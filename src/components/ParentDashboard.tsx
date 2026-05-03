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
import { useLanguage } from '@/lib/i18n';
import DailyOpsApprovalCard from '@/components/DailyOpsApprovalCard';

interface ParentDashboardProps {
  parent: Operator;
  juniors: Operator[];
  onUpdateJunior: (updated: Operator) => void;
  onSelectJuniorForChat?: (junior: Operator) => void;
}

// Type labels — color stays static, label resolved at render time via t().
const TYPE_LABEL: Record<JuniorSafetyEvent['type'], { labelKey: string; color: string }> = {
  concussion_keyword: { labelKey: 'parent.evt.concussion', color: '#ff4444' },
  pain_report: { labelKey: 'parent.evt.pain', color: '#ff8800' },
  red_flag: { labelKey: 'parent.evt.red_flag', color: '#ffaa00' },
  refusal: { labelKey: 'parent.evt.refusal', color: '#888' },
  parent_alert: { labelKey: 'parent.evt.parent_alert', color: '#00aaff' },
};

function formatRelative(iso: string, t: (k: string) => string): string {
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('parent.time.just_now');
  if (m < 60) return `${m} ${t('parent.time.m_suffix')}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t('parent.time.h_suffix')}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ${t('parent.time.d_suffix')}`;
  return new Date(iso).toLocaleDateString();
}

export default function ParentDashboard({ parent, juniors, onUpdateJunior, onSelectJuniorForChat }: ParentDashboardProps) {
  const { t } = useLanguage();
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
          <div style={s.title}>{t('parent.title')}</div>
          <div style={s.subtitle}>
            {juniors.length} {juniors.length === 1 ? t('parent.linked_singular') : t('parent.linked_plural')}
            {allUnresolvedCount > 0 && (
              <span style={badgeStyle('#ff8800')}>{allUnresolvedCount} {t('parent.unresolved_suffix')}</span>
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
        <div style={s.cardTitle}>{t('parent.safety_events')}</div>
        {unresolved.length === 0 && resolved.length === 0 && (
          <div style={s.note}>{t('parent.no_safety_events')}</div>
        )}
        {unresolved.map((event, idx) => {
          const cfg = TYPE_LABEL[event.type];
          const label = cfg ? t(cfg.labelKey) : event.type.toUpperCase();
          const color = cfg ? cfg.color : '#888';
          return (
            <div key={`u-${idx}`} style={eventCardStyle(color)}>
              <div style={s.eventHeader}>
                <span style={eventTypeStyle(color)}>{label}</span>
                <span style={s.eventTime}>{formatRelative(event.timestamp, t)}</span>
              </div>
              <div style={s.eventDetail}>{event.detail}</div>
              <button style={s.resolveBtn} onClick={() => handleResolveEvent((safety.events || []).indexOf(event))}>
                {t('parent.mark_resolved')}
              </button>
            </div>
          );
        })}
        {resolved.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: '#666', cursor: 'pointer', letterSpacing: 1 }}>
              {resolved.length} {t('parent.resolved_count_suffix')}
            </summary>
            <div style={{ marginTop: 8 }}>
              {resolved.map((event, idx) => {
                const cfg = TYPE_LABEL[event.type];
                const label = cfg ? t(cfg.labelKey) : event.type.toUpperCase();
                const color = cfg ? cfg.color : '#888';
                return (
                  <div key={`r-${idx}`} style={{ ...eventCardStyle('#333'), opacity: 0.6 }}>
                    <div style={s.eventHeader}>
                      <span style={eventTypeStyle(color)}>{label}</span>
                      <span style={s.eventTime}>{formatRelative(event.timestamp, t)}</span>
                    </div>
                    <div style={s.eventDetail}>{event.detail}</div>
                    <span style={s.resolvedTag}>
                      {t('parent.resolved_by_prefix')} {event.resolvedBy || t('parent.unknown')} {event.resolvedAt ? formatRelative(event.resolvedAt, t) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>

      {/* DAILY OPS PENDING APPROVAL — surfaces only when there are
          plans awaiting parent review across any linked junior. The
          card hides itself when the queue is empty. */}
      <DailyOpsApprovalCard />

      {/* COMPLIANCE / TRAINING SUMMARY */}
      <div style={s.card}>
        <div style={s.cardTitle}>{activeJunior.callsign} {t('parent.last_7_days_suffix')}</div>
        <div style={s.statsRow}>
          <div style={s.statBox}>
            <div style={s.statValue}>{last7Done}</div>
            <div style={s.statLabel}>{t('parent.sessions_done')}</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statValue}>{last7Planned}</div>
            <div style={s.statLabel}>{t('parent.sessions_planned')}</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statValue}>{(activeJunior.prs || []).length}</div>
            <div style={s.statLabel}>{t('parent.prs_logged')}</div>
          </div>
        </div>
      </div>

      {/* RECENT TRAINING */}
      <div style={s.card}>
        <div style={s.cardTitle}>{t('parent.recent_training')}</div>
        {Object.entries(activeJunior.workouts || {})
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 7)
          .map(([date, w]) => (
            <div key={date} style={s.historyRow}>
              <span style={{ color: '#888' }}>{date}</span>
              <span style={{ color: '#e0e0e0' }}>{w.title || t('parent.untitled')}</span>
              <span style={{ color: w.completed ? '#00ff41' : '#666' }}>{w.completed ? t('parent.done') : t('parent.planned')}</span>
            </div>
          ))}
        {Object.keys(activeJunior.workouts || {}).length === 0 && (
          <div style={s.note}>{t('parent.no_training')}</div>
        )}
      </div>

      {/* PEDIATRICIAN + EMERGENCY CONTACT — parent-editable */}
      <div style={s.card}>
        <div style={s.cardTitle}>{t('parent.emergency_contact')}</div>
        <label style={s.label}>{t('parent.name_label')}</label>
        <input
          type="text"
          style={s.input}
          value={consent?.emergencyContact?.name || ''}
          onChange={e => handleUpdateEmergencyContact('name', e.target.value)}
        />
        <label style={s.label}>{t('parent.relationship_label')}</label>
        <input
          type="text"
          style={s.input}
          value={consent?.emergencyContact?.relationship || ''}
          onChange={e => handleUpdateEmergencyContact('relationship', e.target.value)}
        />
        <label style={s.label}>{t('parent.phone_label')}</label>
        <input
          type="tel"
          style={s.input}
          value={consent?.emergencyContact?.phone || ''}
          onChange={e => handleUpdateEmergencyContact('phone', e.target.value)}
        />

        <div style={{ ...s.pediatricianRow, marginTop: 8 }}>
          <span style={{ fontSize: 10, color: '#888', letterSpacing: 1 }}>{t('parent.pediatrician_label')}</span>
          <span style={{ color: consent?.pediatricianClearance ? '#00ff41' : '#888', fontSize: 12 }}>
            {consent?.pediatricianClearance
              ? `${t('parent.pediatrician_on_file')}${consent?.pediatricianClearanceDate ? ` (${consent.pediatricianClearanceDate})` : ''}`
              : t('parent.pediatrician_not_on_file')}
          </span>
        </div>
      </div>

      {/* COACH CONTACT */}
      {activeJunior.trainerId && (
        <div style={s.card}>
          <div style={s.cardTitle}>{t('parent.coach')}</div>
          <p style={s.note}>{t('parent.coach_note')}</p>
          <a style={s.coachLink} href={`mailto:?subject=${t('parent.email_subject_prefix')} ${activeJunior.callsign}`}>
            {t('parent.email_coach')}
          </a>
          {onSelectJuniorForChat && (
            <button
              style={{ ...s.coachLink, marginLeft: 8, background: 'transparent' }}
              onClick={() => onSelectJuniorForChat(activeJunior)}
            >
              {t('parent.view_chat_prefix')} {activeJunior.callsign}{t('parent.view_chat_suffix')}
            </button>
          )}
        </div>
      )}

      <p style={s.note}>
        {t('parent.footer').replace('{callsign}', activeJunior.callsign)}
      </p>
    </div>
  );
}
