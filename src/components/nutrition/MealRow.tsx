'use client';

import React from 'react';

interface MealRowMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time?: string;
}

interface MealRowProps {
  meal: MealRowMeal;
  timeLabel: string;
  onRemove?: () => void; // undefined => read-only (past days)
}

/**
 * Single meal entry inside the nutrition log.
 *
 * Layout: name + macro chips on the left, timestamp in the middle,
 * red round Remove button on the right (omitted on read-only past
 * days). All colors flow through design-system tokens; per-macro
 * accent is preserved via inline override since the macro color
 * system is dynamic and tied to the canonical macro semantics
 * (calories=amber/warn, protein=green, carbs=light-green, fat=orange).
 */
export const MealRow: React.FC<MealRowProps> = ({ meal, timeLabel, onRemove }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        alignItems: 'center',
        gap: 10,
        padding: '12px 10px',
        borderBottom: '1px solid var(--border-green-soft)',
        fontFamily: 'var(--body)',
      }}
    >
      {/* Left column — name + macros */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: 'var(--text-primary)',
            fontSize: 15,
            fontWeight: 600,
            lineHeight: 1.3,
            marginBottom: 4,
            wordBreak: 'break-word',
          }}
        >
          {meal.name}
        </div>
        <div
          className="t-mono-sm"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 12,
            lineHeight: 1.2,
          }}
        >
          <span style={{ color: 'var(--warn)' }}>{meal.calories} cal</span>
          <span style={{ color: 'var(--green)' }}>P {meal.protein}g</span>
          <span style={{ color: '#4ade80' }}>C {meal.carbs}g</span>
          <span style={{ color: '#f97316' }}>F {meal.fat}g</span>
        </div>
      </div>

      {/* Middle column — timestamp. Mono dim caption. */}
      <div
        className="t-mono-sm"
        style={{
          color: 'var(--text-tertiary)',
          letterSpacing: 0.5,
          whiteSpace: 'nowrap',
        }}
      >
        {timeLabel}
      </div>

      {/* Right column — remove button (optional). Round 14px-radius
          danger-tinted button matches the chip-x pattern but stands
          alone since each meal row needs an obvious destructive
          affordance. Hidden via spacer span on read-only past days
          so columns stay aligned. */}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${meal.name}`}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            border: '1px solid var(--border-danger)',
            background: 'rgba(255, 68, 68, 0.05)',
            color: 'var(--danger)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 68, 68, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(255, 68, 68, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 68, 68, 0.05)';
            e.currentTarget.style.borderColor = 'var(--border-danger)';
          }}
        >
          ×
        </button>
      ) : (
        <span style={{ width: 28, display: 'inline-block' }} aria-hidden />
      )}
    </div>
  );
};

export default MealRow;
