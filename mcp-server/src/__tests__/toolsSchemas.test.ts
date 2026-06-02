// @vitest-environment node
//
// Regression guard for the $ref-in-tools/list bug filed 2026-06-01.
//
// The MCP SDK serializes registerTool() inputSchemas via
// zod-to-json-schema without `$refStrategy: 'none'`. Any zod schema
// REUSED across two fields of the same object (e.g. `from` and `to`)
// gets emitted as `{ "$ref": "#/properties/<first-use>" }` instead of
// an inlined schema. Claude.ai's connector — and the MCP spec client —
// don't resolve intra-schema $refs in tool param schemas, so the second
// field arrives as null and the server rejects with -32602.
//
// The fix is to make every shared schema a factory (DATE_KEY() instead
// of DATE_KEY); this test walks every tool the registry produces and
// fails if any inputSchema contains a `$ref`. Re-introducing a shared
// schema instance in any future tool will trip this.

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { DATE_KEY, registerAllTools } from '../tools.js';

interface CapturedTool {
  name: string;
  config: { inputSchema?: z.ZodRawShape; description?: string };
}

class SpyServer {
  tools: CapturedTool[] = [];
  registerTool(name: string, config: CapturedTool['config'], _handler: unknown): void {
    this.tools.push({ name, config });
  }
}

function findRefs(value: unknown, path = '$'): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(value)) {
    const nextPath = `${path}.${k}`;
    if (k === '$ref' && typeof v === 'string') {
      out.push(`${nextPath} = ${v}`);
    }
    if (typeof v === 'object' && v !== null) {
      out.push(...findRefs(v, nextPath));
    }
  }
  return out;
}

describe('DATE_KEY factory', () => {
  it('returns a fresh ZodString instance each call', () => {
    // Identity test — if these were the same reference, zodToJsonSchema
    // would emit a $ref the second time it appears in a schema.
    expect(DATE_KEY()).not.toBe(DATE_KEY());
  });

  it('produces no $ref when used twice in the same object', () => {
    const schema = z.object({ from: DATE_KEY(), to: DATE_KEY() });
    const json = zodToJsonSchema(schema);
    expect(findRefs(json)).toEqual([]);
  });

  it('WOULD emit a $ref if naively aliased (this is the bug we prevent)', () => {
    // Sanity check that the bug is real — if this assertion ever flips,
    // either the SDK started passing $refStrategy: 'none' (we can revert
    // the factory) or zod-to-json-schema changed its default behavior.
    const aliased = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    const schema = z.object({ from: aliased, to: aliased });
    const json = zodToJsonSchema(schema);
    expect(findRefs(json).length).toBeGreaterThan(0);
  });
});

describe('every registered tool inputSchema is $ref-free', () => {
  const spy = new SpyServer();
  // The handler closures call out to the GunnyApiClient at invocation
  // time. We never invoke handlers in this test — registration alone is
  // synchronous and only reads the inputSchema — so an unconfigured
  // stub client is enough.
  const stubClient = {} as Parameters<typeof registerAllTools>[1];
  registerAllTools(spy as unknown as Parameters<typeof registerAllTools>[0], stubClient);

  it('registers at least all known nutrition + workout-range tools', () => {
    const names = spy.tools.map((t) => t.name);
    expect(names).toContain('get_workouts_in_range');
    expect(names).toContain('get_client_workouts_in_range');
    expect(names).toContain('get_my_nutrition_in_range');
  });

  // Drive a per-tool test so a failure points at the exact tool that
  // regressed instead of a single aggregate "$ref found somewhere"
  // message.
  for (const tool of spy.tools) {
    it(`${tool.name} publishes no $ref`, () => {
      const shape = tool.config.inputSchema ?? {};
      const schema = z.object(shape);
      const json = zodToJsonSchema(schema);
      const refs = findRefs(json);
      expect(refs, `unexpected $ref in ${tool.name}: ${refs.join(', ')}`).toEqual([]);
    });
  }
});
