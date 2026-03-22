'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Operator, DailyBrief as DailyBriefType, SitrepExercise } from '@/lib/types';

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

      const yesterdayData = {
        workoutCompleted: !!yesterdayWorkout?.completed,
        workoutTitle: yesterdayWorkout?.title || null,
        mealsLogged: yesterdayMeals.length,
        mealTotals,
        targetCalories: operator.nutrition?.targets?.calories || operator.sitrep.nutritionPlan?.dailyCalories || 2000,
        targetProtein: operator.nutrition?.targets?.protein || operator.sitrep.nutritionPlan?.protein || 150,
      };

      const operatorContext = {
        callsign: operator.callsign,
        fitnessLevel: operator.fitnessLevel || operator.intake?.fitnessLevel || 'beginner',
        goals: operator.profile?.goals,
        weight: operator.profile?.weight,
      };

      const res = await fetch('/api/gunny/daily-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorContext,
          sitrep: operator.sitrep,
          yesterdayData,
          todayDateStr: todayStr,
          tier: operator.tier,
        }),
      });

      const data = await res.json();
      if (data.success && data.brief) {
        setBrief(data.brief);
        // Save to operator
        const updated = { ...operator, dailyBrief: data.brief };
        onUpdateOperator(updated);
      }
    } catch (err) {
      console.error('Daily brief generation failed:', err);
    }
    setLoading(false);
  }, [operator, onUpdateOperator]);

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
            </div>
          ) : (
            <div style={{ marginBottom: 12, padding: 12, background: '#0a0808', border: '1px solid rgba(255,107,53,0.15)', borderRadius: 4, textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#ff6b35' }}>REST DAY</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Recovery is part of the mission. Stretch, hydrate, sleep.</div>
            </div>
          )}

          {/* Nutrition Reminder */}
          <div style={{ padding: 10, background: 'rgba(0,188,212,0.05)', border: '1px solid rgba(0,188,212,0.15)', borderRadius: 4, marginBottom: 12 }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#00bcd4', letterSpacing: 1, marginBottom: 4 }}>NUTRITION</div>
            <div style={{ fontSize: 11, color: '#ccc' }}>{brief.nutritionReminder}</div>
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
