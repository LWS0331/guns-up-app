'use client';

import React from 'react';
import type { ParsedMovement } from '@/lib/parseMovementText';

interface WarmupMovementCardProps {
  movement: ParsedMovement;
  onPlayVideo?: (searchOrUrl: string, title: string) => void;
  variant?: 'warmup' | 'cooldown';
}

/**
 * Single tappable warmup/cooldown movement card.
 * Shows movement name + prescription, with a PLAY button that
 * opens a YouTube search (or curated URL) in the in-app VideoModal.
 */
export default function WarmupMovementCard({
  movement,
  onPlayVideo,
  variant = 'warmup',
}: WarmupMovementCardProps) {
  const accent = variant === 'warmup' ? '#ff8a3c' : '#60a5fa';
  const bg = variant === 'warmup' ? 'rgba(255,138,60,0.06)' : 'rgba(96,165,250,0.06)';

  const handlePlay = () => {
    if (!onPlayVideo) return;
    // Let the parent decide the URL: it can look up curated exercises,
    // otherwise fall back to a YouTube search by movement name.
    onPlayVideo(movement.name, movement.name);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '10px 12px',
        background: bg,
        border: `1px solid ${accent}33`,
        borderRadius: 10,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <div
          style={{
            color: '#e7e7e7',
            fontFamily: 'monospace',
            fontSize: 13,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {movement.name}
        </div>
        {movement.prescription && (
          <div
            style={{
              color: accent,
              fontFamily: 'monospace',
              fontSize: 12,
              marginTop: 2,
              letterSpacing: '0.05em',
            }}
          >
            {movement.prescription}
          </div>
        )}
      </div>

      {onPlayVideo && movement.isExercise && (
        <button
          onClick={handlePlay}
          aria-label={`Play demo video for ${movement.name}`}
          style={{
            flexShrink: 0,
            background: accent,
            color: '#111',
            border: 'none',
            borderRadius: 8,
            padding: '6px 12px',
            fontFamily: 'monospace',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          ▶ DEMO
        </button>
      )}
    </div>
  );
}
