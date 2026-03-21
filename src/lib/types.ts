// User / Operator types
export type UserRole = 'trainer' | 'client';
export type AiTier = 'haiku' | 'sonnet' | 'opus' | 'white_glove';

export interface TierConfig {
  name: string;
  model: string; // haiku, sonnet, opus
  monthlyPrice: number; // what the client pays
  trainerShare: number; // what the trainer gets per client
  platformShare: number; // what GUNS UP keeps
  apiCostEstimate: number; // estimated API cost per user/month
  features: string[];
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

// Tier configuration with pricing and features
export const TIER_CONFIGS: Record<AiTier, TierConfig> = {
  haiku: {
    name: 'RECON',
    model: 'claude-haiku-4-5',
    monthlyPrice: 2.00,
    trainerShare: 0.50,
    platformShare: 0.90,
    apiCostEstimate: 0.60,
    features: ['Basic AI coaching', 'Workout tracking', 'Macro estimation', 'Exercise library'],
  },
  sonnet: {
    name: 'OPERATOR',
    model: 'claude-sonnet-4-6',
    monthlyPrice: 5.00,
    trainerShare: 1.50,
    platformShare: 1.70,
    apiCostEstimate: 1.80,
    features: ['Smart AI coaching', 'Workout tracking', 'Macro estimation', 'Exercise library', 'Personalized recommendations', 'Trainer workout feed'],
  },
  opus: {
    name: 'COMMANDER',
    model: 'claude-opus-4-6',
    monthlyPrice: 15.00,
    trainerShare: 3.00,
    platformShare: 3.00,
    apiCostEstimate: 9.00,
    features: ['Elite AI coaching', 'Workout tracking', 'Macro estimation', 'Exercise library', 'Personalized recommendations', 'Trainer workout feed', 'Deep periodization', 'Injury-aware programming'],
  },
  white_glove: {
    name: 'WARFIGHTER',
    model: 'claude-opus-4-6',
    monthlyPrice: 49.99,
    trainerShare: 20.00,
    platformShare: 20.99,
    apiCostEstimate: 9.00,
    features: ['Elite AI coaching', 'All Commander features', 'Direct trainer programming', 'Priority support', 'Custom directives', 'Weekly check-ins'],
  },
};
