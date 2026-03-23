'use client';

import React, { useState } from 'react';
import { DailyBrief as DailyBriefType, SitrepExercise } from '@/lib/types';

interface DailyBriefRefProps {
  brief: DailyBriefType;
  /** Which sections to show: 'all' | 'training' | 'nutrition' */
  focus?: 'all' | 'training' | 'nutrition';
  /** Compact mode — collapsed by default */
  compact?: boolean;
}

export default function DailyBriefRef({ brief, focus = 'all', compact = false }: DailyBriefRefProps) {
  const [expanded, setExpanded] = useState(!compact);

  const showTraining = focus === 'all' || focus === 'training';
  const showNutrition = focus === 'all' || focus === 'nutrition';

  const compColor = (brief.complianceScore || 0) >= 80 ? '#00ff41' : (brief.complianceScore || 0) >= 50 ? '#facc15' : '#ff6b35';

  const s = {
    container: {
      background: '#0a0a0a', border: '1px solid rgba(0,255,65,0.15)', borderRadius: 8,
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
    exerciseRow: {
      padding: '6px 10px', borderBottom: '1px solid #111',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    } as React.CSSProperties,
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

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header} onClick={() => compact && setExpanded(!expanded)}>
        <div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#00ff41', letterSpacing: 1 }}>
            📋 TODAY&apos;S DAILY BRIEF
          </div>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#555', marginTop: 2 }}>
            {brief.todaysFocus}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {brief.complianceScore != null && (
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: compColor }}>
              {brief.complianceScore}%
            </span>
          )}
          {brief.streakDays != null && brief.streakDays > 0 && (
            <span style={{ fontSize: 9, color: '#facc15' }}>🔥{brief.streakDays}d</span>
          )}
          {compact && <span style={{ fontSize: 11, color: '#555' }}>{expanded ? '▲' : '▼'}</span>}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Greeting */}
          <div style={{ fontSize: 12, color: '#facc15', fontStyle: 'italic', marginBottom: 10, lineHeight: 1.5 }}>
            &ldquo;{brief.greeting}&rdquo;
          </div>

          {/* Adjustments */}
          {(brief.adjustments || []).length > 0 && (
            <div style={{ ...s.card, borderColor: 'rgba(250,204,21,0.15)' }}>
              <div style={{ ...s.label, color: '#facc15' }}>ADJUSTMENTS FROM BATTLE PLAN</div>
              {brief.adjustments.map((a, i) => (
                <div key={i} style={{ fontSize: 10, color: '#ccc', padding: '2px 0' }}>• {a}</div>
              ))}
            </div>
          )}

          {/* Today's Workout */}
          {showTraining && brief.workout && (
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={s.label}>TODAY&apos;S WORKOUT — {brief.workout.title}</div>
                {brief.workout.duration && <span style={{ fontSize: 9, color: '#555' }}>{brief.workout.duration}</span>}
              </div>
              {brief.workout.warmup && <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>Warmup: {brief.workout.warmup}</div>}
              {(brief.workout.exercises || []).map((ex, i) => renderExercise(ex, i))}
              {brief.workout.cooldown && <div style={{ fontSize: 10, color: '#888', marginTop: 6 }}>Cooldown: {brief.workout.cooldown}</div>}
            </div>
          )}

          {/* Rest Day */}
          {showTraining && !brief.workout && (
            <div style={{ ...s.card, textAlign: 'center', borderColor: 'rgba(255,107,53,0.15)' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#ff6b35' }}>REST DAY</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Recovery is part of the mission.</div>
            </div>
          )}

          {/* Nutrition Reminder */}
          {showNutrition && brief.nutritionReminder && (
            <div style={{ ...s.card, borderColor: 'rgba(0,255,65,0.15)' }}>
              <div style={{ ...s.label, color: '#00ff41' }}>NUTRITION</div>
              <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5 }}>{brief.nutritionReminder}</div>
            </div>
          )}

          {/* Motivation */}
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 11, color: '#00ff41', fontStyle: 'italic' }}>
              &ldquo;{brief.motivation}&rdquo;
            </div>
            <div style={{ fontSize: 8, color: '#555', marginTop: 3 }}>— GUNNY AI</div>
          </div>
        </div>
      )}
    </div>
  );
}
