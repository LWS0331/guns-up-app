// Intake audit helper.
//
// Returns a tiered list of intake fields that are missing for an operator.
// The Gunny route surfaces this in the prompt context and tells the model
// to ask for the missing answers conversationally — one or two at a time —
// before producing programming advice that depends on them. Answers come
// back via <profile_json> (which now accepts an `intake` section, see
// src/components/GunnyChat.tsx::applyProfileData).
//
// Tiers:
//   critical  — required for ANY workout to be high quality
//   important — improves prescription quality + safety
//   useful    — sanity checks (nutrition gap surfacing, etc.)
//
// The route uses the critical tier as a soft gate: when it has critical
// gaps AND the user's message would benefit from the missing data
// (workout, programming, nutrition advice), Gunny asks BEFORE answering.

import type { Operator } from './types';

export type IntakeGapField =
  // critical (workout shape)
  | 'preferredSplit'
  | 'daysPerWeek'
  | 'sessionDuration'
  | 'trainingPath'
  | 'availableEquipment'
  // important (programming quality + safety)
  | 'trainingAge'
  | 'experienceYears'
  | 'primaryGoal'
  | 'currentActivity'
  | 'exerciseHistory'
  | 'healthConditions'
  | 'injuryHistory'
  // useful (nutrition + recovery sanity)
  | 'estimatedCalories'
  | 'dietaryRestrictions'
  | 'currentDiet'
  | 'mealsPerDay'
  | 'dailyWaterOz'
  | 'sleepQuality'
  | 'stressLevel';

export interface IntakeGapEntry {
  field: IntakeGapField;
  /** Conversational label Gunny can use when asking about this field. */
  prompt: string;
  /** Where the field lives — Gunny encodes this in <profile_json> so the
   *  client merges it into the right slot. */
  target: 'preferences' | 'intake' | 'profile';
}

export interface IntakeGapAudit {
  critical: IntakeGapEntry[];
  important: IntakeGapEntry[];
  useful: IntakeGapEntry[];
  /** Total fields evaluated minus filled — handy for a "X% complete" UI. */
  totalChecked: number;
  totalFilled: number;
}

const FIELD_LIBRARY: Record<IntakeGapField, { tier: 'critical' | 'important' | 'useful'; prompt: string; target: IntakeGapEntry['target'] }> = {
  // ─── critical ─────────────────────────────────────────────────────────
  preferredSplit: {
    tier: 'critical',
    prompt: 'What training split do you prefer? (Bro Split, Push/Pull/Legs, Upper/Lower, Full Body, etc.)',
    target: 'preferences',
  },
  daysPerWeek: {
    tier: 'critical',
    prompt: 'How many days per week can you train?',
    target: 'preferences',
  },
  sessionDuration: {
    tier: 'critical',
    prompt: 'How long do you want each session to be? (in minutes)',
    target: 'preferences',
  },
  trainingPath: {
    tier: 'critical',
    prompt: 'What\'s your training focus — bodybuilding/hypertrophy, powerlifting, athletic performance, tactical, or hybrid?',
    target: 'intake',
  },
  availableEquipment: {
    tier: 'critical',
    prompt: 'What equipment do you have access to? (full gym, home rack, dumbbells only, bodyweight, etc.)',
    target: 'preferences',
  },
  // ─── important ────────────────────────────────────────────────────────
  trainingAge: {
    tier: 'important',
    prompt: 'How long have you been training consistently? (e.g. 2 years, 6 months)',
    target: 'profile',
  },
  experienceYears: {
    tier: 'important',
    prompt: 'How many years of consistent lifting do you have?',
    target: 'intake',
  },
  primaryGoal: {
    tier: 'important',
    prompt: 'What\'s your primary goal right now?',
    target: 'intake',
  },
  currentActivity: {
    tier: 'important',
    prompt: 'How active are you outside the gym? (sedentary, lightly active, active, very active, athlete)',
    target: 'intake',
  },
  exerciseHistory: {
    tier: 'important',
    prompt: 'How would you describe your exercise history — sporadic, consistent beginner, intermediate, advanced?',
    target: 'intake',
  },
  healthConditions: {
    tier: 'important',
    prompt: 'Any health conditions I should know about? (cardiovascular, diabetes, asthma, joint pain, etc. — or "none")',
    target: 'intake',
  },
  injuryHistory: {
    tier: 'important',
    prompt: 'Any injuries — current or past — that affect training?',
    target: 'intake',
  },
  // ─── useful ───────────────────────────────────────────────────────────
  estimatedCalories: {
    tier: 'useful',
    prompt: 'Roughly how many calories do you eat per day?',
    target: 'intake',
  },
  dietaryRestrictions: {
    tier: 'useful',
    prompt: 'Any dietary restrictions? (allergies, vegan, halal, etc. — or "none")',
    target: 'intake',
  },
  currentDiet: {
    tier: 'useful',
    prompt: 'What\'s your current nutrition approach? (no plan, basic tracking, strict macros, meal prep, keto, etc.)',
    target: 'intake',
  },
  mealsPerDay: {
    tier: 'useful',
    prompt: 'How many meals per day do you typically eat?',
    target: 'intake',
  },
  dailyWaterOz: {
    tier: 'useful',
    prompt: 'How many ounces of water do you drink per day?',
    target: 'intake',
  },
  sleepQuality: {
    tier: 'useful',
    prompt: 'How would you rate your sleep quality on a 1-10 scale?',
    target: 'intake',
  },
  stressLevel: {
    tier: 'useful',
    prompt: 'How would you rate your daily stress on a 1-10 scale?',
    target: 'intake',
  },
};

/** Read the field's actual current value from the operator across the three
 *  storage slots. Returns null/empty when missing. */
function readField(operator: Operator, field: IntakeGapField): unknown {
  const intake = operator.intake as unknown as Record<string, unknown> | undefined;
  const prefs = operator.preferences as unknown as Record<string, unknown> | undefined;
  const profile = operator.profile as unknown as Record<string, unknown> | undefined;
  switch (field) {
    case 'preferredSplit':         return prefs?.split;
    case 'daysPerWeek':            return prefs?.daysPerWeek;
    case 'sessionDuration':        return prefs?.sessionDuration;
    case 'availableEquipment':     return Array.isArray(prefs?.equipment) ? (prefs.equipment as unknown[]).length : 0;
    case 'trainingPath':           return intake?.trainingPath;
    case 'trainingAge':            return profile?.trainingAge;
    case 'experienceYears':        return intake?.experienceYears;
    case 'primaryGoal':            return intake?.primaryGoal;
    case 'currentActivity':        return intake?.currentActivity;
    case 'exerciseHistory':        return intake?.exerciseHistory;
    case 'healthConditions':       return Array.isArray(intake?.healthConditions) ? (intake.healthConditions as unknown[]).length : 0;
    case 'injuryHistory':          return Array.isArray(intake?.injuryHistory) ? (intake.injuryHistory as unknown[]).length : 0;
    case 'estimatedCalories':      return intake?.estimatedCalories;
    case 'dietaryRestrictions':    return Array.isArray(intake?.dietaryRestrictions) ? (intake.dietaryRestrictions as unknown[]).length : 0;
    case 'currentDiet':            return intake?.currentDiet;
    case 'mealsPerDay':            return intake?.mealsPerDay;
    case 'dailyWaterOz':           return intake?.dailyWaterOz;
    case 'sleepQuality':           return intake?.sleepQuality;
    case 'stressLevel':            return intake?.stressLevel;
  }
}

/** A field counts as "filled" when its value is non-empty. Numeric fields
 *  must be > 0 (sessionDuration: 0 is meaningless). String fields must be
 *  non-empty trimmed. Array fields handled by readField returning length. */
function isFieldFilled(field: IntakeGapField, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return value > 0;
  // Array fields: readField returns length, so we treat 0 as not filled.
  return Boolean(value);
}

/** Main entry point. Returns the gap audit with fields grouped by tier. */
export function getIntakeGaps(operator: Operator): IntakeGapAudit {
  const out: IntakeGapAudit = {
    critical: [],
    important: [],
    useful: [],
    totalChecked: 0,
    totalFilled: 0,
  };

  const fieldNames = Object.keys(FIELD_LIBRARY) as IntakeGapField[];
  for (const field of fieldNames) {
    out.totalChecked++;
    const value = readField(operator, field);
    if (isFieldFilled(field, value)) {
      out.totalFilled++;
      continue;
    }
    const meta = FIELD_LIBRARY[field];
    out[meta.tier].push({ field, prompt: meta.prompt, target: meta.target });
  }

  return out;
}

/** Compact percentage for UI surfaces. */
export function intakeCompletenessPercent(audit: IntakeGapAudit): number {
  if (audit.totalChecked === 0) return 100;
  return Math.round((audit.totalFilled / audit.totalChecked) * 100);
}
