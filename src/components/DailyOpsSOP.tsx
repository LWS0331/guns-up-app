'use client';

// Daily Ops SOP — the operator/coach-authored standing daily routine.
//
// Rendered as a PINNED section at the top of the Daily Ops tab, above
// the per-day generated schedule planner (DailyOps.tsx). The SOP is one
// persistent document on operator.dailyOps (markdown + optional
// structured anchors), authored by GUNNY via the MCP set_daily_ops tool
// — this surface is read + check-off only, NOT a builder.
//
// `markdown` is the render source-of-truth (headers + tables via
// GunnyMarkdown/remark-gfm). When `anchors[]` are present we also render
// a daily checklist whose checked state resets each calendar day
// (persisted in localStorage, keyed by operator + date — server stores
// the routine, not the per-day completion).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Operator, DailyOpsSOP as DailyOpsSOPShape } from '@/lib/types';
import { GunnyMarkdown } from '@/components/gunny/GunnyMarkdown';
import Icon from '@/components/Icons';
import { getLocalDateStr, toLocalDateStr } from '@/lib/dateUtils';

interface DailyOpsSOPProps {
  operator: Operator;
  onSendGunnyMessage?: (prompt: string) => void;
}

const ACCENT = '#ffb800';

const styles = {
  section: {
    background: '#0a0a0a',
    border: '1px solid rgba(255, 184, 0, 0.25)',
    borderRadius: 4,
    padding: 14,
    marginBottom: 18,
  } as React.CSSProperties,
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  title: {
    color: ACCENT,
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 2.5,
    margin: 0,
  } as React.CSSProperties,
  meta: {
    color: '#666',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    letterSpacing: 0.5,
  } as React.CSSProperties,
  empty: {
    color: '#a0a0a0',
    fontSize: 12.5,
    lineHeight: 1.5,
    margin: 0,
  } as React.CSSProperties,
  emptyHint: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 0,
  } as React.CSSProperties,
  checklist: {
    marginTop: 14,
    paddingTop: 12,
    borderTop: '1px solid #1a1a1a',
  } as React.CSSProperties,
  checklistLabel: {
    color: ACCENT,
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    marginBottom: 8,
  } as React.CSSProperties,
  anchorRow: (checked: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '7px 8px',
    borderRadius: 3,
    cursor: 'pointer',
    background: checked ? 'rgba(0, 255, 65, 0.06)' : 'transparent',
    opacity: checked ? 0.7 : 1,
  }),
  checkbox: (checked: boolean): React.CSSProperties => ({
    flex: '0 0 auto',
    width: 18,
    height: 18,
    borderRadius: 3,
    border: `1.5px solid ${checked ? '#00ff41' : '#3a3a3a'}`,
    background: checked ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
    color: '#00ff41',
    fontSize: 12,
    lineHeight: '15px',
    textAlign: 'center',
    marginTop: 1,
  }),
  anchorBody: { flex: 1, minWidth: 0 } as React.CSSProperties,
  anchorHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  anchorTime: {
    color: '#e0e0e0',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 12,
    fontWeight: 600,
  } as React.CSSProperties,
  anchorLabel: (checked: boolean): React.CSSProperties => ({
    color: '#e0e0e0',
    fontSize: 13,
    textDecoration: checked ? 'line-through' : 'none',
  }),
  anchorNote: {
    color: '#888',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 1.4,
  } as React.CSSProperties,
  reshapeLink: {
    appearance: 'none',
    WebkitAppearance: 'none',
    background: 'transparent',
    border: 'none',
    color: '#888',
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 9.5,
    letterSpacing: 1.5,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    padding: 0,
  } as React.CSSProperties,
  loading: {
    color: '#666',
    fontSize: 12,
    padding: '6px 0',
  } as React.CSSProperties,
};

function checksStorageKey(operatorId: string, date: string): string {
  return `dailyOpsSop:checks:${operatorId}:${date}`;
}

const DailyOpsSOP: React.FC<DailyOpsSOPProps> = ({ operator, onSendGunnyMessage }) => {
  const [sop, setSop] = useState<DailyOpsSOPShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const today = useMemo(() => {
    try {
      return getLocalDateStr();
    } catch {
      return toLocalDateStr(new Date());
    }
  }, []);

  const fetchSop = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/operators/${encodeURIComponent(operator.id)}/daily-ops`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        setSop(null);
        return;
      }
      const data = await res.json();
      setSop((data?.dailyOps as DailyOpsSOPShape) ?? null);
    } catch (err) {
      console.error('[daily-ops-sop] fetch failed', err);
      setSop(null);
    } finally {
      setLoading(false);
    }
  }, [operator.id]);

  useEffect(() => {
    void fetchSop();
  }, [fetchSop]);

  // Load today's check-off state from localStorage; reset implicitly when
  // the date key changes (a new day → a fresh, empty set).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(checksStorageKey(operator.id, today));
      if (raw) setChecked(new Set(JSON.parse(raw) as string[]));
      else setChecked(new Set());
    } catch {
      setChecked(new Set());
    }
  }, [operator.id, today]);

  // Refresh when the window regains focus — consistent with the schedule
  // planner below (operator asks Gunny to author the SOP in chat, then
  // tabs back). Pull-to-refresh / force-close re-runs fetchSop on mount.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchSop();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchSop]);

  const toggleAnchor = useCallback(
    (id: string) => {
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          window.localStorage.setItem(
            checksStorageKey(operator.id, today),
            JSON.stringify([...next]),
          );
        } catch {
          /* storage full / unavailable — check-off is best-effort */
        }
        return next;
      });
    },
    [operator.id, today],
  );

  const askGunnyToBuild = useCallback(() => {
    onSendGunnyMessage?.(
      'Build me a Daily Ops SOP — my standing daily routine: fixed anchors, AM/PM training variants, supplement schedule, sleep protocol, and current phase. Author it to my record.',
    );
  }, [onSendGunnyMessage]);

  const anchors = sop?.anchors ?? [];

  return (
    <div style={styles.section}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>STANDING SOP</h2>
        {sop && (
          <span style={styles.meta}>
            v{sop.version} · {sop.authoredBy === 'gunny' ? 'GUNNY' : 'OPERATOR'} ·{' '}
            {sop.updatedAt ? new Date(sop.updatedAt).toLocaleDateString() : ''}
          </span>
        )}
      </div>

      {loading && !sop && <div style={styles.loading}>Loading SOP…</div>}

      {!loading && !sop && (
        <>
          <p style={styles.empty}>No Daily Ops set — ask GUNNY to build one.</p>
          {onSendGunnyMessage && (
            <p style={styles.emptyHint}>
              <button type="button" style={styles.reshapeLink} onClick={askGunnyToBuild}>
                ASK GUNNY TO BUILD MY SOP
              </button>
            </p>
          )}
        </>
      )}

      {sop && (
        <>
          {sop.markdown ? (
            <GunnyMarkdown text={sop.markdown} accent={ACCENT} />
          ) : (
            <p style={styles.empty}>SOP has no written orders yet.</p>
          )}

          {anchors.length > 0 && (
            <div style={styles.checklist}>
              <div style={styles.checklistLabel}>TODAY&apos;S CHECKLIST</div>
              {anchors.map((a) => {
                const isChecked = checked.has(a.id);
                return (
                  <div
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleAnchor(a.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleAnchor(a.id);
                      }
                    }}
                    style={styles.anchorRow(isChecked)}
                  >
                    <span style={{ ...styles.checkbox(isChecked), display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
                      {isChecked ? <Icon.Check size={12} color="#00ff41" /> : null}
                    </span>
                    <div style={styles.anchorBody}>
                      <div style={styles.anchorHeader}>
                        {a.time && <span style={styles.anchorTime}>{a.time}</span>}
                        <span style={styles.anchorLabel(isChecked)}>{a.label}</span>
                      </div>
                      {a.note && <div style={styles.anchorNote}>{a.note}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {onSendGunnyMessage && (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                style={styles.reshapeLink}
                onClick={() =>
                  onSendGunnyMessage('Update my Daily Ops SOP — what would you change?')
                }
              >
                ASK GUNNY TO UPDATE SOP
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DailyOpsSOP;
