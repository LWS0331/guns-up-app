'use client';

// ReadinessPanel — IntelCenter WEARABLES tab transparency view of the
// autoregulation engine. Renders on tab open (and refresh), shows what
// the engine currently thinks: status, confidence, baselineDays
// progress, current ACWR vs Gabbett's sweet spot, and the weighted
// factor breakdown that drove the call.
//
// Why a panel separate from RecoveryReadout: RecoveryReadout is the
// "should I train hard today?" action-taking surface — gated behind a
// button click because it makes an Anthropic call for the headline +
// guidance. This panel is the always-on observability layer so users
// can see whether the engine is in cold-start, low-confidence, or
// fully-trusted mode at a glance, without burning an LLM call.
//
// COMMANDER+ tier-gated (matches RecoveryReadout — both surface live
// wearable engine data).

import React, { useCallback, useEffect, useState } from 'react';
import { Operator } from '@/lib/types';
import { getAuthToken } from '@/lib/authClient';
import { hasCommanderAccess } from '@/lib/tierGates';
import UpgradeCard from '@/components/UpgradeCard';

type Status = 'go_hard' | 'normal' | 'caution' | 'rest' | 'unknown';
type Confidence = 'baseline_only' | 'low' | 'medium' | 'high';
type Source = 'wearable_personal' | 'self_report' | 'fallback' | 'mixed';
type Signal = 'good' | 'warn' | 'bad' | 'neutral';

interface Factor {
  key: string;
  label: string;
  value: string;
  signal: Signal;
  weight: number;
}

interface ReadinessScore {
  status: Status;
  confidence: Confidence;
  source: Source;
  rawScore: number;
  factors: Factor[];
  baselineDays: number;
  acwr?: number;
  rationale: string;
  fallbackToHardcoded: boolean;
}

interface ReadinessPanelProps {
  operator: Operator;
  currentUser?: Operator;
  onOpenBilling?: () => void;
}

const STATUS_COLOR: Record<Status, string> = {
  go_hard: '#00ff41',  // green
  normal:  '#22d3ee',  // cyan
  caution: '#facc15',  // amber
  rest:    '#ff4d4d',  // red
  unknown: '#888888',
};

const STATUS_LABEL: Record<Status, string> = {
  go_hard: 'GO HARD',
  normal:  'NORMAL',
  caution: 'DELOAD',
  rest:    'REST',
  unknown: 'BUILDING',
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  baseline_only: 'BUILDING BASELINE',
  low:           'LOW CONFIDENCE',
  medium:        'MEDIUM CONFIDENCE',
  high:          'HIGH CONFIDENCE',
};

const SIGNAL_COLOR: Record<Signal, string> = {
  good:    '#00ff41',
  warn:    '#facc15',
  bad:     '#ff6b35',
  neutral: '#888888',
};

// Engine confidence tiers from src/lib/readiness.ts.
const COLD_START_DAYS = 7;
const HIGH_CONFIDENCE_DAYS = 28;

// Gabbett 2016 ACWR sweet spot.
const ACWR_LOW = 0.8;
const ACWR_HIGH = 1.3;
const ACWR_DANGER = 1.5;

export default function ReadinessPanel({ operator, currentUser, onOpenBilling }: ReadinessPanelProps) {
  const viewer = currentUser ?? operator;
  const canAccess = hasCommanderAccess(viewer);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<ReadinessScore | null>(null);

  const fetchScore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/readiness/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ operatorId: operator.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error || `Request failed (${res.status})`);
        return;
      }
      const json = await res.json();
      if (json?.score) setScore(json.score as ReadinessScore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [operator.id]);

  useEffect(() => {
    if (!canAccess) return;
    void fetchScore();
  }, [canAccess, fetchScore]);

  if (!canAccess) {
    return (
      <UpgradeCard
        feature="Readiness Engine"
        requiredTier="opus"
        description="Live confidence-graded readiness score from your wearable + workout history. See exactly what the engine sees: HRV vs baseline, ACWR workload, sleep, factor weights — all rolled into a daily GO HARD / NORMAL / DELOAD / REST recommendation."
        onUpgrade={onOpenBilling}
        compact
      />
    );
  }

  // Day X of N progress — N is 7 during cold-start (engine activates
  // at day 7), then 28 (full confidence reached).
  const days = score?.baselineDays ?? 0;
  const target = days < COLD_START_DAYS ? COLD_START_DAYS : HIGH_CONFIDENCE_DAYS;
  const pct = Math.min(100, Math.round((days / target) * 100));

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#00ff41', letterSpacing: 2 }}>
          // READINESS ENGINE
        </div>
        <button
          type="button"
          onClick={fetchScore}
          disabled={loading}
          style={{
            padding: '6px 12px',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 10,
            letterSpacing: 1.5,
            border: '1px solid rgba(0,255,65,0.5)',
            background: loading ? 'rgba(0,255,65,0.15)' : 'transparent',
            color: '#00ff41',
            cursor: loading ? 'wait' : 'pointer',
            textTransform: 'uppercase',
            borderRadius: 3,
          }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 10, background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)', color: '#ff8888', fontFamily: 'Share Tech Mono, monospace', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!score && loading && (
        <div style={{ padding: 14, background: 'rgba(0,0,0,0.3)', border: '1px dashed rgba(0,255,65,0.2)', color: '#888', fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>
          Reading engine state…
        </div>
      )}

      {score && (
        <>
          {/* Status + confidence row */}
          <div
            style={{
              padding: 16,
              background: `${STATUS_COLOR[score.status]}11`,
              border: `1px solid ${STATUS_COLOR[score.status]}`,
              borderLeft: `4px solid ${STATUS_COLOR[score.status]}`,
              borderRadius: 4,
              marginBottom: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 22,
                letterSpacing: 3,
                color: STATUS_COLOR[score.status],
                fontWeight: 800,
              }}
            >
              {STATUS_LABEL[score.status]}
            </div>
            <div
              style={{
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 9,
                letterSpacing: 1.5,
                color: confidenceColor(score.confidence),
                border: `1px solid ${confidenceColor(score.confidence)}66`,
                padding: '3px 8px',
                borderRadius: 3,
                textTransform: 'uppercase',
              }}
            >
              {CONFIDENCE_LABEL[score.confidence]}
            </div>
          </div>

          {/* Day X of N progress meter */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#aaa', letterSpacing: 0.5 }}>
                Baseline maturity
              </div>
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: '#e0e0e0', fontWeight: 700 }}>
                Day {days} of {target}
              </div>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: pct >= 100 ? '#00ff41' : 'linear-gradient(90deg, #22d3ee, #00ff41)',
                  transition: 'width 0.4s ease-out',
                }}
              />
            </div>
          </div>

          {/* ACWR pill — only when computable */}
          {typeof score.acwr === 'number' && (
            <ACWRBar acwr={score.acwr} />
          )}

          {/* Factor breakdown */}
          {score.factors.length > 0 && (
            <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#666', letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 }}>
                What the engine saw
              </div>
              {score.factors.map((f, i) => (
                <div
                  key={`${f.key}-${i}`}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderLeft: `3px solid ${SIGNAL_COLOR[f.signal]}`,
                    borderRadius: 3,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#aaa', letterSpacing: 0.5 }}>
                      {f.label}
                    </div>
                    {f.weight > 0 && (
                      <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#555', letterSpacing: 0.5 }}>
                        weight {Math.round(f.weight * 100)}%
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 13, color: SIGNAL_COLOR[f.signal], fontWeight: 700 }}>
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rationale */}
          {score.rationale && (
            <div
              style={{
                padding: 12,
                background: 'rgba(0,0,0,0.3)',
                borderLeft: `2px solid ${STATUS_COLOR[score.status]}66`,
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 12,
                color: '#bbb',
                lineHeight: 1.6,
              }}
            >
              {score.rationale}
            </div>
          )}

          {score.fallbackToHardcoded && (
            <div style={{ marginTop: 10, padding: 10, background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.2)', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#88dcef', lineHeight: 1.5, borderRadius: 3 }}>
              The engine is still learning your patterns. Until it has 7 days of data, RECOVERY READOUT falls back to deterministic thresholds. Run a workout and rate it 1-10 at the end to start feeding it.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ACWR sweet-spot indicator. Renders a horizontal bar with the
// 0.8-1.3 sweet spot highlighted, current value pinned on the line.
// Above 1.5 = injury risk spike; show a clear danger band.
function ACWRBar({ acwr }: { acwr: number }) {
  // Scale 0 → 2.0 across the bar; clamp display.
  const clamped = Math.max(0, Math.min(2, acwr));
  const leftPct = (clamped / 2) * 100;
  const sweetLeft = (ACWR_LOW / 2) * 100;
  const sweetWidth = ((ACWR_HIGH - ACWR_LOW) / 2) * 100;
  const dangerLeft = (ACWR_DANGER / 2) * 100;

  const inSweet = acwr >= ACWR_LOW && acwr <= ACWR_HIGH;
  const inDanger = acwr > ACWR_DANGER;
  const valueColor = inSweet ? '#00ff41' : inDanger ? '#ff4d4d' : '#facc15';

  return (
    <div style={{ marginBottom: 14, padding: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#aaa', letterSpacing: 0.5 }}>
          Workload (ACWR — Gabbett sweet spot 0.8-1.3)
        </div>
        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 14, color: valueColor, fontWeight: 800 }}>
          {acwr.toFixed(2)}
        </div>
      </div>
      <div style={{ position: 'relative', height: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
        {/* Sweet-spot band */}
        <div
          style={{
            position: 'absolute',
            left: `${sweetLeft}%`,
            width: `${sweetWidth}%`,
            top: 0,
            bottom: 0,
            background: 'rgba(0,255,65,0.15)',
            borderLeft: '1px solid rgba(0,255,65,0.5)',
            borderRight: '1px solid rgba(0,255,65,0.5)',
          }}
        />
        {/* Danger threshold marker */}
        <div
          style={{
            position: 'absolute',
            left: `${dangerLeft}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: 'rgba(255,77,77,0.8)',
          }}
        />
        {/* Current ACWR pin */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${leftPct}% - 1px)`,
            top: -2,
            bottom: -2,
            width: 3,
            background: valueColor,
            boxShadow: `0 0 6px ${valueColor}`,
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#555', letterSpacing: 0.5 }}>
        <span>0</span>
        <span>0.8 sweet 1.3</span>
        <span>1.5 spike</span>
        <span>2.0+</span>
      </div>
    </div>
  );
}

function confidenceColor(c: Confidence): string {
  switch (c) {
    case 'high':          return '#00ff41';
    case 'medium':        return '#22d3ee';
    case 'low':           return '#facc15';
    case 'baseline_only': return '#888888';
  }
}
