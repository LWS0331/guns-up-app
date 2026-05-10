'use client';

// VanguardBanner — recognition strip for founding members.
//
// VANGUARD is the magenta status badge surfaced from the OPS Center
// (admin grants via OpsCenter "VANGUARD" button → flips
// Operator.isVanguard = true). Until now the flag was admin/audit-only:
// recognized in the OPS roster but invisible to the operator
// themselves. This banner closes that loop — VANGUARD operators see a
// thin top-pinned recognition strip on every screen.
//
// Design notes:
//   - Top-pinned (TrialBanner owns the bottom; the two never compete).
//   - 28px tall — tall enough to be unmissable, short enough to never
//     fight Gunny chat / planner / COC for vertical space.
//   - Magenta accent (#ff00ff) to match the OPS Center VANGUARD chip.
//   - Dismissable via × button. Dismiss is persisted to localStorage
//     so the strip doesn't re-mount on every refresh — the user has
//     acknowledged the recognition; they don't need to be reminded
//     daily. Per-operator key so multi-account devices don't cross
//     dismissals.
//   - Self-suppresses when isVanguard !== true. Safe to mount
//     unconditionally (matches the TrialBanner self-suppression
//     pattern at page.tsx:481).
//
// What VANGUARD actually grants today: nothing functional — it's
// purely recognition. The flag survives /api/admin/reset and is
// admin-only-writable, but doesn't change tier / rate limits / model
// routing. Treat this banner as the canonical end-user surface for
// the status; if we ever wire VANGUARD into real perks (e.g. permanent
// founder pricing, exclusive Gunny modes), this is where the copy
// would expand to surface them.

import { useEffect, useState } from 'react';

interface Props {
  operatorId: string;
  isVanguard: boolean;
}

export default function VanguardBanner({ operatorId, isVanguard }: Props) {
  const [dismissed, setDismissed] = useState(false);
  // Track localStorage hydration so SSR doesn't render the banner
  // for a frame before the dismiss state loads.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(`vanguard-banner-dismissed-${operatorId}`);
      if (stored === '1') setDismissed(true);
    } catch {
      // localStorage unavailable — banner shows; not critical.
    }
    setHydrated(true);
  }, [operatorId]);

  if (!isVanguard) return null;
  if (!hydrated) return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(`vanguard-banner-dismissed-${operatorId}`, '1');
    } catch {
      // localStorage unavailable — the in-memory flag still suppresses
      // the banner for this session.
    }
  };

  return (
    <div
      role="status"
      aria-label="Vanguard founding member"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 28,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '0 16px',
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 11,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        color: '#ff00ff',
        background: 'linear-gradient(90deg, rgba(255,0,255,0.06), rgba(255,0,255,0.12), rgba(255,0,255,0.06))',
        borderBottom: '1px solid rgba(255,0,255,0.35)',
        boxShadow: '0 0 14px rgba(255,0,255,0.18)',
        pointerEvents: 'auto',
      }}
    >
      <span aria-hidden="true">★</span>
      <span>Vanguard Member · Founding Operator</span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss vanguard banner"
        style={{
          marginLeft: 6,
          background: 'transparent',
          border: '1px solid rgba(255,0,255,0.35)',
          color: '#ff00ff',
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: 11,
          width: 18,
          height: 18,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
