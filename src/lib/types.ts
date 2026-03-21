// User / Operator types
export interface Operator {
  id: string;
  name: string;
  callsign: string;
  pin: string;
  role: 'admin' | 'user';
  coupleWith: string | null; // ID of partner operator
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
