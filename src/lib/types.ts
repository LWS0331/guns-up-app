// User / Operator types
import { TIER_MODEL_MAP } from './models';

export type UserRole = 'trainer' | 'client';
export type AiTier = 'haiku' | 'sonnet' | 'opus' | 'white_glove';
export type TrainerRank = 'recruit' | 'sergeant' | 'lieutenant' | 'captain' | 'general';
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type AvatarStyle = 'male-1' | 'male-2' | 'male-3' | 'female-1' | 'female-2' | 'female-3' | 'custom';

// Team system
export interface Team {
  id: string;
  name: string;
  trainerId: string;
  memberIds: string[];
}

export const TEAMS: Team[] = [
  { id: 'team-wolf-pack', name: 'WOLF PACK', trainerId: 'op-ruben', memberIds: ['op-ruben', 'op-rosa', 'op-erika', 'op-efrain', 'op-aldo', 'op-edgar', 'op-jasmine', 'op-patty', 'op-poppy'] },
  { id: 'team-madheart', name: 'MADHEART', trainerId: 'op-britney', memberIds: ['op-britney', 'op-mary', 'op-harold', 'op-jonathan', 'op-natalie', 'op-arnold', 'op-lynette'] },
];

// Intake assessment types
export interface IntakeAssessment {
  completed: boolean;
  completedDate?: string;
  fitnessLevel: FitnessLevel;
  experienceYears: number;
  primaryGoal: string;
  secondaryGoals: string[];
  healthConditions: string[];
  currentActivity: string; // sedentary, lightly_active, active, very_active, athlete
  exerciseHistory: string; // none, sporadic, consistent_beginner, consistent_intermediate, advanced_athlete
  movementScreenScore: number; // 1-10 based on self-reported mobility
  injuryHistory: string[];
  injuryNotes?: string; // raw free-text injury descriptions from intake
  availableEquipment: string[];
  preferredWorkoutTime: string;
  motivationFactors: string[];
  sleepQuality: number; // 1-10
  stressLevel: number; // 1-10
  nutritionHabits: string; // poor, fair, good, excellent
  // Nutrition intake data
  mealsPerDay?: number;
  currentDiet?: string; // no_plan, basic_tracking, strict_macros, meal_prep, keto, paleo, vegan, vegetarian, mediterranean, other
  dailyWaterOz?: number;
  supplements?: string[];
  estimatedCalories?: number;
  proteinPriority?: string; // low, moderate, high, very_high
  dietaryRestrictions?: string[];
  wearableDevice?: string;
  daysPerWeek?: number; // training days per week (2-7)
  sessionDuration?: number; // minutes per session
  preferredSplit?: string; // PPL, Upper/Lower, Full Body, Bro Split, etc.
  trainingPath?: string; // bodybuilding, crossfit, powerlifting, athletic, tactical, hybrid, gunny_pick
  startingPRs: { exercise: string; weight: number; reps: number }[];
}

// Leaderboard types
export interface LeaderboardEntry {
  operatorId: string;
  callsign: string;
  teamId: string;
  points: number;
  streak: number;
  workoutsCompleted: number;
  mealsLogged: number;
  prsHit: number;
  consistencyScore: number; // percentage of planned days completed
}

export const LEADERBOARD_POINTS = {
  workoutCompleted: 10,
  mealLogged: 3,
  prHit: 25,
  streakBonus7: 50,
  streakBonus30: 200,
  intakeCompleted: 100,
  wearableConnected: 50,
};

export interface TierConfig {
  name: string;
  codename: string; // RECON, OPERATOR, COMMANDER, WARFIGHTER
  model: string;
  monthlyPrice: number;
  annualPrice: number; // 17% discount
  trainerShare: number;
  platformShare: number;
  apiCostEstimate: number; // with caching
  stripeFee: number;
  infraCost: number;
  margin: number; // percentage
  features: string[];
}

export interface TrainerRankConfig {
  name: string;
  minClients: number;
  maxClients: number | null;
  shareBonus: number; // percentage bonus on trainer share
  perks: string[];
}

export const TRAINER_RANKS: Record<TrainerRank, TrainerRankConfig> = {
  recruit: { name: 'RECRUIT', minClients: 0, maxClients: 10, shareBonus: 0, perks: ['Free Opus-powered trainer account', 'Basic dashboard'] },
  sergeant: { name: 'SERGEANT', minClients: 11, maxClients: 30, shareBonus: 5, perks: ['Featured in app directory', 'Priority support', 'Analytics dashboard'] },
  lieutenant: { name: 'LIEUTENANT', minClients: 31, maxClients: 60, shareBonus: 10, perks: ['Custom branding on client UI', 'Early feature access', 'Quarterly strategy call'] },
  captain: { name: 'CAPTAIN', minClients: 61, maxClients: 100, shareBonus: 15, perks: ['Co-marketing', 'Speaking slot at events', 'Dedicated account manager'] },
  general: { name: 'GENERAL', minClients: 101, maxClients: null, shareBonus: 20, perks: ['Revenue share renegotiation', 'Gym partnership priority', 'Advisory board seat', 'Equity discussion'] },
};

export function getTrainerRank(clientCount: number): TrainerRank {
  if (clientCount >= 101) return 'general';
  if (clientCount >= 61) return 'captain';
  if (clientCount >= 31) return 'lieutenant';
  if (clientCount >= 11) return 'sergeant';
  return 'recruit';
}

// ─── Junior Operator (ages 10–18) ──────────────────────────────────────────
// Gated behind JUNIOR_OPERATOR_ENABLED feature flag. See SOCCER_YOUTH_PROMPT
// in src/app/api/gunny/route.ts for the youth-safe coaching voice and
// hard knowledge boundaries (no body-comp, no supplements, no diagnosis).

export type SoccerPosition = 'GK' | 'CB' | 'FB' | 'CM' | 'W' | 'ST' | 'unsure';
export type CompetitionLevel = 'recreational' | 'club' | 'academy' | 'high_school_varsity' | 'mixed';
export type MaturationStage = 'pre_phv' | 'peri_phv' | 'post_phv' | 'unknown';
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface SportProfile {
  sport: 'soccer';                                // hard-coded for v1, expandable later
  position: SoccerPosition;
  level: CompetitionLevel;
  yearsPlaying: number;
  trainingDaysPerWeek: number;                    // soccer practice days
  gameDay: DayOfWeek;
  noTrainingDays: DayOfWeek[];
  trainingWindow: string;                         // e.g. "6:00 PM"
  multiSport: boolean;
  otherSports: string[];                          // e.g. ["dance"]
  focusAreas: string[];                           // free-text from trainer/parent intake
  // Coach observations (set by trainer, not athlete)
  coachNotes: string;
  // Maturation — set by trainer or auto-estimated via Mirwald (v2)
  maturationStage: MaturationStage;
  estimatedPeakHeightVelocity: string | null;     // ISO date string or null
}

export interface JuniorConsent {
  parentSignatures: Array<{
    parentOperatorId: string;
    signedAt: string;                             // ISO date
    consentVersion: string;                       // for legal audit
  }>;
  participationConsent: boolean;
  dataConsent: boolean;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  pediatricianClearance: boolean;                 // optional but encouraged
  pediatricianClearanceDate: string | null;
}

export type JuniorSafetyEventType =
  | 'refusal'
  | 'red_flag'
  | 'parent_alert'
  | 'pain_report'
  | 'concussion_keyword';

export interface JuniorSafetyEvent {
  timestamp: string;
  type: JuniorSafetyEventType;
  detail: string;
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface JuniorSafetyFlags {
  events: JuniorSafetyEvent[];
}

export interface Operator {
  id: string;
  name: string;
  callsign: string;
  pin: string;
  email?: string;
  passwordHash?: string;
  googleId?: string; // Google OAuth `sub` claim — set after first /api/auth/google sign-in
  role: UserRole;
  tier: AiTier;
  coupleWith: string | null; // ID of partner operator
  trainerId?: string; // ID of trainer (for clients)
  clientIds?: string[]; // IDs of clients (for trainers)
  trainerNotes?: string; // Custom directives from trainer for this client's Gunny
  betaUser?: boolean; // true = in beta trial, no charge
  betaFeedback?: string[]; // collected feedback during beta
  betaStartDate?: string; // ISO date when beta period started
  betaEndDate?: string; // ISO date when beta expires (45 days from start)
  isVanguard?: boolean; // true = founding member (VANGUARD status)
  tierLocked?: boolean; // true = post-launch, tier cannot be changed by admin
  promoActive?: boolean; // true = currently on a promotional free month
  promoType?: string; // e.g. "free_month_recon", "free_month_operator"
  promoExpiry?: string; // ISO date when promo expires
  teamId?: string; // team this operator belongs to
  avatar?: AvatarStyle; // military-themed avatar
  profileImageUrl?: string; // custom profile picture URL
  intake?: IntakeAssessment; // fitness intake screening results
  fitnessLevel?: FitnessLevel; // calculated from intake
  sitrep?: Sitrep; // post-intake battle plan from Gunny AI
  dailyBrief?: DailyBrief; // today's adaptive plan
  profile: OperatorProfile;
  nutrition: NutritionData;
  prs: PRRecord[];
  injuries: Injury[];
  preferences: TrainingPreferences;
  workouts: Record<string, Workout>; // key = "YYYY-MM-DD"
  dayTags: Record<string, DayTag>; // key = "YYYY-MM-DD"

  // Junior Operator fields (all undefined for adult operators)
  isJunior?: boolean;
  juniorAge?: number;                  // duplicate of profile.age for fast filter
  parentIds?: string[];                // adult operators with full visibility
  sportProfile?: SportProfile;
  juniorConsent?: JuniorConsent;
  juniorSafety?: JuniorSafetyFlags;
}

export interface OperatorProfile {
  age: number;
  height: string;
  weight: number;
  bodyFat: number;
  trainingAge: string;
  goals: string[];
  readiness: number;
  sleep: number;
  stress: number;
  // Intake assessment data mirrored here for persistence fallback
  intakeCompleted?: boolean;
  intakeCompletedDate?: string;
  fitnessLevel?: FitnessLevel;
  experienceYears?: number;
  exerciseHistory?: string;
  currentActivity?: string;
  healthConditions?: string[];
  nutritionHabits?: string;
  preferredWorkoutTime?: string;
}

export interface NutritionData {
  targets: { calories: number; protein: number; carbs: number; fat: number };
  meals: Record<string, Meal[]>; // key = "YYYY-MM-DD"
}

export interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
}

export type PRType = 'strength' | 'consistency' | 'endurance' | 'milestone';

export interface PRRecord {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  date: string;
  notes: string;
  type?: PRType; // defaults to 'strength' for backward compat
  achieved?: boolean; // for milestone-type PRs
}

// Milestone roadmap — generated based on fitness level
export interface MilestoneGoal {
  id: string;
  phase: number; // 1-5
  phaseName: string;
  title: string;
  description: string;
  type: PRType;
  target?: { exercise?: string; weight?: number; reps?: number; count?: number; unit?: string };
  achieved: boolean;
  achievedDate?: string;
}

export interface Injury {
  id: string;
  name: string;
  status: 'active' | 'recovering' | 'cleared';
  notes: string;
  restrictions: string[];
}

export interface EquipmentItem {
  name: string;
  description?: string; // user description for smart matching (e.g. "the cable thing with two pulleys")
  category?: string; // auto-categorized: barbell, dumbbell, machine, cable, cardio, bodyweight, band, specialty
}

export interface TrainingPreferences {
  split: string;
  equipment: string[]; // legacy simple list (kept for backward compat)
  equipmentDetailed?: EquipmentItem[]; // rich equipment with descriptions
  sessionDuration: number;
  daysPerWeek: number;
  trainingPath?: string;
  weakPoints: string[];
  avoidMovements: string[];
}

// Workout types
export interface Workout {
  id: string;
  date: string;
  title: string;
  notes: string;
  warmup: string;
  primer?: string; // activation/primer work after warmup, before main blocks
  blocks: WorkoutBlock[];
  cooldown: string;
  completed: boolean;
  // Workout mode tracking
  results?: WorkoutResults;
}

export interface WorkoutResults {
  startTime?: string;
  endTime?: string;
  blockResults: Record<string, BlockResult>; // keyed by block id
}

export interface BlockResult {
  sets: SetResult[];
  notes?: string;
}

export interface SetResult {
  weight?: number;
  reps?: number;
  time?: string;
  rpe?: number;
  completed: boolean;
}

export type WorkoutBlock = ExerciseBlock | ConditioningBlock;

export interface ExerciseBlock {
  type: 'exercise';
  id: string;
  sortOrder: number;
  exerciseName: string;
  prescription: string;
  videoUrl?: string;
  isLinkedToNext: boolean;
}

export interface ConditioningBlock {
  type: 'conditioning';
  id: string;
  sortOrder: number;
  format: string;
  description: string;
  isLinkedToNext: boolean;
}

export interface DayTag {
  color: 'green' | 'amber' | 'red' | 'cyan';
  note: string;
}

// Exercise library
export interface Exercise {
  id: string;
  name: string;
  category: string;
  equipment: string;
  videoUrl?: string;
}

// SITREP — Post-intake battle plan generated by Gunny AI
export interface Sitrep {
  generatedDate: string; // ISO date
  operatorLevel: string; // fitness level at generation time
  summary: string; // Gunny's assessment of the operator in his voice

  nutritionPlan: {
    dailyCalories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealsPerDay: number;
    hydrationOz: number;
    approach: string; // brief description of the nutrition strategy
    sampleDay: SitrepMeal[]; // example day of eating
    notes: string; // Gunny's nutrition notes
  };

  trainingPlan: {
    split: string; // e.g. "Upper/Lower 4-Day"
    daysPerWeek: number;
    sessionDuration: string; // e.g. "45-60 min"
    progressionStrategy: string; // how to progress over time
    deloadProtocol: string; // when and how to deload
  };

  today: SitrepDay; // Day 1 workout — subsequent days generated by DailyBrief

  restrictions: string[]; // injury-based movement restrictions
  priorityFocus: string[]; // top 3 things to focus on
  milestones30Day: string[]; // realistic 30-day targets
  gunnyMessage: string; // motivational closing from Gunny
}

export interface SitrepMeal {
  time: string; // e.g. "7:00 AM"
  name: string; // e.g. "Meal 1 — Breakfast"
  description: string; // e.g. "4 eggs, 2 toast, avocado"
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface SitrepWeek {
  weekNumber: number;
  focus: string; // e.g. "Foundation — Movement Quality"
  days: SitrepDay[];
}

export interface SitrepDay {
  dayNumber: number; // 1-7
  dayName: string; // "Monday", "Tuesday", etc.
  type: 'training' | 'rest' | 'active_recovery' | 'conditioning';
  title: string; // e.g. "Upper Body A — Push Focus"
  exercises: SitrepExercise[];
  warmup?: string;
  cooldown?: string;
  notes?: string;
  duration?: string;
}

export interface SitrepExercise {
  name: string;
  sets: number;
  reps: string; // "8-10" or "30 sec" or "AMRAP"
  weight?: string; // "135 lbs" or "bodyweight" or "light"
  rest?: string; // "90 sec"
  notes?: string; // "Focus on eccentric" or "Substitute: goblet squat"
  superset?: boolean;
}

// Daily Brief — adaptive daily plan
export interface DailyBrief {
  date: string; // ISO date
  greeting: string; // Gunny's daily greeting
  todaysFocus: string; // what today is about
  workout: SitrepDay | null; // today's workout (null = rest day)
  nutritionReminder: string; // daily nutrition nudge
  adjustments: string[]; // what changed from the plan and why
  motivation: string; // daily motivation from Gunny
  complianceScore?: number; // 0-100 based on yesterday's adherence
  streakDays?: number;
}

export type ViewMode = 'month' | 'week' | 'day';
export type AppTab = 'coc' | 'planner' | 'intel' | 'gunny' | 'radio' | 'ops' | 'parent_hub';

// Operator IDs that can access OPS CENTER and the server-side admin guards.
//
// Configurable at build time via NEXT_PUBLIC_OPS_CENTER_ACCESS (comma-separated
// operator IDs). Falls back to the historical hardcoded list if the env var
// isn't set — so existing Railway deployments keep working without a config
// change. NEXT_PUBLIC_ is intentional: these IDs are referenced in both the
// client bundle (to hide/show the OPS tab) and server routes (authorization
// checks), and operator IDs aren't secret.
//
// To grant ops access to another operator without a code change, set e.g.
// NEXT_PUBLIC_OPS_CENTER_ACCESS="op-ruben,op-britney,op-newadmin" in Railway
// environment variables and redeploy. A proper DB-backed admin table is the
// next step (backlog: B1 follow-up) but the env var unblocks operational
// changes for now.
const OPS_CENTER_ACCESS_DEFAULT = ['op-ruben', 'op-britney'];
const opsEnv = process.env.NEXT_PUBLIC_OPS_CENTER_ACCESS;
export const OPS_CENTER_ACCESS: readonly string[] = opsEnv
  ? opsEnv.split(',').map(s => s.trim()).filter(Boolean)
  : OPS_CENTER_ACCESS_DEFAULT;
export const BETA_DURATION_DAYS = 45;
export type IntelTab = 'profile' | 'nutrition' | 'prs' | 'injuries' | 'preferences' | 'wearables';

// Fitness level calculation from intake
export function calculateFitnessLevel(intake: IntakeAssessment): FitnessLevel {
  const { experienceYears, exerciseHistory, movementScreenScore } = intake;
  let score = 0;
  // Experience years scoring
  if (experienceYears >= 10) score += 4;
  else if (experienceYears >= 5) score += 3;
  else if (experienceYears >= 2) score += 2;
  else if (experienceYears >= 0.5) score += 1;
  // Exercise history scoring
  if (exerciseHistory === 'advanced_athlete') score += 4;
  else if (exerciseHistory === 'consistent_intermediate') score += 3;
  else if (exerciseHistory === 'consistent_beginner') score += 2;
  else if (exerciseHistory === 'sporadic') score += 1;
  // Movement screen scoring
  score += Math.round(movementScreenScore / 2.5);
  // Map total score to fitness level
  if (score >= 10) return 'elite';
  if (score >= 7) return 'advanced';
  if (score >= 4) return 'intermediate';
  return 'beginner';
}

// Calculate training age from intake data
export function calculateTrainingAge(intake: IntakeAssessment): string {
  const years = intake.experienceYears;
  if (years < 1) return `${Math.round(years * 12)} months`;
  return `${years} year${years !== 1 ? 's' : ''}`;
}

// Calculate readiness score from intake data (1-10)
export function calculateReadiness(intake: IntakeAssessment): number {
  const sleepScore = intake.sleepQuality;
  const stressScore = 10 - intake.stressLevel; // invert stress
  const mobilityScore = intake.movementScreenScore;
  const nutritionMap: Record<string, number> = { poor: 3, fair: 5, good: 7, excellent: 9 };
  const nutritionScore = nutritionMap[intake.nutritionHabits] || 5;
  return Math.round((sleepScore + stressScore + mobilityScore + nutritionScore) / 4);
}

// Auto-format height input: "511" → "5'11\""
export function formatHeightInput(raw: string): string {
  // If already formatted, return as-is
  if (raw.includes("'") || raw.includes('"')) return raw;
  // Remove non-numeric
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 2) {
    // e.g. "59" → 5'9"
    return `${digits[0]}'${digits[1]}"`;
  }
  if (digits.length === 3) {
    // e.g. "511" → 5'11"
    return `${digits[0]}'${digits.slice(1)}"`;
  }
  if (digits.length === 4) {
    // e.g. "5011" → 5'0" + 11? Unlikely. Try feet=first, inches=rest
    return `${digits[0]}'${digits.slice(1)}"`;
  }
  return raw;
}

export interface AuthState {
  isLoggedIn: boolean;
  currentUser: Operator | null;
  accessibleUsers: Operator[];
}

// Aliases for component compatibility
export type MealLog = Meal;
export type PersonalRecord = PRRecord;
export interface Goal {
  id: string;
  name: string;
}

// Tier configuration with pricing and features.
// ─── PRICING v1.0 (April 2026, per GUNS_UP_Pricing_Strategy_v1.docx) ───
// The previous March 2026 numbers ($2 / $5 / $15 / $49.99) were the
// beta-launch internal pricing; the v1.0 strategy doc locked in the
// public-launch pricing below after benchmarking against 28 competitors
// in the AI fitness market. Key changes:
//   • RECON       $2.00  → $3.99   (still under every competitor except GymGenie)
//   • OPERATOR    $5.00  → $9.99   (matches Hevy Pro / Apple Fitness+ / MacroFactor)
//   • COMMANDER   $15.00 → $14.99  ($0.01 trim for psych pricing — anchor band)
//   • WARFIGHTER  $49.99 unchanged (lifts to $79.99 in Phase DELTA, April 2027)
// Annual is 17% off the monthly × 12 — not the legacy 16.7%.
// Trainer share % per the v1.0 doc: 25 / 30 / 20 / 40 (was 25 / 30 / 35 / 40).
// API costs assume 60% prompt-cache hit rate, validated in beta.
// Margins are recomputed end-to-end in the doc's unit-economics waterfall.
//
// Model IDs are sourced from lib/models.ts — the central map — to avoid drift.
export const TIER_CONFIGS: Record<AiTier, TierConfig> = {
  haiku: {
    name: 'RECON',
    codename: 'RECON',
    model: TIER_MODEL_MAP.haiku,
    monthlyPrice: 3.99,
    annualPrice: 39.92, // 17% off
    trainerShare: 1.00,  // 25%
    platformShare: 2.40,
    apiCostEstimate: 0.07,
    stripeFee: 0.42,     // 2.9% + $0.30
    infraCost: 0.10,
    margin: 60.2,
    features: ['Gunny AI Chat', 'Workout Builder', 'Macro Estimation', 'Trainer Workout Feed'],
  },
  sonnet: {
    name: 'OPERATOR',
    codename: 'OPERATOR',
    model: TIER_MODEL_MAP.sonnet,
    monthlyPrice: 9.99,
    annualPrice: 99.50, // 17% off
    trainerShare: 3.00,  // 30%
    platformShare: 5.96,
    apiCostEstimate: 0.34,
    stripeFee: 0.59,
    infraCost: 0.10,
    margin: 59.7,
    features: ['Gunny AI Chat', 'Workout Builder', 'Macro Estimation', 'Trainer Workout Feed', 'Weekly Programming', 'Goal Path Planning'],
  },
  opus: {
    name: 'COMMANDER',
    codename: 'COMMANDER',
    model: TIER_MODEL_MAP.opus,
    monthlyPrice: 14.99,
    annualPrice: 149.40, // 17% off
    trainerShare: 3.00,  // 20%
    platformShare: 10.60,
    apiCostEstimate: 0.56,
    stripeFee: 0.73,
    infraCost: 0.10,
    margin: 70.7,
    features: ['Gunny AI Chat', 'Workout Builder', 'Macro Estimation', 'Trainer Workout Feed', 'Weekly Programming', 'Goal Path Planning', 'PR Tracking & Analysis', 'Injury Workarounds', 'Periodization Engine'],
  },
  white_glove: {
    name: 'WARFIGHTER',
    codename: 'WARFIGHTER',
    model: TIER_MODEL_MAP.white_glove,
    monthlyPrice: 49.99,
    annualPrice: 497.90, // 17% off — Phase DELTA (Apr 2027) lifts to $79.99/mo, $797.90 annual
    trainerShare: 20.00, // 40%
    platformShare: 27.58,
    apiCostEstimate: 0.56,
    stripeFee: 1.75,
    infraCost: 0.10,
    margin: 55.2,
    features: ['All Commander Features', 'Priority Support', 'Custom Meal Plans', 'Monthly Video Consult', 'Direct Trainer Hotline'],
  },
};
