'use client';

// VitalsSticky — Workout Mode tactical heads-up bar.
//
// Mounts as a sticky top region during workoutMode. Per the
// April 24 canonical screenshot the layout is:
//
//   ┌─────────────────────────────────────────┐
//   │ // VITALS · LIVE          ● REC 18:42   │
//   ├──────────┬──────────┬───────────────────┤
//   │ // REST  │  145 BPM │ // SET · LOG      │
//   │  · TGT   │ ─sparkline│       2/4         │
//   │  2:30    │ IN RANGE │                   │
//   │  1:12    │   · Z3   │                   │
//   │ COUNTDOWN│           │                   │
//   ├──────────┴──────────┴───────────────────┤
//   │   Z1   Z2   [Z3]   Z4   Z5              │
//   ├─────────────────────────────────────────┤
//   │  PAUSE   +30S   RESET   ▼ HUD           │
//   └─────────────────────────────────────────┘
//
// The expanded HR panel + per-exercise set logging stay below the
// scroll boundary — this HUD only surfaces the live state. ▼ HUD
// action toggles the .vitals-expand region (full HRZoneGauge).

import React, { useEffect, useState } from 'react';
import { type HrZoneDef, type HrSample } from './HRZoneGauge';
import Icon from './Icons';

export interface VitalsStickyProps {
  /** Rest timer state (managed by parent). */
  restTimer: number;          // seconds remaining
  restTimerMax: number;       // initial rest in seconds
  restRunning: boolean;
  timerAlarm?: boolean;       // briefly true when timer hits 0

  /** HR + zone state. */
  currentHR: number | null;
  targetZone: number;
  hrSource: 'wearable' | 'manual' | 'none' | string;
  zones: HrZoneDef[];
  hrHistory: HrSample[];
  onSetTargetZone: (zone: number) => void;
  onManualHR: (hr: number) => void;

  /** Current set indicator (1-based). */
  currentSetIndex: number;    // 0-based slot for "now" pip
  totalSets: number;          // total sets in active block

  /** Action row callbacks. Parent decides which to wire. */
  onTalk?: () => void;        // PTT / open Gunny voice
  onDemo?: () => void;        // open exercise demo video
  onNotes?: () => void;       // jump to notes input
  onSkip?: () => void;        // skip current set / advance

  /** Workout start ISO so the HUD can show a session-duration "REC" timer. */
  workoutStartTime?: string;

  /** Rest-timer controls — Pause / +30s / Reset, all optional. */
  onPauseTimer?: () => void;
  onAddRest?: () => void;
  onResetTimer?: () => void;
}

const formatMMSS = (sec: number): string => {
  const m = Math.max(0, Math.floor(sec / 60));
  const s = Math.max(0, sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function VitalsSticky({
  restTimer,
  restTimerMax,
  restRunning,
  timerAlarm = false,
  currentHR,
  targetZone,
  hrSource,
  zones,
  hrHistory,
  onSetTargetZone,
  onManualHR,
  currentSetIndex,
  totalSets,
  workoutStartTime,
  onPauseTimer,
  onAddRest,
  onResetTimer,
}: VitalsStickyProps) {
  // Active HR zone — used both for the center gauge tint and the
  // bottom zone strip glow. Returns null if currentHR is unset.
  const activeZone = currentHR
    ? zones.find(z => currentHR >= z.min && currentHR <= z.max) || null
    : null;

  // Rest timer progress (0-100). Drops as time elapses.
  const restPct = restTimerMax > 0
    ? Math.max(0, Math.min(100, (restTimer / restTimerMax) * 100))
    : 0;

  // Session duration ticker — counts up from workoutStartTime to
  // power the "REC 18:42" stamp on the right of the HUD header.
  // Updates every second; cleans up on unmount.
  const [sessionDuration, setSessionDuration] = useState(0);
  useEffect(() => {
    if (!workoutStartTime) return;
    const start = new Date(workoutStartTime).getTime();
    const tick = () => setSessionDuration(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [workoutStartTime]);

  // In/out-of-range readout for the center HR slot. Shown under
  // the BPM digits as "IN RANGE · Z3" / "ABOVE TARGET" / etc.
  const rangeLabel = (() => {
    if (!currentHR || !activeZone) return null;
    if (activeZone.zone === targetZone) return `IN RANGE · Z${activeZone.zone}`;
    if (activeZone.zone > targetZone) return `ABOVE · Z${activeZone.zone}`;
    return `BELOW · Z${activeZone.zone}`;
  })();

  return (
    <div className="vitals-sticky">
      {/* Top label strip — eyebrow + REC session timer.
          The pulsing red dot signals "we're recording your session". */}
      <div className="vitals-head">
        <span>// Vitals · Live</span>
        {workoutStartTime && (
          <span className="live">REC {formatMMSS(sessionDuration)}</span>
        )}
      </div>

      {/* Three-slot grid: timer | divider | gauge | divider | set */}
      <div className="vitals-grid">
        {/* LEFT — Rest timer with target. */}
        <div className="vital-timer">
          <div className="lbl">// Rest · Tgt</div>
          {restTimerMax > 0 && (
            <div className="target" style={{ marginTop: 0, marginBottom: 4 }}>
              {formatMMSS(restTimerMax)}
            </div>
          )}
          <div className={`val${restTimer <= 3 && restRunning ? ' danger' : ''}`}>
            {formatMMSS(restTimer)}
          </div>
          {restRunning && (
            <div className="target" style={{ color: 'var(--amber)', marginTop: 6 }}>
              COUNTDOWN ACTIVE
            </div>
          )}
          {restTimerMax > 0 && (
            <div className="progress">
              <span style={{ width: `${restPct}%` }} />
            </div>
          )}
        </div>

        <div className="div" aria-hidden />

        {/* CENTER — HR readout + sparkline + range label.
            No longer interactive (the expand-panel target was
            removed); rendered as a div so screen readers don't
            announce it as a button. */}
        <div
          aria-label="Live heart rate readout"
          className="vital-gauge"
          style={{
            padding: '8px 4px',
            color: activeZone?.color || 'var(--text-tertiary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <div style={{ textAlign: 'center', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span
              className="t-mono"
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: 'inherit',
                textShadow: activeZone ? `0 0 10px ${activeZone.color}88` : undefined,
              }}
            >
              {currentHR ?? '—'}
            </span>
            <span className="t-mono-sm" style={{ color: 'var(--text-tertiary)', fontSize: 9, letterSpacing: 1.2 }}>
              BPM
            </span>
          </div>

          {/* Mini sparkline — last 30 HR samples. Uses the active
              zone color so the trend visually matches the BPM tint. */}
          {hrHistory.length > 1 && (
            <svg viewBox="0 0 90 18" width={90} height={18} preserveAspectRatio="none">
              {(() => {
                const data = hrHistory.slice(-30);
                if (data.length < 2) return null;
                const minH = Math.min(...data.map(x => x.hr)) - 2;
                const maxH = Math.max(...data.map(x => x.hr)) + 2;
                const range = maxH - minH || 1;
                const points = data.map((h, i) => {
                  const x = (i / (data.length - 1)) * 90;
                  const y = 16 - ((h.hr - minH) / range) * 14;
                  return `${x},${y}`;
                }).join(' ');
                const stroke = activeZone?.color || 'var(--amber)';
                return (
                  <polyline
                    points={points}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                  />
                );
              })()}
            </svg>
          )}

          {rangeLabel && (
            <div
              className="t-mono-sm"
              style={{
                fontSize: 8,
                letterSpacing: 1.2,
                color: activeZone?.zone === targetZone ? 'var(--green)' : 'var(--amber)',
              }}
            >
              {rangeLabel}
            </div>
          )}
        </div>

        <div className="div" aria-hidden />

        {/* RIGHT — Set indicator. // SET · LOG label + big mono "now/total". */}
        <div className="vital-set">
          <div className="lbl">// Set · Log</div>
          <div className="num">
            {Math.min(currentSetIndex + 1, Math.max(totalSets, 1))}
            <small>/{Math.max(totalSets, 1)}</small>
          </div>
          {totalSets > 0 && (
            <div className="pips">
              {Array.from({ length: totalSets }, (_, i) => (
                <span
                  key={i}
                  className={
                    i < currentSetIndex
                      ? 'done'
                      : i === currentSetIndex
                        ? 'now'
                        : ''
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zone strip — fills the active zone color, all others at
          22% alpha. Tap to set target zone. */}
      {zones.length > 0 && (
        <div className="vital-zonestrip">
          {zones.map(z => {
            const isActive = activeZone?.zone === z.zone;
            const isTarget = z.zone === targetZone;
            return (
              <div
                key={z.zone}
                className={isActive ? 'active' : ''}
                onClick={() => onSetTargetZone(z.zone)}
                style={{
                  background: isActive ? z.color : `${z.color}22`,
                  border: isTarget ? `1px solid ${z.color}` : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                Z{z.zone}
              </div>
            );
          })}
        </div>
      )}

      {/* Action row — PAUSE / +30S / RESET. The legacy ▼ HUD
          toggle was removed: the expanded HRZoneGauge panel that
          it controlled is gone, and the BPM digits + sparkline +
          IN RANGE label in the HUD's center slot already cover
          the at-a-glance HR readout. */}
      <div className="vitals-actions">
        <button
          type="button"
          onClick={onPauseTimer}
          disabled={!onPauseTimer || !restRunning}
          className="primary"
          aria-label="Pause rest timer"
        >
          <Icon.Pause size={11} />
          Pause
        </button>
        <button
          type="button"
          onClick={onAddRest}
          disabled={!onAddRest || !restRunning}
          aria-label="Add 30 seconds to rest"
        >
          <Icon.Plus size={11} />
          30s
        </button>
        <button
          type="button"
          onClick={onResetTimer}
          disabled={!onResetTimer}
          aria-label="Reset rest timer"
        >
          <Icon.X size={11} />
          Reset
        </button>
      </div>
    </div>
  );
}
