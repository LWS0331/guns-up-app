'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Operator, Meal, PRRecord, Injury } from '@/lib/types';

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
}

type SubTab = 'PROFILE' | 'NUTRITION' | 'PR_BOARD' | 'INJURIES' | 'PREFERENCES';

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

const IntelCenter: React.FC<IntelCenterProps> = ({ operator, currentUser, onUpdateOperator }) => {
  const isAdmin = currentUser?.role === 'admin';
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
          readOnly
          value={state.profile.name}
          style={{
            width: '100%',
            padding: '8px',
            fontFamily: 'Chakra Petch, sans-serif',
            fontSize: '15px',
            backgroundColor: 'rgba(0,255,65,0.02)',
            border: '1px solid rgba(0,255,65,0.06)',
            color: '#ddd',
            cursor: 'not-allowed',
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
    </div>
  );

  const renderNutritionTab = () => (
    <div>
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

  const renderPRBoardTab = () => (
    <div>
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          marginBottom: '16px',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'Chakra Petch, sans-serif',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(0,255,65,0.15)' }}>
              <th
                style={{
                  padding: '12px',
                  textAlign: 'left',
                  fontFamily: 'Chakra Petch, sans-serif',
                  fontSize: '15px',
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 'normal',
                }}
              >
                EXERCISE
              </th>
              <th
                style={{
                  padding: '12px',
                  textAlign: 'right',
                  fontFamily: 'Chakra Petch, sans-serif',
                  fontSize: '15px',
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 'normal',
                }}
              >
                WEIGHT
              </th>
              <th
                style={{
                  padding: '12px',
                  textAlign: 'right',
                  fontFamily: 'Chakra Petch, sans-serif',
                  fontSize: '15px',
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 'normal',
                }}
              >
                REPS
              </th>
              <th
                style={{
                  padding: '12px',
                  textAlign: 'right',
                  fontFamily: 'Chakra Petch, sans-serif',
                  fontSize: '15px',
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 'normal',
                }}
              >
                DATE
              </th>
              <th
                style={{
                  padding: '12px',
                  textAlign: 'left',
                  fontFamily: 'Chakra Petch, sans-serif',
                  fontSize: '15px',
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 'normal',
                }}
              >
                NOTES
              </th>
              <th style={{ padding: '12px', width: '32px' }} />
            </tr>
          </thead>
          <tbody>
            {state.prBoard.map((pr, index) => {
              const prDate = new Date(pr.date);
              const isRecent =
                (Date.now() - prDate.getTime()) / (1000 * 60 * 60 * 24) < 7;

              return (
                <tr
                  key={pr.id}
                  style={{
                    borderBottom: '1px solid rgba(0,255,65,0.06)',
                    borderLeft: isRecent ? '2px solid #00ff41' : '2px solid transparent',
                  }}
                >
                  <td style={{ padding: '12px' }}>
                    <input
                      type="text"
                      value={pr.exercise}
                      onChange={(e) => updatePR(index, 'exercise', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontFamily: 'Chakra Petch, sans-serif',
                        fontSize: '15px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#ddd',
                        outline: 'none',
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <input
                      type="number"
                      value={pr.weight}
                      onChange={(e) => updatePR(index, 'weight', parseInt(e.target.value))}
                      style={{
                        width: '80px',
                        padding: '6px',
                        fontFamily: 'Share Tech Mono, monospace',
                        fontSize: '15px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#00ff41',
                        textAlign: 'right',
                        outline: 'none',
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <input
                      type="number"
                      value={pr.reps}
                      onChange={(e) => updatePR(index, 'reps', parseInt(e.target.value))}
                      style={{
                        width: '60px',
                        padding: '6px',
                        fontFamily: 'Share Tech Mono, monospace',
                        fontSize: '15px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#00bcd4',
                        textAlign: 'right',
                        outline: 'none',
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <input
                      type="date"
                      value={pr.date}
                      onChange={(e) => updatePR(index, 'date', e.target.value)}
                      style={{
                        padding: '6px',
                        fontFamily: 'Share Tech Mono, monospace',
                        fontSize: '26px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#888',
                        outline: 'none',
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="text"
                      value={pr.notes}
                      onChange={(e) => updatePR(index, 'notes', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontFamily: 'Chakra Petch, sans-serif',
                        fontSize: '26px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#888',
                        outline: 'none',
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      onClick={() => removePR(pr.id)}
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={addPR}
        style={{
          padding: '10px 16px',
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
        + ADD PR
      </button>
    </div>
  );

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
      case 'INJURIES':
        return renderInjuriesTab();
      case 'PREFERENCES':
        return renderPreferencesTab();
      default:
        return null;
    }
  };

  const tabIcons: Record<SubTab, string> = {
    PROFILE: '◆',
    NUTRITION: '◈',
    PR_BOARD: '▶',
    INJURIES: '▦',
    PREFERENCES: '◇',
  };

  const getTabLabels = (): Record<SubTab, string> => ({
    PROFILE: t('intel.profile'),
    NUTRITION: t('intel.nutrition'),
    PR_BOARD: t('intel.pr_board'),
    INJURIES: t('intel.injuries'),
    PREFERENCES: t('intel.preferences'),
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
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          borderBottom: '1px solid rgba(0,255,65,0.06)',
          background: 'rgba(8,8,8,0.5)',
          flexShrink: 0,
          WebkitOverflowScrolling: 'touch',
        }}>
          {(['PROFILE', 'NUTRITION', 'PR_BOARD', 'INJURIES', 'PREFERENCES'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #00ff41' : '2px solid transparent',
                  color: isActive ? '#00ff41' : '#777',
                  cursor: 'pointer',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '15px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  whiteSpace: 'nowrap',
                  minHeight: '40px',
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

          {(['PROFILE', 'NUTRITION', 'PR_BOARD', 'INJURIES', 'PREFERENCES'] as const).map((tab) => {
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
