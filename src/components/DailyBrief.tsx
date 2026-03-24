'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Operator, DailyBrief as DailyBriefType, SitrepExercise } from '@/lib/types';
import { sitrepDayToWorkout } from '@/lib/workoutConverter';

interface DailyBriefProps {
  operator: Operator;
  onUpdateOperator: (updated: Operator) => void;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DailyBriefComponent({ operator, onUpdateOperator }: DailyBriefProps) {
  const [brief, setBrief] = useState<DailyBriefType | null>(operator.dailyBrief?.date === getTodayStr() ? operator.dailyBrief : null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [workoutLoaded, setWorkoutLoaded] = useState(false);
  const [nutritionInput, setNutritionInput] = useState('');
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [adaptedMealPlan, setAdaptedMealPlan] = useState<string | null>(null);

  // Ref to always read latest operator props (avoids stale closure in async callbacks)
  const operatorRef = useRef(operator);
  operatorRef.current = operator;

  const generateBrief = useCallback(async () => {
    if (!operator.sitrep) return;
    setLoading(true);

    try {
      const todayStr = getTodayStr();
      const yesterdayStr = getYesterdayStr();

      // Gather yesterday's data
      const yesterdayWorkout = operator.workouts?.[yesterdayStr];
      const yesterdayMeals = operator.nutrition?.meals?.[yesterdayStr] || [];
      const mealTotals = yesterdayMeals.reduce(
        (acc: { calories: number; protein: number; carbs: number; fat: number }, m: { calories: number; protein: number; carbs: number; fat: number }) => ({
          calories: acc.calories + m.calories,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fat: acc.fat + m.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      const nPlan = operator.sitrep?.nutritionPlan;
      const yesterdayData = {
        workoutCompleted: !!yesterdayWorkout?.completed,
        workoutTitle: yesterdayWorkout?.title || null,
        mealsLogged: yesterdayMeals.length,
        mealTotals,
        targetCalories: operator.nutrition?.targets?.calories || nPlan?.dailyCalories || 2000,
        targetProtein: operator.nutrition?.targets?.protein || nPlan?.protein || 150,
        targetCarbs: operator.nutrition?.targets?.carbs || nPlan?.carbs || 200,
        targetFat: operator.nutrition?.targets?.fat || nPlan?.fat || 60,
      };

      // Full operator context — gives the AI complete picture for smarter adaptation
      const intake = operator.intake;
      const prof = operator.profile;
      const operatorContext = {
        callsign: operator.callsign,
        name: operator.name,
        fitnessLevel: operator.fitnessLevel || intake?.fitnessLevel || 'beginner',
        goals: prof?.goals,
        weight: prof?.weight,
        height: prof?.height,
        age: prof?.age,
        bodyFat: prof?.bodyFat,
        injuries: operator.injuries?.map((inj: { name: string; status: string; notes?: string; restrictions?: string[] }) => ({
          name: inj.name,
          status: inj.status,
          notes: inj.notes,
          restrictions: inj.restrictions,
        })),
        injuryNotes: intake?.injuryNotes,
        availableEquipment: intake?.availableEquipment || operator.preferences?.equipment,
        currentDiet: intake?.currentDiet,
        mealsPerDay: intake?.mealsPerDay || nPlan?.mealsPerDay,
        proteinPriority: intake?.proteinPriority,
        supplements: intake?.supplements,
        dietaryRestrictions: intake?.dietaryRestrictions,
        sleepQuality: intake?.sleepQuality || prof?.sleep,
        stressLevel: intake?.stressLevel || prof?.stress,
        prs: operator.prs?.map((pr: { exercise: string; weight: number }) => ({ exercise: pr.exercise, weight: pr.weight })),
      };

      const res = await fetch('/api/gunny/daily-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorContext,
          sitrep: operator.sitrep,
          yesterdayData,
          todayDateStr: todayStr,
          todayDayName: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          tier: operator.tier,
        }),
      });

      const data = await res.json();
      if (data.success && data.brief) {
        setBrief(data.brief);
        // Save to operator — use ref for latest state to avoid overwriting concurrent changes
        const freshOp = operatorRef.current;
        const updated = { ...freshOp, dailyBrief: data.brief };
        onUpdateOperator(updated);
      }
    } catch (err) {
    }
    setLoading(false);
  }, [operator, onUpdateOperator]);

  // Check if today's workout already loaded in planner
  useEffect(() => {
    const todayStr = getTodayStr();
    if (operator.workouts?.[todayStr]) {
      setWorkoutLoaded(true);
    }
  }, [operator.workouts]);

  const handleLoadWorkout = useCallback(() => {
    if (!brief?.workout) return;
    const todayStr = getTodayStr();
    const workout = sitrepDayToWorkout(brief.workout, todayStr);
    const freshOp = operatorRef.current;
    const updated = {
      ...freshOp,
      workouts: { ...freshOp.workouts, [todayStr]: workout },
    };
    onUpdateOperator(updated);
    setWorkoutLoaded(true);
  }, [brief, onUpdateOperator]);

  const handleNutritionCoach = useCallback(async () => {
    if (!nutritionInput.trim() || !operator.sitrep) return;
    setNutritionLoading(true);
    try {
      const np = operator.sitrep.nutritionPlan;
      const res = await fetch('/api/gunny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', text: `I have these ingredients/foods available: ${nutritionInput}\n\nBuild me a meal plan for today using ONLY what I have. My targets: ${np?.dailyCalories} cal, ${np?.protein}g protein, ${np?.carbs}g carbs, ${np?.fat}g fat, ${np?.mealsPerDay} meals. Be specific with portions and macros per meal. Keep it short and actionable.` },
          ],
          operatorContext: { callsign: operator.callsign, fitnessLevel: operator.fitnessLevel || 'beginner' },
          tier: operator.tier,
          mode: 'assistant',
        }),
      });
      const data = await res.json();
      setAdaptedMealPlan(data.response || data.message || data.text || 'Could not generate meal plan.');
    } catch {
      setAdaptedMealPlan('Failed to generate meal plan. Try again.');
    }
    setNutritionLoading(false);
  }, [nutritionInput, operator]);

  // Auto-generate on mount if no brief for today
  useEffect(() => {
    if (!brief && operator.sitrep && !loading) {
      generateBrief();
    }
  }, [brief, operator.sitrep, loading, generateBrief]);

  if (!operator.sitrep) return null;

  if (loading && !brief) {
    return (
      <div style={{
        padding: 20, background: '#0a0a0a', border: '1px solid rgba(0,255,65,0.1)', borderRadius: 8, marginBottom: 16,
        textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#00ff41', letterSpacing: 1, marginBottom: 8 }}>
          GENERATING DAILY BRIEF...
        </div>
        <div style={{ fontSize: 10, color: '#555' }}>Gunny is reviewing your data</div>
      </div>
    );
  }

  if (!brief) return null;

  const renderExercise = (ex: SitrepExercise, i: number) => (
    <div key={i} style={{
      padding: '6px 0', borderBottom: '1px solid #111',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <span style={{ fontSize: 12, color: '#e0e0e0' }}>{ex.name}</span>
        {ex.notes && <div style={{ fontSize: 9, color: '#555' }}>{ex.notes}</div>}
      </div>
      <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#00ff41' }}>
        {ex.sets}x{ex.reps}{ex.weight ? ` @ ${ex.weight}` : ''}
      </span>
    </div>
  );

  const compColor = (brief.complianceScore || 0) >= 80 ? '#00ff41' : (brief.complianceScore || 0) >= 50 ? '#facc15' : '#ff6b35';

  return (
    <div style={{
      background: '#0a0a0a', border: '1px solid rgba(0,255,65,0.15)', borderRadius: 8, marginBottom: 16, overflow: 'hidden',
    }}>
      {/* Header — always visible */}
      <div style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#00ff41', letterSpacing: 1 }}>
            ⚔️ DAILY BRIEF
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {brief.complianceScore != null && (
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: compColor }}>
                {brief.complianceScore}% COMPLIANCE
              </span>
            )}
            {brief.streakDays != null && brief.streakDays > 0 && (
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#facc15' }}>
                🔥 {brief.streakDays}d streak
              </span>
            )}
            <span style={{ fontSize: 12, color: '#555' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Greeting */}
        <div style={{ fontSize: 13, color: '#facc15', marginBottom: 6, fontStyle: 'italic' }}>
          &ldquo;{brief.greeting}&rdquo;
        </div>

        {/* Today's Focus */}
        <div style={{ fontSize: 12, color: '#ccc' }}>
          {brief.todaysFocus}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #1a1a1a' }}>
          {/* Adjustments */}
          {(brief.adjustments || []).length > 0 && (
            <div style={{ marginTop: 12, marginBottom: 12, padding: 10, background: 'rgba(250,204,21,0.05)', border: '1px solid rgba(250,204,21,0.15)', borderRadius: 4 }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#facc15', letterSpacing: 1, marginBottom: 4 }}>ADJUSTMENTS</div>
              {brief.adjustments.map((a, i) => (
                <div key={i} style={{ fontSize: 11, color: '#ccc', padding: '2px 0' }}>• {a}</div>
              ))}
            </div>
          )}

          {/* Today's Workout */}
          {brief.workout ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#00ff41', letterSpacing: 1 }}>
                  TODAY&apos;S WORKOUT — {brief.workout.title}
                </div>
                {brief.workout.duration && (
                  <span style={{ fontSize: 9, color: '#555' }}>{brief.workout.duration}</span>
                )}
              </div>
              {brief.workout.warmup && (
                <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>Warmup: {brief.workout.warmup}</div>
              )}
              {(brief.workout.exercises || []).map((ex, i) => renderExercise(ex, i))}
              {brief.workout.cooldown && (
                <div style={{ fontSize: 10, color: '#888', marginTop: 6 }}>Cooldown: {brief.workout.cooldown}</div>
              )}

              {/* Load to Planner button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleLoadWorkout(); }}
                disabled={workoutLoaded}
                style={{
                  width: '100%', marginTop: 10, padding: 10,
                  background: workoutLoaded ? 'rgba(0,255,65,0.08)' : '#00ff41',
                  color: workoutLoaded ? '#00ff41' : '#000',
                  border: workoutLoaded ? '1px solid rgba(0,255,65,0.2)' : 'none',
                  borderRadius: 4, cursor: workoutLoaded ? 'default' : 'pointer',
                  fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 1,
                }}
              >
                {workoutLoaded ? '✓ LOADED IN PLANNER' : '⚔️ LOAD WORKOUT TO PLANNER'}
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: 12, padding: 12, background: '#0a0808', border: '1px solid rgba(255,107,53,0.15)', borderRadius: 4, textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#ff6b35' }}>REST DAY</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Recovery is part of the mission. Stretch, hydrate, sleep.</div>
            </div>
          )}

          {/* Nutrition Reminder */}
          <div style={{ padding: 10, background: 'rgba(0,255,65,0.05)', border: '1px solid rgba(0,255,65,0.15)', borderRadius: 4, marginBottom: 12 }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#00ff41', letterSpacing: 1, marginBottom: 4 }}>NUTRITION</div>
            <div style={{ fontSize: 11, color: '#ccc' }}>{brief.nutritionReminder}</div>
          </div>

          {/* Nutrition Coaching — "What do you have?" */}
          <div style={{ padding: 12, background: 'rgba(250,204,21,0.03)', border: '1px solid rgba(250,204,21,0.12)', borderRadius: 4, marginBottom: 12 }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#facc15', letterSpacing: 1, marginBottom: 6 }}>
              🍽️ WHAT&apos;S IN YOUR KITCHEN?
            </div>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>
              Tell Gunny what ingredients you have — he&apos;ll build today&apos;s meals with exact portions to hit your macros.
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={nutritionInput}
                onChange={e => setNutritionInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNutritionCoach()}
                placeholder="e.g. chicken breast, rice, eggs, broccoli, olive oil..."
                style={{
                  flex: 1, padding: '8px 10px', background: '#0a0a0a', border: '1px solid #333',
                  borderRadius: 4, color: '#ddd', fontFamily: 'Share Tech Mono, monospace', fontSize: 11,
                  outline: 'none',
                }}
                onClick={e => e.stopPropagation()}
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleNutritionCoach(); }}
                disabled={nutritionLoading || !nutritionInput.trim()}
                style={{
                  padding: '8px 14px', background: nutritionLoading ? '#333' : '#facc15',
                  color: '#000', border: 'none', borderRadius: 4, cursor: nutritionLoading ? 'default' : 'pointer',
                  fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700,
                }}
              >
                {nutritionLoading ? '...' : 'ADAPT'}
              </button>
            </div>

            {/* Adapted Meal Plan Response */}
            {adaptedMealPlan && (
              <div style={{ marginTop: 10, padding: 10, background: '#0a0a0a', border: '1px solid rgba(0,255,65,0.1)', borderRadius: 4 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#00ff41', letterSpacing: 1, marginBottom: 6 }}>
                  GUNNY&apos;S ADAPTED MEAL PLAN
                </div>
                <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {adaptedMealPlan}
                </div>
              </div>
            )}
          </div>

          {/* Motivation */}
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 12, color: '#00ff41', fontStyle: 'italic' }}>
              &ldquo;{brief.motivation}&rdquo;
            </div>
            <div style={{ fontSize: 9, color: '#555', marginTop: 4 }}>— GUNNY AI</div>
          </div>

          {/* Refresh button */}
          <button onClick={(e) => { e.stopPropagation(); generateBrief(); }} disabled={loading}
            style={{
              width: '100%', padding: 8, background: 'transparent', border: '1px solid #333',
              color: '#666', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, borderRadius: 4,
              cursor: loading ? 'default' : 'pointer',
            }}>
            {loading ? 'REFRESHING...' : '↻ REFRESH BRIEF'}
          </button>
        </div>
      )}
    </div>
  );
}
