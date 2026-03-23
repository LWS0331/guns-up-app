'use client';

import React, { useState } from 'react';
import { Sitrep, SitrepExercise } from '@/lib/types';

interface SitrepViewProps {
  sitrep: Sitrep;
  callsign: string;
  onAccept: () => void;
  onRegenerate: () => void;
  loading?: boolean;
}

export default function SitrepView({ sitrep, callsign, onAccept, onRegenerate, loading }: SitrepViewProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'nutrition' | 'training'>('overview');

  const s = {
    container: { width: '100%', maxWidth: 640, margin: '0 auto', padding: '20px', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace" } as React.CSSProperties,
    header: { textAlign: 'center' as const, marginBottom: 24 },
    title: { fontFamily: 'Orbitron, sans-serif', fontSize: 20, color: '#00ff41', letterSpacing: 3, marginBottom: 4 },
    subtitle: { fontSize: 11, color: '#666', letterSpacing: 1 },
    sectionBtn: (active: boolean) => ({
      flex: 1, padding: '10px 8px', fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700 as const,
      background: active ? '#00ff41' : '#0a0a0a', color: active ? '#000' : '#666',
      border: `1px solid ${active ? '#00ff41' : '#222'}`, borderRadius: 4, cursor: 'pointer', letterSpacing: 1,
      transition: 'all 0.2s',
    }),
    card: { padding: 16, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, marginBottom: 12 } as React.CSSProperties,
    cardHighlight: { padding: 16, background: '#0a1a0a', border: '1px solid rgba(0,255,65,0.2)', borderRadius: 8, marginBottom: 12 } as React.CSSProperties,
    label: { fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#888', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' as const },
    value: { fontSize: 14, color: '#e0e0e0', lineHeight: 1.6 },
    macroGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' as const, marginBottom: 16 } as React.CSSProperties,
    macroBox: (color: string) => ({
      padding: '12px 8px', background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 6,
    }),
    macroNum: (color: string) => ({
      fontFamily: 'Orbitron, sans-serif', fontSize: 20, color, fontWeight: 700 as const,
    }),
    macroLabel: { fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#555', marginTop: 2 },
    exerciseRow: (superset: boolean) => ({
      padding: '10px 12px', background: superset ? 'rgba(0,188,212,0.05)' : 'transparent',
      borderLeft: superset ? '3px solid #00bcd4' : '3px solid #00ff4130',
      borderBottom: '1px solid #111', display: 'flex' as const, justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
    }),
    btnPrimary: { width: '100%', padding: '14px', background: '#00ff41', color: '#030303', border: 'none', fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 700 as const, letterSpacing: 2, borderRadius: 4, cursor: 'pointer', marginBottom: 8 } as React.CSSProperties,
    btnSecondary: { width: '100%', padding: '12px', background: 'transparent', color: '#888', border: '1px solid #333', fontFamily: 'Share Tech Mono, monospace', fontSize: 12, borderRadius: 4, cursor: 'pointer' } as React.CSSProperties,
  };

  const renderExercise = (ex: SitrepExercise, i: number) => (
    <div key={i} style={s.exerciseRow(!!ex.superset)}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 600 }}>{i + 1}. {ex.name}</div>
        {ex.notes && <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{ex.notes}</div>}
      </div>
      <div style={{ textAlign: 'right' as const, fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
        <span style={{ color: '#00ff41' }}>{ex.sets}x{ex.reps}</span>
        {ex.weight && <span style={{ color: '#888', marginLeft: 6 }}>{ex.weight}</span>}
        {ex.rest && <span style={{ color: '#555', marginLeft: 6 }}>{ex.rest}</span>}
      </div>
    </div>
  );

  const today = sitrep.today;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.title}>⚔️ SITREP</div>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#facc15', letterSpacing: 1, marginBottom: 4 }}>
          BATTLE PLAN FOR {callsign.toUpperCase()}
        </div>
        <div style={s.subtitle}>
          Generated {new Date(sitrep.generatedDate).toLocaleDateString()} • Level: {(sitrep.operatorLevel || 'beginner').toUpperCase()}
        </div>
      </div>

      {/* Gunny's Assessment */}
      <div style={{ ...s.cardHighlight, borderColor: 'rgba(250,204,21,0.3)', background: 'rgba(250,204,21,0.03)' }}>
        <div style={{ fontSize: 13, color: '#facc15', lineHeight: 1.7, fontStyle: 'italic' }}>
          &ldquo;{sitrep.summary}&rdquo;
        </div>
        <div style={{ fontSize: 10, color: '#666', marginTop: 6, textAlign: 'right' as const }}>— GUNNY AI</div>
      </div>

      {/* Section Toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['overview', 'nutrition', 'training'] as const).map(sec => (
          <button key={sec} onClick={() => setActiveSection(sec)} style={s.sectionBtn(activeSection === sec)}>
            {sec === 'overview' ? '📋 OVERVIEW' : sec === 'nutrition' ? '🍽️ NUTRITION' : '🏋️ TODAY'}
          </button>
        ))}
      </div>

      {/* OVERVIEW SECTION */}
      {activeSection === 'overview' && (
        <div>
          {/* Priority Focus */}
          <div style={s.card}>
            <div style={s.label}>PRIORITY FOCUS</div>
            {(sitrep.priorityFocus || []).map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #111' }}>
                <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, color: '#00ff41', width: 24 }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: '#e0e0e0' }}>{p}</span>
              </div>
            ))}
          </div>

          {/* 30-Day Milestones */}
          <div style={s.card}>
            <div style={s.label}>30-DAY MILESTONES</div>
            {(sitrep.milestones30Day || []).map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#555', flexShrink: 0 }}>○</span>
                <span style={{ fontSize: 12, color: '#ccc' }}>{m}</span>
              </div>
            ))}
          </div>

          {/* Restrictions */}
          {(sitrep.restrictions || []).length > 0 && (
            <div style={{ ...s.card, borderColor: 'rgba(255,68,68,0.2)' }}>
              <div style={{ ...s.label, color: '#ff4444' }}>⚠️ RESTRICTIONS</div>
              {sitrep.restrictions.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: '#ff8888', padding: '4px 0' }}>• {r}</div>
              ))}
            </div>
          )}

          {/* Training Overview */}
          <div style={s.card}>
            <div style={s.label}>TRAINING PLAN</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#00ff41' }}>{sitrep.trainingPlan?.daysPerWeek || 0}</div>
                <div style={{ fontSize: 9, color: '#555' }}>DAYS/WEEK</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00bcd4' }}>{sitrep.trainingPlan?.split || 'TBD'}</div>
                <div style={{ fontSize: 9, color: '#555' }}>SPLIT</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#facc15' }}>{sitrep.trainingPlan?.sessionDuration || 'TBD'}</div>
                <div style={{ fontSize: 9, color: '#555' }}>DURATION</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NUTRITION SECTION */}
      {activeSection === 'nutrition' && (
        <div>
          {/* Macro Targets */}
          <div style={s.macroGrid}>
            <div style={s.macroBox('#ffb800')}>
              <div style={s.macroNum('#ffb800')}>{sitrep.nutritionPlan?.dailyCalories || 0}</div>
              <div style={s.macroLabel}>CALORIES</div>
            </div>
            <div style={s.macroBox('#00bcd4')}>
              <div style={s.macroNum('#00bcd4')}>{sitrep.nutritionPlan?.protein || 0}g</div>
              <div style={s.macroLabel}>PROTEIN</div>
            </div>
            <div style={s.macroBox('#4ade80')}>
              <div style={s.macroNum('#4ade80')}>{sitrep.nutritionPlan?.carbs || 0}g</div>
              <div style={s.macroLabel}>CARBS</div>
            </div>
            <div style={s.macroBox('#ff6b35')}>
              <div style={s.macroNum('#ff6b35')}>{sitrep.nutritionPlan?.fat || 0}g</div>
              <div style={s.macroLabel}>FAT</div>
            </div>
          </div>

          {/* Nutrition Strategy */}
          <div style={s.card}>
            <div style={s.label}>NUTRITION STRATEGY</div>
            <div style={s.value}>{sitrep.nutritionPlan?.approach || ''}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 11, color: '#00bcd4' }}>💧 {sitrep.nutritionPlan?.hydrationOz || 0}oz water/day</span>
              <span style={{ fontSize: 11, color: '#facc15' }}>🍽️ {sitrep.nutritionPlan?.mealsPerDay || 0} meals/day</span>
            </div>
          </div>

          {/* Sample Day */}
          <div style={s.card}>
            <div style={s.label}>SAMPLE DAY</div>
            {(sitrep.nutritionPlan?.sampleDay || []).map((meal, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #111' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#facc15' }}>{meal.time} — {meal.name}</span>
                  <span style={{ fontSize: 10, color: '#888' }}>{meal.calories} cal</span>
                </div>
                <div style={{ fontSize: 12, color: '#ccc', marginBottom: 4 }}>{meal.description}</div>
                <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
                  <span style={{ color: '#00bcd4' }}>{meal.protein}g P</span>
                  <span style={{ color: '#4ade80' }}>{meal.carbs}g C</span>
                  <span style={{ color: '#ff6b35' }}>{meal.fat}g F</span>
                </div>
              </div>
            ))}
          </div>

          {/* Gunny Notes */}
          {sitrep.nutritionPlan?.notes && (
            <div style={{ ...s.card, borderColor: 'rgba(250,204,21,0.2)' }}>
              <div style={{ ...s.label, color: '#facc15' }}>GUNNY NOTES</div>
              <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6 }}>{sitrep.nutritionPlan.notes}</div>
            </div>
          )}
        </div>
      )}

      {/* TRAINING SECTION — Today's Workout */}
      {activeSection === 'training' && (
        <div>
          {/* Progression + Deload */}
          <div style={s.card}>
            <div style={s.label}>PROGRESSION STRATEGY</div>
            <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6, marginBottom: 8 }}>{sitrep.trainingPlan?.progressionStrategy || ''}</div>
            <div style={s.label}>DELOAD PROTOCOL</div>
            <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6 }}>{sitrep.trainingPlan?.deloadProtocol || ''}</div>
          </div>

          {/* Today's Workout */}
          {today ? (
            <div>
              {/* Day Header */}
              <div style={{ ...s.cardHighlight, borderColor: 'rgba(0,255,65,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#00ff41', letterSpacing: 1 }}>
                      DAY {today.dayNumber} — {(today.dayName || '').toUpperCase()}
                    </div>
                    <div style={{ fontSize: 15, color: '#e0e0e0', fontWeight: 600, marginTop: 4 }}>
                      {today.title}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    {today.duration && (
                      <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{today.duration}</div>
                    )}
                    <span style={{
                      fontSize: 9, color: '#00ff41', padding: '3px 8px',
                      border: '1px solid rgba(0,255,65,0.3)', borderRadius: 3,
                      fontFamily: 'Orbitron, sans-serif', letterSpacing: 0.5,
                    }}>
                      {today.type === 'rest' ? 'REST DAY' : today.type === 'active_recovery' ? 'ACTIVE RECOVERY' : today.type === 'conditioning' ? 'CONDITIONING' : 'TRAINING'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warmup */}
              {today.warmup && (
                <div style={s.card}>
                  <div style={{ ...s.label, color: '#facc15' }}>🔥 WARMUP</div>
                  <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6 }}>{today.warmup}</div>
                </div>
              )}

              {/* Exercises */}
              {today.exercises && today.exercises.length > 0 && (
                <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #1a1a1a' }}>
                    <div style={s.label}>EXERCISES — {today.exercises.length} MOVEMENTS</div>
                  </div>
                  {today.exercises.map((ex, i) => renderExercise(ex, i))}
                </div>
              )}

              {/* Cooldown */}
              {today.cooldown && (
                <div style={s.card}>
                  <div style={{ ...s.label, color: '#00bcd4' }}>❄️ COOLDOWN</div>
                  <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6 }}>{today.cooldown}</div>
                </div>
              )}

              {/* Day Notes */}
              {today.notes && (
                <div style={{ padding: '10px 14px', background: '#111', borderRadius: 6, fontSize: 11, color: '#facc15', marginBottom: 12 }}>
                  {today.notes}
                </div>
              )}

              {/* Next Day Info */}
              <div style={{ ...s.card, borderColor: 'rgba(0,188,212,0.2)', background: 'rgba(0,188,212,0.03)', textAlign: 'center' as const }}>
                <div style={{ fontSize: 10, color: '#00bcd4', fontFamily: 'Orbitron, sans-serif', letterSpacing: 1, marginBottom: 4 }}>
                  ADAPTIVE PROGRAMMING
                </div>
                <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>
                  Tomorrow&apos;s workout will be auto-generated based on today&apos;s results.
                  Log your workout and Gunny adapts in real time.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...s.card, textAlign: 'center' as const, color: '#666' }}>
              No workout data available. Try regenerating your battle plan.
            </div>
          )}
        </div>
      )}

      {/* Gunny's Closing Message */}
      <div style={{ ...s.cardHighlight, borderColor: 'rgba(0,255,65,0.3)', marginTop: 20, textAlign: 'center' as const }}>
        <div style={{ fontSize: 13, color: '#00ff41', lineHeight: 1.7 }}>
          &ldquo;{sitrep.gunnyMessage}&rdquo;
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ marginTop: 20 }}>
        <button onClick={onAccept} disabled={loading} style={s.btnPrimary}>
          {loading ? 'DEPLOYING...' : 'ACCEPT BATTLE PLAN'}
        </button>
        <button onClick={onRegenerate} disabled={loading} style={s.btnSecondary}>
          REGENERATE PLAN
        </button>
      </div>
    </div>
  );
}
