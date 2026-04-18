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

export const MealRow: React.FC<MealRowProps> = ({ meal, timeLabel, onRemove }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        alignItems: 'center',
        gap: 10,
        padding: '12px 10px',
        borderBottom: '1px solid rgba(0,255,65,0.06)',
        fontFamily: 'Chakra Petch, sans-serif',
      }}
    >
      {/* Left column — name + macros */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: '#e6e6e6',
            fontSize: 15,
            fontWeight: 600,
            lineHeight: 1.3,
            marginBottom: 4,
            wordBreak: 'break-word',
          }}
        >
          {meal.name}
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          fontSize: 12,
          fontFamily: 'Share Tech Mono, monospace',
          lineHeight: 1.2,
        }}>
          <span style={{ color: '#ffb800' }}>{meal.calories} cal</span>
          <span style={{ color: '#00ff41' }}>P {meal.protein}g</span>
          <span style={{ color: '#4ade80' }}>C {meal.carbs}g</span>
          <span style={{ color: '#f97316' }}>F {meal.fat}g</span>
        </div>
      </div>

      {/* Middle column — timestamp */}
      <div
        style={{
          color: '#777',
          fontSize: 11,
          fontFamily: 'Share Tech Mono, monospace',
          letterSpacing: 0.5,
          whiteSpace: 'nowrap',
        }}
      >
        {timeLabel}
      </div>

      {/* Right column — remove button (optional) */}
      {onRemove ? (
        <button
          onClick={onRemove}
          aria-label={`Remove ${meal.name}`}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            border: '1px solid rgba(255,68,68,0.3)',
            background: 'rgba(255,68,68,0.05)',
            color: '#ff6666',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,68,68,0.15)';
            e.currentTarget.style.borderColor = 'rgba(255,68,68,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,68,68,0.05)';
            e.currentTarget.style.borderColor = 'rgba(255,68,68,0.3)';
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
