'use client';

// UpgradeCard — drop-in replacement rendered when an operator's tier
// doesn't meet a feature's requirement. Shows the locked feature name,
// what tier unlocks it, and a "VIEW PRICING" link to the billing
// surface in IntelCenter.
//
// Used by gated charts (Nutrition History, Volume, Strength,
// Frequency, Body Comp at OPERATOR+) and gated wearable surfaces
// (Wearable Connect, HR Zones, Sleep/Recovery at COMMANDER+).

import React from 'react';
import { upgradeTargetLabel } from '@/lib/tierGates';
import { useLanguage } from '@/lib/i18n';

interface UpgradeCardProps {
  feature: string;                                       // e.g. "Volume Tracking"
  requiredTier: 'sonnet' | 'opus' | 'white_glove';
  description?: string;                                  // What you'd see if unlocked
  onUpgrade?: () => void;                                // Hook to open BillingPanel
  compact?: boolean;                                     // Smaller variant for inline use
}

const TIER_ACCENT: Record<UpgradeCardProps['requiredTier'], string> = {
  sonnet: '#22d3ee',       // OPERATOR cyan
  opus: '#facc15',         // COMMANDER amber
  white_glove: '#ff6b35',  // WARFIGHTER orange
};

export default function UpgradeCard({ feature, requiredTier, description, onUpgrade, compact }: UpgradeCardProps) {
  const { t } = useLanguage();
  const target = upgradeTargetLabel(requiredTier);
  const accent = TIER_ACCENT[requiredTier];

  return (
    <div
      style={{
        padding: compact ? '14px 16px' : '20px 18px',
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${accent}`,
        borderRadius: 6,
        margin: compact ? '0' : '12px 0',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle diagonal stripe pattern to read as "locked" */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(45deg, transparent 0, transparent 8px, ${accent}08 8px, ${accent}08 9px)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            background: '#0a0a0a',
            border: `1px solid ${accent}`,
            color: accent,
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 9,
            letterSpacing: 2,
            borderRadius: 3,
            marginBottom: compact ? 8 : 12,
          }}
        >
          🔒 {target} {t('upgrade.tier_required').toUpperCase()}
        </div>

        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: compact ? 13 : 15,
            color: '#e0e0e0',
            letterSpacing: 1,
            marginBottom: 6,
            fontWeight: 700,
          }}
        >
          {feature}
        </div>

        {description && !compact && (
          <div
            style={{
              fontSize: 12,
              color: '#888',
              fontFamily: "'Share Tech Mono', monospace",
              lineHeight: 1.5,
              marginBottom: 14,
              maxWidth: 420,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {description}
          </div>
        )}

        <div
          style={{
            fontSize: 11,
            color: '#888',
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: 0.5,
            marginBottom: compact ? 10 : 14,
          }}
        >
          {t('upgrade.unlock_with')} {target}
        </div>

        {onUpgrade && (
          <button
            type="button"
            onClick={onUpgrade}
            style={{
              padding: compact ? '6px 14px' : '8px 18px',
              background: accent,
              color: '#0a0a0a',
              border: 'none',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: compact ? 10 : 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              borderRadius: 4,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {t('upgrade.view_pricing')} →
          </button>
        )}
      </div>
    </div>
  );
}
