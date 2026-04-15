'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Operator, AppTab, OPS_CENTER_ACCESS } from '@/lib/types';
import { buildWorkoutAnalysis, findMostRecentCompletedWorkout } from '@/lib/workoutAnalysis';
import { applyWorkoutModification, type WorkoutModification } from '@/lib/workoutModification';
import { buildFullGunnyContext } from '@/lib/buildGunnyContext';
import { BoltIcon, SendIcon } from '@/components/Icons';
import Logo from '@/components/Logo';
import OpsCenter from '@/components/OpsCenter';
import UserSwitcher from '@/components/UserSwitcher';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/lib/i18n';
import COCDashboard from '@/components/COCDashboard';
import Planner, { WorkoutModeState } from '@/components/Planner';
import IntelCenter from '@/components/IntelCenter';
import { GunnyChat } from '@/components/GunnyChat';
import IntakeForm from '@/components/IntakeForm';
import SitrepView from '@/components/SitrepView';
import TacticalRadio from '@/components/TacticalRadio';
import { speak as gunnySpeak } from '@/lib/tts';
import DailyBriefComponent from '@/components/DailyBrief';
import BattlePlanRef from '@/components/BattlePlanRef';
import DailyBriefRef from '@/components/DailyBriefRef';
import Leaderboard from '@/components/Leaderboard';
import Achievements from '@/components/Achievements';
import SocialFeed from '@/components/SocialFeed';
import BetaFeedback from '@/components/BetaFeedback';
import TrainerDashboard from '@/components/TrainerDashboard';
import { TermsOfService, PrivacyPolicy } from '@/components/LegalPages';
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
  const { t, language } = useLanguage();
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
  const [selectedOperator, setSelectedOperator] = useState<Operator>(currentUser);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const lastWidthRef = useRef(0);
  const [showTrainerDashboard, setShowTrainerDashboard] = useState(false);
  const [showTOS, setShowTOS] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSitrep, setShowSitrep] = useState(false);
  const [sitrepLoading, setSitrepLoading] = useState(false);
  const [pendingSitrep, setPendingSitrep] = useState<import('@/lib/types').Sitrep | null>(null);
  const [showNewPlanConfirm, setShowNewPlanConfirm] = useState(false);

  // Gunny AI panel state
  const [showGunnyPanel, setShowGunnyPanel] = useState(false);
  const [gunnyMessages, setGunnyMessages] = useState<ChatMessage[]>([]);
  const [gunnyInput, setGunnyInput] = useState('');
  const [gunnyLoading, setGunnyLoading] = useState(false);
  const [gunnyGreeted, setGunnyGreeted] = useState(false);
  const [gunnyTtsEnabled, setGunnyTtsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`guns-up-tts-${selectedOperator?.id}`) === 'true';
  });
  const [workoutModeState, setWorkoutModeState] = useState<WorkoutModeState>({ active: false, workoutTitle: '', exercises: [] });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelInitRef = useRef<string>(''); // track which operator panel was initialized for

  // Initialize mounted state and responsive detection
  useEffect(() => {
    setMounted(true);
    const check = () => {
      const w = window.innerWidth;
      if (w !== lastWidthRef.current) {
        lastWidthRef.current = w;
        setIsMobile(w < 768);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
            const today = new Date().toISOString().split('T')[0];
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
  }, [gunnyMessages]);

  // Load saved panel chat or generate greeting when panel opens
  useEffect(() => {
    if (!showGunnyPanel) return;
    // Only initialize once per operator
    if (panelInitRef.current === selectedOperator.id) return;
    panelInitRef.current = selectedOperator.id;

    const loadPanelChat = async () => {
      // Try API first
      try {
        const res = await fetch(`/api/chat?operatorId=${selectedOperator.id}&chatType=gunny-panel`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}` },
        });
        if (res.ok) {
          const data = await res.json();
          const msgs = data.messages as ChatMessage[];
          if (Array.isArray(msgs) && msgs.length > 0) {
            setGunnyMessages(msgs);
            setGunnyGreeted(true);
            return;
          }
        }
      } catch { /* API unavailable */ }

      // Fallback to localStorage
      try {
        const key = `gunny-panel-${selectedOperator.id}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const saved = JSON.parse(raw) as ChatMessage[];
          if (Array.isArray(saved) && saved.length > 0) {
            setGunnyMessages(saved);
            setGunnyGreeted(true);
            // Migrate to API
            fetch('/api/chat', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''}` },
              body: JSON.stringify({ operatorId: selectedOperator.id, chatType: 'gunny-panel', messages: saved }),
            }).catch(() => {});
            return;
          }
        }
      } catch { /* ignore */ }

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
  }, [showGunnyPanel, selectedOperator.id, selectedOperator.callsign]);

  // Persist panel messages (API + localStorage fallback)
  const prevPanelMsgCountRef = useRef(0);
  useEffect(() => {
    if (gunnyMessages.length > 0 && gunnyMessages.length !== prevPanelMsgCountRef.current) {
      prevPanelMsgCountRef.current = gunnyMessages.length;
      // Save to API (non-blocking)
      fetch('/api/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''}` },
        body: JSON.stringify({ operatorId: selectedOperator.id, chatType: 'gunny-panel', messages: gunnyMessages }),
      }).catch(() => {});
      // Also save to localStorage as fallback
      try {
        localStorage.setItem(`gunny-panel-${selectedOperator.id}`, JSON.stringify(gunnyMessages));
      } catch { /* storage full */ }
    }
  }, [gunnyMessages, selectedOperator.id]);

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
    const today = new Date().toISOString().split('T')[0];
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
    return buildFullGunnyContext(op, {
      language: language || 'en',
      workoutExecution: workoutModeState?.active ? {
        active: workoutModeState.active,
        workoutTitle: workoutModeState.workoutTitle,
        exercises: workoutModeState.exercises,
      } : null,
    }) as OperatorContextData;
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
      dailyBrief: (() => { const td = new Date().toISOString().split('T')[0]; const db = op.dailyBrief as any;
        if (!db || db.date !== td) return null;
        return { complianceScore: db.complianceScore, adjustments: db.adjustments, gunnyNote: db.gunnyNote };
      })(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      todayWorkout: (() => { const td = new Date().toISOString().split('T')[0]; const w = (op.workouts as any)?.[td];
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
          const key = d.toISOString().split('T')[0]; if ((op.workouts as any)?.[key]?.completed) streak++; else if (i > 0) break; }
        return streak; })(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalWorkoutsCompleted: Object.values(op.workouts || {}).filter((w: any) => (w as any)?.completed).length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentDayTags: (() => { const entries = Object.entries(op.dayTags || {}).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7);
        if (!entries.length) return null;
        return entries.map(([date, tag]) => `${date}: [${(tag as any).color}] ${(tag as any).note}`).join('\n');
      })(),
      lastCompletedWorkout: (() => {
        const td = new Date().toISOString().split('T')[0];
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''}` },
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

  // TTS — Gunny speaks back (only when toggle is enabled)
  const speakGunny = (text: string) => {
    if (gunnyTtsEnabled) gunnySpeak(text);
  };

  const toggleGunnyTts = () => {
    setGunnyTtsEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(`guns-up-tts-${selectedOperator?.id}`, String(next)); } catch {}
      return next;
    });
  };

  // Send message to Gunny API (side panel — context-aware mode)
  const sendGunnyMessage = async () => {
    if (!gunnyInput.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      text: gunnyInput,
      timestamp: Date.now(),
    };

    setGunnyMessages(prev => [...prev, userMessage]);
    setGunnyInput('');
    setGunnyLoading(true);

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

      const response = await fetch('/api/gunny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''}` },
        body: JSON.stringify({
          messages: [...gunnyMessages, userMessage],
          operatorContext: buildOperatorContext(),
          tier: selectedOperator.tier || 'standard',
          mode: getGunnyMode(),
          screenContext: getScreenContext(),
          ...(trainerData && { trainerData }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Use the specific error message from the API
        const errMsg = data?.error || 'Gunny AI temporarily offline.';
        setGunnyMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'gunny' && lastMsg.text === errMsg) return prev;
          return [...prev, { role: 'gunny' as const, text: errMsg, timestamp: Date.now() }];
        });
      } else {
        const replyText = data.response || data.message || data.text || 'Copy that, soldier.';
        const gunnyReply: ChatMessage = {
          role: 'gunny',
          text: replyText,
          timestamp: Date.now(),
        };
        setGunnyMessages(prev => [...prev, gunnyReply]);
        speakGunny(replyText);

        // DIRECT MEAL LOG — Gunny emitted <meal_json>; persist to nutrition.meals[today]
        if (data.mealData && typeof data.mealData === 'object') {
          const m = data.mealData as { name?: string; calories?: number; protein?: number; carbs?: number; fat?: number };
          if (typeof m.calories === 'number' && typeof m.protein === 'number' && typeof m.carbs === 'number' && typeof m.fat === 'number') {
            const today = new Date().toISOString().split('T')[0];
            const meal = {
              id: `meal-${Date.now()}`,
              name: m.name || 'Logged meal',
              calories: Math.round(m.calories),
              protein: Math.round(m.protein),
              carbs: Math.round(m.carbs),
              fat: Math.round(m.fat),
              time: new Date().toISOString(),
            };
            const updated = { ...currentSelectedOp };
            if (!updated.nutrition) updated.nutrition = { targets: { calories: 2500, protein: 150, carbs: 300, fat: 80 }, meals: {} };
            if (!updated.nutrition.meals) updated.nutrition.meals = {};
            const prevToday = updated.nutrition.meals[today] || [];
            updated.nutrition.meals = { ...updated.nutrition.meals, [today]: [...prevToday, meal] };
            onUpdateOperator(updated);
          }
        }

        // SURGICAL MODIFICATION — apply targeted change to today's workout (preserves logged results)
        if (data.workoutModification) {
          const today = new Date().toISOString().split('T')[0];
          const current = currentSelectedOp.workouts?.[today];
          if (current) {
            try {
              const modified = applyWorkoutModification(current, data.workoutModification as WorkoutModification);
              const updated = { ...currentSelectedOp };
              updated.workouts = { ...updated.workouts, [today]: modified };
              onUpdateOperator(updated);
            } catch (e) {
              console.error('applyWorkoutModification failed:', e);
            }
          } else {
            console.warn('workout_modification returned but no active workout for today');
          }
        } else if (data.workoutData) {
          // If Gunny Assist built a complete new workout, save it to the planner
          const today = new Date().toISOString().split('T')[0];
          const workout = {
            id: `workout-assist-${Date.now()}`,
            date: today,
            title: data.workoutData.title || 'Gunny Assist Workout',
            notes: data.workoutData.notes || '',
            warmup: data.workoutData.warmup || '',
            blocks: (data.workoutData.blocks || []).map((b: Record<string, unknown>, i: number) => ({
              type: b.type || 'exercise',
              id: `block-assist-${i}`,
              sortOrder: i,
              exerciseName: b.exerciseName || '',
              prescription: b.prescription || '',
              isLinkedToNext: false,
              ...(b.type === 'conditioning' ? { format: b.format, description: b.description } : {}),
              ...(b.videoUrl ? { videoUrl: b.videoUrl } : {}),
            })),
            cooldown: data.workoutData.cooldown || '',
            completed: false,
          };
          const updated = { ...currentSelectedOp };
          updated.workouts = { ...updated.workouts, [today]: workout };
          onUpdateOperator(updated);
        }
      }
    } catch (error) {
      setGunnyMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'gunny' && lastMsg.text.includes('connection')) return prev;
        return [...prev, {
          role: 'gunny' as const,
          text: `Network error, ${selectedOperator.callsign}. Check your internet connection.`,
          timestamp: Date.now(),
        }];
      });
    } finally {
      setGunnyLoading(false);
    }
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
  // Does NOT open the Gunny panel — response shows as overlay on workout screen
  const sendGunnyVoiceMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    // DON'T open Gunny panel — keep workout screen focused
    // Still log to chat history so user can review later
    setTimeout(() => {
      const userMessage: ChatMessage = {
        role: 'user',
        text: text,
        timestamp: Date.now(),
      };
      setGunnyMessages(prev => [...prev, userMessage]);
      setGunnyInput('');
      setGunnyLoading(true);

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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''}` },
            body: JSON.stringify({
              messages: [...gunnyMessages, userMessage],
              operatorContext: buildOperatorContext(),
              tier: selectedOperator.tier || 'standard',
              mode: getGunnyMode(),
              screenContext: getScreenContext(),
              ...(trainerData && { trainerData }),
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            const errMsg = data?.error || 'Gunny AI temporarily offline.';
            setGunnyMessages(prev => [...prev, { role: 'gunny' as const, text: errMsg, timestamp: Date.now() }]);
          } else {
            const replyText = data.response || data.message || data.text || 'Copy that, soldier.';
            setGunnyMessages(prev => [...prev, { role: 'gunny' as const, text: replyText, timestamp: Date.now() }]);
            // Show response on workout screen + speak it
            showGunnyVoiceResponse(replyText);
            speakGunny(replyText);

            // DIRECT MEAL LOG via voice — Gunny emitted <meal_json>
            if (data.mealData && typeof data.mealData === 'object') {
              const m = data.mealData as { name?: string; calories?: number; protein?: number; carbs?: number; fat?: number };
              if (typeof m.calories === 'number' && typeof m.protein === 'number' && typeof m.carbs === 'number' && typeof m.fat === 'number') {
                const today = new Date().toISOString().split('T')[0];
                const meal = {
                  id: `meal-${Date.now()}`,
                  name: m.name || 'Logged meal',
                  calories: Math.round(m.calories),
                  protein: Math.round(m.protein),
                  carbs: Math.round(m.carbs),
                  fat: Math.round(m.fat),
                  time: new Date().toISOString(),
                };
                const updated = { ...currentSelectedOp };
                if (!updated.nutrition) updated.nutrition = { targets: { calories: 2500, protein: 150, carbs: 300, fat: 80 }, meals: {} };
                if (!updated.nutrition.meals) updated.nutrition.meals = {};
                const prevToday = updated.nutrition.meals[today] || [];
                updated.nutrition.meals = { ...updated.nutrition.meals, [today]: [...prevToday, meal] };
                onUpdateOperator(updated);
              }
            }

            if (data.workoutModification) {
              const today = new Date().toISOString().split('T')[0];
              const current = currentSelectedOp.workouts?.[today];
              if (current) {
                try {
                  const modified = applyWorkoutModification(current, data.workoutModification as WorkoutModification);
                  const updated = { ...currentSelectedOp };
                  updated.workouts = { ...updated.workouts, [today]: modified };
                  onUpdateOperator(updated);
                } catch (e) {
                  console.error('applyWorkoutModification (voice) failed:', e);
                }
              }
            } else if (data.workoutData) {
              const today = new Date().toISOString().split('T')[0];
              const workout = {
                id: `workout-assist-${Date.now()}`,
                date: today,
                title: data.workoutData.title || 'Gunny Assist Workout',
                notes: data.workoutData.notes || '',
                warmup: data.workoutData.warmup || '',
                blocks: (data.workoutData.blocks || []).map((b: Record<string, unknown>, i: number) => ({
                  type: b.type || 'exercise',
                  id: `block-assist-${i}`,
                  sortOrder: i,
                  exerciseName: b.exerciseName || '',
                  prescription: b.prescription || '',
                  isLinkedToNext: false,
                  ...(b.type === 'conditioning' ? { format: b.format, description: b.description } : {}),
                  ...(b.videoUrl ? { videoUrl: b.videoUrl } : {}),
                })),
                cooldown: data.workoutData.cooldown || '',
                completed: false,
              };
              const updated = { ...currentSelectedOp };
              updated.workouts = { ...updated.workouts, [today]: workout };
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
          setGunnyLoading(false);
        }
      };
      doSend();
    }, 50);
  }, [gunnyMessages, selectedOperator, operators, buildOperatorContext, getScreenContext, getGunnyMode, currentSelectedOp, onUpdateOperator, showGunnyVoiceResponse]);

  const baseTabs: { id: AppTab; label: string; labelKey: string; icon: string }[] = [
    { id: 'coc', label: t('nav.coc_short'), labelKey: 'nav.coc_short', icon: '◆' },
    { id: 'planner', label: t('nav.planner'), labelKey: 'nav.planner', icon: '▦' },
    { id: 'intel', label: t('nav.intel_short'), labelKey: 'nav.intel_short', icon: '◈' },
    { id: 'gunny', label: t('nav.gunny_short'), labelKey: 'nav.gunny_short', icon: '▶' },
  ];

  // Conditionally add OPS tab for trainers and admins
  const tabs = (OPS_CENTER_ACCESS.includes(currentUser.id) || currentUser.role === 'trainer')
    ? [...baseTabs, { id: 'ops' as AppTab, label: 'OPS', labelKey: 'nav.ops', icon: '⬡' }]
    : baseTabs;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'coc':
        return (
          <>
            {currentSelectedOp.sitrep && Object.keys(currentSelectedOp.sitrep).length > 0 && (
              <DailyBriefComponent operator={currentSelectedOp} onUpdateOperator={onUpdateOperator} />
            )}

            {/* New Battle Plan button — only show for own profile when SITREP exists */}
            {currentSelectedOp.id === currentUser.id && currentSelectedOp.sitrep && Object.keys(currentSelectedOp.sitrep).length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <button
                  onClick={() => setShowNewPlanConfirm(true)}
                  style={{
                    padding: '8px 20px', background: 'transparent', color: '#888',
                    border: '1px solid #333', borderRadius: 4, cursor: 'pointer',
                    fontFamily: 'Share Tech Mono, monospace', fontSize: 11, letterSpacing: 0.5,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff6b35'; e.currentTarget.style.color = '#ff6b35'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#888'; }}
                >
                  ⚔️ NEW BATTLE PLAN
                </button>
              </div>
            )}

            {/* New Battle Plan Confirmation Modal */}
            {showNewPlanConfirm && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 9999, padding: 20,
              }}>
                <div style={{
                  background: '#0a0a0a', border: '1px solid rgba(255,107,53,0.4)', borderRadius: 8,
                  padding: 24, maxWidth: 400, width: '100%', textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#ff6b35', letterSpacing: 1, marginBottom: 12 }}>
                    ⚠️ NEW BATTLE PLAN
                  </div>
                  <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, marginBottom: 8 }}>
                    This will replace your current SITREP and generate a brand new battle plan from scratch.
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 20 }}>
                    Your workout history and progress data will be preserved — only the plan changes.
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => setShowNewPlanConfirm(false)}
                      style={{
                        flex: 1, padding: 12, background: 'transparent', color: '#888',
                        border: '1px solid #333', borderRadius: 4, cursor: 'pointer',
                        fontFamily: 'Share Tech Mono, monospace', fontSize: 12,
                      }}
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={handleNewBattlePlan}
                      style={{
                        flex: 1, padding: 12, background: '#ff6b35', color: '#000',
                        border: 'none', borderRadius: 4, cursor: 'pointer',
                        fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 1,
                      }}
                    >
                      GENERATE NEW PLAN
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
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#FF8C00', letterSpacing: 1, marginBottom: 12 }}>ACHIEVEMENTS</h3>
              <Achievements operator={currentSelectedOp} />
            </div>
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', letterSpacing: 1, marginBottom: 12 }}>SQUAD FEED</h3>
              <SocialFeed operators={operators} currentOperator={currentSelectedOp} />
            </div>
            {currentSelectedOp.betaUser && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#ff4444', letterSpacing: 1, marginBottom: 12 }}>BETA FEEDBACK</h3>
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
        return <Planner operator={currentSelectedOp} onUpdateOperator={onUpdateOperator} onOpenGunny={() => setShowGunnyPanel(true)} onSendGunnyMessage={sendGunnyVoiceMessage} gunnyVoiceResponse={gunnyVoiceResponse} onDismissGunnyResponse={() => setGunnyVoiceResponse(null)} onWorkoutModeChange={setWorkoutModeState} />;
      case 'intel':
        return <IntelCenter operator={currentSelectedOp} currentUser={currentUser} onUpdateOperator={onUpdateOperator} onRequestIntake={() => setShowIntake(true)} />;
      case 'radio':
        return <TacticalRadio operator={currentSelectedOp} allOperators={accessibleUsers} onUpdateOperator={onUpdateOperator} />;
      case 'gunny':
        return <GunnyChat operator={currentSelectedOp} allOperators={accessibleUsers} onUpdateOperator={onUpdateOperator} />;
      case 'ops':
        // Trainer-specific view
        if (currentUser.role === 'trainer') {
          return (
            <div>
              {/* Sub-tab toggle for trainers */}
              <div style={{
                display: 'flex',
                gap: '10px',
                padding: '15px 20px',
                borderBottom: '1px solid #1a1a2e',
                backgroundColor: '#0a0a0a',
              }}>
                <button
                  onClick={() => setShowTrainerDashboard(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: !showTrainerDashboard ? '#00ff41' : 'transparent',
                    color: !showTrainerDashboard ? '#000' : '#888',
                    border: '1px solid ' + (!showTrainerDashboard ? '#00ff41' : '#333'),
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontFamily: '"Orbitron", sans-serif',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    transition: 'all 0.2s',
                  }}
                >
                  MY CLIENTS
                </button>
                {OPS_CENTER_ACCESS.includes(currentUser.id) && (
                  <button
                    onClick={() => setShowTrainerDashboard(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: showTrainerDashboard ? '#00ff41' : 'transparent',
                      color: showTrainerDashboard ? '#000' : '#888',
                      border: '1px solid ' + (showTrainerDashboard ? '#00ff41' : '#333'),
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontFamily: '"Orbitron", sans-serif',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      transition: 'all 0.2s',
                    }}
                  >
                    COMMAND CENTER
                  </button>
                )}
              </div>
              {/* Content */}
              {showTrainerDashboard && OPS_CENTER_ACCESS.includes(currentUser.id) ? (
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
      <div style={{ width: '100%', minHeight: '100dvh', backgroundColor: '#030303', color: '#00ff41', fontFamily: '"Chakra Petch", sans-serif', overflow: 'auto' }}>
        <DataRain />
        <div style={{ position: 'relative', zIndex: 1, padding: '20px 0' }}>
          {sitrepLoading && !pendingSitrep ? (
            <div style={{ maxWidth: 640, margin: '0 auto', padding: 40, textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 20, color: '#00ff41', letterSpacing: 3, marginBottom: 16 }}>
                ⚔️ BUILDING YOUR BATTLE PLAN
              </div>
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 13, color: '#888', marginBottom: 24, lineHeight: 1.8 }}>
                Gunny AI is analyzing your intake data and building a personalized training and nutrition plan...
              </div>
              <div style={{ width: 200, height: 4, background: '#1a1a1a', borderRadius: 2, margin: '0 auto', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: '#00ff41', borderRadius: 2,
                  animation: 'sitrep-load 2s ease-in-out infinite',
                  width: '60%',
                }} />
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
            <div style={{ maxWidth: 640, margin: '0 auto', padding: 40, textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, color: '#ff4444', marginBottom: 16 }}>SITREP GENERATION FAILED</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>Gunny AI encountered an error. Try again or skip for now.</div>
              {sitrepError && (
                <div style={{ fontSize: 10, color: '#ff6b6b', marginBottom: 16, padding: 8, background: 'rgba(255,0,0,0.05)', border: '1px solid rgba(255,0,0,0.15)', borderRadius: 4, fontFamily: 'Share Tech Mono, monospace', wordBreak: 'break-word' }}>
                  {sitrepError}
                </div>
              )}
              <button onClick={() => generateSitrep(currentUser)} style={{ padding: '10px 20px', background: '#00ff41', color: '#000', border: 'none', fontFamily: 'Orbitron, sans-serif', fontSize: 11, borderRadius: 4, cursor: 'pointer', marginRight: 8 }}>RETRY</button>
              <button onClick={() => { setShowSitrep(false); setActiveTab('coc'); }} style={{ padding: '10px 20px', background: 'transparent', color: '#888', border: '1px solid #333', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, borderRadius: 4, cursor: 'pointer' }}>SKIP</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show intake form if not completed OR user requested to re-take it
  if (showIntake) {
    return (
      <div style={{ width: '100%', minHeight: '100dvh', backgroundColor: '#030303', color: '#00ff41', fontFamily: '"Chakra Petch", sans-serif', overflow: 'auto' }}>
        <DataRain />
        <div style={{ position: 'relative', zIndex: 1, padding: '20px 0' }}>
          <IntakeForm
            operator={currentUser}
            onComplete={(updated) => {
              onUpdateOperator(updated);
              setShowIntake(false);
              // Auto-generate SITREP after intake
              generateSitrep(updated);
            }}
            onSkip={() => setShowIntake(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100dvh',
      backgroundColor: '#030303',
      color: '#00ff41',
      fontFamily: '"Chakra Petch", sans-serif',
      overflow: 'hidden',
    }}>

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

        /* Mobile bottom nav */
        .bottom-nav {
          display: none;
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

        .gunny-toggle-btn {
          position: fixed;
          left: 8px;
          bottom: 70px;
          padding: 6px 12px;
          background: linear-gradient(135deg, rgba(255,184,0,0.2), rgba(255,184,0,0.1));
          border: 1px solid rgba(255,184,0,0.5);
          border-radius: 6px;
          color: #ffb800;
          cursor: pointer;
          font-family: 'Orbitron', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
          writing-mode: horizontal-tb;
          z-index: 9997;
          transition: all 0.3s ease;
          box-shadow: 0 2px 12px rgba(255,184,0,0.15);
          animation: togglePulse 3s ease-in-out infinite;
        }

        .gunny-toggle-btn:hover {
          background: linear-gradient(135deg, rgba(255,184,0,0.35), rgba(255,184,0,0.2));
          box-shadow: 0 2px 20px rgba(255,184,0,0.3);
        }

        @keyframes togglePulse {
          0%, 100% { box-shadow: 4px 0 20px rgba(255,184,0,0.15); }
          50% { box-shadow: 4px 0 24px rgba(255,184,0,0.3); }
        }

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
          .bottom-nav {
            display: flex !important;
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

          .gunny-toggle-btn {
            bottom: 64px;
            left: 6px;
            padding: 5px 10px;
            font-size: 9px;
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

      {/* Top Header Bar */}
      <header style={{
        height: isMobile ? '44px' : '52px',
        background: 'linear-gradient(180deg, rgba(10,10,10,0.95) 0%, rgba(5,5,5,0.98) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0, 255, 65, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: isMobile ? '12px' : '20px',
        paddingRight: isMobile ? '12px' : '20px',
        flexShrink: 0,
        position: 'relative',
        zIndex: 100,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}>
        {/* Left: Logo and Title */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '8px' : '12px',
        }}>
          <Logo size={isMobile ? 22 : 26} color="#00ff41" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span className="guns-up-breathing" style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: isMobile ? '10px' : '11px',
              fontWeight: 700,
              letterSpacing: '3px',
              color: '#00ff41',
            }}>
              GUNS UP
            </span>
            <span style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: '15px',
              color: '#666',
              letterSpacing: '1px',
            }}>
              {currentSelectedOp.callsign}
            </span>
          </div>
        </div>

        {/* Center: Desktop Navigation Tabs */}
        <nav className="desktop-nav" style={{
          gap: '2px',
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isOps = tab.id === 'ops';
            const activeColor = isOps ? '#ff2020' : '#00ff41';
            return (
              <button
                key={tab.id}
                className={`nav-tab ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  trackEvent(EVENTS.TAB_CHANGED, { tab: tab.id });
                }}
                style={{
                  fontSize: '15px',
                  padding: '8px 20px',
                  fontWeight: isActive ? 800 : 500,
                  color: isActive ? activeColor : '#3a3a3a',
                  backgroundColor: isActive ? (isOps ? 'rgba(255, 32, 32, 0.06)' : 'rgba(0, 255, 65, 0.04)') : 'transparent',
                }}
              >
                <span className="tab-icon" style={{
                  fontSize: '15px',
                  opacity: isActive ? 1 : 0.3,
                  color: isActive ? activeColor : '#888',
                }}>
                  {tab.icon}
                </span>
                {t(tab.labelKey)}
                <div className="tab-indicator" style={isOps ? { background: '#ff2020', boxShadow: '0 0 8px rgba(255,32,32,0.4)' } : undefined} />
              </button>
            );
          })}
        </nav>

        {/* Right: Language Toggle + User Switcher (desktop) */}
        <div className="desktop-user-switcher" style={{ minWidth: '280px', display: 'flex', justifyContent: 'flex-end', gap: '16px', alignItems: 'center' }}>
          <LanguageToggle compact={true} />
          <UserSwitcher
            currentUser={currentUser}
            accessibleUsers={accessibleUsers}
            selectedUser={currentSelectedOp}
            onSelectUser={setSelectedOperator}
            onLogout={onLogout}
          />
        </div>

        {/* Mobile: compact user switcher */}
        {isMobile && (
          <UserSwitcher
            currentUser={currentUser}
            accessibleUsers={accessibleUsers}
            selectedUser={currentSelectedOp}
            onSelectUser={setSelectedOperator}
            onLogout={onLogout}
          />
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
      <main style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#030303',
        position: 'relative',
        paddingBottom: isMobile ? '56px' : '0',
      }}>
        {renderTabContent()}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="bottom-nav" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '56px',
        background: 'linear-gradient(180deg, rgba(8,8,8,0.98) 0%, rgba(3,3,3,1) 100%)',
        borderTop: '1px solid rgba(0,255,65,0.08)',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 200,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                trackEvent(EVENTS.TAB_CHANGED, { tab: tab.id });
              }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 0',
                background: isActive ? 'rgba(0, 255, 65, 0.08)' : 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                minHeight: '44px',
                borderRadius: '4px',
                margin: '0 4px',
              }}
            >
              {/* Active top indicator */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '25%',
                  right: '25%',
                  height: '2px',
                  backgroundColor: '#00ff41',
                  boxShadow: '0 0 8px rgba(0,255,65,0.4)',
                }} />
              )}
              <span style={{
                fontSize: '26px',
                color: isActive ? '#00ff41' : '#666',
                transition: 'color 0.2s ease',
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '15px',
                fontWeight: isActive ? 800 : 500,
                color: isActive ? '#00ff41' : '#666',
                letterSpacing: '1px',
                transition: 'color 0.2s ease',
              }}>
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Gunny AI Toggle — left edge tab, hidden on Gunny tab */}
      {!showGunnyPanel && activeTab !== 'gunny' && (
        <button
          className="gunny-toggle-btn"
          onClick={() => setShowGunnyPanel(true)}
          title="Open Gunny AI"
        >
          <BoltIcon size={14} /> <span style={{ marginLeft: 4 }}>GUNNY</span>
        </button>
      )}

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
            {gunnyMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`gunny-message ${msg.role}`}
              >
                {msg.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="gunny-input-area">
            <input
              ref={inputRef}
              type="text"
              className="gunny-input"
              placeholder="Ask about what you see..."
              value={gunnyInput}
              onChange={(e) => setGunnyInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !gunnyLoading) {
                  sendGunnyMessage();
                }
              }}
              disabled={gunnyLoading}
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

      {/* Classification Bar */}
      <div className="classification-bar">
        GUNS UP — EYES ONLY
      </div>
    </div>
  );
};

export default AppShell;
