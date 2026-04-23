'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Operator, Meal, PRRecord, Injury, formatHeightInput, FitnessLevel, MilestoneGoal } from '@/lib/types';
import WearableConnect from '@/components/WearableConnect';
import ProgressCharts from '@/components/ProgressCharts';
import { FOOD_DB } from '@/data/foods';
import { notifyPRAlert, loadNotificationPrefs } from '@/lib/notifications';
import BattlePlanRef from '@/components/BattlePlanRef';
import DailyBriefRef from '@/components/DailyBriefRef';
import { MealRow } from '@/components/nutrition/MealRow';
import { getLocalDateStr, toLocalDateStr } from '@/lib/dateUtils';
import { getAuthToken } from '@/lib/authClient';

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

type SubTab = 'PROFILE' | 'NUTRITION' | 'PR_BOARD' | 'ANALYTICS' | 'INJURIES' | 'PREFERENCES' | 'WEARABLES';

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
  };
  newGoal: string;
  newEquipment: string;
  newWeakPoint: string;
  newMovementToAvoid: string;
}

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
    },
    newGoal: '',
    newEquipment: '',
    newWeakPoint: '',
    newMovementToAvoid: '',
  });

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
      },
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* Callsign - full width */}
      <div style={{ gridColumn: '1 / -1', marginBottom: '8px' }}>
        {isAdmin ? (
          <input
            type="text"
            value={state.profile.callsign}
            onChange={(e) => handleProfileChange('callsign', e.target.value)}
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '26px',
              fontWeight: 900,
              color: '#00ff41',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '4px',
              textShadow: '0 0 8px rgba(0,255,65,0.3)',
              backgroundColor: 'rgba(0,255,65,0.02)',
              border: '1px solid rgba(0,255,65,0.06)',
              padding: '8px',
              boxSizing: 'border-box',
              width: '100%',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(0,255,65,0.2)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(0,255,65,0.06)';
            }}
          />
        ) : (
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '26px',
            fontWeight: 900,
            color: '#00ff41',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '4px',
            textShadow: '0 0 8px rgba(0,255,65,0.3)',
          }}>
            {operator.callsign}
          </div>
        )}
        <div style={{
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '15px',
          color: '#666',
          letterSpacing: '1px',
          marginTop: '4px',
        }}>
          {state.profile.name} // {operator.role.toUpperCase()}
        </div>
      </div>

      {/* Name */}
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
          Name
        </label>
        <input
          type="text"
          value={state.profile.name}
          onChange={(e) => handleProfileChange('name', e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            fontFamily: 'Chakra Petch, sans-serif',
            fontSize: '16px',
            backgroundColor: 'rgba(0,255,65,0.02)',
            border: '1px solid rgba(0,255,65,0.1)',
            color: '#ddd',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Access PIN - admin only */}
      {isAdmin && (
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
            Access PIN
          </label>
          <input
            type="text"
            maxLength={4}
            pattern="[0-9]*"
            inputMode="numeric"
            value={state.profile.pin}
            onChange={(e) => handleProfileChange('pin', e.target.value)}
            style={{
              width: '100%',
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
      )}

      {/* Age */}
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
          Age
        </label>
        <input
          type="number"
          value={state.profile.age}
          onChange={(e) => handleProfileChange('age', parseInt(e.target.value))}
          style={{
            width: '100%',
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

      {/* Height */}
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
          Height
        </label>
        <input
          type="text"
          value={state.profile.height}
          onChange={(e) => handleProfileChange('height', e.target.value)}
          placeholder="511 → 5'11&quot;"
          style={{
            width: '100%',
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
            handleProfileChange('height', formatHeightInput(e.target.value));
          }}
        />
      </div>

      {/* Weight */}
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
          Weight (lbs)
        </label>
        <input
          type="number"
          value={state.profile.weight}
          onChange={(e) => handleProfileChange('weight', parseInt(e.target.value))}
          style={{
            width: '100%',
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

      {/* Body Fat */}
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
          Body Fat (%)
        </label>
        <input
          type="number"
          step="0.1"
          value={state.profile.bodyFat}
          onChange={(e) => handleProfileChange('bodyFat', parseFloat(e.target.value))}
          style={{
            width: '100%',
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

      {/* Training Age */}
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
          Training Age (years)
        </label>
        <input
          type="number"
          value={state.profile.trainingAge}
          onChange={(e) => handleProfileChange('trainingAge', parseInt(e.target.value))}
          style={{
            width: '100%',
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

      {/* Readiness Score */}
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
          Readiness (0-100)
        </label>
        <input
          type="number"
          min="0"
          max="100"
          value={state.profile.readinessScore}
          onChange={(e) => handleProfileChange('readinessScore', parseInt(e.target.value))}
          style={{
            width: '100%',
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

      {/* Sleep Quality */}
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
          Sleep (0-10)
        </label>
        <input
          type="number"
          min="0"
          max="10"
          value={state.profile.sleepQuality}
          onChange={(e) => handleProfileChange('sleepQuality', parseInt(e.target.value))}
          style={{
            width: '100%',
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

      {/* Stress Level */}
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
          Stress (0-10)
        </label>
        <input
          type="number"
          min="0"
          max="10"
          value={state.profile.stressLevel}
          onChange={(e) => handleProfileChange('stressLevel', parseInt(e.target.value))}
          style={{
            width: '100%',
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

      {/* Goals - full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <label
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '15px',
            color: '#888',
            display: 'block',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          Goals
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {state.profile.goals.map((goal) => (
            <div
              key={goal.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                backgroundColor: 'transparent',
                border: '1px solid #00ff41',
                borderRadius: '4px',
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: '26px',
                color: '#00ff41',
              }}
            >
              <span>{goal.name}</span>
              <button
                onClick={() => removeGoal(goal.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ff4444',
                  cursor: 'pointer',
                  fontSize: '26px',
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Add goal..."
            value={state.newGoal}
            onChange={(e) => setState((prev) => ({ ...prev, newGoal: e.target.value }))}
            onKeyPress={(e) => {
              if (e.key === 'Enter') addGoal();
            }}
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
          <button
            onClick={addGoal}
            style={{
              padding: '8px 16px',
              fontFamily: 'Chakra Petch, sans-serif',
              fontSize: '26px',
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
            + ADD
          </button>
        </div>
      </div>

      {/* Update Assessment Button */}
      <div style={{ gridColumn: '1 / -1', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(0,255,65,0.08)' }}>
        <button
          onClick={() => onRequestIntake?.()}
          style={{
            width: '100%',
            padding: '12px 20px',
            fontFamily: 'Chakra Petch, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            backgroundColor: 'transparent',
            border: '1px solid rgba(0,255,65,0.15)',
            color: '#888',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0,255,65,0.05)';
            e.currentTarget.style.borderColor = 'rgba(0,255,65,0.3)';
            e.currentTarget.style.color = '#00ff41';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(0,255,65,0.15)';
            e.currentTarget.style.color = '#888';
          }}
        >
          <span style={{ fontSize: '16px' }}>↻</span>
          {(operator.intake?.completed || operator.profile?.intakeCompleted) ? 'UPDATE FITNESS ASSESSMENT' : 'COMPLETE FITNESS ASSESSMENT'}
        </button>
        {(operator.intake?.completedDate || operator.profile?.intakeCompletedDate) && (
          <div style={{ fontSize: '11px', color: '#555', textAlign: 'center', marginTop: '6px', fontFamily: 'Share Tech Mono, monospace' }}>
            Last completed: {new Date(operator.intake?.completedDate || operator.profile?.intakeCompletedDate).toLocaleDateString()}
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

    setPhotoAnalyzing(true);
    setPhotoResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const mimeType = file.type || 'image/jpeg';

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
      };
      reader.readAsDataURL(file);
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

      {/* ACCURACY TIER KEY */}
      <div style={{ marginBottom: 16, padding: 12, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8 }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#888', letterSpacing: 1, marginBottom: 8 }}>TRACKING ACCURACY TIERS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { tier: 1, label: 'MANUAL ENTRY', desc: 'You weigh + enter exact macros', color: '#00ff41', icon: '⚡', accuracy: '±1-3%' },
            { tier: 2, label: 'USDA SEARCH', desc: 'FDA-verified database lookup', color: '#4ade80', icon: '🔬', accuracy: '±5-10%' },
            { tier: 3, label: 'QUICK LOG', desc: 'AI text parsing from description', color: '#facc15', icon: '💬', accuracy: '±15-25%' },
            { tier: 4, label: 'PHOTO SNAP', desc: 'AI vision analysis of plate photo', color: '#ff6b35', icon: '📸', accuracy: '±20-40%' },
          ].map(t => (
            <div key={t.tier} style={{
              padding: '8px 10px', background: `${t.color}08`, border: `1px solid ${t.color}30`, borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: t.color, letterSpacing: 0.5 }}>
                  TIER {t.tier}: {t.label}
                </div>
                <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#555' }}>{t.desc}</div>
              </div>
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: t.color, fontWeight: 700 }}>{t.accuracy}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── DATE NAVIGATOR ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '10px 12px',
        marginBottom: 12,
        background: 'rgba(0,255,65,0.03)',
        border: '1px solid rgba(0,255,65,0.10)',
        borderRadius: 4,
      }}>
        <button
          onClick={() => shiftViewingDate(-1)}
          style={{
            padding: '6px 12px',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 11,
            fontWeight: 700,
            color: '#00ff41',
            background: 'transparent',
            border: '1px solid rgba(0,255,65,0.3)',
            borderRadius: 3,
            cursor: 'pointer',
            letterSpacing: 1,
          }}
          aria-label="Previous day"
        >
          ◀ PREV
        </button>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 13,
            fontWeight: 700,
            color: '#00ff41',
            letterSpacing: 2,
          }}>
            {formatViewingDateLabel()}
          </div>
          <div style={{
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 10,
            color: '#666',
            marginTop: 2,
          }}>
            {viewingDateStr}
          </div>
        </div>

        <button
          onClick={() => shiftViewingDate(1)}
          disabled={isViewingToday}
          style={{
            padding: '6px 12px',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 11,
            fontWeight: 700,
            color: isViewingToday ? '#333' : '#00ff41',
            background: 'transparent',
            border: `1px solid ${isViewingToday ? '#1a1a1a' : 'rgba(0,255,65,0.3)'}`,
            borderRadius: 3,
            cursor: isViewingToday ? 'not-allowed' : 'pointer',
            letterSpacing: 1,
          }}
          aria-label="Next day"
        >
          NEXT ▶
        </button>
      </div>

      {/* JUMP TO TODAY — only visible when viewing a past day */}
      {!isViewingToday && (
        <button
          onClick={() => setViewingDateStr(getTodayStr())}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: 12,
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 10,
            fontWeight: 700,
            color: '#facc15',
            background: 'rgba(250,204,21,0.05)',
            border: '1px solid rgba(250,204,21,0.2)',
            borderRadius: 3,
            cursor: 'pointer',
            letterSpacing: 1.5,
          }}
        >
          ↻ JUMP TO TODAY
        </button>
      )}

      {/* LOG MODE SELECTOR — only when viewing today */}
      {isViewingToday && (<>
      <div style={{ marginBottom: 16, display: 'flex', gap: 6 }}>
        {([
          { id: 'quick' as const, label: '💬 QUICK', color: '#facc15' },
          { id: 'photo' as const, label: '📸 PHOTO', color: '#ff6b35' },
          { id: 'search' as const, label: '🔬 USDA', color: '#4ade80' },
          { id: 'manual' as const, label: '⚡ MANUAL', color: '#00ff41' },
        ]).map(m => (
          <button key={m.id} onClick={() => setNutritionLogMode(m.id)} style={{
            flex: 1, padding: '8px 4px', fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700,
            background: nutritionLogMode === m.id ? `${m.color}20` : '#0a0a0a',
            color: nutritionLogMode === m.id ? m.color : '#555',
            border: `1px solid ${nutritionLogMode === m.id ? m.color : '#222'}`,
            borderRadius: 4, cursor: 'pointer', letterSpacing: 0.5, transition: 'all 0.2s',
          }}>{m.label}</button>
        ))}
      </div>

      {/* QUICK LOG MODE */}
      {nutritionLogMode === 'quick' && (
        <div style={{ marginBottom: 24, padding: 16, backgroundColor: 'rgba(250, 204, 21, 0.03)', border: '1px solid rgba(250, 204, 21, 0.15)', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#facc15', letterSpacing: 1, margin: 0 }}>QUICK LOG</h3>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#facc15', padding: '2px 6px', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 3 }}>TIER 3 · ±15-25%</span>
          </div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontFamily: 'Share Tech Mono' }}>
            Describe what you ate — e.g. &quot;2 eggs and toast&quot; or &quot;chicken breast with rice&quot;
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={quickFoodInput}
              onChange={e => { setQuickFoodInput(e.target.value); setQuickFoodResult(null); }}
              onKeyDown={e => { if (e.key === 'Enter') handleQuickFoodLog(); }}
              placeholder="I had chicken breast and rice..."
              style={{
                flex: 1, padding: '10px 12px', backgroundColor: '#0a0a0a', border: '1px solid rgba(250, 204, 21, 0.3)',
                color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace", fontSize: 14, borderRadius: 4, outline: 'none',
              }}
            />
            <button onClick={handleQuickFoodLog} style={{
              padding: '10px 16px', backgroundColor: '#facc15', color: '#000', border: 'none',
              fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 4,
            }}>
              SCAN
            </button>
          </div>
          {quickFoodResult && (
            <div style={{ marginTop: 12, padding: 12, background: '#0a0a0a', border: '1px solid rgba(0, 255, 65, 0.2)', borderRadius: 4 }}>
              <div style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: 13, marginBottom: 8 }}>
                {quickFoodResult.name}
              </div>
              <div style={{ display: 'flex', gap: 16, fontFamily: 'Share Tech Mono', fontSize: 12 }}>
                <span style={{ color: '#ffb800' }}>{quickFoodResult.calories} cal</span>
                <span style={{ color: '#00ff41' }}>{quickFoodResult.protein}g P</span>
                <span style={{ color: '#4ade80' }}>{quickFoodResult.carbs}g C</span>
                <span style={{ color: '#f97316' }}>{quickFoodResult.fat}g F</span>
              </div>
              <button onClick={handleQuickFoodAdd} style={{
                marginTop: 8, padding: '6px 16px', backgroundColor: '#00ff41', color: '#000', border: 'none',
                fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, cursor: 'pointer', borderRadius: 4,
              }}>
                LOG MEAL
              </button>
            </div>
          )}
        </div>
      )}

      {/* PHOTO SNAP MODE */}
      {nutritionLogMode === 'photo' && (
        <div style={{ marginBottom: 24, padding: 16, backgroundColor: 'rgba(255, 107, 53, 0.03)', border: '1px solid rgba(255, 107, 53, 0.15)', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#ff6b35', letterSpacing: 1, margin: 0 }}>PHOTO SNAP</h3>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#ff6b35', padding: '2px 6px', border: '1px solid rgba(255,107,53,0.3)', borderRadius: 3 }}>TIER 4 · ±20-40%</span>
          </div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 12, fontFamily: 'Share Tech Mono' }}>
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
            <div style={{ marginTop: 12, padding: 12, background: '#0a0a0a', border: '1px solid rgba(255, 107, 53, 0.2)', borderRadius: 4 }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#888', letterSpacing: 1, marginBottom: 8 }}>
                DETECTED ITEMS ({photoResult.confidence.toUpperCase()} CONFIDENCE)
              </div>
              {photoResult.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1a1a1a' }}>
                  <div>
                    <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: '#e0e0e0' }}>{item.name}</span>
                    <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#555', marginLeft: 8 }}>{item.portion}</span>
                  </div>
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, display: 'flex', gap: 8 }}>
                    <span style={{ color: '#ffb800' }}>{item.calories}</span>
                    <span style={{ color: '#00ff41' }}>{item.protein}P</span>
                    <span style={{ color: '#4ade80' }}>{item.carbs}C</span>
                    <span style={{ color: '#f97316' }}>{item.fat}F</span>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 8, padding: '8px 0', borderTop: '1px solid rgba(255,107,53,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Orbitron, sans-serif', fontSize: 12 }}>
                  <span style={{ color: '#ff6b35' }}>TOTALS</span>
                  <div style={{ display: 'flex', gap: 12, fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>
                    <span style={{ color: '#ffb800' }}>{photoResult.totals.calories} cal</span>
                    <span style={{ color: '#00ff41' }}>{photoResult.totals.protein}g P</span>
                    <span style={{ color: '#4ade80' }}>{photoResult.totals.carbs}g C</span>
                    <span style={{ color: '#f97316' }}>{photoResult.totals.fat}g F</span>
                  </div>
                </div>
              </div>
              {photoResult.notes && (
                <div style={{ marginTop: 6, fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#666', fontStyle: 'italic' }}>
                  {photoResult.notes}
                </div>
              )}
              <button onClick={handlePhotoResultLog} style={{
                marginTop: 10, padding: '8px 20px', backgroundColor: '#00ff41', color: '#000', border: 'none',
                fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, cursor: 'pointer', borderRadius: 4, width: '100%',
              }}>
                LOG THIS MEAL
              </button>
            </div>
          )}
        </div>
      )}

      {/* USDA SEARCH MODE */}
      {nutritionLogMode === 'search' && (
        <div style={{ marginBottom: 24, padding: 16, backgroundColor: 'rgba(74, 222, 128, 0.03)', border: '1px solid rgba(74, 222, 128, 0.15)', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#4ade80', letterSpacing: 1, margin: 0 }}>USDA DATABASE</h3>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#4ade80', padding: '2px 6px', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 3 }}>TIER 2 · ±5-10%</span>
          </div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontFamily: 'Share Tech Mono' }}>
            Search 380K+ FDA-verified foods. Macros per 100g standard serving.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={usdaSearch}
              onChange={e => setUsdaSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleUsdaSearch(); }}
              placeholder="Search: chicken breast, brown rice, almonds..."
              style={{
                flex: 1, padding: '10px 12px', backgroundColor: '#0a0a0a', border: '1px solid rgba(74, 222, 128, 0.3)',
                color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace", fontSize: 14, borderRadius: 4, outline: 'none',
              }}
            />
            <button onClick={handleUsdaSearch} disabled={usdaSearching} style={{
              padding: '10px 16px', backgroundColor: usdaSearching ? '#333' : '#4ade80', color: '#000', border: 'none',
              fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 4,
            }}>
              {usdaSearching ? '...' : 'SEARCH'}
            </button>
          </div>
          {usdaResults.length > 0 && (
            <div style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto' }}>
              {usdaResults.map(food => (
                <div key={food.id} style={{
                  padding: '10px 12px', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4, marginBottom: 6,
                  cursor: 'pointer', transition: 'border-color 0.2s',
                }}
                  onClick={() => handleUsdaFoodLog(food)}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,222,128,0.4)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1a1a1a'; }}
                >
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: '#e0e0e0', marginBottom: 4, textTransform: 'capitalize' }}>
                    {food.name.toLowerCase()}
                    {food.brand && <span style={{ color: '#555', marginLeft: 6, fontSize: 10 }}>({food.brand})</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
                    <span style={{ color: '#ffb800' }}>{food.macros.calories} cal</span>
                    <span style={{ color: '#00ff41' }}>{food.macros.protein}g P</span>
                    <span style={{ color: '#4ade80' }}>{food.macros.carbs}g C</span>
                    <span style={{ color: '#f97316' }}>{food.macros.fat}g F</span>
                    <span style={{ color: '#555' }}>per {food.servingSize}{food.servingUnit}</span>
                  </div>
                </div>
              ))}
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#444', textAlign: 'center', marginTop: 4 }}>
                Tap a food to log it. Data: USDA FoodData Central
              </div>
            </div>
          )}
        </div>
      )}

      {/* MANUAL ENTRY MODE — highest accuracy, shown inline when selected */}
      {nutritionLogMode === 'manual' && (
        <div style={{ marginBottom: 24, padding: 16, backgroundColor: 'rgba(0, 255, 65, 0.03)', border: '1px solid rgba(0, 255, 65, 0.15)', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', letterSpacing: 1, margin: 0 }}>MANUAL ENTRY</h3>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#00ff41', padding: '2px 6px', border: '1px solid rgba(0,255,65,0.3)', borderRadius: 3 }}>TIER 1 · ±1-3%</span>
          </div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 12, fontFamily: 'Share Tech Mono' }}>
            Weigh your food and enter exact macros. Highest accuracy for serious tracking.
          </div>
          <div style={{ fontSize: 10, color: '#555', fontFamily: 'Share Tech Mono, monospace', marginBottom: 8 }}>
            Use the meal log section below to enter exact values manually.
          </div>
        </div>
      )}
      </>)}

      {/* Macro Targets */}
      <div
        style={{
          marginBottom: '32px',
          padding: '16px',
          backgroundColor: 'rgba(0,255,65,0.02)',
          border: '1px solid rgba(0,255,65,0.06)',
        }}
      >
        <h3
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '15px',
            color: '#00ff41',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          MACRO TARGETS
        </h3>
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

      {/* Today's Progress */}
      <div
        style={{
          marginBottom: '32px',
          padding: '16px',
          backgroundColor: 'rgba(0,255,65,0.02)',
          border: '1px solid rgba(0,255,65,0.06)',
        }}
      >
        <h3
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '15px',
            color: '#00ff41',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          TODAY'S PROGRESS
        </h3>

        {/* Calories */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
              fontFamily: 'Chakra Petch, sans-serif',
              fontSize: '26px',
            }}
          >
            <span style={{ color: '#ddd' }}>CALORIES</span>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', color: '#00ff41' }}>
              {mealTotals.calories} / {state.nutrition.calorieTarget}
            </span>
          </div>
          <div
            style={{
              height: '8px',
              backgroundColor: 'rgba(0,255,65,0.04)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: '#00ff41',
                width: `${Math.min(
                  (mealTotals.calories / state.nutrition.calorieTarget) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Protein */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
              fontFamily: 'Chakra Petch, sans-serif',
              fontSize: '26px',
            }}
          >
            <span style={{ color: '#ddd' }}>PROTEIN</span>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', color: '#00ff41' }}>
              {mealTotals.protein} / {state.nutrition.proteinTarget}g
            </span>
          </div>
          <div
            style={{
              height: '8px',
              backgroundColor: 'rgba(0,255,65,0.04)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: '#00ff41',
                width: `${Math.min(
                  (mealTotals.protein / state.nutrition.proteinTarget) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Carbs */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
              fontFamily: 'Chakra Petch, sans-serif',
              fontSize: '26px',
            }}
          >
            <span style={{ color: '#ddd' }}>CARBS</span>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', color: '#ffb800' }}>
              {mealTotals.carbs} / {state.nutrition.carbsTarget}g
            </span>
          </div>
          <div
            style={{
              height: '8px',
              backgroundColor: 'rgba(0,255,65,0.04)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: '#ffb800',
                width: `${Math.min(
                  (mealTotals.carbs / state.nutrition.carbsTarget) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Fat */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
              fontFamily: 'Chakra Petch, sans-serif',
              fontSize: '26px',
            }}
          >
            <span style={{ color: '#ddd' }}>FAT</span>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', color: '#a855f7' }}>
              {mealTotals.fat} / {state.nutrition.fatTarget}g
            </span>
          </div>
          <div
            style={{
              height: '8px',
              backgroundColor: 'rgba(0,255,65,0.04)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: '#a855f7',
                width: `${Math.min(
                  (mealTotals.fat / state.nutrition.fatTarget) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Meal Log */}
      <div
        style={{
          marginBottom: '32px',
          padding: '16px',
          backgroundColor: 'rgba(0,255,65,0.02)',
          border: '1px solid rgba(0,255,65,0.06)',
        }}
      >
        <h3
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '15px',
            color: '#00ff41',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          LOG MEAL
        </h3>

        {/* Log Form — only when viewing today */}
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
          <input
            type="text"
            placeholder="Meal name"
            value={state.nutrition.mealName}
            onChange={(e) => handleNutritionChange('mealName', e.target.value)}
            style={{
              gridColumn: '1 / -1',
              padding: '8px',
              fontFamily: 'Chakra Petch, sans-serif',
              fontSize: '15px',
              backgroundColor: 'rgba(0,255,65,0.02)',
              border: '1px solid rgba(0,255,65,0.06)',
              color: '#ddd',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
              minWidth: 0,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(0,255,65,0.2)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(0,255,65,0.06)';
            }}
          />
          <input
            type="number"
            placeholder="Calories"
            value={state.nutrition.mealCalories}
            onChange={(e) => handleNutritionChange('mealCalories', e.target.value)}
            style={{
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
          <input
            type="number"
            placeholder="Protein"
            value={state.nutrition.mealProtein}
            onChange={(e) => handleNutritionChange('mealProtein', e.target.value)}
            style={{
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
          <input
            type="number"
            placeholder="Carbs"
            value={state.nutrition.mealCarbs}
            onChange={(e) => handleNutritionChange('mealCarbs', e.target.value)}
            style={{
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
          <input
            type="number"
            placeholder="Fat"
            value={state.nutrition.mealFat}
            onChange={(e) => handleNutritionChange('mealFat', e.target.value)}
            style={{
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
              <span style={{ color: '#ffb800' }}>BASELINE</span>
              <span style={{ color: '#888', marginLeft: 6 }}>{baseline.weight}x{baseline.reps}</span>
            </div>
          )}
          {prs.map((pr, i) => {
            const isPeak = pr.weight === maxWeight;
            const isNew = (Date.now() - new Date(pr.date).getTime()) / (1000 * 60 * 60 * 24) < 7;
            return (
              <div key={pr.id} style={{
                padding: '3px 8px',
                background: isPeak ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isPeak ? 'rgba(0,255,65,0.3)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 3, fontFamily: 'Share Tech Mono, monospace', fontSize: 10,
              }}>
                <span style={{ color: isPeak ? '#00ff41' : '#888' }}>{pr.weight}x{pr.reps}</span>
                <span style={{ color: '#555', marginLeft: 6 }}>{pr.date.slice(5)}</span>
                {isNew && <span style={{ color: '#ffb800', marginLeft: 4 }}>NEW</span>}
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

    return (
      <div>
        {/* View toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['roadmap', 'tracker', 'table'] as const).map(mode => {
            const labels = { roadmap: 'MILESTONE ROADMAP', tracker: 'PHASE TRACKER', table: 'TABLE VIEW' };
            return (
              <button key={mode} onClick={() => setPrViewMode(mode)} style={{
                padding: '6px 14px', fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700,
                background: prViewMode === mode ? '#00ff41' : '#0a0a0a',
                color: prViewMode === mode ? '#000' : '#888',
                border: `1px solid ${prViewMode === mode ? '#00ff41' : '#333'}`,
                borderRadius: 4, cursor: 'pointer', letterSpacing: 1,
              }}>{labels[mode]}</button>
            );
          })}
        </div>

        {/* Milestone Roadmap View */}
        {prViewMode === 'roadmap' && renderMilestoneRoadmap()}

        {/* Phase Tracker View */}
        {prViewMode === 'tracker' && (
          <div>
            {groupKeys.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#555', fontFamily: 'Share Tech Mono, monospace', fontSize: 13 }}>
                No PRs logged yet. Add your first PR below.
              </div>
            )}
            {groupKeys.map(key => renderPhaseLineTracker(
              exerciseGroups[key][0].exercise, // Use original casing from first entry
              exerciseGroups[key]
            ))}

            {/* Summary stats */}
            {groupKeys.length > 0 && (
              <div style={{
                marginTop: 16, padding: 12, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4,
                display: 'flex', gap: 20, justifyContent: 'center',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#ffb800' }}>{state.prBoard.length}</div>
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#666' }}>TOTAL PRs</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#00ff41' }}>{groupKeys.length}</div>
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#666' }}>EXERCISES</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#00ff41' }}>
                    {state.prBoard.filter(p => (Date.now() - new Date(p.date).getTime()) / (1000 * 60 * 60 * 24) < 30).length}
                  </div>
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#666' }}>LAST 30 DAYS</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Table View (original) */}
        {prViewMode === 'table' && (
          <div style={{ width: '100%', overflowX: 'auto', marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Chakra Petch, sans-serif' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(0,255,65,0.15)' }}>
                  {['EXERCISE', 'WEIGHT', 'REPS', 'DATE', 'NOTES'].map((h, i) => (
                    <th key={h} style={{
                      padding: '12px', textAlign: i === 0 || i === 4 ? 'left' : 'right',
                      fontFamily: 'Chakra Petch, sans-serif', fontSize: '13px', color: '#888',
                      textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'normal',
                    }}>{h}</th>
                  ))}
                  <th style={{ padding: '12px', width: '32px' }} />
                </tr>
              </thead>
              <tbody>
                {state.prBoard.map((pr, index) => {
                  const isRecent = (Date.now() - new Date(pr.date).getTime()) / (1000 * 60 * 60 * 24) < 7;
                  return (
                    <tr key={pr.id} style={{
                      borderBottom: '1px solid rgba(0,255,65,0.06)',
                      borderLeft: isRecent ? '2px solid #00ff41' : '2px solid transparent',
                    }}>
                      <td style={{ padding: '10px 12px' }}>
                        <input type="text" value={pr.exercise} onChange={(e) => handlePRChange(index, 'exercise', e.target.value)}
                          style={{ width: '100%', padding: '4px', fontFamily: 'Chakra Petch, sans-serif', fontSize: '14px', backgroundColor: 'transparent', border: 'none', color: '#ddd', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <input type="number" value={pr.weight} onChange={(e) => handlePRChange(index, 'weight', parseInt(e.target.value))}
                          style={{ width: '70px', padding: '4px', fontFamily: 'Share Tech Mono, monospace', fontSize: '14px', backgroundColor: 'transparent', border: 'none', color: '#00ff41', textAlign: 'right', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <input type="number" value={pr.reps} onChange={(e) => handlePRChange(index, 'reps', parseInt(e.target.value))}
                          style={{ width: '50px', padding: '4px', fontFamily: 'Share Tech Mono, monospace', fontSize: '14px', backgroundColor: 'transparent', border: 'none', color: '#00ff41', textAlign: 'right', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <input type="date" value={pr.date} onChange={(e) => handlePRChange(index, 'date', e.target.value)}
                          style={{ padding: '4px', fontFamily: 'Share Tech Mono, monospace', fontSize: '12px', backgroundColor: 'transparent', border: 'none', color: '#888', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <input type="text" value={pr.notes} onChange={(e) => handlePRChange(index, 'notes', e.target.value)}
                          style={{ width: '100%', padding: '4px', fontFamily: 'Chakra Petch, sans-serif', fontSize: '12px', backgroundColor: 'transparent', border: 'none', color: '#888', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => removePR(pr.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '16px', padding: 0 }}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add PR button */}
        <button onClick={addPR} style={{
          padding: '10px 16px', fontFamily: 'Chakra Petch, sans-serif', fontSize: '13px',
          backgroundColor: 'transparent', border: '1px solid #00ff41', color: '#00ff41',
          cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', transition: 'all 0.2s',
          borderRadius: 4, marginTop: 8,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,255,65,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          + ADD PR
        </button>
      </div>
    );
  };

  const renderInjuriesTab = () => (
    <div>
      <div style={{ display: 'grid', gap: '16px', marginBottom: '16px' }}>
        {state.injuries.map((injury, injuryIndex) => (
          <div
            key={injury.id}
            style={{
              padding: '16px',
              backgroundColor: 'rgba(0,255,65,0.02)',
              border: '1px solid rgba(0,255,65,0.06)',
              borderRadius: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                {/* Injury Name */}
                <input
                  type="text"
                  value={injury.name}
                  onChange={(e) => updateInjury(injuryIndex, 'name', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontFamily: 'Chakra Petch, sans-serif',
                    fontSize: '26px',
                    fontWeight: 'bold',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#ddd',
                    marginBottom: '8px',
                    outline: 'none',
                  }}
                />

                {/* Status */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <select
                    value={injury.status}
                    onChange={(e) =>
                      updateInjury(
                        injuryIndex,
                        'status',
                        e.target.value as 'active' | 'recovering' | 'cleared'
                      )
                    }
                    style={{
                      padding: '6px 8px',
                      fontFamily: 'Chakra Petch, sans-serif',
                      fontSize: '26px',
                      backgroundColor:
                        injury.status === 'active'
                          ? '#ff4444'
                          : injury.status === 'recovering'
                            ? '#ffb800'
                            : '#00ff41',
                      color: '#030303',
                      border: 'none',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      fontWeight: 'bold',
                    }}
                  >
                    <option value="active">ACTIVE</option>
                    <option value="recovering">RECOVERING</option>
                    <option value="cleared">CLEARED</option>
                  </select>
                </div>

                {/* Notes */}
                <textarea
                  value={injury.notes}
                  onChange={(e) => updateInjury(injuryIndex, 'notes', e.target.value)}
                  placeholder="Notes..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontFamily: 'Chakra Petch, sans-serif',
                    fontSize: '15px',
                    backgroundColor: 'rgba(0,255,65,0.02)',
                    border: '1px solid rgba(0,255,65,0.06)',
                    color: '#ddd',
                    marginBottom: '8px',
                    minHeight: '60px',
                    boxSizing: 'border-box',
                    resize: 'none',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,255,65,0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,255,65,0.06)';
                  }}
                />

                {/* Restrictions */}
                <div>
                  <label
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: '15px',
                      color: '#888',
                      display: 'block',
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}
                  >
                    RESTRICTIONS
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {injury.restrictions?.map((restriction, restrictionIndex) => (
                      <div
                        key={restrictionIndex}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          backgroundColor: 'transparent',
                          border: '1px solid #ff4444',
                          borderRadius: '4px',
                          fontFamily: 'Chakra Petch, sans-serif',
                          fontSize: '15px',
                          color: '#ff4444',
                        }}
                      >
                        <span>{restriction}</span>
                        <button
                          onClick={() => removeRestriction(injuryIndex, restrictionIndex)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ff4444',
                            cursor: 'pointer',
                            fontSize: '15px',
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => addRestriction(injuryIndex)}
                    style={{
                      padding: '6px 12px',
                      fontFamily: 'Chakra Petch, sans-serif',
                      fontSize: '15px',
                      backgroundColor: 'transparent',
                      border: '1px solid #ff4444',
                      color: '#ff4444',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,68,68,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    + ADD
                  </button>
                </div>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => removeInjury(injury.id)}
                style={{
                  padding: '8px 12px',
                  fontFamily: 'Chakra Petch, sans-serif',
                  fontSize: '26px',
                  backgroundColor: '#ff4444',
                  border: 'none',
                  color: '#030303',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  alignSelf: 'flex-start',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff6666';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff4444';
                }}
              >
                DELETE
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addInjury}
        style={{
          padding: '10px 16px',
          fontFamily: 'Chakra Petch, sans-serif',
          fontSize: '26px',
          backgroundColor: 'transparent',
          border: '1px solid #ff4444',
          color: '#ff4444',
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255,68,68,0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        + ADD INJURY
      </button>
    </div>
  );

  const renderPreferencesTab = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* Training Split */}
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
          Training Split
        </label>
        <input
          type="text"
          value={state.preferences.trainingSplit}
          onChange={(e) => handlePreferencesChange('trainingSplit', e.target.value)}
          style={{
            width: '100%',
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

      {/* Session Duration */}
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
          Session Duration (min)
        </label>
        <input
          type="number"
          value={state.preferences.sessionDuration}
          onChange={(e) => handlePreferencesChange('sessionDuration', parseInt(e.target.value))}
          style={{
            width: '100%',
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

      {/* Days Per Week */}
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
          Days Per Week
        </label>
        <input
          type="number"
          min="1"
          max="7"
          value={state.preferences.daysPerWeek}
          onChange={(e) => handlePreferencesChange('daysPerWeek', parseInt(e.target.value))}
          style={{
            width: '100%',
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

      {/* Equipment - full width — Smart Equipment System */}
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '15px', color: '#888', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Equipment Arsenal
        </label>
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '12px', fontFamily: 'Share Tech Mono, monospace' }}>
          Tap common gear below or type your own. Describe it however you want — Gunny will figure it out.
        </div>

        {/* Quick-add preset buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
          {['Full Commercial Gym', 'Barbell + Rack', 'Dumbbells', 'Kettlebells', 'Pull-up Bar', 'Resistance Bands', 'Cable Machine', 'Smith Machine', 'Bench (Flat/Incline)', 'Assault Bike / Rower', 'Treadmill', 'TRX / Suspension', 'Medicine Ball', 'Landmine Attachment', 'Leg Press', 'Hack Squat', 'Dip Station', 'Bodyweight Only'].map(preset => {
            const alreadyAdded = state.preferences.equipment.some(e => e.toLowerCase() === preset.toLowerCase());
            return (
              <button key={preset} onClick={() => {
                if (!alreadyAdded) {
                  setState(prev => ({ ...prev, preferences: { ...prev.preferences, equipment: [...prev.preferences.equipment, preset] } }));
                }
              }} style={{
                padding: '5px 10px', fontSize: '11px', fontFamily: 'Chakra Petch, sans-serif',
                backgroundColor: alreadyAdded ? 'rgba(0,255,65,0.12)' : 'transparent',
                border: `1px solid ${alreadyAdded ? '#00ff41' : 'rgba(0,255,65,0.12)'}`,
                color: alreadyAdded ? '#00ff41' : '#666', cursor: alreadyAdded ? 'default' : 'pointer',
                transition: 'all 0.2s', opacity: alreadyAdded ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!alreadyAdded) { e.currentTarget.style.borderColor = 'rgba(0,255,65,0.3)'; e.currentTarget.style.color = '#aaa'; } }}
              onMouseLeave={e => { if (!alreadyAdded) { e.currentTarget.style.borderColor = 'rgba(0,255,65,0.12)'; e.currentTarget.style.color = '#666'; } }}
              >{alreadyAdded ? '✓ ' : '+ '}{preset}</button>
            );
          })}
        </div>

        {/* Current equipment list */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {state.preferences.equipment.map((equip) => (
            <div key={equip} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', backgroundColor: 'rgba(0,255,65,0.04)', border: '1px solid #00ff41', borderRadius: '4px', fontFamily: 'Chakra Petch, sans-serif', fontSize: '12px', color: '#00ff41' }}>
              <span>{equip}</span>
              <button onClick={() => removeEquipment(equip)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '14px', padding: 0 }}>×</button>
            </div>
          ))}
        </div>

        {/* Custom equipment input with description support */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Type equipment name or describe it (e.g. 'the dual cable pulley machine')..."
            value={state.newEquipment}
            onChange={(e) => setState((prev) => ({ ...prev, newEquipment: e.target.value }))}
            onKeyPress={(e) => { if (e.key === 'Enter') addEquipment(); }}
            style={{ flex: 1, padding: '8px', fontFamily: 'Chakra Petch, sans-serif', fontSize: '13px', backgroundColor: 'rgba(0,255,65,0.02)', border: '1px solid rgba(0,255,65,0.06)', color: '#ddd', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(0,255,65,0.2)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(0,255,65,0.06)'; }}
          />
          <button onClick={addEquipment} style={{ padding: '8px 16px', fontFamily: 'Chakra Petch, sans-serif', fontSize: '13px', backgroundColor: 'transparent', border: '1px solid #00ff41', color: '#00ff41', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,255,65,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >+ ADD</button>
        </div>
        <div style={{ fontSize: '10px', color: '#444', marginTop: '6px', fontFamily: 'Share Tech Mono, monospace' }}>
          Don&apos;t know the name? Just describe it. &quot;The thing where you pull the bar down&quot; = Lat Pulldown. Gunny figures it out.
        </div>
      </div>

      {/* Weak Points - full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <label
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '15px',
            color: '#888',
            display: 'block',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          Weak Points
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {state.preferences.weakPoints.map((point) => (
            <div
              key={point}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                backgroundColor: 'transparent',
                border: '1px solid #ffb800',
                borderRadius: '4px',
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: '26px',
                color: '#ffb800',
              }}
            >
              <span>{point}</span>
              <button
                onClick={() => removeWeakPoint(point)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ff4444',
                  cursor: 'pointer',
                  fontSize: '26px',
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Add weak point..."
            value={state.newWeakPoint}
            onChange={(e) => setState((prev) => ({ ...prev, newWeakPoint: e.target.value }))}
            onKeyPress={(e) => {
              if (e.key === 'Enter') addWeakPoint();
            }}
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
          <button
            onClick={addWeakPoint}
            style={{
              padding: '8px 16px',
              fontFamily: 'Chakra Petch, sans-serif',
              fontSize: '26px',
              backgroundColor: 'transparent',
              border: '1px solid #ffb800',
              color: '#ffb800',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,184,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            + ADD
          </button>
        </div>
      </div>

      {/* Movements to Avoid - full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <label
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '15px',
            color: '#888',
            display: 'block',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          Movements to Avoid
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {state.preferences.movementsToAvoid.map((movement) => (
            <div
              key={movement}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                backgroundColor: 'transparent',
                border: '1px solid #ff4444',
                borderRadius: '4px',
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: '26px',
                color: '#ff4444',
              }}
            >
              <span>{movement}</span>
              <button
                onClick={() => removeMovementToAvoid(movement)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ff4444',
                  cursor: 'pointer',
                  fontSize: '26px',
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Add movement..."
            value={state.newMovementToAvoid}
            onChange={(e) => setState((prev) => ({ ...prev, newMovementToAvoid: e.target.value }))}
            onKeyPress={(e) => {
              if (e.key === 'Enter') addMovementToAvoid();
            }}
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
          <button
            onClick={addMovementToAvoid}
            style={{
              padding: '8px 16px',
              fontFamily: 'Chakra Petch, sans-serif',
              fontSize: '26px',
              backgroundColor: 'transparent',
              border: '1px solid #ff4444',
              color: '#ff4444',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,68,68,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            + ADD
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
        return renderPRBoardTab();
      case 'ANALYTICS':
        return <ProgressCharts operator={operator} />;
      case 'INJURIES':
        return renderInjuriesTab();
      case 'PREFERENCES':
        return renderPreferencesTab();
      case 'WEARABLES':
        return <WearableConnect operator={operator} onUpdateOperator={onUpdateOperator} />;
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
    PREFERENCES: '◇',
    WEARABLES: '◎',
  };

  const getTabLabels = (): Record<SubTab, string> => ({
    PROFILE: t('intel.profile'),
    NUTRITION: t('intel.nutrition'),
    PR_BOARD: t('intel.pr_board'),
    ANALYTICS: 'ANALYTICS',
    INJURIES: t('intel.injuries'),
    PREFERENCES: t('intel.preferences'),
    WEARABLES: 'WEARABLES',
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
      {/* Sidebar (desktop) / Top tabs (mobile) */}
      {isMobile ? (
        <div className="horizontal-scroll" style={{
          display: 'flex',
          overflowX: 'auto',
          borderBottom: '1px solid rgba(0,255,65,0.06)',
          background: 'rgba(8,8,8,0.5)',
          flexShrink: 0,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          gap: '0px',
        }}>
          {(['PROFILE', 'NUTRITION', 'PR_BOARD', 'ANALYTICS', 'INJURIES', 'PREFERENCES', 'WEARABLES'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 10px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #00ff41' : '2px solid transparent',
                  color: isActive ? '#00ff41' : '#777',
                  cursor: 'pointer',
                  fontFamily: 'Share Tech Mono, monospace',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  minHeight: '36px',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}
              >
                {getTabLabels()[tab]}
              </button>
            );
          })}
        </div>
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

          {(['PROFILE', 'NUTRITION', 'PR_BOARD', 'ANALYTICS', 'INJURIES', 'PREFERENCES', 'WEARABLES'] as const).map((tab) => {
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
        {/* Header with Save Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isMobile ? '10px 16px' : '12px 24px',
          borderBottom: '1px solid rgba(0,255,65,0.06)',
          background: 'linear-gradient(180deg, rgba(8,8,8,0.5) 0%, rgba(3,3,3,0.5) 100%)',
        }}>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '15px', color: '#666', letterSpacing: '1px' }}>
            {operator.callsign} // {activeTab.replace('_', ' ')}
          </div>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 18px',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '15px',
              backgroundColor: '#00ff41',
              border: 'none',
              color: '#030303',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontWeight: 800,
              transition: 'all 0.2s ease',
              minHeight: '36px',
            }}
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
