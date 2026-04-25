'use client';

// /login — dedicated route for the member login flow.
//
// Why this exists: previously the root `/` page rendered the LoginScreen for
// logged-out users, which meant gunnyai.fit landed visitors directly on a PIN
// keypad with no marketing context. We've now moved the marketing landing
// page to `/`, so members who already have accounts come here from the
// landing page's "MEMBER LOGIN" / "DEPLOY" CTAs.
//
// LoginScreen still owns the auth flow (PIN, email, register). On successful
// login it calls onLogin(operator) — we don't need the operator object here,
// we just route to `/`. The root page's loadFromDB effect picks up the new
// authToken from localStorage and renders AppShell.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginScreen from '@/components/LoginScreen';
import { OPERATORS } from '@/data/operators';
import { getAuthToken } from '@/lib/authClient';
import { trackEvent, EVENTS } from '@/lib/analytics';
import type { Operator } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();

  // If the user already has a valid token, bounce them to the app — visiting
  // /login when authed shouldn't reset anything. Cheap client-side check;
  // /api/auth/me on `/` will still validate and clear an expired token.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (getAuthToken()) {
      router.replace('/');
    }
  }, [router]);

  return (
    <LoginScreen
      operators={OPERATORS}
      onLogin={(operator: Operator) => {
        // Fire the LOGIN event here — root page's loadFromDB calls identifyUser
        // once auth/me resolves, but the LOGIN trackEvent only makes sense at
        // the moment a fresh authentication actually happens.
        try {
          trackEvent(EVENTS.LOGIN, { role: operator.role, tier: operator.tier });
        } catch { /* analytics shouldn't block navigation */ }

        // Hard navigation, not router.push: the root page's mount effect
        // (loadFromDB) reads localStorage for the authToken at boot. Using
        // window.location ensures that effect re-runs cleanly with the
        // freshly-stored token, instead of leaving stale Home state behind.
        window.location.href = '/';
      }}
    />
  );
}
