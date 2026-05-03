// Daily Ops — types for Gunny's daily-schedule planner.
//
// Stored on `DailyOpsPlan.blocks` (JSON column) and emitted by Gunny
// via the `<daily_ops_json>` channel. Distinct from the Workout
// Planner — this owns the *rhythm* of the day, not the workout
// itself. The Workout Planner is read-only input here: when there's
// a scheduled workout, Gunny anchors the workout block to it and
// pads the surrounding meal / supplement / wind-down blocks.
//
// Design notes:
// - All times are local 'HH:MM' strings. Storing as strings (not
//   Date) so a plan generated in NYC reads the same when the user
//   travels to LA — the operator's local clock is what matters.
// - Each block carries a `rationale` that cites the corpus (e.g.
//   "tier1.caffeine — 30-60 min pre, 3-6 mg/kg"). Gunny is
//   instructed to keep this to one short clause so the UI can show
//   it inline without overflowing.
// - `flexibility` lets the UI render fixed blocks differently from
//   shiftable ones; tactical operators' plans collapse most blocks
//   to `flex_2hr` (Mission Mode — Phase 3).

export type BlockCategory =
  | 'wake'
  | 'sun_exposure'
  | 'caffeine_window_open'  // first dose allowed
  | 'caffeine_cutoff'       // last dose allowed
  | 'meal'
  | 'pre_workout_supp'      // citrulline, creatine, beta-alanine if loading
  | 'workout'               // anchored to Workout Planner if a workout is scheduled
  | 'post_workout'          // protein + carb window
  | 'mobility'              // optional mobility / movement-quality block
  | 'wind_down'             // screens off, lights down, tech triage
  | 'pre_bed_supp'          // glycine, Mg glycinate, tart cherry, melatonin (adults only)
  | 'sleep_target'          // lights-out → wake range
  // Recovery / Phase 2-flavor blocks
  | 'sauna'
  | 'cold_exposure'
  | 'recovery_walk'
  // Junior-specific
  | 'fifa_warmup'           // FIFA 11+ Kids 12-min warmup (junior soccer Tier 3)
  | 'mistake_reset_ritual'; // Smoll-Smith CET ritual (junior coaching corpus)

export type Flexibility = 'fixed' | 'flex_30' | 'flex_2hr';

export type BlockSource = 'gunny_default' | 'gunny_adapted' | 'user_override';

export interface DailyBlock {
  id: string;
  /** Local 'HH:MM'. */
  startTime: string;
  /** Optional local 'HH:MM' end (for windows like sun_exposure 06:10–06:30). */
  endTime?: string;
  category: BlockCategory;
  /** User-facing label, e.g. "Pre-workout citrulline 8g". */
  label: string;
  /** One short clause citing the corpus, e.g. "tier1.citrulline — 60 min pre, 8g 2:1 malate". */
  rationale: string;
  flexibility: Flexibility;
  source: BlockSource;
}

export type FollowedStatus = 'yes' | 'partial' | 'no';
export type PerceivedFit = 'too_early' | 'right' | 'too_late' | 'na';

export interface BlockFeedback {
  followed: FollowedStatus;
  perceivedFit?: PerceivedFit;
  notes?: string;
  /** Where the feedback came from. */
  source: 'tap' | 'chat' | 'wearable_inferred';
  /** ISO timestamp. */
  at: string;
}

export type PlanStatus =
  | 'active'                    // adult flow, immediately visible
  | 'pending_parent_approval'   // junior flow, awaiting parent
  | 'approved'                  // junior flow, parent approved
  | 'rejected';                 // junior flow, parent rejected

export type WorkoutLoad = 'rest' | 'light' | 'moderate' | 'heavy';

export interface DailyOpsBasis {
  /** ISO date the plan covers. Mirrors `DailyOpsPlan.date`. */
  date: string;
  periodizationPhase?: 'accumulation' | 'intensification' | 'deload';
  trainingPath?: string;
  /** Hours below the operator's 7-day mean. Negative = sleep debt. */
  sleepDebtHrs?: number;
  /** 0-100 readiness composite if wearable data available. */
  readinessScore?: number;
  /** Anchored from the Workout Planner; 'rest' if no workout scheduled. */
  workoutLoad?: WorkoutLoad;
  /** ISO time the workout is scheduled for, if any. */
  scheduledWorkoutTime?: string;
}

export interface DailyOpsPlanShape {
  id: string;
  operatorId: string;
  date: string;
  generatedAt: string;
  generatedBy: 'gunny' | 'gunny_adapted' | 'manual';
  status: PlanStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionNotes?: string | null;
  basis: DailyOpsBasis;
  blocks: DailyBlock[];
  notes?: string | null;
  feedback: Record<string, BlockFeedback>;
}

/**
 * Loose-validation guard for the JSON Gunny emits in `<daily_ops_json>`.
 * Returns the parsed payload or null if invalid. Permissive on
 * unknown fields (we keep them for forward compat) but strict on the
 * required shape so a malformed channel can't poison the DB.
 */
export function validateDailyOpsPayload(
  raw: unknown,
): { date: string; basis: DailyOpsBasis; blocks: DailyBlock[]; notes?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const date = typeof obj.date === 'string' ? obj.date : null;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const basis = obj.basis;
  if (!basis || typeof basis !== 'object') return null;

  const blocks = obj.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  const validBlocks: DailyBlock[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    const bl = b as Record<string, unknown>;
    const id = typeof bl.id === 'string' ? bl.id : null;
    const startTime = typeof bl.startTime === 'string' ? bl.startTime : null;
    const category = typeof bl.category === 'string' ? bl.category : null;
    const label = typeof bl.label === 'string' ? bl.label : null;
    const rationale = typeof bl.rationale === 'string' ? bl.rationale : null;
    if (!id || !startTime || !category || !label || !rationale) continue;
    if (!/^\d{2}:\d{2}$/.test(startTime)) continue;
    const endTime =
      typeof bl.endTime === 'string' && /^\d{2}:\d{2}$/.test(bl.endTime)
        ? bl.endTime
        : undefined;
    const flexibility =
      bl.flexibility === 'fixed' || bl.flexibility === 'flex_30' || bl.flexibility === 'flex_2hr'
        ? (bl.flexibility as Flexibility)
        : 'flex_30';
    const source =
      bl.source === 'gunny_adapted' || bl.source === 'user_override'
        ? (bl.source as BlockSource)
        : 'gunny_default';
    validBlocks.push({
      id,
      startTime,
      endTime,
      category: category as BlockCategory,
      label,
      rationale,
      flexibility,
      source,
    });
  }
  if (validBlocks.length === 0) return null;

  return {
    date,
    basis: { ...(basis as DailyOpsBasis), date },
    blocks: validBlocks,
    notes: typeof obj.notes === 'string' ? obj.notes : undefined,
  };
}
