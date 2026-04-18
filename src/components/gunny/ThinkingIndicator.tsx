'use client';

import React, { useEffect, useState } from 'react';

interface ThinkingIndicatorProps {
  variant?: 'primary' | 'panel';
  startedAt?: number;
  label?: string;
}

const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  variant = 'primary',
  startedAt,
  label = 'GUNNY THINKING',
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => {
      setElapsedSec(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [startedAt]);

  const color = variant === 'primary' ? '#00ff41' : '#ffb800';
  const bg = variant === 'primary' ? 'rgba(0,255,65,0.04)' : 'rgba(255,184,0,0.05)';
  const dim = variant === 'primary' ? 'rgba(0,255,65,0.15)' : 'rgba(255,184,0,0.2)';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${label}${elapsedSec > 0 ? ` — ${elapsedSec} seconds` : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: bg,
        border: `1px solid ${dim}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        animation: 'msgSlideIn 0.25s ease-out',
        alignSelf: 'flex-start',
        maxWidth: '90%',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: variant === 'primary'
          ? 'linear-gradient(135deg, #00ff41, #00cc33)'
          : 'linear-gradient(135deg, #ffb800, #cc9400)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 900, color: '#030303', flexShrink: 0,
        fontFamily: 'Orbitron, sans-serif',
      }}>G</div>

      {/* Label + dots + timer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'Orbitron, sans-serif', fontSize: 11,
          fontWeight: 700, letterSpacing: 1.5, color,
        }}>
          <span>{label}</span>
          <span style={{ display: 'inline-flex', gap: 3 }} aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 5, height: 5, borderRadius: '50%',
                  backgroundColor: color,
                  animation: 'thinkingDot 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.18}s`,
                  display: 'inline-block',
                }}
              />
            ))}
          </span>
        </div>
        {startedAt !== undefined && (
          <div style={{
            fontFamily: 'Share Tech Mono, monospace', fontSize: 10,
            color: variant === 'primary' ? '#666' : '#8a7030',
            letterSpacing: 0.5,
          }}>
            {elapsedSec < 1 ? 'initiating...' : `${elapsedSec}s elapsed`}
          </div>
        )}
      </div>
    </div>
  );
};

export default ThinkingIndicator;
