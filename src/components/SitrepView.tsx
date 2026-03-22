'use client';

import React, { useState } from 'react';
import { Sitrep, SitrepDay, SitrepExercise } from '@/lib/types';

interface SitrepViewProps {
  sitrep: Sitrep;
  callsign: string;
  onAccept: () => void;
  onRegenerate: () => void;
  loading?: boolean;
}

export default function SitrepView({ sitrep, callsign, onAccept, onRegenerate, loading }: SitrepViewProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'nutrition' | 'training'>('overview');
  const [expandedWeek, setExpandedWeek] = useState<number>(1);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

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
      padding: '8px 12px', background: superset ? 'rgba(0,188,212,0.05)' : 'transparent',
      borderLeft: superset ? '2px solid #00bcd4' : '2px solid transparent',
      borderBottom: '1px solid #111', display: 'flex' as const, justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
    }),
    dayCard: (type: string, expanded: boolean) => ({
      padding: '12px 16px', background: type === 'rest' ? '#0a0808' : type === 'active_recovery' ? '#0a0a08' : '#0a0a0a',
      border: `1px solid ${expanded ? 'rgba(0,255,65,0.3)' : '#1a1a1a'}`,
      borderRadius: 6, marginBottom: 6, cursor: 'pointer', transition: 'border-color 0.2s',
    }),
    btnPrimary: { width: '100%', padding: '14px', background: '#00ff41', color: '#030303', border: 'none', fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 700 as const, letterSpacing: 2, borderRadius: 4, cursor: 'pointer', marginBottom: 8 } as React.CSSProperties,
    btnSecondary: { width: '100%', padding: '12px', background: 'transparent', color: '#888', border: '1px solid #333', fontFamily: 'Share Tech Mono, monospace', fontSize: 12, borderRadius: 4, cursor: 'pointer' } as React.CSSProperties,
  };

  const typeColors: Record<string, string> = {
    training: '#00ff41', rest: '#ff6b35', active_recovery: '#facc15', conditioning: '#00bcd4',
  };

  const typeLabels: Record<string, string> = {
    training: 'TRAINING', rest: 'REST DAY', active_recovery: 'ACTIVE RECOVERY', conditioning: 'CONDITIONING',
  };

  const renderExercise = (ex: SitrepExercise, i: number) => (
    <div key={i} style={s.exerciseRow(!!ex.superset)}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: '#e0e0e0' }}>{ex.name}</div>
        {ex.notes && <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{ex.notes}</div>}
      </div>
      <div style={{ textAlign: 'right' as const, fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
        <span style={{ color: '#00ff41' }}>{ex.sets}x{ex.reps}</span>
        {ex.weight && <span style={{ color: '#888', marginLeft: 6 }}>{ex.weight}</span>}
        {ex.rest && <span style={{ color: '#555', marginLeft: 6 }}>{ex.rest}</span>}
      </div>
    </div>
  );

  const renderDay = (day: SitrepDay, weekNum: number) => {
    const isExpanded = expandedDay === day.dayNumber + (weekNum * 10);
    const color = typeColors[day.type] || '#888';

    return (
      <div key={`${weekNum}-${day.dayNumber}`} style={s.dayCard(day.type, isExpanded)}
        onClick={() => setExpandedDay(isExpanded ? null : day.dayNumber + (weekNum * 10))}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color, letterSpacing: 0.5 }}>
              {day.dayName.toUpperCase()}
            </span>
            <span style={{ fontSize: 12, color: '#e0e0e0', marginLeft: 10 }}>{day.title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {day.duration && <span style={{ fontSize: 9, color: '#555' }}>{day.duration}</span>}
            <span style={{ fontSize: 8, color, padding: '2px 6px', border: `1px solid ${color}40`, borderRadius: 3 }}>
              {typeLabels[day.type] || day.type.toUpperCase()}
            </span>
          </div>
        </div>

        {isExpanded && day.type !== 'rest' && (
          <div style={{ marginTop: 12, borderTop: '1px solid #1a1a1a', paddingTop: 10 }}
            onClick={e => e.stopPropagation()}>
            {day.warmup && (
              <div style={{ marginBottom: 8 }}>
                <div style={s.label}>WARMUP</div>
                <div style={{ fontSize: 11, color: '#888' }}>{day.warmup}</div>
              </div>
            )}
            {day.exercises.map((ex, i) => renderExercise(ex, i))}
            {day.cooldown && (
              <div style={{ marginTop: 8 }}>
                <div style={s.label}>COOLDOWN</div>
                <div style={{ fontSize: 11, color: '#888' }}>{day.cooldown}</div>
              </div>
            )}
            {day.notes && (
              <div style={{ marginTop: 8, padding: 8, background: '#111', borderRadius: 4, fontSize: 10, color: '#facc15' }}>
                {day.notes}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

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
            {sec === 'overview' ? '📋 OVERVIEW' : sec === 'nutrition' ? '🍽️ NUTRITION' : '🏋️ TRAINING'}
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

      {/* TRAINING SECTION */}
      {activeSection === 'training' && (
        <div>
          {/* Progression + Deload */}
          <div style={s.card}>
            <div style={s.label}>PROGRESSION STRATEGY</div>
            <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6, marginBottom: 8 }}>{sitrep.trainingPlan?.progressionStrategy || ''}</div>
            <div style={s.label}>DELOAD PROTOCOL</div>
            <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6 }}>{sitrep.trainingPlan?.deloadProtocol || ''}</div>
          </div>

          {/* Week Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(sitrep.trainingPlan?.weeks || []).map(week => (
              <button key={week.weekNumber} onClick={() => { setExpandedWeek(week.weekNumber); setExpandedDay(null); }}
                style={{
                  flex: 1, padding: '8px', fontFamily: 'Orbitron, sans-serif', fontSize: 10,
                  background: expandedWeek === week.weekNumber ? '#00ff4120' : '#0a0a0a',
                  color: expandedWeek === week.weekNumber ? '#00ff41' : '#555',
                  border: `1px solid ${expandedWeek === week.weekNumber ? '#00ff41' : '#222'}`,
                  borderRadius: 4, cursor: 'pointer',
                }}>
                WEEK {week.weekNumber}
              </button>
            ))}
          </div>

          {/* Week Content */}
          {(sitrep.trainingPlan?.weeks || []).filter(w => w.weekNumber === expandedWeek).map(week => (
            <div key={week.weekNumber}>
              <div style={{ fontSize: 11, color: '#facc15', marginBottom: 8, fontFamily: 'Orbitron, sans-serif', letterSpacing: 0.5 }}>
                FOCUS: {week.focus}
              </div>
              {(week.days || []).map(day => renderDay(day, week.weekNumber))}
            </div>
          ))}
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
