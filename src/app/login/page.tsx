'use client';

// /login — dedicated route for the member login flow.
//
// Why this exists: previously the root `/` page rendered the LoginScreen for
// logged-out users, which meant gunnyai.fit landed visitors directly on a PIN
// keypad with no marketing context. We've now moved the marketing landing
// page to `/`, so members who already have accounts come here from the
// landing page's "MEMBER LOGIN" / "DEPLOY" CTAs.
//
// Tier-aware checkout: the landing page tier CTAs route here as
//   /login?tier=<haiku|sonnet|opus|white_glove>&cycle=monthly
// After the user authenticates we forward operator + tier + cycle to
// /api/stripe/checkout (via lib/stripeClient.startCheckout) and bounce
// to the Stripe-hosted checkout page. Without a tier param we fall through
// to the existing window.location → '/' behavior.
//
// LoginScreen still owns the auth flow (PIN, email, register). On successful
// login it calls onLogin(operator). The root page's loadFromDB effect picks
// up the new authToken from localStorage and renders AppShell.

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginScreen from '@/components/LoginScreen';
import { OPERATORS } from '@/data/operators';
import { getAuthToken } from '@/lib/authClient';
import { trackEvent, EVENTS } from '@/lib/analytics';
import { startCheckout, type BillingCycle } from '@/lib/stripeClient';
import type { Operator } from '@/lib/types';

const VALID_TIERS = new Set(['haiku', 'sonnet', 'opus', 'white_glove']);

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();

  // Pull tier intent off the URL once on mount; keep it stable across
  // re-renders. If a logged-out user lands on /login?tier=opus and then
  // authenticates, we fire startCheckout(opus) before they ever see the
  // app. If they're already logged in below, the same params get carried
  // to / so the home page can choose to surface them too.
  const tierParam = (params?.get('tier') || '').toLowerCase();
  const cycleParam = (params?.get('cycle') || '').toLowerCase();
  const tier = VALID_TIERS.has(tierParam) ? tierParam : null;
  const cycle: BillingCycle = cycleParam === 'annual' ? 'annual' : 'monthly';

  // If the user already has a valid token, bounce them — visiting /login
  // when authed shouldn't reset anything. Cheap client-side check;
  // /api/auth/me on `/` will still validate and clear an expired token.
  // We forward tier/cycle so the home page can pick up checkout intent
  // for already-authed users (they'll see the upgrade affordance there).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (getAuthToken()) {
      const target = tier ? `/?tier=${tier}&cycle=${cycle}` : '/';
      router.replace(target);
    }
  }, [router, tier, cycle]);

  return (
    <LoginScreen
      operators={OPERATORS}
      onLogin={async (operator: Operator) => {
        // Fire the LOGIN event here — root page's loadFromDB calls identifyUser
        // once auth/me resolves, but the LOGIN trackEvent only makes sense at
        // the moment a fresh authentication actually happens.
        try {
          trackEvent(EVENTS.LOGIN, { role: operator.role, tier: operator.tier });
        } catch { /* analytics shouldn't block navigation */ }

        // Tier intent in the URL → kick straight to Stripe checkout.
        // startCheckout posts to /api/stripe/checkout with the operator's
        // identity and performs its own window.location.assign(stripe_url).
        // We only fall through to '/' if the dispatch fails (network /
        // server) so the user doesn't get stranded mid-funnel.
        if (tier) {
          try {
            trackEvent(EVENTS.LOGIN, { stage: 'checkout_dispatch', tier, cycle });
          } catch { /* swallow */ }

          const result = await startCheckout({
            operator: { id: operator.id, email: operator.email, callsign: operator.callsign },
            tier,
            cycle,
          });

          if (result.ok && result.redirected) return; // Stripe owns the next page
          // Fall-through: surface intent on home so the upgrade CTA is
          // visible there. Avoids a dead-end if Stripe call failed.
          console.warn('[login] checkout dispatch failed:', result.error);
          window.location.href = `/?tier=${tier}&cycle=${cycle}&checkout=failed`;
          return;
        }

        // No tier intent — standard post-login bounce. Hard navigation,
        // not router.push: the root page's mount effect (loadFromDB) reads
        // localStorage for the authToken at boot. Using window.location
        // ensures that effect re-runs cleanly with the freshly-stored
        // token, instead of leaving stale Home state behind.
        window.location.href = '/';
      }}
    />
  );
}

export default function LoginPage() {
  // useSearchParams suspends during static prerender — wrap so the page
  // can still be statically generated without bailing the whole tree.
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
