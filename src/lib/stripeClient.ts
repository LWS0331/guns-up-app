// Client-side helper for kicking off the Stripe-hosted checkout flow.
//
// The landing page tier CTAs route to /login?tier=<key>&cycle=monthly so the
// user authenticates first. Once login succeeds (or the user is already
// authed and lands on /login or / with the same params), this helper takes
// the operator + tier + cycle and posts to /api/stripe/checkout, which
// returns a Stripe Checkout Session URL — we redirect there so Stripe owns
// the card-collection UI.
//
// Why a hard `window.location.assign` instead of `router.push`: the URL is
// stripe.com, not our origin. Next's router won't navigate cross-origin.

import { getAuthToken } from './authClient';
import type { Operator } from './types';

export type BillingCycle = 'monthly' | 'annual';

export interface StartCheckoutOptions {
  operator: Pick<Operator, 'id' | 'email' | 'callsign'>;
  tier: string;          // operator.tier key — haiku | sonnet | opus | white_glove
  cycle?: BillingCycle;  // default monthly
}

export interface StartCheckoutResult {
  ok: boolean;
  redirected?: boolean;
  error?: string;
}

/**
 * POST to /api/stripe/checkout and redirect to the returned session URL.
 * Surfaces any error in the return value rather than throwing — callers can
 * decide whether to show a toast / inline message / fall back to /.
 */
export async function startCheckout(opts: StartCheckoutOptions): Promise<StartCheckoutResult> {
  const cycle: BillingCycle = opts.cycle === 'annual' ? 'annual' : 'monthly';

  try {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
        operatorId: opts.operator.id,
        tier: opts.tier,
        billingCycle: cycle,
        email: opts.operator.email,
        callsign: opts.operator.callsign,
      }),
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      console.error('[stripeClient] checkout API rejected:', res.status, detail);
      return { ok: false, error: detail?.error || `checkout_${res.status}` };
    }

    const data = (await res.json()) as { url?: string };
    if (!data.url) {
      return { ok: false, error: 'checkout_missing_url' };
    }

    // Stripe-hosted checkout — full-page redirect.
    window.location.assign(data.url);
    return { ok: true, redirected: true };
  } catch (err) {
    console.error('[stripeClient] network error:', err);
    return { ok: false, error: 'network_error' };
  }
}

/**
 * Open Stripe Customer Portal for an authed user (manage subscription,
 * payment method, cancel, etc.). Uses /api/stripe/portal which returns a
 * portal session URL.
 */
export async function openBillingPortal(operatorId: string): Promise<StartCheckoutResult> {
  try {
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ operatorId }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      return { ok: false, error: detail?.error || `portal_${res.status}` };
    }
    const data = (await res.json()) as { url?: string };
    if (!data.url) return { ok: false, error: 'portal_missing_url' };
    window.location.assign(data.url);
    return { ok: true, redirected: true };
  } catch (err) {
    console.error('[stripeClient] portal network error:', err);
    return { ok: false, error: 'network_error' };
  }
}
