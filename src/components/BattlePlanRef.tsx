'use client';

import React, { useState } from 'react';
import { Sitrep, SitrepExercise, Operator } from '@/lib/types';
import { sitrepDayToWorkout } from '@/lib/workoutConverter';
import { getLocalDateStr } from '@/lib/dateUtils';

interface BattlePlanRefProps {
  sitrep: Sitrep;
  /** Which sections to show: 'all' | 'training' | 'nutrition' */
  focus?: 'all' | 'training' | 'nutrition';
  /** Compact mode — collapsed by default, expandable */
  compact?: boolean;
  /** Optional — needed for "Load to Planner" */
  operator?: Operator;
  onUpdateOperator?: (updated: Operator) => void;
}

export default function BattlePlanRef({ sitrep, focus = 'all', compact = false, operator, onUpdateOperator }: BattlePlanRefProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [activeSection, setActiveSection] = useState<'training' | 'nutrition'>(focus === 'nutrition' ? 'nutrition' : 'training');

  // Check if Day 1 workout already loaded in planner
  const todayStr = getLocalDateStr();
  const workoutAlreadyLoaded = !!operator?.workouts?.[todayStr];

  const handleLoadDay1 = () => {
    if (!sitrep.today || !operator || !onUpdateOperator) return;
    const workout = sitrepDayToWorkout(sitrep.today, todayStr);
    const updated = {
      ...operator,
      workouts: { ...operator.workouts, [todayStr]: workout },
    };
    onUpdateOperator(updated);
  };

  const showTraining = focus === 'all' || focus === 'training';
  const showNutrition = focus === 'all' || focus === 'nutrition';

  const s = {
    container: {
      background: '#0a0a0a', border: '1px solid rgba(0,255,65,0.12)', borderRadius: 8,
      marginBottom: 16, overflow: 'hidden',
    } as React.CSSProperties,
    header: {
      padding: '12px 16px', cursor: compact ? 'pointer' : 'default',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    } as React.CSSProperties,
    label: {
      fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#888',
      letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' as const,
    },
    card: {
      padding: 12, background: '#050505', border: '1px solid #1a1a1a',
      borderRadius: 6, marginBottom: 8,
    } as React.CSSProperties,
    macroBox: (color: string) => ({
      padding: '10px 6px', background: `${color}08`, border: `1px solid ${color}25`,
      borderRadius: 6, textAlign: 'center' as const,
    }),
    macroNum: (color: string) => ({
      fontFamily: 'Orbitron, sans-serif', fontSize: 16, color, fontWeight: 700 as const,
    }),
    macroLabel: { fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#555', marginTop: 2 },
    exerciseRow: {
      padding: '6px 10px', borderBottom: '1px solid #111',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    } as React.CSSProperties,
    tabBtn: (active: boolean) => ({
      flex: 1, padding: '8px 6px', fontFamily: 'Orbitron, sans-serif', fontSize: 9,
      fontWeight: 700 as const, background: active ? '#00ff4115' : 'transparent',
      color: active ? '#00ff41' : '#555', border: `1px solid ${active ? '#00ff4130' : '#1a1a1a'}`,
      borderRadius: 4, cursor: 'pointer', letterSpacing: 0.5,
    }),
  };

  const renderExercise = (ex: SitrepExercise, i: number) => (
    <div key={i} style={s.exerciseRow}>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12, color: '#ddd' }}>{i + 1}. {ex.name}</span>
        {ex.notes && <div style={{ fontSize: 9, color: '#555', marginTop: 1 }}>{ex.notes}</div>}
      </div>
      <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#00ff41' }}>
        {ex.sets}x{ex.reps}{ex.weight ? ` @ ${ex.weight}` : ''}
      </span>
    </div>
  );

  const today = sitrep.today;
  const np = sitrep.nutritionPlan;
  const tp = sitrep.trainingPlan;

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header} onClick={() => compact && setExpanded(!expanded)}>
        <div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#00ff41', letterSpacing: 1 }}>
            ⚔️ ACTIVE BATTLE PLAN
          </div>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#555', marginTop: 2 }}>
            Generated {new Date(sitrep.generatedDate).toLocaleDateString()} • {(sitrep.operatorLevel || 'beginner').toUpperCase()}
          </div>
        </div>
        {compact && (
          <span style={{ fontSize: 11, color: '#555' }}>{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Section tabs — only if showing both */}
          {showTraining && showNutrition && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button onClick={() => setActiveSection('training')} style={s.tabBtn(activeSection === 'training')}>
                🏋️ TRAINING
              </button>
              <button onClick={() => setActiveSection('nutrition')} style={s.tabBtn(activeSection === 'nutrition')}>
                🍽️ NUTRITION
              </button>
            </div>
          )}

          {/* TRAINING SECTION */}
          {((showTraining && activeSection === 'training') || (showTraining && !showNutrition)) && (
            <div>
              {/* Training Plan Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
                <div style={{ textAlign: 'center', padding: 8, background: '#050505', borderRadius: 4, border: '1px solid #1a1a1a' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, color: '#00ff41' }}>{tp?.daysPerWeek || 0}</div>
                  <div style={{ fontSize: 8, color: '#555' }}>DAYS/WK</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: '#050505', borderRadius: 4, border: '1px solid #1a1a1a' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#00ff41' }}>{tp?.split || 'TBD'}</div>
                  <div style={{ fontSize: 8, color: '#555' }}>SPLIT</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: '#050505', borderRadius: 4, border: '1px solid #1a1a1a' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#facc15' }}>{tp?.sessionDuration || 'TBD'}</div>
                  <div style={{ fontSize: 8, color: '#555' }}>DURATION</div>
                </div>
              </div>

              {/* Progression + Deload */}
              <div style={s.card}>
                <div style={s.label}>PROGRESSION</div>
                <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5, marginBottom: 6 }}>{tp?.progressionStrategy || ''}</div>
                <div style={s.label}>DELOAD</div>
                <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5 }}>{tp?.deloadProtocol || ''}</div>
              </div>

              {/* Today's Workout from SITREP */}
              {today && (
                <div style={s.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={s.label}>DAY 1 — {(today.dayName || '').toUpperCase()}: {today.title}</div>
                    {today.duration && <span style={{ fontSize: 9, color: '#555' }}>{today.duration}</span>}
                  </div>
                  {today.warmup && <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>Warmup: {today.warmup}</div>}
                  {(today.exercises || []).map((ex, i) => renderExercise(ex, i))}
                  {today.cooldown && <div style={{ fontSize: 10, color: '#888', marginTop: 6 }}>Cooldown: {today.cooldown}</div>}

                  {/* Load Day 1 to Planner */}
                  {operator && onUpdateOperator && (
                    <button
                      onClick={handleLoadDay1}
                      disabled={workoutAlreadyLoaded}
                      style={{
                        width: '100%', marginTop: 8, padding: 8,
                        background: workoutAlreadyLoaded ? 'rgba(0,255,65,0.08)' : '#00ff41',
                        color: workoutAlreadyLoaded ? '#00ff41' : '#000',
                        border: workoutAlreadyLoaded ? '1px solid rgba(0,255,65,0.2)' : 'none',
                        borderRadius: 4, cursor: workoutAlreadyLoaded ? 'default' : 'pointer',
                        fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 1,
                      }}
                    >
                      {workoutAlreadyLoaded ? '✓ LOADED IN PLANNER' : '⚔️ LOAD DAY 1 TO PLANNER'}
                    </button>
                  )}
                </div>
              )}

              {/* Priority Focus */}
              {(sitrep.priorityFocus || []).length > 0 && (
                <div style={s.card}>
                  <div style={s.label}>PRIORITY FOCUS</div>
                  {sitrep.priorityFocus.map((p, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#ccc', padding: '3px 0' }}>
                      <span style={{ color: '#00ff41', marginRight: 6 }}>{i + 1}.</span>{p}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NUTRITION SECTION */}
          {((showNutrition && activeSection === 'nutrition') || (showNutrition && !showTraining)) && np && (
            <div>
              {/* Macro Targets */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                <div style={s.macroBox('#ffb800')}>
                  <div style={s.macroNum('#ffb800')}>{np.dailyCalories}</div>
                  <div style={s.macroLabel}>CAL</div>
                </div>
                <div style={s.macroBox('#00ff41')}>
                  <div style={s.macroNum('#00ff41')}>{np.protein}g</div>
                  <div style={s.macroLabel}>PROTEIN</div>
                </div>
                <div style={s.macroBox('#4ade80')}>
                  <div style={s.macroNum('#4ade80')}>{np.carbs}g</div>
                  <div style={s.macroLabel}>CARBS</div>
                </div>
                <div style={s.macroBox('#ff6b35')}>
                  <div style={s.macroNum('#ff6b35')}>{np.fat}g</div>
                  <div style={s.macroLabel}>FAT</div>
                </div>
              </div>

              {/* Strategy */}
              <div style={s.card}>
                <div style={s.label}>NUTRITION STRATEGY</div>
                <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5, marginBottom: 6 }}>{np.approach}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
                  <span style={{ color: '#00ff41' }}>💧 {np.hydrationOz}oz/day</span>
                  <span style={{ color: '#facc15' }}>🍽️ {np.mealsPerDay} meals/day</span>
                </div>
              </div>

              {/* Sample Day */}
              {(np.sampleDay || []).length > 0 && (
                <div style={s.card}>
                  <div style={s.label}>SAMPLE DAY</div>
                  {np.sampleDay.map((meal, i) => (
                    <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #111' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#facc15' }}>{meal.time} — {meal.name}</span>
                        <span style={{ fontSize: 9, color: '#888' }}>{meal.calories} cal</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>{meal.description}</div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 9 }}>
                        <span style={{ color: '#00ff41' }}>{meal.protein}g P</span>
                        <span style={{ color: '#4ade80' }}>{meal.carbs}g C</span>
                        <span style={{ color: '#ff6b35' }}>{meal.fat}g F</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Gunny Notes */}
              {np.notes && (
                <div style={{ ...s.card, borderColor: 'rgba(250,204,21,0.15)' }}>
                  <div style={{ ...s.label, color: '#facc15' }}>GUNNY NOTES</div>
                  <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5 }}>{np.notes}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
