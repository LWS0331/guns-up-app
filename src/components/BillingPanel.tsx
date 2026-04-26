'use client';

// BillingPanel — operator-facing subscription affordance.
//
// Shows up in IntelCenter → PROFILE tab (and is small enough to drop
// anywhere else later). Two states:
//   1. Beta / no active subscription → "UPGRADE TIER" CTA per tier
//      that posts to /api/stripe/checkout via lib/stripeClient.startCheckout.
//   2. Paid → "MANAGE SUBSCRIPTION" CTA that opens the Stripe Customer
//      Portal via openBillingPortal().
//
// We keep the markup intentionally light — the tier comparison lives on
// /landing, this panel is just for the in-app moment of friction
// (upgrade / cancel / change card). Pricing labels mirror lib/stripe.ts
// so they stay in lockstep with the actual Checkout amount; if you
// rename a tier, update both.
//
// Why we don't probe Stripe for live status: we'd need a server round-trip
// on every render of the profile page. Instead we trust the operator's
// `tier` + `betaUser` fields (which the webhook updates on subscription
// events). Source of truth = our DB, not Stripe.

import { useState } from 'react';
import { startCheckout, openBillingPortal, type BillingCycle } from '@/lib/stripeClient';
import { trackEvent, EVENTS } from '@/lib/analytics';
import type { Operator, AiTier } from '@/lib/types';

interface BillingPanelProps {
  operator: Pick<Operator, 'id' | 'email' | 'callsign' | 'tier' | 'betaUser'>;
}

interface TierOffer {
  key: AiTier | 'white_glove';
  name: string;
  monthly: number;
  annual: number;
  annualSavings: number;
  blurb: string;
  accent: string;
}

// Mirrors lib/stripe.ts → TIER_PRICES amounts AND landing page copy in
// /app/landing/page.tsx (the canonical pricing surface). Keep all three
// in sync — landing copy + this in-app panel + stripe.ts → real Stripe
// products. Annual = ~17% off the monthly equivalent.
const TIER_OFFERS: TierOffer[] = [
  { key: 'haiku',       name: 'RECON',      monthly: 3.99,  annual: 39.92,  annualSavings: 7,   blurb: 'Core Gunny AI · planner + macros',           accent: '#7dd3fc' },
  { key: 'sonnet',      name: 'OPERATOR',   monthly: 9.99,  annual: 99.50,  annualSavings: 20,  blurb: 'Sonnet brain · SITREP + history',            accent: '#22d3ee' },
  { key: 'opus',        name: 'COMMANDER',  monthly: 14.99, annual: 149.40, annualSavings: 30,  blurb: 'Opus brain · voice + wearable HR',           accent: '#facc15' },
  { key: 'white_glove', name: 'WARFIGHTER', monthly: 49.99, annual: 497.90, annualSavings: 102, blurb: 'Human trainer + weekly custom brief',        accent: '#ff6b35' },
];

export default function BillingPanel({ operator }: BillingPanelProps) {
  const [busy, setBusy] = useState<string | null>(null); // tier key currently dispatching
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  const isPaid = !operator.betaUser; // beta users get the upgrade UI even if tier is set

  const handleUpgrade = async (tier: string) => {
    if (busy) return;
    setBusy(tier);
    setError(null);
    try {
      trackEvent(EVENTS.CHECKOUT_STARTED, { tier, cycle, source: 'billing_panel' });
    } catch { /* noop */ }

    const result = await startCheckout({
      operator: { id: operator.id, email: operator.email, callsign: operator.callsign },
      tier,
      cycle,
    });

    if (!(result.ok && result.redirected)) {
      setBusy(null);
      setError(result.error || 'Checkout failed. Try again.');
      try {
        trackEvent(EVENTS.CHECKOUT_FAILED, { tier, cycle, error: result.error });
      } catch { /* noop */ }
    }
    // On success: window.location.assign already navigated to Stripe.
  };

  const handlePortal = async () => {
    if (busy) return;
    setBusy('portal');
    setError(null);
    try {
      trackEvent(EVENTS.BILLING_PORTAL_OPENED, { tier: operator.tier });
    } catch { /* noop */ }

    const result = await openBillingPortal(operator.id);
    if (!(result.ok && result.redirected)) {
      setBusy(null);
      setError(result.error || 'Could not open billing portal.');
    }
  };

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        border: '1px solid rgba(0,255,65,0.12)',
        background: 'rgba(0,255,65,0.02)',
        padding: '14px 16px',
        marginBottom: '20px',
        position: 'relative',
      }}
    >
      <div
        style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 11,
          letterSpacing: 2,
          color: '#00ff41',
          marginBottom: 6,
          textTransform: 'uppercase',
        }}
      >
        // Subscription
      </div>

      {isPaid ? (
        <div>
          <div
            style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 13,
              color: '#ddd',
              marginBottom: 10,
            }}
          >
            Active tier:&nbsp;
            <span style={{ color: '#00ff41', textTransform: 'uppercase' }}>{operator.tier}</span>
          </div>
          <button
            type="button"
            onClick={handlePortal}
            disabled={busy === 'portal'}
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 11,
              letterSpacing: 2,
              padding: '8px 14px',
              border: '1px solid #00ff41',
              background: busy === 'portal' ? 'rgba(0,255,65,0.15)' : 'transparent',
              color: '#00ff41',
              cursor: busy === 'portal' ? 'wait' : 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {busy === 'portal' ? 'Opening…' : 'Manage Subscription →'}
          </button>
        </div>
      ) : (
        <div>
          <div
            style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 12,
              color: '#aaa',
              marginBottom: 12,
            }}
          >
            Beta access active. Lock in a tier to keep going past the trial — no
            interruption to your data, plans, or PRs.
          </div>

          {/* Cycle toggle — annual gets ~20% off, configured server-side. */}
          <div style={{ marginBottom: 10, display: 'flex', gap: 6 }}>
            {(['monthly', 'annual'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                style={{
                  fontFamily: 'Share Tech Mono, monospace',
                  fontSize: 10,
                  letterSpacing: 1.5,
                  padding: '4px 10px',
                  border: `1px solid ${cycle === c ? '#00ff41' : 'rgba(0,255,65,0.2)'}`,
                  background: cycle === c ? 'rgba(0,255,65,0.12)' : 'transparent',
                  color: cycle === c ? '#00ff41' : '#888',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {c}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
            }}
          >
            {TIER_OFFERS.map((t) => {
              const isCurrent = operator.tier === t.key;
              return (
                <div
                  key={t.key}
                  style={{
                    border: `1px solid ${isCurrent ? t.accent : 'rgba(255,255,255,0.06)'}`,
                    background: 'rgba(0,0,0,0.3)',
                    padding: 10,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: 12,
                      letterSpacing: 2,
                      color: t.accent,
                      marginBottom: 4,
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      fontFamily: 'Share Tech Mono, monospace',
                      fontSize: 16,
                      color: '#fff',
                      marginBottom: 4,
                    }}
                  >
                    {cycle === 'annual'
                      ? `$${t.annual.toFixed(2)}/yr`
                      : `$${t.monthly.toFixed(2)}/mo`}
                  </div>
                  {cycle === 'annual' && (
                    <div
                      style={{
                        fontFamily: 'Share Tech Mono, monospace',
                        fontSize: 10,
                        color: t.accent,
                        marginBottom: 4,
                      }}
                    >
                      save ${t.annualSavings}
                    </div>
                  )}
                  <div
                    style={{
                      fontFamily: 'Share Tech Mono, monospace',
                      fontSize: 10,
                      color: '#888',
                      marginBottom: 8,
                      lineHeight: 1.3,
                    }}
                  >
                    {t.blurb}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpgrade(t.key)}
                    disabled={busy === t.key}
                    style={{
                      width: '100%',
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: 10,
                      letterSpacing: 1.5,
                      padding: '6px 10px',
                      border: `1px solid ${t.accent}`,
                      background: busy === t.key ? `${t.accent}33` : 'transparent',
                      color: t.accent,
                      cursor: busy === t.key ? 'wait' : 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    {busy === t.key ? 'Loading…' : isCurrent ? 'Confirm This Tier' : 'Choose →'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 10,
            padding: '6px 10px',
            border: '1px solid rgba(255,80,80,0.3)',
            color: '#ff8080',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 11,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
