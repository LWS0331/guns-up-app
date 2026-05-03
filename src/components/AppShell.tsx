'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Operator, AppTab, OPS_CENTER_ACCESS, Workout } from '@/lib/types';
import { buildWorkoutAnalysis, findMostRecentCompletedWorkout } from '@/lib/workoutAnalysis';
import { applyWorkoutModification, type WorkoutModification, type PrefillWeightsMod } from '@/lib/workoutModification';
import { dispatchPrefillWeights } from '@/lib/workoutEvents';
import { buildFullGunnyContext } from '@/lib/buildGunnyContext';
import { getLocalDateStr, toLocalDateStr, isValidDateStr, getLocalTimezone } from '@/lib/dateUtils';
import Icon, { BoltIcon, SendIcon } from '@/components/Icons';
import Logo from '@/components/Logo';
import OpsCenter from '@/components/OpsCenter';
import UserSwitcher from '@/components/UserSwitcher';
// LanguageToggle removed from AppShell — language now locks at
// signup. Picker still lives on LoginScreen.
import { useLanguage } from '@/lib/i18n';
import COCDashboard from '@/components/COCDashboard';
import Planner, { WorkoutModeState } from '@/components/Planner';
import IntelCenter from '@/components/IntelCenter';
import { GunnyChat } from '@/components/GunnyChat';
import IntakeForm from '@/components/IntakeForm';
import JuniorIntakeForm from '@/components/JuniorIntakeForm';
import ParentDashboard from '@/components/ParentDashboard';
import DailyOps from '@/components/DailyOps';
import { hasCommanderAccess } from '@/lib/tierGates';
import { isJuniorOperatorEnabledClient } from '@/lib/featureFlags';
import { getParentJuniors } from '@/data/operators';
import SitrepView from '@/components/SitrepView';
import TacticalRadio from '@/components/TacticalRadio';
import { speak as gunnySpeak, isTtsEnabled, setTtsEnabled as setTtsEnabledGlobal, onTtsEnabledChange, unlockAudioContext, stopSpeaking, onSpeechDone, offSpeechDone } from '@/lib/tts';
import ThinkingIndicator from '@/components/gunny/ThinkingIndicator';
import { GunnyMarkdown } from '@/components/gunny/GunnyMarkdown';
import { getAuthToken } from '@/lib/authClient';
import DailyBriefComponent from '@/components/DailyBrief';
import BattlePlanRef from '@/components/BattlePlanRef';
import DailyBriefRef from '@/components/DailyBriefRef';
import Leaderboard from '@/components/Leaderboard';
import Achievements from '@/components/Achievements';
import SocialFeed from '@/components/SocialFeed';
import BetaFeedback from '@/components/BetaFeedback';
import TrainerDashboard from '@/components/TrainerDashboard';
import { TermsOfService, PrivacyPolicy } from '@/components/LegalPages';
import WhatsNewModal from '@/components/WhatsNewModal';
import PersonaPicker from '@/components/PersonaPicker';
import type { Announcement, AnnouncementAction } from '@/data/announcements';
import type { PersonaId } from '@/lib/personas';
import { trackEvent, EVENTS } from '@/lib/analytics';
import {
  requestNotificationPermission,
  checkStreakWarning,
  notifyWorkoutReminder,
  notifyHydration,
  loadNotificationPrefs,
  runMorningComplianceCheck,
  runMealCheck,
  runEveningCheck,
  ComplianceCheckData,
} from '@/lib/notifications';

// ═══ Matrix Code Rain Background (slowed & subtle) ═══
const DataRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    let lastFrame = 0;
    const FPS = 12; // throttled from ~60fps to 12fps — much easier on the eyes
    const frameInterval = 1000 / FPS;
    const chars = '01アイウエオカキクケコサシスセソABCDEF0123456789ΣΩΔλ{}[]<>/\\=+*&#@';
    const fontSize = 13;
    let columns: number;
    let drops: number[];
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = Array.from({ length: columns }, () => Math.random() * -100);
    };
    resize();
    window.addEventListener('resize', resize);
    const draw = (timestamp: number) => {
      animId = requestAnimationFrame(draw);
      const delta = timestamp - lastFrame;
      if (delta < frameInterval) return; // skip frames to maintain target FPS
      lastFrame = timestamp - (delta % frameInterval);
      ctx.fillStyle = 'rgba(3,3,3,0.08)'; // slightly faster fade = shorter trails
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px 'Share Tech Mono', monospace`;
      for (let i = 0; i < drops.length; i++) {
        // only update ~40% of columns per frame for a staggered, calm effect
        if (Math.random() > 0.4) continue;
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,255,65,0.08)' : 'rgba(0,255,65,0.04)';
        ctx.fillText(char, x, y);
        if (y > canvas.height && Math.random() > 0.985) drops[i] = 0;
        drops[i] += 0.4; // slow constant speed (was 0.5-1.0)
      }
    };
    animId = requestAnimationFrame(draw);
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />;
};

// ═══ Gunny Chat Message Types ═══
interface ChatMessage {
  role: 'user' | 'gunny';
  text: string;
  timestamp?: number;
  /** Optional base64 data-URL attached to a user message — forwarded
   *  to /api/gunny as a Claude vision content block. Used by the
   *  workout-mode form-check upload path. */
  image?: string;
}

interface OperatorContextData {
  callsign: string;
  name: string;
  role: string;
  weight?: number;
  height?: string;
  age?: number;
  bodyFat?: number;
  goals?: string[];
  readiness?: number;
  fitnessLevel?: string;
  experienceYears?: number;
  exerciseHistory?: string;
  currentActivity?: string;
  availableEquipment?: string[];
  equipmentDetailed?: Array<{ name: string; description?: string; category?: string }>;
  preferredWorkoutTime?: string;
  healthConditions?: string[];
  sleepQuality?: number;
  stressLevel?: number;
  nutritionHabits?: string;
  currentDiet?: string;
  macroTargets?: { calories: number; protein: number; carbs: number; fat: number };
  dietaryRestrictions?: string[];
  supplements?: string[];
  prs?: Array<{ exercise: string; weight: number; reps?: number; date?: string; type?: string; notes?: string }>;
  injuries?: Array<{ id: string; name: string; status: string; notes?: string; restrictions?: string[] }>;
  injuryNotes?: string;
  movementScreenScore?: number;
  motivationFactors?: string[];
  mealsPerDay?: number;
  dailyWaterOz?: number;
  estimatedCalories?: number;
  proteinPriority?: string;
  daysPerWeek?: number;
  sessionDuration?: number;
  preferredSplit?: string;
  wearableDevice?: string;
  trainerNotes?: string;
  language?: string;
  sitrep?: {
    summary: string; trainingPlan: Record<string, unknown>;
    nutritionPlan?: { dailyCalories: number; protein: number; carbs: number; fat: number; mealsPerDay: number; hydrationOz: number; approach: string } | null;
    priorityFocus: string[]; restrictions: string[]; milestones30Day: string[];
  } | null;
  dailyBrief?: { complianceScore?: number; adjustments?: string; gunnyNote?: string } | null;
  todayWorkout?: { title: string; exercises: string[]; completed: boolean } | null;
  recentWorkoutHistory?: string;
  recentMealHistory?: string;
  workoutStreak?: number;
  totalWorkoutsCompleted?: number;
  recentDayTags?: string | null;
  trainingAge?: string;
  lastCompletedWorkout?: string | null;
  workoutExecution?: string | null;
}

interface AppShellProps {
  currentUser: Operator;
  accessibleUsers: Operator[];
  operators: Operator[];
  onUpdateOperator: (updated: Operator, immediate?: boolean) => void;
  onLogout: () => void;
}

const AppShell: React.FC<AppShellProps> = ({
  currentUser,
  accessibleUsers,
  operators,
  onUpdateOperator,
  onLogout,
}) => {
  const { t, language, setLanguage } = useLanguage();

  // ─── Language lock (May 2026) ───────────────────────────────────────
  // Operators pick EN or ES at signup, and that choice is stored in
  // operator.preferences.language. The in-app LanguageToggle has been
  // hidden — switches require a support request.
  //
  // Three layers of resolution, in order of trust:
  //   1. operator.preferences.language (server, source of truth)
  //   2. localStorage (legacy beta operators who toggled via the old UI)
  //   3. default 'en'
  //
  // For (2): we backfill the localStorage value into the operator
  // record one time, so going forward the server is canonical and
  // they survive device changes / cache wipes.
  useEffect(() => {
    const prefs = (currentUser.preferences || {}) as Record<string, unknown>;
    const serverLang = prefs.language;
    if (serverLang === 'en' || serverLang === 'es') {
      if (serverLang !== language) setLanguage(serverLang);
      return;
    }
    // No server preference yet — backfill from localStorage if present.
    let lsLang: 'en' | 'es' | null = null;
    try {
      const v = localStorage.getItem('gunsup-language');
      if (v === 'en' || v === 'es') lsLang = v;
    } catch { /* localStorage unavailable */ }
    const resolved: 'en' | 'es' = lsLang ?? 'en';
    if (resolved !== language) setLanguage(resolved);
    // Persist back to the operator record so future logins on any
    // device honor this choice. Best-effort; silent failure is fine
    // because localStorage continues to keep the client consistent.
    (async () => {
      try {
        const token = getAuthToken();
        await fetch(`/api/operators/${currentUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            preferences: { ...(currentUser.preferences || {}), language: resolved },
          }),
        });
      } catch {
        // Silent — backfill will retry on next login.
      }
    })();
    // We intentionally only depend on operator id — preferences object
    // identity changes on every render and would loop the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  // Check if intake is completed — 3-layer check: intake column, profile flag, localStorage backup
  const lsIntakeDone = (() => { try { return localStorage.getItem(`guns-up-intake-done-${currentUser.id}`) === 'true'; } catch { return false; } })();
  const intakeCompleted = currentUser.intake?.completed === true || currentUser.profile?.intakeCompleted === true || lsIntakeDone;
  const [showIntake, setShowIntake] = useState(!intakeCompleted);

  // Sync showIntake when currentUser data updates (e.g. after save completes and re-fetch)
  useEffect(() => {
    const lsDone = (() => { try { return localStorage.getItem(`guns-up-intake-done-${currentUser.id}`) === 'true'; } catch { return false; } })();
    const completed = currentUser.intake?.completed === true || currentUser.profile?.intakeCompleted === true || lsDone;
    if (completed) {
      setShowIntake(false);
    }
  }, [currentUser.id, currentUser.intake?.completed, currentUser.profile?.intakeCompleted]);

  // Auto-switch to Gunny tab if profile is incomplete (onboarding needed)
  const profileIncomplete = !currentUser.profile?.age || !currentUser.profile?.weight || !currentUser.profile?.goals?.length || !currentUser.preferences?.daysPerWeek;
  const [activeTab, setActiveTab] = useState<AppTab>(profileIncomplete && intakeCompleted ? 'gunny' : 'coc');

  // P6: Font size setting (S/M/L)
  const [fontScale, setFontScale] = useState<'S' | 'M' | 'L'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('gunsup-font-scale') as 'S' | 'M' | 'L') || 'M';
    }
    return 'M';
  });
  useEffect(() => {
    const zoomMap = { S: '0.85', M: '1', L: '1.15' };
    document.documentElement.style.setProperty('--gu-zoom', zoomMap[fontScale]);
    document.documentElement.setAttribute('data-font-scale', fontScale);
    localStorage.setItem('gunsup-font-scale', fontScale);
  }, [fontScale]);
  const [selectedOperator, setSelectedOperator] = useState<Operator>(currentUser);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // iPad-class viewport flag — drives the .ipad scope helper from
  // the design system so 28px H1 / 24px padding / 2-col grids
  // activate at ≥768px. Spec calls 820px the canonical iPad width
  // but treating anything 768px+ as "iPad-class" gives a smoother
  // breakpoint than waiting for 820 exactly.
  const [isIpadOrLarger, setIsIpadOrLarger] = useState(false);
  const lastWidthRef = useRef(0);
  const [showTrainerDashboard, setShowTrainerDashboard] = useState(false);
  const [showTOS, setShowTOS] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSitrep, setShowSitrep] = useState(false);
  const [sitrepLoading, setSitrepLoading] = useState(false);
  const [pendingSitrep, setPendingSitrep] = useState<import('@/lib/types').Sitrep | null>(null);
  const [showNewPlanConfirm, setShowNewPlanConfirm] = useState(false);

  // ─── What's New (standing shipping order) ────────────────────────────
  // Fetch /api/announcements/current on mount. If an unseen entry comes
  // back, render WhatsNewModal. CTA actions route through
  // handleAnnouncementAction below — that's how `open_persona_picker`
  // surfaces a full-screen PersonaPicker without modal nesting.
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [showStandalonePersonaPicker, setShowStandalonePersonaPicker] = useState(false);

  // Gunny AI panel state
  const [showGunnyPanel, setShowGunnyPanel] = useState(false);
  const [gunnyMessages, setGunnyMessages] = useState<ChatMessage[]>([]);
  const [gunnyInput, setGunnyInput] = useState('');
  const [gunnyLoading, setGunnyLoading] = useState(false);
  const [gunnyThinkingAt, setGunnyThinkingAt] = useState<number | null>(null);
  const [gunnyGreeted, setGunnyGreeted] = useState(false);
  // Mirror the device-scoped global TTS toggle so the header mic icon re-renders
  // when other code (workout mode / planner / anywhere) flips it. One source of
  // truth: lib/tts.ts. The historical per-operator key was migrated once and then
  // retired — see the useEffect below.
  const [gunnyTtsEnabled, setGunnyTtsEnabledLocal] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return isTtsEnabled();
  });
  // Index of the Gunny message in the side-panel chat that is
  // currently being read aloud (or null if nothing is speaking).
  // Drives the per-message HEAR IT / STOP button state.
  const [panelSpeakingIdx, setPanelSpeakingIdx] = useState<number | null>(null);
  const [workoutModeState, setWorkoutModeState] = useState<WorkoutModeState>({ active: false, workoutTitle: '', exercises: [] });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelInitRef = useRef<string>(''); // track which operator panel was initialized for
  // Tracks whether AppShell.gunnyMessages has been hydrated from the
  // DB for the current operator. Critical for preventing the
  // chat-history wipe bug: sendGunnyVoiceMessage (called from
  // Planner / DailyOps / WorkoutMode) appends to gunnyMessages, then
  // the persistence effect PUTs the result to /api/chat — which uses
  // upsert and overwrites the entire `messages` field. If
  // gunnyMessages is still [] (because the floating panel hasn't been
  // opened yet to trigger hydration), the PUT replaces full history
  // with a 1- or 2-message array.
  // The hydration effect below populates gunnyMessages on operator
  // mount regardless of panel state, and the persistence effect
  // gates on this ref so saves only fire after we've loaded.
  const gunnyMessagesHydratedRef = useRef<string>(''); // operator id we've hydrated for

  // Initialize mounted state and responsive detection
  useEffect(() => {
    setMounted(true);
    const check = () => {
      const w = window.innerWidth;
      if (w !== lastWidthRef.current) {
        lastWidthRef.current = w;
        setIsMobile(w < 768);
        setIsIpadOrLarger(w >= 768);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ─── What's New fetch on mount ──────────────────────────────────────
  // Skip while intake is in progress so we don't stack a modal over a
  // brand-new operator onboarding. Once intake clears, this runs.
  useEffect(() => {
    if (showIntake) return;
    let cancelled = false;
    (async () => {
      try {
        const token = getAuthToken();
        const res = await fetch('/api/announcements/current', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.announcement) {
          setAnnouncement(data.announcement as Announcement);
        }
      } catch {
        // Silent — announcements are nice-to-have, not critical path.
      }
    })();
    return () => { cancelled = true; };
  }, [showIntake, currentUser.id]);

  // CTA action router. Keys must match the AnnouncementAction union in
  // src/data/announcements.ts. WhatsNewModal already POSTs the dismiss
  // before invoking this, so we just route to the right surface.
  const handleAnnouncementAction = useCallback((action: AnnouncementAction) => {
    switch (action) {
      case 'open_persona_picker':
        setShowStandalonePersonaPicker(true);
        break;
      case 'open_intake':
        setShowIntake(true);
        break;
      case 'open_billing':
        // Billing tab lives under ops center for now — drop into ops if
        // this operator has access. OPS_CENTER_ACCESS is keyed by op id,
        // not role. Non-admins fall through to dismiss-only.
        if (OPS_CENTER_ACCESS.includes(currentUser.id)) {
          setActiveTab('ops');
        }
        break;
      case 'open_wearable_connect':
        // Wearable hub is reached from Intel Center. Route there.
        setActiveTab('intel');
        break;
      case 'dismiss_only':
      default:
        break;
    }
  }, [currentUser.id]);

  // ═══ Compliance Notification Engine ═══
  useEffect(() => {
    // Request notification permission once on mount
    requestNotificationPermission().catch(() => {});

    const prefs = loadNotificationPrefs(currentUser.id);
    const callsign = currentUser.callsign;
    const timers: NodeJS.Timeout[] = [];

    // Helper: ms until a specific HH:MM today (or tomorrow if passed)
    const msUntilTime = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const now = new Date();
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      return Math.max(0, target.getTime() - now.getTime());
    };

    // Build compliance data snapshot from current operator state
    const getComplianceData = (): ComplianceCheckData => {
      const op = operators.find(o => o.id === currentUser.id) || selectedOperator;
      return {
        callsign,
        workouts: (op.workouts || {}) as Record<string, { completed?: boolean }>,
        nutrition: (op.nutrition || {}) as ComplianceCheckData['nutrition'],
        sitrep: (op.sitrep || null) as ComplianceCheckData['sitrep'],
        dailyBrief: (op.dailyBrief || null) as ComplianceCheckData['dailyBrief'],
      };
    };

    // ── Morning reminder: workout + daily brief + compliance score ──
    if (prefs.workoutReminders || prefs.dailyBriefAlerts || prefs.complianceAlerts) {
      const scheduleMorning = () => {
        const delay = msUntilTime(prefs.reminderTime);
        const id = setTimeout(() => {
          const data = getComplianceData();
          // Workout reminder (only if not completed)
          if (prefs.workoutReminders) {
            const today = getLocalDateStr();
            if (!data.workouts?.[today]?.completed) {
              notifyWorkoutReminder(callsign);
            }
          }
          // Morning compliance checks (daily brief ready, compliance score, rest day)
          runMorningComplianceCheck(data, prefs);
          // Reschedule for tomorrow
          scheduleMorning();
        }, delay);
        timers.push(id);
      };
      scheduleMorning();
    }

    // ── Meal logging nudges at midday, afternoon, evening ──
    if (prefs.mealReminders) {
      const mealTimes = prefs.mealReminderTimes || ['12:00', '15:00', '18:00'];
      mealTimes.forEach((time) => {
        const scheduleMeal = () => {
          const delay = msUntilTime(time);
          const id = setTimeout(() => {
            runMealCheck(getComplianceData(), prefs);
            scheduleMeal();
          }, delay);
          timers.push(id);
        };
        scheduleMeal();
      });
    }

    // ── Hydration reminders every N hours during waking hours (7am–10pm) ──
    if (prefs.hydrationReminders && prefs.hydrationInterval > 0) {
      const intervalMs = prefs.hydrationInterval * 60 * 60 * 1000;
      const id = setInterval(() => {
        const hour = new Date().getHours();
        if (hour >= 7 && hour < 22) {
          notifyHydration(callsign);
        }
      }, intervalMs);
      timers.push(id as unknown as NodeJS.Timeout);
    }

    // ── Evening check-in ──
    if (prefs.eveningCheckIn) {
      const scheduleEvening = () => {
        const delay = msUntilTime(prefs.eveningCheckInTime || '20:00');
        const id = setTimeout(() => {
          runEveningCheck(getComplianceData(), prefs);
          scheduleEvening();
        }, delay);
        timers.push(id);
      };
      scheduleEvening();
    }

    // ── Streak warnings every 4 hours ──
    if (prefs.streakWarnings) {
      const checkStreak = () => {
        const data = getComplianceData();
        if (data.workouts) checkStreakWarning(callsign, data.workouts);
      };
      checkStreak();
      const id = setInterval(checkStreak, 4 * 60 * 60 * 1000);
      timers.push(id as unknown as NodeJS.Timeout);
    }

    // Cleanup all timers
    return () => {
      timers.forEach((id) => {
        clearTimeout(id);
        clearInterval(id as unknown as NodeJS.Timeout);
      });
    };
  }, [currentUser.id, operators, selectedOperator]);

  // Auto-scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gunnyMessages, gunnyLoading]);

  // ──────────────────────────────────────────────────────────────────────
  // EARLY HYDRATION — populate gunnyMessages from DB on operator mount
  // regardless of whether the floating panel is open. Phase 2 fix for
  // the chat-history wipe bug surfaced by the Daily Ops "Generate
  // today's plan" CTA: sendGunnyVoiceMessage appends to gunnyMessages
  // and the persistence effect PUTs the result to /api/chat (which
  // upserts and replaces the entire `messages` array). Without this
  // hydration, sendGunnyVoiceMessage triggered from anywhere OTHER
  // than the floating panel (Planner voice, DailyOps "Generate", etc.)
  // appended to an empty array → the persistence PUT wiped all prior
  // history.
  // The panel-init effect below still runs for panel-specific setup
  // (greeting fallback, gunnyGreeted flag) but gunnyMessages itself
  // is already populated by this earlier effect.
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gunnyMessagesHydratedRef.current === selectedOperator.id) return;
    const opId = selectedOperator.id;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/chat?operatorId=${opId}&chatType=gunny-tab`,
          { headers: { Authorization: `Bearer ${getAuthToken()}` } },
        );
        if (!res.ok) {
          // Mark hydrated anyway so the persistence effect can run for
          // truly-new operators (no chat history yet). Failing closed
          // here would leave new operators unable to save their first
          // message, which is worse than the original bug.
          if (!cancelled) gunnyMessagesHydratedRef.current = opId;
          return;
        }
        const data = await res.json();
        const msgs = Array.isArray(data?.messages) ? (data.messages as ChatMessage[]) : [];
        if (cancelled) return;
        if (msgs.length > 0) {
          // Set state ONLY when we have content. If the DB returned
          // empty, leave gunnyMessages alone — the panel-init effect
          // may set a greeting later.
          setGunnyMessages(msgs);
        }
        gunnyMessagesHydratedRef.current = opId;
      } catch {
        if (!cancelled) gunnyMessagesHydratedRef.current = opId;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOperator.id]);

  // Load saved panel chat or generate greeting when panel opens.
  //
  // ─── ARCHITECTURE NOTE ────────────────────────────────────────────────
  // The Gunny PANEL (this floating side overlay) AND the dedicated GUNNY
  // TAB (rendered by GunnyChat.tsx) USED to write to two separate backend
  // threads:
  //   • Panel  → chatType: 'gunny-panel' / localStorage key gunny-panel-${id}
  //   • Tab    → chatType: 'gunny-tab'   / localStorage key gunny-chat-${id}
  // Same operator opening the panel on desktop and the tab on mobile saw
  // two completely different chat histories. Bug:
  //
  //   "DESKTOP CHAT AND MOBILE CHAT IS NOT MATCHING. WHY IS THAT
  //    HAPPENING IF ITS THE SAME USER"
  //
  // Fix: both surfaces now read/write the SAME chatType ('gunny-tab') and
  // the SAME localStorage key ('gunny-chat-${id}'). The load path also
  // runs a one-time per-operator migration: if the legacy 'gunny-panel'
  // thread has messages, merge them into 'gunny-tab' (sort by timestamp,
  // dedup by role+timestamp+text-prefix) before rendering, then mark
  // migrated so the merge doesn't repeat. The legacy thread is cleared
  // (written empty) after merge so the same content can't drift back in
  // if a stale client hits the old chatType.
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showGunnyPanel) return;
    // Only initialize once per operator
    if (panelInitRef.current === selectedOperator.id) return;
    panelInitRef.current = selectedOperator.id;

    const opId = selectedOperator.id;
    const CANONICAL_TYPE = 'gunny-tab';
    const LEGACY_TYPE = 'gunny-panel';
    const CANONICAL_KEY = `gunny-chat-${opId}`;
    const LEGACY_KEY = `gunny-panel-${opId}`;
    const MIGRATED_FLAG_KEY = `gunny-panel-migrated-${opId}`;

    const fetchThread = async (chatType: string): Promise<ChatMessage[]> => {
      try {
        const res = await fetch(`/api/chat?operatorId=${opId}&chatType=${chatType}`, {
          headers: { 'Authorization': `Bearer ${getAuthToken()}` },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.messages) ? (data.messages as ChatMessage[]) : [];
      } catch {
        return [];
      }
    };

    const readLocalThread = (key: string): ChatMessage[] => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
      } catch {
        return [];
      }
    };

    // Merge two message arrays by timestamp; dedup any pair that looks
    // identical (same role + same timestamp + same first-40-char prefix).
    // We can't use full-text equality because streaming deltas may have
    // been truncated mid-write on one path and not the other.
    const mergeThreads = (a: ChatMessage[], b: ChatMessage[]): ChatMessage[] => {
      const all = [...a, ...b].sort((x, y) => (x.timestamp || 0) - (y.timestamp || 0));
      const seen = new Set<string>();
      const out: ChatMessage[] = [];
      for (const m of all) {
        const key = `${m.role}|${m.timestamp || 0}|${(m.text || '').slice(0, 40)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(m);
      }
      return out;
    };

    const loadPanelChat = async () => {
      // Always load the canonical thread first.
      let canonical = await fetchThread(CANONICAL_TYPE);

      // One-time migration of the legacy 'gunny-panel' thread.
      const alreadyMigrated = (() => {
        try { return localStorage.getItem(MIGRATED_FLAG_KEY) === 'true'; }
        catch { return false; }
      })();

      if (!alreadyMigrated) {
        // Pull legacy from API + localStorage; whichever has more wins.
        const legacyApi = await fetchThread(LEGACY_TYPE);
        const legacyLocal = readLocalThread(LEGACY_KEY);
        const legacy = legacyApi.length >= legacyLocal.length ? legacyApi : legacyLocal;

        if (legacy.length > 0) {
          canonical = mergeThreads(canonical, legacy);
          // Persist merged → canonical thread + canonical localStorage key.
          try { localStorage.setItem(CANONICAL_KEY, JSON.stringify(canonical)); }
          catch (err) { console.warn('[AppShell:migrate] localStorage write failed:', err); }
          fetch('/api/chat', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
            body: JSON.stringify({ operatorId: opId, chatType: CANONICAL_TYPE, messages: canonical }),
          }).catch(() => {});
          // Clear legacy thread so a stale client can't pull it again.
          // ?force=true bypasses the shrink-guard added May 2026 — this
          // is an INTENTIONAL clear (legacy thread already merged into
          // canonical above), not the wipe pattern the guard prevents.
          fetch('/api/chat?force=true', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
            body: JSON.stringify({ operatorId: opId, chatType: LEGACY_TYPE, messages: [] }),
          }).catch(() => {});
        }

        // Always mark migrated to prevent re-running, and clear the
        // legacy localStorage key so it doesn't bloat storage.
        try {
          localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
          localStorage.removeItem(LEGACY_KEY);
        } catch { /* ignore */ }
      }

      if (canonical.length > 0) {
        setGunnyMessages(canonical);
        setGunnyGreeted(true);
        return;
      }

      // Fallback: canonical-key localStorage covers offline-first writes
      // from GunnyChat.tsx that haven't synced to the API yet.
      const localCanonical = readLocalThread(CANONICAL_KEY);
      if (localCanonical.length > 0) {
        setGunnyMessages(localCanonical);
        setGunnyGreeted(true);
        fetch('/api/chat', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
          body: JSON.stringify({ operatorId: opId, chatType: CANONICAL_TYPE, messages: localCanonical }),
        }).catch(() => {});
        return;
      }

      // No saved history — show context-aware greeting
      setGunnyGreeted(true);
      const tab = activeTab;
      let greeting = '';
      if (tab === 'coc') {
        greeting = `Eyes on your dashboard, ${selectedOperator.callsign}. Need help reading your stats, planning today's session, or adjusting anything?`;
      } else if (tab === 'planner') {
        greeting = `I can see your planner, ${selectedOperator.callsign}. Need to modify a workout, swap an exercise, adjust volume, or build something new?`;
      } else if (tab === 'intel') {
        greeting = `Reviewing your Intel, ${selectedOperator.callsign}. Want to update your profile, adjust targets, log a new PR, or check your injury status?`;
      } else {
        greeting = `Standing by, ${selectedOperator.callsign}. I can see what you're working on — what do you need?`;
      }
      setGunnyMessages([{
        role: 'gunny',
        text: greeting,
        timestamp: Date.now(),
      }]);
    };
    loadPanelChat();
  }, [showGunnyPanel, selectedOperator.id, selectedOperator.callsign, activeTab]);

  // Persist panel messages — split strategy:
  // • localStorage: every content change (sync, cheap, survives unmount/refresh).
  // • API: debounced 600ms after last change so streaming deltas collapse into one PUT.
  // Previously gated on length only, which skipped every delta after the first and froze
  // the saved message at the first word ("Got"/"Roger").
  const prevPanelSnapshotRef = useRef('');
  const panelSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPanelPendingRef = useRef<{ serialized: unknown[] } | null>(null);

  useEffect(() => {
    if (gunnyMessages.length === 0) return;

    // CRITICAL: never PUT to /api/chat before we've hydrated from the
    // DB for this operator. Without this gate, the very first append
    // to gunnyMessages (from sendGunnyVoiceMessage) would trigger a
    // PUT that overwrites the entire messages JSON column with a
    // 1- or 2-message array — wiping all prior history. The
    // hydration ref is set by the EARLY HYDRATION effect above (or
    // by a confirmed empty-fetch for new operators); until that
    // ref matches the current operator, defer all persistence.
    if (gunnyMessagesHydratedRef.current !== selectedOperator.id) return;

    // Content-aware signature catches text mutations, not just array length changes.
    const snapshot = gunnyMessages
      .map(m => `${m.role}:${(m.text ?? '').length}:${m.timestamp}`)
      .join('|');
    if (snapshot === prevPanelSnapshotRef.current) return;
    prevPanelSnapshotRef.current = snapshot;

    const serialized = gunnyMessages;

    // Persist to the CANONICAL chatType ('gunny-tab') + key
    // ('gunny-chat-${id}'). Both surfaces — this floating panel and
    // the dedicated GunnyChat tab — write to the same thread so the
    // operator sees a single chat history regardless of which surface
    // they used. See the load effect's architecture note above for
    // the migration story off the legacy 'gunny-panel' thread.
    try {
      localStorage.setItem(`gunny-chat-${selectedOperator.id}`, JSON.stringify(serialized));
    } catch (err) { console.warn('[AppShell:panel-persist] localStorage write failed (quota?):', err); }
    lastPanelPendingRef.current = { serialized };

    if (panelSaveDebounceRef.current) clearTimeout(panelSaveDebounceRef.current);
    panelSaveDebounceRef.current = setTimeout(() => {
      panelSaveDebounceRef.current = null;
      const pending = lastPanelPendingRef.current;
      if (!pending) return;
      fetch('/api/chat', {
        method: 'PUT',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ operatorId: selectedOperator.id, chatType: 'gunny-tab', messages: pending.serialized }),
      }).catch(() => {});
      lastPanelPendingRef.current = null;
    }, 600);
  }, [gunnyMessages, selectedOperator.id]);

  // On unmount / operator switch, flush any pending debounced save with keepalive
  // so the final content reaches the API even if the page navigates away.
  useEffect(() => {
    const operatorId = selectedOperator.id;
    return () => {
      if (panelSaveDebounceRef.current) {
        clearTimeout(panelSaveDebounceRef.current);
        panelSaveDebounceRef.current = null;
      }
      const pending = lastPanelPendingRef.current;
      if (pending) {
        fetch('/api/chat', {
          method: 'PUT',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
          body: JSON.stringify({ operatorId, chatType: 'gunny-tab', messages: pending.serialized }),
        }).catch(() => {});
        lastPanelPendingRef.current = null;
      }
    };
  }, [selectedOperator.id]);

  // Focus input when panel opens
  useEffect(() => {
    if (showGunnyPanel && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showGunnyPanel]);

  // ═══ Screen Context for Side-Panel Gunny ═══
  // Reads what the user is currently looking at and builds a text summary
  const getScreenContext = (): string => {
    const op = currentSelectedOp;
    const today = getLocalDateStr();
    const todayWorkout = op.workouts?.[today];

    let context = `CURRENT SCREEN: ${activeTab.toUpperCase()} tab\n`;

    if (activeTab === 'coc') {
      // COC Dashboard — show summary stats
      const totalWorkouts = Object.keys(op.workouts || {}).length;
      const thisWeekWorkouts = Object.keys(op.workouts || {}).filter(d => {
        const diff = (new Date().getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff < 7;
      }).length;
      context += `The operator is viewing their Command Center dashboard.\n`;
      context += `Total workouts logged: ${totalWorkouts}\n`;
      context += `Workouts this week: ${thisWeekWorkouts}\n`;
      context += `Readiness: ${op.profile?.readiness || 'unknown'}/10\n`;
      if (todayWorkout) {
        context += `Today's workout: "${todayWorkout.title}" — ${(todayWorkout?.blocks || []).length} blocks\n`;
      } else {
        context += `No workout scheduled for today.\n`;
      }
    } else if (activeTab === 'planner') {
      // Planner — check if operator is in WORKOUT MODE (actively training)
      if (workoutModeState.active) {
        context += `*** THE OPERATOR IS IN WORKOUT MODE — ACTIVELY TRAINING RIGHT NOW ***\n`;
        context += `Workout: "${workoutModeState.workoutTitle}"\n\n`;
        context += `LIVE EXERCISE LOG (what they've entered so far):\n`;
        context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        workoutModeState.exercises.forEach((ex, i) => {
          context += `\n${i + 1}. ${ex.name} — Prescribed: ${ex.prescription}\n`;
          if (ex.sets.length > 0) {
            const loggedSets = ex.sets.filter(s => s.weight > 0 || s.reps > 0 || s.completed);
            if (loggedSets.length > 0) {
              loggedSets.forEach((s, si) => {
                context += `   Set ${si + 1}: ${s.weight}lbs x ${s.reps} reps ${s.completed ? '✓ DONE' : '(in progress)'}\n`;
              });
              const unloggedCount = ex.sets.length - loggedSets.length;
              if (unloggedCount > 0) {
                context += `   ${unloggedCount} set(s) remaining\n`;
              }
            } else {
              context += `   No sets logged yet — upcoming exercise\n`;
            }
          }
        });
        context += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        context += `IMPORTANT: Use the logged weights and reps above to give specific weight recommendations. You can see exactly what they lifted.\n`;
      } else {
        // Normal planner view
        context += `The operator is viewing their workout planner.\n`;
        if (todayWorkout) {
          context += `Today's workout: "${todayWorkout.title}"\n`;
          if (todayWorkout.warmup) context += `Warmup: ${todayWorkout.warmup}\n`;
          (todayWorkout?.blocks || []).forEach((block, i) => {
            if (block.type === 'exercise') {
              context += `  ${String.fromCharCode(65 + i)}) ${block.exerciseName} — ${block.prescription}\n`;
            } else {
              context += `  ${String.fromCharCode(65 + i)}) [Conditioning] ${block.format}: ${block.description}\n`;
            }
          });
          if (todayWorkout.cooldown) context += `Cooldown: ${todayWorkout.cooldown}\n`;
          if (todayWorkout.notes) context += `Coach's Notes: ${todayWorkout.notes}\n`;
        } else {
          context += `No workout scheduled for today. The operator may be browsing other days.\n`;
        }
      }
      // Recent workout history
      const recentDates = Object.keys(op.workouts || {}).sort().reverse().slice(0, 5);
      if (recentDates.length > 0) {
        context += `Recent workouts: ${recentDates.map(d => `${d}: "${op.workouts[d].title}"`).join(', ')}\n`;
      }
    } else if (activeTab === 'intel') {
      // Intel Center — profile, nutrition, PRs, injuries
      context += `The operator is viewing their Intel Center (profile/data hub).\n`;
      context += `Profile: ${op.profile?.age}yo, ${op.profile?.height}, ${op.profile?.weight}lbs, ${op.profile?.bodyFat}% BF, Training age: ${op.profile?.trainingAge}\n`;
      context += `Goals: ${op.profile?.goals?.join(', ') || 'none set'}\n`;
      if (op.prs?.length > 0) {
        context += `PRs: ${(op.prs || []).map(pr => `${pr.exercise}: ${pr.weight}lbs`).join(', ')}\n`;
      }
      if (op.injuries?.length > 0) {
        context += `Injuries: ${(op.injuries || []).map(inj => `${inj.name} (${inj.status})${inj.restrictions?.length ? ' — avoid: ' + inj.restrictions.join(', ') : ''}`).join('; ')}\n`;
      }
      const nutri = op.nutrition?.targets;
      if (nutri) {
        context += `Nutrition targets: ${nutri?.calories || 0} cal, ${nutri?.protein || 0}g protein, ${nutri?.carbs || 0}g carbs, ${nutri?.fat || 0}g fat\n`;
      }
    } else if (activeTab === 'gunny') {
      context += `The operator has the full Gunny AI tab open (gameplan/programming mode). They opened the side panel for quick contextual help.\n`;
    }

    return context;
  };

  // Determine Gunny AI mode based on current context
  const getGunnyMode = (): string => {
    if (workoutModeState.active) return 'workout';
    if (activeTab === 'intel') return 'nutrition';
    if (activeTab === 'gunny') return 'gameplan';
    return 'assist';
  };

  // Build operator context for API (includes intake assessment data for Gunny)
  // Reads from intake column first, falls back to profile/preferences fields (which always persist)
  // Accepts optional fresh operator to avoid stale closure reads (e.g. post-intake SITREP generation)
  const buildOperatorContext = (freshOperator?: Operator): OperatorContextData => {
    const op = freshOperator || selectedOperator;
    // Shared builder is the source of truth (Task 12/13).
    // We wrap it to inject UI-local state (language, active workout mode).
    // Cast via unknown: the shared GunnyOperatorContext keeps `sitrep` as a loose
    // AnyRec (so every Operator shape round-trips through it cleanly), while the
    // local OperatorContextData types sitrep as a structured battle-plan object.
    // They're compatible at runtime — this file's callers read fields from
    // either shape — but TS needs the double-cast to acknowledge the structural
    // difference. Adding completedWorkoutLogs to the shared context pushed TS
    // past the "sufficiently overlap" threshold so a direct cast now errors.
    return buildFullGunnyContext(op, {
      language: language || 'en',
      workoutExecution: workoutModeState?.active ? {
        active: workoutModeState.active,
        workoutTitle: workoutModeState.workoutTitle,
        exercises: workoutModeState.exercises,
      } : null,
    }) as unknown as OperatorContextData;
  };

  // LEGACY builder retained for reference — remove in next cleanup pass.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _legacyBuildOperatorContext = (freshOperator?: Operator): OperatorContextData => {
    const op = freshOperator || selectedOperator;
    const intake = op.intake;
    const prof = op.profile;
    const prefs = op.preferences;
    return {
      callsign: op.callsign,
      name: op.name,
      role: op.role || 'operator',
      weight: prof?.weight,
      height: prof?.height,
      age: prof?.age,
      bodyFat: prof?.bodyFat,
      goals: prof?.goals,
      readiness: prof?.readiness,
      fitnessLevel: op.fitnessLevel || intake?.fitnessLevel || prof?.fitnessLevel,
      experienceYears: intake?.experienceYears ?? prof?.experienceYears,
      exerciseHistory: intake?.exerciseHistory || prof?.exerciseHistory,
      currentActivity: intake?.currentActivity || prof?.currentActivity,
      availableEquipment: intake?.availableEquipment || prefs?.equipment,
      equipmentDetailed: prefs?.equipmentDetailed,
      preferredWorkoutTime: intake?.preferredWorkoutTime || prof?.preferredWorkoutTime,
      healthConditions: intake?.healthConditions || prof?.healthConditions,
      sleepQuality: intake?.sleepQuality || prof?.sleep,
      stressLevel: intake?.stressLevel || prof?.stress,
      nutritionHabits: intake?.nutritionHabits || prof?.nutritionHabits,
      currentDiet: intake?.currentDiet,
      macroTargets: op.nutrition?.targets,
      dietaryRestrictions: intake?.dietaryRestrictions,
      supplements: intake?.supplements,
      prs: (op.prs || []).slice(0, 10).map(pr => ({
        exercise: pr.exercise, weight: pr.weight, reps: pr.reps, date: pr.date, type: pr.type || 'strength', notes: pr.notes,
      })),
      injuries: op.injuries?.map(inj => ({
        id: inj.id, name: inj.name, status: inj.status, notes: inj.notes, restrictions: inj.restrictions,
      })),
      injuryNotes: intake?.injuryNotes, movementScreenScore: intake?.movementScreenScore,
      motivationFactors: intake?.motivationFactors, mealsPerDay: intake?.mealsPerDay,
      dailyWaterOz: intake?.dailyWaterOz, estimatedCalories: intake?.estimatedCalories,
      proteinPriority: intake?.proteinPriority, daysPerWeek: prefs?.daysPerWeek,
      sessionDuration: prefs?.sessionDuration, preferredSplit: prefs?.split,
      wearableDevice: intake?.wearableDevice, trainerNotes: op.trainerNotes,
      language: language || 'en',
      trainingAge: prof?.trainingAge,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sitrep: (() => { const s = op.sitrep as any; if (!s || Object.keys(s).length === 0) return null;
        return { summary: s.summary, trainingPlan: s.trainingPlan,
          nutritionPlan: s.nutritionPlan ? { dailyCalories: s.nutritionPlan.dailyCalories, protein: s.nutritionPlan.protein,
            carbs: s.nutritionPlan.carbs, fat: s.nutritionPlan.fat, mealsPerDay: s.nutritionPlan.mealsPerDay,
            hydrationOz: s.nutritionPlan.hydrationOz, approach: s.nutritionPlan.approach } : null,
          priorityFocus: s.priorityFocus || [], restrictions: s.restrictions || [], milestones30Day: s.milestones30Day || [] };
      })(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dailyBrief: (() => { const td = getLocalDateStr(); const db = op.dailyBrief as any;
        if (!db || db.date !== td) return null;
        return { complianceScore: db.complianceScore, adjustments: db.adjustments, gunnyNote: db.gunnyNote };
      })(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      todayWorkout: (() => { const td = getLocalDateStr(); const w = (op.workouts as any)?.[td];
        if (!w) return null;
        return { title: w.title || 'Untitled', exercises: (w.blocks || [])
          .filter((b: { type: string }) => b.type === 'exercise')
          .map((b: { exerciseName?: string; prescription?: string }) => `${b.exerciseName} (${b.prescription})`), completed: !!w.completed };
      })(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentWorkoutHistory: (() => { const dates = Object.keys(op.workouts || {}).sort().reverse().slice(0, 7);
        if (!dates.length) return 'No workouts logged yet';
        return dates.map(date => { const w = (op.workouts as any)[date];
          const ex = (w.blocks || []).filter((b: { type: string }) => b.type === 'exercise')
            .map((b: { exerciseName?: string; prescription?: string }) => `${b.exerciseName} (${b.prescription})`).join(', ');
          return `${date}: "${w.title || 'Untitled'}" — ${ex}${w.completed ? ' ✅' : ''}`; }).join('\n');
      })(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentMealHistory: (() => { const meals = (op.nutrition as any)?.meals || {};
        const dates = Object.keys(meals).sort().reverse().slice(0, 3);
        if (!dates.length) return 'No meals logged';
        return dates.map(date => { const dm = meals[date] || [];
          const t = dm.reduce((a: any, m: any) => ({ calories: a.calories + (m.calories||0), protein: a.protein + (m.protein||0) }), { calories: 0, protein: 0 });
          return `${date}: ${dm.length} meals — ${t.calories}cal, ${t.protein}g P`; }).join('\n');
      })(),
      workoutStreak: (() => { let streak = 0; const now = new Date();
        for (let i = 0; i < 365; i++) { const d = new Date(now); d.setDate(d.getDate() - i);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const key = toLocalDateStr(d); if ((op.workouts as any)?.[key]?.completed) streak++; else if (i > 0) break; }
        return streak; })(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalWorkoutsCompleted: Object.values(op.workouts || {}).filter((w: any) => (w as any)?.completed).length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentDayTags: (() => { const entries = Object.entries(op.dayTags || {}).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7);
        if (!entries.length) return null;
        return entries.map(([date, tag]) => `${date}: [${(tag as any).color}] ${(tag as any).note}`).join('\n');
      })(),
      lastCompletedWorkout: (() => {
        const td = getLocalDateStr();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const todayW = (op.workouts as any)?.[td];
        const target = todayW?.completed ? todayW : findMostRecentCompletedWorkout(op);
        if (!target) return null;
        return buildWorkoutAnalysis(target, op.prs || [], op.workouts || {});
      })(),
      workoutExecution: (() => {
        if (!workoutModeState?.active) return null;
        const lines: string[] = [];
        lines.push('═══ ACTIVE WORKOUT EXECUTION ═══');
        lines.push(`Title: ${workoutModeState.workoutTitle || 'Current workout'}`);
        (workoutModeState.exercises || []).forEach((ex, i) => {
          const sets = ex.sets || [];
          const done = sets.filter(s => s.completed);
          let row = `${i + 1}. ${ex.name} — ${ex.prescription || ''} [${done.length}/${sets.length} sets done]`;
          if (done.length > 0) {
            const last = done[done.length - 1];
            row += ` last: ${last.weight || 0}lbs x${last.reps || 0}`;
          }
          lines.push(row);
        });
        return lines.join('\n');
      })(),
    };
  };

  // Generate SITREP after intake completion
  const [sitrepError, setSitrepError] = useState<string | null>(null);

  const generateSitrep = async (updatedOperator: Operator) => {
    setSitrepLoading(true);
    setSitrepError(null);
    setShowSitrep(true);
    try {
      const res = await fetch('/api/gunny/sitrep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
        body: JSON.stringify({
          operatorContext: buildOperatorContext(updatedOperator),
          tier: updatedOperator.tier,
          clientDayName: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
          clientDate: new Date().toLocaleDateString('en-US'),
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json();
      if (data.success && data.sitrep) {
        setPendingSitrep(data.sitrep);
      } else {
        setSitrepError(data.error || 'Failed to generate SITREP. Check API key configuration.');
      }
    } catch (err) {
      setSitrepError('Network error generating SITREP. Please retry.');
    }
    setSitrepLoading(false);
  };

  const handleAcceptSitrep = () => {
    if (!pendingSitrep) return;
    const updated = { ...currentUser, sitrep: pendingSitrep };
    onUpdateOperator(updated, true); // immediate save — critical data
    setShowSitrep(false);
    setPendingSitrep(null);
    setActiveTab('coc');
  };

  const handleRegenerateSitrep = () => {
    setPendingSitrep(null);
    setSitrepError(null);
    generateSitrep(currentUser);
  };

  const handleNewBattlePlan = () => {
    setShowNewPlanConfirm(false);
    // Clear existing SITREP and daily brief so fresh generation starts clean
    const updated = { ...currentUser, sitrep: undefined, dailyBrief: undefined };
    onUpdateOperator(updated, true);
    generateSitrep(currentUser);
  };

  // TTS — Gunny speaks back. The gate is now inside gunnySpeak itself (lib/tts.ts
  // consults isTtsEnabled), so the simple wrapper below stays for callsites that
  // want to read like English. Still checking the local state here as an early
  // return avoids even constructing the clean text when muted.
  const speakGunny = (text: string) => {
    if (gunnyTtsEnabled) gunnySpeak(text);
  };

  // Subscribe to lib/tts queue-empty so the panel HEAR IT button
  // flips back from STOP when audio finishes naturally OR when
  // stopSpeaking() runs. Replaces the prior 600ms DOM polling
  // which was unreliable for OpenAI TTS audio (those Audio
  // elements aren't attached to the DOM, so the poll thought
  // playback was done while the audio kept playing).
  useEffect(() => {
    const cb = () => setPanelSpeakingIdx(null);
    onSpeechDone(cb);
    return () => offSpeechDone(cb);
  }, []);

  // Per-message playback for the side-panel chat. Tap once → Gunny
  // reads it aloud; tap the SAME button again → stop. Tapping a
  // different message stops the prior one and starts the new one.
  // Bypasses the global TTS-mute flag (the user explicitly asked to
  // hear THIS message). Always user-initiated, so it survives iOS
  // Safari's autoplay block.
  const playPanelMessage = useCallback((idx: number, text: string) => {
    if (!text || !text.trim()) return;
    if (panelSpeakingIdx === idx) {
      stopSpeaking();
      // setPanelSpeakingIdx(null) fires via the onSpeechDone hook above.
      return;
    }
    stopSpeaking();
    unlockAudioContext();
    const wasMuted = !isTtsEnabled();
    if (wasMuted) setTtsEnabledGlobal(true);
    setPanelSpeakingIdx(idx);
    gunnySpeak(text).catch((err) =>
      console.warn('[appshell] panel play-message failed:', err),
    );
    if (wasMuted) {
      // Restore mute once playback actually finishes (not when
      // gunnySpeak resolves — that happens at request-queue time).
      const restore = () => {
        setTtsEnabledGlobal(false);
        offSpeechDone(restore);
      };
      onSpeechDone(restore);
    }
  }, [panelSpeakingIdx]);

  const toggleGunnyTts = () => {
    const next = !gunnyTtsEnabled;
    setTtsEnabledGlobal(next); // persists + broadcasts via onTtsEnabledChange
    // Tapping the mic icon is a user gesture — warm the audio context now so the
    // NEXT speak() call (e.g. streaming response arriving in 3s) actually plays
    // on iOS. Without this, the gesture window expires before the audio arrives.
    if (next) unlockAudioContext();
  };

  // Sync local mirror with global toggle changes + migrate the legacy
  // per-operator key (if it ever stored `true` for this op, pre-populate the
  // global key once so returning users don't suddenly lose their preference).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedOperator?.id) return;

    const legacyKey = `guns-up-tts-${selectedOperator.id}`;
    const legacy = localStorage.getItem(legacyKey);
    const globalKey = 'guns-up-tts-enabled';
    const current = localStorage.getItem(globalKey);
    if (legacy !== null && current === null) {
      localStorage.setItem(globalKey, legacy);
      setGunnyTtsEnabledLocal(legacy === 'true');
    }
    // Clean up legacy key — one-way migration.
    if (legacy !== null) {
      try { localStorage.removeItem(legacyKey); } catch { /* storage full */ }
    }

    // Keep local mirror in sync with any other component that flips the toggle.
    const unsub = onTtsEnabledChange((enabled) => setGunnyTtsEnabledLocal(enabled));
    return unsub;
  }, [selectedOperator?.id]);

  // Send message to Gunny API (side panel — context-aware mode, SSE streaming)
  const sendGunnyMessage = async () => {
    if (!gunnyInput.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      text: gunnyInput,
      timestamp: Date.now(),
    };

    const placeholderId = 'gunny-panel-' + Date.now();
    setGunnyMessages(prev => [...prev, userMessage, { role: 'gunny' as const, text: '', timestamp: Date.now(), _placeholderId: placeholderId } as ChatMessage & { _placeholderId: string }]);
    setGunnyInput('');
    setGunnyLoading(true); setGunnyThinkingAt(Date.now());

    try {
      // Build trainer dataset for sidebar assistant
      const trainer = selectedOperator.trainerId ? operators.find(op => op.id === selectedOperator.trainerId) : null;
      const trainerData = trainer ? {
        workouts: trainer.workouts,
        preferences: trainer.preferences,
        prs: trainer.prs,
        profile: trainer.profile,
        trainerNotes: selectedOperator.trainerNotes,
      } : null;

      const res = await fetch('/api/gunny', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          messages: [...gunnyMessages, userMessage],
          operatorContext: buildOperatorContext(),
          tier: selectedOperator.tier || 'standard',
          mode: getGunnyMode(),
          screenContext: getScreenContext(),
          clientDate: getLocalDateStr(),
          clientDateLong: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          clientTimezone: getLocalTimezone(),
          ...(trainerData && { trainerData }),
        }),
      });

      // Graceful fallback: server returned JSON (error path or old deployment)
      const ctype = res.headers.get('content-type') || '';
      if (!ctype.includes('text/event-stream')) {
        const data = await res.json();
        if (!res.ok) {
          const errMsg = data?.error || 'Gunny AI temporarily offline.';
          setGunnyMessages(prev => prev.map(m =>
            (m as ChatMessage & { _placeholderId?: string })._placeholderId === placeholderId
              ? { ...m, text: errMsg } : m
          ));
        } else {
          const replyText = data.response || data.message || data.text || 'Copy that, Marine.';
          setGunnyMessages(prev => prev.map(m =>
            (m as ChatMessage & { _placeholderId?: string })._placeholderId === placeholderId
              ? { ...m, text: replyText } : m
          ));
          speakGunny(replyText);
          // Handle meal/workout data from JSON fallback
          if (data.mealData) handlePanelMealData(data.mealData);
          // Apply workout deletions FIRST so subsequent add/modify
          // operations on the same response (e.g. a "move" — delete
          // source + add target) don't fight each other.
          const deletes = Array.isArray(data.workoutDeletes)
            ? data.workoutDeletes
            : (data.workoutDelete ? [data.workoutDelete] : []);
          if (deletes.length > 0) handlePanelWorkoutDeletes(deletes);
          // Prefer the plural array if present (route returns both for
          // backwards compat). Falls back to the single mod for older servers.
          const mods = Array.isArray(data.workoutModifications)
            ? data.workoutModifications
            : (data.workoutModification ? [data.workoutModification] : []);
          if (mods.length > 0) handlePanelWorkoutMods(mods);
          else if (data.workoutData) handlePanelWorkoutData(data.workoutData);
          applyPanelVoiceControl(data.voiceControl);
        }
        return;
      }

      // Streaming path — parse SSE manually
      if (!res.body) {
        setGunnyMessages(prev => prev.map(m =>
          (m as ChatMessage & { _placeholderId?: string })._placeholderId === placeholderId
            ? { ...m, text: `⚠ Comms dropped, ${selectedOperator.callsign}. Retry in a moment.` } : m
        ));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let finalPayload: any = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const raw of events) {
          if (!raw.trim()) continue;
          const lines = raw.split('\n');
          let eventType = 'message';
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (!dataStr) continue;
          try {
            const payload = JSON.parse(dataStr);
            if (eventType === 'delta' && payload.text) {
              accumulated += payload.text;
              const visible = accumulated
                .replace(/<workout_json>[\s\S]*?<\/workout_json>/g, '')
                .replace(/<workout_json>[\s\S]*$/, '')
                .replace(/<workout_modification>[\s\S]*?<\/workout_modification>/g, '')
                .replace(/<workout_modification>[\s\S]*$/, '')
                .replace(/<profile_json>[\s\S]*?<\/profile_json>/g, '')
                .replace(/<profile_json>[\s\S]*$/, '')
                .replace(/<meal_json>[\s\S]*?<\/meal_json>/g, '')
                .replace(/<meal_json>[\s\S]*$/, '');
              // Hide thinking indicator once we have content
              if (visible.length > 0) {
                setGunnyLoading(false);
                setGunnyThinkingAt(null);
              }
              setGunnyMessages(prev => prev.map(m =>
                (m as ChatMessage & { _placeholderId?: string })._placeholderId === placeholderId
                  ? { ...m, text: visible } : m
              ));
            } else if (eventType === 'final') {
              finalPayload = payload;
            } else if (eventType === 'error') {
              setGunnyMessages(prev => prev.map(m =>
                (m as ChatMessage & { _placeholderId?: string })._placeholderId === placeholderId
                  ? { ...m, text: `⚠ Comms dropped, ${selectedOperator.callsign}. Retry in a moment.` } : m
              ));
              return;
            }
          } catch { /* malformed SSE record */ }
        }
      }

      if (finalPayload) {
        setGunnyMessages(prev => prev.map(m =>
          (m as ChatMessage & { _placeholderId?: string })._placeholderId === placeholderId
            ? { ...m, text: finalPayload.cleanText } : m
        ));
        speakGunny(finalPayload.cleanText);
        if (finalPayload.mealData) handlePanelMealData(finalPayload.mealData);
        // Same ordering rationale as the non-streaming branch above:
        // apply deletes first so a delete+add (move) lands cleanly.
        const fdeletes = Array.isArray(finalPayload.workoutDeletes)
          ? finalPayload.workoutDeletes
          : (finalPayload.workoutDelete ? [finalPayload.workoutDelete] : []);
        if (fdeletes.length > 0) handlePanelWorkoutDeletes(fdeletes);
        const fmods = Array.isArray(finalPayload.workoutModifications)
          ? finalPayload.workoutModifications
          : (finalPayload.workoutModification ? [finalPayload.workoutModification] : []);
        if (fmods.length > 0) handlePanelWorkoutMods(fmods);
        else if (finalPayload.workoutData) handlePanelWorkoutData(finalPayload.workoutData);
        applyPanelVoiceControl(finalPayload.voiceControl);
      } else if (!accumulated) {
        setGunnyMessages(prev => prev.map(m =>
          (m as ChatMessage & { _placeholderId?: string })._placeholderId === placeholderId
            ? { ...m, text: `⚠ Comms dropped, ${selectedOperator.callsign}. Retry in a moment.` } : m
        ));
      }
    } catch (error) {
      setGunnyMessages(prev => prev.map(m =>
        (m as ChatMessage & { _placeholderId?: string })._placeholderId === placeholderId
          ? { ...m, text: `Network error, ${selectedOperator.callsign}. Check your internet connection.` } : m
      ));
    } finally {
      setGunnyLoading(false); setGunnyThinkingAt(null);
    }
  };

  // Helper: handle meal data from streaming final payload
  const handlePanelMealData = (mealData: unknown) => {
    if (!mealData || typeof mealData !== 'object') return;
    const m = mealData as { name?: string; calories?: number; protein?: number; carbs?: number; fat?: number; date?: string };
    if (typeof m.calories === 'number' && typeof m.protein === 'number' && typeof m.carbs === 'number' && typeof m.fat === 'number') {
      const today = getLocalDateStr();
      const targetDate = isValidDateStr(m.date) ? m.date : today;
      const time = targetDate === today
        ? new Date().toISOString()
        : new Date(`${targetDate}T12:00:00`).toISOString();
      const meal = {
        id: `meal-${Date.now()}`,
        name: m.name || 'Logged meal',
        calories: Math.round(m.calories),
        protein: Math.round(m.protein),
        carbs: Math.round(m.carbs),
        fat: Math.round(m.fat),
        time,
      };
      const existingNutrition = currentSelectedOp.nutrition || { targets: { calories: 2500, protein: 150, carbs: 300, fat: 80 }, meals: {} };
      const existingMeals = existingNutrition.meals || {};
      const prevBucket = existingMeals[targetDate] || [];
      const updated = {
        ...currentSelectedOp,
        nutrition: {
          ...existingNutrition,
          meals: { ...existingMeals, [targetDate]: [...prevBucket, meal] },
        },
      };
      onUpdateOperator(updated);
    }
  };

  // Helper: handle <voice_control> command from streaming final payload.
  // Gunny emits voice_control when the user explicitly asks to turn voice
  // on/off (see gunny route's VOICE OUTPUT section). We trust the server to
  // have parsed the JSON; here we just map the action to setTtsEnabled and
  // warm the iOS audio context on an enable so the confirmation TTS plays.
  const applyPanelVoiceControl = (vc: unknown) => {
    if (!vc || typeof vc !== 'object') return;
    const action = (vc as { action?: string }).action;
    if (typeof action !== 'string') return;
    const a = action.toLowerCase();
    if (a === 'enable' || a === 'on') {
      setTtsEnabledGlobal(true);
      unlockAudioContext();
    } else if (a === 'disable' || a === 'off' || a === 'mute') {
      setTtsEnabledGlobal(false);
    }
  };

  // Helper: handle workout modifications (ARRAY) from streaming final payload.
  // Gunny may emit multiple <workout_modification> blocks in one response — most
  // commonly a prefill_weights per exercise when the operator asks for "fill
  // every lift." We apply prefills via the Planner event bus (they don't touch
  // the persisted workout) and fold every block-shape mod into a single
  // operator update so React only renders once.
  const handlePanelWorkoutMods = (mods: unknown[]) => {
    if (!Array.isArray(mods) || mods.length === 0) return;
    const today = getLocalDateStr();
    let workingOp = currentSelectedOp;
    let touched = false;

    for (const raw of mods) {
      const mod = raw as WorkoutModification;
      if (!mod || typeof mod !== 'object') continue;

      if (mod.type === 'prefill_weights') {
        dispatchPrefillWeights(mod as PrefillWeightsMod);
        continue;
      }

      const current = workingOp.workouts?.[today];
      if (!current) continue;
      try {
        // Unwrap the new return shape — silent no-ops are surfaced
        // via result.changed so the caller can decide whether to
        // persist anything. Without this branch we'd persist the
        // unchanged workout reference, which is harmless but
        // generates noise re-renders.
        const result = applyWorkoutModification(current, mod);
        if (result.changed) {
          workingOp = {
            ...workingOp,
            workouts: { ...workingOp.workouts, [today]: result.workout },
          };
          touched = true;
        } else {
          console.warn('[gunny-mod:appshell] no-op:', result.reason, mod);
        }
      } catch (e) {
        console.error('applyWorkoutModification failed:', e);
      }
    }

    if (touched) onUpdateOperator(workingOp);
  };

  // Apply <workout_delete> signals from Gunny — removes the workout
  // for one or more dates from operator.workouts. Without this handler,
  // Gunny would say "deleted from planner" in chat but the planner
  // would still show the workout (the bug the operator hit). The dates
  // payload comes from /api/gunny which now parses <workout_delete>
  // blocks and returns either a single workoutDelete or an array of
  // workoutDeletes (batch).
  const handlePanelWorkoutDeletes = (deletes: unknown) => {
    const list: Array<{ date: string }> = Array.isArray(deletes)
      ? (deletes as Array<{ date: string }>)
      : (deletes && typeof (deletes as { date?: string }).date === 'string'
          ? [deletes as { date: string }]
          : []);
    if (list.length === 0) return;

    let workingOp = currentSelectedOp;
    let touched = false;
    for (const item of list) {
      const date = item?.date;
      if (!date || !isValidDateStr(date)) continue;
      if (!workingOp.workouts || !workingOp.workouts[date]) continue;
      const nextWorkouts = { ...workingOp.workouts };
      delete nextWorkouts[date];
      workingOp = { ...workingOp, workouts: nextWorkouts };
      touched = true;
    }
    if (touched) onUpdateOperator(workingOp);
  };

  // Helper: handle new workout data from streaming final payload
  const handlePanelWorkoutData = (workoutData: unknown) => {
    const today = getLocalDateStr();
    const wd = workoutData as Record<string, unknown>;
    const targetDate = isValidDateStr(wd.date) ? (wd.date as string) : today;
    const completedFlag = wd.completed === true;
    const workout: Workout = {
      id: `workout-assist-${Date.now()}`,
      date: targetDate,
      title: (wd.title as string) || 'Gunny Assist Workout',
      notes: (wd.notes as string) || '',
      warmup: (wd.warmup as string) || '',
      blocks: ((wd.blocks as Array<Record<string, unknown>>) || []).map((b: Record<string, unknown>, i: number) => {
        const blockType = (b.type as string) === 'conditioning' ? 'conditioning' : 'exercise';
        if (blockType === 'conditioning') {
          return {
            type: 'conditioning' as const,
            id: `block-assist-${i}`,
            sortOrder: i,
            format: (b.format as string) || '',
            description: (b.description as string) || '',
            isLinkedToNext: false,
          };
        }
        return {
          type: 'exercise' as const,
          id: `block-assist-${i}`,
          sortOrder: i,
          exerciseName: (b.exerciseName as string) || '',
          prescription: (b.prescription as string) || '',
          isLinkedToNext: false,
          ...(b.videoUrl ? { videoUrl: b.videoUrl as string } : {}),
        };
      }),
      cooldown: (wd.cooldown as string) || '',
      completed: completedFlag,
    };
    const updated = { ...currentSelectedOp };
    updated.workouts = { ...updated.workouts, [targetDate]: workout };
    onUpdateOperator(updated);
  };

  const currentSelectedOp = operators.find(op => op.id === selectedOperator.id) || selectedOperator;

  // Gunny voice response — shown as overlay on workout screen, NOT in chat panel
  const [gunnyVoiceResponse, setGunnyVoiceResponse] = useState<string | null>(null);
  const gunnyVoiceResponseTimer = useRef<NodeJS.Timeout | null>(null);
  const showGunnyVoiceResponse = useCallback((text: string) => {
    setGunnyVoiceResponse(text);
    if (gunnyVoiceResponseTimer.current) clearTimeout(gunnyVoiceResponseTimer.current);
    // Auto-dismiss based on text length (10s min, 30s max)
    const duration = Math.min(30000, Math.max(10000, text.length * 80));
    gunnyVoiceResponseTimer.current = setTimeout(() => setGunnyVoiceResponse(null), duration);
  }, []);

  // Voice "over" trigger — sends directly to Gunny without touching the phone
  // Does NOT open the Gunny panel — response shows as overlay on workout screen.
  // The optional `image` field is forwarded to /api/gunny which already
  // accepts base64 images on user messages (route.ts:1090-1104) — used by
  // NotesFormPopover's "Upload Form Check" path.
  const sendGunnyVoiceMessage = useCallback((text: string, opts?: { image?: string }) => {
    if (!text.trim()) return;
    // DON'T open Gunny panel — keep workout screen focused
    // Still log to chat history so user can review later
    setTimeout(() => {
      const userMessage: ChatMessage & { image?: string } = {
        role: 'user',
        text: text,
        timestamp: Date.now(),
        ...(opts?.image ? { image: opts.image } : {}),
      };
      setGunnyMessages(prev => [...prev, userMessage]);
      setGunnyInput('');
      setGunnyLoading(true); setGunnyThinkingAt(Date.now());

      const doSend = async () => {
        try {
          const trainer = selectedOperator.trainerId ? operators.find(op => op.id === selectedOperator.trainerId) : null;
          const trainerData = trainer ? {
            workouts: trainer.workouts,
            preferences: trainer.preferences,
            prs: trainer.prs,
            profile: trainer.profile,
            trainerNotes: selectedOperator.trainerNotes,
          } : null;

          const response = await fetch('/api/gunny', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
            body: JSON.stringify({
              messages: [...gunnyMessages, userMessage],
              operatorContext: buildOperatorContext(),
              tier: selectedOperator.tier || 'standard',
              mode: getGunnyMode(),
              screenContext: getScreenContext(),
              clientDate: getLocalDateStr(),
              clientDateLong: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
              clientTimezone: getLocalTimezone(),
              ...(trainerData && { trainerData }),
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            const errMsg = data?.error || 'Gunny AI temporarily offline.';
            setGunnyMessages(prev => [...prev, { role: 'gunny' as const, text: errMsg, timestamp: Date.now() }]);
          } else {
            const replyText = data.response || data.message || data.text || 'Copy that, Marine.';
            setGunnyMessages(prev => [...prev, { role: 'gunny' as const, text: replyText, timestamp: Date.now() }]);
            // Show response on workout screen + speak it
            showGunnyVoiceResponse(replyText);
            speakGunny(replyText);

            // DIRECT MEAL LOG via voice — Gunny emitted <meal_json>, honors backdate
            if (data.mealData && typeof data.mealData === 'object') {
              const m = data.mealData as { name?: string; calories?: number; protein?: number; carbs?: number; fat?: number; date?: string };
              if (typeof m.calories === 'number' && typeof m.protein === 'number' && typeof m.carbs === 'number' && typeof m.fat === 'number') {
                const today = getLocalDateStr();
                const targetDate = isValidDateStr(m.date) ? m.date : today;
                const time = targetDate === today
                  ? new Date().toISOString()
                  : new Date(`${targetDate}T12:00:00`).toISOString();
                const meal = {
                  id: `meal-${Date.now()}`,
                  name: m.name || 'Logged meal',
                  calories: Math.round(m.calories),
                  protein: Math.round(m.protein),
                  carbs: Math.round(m.carbs),
                  fat: Math.round(m.fat),
                  time,
                };
                // Deep-clone the nutrition chain to avoid mutating the live operator reference
                const existingNutrition = currentSelectedOp.nutrition || { targets: { calories: 2500, protein: 150, carbs: 300, fat: 80 }, meals: {} };
                const existingMeals = existingNutrition.meals || {};
                const prevBucket2 = existingMeals[targetDate] || [];
                const updated = {
                  ...currentSelectedOp,
                  nutrition: {
                    ...existingNutrition,
                    meals: { ...existingMeals, [targetDate]: [...prevBucket2, meal] },
                  },
                };
                onUpdateOperator(updated);
              }
            }

            // Voice path: workout deletions land first so move-style
            // operations (delete source date, add target date) don't
            // race each other.
            const voiceDeletes: unknown[] = Array.isArray(data.workoutDeletes)
              ? data.workoutDeletes
              : (data.workoutDelete ? [data.workoutDelete] : []);
            if (voiceDeletes.length > 0) handlePanelWorkoutDeletes(voiceDeletes);
            const voiceMods: unknown[] = Array.isArray(data.workoutModifications)
              ? data.workoutModifications
              : (data.workoutModification ? [data.workoutModification] : []);
            if (voiceMods.length > 0) {
              handlePanelWorkoutMods(voiceMods);
            } else if (data.workoutData) {
              const today = getLocalDateStr();
              const wd = data.workoutData as Record<string, unknown>;
              const targetDate = isValidDateStr(wd.date) ? (wd.date as string) : today;
              const completedFlag = wd.completed === true;
              const workout: Workout = {
                id: `workout-assist-${Date.now()}`,
                date: targetDate,
                title: (wd.title as string) || 'Gunny Assist Workout',
                notes: (wd.notes as string) || '',
                warmup: (wd.warmup as string) || '',
                blocks: ((wd.blocks as Array<Record<string, unknown>>) || []).map((b: Record<string, unknown>, i: number) => {
                  const blockType = (b.type as string) === 'conditioning' ? 'conditioning' : 'exercise';
                  if (blockType === 'conditioning') {
                    return {
                      type: 'conditioning' as const,
                      id: `block-assist-${i}`,
                      sortOrder: i,
                      format: (b.format as string) || '',
                      description: (b.description as string) || '',
                      isLinkedToNext: false,
                    };
                  }
                  return {
                    type: 'exercise' as const,
                    id: `block-assist-${i}`,
                    sortOrder: i,
                    exerciseName: (b.exerciseName as string) || '',
                    prescription: (b.prescription as string) || '',
                    isLinkedToNext: false,
                    ...(b.videoUrl ? { videoUrl: b.videoUrl as string } : {}),
                  };
                }),
                cooldown: (wd.cooldown as string) || '',
                completed: completedFlag,
              };
              const updated = { ...currentSelectedOp };
              updated.workouts = { ...updated.workouts, [targetDate]: workout };
              onUpdateOperator(updated);
            }
          }
        } catch {
          setGunnyMessages(prev => [...prev, {
            role: 'gunny' as const,
            text: `Network error, ${selectedOperator.callsign}. Check your connection.`,
            timestamp: Date.now(),
          }]);
        } finally {
          setGunnyLoading(false); setGunnyThinkingAt(null);
        }
      };
      doSend();
    }, 50);
  }, [gunnyMessages, selectedOperator, operators, buildOperatorContext, getScreenContext, getGunnyMode, currentSelectedOp, onUpdateOperator, showGunnyVoiceResponse]);

  // Tab icons are SVG components from Icons.tsx per the canonical
  // handoff spec — character glyphs (◆ ▦ ◈ ▶ ⬡) were the legacy
  // placeholder. Each takes a `size` prop so the tabbar and the
  // desktop top-nav strip can render at different scales without
  // duplicating definitions. The Gunny center tab keeps its own
  // logo-glow image treatment (rendered via .gunny-icon-wrap in
  // the tabbar JSX); its `icon` prop here is unused in that path.
  const baseTabs: { id: AppTab; label: string; labelKey: string; icon: React.ReactNode }[] = [
    { id: 'coc',     label: t('nav.coc_short'),    labelKey: 'nav.coc_short',    icon: <Icon.Target /> },
    { id: 'planner', label: t('nav.planner'),      labelKey: 'nav.planner',      icon: <Icon.Calendar /> },
    { id: 'intel',   label: t('nav.intel_short'),  labelKey: 'nav.intel_short',  icon: <Icon.Stats /> },
    { id: 'gunny',   label: t('nav.gunny_short'),  labelKey: 'nav.gunny_short',  icon: <Icon.Bolt /> },
  ];

  // Parent Hub tab — only surfaces for adults whose id appears in any
  // junior operator's parentIds (i.e. they have a linked junior). Behind
  // the JUNIOR_OPERATOR_ENABLED flag. Renders ParentDashboard inside.
  const linkedJuniorsForHub = isJuniorOperatorEnabledClient()
    ? getParentJuniors(currentUser.id, operators)
    : [];
  const showParentHub = linkedJuniorsForHub.length > 0;

  // Conditionally add OPS tab for trainers and admins.
  const isTrainerOrAdmin = OPS_CENTER_ACCESS.includes(currentUser.id) || currentUser.role === 'trainer';

  // Daily Ops tab — Commander-tier (opus / white_glove) feature.
  // For junior operators viewing their own surface we surface it
  // anyway and let the DailyOps component handle the "awaiting parent"
  // state; for adult viewers it surfaces only when they themselves
  // hold Commander access. Trainers/admins see it for any operator
  // they're viewing because they sit above the tier gate.
  const showDailyOps =
    isTrainerOrAdmin ||
    currentSelectedOp.isJunior ||
    hasCommanderAccess({
      id: currentSelectedOp.id,
      tier: currentSelectedOp.tier ?? undefined,
      role: currentSelectedOp.role,
    });

  const tabs: typeof baseTabs = [
    ...baseTabs,
    ...(showDailyOps
      ? [{ id: 'daily_ops' as AppTab, label: t('nav.daily_ops_short') || 'OPS DAY', labelKey: 'nav.daily_ops_short', icon: <Icon.Clock /> }]
      : []),
    ...(showParentHub
      ? [{ id: 'parent_hub' as AppTab, label: t('nav.parent_hub_short'), labelKey: 'nav.parent_hub_short', icon: <Icon.Target /> }]
      : []),
    ...(isTrainerOrAdmin
      ? [{ id: 'ops' as AppTab, label: 'OPS', labelKey: 'nav.ops', icon: <Icon.Settings /> }]
      : []),
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'coc':
        return (
          <>
            {currentSelectedOp.sitrep && Object.keys(currentSelectedOp.sitrep).length > 0 && (
              <DailyBriefComponent
                operator={currentSelectedOp}
                onUpdateOperator={onUpdateOperator}
                onViewPriorNutrition={() => setActiveTab('intel')}
              />
            )}

            {/* New Battle Plan button — only shown on own profile
                when a SITREP already exists. Uses .btn.btn-amber.btn-sm
                so it reads as a "warm/in-progress destructive action"
                — replaces the legacy gray ghost button. */}
            {currentSelectedOp.id === currentUser.id && currentSelectedOp.sitrep && Object.keys(currentSelectedOp.sitrep).length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowNewPlanConfirm(true)}
                  className="btn btn-amber btn-sm"
                >
                  <Icon.Sword size={14} />
                  New Battle Plan
                </button>
              </div>
            )}

            {/* New Battle Plan Confirmation Modal */}
            {showNewPlanConfirm && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.85)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  padding: 20,
                }}
              >
                <div
                  className="ds-card bracket amber amber-tone"
                  style={{ padding: 24, maxWidth: 400, width: '100%', textAlign: 'center' }}
                >
                  <span className="bl" /><span className="br" />
                  <div className="t-eyebrow amber" style={{ marginBottom: 12, justifyContent: 'center', display: 'flex' }}>
                    <Icon.Warning size={12} />
                    New Battle Plan
                  </div>
                  <p className="t-body-sm" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
                    This will replace your current SITREP and generate a brand new battle plan from scratch.
                  </p>
                  <p className="t-mono-sm" style={{ color: 'var(--text-tertiary)', marginBottom: 20 }}>
                    Your workout history and progress data will be preserved — only the plan changes.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowNewPlanConfirm(false)}
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleNewBattlePlan}
                      className="btn btn-amber btn-sm"
                      style={{ flex: 1 }}
                    >
                      Generate New Plan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Battle Plan Reference — dedicated section */}
            {currentSelectedOp.sitrep && currentSelectedOp.sitrep.generatedDate && (
              <BattlePlanRef sitrep={currentSelectedOp.sitrep} focus="all" compact={true}
                operator={currentSelectedOp} onUpdateOperator={onUpdateOperator} />
            )}

            {/* Daily Brief Reference — dedicated section */}
            {currentSelectedOp.dailyBrief && currentSelectedOp.dailyBrief.date && (
              <DailyBriefRef brief={currentSelectedOp.dailyBrief} focus="all" compact={true} />
            )}

            <COCDashboard operator={currentSelectedOp} allOperators={accessibleUsers} />

            <Leaderboard operators={operators} currentUser={currentUser} />
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#FF8C00', letterSpacing: 1, marginBottom: 12 }}>{t('appshell.achievements')}</h3>
              <Achievements operator={currentSelectedOp} />
            </div>
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', letterSpacing: 1, marginBottom: 12 }}>{t('appshell.squad_feed')}</h3>
              <SocialFeed operators={operators} currentOperator={currentSelectedOp} />
            </div>
            {currentSelectedOp.betaUser && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#ff4444', letterSpacing: 1, marginBottom: 12 }}>{t('appshell.beta_feedback')}</h3>
                <BetaFeedback operatorId={currentSelectedOp.id} callsign={currentSelectedOp.callsign} />
              </div>
            )}
            <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(0, 255, 65, 0.1)', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px 0', fontFamily: 'Chakra Petch, sans-serif' }}>
                <button
                  onClick={() => setShowTOS(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#00ff41',
                    cursor: 'pointer',
                    fontSize: 12,
                    textDecoration: 'underline',
                  }}
                >
                  Terms of Service
                </button>
                {' | '}
                <button
                  onClick={() => setShowPrivacy(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#00ff41',
                    cursor: 'pointer',
                    fontSize: 12,
                    textDecoration: 'underline',
                  }}
                >
                  Privacy Policy
                </button>
              </p>
            </div>
          </>
        );
      case 'planner':
        return <Planner operator={currentSelectedOp} onUpdateOperator={onUpdateOperator} onOpenGunny={() => setActiveTab('gunny')} onSendGunnyMessage={sendGunnyVoiceMessage} gunnyVoiceResponse={gunnyVoiceResponse} onDismissGunnyResponse={() => setGunnyVoiceResponse(null)} onWorkoutModeChange={setWorkoutModeState} onWorkoutSaved={() => setActiveTab('planner')} />;
      case 'daily_ops':
        // Daily Ops Planner — Gunny's prescribed daily-schedule.
        // Sister surface to Planner; bridges to GunnyChat via
        // onSendGunnyMessage so "Generate today's plan" tap routes
        // through the chat channel that owns the LLM call.
        return (
          <DailyOps
            operator={currentSelectedOp}
            onSendGunnyMessage={(prompt) => {
              setActiveTab('gunny');
              sendGunnyVoiceMessage(prompt);
            }}
          />
        );
      case 'intel':
        return <IntelCenter operator={currentSelectedOp} currentUser={currentUser} onUpdateOperator={onUpdateOperator} onRequestIntake={() => setShowIntake(true)} />;
      case 'radio':
        return <TacticalRadio operator={currentSelectedOp} allOperators={accessibleUsers} onUpdateOperator={onUpdateOperator} />;
      case 'gunny':
        // Rendered as an always-mounted sibling inside <main> below so streaming
        // state survives tab switches. See the display-toggled wrapper near renderTabContent().
        return null;
      case 'parent_hub':
        // Surfaces only for adults with at least one junior in their
        // parentIds. Read-only visibility into the linked juniors' training,
        // safety events, emergency contact. The junior is told their parent
        // sees this (transparency disclosed in JuniorIntakeForm welcome).
        return (
          <div style={{ padding: '16px 18px' }}>
            <ParentDashboard
              parent={currentUser}
              juniors={linkedJuniorsForHub}
              onUpdateJunior={onUpdateOperator}
            />
          </div>
        );
      case 'ops':
        // Trainer-specific view
        if (currentUser.role === 'trainer') {
          // The two-button toggle (MY CLIENTS / COMMAND CENTER) was
          // clipping behind the topbar on mobile because the buttons
          // were sized as full bracket-card chrome (.btn-primary /
          // .btn-ghost render at ~44px tall with 14px+ padding) and
          // the row sat flush against the AppShell header.
          //
          // Mobile fix: smaller pill segmented control, equal-width
          // splits, tighter padding. Desktop keeps the spacious
          // version. The toggle is also Command-Center-only (admins),
          // so non-admins skip the toggle entirely.
          const hasCommandCenter = OPS_CENTER_ACCESS.includes(currentUser.id);
          return (
            <div>
              {hasCommandCenter && (
                <div style={{
                  display: 'flex',
                  gap: isMobile ? '6px' : '10px',
                  padding: isMobile ? '8px 12px' : '14px 18px',
                  borderBottom: '1px solid var(--border-green-soft)',
                  background: 'var(--bg-card)',
                }}>
                  <button
                    type="button"
                    onClick={() => setShowTrainerDashboard(false)}
                    className={`btn ${isMobile ? 'btn-xs' : 'btn-sm'} ${!showTrainerDashboard ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, minHeight: isMobile ? 32 : 40, fontSize: isMobile ? 11 : 13 }}
                  >
                    {isMobile ? 'CLIENTS' : 'My Clients'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTrainerDashboard(true)}
                    className={`btn ${isMobile ? 'btn-xs' : 'btn-sm'} ${showTrainerDashboard ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, minHeight: isMobile ? 32 : 40, fontSize: isMobile ? 11 : 13 }}
                  >
                    {isMobile ? 'COMMAND' : 'Command Center'}
                  </button>
                </div>
              )}
              {/* Content */}
              {showTrainerDashboard && hasCommandCenter ? (
                <OpsCenter currentUser={currentUser} operators={operators} />
              ) : (
                <TrainerDashboard trainer={currentUser} allOperators={operators} onUpdateOperator={onUpdateOperator} />
              )}
            </div>
          );
        }
        // Admin-only view
        return <OpsCenter currentUser={currentUser} operators={operators} />;
      default:
        return null;
    }
  };

  // Show SITREP view after intake completion
  if (showSitrep) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '100dvh',
          background: 'var(--bg-base)',
          color: 'var(--green)',
          fontFamily: 'var(--body)',
          overflow: 'auto',
        }}
      >
        <DataRain />
        <div style={{ position: 'relative', zIndex: 1, padding: '20px 0' }}>
          {sitrepLoading && !pendingSitrep ? (
            <div style={{ maxWidth: 640, margin: '0 auto', padding: 36, textAlign: 'center' }}>
              <div className="t-display-l" style={{ color: 'var(--green)', letterSpacing: 3, marginBottom: 14, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon.Sword size={18} />
                Building Your Battle Plan
              </div>
              <p className="t-mono-sm" style={{ color: 'var(--text-tertiary)', marginBottom: 22, lineHeight: 1.8 }}>
                Gunny AI is analyzing your intake data and building a personalized training and nutrition plan…
              </p>
              <div className="bar" style={{ width: 200, margin: '0 auto', height: 4 }}>
                <span style={{ width: '60%', animation: 'sitrep-load 2s ease-in-out infinite' }} />
              </div>
              <style>{`@keyframes sitrep-load { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }`}</style>
            </div>
          ) : pendingSitrep ? (
            <SitrepView
              sitrep={pendingSitrep}
              callsign={currentUser.callsign}
              onAccept={handleAcceptSitrep}
              onRegenerate={handleRegenerateSitrep}
              loading={sitrepLoading}
            />
          ) : (
            <div style={{ maxWidth: 640, margin: '0 auto', padding: 36, textAlign: 'center' }}>
              <div className="t-display-m" style={{ color: 'var(--danger)', marginBottom: 14 }}>
                Sitrep Generation Failed
              </div>
              <p className="t-body-sm" style={{ color: 'var(--text-tertiary)', marginBottom: 14 }}>
                Gunny AI encountered an error. Try again or skip for now.
              </p>
              {sitrepError && (
                <div
                  className="ds-card"
                  style={{
                    padding: 8,
                    background: 'rgba(255, 0, 0, 0.05)',
                    borderColor: 'rgba(255, 0, 0, 0.15)',
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    color: 'var(--danger)',
                    marginBottom: 14,
                    wordBreak: 'break-word',
                  }}
                >
                  {sitrepError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button type="button" onClick={() => generateSitrep(currentUser)} className="btn btn-primary btn-sm">
                  Retry
                </button>
                <button type="button" onClick={() => { setShowSitrep(false); setActiveTab('coc'); }} className="btn btn-ghost btn-sm">
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Standalone PersonaPicker takeover ──────────────────────────────
  // Triggered by the What's New modal CTA `open_persona_picker`. Renders
  // as a full-screen page that writes the operator's choice and exits.
  // Intentionally placed BEFORE the intake check so a mid-onboarding
  // takeover doesn't happen — intake always wins.
  if (showStandalonePersonaPicker && !showIntake) {
    return (
      <div style={{ width: '100%', minHeight: '100dvh', backgroundColor: '#030303', color: '#00ff41', fontFamily: '"Chakra Petch", sans-serif', overflow: 'auto' }}>
        <DataRain />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <PersonaPicker
            currentPersonaId={(currentUser.personaId as PersonaId | undefined) ?? 'gunny'}
            operatorAge={currentUser.profile?.age}
            operatorFitnessLevel={currentUser.intake?.fitnessLevel}
            mode="standalone"
            onBack={() => setShowStandalonePersonaPicker(false)}
            onSelectPersona={(id) => {
              const updated: Operator = { ...currentUser, personaId: id };
              onUpdateOperator(updated, true);
              setShowStandalonePersonaPicker(false);
            }}
          />
        </div>
      </div>
    );
  }

  // Show intake form if not completed OR user requested to re-take it.
  // Junior operators (with the flag on) get the youth-safe JuniorIntakeForm
  // instead of the adult IntakeForm. Adult flow + flag-disabled juniors
  // fall through to the existing IntakeForm — no behavior change.
  if (showIntake) {
    const useJuniorIntake = currentUser.isJunior === true && isJuniorOperatorEnabledClient();
    return (
      <div style={{ width: '100%', minHeight: '100dvh', backgroundColor: '#030303', color: '#00ff41', fontFamily: '"Chakra Petch", sans-serif', overflow: 'auto' }}>
        <DataRain />
        <div style={{ position: 'relative', zIndex: 1, padding: '20px 0' }}>
          {useJuniorIntake ? (
            <JuniorIntakeForm
              operator={currentUser}
              onComplete={(updated) => {
                onUpdateOperator(updated);
                setShowIntake(false);
                // SITREP generation is intentionally skipped for juniors —
                // the adult SITREP path computes macros and prescribes adult
                // training splits, neither of which apply to youth operators.
                // The trainer (RAMPAGE) sets the junior's program manually.
              }}
              onSkip={() => setShowIntake(false)}
            />
          ) : (
            <IntakeForm
              operator={currentUser}
              onComplete={async (updated) => {
                onUpdateOperator(updated);
                setShowIntake(false);

                // Path recommendation: when the operator picked
                // "LET GUNNY DECIDE" (gunny_pick) we call the
                // /api/gunny/recommend-path endpoint to get a concrete
                // training path + rationale based on intake. We do this
                // BEFORE generateSitrep so the SITREP can use the
                // resolved path. Errors are non-fatal — fall through
                // to SITREP with whatever path was set.
                let opForSitrep = updated;
                if (updated.preferences?.trainingPath === 'gunny_pick') {
                  try {
                    const token = (typeof window !== 'undefined') ? localStorage.getItem('authToken') : null;
                    const res = await fetch('/api/gunny/recommend-path', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({ operatorId: updated.id }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.ok && data.path) {
                        const withPath: Operator = {
                          ...updated,
                          preferences: {
                            ...updated.preferences,
                            trainingPath: data.path,
                            gunnyPathRationale: data.rationale,
                            gunnyPathAlternates: data.alternates,
                          },
                        };
                        onUpdateOperator(withPath);
                        opForSitrep = withPath;
                      }
                    }
                  } catch (err) {
                    console.error('[AppShell] path recommendation failed', err);
                  }
                }

                // Auto-generate SITREP after intake (now using
                // resolved path if recommendation ran)
                generateSitrep(opForSitrep);
              }}
              onSkip={() => setShowIntake(false)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={isIpadOrLarger ? 'ipad' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100dvh',
        backgroundColor: 'var(--bg-base, #030303)',
        color: 'var(--text-primary, #00ff41)',
        fontFamily: '"Chakra Petch", sans-serif',
        overflow: 'hidden',
      }}
    >

      <style>{`
        @keyframes breathingGlow {
          0%, 100% { text-shadow: 0 0 8px rgba(0,255,65,0.3), 0 0 12px rgba(0,255,65,0.1); }
          50% { text-shadow: 0 0 12px rgba(0,255,65,0.5), 0 0 20px rgba(0,255,65,0.2); }
        }

        @keyframes accentPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }

        @keyframes cornerBracketIn {
          from { opacity: 0; }
          to { opacity: 0.4; }
        }

        .guns-up-breathing {
          animation: breathingGlow 3s ease-in-out infinite;
        }

        .accent-pulse {
          animation: accentPulse 2.5s ease-in-out infinite;
        }

        .bracket-decoration {
          position: absolute;
          pointer-events: none;
          animation: cornerBracketIn 0.6s ease-out forwards;
        }

        .bracket-tl::before, .bracket-tl::after { content: ''; position: absolute; background: #ffb800; }
        .bracket-tl::before { width: 12px; height: 2px; top: 0; left: 0; }
        .bracket-tl::after { width: 2px; height: 12px; top: 0; left: 0; }

        .bracket-tr::before, .bracket-tr::after { content: ''; position: absolute; background: #ffb800; }
        .bracket-tr::before { width: 12px; height: 2px; top: 0; right: 0; }
        .bracket-tr::after { width: 2px; height: 12px; top: 0; right: 0; }

        .bracket-bl::before, .bracket-bl::after { content: ''; position: absolute; background: #ffb800; }
        .bracket-bl::before { width: 12px; height: 2px; bottom: 0; left: 0; }
        .bracket-bl::after { width: 2px; height: 12px; bottom: 0; left: 0; }

        .bracket-br::before, .bracket-br::after { content: ''; position: absolute; background: #ffb800; }
        .bracket-br::before { width: 12px; height: 2px; bottom: 0; right: 0; }
        .bracket-br::after { width: 2px; height: 12px; bottom: 0; right: 0; }

        .nav-tab {
          position: relative;
          font-family: 'Orbitron', sans-serif;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          border: none;
          outline: none;
          background: transparent;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .nav-tab .tab-indicator {
          position: absolute;
          bottom: 0;
          left: 10%;
          right: 10%;
          height: 2px;
          background: #00ff41;
          box-shadow: 0 0 8px rgba(0,255,65,0.4);
          transform: scaleX(0);
          transition: transform 0.25s ease;
        }
        .nav-tab.active .tab-indicator {
          transform: scaleX(1);
        }
        .nav-tab:hover { color: #00ff41 !important; }
        .nav-tab .tab-icon { transition: opacity 0.2s ease; }

        /* Mobile bottom nav — visibility logic only.
           Visual styling now lives in src/styles/design-system.css under
           the .ds-tabbar selector. The .bottom-nav class is kept as a
           media-query hook so we can hide the bar on desktop where
           .desktop-nav handles navigation instead. */
        .bottom-nav {
          display: none !important;
        }
        .desktop-nav {
          display: flex;
        }

        /* Gunny panel styles */
        .gunny-panel-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 300;
          animation: fadeIn 0.3s ease;
        }

        .gunny-panel {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 380px;
          background: rgba(3, 3, 3, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-right: 3px solid #ffb800;
          box-shadow: 8px 0 32px rgba(0, 0, 0, 0.8);
          display: flex;
          flex-direction: column;
          z-index: 310;
          animation: slideInLeft 0.35s cubic-bezier(0.25, 1, 0.5, 1);
        }

        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .gunny-header {
          padding: 16px;
          border-bottom: 1px solid rgba(255, 184, 0, 0.2);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }

        .gunny-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .gunny-message {
          padding: 12px;
          border-radius: 4px;
          font-size: 14px;
          line-height: 1.5;
          max-width: 100%;
          word-wrap: break-word;
          animation: messageSlideIn 0.3s ease;
        }

        @keyframes messageSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .gunny-message.user {
          align-self: flex-end;
          background: rgba(0, 255, 65, 0.12);
          border-left: 2px solid #00ff41;
          color: #00ff41;
          max-width: 90%;
        }

        .gunny-message.gunny {
          align-self: flex-start;
          background: rgba(255, 184, 0, 0.08);
          border-left: 2px solid #ffb800;
          color: #ffb800;
          max-width: 90%;
        }

        .gunny-input-area {
          padding: 12px;
          border-top: 1px solid rgba(255, 184, 0, 0.2);
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .gunny-input {
          flex: 1;
          padding: 10px 12px;
          background: rgba(255, 184, 0, 0.06);
          border: 1px solid rgba(255, 184, 0, 0.3);
          border-radius: 4px;
          color: #ffb800;
          font-family: 'Share Tech Mono', monospace;
          font-size: 16px;
          transition: all 0.2s ease;
          outline: none;
        }

        .gunny-input:focus {
          background: rgba(255, 184, 0, 0.1);
          border-color: #ffb800;
          box-shadow: 0 0 12px rgba(255, 184, 0, 0.2);
        }

        .gunny-input::placeholder {
          color: rgba(255, 184, 0, 0.4);
        }

        .gunny-send-btn {
          padding: 10px 16px;
          background: rgba(255, 184, 0, 0.15);
          border: 1px solid #ffb800;
          border-radius: 4px;
          color: #ffb800;
          cursor: pointer;
          font-family: 'Orbitron', sans-serif;
          font-size: 12px;
          font-weight: 700;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .gunny-send-btn:hover:not(:disabled) {
          background: rgba(255, 184, 0, 0.25);
          box-shadow: 0 0 12px rgba(255, 184, 0, 0.3);
        }

        .gunny-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* .gunny-toggle-btn — legacy class hook only.
           All visual treatment now comes from .ds-gunny-fab in
           src/styles/design-system.css (amber translucent fill, 14px
           radius, slide-in pop animation). The class name persists on
           the JSX node in case external code targets it; no styles
           defined here. */

        .classification-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 16px;
          background: rgba(3, 3, 3, 0.95);
          border-top: 1px solid rgba(0, 255, 65, 0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          color: rgba(0, 255, 65, 0.15);
          letter-spacing: 2px;
          z-index: 50;
          pointer-events: none;
        }

        @media (max-width: 768px) {
          /* Show the design-system tabbar on mobile; hide the legacy
             .bottom-nav placeholder. .ds-tabbar owns layout (grid +
             5 cols), background, blur, border, safe-area padding. */
          .bottom-nav {
            display: grid !important;
          }
          .desktop-nav {
            display: none !important;
          }
          .desktop-user-switcher {
            display: none !important;
          }

          .gunny-panel {
            width: 85%;
            max-width: 340px;
            animation: slideInLeft 0.35s cubic-bezier(0.25, 1, 0.5, 1);
          }

          .classification-bar {
            display: none !important;
          }
        }
      `}</style>

      {/* ═══ OVERWATCH-style background overlays ═══ */}
      {/* Scanline overlay */}
      <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,.012) 2px, rgba(0,255,65,.012) 4px)', mixBlendMode: 'screen', pointerEvents: 'none', zIndex: 999 }} />
      {/* Background grid + radar ellipses */}
      <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
        <defs><pattern id="gu-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(0,255,65,0.03)" strokeWidth="0.5" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#gu-grid)" />
        <g opacity=".05" stroke="#00ff41" fill="none" strokeWidth=".4">
          <ellipse cx="50%" cy="55%" rx="350" ry="200"/>
          <ellipse cx="50%" cy="55%" rx="270" ry="150"/>
          <ellipse cx="50%" cy="55%" rx="190" ry="100"/>
          <ellipse cx="50%" cy="55%" rx="110" ry="55"/>
        </g>
      </svg>
      {/* Matrix code rain */}
      <DataRain />

      {/* Top Header Bar — uses .ds-topbar from the design system. The
          mount-fade is the only inline bit left; .ds-topbar owns the
          background, blur, border, padding, and z-index. */}
      <header
        className="ds-topbar"
        style={{
          height: isMobile ? '44px' : '52px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}
      >
        {/* Left: Logo + GUNS UP / callsign brand stack —
            .ds-topbar-brand handles type, glow, layout. The pulsing
            green dot before the callsign satisfies the spec's
            "right-side callsign chip with pulsing dot animation
            (opacity 1→0.4→1 over 2s)" — the chip is on the brand
            stack rather than a separate right-side pill so it
            doesn't compete with the existing UserSwitcher dropdown
            on the right. */}
        <div className="ds-topbar-brand">
          <Logo size={isMobile ? 22 : 26} className="mark" />
          <div className="stack">
            <span className="guns-up-breathing t1">GUNS UP</span>
            <span className="t2" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span
                aria-hidden
                style={{
                  width: 5,
                  height: 5,
                  background: 'var(--green)',
                  borderRadius: '50%',
                  boxShadow: '0 0 6px var(--green)',
                  animation: 'dsPulseDot 2s ease-in-out infinite',
                }}
              />
              {currentSelectedOp.callsign}
            </span>
          </div>
        </div>

        {/* Center: Desktop Navigation Tabs — uses the .subtabs
            utility from the design system so the desktop nav reads
            with the same chrome vocabulary as the mobile bottom
            tabbar (10px Orbitron 700 / 1.8px LS, 2px glowing
            underline on active). The legacy inline-style "nav-tab"
            chrome rendered an unstyled-looking strip on desktop
            because it never adopted design-system tokens. */}
        <nav
          className="desktop-nav subtabs"
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            borderBottom: 'none',
            padding: 0,
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isOps = tab.id === 'ops';
            const isGunny = tab.id === 'gunny';
            return (
              <button
                key={tab.id}
                type="button"
                className={`nav-tab ${isActive ? 'active' : ''} ${isGunny ? 'gunny-tab' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  trackEvent(EVENTS.TAB_CHANGED, { tab: tab.id });
                }}
                style={
                  // Ops tab keeps its red active treatment as the
                  // exception (it's the trainer/admin entry point).
                  isOps && isActive
                    ? { color: '#ff2020', padding: '12px 18px' }
                    : { padding: '12px 18px' }
                }
              >
                {isGunny ? (
                  // Match the mobile/iPad bottom-tab "hero Gunny"
                  // treatment — the green-glowing logo image with
                  // the radial halo behind it (.gunny-icon-wrap from
                  // design-system.css). The .desktop modifier scales
                  // the wrap down for the inline horizontal nav so
                  // it doesn't pop out of the topbar like it does on
                  // the mobile bottom bar.
                  <span className="gunny-icon-wrap desktop" aria-hidden>
                    <img src="/logo-glow.png" alt="" className="gunny-icon" />
                  </span>
                ) : (
                  <span
                    aria-hidden
                    style={{
                      opacity: isActive ? 1 : 0.5,
                      marginRight: 6,
                      display: 'inline-flex',
                      verticalAlign: 'middle',
                    }}
                  >
                    {React.cloneElement(tab.icon as React.ReactElement<{ size?: number }>, { size: 14 })}
                  </span>
                )}
                {t(tab.labelKey)}
              </button>
            );
          })}
        </nav>

        {/* Right: User Switcher (desktop). The EN/ES toggle was
            removed in May 2026 — language is now locked at signup
            and switches require a support request. The picker still
            lives on the LoginScreen. */}
        <div className="desktop-user-switcher" style={{ minWidth: '280px', display: 'flex', justifyContent: 'flex-end', gap: '16px', alignItems: 'center' }}>
          <UserSwitcher
            currentUser={currentUser}
            accessibleUsers={accessibleUsers}
            selectedUser={currentSelectedOp}
            onSelectUser={setSelectedOperator}
            onLogout={onLogout}
          />
        </div>

        {/* Mobile: user switcher only.
            The compact EN/ES toggle that used to live here was
            removed in May 2026 (language locks at signup; switches
            go through support). LoginScreen still surfaces the
            picker pre-signup. */}
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserSwitcher
              currentUser={currentUser}
              accessibleUsers={accessibleUsers}
              selectedUser={currentSelectedOp}
              onSelectUser={setSelectedOperator}
              onLogout={onLogout}
            />
          </div>
        )}
      </header>

      {/* Accent Line with pulse animation */}
      <div className="accent-pulse" style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent 5%, rgba(255,184,0,0.6) 30%, #ffb800 50%, rgba(255,184,0,0.6) 70%, transparent 95%)',
        boxShadow: '0 1px 8px rgba(255,184,0,0.15)',
        flexShrink: 0,
      }} />

      {/* Content Area */}
      <main className="gu-scalable" style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#030303',
        position: 'relative',
        // Tab bar's actual height = 8px top padding + 56px button
        // min-height + 6px bottom padding + safe-area-inset-bottom
        // (per design-system.css .ds-tabbar). The legacy 56px padding
        // here was clipping anything that sat at the bottom of the
        // content area (notably the GunnyChat composer "What's the
        // mission..." bar) under the fixed tab bar. 70px + safe-area
        // matches the actual tab bar footprint.
        paddingBottom: isMobile ? 'calc(70px + env(safe-area-inset-bottom, 0px))' : '0',
      }}>
        {renderTabContent()}
        {/* Always-mounted GunnyChat — display-toggled so streaming state & refs
            survive tab switches. Absolute fill so the inner flex column
            (header + scrollable messages + composer) honors the parent's
            actual height; with the prior height:100% inside flex+overflow,
            percentage heights resolved oddly and the composer slipped
            beneath the bottom tab bar on mobile. */}
        <div style={{
          display: activeTab === 'gunny' ? 'block' : 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: isMobile ? 'calc(70px + env(safe-area-inset-bottom, 0px))' : 0,
        }}>
          <GunnyChat operator={currentSelectedOp} allOperators={accessibleUsers} onUpdateOperator={onUpdateOperator} />
        </div>
      </main>

      {/* Mobile Bottom Tab Bar — uses .ds-tabbar from the design system.
          Background, blur, top-border, safe-area padding, fixed positioning,
          and the active top-pip indicator all live in CSS now. We keep the
          icon glyph + label structure but reorder so Gunny sits in the
          center with the special halo treatment per the handoff. */}
      <nav className={`ds-tabbar bottom-nav${(() => {
        // Compute six-column flag synchronously so the parent gets the
        // right grid template before children render. Six columns
        // appear when the operator has BOTH a power-tab (ops or
        // parent_hub) AND daily_ops — typical for admins/trainers who
        // are also Commander-tier (e.g. founders testing the feature).
        const ids = new Set(tabs.map(t => t.id));
        const hasPowerTab = ids.has('ops') || ids.has('parent_hub');
        const hasDailyOps = ids.has('daily_ops');
        return hasPowerTab && hasDailyOps ? ' six-col' : '';
      })()}`}>
        {(() => {
          // Reorder for the mobile grid: Gunny stays in the
          // visually-anchored center slot. We build a 5-slot row for
          // the common case and a 6-slot row when both Daily Ops AND
          // a power tab (OPS / PARENT_HUB) need to coexist — e.g. a
          // founder/admin who's also Commander-tier and wants both
          // surfaces at thumb-reach.
          //
          // Layout (5-col):  [coc] [planner] [GUNNY] [intel] [daily_ops|ops|parent_hub]
          // Layout (6-col):  [coc] [planner] [GUNNY] [intel] [daily_ops] [ops|parent_hub]
          const byId = new Map(tabs.map(t => [t.id, t] as const));
          const dailyOps = byId.get('daily_ops') ?? null;
          const powerTab = byId.get('ops') ?? byId.get('parent_hub') ?? null;
          const sixCol = !!dailyOps && !!powerTab;
          const slots: (typeof tabs[number] | null)[] = sixCol
            ? [
                byId.get('coc') ?? null,
                byId.get('planner') ?? null,
                byId.get('gunny') ?? null,
                byId.get('intel') ?? null,
                dailyOps,
                powerTab,
              ]
            : [
                byId.get('coc') ?? null,
                byId.get('planner') ?? null,
                byId.get('gunny') ?? null,
                byId.get('intel') ?? null,
                // 5-col fallback priority: daily_ops first (the
                // user-facing daily-rhythm surface), then power tabs.
                // Non-admin Commanders get Daily Ops here. Non-Commander
                // trainers/admins (no Daily Ops in tabs) get OPS here.
                dailyOps ?? powerTab,
              ];
          return slots.map((tab, idx) => {
            if (!tab) {
              // Empty grid cell — preserves 5-col layout for 4-tab users.
              return <span key={`slot-${idx}`} aria-hidden />;
            }
            const isActive = activeTab === tab.id;
            const isGunny = tab.id === 'gunny';
            return (
              <button
                key={tab.id}
                className={`${isActive ? 'active' : ''} ${isGunny ? 'gunny-tab' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  trackEvent(EVENTS.TAB_CHANGED, { tab: tab.id });
                }}
              >
                {isGunny ? (
                  <span className="gunny-icon-wrap">
                    <img src="/logo-glow.png" alt="" className="gunny-icon" />
                  </span>
                ) : (
                  <span aria-hidden style={{ display: 'inline-flex', lineHeight: 1 }}>
                    {React.cloneElement(tab.icon as React.ReactElement<{ size?: number }>, { size: 22 })}
                  </span>
                )}
                <span className="lbl">{t(tab.labelKey)}</span>
              </button>
            );
          });
        })()}
      </nav>

      {/* Gunny AI floating pill — REMOVED. The full GUNNY tab in the
          bottom nav is the canonical entry point. The floating FAB
          covered half the mobile screen and the side panel didn't deliver
          on its "context-aware live edits" intent. Side panel JSX below
          stays dormant for now; a future "Claude in Chrome" style
          implementation will revive a different surface. */}

      {/* Gunny AI Panel Overlay (mobile) */}
      {showGunnyPanel && isMobile && (
        <div
          className="gunny-panel-overlay"
          onClick={() => setShowGunnyPanel(false)}
        />
      )}

      {/* Gunny AI Side Panel */}
      {showGunnyPanel && (
        <div className="gunny-panel">
          {/* Header with Logo and close button */}
          <div className="gunny-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <Logo size={20} color="#ffb800" />
              <span style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                color: '#ffb800',
                letterSpacing: '2px',
              }}>
                GUNNY ASSIST
              </span>
            </div>
            <button
              onClick={toggleGunnyTts}
              title={gunnyTtsEnabled ? 'Voice ON — tap to mute' : 'Voice OFF — tap to unmute'}
              style={{
                background: gunnyTtsEnabled ? 'rgba(255,184,0,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${gunnyTtsEnabled ? 'rgba(255,184,0,0.4)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: '4px',
                color: gunnyTtsEnabled ? '#ffb800' : '#666',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '6px 10px',
                minWidth: '44px',
                minHeight: '36px',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {gunnyTtsEnabled ? '🔊' : '🔇'}
            </button>
            <button
              onClick={() => setShowGunnyPanel(false)}
              style={{
                background: 'rgba(255,68,68,0.1)',
                border: '1px solid rgba(255,68,68,0.3)',
                borderRadius: '4px',
                color: '#ff4444',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '6px 12px',
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700,
                letterSpacing: '1px',
                transition: 'all 0.2s ease',
                minWidth: '44px',
                minHeight: '36px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,68,68,0.2)'; e.currentTarget.style.borderColor = '#ff4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,68,68,0.3)'; }}
            >
              CLOSE
            </button>
          </div>

          {/* Messages Container */}
          <div className="gunny-messages">
            {gunnyMessages.length === 0 && !gunnyGreeted && (
              <div style={{
                textAlign: 'center',
                color: 'rgba(255, 184, 0, 0.4)',
                fontSize: '13px',
                marginTop: '20px',
              }}>
                {t('gunny.waiting') || 'Awaiting orders...'}
              </div>
            )}
            {gunnyMessages.filter(m => m.role === 'user' || m.text.length > 0).map((msg, idx) => (
              <div
                key={idx}
                className={`gunny-message ${msg.role}`}
              >
                {msg.role === 'gunny' ? <GunnyMarkdown text={msg.text} accent="#ffb800" /> : msg.text}
                {/* Per-message HEAR IT button — Gunny messages only.
                    User-initiated playback bypasses iOS autoplay
                    blocks AND the global TTS mute (so users who
                    silenced auto-speak can still hear specific
                    responses on demand). */}
                {msg.role === 'gunny' && msg.text && msg.text.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playPanelMessage(idx, msg.text);
                    }}
                    aria-label={
                      panelSpeakingIdx === idx
                        ? 'Stop reading message'
                        : 'Read message aloud'
                    }
                    title={
                      panelSpeakingIdx === idx
                        ? 'Stop'
                        : 'Hear Gunny say this'
                    }
                    style={{
                      marginTop: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: panelSpeakingIdx === idx
                        ? 'rgba(255,140,0,0.18)'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${
                        panelSpeakingIdx === idx
                          ? 'rgba(255,140,0,0.6)'
                          : 'rgba(255,140,0,0.2)'
                      }`,
                      color: panelSpeakingIdx === idx ? '#ffb800' : 'rgba(255,184,0,0.7)',
                      fontFamily: '"Share Tech Mono", monospace',
                      fontSize: 10,
                      letterSpacing: 1,
                      padding: '3px 8px',
                      cursor: 'pointer',
                      borderRadius: 2,
                      transition: 'all 0.15s ease',
                      boxShadow: panelSpeakingIdx === idx
                        ? '0 0 8px rgba(255,140,0,0.25)'
                        : 'none',
                    }}
                  >
                    {panelSpeakingIdx === idx ? '◼ STOP' : '▶ HEAR IT'}
                  </button>
                )}
              </div>
            ))}
            {gunnyLoading && (
              <ThinkingIndicator
                variant="panel"
                startedAt={gunnyThinkingAt ?? undefined}
                label="GUNNY THINKING"
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="gunny-input-area">
            <textarea
              ref={inputRef}
              className="gunny-input"
              placeholder={t('appshell.ask_about_screen')}
              value={gunnyInput}
              onChange={(e) => {
                setGunnyInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !gunnyLoading) {
                  e.preventDefault();
                  sendGunnyMessage();
                }
              }}
              disabled={gunnyLoading}
              rows={1}
              style={{ resize: 'none', overflow: 'hidden', lineHeight: '1.4' }}
            />
            <button
              className="gunny-send-btn"
              onClick={sendGunnyMessage}
              disabled={gunnyLoading || !gunnyInput.trim()}
            >
              {gunnyLoading ? '⋯' : <SendIcon size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* Legal Pages Overlays */}
      {showTOS && <TermsOfService onClose={() => setShowTOS(false)} />}
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}

      {/* What's New — first-login alert per the standing shipping order.
          The modal fires server-side dismiss before close, then routes
          the CTA action through handleAnnouncementAction (which can
          surface the standalone PersonaPicker, intake flow, etc.). */}
      {announcement && (
        <WhatsNewModal
          announcement={announcement}
          onClose={() => setAnnouncement(null)}
          onActionClick={handleAnnouncementAction}
        />
      )}

      {/* Classification Bar */}
      <div className="classification-bar" style={{ pointerEvents: 'auto', justifyContent: 'space-between', padding: '0 12px' }}>
        <span style={{ opacity: 0.5, fontSize: 9 }}>GUNS UP — EYES ONLY</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {(['S', 'M', 'L'] as const).map((size) => (
            <button
              key={size}
              onClick={() => setFontScale(size)}
              style={{
                background: fontScale === size ? 'rgba(0,255,65,0.2)' : 'transparent',
                border: fontScale === size ? '1px solid rgba(0,255,65,0.4)' : '1px solid transparent',
                borderRadius: 2,
                color: fontScale === size ? '#00ff41' : 'rgba(0,255,65,0.25)',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 8,
                fontWeight: 700,
                padding: '1px 4px',
                cursor: 'pointer',
                letterSpacing: 1,
                lineHeight: 1,
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AppShell;
