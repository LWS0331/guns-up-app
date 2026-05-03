'use client';

import React from 'react';
import Icon from '@/components/Icons';
import type { ParsedMovement } from '@/lib/parseMovementText';

interface WarmupMovementCardProps {
  movement: ParsedMovement;
  onPlayVideo?: (searchOrUrl: string, title: string) => void;
  variant?: 'warmup' | 'cooldown';
}

/**
 * Single tappable warmup/cooldown movement card.
 * Shows movement name + prescription with a Demo button that opens
 * the in-app VideoModal (YouTube search or curated URL).
 *
 * Uses the design system's tone-driven bracket cards:
 *   - warmup   → amber bracket card (matches the "in-progress / warm
 *                up" treatment used in workout-mode rest timers)
 *   - cooldown → blue ghost card (the only non-handoff color in the
 *                system, kept inline to signal "post-session
 *                decompression" specifically)
 */
export default function WarmupMovementCard({
  movement,
  onPlayVideo,
  variant = 'warmup',
}: WarmupMovementCardProps) {
  const isCooldown = variant === 'cooldown';

  const handlePlay = () => {
    if (!onPlayVideo) return;
    // Let the parent decide the URL: curated exercises win, fall
    // back to a YouTube search by movement name.
    onPlayVideo(movement.name, movement.name);
  };

  return (
    <div
      // Cooldown variant uses inline styling for the cool-blue tone
      // since the design system doesn't include a "blue" bracket
      // tone — cooldowns are intentionally outside the standard
      // amber/danger/green palette to signal "wind down."
      className={isCooldown ? 'ds-card' : 'ds-card bracket amber amber-tone'}
      style={
        isCooldown
          ? {
              padding: '10px 12px',
              background: 'rgba(96,165,250,0.06)',
              borderColor: 'rgba(96,165,250,0.33)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }
          : {
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }
      }
    >
      {!isCooldown && (
        <>
          <span className="bl" />
          <span className="br" />
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <div
          className="t-mono-data"
          style={{
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
            className="t-mono-sm"
            style={{
              color: isCooldown ? '#60a5fa' : 'var(--amber)',
              marginTop: 2,
              fontSize: 12,
              letterSpacing: '0.05em',
            }}
          >
            {movement.prescription}
          </div>
        )}
      </div>

      {onPlayVideo && movement.isExercise && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label={`Play demo video for ${movement.name}`}
          className="btn btn-ghost btn-sm"
          style={{ flexShrink: 0, padding: '6px 10px' }}
        >
          <Icon.Play size={10} /> DEMO
        </button>
      )}
    </div>
  );
}
