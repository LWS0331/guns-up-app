'use client';

import React, { useState, useCallback } from 'react';
import { Operator, IntakeAssessment, FitnessLevel, calculateFitnessLevel, calculateTrainingAge, calculateReadiness, formatHeightInput } from '@/lib/types';
import { getLocalDateStr } from '@/lib/dateUtils';
import Icon from '@/components/Icons';

interface IntakeFormProps {
  operator: Operator;
  onComplete: (updated: Operator) => void;
  onSkip: () => void;
}

type IntakeStep = 'welcome' | 'basics' | 'experience' | 'goals' | 'training_path' | 'health' | 'lifestyle' | 'nutrition' | 'equipment' | 'prs' | 'review';

const STEP_ORDER: IntakeStep[] = ['welcome', 'basics', 'experience', 'goals', 'training_path', 'health', 'lifestyle', 'nutrition', 'equipment', 'prs', 'review'];

const DIET_OPTIONS = [
  { id: 'no_plan', label: 'NO PLAN', desc: 'I eat whatever, no tracking' },
  { id: 'basic_tracking', label: 'BASIC TRACKING', desc: 'I loosely count calories' },
  { id: 'strict_macros', label: 'STRICT MACROS', desc: 'I hit protein/carb/fat targets daily' },
  { id: 'meal_prep', label: 'MEAL PREP', desc: 'I batch cook and plan meals ahead' },
  { id: 'keto', label: 'KETO / LOW CARB', desc: 'High fat, very low carb' },
  { id: 'paleo', label: 'PALEO', desc: 'Whole foods, no processed' },
  { id: 'vegan', label: 'VEGAN', desc: 'No animal products' },
  { id: 'vegetarian', label: 'VEGETARIAN', desc: 'No meat, dairy OK' },
  { id: 'mediterranean', label: 'MEDITERRANEAN', desc: 'Balanced, plant-forward' },
  { id: 'other', label: 'OTHER', desc: 'Something custom' },
];

const SUPPLEMENT_OPTIONS = [
  'Protein Powder', 'Creatine', 'Pre-Workout', 'BCAAs', 'Fish Oil / Omega-3',
  'Multivitamin', 'Vitamin D', 'Magnesium', 'Caffeine', 'Collagen', 'None',
];

const DIETARY_RESTRICTIONS = [
  'Gluten Free', 'Dairy Free', 'Nut Allergy', 'Soy Free', 'Shellfish Allergy',
  'Egg Allergy', 'Halal', 'Kosher', 'Low Sodium', 'None',
];

const GOAL_OPTIONS = [
  { id: 'weight_loss', label: 'LOSE WEIGHT', desc: 'Drop body fat, get lean' },
  { id: 'muscle_gain', label: 'BUILD MUSCLE', desc: 'Hypertrophy focus' },
  { id: 'strength', label: 'GET STRONGER', desc: 'Increase max lifts' },
  { id: 'endurance', label: 'ENDURANCE', desc: 'Improve cardio & stamina' },
  { id: 'athletic', label: 'ATHLETIC PERFORMANCE', desc: 'Speed, agility, power' },
  { id: 'general_health', label: 'GENERAL HEALTH', desc: 'Feel better, move better' },
  { id: 'rehab', label: 'INJURY RECOVERY', desc: 'Return to full function' },
  { id: 'sport_specific', label: 'SPORT SPECIFIC', desc: 'Football, basketball, soccer, etc.' },
];

const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbell', 'Kettlebell', 'Pull-up Bar', 'Resistance Bands',
  'Cable Machine', 'Squat Rack', 'Bench', 'Assault Bike', 'Rower',
  'Treadmill', 'Medicine Ball', 'Box/Platform', 'TRX/Suspension', 'None (Bodyweight Only)',
];

const COMMON_CONDITIONS = [
  'High Blood Pressure', 'Diabetes', 'Heart Condition', 'Asthma',
  'Joint Pain', 'Back Problems', 'Knee Issues', 'Shoulder Issues',
  'Previous Surgery', 'Pregnancy/Postpartum', 'None',
];

// Training-path picker — emoji icons replaced with SVG icon components
// from the design-system Icons set so the picker stays on-brand and
// scales cleanly. Each path maps to the closest semantic glyph.
const TRAINING_PATH_OPTIONS: { id: string; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'bodybuilding', label: 'BODYBUILDING', desc: 'Hypertrophy focus — sculpt physique, maximize muscle size, controlled tempos', icon: <Icon.Dumbbell /> },
  { id: 'crossfit', label: 'FUNCTIONAL FITNESS', desc: 'CrossFit-style — WODs, varied movements, compete against the clock', icon: <Icon.Bolt /> },
  { id: 'powerlifting', label: 'POWERLIFTING', desc: 'Squat, bench, deadlift — chase maximal strength numbers', icon: <Icon.Sword /> },
  { id: 'athletic', label: 'ATHLETIC PERFORMANCE', desc: 'Speed, agility, power — train like a pro athlete', icon: <Icon.Target /> },
  { id: 'tactical', label: 'TACTICAL / MILITARY', desc: 'Rucking, calisthenics, endurance — PFT and selection prep', icon: <Icon.Trophy /> },
  { id: 'hybrid', label: 'HYBRID', desc: 'Best of everything — strength + conditioning + muscle', icon: <Icon.Stats /> },
  { id: 'gunny_pick', label: 'LET GUNNY DECIDE', desc: 'Based on your goals, experience, and profile — Gunny picks the optimal path', icon: <Icon.Flame /> },
];

const PR_EXERCISES = [
  'Back Squat', 'Bench Press', 'Deadlift', 'Overhead Press',
  'Pull-ups (max reps)', 'Mile Run (minutes)',
];

export default function IntakeForm({ operator, onComplete, onSkip }: IntakeFormProps) {
  const [step, setStep] = useState<IntakeStep>('welcome');
  const [intake, setIntake] = useState<Partial<IntakeAssessment>>({
    completed: false,
    fitnessLevel: 'beginner',
    experienceYears: 0,
    primaryGoal: '',
    secondaryGoals: [],
    healthConditions: [],
    currentActivity: 'sedentary',
    exerciseHistory: 'none',
    movementScreenScore: 5,
    injuryHistory: [],
    availableEquipment: [],
    preferredWorkoutTime: 'morning',
    motivationFactors: [],
    sleepQuality: 7,
    stressLevel: 4,
    nutritionHabits: 'fair',
    mealsPerDay: 3,
    currentDiet: 'no_plan',
    dailyWaterOz: 64,
    supplements: [],
    estimatedCalories: 2000,
    proteinPriority: 'moderate',
    dietaryRestrictions: [],
    trainingPath: 'gunny_pick',
    startingPRs: [],
  });

  // Basics state
  const [age, setAge] = useState(operator.profile.age || 0);
  const [heightRaw, setHeightRaw] = useState('');
  const [weight, setWeight] = useState(operator.profile.weight || 0);
  const [bodyFat, setBodyFat] = useState(operator.profile.bodyFat || 0);

  const stepIndex = STEP_ORDER.indexOf(step);
  const progress = Math.round((stepIndex / (STEP_ORDER.length - 1)) * 100);

  const nextStep = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  };

  const prevStep = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };

  const toggleArrayItem = (field: 'secondaryGoals' | 'healthConditions' | 'availableEquipment' | 'injuryHistory' | 'motivationFactors' | 'supplements' | 'dietaryRestrictions', item: string) => {
    setIntake(prev => {
      const arr = (prev[field] as string[]) || [];
      if (item === 'None') return { ...prev, [field]: [] };
      const updated = arr.includes(item) ? arr.filter(x => x !== item) : [...arr.filter(x => x !== 'None'), item];
      return { ...prev, [field]: updated };
    });
  };

  const handleComplete = useCallback(() => {
    const fullIntake: IntakeAssessment = {
      completed: true,
      completedDate: new Date().toISOString(),
      fitnessLevel: 'beginner',
      experienceYears: intake.experienceYears || 0,
      primaryGoal: intake.primaryGoal || 'general_health',
      secondaryGoals: intake.secondaryGoals || [],
      healthConditions: intake.healthConditions || [],
      currentActivity: intake.currentActivity || 'sedentary',
      exerciseHistory: intake.exerciseHistory || 'none',
      movementScreenScore: intake.movementScreenScore || 5,
      injuryHistory: intake.injuryHistory || [],
      injuryNotes: intake.injuryNotes || '',
      availableEquipment: intake.availableEquipment || [],
      preferredWorkoutTime: intake.preferredWorkoutTime || 'morning',
      motivationFactors: intake.motivationFactors || [],
      sleepQuality: intake.sleepQuality || 7,
      stressLevel: intake.stressLevel || 4,
      nutritionHabits: intake.nutritionHabits || 'fair',
      mealsPerDay: intake.mealsPerDay || 3,
      currentDiet: intake.currentDiet || 'no_plan',
      dailyWaterOz: intake.dailyWaterOz || 64,
      supplements: intake.supplements || [],
      estimatedCalories: intake.estimatedCalories || 2000,
      proteinPriority: intake.proteinPriority || 'moderate',
      dietaryRestrictions: intake.dietaryRestrictions || [],
      wearableDevice: intake.wearableDevice,
      startingPRs: intake.startingPRs || [],
      // Programming preferences. The form captures all four (UI handlers
      // around lines 407 / 416 / 431 for daysPerWeek / sessionDuration /
      // preferredSplit; path picker for trainingPath), but `fullIntake`
      // previously enumerated fields explicitly and silently omitted these,
      // so they sat in `intake` state and never reached the persisted JSON.
      // Two visible symptoms downstream:
      //   - buildGunnyContext.ts reads `intake.trainingPath` (line 424) →
      //     undefined → Gunny renders "Training Path: Not specified" even
      //     when the user explicitly chose one (RAMPAGE bug, Apr 2026).
      //   - The preferences writes below at lines ~273-276 reference
      //     `fullIntake.daysPerWeek` / `fullIntake.sessionDuration` /
      //     `fullIntake.preferredSplit`. Those were also undefined, so the
      //     preferences object got the literal fallback defaults (4, 60,
      //     'No Preference') instead of the user's selections — which is
      //     also why PR #76 ("respect intake prefs") and PR #77 didn't
      //     actually take effect: the values they were trying to respect
      //     were never being saved in the first place.
      // Adding them to fullIntake fixes both reads (intake-direct AND
      // preferences-derived) without any other code changes.
      daysPerWeek: intake.daysPerWeek || 4,
      sessionDuration: intake.sessionDuration || 60,
      preferredSplit: intake.preferredSplit,
      trainingPath: intake.trainingPath || 'gunny_pick',
    };

    // Calculate fitness level
    fullIntake.fitnessLevel = calculateFitnessLevel(fullIntake);
    const formattedHeight = formatHeightInput(heightRaw) || operator.profile.height;
    const trainingAge = calculateTrainingAge(fullIntake);
    const readiness = calculateReadiness(fullIntake);

    // Calculate macro targets based on intake data
    const wt = weight || 170; // fallback
    const proteinMultiplier = fullIntake.proteinPriority === 'very_high' ? 1.2 : fullIntake.proteinPriority === 'high' ? 1.0 : fullIntake.proteinPriority === 'moderate' ? 0.8 : 0.6;
    const calcProtein = Math.round(wt * proteinMultiplier);
    const calcCalories = fullIntake.estimatedCalories || 2000;
    const proteinCals = calcProtein * 4;
    const fatCals = Math.round(calcCalories * 0.25);
    const calcFat = Math.round(fatCals / 9);
    const calcCarbs = Math.round((calcCalories - proteinCals - fatCals) / 4);

    // Build PRs from intake
    const prs = (fullIntake.startingPRs || [])
      .filter(pr => pr.weight > 0)
      .map((pr, i) => ({
        id: `pr-intake-${i}`,
        exercise: pr.exercise,
        weight: pr.weight,
        reps: pr.reps,
        date: getLocalDateStr(),
        notes: 'Set during intake',
      }));

    // Build injuries from intake — parse free-text into structured data
    const injuries = (fullIntake.injuryHistory || [])
      .filter(x => x && x !== 'None')
      .map((raw, i) => {
        // Split on dash/hyphen to separate injury name from details
        const parts = raw.split(/\s*[-–—]\s*/);
        const injuryName = parts[0]?.trim() || raw.trim();
        const details = parts.slice(1).join(' — ').trim();

        // Extract restrictions from details (keywords that indicate limits)
        const restrictionKeywords = /\b(no |avoid |can't |cannot |don't |limit |cautious|careful|only |never )/i;
        const restrictions: string[] = [];
        const notes: string[] = [];

        if (details) {
          // Split details by commas/semicolons to find individual clauses
          const clauses = details.split(/[,;]+/).map(c => c.trim()).filter(Boolean);
          clauses.forEach(clause => {
            if (restrictionKeywords.test(clause)) {
              restrictions.push(clause);
            } else {
              notes.push(clause);
            }
          });
        }

        return {
          id: `injury-intake-${i}`,
          name: injuryName,
          status: 'active' as const,
          notes: notes.length > 0 ? notes.join('; ') : (details || 'Reported during intake'),
          restrictions,
        };
      });

    const updated: Operator = {
      ...operator,
      intake: fullIntake,
      fitnessLevel: fullIntake.fitnessLevel,
      profile: {
        ...operator.profile,
        age,
        height: formattedHeight,
        weight,
        bodyFat,
        trainingAge,
        goals: [fullIntake.primaryGoal, ...fullIntake.secondaryGoals],
        readiness,
        sleep: fullIntake.sleepQuality,
        stress: fullIntake.stressLevel,
        // Redundant flags stored in profile JSON (persists even if intake column migration hasn't run)
        intakeCompleted: true,
        intakeCompletedDate: fullIntake.completedDate,
        fitnessLevel: fullIntake.fitnessLevel,
        experienceYears: fullIntake.experienceYears,
        exerciseHistory: fullIntake.exerciseHistory,
        currentActivity: fullIntake.currentActivity,
        healthConditions: fullIntake.healthConditions,
        nutritionHabits: fullIntake.nutritionHabits,
        preferredWorkoutTime: fullIntake.preferredWorkoutTime,
      },
      nutrition: {
        ...operator.nutrition,
        targets: {
          calories: calcCalories,
          protein: calcProtein,
          carbs: calcCarbs,
          fat: calcFat,
        },
      },
      prs: [...(operator.prs || []), ...prs],
      injuries: [...(operator.injuries || []), ...injuries],
      preferences: {
        ...operator.preferences,
        equipment: fullIntake.availableEquipment,
        daysPerWeek: fullIntake.daysPerWeek || 4,
        sessionDuration: fullIntake.sessionDuration || 60,
        split: fullIntake.preferredSplit || 'No Preference',
        trainingPath: intake.trainingPath || 'gunny_pick',
      },
    };

    onComplete(updated);
  }, [intake, age, heightRaw, weight, bodyFat, operator, onComplete]);

  const fitnessLevelLabel = (level: FitnessLevel) => {
    const labels: Record<FitnessLevel, { name: string; color: string; desc: string }> = {
      beginner: { name: 'RECRUIT', color: '#4ade80', desc: 'New to structured training. Focus on fundamentals, form, and gradual progression.' },
      intermediate: { name: 'OPERATOR', color: '#00ff41', desc: 'Solid foundation. Ready for periodized programming and progressive overload.' },
      advanced: { name: 'COMMANDER', color: '#facc15', desc: 'Experienced lifter. Advanced programming with specialized blocks.' },
      elite: { name: 'WARFIGHTER', color: '#ff6b35', desc: 'Elite athlete. Sport-specific periodization and peak performance protocols.' },
    };
    return labels[level];
  };

  // Compute live fitness level preview
  const previewLevel = calculateFitnessLevel({
    completed: false, fitnessLevel: 'beginner',
    experienceYears: intake.experienceYears || 0,
    primaryGoal: intake.primaryGoal || '',
    secondaryGoals: [], healthConditions: [], currentActivity: intake.currentActivity || 'sedentary',
    exerciseHistory: intake.exerciseHistory || 'none',
    movementScreenScore: intake.movementScreenScore || 5,
    injuryHistory: [], availableEquipment: [],
    preferredWorkoutTime: 'morning', motivationFactors: [],
    sleepQuality: intake.sleepQuality || 7, stressLevel: intake.stressLevel || 4,
    nutritionHabits: intake.nutritionHabits || 'fair', startingPRs: [],
  });

  const s: Record<string, React.CSSProperties> = {
    container: { width: '100%', maxWidth: 600, margin: '0 auto', padding: '20px', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace" },
    header: { textAlign: 'center', marginBottom: 24 },
    title: { fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#00ff41', letterSpacing: 2, marginBottom: 8 },
    subtitle: { fontSize: 12, color: '#888', letterSpacing: 1 },
    progressBar: { width: '100%', height: 4, background: '#1a1a1a', borderRadius: 2, marginBottom: 24, overflow: 'hidden' },
    progressFill: { height: '100%', background: '#00ff41', borderRadius: 2, transition: 'width 0.3s ease' },
    stepTitle: { fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', letterSpacing: 1, marginBottom: 16 },
    label: { display: 'block', fontSize: 11, color: '#888', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' as const },
    input: { width: '100%', padding: '10px 12px', background: '#0a0a0a', border: '1px solid #333', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace", fontSize: 14, borderRadius: 4, marginBottom: 16, outline: 'none', boxSizing: 'border-box' as const },
    optionGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 },
    optionBtn: { padding: '12px 8px', background: '#0a0a0a', border: '1px solid #333', color: '#888', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, borderRadius: 4, cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.2s' },
    optionBtnActive: { background: '#0a1a0a', border: '1px solid #00ff41', color: '#00ff41' },
    slider: { width: '100%', marginBottom: 16, accentColor: '#00ff41' },
    navRow: { display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 12 },
    btnPrimary: { flex: 1, padding: '12px', background: '#00ff41', color: '#030303', border: 'none', fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: 1, borderRadius: 4, cursor: 'pointer' },
    btnSecondary: { flex: 1, padding: '12px', background: 'transparent', color: '#888', border: '1px solid #333', fontFamily: "'Share Tech Mono', monospace", fontSize: 12, borderRadius: 4, cursor: 'pointer' },
    levelBadge: { display: 'inline-block', padding: '4px 12px', borderRadius: 4, fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: 1 },
    reviewSection: { padding: '12px', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4, marginBottom: 12 },
    reviewLabel: { fontSize: 10, color: '#666', letterSpacing: 1, textTransform: 'uppercase' as const },
    reviewValue: { fontSize: 14, color: '#e0e0e0', marginTop: 4 },
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.title}>FITNESS INTAKE ASSESSMENT</div>
        <div style={s.subtitle}>OPERATOR: {operator.callsign}</div>
      </div>
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${progress}%` }} />
      </div>

      {step === 'welcome' && (
        <div>
          <div style={s.stepTitle}>WELCOME, {operator.callsign}</div>
          <p style={{ color: '#ccc', lineHeight: 1.6, fontSize: 13, marginBottom: 16 }}>
            This assessment determines your starting fitness level and customizes your entire training experience.
            Answer honestly — there are no wrong answers. Whether you are a first-time trainee or a professional athlete,
            this intake calibrates everything: workout intensity, exercise selection, progression rate, and recovery protocols.
          </p>
          <p style={{ color: '#888', fontSize: 12, marginBottom: 24 }}>
            Estimated time: 3-5 minutes
          </p>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={onSkip}>SKIP FOR NOW</button>
            <button style={s.btnPrimary} onClick={nextStep}>BEGIN ASSESSMENT</button>
          </div>
        </div>
      )}

      {step === 'basics' && (
        <div>
          <div style={s.stepTitle}>BASIC METRICS</div>
          <label style={s.label}>AGE</label>
          <input type="number" style={s.input} value={age || ''} onChange={e => setAge(parseInt(e.target.value) || 0)} placeholder="30" />
          <label style={s.label}>HEIGHT (type digits, e.g. 511 for 5&apos;11&quot;)</label>
          <input type="text" style={s.input} value={heightRaw} onChange={e => setHeightRaw(e.target.value)} onBlur={() => setHeightRaw(formatHeightInput(heightRaw))} placeholder="511" />
          <label style={s.label}>WEIGHT (lbs)</label>
          <input type="number" style={s.input} value={weight || ''} onChange={e => setWeight(parseFloat(e.target.value) || 0)} placeholder="180" />
          <label style={s.label}>BODY FAT % (estimate, or leave 0)</label>
          <input type="number" style={s.input} value={bodyFat || ''} onChange={e => setBodyFat(parseFloat(e.target.value) || 0)} placeholder="20" />
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>NEXT</button>
          </div>
        </div>
      )}

      {step === 'experience' && (
        <div>
          <div style={s.stepTitle}>TRAINING EXPERIENCE</div>
          <label style={s.label}>YEARS OF TRAINING</label>
          <input type="number" style={s.input} value={intake.experienceYears || ''} onChange={e => setIntake(prev => ({ ...prev, experienceYears: parseFloat(e.target.value) || 0 }))} placeholder="0" step="0.5" />
          <label style={s.label}>EXERCISE HISTORY</label>
          <div style={{ ...s.optionGrid, gridTemplateColumns: '1fr' }}>
            {[
              { val: 'none', label: 'NO TRAINING EXPERIENCE', desc: 'Never followed a program' },
              { val: 'sporadic', label: 'SPORADIC', desc: 'On and off, no consistency' },
              { val: 'consistent_beginner', label: 'CONSISTENT BEGINNER', desc: 'Regular but still learning' },
              { val: 'consistent_intermediate', label: 'CONSISTENT INTERMEDIATE', desc: 'Solid routine, good form' },
              { val: 'advanced_athlete', label: 'ADVANCED / ATHLETE', desc: 'Competitive or years of dedicated training' },
            ].map(opt => (
              <button key={opt.val} style={{ ...s.optionBtn, textAlign: 'left', ...(intake.exerciseHistory === opt.val ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, exerciseHistory: opt.val }))}>
                <div style={{ fontWeight: 700 }}>{opt.label}</div>
                <div style={{ fontSize: 10, marginTop: 4, color: intake.exerciseHistory === opt.val ? '#00ff4199' : '#666' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
          <label style={s.label}>MOBILITY / MOVEMENT QUALITY: {intake.movementScreenScore}/10</label>
          <input type="range" min="1" max="10" style={s.slider} value={intake.movementScreenScore || 5}
            onChange={e => setIntake(prev => ({ ...prev, movementScreenScore: parseInt(e.target.value) }))} />
          <div style={{ fontSize: 11, color: '#666', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <span>Limited</span><span>Average</span><span>Excellent</span>
          </div>
          <label style={s.label}>TRAINING DAYS PER WEEK</label>
          <div style={s.optionGrid}>
            {[2, 3, 4, 5, 6, 7].map(d => (
              <button key={d} style={{ ...s.optionBtn, ...(intake.daysPerWeek === d ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, daysPerWeek: d }))}>
                {d}
              </button>
            ))}
          </div>
          <label style={s.label}>SESSION DURATION (minutes)</label>
          <div style={s.optionGrid}>
            {[30, 45, 60, 75, 90, 120].map(m => (
              <button key={m} style={{ ...s.optionBtn, ...(intake.sessionDuration === m ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, sessionDuration: m }))}>
                {m}
              </button>
            ))}
          </div>
          <label style={s.label}>PREFERRED TRAINING SPLIT</label>
          <div style={{ ...s.optionGrid, gridTemplateColumns: '1fr' }}>
            {[
              { val: 'Push/Pull/Legs', desc: 'Push day, pull day, legs day rotation' },
              { val: 'Upper/Lower', desc: 'Alternate upper and lower body days' },
              { val: 'Full Body', desc: 'Hit everything each session' },
              { val: 'Bro Split', desc: 'One muscle group per day' },
              { val: 'No Preference', desc: 'Let Gunny decide based on my goals' },
            ].map(opt => (
              <button key={opt.val} style={{ ...s.optionBtn, textAlign: 'left', ...(intake.preferredSplit === opt.val ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, preferredSplit: opt.val }))}>
                <div style={{ fontWeight: 700 }}>{opt.val.toUpperCase()}</div>
                <div style={{ fontSize: 10, marginTop: 4, color: intake.preferredSplit === opt.val ? '#00ff4199' : '#666' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
          <div style={{ padding: 12, background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 4, marginBottom: 16 }}>
            <span style={{ fontSize: 10, color: '#888' }}>PROJECTED LEVEL: </span>
            <span style={{ ...s.levelBadge, color: fitnessLevelLabel(previewLevel).color, border: `1px solid ${fitnessLevelLabel(previewLevel).color}` }}>
              {fitnessLevelLabel(previewLevel).name}
            </span>
          </div>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>NEXT</button>
          </div>
        </div>
      )}

      {step === 'goals' && (
        <div>
          <div style={s.stepTitle}>TRAINING GOALS</div>
          <label style={s.label}>PRIMARY GOAL</label>
          <div style={s.optionGrid}>
            {GOAL_OPTIONS.map(g => (
              <button key={g.id} style={{ ...s.optionBtn, ...(intake.primaryGoal === g.id ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, primaryGoal: g.id }))}>
                <div style={{ fontWeight: 700 }}>{g.label}</div>
                <div style={{ fontSize: 10, marginTop: 4, color: intake.primaryGoal === g.id ? '#00ff4199' : '#666' }}>{g.desc}</div>
              </button>
            ))}
          </div>
          <label style={s.label}>SECONDARY GOALS (select all that apply)</label>
          <div style={s.optionGrid}>
            {GOAL_OPTIONS.filter(g => g.id !== intake.primaryGoal).map(g => (
              <button key={g.id} style={{ ...s.optionBtn, ...((intake.secondaryGoals || []).includes(g.id) ? s.optionBtnActive : {}) }}
                onClick={() => toggleArrayItem('secondaryGoals', g.id)}>
                {g.label}
              </button>
            ))}
          </div>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>NEXT</button>
          </div>
        </div>
      )}

      {step === 'training_path' && (
        <div>
          <div style={s.stepTitle}>CHOOSE YOUR PATH</div>
          <p style={{ color: '#ccc', lineHeight: 1.6, fontSize: 13, marginBottom: 8 }}>
            Every path is scalable — Gunny adapts to your level. There is no wrong choice.
            If you are unsure, let Gunny analyze your profile and recommend the best fit.
          </p>
          {/* Gunny Recommendation Banner */}
          {intake.primaryGoal && (
            <div style={{ padding: 12, background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 4, marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#00ff41', letterSpacing: 1, marginBottom: 6, fontFamily: 'Orbitron, sans-serif' }}>GUNNY RECOMMENDS</div>
              <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5 }}>
                {(() => {
                  const goal = intake.primaryGoal;
                  const exp = intake.exerciseHistory || 'none';
                  if (goal === 'muscle_gain') return 'Based on your muscle-building goal — BODYBUILDING path will maximize hypertrophy with structured volume and progressive overload.';
                  if (goal === 'weight_loss' && (exp === 'none' || exp === 'sporadic')) return 'For fat loss with your current experience — FUNCTIONAL FITNESS combines strength and conditioning for maximum calorie burn.';
                  if (goal === 'weight_loss') return 'For fat loss — HYBRID path blends strength training to preserve muscle with conditioning for calorie expenditure.';
                  if (goal === 'strength') return 'For raw strength — POWERLIFTING path with periodized peaking cycles on the big 3 lifts.';
                  if (goal === 'endurance') return 'For endurance — FUNCTIONAL FITNESS or TACTICAL path with structured cardio progressions and work capacity building.';
                  if (goal === 'athletic') return 'For athletic performance — ATHLETIC path with power development, speed work, and sport-specific conditioning.';
                  if (goal === 'sport_specific') return 'For your sport — ATHLETIC path customized to your sport demands, or HYBRID for well-rounded athleticism.';
                  if (goal === 'rehab') return 'For injury recovery — HYBRID path with controlled progressions. Gunny will respect all restrictions and build you back up safely.';
                  return 'Based on your profile — HYBRID path gives you the best of all worlds. Or let Gunny pick for a fully customized recommendation.';
                })()}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 16 }}>
            {TRAINING_PATH_OPTIONS.map(p => (
              <button key={p.id} style={{
                ...s.optionBtn,
                textAlign: 'left' as const,
                padding: '14px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                ...(intake.trainingPath === p.id ? s.optionBtnActive : {}),
              }}
                onClick={() => setIntake(prev => ({ ...prev, trainingPath: p.id }))}>
                <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', color: 'var(--green)' }}>
                  {React.cloneElement(p.icon as React.ReactElement<{ size?: number }>, { size: 20 })}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{p.label}</div>
                  <div style={{ fontSize: 10, marginTop: 4, color: intake.trainingPath === p.id ? '#00ff4199' : '#666' }}>{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#666', marginBottom: 16, textAlign: 'center' as const }}>
            Any time commitment works. Gunny scales programming for 2 days/week to 7 days/week.
          </p>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>NEXT</button>
          </div>
        </div>
      )}

      {step === 'health' && (
        <div>
          <div style={s.stepTitle}>HEALTH SCREENING</div>
          <label style={s.label}>HEALTH CONDITIONS (select all that apply)</label>
          <div style={s.optionGrid}>
            {COMMON_CONDITIONS.map(c => (
              <button key={c} style={{ ...s.optionBtn, ...((intake.healthConditions || []).includes(c) ? s.optionBtnActive : {}) }}
                onClick={() => toggleArrayItem('healthConditions', c)}>
                {c}
              </button>
            ))}
          </div>
          <label style={s.label}>CURRENT INJURIES (one per line — include any restrictions or notes)</label>
          <textarea style={{ ...s.input, height: 100, resize: 'vertical' as const }}
            placeholder={"e.g.\nRight shoulder labrum - cautious of overuse, no heavy overhead\nLower back sciatic - hex bar OK, no conventional deadlifts back to back weeks"}
            value={intake.injuryNotes || ''}
            onChange={e => {
              const raw = e.target.value;
              const injuries = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
              setIntake(prev => ({ ...prev, injuryNotes: raw, injuryHistory: injuries }));
            }} />
          <div style={{ fontSize: 9, color: '#555', marginTop: -12, marginBottom: 12, fontFamily: 'Share Tech Mono, monospace' }}>
            Be specific — Gunny AI reads this to avoid aggravating injuries and program around restrictions.
          </div>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>NEXT</button>
          </div>
        </div>
      )}

      {step === 'lifestyle' && (
        <div>
          <div style={s.stepTitle}>LIFESTYLE & RECOVERY</div>
          <label style={s.label}>DAILY ACTIVITY LEVEL</label>
          <div style={{ ...s.optionGrid, gridTemplateColumns: '1fr' }}>
            {[
              { val: 'sedentary', label: 'SEDENTARY', desc: 'Desk job, minimal movement' },
              { val: 'lightly_active', label: 'LIGHTLY ACTIVE', desc: 'Some walking, light daily activity' },
              { val: 'active', label: 'ACTIVE', desc: 'Regular movement, on feet often' },
              { val: 'very_active', label: 'VERY ACTIVE', desc: 'Physical job or daily training' },
              { val: 'athlete', label: 'COMPETITIVE ATHLETE', desc: 'Training 5+ days, sport-specific' },
            ].map(opt => (
              <button key={opt.val} style={{ ...s.optionBtn, textAlign: 'left', ...(intake.currentActivity === opt.val ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, currentActivity: opt.val }))}>
                <div style={{ fontWeight: 700 }}>{opt.label}</div>
                <div style={{ fontSize: 10, marginTop: 4, color: intake.currentActivity === opt.val ? '#00ff4199' : '#666' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
          <label style={s.label}>SLEEP QUALITY: {intake.sleepQuality}/10</label>
          <input type="range" min="1" max="10" style={s.slider} value={intake.sleepQuality || 7}
            onChange={e => setIntake(prev => ({ ...prev, sleepQuality: parseInt(e.target.value) }))} />
          <label style={s.label}>STRESS LEVEL: {intake.stressLevel}/10</label>
          <input type="range" min="1" max="10" style={s.slider} value={intake.stressLevel || 4}
            onChange={e => setIntake(prev => ({ ...prev, stressLevel: parseInt(e.target.value) }))} />
          <label style={s.label}>NUTRITION HABITS</label>
          <div style={s.optionGrid}>
            {['poor', 'fair', 'good', 'excellent'].map(n => (
              <button key={n} style={{ ...s.optionBtn, ...(intake.nutritionHabits === n ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, nutritionHabits: n }))}>
                {n.toUpperCase()}
              </button>
            ))}
          </div>
          <label style={s.label}>WEARABLE DEVICE (optional)</label>
          <div style={s.optionGrid}>
            {['Apple Watch', 'WHOOP', 'Garmin', 'Fitbit', 'Oura Ring', 'None'].map(d => (
              <button key={d} style={{ ...s.optionBtn, ...(intake.wearableDevice === d ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, wearableDevice: d === 'None' ? undefined : d }))}>
                {d}
              </button>
            ))}
          </div>
          {!intake.wearableDevice && (
            <div style={{ padding: 8, background: '#1a1a0a', border: '1px solid #333300', borderRadius: 4, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: '#facc15' }}>HIGHLY RECOMMENDED: Connect a wearable for truly customized programming and superior Gunny AI intel.</span>
            </div>
          )}
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>NEXT</button>
          </div>
        </div>
      )}

      {step === 'nutrition' && (
        <div>
          <div style={s.stepTitle}>NUTRITION INTEL</div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
            This data calibrates your macro targets and lets Gunny AI build nutrition plans around your current habits.
          </p>

          <label style={s.label}>MEALS PER DAY</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} style={{ ...s.optionBtn, flex: 1, ...(intake.mealsPerDay === n ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, mealsPerDay: n }))}>
                {n}
              </button>
            ))}
          </div>

          <label style={s.label}>CURRENT DIET APPROACH</label>
          <div style={s.optionGrid}>
            {DIET_OPTIONS.map(d => (
              <button key={d.id} style={{ ...s.optionBtn, textAlign: 'left' as const, padding: '10px 12px', ...(intake.currentDiet === d.id ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, currentDiet: d.id }))}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{d.label}</div>
                <div style={{ fontSize: 9, color: intake.currentDiet === d.id ? '#00ff41' : '#666', marginTop: 2 }}>{d.desc}</div>
              </button>
            ))}
          </div>

          <label style={s.label}>ESTIMATED DAILY CALORIES</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <input type="range" min={1200} max={5000} step={100}
              value={intake.estimatedCalories || 2000}
              style={s.slider}
              onChange={e => setIntake(prev => ({ ...prev, estimatedCalories: parseInt(e.target.value) }))} />
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', minWidth: 60, textAlign: 'right' as const }}>
              {intake.estimatedCalories || 2000}
            </span>
          </div>
          <p style={{ fontSize: 10, color: '#555', marginBottom: 16 }}>Rough estimate is fine — Gunny AI will refine this based on your goals and activity.</p>

          <label style={s.label}>DAILY WATER INTAKE (OZ)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <input type="range" min={16} max={200} step={8}
              value={intake.dailyWaterOz || 64}
              style={s.slider}
              onChange={e => setIntake(prev => ({ ...prev, dailyWaterOz: parseInt(e.target.value) }))} />
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', minWidth: 50, textAlign: 'right' as const }}>
              {intake.dailyWaterOz || 64}oz
            </span>
          </div>

          <label style={s.label}>PROTEIN PRIORITY</label>
          <p style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>How much protein should Gunny target? Higher = more muscle-building focus.</p>
          <div style={s.optionGrid}>
            {[
              { id: 'low', label: 'LOW', desc: '0.6g/lb — general health' },
              { id: 'moderate', label: 'MODERATE', desc: '0.8g/lb — balanced' },
              { id: 'high', label: 'HIGH', desc: '1.0g/lb — muscle growth' },
              { id: 'very_high', label: 'VERY HIGH', desc: '1.2g/lb — max hypertrophy' },
            ].map(p => (
              <button key={p.id} style={{ ...s.optionBtn, textAlign: 'left' as const, padding: '10px 12px', ...(intake.proteinPriority === p.id ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, proteinPriority: p.id }))}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{p.label}</div>
                <div style={{ fontSize: 9, color: intake.proteinPriority === p.id ? '#00ff41' : '#666', marginTop: 2 }}>{p.desc}</div>
              </button>
            ))}
          </div>

          <label style={s.label}>SUPPLEMENTS (SELECT ALL THAT APPLY)</label>
          <div style={s.optionGrid}>
            {SUPPLEMENT_OPTIONS.map(sup => (
              <button key={sup} style={{ ...s.optionBtn, ...(((intake.supplements || []).includes(sup)) ? s.optionBtnActive : {}) }}
                onClick={() => toggleArrayItem('supplements', sup)}>
                {sup.toUpperCase()}
              </button>
            ))}
          </div>

          <label style={s.label}>DIETARY RESTRICTIONS (SELECT ALL THAT APPLY)</label>
          <div style={s.optionGrid}>
            {DIETARY_RESTRICTIONS.map(r => (
              <button key={r} style={{ ...s.optionBtn, ...(((intake.dietaryRestrictions || []).includes(r)) ? s.optionBtnActive : {}) }}
                onClick={() => toggleArrayItem('dietaryRestrictions', r)}>
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Live macro preview */}
          {(() => {
            const wt = weight || 170;
            const pm = intake.proteinPriority === 'very_high' ? 1.2 : intake.proteinPriority === 'high' ? 1.0 : intake.proteinPriority === 'moderate' ? 0.8 : 0.6;
            const prot = Math.round(wt * pm);
            const cal = intake.estimatedCalories || 2000;
            const fat = Math.round((cal * 0.25) / 9);
            const carbs = Math.round((cal - (prot * 4) - (fat * 9)) / 4);
            return (
              <div style={{ padding: 16, background: '#0a1a0a', border: '1px solid #00ff41', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: '#888', letterSpacing: 1, marginBottom: 8 }}>CALCULATED DAILY TARGETS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' as const }}>
                  <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#00ff41' }}>{cal}</div>
                    <div style={{ fontSize: 9, color: '#666' }}>CALORIES</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#4ade80' }}>{prot}g</div>
                    <div style={{ fontSize: 9, color: '#666' }}>PROTEIN</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#facc15' }}>{carbs}g</div>
                    <div style={{ fontSize: 9, color: '#666' }}>CARBS</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#ff6b35' }}>{fat}g</div>
                    <div style={{ fontSize: 9, color: '#666' }}>FAT</div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>NEXT</button>
          </div>
        </div>
      )}

      {step === 'equipment' && (
        <div>
          <div style={s.stepTitle}>AVAILABLE EQUIPMENT</div>
          <label style={s.label}>SELECT ALL EQUIPMENT YOU HAVE ACCESS TO</label>
          <div style={s.optionGrid}>
            {EQUIPMENT_OPTIONS.map(eq => (
              <button key={eq} style={{ ...s.optionBtn, ...((intake.availableEquipment || []).includes(eq) ? s.optionBtnActive : {}) }}
                onClick={() => toggleArrayItem('availableEquipment', eq)}>
                {eq.toUpperCase()}
              </button>
            ))}
          </div>
          <label style={s.label}>PREFERRED WORKOUT TIME</label>
          <div style={s.optionGrid}>
            {[
              { val: 'early_morning', label: '5-7 AM' },
              { val: 'morning', label: '7-10 AM' },
              { val: 'midday', label: '10 AM-1 PM' },
              { val: 'afternoon', label: '1-5 PM' },
              { val: 'evening', label: '5-8 PM' },
              { val: 'night', label: '8 PM+' },
            ].map(t => (
              <button key={t.val} style={{ ...s.optionBtn, ...(intake.preferredWorkoutTime === t.val ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, preferredWorkoutTime: t.val }))}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>NEXT</button>
          </div>
        </div>
      )}

      {step === 'prs' && (
        <div>
          <div style={s.stepTitle}>STARTING PRs (OPTIONAL)</div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
            Enter your current best lifts. Leave blank if you don&apos;t know — Gunny AI will help establish baselines.
          </p>
          {PR_EXERCISES.map(ex => (
            <div key={ex} style={{ marginBottom: 12 }}>
              <label style={s.label}>{ex}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" style={{ ...s.input, flex: 1, marginBottom: 0 }} placeholder="Weight (lbs)"
                  onChange={e => {
                    const w = parseFloat(e.target.value) || 0;
                    setIntake(prev => {
                      const prs = [...(prev.startingPRs || [])];
                      const idx = prs.findIndex(p => p.exercise === ex);
                      if (idx >= 0) prs[idx] = { ...prs[idx], weight: w };
                      else prs.push({ exercise: ex, weight: w, reps: 1 });
                      return { ...prev, startingPRs: prs };
                    });
                  }} />
                <input type="number" style={{ ...s.input, width: 80, marginBottom: 0 }} placeholder="Reps"
                  onChange={e => {
                    const r = parseInt(e.target.value) || 1;
                    setIntake(prev => {
                      const prs = [...(prev.startingPRs || [])];
                      const idx = prs.findIndex(p => p.exercise === ex);
                      if (idx >= 0) prs[idx] = { ...prs[idx], reps: r };
                      return { ...prev, startingPRs: prs };
                    });
                  }} />
              </div>
            </div>
          ))}
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>REVIEW</button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div style={s.stepTitle}>ASSESSMENT REVIEW</div>
          <div style={{ textAlign: 'center', marginBottom: 20, padding: 16, background: '#0a1a0a', border: `1px solid ${fitnessLevelLabel(previewLevel).color}`, borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>YOUR FITNESS CLASSIFICATION</div>
            <div style={{ ...s.levelBadge, fontSize: 18, color: fitnessLevelLabel(previewLevel).color, border: `2px solid ${fitnessLevelLabel(previewLevel).color}`, padding: '8px 20px' }}>
              {fitnessLevelLabel(previewLevel).name}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>{fitnessLevelLabel(previewLevel).desc}</div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>BASICS</div>
            <div style={s.reviewValue}>{age}y, {formatHeightInput(heightRaw) || 'N/A'}, {weight}lbs{bodyFat > 0 ? `, ${bodyFat}% BF` : ''}</div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>EXPERIENCE</div>
            <div style={s.reviewValue}>{intake.experienceYears} years — {(intake.exerciseHistory || 'none').replace(/_/g, ' ').toUpperCase()}</div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>PRIMARY GOAL</div>
            <div style={s.reviewValue}>{GOAL_OPTIONS.find(g => g.id === intake.primaryGoal)?.label || intake.primaryGoal}</div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>TRAINING PATH</div>
            <div style={s.reviewValue}>{TRAINING_PATH_OPTIONS.find(p => p.id === intake.trainingPath)?.label || 'LET GUNNY DECIDE'}</div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>LIFESTYLE</div>
            <div style={s.reviewValue}>Sleep: {intake.sleepQuality}/10, Stress: {intake.stressLevel}/10, Nutrition: {(intake.nutritionHabits || '').toUpperCase()}</div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>NUTRITION</div>
            <div style={s.reviewValue}>
              {intake.mealsPerDay} meals/day, {DIET_OPTIONS.find(d => d.id === intake.currentDiet)?.label || 'No plan'}, ~{intake.estimatedCalories || 2000} cal, {intake.dailyWaterOz || 64}oz water
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              Protein priority: {(intake.proteinPriority || 'moderate').toUpperCase()}
              {(intake.supplements || []).length > 0 && ` | Supps: ${(intake.supplements || []).join(', ')}`}
              {(intake.dietaryRestrictions || []).length > 0 && ` | Restrictions: ${(intake.dietaryRestrictions || []).join(', ')}`}
            </div>
          </div>
          {(intake.healthConditions || []).length > 0 && (
            <div style={s.reviewSection}>
              <div style={s.reviewLabel}>HEALTH CONDITIONS</div>
              <div style={s.reviewValue}>{(intake.healthConditions || []).join(', ')}</div>
            </div>
          )}
          {intake.wearableDevice && (
            <div style={s.reviewSection}>
              <div style={s.reviewLabel}>WEARABLE</div>
              <div style={s.reviewValue}>{intake.wearableDevice}</div>
            </div>
          )}
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>EDIT</button>
            <button style={s.btnPrimary} onClick={handleComplete}>DEPLOY PROFILE</button>
          </div>
        </div>
      )}
    </div>
  );
}
