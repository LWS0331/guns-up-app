// Macrocycle block library — periodization templates per goal type.
//
// Each template returns an ordered list of "block specs" (relative to the
// goal date). The engine in src/lib/macrocycle.ts converts these into
// concrete MacroBlock entries with absolute startDate/endDate by walking
// backwards from the goal date.
//
// Citations (where the templates come from):
//   - Powerlifting meet: classic Westside / RTS / Sheiko 12-16 wk peak —
//     general prep → specific prep → competition prep → taper.
//   - Hypertrophy: NSCA daily-undulating w/ accumulation/intensification
//     blocks per Lloyd & Oliver YPD adult adaptation; Helms 3MMC.
//   - Season prep: Bompa periodization for in-season athletes — off-season
//     base → pre-season specific → in-season maintenance + taper for
//     tournaments.
//   - Fat loss: Helms / Lyle McDonald linear cut → refeed → cut → stabilize.
//
// V1 keeps templates fixed-length per goal type. Adapting nominal weeks to
// the actual operator-to-goal interval is the engine's job (it stretches
// or compresses the FIRST block in the sequence to fit).

import type {
  MacroBlockKind,
  MacroBlockCompatibility,
  MacroGoalType,
  MacroPerformanceMarker,
} from './types';

export interface BlockSpec {
  kind: MacroBlockKind;
  name: string;
  /** Nominal duration in weeks. The engine compresses/extends only the
   *  general-prep / accumulation block at the start of the cycle; later
   *  blocks (peak, taper, deload) keep their nominal duration because
   *  shortening a peak doesn't make a peak. */
  durationWeeks: number;
  compatibility: MacroBlockCompatibility;
  volumeMultiplier: number;
  intensityMultiplier: number;
  description: string;
  performanceMarker?: MacroPerformanceMarker;
  /** True for the front block(s) of the cycle that the engine is allowed
   *  to compress/extend to fit the operator-to-goal interval. */
  flexible?: boolean;
}

/** Standard 12–16 wk powerlifting meet macrocycle. Last 6 wk are fixed
 *  (specific prep + peak + taper); earlier general-prep flexes. */
const POWERLIFTING_MEET: BlockSpec[] = [
  {
    kind: 'general_prep',
    name: 'General Prep',
    durationWeeks: 4,
    compatibility: 'concurrent_with_secondary',
    volumeMultiplier: 1.10,
    intensityMultiplier: 0.70,
    description: 'Hypertrophy bias, build work capacity. RPE 7-8, 65-75% 1RM.',
    flexible: true,
    performanceMarker: {
      label: 'Sustain 4 working sets at RPE 7 across the big 3',
      kind: 'compliance_rate',
      threshold: 80,
      advanceEarlyDaysAllowed: 7,
    },
  },
  {
    kind: 'specific_prep',
    name: 'Specific Prep',
    durationWeeks: 4,
    compatibility: 'concurrent_with_secondary',
    volumeMultiplier: 1.00,
    intensityMultiplier: 0.85,
    description: 'Competition movements at 80-87% 1RM. Cut accessory volume.',
    performanceMarker: {
      label: 'Hit 5x3 @ 85% on competition lifts',
      kind: 'intensity_target',
      threshold: 85,
      advanceEarlyDaysAllowed: 5,
    },
  },
  {
    kind: 'peak',
    name: 'Competition Prep / Peak',
    durationWeeks: 3,
    compatibility: 'exclusive',
    volumeMultiplier: 0.85,
    intensityMultiplier: 0.95,
    description: '88-95% 1RM doubles and singles. Volume drops, intensity climbs.',
    performanceMarker: {
      label: 'Open attempt felt smooth (planned opener × 1)',
      kind: 'intensity_target',
      threshold: 92,
      advanceEarlyDaysAllowed: 3,
    },
  },
  {
    kind: 'taper',
    name: 'Taper',
    durationWeeks: 1,
    compatibility: 'exclusive',
    volumeMultiplier: 0.50,
    intensityMultiplier: 1.00,
    description: 'Last week. Singles only, openers + light volume. Sleep + carbs.',
  },
];

/** Hypertrophy phase — accumulation/intensification mesocycle pair w/ deload. */
const HYPERTROPHY_PHASE: BlockSpec[] = [
  {
    kind: 'accumulation',
    name: 'Accumulation 1',
    durationWeeks: 4,
    compatibility: 'concurrent_with_secondary',
    volumeMultiplier: 1.20,
    intensityMultiplier: 0.70,
    description: 'High volume, RPE 7-8. Push sets per muscle group.',
    flexible: true,
    performanceMarker: {
      label: 'Add 1+ rep at same weight on 2/3 indicator lifts',
      kind: 'pr_progression',
      threshold: 1,
      advanceEarlyDaysAllowed: 5,
    },
  },
  {
    kind: 'intensification',
    name: 'Intensification 1',
    durationWeeks: 3,
    compatibility: 'concurrent_with_secondary',
    volumeMultiplier: 1.00,
    intensityMultiplier: 0.85,
    description: 'Drop volume ~15%, push load. RPE 8-9 on top sets.',
    performanceMarker: {
      label: 'Add 5-10 lbs on indicator lifts at same reps',
      kind: 'pr_progression',
      threshold: 5,
      advanceEarlyDaysAllowed: 3,
    },
  },
  {
    kind: 'deload',
    name: 'Deload',
    durationWeeks: 1,
    compatibility: 'exclusive',
    volumeMultiplier: 0.50,
    intensityMultiplier: 0.60,
    description: 'Half volume, half intensity. Active recovery week.',
  },
  {
    kind: 'accumulation',
    name: 'Accumulation 2',
    durationWeeks: 4,
    compatibility: 'concurrent_with_secondary',
    volumeMultiplier: 1.25,
    intensityMultiplier: 0.75,
    description: 'Highest-volume block of the phase. Push to MRV.',
    performanceMarker: {
      label: 'Sustain volume bump for full block w/o RPE creep',
      kind: 'compliance_rate',
      threshold: 85,
      advanceEarlyDaysAllowed: 5,
    },
  },
];

/** Season prep — for athletes with a competition period. Bompa structure. */
const SEASON_PREP: BlockSpec[] = [
  {
    kind: 'general_prep',
    name: 'Off-Season Base',
    durationWeeks: 6,
    compatibility: 'concurrent_with_secondary',
    volumeMultiplier: 1.10,
    intensityMultiplier: 0.80,
    description: 'GPP — capacity, mobility, foundational strength. Sport-light.',
    flexible: true,
    performanceMarker: {
      label: 'Hit conditioning standard (Yo-Yo IR1 / 30-15 IFT progression)',
      kind: 'volume_target',
      threshold: 80,
      advanceEarlyDaysAllowed: 7,
    },
  },
  {
    kind: 'specific_prep',
    name: 'Pre-Season',
    durationWeeks: 4,
    compatibility: 'concurrent_with_secondary',
    volumeMultiplier: 1.00,
    intensityMultiplier: 0.90,
    description: 'Sport-specific power + speed. Re-introduce match volume.',
    performanceMarker: {
      label: '90% of position-specific match-pace volume',
      kind: 'intensity_target',
      threshold: 90,
      advanceEarlyDaysAllowed: 3,
    },
  },
  {
    kind: 'maintenance',
    name: 'In-Season Maintenance',
    durationWeeks: 2,
    compatibility: 'concurrent_only',
    volumeMultiplier: 0.70,
    intensityMultiplier: 0.85,
    description: 'Lift 1-2x/wk to maintain. Match-day is the real work.',
  },
  {
    kind: 'taper',
    name: 'Tournament Taper',
    durationWeeks: 1,
    compatibility: 'exclusive',
    volumeMultiplier: 0.55,
    intensityMultiplier: 0.90,
    description: 'Final week. Sharpen, don\'t fatigue. Walkthrough drills only.',
  },
];

/** Fat loss — linear cut with refeed/stabilization phases. */
const FAT_LOSS: BlockSpec[] = [
  {
    kind: 'cut',
    name: 'Initial Cut',
    durationWeeks: 4,
    compatibility: 'concurrent_with_secondary',
    volumeMultiplier: 1.00,
    intensityMultiplier: 0.85,
    description: '500 kcal deficit. Maintain training volume, expect mild RPE creep.',
    flexible: true,
    performanceMarker: {
      label: 'Avg 0.5-1.0% body weight loss per week, no PR regression',
      kind: 'compliance_rate',
      threshold: 75,
      advanceEarlyDaysAllowed: 5,
    },
  },
  {
    kind: 'transition',
    name: 'Refeed Week',
    durationWeeks: 1,
    compatibility: 'exclusive',
    volumeMultiplier: 0.85,
    intensityMultiplier: 0.85,
    description: 'Maintenance calories. Restore performance + leptin. No cut.',
  },
  {
    kind: 'cut',
    name: 'Continued Cut',
    durationWeeks: 4,
    compatibility: 'concurrent_with_secondary',
    volumeMultiplier: 0.90,
    intensityMultiplier: 0.85,
    description: 'Resume deficit. Watch for PR regression — stop if >5% drop.',
    performanceMarker: {
      label: 'Hit goal weight or BF% within 3% of target',
      kind: 'pr_progression',
      threshold: 3,
      advanceEarlyDaysAllowed: 7,
    },
  },
  {
    kind: 'transition',
    name: 'Stabilization',
    durationWeeks: 2,
    compatibility: 'concurrent_with_secondary',
    volumeMultiplier: 0.95,
    intensityMultiplier: 0.85,
    description: 'Slow caloric return to maintenance. Lock in the new bodyweight.',
  },
];

/** Lookup — picks the canonical template for a goal type. */
export function getTemplateForGoal(type: MacroGoalType): BlockSpec[] {
  switch (type) {
    case 'powerlifting_meet':
      return POWERLIFTING_MEET;
    case 'hypertrophy_phase':
      return HYPERTROPHY_PHASE;
    case 'season_prep':
      return SEASON_PREP;
    case 'fat_loss':
      return FAT_LOSS;
  }
}

/** Sum of nominal weeks for a goal-type template. Useful for the UI to
 *  warn "your goal is N weeks out, the template needs X weeks — flexible
 *  blocks will compress to fit." */
export function getTemplateNominalWeeks(type: MacroGoalType): number {
  return getTemplateForGoal(type).reduce((s, b) => s + b.durationWeeks, 0);
}
