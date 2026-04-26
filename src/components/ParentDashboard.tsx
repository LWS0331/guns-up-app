'use client';

// Parent Dashboard — surfaces inside the parent's Command Center when
// they have one or more juniors linked via parentIds.
//
// Read-only mostly: parents view their junior's training compliance, recent
// Gunny chat (read-only), unresolved safety events (most important), and
// can update emergency contact. Cannot modify workouts or chat history.
//
// Visibility model: parents see this card BECAUSE getAccessibleOperators
// (extended in Phase A) puts juniors in their parentIds list into the
// parent's accessible-operators array. The junior knows their parent has
// visibility — that transparency is mandatory, not a setting (per Phase B
// JuniorIntakeForm welcome screen).

import React, { useMemo, useState } from 'react';
import type { Operator, JuniorSafetyEvent, JuniorSafetyFlags, JuniorConsent } from '@/lib/types';

interface ParentDashboardProps {
  parent: Operator;
  juniors: Operator[];
  onUpdateJunior: (updated: Operator) => void;
  onSelectJuniorForChat?: (junior: Operator) => void;
}

const TYPE_LABEL: Record<JuniorSafetyEvent['type'], { label: string; color: string }> = {
  concussion_keyword: { label: 'CONCUSSION KEYWORD', color: '#ff4444' },
  pain_report: { label: 'PAIN REPORT', color: '#ff8800' },
  red_flag: { label: 'RED FLAG', color: '#ffaa00' },
  refusal: { label: 'GUNNY REFUSAL', color: '#888' },
  parent_alert: { label: 'PARENT ALERT', color: '#00aaff' },
};

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ParentDashboard({ parent, juniors, onUpdateJunior, onSelectJuniorForChat }: ParentDashboardProps) {
  const [activeJuniorId, setActiveJuniorId] = useState<string>(juniors[0]?.id || '');
  const activeJunior = juniors.find(j => j.id === activeJuniorId) || juniors[0];

  const allUnresolvedCount = useMemo(
    () =>
      juniors.reduce((sum, j) => {
        const events = (j.juniorSafety as JuniorSafetyFlags | undefined)?.events || [];
        return sum + events.filter(e => !e.resolved).length;
      }, 0),
    [juniors]
  );

  if (!activeJunior) return null;

  const safety = (activeJunior.juniorSafety as JuniorSafetyFlags | undefined) || { events: [] };
  const unresolved = (safety.events || []).filter(e => !e.resolved);
  const resolved = (safety.events || []).filter(e => e.resolved);
  const consent = (activeJunior.juniorConsent as JuniorConsent | undefined) || null;

  // Compliance = workouts marked completed in the last 7 days
  const last7DayKeys: string[] = (() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  })();
  const last7Done = last7DayKeys.filter(k => activeJunior.workouts?.[k]?.completed).length;
  const last7Planned = last7DayKeys.filter(k => activeJunior.workouts?.[k]).length;

  const handleResolveEvent = (idx: number) => {
    const updatedEvents = (safety.events || []).map((e, i) =>
      i === idx ? { ...e, resolved: true, resolvedBy: parent.callsign, resolvedAt: new Date().toISOString() } : e
    );
    const updated: Operator = {
      ...activeJunior,
      juniorSafety: { events: updatedEvents },
    };
    onUpdateJunior(updated);
  };

  const handleUpdateEmergencyContact = (field: 'name' | 'relationship' | 'phone', value: string) => {
    const currentConsent: JuniorConsent = consent || {
      parentSignatures: [],
      participationConsent: false,
      dataConsent: false,
      emergencyContact: { name: '', relationship: '', phone: '' },
      pediatricianClearance: false,
      pediatricianClearanceDate: null,
    };
    const updated: Operator = {
      ...activeJunior,
      juniorConsent: {
        ...currentConsent,
        emergencyContact: {
          ...currentConsent.emergencyContact,
          [field]: value,
        },
      },
    };
    onUpdateJunior(updated);
  };

  const badgeStyle = (color: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 8px', background: '#0a0a0a', border: `1px solid ${color}`, color, fontSize: 10, letterSpacing: 1, borderRadius: 3, marginLeft: 8 });
  const eventCardStyle = (color: string): React.CSSProperties => ({ padding: 10, background: '#050505', border: `1px solid ${color}`, borderLeft: `3px solid ${color}`, borderRadius: 3, marginBottom: 8 });
  const eventTypeStyle = (color: string): React.CSSProperties => ({ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color, letterSpacing: 1 });

  const s: Record<string, React.CSSProperties> = {
    container: { width: '100%', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace" },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' as const },
    title: { fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', letterSpacing: 1 },
    subtitle: { fontSize: 11, color: '#888', letterSpacing: 1, marginTop: 4 },
    juniorTabs: { display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' as const },
    juniorTab: { padding: '10px 14px', background: '#0a0a0a', border: '1px solid #333', color: '#888', fontFamily: 'Orbitron, sans-serif', fontSize: 12, letterSpacing: 1, borderRadius: 3, cursor: 'pointer' },
    juniorTabActive: { background: '#0a1a0a', border: '1px solid #00ff41', color: '#00ff41' },
    card: { padding: 14, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4, marginBottom: 14 },
    cardTitle: { fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#00ff41', letterSpacing: 1, marginBottom: 10 },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
    statBox: { padding: '10px', background: '#050505', borderRadius: 3, textAlign: 'center' as const },
    statValue: { fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#00ff41', marginBottom: 2 },
    statLabel: { fontSize: 9, color: '#666', letterSpacing: 1, textTransform: 'uppercase' as const },
    eventHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    eventTime: { fontSize: 10, color: '#666' },
    eventDetail: { fontSize: 12, color: '#ccc', lineHeight: 1.4, marginBottom: 8 },
    resolveBtn: { padding: '4px 10px', background: 'transparent', border: '1px solid #00ff41', color: '#00ff41', fontSize: 10, letterSpacing: 1, borderRadius: 3, cursor: 'pointer' },
    resolvedTag: { fontSize: 10, color: '#00ff41', fontStyle: 'italic' as const },
    label: { display: 'block', fontSize: 10, color: '#888', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' as const },
    input: { width: '100%', padding: '6px 8px', background: '#050505', border: '1px solid #333', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace", fontSize: 12, borderRadius: 3, marginBottom: 8, outline: 'none', boxSizing: 'border-box' as const },
    note: { fontSize: 11, color: '#666', lineHeight: 1.5, fontStyle: 'italic' as const },
    coachLink: { display: 'inline-block', padding: '8px 14px', background: '#0a1a0a', border: '1px solid #00ff41', color: '#00ff41', fontFamily: 'Orbitron, sans-serif', fontSize: 11, letterSpacing: 1, borderRadius: 3, cursor: 'pointer', textDecoration: 'none' },
    pediatricianRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#050505', borderRadius: 3, fontSize: 12 },
    historyRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderBottom: '1px solid #1a1a1a', fontSize: 11 },
  };

  return (
    <div style={s.container}>
      <div style={s.headerRow}>
        <div>
          <div style={s.title}>PARENT DASHBOARD</div>
          <div style={s.subtitle}>
            {juniors.length} junior operator{juniors.length === 1 ? '' : 's'} linked
            {allUnresolvedCount > 0 && (
              <span style={badgeStyle('#ff8800')}>{allUnresolvedCount} unresolved</span>
            )}
          </div>
        </div>
      </div>

      {juniors.length > 1 && (
        <div style={s.juniorTabs}>
          {juniors.map(j => (
            <div
              key={j.id}
              style={{ ...s.juniorTab, ...(j.id === activeJuniorId ? s.juniorTabActive : {}) }}
              onClick={() => setActiveJuniorId(j.id)}
            >
              {j.callsign}
            </div>
          ))}
        </div>
      )}

      {/* SAFETY EVENTS — most important block, first */}
      <div style={s.card}>
        <div style={s.cardTitle}>SAFETY EVENTS</div>
        {unresolved.length === 0 && resolved.length === 0 && (
          <div style={s.note}>No safety events on file. The system flags pain, head-impact, and red-flag language automatically.</div>
        )}
        {unresolved.map((event, idx) => {
          const cfg = TYPE_LABEL[event.type] || { label: event.type.toUpperCase(), color: '#888' };
          return (
            <div key={`u-${idx}`} style={eventCardStyle(cfg.color)}>
              <div style={s.eventHeader}>
                <span style={eventTypeStyle(cfg.color)}>{cfg.label}</span>
                <span style={s.eventTime}>{formatRelative(event.timestamp)}</span>
              </div>
              <div style={s.eventDetail}>{event.detail}</div>
              <button style={s.resolveBtn} onClick={() => handleResolveEvent((safety.events || []).indexOf(event))}>
                MARK RESOLVED
              </button>
            </div>
          );
        })}
        {resolved.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: '#666', cursor: 'pointer', letterSpacing: 1 }}>
              {resolved.length} resolved
            </summary>
            <div style={{ marginTop: 8 }}>
              {resolved.map((event, idx) => {
                const cfg = TYPE_LABEL[event.type] || { label: event.type.toUpperCase(), color: '#888' };
                return (
                  <div key={`r-${idx}`} style={{ ...eventCardStyle('#333'), opacity: 0.6 }}>
                    <div style={s.eventHeader}>
                      <span style={eventTypeStyle(cfg.color)}>{cfg.label}</span>
                      <span style={s.eventTime}>{formatRelative(event.timestamp)}</span>
                    </div>
                    <div style={s.eventDetail}>{event.detail}</div>
                    <span style={s.resolvedTag}>
                      Resolved by {event.resolvedBy || 'unknown'} {event.resolvedAt ? formatRelative(event.resolvedAt) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>

      {/* COMPLIANCE / TRAINING SUMMARY */}
      <div style={s.card}>
        <div style={s.cardTitle}>{activeJunior.callsign} — LAST 7 DAYS</div>
        <div style={s.statsRow}>
          <div style={s.statBox}>
            <div style={s.statValue}>{last7Done}</div>
            <div style={s.statLabel}>Sessions Done</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statValue}>{last7Planned}</div>
            <div style={s.statLabel}>Sessions Planned</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statValue}>{(activeJunior.prs || []).length}</div>
            <div style={s.statLabel}>PRs Logged</div>
          </div>
        </div>
      </div>

      {/* RECENT TRAINING */}
      <div style={s.card}>
        <div style={s.cardTitle}>RECENT TRAINING</div>
        {Object.entries(activeJunior.workouts || {})
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 7)
          .map(([date, w]) => (
            <div key={date} style={s.historyRow}>
              <span style={{ color: '#888' }}>{date}</span>
              <span style={{ color: '#e0e0e0' }}>{w.title || 'Untitled'}</span>
              <span style={{ color: w.completed ? '#00ff41' : '#666' }}>{w.completed ? '✓ DONE' : 'PLANNED'}</span>
            </div>
          ))}
        {Object.keys(activeJunior.workouts || {}).length === 0 && (
          <div style={s.note}>No training logged yet.</div>
        )}
      </div>

      {/* PEDIATRICIAN + EMERGENCY CONTACT — parent-editable */}
      <div style={s.card}>
        <div style={s.cardTitle}>EMERGENCY CONTACT</div>
        <label style={s.label}>NAME</label>
        <input
          type="text"
          style={s.input}
          value={consent?.emergencyContact?.name || ''}
          onChange={e => handleUpdateEmergencyContact('name', e.target.value)}
        />
        <label style={s.label}>RELATIONSHIP</label>
        <input
          type="text"
          style={s.input}
          value={consent?.emergencyContact?.relationship || ''}
          onChange={e => handleUpdateEmergencyContact('relationship', e.target.value)}
        />
        <label style={s.label}>PHONE</label>
        <input
          type="tel"
          style={s.input}
          value={consent?.emergencyContact?.phone || ''}
          onChange={e => handleUpdateEmergencyContact('phone', e.target.value)}
        />

        <div style={{ ...s.pediatricianRow, marginTop: 8 }}>
          <span style={{ fontSize: 10, color: '#888', letterSpacing: 1 }}>PEDIATRICIAN CLEARANCE:</span>
          <span style={{ color: consent?.pediatricianClearance ? '#00ff41' : '#888', fontSize: 12 }}>
            {consent?.pediatricianClearance
              ? `✓ ON FILE${consent?.pediatricianClearanceDate ? ` (${consent.pediatricianClearanceDate})` : ''}`
              : 'NOT ON FILE'}
          </span>
        </div>
      </div>

      {/* COACH CONTACT */}
      {activeJunior.trainerId && (
        <div style={s.card}>
          <div style={s.cardTitle}>COACH</div>
          <p style={s.note}>Reach out to your junior&apos;s trainer directly. In-app secure messaging is on the roadmap.</p>
          <a style={s.coachLink} href={`mailto:?subject=Question about ${activeJunior.callsign}`}>
            EMAIL COACH
          </a>
          {onSelectJuniorForChat && (
            <button
              style={{ ...s.coachLink, marginLeft: 8, background: 'transparent' }}
              onClick={() => onSelectJuniorForChat(activeJunior)}
            >
              VIEW {activeJunior.callsign}&apos;S CHAT
            </button>
          )}
        </div>
      )}

      <p style={s.note}>
        You have read-only visibility into {activeJunior.callsign}&apos;s training log and Gunny chat. You cannot modify their workouts or chat history. Safety events are flagged automatically; resolving an event records your callsign as the resolver.
      </p>
    </div>
  );
}
