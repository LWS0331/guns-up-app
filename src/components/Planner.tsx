'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Operator, Workout, WorkoutBlock, ExerciseBlock, ConditioningBlock, DayTag, ViewMode, WorkoutResults, BlockResult, SetResult } from '@/lib/types';
import { EXERCISE_LIBRARY, getVideoUrl } from '@/data/exercises';
import BattlePlanRef from '@/components/BattlePlanRef';
import DailyBriefRef from '@/components/DailyBriefRef';
import VoiceInput, { VoiceCommand } from '@/components/VoiceInput';

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
  onWorkoutModeChange?: (state: WorkoutModeState) => void;
}

const Planner: React.FC<PlannerProps> = ({ operator, onUpdateOperator, onOpenGunny, onWorkoutModeChange }) => {
  const { t } = useLanguage();
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
  const [workoutResults, setWorkoutResults] = useState<Record<string, { sets: { weight: number; reps: number; completed: boolean }[] }>>({});

  // Voice command state
  const [activeListening, setActiveListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const voiceFeedbackTimer = useRef<NodeJS.Timeout | null>(null);

  const showVoiceFeedback = useCallback((msg: string) => {
    setVoiceFeedback(msg);
    if (voiceFeedbackTimer.current) clearTimeout(voiceFeedbackTimer.current);
    voiceFeedbackTimer.current = setTimeout(() => setVoiceFeedback(null), 3000);
  }, []);

  // Handle voice commands during workout mode
  const handleVoiceCommand = useCallback((command: VoiceCommand) => {
    if (!workoutMode) return;
    const dateStr = selectedDate || new Date().toISOString().split('T')[0];
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

  // TTS — Gunny speaks back
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 0.85;
    utterance.volume = 0.9;
    // Prefer a deeper male voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Daniel') || v.name.includes('Alex') || v.name.includes('Google US English'));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  }, []);

  // HR Zone Tracking state
  const [currentHR, setCurrentHR] = useState<number | null>(null);
  const [targetZone, setTargetZone] = useState<number>(3); // default Zone 3
  const [hrSource, setHrSource] = useState<'wearable' | 'manual' | 'none'>('none');
  const [showHrPanel, setShowHrPanel] = useState(true);
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
    const dateStr = selectedDate || new Date().toISOString().split('T')[0];
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

  // Poll wearable for HR data during workout mode
  useEffect(() => {
    if (!workoutMode) {
      if (hrPollRef.current) clearInterval(hrPollRef.current);
      setHrSource('none');
      setCurrentHR(null);
      setHrHistory([]);
      return;
    }

    // Try to fetch HR from wearable API
    const fetchHR = async () => {
      try {
        const res = await fetch('/api/wearables/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operatorId: operator.id }),
        });
        if (res.ok) {
          const data = await res.json();
          const hr = data?.syncSnapshot?.activity?.heartRate?.avg;
          if (hr && typeof hr === 'number') {
            setCurrentHR(hr);
            setHrSource('wearable');
            setHrHistory(prev => [...prev.slice(-60), { hr, time: Date.now() }]);
          }
        }
      } catch {
        // Wearable not available — user can enter manually
      }
    };

    fetchHR();
    hrPollRef.current = setInterval(fetchHR, 30000); // poll every 30s

    return () => {
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
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
      <div>
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Orbitron', color: '#00ff41', margin: 0, fontSize: '26px', fontWeight: 900, letterSpacing: '4px', textShadow: '0 0 8px rgba(0,255,65,0.2)' }}>
            {monthName.toUpperCase()}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? '2px' : '4px', marginBottom: isMobile ? '2px' : '4px' }}>
          {(isMobile ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']).map((day, i) => (
            <div key={`${day}-${i}`} style={{
              textAlign: 'center',
              fontFamily: 'Orbitron',
              color: '#666',
              fontSize: isMobile ? '6px' : '7px',
              fontWeight: 700,
              padding: isMobile ? '4px' : '8px',
              letterSpacing: isMobile ? '1px' : '2px',
            }}>
              {day}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? '2px' : '4px' }}>
          {monthDates.map(week =>
            week.map(date => {
              const dateStr = formatDate(date);
              const workout = getWorkoutForDate(dateStr);
              const tag = getDayTag(dateStr);
              const isCurrentDay = isToday(date);
              const isInMonth = isCurrentMonth(date);

              return (
                <div
                  key={dateStr}
                  onClick={() => { setSelectedDate(dateStr); setViewMode('day'); }}
                  onContextMenu={e => { e.preventDefault(); setShowDayMenu(dateStr); }}
                  style={{
                    minHeight: isMobile ? '60px' : '90px',
                    padding: isMobile ? '4px' : '8px',
                    backgroundColor: isCurrentDay ? 'rgba(0,255,65,0.04)' : 'rgba(5,5,5,0.6)',
                    border: isCurrentDay ? '1px solid rgba(0,255,65,0.3)' : '1px solid rgba(0,255,65,0.04)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,255,65,0.2)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,255,65,0.03)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = isCurrentDay ? 'rgba(0,255,65,0.3)' : 'rgba(0,255,65,0.04)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = isCurrentDay ? 'rgba(0,255,65,0.04)' : 'rgba(5,5,5,0.6)';
                  }}
                >
                  {/* Today left accent */}
                  {isCurrentDay && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', backgroundColor: '#00ff41', boxShadow: '0 0 6px rgba(0,255,65,0.4)' }} />
                  )}

                  <div style={{
                    fontFamily: 'Share Tech Mono',
                    fontSize: '15px',
                    fontWeight: 700,
                    color: isCurrentDay ? '#00ff41' : isInMonth ? '#888' : '#222',
                    marginBottom: '6px',
                  }}>
                    {date.getDate()}
                  </div>

                  {workout && (
                    <div style={{
                      fontFamily: 'Chakra Petch',
                      fontSize: '15px',
                      color: '#00ff41',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '4px',
                      paddingLeft: '6px',
                      borderLeft: '1px solid rgba(0,255,65,0.3)',
                    }}>
                      {workout.title}
                    </div>
                  )}

                  {tag && (
                    <div style={{
                      display: 'inline-block',
                      padding: '1px 5px',
                      backgroundColor: `${getTagColor(tag.color)}10`,
                      border: `1px solid ${getTagColor(tag.color)}40`,
                      fontFamily: 'Share Tech Mono',
                      fontSize: '15px',
                      color: getTagColor(tag.color),
                      letterSpacing: '0.5px',
                    }}>
                      {tag.note.substring(0, 10)}
                    </div>
                  )}

                  {showDayMenu === dateStr && (
                    <DayMenu dateStr={dateStr} workout={workout} onClose={() => setShowDayMenu(null)} />
                  )}
                </div>
              );
            })
          )}
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
      <div>
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Orbitron', color: '#00ff41', margin: '0 0 20px 0', fontSize: '26px' }}>
            Week: {weekStart} - {weekEnd}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
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
                style={{
                  minHeight: '200px',
                  padding: '12px',
                  backgroundColor: isCurrentDay ? 'rgba(0, 255, 65, 0.1)' : '#030303',
                  border: isCurrentDay ? '2px solid #00ff41' : '1px solid rgba(0, 255, 65, 0.2)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '15px', fontWeight: 'bold', marginBottom: '8px' }}>
                  {dayName} {date.getDate()}
                </div>

                {workout ? (
                  <div>
                    <div style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '15px', fontWeight: 'bold', marginBottom: '2px' }}>
                      {workout.title}
                    </div>
                    <div style={{ fontFamily: 'Share Tech Mono', fontSize: '12px', color: '#aaa' }}>
                      {workout.blocks.length} blocks
                    </div>
                  </div>
                ) : tag ? (
                  <div style={{ fontFamily: 'Chakra Petch', color: getTagColor(tag.color), fontSize: '15px' }}>
                    {tag.note}
                  </div>
                ) : (
                  <div style={{ fontFamily: 'Share Tech Mono', color: '#999', fontSize: '15px' }}>No workout</div>
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
  // Rest timer countdown
  useEffect(() => {
    if (!restRunning || restTimer <= 0) {
      if (restTimer <= 0 && restRunning) setRestRunning(false);
      return;
    }
    const interval = setInterval(() => setRestTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [restRunning, restTimer]);

  // Initialize workout results when entering workout mode
  useEffect(() => {
    if (!workoutMode) return;
    const dateStr = selectedDate || formatDate(currentDate);
    const workout = getWorkoutForDate(dateStr);
    if (!workout) return;
    if (Object.keys(workoutResults).length === 0) {
      const initial = workout.results?.blockResults
        ? Object.fromEntries(Object.entries(workout.results.blockResults).map(([k, v]) => [k, { sets: v.sets.map(s => ({ weight: s.weight || 0, reps: s.reps || 0, completed: s.completed })) }]))
        : Object.fromEntries(workout.blocks.map(b => [b.id, { sets: [{ weight: 0, reps: 0, completed: false }] }]));
      setWorkoutResults(initial);
    }
  }, [workoutMode, selectedDate]);

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
            { sets: data.sets.map(s => ({ weight: s.weight, reps: s.reps, completed: s.completed })) }
          ])
        ),
      };
      const updated = { ...operator };
      updated.workouts[dateStr] = { ...workout, results: savedResults, completed: true };
      onUpdateOperator(updated);
      setWorkoutMode(false);
      setWorkoutResults({});
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
            <button onClick={() => setWorkoutMode(false)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #666', color: '#888', fontFamily: 'Share Tech Mono', cursor: 'pointer', fontSize: 11 }}>EXIT</button>
          </div>
        </div>
        <h3 style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: 16, margin: '0 0 12px 0' }}>{workout.title}</h3>

        {/* ═══ VOICE COMMAND BAR ═══ */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          padding: '8px 12px',
          background: activeListening ? 'rgba(0,255,65,0.04)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${activeListening ? 'rgba(0,255,65,0.25)' : '#1C2E1C'}`,
          borderRadius: 6,
          transition: 'all 0.3s',
        }}>
          <VoiceInput
            onTranscript={(text) => {
              // Non-command voice goes to Gunny Assist
              if (onOpenGunny) onOpenGunny();
            }}
            onVoiceCommand={handleVoiceCommand}
            activeListening={activeListening}
            compact
          />
          <button
            onClick={() => setActiveListening(!activeListening)}
            style={{
              flex: 1,
              padding: '6px 0',
              background: activeListening
                ? 'linear-gradient(90deg, rgba(0,255,65,0.1), rgba(0,255,65,0.05))'
                : 'transparent',
              border: 'none',
              color: activeListening ? '#00ff41' : '#6B7B6B',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.5,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            {activeListening ? '● LISTENING — Say "log 135 for 10" or "rest 90 seconds"' : 'TAP TO ENABLE VOICE COMMANDS'}
          </button>
          {activeListening && (
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#00ff41',
              boxShadow: '0 0 6px rgba(0,255,65,0.8)',
              animation: 'voicePulse 2s infinite',
              flexShrink: 0,
            }} />
          )}
        </div>

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

        {/* Rest Timer */}
        <div style={{ textAlign: 'center', marginBottom: 20, padding: 16, background: restRunning ? '#1a1a0a' : '#0a0a0a', border: `1px solid ${restRunning ? '#FF8C00' : '#333'}`, borderRadius: 8, transition: 'all 0.3s' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: restRunning ? 48 : 24, color: restTimer <= 10 && restRunning ? '#ff4444' : '#FF8C00', transition: 'all 0.3s' }}>
            {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
            {[30, 60, 90, 120, 180].map(sec => (
              <button key={sec} onClick={() => { setRestTimer(sec); setRestRunning(true); }}
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
              <div style={{ marginTop: 8, height: 30, display: 'flex', alignItems: 'end', gap: 1 }}>
                {hrHistory.slice(-20).map((h, i) => {
                  const minH = Math.min(...hrHistory.slice(-20).map(x => x.hr));
                  const maxH = Math.max(...hrHistory.slice(-20).map(x => x.hr));
                  const range = maxH - minH || 1;
                  const pct = ((h.hr - minH) / range) * 100;
                  return (
                    <div key={i} style={{
                      flex: 1, height: `${Math.max(10, pct)}%`,
                      background: getCurrentZone(h.hr).color,
                      borderRadius: '1px 1px 0 0', opacity: 0.7,
                      transition: 'height 0.3s',
                    }} />
                  );
                })}
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

        {/* Exercise blocks in execution mode */}
        {workout.blocks.map((block, idx) => {
          if (block.type !== 'exercise') return (
            <div key={block.id} style={{ padding: 12, marginBottom: 12, background: '#0a0a0a', border: '1px solid rgba(255, 184, 0, 0.3)', borderRadius: 4 }}>
              <div style={{ fontFamily: 'Chakra Petch', color: '#ffb800', fontSize: 13, fontWeight: 'bold' }}>CONDITIONING</div>
              <div style={{ fontFamily: 'Share Tech Mono', color: '#ddd', fontSize: 13, marginTop: 4 }}>{block.format}: {block.description}</div>
            </div>
          );

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
              {block.videoUrl && (
                <a href={block.videoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: '#666', fontFamily: 'Share Tech Mono', textDecoration: 'none' }}>
                  Form video
                </a>
              )}
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
                      setResults(prev => {
                        const blockData = { ...prev[block.id] };
                        const sets = [...blockData.sets];
                        sets[si] = { ...sets[si], completed: !sets[si].completed };
                        return { ...prev, [block.id]: { sets } };
                      });
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
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
      <div>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontFamily: 'Orbitron', color: '#00ff41', margin: '0 0 10px 0', fontSize: '26px' }}>
            {dayName}
          </h2>
        </div>

        {workoutMode && workout ? (
          renderWorkoutMode()
        ) : showWorkoutBuilder ? (
          renderWorkoutBuilder()
        ) : workout ? (
          <div style={{ padding: '20px', backgroundColor: '#0a0a0a', border: '1px solid rgba(0, 255, 65, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontFamily: 'Chakra Petch', color: '#00ff41', margin: 0 }}>{workout.title}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleEditWorkout(workout)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#00ff41',
                    color: '#000',
                    border: 'none',
                    fontFamily: 'Chakra Petch',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: 'bold',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setWorkoutMode(true);
                    setSelectedDate(dateStr);
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#00ff41',
                    color: '#000',
                    border: 'none',
                    fontFamily: 'Chakra Petch',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: 'bold',
                  }}
                >
                  START
                </button>
                <button
                  onClick={() => handleDeleteWorkout(dateStr)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ff4444',
                    color: '#000',
                    border: 'none',
                    fontFamily: 'Chakra Petch',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: 'bold',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            {workout.notes && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1.5px' }}>
                  COACH'S NOTES
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', color: '#ddd', fontSize: '13px', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {workout.notes}
                </div>
              </div>
            )}

            {workout.warmup && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'Chakra Petch', color: '#ffb800', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1.5px' }}>
                  WARMUP
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', color: '#ddd', fontSize: '13px', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {workout.warmup}
                </div>
              </div>
            )}

            {workout.primer && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'Chakra Petch', color: '#FF8C00', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1.5px' }}>
                  PRIMER
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', color: '#ddd', fontSize: '13px', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {workout.primer}
                </div>
              </div>
            )}

            {workout.blocks.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', letterSpacing: '1.5px' }}>
                  WORKOUT BLOCKS
                </div>
                {workout.blocks.map((block, idx) => {
                  const label = getBlockLabels(workout.blocks)[idx];
                  if (block.type === 'exercise') {
                    const vidUrl = block.videoUrl || getVideoUrl(block.exerciseName);
                    const parsed = parsePrescription(block.prescription);
                    return (
                      <div key={block.id} style={{
                        marginBottom: '8px',
                        padding: '10px 12px',
                        borderLeft: '3px solid #00ff41',
                        background: 'rgba(0,255,65,0.04)',
                        borderRadius: '0 4px 4px 0',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '15px', fontWeight: 700 }}>
                            {label}) {block.exerciseName}
                          </div>
                          {vidUrl && (
                            <a href={vidUrl} target="_blank" rel="noopener noreferrer" className="video-link" style={{ fontSize: '10px' }}>
                              ▶ DEMO
                            </a>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {parsed.map((tag, ti) => (
                            <TagPill key={ti} tag={tag} />
                          ))}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={block.id} style={{
                        marginBottom: '8px',
                        padding: '10px 12px',
                        borderLeft: '3px solid #ffb800',
                        background: 'rgba(255,184,0,0.04)',
                        borderRadius: '0 4px 4px 0',
                      }}>
                        <div style={{ fontFamily: 'Chakra Petch', color: '#ffb800', fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>
                          {block.format}
                        </div>
                        <div style={{
                          fontFamily: 'Share Tech Mono',
                          color: '#aaa',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                        }}>
                          {block.description}
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            )}

            {workout.cooldown && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'Chakra Petch', color: '#ffb800', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1.5px' }}>
                  COOLDOWN
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', color: '#ddd', fontSize: '13px', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {workout.cooldown}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <p style={{ fontFamily: 'Chakra Petch' }}>No workout for this day</p>
            <button
              onClick={() => handleAddWorkout(dateStr)}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                backgroundColor: '#00ff41',
                color: '#000',
                border: 'none',
                fontFamily: 'Chakra Petch',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Create Workout
            </button>
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

      {/* VIEW MODE + NAVIGATION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
        <button
          onClick={handleNavigatePrevious}
          style={{
            padding: '6px 14px',
            backgroundColor: 'transparent',
            color: '#888',
            border: '1px solid rgba(0,255,65,0.08)',
            fontFamily: 'Orbitron',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 700,
            transition: 'all 0.2s ease',
          }}
        >
          ◀
        </button>

        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => handleViewModeChange(mode)}
              style={{
                padding: '6px 16px',
                backgroundColor: viewMode === mode ? 'rgba(0,255,65,0.06)' : 'transparent',
                color: viewMode === mode ? '#00ff41' : '#3a3a3a',
                border: viewMode === mode ? '1px solid rgba(0,255,65,0.2)' : '1px solid transparent',
                fontFamily: 'Orbitron',
                fontSize: '15px',
                fontWeight: viewMode === mode ? 800 : 500,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                transition: 'all 0.2s ease',
              }}
            >
              {mode}
            </button>
          ))}

          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(0,255,65,0.1)', margin: '0 8px' }} />

          <button
            onClick={() => {
              setCurrentDate(new Date());
              setSelectedDate(null);
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              color: '#00ff41',
              border: '1px solid rgba(0,255,65,0.15)',
              fontFamily: 'Share Tech Mono',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '1px',
              transition: 'all 0.2s ease',
            }}
          >
            TODAY
          </button>
        </div>

        <button
          onClick={handleNavigateNext}
          style={{
            padding: '6px 14px',
            backgroundColor: 'transparent',
            color: '#888',
            border: '1px solid rgba(0,255,65,0.08)',
            fontFamily: 'Orbitron',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 700,
            transition: 'all 0.2s ease',
          }}
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
