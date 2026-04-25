'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Operator, Workout, WorkoutBlock, ExerciseBlock, ConditioningBlock, DayTag, ViewMode, WorkoutResults, BlockResult, SetResult } from '@/lib/types';
import { EXERCISE_LIBRARY, getVideoUrl } from '@/data/exercises';
import { getLocalDateStr, toLocalDateStr } from '@/lib/dateUtils';
import BattlePlanRef from '@/components/BattlePlanRef';
import DailyBriefRef from '@/components/DailyBriefRef';
import { VoiceCommand } from '@/components/VoiceInput';
import { speak, unlockAudioContext, getPreferredVoice, setPreferredVoice, VOICE_OPTIONS, GunnyVoice } from '@/lib/tts';
import VideoModal from '@/components/VideoModal';
import WarmupMovementCard from '@/components/WarmupMovementCard';
import HRZoneGauge from '@/components/HRZoneGauge';
import WorkoutPTT from '@/components/WorkoutPTT';
import { parseMovementText } from '@/lib/parseMovementText';
import { buildSearchUrl } from '@/lib/videoUrl';
import { getAuthToken } from '@/lib/authClient';
import { onPrefillWeights } from '@/lib/workoutEvents';

// ═══ Tooltip Tag Pill Component ═══
interface TagPillData {
  icon: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  tooltip: string;
}

// Global singleton: only one tooltip open at a time
let globalCloseTooltip: (() => void) | null = null;

const TOOLTIP_WIDTH = 240;
const TOOLTIP_MARGIN = 8; // min px from viewport edge

const TagPill: React.FC<{ tag: TagPillData }> = ({ tag }) => {
  const [showTip, setShowTip] = useState(false);
  const [tipOffset, setTipOffset] = useState<{ left: string; arrowLeft: string }>({ left: '50%', arrowLeft: '50%' });
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  const open = () => {
    // Close any other open tooltip first
    if (globalCloseTooltip) globalCloseTooltip();

    // Calculate viewport-safe position
    if (pillRef.current) {
      const rect = pillRef.current.getBoundingClientRect();
      const pillCenterX = rect.left + rect.width / 2;
      const halfTip = TOOLTIP_WIDTH / 2;
      const vw = window.innerWidth;

      // Default: centered on pill
      let tipLeftPx = pillCenterX - halfTip;
      // Clamp to viewport
      if (tipLeftPx < TOOLTIP_MARGIN) tipLeftPx = TOOLTIP_MARGIN;
      if (tipLeftPx + TOOLTIP_WIDTH > vw - TOOLTIP_MARGIN) tipLeftPx = vw - TOOLTIP_MARGIN - TOOLTIP_WIDTH;

      // Convert to offset relative to the pill (since tooltip is position:absolute inside pill)
      const offsetFromPill = tipLeftPx - rect.left;
      // Arrow should point at pill center
      const arrowFromTip = pillCenterX - tipLeftPx;

      setTipOffset({
        left: `${offsetFromPill}px`,
        arrowLeft: `${arrowFromTip}px`,
      });
    }

    setShowTip(true);
    globalCloseTooltip = close;
  };

  const close = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setShowTip(false);
    if (globalCloseTooltip === close) globalCloseTooltip = null;
  };

  // Desktop: hover with small delay to open, small delay to close (prevents flicker)
  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    enterTimer.current = setTimeout(open, 180);
  };
  const handleMouseLeave = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    leaveTimer.current = setTimeout(close, 120);
  };

  // Mobile: tap to toggle, document listener to dismiss on tap-away
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (showTip) {
      close();
    } else {
      open();
    }
  };

  // Tap-away listener: close when user taps outside this pill
  useEffect(() => {
    if (!showTip) return;
    const handleDocTouch = (e: TouchEvent) => {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        close();
      }
    };
    // Use setTimeout to avoid catching the same tap that opened it
    const id = setTimeout(() => {
      document.addEventListener('touchstart', handleDocTouch, { passive: true });
    }, 50);
    return () => {
      clearTimeout(id);
      document.removeEventListener('touchstart', handleDocTouch);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTip]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
      if (globalCloseTooltip === close) globalCloseTooltip = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span
      ref={pillRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '3px',
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '12px',
        fontWeight: 600,
        background: showTip ? tag.border : tag.bg,
        color: tag.color,
        border: `1px solid ${tag.border}`,
        letterSpacing: '0.3px',
        cursor: 'help',
        transition: 'background 0.15s ease',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: '10px', opacity: 0.7 }}>{tag.icon}</span>
      {tag.label}
      {showTip && tag.tooltip && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: tipOffset.left,
          width: `${TOOLTIP_WIDTH}px`,
          padding: '10px 12px',
          background: 'rgba(10,10,10,0.97)',
          border: `1px solid ${tag.border}`,
          borderRadius: '6px',
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 12px ${tag.bg}`,
          zIndex: 10000,
          pointerEvents: 'none',
          animation: 'tooltipFadeIn 0.15s ease-out',
        }}>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '9px',
            fontWeight: 700,
            color: tag.color,
            letterSpacing: '1.5px',
            marginBottom: '6px',
            textTransform: 'uppercase',
          }}>
            {tag.label}
          </div>
          <div style={{
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '11px',
            color: '#ccc',
            lineHeight: '1.5',
            fontWeight: 400,
          }}>
            {tag.tooltip}
          </div>
          {/* Arrow — tracks pill center */}
          <div style={{
            position: 'absolute',
            bottom: '-5px',
            left: tipOffset.arrowLeft,
            transform: 'translateX(-50%) rotate(45deg)',
            width: '8px',
            height: '8px',
            background: 'rgba(10,10,10,0.97)',
            borderRight: `1px solid ${tag.border}`,
            borderBottom: `1px solid ${tag.border}`,
          }} />
        </div>
      )}
    </span>
  );
};

export interface WorkoutModeState {
  active: boolean;
  workoutTitle: string;
  exercises: { name: string; prescription: string; sets: { weight: number; reps: number; completed: boolean }[] }[];
}

interface PlannerProps {
  operator: Operator;
  onUpdateOperator: (updated: Operator) => void;
  onOpenGunny?: () => void;
  onSendGunnyMessage?: (text: string) => void;
  gunnyVoiceResponse?: string | null; // Gunny's spoken response — show as overlay
  onDismissGunnyResponse?: () => void;
  onWorkoutModeChange?: (state: WorkoutModeState) => void;
}

const Planner: React.FC<PlannerProps> = ({ operator, onUpdateOperator, onOpenGunny, onSendGunnyMessage, gunnyVoiceResponse, onDismissGunnyResponse, onWorkoutModeChange }) => {
  const { t, language } = useLanguage();
  // ============================================================================
  // STATE
  // ============================================================================
  const [isMobile, setIsMobile] = useState(false);
  const lastWidthRef = useRef(0);
  useEffect(() => {
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
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<Workout | null>(null);
  const [showDayTagEditor, setShowDayTagEditor] = useState<string | null>(null);
  const [tagNoteInput, setTagNoteInput] = useState('');
  const [selectedTagColor, setSelectedTagColor] = useState<'green' | 'amber' | 'red' | 'cyan'>('green');
  const [showDayMenu, setShowDayMenu] = useState<string | null>(null);
  const [showWorkoutBuilder, setShowWorkoutBuilder] = useState(false);

  // Drag and drop state
  const [dragDate, setDragDate] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Workout builder state
  const [builderData, setBuilderData] = useState<Workout>({
    id: '',
    date: '',
    title: '',
    notes: '',
    warmup: '',
    blocks: [],
    cooldown: '',
    completed: false,
  });

  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [showExerciseAutocomplete, setShowExerciseAutocomplete] = useState(false);
  const [autocompleteFor, setAutocompleteFor] = useState<number | null>(null);
  const [workoutMode, setWorkoutMode] = useState(false); // Workout execution mode
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restTimerMax, setRestTimerMax] = useState(0); // for progress ring calculation
  const [timerAlarm, setTimerAlarm] = useState(false); // visual pulse when timer completes
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const [workoutResults, setWorkoutResults] = useState<Record<string, { sets: { weight: number; reps: number; completed: boolean }[]; notes?: string }>>({});

  // Mission Complete overlay — shown after COMPLETE WORKOUT, before returning to day view
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [completionData, setCompletionData] = useState<{
    title: string;
    duration: number;       // minutes
    exerciseCount: number;
    totalVolume: number;    // lbs
    completionRate: number; // 0-100
    gunnyMessage: string;
  } | null>(null);

  // Voice command state
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<GunnyVoice>('onyx');
  const [showVoiceSelect, setShowVoiceSelect] = useState(false);

  // Load preferred voice on mount
  useEffect(() => {
    setSelectedVoice(getPreferredVoice());
  }, []);
  const voiceFeedbackTimer = useRef<NodeJS.Timeout | null>(null);

  const showVoiceFeedback = useCallback((msg: string) => {
    setVoiceFeedback(msg);
    if (voiceFeedbackTimer.current) clearTimeout(voiceFeedbackTimer.current);
    voiceFeedbackTimer.current = setTimeout(() => setVoiceFeedback(null), 3000);
  }, []);

  // Handle voice commands during workout mode
  const handleVoiceCommand = useCallback((command: VoiceCommand) => {
    if (!workoutMode) return;
    const dateStr = selectedDate || getLocalDateStr();
    const workout = operator.workouts?.[dateStr];
    if (!workout) return;

    const exerciseBlocks = workout.blocks.filter(b => b.type === 'exercise');

    if (command.type === 'log_set') {
      // Find current active exercise (first one with incomplete sets)
      let targetBlockId: string | null = null;
      let targetSetIdx = -1;

      for (const block of exerciseBlocks) {
        const blockData = workoutResults[block.id];
        if (!blockData) { targetBlockId = block.id; targetSetIdx = 0; break; }
        const nextIncomplete = blockData.sets.findIndex(s => !s.completed);
        if (nextIncomplete >= 0) {
          targetBlockId = block.id;
          targetSetIdx = nextIncomplete;
          break;
        }
      }

      if (targetBlockId && targetSetIdx >= 0) {
        const weight = command.weight || 0;
        const reps = command.reps || 0;
        setWorkoutResults(prev => {
          const blockData = prev[targetBlockId] ? { ...prev[targetBlockId] } : { sets: [] as { weight: number; reps: number; completed: boolean }[] };
          const sets = [...(blockData.sets || [])];
          // Ensure we have enough sets
          while (sets.length <= targetSetIdx) {
            sets.push({ weight: 0, reps: 0, completed: false });
          }
          sets[targetSetIdx] = { weight, reps, completed: true };
          // Auto-fill weight for remaining sets if this was set 1
          if (targetSetIdx === 0 && weight > 0) {
            for (let i = 1; i < sets.length; i++) {
              if (sets[i].weight === 0) sets[i] = { ...sets[i], weight };
            }
          }
          return { ...prev, [targetBlockId]: { sets } };
        });

        const block = exerciseBlocks.find(b => b.id === targetBlockId);
        const exName = (block as ExerciseBlock)?.exerciseName || 'Exercise';
        if (weight && reps) {
          showVoiceFeedback(`LOGGED: ${exName} — ${weight}lbs x ${reps}`);
          speak(`Logged. ${weight} pounds, ${reps} reps.`);
        } else {
          showVoiceFeedback(`SET ${targetSetIdx + 1} COMPLETE`);
          speak('Set logged.');
        }
      }
    } else if (command.type === 'start_timer') {
      const secs = command.duration || 90;
      setRestTimer(secs);
      setRestRunning(true);
      showVoiceFeedback(`TIMER: ${secs}s`);
      speak(`Rest timer. ${secs} seconds.`);
    } else if (command.type === 'next_exercise') {
      // Find next exercise with incomplete sets
      for (let i = 0; i < exerciseBlocks.length; i++) {
        const blockData = workoutResults[exerciseBlocks[i].id];
        if (!blockData || blockData.sets.some(s => !s.completed)) {
          setActiveBlockIdx(i);
          const exName = (exerciseBlocks[i] as ExerciseBlock)?.exerciseName || 'Next exercise';
          showVoiceFeedback(`NEXT: ${exName}`);
          speak(`Moving to ${exName}.`);
          break;
        }
      }
    } else if (command.type === 'complete_workout') {
      showVoiceFeedback('COMPLETING WORKOUT');
      speak('Workout complete. Good work.');
      // Trigger save — same as the COMPLETE WORKOUT button
      // Will be handled by the existing save handler
    } else if (command.type === 'ask_gunny') {
      // Open Gunny with the voice text
      if (onOpenGunny) onOpenGunny();
    }
  }, [workoutMode, selectedDate, operator.workouts, workoutResults, showVoiceFeedback, onOpenGunny]);

  // HR Zone Tracking state
  const [currentHR, setCurrentHR] = useState<number | null>(null);
  const [targetZone, setTargetZone] = useState<number>(3); // default Zone 3
  const [hrSource, setHrSource] = useState<'wearable' | 'manual' | 'none'>('none');
  const [showHrPanel, setShowHrPanel] = useState(true);
  // ═══ Task 20/21: WARMUP + COOLDOWN collapsible + in-app video modal ═══
  const [videoModalState, setVideoModalState] = useState<{ url: string; title: string } | null>(null);
  const [warmupExpanded, setWarmupExpanded] = useState(true);
  const [cooldownExpanded, setCooldownExpanded] = useState(false);
  const openExerciseVideo = useCallback((exerciseName: string, curatedUrl?: string | null) => {
    const url = curatedUrl || getVideoUrl(exerciseName) || buildSearchUrl(exerciseName);
    setVideoModalState({ url, title: exerciseName });
  }, []);
  const [hrHistory, setHrHistory] = useState<{ hr: number; time: number }[]>([]);
  const hrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // HR Zone definitions based on max HR (220 - age)
  const maxHR = 220 - (operator.profile?.age || 30);
  const HR_ZONES = [
    { zone: 1, name: 'RECOVERY', min: Math.round(maxHR * 0.50), max: Math.round(maxHR * 0.60), color: '#00ff41' },
    { zone: 2, name: 'FAT BURN', min: Math.round(maxHR * 0.60), max: Math.round(maxHR * 0.70), color: '#00ff41' },
    { zone: 3, name: 'CARDIO', min: Math.round(maxHR * 0.70), max: Math.round(maxHR * 0.80), color: '#ffb800' },
    { zone: 4, name: 'THRESHOLD', min: Math.round(maxHR * 0.80), max: Math.round(maxHR * 0.90), color: '#ff6600' },
    { zone: 5, name: 'MAX EFFORT', min: Math.round(maxHR * 0.90), max: maxHR, color: '#ff4444' },
  ];

  const getCurrentZone = (hr: number) => {
    for (let i = HR_ZONES.length - 1; i >= 0; i--) {
      if (hr >= HR_ZONES[i].min) return HR_ZONES[i];
    }
    return HR_ZONES[0];
  };

  // Broadcast workout mode state to parent (for Gunny Assist context)
  useEffect(() => {
    if (!onWorkoutModeChange) return;
    if (!workoutMode) {
      onWorkoutModeChange({ active: false, workoutTitle: '', exercises: [] });
      return;
    }
    const dateStr = selectedDate || getLocalDateStr();
    const workout = operator.workouts?.[dateStr];
    if (!workout) return;
    const exercises = (workout.blocks || [])
      .filter((b: WorkoutBlock) => b.type === 'exercise')
      .map((b) => {
        const ex = b as { id: string; exerciseName?: string; prescription?: string };
        const blockData = workoutResults[ex.id] || { sets: [] };
        return {
          name: ex.exerciseName || '',
          prescription: ex.prescription || '',
          sets: blockData.sets.map(s => ({ weight: s.weight, reps: s.reps, completed: s.completed })),
        };
      });
    onWorkoutModeChange({ active: true, workoutTitle: workout.title || '', exercises });
  }, [workoutMode, workoutResults, selectedDate, onWorkoutModeChange]);

  // Poll wearable for HR data during workout mode.
  //
  // Architecture (replaces the old "POST /sync every 30s" loop, which
  // hammered Vital's API and wrote to Postgres on every tick):
  //   1. On workout start: kick a single POST /api/wearables/sync to
  //      refresh the cached syncData blob from Vital.
  //   2. Then poll GET /api/wearables/latest every 10s — that endpoint
  //      reads the cached blob from the DB. Fast, no upstream calls.
  //   3. The wearable webhook (/api/wearables/webhook) updates that
  //      same syncData when Vital pushes new data, so polling latest
  //      picks up live HR as soon as it arrives.
  //
  // Net effect: HR feels live (10s update cadence visually), Vital
  // sees one call per workout instead of ~120, and the user's
  // wearables_connection row sees one write per workout instead of
  // dozens of overlapping ones.
  useEffect(() => {
    if (!workoutMode) {
      if (hrPollRef.current) clearInterval(hrPollRef.current);
      setHrSource('none');
      setCurrentHR(null);
      setHrHistory([]);
      return;
    }

    let cancelled = false;

    // One-shot kickoff sync to refresh the server-cached snapshot.
    // Errors are swallowed — if the user has no wearable, the latest
    // poll below just returns null and the manual entry UI takes over.
    const kickoffSync = async () => {
      try {
        await fetch('/api/wearables/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({ operatorId: operator.id }),
        });
      } catch {
        // No wearable / not configured — fine.
      }
    };

    const fetchLatest = async () => {
      try {
        const res = await fetch(
          `/api/wearables/latest?operatorId=${encodeURIComponent(operator.id)}`,
          {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` },
          }
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const hr = data?.currentHR;
        if (typeof hr === 'number' && hr > 0) {
          setCurrentHR(hr);
          setHrSource('wearable');
          setHrHistory(prev => [...prev.slice(-60), { hr, time: Date.now() }]);
        }
      } catch {
        // Network blip — try again on next tick.
      }
    };

    // Kick the sync, then start the poll. The kickoff is fire-and-forget
    // so the first latest() call happens immediately (cached data), and
    // the next tick (10s later) catches the freshly-synced data.
    kickoffSync();
    fetchLatest();
    hrPollRef.current = setInterval(fetchLatest, 10000); // 10s — feels live, cheap on the server

    return () => {
      cancelled = true;
      if (hrPollRef.current) clearInterval(hrPollRef.current);
    };
  }, [workoutMode, operator.id]);

  // Keyboard shortcuts for workout builder
  useEffect(() => {
    if (!showWorkoutBuilder || workoutMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter = add exercise block
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAddExerciseBlock();
      }
      // Cmd+Shift+Enter = add conditioning block
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        handleAddConditioningBlock();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showWorkoutBuilder, workoutMode, builderData.blocks.length]);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDateForDisplay = (dateStr: string): string => {
    const date = parseDate(dateStr);
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const getWeekDates = (date: Date): Date[] => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));

    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      week.push(date);
    }
    return week;
  };

  const getMonthDates = (date: Date): Date[][] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const dayOfWeek = firstDay.getDay();
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const grid: Date[][] = [];
    const current = new Date(startDate);

    for (let week = 0; week < 6; week++) {
      const weekDates: Date[] = [];
      for (let day = 0; day < 7; day++) {
        weekDates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      grid.push(weekDates);
    }

    return grid;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
  };

  const getWorkoutForDate = (date: Date | string): Workout | undefined => {
    const dateKey = typeof date === 'string' ? date : formatDate(date);
    return operator.workouts[dateKey];
  };

  const getDayTag = (dateStr: string): DayTag | undefined => {
    return operator.dayTags?.[dateStr];
  };

  const fuzzyMatch = (query: string, text: string): boolean => {
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    let qIdx = 0;
    for (let i = 0; i < t.length && qIdx < q.length; i++) {
      if (t[i] === q[qIdx]) qIdx++;
    }
    return qIdx === q.length;
  };

  const getFilteredExercises = (query: string) => {
    if (!query.trim()) return [];
    return EXERCISE_LIBRARY.filter(ex => fuzzyMatch(query, ex.name)).slice(0, 8);
  };

  const getBlockLabels = (blocks: WorkoutBlock[]): string[] => {
    const labels: string[] = [];
    let currentLetter = 'A';
    let supersetCount = 0;

    for (let i = 0; i < blocks.length; i++) {
      const isLinkedToPrevious = i > 0 && blocks[i - 1].isLinkedToNext;

      if (!isLinkedToPrevious) {
        labels.push(currentLetter);
        supersetCount = 0;
        currentLetter = String.fromCharCode(currentLetter.charCodeAt(0) + 1);
      } else {
        supersetCount++;
        labels.push(`${labels[i - 1].charAt(0)}${supersetCount + 1}`);
      }
    }

    return labels;
  };

  // ═══ Prescription Tag Type ═══
  interface PrescriptionTag {
    icon: string;
    label: string;
    color: string;
    bg: string;
    border: string;
    tooltip: string;
  }

  // ═══ RPE Explanation Helper ═══
  const getRpeExplanation = (rpe: string): string => {
    const val = parseInt(rpe.split('-')[0]);
    const rpeDescriptions: Record<number, string> = {
      5: 'Easy effort — could do 5+ more reps. Good for warmups and deload work.',
      6: 'Moderate effort — about 4 reps left in the tank. Light working weight.',
      7: 'Challenging — roughly 3 reps left in reserve. Solid working sets.',
      8: 'Hard — about 2 reps left before failure. Heavy working sets.',
      9: 'Very hard — only 1 rep left in the tank. Near-max effort.',
      10: 'Max effort — absolute failure, no reps left. Use sparingly.',
    };
    return rpeDescriptions[val] || `Intensity level ${rpe}/10 — higher = closer to failure.`;
  };

  // ═══ Tempo Explanation Helper ═══
  const getTempoExplanation = (tempo: string): string => {
    const parts = tempo.split('-').map(Number);
    if (parts.length === 4) {
      const labels = ['Eccentric (lowering)', 'Pause at bottom', 'Concentric (lifting)', 'Pause at top'];
      const details = parts.map((sec, i) => `${sec}s ${labels[i]}`).join(' → ');
      const totalTUT = parts.reduce((a, b) => a + b, 0);
      return `${details}. Total time under tension: ${totalTUT}s per rep.`;
    }
    return `Tempo controls rep speed — each number is seconds for each phase of the lift.`;
  };

  // ═══ Smart Prescription Parser ═══
  const parsePrescription = (rx: string): PrescriptionTag[] => {
    if (!rx || !rx.trim()) return [];
    const tags: PrescriptionTag[] = [];
    const str = rx.trim();

    // Sets x Reps pattern: "4x8-10", "3x20", "4x12-15 each arm"
    const setsMatch = str.match(/(\d+)\s*x\s*(\d+(?:-\d+)?(?:\s*(?:each\s*(?:arm|side|leg)?))?)/i);
    if (setsMatch) {
      const parts = setsMatch[0].trim().match(/(\d+)\s*x\s*(\d+(?:-\d+)?)/i);
      const sets = parts ? parts[1] : '?';
      const reps = parts ? parts[2] : '?';
      tags.push({ icon: '◆', label: setsMatch[0].trim(), color: '#00ff41', bg: 'rgba(0,255,65,0.08)', border: 'rgba(0,255,65,0.2)',
        tooltip: `${sets} sets of ${reps} reps. Complete all sets with the prescribed weight before moving to the next exercise.` });
    }

    // "Work up to" pattern
    const workUpMatch = str.match(/work\s*up\s*to\s+([^,@]+)/i);
    if (workUpMatch) {
      tags.push({ icon: '▲', label: workUpMatch[0].trim(), color: '#00ff41', bg: 'rgba(0,255,65,0.08)', border: 'rgba(0,255,65,0.2)',
        tooltip: 'Ramp up weight each set until you hit the target. Warm-up sets don\'t count toward working sets.' });
    }

    // Sets standalone: "3-5 sets"
    const setsStandalone = str.match(/(\d+(?:-\d+)?)\s*sets/i);
    if (setsStandalone && !setsMatch) {
      tags.push({ icon: '◆', label: `${setsStandalone[1]} sets`, color: '#00ff41', bg: 'rgba(0,255,65,0.08)', border: 'rgba(0,255,65,0.2)',
        tooltip: `Perform ${setsStandalone[1]} working sets. Adjust based on how you feel — stay in the range.` });
    }

    // RPE
    const rpeMatch = str.match(/(?:@\s*)?RPE\s*(\d+(?:-\d+)?)/i);
    if (rpeMatch) {
      tags.push({ icon: '⚡', label: `RPE ${rpeMatch[1]}`, color: '#ff6b6b', bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.2)',
        tooltip: `Rate of Perceived Exertion — ${getRpeExplanation(rpeMatch[1])}` });
    }

    // Tempo
    const tempoMatch = str.match(/tempo\s*([\d]-[\d]-[\d]-[\d])/i);
    if (tempoMatch) {
      tags.push({ icon: '◷', label: `Tempo ${tempoMatch[1]}`, color: '#ba68c8', bg: 'rgba(186,104,200,0.08)', border: 'rgba(186,104,200,0.2)',
        tooltip: getTempoExplanation(tempoMatch[1]) });
    }

    // Rest
    const restMatch = str.match(/rest\s*([\d:]+\s*(?:min|sec|s)?)/i);
    if (restMatch) {
      tags.push({ icon: '⏱', label: `Rest ${restMatch[1]}`, color: '#4fc3f7', bg: 'rgba(79,195,247,0.08)', border: 'rgba(79,195,247,0.2)',
        tooltip: `Rest ${restMatch[1]} between sets. Stick to this — rest periods control fatigue accumulation and training stimulus.` });
    }

    // RIR
    const rirMatch = str.match(/(\d+)\s*RIR/i);
    if (rirMatch) {
      const rir = parseInt(rirMatch[1]);
      const rirDesc = rir === 0 ? 'Go to absolute failure — no reps left.' :
        rir === 1 ? 'Stop with 1 rep left before failure. Very high intensity.' :
        rir === 2 ? 'Stop with 2 reps left. Hard but sustainable.' :
        `Stop with ${rir} reps left before failure.`;
      tags.push({ icon: '◇', label: `${rirMatch[1]} RIR`, color: '#ffb800', bg: 'rgba(255,184,0,0.08)', border: 'rgba(255,184,0,0.2)',
        tooltip: `Reps In Reserve — ${rirDesc} Similar to RPE but counts remaining reps instead.` });
    }

    // % / percentage
    const pctMatch = str.match(/(\d+(?:-\d+)?)\s*%/);
    if (pctMatch) {
      tags.push({ icon: '%', label: `${pctMatch[1]}%`, color: '#ffb800', bg: 'rgba(255,184,0,0.08)', border: 'rgba(255,184,0,0.2)',
        tooltip: `${pctMatch[1]}% of your 1-rep max (1RM). Calculate from your PR board or estimated max.` });
    }

    // "each arm/side/leg" standalone
    const eachMatch = str.match(/each\s*(arm|side|leg)/i);
    if (eachMatch && !setsMatch?.[0]?.toLowerCase().includes('each')) {
      tags.push({ icon: '↔', label: `each ${eachMatch[1]}`, color: '#aaa', bg: 'rgba(170,170,170,0.08)', border: 'rgba(170,170,170,0.2)',
        tooltip: `Unilateral — perform the prescribed reps on each ${eachMatch[1]} separately. Total volume is doubled.` });
    }

    // Fallback
    if (tags.length === 0) {
      tags.push({ icon: '•', label: str, color: '#aaa', bg: 'rgba(170,170,170,0.06)', border: 'rgba(170,170,170,0.15)', tooltip: str });
    }

    return tags;
  };

  const findLastExerciseLog = (exerciseName: string): { date: string; prescription: string } | null => {
    const entries = Object.entries(operator.workouts).sort(([dateA], [dateB]) => dateB.localeCompare(dateA));

    for (const [date, workout] of entries) {
      if (date >= (selectedDate || formatDate(new Date()))) continue;

      for (const block of workout.blocks) {
        if (block.type === 'exercise' && block.exerciseName.toLowerCase() === exerciseName.toLowerCase()) {
          return { date, prescription: block.prescription };
        }
      }
    }

    return null;
  };

  const getTagColor = (color: string): string => {
    switch (color) {
      case 'green':
        return '#00ff41';
      case 'amber':
        return '#ffb800';
      case 'red':
        return '#ff4444';
      case 'cyan':
        return '#00ff41';
      default:
        return '#00ff41';
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedDate(null);
    setShowWorkoutBuilder(false);
  };

  const handleNavigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNavigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleAddWorkout = (dateStr: string) => {
    setSelectedDate(dateStr);
    setBuilderData({
      id: generateId(),
      date: dateStr,
      title: '',
      notes: '',
      warmup: '',
      primer: '',
      blocks: [],
      cooldown: '',
      completed: false,
    });
    setShowWorkoutBuilder(true);
    setShowDayMenu(null);
  };

  const handleEditWorkout = (workout: Workout) => {
    setSelectedDate(workout.date);
    setBuilderData(JSON.parse(JSON.stringify(workout)));
    setShowWorkoutBuilder(true);
    setShowDayMenu(null);
  };

  const handleSaveWorkout = () => {
    if (!selectedDate || !builderData.title.trim()) {
      alert('Please enter a workout title');
      return;
    }

    // Auto-populate video URLs for exercises that don't have one
    const blocksWithVideos = builderData.blocks.map(block => {
      if (block.type === 'exercise' && !block.videoUrl && block.exerciseName) {
        const videoUrl = getVideoUrl(block.exerciseName);
        if (videoUrl) return { ...block, videoUrl };
      }
      return block;
    });

    const workoutToSave = { ...builderData, blocks: blocksWithVideos };
    const updated = { ...operator };
    updated.workouts[selectedDate] = workoutToSave;
    onUpdateOperator(updated);
    setShowWorkoutBuilder(false);
    setWorkoutMode(false);
    /* activeListening removed — use Radio tab */
    // Stay on day view so user can review the saved workout — don't clear selectedDate
  };

  const handleCancelWorkout = () => {
    setShowWorkoutBuilder(false);
    setSelectedDate(null);
  };

  const handleAddExerciseBlock = () => {
    const newBlock: ExerciseBlock = {
      type: 'exercise',
      id: generateId(),
      sortOrder: builderData.blocks.length,
      exerciseName: '',
      prescription: '',
      isLinkedToNext: false,
    };
    setBuilderData({
      ...builderData,
      blocks: [...builderData.blocks, newBlock],
    });
  };

  const handleAddConditioningBlock = () => {
    const newBlock: ConditioningBlock = {
      type: 'conditioning',
      id: generateId(),
      sortOrder: builderData.blocks.length,
      format: '',
      description: '',
      isLinkedToNext: false,
    };
    setBuilderData({
      ...builderData,
      blocks: [...builderData.blocks, newBlock],
    });
  };

  const handleUpdateBlock = (index: number, updates: Record<string, unknown>) => {
    const newBlocks = [...builderData.blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates } as WorkoutBlock;
    setBuilderData({
      ...builderData,
      blocks: newBlocks,
    });
  };

  const handleDeleteBlock = (index: number) => {
    const newBlocks = builderData.blocks.filter((_, i) => i !== index);
    setBuilderData({
      ...builderData,
      blocks: newBlocks,
    });
  };

  const handleCopyWorkout = (workout: Workout) => {
    setClipboard(workout);
    setShowDayMenu(null);
  };

  const handlePasteWorkout = (dateStr: string) => {
    if (!clipboard) return;

    const newWorkout: Workout = {
      ...JSON.parse(JSON.stringify(clipboard)),
      id: generateId(),
      date: dateStr,
      completed: false,
    };

    const updated = { ...operator };
    updated.workouts[dateStr] = newWorkout;
    onUpdateOperator(updated);
    setShowDayMenu(null);
  };

  const handleSetRestDay = (dateStr: string) => {
    const updated = { ...operator };
    if (updated.workouts[dateStr]) {
      delete updated.workouts[dateStr];
    }
    updated.dayTags = updated.dayTags || {};
    updated.dayTags[dateStr] = { color: 'cyan', note: 'Rest Day' };
    onUpdateOperator(updated);
    setShowDayMenu(null);
  };

  const handleDeleteWorkout = (dateStr: string) => {
    if (!confirm('Delete this workout?')) return;

    const updated = { ...operator };
    if (updated.workouts[dateStr]) {
      delete updated.workouts[dateStr];
    }
    onUpdateOperator(updated);
    setShowWorkoutBuilder(false);
    setSelectedDate(null);
  };

  const handleMoveWorkout = (fromDate: string, toDate: string) => {
    if (fromDate === toDate) return;
    const workout = operator.workouts?.[fromDate];
    if (!workout) return;
    const updated = { ...operator };
    updated.workouts = { ...updated.workouts };
    // Move workout to new date
    updated.workouts[toDate] = { ...workout, date: toDate };
    delete updated.workouts[fromDate];
    // Also move day tags if they exist
    if (operator.dayTags?.[fromDate]) {
      updated.dayTags = { ...updated.dayTags };
      updated.dayTags[toDate] = operator.dayTags[fromDate];
      delete updated.dayTags[fromDate];
    }
    onUpdateOperator(updated);
  };

  const handleSaveDayTag = (dateStr: string) => {
    const updated = { ...operator };
    updated.dayTags = updated.dayTags || {};
    updated.dayTags[dateStr] = {
      color: selectedTagColor,
      note: tagNoteInput,
    };
    onUpdateOperator(updated);
    setShowDayTagEditor(null);
    setTagNoteInput('');
  };

  const handleExerciseSelect = (exerciseName: string, blockIndex: number) => {
    handleUpdateBlock(blockIndex, { exerciseName });
    setShowExerciseAutocomplete(false);
    setExerciseSearchQuery('');
    setAutocompleteFor(null);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(operator, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${operator.callsign}_workouts_${formatDate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // RENDER MONTH VIEW
  // ============================================================================

  const renderMonthView = () => {
    const monthDates = getMonthDates(currentDate);
    const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long' });
    const yearLabel = currentDate.getFullYear();

    return (
      <div className="stack-3">
        {/* Month header — handoff "April **2026**" pattern: month
            in white display type + year as green-glow <em>. */}
        <header style={{ marginBottom: 4 }}>
          <div className="t-mono-sm" style={{ marginBottom: 6, color: 'var(--text-tertiary)' }}>
            <b style={{ color: 'var(--green)', fontWeight: 'normal' }}>//</b> Planner&nbsp;
            <span style={{ color: 'var(--text-dim)' }}>/</span>&nbsp;Month
          </div>
          <h2 className="t-display-xl" style={{ fontSize: 22, textAlign: 'center', letterSpacing: 2 }}>
            {monthLabel}{' '}
            <em style={{ fontStyle: 'normal', color: 'var(--green)', textShadow: '0 0 12px rgba(0,255,65,0.35)' }}>
              {yearLabel}
            </em>
          </h2>
        </header>

        {/* Day-of-week header row — uses .t-label sizing for the
            stenciled feel and tertiary text token for color. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: isMobile ? 2 : 4,
            marginBottom: isMobile ? 2 : 4,
          }}
        >
          {(isMobile ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']).map((day, i) => (
            <div
              key={`${day}-${i}`}
              className="t-label"
              style={{
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                padding: isMobile ? 4 : 8,
                fontSize: isMobile ? 9 : 10,
                letterSpacing: isMobile ? 1 : 2,
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid — each cell uses design-system tokens for
            border + bg. Today gets the strong green border + 6%
            green fill per the handoff mock. Drag-over uses dashed
            green to signal a valid drop target. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 2 : 4 }}>
          {monthDates.map(week =>
            week.map(date => {
              const dateStr = formatDate(date);
              const workout = getWorkoutForDate(dateStr);
              const tag = getDayTag(dateStr);
              const isCurrentDay = isToday(date);
              const isInMonth = isCurrentMonth(date);

              const cellBg = dragOverDate === dateStr
                ? 'rgba(0,255,65,0.1)'
                : isCurrentDay
                  ? 'rgba(0,255,65,0.06)'
                  : 'rgba(5,5,5,0.6)';

              const cellBorder = dragOverDate === dateStr
                ? '2px dashed var(--green)'
                : isCurrentDay
                  ? '1px solid var(--border-green-strong)'
                  : '1px solid var(--border-green-soft)';

              return (
                <div
                  key={dateStr}
                  onClick={() => { setSelectedDate(dateStr); setViewMode('day'); }}
                  onContextMenu={e => { e.preventDefault(); setShowDayMenu(dateStr); }}
                  onDragOver={e => { e.preventDefault(); setDragOverDate(dateStr); }}
                  onDragEnter={e => { e.preventDefault(); setDragOverDate(dateStr); }}
                  onDragLeave={() => { if (dragOverDate === dateStr) setDragOverDate(null); }}
                  onDrop={e => {
                    e.preventDefault();
                    if (dragDate && dragDate !== dateStr) {
                      handleMoveWorkout(dragDate, dateStr);
                    }
                    setDragDate(null);
                    setDragOverDate(null);
                  }}
                  style={{
                    minHeight: isMobile ? 60 : 90,
                    padding: isMobile ? 4 : 8,
                    backgroundColor: cellBg,
                    border: cellBorder,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    overflow: 'hidden',
                  }}
                >
                  {/* Today left accent stripe — kept as a separate
                      pseudo-rectangle so the cell border can swap to
                      dashed during drag without losing the marker. */}
                  {isCurrentDay && (
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: 'var(--green)',
                        boxShadow: '0 0 6px var(--green)',
                      }}
                    />
                  )}

                  {/* Date number — mono per handoff. Today glows green;
                      out-of-month dates fade to text-dim. */}
                  <div
                    className="t-mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: isCurrentDay
                        ? 'var(--green)'
                        : isInMonth
                          ? 'var(--text-secondary)'
                          : 'var(--text-dim)',
                      marginBottom: 6,
                    }}
                  >
                    {date.getDate()}
                  </div>

                  {workout && (
                    <div
                      draggable={true}
                      onDragStart={e => {
                        setDragDate(dateStr);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => { setDragDate(null); setDragOverDate(null); }}
                      style={{
                        fontFamily: 'var(--body)',
                        fontSize: 12,
                        color: 'var(--green)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: 4,
                        paddingLeft: 6,
                        borderLeft: '1px solid var(--border-green-strong)',
                        cursor: dragDate === dateStr ? 'grabbing' : 'grab',
                        opacity: dragDate === dateStr ? 0.6 : 1,
                        transition: 'opacity 0.2s ease',
                      }}
                    >
                      {workout.title}
                    </div>
                  )}

                  {tag && (
                    <span
                      className="chip"
                      style={{
                        padding: '1px 5px',
                        fontSize: 9,
                        background: `${getTagColor(tag.color)}10`,
                        borderColor: `${getTagColor(tag.color)}40`,
                        color: getTagColor(tag.color),
                      }}
                    >
                      {tag.note.substring(0, 10)}
                    </span>
                  )}

                  {showDayMenu === dateStr && (
                    <DayMenu dateStr={dateStr} workout={workout} onClose={() => setShowDayMenu(null)} />
                  )}
                </div>
              );
            })
          )}
        </div>

        <div
          className="t-mono-sm"
          style={{ textAlign: 'center', marginTop: 4, color: 'var(--text-dim)' }}
        >
          Drag workouts to move between dates
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER WEEK VIEW
  // ============================================================================

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate);
    const weekStart = formatDateForDisplay(formatDate(weekDates[0]));
    const weekEnd = formatDateForDisplay(formatDate(weekDates[6]));

    return (
      <div className="stack-3">
        {/* Week header — same crumb + green-em treatment as Day/Month
            so all three views share a screen-head pattern. */}
        <header style={{ marginBottom: 4 }}>
          <div className="t-mono-sm" style={{ marginBottom: 6, color: 'var(--text-tertiary)' }}>
            <b style={{ color: 'var(--green)', fontWeight: 'normal' }}>//</b> Planner&nbsp;
            <span style={{ color: 'var(--text-dim)' }}>/</span>&nbsp;Week
          </div>
          <h2 className="t-display-xl" style={{ fontSize: 22, textAlign: 'center', letterSpacing: 2 }}>
            <em style={{ fontStyle: 'normal', color: 'var(--green)', textShadow: '0 0 12px rgba(0,255,65,0.35)' }}>
              {weekStart}
            </em>{' '}
            — {weekEnd}
          </h2>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {weekDates.map(date => {
            const dateStr = formatDate(date);
            const workout = getWorkoutForDate(dateStr);
            const tag = getDayTag(dateStr);
            const isCurrentDay = isToday(date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

            return (
              <div
                key={dateStr}
                onClick={() => {
                  setSelectedDate(dateStr);
                  setViewMode('day');
                }}
                className="ds-card"
                style={{
                  minHeight: 200,
                  padding: 12,
                  cursor: 'pointer',
                  // Today gets the elevated green wash + strong border
                  // so it stands out from the rest of the week strip.
                  background: isCurrentDay
                    ? 'linear-gradient(180deg, rgba(0,255,65,0.06), transparent)'
                    : undefined,
                  borderColor: isCurrentDay ? 'var(--border-green-strong)' : undefined,
                }}
              >
                <div className="t-display-m" style={{ marginBottom: 8, fontSize: 12 }}>
                  {dayName}{' '}
                  <span
                    className="t-mono"
                    style={{
                      color: isCurrentDay ? 'var(--green)' : 'var(--text-tertiary)',
                      fontWeight: 700,
                    }}
                  >
                    {date.getDate()}
                  </span>
                </div>

                {workout ? (
                  <div>
                    <div className="t-display-m" style={{ color: 'var(--green)', fontSize: 12, marginBottom: 4 }}>
                      {workout.title}
                    </div>
                    <div className="t-mono-sm">
                      {workout.blocks.length} blocks
                    </div>
                  </div>
                ) : tag ? (
                  <div className="t-body-sm" style={{ color: getTagColor(tag.color) }}>
                    {tag.note}
                  </div>
                ) : (
                  <div className="t-mono-sm" style={{ color: 'var(--text-dim)' }}>No workout</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // WORKOUT MODE — Simplified execution view with rest timer + result logging
  // ============================================================================
  // Play a LOUD multi-tone completion alarm — 3 ascending tones, repeated twice
  const playCompletionAlarm = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const tones = [660, 880, 1100]; // Hz — ascending urgency
      const toneDur = 0.18;
      const gap = 0.06;
      const pattern = [...tones, ...tones]; // repeat twice for extra attention
      pattern.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * (toneDur + gap);
        // envelope: quick attack, sustain at 0.8, short release — prevents click
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.8, start + 0.01);
        gain.gain.setValueAtTime(0.8, start + toneDur - 0.02);
        gain.gain.linearRampToValueAtTime(0, start + toneDur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + toneDur);
      });
    } catch { /* AudioContext unavailable — HTML5 Audio fallback below picks up */ }
    // Fallback HTML5 Audio (for browsers where AudioContext fails silently)
    try {
      if (fallbackAudioRef.current) {
        fallbackAudioRef.current.currentTime = 0;
        fallbackAudioRef.current.volume = 1.0;
        void fallbackAudioRef.current.play();
      }
    } catch { /* audio blocked by autoplay policy — vibration fallback below */ }
    // Vibration pattern: long-short-long-short-long (attention-grabbing)
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([400, 120, 400, 120, 600]);
      }
    } catch { /* vibrate API unavailable — silent */ }
  };

  // Rest timer countdown
  useEffect(() => {
    if (!restRunning || restTimer <= 0) {
      if (restTimer <= 0 && restRunning) {
        setRestRunning(false);
        playCompletionAlarm();
        // Visual alarm pulse for 5 seconds
        setTimerAlarm(true);
        setTimeout(() => setTimerAlarm(false), 5000);
        speak('Time. Next set.');
      }
      return;
    }
    // Louder beep at 3, 2, 1
    if (restTimer <= 3 && restTimer > 0) {
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 520;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.01);
        gain.gain.setValueAtTime(0.6, ctx.currentTime + 0.22);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } catch { /* AudioContext unavailable — skip countdown beep */ }
      // Short vibration tick on final countdown (if supported)
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(80);
        }
      } catch { /* vibrate API unavailable */ }
    }
    const interval = setInterval(() => setRestTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [restRunning, restTimer]);

  // Wake lock — keep screen awake during rest timer and workout mode
  useEffect(() => {
    const shouldLock = workoutMode || restRunning;
    const acquire = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } };
        if (nav.wakeLock && !wakeLockRef.current) {
          wakeLockRef.current = await nav.wakeLock.request('screen');
          wakeLockRef.current.addEventListener('release', () => {
            wakeLockRef.current = null;
          });
        }
      } catch { /* wakeLock API unsupported / denied — screen may sleep during rest */ }
    };
    const release = async () => {
      try {
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        }
      } catch { /* already released or API unavailable */ }
    };
    if (shouldLock) {
      void acquire();
    } else {
      void release();
    }
    return () => { void release(); };
  }, [workoutMode, restRunning]);

  // Initialize workout results when entering workout mode
  useEffect(() => {
    if (!workoutMode) return;
    const dateStr = selectedDate || formatDate(currentDate);
    const workout = getWorkoutForDate(dateStr);
    if (!workout) return;
    if (Object.keys(workoutResults).length === 0) {
      const initial = workout.results?.blockResults
        ? Object.fromEntries(Object.entries(workout.results.blockResults).map(([k, v]) => [k, { sets: v.sets.map(s => ({ weight: s.weight || 0, reps: s.reps || 0, completed: s.completed })), notes: (v as { sets: unknown[]; notes?: string }).notes }]))
        : Object.fromEntries(workout.blocks.map(b => [b.id, { sets: [{ weight: 0, reps: 0, completed: false }], notes: '' }]));
      setWorkoutResults(initial);
    }
  }, [workoutMode, selectedDate]);

  // Merge external workout block changes (from Gunny modifications) into workoutResults
  useEffect(() => {
    if (!workoutMode) return;
    const dateStr = selectedDate || formatDate(currentDate);
    const workout = getWorkoutForDate(dateStr);
    if (!workout) return;
    const currentBlockIds = Object.keys(workoutResults);
    if (currentBlockIds.length === 0) return;
    const newBlockIds = workout.blocks.map(b => b.id);
    const hasChanges = newBlockIds.some(id => !currentBlockIds.includes(id))
                    || currentBlockIds.some(id => !newBlockIds.includes(id));
    if (hasChanges) {
      const merged: typeof workoutResults = {};
      workout.blocks.forEach(b => {
        merged[b.id] = workoutResults[b.id] || { sets: [{ weight: 0, reps: 0, completed: false }], notes: '' };
      });
      setWorkoutResults(merged);
    }
  }, [operator.workouts, selectedDate, workoutMode]);

  // Live prefill-weights from Gunny chat. When the user asks Gunny "fill in my
  // weights from last week," Gunny emits a prefill_weights workout-modification;
  // AppShell/GunnyChat dispatch the detail via CustomEvent on the window, and
  // this effect patches the live workoutResults so the user sees the numbers
  // populate in the set inputs without leaving workout mode.
  //
  // Listener is only attached while workoutMode is true — outside of workout
  // mode there are no inputs to fill, and Gunny is instructed to use
  // update_prescription instead (see lib prompt guidance).
  useEffect(() => {
    if (!workoutMode) return;
    const dateStr = selectedDate || formatDate(currentDate);

    const unsub = onPrefillWeights((detail) => {
      const workout = getWorkoutForDate(dateStr);
      if (!workout) return;

      // Resolve target block: prefer id match (Gunny rarely has it), then
      // case-insensitive exerciseName match. Bail if nothing matches — Gunny's
      // plain-text reply still shows the user what was attempted.
      const targetName = (detail.targetExerciseName || '').trim().toLowerCase();
      const block = workout.blocks.find(b =>
        (detail.targetBlockId && b.id === detail.targetBlockId) ||
        (b.type === 'exercise' && targetName &&
          (b as ExerciseBlock).exerciseName?.toLowerCase().trim() === targetName)
      );
      if (!block) {
        console.warn('[Planner:prefill_weights] no matching block for', detail);
        return;
      }

      // Merge incoming sets with whatever's already there: each incoming set
      // index overwrites the weight/reps at that position. Preserves any
      // `completed: true` flags so a user mid-session doesn't lose their work.
      setWorkoutResults(prev => {
        const existing = prev[block.id]?.sets || [];
        const nextSets = detail.sets.map((s, i) => {
          const e = existing[i];
          return {
            weight: s.weight || 0,
            reps: s.reps ?? e?.reps ?? 0,
            completed: e?.completed ?? false,
          };
        });
        // Keep any extra sets the user already had beyond what Gunny prefilled.
        const extras = existing.slice(detail.sets.length);
        return {
          ...prev,
          [block.id]: {
            sets: [...nextSets, ...extras],
            notes: prev[block.id]?.notes || '',
          },
        };
      });

      // Hands-free feedback: flash the on-screen toast and speak a short
      // confirmation. Callers explicitly asked for this to surface visibly so
      // they can glance at the bar and see Gunny did the work.
      const exName = block.type === 'exercise' ? (block as ExerciseBlock).exerciseName : 'this exercise';
      const src = detail.sourceLabel ? ` ${detail.sourceLabel}` : '';
      showVoiceFeedback(`Prefilled ${exName}${src}`);
      speak(`${exName} weights loaded${src}.`);
    });

    return unsub;
  }, [workoutMode, selectedDate, currentDate, showVoiceFeedback]);

  // Auto-persist workout results on every change (prevents data loss on tab switch)
  useEffect(() => {
    if (!workoutMode) return;
    if (Object.keys(workoutResults).length === 0) return;
    const dateStr = selectedDate || formatDate(currentDate);
    const workout = getWorkoutForDate(dateStr);
    if (!workout) return;

    const savedResults: WorkoutResults = {
      startTime: workout.results?.startTime || new Date().toISOString(),
      blockResults: Object.fromEntries(
        Object.entries(workoutResults).map(([blockId, data]) => [
          blockId,
          { sets: data.sets.map(s => ({ weight: s.weight, reps: s.reps, completed: s.completed })), notes: (data as { sets: unknown[]; notes?: string }).notes }
        ])
      ),
    };
    const updated = { ...operator };
    updated.workouts = { ...updated.workouts };
    updated.workouts[dateStr] = { ...workout, results: savedResults };
    onUpdateOperator(updated);
  }, [workoutResults]);

  const renderWorkoutMode = () => {
    const dateStr = selectedDate || formatDate(currentDate);
    const workout = getWorkoutForDate(dateStr);
    if (!workout) return null;

    const results = workoutResults;
    const setResults = setWorkoutResults;

    const handleSaveResults = () => {
      const savedResults: WorkoutResults = {
        startTime: workout.results?.startTime || new Date().toISOString(),
        endTime: new Date().toISOString(),
        blockResults: Object.fromEntries(
          Object.entries(results).map(([blockId, data]) => [
            blockId,
            { sets: data.sets.map(s => ({ weight: s.weight, reps: s.reps, completed: s.completed })), notes: (data as { sets: unknown[]; notes?: string }).notes }
          ])
        ),
      };
      const updated = { ...operator };
      updated.workouts[dateStr] = { ...workout, results: savedResults, completed: true };
      onUpdateOperator(updated);

      // ─── MISSION COMPLETE stats ──────────────────────────────────────────
      const startTimeStr = workout.results?.startTime || savedResults.startTime;
      const startTime = new Date(startTimeStr);
      const durationMin = Math.max(
        1,
        Math.round((Date.now() - startTime.getTime()) / 60000)
      );

      let totalVolume = 0;
      let completedSets = 0;
      let totalSets = 0;
      Object.values(results).forEach((block) => {
        block.sets.forEach((s) => {
          totalSets++;
          if (s.completed) {
            completedSets++;
            totalVolume += (s.weight || 0) * (s.reps || 0);
          }
        });
      });
      const exerciseCount = workout.blocks.filter(
        (b) => b.type === 'exercise'
      ).length;
      const completionRate = totalSets > 0
        ? Math.round((completedSets / totalSets) * 100)
        : 0;

      const callsign = operator.callsign || 'Operator';
      const volumeStr = totalVolume.toLocaleString();
      const gunnyLines = {
        perfect: [
          `100% completion. That's what DISCIPLINE looks like, ${callsign}. Zero excuses. Zero shortcuts. Every rep accounted for.`,
          `FLAWLESS EXECUTION, ${callsign}. ${volumeStr} lbs moved. That iron didn't stand a chance.`,
          `${callsign} — every set, every rep, every pound. THAT is the standard. Maintain it.`,
        ],
        good: [
          `${completionRate}% completion — solid session, ${callsign}. ${volumeStr} lbs of total volume. Recover hard, come back harder.`,
          `Good work out there, ${callsign}. Not perfect, but you showed up and put in work. That counts.`,
          `Real talk, ${callsign}: ${completionRate}% of the plan executed, ${volumeStr} lbs moved in ${durationMin} minutes. That's a win. Log the food, hydrate, sleep.`,
        ],
        partial: [
          `${completionRate}% today, ${callsign}. Some days the weight wins. What matters is you were HERE. Rest up and attack it next session.`,
          `Listen up, ${callsign} — a bad day in the gym beats a good day on the couch. ${durationMin} minutes of work is ${durationMin} minutes of growth. We go again.`,
          `${callsign}, the scoreboard doesn't always reflect the fight. You showed up. Recover, reassess, redeploy.`,
        ],
      } as const;
      const tier: 'perfect' | 'good' | 'partial' =
        completionRate >= 100 ? 'perfect'
        : completionRate >= 70 ? 'good'
        : 'partial';
      const lines = gunnyLines[tier];
      const gunnyMessage = lines[Math.floor(Math.random() * lines.length)];

      setCompletionData({
        title: workout.title,
        duration: durationMin,
        exerciseCount,
        totalVolume,
        completionRate,
        gunnyMessage,
      });
      setShowCompletionScreen(true);

      // Ascending victory chord
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          [440, 554, 659, 880].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.15 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.35);
            osc.start(ctx.currentTime + i * 0.15);
            osc.stop(ctx.currentTime + i * 0.15 + 0.4);
          });
        }
      } catch { /* audio unavailable — silent fallback */ }

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate([100, 50, 100, 50, 200]); } catch { /* noop */ }
      }

      // setWorkoutMode(false) + setWorkoutResults({}) are deferred to the
      // DEBRIEF COMPLETE button in the overlay — so stats/volume math above
      // still has access to the in-memory results.
    };

    // Smart weight logic: if user enters weight for first set, auto-fill rest
    const handleWeightChange = (blockId: string, setIdx: number, weight: number) => {
      setResults(prev => {
        const blockData = { ...prev[blockId] };
        const sets = [...blockData.sets];
        sets[setIdx] = { ...sets[setIdx], weight };
        // If it's the first set and other sets have no weight, fill them
        if (setIdx === 0) {
          for (let i = 1; i < sets.length; i++) {
            if (sets[i].weight === 0) sets[i] = { ...sets[i], weight };
          }
        }
        return { ...prev, [blockId]: { sets } };
      });
    };

    return (
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        {/* Fallback HTML5 audio — short data-URI beep (pure tone via WAV header) */}
        <audio
          ref={fallbackAudioRef}
          preload="auto"
          src="data:audio/wav;base64,UklGRnQFAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YVAFAACAgIGChIaHiYqMjY6QkZKTlJWVlpaXl5eXlpaVlZSTkpGPjo2Li4qJiIeHhoaFhYWEhISEhISEhYWGhoeIiYqKi4yNjo6PkJGSk5OUlZaWl5eYmJiYmJiYmJeXlpaVlJOSkZCPjo2MjIuKiYiHh4aGhoWFhYWFhYWFhYaGh4eIiImJioqLi4yMjY2Ojo+Pj5CQkJCRkZGRkZGRkZGRkZCQkJCPj4+OjY2MjIuLiomJiIiHh4eGhoaGhoaGhoaGhoaGh4eHh4iIiIiJiYmKioqLi4uLjIyMjIyNjY2NjY2NjY2Njo6Ojo2NjY2NjIyMjIuLioqKiYmJiYiIiIiHh4eHh4eHh4eHh4eHh4eHh4eIiIiIiImJiYmJiYqKioqKiouLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4qKioqKiYmJiYmIiIiIiIeHh4eHh4eHh4eHh4eHh4eHiIiIiIiIiImJiYmJiYqKioqKiouLi4uLi4uMjIyMjIyMjIyMjIyMjIyMjIyMjIyLi4uLi4uKioqKioqJiYmJiYmIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiJiYmJiYmJiYqKioqKiouLi4uLi4yMjIyMjIyMjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjIyMjIyMjIuLi4uLi4qKioqKiomJiYmJiYmIiIiIiIiIiIiIiIiIiIiIiIiIiIiJiYmJiYmKioqKiouLi4uMjIyMjIyNjY2NjY2Ojo6Ojo6Ojo+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj46Ojo6Ojo6NjY2NjY2MjIyMi4uLi4uKioqKioqJiYmJiYmIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiYmJiYmJiYqKioqKioqLi4uLi4uLjIyMjIyMjIyNjY2NjY2NjY2Njo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6NjY2NjY2MjIyMjIyMi4uLi4uLi4uKioqKioqKiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmKioqKioqKiouLi4uLi4uLjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIuLi4uLi4uLioqKioqKiomJiYmJiYmJiYmIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiImJiYmJiYmJiYqKioqKiouLi4uLi4yMjIyMjIyNjY2NjY2OjY2Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo2NjY2NjY2NjY2MjIyMjIyMi4uLi4uLioqKioqKiYmJiYmJiIiIiIiIiIiIiIiIiIiIiIiIiIiIiImJiYmJiYmKioqKioqKi4uLi4uLi4yMjIyMjIyMjIyMjIyMjIyMjIyMjIyLi4uLi4uLi4qKioqKioqKiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmKioqKioqKiouLi4uLi4uMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyLi4uLi4uKioqKioqKiomJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiomJiYmJiYmKioqKioqKi4uLi4uLjIyMjIyMjY2NjY2Njo6Ojo6Ojo+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Ojo6Ojo6Ojo6NjY2NjY2MjIyMjIuLi4uLioqKioqJiYmJiYmIiIiIiIiIiIiIiIiIiIiIiImJiYmJiYqKioqKi4uLi4uMjIyMjIyNjY2NjY2Ojo6Ojo6Ojo6Ojo6Ojo6NjY2NjY2MjIyMjIuLi4uKioqKiYmJiYiIiIiIh4eHh4eHh4eHh4eHh4eHh4eHh4eHiIiIiImJiYmJioqKioqLi4uLi4yMjIyMjI2NjY2Nj"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'Orbitron', color: '#FF8C00', fontSize: 18, margin: 0 }}>WORKOUT MODE</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onOpenGunny && (
              <button
                onClick={onOpenGunny}
                style={{
                  padding: '4px 10px',
                  background: 'linear-gradient(135deg, rgba(255,184,0,0.2), rgba(255,184,0,0.1))',
                  border: '1px solid rgba(255,184,0,0.5)',
                  color: '#ffb800',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 1,
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
              >
                ⚡ GUNNY
              </button>
            )}
            <button onClick={() => { setWorkoutMode(false); /* activeListening removed — use Radio tab */ }} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #666', color: '#888', fontFamily: 'Share Tech Mono', cursor: 'pointer', fontSize: 11 }}>EXIT</button>
          </div>
        </div>
        <h3 style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: 16, margin: '0 0 12px 0' }}>{workout.title}</h3>

        {/* ═══ WORKOUT PTT — floating voice button (replaces the old RADIO TAB banner) ═══ */}
        {/* Button itself is rendered at the end of renderWorkoutMode via <WorkoutPTT /> */}

        {/* Voice command feedback toast */}
        {voiceFeedback && (
          <div style={{
            marginBottom: 12, padding: '8px 12px', textAlign: 'center',
            background: 'rgba(0,255,65,0.06)', border: '1px solid rgba(0,255,65,0.3)',
            borderRadius: 4, fontFamily: 'Orbitron, sans-serif', fontSize: 12,
            color: '#00ff41', letterSpacing: 1, fontWeight: 700,
          }}>
            {voiceFeedback}
          </div>
        )}

        {/* ═══ GUNNY VOICE RESPONSE OVERLAY ═══ */}
        {gunnyVoiceResponse && (
          <div
            onClick={onDismissGunnyResponse}
            style={{
              marginBottom: 12, padding: '12px 14px',
              background: 'rgba(255,140,0,0.06)',
              border: '1px solid rgba(255,140,0,0.35)',
              borderRadius: 6,
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: '#FF8C00',
                boxShadow: '0 0 4px rgba(255,140,0,0.8)',
              }} />
              <span style={{
                fontFamily: 'Orbitron, sans-serif', fontSize: 8, fontWeight: 700,
                color: '#FF8C00', letterSpacing: 1.5, textTransform: 'uppercase',
              }}>
                GUNNY
              </span>
              <span style={{
                fontFamily: 'Share Tech Mono, monospace', fontSize: 8,
                color: '#6B7B6B', marginLeft: 'auto',
              }}>
                tap to dismiss
              </span>
            </div>
            <p style={{
              fontFamily: 'Share Tech Mono, monospace', fontSize: 12,
              color: '#D0D8C8', margin: 0, lineHeight: 1.5,
              maxHeight: 120, overflow: 'auto',
            }}>
              {gunnyVoiceResponse}
            </p>
          </div>
        )}

        {/* ═══ VOICE SELECTOR (inline toggle) ═══ */}
        {workoutMode && (
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setShowVoiceSelect(!showVoiceSelect)}
              style={{
                padding: '2px 8px', background: 'transparent',
                border: '1px solid #2A3A2A', borderRadius: 4,
                color: '#6B7B6B', fontFamily: 'Share Tech Mono, monospace',
                fontSize: 9, cursor: 'pointer', letterSpacing: 0.5,
              }}
            >
              VOICE: {selectedVoice.toUpperCase()}
            </button>
            {showVoiceSelect && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {VOICE_OPTIONS.map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVoice(v.id);
                      setPreferredVoice(v.id);
                      setShowVoiceSelect(false);
                      // Play a preview
                      speak('Copy that.', v.id);
                    }}
                    style={{
                      padding: '2px 6px',
                      background: v.id === selectedVoice ? 'rgba(0,255,65,0.1)' : 'transparent',
                      border: `1px solid ${v.id === selectedVoice ? '#00ff41' : '#2A3A2A'}`,
                      borderRadius: 3,
                      color: v.id === selectedVoice ? '#00ff41' : '#6B7B6B',
                      fontFamily: 'Share Tech Mono, monospace',
                      fontSize: 8, cursor: 'pointer',
                    }}
                    title={v.desc}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rest Timer with countdown ring + audio */}
        <div style={{
          textAlign: 'center', marginBottom: 20, padding: 16,
          background: timerAlarm ? '#3a0a0a' : restRunning ? '#1a1a0a' : '#0a0a0a',
          border: `${timerAlarm ? 3 : 1}px solid ${timerAlarm ? '#ff4444' : restRunning ? '#FF8C00' : '#333'}`,
          borderRadius: 8,
          transition: 'all 0.3s',
          position: 'relative',
          animation: timerAlarm ? 'timerAlarmPulse 0.5s ease-in-out infinite' : undefined,
          boxShadow: timerAlarm ? '0 0 24px rgba(255,68,68,0.6)' : undefined,
        }}>
          <style>{`@keyframes timerAlarmPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }`}</style>
          {restRunning && restTimerMax > 0 && (
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', opacity: 0.3 }}>
              <circle cx="50" cy="50" r="44" fill="none" stroke="#333" strokeWidth="4" />
              <circle cx="50" cy="50" r="44" fill="none" stroke={restTimer <= 10 ? '#ff4444' : '#FF8C00'} strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - restTimer / restTimerMax)}`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
          )}
          <div style={{ fontFamily: 'Orbitron', fontSize: restRunning ? 48 : 24, color: restTimer <= 3 && restRunning ? '#ff4444' : restTimer <= 10 && restRunning ? '#FF8C00' : '#FF8C00', transition: 'all 0.3s', position: 'relative', zIndex: 1 }}>
            {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8, position: 'relative', zIndex: 1 }}>
            {[30, 60, 90, 120, 180].map(sec => (
              <button key={sec} onClick={() => { setRestTimer(sec); setRestTimerMax(sec); setRestRunning(true); }}
                style={{ padding: '4px 8px', background: '#1a1a1a', border: '1px solid #444', color: '#ccc', fontFamily: 'Share Tech Mono', fontSize: 11, cursor: 'pointer', borderRadius: 4 }}>
                {sec < 60 ? `${sec}s` : `${sec / 60}m`}
              </button>
            ))}
            {restRunning && (
              <button onClick={() => { setRestRunning(false); setRestTimer(0); }}
                style={{ padding: '4px 8px', background: '#ff4444', border: 'none', color: '#fff', fontFamily: 'Share Tech Mono', fontSize: 11, cursor: 'pointer', borderRadius: 4 }}>
                STOP
              </button>
            )}
          </div>
        </div>

        {/* HR Zone Tracking Panel */}
        {showHrPanel && (
          <HRZoneGauge
            currentHR={currentHR}
            targetZone={targetZone}
            hrSource={hrSource}
            zones={HR_ZONES}
            history={hrHistory}
            onSetTargetZone={setTargetZone}
            onManualSubmit={(val) => {
              setCurrentHR(val);
              setHrSource('manual');
              setHrHistory(prev => [...prev.slice(-60), { hr: val, time: Date.now() }]);
            }}
            onClose={() => setShowHrPanel(false)}
          />
        )}
        {/* legacy inline HR panel — kept commented for reference */}
        {false && (
          <div style={{ marginBottom: 16, padding: 12, background: '#0a0a0a', border: `1px solid ${currentHR ? getCurrentZone(currentHR).color : '#333'}`, borderRadius: 8, transition: 'all 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#888', letterSpacing: 1 }}>HR ZONE TRACKER</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#555' }}>
                  {hrSource === 'wearable' ? 'LIVE' : hrSource === 'manual' ? 'MANUAL' : 'NO DEVICE'}
                </span>
                <button onClick={() => setShowHrPanel(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
              </div>
            </div>

            {/* Current HR display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              <div style={{ textAlign: 'center' }}>
                {currentHR ? (
                  <>
                    <div style={{ fontFamily: 'Orbitron', fontSize: 36, color: getCurrentZone(currentHR).color, fontWeight: 700 }}>{currentHR}</div>
                    <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#666' }}>BPM</div>
                  </>
                ) : (
                  <div style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: '#555' }}>
                    <input type="number" placeholder="Enter HR"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const val = parseInt((e.target as HTMLInputElement).value);
                          if (val > 0) {
                            setCurrentHR(val);
                            setHrSource('manual');
                            setHrHistory(prev => [...prev.slice(-60), { hr: val, time: Date.now() }]);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                      style={{ width: 80, padding: '6px 8px', background: '#000', border: '1px solid #333', color: '#e0e0e0', fontFamily: 'Share Tech Mono', fontSize: 16, textAlign: 'center', borderRadius: 4 }}
                    />
                  </div>
                )}
              </div>

              {currentHR && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 13, color: getCurrentZone(currentHR).color, marginBottom: 4 }}>
                    ZONE {getCurrentZone(currentHR).zone}: {getCurrentZone(currentHR).name}
                  </div>
                  {/* Zone alert — flash if outside target */}
                  {getCurrentZone(currentHR).zone !== targetZone && (
                    <div style={{
                      fontFamily: 'Share Tech Mono', fontSize: 11,
                      color: getCurrentZone(currentHR).zone > targetZone ? '#ff4444' : '#00ff41',
                      animation: 'pulse 1s infinite',
                    }}>
                      {getCurrentZone(currentHR).zone > targetZone ? 'ABOVE TARGET — SLOW DOWN' : 'BELOW TARGET — PUSH HARDER'}
                    </div>
                  )}
                  {getCurrentZone(currentHR).zone === targetZone && (
                    <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: '#00ff41' }}>ON TARGET</div>
                  )}
                </div>
              )}
            </div>

            {/* Zone bar visualization */}
            <div style={{ display: 'flex', gap: 2, height: 24, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              {HR_ZONES.map(z => {
                const isActive = currentHR ? getCurrentZone(currentHR).zone === z.zone : false;
                const isTarget = z.zone === targetZone;
                return (
                  <div key={z.zone} onClick={() => setTargetZone(z.zone)} style={{
                    flex: 1, background: isActive ? z.color : `${z.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    border: isTarget ? `2px solid ${z.color}` : '2px solid transparent',
                    transition: 'all 0.3s', position: 'relative',
                  }}>
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: isActive ? '#000' : z.color, fontWeight: isActive ? 700 : 400 }}>
                      Z{z.zone}
                    </span>
                    {isTarget && (
                      <div style={{ position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `4px solid ${z.color}` }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Zone range labels */}
            <div style={{ display: 'flex', gap: 2 }}>
              {HR_ZONES.map(z => (
                <div key={z.zone} style={{ flex: 1, textAlign: 'center', fontFamily: 'Share Tech Mono', fontSize: 8, color: '#555' }}>
                  {z.min}-{z.max}
                </div>
              ))}
            </div>

            {/* Manual HR update button when already has HR */}
            {currentHR && hrSource === 'manual' && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="number" placeholder="Update HR"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = parseInt((e.target as HTMLInputElement).value);
                      if (val > 0) {
                        setCurrentHR(val);
                        setHrHistory(prev => [...prev.slice(-60), { hr: val, time: Date.now() }]);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  style={{ width: 70, padding: '4px 6px', background: '#000', border: '1px solid #333', color: '#e0e0e0', fontFamily: 'Share Tech Mono', fontSize: 12, textAlign: 'center', borderRadius: 4 }}
                />
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#555' }}>press Enter</span>
              </div>
            )}

            {/* Mini HR history sparkline */}
            {hrHistory.length > 1 && (
              <div style={{ marginTop: 8 }}>
                <svg width="100%" height="60" viewBox="0 0 200 60" preserveAspectRatio="none" style={{ display: 'block' }}>
                  {(() => {
                    const data = hrHistory.slice(-30);
                    const minH = Math.min(...data.map(x => x.hr)) - 5;
                    const maxH = Math.max(...data.map(x => x.hr)) + 5;
                    const range = maxH - minH || 1;
                    const points = data.map((h, i) => {
                      const x = (i / (data.length - 1)) * 200;
                      const y = 55 - ((h.hr - minH) / range) * 50;
                      return `${x},${y}`;
                    }).join(' ');
                    const fillPoints = `0,55 ${points} 200,55`;
                    const lastHr = data[data.length - 1];
                    const lastColor = lastHr ? getCurrentZone(lastHr.hr).color : '#FF8C00';
                    return (
                      <>
                        <defs>
                          <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lastColor} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={lastColor} stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <polygon points={fillPoints} fill="url(#hrGrad)" />
                        <polyline points={points} fill="none" stroke={lastColor} strokeWidth="2" strokeLinejoin="round" />
                        {lastHr && (
                          <circle cx={200} cy={55 - ((lastHr.hr - minH) / range) * 50} r="3" fill={lastColor} />
                        )}
                      </>
                    );
                  })()}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Share Tech Mono', fontSize: 8, color: '#555' }}>
                  <span>{hrHistory.length > 30 ? `${Math.round((Date.now() - hrHistory[hrHistory.length - 30].time) / 60000)}min ago` : 'start'}</span>
                  <span>now</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HR panel toggle when hidden */}
        {!showHrPanel && workoutMode && (
          <button onClick={() => setShowHrPanel(true)} style={{
            marginBottom: 12, padding: '4px 10px', background: '#0a0a0a', border: '1px solid #333',
            color: '#888', fontFamily: 'Share Tech Mono', fontSize: 10, cursor: 'pointer', borderRadius: 4,
          }}>SHOW HR TRACKER</button>
        )}

        {/* ═══ WARMUP — collapsible, tappable movement cards with in-app video ═══ */}
        {workout.warmup && parseMovementText(workout.warmup).length > 0 && (
          <div style={{ marginBottom: 12, border: '1px solid rgba(255,138,60,0.35)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setWarmupExpanded(v => !v)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,138,60,0.08)', border: 'none', cursor: 'pointer', color: '#ff8a3c', fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 1.5 }}>
              <span>WARMUP · {parseMovementText(workout.warmup).length} MOVEMENTS</span>
              <span style={{ fontFamily: 'Share Tech Mono', fontSize: 14 }}>{warmupExpanded ? '▾' : '▸'}</span>
            </button>
            {warmupExpanded && (
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, background: '#070707' }}>
                {parseMovementText(workout.warmup).map((m, i) => (
                  <WarmupMovementCard
                    key={`warmup-${i}`}
                    movement={m}
                    variant="warmup"
                    onPlayVideo={(name) => openExerciseVideo(name)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Exercise blocks in execution mode */}
        {workout.blocks.map((block, idx) => {
          if (block.type !== 'exercise') {
            const condBlock = block as ConditioningBlock;
            const blockData = results[block.id] || { sets: [{ weight: 0, reps: 0, completed: false }] };
            return (
              <div key={block.id} style={{
                padding: 16, marginBottom: 12,
                background: blockData.sets[0]?.completed ? 'rgba(255,140,0,0.08)' : '#0a0a0a',
                border: `2px solid ${blockData.sets[0]?.completed ? '#00ff41' : '#FF8C00'}`,
                borderRadius: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontFamily: 'Orbitron', color: '#FF8C00', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 }}>
                    GO TIME
                  </div>
                  <div style={{ fontFamily: 'Orbitron', color: '#FF8C00', fontSize: 12 }}>
                    {condBlock.format}
                  </div>
                </div>
                <div style={{
                  fontFamily: 'Share Tech Mono', color: '#e0e0e0', fontSize: 14,
                  lineHeight: 1.8, whiteSpace: 'pre-line', marginBottom: 12,
                  padding: '8px 12px', background: 'rgba(255,140,0,0.04)',
                  borderLeft: '3px solid #FF8C00', borderRadius: '0 4px 4px 0',
                }}>
                  {condBlock.description?.replace(/\\n/g, '\n')}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="text" placeholder="Time / Rounds / Score"
                    value={blockData.sets[0]?.reps ? `${blockData.sets[0].reps}` : ''}
                    onChange={e => {
                      const val = e.target.value;
                      setResults(prev => ({
                        ...prev,
                        [block.id]: { sets: [{ weight: 0, reps: parseInt(val) || 0, completed: blockData.sets[0]?.completed || false }] }
                      }));
                    }}
                    style={{
                      flex: 1, padding: '8px 10px', background: '#000',
                      border: '1px solid #FF8C00', color: '#e0e0e0',
                      fontFamily: 'Share Tech Mono', fontSize: 14, borderRadius: 4,
                    }}
                  />
                  <button
                    onClick={() => {
                      setResults(prev => ({
                        ...prev,
                        [block.id]: { sets: [{ ...blockData.sets[0], completed: !blockData.sets[0]?.completed }] }
                      }));
                    }}
                    style={{
                      padding: '8px 16px',
                      background: blockData.sets[0]?.completed ? '#00ff41' : '#FF8C00',
                      border: 'none',
                      color: '#000',
                      fontFamily: 'Orbitron', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', borderRadius: 4,
                    }}
                  >
                    {blockData.sets[0]?.completed ? 'DONE' : 'COMPLETE'}
                  </button>
                </div>
              </div>
            );
          }

          const blockResults = results[block.id] || { sets: [{ weight: 0, reps: 0, completed: false }] };
          const parsedSets = parseInt(block.prescription?.match(/(\d+)\s*x/)?.[1] || '3');
          // Ensure we have enough sets
          while (blockResults.sets.length < parsedSets) {
            blockResults.sets.push({ weight: 0, reps: 0, completed: false });
          }

          return (
            <div key={block.id} style={{ padding: 12, marginBottom: 12, background: idx === activeBlockIdx ? '#0a1a0a' : '#0a0a0a', border: `1px solid ${idx === activeBlockIdx ? '#00ff41' : '#333'}`, borderRadius: 4, transition: 'all 0.2s' }}
              onClick={() => setActiveBlockIdx(idx)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: 14, fontWeight: 'bold' }}>{block.exerciseName}</div>
                <div style={{ fontFamily: 'Share Tech Mono', color: '#888', fontSize: 11 }}>{block.prescription}</div>
              </div>
              {(block.videoUrl || getVideoUrl(block.exerciseName)) && (
                <button
                  onClick={(e) => { e.stopPropagation(); openExerciseVideo(block.exerciseName, block.videoUrl); }}
                  style={{ fontSize: 10, padding: '3px 10px', marginTop: 4, background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.4)', color: '#ffb800', fontFamily: 'Share Tech Mono', cursor: 'pointer', borderRadius: 4 }}>
                  ▶ FORM DEMO
                </button>
              )}
              {/* Exercise notes — intel for Gunny */}
              <div style={{ marginTop: 6 }}>
                <input
                  type="text"
                  placeholder="Notes (e.g. banded felt hard, left knee tight)"
                  value={(results[block.id] as { sets: unknown[]; notes?: string })?.notes || ''}
                  onChange={e => {
                    const notes = e.target.value;
                    setResults(prev => ({
                      ...prev,
                      [block.id]: { ...prev[block.id], notes }
                    }));
                  }}
                  style={{
                    width: '100%', padding: '4px 8px', background: '#000',
                    border: '1px solid #222', color: '#999',
                    fontFamily: 'Share Tech Mono', fontSize: 10,
                    borderRadius: 3, boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                {blockResults.sets.slice(0, parsedSets).map((set, si) => (
                  <div key={si} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Share Tech Mono', color: '#666', fontSize: 11, width: 30 }}>S{si + 1}</span>
                    <input type="number" placeholder="lbs" value={set.weight || ''} onChange={e => handleWeightChange(block.id, si, parseFloat(e.target.value) || 0)}
                      style={{ width: 60, padding: '4px 6px', background: '#000', border: '1px solid #333', color: '#e0e0e0', fontFamily: 'Share Tech Mono', fontSize: 13, textAlign: 'center' }} />
                    <span style={{ color: '#444', fontSize: 11 }}>x</span>
                    <input type="number" placeholder="reps" value={set.reps || ''} onChange={e => {
                      setResults(prev => {
                        const blockData = { ...prev[block.id] };
                        const sets = [...blockData.sets];
                        sets[si] = { ...sets[si], reps: parseInt(e.target.value) || 0 };
                        return { ...prev, [block.id]: { sets } };
                      });
                    }}
                      style={{ width: 50, padding: '4px 6px', background: '#000', border: '1px solid #333', color: '#e0e0e0', fontFamily: 'Share Tech Mono', fontSize: 13, textAlign: 'center' }} />
                    <button onClick={() => {
                      const wasCompleted = set.completed;
                      setResults(prev => {
                        const blockData = { ...prev[block.id] };
                        const sets = [...blockData.sets];
                        sets[si] = { ...sets[si], completed: !wasCompleted };
                        return { ...prev, [block.id]: { sets } };
                      });
                      // Auto-start rest timer from prescription when logging a set
                      if (!wasCompleted) {
                        const restMatch = block.prescription?.match(/(?:rest|Rest|REST)\s*:?\s*(\d+)\s*:?\s*(\d+)?/i);
                        if (restMatch) {
                          const mins = restMatch[2] !== undefined ? parseInt(restMatch[1]) : 0;
                          const secs = restMatch[2] !== undefined ? parseInt(restMatch[2]) : parseInt(restMatch[1]);
                          const totalSecs = mins * 60 + secs;
                          if (totalSecs > 0) {
                            setRestTimer(totalSecs);
                            setRestTimerMax(totalSecs);
                            setRestRunning(true);
                          }
                        }
                      }
                    }}
                      style={{ padding: '2px 8px', background: set.completed ? '#00ff41' : '#1a1a1a', border: `1px solid ${set.completed ? '#00ff41' : '#444'}`, color: set.completed ? '#000' : '#888', fontFamily: 'Share Tech Mono', fontSize: 11, cursor: 'pointer', borderRadius: 4 }}>
                      {set.completed ? 'DONE' : 'LOG'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Mid-workout edit controls */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 4 }}>
          <button onClick={() => {
            const newBlock: ExerciseBlock = {
              type: 'exercise', id: `block-live-${Date.now()}`, sortOrder: workout.blocks.length,
              exerciseName: '', prescription: '3x10', isLinkedToNext: false,
            };
            const dateStr = selectedDate || formatDate(currentDate);
            const updated = { ...operator };
            updated.workouts = { ...updated.workouts };
            updated.workouts[dateStr] = { ...workout, blocks: [...workout.blocks, newBlock] };
            onUpdateOperator(updated);
            // Initialize results for new block
            setWorkoutResults(prev => ({ ...prev, [newBlock.id]: { sets: [{ weight: 0, reps: 0, completed: false }, { weight: 0, reps: 0, completed: false }, { weight: 0, reps: 0, completed: false }], notes: '' } }));
          }}
            style={{ flex: 1, padding: '6px 8px', background: '#0a0a0a', border: '1px dashed #333', color: '#666', fontFamily: 'Share Tech Mono', fontSize: 10, cursor: 'pointer', borderRadius: 4 }}>
            + ADD EXERCISE
          </button>
          <button onClick={() => {
            if (workout.blocks.length <= 1) return;
            const dateStr = selectedDate || formatDate(currentDate);
            const removedId = workout.blocks[workout.blocks.length - 1].id;
            const updated = { ...operator };
            updated.workouts = { ...updated.workouts };
            updated.workouts[dateStr] = { ...workout, blocks: workout.blocks.slice(0, -1) };
            onUpdateOperator(updated);
            setWorkoutResults(prev => {
              const next = { ...prev };
              delete next[removedId];
              return next;
            });
          }}
            style={{ padding: '6px 8px', background: '#0a0a0a', border: '1px dashed #442222', color: '#884444', fontFamily: 'Share Tech Mono', fontSize: 10, cursor: 'pointer', borderRadius: 4 }}>
            - REMOVE LAST
          </button>
        </div>

        {/* ═══ COOLDOWN — collapsible, auto-expands when last exercise set is completed ═══ */}
        {workout.cooldown && parseMovementText(workout.cooldown).length > 0 && (() => {
          const lastExercise = [...workout.blocks].reverse().find(b => b.type === 'exercise') as ExerciseBlock | undefined;
          const lastDone = lastExercise ? (results[lastExercise.id]?.sets?.every(s => s.completed) ?? false) : false;
          const isExpanded = cooldownExpanded || lastDone;
          return (
            <div style={{ marginTop: 12, marginBottom: 12, border: '1px solid rgba(96,165,250,0.35)', borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setCooldownExpanded(v => !v)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(96,165,250,0.08)', border: 'none', cursor: 'pointer', color: '#60a5fa', fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 1.5 }}>
                <span>COOLDOWN · {parseMovementText(workout.cooldown).length} MOVEMENTS{lastDone ? ' · READY' : ''}</span>
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 14 }}>{isExpanded ? '▾' : '▸'}</span>
              </button>
              {isExpanded && (
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, background: '#070707' }}>
                  {parseMovementText(workout.cooldown).map((m, i) => (
                    <WarmupMovementCard
                      key={`cooldown-${i}`}
                      movement={m}
                      variant="cooldown"
                      onPlayVideo={(name) => openExerciseVideo(name)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ Video Modal (Task 18) ═══ */}
        <VideoModal
          open={!!videoModalState}
          onClose={() => setVideoModalState(null)}
          url={videoModalState?.url || ''}
          title={videoModalState?.title}
        />

        {/* Ask Gunny — mid-workout coaching access */}
        {onOpenGunny && (
          <button onClick={onOpenGunny}
            style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, rgba(255,184,0,0.15), rgba(255,184,0,0.08))', color: '#ffb800', border: '1px solid rgba(255,184,0,0.4)', fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, cursor: 'pointer', borderRadius: 4, marginTop: 12 }}>
            ⚡ NEED HELP? ASK GUNNY
          </button>
        )}

        <button onClick={handleSaveResults}
          style={{ width: '100%', padding: 14, background: '#00ff41', color: '#000', border: 'none', fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', borderRadius: 4, marginTop: 12 }}>
          COMPLETE WORKOUT
        </button>

        {/* ═══ Floating Push-To-Talk — voice to Gunny without leaving workout mode ═══ */}
        <WorkoutPTT
          onSend={(text) => {
            if (onSendGunnyMessage) onSendGunnyMessage(text);
          }}
          onLocalCommand={(cmd) => handleVoiceCommand(cmd)}
        />

        {/* ═══ MISSION COMPLETE overlay — shown after COMPLETE WORKOUT ═══ */}
        {showCompletionScreen && completionData && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              textAlign: 'center',
              animation: 'fadeInScale 0.35s ease',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 30,
                fontWeight: 900,
                color: '#00ff41',
                letterSpacing: 4,
                marginBottom: 8,
                textShadow: '0 0 20px rgba(0,255,65,0.5)',
              }}
            >
              MISSION COMPLETE
            </div>
            <div
              style={{
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: 16,
                color: '#FF8C00',
                marginBottom: 28,
                maxWidth: 360,
              }}
            >
              {completionData.title}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                width: '100%',
                maxWidth: 340,
                marginBottom: 28,
              }}
            >
              {[
                { label: 'DURATION', value: `${completionData.duration} MIN`, color: '#00ff41' },
                { label: 'EXERCISES', value: String(completionData.exerciseCount), color: '#00ff41' },
                { label: 'VOLUME', value: `${completionData.totalVolume.toLocaleString()} LBS`, color: '#FFB800' },
                { label: 'COMPLETION', value: `${completionData.completionRate}%`, color: completionData.completionRate >= 90 ? '#00ff41' : '#FFB800' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: '#111',
                    border: '1px solid #222',
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#666', letterSpacing: 1, marginBottom: 4 }}>{stat.label}</div>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 20, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                maxWidth: 400,
                width: '100%',
                padding: '14px 18px',
                background: 'rgba(255,140,0,0.05)',
                border: '1px solid rgba(255,140,0,0.2)',
                borderLeft: '3px solid #FF8C00',
                borderRadius: 4,
                marginBottom: 28,
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 13,
                color: '#ccc',
                lineHeight: 1.6,
                textAlign: 'left',
              }}
            >
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#FF8C00', letterSpacing: 1, marginBottom: 8 }}>GUNNY SAYS</div>
              {completionData.gunnyMessage}
            </div>

            <button
              onClick={() => {
                setShowCompletionScreen(false);
                setCompletionData(null);
                setWorkoutMode(false);
                setWorkoutResults({});
              }}
              style={{
                padding: '14px 40px',
                background: '#00ff41',
                color: '#000',
                border: 'none',
                borderRadius: 4,
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 1,
                cursor: 'pointer',
              }}
            >
              DEBRIEF COMPLETE
            </button>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER DAY VIEW
  // ============================================================================

  const renderDayView = () => {
    const dateObj = selectedDate ? parseDate(selectedDate) : currentDate;
    const dateStr = formatDate(dateObj);
    const workout = getWorkoutForDate(dateStr);
    // Split the day name into "Friday," and "April 24" so the date
    // portion can render as the green-glow <em> per the handoff
    // screen-head pattern: H1 "Friday, <em>April 24</em>".
    const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    return (
      <div className="stack-4">
        {/* Day-view header — crumb + H1 + sub mono. Replaces the old
            single-line green H2 with the canonical .screen-head
            structure. */}
        <header style={{ marginBottom: 8 }}>
          <div className="t-mono-sm" style={{ marginBottom: 6, color: 'var(--text-tertiary)' }}>
            <b style={{ color: 'var(--green)', fontWeight: 'normal' }}>//</b> Planner&nbsp;
            <span style={{ color: 'var(--text-dim)' }}>/</span>&nbsp;Day
          </div>
          <h2 className="t-display-xl" style={{ fontSize: 22 }}>
            {weekday}, <em style={{ fontStyle: 'normal', color: 'var(--green)', textShadow: '0 0 12px rgba(0,255,65,0.35)' }}>{monthDay}</em>
          </h2>
          {workout && (
            <div className="t-mono-sm" style={{ marginTop: 6, color: 'var(--text-secondary)' }}>
              {workout.title}
            </div>
          )}
        </header>

        {workoutMode && workout ? (
          renderWorkoutMode()
        ) : showWorkoutBuilder ? (
          renderWorkoutBuilder()
        ) : workout ? (
          // Workout card — bracket card with elevated tone. Replaces
          // the old border-rectangle. The action row uses ghost/primary/
          // danger-outline button variants per the handoff mock.
          <div className="ds-card bracket elevated">
            <span className="bl" /><span className="br" />

            <div className="row-between" style={{ marginBottom: 14, alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ flex: '1 1 160px' }}>
                <div className="t-display-l" style={{ color: 'var(--green)', marginBottom: 4 }}>
                  {workout.title}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button type="button" onClick={() => handleEditWorkout(workout)} className="btn btn-ghost btn-sm">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    unlockAudioContext();
                    setWorkoutMode(true);
                    setSelectedDate(dateStr);
                  }}
                  className="btn btn-primary btn-sm"
                >
                  Start
                </button>
                <button type="button" onClick={() => handleDeleteWorkout(dateStr)} className="btn btn-danger-outline btn-sm">
                  Delete
                </button>
              </div>
            </div>

            {workout.notes && (
              <>
                <div className="t-label" style={{ color: 'var(--green)', marginBottom: 6 }}>// Coach's Notes</div>
                <p className="t-body-sm" style={{ marginBottom: 16, whiteSpace: 'pre-wrap' }}>
                  {workout.notes}
                </p>
              </>
            )}

            {workout.warmup && (
              <>
                <div className="t-label" style={{ color: 'var(--amber)', marginBottom: 8 }}>// Warmup</div>
                {/* Numbered list with mono-green index per the handoff
                    Day mock. Falls back to plain pre-wrap if the warmup
                    isn't multi-line. */}
                <ul style={{ listStyle: 'none', paddingLeft: 0, marginBottom: 16 }} className="stack-2">
                  {workout.warmup.split(/\n+/).filter(Boolean).map((line, i) => (
                    <li key={i} className="t-body-sm" style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <span className="t-mono-sm" style={{ color: 'var(--green)', minWidth: 24 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{ color: 'var(--text-primary)' }}>{line}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {workout.primer && (
              <>
                <div className="t-label" style={{ color: 'var(--amber)', marginBottom: 8 }}>// Primer</div>
                <p className="t-body-sm" style={{ marginBottom: 16, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                  {workout.primer}
                </p>
              </>
            )}

            {workout.cooldown && (
              <>
                <div className="t-label" style={{ color: 'var(--amber)', marginBottom: 8 }}>// Cooldown</div>
                <p className="t-body-sm" style={{ marginBottom: 0, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                  {workout.cooldown}
                </p>
              </>
            )}
          </div>
        ) : (
          // Empty state — simple centered ghost card with a primary
          // button to create the day's workout.
          <div className="ds-card" style={{ textAlign: 'center', padding: 32 }}>
            <p className="t-body-sm" style={{ color: 'var(--text-secondary)', marginBottom: 14 }}>
              No workout for this day.
            </p>
            <button
              type="button"
              onClick={() => handleAddWorkout(dateStr)}
              className="btn btn-primary btn-sm"
            >
              Create Workout
            </button>
          </div>
        )}

        {/* Workout blocks — each rendered as its own bracket card so
            every movement reads as an independent HUD tile per the
            handoff "Movement card" pattern. Lives outside the main
            workout card to give each block visual breathing room. */}
        {workout && !workoutMode && !showWorkoutBuilder && workout.blocks.length > 0 && (
          <div className="stack-3">
            {workout.blocks.map((block, idx) => {
              const label = getBlockLabels(workout.blocks)[idx];
              if (block.type === 'exercise') {
                const vidUrl = block.videoUrl || getVideoUrl(block.exerciseName);
                const parsed = parsePrescription(block.prescription);
                return (
                  <div key={block.id} className="ds-card bracket">
                    <span className="bl" /><span className="br" />
                    <div className="row-between" style={{ marginBottom: 12, alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div className="t-display-m" style={{ color: 'var(--green)' }}>
                        {label}) {block.exerciseName}
                      </div>
                      {vidUrl && (
                        <a
                          href={vidUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-amber btn-sm"
                          style={{ padding: '7px 10px' }}
                        >
                          ▶ Demo
                        </a>
                      )}
                    </div>
                    {/* Each prescription tag as a chip. TagPill is the
                        legacy renderer; render its parsed values as
                        plain .chip elements to match the handoff. */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {parsed.length > 0
                        ? parsed.map((tag, ti) => <TagPill key={ti} tag={tag} />)
                        : block.prescription && (
                            <span className="chip" title="Prescription">
                              {block.prescription}
                            </span>
                          )}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={block.id} className="ds-card bracket amber amber-tone">
                    <span className="bl" /><span className="br" />
                    <div className="t-display-m" style={{ color: 'var(--amber)', marginBottom: 6 }}>
                      {block.format}
                    </div>
                    <div className="t-body-sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {block.description}
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // WORKOUT BUILDER COMPONENT
  // ============================================================================

  const renderWorkoutBuilder = () => {
    const blockLabels = getBlockLabels(builderData.blocks);

    return (
      <div
        style={{
          padding: '24px',
          backgroundColor: 'rgba(5,5,5,0.8)',
          border: '1px solid rgba(0,255,65,0.15)',
          maxWidth: '900px',
          position: 'relative',
        }}
      >
        {/* Top accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,255,65,0.4), transparent)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'Orbitron', color: '#00ff41', fontSize: '26px', fontWeight: 900, letterSpacing: '2px' }}>
            {t('planner.title')}
          </div>
          <div style={{ fontFamily: 'Share Tech Mono', color: '#666', fontSize: '15px' }}>
            // {selectedDate}
          </div>
        </div>

        {/* TITLE */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '15px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
            {t('planner.title_label')}
          </label>
          <input
            type="text"
            value={builderData.title}
            onChange={e => setBuilderData({ ...builderData, title: e.target.value })}
            placeholder="e.g. Lower Body Push"
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0a0a0a',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              color: '#00ff41',
              fontFamily: 'Chakra Petch',
              fontSize: '26px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* COACH'S NOTES */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '15px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
            {t('planner.notes')}
          </label>
          <textarea
            value={builderData.notes}
            onChange={e => setBuilderData({ ...builderData, notes: e.target.value })}
            placeholder="Add coaching notes or cues..."
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0a0a0a',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              color: '#00ff41',
              fontFamily: 'Chakra Petch',
              fontSize: '16px',
              minHeight: '60px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* WARMUP */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontFamily: 'Chakra Petch', color: '#ffb800', fontSize: '15px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
            {t('planner.warmup')}
          </label>
          <textarea
            value={builderData.warmup}
            onChange={e => setBuilderData({ ...builderData, warmup: e.target.value })}
            placeholder="e.g. 10 min elliptical"
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0a0a0a',
              border: '1px solid rgba(255, 184, 0, 0.3)',
              color: '#ffb800',
              fontFamily: 'Chakra Petch',
              fontSize: '16px',
              minHeight: '50px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* PRIMER */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontFamily: 'Chakra Petch', color: '#FF8C00', fontSize: '15px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
            PRIMER (Activation)
          </label>
          <textarea
            value={builderData.primer || ''}
            onChange={e => setBuilderData({ ...builderData, primer: e.target.value })}
            placeholder="e.g. 3x12 Band Pull-Aparts, 2x15 Glute Bridges, 2x10 Scap Push-ups"
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0a0a0a',
              border: '1px solid rgba(255, 140, 0, 0.3)',
              color: '#FF8C00',
              fontFamily: 'Chakra Petch',
              fontSize: '16px',
              minHeight: '50px',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: '10px', color: '#666', marginTop: '4px', fontFamily: 'Share Tech Mono' }}>
            Activation work after warmup, before main lifts
          </div>
        </div>

        {/* KEYBOARD SHORTCUTS HINT */}
        <div style={{ fontSize: '10px', color: '#444', marginBottom: '12px', fontFamily: 'Share Tech Mono', textAlign: 'right' }}>
          ⌘+Enter = +Exercise | ⌘+Shift+Enter = +Conditioning
        </div>

        {/* WORKOUT BLOCKS */}
        {builderData.blocks.length > 0 && (
          <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#0a0a0a', border: '1px solid rgba(0, 255, 65, 0.2)', borderRadius: '4px' }}>
            <h4 style={{ fontFamily: 'Chakra Petch', color: '#00ff41', margin: '0 0 16px 0', fontSize: '26px' }}>
              WORKOUT BLOCKS
            </h4>

            {builderData.blocks.map((block, idx) => {
              const label = blockLabels[idx];
              const lastLog = block.type === 'exercise' ? findLastExerciseLog(block.exerciseName) : null;

              return (
                <div key={block.id} style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#000', border: '1px solid rgba(0, 255, 65, 0.2)', borderRadius: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '15px', fontWeight: 'bold' }}>
                      {label}
                    </span>
                    <button
                      onClick={() => handleDeleteBlock(idx)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#ff4444',
                        color: '#fff',
                        border: 'none',
                        fontFamily: 'Share Tech Mono',
                        fontSize: '15px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>

                  {block.type === 'exercise' ? (
                    <>
                      {/* Exercise Name */}
                      <div style={{ marginBottom: '12px', position: 'relative' }}>
                        <label style={{ fontFamily: 'Share Tech Mono', color: '#00ff41', fontSize: '15px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                          Exercise Name
                        </label>
                        <input
                          type="text"
                          value={block.exerciseName}
                          onChange={e => {
                            handleUpdateBlock(idx, { exerciseName: e.target.value });
                            setAutocompleteFor(e.target.value.length > 0 ? idx : null);
                            setExerciseSearchQuery(e.target.value);
                            setShowExerciseAutocomplete(e.target.value.length > 0);
                          }}
                          placeholder="Search exercise..."
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#0a0a0a',
                            border: '1px solid rgba(0, 255, 65, 0.4)',
                            color: '#00ff41',
                            fontFamily: 'Share Tech Mono',
                            fontSize: '16px',
                            boxSizing: 'border-box',
                          }}
                        />

                        {showExerciseAutocomplete && autocompleteFor === idx && (
                          <div
                            ref={autocompleteRef}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              backgroundColor: '#0a0a0a',
                              border: '1px solid #00ff41',
                              zIndex: 100,
                              maxHeight: '150px',
                              overflowY: 'auto',
                            }}
                          >
                            {getFilteredExercises(block.exerciseName).map(ex => (
                              <div
                                key={ex.id}
                                onClick={() => handleExerciseSelect(ex.name, idx)}
                                style={{
                                  padding: '8px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid rgba(0, 255, 65, 0.2)',
                                  fontFamily: 'Share Tech Mono',
                                  fontSize: '26px',
                                  color: '#00ff41',
                                }}
                                onMouseEnter={e => {
                                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 255, 65, 0.1)';
                                }}
                                onMouseLeave={e => {
                                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                }}
                              >
                                {ex.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Last Log */}
                      {lastLog && (
                        <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: 'rgba(0, 255, 65, 0.05)', border: '1px solid rgba(0, 255, 65, 0.2)', borderRadius: '2px' }}>
                          <div style={{ fontFamily: 'Share Tech Mono', color: '#aaa', fontSize: '15px' }}>
                            Last logged: {lastLog.date} - {lastLog.prescription}
                          </div>
                        </div>
                      )}

                      {/* Prescription */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontFamily: 'Share Tech Mono', color: '#00ff41', fontSize: '15px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                          Prescription
                        </label>
                        <textarea
                          value={block.prescription}
                          onChange={e => handleUpdateBlock(idx, { prescription: e.target.value })}
                          placeholder="e.g. 3 REPS EVERY 90 SECONDS X 4"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#0a0a0a',
                            border: '1px solid rgba(0, 255, 65, 0.4)',
                            color: '#00ff41',
                            fontFamily: 'Share Tech Mono',
                            fontSize: '26px',
                            minHeight: '40px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Video URL */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontFamily: 'Share Tech Mono', color: '#ff4444', fontSize: '15px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                          Demo Video URL (YouTube)
                        </label>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="url"
                            value={block.videoUrl || ''}
                            onChange={e => handleUpdateBlock(idx, { videoUrl: e.target.value })}
                            placeholder={getVideoUrl(block.exerciseName) ? 'Auto-linked from library' : 'https://youtube.com/watch?v=...'}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              backgroundColor: '#0a0a0a',
                              border: '1px solid rgba(255, 68, 68, 0.2)',
                              color: '#ff4444',
                              fontFamily: 'Share Tech Mono',
                              fontSize: '16px',
                              boxSizing: 'border-box',
                            }}
                          />
                          {(block.videoUrl || getVideoUrl(block.exerciseName)) && (
                            <a
                              href={block.videoUrl || getVideoUrl(block.exerciseName)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="video-link"
                              style={{ whiteSpace: 'nowrap' }}
                            >
                              ▶ WATCH
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Superset Link */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={block.isLinkedToNext}
                          onChange={e => handleUpdateBlock(idx, { isLinkedToNext: e.target.checked })}
                          style={{ cursor: 'pointer' }}
                        />
                        <label style={{ fontFamily: 'Share Tech Mono', color: '#00ff41', fontSize: '15px', cursor: 'pointer' }}>
                          Superset to next exercise
                        </label>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Conditioning Format */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontFamily: 'Share Tech Mono', color: '#ffb800', fontSize: '15px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                          Format
                        </label>
                        <input
                          type="text"
                          value={block.format}
                          onChange={e => handleUpdateBlock(idx, { format: e.target.value })}
                          placeholder="e.g. 3 rounds for time"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#0a0a0a',
                            border: '1px solid rgba(255, 184, 0, 0.4)',
                            color: '#ffb800',
                            fontFamily: 'Share Tech Mono',
                            fontSize: '16px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Conditioning Description */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontFamily: 'Share Tech Mono', color: '#ffb800', fontSize: '15px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                          Description
                        </label>
                        <textarea
                          value={block.description}
                          onChange={e => handleUpdateBlock(idx, { description: e.target.value })}
                          placeholder="e.g. Run 400m&#10;10 box jumps&#10;15 Hang Power Clean"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#0a0a0a',
                            border: '1px solid rgba(255, 184, 0, 0.4)',
                            color: '#ffb800',
                            fontFamily: 'Share Tech Mono',
                            fontSize: '16px',
                            minHeight: '60px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ADD BLOCKS */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
          <button
            onClick={handleAddExerciseBlock}
            style={{
              padding: '8px 12px',
              backgroundColor: '#00ff41',
              color: '#000',
              border: 'none',
              fontFamily: 'Chakra Petch',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            + Exercise
          </button>
          <button
            onClick={handleAddConditioningBlock}
            style={{
              padding: '8px 12px',
              backgroundColor: '#ffb800',
              color: '#000',
              border: 'none',
              fontFamily: 'Chakra Petch',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            + Conditioning
          </button>
        </div>

        {/* COOLDOWN */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontFamily: 'Chakra Petch', color: '#ffb800', fontSize: '15px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
            {t('planner.cooldown')}
          </label>
          <textarea
            value={builderData.cooldown}
            onChange={e => setBuilderData({ ...builderData, cooldown: e.target.value })}
            placeholder="e.g. 5 min walk + stretch"
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0a0a0a',
              border: '1px solid rgba(255, 184, 0, 0.3)',
              color: '#ffb800',
              fontFamily: 'Chakra Petch',
              fontSize: '16px',
              minHeight: '50px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ACTION BUTTONS */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleCancelWorkout}
            style={{
              padding: '10px 16px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 68, 68, 0.5)',
              color: '#ff4444',
              fontFamily: 'Chakra Petch',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            {t('planner.cancel')}
          </button>
          <button
            onClick={handleSaveWorkout}
            style={{
              padding: '10px 16px',
              backgroundColor: '#00ff41',
              color: '#000',
              border: 'none',
              fontFamily: 'Chakra Petch',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            {t('planner.save')}
          </button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // DAY MENU COMPONENT
  // ============================================================================

  const DayMenu = ({ dateStr, workout, onClose }: { dateStr: string; workout?: Workout; onClose: () => void }) => {
    return (
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#0a0a0a',
          border: '1px solid #00ff41',
          zIndex: 1000,
          minWidth: '150px',
          boxShadow: '0 0 20px rgba(0, 255, 65, 0.1)',
        }}
      >
        {!workout ? (
          <>
            <button
              onClick={() => handleAddWorkout(dateStr)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#00ff41',
                fontFamily: 'Chakra Petch',
                fontSize: '15px',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: '1px solid rgba(0, 255, 65, 0.2)',
              }}
            >
              Workout
            </button>
            <button
              onClick={() => handleSetRestDay(dateStr)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#00ff41',
                fontFamily: 'Chakra Petch',
                fontSize: '15px',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: '1px solid rgba(0, 255, 65, 0.2)',
              }}
            >
              Rest Day
            </button>
            <button
              onClick={() => clipboard && handlePasteWorkout(dateStr)}
              disabled={!clipboard}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: clipboard ? '#ffb800' : '#999',
                fontFamily: 'Chakra Petch',
                fontSize: '15px',
                cursor: clipboard ? 'pointer' : 'not-allowed',
                textAlign: 'left',
              }}
            >
              Paste
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleEditWorkout(workout)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#00ff41',
                fontFamily: 'Chakra Petch',
                fontSize: '15px',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: '1px solid rgba(0, 255, 65, 0.2)',
              }}
            >
              Edit
            </button>
            <button
              onClick={() => handleCopyWorkout(workout)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#ffb800',
                fontFamily: 'Chakra Petch',
                fontSize: '15px',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: '1px solid rgba(255, 184, 0, 0.2)',
              }}
            >
              Copy
            </button>
            <button
              onClick={() => handleDeleteWorkout(dateStr)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#ff4444',
                fontFamily: 'Chakra Petch',
                fontSize: '15px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div
      style={{
        backgroundColor: '#030303',
        color: '#00ff41',
        fontFamily: 'Chakra Petch',
        padding: '24px',
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      {/* Ambient grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'linear-gradient(rgba(0,255,65,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.012) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        pointerEvents: 'none',
      }} />

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,255,65,0.06)', position: 'relative' }}>
        <div>
          <div style={{ fontFamily: 'Orbitron', color: '#00ff41', fontSize: '26px', fontWeight: 900, letterSpacing: '3px', textShadow: '0 0 8px rgba(0,255,65,0.3)' }}>
            {operator.callsign}
          </div>
          <div style={{ fontFamily: 'Share Tech Mono', color: '#666', fontSize: '15px', letterSpacing: '1px', marginTop: '4px' }}>
            TRAINING PLANNER // ACTIVE
          </div>
        </div>
        <button
          onClick={handleExportJson}
          style={{
            padding: '6px 14px',
            backgroundColor: 'transparent',
            color: '#00ff41',
            border: '1px solid rgba(0,255,65,0.2)',
            fontFamily: 'Share Tech Mono',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 700,
            letterSpacing: '1px',
            transition: 'all 0.2s ease',
          }}
        >
          EXPORT
        </button>
      </div>

      {/* ACTIVE BATTLE PLAN — Training Reference */}
      {operator.sitrep && operator.sitrep.generatedDate && (
        <BattlePlanRef sitrep={operator.sitrep} focus="training" compact={true}
          operator={operator} onUpdateOperator={onUpdateOperator} />
      )}

      {/* TODAY'S BRIEF — Training for Today */}
      {operator.dailyBrief && operator.dailyBrief.date && (
        <DailyBriefRef brief={operator.dailyBrief} focus="training" compact={true} />
      )}

      {/* VIEW MODE + NAVIGATION — uses .segmented from the design
          system. Layout matches the handoff Planner Day mock:
          previous chevron · [Month][Week][Day] segmented · Today
          accent button on the right. */}
      <div className="row-between" style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={handleNavigatePrevious}
          className="seg"
          aria-label="Previous"
          style={{ padding: '9px 12px' }}
        >
          ◀
        </button>

        <div className="segmented">
          {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => handleViewModeChange(mode)}
              className={`seg ${viewMode === mode ? 'active' : ''}`}
            >
              {mode}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setCurrentDate(new Date());
            setSelectedDate(null);
          }}
          className="seg"
          // "Today" gets the accent treatment per the handoff mock —
          // visually separates "jump to now" from the mode segments.
          style={{ borderColor: 'var(--border-green-strong)', color: 'var(--green)' }}
        >
          Today
        </button>

        <button
          type="button"
          onClick={handleNavigateNext}
          className="seg"
          aria-label="Next"
          style={{ padding: '9px 12px' }}
        >
          ▶
        </button>
      </div>

      {/* CONTENT */}
      <div style={{ marginBottom: '24px' }}>
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
      </div>
    </div>
  );
};

export default Planner;
