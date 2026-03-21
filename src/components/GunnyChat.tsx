'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Operator, Meal } from '@/lib/types';

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

export const GunnyChat: React.FC<GunnyChatProps> = ({ operator, allOperators, onUpdateOperator }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const greeting: Message = {
      id: 'greeting-' + Date.now(),
      role: 'gunny',
      text: "Gunny reporting for duty. Full intel loaded — ready to build you a training plan that works, champ. What's the mission? Ask me to BUILD A WORKOUT, check your READINESS, review GOAL PATHS, or just talk training.",
      timestamp: new Date(),
    };
    setMessages([greeting]);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    if (lower.includes('build') || lower.includes('workout') || lower.includes('wod') || lower.includes('program')) {
      const muscleGroup = getMuscleGroup(userMessage);
      const goalKey = getGoalPath(userMessage);
      if (muscleGroup) {
        return { response: formatWorkout(buildWorkout(muscleGroup, goalKey)) };
      }
      return { response: "Roger that, champ. Need to know your target — CHEST, BACK, LEGS, SHOULDERS, or ARMS? Ask me to BUILD A CHEST WORKOUT or similar and I'll lock it in." };
    }

    if (lower.includes('goal path') || lower.includes('goal paths') || lower.includes('paths')) {
      return { response: `Roger that, champ. Here's what I've got:\n\nHYPERTROPHY — ${GOAL_PATHS.HYPERTROPHY.description}\n\nFAT LOSS — ${GOAL_PATHS.FAT_LOSS.description}\n\nSTRENGTH — ${GOAL_PATHS.STRENGTH.description}\n\nATHLETIC PERFORMANCE — ${GOAL_PATHS.ATHLETIC_PERFORMANCE.description}\n\nGENERAL FITNESS — ${GOAL_PATHS.GENERAL_FITNESS.description}\n\nTell me your target and I'll build accordingly. Copy that?` };
    }

    if (lower.includes('readiness') || lower.includes('check readiness') || lower.includes('how am i')) {
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

    if (lower.includes('injury') || lower.includes('hurt') || lower.includes('pain') || lower.includes('restriction')) {
      const injuries = operator.injuries || [];
      if (injuries.length > 0) {
        const injuryList = injuries.map((inj) => `${inj.name}: ${inj.restrictions?.join(', ') || 'avoid heavy loading'}`).join('\n');
        return { response: `ACTIVE INJURIES LOGGED:\n${injuryList}\n\nNo heroes, champ. Follow your restrictions. We'll modify workouts around this.` };
      }
      return { response: "No injuries on the books, champ. You're clean. Keep that body healthy." };
    }

    // Food logging - "i ate", "i had", "just ate", "log food", etc
    if (lower.includes('i ate') || lower.includes('i had') || lower.includes('just ate') ||
        lower.includes('log food') || lower.includes('track meal') || lower.includes('had a') ||
        lower.includes('eaten')) {
      const estimatedMeal = estimateMacros(userMessage);
      if (estimatedMeal && onUpdateOperator) {
        const today = new Date().toISOString().split('T')[0];
        const updatedOp = { ...operator };

        // Initialize meals for today if not exists
        if (!updatedOp.nutrition.meals[today]) {
          updatedOp.nutrition.meals[today] = [];
        }

        // Create meal object
        const meal: Meal = {
          id: `meal-${Date.now()}`,
          name: estimatedMeal.name,
          calories: estimatedMeal.calories,
          protein: estimatedMeal.protein,
          carbs: estimatedMeal.carbs,
          fat: estimatedMeal.fat,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        };

        updatedOp.nutrition.meals[today].push(meal);
        onUpdateOperator(updatedOp);

        // Calculate daily totals
        const todayMeals = updatedOp.nutrition.meals[today];
        const totalCalories = todayMeals.reduce((sum, m) => sum + m.calories, 0);
        const totalProtein = todayMeals.reduce((sum, m) => sum + m.protein, 0);
        const targetCalories = updatedOp.nutrition.targets?.calories || 2500;
        const targetProtein = updatedOp.nutrition.targets?.protein || 150;

        const response = `MACRO INTEL — FOOD LOGGED
━━━━━━━━━━━━━━━━━━
${estimatedMeal.name} — ${estimatedMeal.portion}
Calories: ~${estimatedMeal.calories} | Protein: ~${estimatedMeal.protein}g | Carbs: ~${estimatedMeal.carbs}g | Fat: ~${estimatedMeal.fat}g

DAILY RUNNING TOTAL:
Calories: ${totalCalories}/${targetCalories} | Protein: ${totalProtein}g/${targetProtein}g

⚠ ${estimatedMeal.confidence}`;

        return { response, updatedOperator: updatedOp };
      }

      // Fallback if no food matched
      const nutrition = operator.nutrition;
      const today = new Date().toISOString().split('T')[0];
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

    // Macro recommendations
    if (lower.includes('macro recommendation') || lower.includes('what should i eat') ||
        lower.includes('how much protein') || lower.includes('nutrition plan') ||
        lower.includes('diet recommendation') || lower.includes('meal plan')) {
      const goals = operator.profile?.goals || [];
      const weight = operator.profile?.weight || 180;
      const nutrition = operator.nutrition;
      const today = new Date().toISOString().split('T')[0];
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

    if (lower.includes('nutrition') || lower.includes('macro') || lower.includes('food') || lower.includes('eat')) {
      const nutrition = operator.nutrition;
      const today = new Date().toISOString().split('T')[0];
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

    if (lower.includes('pr') || lower.includes('personal record') || lower.includes('best')) {
      const prs = operator.prs || [];
      if (prs.length > 0) {
        const prList = prs.slice(0, 3).map((pr) => `${pr.exercise}: ${pr.weight}lbs x${pr.reps}`).join('\n');
        return { response: `RECENT PRs:\n${prList}\n\nChase those numbers, champ. Build on the foundation.` };
      }
      return { response: "No PRs logged yet. Establish your baseline on main lifts. First attempt counts." };
    }

    return { response: "Stay in the fight, champ. What's the mission? BUILD A WORKOUT, check READINESS, review GOAL PATHS, or plan your WEEK?" };
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    const text = inputValue;
    const userMessage: Message = { id: 'user-' + Date.now(), role: 'user', text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const result = generateGunnyResponse(text);
      const responseText = result.response;
      if (result.updatedOperator && onUpdateOperator) {
        onUpdateOperator(result.updatedOperator);
      }
      const isWorkout = text.toLowerCase().includes('build') || text.toLowerCase().includes('workout') || text.toLowerCase().includes('wod');
      const gunnyResponse: Message = { id: 'gunny-' + Date.now(), role: 'gunny', text: responseText, timestamp: new Date(), isWorkout };
      setIsTyping(false);
      setMessages((prev) => [...prev, gunnyResponse]);
    }, 800 + Math.random() * 600);

    inputRef.current?.focus();
  };

  const handleQuickAction = (action: string) => {
    const userMessage: Message = { id: 'user-' + Date.now(), role: 'user', text: action, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    setTimeout(() => {
      const result = generateGunnyResponse(action);
      const responseText = result.response;
      if (result.updatedOperator && onUpdateOperator) {
        onUpdateOperator(result.updatedOperator);
      }
      const isWorkout = action.toLowerCase().includes('build') || action.toLowerCase().includes('wod');
      const gunnyResponse: Message = { id: 'gunny-' + Date.now(), role: 'gunny', text: responseText, timestamp: new Date(), isWorkout };
      setIsTyping(false);
      setMessages((prev) => [...prev, gunnyResponse]);
    }, 600 + Math.random() * 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    { label: 'BUILD WOD', icon: '▶' },
    { label: 'GOAL PATHS', icon: '◆' },
    { label: 'CHECK READINESS', icon: '◈' },
    { label: 'WEEKLY PLAN', icon: '▦' },
    { label: 'MACRO CHECK', icon: '◉' },
  ];

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
        .quick-btn:hover {
          background: rgba(0,255,65,0.08);
          border-color: rgba(0,255,65,0.3);
          box-shadow: 0 0 12px rgba(0,255,65,0.15);
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
        }
        .send-btn:hover {
          background: #33ff77;
          box-shadow: 0 0 20px rgba(0,255,65,0.5);
        }
        .chat-input {
          flex: 1;
          padding: 12px 16px;
          font-size: 15px;
          font-family: 'Chakra Petch', sans-serif;
          background: rgba(0,255,65,0.02);
          border: 1px solid rgba(0,255,65,0.08);
          color: #ddd;
          outline: none;
          transition: all 0.2s ease;
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
            FUNCTIONAL BODYBUILDER TRAINER
          </div>
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
            ONLINE
          </span>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '6px',
        padding: '10px 20px',
        borderBottom: '1px solid rgba(0,255,65,0.05)',
        backgroundColor: 'rgba(0,255,65,0.01)',
      }}>
        {quickActions.map((action, idx) => (
          <button key={idx} className="quick-btn" onClick={() => handleQuickAction(action.label)}>
            <span style={{ color: '#00ff41', fontSize: '15px', opacity: 0.6 }}>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {messages.map((message) => (
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
              whiteSpace: 'pre-wrap',
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
              {message.text}
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

        {/* Typing indicator */}
        {isTyping && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'msgSlideIn 0.2s ease-out',
          }}>
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
              opacity: 0.7,
            }}>
              G
            </div>
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(0,255,65,0.02)',
              border: '1px solid rgba(0,255,65,0.08)',
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
            }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: '#00ff41',
                  animation: `typingDot 1.2s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          </div>
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
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's the mission, champ?"
          className="chat-input"
        />
        <button onClick={handleSendMessage} className="send-btn" disabled={!inputValue.trim()}>
          SEND
        </button>
      </div>
    </div>
  );
};
