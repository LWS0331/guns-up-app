import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

export function initAnalytics() {
  if (typeof window === 'undefined' || initialized || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'memory', // privacy-friendly — no cookies
    autocapture: false, // we'll track specific events
    disable_session_recording: true,
  });
  initialized = true;
}

export function identifyUser(operatorId: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.identify(operatorId, properties);
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function resetAnalytics() {
  if (!initialized) return;
  posthog.reset();
}

// Pre-defined event names for consistency
export const EVENTS = {
  LOGIN: 'user_login',
  LOGOUT: 'user_logout',
  WORKOUT_CREATED: 'workout_created',
  WORKOUT_COMPLETED: 'workout_completed',
  MEAL_LOGGED: 'meal_logged',
  PR_SET: 'pr_set',
  GUNNY_CHAT: 'gunny_chat_sent',
  VOICE_INPUT_USED: 'voice_input_used',
  INTAKE_COMPLETED: 'intake_completed',
  TIER_SELECTED: 'tier_selected',
  CHECKOUT_STARTED: 'checkout_started',
  CHECKOUT_FAILED: 'checkout_failed',
  BILLING_PORTAL_OPENED: 'billing_portal_opened',
  TRAINER_SELECTED: 'trainer_selected',
  BETA_FEEDBACK_SUBMITTED: 'beta_feedback_submitted',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  TAB_CHANGED: 'tab_changed',

  // ─── Early Access funnel ─────────────────────────────────────────────
  // Founding-cohort marketing page (/early-access). Conversion happens
  // entirely off-platform via Instagram DM — these events are how we see
  // intent before it leaves our domain. Properties documented at each
  // fire site in the page + chat components.
  //
  // EARLY_ACCESS_IG_CLICK: any IG-DM/IG-profile click on /early-access.
  //   props: { cta: 'commander' | 'warfighter' | 'ops_helper' | 'closed_box',
  //            tier?: 'commander' | 'warfighter' }
  //
  // EARLY_ACCESS_CHAT_MSG_SENT: user submits a Gunny-Lite question.
  //   props: { msg_number: 1 | 2 }
  //
  // EARLY_ACCESS_CHAT_LIMIT_HIT: server flagged limitReached=true (either
  // because the 2-msg cap is now exhausted, or because the Anthropic call
  // failed and the fallback path triggered).
  //   props: { via: 'cap_reached' | 'network_error' }
  //
  // EARLY_ACCESS_CHAT_FALLBACK_CLICK: user clicks the "DM @gunnyai_fit"
  // button that replaces the input after limit hit.
  //   props: {}
  EARLY_ACCESS_IG_CLICK: 'early_access_ig_click',
  EARLY_ACCESS_CHAT_MSG_SENT: 'early_access_chat_msg_sent',
  EARLY_ACCESS_CHAT_LIMIT_HIT: 'early_access_chat_limit_hit',
  EARLY_ACCESS_CHAT_FALLBACK_CLICK: 'early_access_chat_fallback_click',
} as const;
