'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Operator, Meal, Workout, WorkoutBlock, TIER_CONFIGS } from '@/lib/types';
import { buildWorkoutAnalysis, findMostRecentCompletedWorkout } from '@/lib/workoutAnalysis';
import { applyWorkoutModification, type WorkoutModification } from '@/lib/workoutModification';
import { buildFullGunnyContext } from '@/lib/buildGunnyContext';
import VoiceInput from '@/components/VoiceInput';
import { getTrainerClients, getClientTrainer } from '@/data/operators';
import { trackEvent, EVENTS } from '@/lib/analytics';
import { getLocalDateStr, toLocalDateStr, isValidDateStr, getLocalTimezone, formatLocalDateKey } from '@/lib/dateUtils';
import ThinkingIndicator from '@/components/gunny/ThinkingIndicator';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface GunnyChatProps {
  operator: Operator;
  allOperators: Operator[];
  onUpdateOperator?: (updated: Operator) => void;
}

interface Message {
  id: string;
  role: 'user' | 'gunny';
  text: string;
  timestamp: Date;
  isWorkout?: boolean;
  image?: string; // base64 data URL for vision analysis
}

interface WorkoutSession {
  muscleGroup: string;
  goal: string;
  warmup: string;
  primer: { movements: string[]; rounds: string };
  complex: { movement: string; reps: string; timing: string };
  strength: { exercise: string; sets: string; rest: string };
  isolation: { exercise: string; reps: string; rest: string; rounds: string };
  metcon: { format: string; movements: string[] };
}

const GOAL_PATHS = {
  HYPERTROPHY: { name: 'HYPERTROPHY', description: 'Muscle building focus. Higher reps (8-12), moderate weight, constant tension.', primerRounds: '3-4', complexReps: '3-4', strengthSets: '4-5', isolationRounds: '4', metconStyle: 'moderate-weight high-volume' },
  FAT_LOSS: { name: 'FAT LOSS', description: 'Metabolic conditioning focus. Moderate reps (6-10), heavier weight, shorter rest.', primerRounds: '3', complexReps: '3', strengthSets: '3-4', isolationRounds: '3', metconStyle: 'high-intensity short-duration' },
  STRENGTH: { name: 'STRENGTH', description: 'Powerlifting focus. Lower reps (1-5), heavy weight, full recovery.', primerRounds: '2-3', complexReps: '2-3', strengthSets: '5-6', isolationRounds: '3', metconStyle: 'heavy-singles-doubles' },
  ATHLETIC_PERFORMANCE: { name: 'ATHLETIC PERFORMANCE', description: 'Sport-specific focus. Power, explosivity, functional movement patterns.', primerRounds: '3', complexReps: '4-5', strengthSets: '4', isolationRounds: '3-4', metconStyle: 'explosive-functional' },
  GENERAL_FITNESS: { name: 'GENERAL FITNESS', description: 'Balanced approach. Mixed rep ranges, balanced progression.', primerRounds: '3', complexReps: '3-4', strengthSets: '4', isolationRounds: '3', metconStyle: 'moderate-mixed' },
};

const MUSCLE_GROUP_TEMPLATES = {
  CHEST: { primerMovements: ['Scapular Push-ups', 'Band Pull-aparts', 'Pec Flyes'], complexMovement: 'Bench Press Doubles', strengthExercise: 'Barbell Bench Press', isolationExercise: 'DB Incline Press', metconExample: 'Run 400m, 15 Burpees, 20 Push-ups' },
  BACK: { primerMovements: ['Dead Bugs', 'Scapular Rows', 'Band Rows'], complexMovement: 'Deadlift Doubles', strengthExercise: 'Conventional Deadlift', isolationExercise: 'Barbell Rows', metconExample: 'Run 400m, 10 Deadlifts, 15 Box Jump Overs' },
  LEGS: { primerMovements: ['Leg Swings', 'Goblet Squats', 'Single-Leg RDLs'], complexMovement: 'Squat Clean Doubles', strengthExercise: 'Back Squat', isolationExercise: 'DB Walking Lunges', metconExample: 'Run 400m, 15 Box Jumps, 10 Squat Cleans at 95lbs' },
  SHOULDERS: { primerMovements: ['Arm Circles', 'Band Pull-aparts', 'Pike Push-ups'], complexMovement: 'Push Press Doubles', strengthExercise: 'Overhead Press', isolationExercise: 'DB Shoulder Raises', metconExample: '5 Rounds for Time: 10 Thrusters, 15 Overhead Walks' },
  ARMS: { primerMovements: ['Scapular Hangs', 'Resistance Band Curls', 'Tricep Dips'], complexMovement: 'Power Clean Doubles', strengthExercise: 'Barbell Curls', isolationExercise: 'DB Hammer Curls', metconExample: '4 Rounds for Time: 12 Barbell Curls, 15 Dips, 400m Run' },
};

// Food macro lookup table - common foods with approximate macros per serving
const FOOD_DATABASE: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {
  // Proteins
  'chicken breast': { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  'chicken': { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  'steak': { calories: 271, protein: 36, carbs: 0, fat: 13 },
  'beef': { calories: 271, protein: 36, carbs: 0, fat: 13 },
  'salmon': { calories: 280, protein: 25, carbs: 0, fat: 17 },
  'fish': { calories: 200, protein: 22, carbs: 0, fat: 12 },
  'tuna': { calories: 144, protein: 30, carbs: 0, fat: 1 },
  'shrimp': { calories: 99, protein: 24, carbs: 0, fat: 0.3 },
  'turkey': { calories: 189, protein: 29, carbs: 0, fat: 7.4 },
  'pork chop': { calories: 242, protein: 27, carbs: 0, fat: 14 },
  'pork': { calories: 242, protein: 27, carbs: 0, fat: 14 },
  'ground beef': { calories: 217, protein: 23, carbs: 0, fat: 13 },
  'tofu': { calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
  'greek yogurt': { calories: 100, protein: 17, carbs: 7, fat: 0.5 },
  'cottage cheese': { calories: 98, protein: 14, carbs: 7, fat: 4.3 },
  'egg': { calories: 78, protein: 6, carbs: 0.6, fat: 5.3 },
  'eggs': { calories: 78, protein: 6, carbs: 0.6, fat: 5.3 },
  'protein shake': { calories: 120, protein: 25, carbs: 2, fat: 1 },
  'whey': { calories: 120, protein: 25, carbs: 2, fat: 1 },
  'milk': { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },

  // Carbs
  'rice': { calories: 206, protein: 4.3, carbs: 45, fat: 0.3 },
  'pasta': { calories: 214, protein: 7.5, carbs: 43, fat: 1.1 },
  'bread': { calories: 79, protein: 2.7, carbs: 14, fat: 1 },
  'oatmeal': { calories: 389, protein: 17, carbs: 67, fat: 7 },
  'oats': { calories: 389, protein: 17, carbs: 67, fat: 7 },
  'sweet potato': { calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  'potato': { calories: 77, protein: 2, carbs: 17, fat: 0.1 },
  'banana': { calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  'apple': { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  'bagel': { calories: 289, protein: 11, carbs: 56, fat: 1.5 },
  'tortilla': { calories: 52, protein: 1.5, carbs: 11, fat: 0.5 },
  'quinoa': { calories: 222, protein: 8, carbs: 39, fat: 4 },
  'white rice': { calories: 206, protein: 4.3, carbs: 45, fat: 0.3 },
  'brown rice': { calories: 215, protein: 5, carbs: 45, fat: 1.8 },
  'cereal': { calories: 120, protein: 3, carbs: 25, fat: 1 },
  'granola': { calories: 471, protein: 13, carbs: 61, fat: 20 },
  'pancakes': { calories: 175, protein: 5, carbs: 26, fat: 6 },
  'waffle': { calories: 176, protein: 4.6, carbs: 28, fat: 5.6 },

  // Fats
  'avocado': { calories: 160, protein: 2, carbs: 9, fat: 15 },
  'peanut butter': { calories: 188, protein: 8, carbs: 7, fat: 16 },
  'almond butter': { calories: 196, protein: 7, carbs: 6, fat: 18 },
  'olive oil': { calories: 119, protein: 0, carbs: 0, fat: 14 },
  'cheese': { calories: 115, protein: 7, carbs: 0.4, fat: 9.5 },
  'almonds': { calories: 579, protein: 21, carbs: 21, fat: 50 },
  'nuts': { calories: 579, protein: 21, carbs: 21, fat: 50 },
  'butter': { calories: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  'coconut oil': { calories: 117, protein: 0, carbs: 0, fat: 14 },

  // Meals/Combinations
  'pizza': { calories: 285, protein: 12, carbs: 36, fat: 10 }, // per slice
  'burger': { calories: 540, protein: 30, carbs: 41, fat: 28 },
  'burrito': { calories: 450, protein: 18, carbs: 51, fat: 20 },
  'sandwich': { calories: 350, protein: 15, carbs: 40, fat: 15 },
  'salad': { calories: 150, protein: 8, carbs: 12, fat: 8 },
  'sushi': { calories: 140, protein: 7, carbs: 20, fat: 3 },
  'tacos': { calories: 200, protein: 10, carbs: 20, fat: 9 },

  // Snacks
  'protein bar': { calories: 200, protein: 20, carbs: 20, fat: 5 },
  'granola bar': { calories: 140, protein: 3, carbs: 20, fat: 5 },
  'trail mix': { calories: 600, protein: 21, carbs: 55, fat: 35 },
  'candy': { calories: 150, protein: 0, carbs: 40, fat: 0 },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept as offline fallback; active path now uses <meal_json> from Gunny API
const estimateMacros = (foodDescription: string): {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: string;
} | null => {
  const lower = foodDescription.toLowerCase();

  // Find matching food
  let foodName = '';
  let baseMacros: typeof FOOD_DATABASE[string] | null = null;

  for (const [key, macros] of Object.entries(FOOD_DATABASE)) {
    if (lower.includes(key)) {
      foodName = key;
      baseMacros = macros;
      break;
    }
  }

  if (!baseMacros) return null;

  // Parse quantity multipliers
  let multiplier = 1;

  // Check for numbers (2, 3, etc)
  const numberMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:x|times?|of|servings?)?/);
  if (numberMatch) {
    multiplier = parseFloat(numberMatch[1]);
  }

  // Check for "double", "half", etc
  if (lower.includes('double') || lower.includes('2x')) multiplier = 2;
  if (lower.includes('half')) multiplier = 0.5;
  if (lower.includes('triple') || lower.includes('3x')) multiplier = 3;

  // Size modifiers
  if (lower.includes('large')) multiplier *= 1.3;
  if (lower.includes('small')) multiplier *= 0.7;
  if (lower.includes('handful')) multiplier *= 0.5;
  if (lower.includes('cup')) multiplier *= 1.2;
  if (lower.includes('bowl')) multiplier *= 1.5;
  if (lower.includes('plate')) multiplier *= 2;

  // Portion descriptions
  if (lower.includes('fist')) multiplier *= 0.4;
  if (lower.includes('palm')) multiplier *= 0.5;
  if (lower.includes('scoop')) multiplier *= 0.7;

  const portion = multiplier === 1 ? 'serving' : `${multiplier}x serving`;

  return {
    name: foodName.charAt(0).toUpperCase() + foodName.slice(1),
    portion,
    calories: Math.round(baseMacros.calories * multiplier),
    protein: Math.round(baseMacros.protein * multiplier),
    carbs: Math.round(baseMacros.carbs * multiplier),
    fat: Math.round(baseMacros.fat * multiplier),
    confidence: 'ESTIMATE — log exact macros in Intel Center for precision'
  };
};

const getTimeOfDay = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
};

// Owner-only diagnostic surface for Gunny API failures (RAMPAGE only).
// Classifies the error bucket from `/api/gunny` and renders a short debug block
// so we can tell billing/auth/rate_limit apart from a generic comms drop.
const formatOwnerDiagnostic = (info: { errorType?: string; message?: string; status?: number; details?: string }): string => {
  const t = info.errorType || 'unknown';
  const hint =
    t === 'auth' ? 'Check ANTHROPIC_API_KEY in Railway env.'
    : t === 'billing' ? 'Anthropic billing — verify payment method & active credits.'
    : t === 'rate_limit' ? 'Hit per-minute rate limit — back off or downgrade tier.'
    : t === 'overloaded' ? 'Anthropic 529 — retry in a few seconds.'
    : t === 'model' ? 'Model string rejected — check TIER_MODEL_MAP.'
    : t === 'network' ? 'Network/timeout — check Railway logs for stream cut.'
    : t === 'stream_error' ? 'Mid-stream throw — see server log `Gunny API error`.'
    : 'Unclassified — check Railway logs.';
  const lines = [
    '⚠ [DEBUG · RAMPAGE]',
    `type: ${t}${info.status ? ` (HTTP ${info.status})` : ''}`,
    info.message ? `msg: ${info.message}` : null,
    info.details ? `details: ${info.details}` : null,
    `→ ${hint}`,
  ].filter(Boolean);
  return lines.join('\n');
};

const getTierColor = (tier: string): string => {
  switch (tier) {
    case 'haiku': return '#6B7B6B';
    case 'sonnet': return '#ffb800';
    case 'opus': return '#ff4444';
    case 'white_glove': return '#ff00ff';
    default: return '#888';
  }
};

const calculateStreak = (operator: Operator): number => {
  const today = new Date();
  let streak = 0;
  let currentDate = new Date(today);

  while (true) {
    const dateStr = toLocalDateStr(currentDate);
    if (operator.workouts[dateStr]?.completed) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
};

// Common exercise substitutions for injuries
const getExerciseSubstitute = (exerciseName: string, restrictions: string[]): string | null => {
  const nameLower = exerciseName.toLowerCase();

  for (const restriction of restrictions) {
    const restrictionLower = restriction.toLowerCase();

    if (restrictionLower.includes('overhead')) {
      if (nameLower.includes('overhead press') || nameLower.includes('osp') || nameLower.includes('shoulder press')) {
        return 'Landmine Press';
      }
    }

    if (restrictionLower.includes('deadlift')) {
      if (nameLower.includes('deadlift') && !nameLower.includes('rdl')) {
        return 'Trap Bar Deadlift';
      }
    }

    if (restrictionLower.includes('row') && restrictionLower.includes('bent')) {
      if (nameLower.includes('bent') && nameLower.includes('row')) {
        return 'Seal Row';
      }
    }

    if (restrictionLower.includes('wide grip')) {
      if (nameLower.includes('wide')) {
        return 'Neutral Grip ' + exerciseName.replace(/wide/i, 'neutral').trim();
      }
    }

    if (restrictionLower.includes('squat') && (restrictionLower.includes('back') || restrictionLower.includes('back issue'))) {
      if (nameLower.includes('back squat')) {
        return 'Leg Press';
      }
    }
  }

  return null;
};

// Scale weights proportionally for clients based on trainer's workout
const scaleWeight = (
  originalWeight: number,
  exerciseName: string,
  clientWeight: number,
  trainerWeight: number,
  clientPRs: Array<{ exercise: string; weight: number }>
): number => {
  const ratio = clientWeight / trainerWeight;

  // Identify exercise category
  const nameLower = exerciseName.toLowerCase();
  const isCompound = ['squat', 'deadlift', 'bench', 'row', 'press'].some(e => nameLower.includes(e));
  const scaleFactor = isCompound ? 0.7 : 0.8;

  let scaled = Math.round((originalWeight * ratio * scaleFactor) / 5) * 5;

  // Check against client's PR
  const clientPR = clientPRs.find(pr => pr.exercise.toLowerCase() === exerciseName.toLowerCase());
  if (clientPR && scaled > clientPR.weight) {
    scaled = Math.max(Math.round(clientPR.weight * 0.85 / 5) * 5, scaled);
  }

  return Math.max(45, scaled); // Minimum 45 lbs
};

// Format a workout with personalization
const formatPersonalizedWorkout = (
  trainerWorkout: Workout,
  trainerCallsign: string,
  clientCallsign: string,
  clientWeight: number,
  trainerWeight: number,
  clientPRs: Array<{ exercise: string; weight: number }>,
  clientInjuries: Array<{ restrictions: string[] }>,
  trainerNotes?: string
): string => {
  // trainerWorkout.date is a YYYY-MM-DD local key; parse in local tz so PST
  // viewers don't see the date shifted one day earlier.
  const workoutDate = formatLocalDateKey(trainerWorkout.date, { weekday: 'short', month: 'short', day: 'numeric' });

  let output = `YOUR TRAINER'S WORKOUT — ${workoutDate}
━━━━━━━━━━━━━━━━━━
${trainerCallsign} logged: ${trainerWorkout.title}

PERSONALIZED FOR YOU, ${clientCallsign}:
━━━━━━━━━━━━━━━━━━
Warmup: ${trainerWorkout.warmup}

`;

  let hasSubstitutions = false;

  for (const block of trainerWorkout.blocks) {
    if (block.type === 'exercise') {
      const exerciseBlock = block as any;
      let exercise = exerciseBlock.exerciseName;
      let prescription = exerciseBlock.prescription;

      // Check for injury restrictions
      for (const injury of clientInjuries) {
        const substitute = getExerciseSubstitute(exercise, injury.restrictions);
        if (substitute) {
          exercise = substitute;
          hasSubstitutions = true;
          break;
        }
      }

      // Scale weights in prescription
      const prescriptionMatch = prescription.match(/(@|x)\s*(\d+)/);
      if (prescriptionMatch) {
        const originalWeight = parseInt(prescriptionMatch[2]);
        const scaledWeight = scaleWeight(originalWeight, exerciseBlock.exerciseName, clientWeight, trainerWeight, clientPRs);
        prescription = prescription.replace(/@\s*\d+/g, `@ ${scaledWeight}`);
      }

      output += `${exercise}\n${prescription}\n`;
    } else {
      const condBlock = block as any;
      output += `${condBlock.description} (${condBlock.format})\n`;
    }
  }

  output += `\nCooldown: ${trainerWorkout.cooldown}

━━━━━━━━━━━━━━━━━━`;

  if (hasSubstitutions) {
    output += `\n⚠ Some exercises modified around your restrictions. No workarounds, champ — get the work in safely.`;
  } else {
    output += `\n⚠ Weights scaled to your level.`;
  }

  if (trainerNotes) {
    output += `\n\nTRAINER DIRECTIVE: ${trainerNotes}`;
  }

  return output;
};

// ═══ Chat persistence helpers (API-first, localStorage fallback) ═══
// Serializes a Message[] for both localStorage and the /api/chat PUT body.
const serializeMessages = (msgs: Message[]) =>
  msgs.map(m => ({ ...m, timestamp: new Date(m.timestamp).toISOString() }));

// Sync, immediate — cheap and survives tab unmount / page refresh.
const saveChatLocal = (opId: string, serialized: ReturnType<typeof serializeMessages>) => {
  try {
    localStorage.setItem(`gunny-chat-${opId}`, JSON.stringify(serialized));
  } catch { /* storage full */ }
};

// Async API write. `keepalive` lets the request complete even if the document
// unmounts or navigates away — critical because loadChat prefers API over local.
const saveChatRemote = (opId: string, chatType: string, serialized: ReturnType<typeof serializeMessages>) => {
  fetch('/api/chat', {
    method: 'PUT',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''}` },
    body: JSON.stringify({ operatorId: opId, chatType, messages: serialized }),
  }).catch(() => { /* API unavailable — localStorage will cover it */ });
};

const saveChatToStorage = (opId: string, chatType: string, msgs: Message[]) => {
  const serialized = serializeMessages(msgs);
  saveChatRemote(opId, chatType, serialized);
  saveChatLocal(opId, serialized);
};

const loadChatFromAPI = async (opId: string, chatType: string): Promise<Message[] | null> => {
  try {
    const res = await fetch(`/api/chat?operatorId=${opId}&chatType=${chatType}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const msgs = data.messages as Array<{ id: string; role: string; text: string; timestamp: string; isWorkout?: boolean }>;
    if (!Array.isArray(msgs) || msgs.length === 0) return null;
    return msgs.map(m => ({
      id: m.id,
      role: m.role as 'user' | 'gunny',
      text: m.text,
      timestamp: new Date(m.timestamp),
      isWorkout: m.isWorkout,
    }));
  } catch { return null; }
};

const loadChatFromLocalStorage = (opId: string): Message[] | null => {
  try {
    const raw = localStorage.getItem(`gunny-chat-${opId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Array<{ id: string; role: string; text: string; timestamp: string; isWorkout?: boolean }>;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map(m => ({
      id: m.id,
      role: m.role as 'user' | 'gunny',
      text: m.text,
      timestamp: new Date(m.timestamp),
      isWorkout: m.isWorkout,
    }));
  } catch { return null; }
};

// Check if operator needs onboarding (empty/incomplete profile)
const needsOnboarding = (op: Operator): boolean => {
  // If intake form was completed, never show onboarding — intake is the new flow
  if (op.intake?.completed || (op.profile as unknown as Record<string, unknown>)?.intakeCompleted) return false;
  const p = op.profile;
  // If no age, no weight, or no goals set — needs onboarding
  if (!p?.age || !p?.weight || !p?.goals?.length) return true;
  // If no training preferences set
  if (!op.preferences?.daysPerWeek || !op.preferences?.sessionDuration) return true;
  return false;
};

export const GunnyChat: React.FC<GunnyChatProps> = ({ operator, allOperators, onUpdateOperator }) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingStartedAt, setThinkingStartedAt] = useState<number | null>(null);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Track which operator ID we've initialized — only reset chat on actual user switch
  const initOperatorRef = useRef<string>('');

  // Apply profile data from onboarding AI response
  const applyProfileData = (profileData: Record<string, unknown>) => {
    if (!onUpdateOperator) return;
    const updated = { ...operator };

    if (profileData.profile && typeof profileData.profile === 'object') {
      const p = profileData.profile as Record<string, unknown>;
      updated.profile = {
        ...updated.profile,
        ...(p.age && { age: Number(p.age) }),
        ...(p.height && { height: String(p.height) }),
        ...(p.weight && { weight: Number(p.weight) }),
        ...(p.bodyFat && { bodyFat: Number(p.bodyFat) }),
        ...(p.trainingAge && { trainingAge: String(p.trainingAge) }),
        ...(p.goals && Array.isArray(p.goals) && { goals: p.goals as string[] }),
        ...(p.readiness && { readiness: Number(p.readiness) }),
        ...(p.sleep && { sleep: Number(p.sleep) }),
        ...(p.stress && { stress: Number(p.stress) }),
      };
    }

    if (profileData.preferences && typeof profileData.preferences === 'object') {
      const pref = profileData.preferences as Record<string, unknown>;
      updated.preferences = {
        ...updated.preferences,
        ...(pref.split && { split: String(pref.split) }),
        ...(pref.equipment && Array.isArray(pref.equipment) && { equipment: pref.equipment as string[] }),
        ...(pref.sessionDuration && { sessionDuration: Number(pref.sessionDuration) }),
        ...(pref.daysPerWeek && { daysPerWeek: Number(pref.daysPerWeek) }),
        ...(pref.weakPoints && Array.isArray(pref.weakPoints) && { weakPoints: pref.weakPoints as string[] }),
        ...(pref.avoidMovements && Array.isArray(pref.avoidMovements) && { avoidMovements: pref.avoidMovements as string[] }),
      };
    }

    if (profileData.injuries && Array.isArray(profileData.injuries)) {
      const injuries = (profileData.injuries as Array<Record<string, unknown>>).map((inj, i) => ({
        id: `inj-onboard-${Date.now()}-${i}`,
        name: String(inj.name || ''),
        status: (inj.status as 'active' | 'recovering' | 'cleared') || 'active',
        notes: String(inj.notes || ''),
        restrictions: Array.isArray(inj.restrictions) ? inj.restrictions as string[] : [],
      }));
      if (injuries.length > 0) {
        updated.injuries = [...(updated.injuries || []), ...injuries];
      }
    }

    if (profileData.nutrition && typeof profileData.nutrition === 'object') {
      const n = profileData.nutrition as Record<string, unknown>;
      if (n.targets && typeof n.targets === 'object') {
        const t = n.targets as Record<string, unknown>;
        updated.nutrition = {
          ...updated.nutrition,
          targets: {
            calories: Number(t.calories) || updated.nutrition?.targets?.calories || 2500,
            protein: Number(t.protein) || updated.nutrition?.targets?.protein || 150,
            carbs: Number(t.carbs) || updated.nutrition?.targets?.carbs || 250,
            fat: Number(t.fat) || updated.nutrition?.targets?.fat || 70,
          },
        };
      }
    }

    if (profileData.prs && Array.isArray(profileData.prs)) {
      const prs = (profileData.prs as Array<Record<string, unknown>>).map((pr, i) => ({
        id: `pr-onboard-${Date.now()}-${i}`,
        exercise: String(pr.exercise || ''),
        weight: Number(pr.weight) || 0,
        reps: Number(pr.reps) || 1,
        date: getLocalDateStr(),
        notes: String(pr.notes || 'Set during onboarding'),
      }));
      if (prs.length > 0) {
        updated.prs = [...(updated.prs || []), ...prs];
      }
    }

    onUpdateOperator(updated);

    // If onboarding is complete, exit onboarding mode
    if (profileData.onboardingComplete) {
      setIsOnboarding(false);
    }
  };

  useEffect(() => {
    if (initOperatorRef.current === operator.id) return;
    initOperatorRef.current = operator.id;

    const shouldOnboard = needsOnboarding(operator);
    setIsOnboarding(shouldOnboard);

    // Pick whichever source (API or localStorage) holds the fresher conversation
    // based on last-message timestamp. The old logic was "API first, localStorage
    // fallback only when API was empty," which silently dropped unsent messages:
    // a user who typed while offline had their messages in localStorage, but on
    // reconnect the API's stale history would overwrite them. Comparing by last
    // timestamp keeps the user's most recent work regardless of which side wrote
    // it last, and then syncs the loser back up to the winner.
    const lastTs = (msgs: Message[]): number => {
      const last = msgs[msgs.length - 1];
      const t = last?.timestamp ? new Date(last.timestamp).getTime() : 0;
      return Number.isFinite(t) ? t : 0;
    };

    const loadChat = async () => {
      // If onboarding needed, check for existing onboarding chat first
      if (shouldOnboard) {
        const onboardMessages = await loadChatFromAPI(operator.id, 'gunny-onboarding');
        if (onboardMessages && onboardMessages.length > 0) {
          setMessages(onboardMessages);
          inputRef.current?.focus();
          return;
        }
      }

      const apiMessages = await loadChatFromAPI(operator.id, 'gunny-tab');
      const localMessages = !shouldOnboard ? loadChatFromLocalStorage(operator.id) : null;

      const apiHas = !!apiMessages && apiMessages.length > 0;
      const localHas = !!localMessages && localMessages.length > 0;

      if (!shouldOnboard && (apiHas || localHas)) {
        let winner: Message[];
        if (apiHas && localHas) {
          winner = lastTs(localMessages!) > lastTs(apiMessages!) ? localMessages! : apiMessages!;
        } else {
          winner = (apiHas ? apiMessages! : localMessages!);
        }
        setMessages(winner);
        // setMessages will trigger the persist effect (content-hash signature)
        // which pushes winner to BOTH localStorage (immediate) and the API
        // (debounced 600ms), keeping the loser side in sync automatically.
        inputRef.current?.focus();
        return;
      }

      // API has data but we still need onboarding → fall through to onboarding block.
      // (The old code had this intent but computed it in a more convoluted way.)

      if (shouldOnboard) {
        // Start onboarding — send initial message to Gunny API
        setIsTyping(true); setThinkingStartedAt(Date.now());
        try {
          const res = await fetch('/api/gunny', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''}` },
            body: JSON.stringify({
              messages: [{ role: 'user', text: 'I just signed up. Start my intake assessment.' }],
              tier: operator.tier,
              mode: 'onboarding',
              clientDate: getLocalDateStr(),
              clientDateLong: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
              clientTimezone: getLocalTimezone(),
              operatorContext: {
                callsign: operator.callsign,
                name: operator.name,
                role: operator.role,
                weight: operator.profile?.weight || 0,
                goals: operator.profile?.goals || [],
                readiness: operator.profile?.readiness || 0,
                prs: 'None',
                injuries: 'None',
                trainerNotes: operator.trainerNotes || 'None',
                language: 'en',
              },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            // Guard against 200 OK with empty/missing response — without this,
            // an empty body would render a blank Gunny bubble and the user sees
            // nothing during onboarding. Throw so the catch fires the hardcoded
            // fallback greeting below.
            if (!data?.response || typeof data.response !== 'string' || !data.response.trim()) {
              throw new Error('Empty onboarding response');
            }
            const greeting: Message = {
              id: 'onboard-greeting-' + Date.now(),
              role: 'gunny',
              text: data.response,
              timestamp: new Date(),
            };
            setMessages([greeting]);
            if (data.profileData) applyProfileData(data.profileData);
          } else {
            throw new Error('API error');
          }
        } catch {
          // Fallback onboarding greeting
          const greeting: Message = {
            id: 'onboard-greeting-' + Date.now(),
            role: 'gunny',
            text: `Listen up, ${operator.callsign}. Before I can build you a program that actually works, I need to know what I'm working with. Let's run a quick intake.\n\nFirst — how old are you, what's your height and weight, and how long have you been training?`,
            timestamp: new Date(),
          };
          setMessages([greeting]);
        }
        setIsTyping(false); setThinkingStartedAt(null);
        inputRef.current?.focus();
        return;
      }

      // No saved history, no onboarding — generate fresh greeting
      let greetingText = '';
      if (operator.role === 'trainer') {
        const clientCount = getTrainerClients(operator.id, allOperators).length;
        greetingText = `War room is open, Coach. You have ${clientCount} active clients. This is your gameplan hub — BUILD A WORKOUT, plan a WEEKLY SPLIT, deep-dive GOAL PATHS, or review MY CLIENTS.`;
      } else {
        const trainer = getClientTrainer(operator.id, allOperators);
        const trainerName = trainer ? trainer.callsign : 'your trainer';
        greetingText = `Welcome to the war room, ${operator.callsign}. Your trainer is ${trainerName}. This is where we go deep — BUILD A WORKOUT, plan your WEEKLY SPLIT, review GOAL PATHS, or ask me anything about your programming.`;
      }
      const greeting: Message = {
        id: 'greeting-' + Date.now(),
        role: 'gunny',
        text: greetingText,
        timestamp: new Date(),
      };
      setMessages([greeting]);
      inputRef.current?.focus();
    };
    loadChat();
  }, [operator.id, operator.role, allOperators]);

  // Persist messages — split strategy:
  // • localStorage: written on every content change (sync, cheap, survives tab unmount + refresh).
  // • API: debounced 600ms after last change so rapid streaming deltas collapse into one PUT.
  //
  // Why the content-hash signature? The previous gate triggered only on messages.length change,
  // which missed every delta after the first (streaming mutates the placeholder's text, not the
  // array length) — so localStorage/API froze at "Got"/"Roger" mid-stream. Hashing id:textLength
  // per message catches text mutations too.
  const prevSnapshotRef = useRef('');
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPendingSaveRef = useRef<{ chatType: string; serialized: ReturnType<typeof serializeMessages> } | null>(null);

  useEffect(() => {
    if (messages.length === 0) return;

    const snapshot = messages.map(m => `${m.id}:${m.text?.length ?? 0}`).join('|');
    if (snapshot === prevSnapshotRef.current) return;
    prevSnapshotRef.current = snapshot;

    const chatType = isOnboarding ? 'gunny-onboarding' : 'gunny-tab';
    const serialized = serializeMessages(messages);

    saveChatLocal(operator.id, serialized);
    lastPendingSaveRef.current = { chatType, serialized };

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      saveDebounceRef.current = null;
      const pending = lastPendingSaveRef.current;
      if (pending) {
        saveChatRemote(operator.id, pending.chatType, pending.serialized);
        lastPendingSaveRef.current = null;
      }
    }, 600);
  }, [messages, operator.id, isOnboarding]);

  // On unmount, flush any pending debounced save using keepalive so the final stream
  // content reaches the API even if the tab was switched / page navigated away.
  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = null;
      }
      const pending = lastPendingSaveRef.current;
      if (pending) {
        saveChatRemote(operator.id, pending.chatType, pending.serialized);
        lastPendingSaveRef.current = null;
      }
    };
  }, [operator.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const calculateTrainingAge = (): number => {
    const parsed = parseInt(operator.profile?.trainingAge || '0');
    return isNaN(parsed) ? 0 : parsed;
  };

  const getGoalPath = (userInput: string): string | null => {
    const lower = userInput.toLowerCase();
    if (lower.includes('hypertrophy') || lower.includes('muscle building') || lower.includes('size')) return 'HYPERTROPHY';
    if (lower.includes('fat loss') || lower.includes('cut') || lower.includes('lean')) return 'FAT_LOSS';
    if (lower.includes('strength') || lower.includes('powerlifting') || lower.includes('max')) return 'STRENGTH';
    if (lower.includes('athletic') || lower.includes('sport') || lower.includes('performance')) return 'ATHLETIC_PERFORMANCE';
    if (lower.includes('general') || lower.includes('balanced') || lower.includes('fitness')) return 'GENERAL_FITNESS';
    return null;
  };

  const getMuscleGroup = (userInput: string): string | null => {
    const lower = userInput.toLowerCase();
    if (lower.includes('chest') || lower.includes('bench') || lower.includes('push day')) return 'CHEST';
    if (lower.includes('back') || lower.includes('deadlift') || lower.includes('row') || lower.includes('pull day')) return 'BACK';
    if (lower.includes('leg') || lower.includes('squat') || lower.includes('lunge')) return 'LEGS';
    if (lower.includes('shoulder') || lower.includes('ohp')) return 'SHOULDERS';
    if (lower.includes('arm') || lower.includes('bicep') || lower.includes('tricep')) return 'ARMS';
    return null;
  };

  const buildWorkout = (muscleGroup: string, goalKey: string | null): WorkoutSession => {
    const template = MUSCLE_GROUP_TEMPLATES[muscleGroup as keyof typeof MUSCLE_GROUP_TEMPLATES];
    const goal = goalKey ? GOAL_PATHS[goalKey as keyof typeof GOAL_PATHS] : GOAL_PATHS.GENERAL_FITNESS;
    const readiness = operator.profile?.readiness || 75;
    return {
      muscleGroup, goal: goal.name,
      warmup: '10 MIN CARDIO WARMUP\nLight jog, rowing machine, or assault bike. Dynamic mobility work.',
      primer: { movements: template.primerMovements, rounds: goal.primerRounds },
      complex: { movement: template.complexMovement, reps: `${goal.complexReps} reps`, timing: 'every 90 seconds x 4 sets' },
      strength: { exercise: template.strengthExercise, sets: goal.strengthSets, rest: readiness > 75 ? '60 seconds' : '90 seconds' },
      isolation: { exercise: template.isolationExercise, reps: '10-12 reps', rest: '45 seconds', rounds: goal.isolationRounds },
      metcon: { format: '3 rounds for time', movements: [template.metconExample] },
    };
  };

  const formatWorkout = (workout: WorkoutSession): string => {
    return `════════════════════════════════════════
WORKOUT OF THE DAY — ${workout.muscleGroup} FOCUS
Goal Path: ${workout.goal}
════════════════════════════════════════

A. WARMUP
${workout.warmup}

B. PRIMER — ${workout.primer.rounds} rounds (not for time)
${workout.primer.movements.map((m) => `   • ${m}`).join('\n')}
Rest 60-90 sec between rounds.

C. COMPLEX MOVEMENT
${workout.complex.movement} — ${workout.complex.reps} ${workout.complex.timing}
Rest 90 sec between sets.

D. STRENGTH
${workout.strength.exercise}
Sets: ${workout.strength.sets} | Rest: ${workout.strength.rest}
Target: challenging weight, technical execution

E. ISOLATION
${workout.isolation.exercise} — ${workout.isolation.reps}
${workout.isolation.rounds} rounds | Rest: ${workout.isolation.rest}

F. METCON
${workout.metcon.format}
${workout.metcon.movements.map((m) => `   ${m}`).join('\n')}
Track splits — compete with yesterday's time.

════════════════════════════════════════
Notes: Follow form over ego. Hydrate. Stay locked in.
════════════════════════════════════════`;
  };

  const generateGunnyResponse = (userMessage: string): { response: string; updatedOperator?: Operator } => {
    const lower = userMessage.toLowerCase();

    // TRAINER FEATURE: MY CLIENTS
    if (operator.role === 'trainer' && (lower.includes('my clients') || lower.includes('client list') || lower.includes('client check') || lower.includes('roster') || lower.includes('check clients'))) {
      const clients = getTrainerClients(operator.id, allOperators);
      if (clients.length === 0) {
        return { response: `No clients on the roster yet, Coach. Ready when they are.` };
      }

      let response = `CLIENT ROSTER — ${operator.callsign}
━━━━━━━━━━━━━━━━━━\n`;

      for (const client of clients) {
        const streak = calculateStreak(client);
        const lastWorkoutDate = Object.keys(client.workouts)
          .filter(date => client.workouts[date]?.completed)
          .sort()
          .reverse()[0];

        response += `${client.callsign} — ${client.name}
  Tier: ${client.tier.toUpperCase()} | Last Workout: ${lastWorkoutDate ? formatLocalDateKey(lastWorkoutDate) : 'None'}
  Goals: ${client.profile.goals?.join(', ') || 'TBD'}
  Readiness: ${client.profile.readiness}% | Streak: ${streak} days
  Notes: ${client.trainerNotes || 'No custom directives set'}

`;
      }

      response += `━━━━━━━━━━━━━━━━━━
Total: ${clients.length} active clients`;

      return { response };
    }

    // TRAINER FEATURE: CLIENT NOTES
    if (operator.role === 'trainer' && (lower.includes('client notes') || lower.includes('set notes') || lower.includes('directives') || lower.includes('customize'))) {
      const clients = getTrainerClients(operator.id, allOperators);
      if (clients.length === 0) {
        return { response: `No clients to set notes for yet, Coach.` };
      }

      let response = `CURRENT CLIENT DIRECTIVES:
━━━━━━━━━━━━━━━━━━\n`;

      for (const client of clients) {
        response += `${client.callsign}: ${client.trainerNotes || '(none set)'}
`;
      }

      response += `\nTo update notes, log in to INTEL CENTER and edit each client's profile. I can't modify notes from chat.`;

      return { response };
    }

    // CLIENT FEATURE: TRAINER'S WORKOUT
    if (operator.role === 'client' && (lower.includes('what did my trainer') || lower.includes('trainer workout') || lower.includes('coach workout') || lower.includes('trainer\'s workout') || lower.includes('what did coach') || lower.includes('show me trainer'))) {
      const trainer = getClientTrainer(operator.id, allOperators);
      if (!trainer) {
        return { response: `No trainer assigned yet, champ. Get one set up and we can sync workouts.` };
      }

      // Look for today's workout, then yesterday, then day before
      const today = getLocalDateStr();
      let workoutDate = today;
      let workout: Workout | null = null;

      for (let i = 0; i < 3; i++) {
        const dateToCheck = new Date();
        dateToCheck.setDate(dateToCheck.getDate() - i);
        const dateStr = toLocalDateStr(dateToCheck);
        if (trainer.workouts[dateStr]?.completed) {
          workoutDate = dateStr;
          workout = trainer.workouts[dateStr];
          break;
        }
      }

      if (!workout) {
        return { response: `Your trainer hasn't logged a workout recently. Check back later or ask Gunny to BUILD you a workout.` };
      }

      const response = formatPersonalizedWorkout(
        workout,
        trainer.callsign,
        operator.callsign,
        operator.profile.weight,
        trainer.profile.weight,
        operator.prs,
        operator.injuries,
        operator.trainerNotes
      );

      return { response };
    }

    // NOTE: the old "build me a workout" branch used to intercept here and return a
    // hard-coded template from buildWorkout/MUSCLE_GROUP_TEMPLATES, ignoring the
    // operator's goals/PRs/injuries/preferences. Users reported it as "a generic
    // workout." Routing these requests to the LLM (the fallthrough path below) lets
    // Gunny generate a personalized workout using the full operator context built by
    // buildFullGunnyContext. The dead helpers (buildWorkout/formatWorkout/
    // getMuscleGroup/getGoalPath/MUSCLE_GROUP_TEMPLATES/WorkoutSession) will be
    // removed in the sprint 6 dead-code pass.

    if (lower.includes('goal path') || lower.includes('goal paths') || lower === 'paths' || lower === 'show me goal paths') {
      return { response: `Roger that, champ. Here's what I've got:\n\nHYPERTROPHY — ${GOAL_PATHS.HYPERTROPHY.description}\n\nFAT LOSS — ${GOAL_PATHS.FAT_LOSS.description}\n\nSTRENGTH — ${GOAL_PATHS.STRENGTH.description}\n\nATHLETIC PERFORMANCE — ${GOAL_PATHS.ATHLETIC_PERFORMANCE.description}\n\nGENERAL FITNESS — ${GOAL_PATHS.GENERAL_FITNESS.description}\n\nTell me your target and I'll build accordingly. Copy that?` };
    }

    if (lower.includes('readiness') || lower.includes('check readiness') || lower === 'how am i doing') {
      const readiness = operator.profile?.readiness || 75;
      const sleep = operator.profile?.sleep || 7;
      const stress = operator.profile?.stress || 5;
      const trainingAge = calculateTrainingAge();
      let assessment = readiness > 85 ? 'GREEN ZONE. All systems go. Push hard today.'
        : readiness > 70 ? 'OPERATIONAL. Execute your primary lift and stay disciplined.'
        : readiness > 55 ? 'YELLOW ZONE. Dial it back — lighter weight, perfect form, no ego.'
        : 'RED ZONE. Recovery session recommended — mobility, light conditioning, rest.';
      return { response: `READINESS REPORT:\nReadiness: ${readiness}% | Sleep: ${sleep}/10 | Stress: ${stress}/10\nTraining Age: ${trainingAge} years\n\n${assessment}\n\nRecommendation: ${readiness > 75 ? 'Push intensity' : readiness > 55 ? 'Moderate effort' : 'Focus on recovery'}.` };
    }

    if (lower.includes('weekly') || lower.includes('week plan') || lower.includes('plan my week')) {
      const split = operator.preferences?.split || 'Push/Pull/Legs';
      const daysPerWeek = operator.preferences?.daysPerWeek || 4;
      return { response: `WEEKLY OPERATION PLAN — ${split} split, ${daysPerWeek} days/week\n\nDay 1: PUSH (Chest, Shoulders, Triceps)\nDay 2: PULL (Back, Biceps)\nDay 3: LEGS (Quads, Hamstrings, Glutes)\nDay 4: ACCESSORIES (Weak points)\n${daysPerWeek >= 5 ? 'Day 5: CONDITIONING (Metcon focus)\n' : ''}\nTell me which day and I'll build that workout, champ.` };
    }

    if (lower.includes('my injuries') || lower.includes('injury list') || lower.includes('show injuries') || lower.includes('my restrictions')) {
      const injuries = operator.injuries || [];
      if (injuries.length > 0) {
        const injuryList = injuries.map((inj) => `${inj.name}: ${inj.restrictions?.join(', ') || 'avoid heavy loading'}`).join('\n');
        return { response: `ACTIVE INJURIES LOGGED:\n${injuryList}\n\nNo heroes, champ. Follow your restrictions. We'll modify workouts around this.` };
      }
      return { response: "No injuries on the books, champ. You're clean. Keep that body healthy." };
    }

    // Food logging — the crude estimateMacros() fallback used to intercept
    // "i ate / i had / just ate / had a / log food / track meal / eaten"
    // messages here. It's been removed so ALL food messages reach the Gunny
    // API, which does far better analysis AND writes via <meal_json>.
    // (Follow-ups like "add it to my meal log" now also reach the AI and
    // succeed, instead of being told "I can't write to your meal log".)

    // Macro recommendations
    if (lower.includes('macro recommendation') || lower.includes('what should i eat') ||
        lower.includes('how much protein') || lower.includes('nutrition plan') ||
        lower.includes('diet recommendation') || lower.includes('meal plan')) {
      const goals = operator.profile?.goals || [];
      const weight = operator.profile?.weight || 180;
      const nutrition = operator.nutrition;
      const today = getLocalDateStr();
      const todayMeals = nutrition?.meals?.[today] || [];
      const currentCalories = todayMeals.reduce((sum: number, m: { calories?: number }) => sum + (m.calories || 0), 0);
      const targetCalories = nutrition?.targets?.calories || 2500;
      const currentProtein = todayMeals.reduce((sum: number, m: { protein?: number }) => sum + (m.protein || 0), 0);
      const targetProtein = nutrition?.targets?.protein || Math.round(weight * 1.1);
      const currentCarbs = todayMeals.reduce((sum: number, m: { carbs?: number }) => sum + (m.carbs || 0), 0);
      const targetCarbs = nutrition?.targets?.carbs || Math.round(targetCalories * 0.4 / 4);
      const timeOfDay = getTimeOfDay();

      let mealSuggestion = '';
      if (timeOfDay === 'morning') {
        mealSuggestion = 'BREAKFAST: Eggs + oats + banana. Solid protein + carbs to start the day.';
      } else if (timeOfDay === 'afternoon') {
        mealSuggestion = 'PRE-TRAINING: Rice + chicken breast. Carbs + protein for fuel.';
      } else {
        mealSuggestion = 'DINNER: Salmon + sweet potato + avocado. Complete meal with all macros.';
      }

      const goalText = goals.length > 0 ? goals.join(', ') : 'general fitness';

      const response = `NUTRITION BRIEFING — ${operator.callsign}
━━━━━━━━━━━━━━━━━━
TARGETS: ${targetCalories} cal | ${targetProtein}P | ${targetCarbs}C | ${Math.round(targetCalories * 0.25 / 9)}F

Based on your goals [${goalText}] at ${weight}lbs:
- Protein: 1.1g/lb = ~${Math.round(weight * 1.1)}g ✓ Target looks right
- You're currently at ${currentCalories}/${targetCalories} cal today
- Still need: ~${Math.max(0, targetProtein - currentProtein)}g protein, ~${Math.max(0, targetCarbs - currentCarbs)}g carbs

NEXT MEAL SUGGESTION:
${mealSuggestion}`;

      return { response };
    }

    if (lower.includes('nutrition status') || lower.includes('check macros') || lower.includes('macro status') || lower.includes('how are my macros')) {
      const nutrition = operator.nutrition;
      const today = getLocalDateStr();
      const todayMeals = nutrition?.meals?.[today] || [];
      const currentCalories = todayMeals.reduce((sum: number, m: { calories?: number }) => sum + (m.calories || 0), 0);
      const targetCalories = nutrition?.targets?.calories || 2500;
      const currentProtein = todayMeals.reduce((sum: number, m: { protein?: number }) => sum + (m.protein || 0), 0);
      const targetProtein = nutrition?.targets?.protein || 150;
      const rec = currentCalories < targetCalories * 0.85 ? 'UNDER. Fuel up before training.'
        : currentCalories > targetCalories * 1.15 ? 'OVER. Tighten it up.'
        : 'Tracking solid. Discipline.';
      return { response: `NUTRITION STATUS:\nCalories: ${currentCalories}/${targetCalories} | Protein: ${currentProtein}g/${targetProtein}g\n\n${rec}` };
    }

    if (/\bprs?\b/.test(lower) || lower.includes('personal record') || /\bmy best\b/.test(lower) || lower.includes('show my best')) {
      const prs = operator.prs || [];
      if (prs.length > 0) {
        const prList = prs.slice(0, 3).map((pr) => `${pr.exercise}: ${pr.weight}lbs x${pr.reps}`).join('\n');
        return { response: `RECENT PRs:\n${prList}\n\nChase those numbers, champ. Build on the foundation.` };
      }
      return { response: "No PRs logged yet. Establish your baseline on main lifts. First attempt counts." };
    }

    // BETA FEEDBACK HANDLER
    if (lower.includes('feedback') || lower.includes('bug report') || lower.includes('bug:') || lower.includes('feedback:') ||
        lower.includes('suggestion') || lower.includes('report issue')) {
      // Extract feedback text
      let feedbackText = userMessage;
      const feedbackKeywords = ['feedback:', 'bug:', 'bug report:', 'suggestion:', 'report issue:'];
      for (const keyword of feedbackKeywords) {
        const keywordIndex = lower.indexOf(keyword);
        if (keywordIndex !== -1) {
          feedbackText = userMessage.substring(keywordIndex + keyword.length).trim();
          break;
        }
      }

      // If no keyword found, use entire message
      if (feedbackText === userMessage) {
        feedbackText = userMessage;
      }

      if (feedbackText && onUpdateOperator) {
        const updatedOp = { ...operator };
        if (!updatedOp.betaFeedback) {
          updatedOp.betaFeedback = [];
        }
        updatedOp.betaFeedback.push(feedbackText);
        onUpdateOperator(updatedOp);

        return { response: `FEEDBACK LOGGED — Thanks for helping us improve, ${operator.callsign}. Your input shapes the mission. Keep it coming.` };
      }

      return { response: `Ready to log feedback, ${operator.callsign}. What's on your mind?` };
    }

    // TRAINER FEATURE: REVENUE SHARE
    if (operator.role === 'trainer' && (lower.includes('revenue') || lower.includes('earnings') || lower.includes('my share') || lower.includes('trainer revenue'))) {
      const clients = getTrainerClients(operator.id, allOperators);

      // Count clients by tier
      const tierCounts: Record<string, number> = {
        haiku: 0,
        sonnet: 0,
        opus: 0,
        white_glove: 0,
      };

      for (const client of clients) {
        tierCounts[client.tier]++;
      }

      // Calculate revenue
      let response = `TRAINER REVENUE REPORT — ${operator.callsign}\n━━━━━━━━━━━━━━━━━━\nCLIENT BREAKDOWN:\n`;
      let totalMonthly = 0;

      for (const client of clients) {
        const tierConfig = TIER_CONFIGS[client.tier];
        response += `${client.callsign} — ${tierConfig.name} (${tierConfig.model}) → $${tierConfig.trainerShare.toFixed(2)}/mo\n`;
        totalMonthly += tierConfig.trainerShare;
      }

      const totalAnnual = totalMonthly * 12;

      response += `\nMONTHLY SHARE: $${totalMonthly.toFixed(2)}/mo\nPROJECTED ANNUAL: $${totalAnnual.toFixed(2)}/yr\n\n`;

      if (clients.length < 10) {
        const avgShare = clients.length > 0 ? totalMonthly / clients.length : 0;
        response += `Scale to 10 clients avg $${avgShare.toFixed(2)} share = $${(avgShare * 10).toFixed(2)}/mo\n`;
        response += `Scale to 50 clients avg $${avgShare.toFixed(2)} share = $${(avgShare * 50).toFixed(2)}/mo`;
      }

      return { response };
    }

    return { response: "Stay in the fight, champ. What's the mission? BUILD A WORKOUT, check READINESS, review GOAL PATHS, or plan your WEEK?" };
  };

  const FALLBACK_RESPONSE = "Stay in the fight, champ. What's the mission? BUILD A WORKOUT, check READINESS, review GOAL PATHS, or plan your WEEK?";

  // Store last workout data from AI for "add it" / "save it" commands
  const lastWorkoutDataRef = useRef<Record<string, unknown> | null>(null);

  const callGunnyAPI = async (allMessages: Message[], forceMode?: string): Promise<{ response: string; workoutData?: Record<string, unknown>; workoutModification?: WorkoutModification; profileData?: Record<string, unknown>; mealData?: { name: string; calories: number; protein: number; carbs: number; fat: number; date?: string } } | null> => {
    try {
      const recentMessages = allMessages.slice(-10).map(m => ({
        role: m.role,
        text: m.text,
        ...(m.image && { image: m.image }),
      }));

      // ── Full operator context (supercharged) ──
      const prof = operator.profile;
      const intake = operator.intake;
      const prefs = operator.preferences;
      const today = getLocalDateStr();
      const todayWorkout = operator.workouts?.[today];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const workoutsMap = (operator.workouts || {}) as Record<string, any>;
      const workoutDates = Object.keys(workoutsMap).sort().reverse().slice(0, 7);
      const recentWorkoutHistory = workoutDates.map(date => {
        const w = workoutsMap[date];
        const blocks = (w?.blocks || []) as Array<{ type: string; exerciseName?: string; prescription?: string }>;
        const exercises = blocks
          .filter(b => b.type === 'exercise')
          .map(b => `${b.exerciseName} (${b.prescription})`)
          .join(', ');
        return `${date}: "${w?.title || 'Untitled'}" — ${exercises}${w?.completed ? ' ✅ COMPLETED' : ''}`;
      }).join('\n');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nutri = operator.nutrition as any;
      const mealLog = (nutri?.meals || {}) as Record<string, Array<{ calories: number; protein: number; carbs: number; fat: number }>>;
      const mealDates = Object.keys(mealLog).sort().reverse().slice(0, 3);
      const recentMealHistory = mealDates.map(date => {
        const meals = mealLog[date] || [];
        const total = meals.reduce((acc, m) => ({
          calories: acc.calories + (m.calories || 0), protein: acc.protein + (m.protein || 0),
          carbs: acc.carbs + (m.carbs || 0), fat: acc.fat + (m.fat || 0),
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
        return `${date}: ${meals.length} meals — ${total.calories}cal, ${total.protein}g P, ${total.carbs}g C, ${total.fat}g F`;
      }).join('\n');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sitrep = operator.sitrep as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dailyBrief = operator.dailyBrief as any;
      void sitrep; void dailyBrief;

      // Tasks 12/13: delegate to the shared context builder. AppShell uses
      // the same function, so the main chat and side panel no longer drift.
      const operatorContext = buildFullGunnyContext(operator, { language: 'en' });
      /* LEGACY inline builder preserved for reference:
      const _legacyContext = {
        callsign: operator.callsign, name: operator.name, role: operator.role, language: 'en',
        weight: prof?.weight, height: prof?.height, age: prof?.age, bodyFat: prof?.bodyFat, trainingAge: prof?.trainingAge,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fitnessLevel: (operator as any).fitnessLevel || intake?.fitnessLevel || prof?.fitnessLevel,
        experienceYears: intake?.experienceYears ?? prof?.experienceYears,
        goals: prof?.goals, readiness: prof?.readiness,
        sleepQuality: intake?.sleepQuality || prof?.sleep, stressLevel: intake?.stressLevel || prof?.stress,
        movementScreenScore: intake?.movementScreenScore, motivationFactors: intake?.motivationFactors,
        availableEquipment: intake?.availableEquipment || prefs?.equipment, equipmentDetailed: prefs?.equipmentDetailed,
        preferredSplit: prefs?.split, daysPerWeek: prefs?.daysPerWeek, sessionDuration: prefs?.sessionDuration,
        preferredWorkoutTime: intake?.preferredWorkoutTime || prof?.preferredWorkoutTime,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        macroTargets: (operator.nutrition as any)?.targets,
        nutritionHabits: intake?.nutritionHabits || prof?.nutritionHabits, currentDiet: intake?.currentDiet,
        mealsPerDay: intake?.mealsPerDay, dailyWaterOz: intake?.dailyWaterOz,
        proteinPriority: intake?.proteinPriority, dietaryRestrictions: intake?.dietaryRestrictions,
        supplements: intake?.supplements, healthConditions: intake?.healthConditions || prof?.healthConditions,
        prs: (operator.prs || []).slice(0, 10).map(pr => ({
          exercise: pr.exercise, weight: pr.weight, reps: pr.reps, date: pr.date, type: pr.type || 'strength', notes: pr.notes,
        })),
        injuries: (operator.injuries || []).map(inj => ({
          id: inj.id, name: inj.name, status: inj.status, notes: inj.notes, restrictions: inj.restrictions,
        })),
        injuryNotes: intake?.injuryNotes,
        trainerNotes: operator.trainerNotes || 'None', wearableDevice: intake?.wearableDevice,
        sitrep: sitrep && Object.keys(sitrep).length > 0 ? {
          summary: sitrep.summary, trainingPlan: sitrep.trainingPlan,
          nutritionPlan: sitrep.nutritionPlan ? {
            dailyCalories: sitrep.nutritionPlan.dailyCalories, protein: sitrep.nutritionPlan.protein,
            carbs: sitrep.nutritionPlan.carbs, fat: sitrep.nutritionPlan.fat,
            mealsPerDay: sitrep.nutritionPlan.mealsPerDay, hydrationOz: sitrep.nutritionPlan.hydrationOz,
            approach: sitrep.nutritionPlan.approach,
          } : null,
          priorityFocus: sitrep.priorityFocus, restrictions: sitrep.restrictions, milestones30Day: sitrep.milestones30Day,
        } : null,
        dailyBrief: dailyBrief?.date === today ? {
          complianceScore: dailyBrief.complianceScore, adjustments: dailyBrief.adjustments, gunnyNote: dailyBrief.gunnyNote,
        } : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        todayWorkout: todayWorkout ? {
          title: (todayWorkout as any).title,
          exercises: ((todayWorkout as any).blocks || [])
            .filter((b: { type: string }) => b.type === 'exercise')
            .map((b: { exerciseName?: string; prescription?: string }) => `${b.exerciseName} (${b.prescription})`),
          completed: (todayWorkout as any).completed,
        } : null,
        recentWorkoutHistory: recentWorkoutHistory || 'No workouts logged yet',
        recentMealHistory: recentMealHistory || 'No meals logged yet',
        workoutStreak: (() => {
          let streak = 0; const now = new Date();
          for (let i = 0; i < 365; i++) {
            const d = new Date(now); d.setDate(d.getDate() - i);
            const key = toLocalDateStr(d);
            if (workoutsMap[key]?.completed) streak++; else if (i > 0) break;
          }
          return streak;
        })(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        totalWorkoutsCompleted: Object.values(workoutsMap).filter((w: any) => w?.completed).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recentDayTags: Object.entries(operator.dayTags || {}).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7)
          .map(([date, tag]) => `${date}: [${(tag as any).color}] ${(tag as any).note}`).join('\n') || null,
        lastCompletedWorkout: (() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tw = todayWorkout as any;
          const target = tw?.completed ? tw : findMostRecentCompletedWorkout(operator);
          if (!target) return null;
          return buildWorkoutAnalysis(target, operator.prs || [], operator.workouts || {});
        })(),
      };
      END LEGACY */

      const apiMode = forceMode || (isOnboarding ? 'onboarding' : undefined);

      // Build trainer dataset for workout personalization
      const trainer = operator.trainerId ? allOperators.find(op => op.id === operator.trainerId) : null;
      const trainerData = trainer ? {
        workouts: trainer.workouts,
        preferences: trainer.preferences,
        prs: trainer.prs,
        profile: trainer.profile,
        trainerNotes: operator.trainerNotes,
      } : null;

      const res = await fetch('/api/gunny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''}` },
        body: JSON.stringify({
          messages: recentMessages,
          tier: operator.tier,
          operatorContext,
          clientDate: getLocalDateStr(),
          clientDateLong: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          clientTimezone: getLocalTimezone(),
          ...(apiMode && { mode: apiMode }),
          ...(trainerData && { trainerData }),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Return the specific error from the API so the user sees what's wrong
        const errMsg = data?.error || 'Gunny AI temporarily offline.';
        return { response: errMsg };
      }
      return { response: data.response, workoutData: data.workoutData, workoutModification: data.workoutModification, profileData: data.profileData, mealData: data.mealData };
    } catch {
      return { response: 'Network error — check your internet connection and try again.' };
    }
  };

  // ── STREAMING API CONSUMER ──
  // Drop-in replacement for callGunnyAPI that streams tokens via SSE.
  // Returns the same shape as callGunnyAPI, but also invokes onDelta
  // as chunks arrive so the caller can update the in-progress message.
  const callGunnyAPIStreaming = async (
    allMessages: Message[],
    opts: {
      forceMode?: string;
      onDelta: (accumulated: string) => void;
      onError?: (info: { errorType?: string; message?: string; status?: number; details?: string }) => void;
    }
  ): Promise<{
    response: string;
    workoutData?: Record<string, unknown>;
    workoutModification?: Record<string, unknown>;
    profileData?: Record<string, unknown>;
    mealData?: { name: string; calories: number; protein: number; carbs: number; fat: number; date?: string };
  } | null> => {
    try {
      const recentMessages = allMessages.slice(-10).map((m) => ({
        role: m.role,
        text: m.text,
        ...(m.image ? { image: m.image } : {}),
      }));

      const operatorContext = buildFullGunnyContext(operator, { language: 'en' });
      const apiMode = opts.forceMode || (isOnboarding ? 'onboarding' : undefined);

      const trainer = operator.trainerId ? allOperators.find(op => op.id === operator.trainerId) : null;
      const trainerData = trainer ? {
        workouts: trainer.workouts,
        preferences: trainer.preferences,
        prs: trainer.prs,
        profile: trainer.profile,
        trainerNotes: operator.trainerNotes,
      } : null;

      const res = await fetch('/api/gunny', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          messages: recentMessages,
          tier: operator.tier,
          operatorContext,
          clientDate: getLocalDateStr(),
          clientDateLong: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          clientTimezone: getLocalTimezone(),
          ...(apiMode && { mode: apiMode }),
          ...(trainerData && { trainerData }),
        }),
      });

      // Graceful fallback: server returned JSON (error path or old deployment)
      const ctype = res.headers.get('content-type') || '';
      if (!ctype.includes('text/event-stream')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          opts.onError?.({
            errorType: data?.errorType,
            message: data?.error,
            status: res.status,
            details: data?.details,
          });
          return null;
        }
        opts.onDelta(data.response || '');
        return {
          response: data.response || '',
          workoutData: data.workoutData,
          workoutModification: data.workoutModification,
          profileData: data.profileData,
          mealData: data.mealData,
        };
      }

      // Streaming path — parse SSE manually
      if (!res.body) return null;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let finalPayload: any = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split on the SSE record separator
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // last may be partial

        for (const raw of events) {
          if (!raw.trim()) continue;
          const lines = raw.split('\n');
          let eventType = 'message';
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (!dataStr) continue;
          try {
            const payload = JSON.parse(dataStr);
            if (eventType === 'delta' && payload.text) {
              accumulated += payload.text;
              // Strip in-progress JSON tags from the visible stream
              const visible = accumulated
                .replace(/<workout_json>[\s\S]*?<\/workout_json>/g, '')
                .replace(/<workout_json>[\s\S]*$/, '')
                .replace(/<workout_modification>[\s\S]*?<\/workout_modification>/g, '')
                .replace(/<workout_modification>[\s\S]*$/, '')
                .replace(/<profile_json>[\s\S]*?<\/profile_json>/g, '')
                .replace(/<profile_json>[\s\S]*$/, '')
                .replace(/<meal_json>[\s\S]*?<\/meal_json>/g, '')
                .replace(/<meal_json>[\s\S]*$/, '')
                // Strip trailing half-streamed markdown table row (pipe-led line missing its closing pipe)
                .replace(/\n\|[^\n|]*$/, '');
              opts.onDelta(visible);
            } else if (eventType === 'final') {
              finalPayload = payload;
            } else if (eventType === 'error') {
              opts.onError?.({
                errorType: 'stream_error',
                message: payload?.error,
              });
              return null;
            }
          } catch {
            /* malformed SSE record — skip */
          }
        }
      }

      if (finalPayload) {
        // Replace the visible text with the server's cleaned text (authoritative)
        opts.onDelta(finalPayload.cleanText);
        return {
          response: finalPayload.cleanText,
          workoutData: finalPayload.workoutData,
          workoutModification: finalPayload.workoutModification,
          profileData: finalPayload.profileData,
          mealData: finalPayload.mealData,
        };
      }
      return { response: accumulated };
    } catch (e) {
      opts.onError?.({
        errorType: 'network',
        message: e instanceof Error ? e.message : 'Unknown fetch error',
      });
      return null;
    }
  };

  // Normalize conditioning descriptions: ensure newlines are real, split "+" joined movements
  const normalizeDescription = (desc: string): string => {
    if (!desc) return '';
    let normalized = desc
      .replace(/\\n/g, '\n')           // Convert literal \n to real newlines
      .replace(/\r\n/g, '\n');         // Normalize Windows line endings

    // If the description is a single line with " + " separators (common AI format),
    // split into separate lines for readability
    if (!normalized.includes('\n') && (normalized.match(/\s\+\s/g) || []).length >= 2) {
      normalized = normalized.split(/\s\+\s/).join('\n');
    }

    return normalized.trim();
  };

  // Save workout to planner. Honors optional `date` (backdate) and `completed` fields on workoutData.
  const saveWorkoutToPlanner = (workoutData: Record<string, unknown>) => {
    if (!onUpdateOperator) return;
    const today = getLocalDateStr();
    const targetDate = isValidDateStr(workoutData.date) ? (workoutData.date as string) : today;
    const completedFlag = workoutData.completed === true;
    const updatedOp = { ...operator };

    const blocks = ((workoutData.blocks as Array<Record<string, unknown>>) || []).map((block, i) => {
      if (block.type === 'conditioning') {
        return {
          type: 'conditioning' as const,
          id: `block-ai-${Date.now()}-${i}`,
          sortOrder: i + 1,
          format: (block.format as string) || '',
          description: normalizeDescription((block.description as string) || ''),
          isLinkedToNext: false,
        };
      }
      return {
        type: 'exercise' as const,
        id: `block-ai-${Date.now()}-${i}`,
        sortOrder: i + 1,
        exerciseName: (block.exerciseName as string) || '',
        prescription: (block.prescription as string) || '',
        videoUrl: (block.videoUrl as string) || '',
        isLinkedToNext: false,
      };
    });

    updatedOp.workouts = {
      ...updatedOp.workouts,
      [targetDate]: {
        id: `wk-ai-${Date.now()}`,
        date: targetDate,
        title: (workoutData.title as string) || 'AI Generated Workout',
        notes: normalizeDescription((workoutData.notes as string) || ''),
        warmup: normalizeDescription((workoutData.warmup as string) || ''),
        blocks,
        cooldown: normalizeDescription((workoutData.cooldown as string) || ''),
        completed: completedFlag,
      },
    };

    onUpdateOperator(updatedOp);
  };

  const handleSendMessage = async () => {
    // Guard against double-submit: if a request is already in-flight (thinking
    // indicator up, or streaming into a placeholder), ignore this tap so the
    // user can't stack duplicate messages while waiting for Gunny's reply.
    if (isTyping) return;
    if (!inputValue.trim() && !pendingImage) return;
    const text = inputValue || (pendingImage ? 'Analyze this image' : '');
    const lower = text.toLowerCase();
    const userMessage: Message = { id: 'user-' + Date.now(), role: 'user', text, timestamp: new Date(), ...(pendingImage && { image: pendingImage }) };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setPendingImage(null);
    setIsTyping(true); setThinkingStartedAt(Date.now());

    // Track Gunny chat event
    trackEvent(EVENTS.GUNNY_CHAT, {
      operatorId: operator.id,
      messageLength: text.length,
      isOnboarding: isOnboarding,
    });

    // ═══ ONBOARDING MODE — stream from API with onboarding prompt ═══
    if (isOnboarding) {
      const placeholderId = 'gunny-onboard-' + Date.now();
      setMessages((prev) => [...prev, {
        id: placeholderId, role: 'gunny' as const, text: '', timestamp: new Date(),
      }]);

      let errorInfo: { errorType?: string; message?: string; status?: number; details?: string } | null = null;
      const apiResult = await callGunnyAPIStreaming(updatedMessages, {
        forceMode: 'onboarding',
        onDelta: (accumulated) => {
          if (accumulated.length > 0) {
            setIsTyping(false);
            setThinkingStartedAt(null);
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === placeholderId ? { ...m, text: accumulated } : m))
          );
        },
        onError: (info) => { errorInfo = info; },
      });

      if (apiResult?.profileData) {
        applyProfileData(apiResult.profileData);
      }
      if (!apiResult) {
        const fallbackText = operator.callsign === 'RAMPAGE' && errorInfo
          ? formatOwnerDiagnostic(errorInfo)
          : 'Copy that. Tell me more about your training background and goals.';
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholderId ? { ...m, text: fallbackText } : m))
        );
      }

      setIsTyping(false); setThinkingStartedAt(null);
      inputRef.current?.focus();
      return;
    }

    // ═══ NORMAL MODE ═══

    // Check for "add it" / "save it" / "I like it" — save last workout to planner
    const isSaveCommand = /\b(add it|save it|i like it|lock it in|add to planner|save to planner|add that|save that|add this|log it)\b/i.test(lower);
    if (isSaveCommand && lastWorkoutDataRef.current) {
      saveWorkoutToPlanner(lastWorkoutDataRef.current);
      const savedTitle = (lastWorkoutDataRef.current.title as string) || 'workout';
      lastWorkoutDataRef.current = null;
      setTimeout(() => {
        const gunnyResponse: Message = {
          id: 'gunny-' + Date.now(), role: 'gunny',
          text: `LOCKED IN. "${savedTitle}" is now on your PLANNER for today. Go to PLANNER tab to review and execute. No excuses, champ.`,
          timestamp: new Date(),
        };
        setIsTyping(false); setThinkingStartedAt(null);
        setMessages((prev) => [...prev, gunnyResponse]);
      }, 300);
      inputRef.current?.focus();
      return;
    }

    // Try local handler first (for state-modifying actions like food logging, client roster)
    const result = generateGunnyResponse(text);

    if (result.response !== FALLBACK_RESPONSE) {
      // Local handler matched — use it
      if (result.updatedOperator && onUpdateOperator) {
        onUpdateOperator(result.updatedOperator);
      }
      setTimeout(() => {
        const gunnyResponse: Message = { id: 'gunny-' + Date.now(), role: 'gunny', text: result.response, timestamp: new Date() };
        setIsTyping(false); setThinkingStartedAt(null);
        setMessages((prev) => [...prev, gunnyResponse]);
      }, 400 + Math.random() * 300);
    } else {
      // No local match — STREAM from Anthropic API
      const placeholderId = 'gunny-' + Date.now();

      // Create an empty Gunny bubble immediately — the thinking indicator will sit
      // above it until the first token arrives, then the bubble fills in live.
      setMessages((prev) => [...prev, {
        id: placeholderId,
        role: 'gunny' as const,
        text: '',
        timestamp: new Date(),
      }]);

      let errorInfo: { errorType?: string; message?: string; status?: number; details?: string } | null = null;
      const apiResult = await callGunnyAPIStreaming(updatedMessages, {
        onDelta: (accumulated) => {
          // Hide the thinking indicator once we have content
          if (accumulated.length > 0) {
            setIsTyping(false);
            setThinkingStartedAt(null);
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === placeholderId ? { ...m, text: accumulated } : m))
          );
        },
        onError: (info) => { errorInfo = info; },
      });

      // SURGICAL MODIFICATION — apply targeted change to today's active workout
      let wasModification = false;
      if (apiResult?.workoutModification && onUpdateOperator) {
        const today = getLocalDateStr();
        const current = operator.workouts?.[today];
        if (current) {
          try {
            const modified = applyWorkoutModification(current, apiResult.workoutModification as unknown as WorkoutModification);
            const updated = { ...operator };
            updated.workouts = { ...updated.workouts, [today]: modified };
            onUpdateOperator(updated);
            wasModification = true;
          } catch (e) {
            console.error('applyWorkoutModification failed:', e);
          }
        }
      }

      // Store workout data if AI generated a NEW complete workout
      if (!wasModification && apiResult?.workoutData) {
        lastWorkoutDataRef.current = apiResult.workoutData;
      }

      // MEAL LOGGING — Gunny emitted <meal_json>; write straight to operator
      let mealLogged = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mealPayload = apiResult?.mealData as any;
      if (mealPayload && onUpdateOperator) {
        const m = mealPayload;
        const macrosOk =
          typeof m.calories === 'number' && !isNaN(m.calories) &&
          typeof m.protein === 'number' && !isNaN(m.protein) &&
          typeof m.carbs === 'number' && !isNaN(m.carbs) &&
          typeof m.fat === 'number' && !isNaN(m.fat);
        if (macrosOk) {
          const today = getLocalDateStr();
          const targetDate = isValidDateStr(m.date) ? m.date : today;
          const time = targetDate === today
            ? new Date().toISOString()
            : new Date(`${targetDate}T12:00:00`).toISOString();
          const meal: Meal = {
            id: `meal-${Date.now()}`,
            name: m.name || 'Logged meal',
            calories: Math.round(m.calories),
            protein: Math.round(m.protein),
            carbs: Math.round(m.carbs),
            fat: Math.round(m.fat),
            time,
          };
          const existingNutrition = operator.nutrition || { targets: { calories: 2500, protein: 150, carbs: 300, fat: 80 }, meals: {} };
          const existingMeals = existingNutrition.meals || {};
          const prevBucket = existingMeals[targetDate] || [];

          // DEDUP: reject if same name + calories logged within 60 seconds
          const nowMs = Date.now();
          const recentDup = prevBucket.find((existing: Meal) => {
            if ((existing.name || '').toLowerCase() !== (meal.name || '').toLowerCase()) return false;
            if (Math.abs((existing.calories || 0) - meal.calories) > 5) return false;
            const idMatch = existing.id.match(/^meal-(\d+)$/);
            if (!idMatch) return false;
            return (nowMs - Number(idMatch[1])) < 60_000;
          });
          if (recentDup) {
            const dupMsg: Message = {
              id: 'gunny-dedup-' + Date.now(), role: 'gunny',
              text: `Hold up, champ — I just logged "${meal.name}" under a minute ago. If that was a second helping, say "log another serving" and I'll stack it.`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, dupMsg]);
            setIsTyping(false); setThinkingStartedAt(null);
            inputRef.current?.focus();
            return;
          }

          const updatedOp = {
            ...operator,
            nutrition: {
              ...existingNutrition,
              meals: {
                ...existingMeals,
                [targetDate]: [...prevBucket, meal],
              },
            },
          };
          onUpdateOperator(updatedOp);
          mealLogged = true;
        }
      }

      // Final pass — stamp the workout suffix if a workout was generated
      const hasWorkout = !wasModification && !!apiResult?.workoutData;
      if (hasWorkout || wasModification || mealLogged) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  text: (apiResult?.response || m.text)
                    + (hasWorkout ? '\n\n━━━━━━━━━━━━━━━━━━\nSay "ADD IT" to save this workout to your PLANNER.' : '')
                    + (wasModification ? '\n\n[WORKOUT UPDATED]' : '')
                    + (mealLogged ? '\n\n[MEAL LOGGED TO NUTRITION TRACKER]' : ''),
                  isWorkout: hasWorkout,
                }
              : m
          )
        );
      }

      // If the API returned nothing at all, show the fallback
      if (!apiResult) {
        const fallbackText = operator.callsign === 'RAMPAGE' && errorInfo
          ? formatOwnerDiagnostic(errorInfo)
          : `⚠ Comms dropped mid-stream. Retry in a moment, ${operator.callsign}.`;
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholderId ? { ...m, text: fallbackText } : m))
        );
      }

      setIsTyping(false); setThinkingStartedAt(null);
    }

    inputRef.current?.focus();
  };

  const handleQuickAction = async (action: string) => {
    // Guard double-submit — same as handleSendMessage. A user tapping BUILD WOD
    // while a previous request is in-flight would stack calls otherwise.
    if (isTyping) return;
    const userMessage: Message = { id: 'user-' + Date.now(), role: 'user', text: action, timestamp: new Date() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsTyping(true); setThinkingStartedAt(Date.now());

    const result = generateGunnyResponse(action);

    if (result.response !== FALLBACK_RESPONSE) {
      if (result.updatedOperator && onUpdateOperator) {
        onUpdateOperator(result.updatedOperator);
      }
      setTimeout(() => {
        const gunnyResponse: Message = { id: 'gunny-' + Date.now(), role: 'gunny', text: result.response, timestamp: new Date() };
        setIsTyping(false); setThinkingStartedAt(null);
        setMessages((prev) => [...prev, gunnyResponse]);
      }, 400 + Math.random() * 300);
    } else {
      // No local match — STREAM from Anthropic API
      const placeholderId = 'gunny-qa-' + Date.now();
      setMessages((prev) => [...prev, {
        id: placeholderId, role: 'gunny' as const, text: '', timestamp: new Date(),
      }]);

      let errorInfo: { errorType?: string; message?: string; status?: number; details?: string } | null = null;
      const apiResult = await callGunnyAPIStreaming(updatedMessages, {
        onDelta: (accumulated) => {
          if (accumulated.length > 0) {
            setIsTyping(false);
            setThinkingStartedAt(null);
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === placeholderId ? { ...m, text: accumulated } : m))
          );
        },
        onError: (info) => { errorInfo = info; },
      });

      let wasModification = false;
      if (apiResult?.workoutModification && onUpdateOperator) {
        const today = getLocalDateStr();
        const current = operator.workouts?.[today];
        if (current) {
          try {
            const modified = applyWorkoutModification(current, apiResult.workoutModification as unknown as WorkoutModification);
            const updated = { ...operator };
            updated.workouts = { ...updated.workouts, [today]: modified };
            onUpdateOperator(updated);
            wasModification = true;
          } catch (e) {
            console.error('applyWorkoutModification (quick action) failed:', e);
          }
        }
      }

      if (!wasModification && apiResult?.workoutData) {
        lastWorkoutDataRef.current = apiResult.workoutData;
      }
      const hasWorkout = !wasModification && !!apiResult?.workoutData;
      if (hasWorkout || wasModification) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  text: (apiResult?.response || m.text)
                    + (hasWorkout ? '\n\n━━━━━━━━━━━━━━━━━━\nSay "ADD IT" to save this workout to your PLANNER.' : '')
                    + (wasModification ? '\n\n[WORKOUT UPDATED]' : ''),
                  isWorkout: hasWorkout,
                }
              : m
          )
        );
      }
      if (!apiResult) {
        const fallbackText = operator.callsign === 'RAMPAGE' && errorInfo
          ? formatOwnerDiagnostic(errorInfo)
          : `⚠ Comms dropped mid-stream. Retry in a moment, ${operator.callsign}.`;
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholderId ? { ...m, text: fallbackText } : m))
        );
      }
      setIsTyping(false); setThinkingStartedAt(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = operator.role === 'trainer'
    ? [
        { id: 'build_wod', label: t('gunny.build_wod'), icon: '▶' },
        { id: 'my_clients', label: 'MY CLIENTS', icon: '◈' },
        { id: 'goal_paths', label: t('gunny.goal_paths'), icon: '◆' },
        { id: 'weekly_plan', label: t('gunny.weekly_plan'), icon: '▦' },
      ]
    : [
        { id: 'build_wod', label: t('gunny.build_wod'), icon: '▶' },
        { id: 'trainer_wod', label: 'TRAINER WOD', icon: '★' },
        { id: 'check_readiness', label: t('gunny.check_readiness'), icon: '◈' },
        { id: 'goal_paths', label: t('gunny.goal_paths'), icon: '◆' },
        { id: 'macro_check', label: t('gunny.macro_check'), icon: '◉' },
      ];

  const handleQuickActionById = (actionId: string) => {
    let actionText = 'BUILD A WORKOUT';
    if (actionId === 'goal_paths') actionText = 'SHOW ME GOAL PATHS';
    if (actionId === 'check_readiness') actionText = 'CHECK MY READINESS';
    if (actionId === 'weekly_plan') actionText = 'PLAN MY WEEK';
    if (actionId === 'macro_check') actionText = 'CHECK MACROS';
    if (actionId === 'my_clients') actionText = 'SHOW MY CLIENTS';
    if (actionId === 'trainer_wod') actionText = 'WHAT DID MY TRAINER DO TODAY';
    handleQuickAction(actionText);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#030303',
      color: '#ddd',
      fontFamily: '"Chakra Petch", sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes workoutCardGlow {
          0%, 100% { border-color: rgba(255,184,0,0.15); }
          50% { border-color: rgba(255,184,0,0.3); }
        }
        .quick-btn {
          padding: 8px 16px;
          font-size: 15px;
          font-family: 'Share Tech Mono', monospace;
          color: #00ff41;
          background: rgba(0,255,65,0.03);
          border: 1px solid rgba(0,255,65,0.1);
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 700;
          letter-spacing: 1px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .quick-btn:hover:not(:disabled) {
          background: rgba(0,255,65,0.08);
          border-color: rgba(0,255,65,0.3);
          box-shadow: 0 0 12px rgba(0,255,65,0.15);
        }
        .quick-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .send-btn {
          padding: 10px 20px;
          font-size: 15px;
          font-family: 'Orbitron', sans-serif;
          color: #030303;
          background: #00ff41;
          border: none;
          cursor: pointer;
          font-weight: 800;
          letter-spacing: 2px;
          transition: all 0.2s ease;
          min-width: 70px;
        }
        .send-btn:hover:not(:disabled) {
          background: #33ff77;
          box-shadow: 0 0 20px rgba(0,255,65,0.5);
        }
        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .send-btn[aria-busy="true"] {
          background: #0a7a1e;
          color: #aaffcc;
          animation: sendBtnPulse 1.2s ease-in-out infinite;
        }
        @keyframes sendBtnPulse {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
        .chat-input {
          flex: 1;
          padding: 12px 16px;
          font-size: 16px;
          font-family: 'Chakra Petch', sans-serif;
          background: rgba(0,255,65,0.02);
          border: 1px solid rgba(0,255,65,0.08);
          color: #ddd;
          outline: none;
          transition: all 0.2s ease;
          -webkit-appearance: none;
          border-radius: 0;
        }
        .chat-input:focus {
          border-color: rgba(0,255,65,0.25);
          box-shadow: 0 0 12px rgba(0,255,65,0.08);
          background: rgba(0,255,65,0.03);
        }
        .chat-input::placeholder { color: #333; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(0,255,65,0.08)',
        background: 'linear-gradient(180deg, rgba(8,8,8,0.95) 0%, rgba(3,3,3,0.98) 100%)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }}>
        {/* Avatar */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #00ff41 0%, #00cc33 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
          fontWeight: 900,
          color: '#030303',
          fontFamily: '"Orbitron", sans-serif',
          boxShadow: '0 0 16px rgba(0,255,65,0.3)',
          flexShrink: 0,
        }}>
          G
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '26px',
            fontFamily: '"Orbitron", sans-serif',
            color: '#00ff41',
            fontWeight: 900,
            letterSpacing: '3px',
            textShadow: '0 0 8px rgba(0,255,65,0.3)',
          }}>
            GUNNY
          </div>
          <div style={{
            fontSize: '15px',
            fontFamily: '"Share Tech Mono", monospace',
            color: '#888',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginTop: '2px',
          }}>
            {isOnboarding ? 'INTAKE ASSESSMENT' : 'FUNCTIONAL BODYBUILDER TRAINER'}
          </div>
        </div>

        {/* Tier Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            padding: '4px 10px',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '1.5px',
            fontFamily: '"Share Tech Mono", monospace',
            border: `1px solid ${getTierColor(operator.tier)}`,
            backgroundColor: `${getTierColor(operator.tier)}1a`,
            color: getTierColor(operator.tier),
            borderRadius: '2px',
          }}>
            {operator.tier.toUpperCase()}
          </div>

          {/* Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            border: '1px solid rgba(0,255,65,0.15)',
            backgroundColor: 'rgba(0,255,65,0.03)',
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#00ff41',
              boxShadow: '0 0 8px #00ff41',
              animation: 'pulse 2s infinite',
            }} />
            <span style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#00ff41',
              letterSpacing: '1.5px',
              fontFamily: '"Share Tech Mono", monospace',
            }}>
              {t('gunny.online')}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons — hidden during onboarding */}
      {isOnboarding ? (
        <div style={{
          padding: '10px 20px',
          borderBottom: '1px solid rgba(255,184,0,0.1)',
          backgroundColor: 'rgba(255,184,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#ffb800', animation: 'typingDot 1.5s infinite',
          }} />
          <span style={{
            fontFamily: '"Share Tech Mono", monospace',
            fontSize: '13px', color: '#ffb800', letterSpacing: '1.5px',
          }}>
            PROFILE INTAKE IN PROGRESS — Answer Gunny&apos;s questions to unlock full features
          </span>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          gap: '6px',
          padding: '10px 20px',
          borderBottom: '1px solid rgba(0,255,65,0.05)',
          backgroundColor: 'rgba(0,255,65,0.01)',
        }}>
          {quickActions.map((action) => (
            <button key={action.id} className="quick-btn" onClick={() => handleQuickActionById(action.id)} disabled={isTyping}>
              <span style={{ color: '#00ff41', fontSize: '15px', opacity: 0.6 }}>{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {messages.filter((m) => m.role === 'user' || m.text.length > 0).map((message) => (
          <div key={message.id} style={{
            display: 'flex',
            justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            alignItems: 'flex-start',
            gap: '10px',
            animation: 'msgSlideIn 0.3s ease-out',
          }}>
            {message.role === 'gunny' && (
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00ff41, #00cc33)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 900,
                color: '#030303',
                flexShrink: 0,
                fontFamily: '"Orbitron", sans-serif',
                boxShadow: '0 0 8px rgba(0,255,65,0.2)',
                marginTop: '2px',
              }}>
                G
              </div>
            )}

            <div style={{
              maxWidth: '75%',
              padding: message.isWorkout ? '16px' : '10px 14px',
              fontSize: '15px',
              lineHeight: '1.65',
              backgroundColor: message.role === 'user'
                ? 'rgba(0,150,255,0.05)'
                : message.isWorkout
                  ? 'rgba(255,184,0,0.03)'
                  : 'rgba(0,255,65,0.02)',
              border: message.role === 'user'
                ? '1px solid rgba(0,150,255,0.15)'
                : message.isWorkout
                  ? '1px solid rgba(255,184,0,0.15)'
                  : '1px solid rgba(0,255,65,0.08)',
              color: message.isWorkout ? '#e0a800' : message.role === 'user' ? '#bbb' : '#ccc',
              whiteSpace: message.isWorkout ? 'pre-wrap' : 'normal',
              wordWrap: 'break-word',
              fontFamily: message.isWorkout ? '"Share Tech Mono", monospace' : '"Chakra Petch", sans-serif',
              animation: message.isWorkout ? 'workoutCardGlow 3s ease-in-out infinite' : 'none',
              position: 'relative',
            }}>
              {/* Workout card header accent */}
              {message.isWorkout && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #ffb800, transparent)',
                }} />
              )}
              {/* User-attached image */}
              {message.image && (
                <img src={message.image} alt="User upload" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4, marginBottom: 8, display: 'block' }} />
              )}
              {/* Render text — workout cards keep the line-split with VIDEO links; other messages render as tactical markdown */}
              {message.isWorkout ? (
                message.text.split('\n').map((line, lineIdx) => {
                // Phase headers — style them prominently
                const isPhaseHeader = /^(PHASE \d|OPERATION:|TARGET:|GOAL PATH:|COOLDOWN:|━+$|PRIMER|COMPLEX|STRENGTH|ISOLATION|METCON)/i.test(line.trim());
                const isSectionDivider = /^━+$/.test(line.trim());
                const isAddItPrompt = line.includes('Say "ADD IT"');

                if (isSectionDivider) {
                  return <div key={lineIdx} style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,184,0,0.4), transparent)', margin: '8px 0' }} />;
                }

                if (isAddItPrompt) {
                  return (
                    <div key={lineIdx} style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => {
                          if (lastWorkoutDataRef.current) {
                            saveWorkoutToPlanner(lastWorkoutDataRef.current);
                            const title = (lastWorkoutDataRef.current.title as string) || 'workout';
                            lastWorkoutDataRef.current = null;
                            const confirmMsg: Message = { id: 'gunny-confirm-' + Date.now(), role: 'gunny', text: `LOCKED IN. "${title}" saved to your PLANNER. Go execute, champ.`, timestamp: new Date() };
                            setMessages(prev => [...prev, confirmMsg]);
                          }
                        }}
                        style={{
                          padding: '10px 24px', fontFamily: '"Orbitron", sans-serif', fontSize: '13px',
                          fontWeight: 800, letterSpacing: '2px', color: '#030303', background: '#ffb800',
                          border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: '0 0 12px rgba(255,184,0,0.3)',
                        }}
                      >
                        ◆ ADD TO PLANNER
                      </button>
                      <span style={{ fontSize: '12px', color: '#666', fontFamily: '"Share Tech Mono", monospace' }}>or type "add it"</span>
                    </div>
                  );
                }

                // Check for VIDEO links within the line
                const parts = line.split(/(\[VIDEO: [^\]]+\]\([^)]+\))/);
                return (
                  <div key={lineIdx} style={{
                    ...(isPhaseHeader ? {
                      color: '#ffb800', fontFamily: '"Orbitron", sans-serif', fontSize: '13px',
                      fontWeight: 700, letterSpacing: '2px', marginTop: '12px', marginBottom: '4px',
                      textShadow: '0 0 6px rgba(255,184,0,0.3)',
                    } : {}),
                    minHeight: line.trim() === '' ? '8px' : undefined,
                  }}>
                    {parts.map((part, i) => {
                      const videoMatch = part.match(/\[VIDEO: ([^\]]+)\]\(([^)]+)\)/);
                      if (videoMatch) {
                        return (
                          <a key={i} href={videoMatch[2]} target="_blank" rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px',
                              fontFamily: '"Share Tech Mono", monospace', fontSize: '11px', color: '#ff4444',
                              background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.2)',
                              cursor: 'pointer', textDecoration: 'none', margin: '2px 4px 2px 0',
                              transition: 'all 0.2s',
                            }}>
                            ▶ {videoMatch[1]}
                          </a>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
                );
                })
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <div style={{
                        fontFamily: '"Orbitron", sans-serif', fontSize: '16px', fontWeight: 800,
                        color: '#00ff41', letterSpacing: '2px', marginTop: '14px', marginBottom: '6px',
                        textShadow: '0 0 6px rgba(0,255,65,0.3)',
                      }}>{children}</div>
                    ),
                    h2: ({ children }) => (
                      <div style={{
                        fontFamily: '"Orbitron", sans-serif', fontSize: '14px', fontWeight: 700,
                        color: '#00ff41', letterSpacing: '1.5px', marginTop: '12px', marginBottom: '4px',
                      }}>{children}</div>
                    ),
                    h3: ({ children }) => (
                      <div style={{
                        fontFamily: '"Share Tech Mono", monospace', fontSize: '13px', fontWeight: 700,
                        color: '#facc15', letterSpacing: '1px', marginTop: '10px', marginBottom: '4px',
                      }}>{children}</div>
                    ),
                    p: ({ children }) => (
                      <p style={{ margin: '6px 0', lineHeight: 1.6 }}>{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong style={{ color: '#facc15', fontWeight: 700 }}>{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em style={{ color: '#9ca3af', fontStyle: 'italic' }}>{children}</em>
                    ),
                    ul: ({ children }) => (
                      <ul style={{ margin: '6px 0', paddingLeft: '20px' }}>{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol style={{ margin: '6px 0', paddingLeft: '20px' }}>{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li style={{ margin: '2px 0', lineHeight: 1.5 }}>{children}</li>
                    ),
                    table: ({ children }) => (
                      <div style={{ overflowX: 'auto', margin: '10px 0' }}>
                        <table style={{
                          width: '100%', borderCollapse: 'collapse',
                          fontFamily: '"Share Tech Mono", monospace', fontSize: '13px',
                          border: '1px solid rgba(0,255,65,0.25)',
                        }}>{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead style={{ background: 'rgba(0,255,65,0.06)' }}>{children}</thead>
                    ),
                    tbody: ({ children }) => <tbody>{children}</tbody>,
                    tr: ({ children }) => <tr>{children}</tr>,
                    th: ({ children }) => (
                      <th style={{
                        padding: '6px 10px', textAlign: 'left',
                        borderBottom: '1px solid rgba(0,255,65,0.3)',
                        color: '#00ff41', fontWeight: 700, letterSpacing: '1px',
                      }}>{children}</th>
                    ),
                    td: ({ children }) => (
                      <td style={{
                        padding: '5px 10px', borderBottom: '1px solid rgba(0,255,65,0.08)',
                        color: '#ccc',
                      }}>{children}</td>
                    ),
                    code: ({ children }) => (
                      <code style={{
                        background: 'rgba(0,255,65,0.08)', color: '#facc15',
                        padding: '1px 5px', fontFamily: '"Share Tech Mono", monospace',
                        fontSize: '13px', borderRadius: 2,
                      }}>{children}</code>
                    ),
                    hr: () => (
                      <div style={{
                        height: '1px', margin: '10px 0',
                        background: 'linear-gradient(90deg, transparent, rgba(0,255,65,0.3), transparent)',
                      }} />
                    ),
                    blockquote: ({ children }) => (
                      <blockquote style={{
                        borderLeft: '2px solid #facc15', paddingLeft: '10px',
                        margin: '8px 0', color: '#bbb', fontStyle: 'italic',
                      }}>{children}</blockquote>
                    ),
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              )}
              {/* Timestamp */}
              <div style={{
                fontSize: '15px',
                color: '#666',
                marginTop: '6px',
                fontFamily: '"Share Tech Mono", monospace',
                textAlign: message.role === 'user' ? 'right' : 'left',
              }}>
                {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {isTyping && (
          <ThinkingIndicator
            variant="primary"
            startedAt={thinkingStartedAt ?? undefined}
            label="GUNNY THINKING"
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid rgba(0,255,65,0.08)',
        background: 'linear-gradient(180deg, rgba(5,5,5,0.98) 0%, rgba(3,3,3,1) 100%)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <div style={{
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: '15px',
          color: '#222',
          marginRight: '4px',
        }}>
          {'>>'}
        </div>
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
          onKeyDown={handleKeyDown}
          placeholder="What's the mission, champ?"
          className="chat-input"
          rows={1}
          style={{ resize: 'none', overflow: 'hidden', lineHeight: '1.4' }}
        />
        <VoiceInput
          onTranscript={(text) => {
            setInputValue(prev => prev ? prev + ' ' + text : text);
          }}
          onSendMessage={(text) => {
            // "Over" trigger — auto-send without hitting button
            setInputValue(text);
            setTimeout(() => {
              const sendBtn = document.querySelector('.send-btn') as HTMLButtonElement;
              if (sendBtn) sendBtn.click();
            }, 100);
          }}
          callSign={operator.callsign}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
            const reader = new FileReader();
            reader.onload = () => setPendingImage(reader.result as string);
            reader.readAsDataURL(file);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => imageInputRef.current?.click()}
          style={{
            background: pendingImage ? '#ff6b35' : 'transparent',
            border: `1px solid ${pendingImage ? '#ff6b35' : '#333'}`,
            borderRadius: 4,
            padding: '6px 8px',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            color: pendingImage ? '#fff' : '#666',
          }}
          title="Attach image for analysis"
        >
          📷
        </button>
        <button
          onClick={handleSendMessage}
          className="send-btn"
          disabled={isTyping || (!inputValue.trim() && !pendingImage)}
          aria-busy={isTyping || undefined}
        >
          {isTyping ? '…' : 'SEND'}
        </button>
      </div>
      {/* Image preview */}
      {pendingImage && (
        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,107,53,0.08)', borderTop: '1px solid rgba(255,107,53,0.2)' }}>
          <img src={pendingImage} alt="Preview" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #333' }} />
          <span style={{ fontFamily: 'Chakra Petch, sans-serif', fontSize: 11, color: '#ff6b35' }}>IMAGE ATTACHED — Gunny will analyze</span>
          <button onClick={() => setPendingImage(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}
    </div>
  );
};
