'use client';

import React from 'react';

export interface HrZoneDef {
  zone: number;
  name: string;
  min: number;
  max: number;
  color: string;
}

export interface HrSample {
  hr: number;
  time: number;
}

interface HRZoneGaugeProps {
  currentHR: number | null;
  targetZone: number;
  hrSource: 'wearable' | 'manual' | 'none' | string;
  zones: HrZoneDef[];
  history: HrSample[];
  onSetTargetZone: (zone: number) => void;
  onManualSubmit: (hr: number) => void;
  onClose?: () => void;
}

/**
 * HRZoneGauge — Task 22 upgrade of the HR tracker panel.
 *
 * Features:
 *   - Radial arc gauge (0 → 220 BPM) with zone-colored arc segments
 *   - Pulsing center dot when live data is arriving
 *   - BPM + zone label in the center
 *   - Zone strip (tap to set target) underneath
 *   - 30-sample sparkline below
 *
 * Pure SVG — no external chart lib.
 */
export default function HRZoneGauge({
  currentHR,
  targetZone,
  hrSource,
  zones,
  history,
  onSetTargetZone,
  onManualSubmit,
  onClose,
}: HRZoneGaugeProps) {
  const GAUGE_MIN = 40;
  const GAUGE_MAX = 220;
  // Arc geometry — half-donut, angle runs from 180° (left) to 360° (right)
  const RADIUS = 80;
  const STROKE = 14;
  const CX = 100;
  const CY = 100;
  const startAngle = 180;
  const endAngle = 360;

  const bpmToAngle = (bpm: number) => {
    const clamped = Math.max(GAUGE_MIN, Math.min(GAUGE_MAX, bpm));
    const pct = (clamped - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN);
    return startAngle + pct * (endAngle - startAngle);
  };

  const polar = (angleDeg: number, r: number = RADIUS) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  };

  const arcPath = (a0: number, a1: number, r: number = RADIUS) => {
    const p0 = polar(a0, r);
    const p1 = polar(a1, r);
    const largeArc = a1 - a0 > 180 ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
  };

  const getZone = (bpm: number | null): HrZoneDef | null => {
    if (!bpm) return null;
    return zones.find(z => bpm >= z.min && bpm <= z.max) || null;
  };

  const currentZone = getZone(currentHR);
  const currentAngle = currentHR ? bpmToAngle(currentHR) : null;
  const needleTip = currentAngle != null ? polar(currentAngle, RADIUS + 6) : null;

  const borderColor = currentZone?.color || 'var(--border-green-soft)';
  const liveLabel =
    hrSource === 'wearable' ? 'LIVE' : hrSource === 'manual' ? 'MANUAL' : 'NO DEVICE';
  const liveTone =
    hrSource === 'wearable' ? 'ok' : hrSource === 'manual' ? 'ghost' : 'ghost';

  return (
    // HR Zone Tracker — design-system bracket card. Border tints to
    // the active zone color when live data is arriving, falling back
    // to the soft green default. The legacy hex (#333) is replaced
    // by --border-green-soft so an idle card matches every other
    // tactical surface in the app.
    <div
      className="ds-card bracket"
      style={{
        marginBottom: 16,
        padding: 12,
        borderColor,
        transition: 'border-color 0.3s',
      }}
    >
      <span className="bl" /><span className="br" />
      <style>{`
        @keyframes hrPulseRing { 0% { transform: scale(1); opacity: 0.7; } 70% { transform: scale(1.6); opacity: 0; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes hrPulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
      `}</style>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <span className="t-eyebrow">HR Zone Tracker</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* LIVE / MANUAL / NO DEVICE — uses the canonical
              .status-pill so it matches the online indicator in
              GunnyChat's header. */}
          <span className={`status-pill ${liveTone}`} style={{ fontSize: 9, padding: '4px 8px' }}>
            {liveLabel}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close HR tracker"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                fontSize: 16,
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Radial gauge */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <svg viewBox="0 0 200 120" style={{ width: 200, height: 120 }}>
          {/* Track */}
          <path d={arcPath(startAngle, endAngle)} stroke="#1a1a1a" strokeWidth={STROKE} fill="none" strokeLinecap="round" />
          {/* Zone-colored arc segments */}
          {zones.map((z, i) => {
            const a0 = bpmToAngle(z.min);
            const a1 = bpmToAngle(z.max);
            if (a1 <= a0) return null;
            return (
              <path key={i} d={arcPath(a0, a1)} stroke={z.color} strokeWidth={STROKE} fill="none" strokeLinecap="butt" opacity={currentZone?.zone === z.zone ? 1 : 0.35} />
            );
          })}
          {/* Needle */}
          {currentAngle != null && needleTip && (
            <>
              <line x1={CX} y1={CY} x2={needleTip.x} y2={needleTip.y} stroke={currentZone?.color || '#fff'} strokeWidth={3} strokeLinecap="round" />
              <circle cx={needleTip.x} cy={needleTip.y} r={4} fill={currentZone?.color || '#fff'} />
            </>
          )}
          {/* Pulse ring */}
          {currentHR && (
            <g>
              <circle cx={CX} cy={CY} r={10} fill={currentZone?.color || '#FF8C00'} style={{ animation: 'hrPulseDot 1.2s ease-in-out infinite', transformOrigin: `${CX}px ${CY}px` }} />
              <circle cx={CX} cy={CY} r={10} fill="none" stroke={currentZone?.color || '#FF8C00'} strokeWidth={2} style={{ animation: 'hrPulseRing 1.2s ease-out infinite', transformOrigin: `${CX}px ${CY}px` }} />
            </g>
          )}
          {/* Center label */}
          {currentHR ? (
            <>
              <text x={CX} y={CY - 24} textAnchor="middle" fill={currentZone?.color || '#fff'} fontFamily="Orbitron, sans-serif" fontSize="24" fontWeight="700">{currentHR}</text>
              <text x={CX} y={CY - 8} textAnchor="middle" fill="#666" fontFamily="Share Tech Mono" fontSize="9">BPM</text>
            </>
          ) : (
            <text x={CX} y={CY - 16} textAnchor="middle" fill="#555" fontFamily="Share Tech Mono" fontSize="10">--</text>
          )}
        </svg>

        {/* Side info + manual input */}
        <div style={{ minWidth: 140, flex: 1 }}>
          {currentHR && currentZone ? (
            <>
              <div
                className="t-display-m"
                style={{ color: currentZone.color, marginBottom: 4, fontSize: 13, textShadow: `0 0 6px ${currentZone.color}55` }}
              >
                Zone {currentZone.zone}: {currentZone.name}
              </div>
              {currentZone.zone !== targetZone ? (
                // Off-target callout — danger if above, green if below.
                // Above-target = "SLOW DOWN" (overexerting); below =
                // "PUSH HARDER" (under target). Color tracks intent.
                <div
                  className="t-mono-sm"
                  style={{
                    color: currentZone.zone > targetZone ? 'var(--danger)' : 'var(--green)',
                    letterSpacing: 1,
                  }}
                >
                  {currentZone.zone > targetZone ? 'ABOVE TARGET — SLOW DOWN' : 'BELOW TARGET — PUSH HARDER'}
                </div>
              ) : (
                <div className="t-mono-sm" style={{ color: 'var(--green)', letterSpacing: 1 }}>
                  ON TARGET
                </div>
              )}
            </>
          ) : (
            <div className="t-mono-sm" style={{ marginBottom: 6, color: 'var(--text-tertiary)' }}>
              Enter HR manually or connect a wearable
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number"
              placeholder={currentHR ? 'Update HR' : 'Enter HR'}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = parseInt((e.target as HTMLInputElement).value);
                  if (val > 0) {
                    onManualSubmit(val);
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              }}
              className="ds-input"
              style={{ width: 90, padding: '6px 8px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13 }}
            />
            <span className="t-mono-sm" style={{ color: 'var(--text-dim)' }}>↵ enter</span>
          </div>
        </div>
      </div>

      {/* Zone strip — tap to select a target zone. The active zone
          (current HR) fills with its color; the target zone gets a
          2px outline so the user sees both at a glance. */}
      <div style={{ display: 'flex', gap: 2, height: 20, overflow: 'hidden', marginTop: 10 }}>
        {zones.map(z => {
          const isActive = currentZone?.zone === z.zone;
          const isTarget = z.zone === targetZone;
          return (
            <button
              key={z.zone}
              type="button"
              onClick={() => onSetTargetZone(z.zone)}
              aria-label={`Set target zone ${z.zone}: ${z.name}`}
              aria-pressed={isTarget}
              style={{
                flex: 1,
                background: isActive ? z.color : `${z.color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: isTarget ? `2px solid ${z.color}` : '2px solid transparent',
                padding: 0,
                transition: 'all 0.3s',
                position: 'relative',
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: isActive ? '#000' : z.color,
                fontWeight: isActive ? 700 : 400,
                letterSpacing: '0.04em',
              }}
            >
              Z{z.zone}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
        {zones.map(z => (
          <div
            key={z.zone}
            className="t-mono-sm"
            style={{ flex: 1, textAlign: 'center', fontSize: 8, color: 'var(--text-dim)' }}
          >
            {z.min}-{z.max}
          </div>
        ))}
      </div>

      {/* Sparkline */}
      {history.length > 1 && (
        <div style={{ marginTop: 10 }}>
          <svg width="100%" height="50" viewBox="0 0 200 50" preserveAspectRatio="none" style={{ display: 'block' }}>
            {(() => {
              const data = history.slice(-30);
              const minH = Math.min(...data.map(x => x.hr)) - 5;
              const maxH = Math.max(...data.map(x => x.hr)) + 5;
              const range = maxH - minH || 1;
              const points = data.map((h, i) => {
                const x = (i / Math.max(1, data.length - 1)) * 200;
                const y = 45 - ((h.hr - minH) / range) * 40;
                return `${x},${y}`;
              }).join(' ');
              const fillPoints = `0,45 ${points} 200,45`;
              const lastHr = data[data.length - 1];
              const lastZone = lastHr ? getZone(lastHr.hr) : null;
              const lastColor = lastZone?.color || '#FF8C00';
              return (
                <>
                  <defs>
                    <linearGradient id="hrGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={lastColor} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={lastColor} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={fillPoints} fill="url(#hrGrad2)" />
                  <polyline points={points} fill="none" stroke={lastColor} strokeWidth={2} strokeLinejoin="round" />
                  {lastHr && (
                    <circle cx={200} cy={45 - ((lastHr.hr - minH) / range) * 40} r={3} fill={lastColor} />
                  )}
                </>
              );
            })()}
          </svg>
        </div>
      )}
    </div>
  );
}
