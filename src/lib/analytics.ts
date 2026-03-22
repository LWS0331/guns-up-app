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
  TRAINER_SELECTED: 'trainer_selected',
  BETA_FEEDBACK_SUBMITTED: 'beta_feedback_submitted',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  TAB_CHANGED: 'tab_changed',
} as const;
