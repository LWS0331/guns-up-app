'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Operator, Meal, PRRecord, Injury, formatHeightInput, FitnessLevel, MilestoneGoal } from '@/lib/types';
import WearableConnect from '@/components/WearableConnect';
import ProgressCharts from '@/components/ProgressCharts';
import BillingPanel from '@/components/BillingPanel';
import { FOOD_DB } from '@/data/foods';
import { notifyPRAlert, loadNotificationPrefs } from '@/lib/notifications';
import BattlePlanRef from '@/components/BattlePlanRef';
import DailyBriefRef from '@/components/DailyBriefRef';
import JuniorPRBoard from '@/components/JuniorPRBoard';
import MacrocyclePanel from '@/components/MacrocyclePanel';
import SupplementStack from '@/components/SupplementStack';
import RecoveryReadout from '@/components/RecoveryReadout';
import ReadinessPanel from '@/components/ReadinessPanel';
import FormAnalysis from '@/components/FormAnalysis';
import OperatingManual from '@/components/OperatingManual';
import { isJuniorOperatorEnabledClient } from '@/lib/featureFlags';
import { MealRow } from '@/components/nutrition/MealRow';
import { getLocalDateStr, toLocalDateStr } from '@/lib/dateUtils';
import { getAuthToken } from '@/lib/authClient';
import { compressImageForVision } from '@/lib/imageCompress';

/** Format a meal.time for display — handles ISO, legacy locale strings, and bare times. */
const formatMealTime = (raw: string | undefined): string => {
  if (!raw) return '';
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return raw; // legacy non-parseable — show as stored
};

// Local type aliases for internal state management
interface Goal {
  id: string;
  name: string;
}

interface PersonalRecord extends PRRecord {}

interface IntelCenterProps {
  operator: Operator;
  currentUser?: Operator;
  onUpdateOperator: (updated: Operator) => void;
  onRequestIntake?: () => void;
}

type SubTab = 'PROFILE' | 'NUTRITION' | 'PR_BOARD' | 'ANALYTICS' | 'INJURIES' | 'PREFERENCES' | 'WEARABLES' | 'FORM_CHECK' | 'MACROCYCLE' | 'MANUAL';

interface LocalState {
  profile: {
    name: string;
    age: number;
    height: string;
    weight: number;
    bodyFat: number;
    trainingAge: number;
    goals: Goal[];
    readinessScore: number;
    sleepQuality: number;
    stressLevel: number;
    callsign: string;
    pin: string;
  };
  nutrition: {
    calorieTarget: number;
    proteinTarget: number;
    carbsTarget: number;
    fatTarget: number;
    mealLogs: Meal[];
    mealName: string;
    mealCalories: string;
    mealProtein: string;
    mealCarbs: string;
    mealFat: string;
  };
  prBoard: PersonalRecord[];
  injuries: Injury[];
  preferences: {
    trainingSplit: string;
    equipment: string[];
    sessionDuration: number;
    daysPerWeek: number;
    weakPoints: string[];
    movementsToAvoid: string[];
    // Apr 2026 audit: trainingPath was captured during intake but had
    // ZERO UI surface in IntelCenter. That's why Gunny kept drifting on
    // the field — the operator had no way to verify or correct what was
    // saved. Surfacing it here closes the loop. Same logic applied to
    // preferredWorkoutTime which was also intake-only.
    trainingPath: string;
    preferredWorkoutTime: string;
  };
  // ── intakeFields ───────────────────────────────────────────────────
  // Apr 2026 follow-up to PR #88. Audit found 7 more intake fields that
  // were captured during onboarding but had no UI surface in any tab.
  // Same Gunny-drift mechanism: data exists, operator can't see it,
  // any prompt that depends on it produces opaque output. Grouping them
  // under an explicit `intakeFields` slice (rather than overloading
  // `preferences`) so the persist path (write-to-operator.intake) is
  // unambiguous in handleSave.
  intakeFields: {
    currentActivity: string;
    exerciseHistory: string;
    movementScreenScore: number;
    healthConditions: string[];
    nutritionHabits: string;
    dietaryRestrictions: string[];
    supplements: string[];
  };
  newGoal: string;
  newEquipment: string;
  newWeakPoint: string;
  newMovementToAvoid: string;
}

// ─────────────────────────────────────────────────────────────────
// Design-system field helper. Wraps a label + input in the .field
// utility from design-system.css so each form field shrinks from
// ~30 lines of inline-style boilerplate to a single component call.
//
// Why a local component instead of pulling from a shared lib: every
// field in this screen has the same shape (label above, single input
// below). A typed helper here documents that pattern in-file without
// adding a new module to import. If a second screen needs the same
// thing, promote it then.
// ─────────────────────────────────────────────────────────────────
type DsFieldProps = {
  label: string;
  type?: 'text' | 'number' | 'tel';
  value: string | number;
  onChange: (next: string) => void;
  onBlur?: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | string;
  maxLength?: number;
  inputMode?: 'numeric' | 'text' | 'tel';
  pattern?: string;
  htmlId?: string;
};
const DsField: React.FC<DsFieldProps> = ({
  label, type = 'text', value, onChange, onBlur, placeholder,
  min, max, step, maxLength, inputMode, pattern, htmlId,
}) => (
  <div className="field" style={{ marginBottom: 0 }}>
    <label htmlFor={htmlId}>{label}</label>
    <input
      id={htmlId}
      className="ds-input"
      type={type}
      value={value}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      maxLength={maxLength}
      inputMode={inputMode}
      pattern={pattern}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined}
    />
  </div>
);

const IntelCenter: React.FC<IntelCenterProps> = ({ operator, currentUser, onUpdateOperator, onRequestIntake }) => {
  const isAdmin = currentUser?.role === 'trainer';
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<SubTab>('PROFILE');

  // Helper function to get today's date in YYYY-MM-DD format — LOCAL timezone.
  // Using UTC (toISOString) silently drops meals logged by PST/EST users when
  // their local evening crosses UTC midnight.
  const getTodayStr = () => getLocalDateStr();

  // ─── P1: Day-back navigation state ───
  const [viewingDateStr, setViewingDateStr] = useState<string>(() => getLocalDateStr());

  const viewingDayMeals: Meal[] = React.useMemo(
    () => operator.nutrition?.meals?.[viewingDateStr] || [],
    [operator.nutrition?.meals, viewingDateStr]
  );

  const viewingDayTotals = React.useMemo(() => viewingDayMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      protein: acc.protein + (m.protein || 0),
      carbs: acc.carbs + (m.carbs || 0),
      fat: acc.fat + (m.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  ), [viewingDayMeals]);

  const isViewingToday = viewingDateStr === getTodayStr();

  const shiftViewingDate = (days: number) => {
    const [y, m, d] = viewingDateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    setViewingDateStr(toLocalDateStr(dt));
  };

  const formatViewingDateLabel = () => {
    if (isViewingToday) return 'TODAY';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (viewingDateStr === toLocalDateStr(yesterday)) return 'YESTERDAY';
    const [y, m, d] = viewingDateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  };

  // Convert string goals to Goal objects with id/name
  const convertGoalsToObjects = (goals: string[]): Goal[] => {
    return goals.map((g, i) => ({ id: String(i), name: g }));
  };

  // Get today's meals from the nutrition.meals record
  const getTodayMeals = (): Meal[] => {
    const todayStr = getTodayStr();
    return operator.nutrition?.meals?.[todayStr] || [];
  };

  const [state, setState] = useState<LocalState>({
    profile: {
      name: operator.name,
      age: operator.profile?.age,
      height: operator.profile?.height,
      weight: operator.profile?.weight,
      bodyFat: operator.profile?.bodyFat,
      trainingAge: parseInt(operator.profile?.trainingAge) || 0,
      goals: convertGoalsToObjects(operator.profile?.goals || []),
      readinessScore: operator.profile?.readiness || 75,
      sleepQuality: operator.profile?.sleep || 7,
      stressLevel: operator.profile?.stress || 5,
      callsign: operator.callsign,
      pin: operator.pin,
    },
    nutrition: {
      calorieTarget: operator.nutrition?.targets?.calories || 2500,
      proteinTarget: operator.nutrition?.targets?.protein || 180,
      carbsTarget: operator.nutrition?.targets?.carbs || 300,
      fatTarget: operator.nutrition?.targets?.fat || 80,
      mealLogs: getTodayMeals(),
      mealName: '',
      mealCalories: '',
      mealProtein: '',
      mealCarbs: '',
      mealFat: '',
    },
    prBoard: operator.prs || [],
    injuries: operator.injuries || [],
    preferences: {
      trainingSplit: operator.preferences?.split || 'PPL',
      equipment: operator.preferences?.equipment || [],
      sessionDuration: operator.preferences?.sessionDuration || 60,
      daysPerWeek: operator.preferences?.daysPerWeek || 6,
      weakPoints: operator.preferences?.weakPoints || [],
      movementsToAvoid: operator.preferences?.avoidMovements || [],
      // Read trainingPath from intake first (the canonical source per
      // buildGunnyContext.ts:424) and fall back to preferences for
      // operators who completed intake before PR #82 — same fallback
      // pattern as buildGunnyContext.
      trainingPath: operator.intake?.trainingPath || operator.preferences?.trainingPath || 'gunny_pick',
      preferredWorkoutTime: operator.intake?.preferredWorkoutTime || 'morning',
    },
    intakeFields: {
      currentActivity: operator.intake?.currentActivity || 'sedentary',
      exerciseHistory: operator.intake?.exerciseHistory || 'none',
      movementScreenScore: operator.intake?.movementScreenScore || 5,
      healthConditions: operator.intake?.healthConditions || [],
      nutritionHabits: operator.intake?.nutritionHabits || 'fair',
      dietaryRestrictions: operator.intake?.dietaryRestrictions || [],
      supplements: operator.intake?.supplements || [],
    },
    newGoal: '',
    newEquipment: '',
    newWeakPoint: '',
    newMovementToAvoid: '',
  });

  // Re-sync the mirrored mealLogs slice whenever the operator prop changes.
  //
  // state.nutrition.mealLogs was originally seeded once at mount from
  // operator.nutrition.meals[today] and never refreshed. That stale-state
  // window meant: if the operator logged meals via Gunny chat (or in
  // another tab/device) while IntelCenter was mounted, the user could
  // click "Save Changes" on the form and the handleSave write would
  // overwrite operator.nutrition.meals[today] with the stale snapshot —
  // silently deleting recently-added meals.
  //
  // Only update when the canonical bucket actually differs from local state
  // (compare via JSON.stringify; meal arrays are tiny, max ~10 entries).
  // The meal-add handlers below also setState mealLogs immediately after
  // onUpdateOperator, so this effect is a no-op in the synchronous case;
  // it only fires for the cross-tab / cross-channel scenario.
  useEffect(() => {
    const todayStr = getTodayStr();
    const serverBucket = operator.nutrition?.meals?.[todayStr] || [];
    const stateBucket = state.nutrition.mealLogs;
    if (JSON.stringify(serverBucket) === JSON.stringify(stateBucket)) return;
    setState(prev => ({
      ...prev,
      nutrition: { ...prev.nutrition, mealLogs: serverBucket },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operator.nutrition?.meals]);

  const handleSave = useCallback(() => {
    // Convert Goal objects back to strings
    const goalsAsStrings = state.profile.goals.map((g) => g.name);

    // Get today's date string
    const todayStr = getTodayStr();

    // Build the updated operator with correct nested structure
    const updated: Operator = {
      ...operator,
      name: state.profile.name,
      callsign: state.profile.callsign,
      pin: state.profile.pin,
      profile: {
        ...operator.profile,
        age: state.profile.age,
        height: state.profile.height,
        weight: state.profile.weight,
        bodyFat: state.profile.bodyFat,
        trainingAge: String(state.profile.trainingAge),
        goals: goalsAsStrings,
        readiness: state.profile.readinessScore,
        sleep: state.profile.sleepQuality,
        stress: state.profile.stressLevel,
      },
      nutrition: {
        ...operator.nutrition,
        targets: {
          calories: state.nutrition.calorieTarget,
          protein: state.nutrition.proteinTarget,
          carbs: state.nutrition.carbsTarget,
          fat: state.nutrition.fatTarget,
        },
        meals: {
          ...operator.nutrition.meals,
          [todayStr]: state.nutrition.mealLogs,
        },
      },
      prs: state.prBoard,
      injuries: state.injuries,
      preferences: {
        ...operator.preferences,
        split: state.preferences.trainingSplit,
        equipment: state.preferences.equipment,
        sessionDuration: state.preferences.sessionDuration,
        daysPerWeek: state.preferences.daysPerWeek,
        weakPoints: state.preferences.weakPoints,
        avoidMovements: state.preferences.movementsToAvoid,
        // Mirror trainingPath into preferences too so the buildGunnyContext
        // fallback (intake → prefs) keeps working for legacy operators.
        // The intake write below is the canonical source.
        trainingPath: state.preferences.trainingPath,
      },
      // Write trainingPath + preferredWorkoutTime + the residual 7
      // intakeFields into operator.intake. Intake is the canonical
      // read source for these — buildGunnyContext.ts and intakeAudit.ts
      // both read directly from operator.intake.*. Without writing
      // them through, edits in IntelCenter would never propagate to
      // Gunny (the exact bug surfaced in PR #82 / #88).
      intake: {
        ...(operator.intake || {}),
        trainingPath: state.preferences.trainingPath,
        preferredWorkoutTime: state.preferences.preferredWorkoutTime,
        currentActivity: state.intakeFields.currentActivity,
        exerciseHistory: state.intakeFields.exerciseHistory,
        movementScreenScore: state.intakeFields.movementScreenScore,
        healthConditions: state.intakeFields.healthConditions,
        nutritionHabits: state.intakeFields.nutritionHabits,
        dietaryRestrictions: state.intakeFields.dietaryRestrictions,
        supplements: state.intakeFields.supplements,
      } as Operator['intake'],
    };
    onUpdateOperator(updated);
  }, [state, operator, onUpdateOperator]);

  // Profile handlers
  const handleProfileChange = (field: keyof LocalState['profile'], value: any) => {
    setState((prev) => ({
      ...prev,
      profile: { ...prev.profile, [field]: value },
    }));
  };

  const addGoal = () => {
    if (state.newGoal.trim()) {
      const newGoal: Goal = {
        id: `goal-${Date.now()}`,
        name: state.newGoal,
      };
      setState((prev) => ({
        ...prev,
        profile: { ...prev.profile, goals: [...prev.profile.goals, newGoal] },
        newGoal: '',
      }));
    }
  };

  const removeGoal = (goalId: string) => {
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        goals: prev.profile.goals.filter((g) => g.id !== goalId),
      },
    }));
  };

  // Nutrition handlers
  const handleNutritionChange = (field: keyof LocalState['nutrition'], value: any) => {
    setState((prev) => ({
      ...prev,
      nutrition: { ...prev.nutrition, [field]: value },
    }));
  };

  const addMeal = () => {
    if (
      state.nutrition.mealName.trim() &&
      state.nutrition.mealCalories &&
      state.nutrition.mealProtein &&
      state.nutrition.mealCarbs &&
      state.nutrition.mealFat
    ) {
      const now = new Date();
      const mealLog: Meal = {
        id: `meal-${Date.now()}`,
        name: state.nutrition.mealName,
        calories: parseInt(state.nutrition.mealCalories),
        protein: parseInt(state.nutrition.mealProtein),
        carbs: parseInt(state.nutrition.mealCarbs),
        fat: parseInt(state.nutrition.mealFat),
        time: now.toISOString(),
      };
      setState((prev) => ({
        ...prev,
        nutrition: {
          ...prev.nutrition,
          mealLogs: [...prev.nutrition.mealLogs, mealLog],
          mealName: '',
          mealCalories: '',
          mealProtein: '',
          mealCarbs: '',
          mealFat: '',
        },
      }));
    }
  };

  const removeMeal = (mealId: string) => {
    setState((prev) => ({
      ...prev,
      nutrition: {
        ...prev.nutrition,
        mealLogs: prev.nutrition.mealLogs.filter((m) => m.id !== mealId),
      },
    }));
  };

  // PR Board handlers
  const updatePR = (index: number, field: keyof PersonalRecord, value: any) => {
    setState((prev) => {
      const updated = [...prev.prBoard];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, prBoard: updated };
    });
  };

  const addPR = () => {
    const newPR: PersonalRecord = {
      id: `pr-${Date.now()}`,
      exercise: 'New Exercise',
      weight: 0,
      reps: 1,
      date: getLocalDateStr(),
      notes: '',
    };
    setState((prev) => ({
      ...prev,
      prBoard: [...prev.prBoard, newPR],
    }));
  };

  // Trigger PR notification when a PR is updated with real data
  const handlePRChange = (index: number, field: keyof PersonalRecord, value: any) => {
    updatePR(index, field, value);

    // Send notification if weight or exercise is being set to meaningful values
    if ((field === 'weight' || field === 'exercise') && value && Number(value) > 0 && value !== 'New Exercise') {
      // Use setTimeout to allow state to update before checking
      setTimeout(() => {
        const prefs = loadNotificationPrefs(operator.id);
        if (prefs.prAlerts) {
          const pr = state.prBoard[index];
          if (pr && pr.exercise && Number(pr.weight) > 0) {
            notifyPRAlert(operator.callsign, pr.exercise, Number(pr.weight));
          }
        }
      }, 100);
    }
  };

  const removePR = (prId: string) => {
    setState((prev) => ({
      ...prev,
      prBoard: prev.prBoard.filter((pr) => pr.id !== prId),
    }));
  };

  // Injuries handlers
  const updateInjury = (index: number, field: keyof Injury, value: any) => {
    setState((prev) => {
      const updated = [...prev.injuries];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, injuries: updated };
    });
  };

  const addRestriction = (injuryIndex: number) => {
    setState((prev) => {
      const updated = [...prev.injuries];
      updated[injuryIndex].restrictions = updated[injuryIndex].restrictions || [];
      updated[injuryIndex].restrictions!.push('New restriction');
      return { ...prev, injuries: updated };
    });
  };

  const removeRestriction = (injuryIndex: number, restrictionIndex: number) => {
    setState((prev) => {
      const updated = [...prev.injuries];
      updated[injuryIndex].restrictions = updated[injuryIndex].restrictions?.filter(
        (_, i) => i !== restrictionIndex
      );
      return { ...prev, injuries: updated };
    });
  };

  const addInjury = () => {
    const newInjury: Injury = {
      id: `injury-${Date.now()}`,
      name: 'New Injury',
      status: 'active',
      notes: '',
      restrictions: [],
    };
    setState((prev) => ({
      ...prev,
      injuries: [...prev.injuries, newInjury],
    }));
  };

  const removeInjury = (injuryId: string) => {
    setState((prev) => ({
      ...prev,
      injuries: prev.injuries.filter((i) => i.id !== injuryId),
    }));
  };

  // Preferences handlers
  const handlePreferencesChange = (field: keyof LocalState['preferences'], value: any) => {
    setState((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, [field]: value },
    }));
  };

  // intakeFields handler — mirrors handlePreferencesChange but writes
  // into the new intakeFields slice. Save flushes the slice into
  // operator.intake (canonical source for buildGunnyContext +
  // intakeAudit).
  const handleIntakeFieldChange = <K extends keyof LocalState['intakeFields']>(
    field: K,
    value: LocalState['intakeFields'][K],
  ) => {
    setState((prev) => ({
      ...prev,
      intakeFields: { ...prev.intakeFields, [field]: value },
    }));
  };

  // Toggle helper for the array-typed intakeFields (healthConditions,
  // dietaryRestrictions, supplements). Mirrors IntakeForm's
  // toggleArrayItem behavior: clicking 'None' clears the whole list,
  // clicking any other item toggles it in/out.
  const toggleIntakeArrayItem = (
    field: 'healthConditions' | 'dietaryRestrictions' | 'supplements',
    item: string,
  ) => {
    setState((prev) => {
      const arr = prev.intakeFields[field] || [];
      let next: string[];
      if (item === 'None') {
        next = arr.includes('None') ? [] : ['None'];
      } else {
        next = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr.filter((x) => x !== 'None'), item];
      }
      return { ...prev, intakeFields: { ...prev.intakeFields, [field]: next } };
    });
  };

  const addEquipment = () => {
    if (state.newEquipment.trim()) {
      setState((prev) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          equipment: [...prev.preferences.equipment, state.newEquipment],
        },
        newEquipment: '',
      }));
    }
  };

  const removeEquipment = (equipment: string) => {
    setState((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        equipment: prev.preferences.equipment.filter((e) => e !== equipment),
      },
    }));
  };

  const addWeakPoint = () => {
    if (state.newWeakPoint.trim()) {
      setState((prev) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          weakPoints: [...prev.preferences.weakPoints, state.newWeakPoint],
        },
        newWeakPoint: '',
      }));
    }
  };

  const removeWeakPoint = (weakPoint: string) => {
    setState((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        weakPoints: prev.preferences.weakPoints.filter((w) => w !== weakPoint),
      },
    }));
  };

  const addMovementToAvoid = () => {
    if (state.newMovementToAvoid.trim()) {
      setState((prev) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          movementsToAvoid: [...prev.preferences.movementsToAvoid, state.newMovementToAvoid],
        },
        newMovementToAvoid: '',
      }));
    }
  };

  const removeMovementToAvoid = (movement: string) => {
    setState((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        movementsToAvoid: prev.preferences.movementsToAvoid.filter((m) => m !== movement),
      },
    }));
  };

  // Calculate today's meal totals.
  //
  // state.nutrition.mealLogs is already sourced from operator.nutrition.meals[todayStr]
  // (see getTodayMeals()) so every entry here is structurally "today". The previous
  // new Date(meal.time).toDateString() check silently dropped every meal whose `time`
  // was stored as a bare time string ("11:00 AM", "11:00") — i.e. everything logged
  // via GunnyChat, Quick Food, Photo, and USDA paths. We now keep all entries from the
  // date-keyed bucket and only filter out meals whose full ISO timestamp demonstrably
  // belongs to a different day.
  const todayStr = getTodayStr();
  const todaysMeals = state.nutrition.mealLogs.filter((meal) => {
    if (!meal?.time) return true;
    const parsed = new Date(meal.time);
    if (isNaN(parsed.getTime())) return true; // legacy time-only string — still today
    // Compare LOCAL date keys (not UTC) so 11 AM PST April 14 doesn't get tagged as April 15.
    return toLocalDateStr(parsed) === todayStr;
  });

  const mealTotals = todaysMeals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Render functions
  const renderProfileTab = () => (
    // Two-column grid; .grid-2-md only kicks in on .ipad scope so this
    // stays single-column on mobile. We force 2-col here because Intel
    // already lives behind the desktop sidebar and the profile is the
    // canonical "form-only" screen the handoff README calls out.
    <div
      className="stack-4"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '14px',
      }}
    >
      {/* Billing affordance — top of profile so it's the first thing the
          operator sees when they're managing account-level stuff. Hides
          itself for non-owners (a trainer viewing a client shouldn't see
          the client's upgrade buttons). */}
      {currentUser && currentUser.id === operator.id && (
        <BillingPanel operator={operator} />
      )}

      {/* Callsign — full-width display block. Admins can edit inline;
          everyone else sees a read-only .t-display-xl (the canonical
          green-glow heading from the design system). The mono "name //
          role" sub-line replaces the old hand-rolled meta string. */}
      <div style={{ gridColumn: '1 / -1' }}>
        {isAdmin ? (
          <input
            type="text"
            value={state.profile.callsign}
            onChange={(e) => handleProfileChange('callsign', e.target.value)}
            className="ds-input"
            style={{
              fontFamily: 'var(--display)',
              fontSize: 26,
              fontWeight: 900,
              color: 'var(--green)',
              textTransform: 'uppercase',
              letterSpacing: 4,
              textShadow: '0 0 8px rgba(0,255,65,0.3)',
              padding: 8,
            }}
          />
        ) : (
          <h2 className="t-display-xl" style={{ color: 'var(--green)', textShadow: '0 0 12px rgba(0,255,65,0.35)', letterSpacing: 4, fontSize: 26 }}>
            {operator.callsign}
          </h2>
        )}
        <div className="t-mono-sm" style={{ marginTop: 6, color: 'var(--text-tertiary)' }}>
          {state.profile.name} // {operator.role.toUpperCase()}
        </div>
      </div>

      {/* Identity & vitals — every field uses the .field/.ds-input
          utility. handleProfileChange takes (field, value) and casts
          numbers itself; we keep that contract by parsing in the
          onChange where needed. */}
      <DsField
        label="Name"
        value={state.profile.name}
        onChange={(v) => handleProfileChange('name', v)}
        htmlId="intel-name"
      />

      {isAdmin && (
        <DsField
          label="Access PIN"
          value={state.profile.pin}
          onChange={(v) => handleProfileChange('pin', v)}
          maxLength={4}
          inputMode="numeric"
          pattern="[0-9]*"
          htmlId="intel-pin"
        />
      )}

      <DsField
        label="Age"
        type="number"
        value={state.profile.age}
        onChange={(v) => handleProfileChange('age', parseInt(v))}
        htmlId="intel-age"
      />

      <DsField
        label="Height"
        value={state.profile.height}
        onChange={(v) => handleProfileChange('height', v)}
        onBlur={(v) => handleProfileChange('height', formatHeightInput(v))}
        placeholder={`511 → 5'11"`}
        htmlId="intel-height"
      />

      <DsField
        label="Weight (lbs)"
        type="number"
        value={state.profile.weight}
        onChange={(v) => handleProfileChange('weight', parseInt(v))}
        htmlId="intel-weight"
      />

      <DsField
        label="Body Fat (%)"
        type="number"
        step={0.1}
        value={state.profile.bodyFat}
        onChange={(v) => handleProfileChange('bodyFat', parseFloat(v))}
        htmlId="intel-bf"
      />

      <DsField
        label="Training Age (years)"
        type="number"
        value={state.profile.trainingAge}
        onChange={(v) => handleProfileChange('trainingAge', parseInt(v))}
        htmlId="intel-training-age"
      />

      {/* Readiness / Sleep / Stress — wrapped in a single bracket card
          so the recovery-vitals trio reads as one HUD block per the
          handoff Daily-Brief pattern. */}
      <div className="ds-card bracket" style={{ gridColumn: '1 / -1' }}>
        <span className="bl" /><span className="br" />
        <span className="t-eyebrow" style={{ marginBottom: 12, display: 'inline-flex' }}>{t('intel.recovery_eyebrow')}</span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
          }}
        >
          <DsField
            label="Readiness (0-100)"
            type="number"
            min={0}
            max={100}
            value={state.profile.readinessScore}
            onChange={(v) => handleProfileChange('readinessScore', parseInt(v))}
            htmlId="intel-readiness"
          />
          <DsField
            label="Sleep (0-10)"
            type="number"
            min={0}
            max={10}
            value={state.profile.sleepQuality}
            onChange={(v) => handleProfileChange('sleepQuality', parseInt(v))}
            htmlId="intel-sleep"
          />
          <DsField
            label="Stress (0-10)"
            type="number"
            min={0}
            max={10}
            value={state.profile.stressLevel}
            onChange={(v) => handleProfileChange('stressLevel', parseInt(v))}
            htmlId="intel-stress"
          />
        </div>
      </div>

      {/* Goals — chip group + add input. Per the handoff, equipment /
          tag style selectors render as .chip.green with a .chip-x close
          button. The add input is the canonical .ds-input + .btn so
          it matches every other form-add affordance in the system. */}
      <div className="field" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
        <label htmlFor="intel-new-goal">{t('intel.goals')}</label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {state.profile.goals.length === 0 && (
            <span className="t-mono-sm" style={{ color: 'var(--text-dim)' }}>
              No goals set yet. Add one below.
            </span>
          )}
          {state.profile.goals.map((goal) => (
            <span key={goal.id} className="chip green">
              <span>{goal.name}</span>
              <button
                onClick={() => removeGoal(goal.id)}
                className="chip-x"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--danger)',
                  padding: 0,
                  cursor: 'pointer',
                }}
                aria-label={`Remove goal ${goal.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="intel-new-goal"
            type="text"
            placeholder={t('intel.add_goal_placeholder')}
            value={state.newGoal}
            onChange={(e) => setState((prev) => ({ ...prev, newGoal: e.target.value }))}
            onKeyPress={(e) => {
              if (e.key === 'Enter') addGoal();
            }}
            className="ds-input"
            style={{ flex: 1 }}
          />
          <button onClick={addGoal} className="btn btn-primary btn-sm" type="button">
            + Add
          </button>
        </div>
      </div>

      {/* ─── INTAKE BACKGROUND ─────────────────────────────────────────
          Captured during onboarding but no UI surface before this.
          Surfacing them so the operator can verify/correct what Gunny
          uses to calibrate programming + recovery + safety advice.
          Each field writes to operator.intake.* on save (the canonical
          source read by buildGunnyContext.ts).
          - currentActivity: drives non-training NEAT estimate + recovery
          - exerciseHistory: drives starting-load + program complexity
          - movementScreenScore: drives exercise selection + mobility cues
          - healthConditions: hard contraindication filter
       */}
      <div className="ds-card bracket" style={{ gridColumn: '1 / -1', marginTop: 8 }}>
        <span className="bl" /><span className="br" />
        <span className="t-eyebrow" style={{ marginBottom: 12, display: 'inline-flex' }}>
          Intake Background
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {/* Daily Activity Level */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="intel-activity">Daily Activity Level</label>
            <select
              id="intel-activity"
              value={state.intakeFields.currentActivity}
              onChange={(e) => handleIntakeFieldChange('currentActivity', e.target.value)}
              className="ds-input"
            >
              <option value="sedentary">Sedentary — desk job, minimal movement</option>
              <option value="lightly_active">Lightly Active — some daily walking</option>
              <option value="active">Active — regular movement, on feet often</option>
              <option value="very_active">Very Active — physical job or daily training</option>
              <option value="athlete">Competitive Athlete — 5+ days, sport-specific</option>
            </select>
          </div>

          {/* Exercise History */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="intel-exercise-history">Exercise History</label>
            <select
              id="intel-exercise-history"
              value={state.intakeFields.exerciseHistory}
              onChange={(e) => handleIntakeFieldChange('exerciseHistory', e.target.value)}
              className="ds-input"
            >
              <option value="none">No Training Experience</option>
              <option value="sporadic">Sporadic — on and off, no consistency</option>
              <option value="consistent_beginner">Consistent Beginner — regular but learning</option>
              <option value="consistent_intermediate">Consistent Intermediate — solid routine</option>
              <option value="advanced_athlete">Advanced / Athlete — competitive or years of dedicated training</option>
            </select>
          </div>

          {/* Movement Screen Score (1-10) */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="intel-mobility">Mobility / Movement Quality (1-10)</label>
            <input
              id="intel-mobility"
              type="number"
              min={1}
              max={10}
              value={state.intakeFields.movementScreenScore}
              onChange={(e) => handleIntakeFieldChange('movementScreenScore', parseInt(e.target.value) || 5)}
              className="ds-input"
            />
          </div>
        </div>

        {/* Health Conditions — chip toggle. Same UX as the Equipment
            Arsenal grid in PREFERENCES so operators get a consistent
            multi-select pattern. 'None' clears the list. */}
        <div className="field" style={{ marginTop: 16, marginBottom: 0 }}>
          <label>{t('intel.tracking_tiers.health_conditions_label')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {/* DB-key array stays English (canonical persistence keys) —
                CONDITION_LABEL_KEYS map handles the visible label
                translation. Hybrid bug surfaced in May 2026 audit:
                without the labelKey indirection, an ES operator
                toggling "Presión Alta" would silently store Spanish
                text into operator.intake.healthConditions, breaking
                downstream injury / contraindication lookups that key
                off the English values. The same labelKey map exists
                in IntakeForm.tsx — kept inline here too rather than
                exporting to avoid coupling the form's internal state. */}
            {([
              ['High Blood Pressure', 'intake.health.cond.high_bp'],
              ['Diabetes', 'intake.health.cond.diabetes'],
              ['Heart Condition', 'intake.health.cond.heart'],
              ['Asthma', 'intake.health.cond.asthma'],
              ['Joint Pain', 'intake.health.cond.joint_pain'],
              ['Back Problems', 'intake.health.cond.back'],
              ['Knee Issues', 'intake.health.cond.knee'],
              ['Shoulder Issues', 'intake.health.cond.shoulder'],
              ['Previous Surgery', 'intake.health.cond.surgery'],
              ['Pregnancy/Postpartum', 'intake.health.cond.pregnancy'],
              ['None', 'intake.health.cond.none'],
            ] as const).map(([c, labelKey]) => {
              const active = (state.intakeFields.healthConditions || []).includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleIntakeArrayItem('healthConditions', c)}
                  style={{
                    padding: '6px 10px',
                    fontFamily: 'Chakra Petch, sans-serif',
                    fontSize: 12,
                    background: active ? 'rgba(0,255,65,0.12)' : 'rgba(0,255,65,0.02)',
                    border: `1px solid ${active ? 'rgba(0,255,65,0.55)' : 'rgba(0,255,65,0.15)'}`,
                    color: active ? '#00ff41' : '#888',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t(labelKey) || c}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Intake assessment — full-width ghost CTA. Always-on in the
          bottom of the profile so operators can re-run their intake
          without hunting through tabs. The button uses .btn.btn-ghost
          so it sits visually subordinate to the Save Changes primary
          in the screen header. */}
      <div
        style={{
          gridColumn: '1 / -1',
          marginTop: 8,
          paddingTop: 16,
          borderTop: '1px solid var(--border-green-soft)',
        }}
      >
        <button
          type="button"
          onClick={() => onRequestIntake?.()}
          className="btn btn-ghost btn-block"
        >
          <span aria-hidden style={{ fontSize: 16 }}>↻</span>
          {(operator.intake?.completed || operator.profile?.intakeCompleted)
            ? 'Update Fitness Assessment'
            : 'Complete Fitness Assessment'}
        </button>
        {(operator.intake?.completedDate || operator.profile?.intakeCompletedDate) && (
          <div
            className="t-mono-sm"
            style={{ textAlign: 'center', marginTop: 6, color: 'var(--text-dim)' }}
          >
            Last completed:{' '}
            {new Date(operator.intake?.completedDate || operator.profile?.intakeCompletedDate).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );

  // ═══ QUICK NUTRITION CHAT LOG ═══
  // FOOD_DB imported from @/data/foods (200+ foods with serving sizes)

  const [quickFoodInput, setQuickFoodInput] = useState('');
  const [quickFoodResult, setQuickFoodResult] = useState<{ name: string; calories: number; protein: number; carbs: number; fat: number; accuracy?: string } | null>(null);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [photoResult, setPhotoResult] = useState<{ items: Array<{ name: string; portion: string; calories: number; protein: number; carbs: number; fat: number }>; totals: { calories: number; protein: number; carbs: number; fat: number }; confidence: string; notes: string } | null>(null);
  const [usdaSearch, setUsdaSearch] = useState('');
  const [usdaResults, setUsdaResults] = useState<Array<{ id: number; name: string; brand: string | null; servingSize: number; servingUnit: string; macros: { calories: number; protein: number; fat: number; carbs: number } }>>([]);
  const [usdaSearching, setUsdaSearching] = useState(false);
  const [nutritionLogMode, setNutritionLogMode] = useState<'quick' | 'photo' | 'search' | 'manual'>('quick');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const parseQuickFood = (input: string) => {
    const lower = input.toLowerCase();
    let foodName = '';
    let macros: { calories: number; protein: number; carbs: number; fat: number } | null = null;
    for (const [key, m] of Object.entries(FOOD_DB)) {
      if (lower.includes(key)) {
        if (!foodName || key.length > foodName.length) { foodName = key; macros = m; }
      }
    }
    if (!macros) return null;
    // Parse multiplier
    let multiplier = 1;
    const numMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:x|servings?|pieces?|slices?)?/);
    if (numMatch) multiplier = parseFloat(numMatch[1]);
    if (lower.includes('double') || lower.includes('2x')) multiplier = 2;
    if (lower.includes('half')) multiplier = 0.5;
    if (lower.includes('large') || lower.includes('big')) multiplier *= 1.5;
    if (lower.includes('small') || lower.includes('little')) multiplier *= 0.7;
    return {
      name: input,
      calories: Math.round(macros.calories * multiplier),
      protein: Math.round(macros.protein * multiplier),
      carbs: Math.round(macros.carbs * multiplier),
      fat: Math.round(macros.fat * multiplier),
    };
  };

  const handleQuickFoodLog = () => {
    if (!quickFoodInput.trim()) return;
    const result = parseQuickFood(quickFoodInput);
    if (result) {
      setQuickFoodResult(result);
      // Auto-populate the manual fields
      setState(prev => ({
        ...prev,
        nutrition: {
          ...prev.nutrition,
          mealName: result.name,
          mealCalories: String(result.calories),
          mealProtein: String(result.protein),
          mealCarbs: String(result.carbs),
          mealFat: String(result.fat),
        },
      }));
    } else {
      setQuickFoodResult(null);
    }
  };

  const handleQuickFoodAdd = () => {
    if (!quickFoodResult) return;
    const newMeal: Meal = {
      id: `meal-${Date.now()}`,
      name: quickFoodResult.name,
      calories: quickFoodResult.calories,
      protein: quickFoodResult.protein,
      carbs: quickFoodResult.carbs,
      fat: quickFoodResult.fat,
      time: new Date().toISOString(),
    };
    const todayStr = getTodayStr();
    const updatedMeals = [...(operator.nutrition?.meals?.[todayStr] || []), newMeal];
    const updated: Operator = {
      ...operator,
      nutrition: {
        ...operator.nutrition,
        meals: { ...operator.nutrition.meals, [todayStr]: updatedMeals },
      },
    };
    onUpdateOperator(updated);
    setState(prev => ({
      ...prev,
      nutrition: { ...prev.nutrition, mealLogs: updatedMeals, mealName: '', mealCalories: '', mealProtein: '', mealCarbs: '', mealFat: '' },
    }));
    setQuickFoodInput('');
    setQuickFoodResult(null);
  };

  // Photo analysis handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Hard cap at 25 MB raw — beyond that, decoding into a canvas can
    // OOM mobile Safari. Otherwise compressImageForVision resizes +
    // recompresses to fit Anthropic's 5 MB base64-payload limit.
    if (file.size > 25 * 1024 * 1024) {
      alert('Image is too large (max 25 MB raw). Try a smaller photo.');
      e.target.value = '';
      return;
    }

    setPhotoAnalyzing(true);
    setPhotoResult(null);

    try {
      const compressed = await compressImageForVision(file);
      // compressImageForVision always returns a JPEG data URL when it
      // re-encodes; for tiny / SVG passthroughs it preserves the
      // original mime. Either way, parse the data URL to feed the
      // analyze-photo endpoint with a matching mimeType.
      const dataUrlMatch = compressed.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      const base64 = dataUrlMatch ? dataUrlMatch[2] : compressed.split(',')[1];
      const mimeType = dataUrlMatch ? dataUrlMatch[1] : (file.type || 'image/jpeg');
      const res = await fetch('/api/nutrition/analyze-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ image: base64, mimeType }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setPhotoResult(data.data);
      } else {
        alert('Could not analyze photo. Try a clearer image.');
      }
      setPhotoAnalyzing(false);
    } catch (err) {
      console.error('[IntelCenter:analyzePhoto] Failed:', err);
      setPhotoAnalyzing(false);
      alert('Photo analysis failed.');
    }

    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  const handlePhotoResultLog = () => {
    if (!photoResult) return;
    const newMeal: Meal = {
      id: `meal-${Date.now()}`,
      name: photoResult.items.map(i => i.name).join(' + '),
      calories: photoResult.totals.calories,
      protein: photoResult.totals.protein,
      carbs: photoResult.totals.carbs,
      fat: photoResult.totals.fat,
      time: new Date().toISOString(),
    };
    const todayStr = getTodayStr();
    const updatedMeals = [...(operator.nutrition?.meals?.[todayStr] || []), newMeal];
    const updated: Operator = {
      ...operator,
      nutrition: {
        ...operator.nutrition,
        meals: { ...operator.nutrition.meals, [todayStr]: updatedMeals },
      },
    };
    onUpdateOperator(updated);
    setState(prev => ({
      ...prev,
      nutrition: { ...prev.nutrition, mealLogs: updatedMeals, mealName: '', mealCalories: '', mealProtein: '', mealCarbs: '', mealFat: '' },
    }));
    setPhotoResult(null);
  };

  // USDA food search handler
  const handleUsdaSearch = async () => {
    if (!usdaSearch.trim()) return;
    setUsdaSearching(true);
    try {
      const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(usdaSearch)}&limit=8`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (data.success && data.foods) {
        setUsdaResults(data.foods);
      }
    } catch (err) {
      console.error('[IntelCenter:handleUsdaSearch] Failed:', err);
      setUsdaResults([]);
    }
    setUsdaSearching(false);
  };

  const handleUsdaFoodLog = (food: typeof usdaResults[0]) => {
    const newMeal: Meal = {
      id: `meal-${Date.now()}`,
      name: food.name,
      calories: food.macros.calories,
      protein: food.macros.protein,
      carbs: food.macros.carbs,
      fat: food.macros.fat,
      time: new Date().toISOString(),
    };
    const todayStr = getTodayStr();
    const updatedMeals = [...(operator.nutrition?.meals?.[todayStr] || []), newMeal];
    const updated: Operator = {
      ...operator,
      nutrition: {
        ...operator.nutrition,
        meals: { ...operator.nutrition.meals, [todayStr]: updatedMeals },
      },
    };
    onUpdateOperator(updated);
    setState(prev => ({
      ...prev,
      nutrition: { ...prev.nutrition, mealLogs: updatedMeals, mealName: '', mealCalories: '', mealProtein: '', mealCarbs: '', mealFat: '' },
    }));
    setUsdaResults([]);
    setUsdaSearch('');
  };

  const renderNutritionTab = () => (
    <div>
      {/* BATTLE PLAN — Nutrition Targets */}
      {operator.sitrep && operator.sitrep.generatedDate && (
        <BattlePlanRef sitrep={operator.sitrep} focus="nutrition" compact={true} />
      )}

      {/* DAILY BRIEF — Today's Nutrition */}
      {operator.dailyBrief && operator.dailyBrief.date && (
        <DailyBriefRef brief={operator.dailyBrief} focus="nutrition" compact={true} />
      )}

      {/* Accuracy tier key — bracket card listing the 4 tracking
          modes (Manual / USDA / Quick / Photo) with their accuracy
          bands. Each tier-row uses a tier-tinted background +
          border via inline override since tier colors are dynamic
          and outside the canonical green/amber/danger palette. */}
      <div className="ds-card bracket" style={{ marginBottom: 16, padding: 12 }}>
        <span className="bl" /><span className="br" />
        <span className="t-eyebrow" style={{ marginBottom: 8, display: 'inline-flex' }}>
          {t('intel.tracking_tiers.heading')}
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {/* Map iteration variable renamed `t` → `tr` to avoid shadowing
              the i18n `t` translator now that label / desc resolve via
              t(). DB-key strings (`labelKey`, `descKey`) keep the row's
              identity stable across language switches. */}
          {[
            { tier: 1, labelKey: 'intel.tracking_tiers.tier1.label', descKey: 'intel.tracking_tiers.tier1.desc', color: '#00ff41', icon: '⚡', accuracy: '±1-3%' },
            { tier: 2, labelKey: 'intel.tracking_tiers.tier2.label', descKey: 'intel.tracking_tiers.tier2.desc', color: '#4ade80', icon: '🔬', accuracy: '±5-10%' },
            { tier: 3, labelKey: 'intel.tracking_tiers.tier3.label', descKey: 'intel.tracking_tiers.tier3.desc', color: '#facc15', icon: '💬', accuracy: '±15-25%' },
            { tier: 4, labelKey: 'intel.tracking_tiers.tier4.label', descKey: 'intel.tracking_tiers.tier4.desc', color: '#ff6b35', icon: '📸', accuracy: '±20-40%' },
          ].map(tr => (
            <div
              key={tr.tier}
              style={{
                padding: '8px 10px',
                background: `${tr.color}08`,
                border: `1px solid ${tr.color}30`,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>{tr.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-display-m" style={{ color: tr.color, fontSize: 9, letterSpacing: 1 }}>
                  TIER {tr.tier}: {t(tr.labelKey)}
                </div>
                <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {t(tr.descKey)}
                </div>
              </div>
              <span className="t-mono-data" style={{ color: tr.color, fontWeight: 700, fontSize: 10 }}>
                {tr.accuracy}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Date navigator — prev / day-label / next. Center cluster
          shows the prominent .t-display-m label + small mono ISO
          date below. Buttons use .btn.btn-ghost.btn-sm so they
          read as "tap to navigate" without competing with primary
          actions further down the screen. */}
      <div
        className="row-between"
        style={{
          gap: 8,
          padding: '10px 12px',
          marginBottom: 12,
          background: 'rgba(0,255,65,0.03)',
          border: '1px solid var(--border-green-soft)',
        }}
      >
        <button
          type="button"
          onClick={() => shiftViewingDate(-1)}
          aria-label={t('intel.prev_day_aria')}
          className="btn btn-ghost btn-sm"
        >
          ◀ Prev
        </button>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <div className="t-display-m" style={{ color: 'var(--green)', fontSize: 13, letterSpacing: 2 }}>
            {formatViewingDateLabel()}
          </div>
          <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
            {viewingDateStr}
          </div>
        </div>

        <button
          type="button"
          onClick={() => shiftViewingDate(1)}
          disabled={isViewingToday}
          aria-label={t('intel.next_day_aria')}
          className="btn btn-ghost btn-sm"
        >
          Next ▶
        </button>
      </div>

      {/* Jump-to-today — only visible when viewing a past day.
          Amber tone matches the canonical "warm/in-progress"
          treatment used elsewhere for non-blocking attention CTAs. */}
      {!isViewingToday && (
        <button
          type="button"
          onClick={() => setViewingDateStr(getTodayStr())}
          className="btn btn-amber btn-block btn-sm"
          style={{ marginBottom: 12 }}
        >
          ↻ Jump to Today
        </button>
      )}

      {/* Log mode selector — only when viewing today. Four-mode
          toggle (Quick / Photo / USDA / Manual) where each mode
          tracks the per-tier color (yellow / orange / light-green
          / green). The active button shows the tier color via
          inline override; the rest stay as the default segmented
          chrome. */}
      {isViewingToday && (<>
      <div className="segmented" style={{ marginBottom: 16, gap: 6 }}>
        {([
          { id: 'quick' as const, label: '💬 Quick', color: '#facc15' },
          { id: 'photo' as const, label: '📸 Photo', color: '#ff6b35' },
          { id: 'search' as const, label: '🔬 USDA', color: '#4ade80' },
          { id: 'manual' as const, label: '⚡ Manual', color: '#00ff41' },
        ]).map(m => {
          const isActive = nutritionLogMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setNutritionLogMode(m.id)}
              className={`seg ${isActive ? 'active' : ''}`}
              style={{
                flex: 1,
                padding: '8px 4px',
                fontSize: 10,
                ...(isActive
                  ? {
                      color: m.color,
                      borderColor: m.color,
                      background: `${m.color}20`,
                    }
                  : {}),
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* QUICK LOG MODE — yellow tier-3 (AI text parsing). Section
          uses a tinted bracket card; tier badge is a .chip with
          inline color override since the tier colors are outside
          the canonical green/amber/danger palette. */}
      {nutritionLogMode === 'quick' && (
        <div
          className="ds-card bracket"
          style={{
            marginBottom: 24,
            padding: 16,
            background: 'rgba(250, 204, 21, 0.03)',
            borderColor: 'rgba(250, 204, 21, 0.3)',
          }}
        >
          <span className="bl" /><span className="br" />
          <div className="row-between" style={{ marginBottom: 8 }}>
            <h3 className="t-display-m" style={{ color: '#facc15', margin: 0, fontSize: 12 }}>
              Quick Log
            </h3>
            <span
              className="chip"
              style={{ color: '#facc15', borderColor: 'rgba(250,204,21,0.3)', fontSize: 9 }}
            >
              TIER 3 · ±15-25%
            </span>
          </div>
          <div className="t-mono-sm" style={{ marginBottom: 8, color: 'var(--text-tertiary)' }}>
            Describe what you ate — e.g. &ldquo;2 eggs and toast&rdquo; or &ldquo;chicken breast with rice&rdquo;
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={quickFoodInput}
              onChange={e => { setQuickFoodInput(e.target.value); setQuickFoodResult(null); }}
              onKeyDown={e => { if (e.key === 'Enter') handleQuickFoodLog(); }}
              placeholder={t('intel.meal_freeform_placeholder')}
              className="ds-input"
              style={{ flex: 1, borderColor: 'rgba(250, 204, 21, 0.3)', fontFamily: 'var(--mono)' }}
            />
            <button
              type="button"
              onClick={handleQuickFoodLog}
              className="btn btn-sm"
              // Tier-3 yellow filled button — bespoke since none of
              // the canonical .btn variants cover yellow. Uses
              // var(--display) + token-driven sizing.
              style={{
                background: '#facc15',
                color: '#000',
                border: 'none',
                fontFamily: 'var(--display)',
                fontWeight: 700,
                letterSpacing: 1.6,
                padding: '6px 14px',
              }}
            >
              Scan
            </button>
          </div>
          {quickFoodResult && (
            <div
              className="ds-card"
              style={{ marginTop: 12, padding: 12, borderColor: 'var(--border-green)' }}
            >
              <div className="t-display-m" style={{ color: 'var(--green)', fontSize: 13, marginBottom: 8 }}>
                {quickFoodResult.name}
              </div>
              <div style={{ display: 'flex', gap: 16 }} className="t-mono-data">
                <span style={{ color: 'var(--warn)' }}>{quickFoodResult.calories} cal</span>
                <span style={{ color: 'var(--green)' }}>{quickFoodResult.protein}g P</span>
                <span style={{ color: '#4ade80' }}>{quickFoodResult.carbs}g C</span>
                <span style={{ color: '#f97316' }}>{quickFoodResult.fat}g F</span>
              </div>
              <button
                type="button"
                onClick={handleQuickFoodAdd}
                className="btn btn-primary btn-sm"
                style={{ marginTop: 8 }}
              >
                Log Meal
              </button>
            </div>
          )}
        </div>
      )}

      {/* PHOTO SNAP MODE — orange tier-4 (AI vision). */}
      {nutritionLogMode === 'photo' && (
        <div
          className="ds-card bracket"
          style={{
            marginBottom: 24,
            padding: 16,
            background: 'rgba(255, 107, 53, 0.03)',
            borderColor: 'rgba(255, 107, 53, 0.3)',
          }}
        >
          <span className="bl" /><span className="br" />
          <div className="row-between" style={{ marginBottom: 8 }}>
            <h3 className="t-display-m" style={{ color: '#ff6b35', margin: 0, fontSize: 12 }}>
              Photo Snap
            </h3>
            <span
              className="chip"
              style={{ color: '#ff6b35', borderColor: 'rgba(255,107,53,0.3)', fontSize: 9 }}
            >
              TIER 4 · ±20-40%
            </span>
          </div>
          <div className="t-mono-sm" style={{ marginBottom: 12, color: 'var(--text-tertiary)' }}>
            Snap a photo of your plate. AI vision analyzes portion sizes and estimates macros. Best for quick ballpark tracking.
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: 'none' }} />
          <button onClick={() => photoInputRef.current?.click()} disabled={photoAnalyzing} style={{
            width: '100%', padding: '16px', backgroundColor: photoAnalyzing ? '#333' : 'rgba(255, 107, 53, 0.1)',
            border: `2px dashed ${photoAnalyzing ? '#555' : '#ff6b35'}`, borderRadius: 8, cursor: photoAnalyzing ? 'default' : 'pointer',
            fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: photoAnalyzing ? '#888' : '#ff6b35', letterSpacing: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s',
          }}>
            {photoAnalyzing ? (
              <>ANALYZING...</>
            ) : (
              <>📸 TAP TO SNAP OR UPLOAD PHOTO</>
            )}
          </button>

          {photoResult && (
            // Detection result subcard — sits inside the parent
            // PHOTO mode card, so we use a plain .ds-card with the
            // orange tier-4 border to match the parent tone.
            <div
              className="ds-card"
              style={{
                marginTop: 12,
                padding: 12,
                borderColor: 'rgba(255, 107, 53, 0.3)',
              }}
            >
              <div className="t-eyebrow" style={{ marginBottom: 8 }}>
                Detected Items ({photoResult.confidence.toUpperCase()} confidence)
              </div>
              {photoResult.items.map((item, i) => (
                <div
                  key={i}
                  className="row-between"
                  style={{ padding: '6px 0', borderBottom: '1px solid var(--border-green-soft)' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span className="t-mono-data" style={{ fontSize: 12 }}>{item.name}</span>
                    <span className="t-mono-sm" style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
                      {item.portion}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }} className="t-mono-data">
                    <span style={{ color: 'var(--warn)' }}>{item.calories}</span>
                    <span style={{ color: 'var(--green)' }}>{item.protein}P</span>
                    <span style={{ color: '#4ade80' }}>{item.carbs}C</span>
                    <span style={{ color: '#f97316' }}>{item.fat}F</span>
                  </div>
                </div>
              ))}
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 0',
                  borderTop: '1px solid rgba(255, 107, 53, 0.2)',
                }}
              >
                <div className="row-between">
                  <span className="t-display-m" style={{ color: '#ff6b35', fontSize: 12 }}>
                    Totals
                  </span>
                  <div style={{ display: 'flex', gap: 12 }} className="t-mono-data">
                    <span style={{ color: 'var(--warn)' }}>{photoResult.totals.calories} cal</span>
                    <span style={{ color: 'var(--green)' }}>{photoResult.totals.protein}g P</span>
                    <span style={{ color: '#4ade80' }}>{photoResult.totals.carbs}g C</span>
                    <span style={{ color: '#f97316' }}>{photoResult.totals.fat}g F</span>
                  </div>
                </div>
              </div>
              {photoResult.notes && (
                <div
                  className="t-mono-sm"
                  style={{ marginTop: 6, color: 'var(--text-tertiary)', fontStyle: 'italic' }}
                >
                  {photoResult.notes}
                </div>
              )}
              <button
                type="button"
                onClick={handlePhotoResultLog}
                className="btn btn-primary btn-block btn-sm"
                style={{ marginTop: 10 }}
              >
                Log This Meal
              </button>
            </div>
          )}
        </div>
      )}

      {/* USDA SEARCH MODE — light-green tier-2 (verified database). */}
      {nutritionLogMode === 'search' && (
        <div
          className="ds-card bracket"
          style={{
            marginBottom: 24,
            padding: 16,
            background: 'rgba(74, 222, 128, 0.03)',
            borderColor: 'rgba(74, 222, 128, 0.3)',
          }}
        >
          <span className="bl" /><span className="br" />
          <div className="row-between" style={{ marginBottom: 8 }}>
            <h3 className="t-display-m" style={{ color: '#4ade80', margin: 0, fontSize: 12 }}>
              USDA Database
            </h3>
            <span
              className="chip"
              style={{ color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)', fontSize: 9 }}
            >
              TIER 2 · ±5-10%
            </span>
          </div>
          <div className="t-mono-sm" style={{ marginBottom: 8, color: 'var(--text-tertiary)' }}>
            Search 380K+ FDA-verified foods. Macros per 100g standard serving.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={usdaSearch}
              onChange={e => setUsdaSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleUsdaSearch(); }}
              placeholder={t('intel.food_search_placeholder')}
              className="ds-input"
              style={{ flex: 1, borderColor: 'rgba(74, 222, 128, 0.3)', fontFamily: 'var(--mono)' }}
            />
            <button
              type="button"
              onClick={handleUsdaSearch}
              disabled={usdaSearching}
              className="btn btn-sm"
              style={{
                background: usdaSearching ? '#333' : '#4ade80',
                color: '#000',
                border: 'none',
                fontFamily: 'var(--display)',
                fontWeight: 700,
                letterSpacing: 1.6,
                padding: '6px 14px',
              }}
            >
              {usdaSearching ? '…' : 'Search'}
            </button>
          </div>
          {usdaResults.length > 0 && (
            // Result list — capped at 300px height with scroll. Each
            // row is a tap-to-log .ds-card with hover border tint
            // matching the tier-2 light-green accent.
            <div style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto' }}>
              {usdaResults.map(food => (
                <div
                  key={food.id}
                  className="ds-card"
                  onClick={() => handleUsdaFoodLog(food)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74, 222, 128, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-green-soft)';
                  }}
                  style={{
                    padding: '10px 12px',
                    marginBottom: 6,
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div
                    className="t-mono-data"
                    style={{
                      fontSize: 12,
                      marginBottom: 4,
                      textTransform: 'capitalize',
                    }}
                  >
                    {food.name.toLowerCase()}
                    {food.brand && (
                      <span
                        className="t-mono-sm"
                        style={{ color: 'var(--text-dim)', marginLeft: 6 }}
                      >
                        ({food.brand})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12 }} className="t-mono-data">
                    <span style={{ color: 'var(--warn)' }}>{food.macros.calories} cal</span>
                    <span style={{ color: 'var(--green)' }}>{food.macros.protein}g P</span>
                    <span style={{ color: '#4ade80' }}>{food.macros.carbs}g C</span>
                    <span style={{ color: '#f97316' }}>{food.macros.fat}g F</span>
                    <span style={{ color: 'var(--text-dim)' }}>
                      per {food.servingSize}{food.servingUnit}
                    </span>
                  </div>
                </div>
              ))}
              <div
                className="t-mono-sm"
                style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: 4 }}
              >
                Tap a food to log it. Data: USDA FoodData Central
              </div>
            </div>
          )}
        </div>
      )}

      {/* MANUAL ENTRY MODE — green tier-1 (canonical accent).
          Highest accuracy. Body just points users to the meal log
          section below. */}
      {nutritionLogMode === 'manual' && (
        <div
          className="ds-card bracket elevated"
          style={{ marginBottom: 24, padding: 16 }}
        >
          <span className="bl" /><span className="br" />
          <div className="row-between" style={{ marginBottom: 8 }}>
            <h3 className="t-display-m" style={{ color: 'var(--green)', margin: 0, fontSize: 12 }}>
              Manual Entry
            </h3>
            <span className="chip green" style={{ fontSize: 9 }}>
              TIER 1 · ±1-3%
            </span>
          </div>
          <div className="t-mono-sm" style={{ marginBottom: 12, color: 'var(--text-tertiary)' }}>
            Weigh your food and enter exact macros. Highest accuracy for serious tracking.
          </div>
          <div className="t-mono-sm" style={{ color: 'var(--text-dim)', marginBottom: 8 }}>
            Use the meal log section below to enter exact values manually.
          </div>
        </div>
      )}
      </>)}

      {/* Macro Targets — bracket card with .t-eyebrow header. The
          four inline inputs below keep their existing focus-state
          ternaries since each binds to a distinct state slice and
          inlining a helper would reduce clarity here. */}
      <div className="ds-card bracket" style={{ marginBottom: 32, padding: 16 }}>
        <span className="bl" /><span className="br" />
        <span className="t-eyebrow" style={{ marginBottom: 16, display: 'inline-flex' }}>
          Macro Targets
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', minWidth: 0 }}>
          <div>
            <label
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '15px',
                color: '#888',
                display: 'block',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Calories
            </label>
            <div style={{ display: 'flex', gap: '4px', minWidth: 0 }}>
              <input
                type="number"
                value={state.nutrition.calorieTarget}
                onChange={(e) =>
                  handleNutritionChange('calorieTarget', parseInt(e.target.value))
                }
                style={{
                  flex: 1,
                  padding: '8px',
                  fontFamily: 'Chakra Petch, sans-serif',
                  fontSize: '15px',
                  backgroundColor: 'rgba(0,255,65,0.02)',
                  border: '1px solid rgba(0,255,65,0.06)',
                  color: '#ddd',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(0,255,65,0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0,255,65,0.06)';
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '15px',
                color: '#888',
                display: 'block',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Protein (g)
            </label>
            <div style={{ display: 'flex', gap: '4px', minWidth: 0 }}>
              <input
                type="number"
                value={state.nutrition.proteinTarget}
                onChange={(e) =>
                  handleNutritionChange('proteinTarget', parseInt(e.target.value))
                }
                style={{
                  flex: 1,
                  padding: '8px',
                  fontFamily: 'Chakra Petch, sans-serif',
                  fontSize: '15px',
                  backgroundColor: 'rgba(0,255,65,0.02)',
                  border: '1px solid rgba(0,255,65,0.06)',
                  color: '#ddd',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(0,255,65,0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0,255,65,0.06)';
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '15px',
                color: '#888',
                display: 'block',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Carbs (g)
            </label>
            <div style={{ display: 'flex', gap: '4px', minWidth: 0 }}>
              <input
                type="number"
                value={state.nutrition.carbsTarget}
                onChange={(e) =>
                  handleNutritionChange('carbsTarget', parseInt(e.target.value))
                }
                style={{
                  flex: 1,
                  padding: '8px',
                  fontFamily: 'Chakra Petch, sans-serif',
                  fontSize: '15px',
                  backgroundColor: 'rgba(0,255,65,0.02)',
                  border: '1px solid rgba(0,255,65,0.06)',
                  color: '#ddd',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(0,255,65,0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0,255,65,0.06)';
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '15px',
                color: '#888',
                display: 'block',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Fat (g)
            </label>
            <div style={{ display: 'flex', gap: '4px', minWidth: 0 }}>
              <input
                type="number"
                value={state.nutrition.fatTarget}
                onChange={(e) =>
                  handleNutritionChange('fatTarget', parseInt(e.target.value))
                }
                style={{
                  flex: 1,
                  padding: '8px',
                  fontFamily: 'Chakra Petch, sans-serif',
                  fontSize: '15px',
                  backgroundColor: 'rgba(0,255,65,0.02)',
                  border: '1px solid rgba(0,255,65,0.06)',
                  color: '#ddd',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(0,255,65,0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0,255,65,0.06)';
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Today's Progress — four .bar progress strips, one per
          macro. Each bar shows actual / target. The four-line
          repeated structure was extracted into a small inline
          helper below to cut duplication. Bar color is dynamic
          (matches macro semantic: cal=green, protein=green,
          carbs=amber, fat=purple) so we use inline override on
          the .bar > span fill. */}
      <div className="ds-card bracket" style={{ marginBottom: 32, padding: 16 }}>
        <span className="bl" /><span className="br" />
        <span className="t-eyebrow" style={{ marginBottom: 16, display: 'inline-flex' }}>
          Today&apos;s Progress
        </span>

        {([
          { label: 'CALORIES',  actual: mealTotals.calories, target: state.nutrition.calorieTarget, color: 'var(--green)',  unit: '' },
          { label: 'PROTEIN',   actual: mealTotals.protein,  target: state.nutrition.proteinTarget, color: 'var(--green)',  unit: 'g' },
          { label: 'CARBS',     actual: mealTotals.carbs,    target: state.nutrition.carbsTarget,   color: 'var(--warn)',   unit: 'g' },
          { label: 'FAT',       actual: mealTotals.fat,      target: state.nutrition.fatTarget,     color: '#a855f7',       unit: 'g' },
        ] as const).map((row) => {
          const pct = row.target > 0 ? Math.min((row.actual / row.target) * 100, 100) : 0;
          return (
            <div key={row.label} style={{ marginBottom: 16 }}>
              <div
                className="row-between"
                style={{ marginBottom: 6, fontFamily: 'var(--body)', fontSize: 13 }}
              >
                <span style={{ color: 'var(--text-primary)', letterSpacing: 1 }}>{row.label}</span>
                <span className="t-mono-data" style={{ color: row.color, fontSize: 13 }}>
                  {row.actual} / {row.target}{row.unit}
                </span>
              </div>
              <div className="bar" style={{ height: 8 }}>
                <span style={{ width: `${pct}%`, background: row.color, boxShadow: `0 0 6px ${row.color}` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Meal Log — bracket card. Header reads "Log Meal" when
          today (input form below), "Past Meals" when viewing a
          historical day. */}
      <div className="ds-card bracket" style={{ marginBottom: 32, padding: 16 }}>
        <span className="bl" /><span className="br" />
        <span className="t-eyebrow" style={{ marginBottom: 16, display: 'inline-flex' }}>
          {isViewingToday ? 'Log Meal' : 'Past Meals'}
        </span>

        {/* Log Form — only when viewing today. Inputs migrated to
            <DsField> so focus rings + labels stay consistent with
            the rest of the Intel Center forms. The meal-name field
            spans the full width via gridColumn: '1 / -1'. */}
        {isViewingToday ? (<div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
            gap: '8px',
            marginBottom: '16px',
            alignItems: 'flex-end',
            minWidth: 0,
          }}
        >
          <div style={{ gridColumn: '1 / -1' }}>
            <DsField
              label="Meal Name"
              type="text"
              value={state.nutrition.mealName}
              onChange={(v) => handleNutritionChange('mealName', v)}
              placeholder="e.g. Chicken bowl"
            />
          </div>
          <DsField
            label="Calories"
            type="number"
            value={state.nutrition.mealCalories}
            onChange={(v) => handleNutritionChange('mealCalories', v)}
            placeholder="kcal"
            inputMode="numeric"
          />
          <DsField
            label="Protein"
            type="number"
            value={state.nutrition.mealProtein}
            onChange={(v) => handleNutritionChange('mealProtein', v)}
            placeholder="g"
            inputMode="numeric"
          />
          <DsField
            label="Carbs"
            type="number"
            value={state.nutrition.mealCarbs}
            onChange={(v) => handleNutritionChange('mealCarbs', v)}
            placeholder="g"
            inputMode="numeric"
          />
          <DsField
            label="Fat"
            type="number"
            value={state.nutrition.mealFat}
            onChange={(v) => handleNutritionChange('mealFat', v)}
            placeholder="g"
            inputMode="numeric"
          />
          <button
            onClick={addMeal}
            style={{
              gridColumn: '1 / -1',
              padding: '10px 16px',
              fontFamily: 'Chakra Petch, sans-serif',
              fontSize: '20px',
              backgroundColor: 'transparent',
              border: '1px solid #00ff41',
              color: '#00ff41',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0,255,65,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            ADD
          </button>
        </div>
      ) : (
        <div style={{
          padding: 14,
          marginBottom: 12,
          background: 'rgba(255,184,0,0.04)',
          border: '1px solid rgba(255,184,0,0.2)',
          borderRadius: 4,
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: 11,
          color: '#facc15',
          textAlign: 'center',
        }}>
          VIEWING PAST DAY — LOGGING DISABLED. Jump to today to add meals.
        </div>
      )}

        {/* Meals List */}
        <div style={{ marginBottom: '16px' }}>
          {(isViewingToday ? todaysMeals : viewingDayMeals).length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '20px 12px',
                color: '#666',
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: 13,
              }}
            >
              {isViewingToday ? 'No meals logged today' : 'No meals logged on this day'}
            </div>
          ) : (
            (isViewingToday ? todaysMeals : viewingDayMeals).map((meal) => (
              <MealRow
                key={meal.id}
                meal={meal}
                timeLabel={formatMealTime(meal.time)}
                onRemove={isViewingToday ? () => removeMeal(meal.id) : undefined}
              />
            ))
          )}
        </div>

        {/* Totals Summary */}
        {(isViewingToday ? todaysMeals : viewingDayMeals).length > 0 && (
          <div
            style={{
              padding: '12px',
              marginTop: 10,
              background: 'rgba(0,255,65,0.04)',
              border: '1px solid rgba(0,255,65,0.12)',
              borderRadius: 4,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))',
              gap: 8,
              textAlign: 'center',
              minWidth: 0,
            }}
          >
            {[
              { label: 'CAL', value: (isViewingToday ? mealTotals : viewingDayTotals).calories, color: '#ffb800' },
              { label: 'P', value: `${(isViewingToday ? mealTotals : viewingDayTotals).protein}g`, color: '#00ff41' },
              { label: 'C', value: `${(isViewingToday ? mealTotals : viewingDayTotals).carbs}g`, color: '#4ade80' },
              { label: 'F', value: `${(isViewingToday ? mealTotals : viewingDayTotals).fat}g`, color: '#f97316' },
            ].map((t) => (
              <div key={t.label}>
                <div style={{
                  fontSize: 9,
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#666',
                  letterSpacing: 1.5,
                  marginBottom: 4,
                }}>
                  {t.label}
                </div>
                <div style={{
                  fontSize: 16,
                  fontFamily: 'Share Tech Mono, monospace',
                  color: t.color,
                  fontWeight: 700,
                }}>
                  {t.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supplement Stack — COMMANDER+ tier-gated. Renders Generate
          Stack CTA if no recommendation yet, or the existing stack if
          previously generated. Persists on operator.nutrition.supplementStack. */}
      <div style={{ marginTop: 20 }}>
        <SupplementStack
          operator={operator}
          currentUser={currentUser}
          onUpdateOperator={onUpdateOperator}
          onOpenBilling={() => setActiveTab('PROFILE')}
        />
      </div>

      {/* ─── DIETARY PROFILE ────────────────────────────────────────
          Three intake fields surfaced together: nutritionHabits,
          dietaryRestrictions, supplements. Captured during onboarding
          but had no UI surface — Gunny was making meal recommendations
          and macro advice without the operator being able to verify
          the assumptions baked in. Each field saves to operator.intake
          (canonical read source for buildGunnyContext). */}
      <div className="ds-card bracket" style={{ marginTop: 20, padding: 16 }}>
        <span className="bl" /><span className="br" />
        <span className="t-eyebrow" style={{ marginBottom: 12, display: 'inline-flex' }}>
          Dietary Profile
        </span>

        {/* Nutrition Habits — 4-tier dropdown matching IntakeForm. */}
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="intel-nutrition-habits">Nutrition Habits</label>
          <select
            id="intel-nutrition-habits"
            value={state.intakeFields.nutritionHabits}
            onChange={(e) => handleIntakeFieldChange('nutritionHabits', e.target.value)}
            className="ds-input"
          >
            <option value="poor">Poor — fast food, irregular meals</option>
            <option value="fair">Fair — some structure, room to improve</option>
            <option value="good">Good — mostly whole foods, consistent</option>
            <option value="excellent">Excellent — tracked macros, dialed in</option>
          </select>
        </div>

        {/* Dietary Restrictions — chip toggle from the canonical
            DIETARY_RESTRICTIONS list in IntakeForm. 'None' clears. */}
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Dietary Restrictions (select all that apply)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {[
              'Gluten Free', 'Dairy Free', 'Nut Allergy', 'Soy Free', 'Shellfish Allergy',
              'Egg Allergy', 'Halal', 'Kosher', 'Low Sodium', 'None',
            ].map((r) => {
              const active = (state.intakeFields.dietaryRestrictions || []).includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleIntakeArrayItem('dietaryRestrictions', r)}
                  style={{
                    padding: '6px 10px',
                    fontFamily: 'Chakra Petch, sans-serif',
                    fontSize: 12,
                    background: active ? 'rgba(0,255,65,0.12)' : 'rgba(0,255,65,0.02)',
                    border: `1px solid ${active ? 'rgba(0,255,65,0.55)' : 'rgba(0,255,65,0.15)'}`,
                    color: active ? '#00ff41' : '#888',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        {/* Supplements — chip toggle from the canonical
            SUPPLEMENT_OPTIONS list in IntakeForm. 'None' clears. */}
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Supplements (select all that apply)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {[
              'Protein Powder', 'Creatine', 'Pre-Workout', 'BCAAs', 'Fish Oil / Omega-3',
              'Multivitamin', 'Vitamin D', 'Magnesium', 'Caffeine', 'Collagen', 'None',
            ].map((s) => {
              const active = (state.intakeFields.supplements || []).includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleIntakeArrayItem('supplements', s)}
                  style={{
                    padding: '6px 10px',
                    fontFamily: 'Chakra Petch, sans-serif',
                    fontSize: 12,
                    background: active ? 'rgba(0,255,65,0.12)' : 'rgba(0,255,65,0.02)',
                    border: `1px solid ${active ? 'rgba(0,255,65,0.55)' : 'rgba(0,255,65,0.15)'}`,
                    color: active ? '#00ff41' : '#888',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // PR Board helpers
  const getExerciseGroups = () => {
    const groups: Record<string, PersonalRecord[]> = {};
    state.prBoard.forEach(pr => {
      const key = pr.exercise.toLowerCase().trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(pr);
    });
    // Sort each group by date
    Object.values(groups).forEach(g => g.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    return groups;
  };

  // Phase line milestones for common lifts (weight thresholds for 1RM)
  const PHASE_LINES: Record<string, { label: string; weight: number }[]> = {
    'bench press': [
      { label: 'PHASE 1', weight: 135 }, { label: 'PHASE 2', weight: 185 },
      { label: 'PHASE 3', weight: 225 }, { label: 'PHASE 4', weight: 275 },
      { label: 'PHASE 5', weight: 315 },
    ],
    'squat': [
      { label: 'PHASE 1', weight: 135 }, { label: 'PHASE 2', weight: 225 },
      { label: 'PHASE 3', weight: 315 }, { label: 'PHASE 4', weight: 405 },
      { label: 'PHASE 5', weight: 495 },
    ],
    'back squat': [
      { label: 'PHASE 1', weight: 135 }, { label: 'PHASE 2', weight: 225 },
      { label: 'PHASE 3', weight: 315 }, { label: 'PHASE 4', weight: 405 },
      { label: 'PHASE 5', weight: 495 },
    ],
    'deadlift': [
      { label: 'PHASE 1', weight: 135 }, { label: 'PHASE 2', weight: 225 },
      { label: 'PHASE 3', weight: 315 }, { label: 'PHASE 4', weight: 405 },
      { label: 'PHASE 5', weight: 495 },
    ],
    'overhead press': [
      { label: 'PHASE 1', weight: 65 }, { label: 'PHASE 2', weight: 95 },
      { label: 'PHASE 3', weight: 135 }, { label: 'PHASE 4', weight: 185 },
      { label: 'PHASE 5', weight: 225 },
    ],
    'ohp': [
      { label: 'PHASE 1', weight: 65 }, { label: 'PHASE 2', weight: 95 },
      { label: 'PHASE 3', weight: 135 }, { label: 'PHASE 4', weight: 185 },
      { label: 'PHASE 5', weight: 225 },
    ],
  };

  // Generate dynamic phase lines for exercises without predefined ones
  const getPhaseLines = (exerciseName: string, maxWeight: number) => {
    const key = exerciseName.toLowerCase().trim();
    if (PHASE_LINES[key]) return PHASE_LINES[key];
    // Generate 5 phases based on max weight seen, rounding to nice numbers
    const ceiling = Math.max(maxWeight * 1.5, 50);
    const step = Math.ceil(ceiling / 5 / 5) * 5; // round to nearest 5
    return Array.from({ length: 5 }, (_, i) => ({
      label: `PHASE ${i + 1}`,
      weight: step * (i + 1),
    }));
  };

  // Get starting PR from intake for an exercise
  const getIntakeBaseline = (exerciseName: string) => {
    const intakePRs = operator.intake?.startingPRs || [];
    return intakePRs.find(p => p.exercise.toLowerCase().trim() === exerciseName.toLowerCase().trim());
  };

  const [prViewMode, setPrViewMode] = useState<'roadmap' | 'tracker' | 'table'>('roadmap');

  const renderPhaseLineTracker = (exerciseName: string, prs: PersonalRecord[]) => {
    const maxWeight = Math.max(...prs.map(p => p.weight), 0);
    const phases = getPhaseLines(exerciseName, maxWeight);
    const baseline = getIntakeBaseline(exerciseName);
    const maxPhaseWeight = phases[phases.length - 1].weight;
    const progressPct = maxPhaseWeight > 0 ? Math.min(100, (maxWeight / maxPhaseWeight) * 100) : 0;

    // Find which phase they're in
    let currentPhaseIdx = 0;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (maxWeight >= phases[i].weight) { currentPhaseIdx = i + 1; break; }
    }

    return (
      <div style={{ padding: '16px', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, marginBottom: 12 }}>
        {/* Exercise header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', letterSpacing: 1, textTransform: 'uppercase' }}>
              {exerciseName}
            </span>
            {baseline && (
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#666', marginLeft: 10 }}>
                INTAKE: {baseline.weight}lbs x {baseline.reps}
              </span>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 20, color: '#ffb800', fontWeight: 700 }}>{maxWeight}</span>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#666', marginLeft: 4 }}>LBS</span>
          </div>
        </div>

        {/* Phase line progress bar */}
        <div style={{ position: 'relative', height: 32, background: '#111', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
          {/* Progress fill */}
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, #00ff41 0%, ${currentPhaseIdx >= phases.length ? '#ffb800' : '#00ff41'} 100%)`,
            opacity: 0.25, transition: 'width 0.5s ease',
          }} />
          {/* Phase line markers */}
          {phases.map((phase, idx) => {
            const pct = (phase.weight / maxPhaseWeight) * 100;
            const passed = maxWeight >= phase.weight;
            return (
              <div key={phase.label} style={{
                position: 'absolute', top: 0, bottom: 0, left: `${pct}%`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateX(-50%)',
              }}>
                <div style={{
                  width: 2, flex: 1,
                  background: passed ? '#00ff41' : '#333',
                }} />
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: passed ? '#00ff41' : '#333',
                  border: passed ? '2px solid #00ff41' : '2px solid #555',
                  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                }} />
              </div>
            );
          })}
          {/* Current position marker */}
          <div style={{
            position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
            left: `${progressPct}%`,
            width: 14, height: 14, borderRadius: '50%',
            background: '#ffb800', border: '2px solid #000',
            boxShadow: '0 0 8px rgba(255,184,0,0.5)',
            zIndex: 2,
          }} />
        </div>

        {/* Phase labels */}
        <div style={{ position: 'relative', height: 20, marginBottom: 8 }}>
          {phases.map((phase, idx) => {
            const pct = (phase.weight / maxPhaseWeight) * 100;
            const passed = maxWeight >= phase.weight;
            return (
              <div key={phase.label} style={{
                position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
                fontFamily: 'Share Tech Mono, monospace', fontSize: 8,
                color: passed ? '#00ff41' : '#555', textAlign: 'center', whiteSpace: 'nowrap',
              }}>
                <div>{phase.weight}</div>
              </div>
            );
          })}
        </div>

        {/* PR history timeline */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {baseline && (
            <div style={{
              padding: '3px 8px', background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.2)',
              borderRadius: 3, fontFamily: 'Share Tech Mono, monospace', fontSize: 10,
            }}>
              <span style={{ color: '#ffb800' }}>{t('intel.baseline')}</span>
              <span style={{ color: '#888', marginLeft: 6 }}>{baseline.weight}x{baseline.reps}</span>
            </div>
          )}
          {prs.map((pr, i) => {
            const isPeak = pr.weight === maxWeight;
            const isNew = (Date.now() - new Date(pr.date).getTime()) / (1000 * 60 * 60 * 24) < 7;
            // Path abbreviation. Apr 2026: PRs are stamped with the
            // operator's training path at log time (Planner auto-detect +
            // GunnyChat <pr_json>). gunny_pick is hidden — it means
            // "operator hasn't picked a path yet," not a real path.
            const pathAbbr = (() => {
              switch (pr.path) {
                case 'bodybuilding': return 'BB';
                case 'crossfit': return 'CF';
                case 'powerlifting': return 'PL';
                case 'athletic': return 'ATH';
                case 'tactical': return 'TAC';
                case 'hybrid': return 'HYB';
                default: return null; // undefined or gunny_pick
              }
            })();
            return (
              <div key={pr.id} style={{
                padding: '3px 8px',
                background: isPeak ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isPeak ? 'rgba(0,255,65,0.3)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 3, fontFamily: 'Share Tech Mono, monospace', fontSize: 10,
              }}>
                <span style={{ color: isPeak ? '#00ff41' : '#888' }}>{pr.weight}x{pr.reps}</span>
                <span style={{ color: '#555', marginLeft: 6 }}>{pr.date.slice(5)}</span>
                {pathAbbr && <span style={{ color: '#5a8a5a', marginLeft: 6 }}>{pathAbbr}</span>}
                {isNew && <span style={{ color: '#ffb800', marginLeft: 4 }}>{t('intel.new_tag')}</span>}
              </div>
            );
          })}
        </div>

        {/* Gain from baseline */}
        {baseline && maxWeight > baseline.weight && (
          <div style={{ marginTop: 6, fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
            <span style={{ color: '#00ff41' }}>+{maxWeight - baseline.weight} lbs</span>
            <span style={{ color: '#555' }}> since intake ({Math.round(((maxWeight - baseline.weight) / baseline.weight) * 100)}% gain)</span>
          </div>
        )}
      </div>
    );
  };

  // Generate milestone roadmap based on fitness level
  const generateMilestoneRoadmap = (): MilestoneGoal[] => {
    const level: FitnessLevel = operator.fitnessLevel || operator.intake?.fitnessLevel || operator.profile?.fitnessLevel || 'beginner';
    const milestones: MilestoneGoal[] = [];
    let id = 0;

    // Check if a milestone is achieved based on current data
    const workoutCount = Object.values(operator.workouts || {}).filter(w => w.completed).length;
    const streakDays = (() => {
      const dates = Object.entries(operator.workouts || {}).filter(([, w]) => w.completed).map(([d]) => d).sort().reverse();
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < dates.length; i++) {
        const d = new Date(dates[i]);
        const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= streak + 2) streak = diff + 1; else break; // allow 1 rest day
      }
      return Math.min(streak, dates.length);
    })();
    const mealDays = Object.keys(operator.nutrition?.meals || {}).length;
    const maxBench = Math.max(0, ...state.prBoard.filter(p => p.exercise.toLowerCase().includes('bench')).map(p => p.weight));
    const maxSquat = Math.max(0, ...state.prBoard.filter(p => p.exercise.toLowerCase().includes('squat')).map(p => p.weight));
    const maxDeadlift = Math.max(0, ...state.prBoard.filter(p => p.exercise.toLowerCase().includes('deadlift')).map(p => p.weight));
    const bodyWeight = operator.profile?.weight || 170;

    if (level === 'beginner') {
      // PHASE 1: Build the Habit (Consistency)
      milestones.push(
        { id: `ms-${id++}`, phase: 1, phaseName: 'BUILD THE HABIT', title: 'First Workout Logged', description: 'Complete and log your very first workout', type: 'consistency', target: { count: 1, unit: 'workouts' }, achieved: workoutCount >= 1, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 1, phaseName: 'BUILD THE HABIT', title: '3 Workouts in One Week', description: 'Hit 3 training sessions in a single week', type: 'consistency', target: { count: 3, unit: 'workouts/week' }, achieved: workoutCount >= 3, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 1, phaseName: 'BUILD THE HABIT', title: 'Log Meals for 3 Days', description: 'Track your nutrition for 3 separate days', type: 'consistency', target: { count: 3, unit: 'meal days' }, achieved: mealDays >= 3, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 1, phaseName: 'BUILD THE HABIT', title: '2-Week Streak', description: 'Train consistently for 2 weeks (at least 6 sessions)', type: 'consistency', target: { count: 6, unit: 'workouts' }, achieved: workoutCount >= 6, achievedDate: undefined },
      );
      // PHASE 2: Foundation (Endurance + Consistency)
      milestones.push(
        { id: `ms-${id++}`, phase: 2, phaseName: 'FOUNDATION', title: '10 Workouts Completed', description: 'Reach double-digit training sessions', type: 'consistency', target: { count: 10, unit: 'workouts' }, achieved: workoutCount >= 10, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 2, phaseName: 'FOUNDATION', title: '30-Day Nutrition Log', description: 'Log meals for 30 different days', type: 'consistency', target: { count: 30, unit: 'meal days' }, achieved: mealDays >= 30, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 2, phaseName: 'FOUNDATION', title: '20-Minute Cardio Session', description: 'Complete 20 minutes of sustained cardio', type: 'endurance', achieved: false, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 2, phaseName: 'FOUNDATION', title: '4-Week Streak', description: 'Train for 4 consecutive weeks without missing a scheduled day', type: 'consistency', target: { count: 12, unit: 'workouts' }, achieved: workoutCount >= 12, achievedDate: undefined },
      );
      // PHASE 3: First PRs (Strength + Endurance)
      milestones.push(
        { id: `ms-${id++}`, phase: 3, phaseName: 'FIRST PRs', title: 'Bench Press 95 lbs', description: 'Hit a 95lb bench press for any reps', type: 'strength', target: { exercise: 'Bench Press', weight: 95 }, achieved: maxBench >= 95, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 3, phaseName: 'FIRST PRs', title: 'Squat 135 lbs', description: 'Hit one plate on squat', type: 'strength', target: { exercise: 'Squat', weight: 135 }, achieved: maxSquat >= 135, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 3, phaseName: 'FIRST PRs', title: 'Deadlift 135 lbs', description: 'Pull one plate from the floor', type: 'strength', target: { exercise: 'Deadlift', weight: 135 }, achieved: maxDeadlift >= 135, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 3, phaseName: 'FIRST PRs', title: '25 Workouts Completed', description: 'Quarter century of training sessions', type: 'consistency', target: { count: 25, unit: 'workouts' }, achieved: workoutCount >= 25, achievedDate: undefined },
      );
      // PHASE 4: Building Momentum
      milestones.push(
        { id: `ms-${id++}`, phase: 4, phaseName: 'BUILDING MOMENTUM', title: 'Bench Press 135 lbs', description: 'One plate bench — a major milestone', type: 'strength', target: { exercise: 'Bench Press', weight: 135 }, achieved: maxBench >= 135, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 4, phaseName: 'BUILDING MOMENTUM', title: 'Squat 185 lbs', description: 'Close to bodyweight squat for most', type: 'strength', target: { exercise: 'Squat', weight: 185 }, achieved: maxSquat >= 185, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 4, phaseName: 'BUILDING MOMENTUM', title: 'Deadlift 225 lbs', description: 'Two plates — you are strong', type: 'strength', target: { exercise: 'Deadlift', weight: 225 }, achieved: maxDeadlift >= 225, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 4, phaseName: 'BUILDING MOMENTUM', title: '50 Workouts Completed', description: 'Half century — training is a habit now', type: 'milestone', target: { count: 50, unit: 'workouts' }, achieved: workoutCount >= 50, achievedDate: undefined },
      );
      // PHASE 5: Graduation
      milestones.push(
        { id: `ms-${id++}`, phase: 5, phaseName: 'GRADUATION', title: 'Bench Bodyweight', description: `Bench press ${bodyWeight} lbs (your bodyweight)`, type: 'strength', target: { exercise: 'Bench Press', weight: bodyWeight }, achieved: maxBench >= bodyWeight, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 5, phaseName: 'GRADUATION', title: 'Squat 1.25x Bodyweight', description: `Squat ${Math.round(bodyWeight * 1.25)} lbs`, type: 'strength', target: { exercise: 'Squat', weight: Math.round(bodyWeight * 1.25) }, achieved: maxSquat >= bodyWeight * 1.25, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 5, phaseName: 'GRADUATION', title: 'Deadlift 1.5x Bodyweight', description: `Deadlift ${Math.round(bodyWeight * 1.5)} lbs`, type: 'strength', target: { exercise: 'Deadlift', weight: Math.round(bodyWeight * 1.5) }, achieved: maxDeadlift >= bodyWeight * 1.5, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 5, phaseName: 'GRADUATION', title: '100 Workouts Completed', description: 'Triple digits — you are an operator now', type: 'milestone', target: { count: 100, unit: 'workouts' }, achieved: workoutCount >= 100, achievedDate: undefined },
      );
    } else if (level === 'intermediate') {
      milestones.push(
        { id: `ms-${id++}`, phase: 1, phaseName: 'RECALIBRATE', title: 'Complete Intake Assessment', description: 'Establish baselines for all major lifts', type: 'milestone', achieved: !!(operator.intake?.completed), achievedDate: undefined },
        { id: `ms-${id++}`, phase: 1, phaseName: 'RECALIBRATE', title: '4-Week Consistency Streak', description: 'Hit all scheduled sessions for 4 straight weeks', type: 'consistency', target: { count: 16, unit: 'workouts' }, achieved: workoutCount >= 16, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 1, phaseName: 'RECALIBRATE', title: 'Log Nutrition for 2 Weeks', description: 'Track meals consistently for 14 days', type: 'consistency', target: { count: 14, unit: 'meal days' }, achieved: mealDays >= 14, achievedDate: undefined },
      );
      milestones.push(
        { id: `ms-${id++}`, phase: 2, phaseName: 'PROGRESSIVE OVERLOAD', title: 'Bench Press 185 lbs', description: 'Push toward intermediate bench standards', type: 'strength', target: { exercise: 'Bench Press', weight: 185 }, achieved: maxBench >= 185, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 2, phaseName: 'PROGRESSIVE OVERLOAD', title: 'Squat 225 lbs', description: 'Two plates on squat — a real milestone', type: 'strength', target: { exercise: 'Squat', weight: 225 }, achieved: maxSquat >= 225, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 2, phaseName: 'PROGRESSIVE OVERLOAD', title: 'Deadlift 315 lbs', description: 'Three plates from the floor', type: 'strength', target: { exercise: 'Deadlift', weight: 315 }, achieved: maxDeadlift >= 315, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 2, phaseName: 'PROGRESSIVE OVERLOAD', title: '30 Workouts Completed', description: 'Building a solid training base', type: 'consistency', target: { count: 30, unit: 'workouts' }, achieved: workoutCount >= 30, achievedDate: undefined },
      );
      milestones.push(
        { id: `ms-${id++}`, phase: 3, phaseName: 'STRENGTH STANDARDS', title: 'Bench Press 225 lbs', description: 'Two plate bench — intermediate strength', type: 'strength', target: { exercise: 'Bench Press', weight: 225 }, achieved: maxBench >= 225, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 3, phaseName: 'STRENGTH STANDARDS', title: 'Squat 315 lbs', description: 'Three plate squat — serious strength', type: 'strength', target: { exercise: 'Squat', weight: 315 }, achieved: maxSquat >= 315, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 3, phaseName: 'STRENGTH STANDARDS', title: 'Deadlift 405 lbs', description: 'Four plates — elite territory', type: 'strength', target: { exercise: 'Deadlift', weight: 405 }, achieved: maxDeadlift >= 405, achievedDate: undefined },
      );
      milestones.push(
        { id: `ms-${id++}`, phase: 4, phaseName: 'OPERATOR CLASS', title: 'Bench 1.25x Bodyweight', description: `Bench ${Math.round(bodyWeight * 1.25)} lbs`, type: 'strength', target: { exercise: 'Bench Press', weight: Math.round(bodyWeight * 1.25) }, achieved: maxBench >= bodyWeight * 1.25, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 4, phaseName: 'OPERATOR CLASS', title: 'Squat 2x Bodyweight', description: `Squat ${Math.round(bodyWeight * 2)} lbs`, type: 'strength', target: { exercise: 'Squat', weight: Math.round(bodyWeight * 2) }, achieved: maxSquat >= bodyWeight * 2, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 4, phaseName: 'OPERATOR CLASS', title: '100 Workouts Completed', description: 'Triple digits — true commitment', type: 'milestone', target: { count: 100, unit: 'workouts' }, achieved: workoutCount >= 100, achievedDate: undefined },
      );
      milestones.push(
        { id: `ms-${id++}`, phase: 5, phaseName: 'COMMANDER READY', title: '1000 lb Total', description: 'Bench + Squat + Deadlift ≥ 1000 lbs', type: 'milestone', target: { weight: 1000 }, achieved: (maxBench + maxSquat + maxDeadlift) >= 1000, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 5, phaseName: 'COMMANDER READY', title: '200 Workouts', description: 'Two hundred sessions of dedicated training', type: 'milestone', target: { count: 200, unit: 'workouts' }, achieved: workoutCount >= 200, achievedDate: undefined },
      );
    } else {
      // Advanced / Elite
      milestones.push(
        { id: `ms-${id++}`, phase: 1, phaseName: 'ESTABLISH BASELINE', title: 'Set All Baseline PRs', description: 'Log current 1RM for bench, squat, and deadlift', type: 'milestone', achieved: maxBench > 0 && maxSquat > 0 && maxDeadlift > 0, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 1, phaseName: 'ESTABLISH BASELINE', title: 'Consistent 4-Day Split', description: 'Hit 4 sessions/week for 4 consecutive weeks', type: 'consistency', target: { count: 16, unit: 'workouts' }, achieved: workoutCount >= 16, achievedDate: undefined },
      );
      milestones.push(
        { id: `ms-${id++}`, phase: 2, phaseName: 'PEAK PERFORMANCE', title: 'Bench 1.5x Bodyweight', description: `Bench ${Math.round(bodyWeight * 1.5)} lbs`, type: 'strength', target: { exercise: 'Bench Press', weight: Math.round(bodyWeight * 1.5) }, achieved: maxBench >= bodyWeight * 1.5, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 2, phaseName: 'PEAK PERFORMANCE', title: 'Squat 2.5x Bodyweight', description: `Squat ${Math.round(bodyWeight * 2.5)} lbs`, type: 'strength', target: { exercise: 'Squat', weight: Math.round(bodyWeight * 2.5) }, achieved: maxSquat >= bodyWeight * 2.5, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 2, phaseName: 'PEAK PERFORMANCE', title: 'Deadlift 3x Bodyweight', description: `Deadlift ${Math.round(bodyWeight * 3)} lbs`, type: 'strength', target: { exercise: 'Deadlift', weight: Math.round(bodyWeight * 3) }, achieved: maxDeadlift >= bodyWeight * 3, achievedDate: undefined },
      );
      milestones.push(
        { id: `ms-${id++}`, phase: 3, phaseName: 'WARFIGHTER', title: '1200 lb Total', description: 'Bench + Squat + Deadlift ≥ 1200 lbs', type: 'milestone', target: { weight: 1200 }, achieved: (maxBench + maxSquat + maxDeadlift) >= 1200, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 3, phaseName: 'WARFIGHTER', title: '200 Workouts', description: 'Two hundred sessions — built different', type: 'milestone', target: { count: 200, unit: 'workouts' }, achieved: workoutCount >= 200, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 3, phaseName: 'WARFIGHTER', title: 'PR Every Lift +10%', description: 'Beat every intake baseline by at least 10%', type: 'milestone', achieved: false, achievedDate: undefined },
      );
      milestones.push(
        { id: `ms-${id++}`, phase: 4, phaseName: 'ELITE OPS', title: '1500 lb Total', description: 'Bench + Squat + Deadlift ≥ 1500 lbs', type: 'milestone', target: { weight: 1500 }, achieved: (maxBench + maxSquat + maxDeadlift) >= 1500, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 4, phaseName: 'ELITE OPS', title: '365-Day Streak', description: 'A full year of consistent training', type: 'consistency', target: { count: 365, unit: 'days' }, achieved: streakDays >= 365, achievedDate: undefined },
      );
      milestones.push(
        { id: `ms-${id++}`, phase: 5, phaseName: 'LEGEND', title: 'Competition Ready', description: 'All lifts meet competitive standards for your weight class', type: 'milestone', achieved: false, achievedDate: undefined },
        { id: `ms-${id++}`, phase: 5, phaseName: 'LEGEND', title: '500 Workouts', description: 'Half a thousand. Living legend status.', type: 'milestone', target: { count: 500, unit: 'workouts' }, achieved: workoutCount >= 500, achievedDate: undefined },
      );
    }

    return milestones;
  };

  const renderMilestoneRoadmap = () => {
    const milestones = generateMilestoneRoadmap();
    const phases = [...new Set(milestones.map(m => m.phase))].sort();
    const totalAchieved = milestones.filter(m => m.achieved).length;
    const totalMilestones = milestones.length;
    const overallPct = totalMilestones > 0 ? Math.round((totalAchieved / totalMilestones) * 100) : 0;

    // Determine current phase (first phase with incomplete milestones)
    let currentPhase = phases[phases.length - 1];
    for (const p of phases) {
      const phaseMilestones = milestones.filter(m => m.phase === p);
      if (phaseMilestones.some(m => !m.achieved)) { currentPhase = p; break; }
    }

    const typeColors: Record<string, string> = {
      consistency: '#4ade80',
      endurance: '#00ff41',
      strength: '#ff6b35',
      milestone: '#facc15',
    };

    const typeIcons: Record<string, string> = {
      consistency: '🔄',
      endurance: '🫁',
      strength: '💪',
      milestone: '⭐',
    };

    return (
      <div>
        {/* Overall progress header */}
        <div style={{ padding: 16, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#888', letterSpacing: 1 }}>MISSION PROGRESS</span>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, color: '#00ff41' }}>{totalAchieved}/{totalMilestones}</span>
          </div>
          <div style={{ height: 6, background: '#111', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${overallPct}%`, background: 'linear-gradient(90deg, #00ff41, #facc15)', borderRadius: 3, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {Object.entries(typeColors).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#666', textTransform: 'uppercase' }}>{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Phase sections */}
        {phases.map(phase => {
          const phaseMilestones = milestones.filter(m => m.phase === phase);
          const phaseAchieved = phaseMilestones.filter(m => m.achieved).length;
          const phasePct = Math.round((phaseAchieved / phaseMilestones.length) * 100);
          const isCurrentPhase = phase === currentPhase;
          const isComplete = phaseAchieved === phaseMilestones.length;
          const phaseName = phaseMilestones[0]?.phaseName || `PHASE ${phase}`;

          return (
            <div key={phase} style={{
              marginBottom: 12,
              border: `1px solid ${isCurrentPhase ? 'rgba(0,255,65,0.3)' : '#1a1a1a'}`,
              borderRadius: 8,
              overflow: 'hidden',
              background: isCurrentPhase ? 'rgba(0,255,65,0.02)' : '#0a0a0a',
            }}>
              {/* Phase header */}
              <div style={{
                padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: isComplete ? 'rgba(0,255,65,0.08)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isComplete ? (
                    <span style={{ fontSize: 14 }}>✅</span>
                  ) : isCurrentPhase ? (
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#00ff41', display: 'inline-block', boxShadow: '0 0 6px rgba(0,255,65,0.5)' }} />
                  ) : (
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#333', display: 'inline-block' }} />
                  )}
                  <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: isComplete ? '#00ff41' : isCurrentPhase ? '#e0e0e0' : '#555', letterSpacing: 1 }}>
                    PHASE {phase}: {phaseName}
                  </span>
                </div>
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: isComplete ? '#00ff41' : '#666' }}>
                  {phaseAchieved}/{phaseMilestones.length} {isComplete ? '✓' : `(${phasePct}%)`}
                </span>
              </div>

              {/* Milestone items */}
              <div style={{ padding: '8px 12px' }}>
                {phaseMilestones.map(ms => (
                  <div key={ms.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 4px',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    opacity: ms.achieved ? 0.7 : 1,
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: ms.achieved ? typeColors[ms.type] || '#00ff41' : 'transparent',
                      border: `2px solid ${ms.achieved ? typeColors[ms.type] || '#00ff41' : '#333'}`,
                      fontSize: 10,
                    }}>
                      {ms.achieved ? '✓' : typeIcons[ms.type] || '○'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: 'Share Tech Mono, monospace', fontSize: 12,
                        color: ms.achieved ? '#888' : '#e0e0e0',
                        textDecoration: ms.achieved ? 'line-through' : 'none',
                      }}>
                        {ms.title}
                      </div>
                      <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#555', marginTop: 2 }}>
                        {ms.description}
                      </div>
                    </div>
                    <div style={{
                      padding: '2px 6px', borderRadius: 3, fontSize: 8,
                      fontFamily: 'Share Tech Mono, monospace', textTransform: 'uppercase',
                      background: `${typeColors[ms.type] || '#666'}20`,
                      color: typeColors[ms.type] || '#666',
                      letterSpacing: 0.5,
                    }}>
                      {ms.type}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPRBoardTab = () => {
    const exerciseGroups = getExerciseGroups();
    const groupKeys = Object.keys(exerciseGroups);
    const recentCount = state.prBoard.filter(
      p => (Date.now() - new Date(p.date).getTime()) / (1000 * 60 * 60 * 24) < 30
    ).length;

    return (
      <div className="stack-4">
        {/* View toggle — uses .segmented so it matches the
            Planner Month/Week/Day chrome. Three modes: roadmap
            (visual milestones), tracker (per-exercise progression),
            table (raw editable rows). */}
        <div className="segmented" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          {(['roadmap', 'tracker', 'table'] as const).map(mode => {
            const labels = {
              roadmap: 'Milestone Roadmap',
              tracker: 'Phase Tracker',
              table: 'Table View',
            };
            return (
              <button
                key={mode}
                type="button"
                className={`seg ${prViewMode === mode ? 'active' : ''}`}
                onClick={() => setPrViewMode(mode)}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* Milestone Roadmap — delegated to renderMilestoneRoadmap. */}
        {prViewMode === 'roadmap' && renderMilestoneRoadmap()}

        {/* Phase Tracker */}
        {prViewMode === 'tracker' && (
          <div>
            {groupKeys.length === 0 && (
              <div className="ds-card" style={{ padding: 24, textAlign: 'center' }}>
                <span className="t-mono-sm" style={{ color: 'var(--text-tertiary)' }}>
                  No PRs logged yet. Add your first PR below.
                </span>
              </div>
            )}
            {groupKeys.map(key =>
              renderPhaseLineTracker(
                exerciseGroups[key][0].exercise,
                exerciseGroups[key]
              )
            )}

            {/* Summary stats — bracket card with three stat cells. */}
            {groupKeys.length > 0 && (
              <div
                className="ds-card bracket"
                style={{
                  marginTop: 16,
                  padding: 12,
                  display: 'flex',
                  gap: 20,
                  justifyContent: 'center',
                }}
              >
                <span className="bl" /><span className="br" />
                <div style={{ textAlign: 'center' }}>
                  <div className="t-num-display" style={{ color: 'var(--warn)' }}>
                    {state.prBoard.length}
                  </div>
                  <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)' }}>
                    TOTAL PRs
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="t-num-display">{groupKeys.length}</div>
                  <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)' }}>
                    EXERCISES
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="t-num-display">{recentCount}</div>
                  <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)' }}>
                    LAST 30 DAYS
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Table View — original editable grid. Header uses .t-label
            tokens; rows get a left green stripe on recent (<7d) PRs
            so streak-active lifts pop visually. */}
        {prViewMode === 'table' && (
          <div className="ds-card bracket" style={{ padding: 0, overflowX: 'auto' }}>
            <span className="bl" /><span className="br" />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--body)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-green-strong)' }}>
                  {['EXERCISE', 'WEIGHT', 'REPS', 'DATE', 'NOTES'].map((h, i) => (
                    <th
                      key={h}
                      className="t-label"
                      style={{
                        padding: '12px',
                        textAlign: i === 0 || i === 4 ? 'left' : 'right',
                        fontWeight: 'normal',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                  <th style={{ padding: 12, width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {state.prBoard.map((pr, index) => {
                  const isRecent = (Date.now() - new Date(pr.date).getTime()) / (1000 * 60 * 60 * 24) < 7;
                  return (
                    <tr
                      key={pr.id}
                      style={{
                        borderBottom: '1px solid var(--border-green-soft)',
                        borderLeft: isRecent ? '2px solid var(--green)' : '2px solid transparent',
                      }}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <input
                          type="text"
                          value={pr.exercise}
                          onChange={(e) => handlePRChange(index, 'exercise', e.target.value)}
                          style={{
                            width: '100%',
                            padding: 4,
                            fontFamily: 'var(--body)',
                            fontSize: 14,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={pr.weight}
                          onChange={(e) => handlePRChange(index, 'weight', parseInt(e.target.value))}
                          style={{
                            width: 70,
                            padding: 4,
                            fontFamily: 'var(--mono)',
                            fontSize: 14,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--green)',
                            textAlign: 'right',
                            outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={pr.reps}
                          onChange={(e) => handlePRChange(index, 'reps', parseInt(e.target.value))}
                          style={{
                            width: 50,
                            padding: 4,
                            fontFamily: 'var(--mono)',
                            fontSize: 14,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--green)',
                            textAlign: 'right',
                            outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <input
                          type="date"
                          value={pr.date}
                          onChange={(e) => handlePRChange(index, 'date', e.target.value)}
                          style={{
                            padding: 4,
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <input
                          type="text"
                          value={pr.notes}
                          onChange={(e) => handlePRChange(index, 'notes', e.target.value)}
                          style={{
                            width: '100%',
                            padding: 4,
                            fontFamily: 'var(--body)',
                            fontSize: 12,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          type="button"
                          onClick={() => removePR(pr.id)}
                          aria-label={`Delete PR ${pr.exercise}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            fontSize: 16,
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add PR — primary CTA, full-width-feeling so users see
            it immediately under any of the three view modes. */}
        <button
          type="button"
          onClick={addPR}
          className="btn btn-primary"
          style={{ marginTop: 8 }}
        >
          + Add PR
        </button>
      </div>
    );
  };

  const renderInjuriesTab = () => (
    // Per the handoff Intel/Injuries spec: each injury renders as a
    // danger-toned bracket card with name input, ACTIVE/RECOVERING/
    // CLEARED status pill (solid color matches state), notes input,
    // and a restrictions chip row. Cleared injuries flip to elevated
    // green so users see they're "out of the way".
    <div className="stack-4">
      <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
        {state.injuries.map((injury, injuryIndex) => {
          const cardClass = injury.status === 'cleared'
            ? 'ds-card bracket elevated'
            : injury.status === 'recovering'
              ? 'ds-card bracket amber amber-tone'
              : 'ds-card bracket danger danger-tone';
          return (
            <div key={injury.id} className={cardClass}>
              <span className="bl" /><span className="br" />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Injury name — display-l in white, no border;
                      reads as the card title since the bracket card
                      itself owns the visual frame. */}
                  <input
                    type="text"
                    value={injury.name}
                    onChange={(e) => updateInjury(injuryIndex, 'name', e.target.value)}
                    className="t-display-l"
                    style={{
                      width: '100%',
                      padding: 4,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-bright)',
                      marginBottom: 8,
                      outline: 'none',
                    }}
                    placeholder={t('intel.injury_name_placeholder')}
                  />

                  {/* Status pill — solid danger/warn/green per state.
                      <select> styled to look like a button. The
                      handoff "ACTIVE status pill (solid danger)"
                      maps directly to this. */}
                  <div style={{ marginBottom: 12 }}>
                    <select
                      value={injury.status}
                      onChange={(e) =>
                        updateInjury(
                          injuryIndex,
                          'status',
                          e.target.value as 'active' | 'recovering' | 'cleared'
                        )
                      }
                      className="t-display-m"
                      style={{
                        padding: '4px 12px',
                        fontSize: 11,
                        background:
                          injury.status === 'active'
                            ? 'var(--danger)'
                            : injury.status === 'recovering'
                              ? 'var(--warn)'
                              : 'var(--green)',
                        color: '#030303',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 800,
                        letterSpacing: 2,
                      }}
                    >
                      <option value="active">{t('intel.injury_status_active')}</option>
                      <option value="recovering">{t('intel.injury_status_recovering')}</option>
                      <option value="cleared">{t('intel.injury_status_cleared')}</option>
                    </select>
                  </div>

                  {/* Notes — .ds-textarea, condensed for inline use. */}
                  <textarea
                    value={injury.notes}
                    onChange={(e) => updateInjury(injuryIndex, 'notes', e.target.value)}
                    placeholder={t('intel.injury_desc_placeholder')}
                    className="ds-textarea"
                    style={{ marginBottom: 12, minHeight: 60, resize: 'vertical' }}
                  />

                  {/* Restrictions chip group — danger-toned chips
                      with × close. Add input → .btn.btn-danger.btn-sm. */}
                  <span className="t-label" style={{ marginBottom: 8, display: 'block' }}>
                    Restrictions
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {injury.restrictions?.map((restriction, restrictionIndex) => (
                      <span key={restrictionIndex} className="chip danger">
                        <span>{restriction}</span>
                        <button
                          type="button"
                          onClick={() => removeRestriction(injuryIndex, restrictionIndex)}
                          aria-label={`Remove restriction ${restriction}`}
                          className="chip-x"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addRestriction(injuryIndex)}
                    className="btn btn-danger-outline btn-sm"
                  >
                    + Add Restriction
                  </button>
                </div>

                {/* Delete card — danger button so the destructive
                    action reads loud and consistent. */}
                <button
                  type="button"
                  onClick={() => removeInjury(injury.id)}
                  className="btn btn-danger btn-sm"
                  aria-label={`Delete injury ${injury.name}`}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addInjury}
        className="btn btn-danger-outline"
      >
        + Add Injury
      </button>
    </div>
  );

  const renderPreferencesTab = () => (
    // Per the handoff Intel/Preferences spec: training split + duration
    // + days/week fields, Equipment Arsenal grid (tap-to-select chips
    // + custom add input), Weak Points + Movements to Avoid sections.
    //
    // Apr 2026: trainingPath + preferredWorkoutTime added to the top of
    // this tab. They were captured during intake but had no UI surface,
    // which broke the user→Gunny feedback loop and caused recurring
    // drift complaints. Editing here writes to both preferences (legacy
    // mirror) and intake (canonical, read by buildGunnyContext).
    <div
      className="stack-4"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 14,
      }}
    >
      {/* Training Path — span full width, dropdown of the 7 options
          captured during intake. Showing this lets the operator verify
          and correct what Gunny is using to pick programming templates. */}
      <div className="field" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
        <label htmlFor="prefs-training-path">Training Path</label>
        <select
          id="prefs-training-path"
          value={state.preferences.trainingPath}
          onChange={(e) => handlePreferencesChange('trainingPath', e.target.value)}
          className="ds-input"
        >
          <option value="bodybuilding">Bodybuilding / Hypertrophy</option>
          <option value="crossfit">Functional Fitness / CrossFit</option>
          <option value="powerlifting">Powerlifting</option>
          <option value="athletic">Athletic Performance</option>
          <option value="tactical">Tactical / Military</option>
          <option value="hybrid">Hybrid</option>
          <option value="gunny_pick">Let Gunny Decide</option>
        </select>
      </div>

      {/* Preferred Workout Time — captured during intake, no UI surface
          before. Affects when Gunny suggests training and how it phrases
          recovery/wake/post-workout advice. */}
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="prefs-workout-time">Preferred Workout Time</label>
        <select
          id="prefs-workout-time"
          value={state.preferences.preferredWorkoutTime}
          onChange={(e) => handlePreferencesChange('preferredWorkoutTime', e.target.value)}
          className="ds-input"
        >
          <option value="morning">Morning</option>
          <option value="midday">Midday</option>
          <option value="afternoon">Afternoon</option>
          <option value="evening">Evening</option>
          <option value="late_night">Late Night</option>
        </select>
      </div>

      {/* Training Split */}
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="prefs-split">{t('intel.training_split')}</label>
        <input
          id="prefs-split"
          type="text"
          value={state.preferences.trainingSplit}
          onChange={(e) => handlePreferencesChange('trainingSplit', e.target.value)}
          className="ds-input"
        />
      </div>

      {/* Session Duration */}
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="prefs-duration">Session Duration (min)</label>
        <input
          id="prefs-duration"
          type="number"
          value={state.preferences.sessionDuration}
          onChange={(e) => handlePreferencesChange('sessionDuration', parseInt(e.target.value))}
          className="ds-input"
        />
      </div>

      {/* Days Per Week */}
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="prefs-days">{t('intel.days_per_week')}</label>
        <input
          id="prefs-days"
          type="number"
          min={1}
          max={7}
          value={state.preferences.daysPerWeek}
          onChange={(e) => handlePreferencesChange('daysPerWeek', parseInt(e.target.value))}
          className="ds-input"
        />
      </div>

      {/* Equipment Arsenal — preset chip grid + custom add. Wrapped
          in a full-width bracket card so it reads as one block. */}
      <div className="ds-card bracket" style={{ gridColumn: '1 / -1' }}>
        <span className="bl" /><span className="br" />
        <span className="t-eyebrow" style={{ marginBottom: 6, display: 'inline-flex' }}>
          Equipment Arsenal
        </span>
        <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Tap common gear below or type your own. Describe it however you want — Gunny will figure it out.
        </div>

        {/* Preset quick-add buttons. Already-added presets show as
            green-filled chips with a check; not-yet-added ones are
            outlined ghost chips with a +. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {[
            'Full Commercial Gym', 'Barbell + Rack', 'Dumbbells', 'Kettlebells',
            'Pull-up Bar', 'Resistance Bands', 'Cable Machine', 'Smith Machine',
            'Bench (Flat/Incline)', 'Assault Bike / Rower', 'Treadmill', 'TRX / Suspension',
            'Medicine Ball', 'Landmine Attachment', 'Leg Press', 'Hack Squat',
            'Dip Station', 'Bodyweight Only',
          ].map(preset => {
            const alreadyAdded = state.preferences.equipment.some(
              e => e.toLowerCase() === preset.toLowerCase()
            );
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  if (!alreadyAdded) {
                    setState(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        equipment: [...prev.preferences.equipment, preset],
                      },
                    }));
                  }
                }}
                className={alreadyAdded ? 'chip green' : 'chip'}
                disabled={alreadyAdded}
                style={{
                  cursor: alreadyAdded ? 'default' : 'pointer',
                  opacity: alreadyAdded ? 0.85 : 1,
                  background: alreadyAdded ? 'rgba(0,255,65,0.08)' : 'transparent',
                }}
              >
                {alreadyAdded ? '✓ ' : '+ '}
                {preset}
              </button>
            );
          })}
        </div>

        {/* Current equipment list — green chips with × close. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {state.preferences.equipment.length === 0 && (
            <span className="t-mono-sm" style={{ color: 'var(--text-dim)' }}>
              No equipment selected yet — Gunny will assume bodyweight only.
            </span>
          )}
          {state.preferences.equipment.map((equip) => (
            <span key={equip} className="chip green">
              <span>{equip}</span>
              <button
                type="button"
                onClick={() => removeEquipment(equip)}
                aria-label={`Remove ${equip}`}
                className="chip-x"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--danger)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {/* Custom add — .ds-input + .btn.btn-primary.btn-sm. */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder={t('intel.equipment_placeholder')}
            value={state.newEquipment}
            onChange={(e) => setState((prev) => ({ ...prev, newEquipment: e.target.value }))}
            onKeyPress={(e) => { if (e.key === 'Enter') addEquipment(); }}
            className="ds-input"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={addEquipment}
            className="btn btn-primary btn-sm"
          >
            + Add
          </button>
        </div>
        <div className="t-mono-sm" style={{ marginTop: 6, color: 'var(--text-dim)' }}>
          Don&apos;t know the name? Just describe it. &ldquo;The thing where you pull the bar
          down&rdquo; = Lat Pulldown. Gunny figures it out.
        </div>
      </div>

      {/* Weak Points — amber chip group, full-width row. */}
      <div className="field" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
        <label htmlFor="prefs-new-weak">{t('intel.weak_points')}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {state.preferences.weakPoints.length === 0 && (
            <span className="t-mono-sm" style={{ color: 'var(--text-dim)' }}>
              No weak points logged. Add areas you want to bring up.
            </span>
          )}
          {state.preferences.weakPoints.map((point) => (
            <span key={point} className="chip amber">
              <span>{point}</span>
              <button
                type="button"
                onClick={() => removeWeakPoint(point)}
                aria-label={`Remove weak point ${point}`}
                className="chip-x"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--danger)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="prefs-new-weak"
            type="text"
            placeholder={t('intel.add_weak_point_placeholder')}
            value={state.newWeakPoint}
            onChange={(e) => setState((prev) => ({ ...prev, newWeakPoint: e.target.value }))}
            onKeyPress={(e) => { if (e.key === 'Enter') addWeakPoint(); }}
            className="ds-input"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={addWeakPoint}
            className="btn btn-amber btn-sm"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Movements to Avoid — danger chip group. */}
      <div className="field" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
        <label htmlFor="prefs-new-avoid">{t('intel.movements_avoid')}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {state.preferences.movementsToAvoid.length === 0 && (
            <span className="t-mono-sm" style={{ color: 'var(--text-dim)' }}>
              Nothing on the do-not-program list yet.
            </span>
          )}
          {state.preferences.movementsToAvoid.map((movement) => (
            <span key={movement} className="chip danger">
              <span>{movement}</span>
              <button
                type="button"
                onClick={() => removeMovementToAvoid(movement)}
                aria-label={`Remove ${movement}`}
                className="chip-x"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--danger)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="prefs-new-avoid"
            type="text"
            placeholder={t('intel.add_avoid_placeholder')}
            value={state.newMovementToAvoid}
            onChange={(e) => setState((prev) => ({ ...prev, newMovementToAvoid: e.target.value }))}
            onKeyPress={(e) => { if (e.key === 'Enter') addMovementToAvoid(); }}
            className="ds-input"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={addMovementToAvoid}
            className="btn btn-danger-outline btn-sm"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );


  const renderContent = () => {
    switch (activeTab) {
      case 'PROFILE':
        return renderProfileTab();
      case 'NUTRITION':
        return renderNutritionTab();
      case 'PR_BOARD':
        // Junior operators (with the flag on) see sport-performance metrics
        // (10m sprint, CMJ, agility T, mile, etc.) instead of the adult
        // 1RM-centric PR board. Per docs/youth-soccer-corpus.md §11: no
        // maximal 1RM testing for unsupervised juniors.
        if (operator.isJunior === true && isJuniorOperatorEnabledClient()) {
          return <JuniorPRBoard operator={operator} onUpdateOperator={onUpdateOperator} />;
        }
        return renderPRBoardTab();
      case 'ANALYTICS':
        // Pass currentUser so the OPERATOR+ tier gate uses the viewer's
        // tier (a trainer viewing a client always has access). Upgrade
        // CTA bounces back to the PROFILE tab where BillingPanel lives.
        return (
          <ProgressCharts
            operator={operator}
            currentUser={currentUser}
            onOpenBilling={() => setActiveTab('PROFILE')}
          />
        );
      case 'INJURIES':
        return renderInjuriesTab();
      case 'MACROCYCLE':
        return <MacrocyclePanel operator={operator} onUpdateOperator={onUpdateOperator} />;
      case 'PREFERENCES':
        return renderPreferencesTab();
      case 'WEARABLES':
        // Pass currentUser so the COMMANDER+ tier gate uses the viewer's
        // tier (a trainer viewing a client always has access). Upgrade
        // CTA bounces back to the PROFILE tab where BillingPanel lives.
        //
        // Layout:
        //   1. WearableConnect — connect/disconnect providers
        //   2. ReadinessPanel  — always-on engine state (Day X of N,
        //                        confidence, ACWR, factors)
        //   3. RecoveryReadout — on-demand action surface (GO_HARD/
        //                        NORMAL/DELOAD/REST + LLM coaching)
        return (
          <div>
            <WearableConnect
              operator={operator}
              onUpdateOperator={onUpdateOperator}
              currentUser={currentUser}
              onOpenBilling={() => setActiveTab('PROFILE')}
            />
            <div style={{ marginTop: 20 }}>
              <ReadinessPanel
                operator={operator}
                currentUser={currentUser}
                onOpenBilling={() => setActiveTab('PROFILE')}
              />
            </div>
            <div style={{ marginTop: 20 }}>
              <RecoveryReadout
                operator={operator}
                currentUser={currentUser}
                onOpenBilling={() => setActiveTab('PROFILE')}
              />
            </div>
          </div>
        );
      case 'MANUAL':
        // User-facing operating manual — every feature explained.
        // Bilingual via internal language hook (no operator data
        // needed). Mirrors the OpsCenter ROADMAP tab in chrome.
        return <OperatingManual />;
      case 'FORM_CHECK':
        // AI Form Analysis (Video) — feature #47. Operator uploads a
        // short clip; client-side frame extraction + Claude vision
        // returns a structured form review. WARFIGHTER tier-gated;
        // upgrade CTA bounces to PROFILE → BillingPanel.
        return (
          <FormAnalysis
            operator={operator}
            currentUser={currentUser}
            onOpenBilling={() => setActiveTab('PROFILE')}
          />
        );
      default:
        return null;
    }
  };

  const tabIcons: Record<SubTab, string> = {
    PROFILE: '◆',
    NUTRITION: '◈',
    PR_BOARD: '▶',
    ANALYTICS: '◉',
    INJURIES: '▦',
    MACROCYCLE: '⟁',
    PREFERENCES: '◇',
    WEARABLES: '◎',
    FORM_CHECK: '◊',
    MANUAL: '☰',
  };

  const getTabLabels = (): Record<SubTab, string> => ({
    PROFILE: t('intel.profile'),
    NUTRITION: t('intel.nutrition'),
    PR_BOARD: t('intel.pr_board'),
    ANALYTICS: 'ANALYTICS',
    INJURIES: t('intel.injuries'),
    MACROCYCLE: 'MACROCYCLE',
    PREFERENCES: t('intel.preferences'),
    WEARABLES: 'WEARABLES',
    FORM_CHECK: 'FORM CHECK',
    // MANUAL is the user-facing operating manual — every feature
    // explained, parallel to OPS Center's ROADMAP tab. Translated
    // inline by OperatingManual based on operator language.
    MANUAL: t('intel.manual') || 'MANUAL',
  });

  const [isMobile, setIsMobile] = useState(false);
  const lastWidthRef = useRef(0);
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w !== lastWidthRef.current) {
        lastWidthRef.current = w;
        setIsMobile(w < 768);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        height: '100%',
        backgroundColor: '#030303',
        color: '#ddd',
        fontFamily: 'Chakra Petch, sans-serif',
        position: 'relative',
      }}
    >
      {/* Sidebar (desktop) / 3x3 grid (mobile).
          The previous mobile design was a single-row .subtabs strip,
          horizontal-scrollable. That hid 5 of 9 tabs offscreen by
          default — the operator literally didn't know FORM_CHECK or
          MACROCYCLE existed (Apr 2026 reproduction). Switched to a
          3-column × 3-row grid: all 9 tabs visible above the fold,
          icon + label per cell, no cramming. Uses ~225px of vertical
          real estate but the tabs bar is the operator's only entry
          point to half the IntelCenter surface — discoverability
          dominates compactness here. */}
      {isMobile ? (
        <nav
          aria-label={t('intel.subnav_aria')}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            padding: '12px',
            borderBottom: '1px solid rgba(0,255,65,0.06)',
            background: 'linear-gradient(180deg, rgba(8,8,8,0.5) 0%, rgba(3,3,3,0.5) 100%)',
          }}
        >
          {(['PROFILE', 'NUTRITION', 'PR_BOARD', 'ANALYTICS', 'INJURIES', 'MACROCYCLE', 'PREFERENCES', 'WEARABLES', 'FORM_CHECK'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  // Cell: icon top, label bottom. On a 375px-wide phone
                  // each cell is ~115px wide — readable, not cramped.
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '14px 6px',
                  minHeight: '70px',
                  // Active: tinted bg + bright green border/glow.
                  // Inactive: subtle fill + dim border so cells still
                  // read as tappable instead of vanishing into the bg.
                  background: isActive ? 'rgba(0,255,65,0.08)' : 'rgba(0,255,65,0.015)',
                  border: isActive
                    ? '1px solid rgba(0,255,65,0.55)'
                    : '1px solid rgba(0,255,65,0.12)',
                  borderRadius: '4px',
                  color: isActive ? '#00ff41' : '#777',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '10px',
                  fontWeight: isActive ? 700 : 400,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive
                    ? '0 0 12px rgba(0,255,65,0.18), inset 0 0 12px rgba(0,255,65,0.04)'
                    : 'none',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: '22px',
                    lineHeight: 1,
                    opacity: isActive ? 1 : 0.45,
                  }}
                >
                  {tabIcons[tab]}
                </span>
                <span style={{ lineHeight: 1.1 }}>{getTabLabels()[tab]}</span>
              </button>
            );
          })}
        </nav>
      ) : (
        <div
          style={{
            width: '180px',
            borderRight: '1px solid rgba(0,255,65,0.06)',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: '20px',
            background: 'linear-gradient(180deg, rgba(8,8,8,0.5) 0%, rgba(3,3,3,0.5) 100%)',
          }}
        >
          <div style={{ padding: '0 16px 16px 16px', borderBottom: '1px solid rgba(0,255,65,0.05)', marginBottom: '8px' }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '15px', fontWeight: 700, color: '#777', letterSpacing: '2px' }}>
              INTEL CENTER
            </div>
          </div>

          {(['PROFILE', 'NUTRITION', 'PR_BOARD', 'ANALYTICS', 'INJURIES', 'MACROCYCLE', 'PREFERENCES', 'WEARABLES', 'FORM_CHECK'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: isActive ? 'rgba(0,255,65,0.04)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '2px solid #00ff41' : '2px solid transparent',
                  color: isActive ? '#ccc' : '#777',
                  cursor: 'pointer',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '15px',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '15px', opacity: isActive ? 1 : 0.4 }}>{tabIcons[tab]}</span>
                {getTabLabels()[tab]}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Save bar — sticky-ish header with breadcrumb mono line on
            the left and the primary save button on the right. The
            crumb format mirrors the screen-head .crumb pattern from
            the design system. */}
        <div
          className="row-between"
          style={{
            padding: isMobile ? '10px 16px' : '12px 24px',
            borderBottom: '1px solid var(--border-green-soft)',
            background: 'linear-gradient(180deg, rgba(8,8,8,0.5) 0%, rgba(3,3,3,0.5) 100%)',
          }}
        >
          <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)' }}>
            {operator.callsign} // {activeTab.replace('_', ' ')}
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary btn-sm"
          >
            {t('intel.save_changes')}
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '24px', backgroundColor: '#030303' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default IntelCenter;
