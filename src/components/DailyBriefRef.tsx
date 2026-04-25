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

/**
 * DailyBriefRef — surfaces today's adaptive plan as the canonical
 * amber bracket card from the design handoff. Per the Planner mocks
 * (both Day and Month views) the Daily Brief lives at the top with:
 *   - amber eyebrow ("Today's Daily Brief")
 *   - compliance % top-right
 *   - body copy explaining today's adjustments
 *   - expandable details (workout, nutrition, motivation)
 *
 * Used in:
 *   - Planner header (above the segmented Month/Week/Day nav)
 *   - AppShell COC tab
 *
 * Why amber tone: warm/in-progress callouts (warmups, daily briefs,
 * warnings) all share the amber surface so users learn the pattern.
 */
export default function DailyBriefRef({ brief, focus = 'all', compact = false }: DailyBriefRefProps) {
  const [expanded, setExpanded] = useState(!compact);

  const showTraining = focus === 'all' || focus === 'training';
  const showNutrition = focus === 'all' || focus === 'nutrition';

  // Compliance score color — green ≥80%, amber ≥50%, danger below.
  const compColor =
    (brief.complianceScore || 0) >= 80
      ? 'var(--green)'
      : (brief.complianceScore || 0) >= 50
        ? 'var(--warn)'
        : 'var(--amber)';

  const renderExercise = (ex: SitrepExercise, i: number) => (
    <div
      key={i}
      style={{
        padding: '6px 10px',
        borderBottom: '1px solid var(--border-green-soft)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="t-body-sm" style={{ color: 'var(--text-primary)' }}>
          {i + 1}. {ex.name}
        </span>
        {ex.notes && (
          <div className="t-mono-sm" style={{ color: 'var(--text-dim)', marginTop: 1 }}>
            {ex.notes}
          </div>
        )}
      </div>
      <span className="t-mono-data" style={{ color: 'var(--green)', fontSize: 11 }}>
        {ex.sets}×{ex.reps}{ex.weight ? ` @ ${ex.weight}` : ''}
      </span>
    </div>
  );

  return (
    // Amber bracket card — handoff Day-view "Today's Daily Brief"
    // pattern. Cursor flips to pointer in compact mode so the
    // collapsed header is obviously interactive.
    <div
      className="ds-card bracket amber amber-tone"
      style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}
    >
      <span className="bl" /><span className="br" />

      {/* Header — eyebrow + focus mono line on the left, compliance
          + streak + chevron on the right. */}
      <div
        onClick={() => compact && setExpanded(!expanded)}
        style={{
          padding: '12px 16px',
          cursor: compact ? 'pointer' : 'default',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div>
          <span className="t-eyebrow amber" style={{ marginBottom: 4 }}>
            Today&apos;s Daily Brief
          </span>
          {brief.todaysFocus && (
            <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
              {brief.todaysFocus}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {brief.complianceScore != null && (
            <span className="t-mono-data" style={{ color: compColor, fontSize: 12 }}>
              {brief.complianceScore}%
            </span>
          )}
          {brief.streakDays != null && brief.streakDays > 0 && (
            <span className="t-mono-sm" style={{ color: 'var(--warn)' }}>
              🔥{brief.streakDays}d
            </span>
          )}
          {compact && (
            <span className="t-mono-sm" style={{ color: 'var(--text-dim)' }}>
              {expanded ? '▲' : '▼'}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Greeting — italic amber, the Gunny voice line. */}
          <p
            className="t-body-sm"
            style={{
              color: 'var(--warn)',
              fontStyle: 'italic',
              marginBottom: 10,
              lineHeight: 1.5,
            }}
          >
            &ldquo;{brief.greeting}&rdquo;
          </p>

          {/* Adjustments from Battle Plan — amber-bordered subcard. */}
          {(brief.adjustments || []).length > 0 && (
            <div
              className="ds-card"
              style={{
                padding: 12,
                background: 'rgba(255,140,0,0.04)',
                borderColor: 'var(--border-amber)',
                marginBottom: 8,
              }}
            >
              <span className="t-eyebrow amber" style={{ marginBottom: 6 }}>
                Adjustments from Battle Plan
              </span>
              {brief.adjustments.map((a, i) => (
                <div key={i} className="t-body-sm" style={{ padding: '2px 0', color: 'var(--text-primary)' }}>
                  • {a}
                </div>
              ))}
            </div>
          )}

          {/* Today's Workout — green-soft subcard with exercise rows. */}
          {showTraining && brief.workout && (
            <div className="ds-card" style={{ padding: 12, marginBottom: 8 }}>
              <div className="row-between" style={{ marginBottom: 8 }}>
                <span className="t-eyebrow">
                  Today&apos;s Workout — {brief.workout.title}
                </span>
                {brief.workout.duration && (
                  <span className="t-mono-sm" style={{ color: 'var(--text-dim)' }}>
                    {brief.workout.duration}
                  </span>
                )}
              </div>
              {brief.workout.warmup && (
                <div className="t-body-sm" style={{ color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  Warmup: {brief.workout.warmup}
                </div>
              )}
              {(brief.workout.exercises || []).map((ex, i) => renderExercise(ex, i))}
              {brief.workout.cooldown && (
                <div className="t-body-sm" style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>
                  Cooldown: {brief.workout.cooldown}
                </div>
              )}
            </div>
          )}

          {/* Rest Day — danger-toned subcard so the "no workout"
              state is visually distinct from a low-volume day. */}
          {showTraining && !brief.workout && (
            <div
              className="ds-card"
              style={{
                padding: 12,
                marginBottom: 8,
                textAlign: 'center',
                background: 'rgba(255,107,53,0.04)',
                borderColor: 'var(--border-danger)',
              }}
            >
              <div className="t-display-m" style={{ color: 'var(--amber)' }}>
                Rest Day
              </div>
              <div className="t-body-sm" style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
                Recovery is part of the mission.
              </div>
            </div>
          )}

          {/* Nutrition Reminder — green-soft subcard. */}
          {showNutrition && brief.nutritionReminder && (
            <div className="ds-card" style={{ padding: 12, marginBottom: 8 }}>
              <span className="t-eyebrow" style={{ marginBottom: 6 }}>
                Nutrition
              </span>
              <p className="t-body-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {brief.nutritionReminder}
              </p>
            </div>
          )}

          {/* Motivation tag-line — green italic, attribution dimmed. */}
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <p className="t-body-sm" style={{ color: 'var(--green)', fontStyle: 'italic' }}>
              &ldquo;{brief.motivation}&rdquo;
            </p>
            <div className="t-mono-sm" style={{ color: 'var(--text-dim)', marginTop: 3 }}>
              — GUNNY AI
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
