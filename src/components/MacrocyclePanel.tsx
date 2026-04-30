'use client';

// MacrocyclePanel — operator-facing UI for the long-horizon goal engine.
//
// Two states:
//   1. No active goal: shows a "Set a Goal" CTA + a brief explainer of
//      what the macrocycle does (calendar-aware periodization).
//   2. Active goal(s): shows each cycle's header (name, type, days-to-goal),
//      a horizontal timeline of blocks colored by kind, and the active
//      block highlighted with its description + volume/intensity scalers.
//
// Goal entry is a small modal — pick goal type, date, priority, name. The
// engine in src/lib/macrocycle.ts builds the cycle on save.

import React, { useMemo, useState } from 'react';
import type { MacroCycle, MacroGoal, MacroGoalType, Operator } from '@/lib/types';
import { buildMacroCycle, getActiveBlock, daysToGoal, recomputeOnGoalDateChange } from '@/lib/macrocycle';
import { getTemplateNominalWeeks } from '@/lib/macrocycleLibrary';
import { getLocalDateStr } from '@/lib/dateUtils';
import { useLanguage } from '@/lib/i18n';

interface MacrocyclePanelProps {
  operator: Operator;
  onUpdateOperator: (updated: Operator) => void;
}

const GOAL_TYPE_OPTIONS: { value: MacroGoalType; labelKey: string; nominalWeeks: number }[] = [
  { value: 'powerlifting_meet', labelKey: 'macrocycle.goal.powerlifting_meet', nominalWeeks: getTemplateNominalWeeks('powerlifting_meet') },
  { value: 'hypertrophy_phase', labelKey: 'macrocycle.goal.hypertrophy_phase', nominalWeeks: getTemplateNominalWeeks('hypertrophy_phase') },
  { value: 'season_prep',       labelKey: 'macrocycle.goal.season_prep',       nominalWeeks: getTemplateNominalWeeks('season_prep') },
  { value: 'fat_loss',          labelKey: 'macrocycle.goal.fat_loss',          nominalWeeks: getTemplateNominalWeeks('fat_loss') },
];

const BLOCK_COLORS: Record<string, string> = {
  general_prep:    '#3b82f6',
  specific_prep:   '#0ea5e9',
  accumulation:    '#22c55e',
  intensification: '#f59e0b',
  peak:            '#ef4444',
  taper:           '#a855f7',
  deload:          '#64748b',
  maintenance:     '#94a3b8',
  cut:             '#ec4899',
  transition:      '#71717a',
};

export default function MacrocyclePanel({ operator, onUpdateOperator }: MacrocyclePanelProps) {
  const { t } = useLanguage();
  const cycles = operator.macroCycles || [];
  const today = getLocalDateStr();

  const [showSetup, setShowSetup] = useState(false);

  const handleAddGoal = (form: {
    type: MacroGoalType;
    name: string;
    targetDate: string;
    priority: 1 | 2;
  }) => {
    const goal: MacroGoal = {
      id: `mg-${Date.now()}`,
      type: form.type,
      name: form.name.trim() || t(GOAL_TYPE_OPTIONS.find((o) => o.value === form.type)!.labelKey),
      targetDate: form.targetDate,
      priority: form.priority,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    const cycle = buildMacroCycle(goal, today);
    // Cap at 2 active cycles. If already 2, refuse — UI prevents this.
    const active = (operator.macroCycles || []).filter((c) => c.goal.status === 'active');
    if (active.length >= 2) {
      alert(t('macrocycle.alert_max'));
      return;
    }
    onUpdateOperator({
      ...operator,
      macroCycles: [...(operator.macroCycles || []), cycle],
    });
    setShowSetup(false);
  };

  const handleRemoveGoal = (cycleId: string) => {
    if (!confirm(t('macrocycle.confirm_remove'))) return;
    onUpdateOperator({
      ...operator,
      macroCycles: (operator.macroCycles || []).filter((c) => c.id !== cycleId),
    });
  };

  const handleMoveGoalDate = (cycleId: string, newDate: string) => {
    const cycle = (operator.macroCycles || []).find((c) => c.id === cycleId);
    if (!cycle) return;
    const recomputed = recomputeOnGoalDateChange(cycle, newDate, today);
    onUpdateOperator({
      ...operator,
      macroCycles: (operator.macroCycles || []).map((c) => (c.id === cycleId ? recomputed : c)),
    });
  };

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', letterSpacing: 1 }}>
            {t('macrocycle.title')}
          </div>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {t('macrocycle.subtitle')}
          </div>
        </div>
        {cycles.length < 2 && (
          <button
            type="button"
            onClick={() => setShowSetup(true)}
            className="btn btn-primary btn-sm"
          >
            {t('macrocycle.set_goal')}
          </button>
        )}
      </div>

      {cycles.length === 0 && !showSetup && (
        <div
          style={{
            padding: 16,
            background: 'rgba(0,255,65,0.03)',
            border: '1px dashed rgba(0,255,65,0.2)',
            borderRadius: 6,
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 13,
            color: '#a0a0a0',
            lineHeight: 1.6,
          }}
        >
          {t('macrocycle.empty_state')}
        </div>
      )}

      {showSetup && (
        <GoalSetupForm
          today={today}
          existingCount={cycles.length}
          onCancel={() => setShowSetup(false)}
          onSubmit={handleAddGoal}
        />
      )}

      {cycles.map((cycle) => (
        <CycleCard
          key={cycle.id}
          cycle={cycle}
          today={today}
          onRemove={() => handleRemoveGoal(cycle.id)}
          onMoveDate={(d) => handleMoveGoalDate(cycle.id, d)}
        />
      ))}
    </div>
  );
}

// ─── Goal-setup form ──────────────────────────────────────────────────────

interface GoalSetupFormProps {
  today: string;
  existingCount: number;
  onCancel: () => void;
  onSubmit: (form: { type: MacroGoalType; name: string; targetDate: string; priority: 1 | 2 }) => void;
}

function GoalSetupForm({ today, existingCount, onCancel, onSubmit }: GoalSetupFormProps) {
  const { t } = useLanguage();
  const [type, setType] = useState<MacroGoalType>('powerlifting_meet');
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState(() => {
    // Default to 12 weeks from today — sane starting point for any goal type.
    const d = new Date();
    d.setDate(d.getDate() + 84);
    return d.toISOString().slice(0, 10);
  });
  const [priority, setPriority] = useState<1 | 2>(existingCount === 0 ? 1 : 2);

  const nominalWeeks = useMemo(
    () => GOAL_TYPE_OPTIONS.find((o) => o.value === type)?.nominalWeeks || 12,
    [type],
  );

  const intervalWeeks = useMemo(() => {
    const ms = new Date(`${targetDate}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime();
    return Math.max(0, Math.floor(ms / (7 * 86400000)));
  }, [targetDate, today]);

  const fitNote =
    intervalWeeks < nominalWeeks
      ? t('macrocycle.fit_short').replace('{interval}', String(intervalWeeks)).replace('{nominal}', String(nominalWeeks))
      : intervalWeeks > nominalWeeks
        ? t('macrocycle.fit_long').replace('{interval}', String(intervalWeeks)).replace('{nominal}', String(nominalWeeks))
        : t('macrocycle.fit_exact').replace('{interval}', String(intervalWeeks)).replace('{nominal}', String(nominalWeeks));

  return (
    <div
      style={{
        padding: 14,
        background: '#0a0a0a',
        border: '1px solid rgba(0,255,65,0.25)',
        borderRadius: 6,
        marginBottom: 12,
      }}
    >
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#00ff41', letterSpacing: 2, marginBottom: 12 }}>
        {t('macrocycle.setup_heading')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <label style={{ display: 'block', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#888' }}>
          {t('macrocycle.goal_type')}
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MacroGoalType)}
            style={{
              width: '100%',
              marginTop: 4,
              padding: '6px 8px',
              background: '#000',
              color: '#e0e0e0',
              border: '1px solid #333',
              fontFamily: 'inherit',
            }}
          >
            {GOAL_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)} · {o.nominalWeeks}{t('macrocycle.nominal_suffix')}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'block', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#888' }}>
          {t('macrocycle.priority')}
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) as 1 | 2)}
            style={{
              width: '100%',
              marginTop: 4,
              padding: '6px 8px',
              background: '#000',
              color: '#e0e0e0',
              border: '1px solid #333',
              fontFamily: 'inherit',
            }}
          >
            <option value={1}>{t('macrocycle.priority_1')}</option>
            <option value={2}>{t('macrocycle.priority_2')}</option>
          </select>
        </label>
      </div>
      <label style={{ display: 'block', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#888', marginBottom: 10 }}>
        {t('macrocycle.goal_name_label')}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('macrocycle.goal_name_placeholder')}
          style={{
            width: '100%',
            marginTop: 4,
            padding: '6px 8px',
            background: '#000',
            color: '#e0e0e0',
            border: '1px solid #333',
            fontFamily: 'inherit',
          }}
        />
      </label>
      <label style={{ display: 'block', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#888', marginBottom: 8 }}>
        {t('macrocycle.target_date')}
        <input
          type="date"
          value={targetDate}
          min={today}
          onChange={(e) => setTargetDate(e.target.value)}
          style={{
            width: '100%',
            marginTop: 4,
            padding: '6px 8px',
            background: '#000',
            color: '#e0e0e0',
            border: '1px solid #333',
            fontFamily: 'inherit',
          }}
        />
      </label>
      <div
        style={{
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: 11,
          color: intervalWeeks < nominalWeeks ? '#FF8C00' : '#a0a0a0',
          marginBottom: 12,
        }}
      >
        {fitNote}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          {t('macrocycle.cancel')}
        </button>
        <button
          type="button"
          onClick={() => onSubmit({ type, name, targetDate, priority })}
          disabled={!targetDate || intervalWeeks === 0}
          className="btn btn-primary btn-sm"
          style={{ flex: 1 }}
        >
          {t('macrocycle.build')}
        </button>
      </div>
    </div>
  );
}

// ─── Cycle card ───────────────────────────────────────────────────────────

interface CycleCardProps {
  cycle: MacroCycle;
  today: string;
  onRemove: () => void;
  onMoveDate: (newDate: string) => void;
}

const CycleCard: React.FC<CycleCardProps> = ({ cycle, today, onRemove, onMoveDate }) => {
  const { t } = useLanguage();
  const active = getActiveBlock(cycle, today);
  const dToGoal = daysToGoal(cycle, today);
  const totalDays = (() => {
    const start = cycle.blocks[0]?.startDate || today;
    const end = cycle.goal.targetDate;
    return Math.max(
      1,
      Math.round(
        (new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86400000,
      ),
    );
  })();

  const [editingDate, setEditingDate] = useState(false);
  const [pendingDate, setPendingDate] = useState(cycle.goal.targetDate);

  return (
    <div
      style={{
        padding: 14,
        background: '#0a0a0a',
        border: `1px solid ${cycle.goal.priority === 1 ? 'rgba(0,255,65,0.35)' : 'rgba(0,255,65,0.18)'}`,
        borderLeft: `3px solid ${cycle.goal.priority === 1 ? '#00ff41' : '#FF8C00'}`,
        borderRadius: 6,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, color: '#fff', letterSpacing: 1 }}>
            {cycle.goal.name}
          </div>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {cycle.goal.type.replace(/_/g, ' ').toUpperCase()} · {t('macrocycle.priority_label')} {cycle.goal.priority} · {dToGoal >= 0 ? `${dToGoal} ${t('macrocycle.days_to_goal_suffix')}` : `${Math.abs(dToGoal)} ${t('macrocycle.days_past_suffix')}`}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('macrocycle.remove_aria')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-tertiary)',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 11,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          ✕
        </button>
      </div>

      {/* Block timeline — horizontal bar with proportional segments. */}
      <div
        style={{
          display: 'flex',
          height: 22,
          marginBottom: 6,
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid rgba(0,255,65,0.15)',
        }}
      >
        {cycle.blocks.map((b) => {
          const startMs = new Date(`${b.startDate}T12:00:00Z`).getTime();
          const endMs = new Date(`${b.endDate}T12:00:00Z`).getTime();
          const blockDays = Math.max(1, Math.round((endMs - startMs) / 86400000));
          const widthPct = (blockDays / totalDays) * 100;
          const isActive = active?.id === b.id;
          return (
            <div
              key={b.id}
              title={`${b.name} · ${b.startDate} → ${b.endDate}`}
              style={{
                width: `${widthPct}%`,
                background: BLOCK_COLORS[b.kind] || '#444',
                opacity: isActive ? 1 : 0.55,
                borderRight: '1px solid rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 9,
                color: '#000',
                fontWeight: 700,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {widthPct >= 8 ? b.name.split(' ')[0] : ''}
            </div>
          );
        })}
      </div>

      {active && (
        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: '#a0a0a0', marginTop: 8 }}>
          <div style={{ color: '#00ff41', fontWeight: 700, marginBottom: 4 }}>
            {t('macrocycle.active_label')} {active.name}
          </div>
          <div style={{ marginBottom: 4 }}>{active.description}</div>
          <div style={{ color: 'var(--text-tertiary)' }}>
            {t('macrocycle.vol_int').replace('{vol}', active.volumeMultiplier.toFixed(2)).replace('{int}', active.intensityMultiplier.toFixed(2))}
            {active.performanceMarker && ` · ${t('macrocycle.marker_prefix')} ${active.performanceMarker.label}`}
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-dim)' }}>
          {t('macrocycle.target_label')} {cycle.goal.targetDate}
        </div>
        {editingDate ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="date"
              value={pendingDate}
              min={today}
              onChange={(e) => setPendingDate(e.target.value)}
              style={{
                padding: '4px 6px',
                background: '#000',
                color: '#e0e0e0',
                border: '1px solid #333',
                fontFamily: 'inherit',
                fontSize: 11,
              }}
            />
            <button
              type="button"
              onClick={() => { onMoveDate(pendingDate); setEditingDate(false); }}
              className="btn btn-primary btn-sm"
            >
              {t('macrocycle.save')}
            </button>
            <button
              type="button"
              onClick={() => { setPendingDate(cycle.goal.targetDate); setEditingDate(false); }}
              className="btn btn-ghost btn-sm"
            >
              {t('macrocycle.cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingDate(true)}
            className="btn btn-ghost btn-sm"
          >
            {t('macrocycle.move_date')}
          </button>
        )}
      </div>
    </div>
  );
};
