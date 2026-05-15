'use client';

// TrialBanner — overlay that surfaces trial-tier state to the operator.
//
// Two visual modes:
//   - Soft warning when a trial is active and ≤ 3 days remain. Sticks
//     to the bottom of the viewport, dismissable for the session, and
//     non-blocking. Shows "Your COMMANDER trial ends in N days" + a
//     single CTA to lock in a tier.
//   - Hard prompt when the trial has expired. Modal-style overlay
//     pinned to the bottom (not fully blocking — operator can still
//     read prior chats / data) with three CTAs: pay for OPERATOR,
//     pay for COMMANDER, or drop to free RECON.
//
// Why bottom-pinned and not modal-blocking: paywalls that block the
// app on day 14 destroy the trial-to-paid funnel — operators have data
// and momentum, and the goal is to convert without breaking trust. A
// persistent bottom bar nudges the decision without creating a hostile
// "your coach is locked" wall. Hard paywall lock + auto-downgrade are
// deferred to a follow-up PR (see route.ts comments on /api/auth/me).
//
// Stripe checkout flow: the OPERATOR / COMMANDER buttons POST to
// /api/stripe/checkout with the chosen tier, get redirected to
// Stripe, then back to /?checkout=success. RECON downgrade flips the
// operator's tier to 'haiku' via PUT /api/operators/:id (tier is in
// SELF_FIELDS so self-update is allowed).

import { useState } from 'react';
import { getAuthToken } from '@/lib/authClient';
import { trackEvent } from '@/lib/analytics';

export interface TrialState {
  /** True when the operator is on an active trial promo (promoActive
   *  is true AND promoType starts with 'trial_'). Drives whether the
   *  banner mounts at all. */
  active: boolean;
  /** Tier slug from promoType — e.g. 'opus' for COMMANDER. Used in
   *  the banner copy ("Your COMMANDER trial..."). Null when the promo
   *  shape doesn't parse. */
  tier: string | null;
  /** Days from now to promoExpiry (rounded up). Negative means
   *  expired N days ago. Null when expiry can't be parsed. */
  daysRemaining: number | null;
  /** True when expiry < now. */
  expired: boolean;
}

interface Props {
  trial: TrialState;
  operatorId: string;
  /** Pass-through hook for the parent: when set, the OPERATOR /
   *  COMMANDER CTAs route to Stripe checkout instead of just showing
   *  a coming-soon nudge. The /api/billing/checkout endpoint is the
   *  canonical entry point — it builds the session server-side using
   *  STRIPE_PRICE_* env vars. */
  stripePortalEnabled?: boolean;
}

const TIER_NAME: Record<string, string> = {
  haiku: 'RECON',
  sonnet: 'OPERATOR',
  opus: 'COMMANDER',
  white_glove: 'WARFIGHTER',
};

export default function TrialBanner({ trial, operatorId, stripePortalEnabled }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState<'operator' | 'commander' | 'recon' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Don't mount for operators without a trial promo at all.
  if (!trial.active) return null;

  const isExpired = trial.expired;
  const daysLeft = trial.daysRemaining ?? 0;
  const isWarning = !isExpired && daysLeft >= 0 && daysLeft <= 3;

  // Soft warning is dismissable for the session; expired prompt is not
  // (the operator has to make a choice). The dismissal is local-only —
  // a refresh re-shows it, which is intentional.
  if (!isExpired && !isWarning) return null;
  if (isWarning && dismissed) return null;

  const trialTierName = trial.tier ? TIER_NAME[trial.tier] || trial.tier.toUpperCase() : 'TRIAL';

  // Stripe checkout — POST /api/stripe/checkout with target tier.
  // Server returns { url } and we navigate. trackEvent fires before
  // navigation so the funnel event lands even if the redirect fails.
  const goToCheckout = async (target: 'sonnet' | 'opus') => {
    setError(null);
    const slot = target === 'sonnet' ? 'operator' : 'commander';
    setBusy(slot);
    trackEvent('trial_cta_click', { target, where: isExpired ? 'expired_banner' : 'warning_banner' });
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          operatorId,
          tier: target,
          billingCycle: 'monthly',
        }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(data?.error || 'Could not start checkout — try again from the BILLING tab.');
    } catch (err) {
      console.error('[TrialBanner] checkout failed', err);
      setError('Network error — try again.');
    } finally {
      setBusy(null);
    }
  };

  // RECON downgrade — clear the promo fields and flip tier to haiku.
  // PUT /api/operators/:id allows self-update of tier (SELF_FIELDS).
  const dropToRecon = async () => {
    setError(null);
    setBusy('recon');
    trackEvent('trial_cta_click', { target: 'haiku', where: isExpired ? 'expired_banner' : 'warning_banner' });
    try {
      const res = await fetch(`/api/operators/${operatorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          tier: 'haiku',
          // promo* are admin-only fields — the tier flip is enough on
          // the self path. The /me endpoint will see promoExpired
          // already passed, but with tier=haiku the gate stays quiet.
        }),
      });
      if (res.ok) {
        // Reload so /api/auth/me re-runs and the banner unmounts.
        window.location.reload();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data?.error || `Downgrade failed (HTTP ${res.status})`);
    } catch (err) {
      console.error('[TrialBanner] downgrade failed', err);
      setError('Network error — try again.');
    } finally {
      setBusy(null);
    }
  };

  const accent = isExpired ? '#ff4444' : '#ffb800';

  return (
    <div
      role="region"
      aria-label={isExpired ? 'Trial expired — pick a tier' : 'Trial ending soon'}
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 999,
        background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.95) 100%)`,
        padding: '14px 16px 18px',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        borderTop: `1px solid ${accent}40`,
      }}
    >
      <div style={{
        maxWidth: 720, margin: '0 auto',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        <div style={{
          color: accent,
          fontFamily: '"Orbitron", sans-serif',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '2px',
        }}>
          {isExpired
            ? `// ${trialTierName} TRIAL EXPIRED`
            : `// ${trialTierName} TRIAL ENDS IN ${daysLeft} ${daysLeft === 1 ? 'DAY' : 'DAYS'}`}
        </div>

        <div style={{
          color: '#ddd',
          fontFamily: '"Chakra Petch", sans-serif',
          fontSize: '14px',
          lineHeight: 1.5,
        }}>
          {isExpired
            ? `Your ${trialTierName} trial just ended. Pick a tier to keep going — your data, plans, and PRs stay locked in either way.`
            : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left on your free ${trialTierName} window. Lock in a paid tier now and you keep going without interruption.`}
        </div>

        {error && (
          <div style={{
            padding: '8px 10px',
            background: 'rgba(255,68,68,0.10)',
            border: '1px solid rgba(255,68,68,0.30)',
            color: '#ff8888',
            fontFamily: '"Share Tech Mono", monospace',
            fontSize: '11px',
          }}>
            ✕ {error}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '8px',
        }}>
          <button
            type="button"
            onClick={() => stripePortalEnabled && goToCheckout('opus')}
            disabled={!!busy}
            style={{
              padding: '12px 14px',
              background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
              border: 'none',
              color: '#fff',
              fontFamily: '"Orbitron", sans-serif',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1px',
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy && busy !== 'commander' ? 0.5 : 1,
              boxShadow: '0 0 12px rgba(255,68,68,0.30)',
            }}
          >
            {busy === 'commander' ? '…' : 'KEEP COMMANDER  $39.99/mo'}
          </button>
          <button
            type="button"
            onClick={() => stripePortalEnabled && goToCheckout('sonnet')}
            disabled={!!busy}
            style={{
              padding: '12px 14px',
              background: 'rgba(85,170,255,0.15)',
              border: '1px solid rgba(85,170,255,0.40)',
              color: '#9cf',
              fontFamily: '"Orbitron", sans-serif',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1px',
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy && busy !== 'operator' ? 0.5 : 1,
            }}
          >
            {busy === 'operator' ? '…' : 'OPERATOR  $19.99/mo'}
          </button>
          <button
            type="button"
            onClick={dropToRecon}
            disabled={!!busy}
            style={{
              padding: '12px 14px',
              background: 'rgba(120,120,120,0.10)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: '#aaa',
              fontFamily: '"Share Tech Mono", monospace',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '1px',
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy && busy !== 'recon' ? 0.5 : 1,
            }}
          >
            {busy === 'recon' ? '…' : 'STAY FREE — RECON'}
          </button>
        </div>

        {!isExpired && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            style={{
              alignSelf: 'flex-end',
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              color: '#666',
              fontFamily: '"Share Tech Mono", monospace',
              fontSize: '10px',
              letterSpacing: '1px',
              cursor: 'pointer',
            }}
          >
            DISMISS FOR NOW
          </button>
        )}
      </div>
    </div>
  );
}
