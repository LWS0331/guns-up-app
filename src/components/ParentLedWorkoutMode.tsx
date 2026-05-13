'use client';

// Parent-Led Workout Mode — full-screen execution surface for parents
// running a session with their junior operator (ages 4-10 who don't log in
// themselves). Mirrors the shape of Planner.renderWorkoutMode (stepped
// flow: warmup → drill blocks → cooldown → debrief) but adapts the per-
// step UI for the parent-led context:
//
//   • Each drill block shows a "cue card" (the prescription text, read
//     aloud verbatim) with a single big DONE button + optional notes
//     field — no per-set weight/reps/RPE inputs.
//   • Inline safety quick-buttons (Refusal / Pain / Form concern) append
//     directly to junior.juniorSafety.events so the parent can flag a
//     concern mid-drill without leaving the flow.
//   • Voice PTT (WorkoutPTT) is mounted so the parent can ask Gunny for
//     coaching cues without typing.
//   • Debrief captures qualitative effort (Effortful / Engaged /
//     Distracted / Refused) — mapped onto sessionRpe so the existing
//     autoregulation engine still gets a numeric input.
//
// Persistence: writes through onUpdateJunior with the same Workout/
// WorkoutResults shape adult mode uses, so dashboards/history pages
// keep working without a schema fork.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Operator,
  Workout,
  WorkoutResults,
  ExerciseBlock,
  ConditioningBlock,
  JuniorSafetyEvent,
  JuniorSafetyEventType,
  JuniorSafetyFlags,
} from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { parseMovementText } from '@/lib/parseMovementText';
import WarmupMovementCard from '@/components/WarmupMovementCard';
import WorkoutPTT from '@/components/WorkoutPTT';
import type { VoiceCommand } from '@/components/VoiceInput';

// Effort → sRPE mapping. Lets Foster's autoregulation engine consume
// parent-led sessions on the same scale as adult ones, without forcing
// a parent to think in a 1-10 numeric. Anchored at conservative values
// because junior sessions are short and play-based.
const EFFORT_TO_SRPE: Record<EffortLevel, number> = {
  effortful: 8,
  engaged: 6,
  distracted: 4,
  refused: 2,
};

type EffortLevel = 'effortful' | 'engaged' | 'distracted' | 'refused';

type ParentLedStep =
  | { kind: 'warmup' }
  | { kind: 'block'; idx: number }
  | { kind: 'cooldown' };

interface Props {
  parent: Operator;
  junior: Operator;
  workout: Workout;
  dateISO: string;
  onUpdateJunior: (updated: Operator) => void;
  onExit: () => void;
  onOpenGunny?: () => void;
  onSendGunnyMessage?: (text: string) => void;
}

export default function ParentLedWorkoutMode({
  parent,
  junior,
  workout,
  dateISO,
  onUpdateJunior,
  onExit,
  onOpenGunny,
  onSendGunnyMessage,
}: Props) {
  const { t } = useLanguage();

  // ── Derived steps ──────────────────────────────────────────────────
  // Built fresh each render from workout.warmup / blocks / cooldown so
  // mid-session edits (if we add them later) re-flow cleanly. Same
  // pattern as Planner.renderWorkoutMode.
  const steps = useMemo<ParentLedStep[]>(() => {
    const out: ParentLedStep[] = [];
    if (workout.warmup && parseMovementText(workout.warmup).length > 0) {
      out.push({ kind: 'warmup' });
    }
    workout.blocks.forEach((_, i) => out.push({ kind: 'block', idx: i }));
    if (workout.cooldown && parseMovementText(workout.cooldown).length > 0) {
      out.push({ kind: 'cooldown' });
    }
    if (out.length === 0) out.push({ kind: 'block', idx: 0 });
    return out;
  }, [workout]);

  const [stepIdx, setStepIdx] = useState(0);
  const safeStepIdx = Math.max(0, Math.min(stepIdx, steps.length - 1));
  const currentStep = steps[safeStepIdx];
  const isFirstStep = safeStepIdx === 0;
  const isLastStep = safeStepIdx === steps.length - 1;

  // Per-block parent-led state. Notes are optional free-text the parent
  // captures while the drill is happening; completed flips on DONE/SKIP.
  const [blockCompleted, setBlockCompleted] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        workout.blocks.map((b) => [b.id, !!workout.results?.blockResults?.[b.id]?.sets?.[0]?.completed])
      )
  );
  const [blockNotes, setBlockNotes] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        workout.blocks.map((b) => [b.id, workout.results?.blockResults?.[b.id]?.notes || ''])
      )
  );

  // Session timer — start at mount, freeze on debrief save. Stored as a
  // ref so we don't trigger re-renders just to update the displayed
  // duration; a 1-Hz tick state drives the displayed value.
  const sessionStartRef = useRef<number>(
    workout.results?.startTime ? new Date(workout.results.startTime).getTime() : Date.now()
  );
  const [tickNow, setTickNow] = useState<number>(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsedSec = Math.max(0, Math.floor((tickNow - sessionStartRef.current) / 1000));
  const elapsedDisplay = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`;

  // Safety toast — surfaces for 2.5s after the parent taps a quick-log
  // button so they get visual confirmation the event was captured.
  const [safetyToast, setSafetyToast] = useState<string | null>(null);
  useEffect(() => {
    if (!safetyToast) return;
    const id = setTimeout(() => setSafetyToast(null), 2500);
    return () => clearTimeout(id);
  }, [safetyToast]);

  // Debrief overlay state. effortLevel defaults to 'engaged' (the
  // middle-of-the-road choice) so a tired parent who just hits Save
  // still produces useful telemetry.
  const [showDebrief, setShowDebrief] = useState(false);
  const [effortLevel, setEffortLevel] = useState<EffortLevel>('engaged');
  const [debriefNotes, setDebriefNotes] = useState('');

  // ── Handlers ───────────────────────────────────────────────────────

  const goPrev = () => {
    if (!isFirstStep) setStepIdx(safeStepIdx - 1);
  };
  const goNext = () => {
    if (!isLastStep) {
      setStepIdx(safeStepIdx + 1);
    } else {
      setShowDebrief(true);
    }
  };

  const markBlockDone = (blockId: string, completed: boolean) => {
    setBlockCompleted((prev) => ({ ...prev, [blockId]: completed }));
    // Auto-advance after marking done, if there's a next step. Mirrors
    // the adult-mode "log set → step forward" affordance — fewer taps
    // to keep the session moving.
    if (completed && !isLastStep) {
      setTimeout(() => setStepIdx((s) => Math.min(s + 1, steps.length - 1)), 150);
    }
  };

  const updateBlockNotes = (blockId: string, value: string) => {
    setBlockNotes((prev) => ({ ...prev, [blockId]: value }));
  };

  // Safety quick-log. Appends a JuniorSafetyEvent to the junior's
  // juniorSafety.events array immediately (not deferred to debrief
  // save) — the parent expects the flag to "stick" the moment they
  // tap it, so a mid-session crash or back-tap doesn't lose the
  // observation.
  const logSafetyEvent = (type: JuniorSafetyEventType, label: string) => {
    const existing = (junior.juniorSafety as JuniorSafetyFlags | undefined)?.events || [];
    const event: JuniorSafetyEvent = {
      timestamp: new Date().toISOString(),
      type,
      detail: `Logged during ${workout.title || 'parent-led session'} by ${parent.callsign}`,
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
    };
    const updated: Operator = {
      ...junior,
      juniorSafety: { events: [...existing, event] },
    };
    onUpdateJunior(updated);
    setSafetyToast(`${label} · ${t('parent.workout.safety_logged')}`);
  };

  // Save & close. Writes the workout back with completed: true plus a
  // results blob keyed by block id. Each block carries a single
  // "completed" set — adult mode uses many sets per block but for
  // parent-led it's binary done/skip per drill, so a 1-element sets
  // array is the cleanest fit for the existing BlockResult shape.
  const handleSave = () => {
    const endIso = new Date().toISOString();
    const startIso = workout.results?.startTime || new Date(sessionStartRef.current).toISOString();
    const durationMin = Math.max(1, Math.round(elapsedSec / 60));

    const blockResults: WorkoutResults['blockResults'] = {};
    workout.blocks.forEach((b) => {
      const done = !!blockCompleted[b.id];
      const notes = (blockNotes[b.id] || '').trim() || undefined;
      blockResults[b.id] = {
        sets: [{ completed: done }],
        notes,
      };
    });

    const updatedWorkout: Workout = {
      ...workout,
      completed: true,
      results: {
        startTime: startIso,
        endTime: endIso,
        blockResults,
      },
      sessionRpe: EFFORT_TO_SRPE[effortLevel],
      sessionDurationMin: durationMin,
      // Append the parent's debrief note to the workout's own notes
      // field so it shows up in the recent-training history without a
      // schema add. Prefixed so it's distinguishable from the coach's
      // original session notes.
      notes: debriefNotes.trim()
        ? `${workout.notes || ''}${workout.notes ? '\n\n' : ''}[${parent.callsign}] ${debriefNotes.trim()}`
        : workout.notes,
    };

    const updatedJunior: Operator = {
      ...junior,
      workouts: {
        ...(junior.workouts || {}),
        [dateISO]: updatedWorkout,
      },
    };
    onUpdateJunior(updatedJunior);

    // Ascending victory chord — same audio cue the adult workout mode
    // plays on completion. Wrapped in a try/catch so a missing/blocked
    // AudioContext doesn't break the save flow.
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
    } catch {
      /* audio unavailable — silent fallback */
    }

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([100, 50, 100, 50, 200]);
      } catch {
        /* noop */
      }
    }

    onExit();
  };

  // Voice PTT — local-command hook for "next" / "previous" / "complete".
  // We don't try to parse "log set" style commands because parent-led
  // drills don't have sets; everything else falls through to Gunny via
  // onSendGunnyMessage so the parent can ask for coaching cues hands-
  // free ("Gunny, how do I cue a single-leg balance for a 4 year old?").
  const handleVoiceCommand = (command: VoiceCommand) => {
    if (command.type === 'next_exercise' || command.type === 'complete_workout') {
      goNext();
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────

  const completedCount = workout.blocks.filter((b) => blockCompleted[b.id]).length;
  const totalBlocks = workout.blocks.length;
  const completionPct = totalBlocks > 0 ? Math.round((completedCount / totalBlocks) * 100) : 0;

  const renderBlock = (block: ExerciseBlock | ConditioningBlock) => {
    const done = !!blockCompleted[block.id];
    const isExercise = block.type === 'exercise';
    const title = isExercise
      ? (block as ExerciseBlock).exerciseName?.trim() || `${t('parent.workout.block_label')} ${(block.sortOrder || 0) + 1}`
      : (block as ConditioningBlock).format || t('parent.workout.block_label');
    const cueText = isExercise
      ? (block as ExerciseBlock).prescription
      : (block as ConditioningBlock).description;

    return (
      <div
        key={block.id}
        style={{
          padding: 16,
          background: done ? 'rgba(0,255,65,0.06)' : 'rgba(0,184,212,0.04)',
          border: done ? '1px solid #00ff41' : '1px solid rgba(0,184,212,0.35)',
          borderLeft: done ? '3px solid #00ff41' : '3px solid #00b8d4',
          borderRadius: 4,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 10,
            color: done ? '#00ff41' : '#00b8d4',
            letterSpacing: 1.5,
            marginBottom: 6,
            textTransform: 'uppercase',
          }}
        >
          {t('parent.workout.cue_card')}
        </div>
        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 18,
            color: '#e0e0e0',
            marginBottom: 10,
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        {cueText && (
          <div
            style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 14,
              color: '#bbb',
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.35)',
              borderRadius: 3,
              marginBottom: 14,
            }}
          >
            {cueText.replace(/\\n/g, '\n')}
          </div>
        )}
        <textarea
          value={blockNotes[block.id] || ''}
          onChange={(e) => updateBlockNotes(block.id, e.target.value)}
          placeholder={t('parent.workout.notes_placeholder')}
          style={{
            width: '100%',
            minHeight: 56,
            padding: '8px 10px',
            background: '#050505',
            border: '1px solid #222',
            borderRadius: 3,
            color: '#e0e0e0',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 12,
            lineHeight: 1.5,
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            marginBottom: 12,
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => markBlockDone(block.id, !done)}
            style={{
              flex: 1,
              padding: '14px 16px',
              background: done ? 'rgba(0,255,65,0.18)' : '#00ff41',
              color: done ? '#00ff41' : '#000',
              border: done ? '1px solid #00ff41' : 'none',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1.5,
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {t('parent.workout.done')}
          </button>
          {!done && (
            <button
              type="button"
              onClick={() => {
                setBlockCompleted((prev) => ({ ...prev, [block.id]: false }));
                if (!isLastStep) setStepIdx((s) => Math.min(s + 1, steps.length - 1));
              }}
              style={{
                padding: '14px 18px',
                background: 'transparent',
                color: '#888',
                border: '1px solid #333',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 12,
                letterSpacing: 1.2,
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {t('parent.workout.skip')}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderWarmupCooldown = (variant: 'warmup' | 'cooldown') => {
    const text = variant === 'warmup' ? workout.warmup : workout.cooldown;
    if (!text) return null;
    const movements = parseMovementText(text);
    if (movements.length === 0) return null;
    return (
      <div
        style={{
          padding: 14,
          background: 'rgba(255,140,0,0.04)',
          border: '1px solid rgba(255,140,0,0.3)',
          borderLeft: '3px solid #FF8C00',
          borderRadius: 4,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 11,
            color: '#FF8C00',
            letterSpacing: 1.8,
            marginBottom: 10,
            textTransform: 'uppercase',
          }}
        >
          // {variant === 'warmup' ? t('parent.workout.warmup_title') : t('parent.workout.cooldown_title')} · {movements.length}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {movements.map((m, i) => (
            <WarmupMovementCard key={`${variant}-${i}`} movement={m} variant={variant} />
          ))}
        </div>
      </div>
    );
  };

  // ── Empty workout fallback ─────────────────────────────────────────
  if (!workout || workout.blocks.length === 0 && !workout.warmup && !workout.cooldown) {
    return (
      <div style={{ padding: 24, color: '#888', fontFamily: 'Share Tech Mono, monospace', textAlign: 'center' }}>
        <div style={{ marginBottom: 12 }}>{t('parent.workout.empty_no_workout')}</div>
        <button
          type="button"
          onClick={onExit}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: '1px solid #888',
            color: '#888',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 12,
            letterSpacing: 1,
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          {t('parent.workout.exit')}
        </button>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────
  return (
    <div
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '12px 16px 120px 16px',
        color: '#e0e0e0',
        fontFamily: 'Share Tech Mono, monospace',
      }}
    >
      {/* Header — eyebrow + Gunny + Exit. Matches the Workout Mode
          treatment from Planner (amber eyebrow, btn-amber Gunny,
          ghost Exit) but recolored cyan to inherit the parent-led
          banner palette. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 10,
            color: '#00b8d4',
            letterSpacing: 1.8,
            textTransform: 'uppercase',
          }}
        >
          {t('parent.workout.eyebrow_active')} · {junior.callsign}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {onOpenGunny && (
            <button
              type="button"
              onClick={onOpenGunny}
              style={{
                padding: '6px 12px',
                background: 'rgba(255,140,0,0.12)',
                border: '1px solid #FF8C00',
                color: '#FF8C00',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 11,
                letterSpacing: 1,
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              ⚡ {t('parent.workout.gunny')}
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid #444',
              color: '#888',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 11,
              letterSpacing: 1,
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {t('parent.workout.exit')}
          </button>
        </div>
      </div>

      {/* Title + session timer */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 22,
            color: '#00ff41',
            letterSpacing: 1,
            textShadow: '0 0 12px rgba(0,255,65,0.4)',
            lineHeight: 1.2,
          }}
        >
          {workout.title || t('parent.workout.block_label')}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#888' }}>
          <span>
            {t('parent.workout.session_timer')} · {elapsedDisplay}
          </span>
          <span>
            {completedCount}/{totalBlocks} · {completionPct}%
          </span>
        </div>
      </div>

      {/* Stepper progress bar — 2px line that fills as the parent
          advances through warmup → blocks → cooldown. Visual
          continuity with adult mode's vitals strip. */}
      <div
        style={{
          height: 2,
          background: '#1a1a1a',
          borderRadius: 1,
          marginBottom: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${steps.length > 0 ? Math.round(((safeStepIdx + 1) / steps.length) * 100) : 0}%`,
            height: '100%',
            background: '#00b8d4',
            transition: 'width 200ms ease',
          }}
        />
      </div>

      {/* Active step */}
      {currentStep.kind === 'warmup' && renderWarmupCooldown('warmup')}
      {currentStep.kind === 'cooldown' && renderWarmupCooldown('cooldown')}
      {currentStep.kind === 'block' && workout.blocks[currentStep.idx] && renderBlock(workout.blocks[currentStep.idx])}

      {/* Stepper footer */}
      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button
          type="button"
          onClick={goPrev}
          disabled={isFirstStep}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'transparent',
            border: '1px solid #333',
            color: isFirstStep ? '#444' : '#888',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 12,
            letterSpacing: 1.2,
            borderRadius: 3,
            cursor: isFirstStep ? 'not-allowed' : 'pointer',
          }}
        >
          ← {t('parent.workout.previous')}
        </button>
        <button
          type="button"
          onClick={goNext}
          style={{
            flex: 2,
            padding: '12px 16px',
            background: isLastStep ? '#00ff41' : '#00b8d4',
            color: '#000',
            border: 'none',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.5,
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          {isLastStep ? t('parent.workout.complete') : `${t('parent.workout.next')} →`}
        </button>
      </div>

      {/* Safety quick-log row — persistent across steps. Three
          one-tap buttons that append a JuniorSafetyEvent to the
          junior's juniorSafety.events array immediately. */}
      <div
        style={{
          marginTop: 24,
          padding: 12,
          background: 'rgba(255,68,68,0.04)',
          border: '1px solid rgba(255,68,68,0.25)',
          borderRadius: 4,
        }}
      >
        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 9,
            color: '#ff6666',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          {t('parent.workout.safety_title')}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(
            [
              { type: 'refusal', label: t('parent.workout.safety_refusal'), color: '#888' },
              { type: 'pain_report', label: t('parent.workout.safety_pain'), color: '#ff8800' },
              { type: 'red_flag', label: t('parent.workout.safety_form'), color: '#ffaa00' },
            ] as { type: JuniorSafetyEventType; label: string; color: string }[]
          ).map((b) => (
            <button
              key={b.type}
              type="button"
              onClick={() => logSafetyEvent(b.type, b.label)}
              style={{
                flex: '1 1 90px',
                padding: '8px 10px',
                background: 'transparent',
                border: `1px solid ${b.color}`,
                color: b.color,
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 10,
                letterSpacing: 1.2,
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              ⚠ {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Safety toast */}
      {safetyToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 16px',
            background: 'rgba(0,0,0,0.92)',
            border: '1px solid #ff8800',
            borderRadius: 4,
            color: '#ff8800',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 12,
            zIndex: 1000,
            maxWidth: 300,
            textAlign: 'center',
          }}
        >
          {safetyToast}
        </div>
      )}

      {/* Voice PTT — hold-to-talk button. Local commands (next/complete)
          fire stepper actions; everything else routes to Gunny. */}
      {onSendGunnyMessage && (
        <WorkoutPTT onSend={onSendGunnyMessage} onLocalCommand={handleVoiceCommand} disabled={showDebrief} />
      )}

      {/* ── Debrief overlay ─────────────────────────────────────────── */}
      {showDebrief && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.95)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '40px 20px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 26,
              fontWeight: 900,
              color: '#00ff41',
              letterSpacing: 3,
              marginBottom: 8,
              textShadow: '0 0 20px rgba(0,255,65,0.5)',
              textAlign: 'center',
            }}
          >
            {t('parent.workout.complete_title')}
          </div>
          <div
            style={{
              fontFamily: 'Chakra Petch, sans-serif',
              fontSize: 14,
              color: '#FF8C00',
              marginBottom: 24,
              textAlign: 'center',
            }}
          >
            {t('parent.workout.complete_subtitle').replace('{callsign}', junior.callsign)}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              width: '100%',
              maxWidth: 380,
              marginBottom: 24,
            }}
          >
            {[
              { label: t('parent.workout.complete_duration'), value: `${Math.max(1, Math.round(elapsedSec / 60))} ${t('parent.workout.complete_unit_min')}` },
              { label: t('parent.workout.complete_drills'), value: `${completedCount}/${totalBlocks}` },
              { label: t('parent.workout.complete_completion'), value: `${completionPct}%` },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  padding: 12,
                  background: '#111',
                  border: '1px solid #222',
                  borderRadius: 6,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    fontSize: 8,
                    color: '#666',
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#00ff41',
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Effort dropdown — qualitative single-choice. Maps to
              sessionRpe via EFFORT_TO_SRPE on save so the
              autoregulation engine still consumes a numeric. */}
          <div style={{ width: '100%', maxWidth: 380, marginBottom: 18 }}>
            <div
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 10,
                color: '#FF8C00',
                letterSpacing: 1,
                marginBottom: 10,
                textAlign: 'center',
              }}
            >
              {t('parent.workout.effort_question')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(
                [
                  { id: 'effortful', label: t('parent.workout.effort_effortful'), color: '#00ff41' },
                  { id: 'engaged', label: t('parent.workout.effort_engaged'), color: '#00b8d4' },
                  { id: 'distracted', label: t('parent.workout.effort_distracted'), color: '#ffb800' },
                  { id: 'refused', label: t('parent.workout.effort_refused'), color: '#ff4d4d' },
                ] as { id: EffortLevel; label: string; color: string }[]
              ).map((opt) => {
                const selected = effortLevel === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setEffortLevel(opt.id)}
                    style={{
                      padding: '12px 14px',
                      background: selected ? `${opt.color}22` : 'transparent',
                      border: `1px solid ${selected ? opt.color : '#333'}`,
                      color: selected ? opt.color : '#888',
                      fontFamily: 'Share Tech Mono, monospace',
                      fontSize: 13,
                      borderRadius: 3,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            value={debriefNotes}
            onChange={(e) => setDebriefNotes(e.target.value)}
            placeholder={t('parent.workout.debrief_notes_placeholder')}
            style={{
              width: '100%',
              maxWidth: 380,
              minHeight: 70,
              padding: '10px 12px',
              background: '#050505',
              border: '1px solid #222',
              borderRadius: 3,
              color: '#e0e0e0',
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 13,
              lineHeight: 1.5,
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
              marginBottom: 18,
            }}
          />

          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '14px 36px',
              background: '#00ff41',
              color: '#000',
              border: 'none',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 1.5,
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {t('parent.workout.debrief_save')}
          </button>
        </div>
      )}
    </div>
  );
}
