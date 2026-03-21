// User / Operator types
export type UserRole = 'trainer' | 'client';
export type AiTier = 'haiku' | 'sonnet' | 'opus' | 'white_glove';
export type TrainerRank = 'recruit' | 'sergeant' | 'lieutenant' | 'captain' | 'general';

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
  blocks: WorkoutBlock[];
  cooldown: string;
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
export type AppTab = 'coc' | 'planner' | 'intel' | 'gunny';
export type IntelTab = 'profile' | 'nutrition' | 'prs' | 'injuries' | 'preferences';

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
