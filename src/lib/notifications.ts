// Push notification utilities for GUNS UP PWA
// Full SITREP-aware compliance reminder engine

import { getLocalDateStr, toLocalDateStr } from './dateUtils';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function getNotificationPermission(): string {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Schedule a local notification (uses service worker for reliability).
//
// IMPORTANT: this function does NOT request permission. Chrome and Safari
// reject Notification.requestPermission() calls that aren't triggered by a
// direct user gesture (click/tap), so attempting to prompt from a timer or
// async effect either rejects silently or throws "NotAllowedError" — and
// even when it works, it surprises the user with an "Allow notifications?"
// popup in the middle of an unrelated flow (e.g. mid-chat or post-meal-log).
// If permission isn't already granted, we no-op. The actual permission
// prompt lives behind the "REQUEST PERMISSION" button in NotificationSettings
// (COCDashboard), which is guaranteed user-initiated.
export async function sendLocalNotification(title: string, body: string, tag?: string): Promise<void> {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag || 'guns-up-notification',
      data: { url: '/' },
    } as NotificationOptions);
  } else {
    new Notification(title, { body, icon: '/icon-192.png' });
  }
}

// ─── NOTIFICATION TYPES ──────────────────────────────────────

export function notifyStreakWarning(callsign: string, streak: number): void {
  sendLocalNotification(
    `STREAK ALERT, ${callsign}!`,
    `Your ${streak}-day streak is on the line. Get a workout in today or lose it.`,
    'streak-warning'
  );
}

export function notifyWorkoutReminder(callsign: string): void {
  sendLocalNotification(
    `TIME TO TRAIN, ${callsign}`,
    'Your workout is waiting. No excuses.',
    'workout-reminder'
  );
}

export function notifyPRAlert(callsign: string, exercise: string, weight: number): void {
  sendLocalNotification(
    `NEW PR! ${exercise}`,
    `${callsign} just hit ${weight} lbs. Keep pushing.`,
    'pr-alert'
  );
}

export function notifyGunnyCheckIn(callsign: string, message: string): void {
  sendLocalNotification(
    `GUNNY CHECK-IN`,
    `${callsign}, ${message}`,
    'gunny-checkin'
  );
}

// ─── NEW: SITREP COMPLIANCE NOTIFICATIONS ────────────────────

export function notifyDailyBriefReady(callsign: string): void {
  sendLocalNotification(
    `DAILY BRIEF READY, ${callsign}`,
    'Your battle plan for today is locked and loaded. Open up and review your orders.',
    'daily-brief'
  );
}

export function notifyMealLogging(callsign: string, mealsLogged: number, targetMeals: number): void {
  const remaining = targetMeals - mealsLogged;
  if (remaining <= 0) return;
  const messages = [
    `${remaining} meal${remaining > 1 ? 's' : ''} left to log today. Nutrition is half the battle.`,
    `You've logged ${mealsLogged}/${targetMeals} meals. Don't let your nutrition slip.`,
    `${remaining} more meal${remaining > 1 ? 's' : ''} to track. Fuel the machine, ${callsign}.`,
  ];
  sendLocalNotification(
    `LOG YOUR MEALS, ${callsign}`,
    messages[Math.floor(Math.random() * messages.length)],
    'meal-reminder'
  );
}

export function notifyHydration(callsign: string): void {
  const messages = [
    'Hydration check. Drink water now. Your performance depends on it.',
    'Water break. Dehydration kills gains before bad programming does.',
    'Have you hit your water target? Stay ahead of the curve.',
  ];
  sendLocalNotification(
    `HYDRATE, ${callsign}`,
    messages[Math.floor(Math.random() * messages.length)],
    'hydration-reminder'
  );
}

export function notifyComplianceScore(callsign: string, score: number): void {
  let title: string;
  let body: string;
  if (score >= 90) {
    title = `OUTSTANDING, ${callsign}!`;
    body = `Yesterday's compliance: ${score}%. You're operating at peak level. Keep this standard.`;
  } else if (score >= 70) {
    title = `SOLID WORK, ${callsign}`;
    body = `Yesterday's compliance: ${score}%. Good effort but there's room to tighten up. Push for 90%+ today.`;
  } else if (score >= 50) {
    title = `RALLY UP, ${callsign}`;
    body = `Yesterday's compliance: ${score}%. Half-measures get half-results. Recommit today.`;
  } else {
    title = `WAKE UP CALL, ${callsign}`;
    body = `Yesterday's compliance: ${score}%. The mission doesn't complete itself. Get back on track NOW.`;
  }
  sendLocalNotification(title, body, 'compliance-score');
}

export function notifyEveningCheckIn(callsign: string, workoutDone: boolean, mealsLogged: number, targetMeals: number): void {
  const issues: string[] = [];
  if (!workoutDone) issues.push('workout not logged');
  if (mealsLogged < targetMeals) issues.push(`${targetMeals - mealsLogged} meal${targetMeals - mealsLogged > 1 ? 's' : ''} unlogged`);

  if (issues.length === 0) {
    sendLocalNotification(
      `MISSION COMPLETE, ${callsign}`,
      'All tasks accounted for today. Rest well — tomorrow we go again.',
      'evening-checkin'
    );
  } else {
    sendLocalNotification(
      `END OF DAY CHECK, ${callsign}`,
      `Still outstanding: ${issues.join(', ')}. Close out strong before lights out.`,
      'evening-checkin'
    );
  }
}

export function notifyRestDay(callsign: string): void {
  sendLocalNotification(
    `REST DAY, ${callsign}`,
    'Recovery is part of the mission. Stretch, hydrate, sleep well. Tomorrow we attack.',
    'rest-day'
  );
}

// ─── NOTIFICATION PREFERENCES ────────────────────────────────

export interface NotificationPreferences {
  workoutReminders: boolean;
  streakWarnings: boolean;
  prAlerts: boolean;
  gunnyCheckIns: boolean;
  mealReminders: boolean;
  hydrationReminders: boolean;
  dailyBriefAlerts: boolean;
  complianceAlerts: boolean;
  eveningCheckIn: boolean;
  reminderTime: string;        // HH:MM — morning workout/brief reminder
  eveningCheckInTime: string;  // HH:MM — evening wrap-up
  mealReminderTimes: string[]; // HH:MM[] — meal logging nudges
  hydrationInterval: number;   // hours between hydration reminders (0 = off)
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  workoutReminders: true,
  streakWarnings: true,
  prAlerts: true,
  gunnyCheckIns: true,
  mealReminders: true,
  hydrationReminders: true,
  dailyBriefAlerts: true,
  complianceAlerts: true,
  eveningCheckIn: true,
  reminderTime: '08:00',
  eveningCheckInTime: '20:00',
  mealReminderTimes: ['12:00', '15:00', '18:00'],
  hydrationInterval: 2,
};

// Save/load notification preferences
export function saveNotificationPrefs(operatorId: string, prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(`guns-up-notif-${operatorId}`, JSON.stringify(prefs));
  } catch { /* localStorage may not be available */ }
}

export function loadNotificationPrefs(operatorId: string): NotificationPreferences {
  try {
    const stored = localStorage.getItem(`guns-up-notif-${operatorId}`);
    if (stored) {
      // Merge with defaults to handle new fields added after user saved prefs
      return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(stored) };
    }
  } catch { /* ignore */ }
  return DEFAULT_NOTIFICATION_PREFS;
}

// ─── COMPLIANCE CHECK ENGINE ─────────────────────────────────

// Check and send streak warning if needed
export function checkStreakWarning(callsign: string, workouts: Record<string, { completed?: boolean }>): void {
  const today = getLocalDateStr();
  const hasWorkoutToday = workouts[today]?.completed;

  if (!hasWorkoutToday) {
    let streak = 0;
    const now = new Date();
    for (let i = 1; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = toLocalDateStr(d);
      if (workouts[key]?.completed) streak++;
      else break;
    }

    if (streak >= 3) {
      notifyStreakWarning(callsign, streak);
    }
  }
}

// Full compliance check — called from AppShell on login and periodically
export interface ComplianceCheckData {
  callsign: string;
  workouts: Record<string, { completed?: boolean }>;
  nutrition: {
    meals?: Record<string, Array<{ calories: number }>>;
    targets?: { calories?: number };
  };
  sitrep: {
    nutritionPlan?: {
      mealsPerDay?: number;
      dailyCalories?: number;
    };
    trainingPlan?: {
      daysPerWeek?: number;
    };
  } | null;
  dailyBrief: {
    date?: string;
    complianceScore?: number;
    workout?: { title: string } | null;
  } | null;
}

export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Check meal logging status for today
export function checkMealCompliance(data: ComplianceCheckData): { logged: number; target: number } {
  const today = getTodayStr();
  const mealsToday = data.nutrition?.meals?.[today] || [];
  const target = data.sitrep?.nutritionPlan?.mealsPerDay || 3;
  return { logged: mealsToday.length, target };
}

// Run morning compliance check — fires daily brief and compliance score notifications
export function runMorningComplianceCheck(data: ComplianceCheckData, prefs: NotificationPreferences): void {
  // Daily brief ready notification
  if (prefs.dailyBriefAlerts && data.sitrep) {
    notifyDailyBriefReady(data.callsign);
  }

  // Yesterday's compliance score
  if (prefs.complianceAlerts && data.dailyBrief?.complianceScore != null) {
    notifyComplianceScore(data.callsign, data.dailyBrief.complianceScore);
  }

  // Rest day notification
  if (data.dailyBrief?.workout === null) {
    notifyRestDay(data.callsign);
  }
}

// Run meal check — fires if meals behind schedule
export function runMealCheck(data: ComplianceCheckData, prefs: NotificationPreferences): void {
  if (!prefs.mealReminders) return;
  const { logged, target } = checkMealCompliance(data);
  if (logged < target) {
    notifyMealLogging(data.callsign, logged, target);
  }
}

// Run evening check — fires end-of-day summary
export function runEveningCheck(data: ComplianceCheckData, prefs: NotificationPreferences): void {
  if (!prefs.eveningCheckIn) return;
  const today = getTodayStr();
  const workoutDone = !!data.workouts?.[today]?.completed;
  const { logged, target } = checkMealCompliance(data);
  notifyEveningCheckIn(data.callsign, workoutDone, logged, target);
}
