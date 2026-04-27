'use client';

// /recover — recovery wizard for users who paid but can't access
// their account. PaywallSpec §7. Most common cause: signed up with a
// different email than the one used at checkout.
//
// Flow:
//   1. User enters email
//   2. Backend (/api/auth/recover) tries 3 strategies:
//      a. Email matches existing Operator → magic link sent
//      b. Email matches Stripe customer but no Operator → repair +
//         magic link
//      c. Nothing found → support email fallback
//   3. UI shows the outcome message + clear next step

import React, { useState } from 'react';

interface RecoverResult {
  ok: boolean;
  outcome?: 'magic_link_sent' | 'account_repaired' | 'not_found';
  message?: string;
  error?: string;
}

const SUPPORT_EMAIL = 'support@gunsupfitness.com';

export default function RecoverPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RecoverResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, error: 'Network error. Try again or email support.' });
    } finally {
      setBusy(false);
    }
  };

  const outcomeColor =
    result?.outcome === 'magic_link_sent' || result?.outcome === 'account_repaired' ? '#00ff41'
    : result?.outcome === 'not_found' ? '#facc15'
    : '#ff6b35';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#030303',
      color: '#ddd',
      fontFamily: 'Chakra Petch, sans-serif',
      padding: '40px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ maxWidth: 540, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#666', letterSpacing: 3, marginBottom: 10 }}>
            // GUNS UP · RECOVERY
          </div>
          <h1 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 24,
            color: '#fff',
            letterSpacing: 2,
            margin: 0,
            fontWeight: 800,
          }}>
            CAN&apos;T SIGN IN?
          </h1>
          <p style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: '#888', marginTop: 10, lineHeight: 1.6 }}>
            Enter the email you used at checkout. We&apos;ll find your subscription and send you a magic link.
          </p>
        </div>

        {!result?.outcome && (
          <form onSubmit={submit} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: 20,
          }}>
            <label htmlFor="email" style={{ display: 'block', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#888', marginBottom: 6, letterSpacing: 1 }}>
              Email used at checkout
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              autoFocus
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0a0a0a',
                border: '1px solid rgba(0,255,65,0.3)',
                color: '#e0e0e0',
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 14,
                borderRadius: 3,
                marginBottom: 14,
              }}
              placeholder="you@example.com"
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: busy || !email.trim() ? 'rgba(0,255,65,0.1)' : '#00ff41',
                color: busy || !email.trim() ? '#00ff41' : '#0a0a0a',
                border: '1px solid #00ff41',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1.5,
                cursor: busy ? 'wait' : !email.trim() ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                borderRadius: 3,
              }}
            >
              {busy ? 'Searching…' : 'Find My Subscription'}
            </button>

            <div style={{ marginTop: 12, fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#555', lineHeight: 1.5 }}>
              We never confirm or deny account existence in error responses — for security. Check your inbox after submitting.
            </div>
          </form>
        )}

        {result?.outcome && (
          <div style={{
            padding: 18,
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${outcomeColor}`,
            borderLeft: `4px solid ${outcomeColor}`,
            borderRadius: 4,
            marginBottom: 16,
          }}>
            <div style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 11,
              letterSpacing: 2,
              color: outcomeColor,
              marginBottom: 8,
              textTransform: 'uppercase',
            }}>
              {result.outcome === 'magic_link_sent' && '✓ Magic Link Sent'}
              {result.outcome === 'account_repaired' && '✓ Account Repaired'}
              {result.outcome === 'not_found' && '⚠ Not Found'}
            </div>
            <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 13, color: '#ddd', lineHeight: 1.6 }}>
              {result.message}
            </div>
            {result.outcome === 'not_found' && (
              <div style={{ marginTop: 12 }}>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=GUNS%20UP%20recovery%20-%20${encodeURIComponent(email)}`}
                  style={{
                    display: 'inline-block',
                    padding: '8px 14px',
                    border: `1px solid ${outcomeColor}`,
                    color: outcomeColor,
                    fontFamily: 'Orbitron, sans-serif',
                    fontSize: 11,
                    letterSpacing: 1.5,
                    textDecoration: 'none',
                    textTransform: 'uppercase',
                    borderRadius: 3,
                  }}
                >
                  Email Support →
                </a>
              </div>
            )}
            {(result.outcome === 'magic_link_sent' || result.outcome === 'account_repaired') && (
              <button
                type="button"
                onClick={() => { setResult(null); setEmail(''); }}
                style={{
                  marginTop: 14,
                  padding: '6px 12px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent',
                  color: '#888',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 10,
                  letterSpacing: 1.5,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  borderRadius: 3,
                }}
              >
                Try Another Email
              </button>
            )}
          </div>
        )}

        {result?.error && !result.outcome && (
          <div style={{
            padding: 14,
            background: 'rgba(255,68,68,0.08)',
            border: '1px solid rgba(255,68,68,0.4)',
            color: '#ff8888',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 12,
            borderRadius: 3,
          }}>
            {result.error}
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'center', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#555', lineHeight: 1.6 }}>
          Still stuck? <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#888' }}>{SUPPORT_EMAIL}</a> — Ruben replies personally during launch.
        </div>
      </div>
    </div>
  );
}
