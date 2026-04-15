// Shared Gunny AI context builder.
// Single source of truth for the operatorContext object sent to /api/gunny.
// Both AppShell.tsx (side panel) and GunnyChat.tsx (main chat) must use this
// so responses never regress to generic advice because one caller forgot
// to include a field.

import type { Operator } from './types';
import { buildWorkoutAnalysis, findMostRecentCompletedWorkout } from './workoutAnalysis';
import { getLocalDateStr, toLocalDateStr } from './dateUtils';

// Matches the in-progress Workout Mode UI state consumed by AppShell
export interface WorkoutExecutionState {
  active?: boolean;
  workoutTitle?: string;
  exercises?: Array<{
    name: string;
    prescription?: string;
    sets?: Array<{ weight?: number; reps?: number; completed?: boolean }>;
  }>;
}

export interface BuildGunnyContextOptions {
  language?: string;
  workoutExecution?: WorkoutExecutionState | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = Record<string, any>;

export interface GunnyOperatorContext {
  callsign: string;
  name: string;
  role: string;
  language: string;
  weight?: number;
  height?: string;
  age?: number;
  bodyFat?: number;
  trainingAge?: string;
  fitnessLevel?: string;
  experienceYears?: number;
  exerciseHistory?: string;
  currentActivity?: string;
  goals?: string[];
  readiness?: number;
  sleepQuality?: number;
  stressLevel?: number;
  movementScreenScore?: number;
  motivationFactors?: string[];
  availableEquipment?: string[];
  equipmentDetailed?: Array<{ name: string; description?: string; category?: string }>;
  preferredSplit?: string;
  daysPerWeek?: number;
  sessionDuration?: number;
  preferredWorkoutTime?: string;
  macroTargets?: { calories: number; protein: number; carbs: number; fat: number };
  nutritionHabits?: string;
  currentDiet?: string;
  mealsPerDay?: number;
  dailyWaterOz?: number;
  estimatedCalories?: number;
  proteinPriority?: string;
  dietaryRestrictions?: string[];
  supplements?: string[];
  healthConditions?: string[];
  prs: Array<{ exercise: string; weight: number; reps?: number; date?: string; type?: string; notes?: string }>;
  injuries: Array<{ id: string; name: string; status: string; notes?: string; restrictions?: string[] }>;
  injuryNotes?: string;
  trainerNotes?: string;
  wearableDevice?: string;
  sitrep: AnyRec | null;
  dailyBrief: { complianceScore?: number; adjustments?: string; gunnyNote?: string } | null;
  todayWorkout: { title: string; exercises: string[]; completed: boolean } | null;
  recentWorkoutHistory: string;
  recentMealHistory: string;
  workoutStreak: number;
  totalWorkoutsCompleted: number;
  recentDayTags: string | null;
  lastCompletedWorkout: string | null;
  workoutExecution: string | null;
}

export function buildFullGunnyContext(
  operator: Operator,
  options: BuildGunnyContextOptions = {}
): GunnyOperatorContext {
  const intake = operator.intake as AnyRec | undefined;
  const prof = operator.profile as AnyRec | undefined;
  const prefs = operator.preferences as AnyRec | undefined;
  const sitrep = operator.sitrep as AnyRec | undefined;
  const dailyBrief = operator.dailyBrief as AnyRec | undefined;
  const workouts = (operator.workouts || {}) as AnyRec;
  const today = getLocalDateStr();
  const todayWorkout = workouts[today];

  const recentWorkoutHistory = (() => {
    const dates = Object.keys(workouts).sort().reverse().slice(0, 7);
    if (!dates.length) return 'No workouts logged yet';
    return dates
      .map(date => {
        const w = workouts[date];
        const ex = (w.blocks || [])
          .filter((b: { type: string }) => b.type === 'exercise')
          .map((b: { exerciseName?: string; prescription?: string }) => `${b.exerciseName} (${b.prescription})`)
          .join(', ');
        return `${date}: "${w.title || 'Untitled'}" — ${ex}${w.completed ? ' ✅' : ''}`;
      })
      .join('\n');
  })();

  const recentMealHistory = (() => {
    const meals = (operator.nutrition as AnyRec | undefined)?.meals || {};
    const dates = Object.keys(meals).sort().reverse().slice(0, 3);
    if (!dates.length) return 'No meals logged';
    return dates
      .map(date => {
        const dm = (meals as AnyRec)[date] || [];
        const t = dm.reduce(
          (a: { calories: number; protein: number }, m: { calories?: number; protein?: number }) => ({
            calories: a.calories + (m.calories || 0),
            protein: a.protein + (m.protein || 0),
          }),
          { calories: 0, protein: 0 }
        );
        return `${date}: ${dm.length} meals — ${t.calories}cal, ${t.protein}g P`;
      })
      .join('\n');
  })();

  const workoutStreak = (() => {
    let streak = 0;
    const now = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = toLocalDateStr(d);
      if (workouts[key]?.completed) streak++;
      else if (i > 0) break;
    }
    return streak;
  })();

  const totalWorkoutsCompleted = Object.values(workouts).filter(
    (w: unknown) => (w as AnyRec | undefined)?.completed
  ).length;

  const lastCompletedWorkout = (() => {
    const target = todayWorkout?.completed ? todayWorkout : findMostRecentCompletedWorkout(operator);
    if (!target) return null;
    return buildWorkoutAnalysis(target, operator.prs || [], (operator.workouts || {}) as AnyRec);
  })();

  const workoutExecution = (() => {
    const exec = options.workoutExecution;
    if (!exec?.active) return null;
    const lines: string[] = [];
    lines.push('═══ ACTIVE WORKOUT EXECUTION ═══');
    lines.push(`Title: ${exec.workoutTitle || 'Current workout'}`);
    (exec.exercises || []).forEach((ex, i) => {
      const sets = ex.sets || [];
      const done = sets.filter(s => s.completed);
      let row = `${i + 1}. ${ex.name} — ${ex.prescription || ''} [${done.length}/${sets.length} sets done]`;
      if (done.length > 0) {
        const last = done[done.length - 1];
        row += ` last: ${last.weight || 0}lbs x${last.reps || 0}`;
      }
      lines.push(row);
    });
    return lines.join('\n');
  })();

  return {
    callsign: operator.callsign,
    name: operator.name,
    role: operator.role || 'operator',
    language: options.language || 'en',
    weight: prof?.weight,
    height: prof?.height,
    age: prof?.age,
    bodyFat: prof?.bodyFat,
    trainingAge: prof?.trainingAge,
    fitnessLevel:
      (operator as AnyRec).fitnessLevel || intake?.fitnessLevel || prof?.fitnessLevel,
    experienceYears: intake?.experienceYears ?? prof?.experienceYears,
    exerciseHistory: intake?.exerciseHistory || prof?.exerciseHistory,
    currentActivity: intake?.currentActivity || prof?.currentActivity,
    goals: prof?.goals,
    readiness: prof?.readiness,
    sleepQuality: intake?.sleepQuality || prof?.sleep,
    stressLevel: intake?.stressLevel || prof?.stress,
    movementScreenScore: intake?.movementScreenScore,
    motivationFactors: intake?.motivationFactors,
    availableEquipment: intake?.availableEquipment || prefs?.equipment,
    equipmentDetailed: prefs?.equipmentDetailed,
    preferredSplit: prefs?.split,
    daysPerWeek: prefs?.daysPerWeek,
    sessionDuration: prefs?.sessionDuration,
    preferredWorkoutTime: intake?.preferredWorkoutTime || prof?.preferredWorkoutTime,
    macroTargets: (operator.nutrition as AnyRec | undefined)?.targets,
    nutritionHabits: intake?.nutritionHabits || prof?.nutritionHabits,
    currentDiet: intake?.currentDiet,
    mealsPerDay: intake?.mealsPerDay,
    dailyWaterOz: intake?.dailyWaterOz,
    estimatedCalories: intake?.estimatedCalories,
    proteinPriority: intake?.proteinPriority,
    dietaryRestrictions: intake?.dietaryRestrictions,
    supplements: intake?.supplements,
    healthConditions: intake?.healthConditions || prof?.healthConditions,
    prs: (operator.prs || []).slice(0, 10).map(pr => ({
      exercise: pr.exercise,
      weight: pr.weight,
      reps: pr.reps,
      date: pr.date,
      type: pr.type || 'strength',
      notes: pr.notes,
    })),
    injuries: (operator.injuries || []).map(inj => ({
      id: inj.id,
      name: inj.name,
      status: inj.status,
      notes: inj.notes,
      restrictions: inj.restrictions,
    })),
    injuryNotes: intake?.injuryNotes,
    trainerNotes: operator.trainerNotes || 'None',
    wearableDevice: intake?.wearableDevice,
    sitrep:
      sitrep && Object.keys(sitrep).length > 0
        ? {
            summary: sitrep.summary,
            trainingPlan: sitrep.trainingPlan,
            nutritionPlan: sitrep.nutritionPlan
              ? {
                  dailyCalories: sitrep.nutritionPlan.dailyCalories,
                  protein: sitrep.nutritionPlan.protein,
                  carbs: sitrep.nutritionPlan.carbs,
                  fat: sitrep.nutritionPlan.fat,
                  mealsPerDay: sitrep.nutritionPlan.mealsPerDay,
                  hydrationOz: sitrep.nutritionPlan.hydrationOz,
                  approach: sitrep.nutritionPlan.approach,
                }
              : null,
            priorityFocus: sitrep.priorityFocus || [],
            restrictions: sitrep.restrictions || [],
            milestones30Day: sitrep.milestones30Day || [],
          }
        : null,
    dailyBrief:
      dailyBrief?.date === today
        ? {
            complianceScore: dailyBrief.complianceScore,
            adjustments: dailyBrief.adjustments,
            gunnyNote: dailyBrief.gunnyNote,
          }
        : null,
    todayWorkout: todayWorkout
      ? {
          title: todayWorkout.title || 'Untitled',
          exercises: (todayWorkout.blocks || [])
            .filter((b: { type: string }) => b.type === 'exercise')
            .map((b: { exerciseName?: string; prescription?: string }) =>
              `${b.exerciseName} (${b.prescription})`
            ),
          completed: !!todayWorkout.completed,
        }
      : null,
    recentWorkoutHistory,
    recentMealHistory,
    workoutStreak,
    totalWorkoutsCompleted,
    recentDayTags: (() => {
      const entries = Object.entries(operator.dayTags || {})
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 7);
      if (!entries.length) return null;
      return entries
        .map(([date, tag]) => `${date}: [${(tag as AnyRec).color}] ${(tag as AnyRec).note}`)
        .join('\n');
    })(),
    lastCompletedWorkout,
    workoutExecution,
  };
}
