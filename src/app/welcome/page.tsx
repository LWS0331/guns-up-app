'use client';

// /welcome — the post-Stripe-checkout landing page (PaywallSpec §2).
// Replaces Stripe's default success page. Picks up the
// ?session_id=cs_... query string from Stripe and surfaces:
//   - Tier-specific welcome banner (COMMANDER / WARFIGHTER / etc.)
//   - Confirmation chip with subscription status
//   - PRIMARY ACTION: "Get the app" (App Store deep link / QR)
//   - Secondary: SMS download link form, magic-link email resend
//   - What's next checklist
//
// The page does NOT require auth — it's reached straight from Stripe
// before the user has signed in on this device. Auth happens via the
// magic link in the activation email.

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface WelcomeStatus {
  email?: string;
  tier?: string;
  callsign?: string;
  amount?: number;
  cycle?: 'monthly' | 'annual';
  cardLast4?: string;
  ready: boolean;
}

const TIER_LABEL: Record<string, string> = {
  haiku: 'RECON',
  sonnet: 'OPERATOR',
  opus: 'COMMANDER',
  white_glove: 'WARFIGHTER',
};

const TIER_COLOR: Record<string, string> = {
  haiku: '#7dd3fc',
  sonnet: '#22d3ee',
  opus: '#facc15',
  white_glove: '#ff6b35',
};

const APP_STORE_URL = 'https://apps.apple.com/app/guns-up-fitness/id0000000000'; // replaced post-listing
const SUPPORT_EMAIL = 'support@gunsupfitness.com';

function WelcomeInner() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');

  const [status, setStatus] = useState<WelcomeStatus>({ ready: false });
  const [polling, setPolling] = useState(true);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkBusy, setMagicLinkBusy] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);

  // Poll /api/stripe/checkout-session?session_id=... for up to 30s
  // while the webhook updates the operator record. PaywallSpec §10
  // edge 4: race condition where the webhook arrives before this
  // page loads OR vice versa — polling smooths the transition.
  useEffect(() => {
    if (!sessionId) {
      setPolling(false);
      return;
    }
    let attempts = 0;
    const maxAttempts = 15;  // 15 × 2s = 30s
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/stripe/checkout-session?session_id=${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.ready) {
            if (!cancelled) {
              setStatus({
                email: data.email,
                tier: data.tier,
                callsign: data.callsign,
                amount: data.amount,
                cycle: data.cycle,
                cardLast4: data.cardLast4,
                ready: true,
              });
              setPolling(false);
            }
            return;
          }
        }
      } catch {
        /* swallow — try again */
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        if (!cancelled) setPolling(false);
        return;
      }
      setTimeout(poll, 2000);
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  const tierName = status.tier ? (TIER_LABEL[status.tier] || 'OPERATOR') : 'OPERATOR';
  const tierColor = status.tier ? (TIER_COLOR[status.tier] || '#22d3ee') : '#22d3ee';

  const requestMagicLink = async () => {
    if (!status.email || magicLinkBusy) return;
    setMagicLinkBusy(true);
    setMagicLinkError(null);
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: status.email, intent: 'sign_in' }),
      });
      if (res.ok) {
        setMagicLinkSent(true);
      } else {
        setMagicLinkError('Could not send magic link. Email support if this persists.');
      }
    } catch {
      setMagicLinkError('Network error. Try again.');
    } finally {
      setMagicLinkBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#030303',
      color: '#ddd',
      fontFamily: 'Chakra Petch, sans-serif',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 12,
            color: '#666',
            letterSpacing: 3,
            marginBottom: 12,
          }}>
            // GUNS UP FITNESS
          </div>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 32,
            color: tierColor,
            letterSpacing: 4,
            fontWeight: 800,
          }}>
            WELCOME, {tierName}
          </div>
          {polling && !status.ready && (
            <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: '#666', marginTop: 16 }}>
              Confirming your subscription…
            </div>
          )}
        </div>

        {/* Confirmation chip */}
        {status.ready && (
          <div style={{
            padding: 12,
            background: 'rgba(0,255,65,0.05)',
            border: '1px solid rgba(0,255,65,0.3)',
            borderRadius: 4,
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 12,
          }}>
            <div>
              <span style={{ color: '#00ff41' }}>✓</span>{' '}
              <span style={{ color: '#ddd' }}>Subscription active</span>
              {status.amount && status.cycle && (
                <span style={{ color: '#888' }}>
                  {' · '}${(status.amount / 100).toFixed(2)}/{status.cycle === 'annual' ? 'yr' : 'mo'}
                </span>
              )}
            </div>
            {status.cardLast4 && (
              <div style={{ color: '#888' }}>•••• {status.cardLast4}</div>
            )}
          </div>
        )}

        {/* PRIMARY ACTION CARD */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: `2px solid ${tierColor}`,
          borderRadius: 8,
          padding: 24,
          marginBottom: 24,
        }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#888', letterSpacing: 2, marginBottom: 8 }}>
            // STEP 1 OF 1
          </div>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 24,
            color: '#fff',
            letterSpacing: 1,
            marginBottom: 14,
            marginTop: 0,
            fontWeight: 800,
          }}>
            Get the app.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
            <a
              href={APP_STORE_URL}
              style={{
                display: 'block',
                padding: '14px 18px',
                background: tierColor,
                color: '#0a0a0a',
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                textAlign: 'center',
                textDecoration: 'none',
                borderRadius: 4,
              }}
            >
              Open App Store →
            </a>
            <button
              type="button"
              onClick={requestMagicLink}
              disabled={!status.email || magicLinkBusy || magicLinkSent}
              style={{
                padding: '14px 18px',
                background: 'transparent',
                color: tierColor,
                border: `1px solid ${tierColor}`,
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                cursor: status.email && !magicLinkBusy ? 'pointer' : 'not-allowed',
                borderRadius: 4,
                opacity: !status.email || magicLinkBusy ? 0.5 : 1,
              }}
            >
              {magicLinkSent
                ? '✓ Magic Link Sent'
                : magicLinkBusy
                  ? 'Sending…'
                  : 'Resend Magic Link'}
            </button>
          </div>

          {magicLinkError && (
            <div style={{ padding: 8, background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)', color: '#ff8888', fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
              {magicLinkError}
            </div>
          )}

          {/* What's next */}
          <ol style={{
            margin: '16px 0 0 18px',
            padding: 0,
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 13,
            color: '#bbb',
            lineHeight: 1.7,
          }}>
            <li>Download GUNS UP from the App Store</li>
            <li>Tap &quot;Sign In&quot; — use{' '}
              <code style={{ color: tierColor, background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 2 }}>
                {status.email || 'the email you just used'}
              </code>
            </li>
            <li>Tap your magic link from the activation email (or set a password)</li>
            <li>Complete intake — Gunny builds your battle plan</li>
            <li>First workout in under 5 minutes</li>
          </ol>
        </div>

        {/* Reassurance footer */}
        <div style={{
          padding: 14,
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 4,
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: 11,
          color: '#888',
          lineHeight: 1.6,
        }}>
          <div style={{ marginBottom: 6 }}>Your subscription works on iOS, web, and Apple Watch.</div>
          <div style={{ marginBottom: 6 }}>
            Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: tierColor }}>{SUPPORT_EMAIL}</a> — Ruben replies personally.
          </div>
          <div>
            Trouble signing in? <a href="/recover" style={{ color: tierColor }}>Use the recovery wizard</a>.
          </div>
          <div style={{ marginTop: 6, color: '#666' }}>
            Refund policy: cancel anytime, prorated refunds available.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#888', fontFamily: 'Share Tech Mono, monospace' }}>Loading…</div>}>
      <WelcomeInner />
    </Suspense>
  );
}
