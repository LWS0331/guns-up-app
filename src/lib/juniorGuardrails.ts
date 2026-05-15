// Junior Operator workload guardrails.
//
// Hard caps on plyo volume, RPE, and session duration by maturation stage,
// plus the Jayanthi weekly-hour rule. Cited from docs/youth-soccer-corpus.md
// (sections 2 + 4 + 5).
//
// Used in two places:
//   1. Reference data for SOCCER_YOUTH_PROMPT (so the model already knows
//      the caps and shouldn't produce over-cap workouts).
//   2. Runtime safety net — applyJuniorGuardrailsToWorkout() scans a parsed
//      <workout_json> and silently downscales obvious violations before
//      saving. Belt and suspenders: if the prompt slips, the runtime catches
//      it.
//
// Adult operators bypass everything in this file.

import type { Operator, MaturationStage, Workout, WorkoutBlock, ExerciseBlock } from './types';

// ─── Pure cap helpers ──────────────────────────────────────────────────────

// Jayanthi rule (Jayanthi et al. 2015, AJSM 43:794): weekly organized sport
// hours ≤ chronological age, hard ceiling 16 h/wk regardless of age.
export function getWeeklyHourCap(juniorAge: number): number {
  if (!juniorAge || juniorAge < 1) return 8;
  return Math.min(juniorAge, 16);
}

// Plyo contacts per session by maturation band — Bedoya 2015 / Lloyd YPD model.
// Defaults to the most conservative cap for unknown.
export function getMaxPlyoContacts(stage?: MaturationStage): number {
  switch (stage) {
    case 'pre_phv':
      return 80;
    case 'peri_phv':
      return 120;
    case 'post_phv':
      return 200;
    default:
      return 80;
  }
}

// RPE cap by maturation band — pre-PHV 6/10, peri 7/10, post 8/10.
export function getRpeCap(stage?: MaturationStage): number {
  switch (stage) {
    case 'pre_phv':
      return 6;
    case 'peri_phv':
      return 7;
    case 'post_phv':
      return 8;
    default:
      return 6;
  }
}

// Hard session-duration ceiling for any junior, regardless of age. AAP /
// AOSSM guidance plus the practical observation that >75 min single sessions
// in 10–18 yr olds correlate with disengagement and overuse risk.
export const MAX_JUNIOR_SESSION_MINUTES = 75;

// ─── Workout-level scanning ────────────────────────────────────────────────

// Keywords used to identify plyometric exercises by name. Conservative — we'd
// rather over-flag than miss a high-impact contact.
const PLYO_KEYWORDS = [
  'jump', 'hop', 'bound', 'plyo', 'depth', 'broad', 'tuck',
  'skater', 'pogo', 'box jump', 'lateral bound', 'drop jump',
];

// Pattern matches "5x10", "3 x 8", "4×6" — any sets×reps prescription. Used
// for plyo contact counting and to find sub-blocks for downscaling.
const SETS_REPS_RE = /(\d+)\s*[x×]\s*(\d+)/i;

// Pattern matches "RPE 7" / "@ RPE 8" / "rpe7" — extracts the RPE value from
// a prescription string.
const RPE_RE = /rpe\s*(\d+(?:\.\d+)?)/i;

function isPlyoBlock(block: WorkoutBlock): boolean {
  if (block.type !== 'exercise') return false;
  const name = (block.exerciseName || '').toLowerCase();
  return PLYO_KEYWORDS.some(kw => name.includes(kw));
}

function countPlyoContactsInBlock(block: WorkoutBlock): number {
  if (!isPlyoBlock(block)) return 0;
  if (block.type !== 'exercise') return 0;
  const m = (block.prescription || '').match(SETS_REPS_RE);
  if (!m) return 0;
  return parseInt(m[1], 10) * parseInt(m[2], 10);
}

function countPlyoContacts(blocks: WorkoutBlock[]): number {
  return blocks.reduce((sum, b) => sum + countPlyoContactsInBlock(b), 0);
}

function getMaxRpe(blocks: WorkoutBlock[]): number {
  let max = 0;
  for (const b of blocks) {
    if (b.type !== 'exercise') continue;
    const m = (b.prescription || '').match(RPE_RE);
    if (m) {
      const v = parseFloat(m[1]);
      if (v > max) max = v;
    }
  }
  return max;
}

// Crude session-minute estimate from block count. Each strength/plyo/agility
// block runs ~5 min including transitions; conditioning blocks ~10 min.
// Plus ~15 min for warm-up/cooldown overhead. Good enough as a guardrail
// signal, not a planner-grade estimate.
function estimateSessionMinutes(blocks: WorkoutBlock[]): number {
  let mins = 15;
  for (const b of blocks) {
    if (b.type === 'conditioning') mins += 10;
    else mins += 5;
  }
  return mins;
}

// ─── Public API: cap-check + downscale ────────────────────────────────────

export interface JuniorCapViolation {
  rule: 'plyo_contacts' | 'rpe' | 'session_duration';
  cap: number;
  observed: number;
  detail: string;
}

export interface JuniorWorkoutCheckResult {
  ok: boolean;
  violations: JuniorCapViolation[];
  // The (possibly mutated) workout — caller saves THIS, not the original.
  workout: Workout;
  // True if the workout was modified to fit caps.
  modified: boolean;
  // Human-readable summary of what was downscaled — surfaced to safety log.
  modificationsApplied: string[];
}

// Returns true if the operator is a junior and has the fields we need to
// apply guardrails. Adult operators short-circuit through here unchanged.
export function isJuniorOperator(op: Pick<Operator, 'isJunior'> | undefined | null): boolean {
  return !!op?.isJunior;
}

// Read-only check — does NOT mutate the workout. Use for pre-flight in UI.
export function checkWorkoutAgainstCaps(
  workout: Workout,
  junior: Pick<Operator, 'isJunior' | 'sportProfile' | 'juniorAge'>
): JuniorCapViolation[] {
  if (!junior.isJunior) return [];
  const stage = junior.sportProfile?.maturationStage;
  const violations: JuniorCapViolation[] = [];
  const blocks = workout.blocks || [];

  const plyoMax = getMaxPlyoContacts(stage);
  const plyoObserved = countPlyoContacts(blocks);
  if (plyoObserved > plyoMax) {
    violations.push({
      rule: 'plyo_contacts',
      cap: plyoMax,
      observed: plyoObserved,
      detail: `Plyo contacts ${plyoObserved} exceeds ${stage || 'pre_phv'} cap of ${plyoMax}.`,
    });
  }

  const rpeMax = getRpeCap(stage);
  const rpeObserved = getMaxRpe(blocks);
  if (rpeObserved > rpeMax) {
    violations.push({
      rule: 'rpe',
      cap: rpeMax,
      observed: rpeObserved,
      detail: `RPE ${rpeObserved} exceeds ${stage || 'pre_phv'} cap of ${rpeMax}.`,
    });
  }

  const durationObserved = estimateSessionMinutes(blocks);
  if (durationObserved > MAX_JUNIOR_SESSION_MINUTES) {
    violations.push({
      rule: 'session_duration',
      cap: MAX_JUNIOR_SESSION_MINUTES,
      observed: durationObserved,
      detail: `Estimated session duration ${durationObserved}min exceeds ${MAX_JUNIOR_SESSION_MINUTES}min junior cap.`,
    });
  }

  return violations;
}

// Apply guardrails: scan, downscale in place where possible, return the
// mutated workout + a list of what changed. Silent — caller decides whether
// to surface the modifications.
//
// Downscaling strategy:
//  - Plyo over cap → proportionally reduce reps in plyo blocks
//  - RPE over cap → rewrite "RPE N" tokens in prescriptions to the cap value
//  - Duration over cap → drop trailing exercise blocks until estimate ≤ cap
//    (preserves warm-up + first half of session, sheds accessory work)
export function applyJuniorGuardrailsToWorkout(
  workout: Workout,
  junior: Pick<Operator, 'isJunior' | 'sportProfile' | 'juniorAge'>
): JuniorWorkoutCheckResult {
  if (!junior.isJunior) {
    return { ok: true, violations: [], workout, modified: false, modificationsApplied: [] };
  }

  // Deep clone so we never mutate the caller's reference.
  const w: Workout = JSON.parse(JSON.stringify(workout));
  const stage = junior.sportProfile?.maturationStage;
  const modificationsApplied: string[] = [];
  const violations = checkWorkoutAgainstCaps(w, junior);
  if (violations.length === 0) {
    return { ok: true, violations: [], workout: w, modified: false, modificationsApplied: [] };
  }

  // ── 1. Plyo cap ──────────────────────────────────────────────────────
  const plyoMax = getMaxPlyoContacts(stage);
  const plyoObserved = countPlyoContacts(w.blocks);
  if (plyoObserved > plyoMax) {
    const ratio = plyoMax / plyoObserved;
    for (const b of w.blocks) {
      if (!isPlyoBlock(b) || b.type !== 'exercise') continue;
      const eb = b as ExerciseBlock;
      const m = (eb.prescription || '').match(SETS_REPS_RE);
      if (!m) continue;
      const sets = parseInt(m[1], 10);
      const reps = parseInt(m[2], 10);
      const newReps = Math.max(1, Math.floor(reps * ratio));
      eb.prescription = eb.prescription.replace(SETS_REPS_RE, `${sets}x${newReps}`);
    }
    modificationsApplied.push(
      `Plyo volume scaled ${plyoObserved} → ${countPlyoContacts(w.blocks)} contacts to fit ${stage || 'pre_phv'} cap (${plyoMax}).`
    );
  }

  // ── 2. RPE cap ───────────────────────────────────────────────────────
  const rpeMax = getRpeCap(stage);
  let rpeRewrittenCount = 0;
  for (const b of w.blocks) {
    if (b.type !== 'exercise') continue;
    const eb = b as ExerciseBlock;
    const m = (eb.prescription || '').match(RPE_RE);
    if (!m) continue;
    const observedRpe = parseFloat(m[1]);
    if (observedRpe > rpeMax) {
      eb.prescription = eb.prescription.replace(RPE_RE, `RPE ${rpeMax}`);
      rpeRewrittenCount++;
    }
  }
  if (rpeRewrittenCount > 0) {
    modificationsApplied.push(
      `Capped RPE at ${rpeMax}/10 on ${rpeRewrittenCount} exercise${rpeRewrittenCount === 1 ? '' : 's'} for ${stage || 'pre_phv'} band.`
    );
  }

  // ── 3. Duration cap ──────────────────────────────────────────────────
  // Drop trailing exercise blocks (preserve conditioning where possible —
  // ball-integrated finishers carry training value, accessory strength does
  // not at this volume).
  let droppedCount = 0;
  while (estimateSessionMinutes(w.blocks) > MAX_JUNIOR_SESSION_MINUTES && w.blocks.length > 1) {
    // Find the last exercise block (non-conditioning) and drop it.
    let dropIdx = -1;
    for (let i = w.blocks.length - 1; i >= 0; i--) {
      if (w.blocks[i].type === 'exercise') {
        dropIdx = i;
        break;
      }
    }
    if (dropIdx < 0) break; // no exercise blocks left to drop
    w.blocks.splice(dropIdx, 1);
    droppedCount++;
  }
  if (droppedCount > 0) {
    modificationsApplied.push(
      `Trimmed ${droppedCount} trailing exercise block${droppedCount === 1 ? '' : 's'} to keep session ≤${MAX_JUNIOR_SESSION_MINUTES}min.`
    );
  }

  return {
    ok: true,
    violations,
    workout: w,
    modified: modificationsApplied.length > 0,
    modificationsApplied,
  };
}

// ─── Runtime variant for parsed <workout_json> ─────────────────────────────
// The Gunny route parses workout JSON from the model output as a generic
// record — the blocks lack the id/sortOrder/isLinkedToNext fields a saved
// Workout has (those are filled in by the client-side converter). This
// variant accepts the partial shape, runs the same downscaling, and returns
// the mutated record for the route to relay to the client.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyJuniorGuardrailsToWorkoutJson(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workoutJson: any,
  junior: Pick<Operator, 'isJunior' | 'sportProfile' | 'juniorAge'>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { workout: any; modified: boolean; modificationsApplied: string[] } {
  if (!junior.isJunior || !workoutJson) {
    return { workout: workoutJson, modified: false, modificationsApplied: [] };
  }
  // The downscaler reads only block.type / .exerciseName / .prescription, so
  // the partial shape (no id/sortOrder) is fine — cast for the call.
  const result = applyJuniorGuardrailsToWorkout(workoutJson as Workout, junior);
  return {
    workout: result.workout,
    modified: result.modified,
    modificationsApplied: result.modificationsApplied,
  };
}
