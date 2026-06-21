// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Server-component icon guard — `src/components/Icons.tsx` is a 'use client'
 * module whose DEFAULT export is a plain object (`Icon = { X, Bolt, … }`).
 * Its named exports are tracked React client references, but the object's
 * properties are not. So a SERVER component (a file under src/app without a
 * 'use client' directive) that renders `<Icon.X />` crashes `next build` at
 * prerender with: Could not find the module "Icons.tsx#default#X" in the
 * React Client Manifest (this broke production in #212 → fixed in #213).
 *
 * Rule: in src/app, a non-'use client' file must NOT use the default Icon
 * namespace (`import Icon from '.../Icons'` + `<Icon.Foo />`). Use named
 * imports instead — `import { XIcon } from '@/components/Icons'` — which are
 * proper client references that resolve in the manifest.
 *
 * Client components (with 'use client') are unaffected and may use `Icon.*`.
 */
const APP_DIR = join(__dirname, '..', '..', 'app'); // → src/app/
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.git']);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // src/app should exist, but don't hard-fail if layout changes
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

const DEFAULT_ICON_IMPORT = /import\s+Icon\s*(?:,|from)\s*['"][^'"]*\/Icons['"]/;
const NAMESPACE_USAGE = /\bIcon\.[A-Z]\w*/;
const USE_CLIENT = /^\s*['"]use client['"]/m;

describe('no default-namespace Icon in server components', () => {
  it('src/app server components use named icon imports, not Icon.*', () => {
    const offenders: string[] = [];
    for (const file of walk(APP_DIR)) {
      const src = readFileSync(file, 'utf8');
      if (USE_CLIENT.test(src)) continue; // client component — Icon.* is fine
      if (DEFAULT_ICON_IMPORT.test(src) && NAMESPACE_USAGE.test(src)) {
        offenders.push(relative(join(__dirname, '..', '..'), file));
      }
    }
    expect(
      offenders,
      `Server component(s) use the default Icon namespace (<Icon.X />), which ` +
        `breaks next build at prerender. Switch to named imports ` +
        `(import { XIcon } from '@/components/Icons'):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
