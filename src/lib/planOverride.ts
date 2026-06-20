// Head-trainer plan override — pure lock/merge helpers.
//
// A head trainer (see HEAD_TRAINER_ACCESS in types.ts) can take over an
// operator's daily plan (sitrep/dailyBrief). The plan itself is written
// into the operator's existing `sitrep` / `dailyBrief` columns so the app
// renders it unchanged; this module owns the small `operator.planOverride`
// flag that records the takeover and gates the generate-on-read refresh.
//
// Lifecycle (per product decision: "permanent takeover"):
//   - applyOverride → active:true; the daily plan stays trainer-managed
//     and is NEVER auto-regenerated until released.
//   - releaseOverride → active:false; auto-generation resumes.
//
// Both the PATCH /api/operators/:id/daily-plan route and the MCP
// set_(client_)daily_plan tools go through here, so the version bump +
// timestamp + lockedBy stamp happen in exactly one place. Pure (no DB,
// no SDK) so it's unit-testable.

import type { PlanOverride } from './types';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Coerce the raw JSON column into a PlanOverride, or null when unset ({}). */
export function readPlanOverride(raw: unknown): PlanOverride | null {
  if (!isPlainObject(raw) || typeof raw.version !== 'number') return null;
  return raw as unknown as PlanOverride;
}

/**
 * True when this operator's daily plan is currently under head-trainer
 * takeover — the signal the generate-on-read refresh checks before
 * regenerating or flagging the plan stale.
 */
export function isPlanLocked(
  operator: { planOverride?: unknown } | null | undefined,
): boolean {
  const ov = readPlanOverride(operator?.planOverride);
  return !!ov && ov.active === true;
}

/**
 * Apply a head-trainer override: mark the plan locked, stamp who/when,
 * bump version. Pure — does not mutate its input.
 */
export function applyOverride(
  existingRaw: unknown,
  opts: { lockedBy: string; note?: string; now?: string },
): PlanOverride {
  const existing = isPlainObject(existingRaw) ? existingRaw : {};
  const prevVersion = typeof existing.version === 'number' ? (existing.version as number) : 0;
  const out: PlanOverride = {
    active: true,
    lockedBy: opts.lockedBy,
    lockedAt: opts.now ?? new Date().toISOString(),
    version: prevVersion + 1,
  };
  // Preserve a prior note unless a new one is supplied; allow clearing
  // with an explicit empty string.
  if (opts.note !== undefined) {
    if (opts.note !== '') out.note = opts.note;
  } else if (typeof existing.note === 'string' && existing.note) {
    out.note = existing.note as string;
  }
  return out;
}

/**
 * Release the override: auto-generation resumes. Keeps the version
 * counter and lockedBy/at as an audit trail of who last touched it.
 */
export function releaseOverride(
  existingRaw: unknown,
  opts: { lockedBy: string; now?: string } = { lockedBy: '' },
): PlanOverride {
  const existing = isPlainObject(existingRaw) ? existingRaw : {};
  const prevVersion = typeof existing.version === 'number' ? (existing.version as number) : 0;
  return {
    active: false,
    lockedBy: opts.lockedBy || (typeof existing.lockedBy === 'string' ? (existing.lockedBy as string) : ''),
    lockedAt: opts.now ?? new Date().toISOString(),
    version: prevVersion + 1,
  };
}
