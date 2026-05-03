// Daily Ops — junior guardrails.
//
// Mirrors the spirit of `juniorGuardrails.ts` for the Workout Planner:
// silently scrub or remove blocks that aren't appropriate for the
// junior's age band, with structured logging so we can audit how
// often Gunny tries to violate the rules. The runtime guard is the
// last line of defense — Gunny's prompt is the first.
//
// Age bands:
//   < 13          : strip caffeine, adult supplements, late bedtimes,
//                   alcohol mentions; cap sleep_target start at 21:30
//   13–17         : allow caffeine cap (≤100 mg) but strip adult
//                   supplements (ashwagandha, tongkat ali, bicarb,
//                   melatonin, tribulus, fadogia, turkesterone,
//                   ecdysterone, HMB, DAA)
//   18+           : pass through unchanged

import type { DailyBlock } from './dailyOpsTypes';

const FORBIDDEN_CATEGORIES_UNDER_13 = new Set([
  'caffeine_window_open',
  'caffeine_cutoff',
  'pre_workout_supp',
  'pre_bed_supp',
]);

// Adult supplement names that should never appear in a junior plan,
// even at 13–17. Caffeine is allowed up to 100 mg for adolescents
// per pediatric consensus; these adaptogens / nootropics / esters
// are not.
const ADULT_SUPPLEMENT_RE =
  /\b(ashwagandha|tongkat\s*ali|sodium\s*bicarb(onate)?|NaHCO3|melatonin|tribulus|fadogia|turkesterone|ecdysterone|HMB|d-aspartic|DAA|shilajit|boron|citrulline|beta[-\s]*alanine|creatine\s*HCl)\b/gi;

// Nicotine / alcohol / weight-loss-pharma — never appropriate for
// any junior, regardless of age band.
const FORBIDDEN_SUBSTANCES_RE =
  /\b(alcohol|beer|wine|cocktail|nicotine|pouch|snus|zyn|caffeine pill|fat burner|stim|prohormone|SARM|TRT|testosterone)\b/gi;

const PARSE_HHMM = (s: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

const SLEEP_TARGET_CAP_UNDER_13 = 21 * 60 + 30; // 21:30

export interface JuniorGuardrailResult {
  blocks: DailyBlock[];
  removed: number;
  modified: number;
  reasons: string[];
}

/**
 * Apply junior guardrails to a DailyOps block list.
 * Pure function — does not mutate `inBlocks`.
 *
 * @param inBlocks - blocks emitted by Gunny
 * @param age - junior's age in years (caller passes operator.juniorAge or operator.profile.age)
 */
export function applyJuniorGuardrailsToDailyOps(
  inBlocks: DailyBlock[],
  age: number,
): JuniorGuardrailResult {
  const reasons: string[] = [];
  let removed = 0;
  let modified = 0;

  if (age >= 18) {
    return { blocks: inBlocks, removed, modified, reasons };
  }

  let blocks = inBlocks.slice();

  // Pass 1 — under-13 categorical removals
  if (age < 13) {
    const before = blocks.length;
    blocks = blocks.filter((b) => {
      if (FORBIDDEN_CATEGORIES_UNDER_13.has(b.category)) {
        reasons.push(`removed ${b.category} (under 13)`);
        return false;
      }
      return true;
    });
    removed += before - blocks.length;
  }

  // Pass 2 — under-13 bedtime cap
  if (age < 13) {
    blocks = blocks.map((b) => {
      if (b.category !== 'sleep_target') return b;
      const m = PARSE_HHMM(b.startTime);
      if (m === null) return b;
      if (m > SLEEP_TARGET_CAP_UNDER_13) {
        modified++;
        reasons.push(`bedtime moved ${b.startTime} → 21:30 (under-13 cap)`);
        return {
          ...b,
          startTime: '21:30',
          rationale: `Junior sleep cap (under 13). Original ${b.startTime} exceeded the 21:30 ceiling. ${b.rationale}`,
        };
      }
      return b;
    });
  }

  // Pass 3 — strip forbidden substances from labels & rationales (all junior bands)
  blocks = blocks.map((b) => {
    let label = b.label;
    let rationale = b.rationale;
    let touched = false;
    if (FORBIDDEN_SUBSTANCES_RE.test(label) || FORBIDDEN_SUBSTANCES_RE.test(rationale)) {
      label = label.replace(FORBIDDEN_SUBSTANCES_RE, '[restricted]');
      rationale = rationale.replace(FORBIDDEN_SUBSTANCES_RE, '[restricted]');
      touched = true;
      reasons.push(`scrubbed forbidden substance reference in ${b.id}`);
    }
    if (touched) {
      modified++;
      return { ...b, label, rationale };
    }
    return b;
  });

  // Pass 4 — strip adult-supplement names for 13-17 (under-13 already
  // had pre_workout_supp / pre_bed_supp removed entirely above)
  if (age >= 13 && age < 18) {
    blocks = blocks.map((b) => {
      let label = b.label;
      let rationale = b.rationale;
      let touched = false;
      if (ADULT_SUPPLEMENT_RE.test(label) || ADULT_SUPPLEMENT_RE.test(rationale)) {
        label = label.replace(ADULT_SUPPLEMENT_RE, '[adult supp]');
        rationale = rationale.replace(ADULT_SUPPLEMENT_RE, '[adult supp]');
        touched = true;
        reasons.push(`stripped adult-supplement reference in ${b.id} (13-17)`);
      }
      if (touched) {
        modified++;
        return { ...b, label, rationale };
      }
      return b;
    });
  }

  return { blocks, removed, modified, reasons };
}
