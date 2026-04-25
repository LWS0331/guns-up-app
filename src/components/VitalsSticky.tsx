'use client';

// VitalsSticky — Workout Mode tactical heads-up bar.
//
// Mounts as a sticky top region during workoutMode. Three slots:
//   left   = rest-timer countdown + label + progress bar
//   center = HR pulse readout (compact gauge)
//   right  = current set indicator + per-set pip strip
// Below the grid: 5-col HR zone strip (active zone glows).
// Below that: 4-button "ammo strip" action row (PTT, Demo, Notes, Skip).
//
// The expanded HR panel + per-exercise set logging stay below the
// scroll boundary — this HUD only surfaces the live state. Tap any
// of the three slots to open the relevant detail view (parent
// component owns the open/close state via callbacks).
//
// Why a separate component: AppShell + Planner already share the
// rest timer + HR gauge state, so consolidating them into one
// presentational component lets future workout modes (running,
// climbing, mobility) reuse the HUD shape with different
// per-slot data.

import React from 'react';
import HRZoneGauge, { type HrZoneDef, type HrSample } from './HRZoneGauge';

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

  /** Render the expanded HR panel below the HUD when true. */
  hrExpanded?: boolean;
  onToggleHrExpanded?: () => void;
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
  onTalk,
  onDemo,
  onNotes,
  onSkip,
  hrExpanded = false,
  onToggleHrExpanded,
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

  // LIVE indicator label tracks hrSource. Wearable + manual both
  // count as "data flowing"; only "none" reads as static.
  const liveLabel =
    hrSource === 'wearable' ? 'LIVE'
    : hrSource === 'manual' ? 'MANUAL'
    : 'NO DATA';

  return (
    <div className="vitals-sticky">
      {/* Top label strip — eyebrow + live badge */}
      <div className="vitals-head">
        <span>// Vitals · Live</span>
        <span className="live">{liveLabel}</span>
      </div>

      {/* Three-slot grid: timer | divider | gauge | divider | set */}
      <div className="vitals-grid">
        {/* LEFT — Rest timer */}
        <div className="vital-timer">
          <div className="lbl">Rest</div>
          <div className={`val${restTimer <= 3 && restRunning ? ' danger' : ''}`}>
            {formatMMSS(restTimer)}
          </div>
          {restTimerMax > 0 && (
            <>
              <div className="target">/ {formatMMSS(restTimerMax)} prescribed</div>
              <div className="progress">
                <span style={{ width: `${restPct}%` }} />
              </div>
            </>
          )}
        </div>

        <div className="div" aria-hidden />

        {/* CENTER — Compact HR gauge. Tap to expand the full
            HRZoneGauge panel below. */}
        <button
          type="button"
          onClick={onToggleHrExpanded}
          aria-label="Toggle HR panel"
          aria-expanded={hrExpanded}
          className="vital-gauge"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: onToggleHrExpanded ? 'pointer' : 'default',
            padding: '8px 4px',
            color: activeZone?.color || 'var(--text-tertiary)',
          }}
        >
          <div style={{ textAlign: 'center', lineHeight: 1 }}>
            <div
              className="t-mono"
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'inherit',
                textShadow: activeZone ? `0 0 10px ${activeZone.color}88` : undefined,
              }}
            >
              {currentHR ?? '—'}
            </div>
            <div
              className="t-mono-sm"
              style={{ fontSize: 8.5, color: 'var(--text-tertiary)', letterSpacing: 1.5, marginTop: 4 }}
            >
              BPM
            </div>
          </div>
        </button>

        <div className="div" aria-hidden />

        {/* RIGHT — Set indicator. Big "current/total" + pip strip. */}
        <div className="vital-set">
          <div className="lbl">Set</div>
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

      {/* Bottom zone strip — fills the active zone color, all
          others render at 22% alpha. Tap to set target zone. */}
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

      {/* Action row — 4-button ammo strip. PTT button gets the
          .primary amber treatment with leading dot since it's the
          "talk to coach" affordance you reach for during a set. */}
      <div className="vitals-actions">
        <button
          type="button"
          onClick={onTalk}
          disabled={!onTalk}
          className="primary"
          aria-label="Push to talk / open Gunny"
        >
          PTT
        </button>
        <button
          type="button"
          onClick={onDemo}
          disabled={!onDemo}
          aria-label="Show exercise demo"
        >
          Demo
        </button>
        <button
          type="button"
          onClick={onNotes}
          disabled={!onNotes}
          aria-label="Jump to notes"
        >
          Notes
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={!onSkip}
          aria-label="Skip / advance set"
        >
          Skip
        </button>
      </div>

      {/* Expanded HR panel — only visible when toggled open. Hosts
          the full HRZoneGauge component (gauge + sparkline + manual
          input) so the live HUD stays compact. */}
      {hrExpanded && (
        <div className="vitals-expand">
          <HRZoneGauge
            currentHR={currentHR}
            targetZone={targetZone}
            hrSource={hrSource}
            zones={zones}
            history={hrHistory}
            onSetTargetZone={onSetTargetZone}
            onManualSubmit={onManualHR}
            onClose={onToggleHrExpanded}
          />
        </div>
      )}
    </div>
  );
}
