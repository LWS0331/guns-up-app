'use client';

// /auth/oauth-callback — terminal step of the Google OAuth dance.
//
// /api/auth/google/callback redirects here with ?token=<jwt>&next=<path>.
// We stash the JWT in localStorage (matching the shape of the existing
// email/PIN login flows) and bounce to `next` (or "/" by default), stripping
// the token from the address bar so it doesn't end up in browser history.
//
// This page is intentionally bare — no nav, no styling beyond a status line —
// because it's a 200ms transit. Users should never linger here.

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const SAFE_NEXT_DEFAULT = '/';

function isSafeNext(value: string | null): value is string {
  if (!value) return false;
  return value.startsWith('/') && !value.startsWith('//');
}

function OAuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<'finalizing' | 'error'>('finalizing');

  useEffect(() => {
    const token = params?.get('token');
    const nextParam = params?.get('next');
    const next = isSafeNext(nextParam || null) ? nextParam! : SAFE_NEXT_DEFAULT;

    if (!token) {
      setStatus('error');
      return;
    }

    try {
      localStorage.setItem('authToken', token);
    } catch {
      // localStorage unavailable (private mode, locked-down browser) —
      // continue anyway so the user isn't stranded; they'll just have to
      // re-authenticate next visit.
    }

    // Strip the token from the address bar BEFORE navigation so it doesn't
    // sit in history. router.replace handles the navigation part; this
    // replaces the current entry instead of pushing a new one.
    router.replace(next);
  }, [params, router]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#030303',
        color: '#00ff41',
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 11,
        letterSpacing: 2,
        textTransform: 'uppercase',
        padding: 24,
        textAlign: 'center',
      }}
    >
      {status === 'finalizing' ? (
        <span>// AUTHENTICATING — STAND BY…</span>
      ) : (
        <span style={{ color: '#ff4444' }}>
          // SIGN-IN FAILED · <a href="/login" style={{ color: '#00ff41', textDecoration: 'underline' }}>return to login</a>
        </span>
      )}
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', backgroundColor: '#030303' }} />}>
      <OAuthCallbackInner />
    </Suspense>
  );
}
