'use client';

import React, { useState, useCallback } from 'react';
import { Operator, IntakeAssessment, FitnessLevel, calculateFitnessLevel, calculateTrainingAge, calculateReadiness, formatHeightInput } from '@/lib/types';
import { getLocalDateStr } from '@/lib/dateUtils';
import Icon from '@/components/Icons';
import { useLanguage } from '@/lib/i18n';

interface IntakeFormProps {
  operator: Operator;
  onComplete: (updated: Operator) => void;
  onSkip: () => void;
}

type IntakeStep = 'welcome' | 'basics' | 'experience' | 'goals' | 'training_path' | 'health' | 'lifestyle' | 'nutrition' | 'equipment' | 'prs' | 'review';

const STEP_ORDER: IntakeStep[] = ['welcome', 'basics', 'experience', 'goals', 'training_path', 'health', 'lifestyle', 'nutrition', 'equipment', 'prs', 'review'];

// i18n note: module-level constants store DB id/value strings. The
// translation keys (`labelKey` / `descKey` on object arrays, and the
// sibling `*_LABEL_KEYS` maps for plain string arrays) are resolved
// via `t()` at render time inside the component.

const DIET_OPTIONS: { id: string; labelKey: string; descKey: string }[] = [
  { id: 'no_plan', labelKey: 'intake.nutrition.diet.no_plan.label', descKey: 'intake.nutrition.diet.no_plan.desc' },
  { id: 'basic_tracking', labelKey: 'intake.nutrition.diet.basic_tracking.label', descKey: 'intake.nutrition.diet.basic_tracking.desc' },
  { id: 'strict_macros', labelKey: 'intake.nutrition.diet.strict_macros.label', descKey: 'intake.nutrition.diet.strict_macros.desc' },
  { id: 'meal_prep', labelKey: 'intake.nutrition.diet.meal_prep.label', descKey: 'intake.nutrition.diet.meal_prep.desc' },
  { id: 'keto', labelKey: 'intake.nutrition.diet.keto.label', descKey: 'intake.nutrition.diet.keto.desc' },
  { id: 'paleo', labelKey: 'intake.nutrition.diet.paleo.label', descKey: 'intake.nutrition.diet.paleo.desc' },
  { id: 'vegan', labelKey: 'intake.nutrition.diet.vegan.label', descKey: 'intake.nutrition.diet.vegan.desc' },
  { id: 'vegetarian', labelKey: 'intake.nutrition.diet.vegetarian.label', descKey: 'intake.nutrition.diet.vegetarian.desc' },
  { id: 'mediterranean', labelKey: 'intake.nutrition.diet.mediterranean.label', descKey: 'intake.nutrition.diet.mediterranean.desc' },
  { id: 'other', labelKey: 'intake.nutrition.diet.other.label', descKey: 'intake.nutrition.diet.other.desc' },
];

const SUPPLEMENT_OPTIONS = [
  'Protein Powder', 'Creatine', 'Pre-Workout', 'BCAAs', 'Fish Oil / Omega-3',
  'Multivitamin', 'Vitamin D', 'Magnesium', 'Caffeine', 'Collagen', 'None',
];

const SUPPLEMENT_LABEL_KEYS: Record<string, string> = {
  'Protein Powder': 'intake.nutrition.supp.protein',
  'Creatine': 'intake.nutrition.supp.creatine',
  'Pre-Workout': 'intake.nutrition.supp.preworkout',
  'BCAAs': 'intake.nutrition.supp.bcaa',
  'Fish Oil / Omega-3': 'intake.nutrition.supp.fish_oil',
  'Multivitamin': 'intake.nutrition.supp.multivitamin',
  'Vitamin D': 'intake.nutrition.supp.vitamin_d',
  'Magnesium': 'intake.nutrition.supp.magnesium',
  'Caffeine': 'intake.nutrition.supp.caffeine',
  'Collagen': 'intake.nutrition.supp.collagen',
  'None': 'intake.nutrition.supp.none',
};

const DIETARY_RESTRICTIONS = [
  'Gluten Free', 'Dairy Free', 'Nut Allergy', 'Soy Free', 'Shellfish Allergy',
  'Egg Allergy', 'Halal', 'Kosher', 'Low Sodium', 'None',
];

const RESTRICTION_LABEL_KEYS: Record<string, string> = {
  'Gluten Free': 'intake.nutrition.rest.gluten_free',
  'Dairy Free': 'intake.nutrition.rest.dairy_free',
  'Nut Allergy': 'intake.nutrition.rest.nut_allergy',
  'Soy Free': 'intake.nutrition.rest.soy_free',
  'Shellfish Allergy': 'intake.nutrition.rest.shellfish',
  'Egg Allergy': 'intake.nutrition.rest.egg_allergy',
  'Halal': 'intake.nutrition.rest.halal',
  'Kosher': 'intake.nutrition.rest.kosher',
  'Low Sodium': 'intake.nutrition.rest.low_sodium',
  'None': 'intake.nutrition.rest.none',
};

const GOAL_OPTIONS: { id: string; labelKey: string; descKey: string }[] = [
  { id: 'weight_loss', labelKey: 'intake.goals.weight_loss.label', descKey: 'intake.goals.weight_loss.desc' },
  { id: 'muscle_gain', labelKey: 'intake.goals.muscle_gain.label', descKey: 'intake.goals.muscle_gain.desc' },
  { id: 'strength', labelKey: 'intake.goals.strength.label', descKey: 'intake.goals.strength.desc' },
  { id: 'endurance', labelKey: 'intake.goals.endurance.label', descKey: 'intake.goals.endurance.desc' },
  { id: 'athletic', labelKey: 'intake.goals.athletic.label', descKey: 'intake.goals.athletic.desc' },
  { id: 'general_health', labelKey: 'intake.goals.general_health.label', descKey: 'intake.goals.general_health.desc' },
  { id: 'rehab', labelKey: 'intake.goals.rehab.label', descKey: 'intake.goals.rehab.desc' },
  { id: 'sport_specific', labelKey: 'intake.goals.sport_specific.label', descKey: 'intake.goals.sport_specific.desc' },
];

const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbell', 'Kettlebell', 'Pull-up Bar', 'Resistance Bands',
  'Cable Machine', 'Squat Rack', 'Bench', 'Assault Bike', 'Rower',
  'Treadmill', 'Medicine Ball', 'Box/Platform', 'TRX/Suspension', 'None (Bodyweight Only)',
];

const EQUIPMENT_LABEL_KEYS: Record<string, string> = {
  'Barbell': 'intake.equipment.barbell',
  'Dumbbell': 'intake.equipment.dumbbell',
  'Kettlebell': 'intake.equipment.kettlebell',
  'Pull-up Bar': 'intake.equipment.pullup_bar',
  'Resistance Bands': 'intake.equipment.bands',
  'Cable Machine': 'intake.equipment.cable',
  'Squat Rack': 'intake.equipment.squat_rack',
  'Bench': 'intake.equipment.bench',
  'Assault Bike': 'intake.equipment.assault_bike',
  'Rower': 'intake.equipment.rower',
  'Treadmill': 'intake.equipment.treadmill',
  'Medicine Ball': 'intake.equipment.med_ball',
  'Box/Platform': 'intake.equipment.box',
  'TRX/Suspension': 'intake.equipment.trx',
  'None (Bodyweight Only)': 'intake.equipment.bodyweight_only',
};

const COMMON_CONDITIONS = [
  'High Blood Pressure', 'Diabetes', 'Heart Condition', 'Asthma',
  'Joint Pain', 'Back Problems', 'Knee Issues', 'Shoulder Issues',
  'Previous Surgery', 'Pregnancy/Postpartum', 'None',
];

const CONDITION_LABEL_KEYS: Record<string, string> = {
  'High Blood Pressure': 'intake.health.cond.high_bp',
  'Diabetes': 'intake.health.cond.diabetes',
  'Heart Condition': 'intake.health.cond.heart',
  'Asthma': 'intake.health.cond.asthma',
  'Joint Pain': 'intake.health.cond.joint_pain',
  'Back Problems': 'intake.health.cond.back',
  'Knee Issues': 'intake.health.cond.knee',
  'Shoulder Issues': 'intake.health.cond.shoulder',
  'Previous Surgery': 'intake.health.cond.surgery',
  'Pregnancy/Postpartum': 'intake.health.cond.pregnancy',
  'None': 'intake.health.cond.none',
};

// Training-path picker — emoji icons replaced with SVG icon components
// from the design-system Icons set so the picker stays on-brand and
// scales cleanly. Each path maps to the closest semantic glyph.
const TRAINING_PATH_OPTIONS: { id: string; labelKey: string; descKey: string; icon: React.ReactNode }[] = [
  { id: 'bodybuilding', labelKey: 'intake.path.bodybuilding.label', descKey: 'intake.path.bodybuilding.desc', icon: <Icon.Dumbbell /> },
  { id: 'crossfit', labelKey: 'intake.path.crossfit.label', descKey: 'intake.path.crossfit.desc', icon: <Icon.Bolt /> },
  { id: 'powerlifting', labelKey: 'intake.path.powerlifting.label', descKey: 'intake.path.powerlifting.desc', icon: <Icon.Sword /> },
  { id: 'athletic', labelKey: 'intake.path.athletic.label', descKey: 'intake.path.athletic.desc', icon: <Icon.Target /> },
  { id: 'tactical', labelKey: 'intake.path.tactical.label', descKey: 'intake.path.tactical.desc', icon: <Icon.Trophy /> },
  { id: 'hybrid', labelKey: 'intake.path.hybrid.label', descKey: 'intake.path.hybrid.desc', icon: <Icon.Stats /> },
  { id: 'gunny_pick', labelKey: 'intake.path.gunny_pick.label', descKey: 'intake.path.gunny_pick.desc', icon: <Icon.Flame /> },
];

const PR_EXERCISES = [
  'Back Squat', 'Bench Press', 'Deadlift', 'Overhead Press',
  'Pull-ups (max reps)', 'Mile Run (minutes)',
];

const PR_EXERCISE_LABEL_KEYS: Record<string, string> = {
  'Back Squat': 'intake.prs.ex.back_squat',
  'Bench Press': 'intake.prs.ex.bench_press',
  'Deadlift': 'intake.prs.ex.deadlift',
  'Overhead Press': 'intake.prs.ex.overhead_press',
  'Pull-ups (max reps)': 'intake.prs.ex.pullups_max',
  'Mile Run (minutes)': 'intake.prs.ex.mile_run',
};

export default function IntakeForm({ operator, onComplete, onSkip }: IntakeFormProps) {
  const { t } = useLanguage();
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
      beginner: { name: t('intake.level.recruit.name'), color: '#4ade80', desc: t('intake.level.recruit.desc') },
      intermediate: { name: t('intake.level.operator.name'), color: '#00ff41', desc: t('intake.level.operator.desc') },
      advanced: { name: t('intake.level.commander.name'), color: '#facc15', desc: t('intake.level.commander.desc') },
      elite: { name: t('intake.level.warfighter.name'), color: '#ff6b35', desc: t('intake.level.warfighter.desc') },
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
        <div style={s.title}>{t('intake.title')}</div>
        <div style={s.subtitle}>{t('intake.operator_label')}: {operator.callsign}</div>
      </div>
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${progress}%` }} />
      </div>

      {step === 'welcome' && (
        <div>
          <div style={s.stepTitle}>{t('intake.welcome.heading')}, {operator.callsign}</div>
          <p style={{ color: '#ccc', lineHeight: 1.6, fontSize: 13, marginBottom: 16 }}>
            {t('intake.welcome.intro')}
          </p>
          <p style={{ color: '#888', fontSize: 12, marginBottom: 24 }}>
            {t('intake.welcome.time')}
          </p>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={onSkip}>{t('intake.welcome.skip')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('intake.welcome.begin')}</button>
          </div>
        </div>
      )}

      {step === 'basics' && (
        <div>
          <div style={s.stepTitle}>{t('intake.basics.heading')}</div>
          <label style={s.label}>{t('intake.basics.age')}</label>
          <input type="number" style={s.input} value={age || ''} onChange={e => setAge(parseInt(e.target.value) || 0)} placeholder={t('intake.basics.age_placeholder')} />
          <label style={s.label}>{t('intake.basics.height')}</label>
          <input type="text" style={s.input} value={heightRaw} onChange={e => setHeightRaw(e.target.value)} onBlur={() => setHeightRaw(formatHeightInput(heightRaw))} placeholder={t('intake.basics.height_placeholder')} />
          <label style={s.label}>{t('intake.basics.weight')}</label>
          <input type="number" style={s.input} value={weight || ''} onChange={e => setWeight(parseFloat(e.target.value) || 0)} placeholder={t('intake.basics.weight_placeholder')} />
          <label style={s.label}>{t('intake.basics.body_fat')}</label>
          <input type="number" style={s.input} value={bodyFat || ''} onChange={e => setBodyFat(parseFloat(e.target.value) || 0)} placeholder={t('intake.basics.body_fat_placeholder')} />
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('common.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {step === 'experience' && (
        <div>
          <div style={s.stepTitle}>{t('intake.experience.heading')}</div>
          <label style={s.label}>{t('intake.experience.years')}</label>
          <input type="number" style={s.input} value={intake.experienceYears || ''} onChange={e => setIntake(prev => ({ ...prev, experienceYears: parseFloat(e.target.value) || 0 }))} placeholder="0" step="0.5" />
          <label style={s.label}>{t('intake.experience.history')}</label>
          <div style={{ ...s.optionGrid, gridTemplateColumns: '1fr' }}>
            {[
              { val: 'none', labelKey: 'intake.experience.history.none.label', descKey: 'intake.experience.history.none.desc' },
              { val: 'sporadic', labelKey: 'intake.experience.history.sporadic.label', descKey: 'intake.experience.history.sporadic.desc' },
              { val: 'consistent_beginner', labelKey: 'intake.experience.history.consistent_beginner.label', descKey: 'intake.experience.history.consistent_beginner.desc' },
              { val: 'consistent_intermediate', labelKey: 'intake.experience.history.consistent_intermediate.label', descKey: 'intake.experience.history.consistent_intermediate.desc' },
              { val: 'advanced_athlete', labelKey: 'intake.experience.history.advanced_athlete.label', descKey: 'intake.experience.history.advanced_athlete.desc' },
            ].map(opt => (
              <button key={opt.val} style={{ ...s.optionBtn, textAlign: 'left', ...(intake.exerciseHistory === opt.val ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, exerciseHistory: opt.val }))}>
                <div style={{ fontWeight: 700 }}>{t(opt.labelKey)}</div>
                <div style={{ fontSize: 10, marginTop: 4, color: intake.exerciseHistory === opt.val ? '#00ff4199' : '#666' }}>{t(opt.descKey)}</div>
              </button>
            ))}
          </div>
          <label style={s.label}>{t('intake.experience.movement_quality')}: {intake.movementScreenScore}/10</label>
          <input type="range" min="1" max="10" style={s.slider} value={intake.movementScreenScore || 5}
            onChange={e => setIntake(prev => ({ ...prev, movementScreenScore: parseInt(e.target.value) }))} />
          <div style={{ fontSize: 11, color: '#666', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('intake.experience.movement_limited')}</span><span>{t('intake.experience.movement_average')}</span><span>{t('intake.experience.movement_excellent')}</span>
          </div>
          <label style={s.label}>{t('intake.experience.days_per_week')}</label>
          <div style={s.optionGrid}>
            {[2, 3, 4, 5, 6, 7].map(d => (
              <button key={d} style={{ ...s.optionBtn, ...(intake.daysPerWeek === d ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, daysPerWeek: d }))}>
                {d}
              </button>
            ))}
          </div>
          <label style={s.label}>{t('intake.experience.session_duration')}</label>
          <div style={s.optionGrid}>
            {[30, 45, 60, 75, 90, 120].map(m => (
              <button key={m} style={{ ...s.optionBtn, ...(intake.sessionDuration === m ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, sessionDuration: m }))}>
                {m}
              </button>
            ))}
          </div>
          <label style={s.label}>{t('intake.experience.split')}</label>
          <div style={{ ...s.optionGrid, gridTemplateColumns: '1fr' }}>
            {[
              { val: 'Push/Pull/Legs', labelKey: 'intake.experience.split.ppl.label', descKey: 'intake.experience.split.ppl.desc' },
              { val: 'Upper/Lower', labelKey: 'intake.experience.split.upper_lower.label', descKey: 'intake.experience.split.upper_lower.desc' },
              { val: 'Full Body', labelKey: 'intake.experience.split.full_body.label', descKey: 'intake.experience.split.full_body.desc' },
              { val: 'Bro Split', labelKey: 'intake.experience.split.bro.label', descKey: 'intake.experience.split.bro.desc' },
              { val: 'No Preference', labelKey: 'intake.experience.split.no_pref.label', descKey: 'intake.experience.split.no_pref.desc' },
            ].map(opt => (
              <button key={opt.val} style={{ ...s.optionBtn, textAlign: 'left', ...(intake.preferredSplit === opt.val ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, preferredSplit: opt.val }))}>
                <div style={{ fontWeight: 700 }}>{t(opt.labelKey)}</div>
                <div style={{ fontSize: 10, marginTop: 4, color: intake.preferredSplit === opt.val ? '#00ff4199' : '#666' }}>{t(opt.descKey)}</div>
              </button>
            ))}
          </div>
          <div style={{ padding: 12, background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 4, marginBottom: 16 }}>
            <span style={{ fontSize: 10, color: '#888' }}>{t('intake.experience.projected_level')}: </span>
            <span style={{ ...s.levelBadge, color: fitnessLevelLabel(previewLevel).color, border: `1px solid ${fitnessLevelLabel(previewLevel).color}` }}>
              {fitnessLevelLabel(previewLevel).name}
            </span>
          </div>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('common.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {step === 'goals' && (
        <div>
          <div style={s.stepTitle}>{t('intake.goals.heading')}</div>
          <label style={s.label}>{t('intake.goals.primary')}</label>
          <div style={s.optionGrid}>
            {GOAL_OPTIONS.map(g => (
              <button key={g.id} style={{ ...s.optionBtn, ...(intake.primaryGoal === g.id ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, primaryGoal: g.id }))}>
                <div style={{ fontWeight: 700 }}>{t(g.labelKey)}</div>
                <div style={{ fontSize: 10, marginTop: 4, color: intake.primaryGoal === g.id ? '#00ff4199' : '#666' }}>{t(g.descKey)}</div>
              </button>
            ))}
          </div>
          <label style={s.label}>{t('intake.goals.secondary')}</label>
          <div style={s.optionGrid}>
            {GOAL_OPTIONS.filter(g => g.id !== intake.primaryGoal).map(g => (
              <button key={g.id} style={{ ...s.optionBtn, ...((intake.secondaryGoals || []).includes(g.id) ? s.optionBtnActive : {}) }}
                onClick={() => toggleArrayItem('secondaryGoals', g.id)}>
                {t(g.labelKey)}
              </button>
            ))}
          </div>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('common.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {step === 'training_path' && (
        <div>
          <div style={s.stepTitle}>{t('intake.path.heading')}</div>
          <p style={{ color: '#ccc', lineHeight: 1.6, fontSize: 13, marginBottom: 8 }}>
            {t('intake.path.intro')}
          </p>
          {/* Gunny Recommendation Banner */}
          {intake.primaryGoal && (
            <div style={{ padding: 12, background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 4, marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#00ff41', letterSpacing: 1, marginBottom: 6, fontFamily: 'Orbitron, sans-serif' }}>{t('intake.path.gunny_recommends')}</div>
              <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5 }}>
                {(() => {
                  const goal = intake.primaryGoal;
                  const exp = intake.exerciseHistory || 'none';
                  if (goal === 'muscle_gain') return t('intake.path.rec.muscle_gain');
                  if (goal === 'weight_loss' && (exp === 'none' || exp === 'sporadic')) return t('intake.path.rec.weight_loss_novice');
                  if (goal === 'weight_loss') return t('intake.path.rec.weight_loss');
                  if (goal === 'strength') return t('intake.path.rec.strength');
                  if (goal === 'endurance') return t('intake.path.rec.endurance');
                  if (goal === 'athletic') return t('intake.path.rec.athletic');
                  if (goal === 'sport_specific') return t('intake.path.rec.sport_specific');
                  if (goal === 'rehab') return t('intake.path.rec.rehab');
                  return t('intake.path.rec.default');
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
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{t(p.labelKey)}</div>
                  <div style={{ fontSize: 10, marginTop: 4, color: intake.trainingPath === p.id ? '#00ff4199' : '#666' }}>{t(p.descKey)}</div>
                </div>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#666', marginBottom: 16, textAlign: 'center' as const }}>
            {t('intake.path.scaling_note')}
          </p>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('common.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {step === 'health' && (
        <div>
          <div style={s.stepTitle}>{t('intake.health.heading')}</div>
          <label style={s.label}>{t('intake.health.conditions')}</label>
          <div style={s.optionGrid}>
            {COMMON_CONDITIONS.map(c => (
              <button key={c} style={{ ...s.optionBtn, ...((intake.healthConditions || []).includes(c) ? s.optionBtnActive : {}) }}
                onClick={() => toggleArrayItem('healthConditions', c)}>
                {t(CONDITION_LABEL_KEYS[c] || '') || c}
              </button>
            ))}
          </div>
          <label style={s.label}>{t('intake.health.injuries_label')}</label>
          <textarea style={{ ...s.input, height: 100, resize: 'vertical' as const }}
            placeholder={t('intake.health.injuries_placeholder')}
            value={intake.injuryNotes || ''}
            onChange={e => {
              const raw = e.target.value;
              const injuries = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
              setIntake(prev => ({ ...prev, injuryNotes: raw, injuryHistory: injuries }));
            }} />
          <div style={{ fontSize: 9, color: '#555', marginTop: -12, marginBottom: 12, fontFamily: 'Share Tech Mono, monospace' }}>
            {t('intake.health.injuries_note')}
          </div>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('common.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {step === 'lifestyle' && (
        <div>
          <div style={s.stepTitle}>{t('intake.lifestyle.heading')}</div>
          <label style={s.label}>{t('intake.lifestyle.activity')}</label>
          <div style={{ ...s.optionGrid, gridTemplateColumns: '1fr' }}>
            {[
              { val: 'sedentary', labelKey: 'intake.lifestyle.activity.sedentary.label', descKey: 'intake.lifestyle.activity.sedentary.desc' },
              { val: 'lightly_active', labelKey: 'intake.lifestyle.activity.lightly_active.label', descKey: 'intake.lifestyle.activity.lightly_active.desc' },
              { val: 'active', labelKey: 'intake.lifestyle.activity.active.label', descKey: 'intake.lifestyle.activity.active.desc' },
              { val: 'very_active', labelKey: 'intake.lifestyle.activity.very_active.label', descKey: 'intake.lifestyle.activity.very_active.desc' },
              { val: 'athlete', labelKey: 'intake.lifestyle.activity.athlete.label', descKey: 'intake.lifestyle.activity.athlete.desc' },
            ].map(opt => (
              <button key={opt.val} style={{ ...s.optionBtn, textAlign: 'left', ...(intake.currentActivity === opt.val ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, currentActivity: opt.val }))}>
                <div style={{ fontWeight: 700 }}>{t(opt.labelKey)}</div>
                <div style={{ fontSize: 10, marginTop: 4, color: intake.currentActivity === opt.val ? '#00ff4199' : '#666' }}>{t(opt.descKey)}</div>
              </button>
            ))}
          </div>
          <label style={s.label}>{t('intake.lifestyle.sleep_quality')}: {intake.sleepQuality}/10</label>
          <input type="range" min="1" max="10" style={s.slider} value={intake.sleepQuality || 7}
            onChange={e => setIntake(prev => ({ ...prev, sleepQuality: parseInt(e.target.value) }))} />
          <label style={s.label}>{t('intake.lifestyle.stress_level')}: {intake.stressLevel}/10</label>
          <input type="range" min="1" max="10" style={s.slider} value={intake.stressLevel || 4}
            onChange={e => setIntake(prev => ({ ...prev, stressLevel: parseInt(e.target.value) }))} />
          <label style={s.label}>{t('intake.lifestyle.nutrition_habits')}</label>
          <div style={s.optionGrid}>
            {['poor', 'fair', 'good', 'excellent'].map(n => (
              <button key={n} style={{ ...s.optionBtn, ...(intake.nutritionHabits === n ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, nutritionHabits: n }))}>
                {t(`intake.lifestyle.nutrition.${n}`)}
              </button>
            ))}
          </div>
          <label style={s.label}>{t('intake.lifestyle.wearable')}</label>
          <div style={s.optionGrid}>
            {['Apple Watch', 'WHOOP', 'Garmin', 'Fitbit', 'Oura Ring', 'None'].map(d => (
              <button key={d} style={{ ...s.optionBtn, ...(intake.wearableDevice === d ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, wearableDevice: d === 'None' ? undefined : d }))}>
                {d === 'None' ? t('intake.lifestyle.wearable.none') : d}
              </button>
            ))}
          </div>
          {!intake.wearableDevice && (
            <div style={{ padding: 8, background: '#1a1a0a', border: '1px solid #333300', borderRadius: 4, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: '#facc15' }}>{t('intake.lifestyle.wearable_recommend')}</span>
            </div>
          )}
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('common.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {step === 'nutrition' && (
        <div>
          <div style={s.stepTitle}>{t('intake.nutrition.heading')}</div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
            {t('intake.nutrition.intro')}
          </p>

          <label style={s.label}>{t('intake.nutrition.meals_per_day')}</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} style={{ ...s.optionBtn, flex: 1, ...(intake.mealsPerDay === n ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, mealsPerDay: n }))}>
                {n}
              </button>
            ))}
          </div>

          <label style={s.label}>{t('intake.nutrition.diet_approach')}</label>
          <div style={s.optionGrid}>
            {DIET_OPTIONS.map(d => (
              <button key={d.id} style={{ ...s.optionBtn, textAlign: 'left' as const, padding: '10px 12px', ...(intake.currentDiet === d.id ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, currentDiet: d.id }))}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{t(d.labelKey)}</div>
                <div style={{ fontSize: 9, color: intake.currentDiet === d.id ? '#00ff41' : '#666', marginTop: 2 }}>{t(d.descKey)}</div>
              </button>
            ))}
          </div>

          <label style={s.label}>{t('intake.nutrition.calories_label')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <input type="range" min={1200} max={5000} step={100}
              value={intake.estimatedCalories || 2000}
              style={s.slider}
              onChange={e => setIntake(prev => ({ ...prev, estimatedCalories: parseInt(e.target.value) }))} />
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', minWidth: 60, textAlign: 'right' as const }}>
              {intake.estimatedCalories || 2000}
            </span>
          </div>
          <p style={{ fontSize: 10, color: '#555', marginBottom: 16 }}>{t('intake.nutrition.calories_note')}</p>

          <label style={s.label}>{t('intake.nutrition.water_label')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <input type="range" min={16} max={200} step={8}
              value={intake.dailyWaterOz || 64}
              style={s.slider}
              onChange={e => setIntake(prev => ({ ...prev, dailyWaterOz: parseInt(e.target.value) }))} />
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', minWidth: 50, textAlign: 'right' as const }}>
              {intake.dailyWaterOz || 64}oz
            </span>
          </div>

          <label style={s.label}>{t('intake.nutrition.protein_priority')}</label>
          <p style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>{t('intake.nutrition.protein_intro')}</p>
          <div style={s.optionGrid}>
            {[
              { id: 'low', labelKey: 'intake.nutrition.protein.low.label', descKey: 'intake.nutrition.protein.low.desc' },
              { id: 'moderate', labelKey: 'intake.nutrition.protein.moderate.label', descKey: 'intake.nutrition.protein.moderate.desc' },
              { id: 'high', labelKey: 'intake.nutrition.protein.high.label', descKey: 'intake.nutrition.protein.high.desc' },
              { id: 'very_high', labelKey: 'intake.nutrition.protein.very_high.label', descKey: 'intake.nutrition.protein.very_high.desc' },
            ].map(p => (
              <button key={p.id} style={{ ...s.optionBtn, textAlign: 'left' as const, padding: '10px 12px', ...(intake.proteinPriority === p.id ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, proteinPriority: p.id }))}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{t(p.labelKey)}</div>
                <div style={{ fontSize: 9, color: intake.proteinPriority === p.id ? '#00ff41' : '#666', marginTop: 2 }}>{t(p.descKey)}</div>
              </button>
            ))}
          </div>

          <label style={s.label}>{t('intake.nutrition.supplements')}</label>
          <div style={s.optionGrid}>
            {SUPPLEMENT_OPTIONS.map(sup => (
              <button key={sup} style={{ ...s.optionBtn, ...(((intake.supplements || []).includes(sup)) ? s.optionBtnActive : {}) }}
                onClick={() => toggleArrayItem('supplements', sup)}>
                {(t(SUPPLEMENT_LABEL_KEYS[sup] || '') || sup).toUpperCase()}
              </button>
            ))}
          </div>

          <label style={s.label}>{t('intake.nutrition.restrictions')}</label>
          <div style={s.optionGrid}>
            {DIETARY_RESTRICTIONS.map(r => (
              <button key={r} style={{ ...s.optionBtn, ...(((intake.dietaryRestrictions || []).includes(r)) ? s.optionBtnActive : {}) }}
                onClick={() => toggleArrayItem('dietaryRestrictions', r)}>
                {(t(RESTRICTION_LABEL_KEYS[r] || '') || r).toUpperCase()}
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
                <div style={{ fontSize: 10, color: '#888', letterSpacing: 1, marginBottom: 8 }}>{t('intake.nutrition.daily_targets')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' as const }}>
                  <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#00ff41' }}>{cal}</div>
                    <div style={{ fontSize: 9, color: '#666' }}>{t('intel.calories').toUpperCase()}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#4ade80' }}>{prot}g</div>
                    <div style={{ fontSize: 9, color: '#666' }}>{t('intel.protein').toUpperCase()}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#facc15' }}>{carbs}g</div>
                    <div style={{ fontSize: 9, color: '#666' }}>{t('intel.carbs').toUpperCase()}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#ff6b35' }}>{fat}g</div>
                    <div style={{ fontSize: 9, color: '#666' }}>{t('intel.fat').toUpperCase()}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('common.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {step === 'equipment' && (
        <div>
          <div style={s.stepTitle}>{t('intake.equipment.heading')}</div>
          <label style={s.label}>{t('intake.equipment.label')}</label>
          <div style={s.optionGrid}>
            {EQUIPMENT_OPTIONS.map(eq => (
              <button key={eq} style={{ ...s.optionBtn, ...((intake.availableEquipment || []).includes(eq) ? s.optionBtnActive : {}) }}
                onClick={() => toggleArrayItem('availableEquipment', eq)}>
                {(t(EQUIPMENT_LABEL_KEYS[eq] || '') || eq).toUpperCase()}
              </button>
            ))}
          </div>
          <label style={s.label}>{t('intake.equipment.workout_time')}</label>
          <div style={s.optionGrid}>
            {[
              { val: 'early_morning', labelKey: 'intake.equipment.time.early_morning' },
              { val: 'morning', labelKey: 'intake.equipment.time.morning' },
              { val: 'midday', labelKey: 'intake.equipment.time.midday' },
              { val: 'afternoon', labelKey: 'intake.equipment.time.afternoon' },
              { val: 'evening', labelKey: 'intake.equipment.time.evening' },
              { val: 'night', labelKey: 'intake.equipment.time.night' },
            ].map(tm => (
              <button key={tm.val} style={{ ...s.optionBtn, ...(intake.preferredWorkoutTime === tm.val ? s.optionBtnActive : {}) }}
                onClick={() => setIntake(prev => ({ ...prev, preferredWorkoutTime: tm.val }))}>
                {t(tm.labelKey)}
              </button>
            ))}
          </div>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('common.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {step === 'prs' && (
        <div>
          <div style={s.stepTitle}>{t('intake.prs.heading')}</div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
            {t('intake.prs.intro')}
          </p>
          {PR_EXERCISES.map(ex => (
            <div key={ex} style={{ marginBottom: 12 }}>
              <label style={s.label}>{t(PR_EXERCISE_LABEL_KEYS[ex] || '') || ex}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" style={{ ...s.input, flex: 1, marginBottom: 0 }} placeholder={t('intake.prs.weight_placeholder')}
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
                <input type="number" style={{ ...s.input, width: 80, marginBottom: 0 }} placeholder={t('intake.prs.reps_placeholder')}
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
            <button style={s.btnSecondary} onClick={prevStep}>{t('common.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('intake.prs.review_btn')}</button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div style={s.stepTitle}>{t('intake.review.heading')}</div>
          <div style={{ textAlign: 'center', marginBottom: 20, padding: 16, background: '#0a1a0a', border: `1px solid ${fitnessLevelLabel(previewLevel).color}`, borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>{t('intake.review.classification')}</div>
            <div style={{ ...s.levelBadge, fontSize: 18, color: fitnessLevelLabel(previewLevel).color, border: `2px solid ${fitnessLevelLabel(previewLevel).color}`, padding: '8px 20px' }}>
              {fitnessLevelLabel(previewLevel).name}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>{fitnessLevelLabel(previewLevel).desc}</div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>{t('intake.review.basics')}</div>
            <div style={s.reviewValue}>{age}{t('intake.review.basics_years_suffix')}, {formatHeightInput(heightRaw) || t('intake.review.basics_na')}, {weight}{t('intake.review.basics_lbs_suffix')}{bodyFat > 0 ? `, ${bodyFat}${t('intake.review.basics_bf_suffix')}` : ''}</div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>{t('intake.review.experience')}</div>
            <div style={s.reviewValue}>{intake.experienceYears} {t('intake.review.experience_years')} — {t(`intake.experience.history.${intake.exerciseHistory || 'none'}.label`)}</div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>{t('intake.review.primary_goal')}</div>
            <div style={s.reviewValue}>{t(GOAL_OPTIONS.find(g => g.id === intake.primaryGoal)?.labelKey || '') || intake.primaryGoal}</div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>{t('intake.review.training_path')}</div>
            <div style={s.reviewValue}>{t(TRAINING_PATH_OPTIONS.find(p => p.id === intake.trainingPath)?.labelKey || 'intake.path.gunny_pick.label')}</div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>{t('intake.review.lifestyle')}</div>
            <div style={s.reviewValue}>{t('intake.review.lifestyle_sleep')}: {intake.sleepQuality}/10, {t('intake.review.lifestyle_stress')}: {intake.stressLevel}/10, {t('intake.review.lifestyle_nutrition')}: {t(`intake.lifestyle.nutrition.${intake.nutritionHabits || 'fair'}`)}</div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>{t('intake.review.nutrition')}</div>
            <div style={s.reviewValue}>
              {intake.mealsPerDay} {t('intake.review.nutrition_meals_suffix')}, {t(DIET_OPTIONS.find(d => d.id === intake.currentDiet)?.labelKey || '') || t('intake.review.nutrition_no_plan')}, ~{intake.estimatedCalories || 2000} {t('intake.review.nutrition_cal_suffix')}, {intake.dailyWaterOz || 64}{t('intake.review.nutrition_water_suffix')}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              {t('intake.review.protein_priority_label')}: {t(`intake.nutrition.protein.${intake.proteinPriority || 'moderate'}.label`)}
              {(intake.supplements || []).length > 0 && ` | ${t('intake.review.supps_label')}: ${(intake.supplements || []).map(sup => t(SUPPLEMENT_LABEL_KEYS[sup] || '') || sup).join(', ')}`}
              {(intake.dietaryRestrictions || []).length > 0 && ` | ${t('intake.review.restrictions_label')}: ${(intake.dietaryRestrictions || []).map(r => t(RESTRICTION_LABEL_KEYS[r] || '') || r).join(', ')}`}
            </div>
          </div>
          {(intake.healthConditions || []).length > 0 && (
            <div style={s.reviewSection}>
              <div style={s.reviewLabel}>{t('intake.review.health_conditions')}</div>
              <div style={s.reviewValue}>{(intake.healthConditions || []).map(c => t(CONDITION_LABEL_KEYS[c] || '') || c).join(', ')}</div>
            </div>
          )}
          {intake.wearableDevice && (
            <div style={s.reviewSection}>
              <div style={s.reviewLabel}>{t('intake.review.wearable')}</div>
              <div style={s.reviewValue}>{intake.wearableDevice}</div>
            </div>
          )}
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('intake.review.edit_btn')}</button>
            <button style={s.btnPrimary} onClick={handleComplete}>{t('intake.review.deploy_btn')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
