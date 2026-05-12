'use client';

// PostWorkoutAnalysis — WS4 surface for the completion overlay.
//
// The completion screen used to show: stats, auto-detected PRs (all-
// time bests only), a static gunnyMessage, sRPE input. Most sessions
// don't break a PR but DO show progress vs the prior session — and
// that progress was invisible. This component renders per-exercise
// "vs last time" badges + an adherence breakdown that reads from the
// same data buildWorkoutAnalysis() uses for Gunny's context, but
// structured for the UI rather than as a text dump.
//
// Pure-display: no state, no fetches. Wraps computeSessionAnalysis()
// from src/lib/workoutAnalysis.ts. Mounts inside the completion
// overlay between the PR list and the static gunnyMessage block.

import React from 'react';
import type { Workout, Operator } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { computeSessionAnalysis, type ExerciseComparison } from '@/lib/workoutAnalysis';

interface PostWorkoutAnalysisProps {
  workout: Workout;
  operator: Operator;
}

const COLOR_FOR = {
  up: '#00ff41',
  down: '#ff4d4d',
  same: '#ffb800',
  neutral: '#888',
} as const;

const BG_FOR = {
  up: 'rgba(0,255,65,0.06)',
  down: 'rgba(255,77,77,0.06)',
  same: 'rgba(255,184,0,0.06)',
  neutral: 'rgba(255,255,255,0.04)',
} as const;

function formatSet(s: { weight: number; reps: number } | null): string {
  if (!s) return '—';
  return `${s.weight}×${s.reps}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  // YYYY-MM-DD → "May 8"
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function ComparisonRow({ row }: { row: ExerciseComparison }) {
  const color = COLOR_FOR[row.color];
  const bg = BG_FOR[row.color];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 8,
        padding: '10px 12px',
        marginBottom: 6,
        background: bg,
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 3,
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: '#e0e0e0', marginBottom: 2 }}>{row.exerciseName}</div>
        <div style={{ color: '#888', fontSize: 11 }}>
          today {formatSet(row.today)}
          {row.prior && row.priorDate && (
            <>
              {' · '}
              <span style={{ color: '#666' }}>prior {formatSet(row.prior)} ({formatDate(row.priorDate)})</span>
            </>
          )}
        </div>
      </div>
      <div
        style={{
          alignSelf: 'center',
          padding: '4px 8px',
          background: `${color}1a`,
          border: `1px solid ${color}`,
          color,
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.8,
          borderRadius: 3,
          whiteSpace: 'nowrap',
        }}
      >
        {row.label}
      </div>
    </div>
  );
}

function AdherenceBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#00ff41' : pct >= 70 ? '#ffb800' : '#ff4d4d';
  return (
    <div style={{ width: 60, height: 4, background: '#222', borderRadius: 2 }}>
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 2,
        }}
      />
    </div>
  );
}

export default function PostWorkoutAnalysis({ workout, operator }: PostWorkoutAnalysisProps) {
  const { t } = useLanguage();
  const analysis = React.useMemo(
    () => computeSessionAnalysis(workout, operator),
    [workout, operator],
  );

  if (analysis.comparisons.length === 0) return null;

  const summaryParts: string[] = [];
  if (analysis.exercisesUp > 0)
    summaryParts.push(`${analysis.exercisesUp} ↑`);
  if (analysis.exercisesDown > 0)
    summaryParts.push(`${analysis.exercisesDown} ↓`);
  if (analysis.firstTimeCount > 0)
    summaryParts.push(`${analysis.firstTimeCount} new`);

  return (
    <div
      style={{
        maxWidth: 460,
        width: '100%',
        marginBottom: 24,
        textAlign: 'left',
      }}
    >
      {/* Header strip with one-glance summary */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: '1px solid rgba(0,255,65,0.15)',
        }}
      >
        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 10,
            color: '#00ff41',
            letterSpacing: 1,
          }}
        >
          {t('post_workout.vs_last_time') || 'VS LAST SESSION'}
        </div>
        <div
          style={{
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 11,
            color: '#888',
          }}
        >
          {summaryParts.join(' · ') || `${analysis.comparisons.length} exercises`}
        </div>
      </div>

      {/* Per-exercise progress chips */}
      <div>
        {analysis.comparisons.map((row) => (
          <ComparisonRow key={row.exerciseName} row={row} />
        ))}
      </div>

      {/* Adherence breakdown — collapsible would be ideal, but for
          v1 keep it always visible. Quick scan: did the operator
          actually finish each block? */}
      {analysis.adherence.length > 0 && (
        <>
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 10,
              color: '#FF8C00',
              letterSpacing: 1,
              marginTop: 14,
              marginBottom: 6,
              paddingBottom: 4,
              borderBottom: '1px solid rgba(255,140,0,0.15)',
            }}
          >
            {t('post_workout.adherence') || 'ADHERENCE'}
          </div>
          <div
            style={{
              padding: '8px 12px',
              background: 'rgba(255,140,0,0.04)',
              border: '1px solid rgba(255,140,0,0.18)',
              borderRadius: 3,
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 11,
            }}
          >
            {analysis.adherence.map((row) => (
              <div
                key={row.exerciseName}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: '1px solid rgba(255,140,0,0.08)',
                  color: '#bbb',
                }}
              >
                <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.exerciseName}
                </div>
                <AdherenceBar pct={row.completionPct} />
                <div style={{ color: '#888', minWidth: 38, textAlign: 'right' }}>
                  {row.setsCompleted}/{row.setsPrescribed}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
