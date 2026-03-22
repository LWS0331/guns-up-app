'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Operator, Meal, PRRecord, Injury, formatHeightInput } from '@/lib/types';
import WearableConnect from '@/components/WearableConnect';
import ProgressCharts from '@/components/ProgressCharts';
import { FOOD_DB } from '@/data/foods';
import { notifyPRAlert, loadNotificationPrefs } from '@/lib/notifications';

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

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayStr = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
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
      age: operator.profile.age,
      height: operator.profile.height,
      weight: operator.profile.weight,
      bodyFat: operator.profile.bodyFat,
      trainingAge: parseInt(operator.profile.trainingAge) || 0,
      goals: convertGoalsToObjects(operator.profile.goals || []),
      readinessScore: operator.profile.readiness || 75,
      sleepQuality: operator.profile.sleep || 7,
      stressLevel: operator.profile.stress || 5,
      callsign: operator.callsign,
      pin: operator.pin,
    },
    nutrition: {
      calorieTarget: operator.nutrition.targets.calories || 2500,
      proteinTarget: operator.nutrition.targets.protein || 180,
      carbsTarget: operator.nutrition.targets.carbs || 300,
      fatTarget: operator.nutrition.targets.fat || 80,
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
      trainingSplit: operator.preferences.split || 'PPL',
      equipment: operator.preferences.equipment || [],
      sessionDuration: operator.preferences.sessionDuration || 60,
      daysPerWeek: operator.preferences.daysPerWeek || 6,
      weakPoints: operator.preferences.weakPoints || [],
      movementsToAvoid: operator.preferences.avoidMovements || [],
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
      date: new Date().toISOString().split('T')[0],
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

  // Calculate today's meal totals
  const todaysMeals = state.nutrition.mealLogs.filter((meal) => {
    const mealDate = new Date(meal.time).toDateString();
    const today = new Date().toDateString();
    return mealDate === today;
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
  const [quickFoodResult, setQuickFoodResult] = useState<{ name: string; calories: number; protein: number; carbs: number; fat: number } | null>(null);

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
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
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

  const renderNutritionTab = () => (
    <div>
      {/* QUICK LOG — Chat-style food input */}
      <div style={{ marginBottom: 24, padding: 16, backgroundColor: 'rgba(224, 64, 251, 0.03)', border: '1px solid rgba(224, 64, 251, 0.15)', borderRadius: 4 }}>
        <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#e040fb', marginBottom: 12, letterSpacing: 1 }}>
          QUICK LOG
        </h3>
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
              flex: 1, padding: '10px 12px', backgroundColor: '#0a0a0a', border: '1px solid rgba(224, 64, 251, 0.3)',
              color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace", fontSize: 14, borderRadius: 4, outline: 'none',
            }}
          />
          <button onClick={handleQuickFoodLog} style={{
            padding: '10px 16px', backgroundColor: '#e040fb', color: '#000', border: 'none',
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
              <span style={{ color: '#00bcd4' }}>{quickFoodResult.protein}g P</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
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
            <div style={{ display: 'flex', gap: '4px' }}>
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
            <div style={{ display: 'flex', gap: '4px' }}>
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
            <div style={{ display: 'flex', gap: '4px' }}>
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
            <div style={{ display: 'flex', gap: '4px' }}>
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
            <span style={{ fontFamily: 'Share Tech Mono, monospace', color: '#00bcd4' }}>
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
                backgroundColor: '#00bcd4',
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

        {/* Log Form */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr) auto',
            gap: '8px',
            marginBottom: '16px',
            alignItems: 'flex-end',
          }}
        >
          <input
            type="text"
            placeholder="Meal name"
            value={state.nutrition.mealName}
            onChange={(e) => handleNutritionChange('mealName', e.target.value)}
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
            ADD
          </button>
        </div>

        {/* Meals List */}
        <div style={{ marginBottom: '16px' }}>
          {todaysMeals.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '16px',
                color: '#888',
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: '15px',
              }}
            >
              No meals logged today
            </div>
          ) : (
            todaysMeals.map((meal) => (
              <div
                key={meal.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  borderBottom: '1px solid rgba(0,255,65,0.06)',
                  fontFamily: 'Chakra Petch, sans-serif',
                  fontSize: '26px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#ddd', marginBottom: '4px' }}>{meal.name}</div>
                  <div style={{ color: '#888', fontSize: '15px' }}>
                    {meal.calories} cal | P: {meal.protein}g C: {meal.carbs}g F: {meal.fat}g
                  </div>
                </div>
                <div
                  style={{
                    color: '#888',
                    marginRight: '16px',
                    fontFamily: 'Share Tech Mono, monospace',
                    fontSize: '15px',
                  }}
                >
                  {new Date(meal.time).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <button
                  onClick={() => removeMeal(meal.id)}
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
            ))
          )}
        </div>

        {/* Totals Summary */}
        {todaysMeals.length > 0 && (
          <div
            style={{
              padding: '10px',
              backgroundColor: 'rgba(0,255,65,0.04)',
              borderRadius: '4px',
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: '26px',
              color: '#00ff41',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ color: '#888', fontSize: '15px', marginBottom: '2px' }}>
                CALORIES
              </div>
              {mealTotals.calories}
            </div>
            <div>
              <div style={{ color: '#888', fontSize: '15px', marginBottom: '2px' }}>
                PROTEIN
              </div>
              {mealTotals.protein}g
            </div>
            <div>
              <div style={{ color: '#888', fontSize: '15px', marginBottom: '2px' }}>CARBS</div>
              {mealTotals.carbs}g
            </div>
            <div>
              <div style={{ color: '#888', fontSize: '15px', marginBottom: '2px' }}>FAT</div>
              {mealTotals.fat}g
            </div>
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

  const [prViewMode, setPrViewMode] = useState<'tracker' | 'table'>('tracker');

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

  const renderPRBoardTab = () => {
    const exerciseGroups = getExerciseGroups();
    const groupKeys = Object.keys(exerciseGroups);

    return (
      <div>
        {/* View toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setPrViewMode('tracker')} style={{
            padding: '6px 14px', fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700,
            background: prViewMode === 'tracker' ? '#00ff41' : '#0a0a0a',
            color: prViewMode === 'tracker' ? '#000' : '#888',
            border: `1px solid ${prViewMode === 'tracker' ? '#00ff41' : '#333'}`,
            borderRadius: 4, cursor: 'pointer', letterSpacing: 1,
          }}>PHASE TRACKER</button>
          <button onClick={() => setPrViewMode('table')} style={{
            padding: '6px 14px', fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700,
            background: prViewMode === 'table' ? '#00ff41' : '#0a0a0a',
            color: prViewMode === 'table' ? '#000' : '#888',
            border: `1px solid ${prViewMode === 'table' ? '#00ff41' : '#333'}`,
            borderRadius: 4, cursor: 'pointer', letterSpacing: 1,
          }}>TABLE VIEW</button>
        </div>

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
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#00bcd4' }}>
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
                          style={{ width: '50px', padding: '4px', fontFamily: 'Share Tech Mono, monospace', fontSize: '14px', backgroundColor: 'transparent', border: 'none', color: '#00bcd4', textAlign: 'right', outline: 'none' }} />
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

      {/* Equipment - full width */}
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
          Equipment
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {state.preferences.equipment.map((equip) => (
            <div
              key={equip}
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
              <span>{equip}</span>
              <button
                onClick={() => removeEquipment(equip)}
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
            placeholder="Add equipment..."
            value={state.newEquipment}
            onChange={(e) => setState((prev) => ({ ...prev, newEquipment: e.target.value }))}
            onKeyPress={(e) => {
              if (e.key === 'Enter') addEquipment();
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
            onClick={addEquipment}
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
