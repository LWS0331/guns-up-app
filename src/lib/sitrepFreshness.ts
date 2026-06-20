// Sitrep freshness — detect when the operator's stored battle plan
// (operator.sitrep) has diverged from their CURRENT training preferences.
//
// The sitrep is generated once and frozen; if the operator later changes
// their split or days/week (via preferences), the plan silently describes
// programming they no longer run. Issue #201, option 2: surface that
// divergence so the plan self-corrects via a one-tap regenerate, rather
// than coaching off a stale plan indefinitely.
//
// Pure + synchronous so it's unit-testable and cheap to call on render.

import type { Operator } from './types';
import { getAppTodayStr, getDateStrInTimezone } from './dateUtils';

/**
 * True when the stored sitrep was generated on an earlier app-calendar day
 * than `today`. The sitrep's embedded `today` workout + nutrition framing
 * are a day-N snapshot, so a prior-day sitrep is stale. Used (alongside
 * divergence) to surface the one-tap "regenerate" banner.
 *
 * Both `generatedDate` and the default `today` are normalized to the app
 * timezone (Pacific) — matching the MCP projection's `toPacificDay` and the
 * digest's `getAppTodayStr` — so staleness agrees across surfaces instead
 * of flipping on a UTC-vs-Pacific server.
 */
export function isSitrepStale(
  operator: Pick<Operator, 'sitrep'> | null | undefined,
  today?: string,
): boolean {
  const gen = operator?.sitrep?.generatedDate;
  if (!gen) return false;
  const d = new Date(gen);
  if (Number.isNaN(d.getTime())) return false;
  const genDay = getDateStrInTimezone(d); // app-TZ (Pacific) YYYY-MM-DD
  const todayStr = today ?? getAppTodayStr();
  return genDay !== todayStr;
}


/** Normalize a split label for comparison: lowercase, drop parenthetical
 *  qualifiers ("(Sciatic-Adapted)", "(2 on / 1 off)"), collapse
 *  punctuation/whitespace. So "Upper / Lower 4-Day Split" and
 *  "upper/lower 4 day split" compare equal, but "Bro Split" ≠ "Upper/Lower". */
function normalizeSplit(s: string | null | undefined): string {
  if (!s || typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')   // strip parenthetical qualifiers
    .replace(/[^a-z0-9]+/g, ' ')  // punctuation → space
    .trim();
}

// Structural words + bare numbers carry no "split family" signal — only
// the distinctive tokens (bro, upper, lower, push, pull, legs, arnold, …)
// identify which split it is.
const GENERIC_SPLIT_TOKENS = new Set([
  'split', 'day', 'days', 'week', 'weeks', 'rotation', 'on', 'off',
  'plan', 'program', 'routine', 'cycle',
]);

function distinctiveTokens(s: string | null | undefined): string[] {
  return normalizeSplit(s)
    .split(' ')
    .filter((t) => t && !GENERIC_SPLIT_TOKENS.has(t) && !/^\d+$/.test(t));
}

/**
 * True when two split labels name different split *families*. Uses
 * distinctive-token overlap rather than exact equality so that the
 * free-form, LLM-authored `sitrep.trainingPlan.split` label doesn't
 * register as "changed" just because it's phrased differently from the
 * operator's `preferences.split` (e.g. "Bro Split" vs "5-Day Bro Split"
 * → same family). Only a genuine family change (e.g. "Bro Split" vs
 * "Upper/Lower") — zero shared distinctive tokens — counts as diverged.
 * Returns false when either side has no distinctive token (not enough
 * signal to claim divergence).
 */
function splitFamilyDiffers(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = distinctiveTokens(a);
  const db = distinctiveTokens(b);
  if (da.length === 0 || db.length === 0) return false;
  return !da.some((t) => db.includes(t));
}

export interface SitrepDivergence {
  /** True when the stored plan no longer matches current preferences. */
  diverged: boolean;
  /** Short human-readable reason (null when not diverged). */
  reason: string | null;
}

const NOT_DIVERGED: SitrepDivergence = { diverged: false, reason: null };

/**
 * Compare the operator's current training preferences against the split +
 * days/week baked into their stored sitrep. Returns a divergence verdict
 * with a reason suitable for a UI prompt. Conservative: only flags when
 * BOTH sides have a comparable value and they differ — a missing field is
 * never treated as divergence (avoids false positives on partial data).
 */
export function detectSitrepDivergence(
  operator: Pick<Operator, 'preferences' | 'sitrep'> | null | undefined,
): SitrepDivergence {
  const sitrep = operator?.sitrep;
  const plan = sitrep?.trainingPlan;
  const prefs = operator?.preferences;
  if (!sitrep || !plan || !prefs) return NOT_DIVERGED;

  const reasons: string[] = [];

  if (splitFamilyDiffers(prefs.split, plan.split)) {
    reasons.push(`your split is now "${prefs.split}" but this plan was built for "${plan.split}"`);
  }

  const prefDays = typeof prefs.daysPerWeek === 'number' ? prefs.daysPerWeek : null;
  const planDays = typeof plan.daysPerWeek === 'number' ? plan.daysPerWeek : null;
  if (prefDays != null && planDays != null && prefDays !== planDays) {
    reasons.push(`you train ${prefDays} days/week now but this plan is built for ${planDays}`);
  }

  return reasons.length > 0
    ? { diverged: true, reason: reasons.join('; ') }
    : NOT_DIVERGED;
}
