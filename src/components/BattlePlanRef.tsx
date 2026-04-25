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

/**
 * BattlePlanRef — surfaces the operator's active SITREP as the
 * canonical "Active Battle Plan" card from the design handoff
 * Planner Month mock. Per the README:
 *   - eyebrow header ("Active Battle Plan")
 *   - mono metadata (generated date · operator level)
 *   - tabbed training / nutrition sections (.subtabs)
 *
 * Used in:
 *   - Planner header (above segmented Month/Week/Day nav)
 *   - AppShell COC tab
 */
export default function BattlePlanRef({
  sitrep,
  focus = 'all',
  compact = false,
  operator,
  onUpdateOperator,
}: BattlePlanRefProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [activeSection, setActiveSection] = useState<'training' | 'nutrition'>(
    focus === 'nutrition' ? 'nutrition' : 'training'
  );

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

  // Macro accent helper — keeps the per-macro color system from
  // the legacy (calories/amber, protein/green, carbs/light-green,
  // fat/orange) but reads colors from semantic tokens.
  const macroBox = (color: string, value: string | number, label: string) => (
    <div
      style={{
        padding: '10px 6px',
        background: `${color}10`,
        border: `1px solid ${color}30`,
        textAlign: 'center',
      }}
    >
      <div
        className="t-num-display"
        style={{ color, fontSize: 16, textShadow: `0 0 6px ${color}55` }}
      >
        {value}
      </div>
      <div className="t-mono-sm" style={{ marginTop: 2, color: 'var(--text-dim)', fontSize: 8 }}>
        {label}
      </div>
    </div>
  );

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

  const today = sitrep.today;
  const np = sitrep.nutritionPlan;
  const tp = sitrep.trainingPlan;

  return (
    <div
      className="ds-card bracket elevated"
      style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}
    >
      <span className="bl" /><span className="br" />

      {/* Header — eyebrow + mono metadata. Cursor flips to pointer
          in compact mode so the collapsed header is interactive. */}
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
          <span className="t-eyebrow" style={{ marginBottom: 4 }}>
            Active Battle Plan
          </span>
          <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
            Generated {new Date(sitrep.generatedDate).toLocaleDateString()} ·{' '}
            {(sitrep.operatorLevel || 'beginner').toUpperCase()}
          </div>
        </div>
        {compact && (
          <span className="t-mono-sm" style={{ color: 'var(--text-dim)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Section tabs — only when both training + nutrition are
              shown. Uses the canonical .subtabs utility. */}
          {showTraining && showNutrition && (
            <nav
              className="subtabs"
              style={{ marginBottom: 12, padding: 0, borderBottom: 'none' }}
              aria-label="Battle plan sections"
            >
              <button
                type="button"
                className={activeSection === 'training' ? 'active' : ''}
                onClick={() => setActiveSection('training')}
              >
                🏋️ Training
              </button>
              <button
                type="button"
                className={activeSection === 'nutrition' ? 'active' : ''}
                onClick={() => setActiveSection('nutrition')}
              >
                🍽️ Nutrition
              </button>
            </nav>
          )}

          {/* TRAINING SECTION */}
          {((showTraining && activeSection === 'training') || (showTraining && !showNutrition)) && (
            <div>
              {/* Training Plan Overview — 3-col mini stat grid. */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
                <div className="ds-card" style={{ textAlign: 'center', padding: 8 }}>
                  <div className="t-num-display" style={{ fontSize: 16 }}>
                    {tp?.daysPerWeek || 0}
                  </div>
                  <div className="t-mono-sm" style={{ color: 'var(--text-dim)', fontSize: 8, marginTop: 2 }}>
                    DAYS/WK
                  </div>
                </div>
                <div className="ds-card" style={{ textAlign: 'center', padding: 8 }}>
                  <div className="t-display-m" style={{ color: 'var(--green)', fontSize: 11 }}>
                    {tp?.split || 'TBD'}
                  </div>
                  <div className="t-mono-sm" style={{ color: 'var(--text-dim)', fontSize: 8, marginTop: 2 }}>
                    SPLIT
                  </div>
                </div>
                <div className="ds-card" style={{ textAlign: 'center', padding: 8 }}>
                  <div className="t-display-m" style={{ color: 'var(--warn)', fontSize: 11 }}>
                    {tp?.sessionDuration || 'TBD'}
                  </div>
                  <div className="t-mono-sm" style={{ color: 'var(--text-dim)', fontSize: 8, marginTop: 2 }}>
                    DURATION
                  </div>
                </div>
              </div>

              {/* Progression + Deload */}
              <div className="ds-card" style={{ padding: 12, marginBottom: 8 }}>
                <span className="t-eyebrow" style={{ marginBottom: 6 }}>Progression</span>
                <p className="t-body-sm" style={{ color: 'var(--text-primary)', marginBottom: 6 }}>
                  {tp?.progressionStrategy || ''}
                </p>
                <span className="t-eyebrow" style={{ marginBottom: 6 }}>Deload</span>
                <p className="t-body-sm" style={{ color: 'var(--text-primary)' }}>
                  {tp?.deloadProtocol || ''}
                </p>
              </div>

              {/* Today's Workout from SITREP */}
              {today && (
                <div className="ds-card" style={{ padding: 12, marginBottom: 8 }}>
                  <div className="row-between" style={{ marginBottom: 8 }}>
                    <span className="t-eyebrow">
                      Day 1 — {(today.dayName || '').toUpperCase()}: {today.title}
                    </span>
                    {today.duration && (
                      <span className="t-mono-sm" style={{ color: 'var(--text-dim)' }}>
                        {today.duration}
                      </span>
                    )}
                  </div>
                  {today.warmup && (
                    <div className="t-body-sm" style={{ color: 'var(--text-tertiary)', marginBottom: 6 }}>
                      Warmup: {today.warmup}
                    </div>
                  )}
                  {(today.exercises || []).map((ex, i) => renderExercise(ex, i))}
                  {today.cooldown && (
                    <div className="t-body-sm" style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>
                      Cooldown: {today.cooldown}
                    </div>
                  )}

                  {/* Load Day 1 to Planner — primary CTA, flips to
                      a "loaded" affordance once the workout is in
                      the planner so users see confirmation. */}
                  {operator && onUpdateOperator && (
                    <button
                      type="button"
                      onClick={handleLoadDay1}
                      disabled={workoutAlreadyLoaded}
                      className={`btn btn-sm btn-block ${workoutAlreadyLoaded ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ marginTop: 8 }}
                    >
                      {workoutAlreadyLoaded ? '✓ Loaded in Planner' : '⚔️ Load Day 1 to Planner'}
                    </button>
                  )}
                </div>
              )}

              {/* Priority Focus */}
              {(sitrep.priorityFocus || []).length > 0 && (
                <div className="ds-card" style={{ padding: 12, marginBottom: 8 }}>
                  <span className="t-eyebrow" style={{ marginBottom: 6 }}>Priority Focus</span>
                  {sitrep.priorityFocus.map((p, i) => (
                    <div
                      key={i}
                      className="t-body-sm"
                      style={{ color: 'var(--text-primary)', padding: '3px 0' }}
                    >
                      <span style={{ color: 'var(--green)', marginRight: 6 }}>{i + 1}.</span>
                      {p}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NUTRITION SECTION */}
          {((showNutrition && activeSection === 'nutrition') || (showNutrition && !showTraining)) && np && (
            <div>
              {/* Macro Targets — 4-col grid with per-macro color. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                {macroBox('#ffb800', np.dailyCalories, 'CAL')}
                {macroBox('#00ff41', `${np.protein}g`, 'PROTEIN')}
                {macroBox('#4ade80', `${np.carbs}g`, 'CARBS')}
                {macroBox('#ff6b35', `${np.fat}g`, 'FAT')}
              </div>

              {/* Strategy */}
              <div className="ds-card" style={{ padding: 12, marginBottom: 8 }}>
                <span className="t-eyebrow" style={{ marginBottom: 6 }}>Nutrition Strategy</span>
                <p className="t-body-sm" style={{ color: 'var(--text-primary)', marginBottom: 6 }}>
                  {np.approach}
                </p>
                <div style={{ display: 'flex', gap: 12 }} className="t-mono-sm">
                  <span style={{ color: 'var(--green)' }}>💧 {np.hydrationOz}oz/day</span>
                  <span style={{ color: 'var(--warn)' }}>🍽️ {np.mealsPerDay} meals/day</span>
                </div>
              </div>

              {/* Sample Day */}
              {(np.sampleDay || []).length > 0 && (
                <div className="ds-card" style={{ padding: 12, marginBottom: 8 }}>
                  <span className="t-eyebrow" style={{ marginBottom: 6 }}>Sample Day</span>
                  {np.sampleDay.map((meal, i) => (
                    <div
                      key={i}
                      style={{ padding: '6px 0', borderBottom: '1px solid var(--border-green-soft)' }}
                    >
                      <div className="row-between" style={{ marginBottom: 2 }}>
                        <span className="t-display-m" style={{ color: 'var(--warn)', fontSize: 9 }}>
                          {meal.time} — {meal.name}
                        </span>
                        <span className="t-mono-sm" style={{ color: 'var(--text-tertiary)' }}>
                          {meal.calories} cal
                        </span>
                      </div>
                      <div className="t-body-sm" style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>
                        {meal.description}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }} className="t-mono-sm">
                        <span style={{ color: 'var(--green)' }}>{meal.protein}g P</span>
                        <span style={{ color: '#4ade80' }}>{meal.carbs}g C</span>
                        <span style={{ color: 'var(--amber)' }}>{meal.fat}g F</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Gunny Notes — amber-toned subcard so it stands out
                  as a coaching aside rather than reference data. */}
              {np.notes && (
                <div
                  className="ds-card"
                  style={{
                    padding: 12,
                    background: 'rgba(255,140,0,0.04)',
                    borderColor: 'var(--border-amber)',
                  }}
                >
                  <span className="t-eyebrow amber" style={{ marginBottom: 6 }}>Gunny Notes</span>
                  <p className="t-body-sm" style={{ color: 'var(--text-primary)' }}>
                    {np.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
