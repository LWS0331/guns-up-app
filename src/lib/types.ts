// User / Operator types
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
  { id: 'team-wolf-pack', name: 'WOLF PACK', trainerId: 'op-ruben', memberIds: ['op-ruben', 'op-rosa', 'op-erika', 'op-efrain', 'op-aldo', 'op-edgar', 'op-jasmine', 'op-patty'] },
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
  availableEquipment: string[];
  preferredWorkoutTime: string;
  motivationFactors: string[];
  sleepQuality: number; // 1-10
  stressLevel: number; // 1-10
  nutritionHabits: string; // poor, fair, good, excellent
  wearableDevice?: string;
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

export interface Operator {
  id: string;
  name: string;
  callsign: string;
  pin: string;
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
  profile: OperatorProfile;
  nutrition: NutritionData;
  prs: PRRecord[];
  injuries: Injury[];
  preferences: TrainingPreferences;
  workouts: Record<string, Workout>; // key = "YYYY-MM-DD"
  dayTags: Record<string, DayTag>; // key = "YYYY-MM-DD"
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

export interface PRRecord {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  date: string;
  notes: string;
}

export interface Injury {
  id: string;
  name: string;
  status: 'active' | 'recovering' | 'cleared';
  notes: string;
  restrictions: string[];
}

export interface TrainingPreferences {
  split: string;
  equipment: string[];
  sessionDuration: number;
  daysPerWeek: number;
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

export type ViewMode = 'month' | 'week' | 'day';
export type AppTab = 'coc' | 'planner' | 'intel' | 'gunny' | 'ops';

// Hardcoded admin access for OPS CENTER
export const OPS_CENTER_ACCESS = ['op-ruben', 'op-britney'];
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

// Tier configuration with pricing and features (updated March 2026 with real API costs + caching)
export const TIER_CONFIGS: Record<AiTier, TierConfig> = {
  haiku: {
    name: 'RECON',
    codename: 'RECON',
    model: 'claude-haiku-4-5',
    monthlyPrice: 2.00,
    annualPrice: 20.00, // $1.67/mo — 17% off
    trainerShare: 0.50,
    platformShare: 0.97,
    apiCostEstimate: 0.07,
    stripeFee: 0.36,
    infraCost: 0.10,
    margin: 48.5,
    features: ['Gunny AI Chat', 'Workout Builder', 'Macro Estimation', 'Trainer Workout Feed'],
  },
  sonnet: {
    name: 'OPERATOR',
    codename: 'OPERATOR',
    model: 'claude-sonnet-4-6',
    monthlyPrice: 5.00,
    annualPrice: 50.00, // $4.17/mo — 17% off
    trainerShare: 1.50,
    platformShare: 2.61,
    apiCostEstimate: 0.34,
    stripeFee: 0.45,
    infraCost: 0.10,
    margin: 52.2,
    features: ['Gunny AI Chat', 'Workout Builder', 'Macro Estimation', 'Trainer Workout Feed', 'Weekly Programming', 'Goal Path Planning'],
  },
  opus: {
    name: 'COMMANDER',
    codename: 'COMMANDER',
    model: 'claude-opus-4-6',
    monthlyPrice: 15.00,
    annualPrice: 150.00, // $12.50/mo — 17% off
    trainerShare: 3.00,
    platformShare: 10.60,
    apiCostEstimate: 0.56,
    stripeFee: 0.74,
    infraCost: 0.10,
    margin: 70.7,
    features: ['Gunny AI Chat', 'Workout Builder', 'Macro Estimation', 'Trainer Workout Feed', 'Weekly Programming', 'Goal Path Planning', 'PR Tracking & Analysis', 'Injury Workarounds', 'Periodization Engine'],
  },
  white_glove: {
    name: 'WARFIGHTER',
    codename: 'WARFIGHTER',
    model: 'claude-opus-4-6',
    monthlyPrice: 49.99,
    annualPrice: 499.00, // $41.58/mo — 17% off
    trainerShare: 20.00,
    platformShare: 27.58,
    apiCostEstimate: 0.56,
    stripeFee: 1.75,
    infraCost: 0.10,
    margin: 55.2,
    features: ['All Commander Features', 'Priority Support', 'Custom Meal Plans', 'Monthly Video Consult', 'Direct Trainer Hotline'],
  },
};
