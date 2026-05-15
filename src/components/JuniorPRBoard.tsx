'use client';

// Junior PR Board — sport-performance metrics for ages 10–18.
//
// REPLACES the adult PRBoard for any operator with isJunior=true. Tracks
// speed (10m/20m/40m sprints), jumps (CMJ height, broad jump), agility
// (5-10-5, T-test, Illinois, 505), and endurance (mile, beep test, plank
// hold). Explicitly does NOT track 1RM strength loads — see
// docs/youth-soccer-corpus.md §11 (no maximal 1RM testing in unsupervised
// youth contexts).
//
// PRs persist in operator.prs (same column as adults), with the metric
// type encoded as a [bracket_prefix] in the notes field so the component
// can pick out junior entries on render. weight = primary numeric value
// (seconds for times, inches for jumps, level for tests). reps = optional
// secondary (shuttles for beep test).

import React, { useMemo, useState } from 'react';
import { Operator, PRRecord } from '@/lib/types';
import { getLocalDateStr } from '@/lib/dateUtils';

interface JuniorPRBoardProps {
  operator: Operator;
  onUpdateOperator: (updated: Operator) => void;
}

// Junior metric definitions. label = chip label, unit = display suffix,
// invertGood = true when LOWER is better (sprint times, mile time).
type JuniorMetricCategory = 'speed' | 'jump' | 'agility' | 'endurance' | 'isometric';

interface JuniorMetricDef {
  id: string;
  category: JuniorMetricCategory;
  label: string;
  unit: string;
  invertGood: boolean;
  desc: string;
  // Optional secondary field (e.g. beep test level + shuttles)
  secondary?: { label: string; unit: string };
}

export const JUNIOR_METRICS: JuniorMetricDef[] = [
  // Speed
  { id: '10m_sprint', category: 'speed', label: '10m sprint', unit: 's', invertGood: true, desc: 'Acceleration phase — start to 10m' },
  { id: '20m_sprint', category: 'speed', label: '20m sprint', unit: 's', invertGood: true, desc: 'Sport-relevant — most match sprints <20m' },
  { id: '40m_sprint', category: 'speed', label: '40m sprint', unit: 's', invertGood: true, desc: 'Max-speed extension' },
  // Jump
  { id: 'cmj', category: 'jump', label: 'Counter-movement jump', unit: 'in', invertGood: false, desc: 'Vertical jump from a quick dip — power benchmark' },
  { id: 'broad_jump', category: 'jump', label: 'Broad jump', unit: 'in', invertGood: false, desc: 'Horizontal power' },
  // Agility
  { id: 'agility_t', category: 'agility', label: 'T-test', unit: 's', invertGood: true, desc: 'Forward / lateral / back change of direction' },
  { id: '505', category: 'agility', label: '505 agility', unit: 's', invertGood: true, desc: 'Single 180° turn — reactive change of direction' },
  { id: 'illinois', category: 'agility', label: 'Illinois agility', unit: 's', invertGood: true, desc: 'Multi-cone weave + sprint' },
  // Endurance
  { id: 'yo_yo_ir1', category: 'endurance', label: 'Yo-Yo IR1', unit: 'm', invertGood: false, desc: 'Bangsbo 2008 — total distance covered' },
  { id: '30_15_ift', category: 'endurance', label: '30-15 IFT', unit: 'km/h', invertGood: false, desc: 'Buchheit 2008 — final velocity reached' },
  { id: 'beep_test', category: 'endurance', label: 'Beep test', unit: 'level', invertGood: false, desc: 'Multi-stage shuttle run', secondary: { label: 'Shuttles', unit: '' } },
  { id: 'mile_time', category: 'endurance', label: 'Mile time', unit: 'min', invertGood: true, desc: '1-mile run — aerobic baseline' },
  // Isometric / control
  { id: 'plank_hold', category: 'isometric', label: 'Plank hold', unit: 's', invertGood: false, desc: 'Front-plank hold to break in form' },
  { id: 'single_leg_balance', category: 'isometric', label: 'Single-leg balance (eyes closed)', unit: 's', invertGood: false, desc: 'Proprioception benchmark' },
];

// Bracket prefix encoded into notes so we can pick junior PRs out of the
// shared prs[] column. Format: "[metric_id] free-form notes…"
const NOTE_PREFIX_RE = /^\[([a-z0-9_]+)\]\s*/i;

function getMetricFromNotes(notes: string | undefined): JuniorMetricDef | null {
  if (!notes) return null;
  const m = notes.match(NOTE_PREFIX_RE);
  if (!m) return null;
  return JUNIOR_METRICS.find(x => x.id === m[1]) || null;
}

function stripMetricPrefix(notes: string | undefined): string {
  if (!notes) return '';
  return notes.replace(NOTE_PREFIX_RE, '').trim();
}

function formatValue(metric: JuniorMetricDef, weight: number, reps: number): string {
  // Generic formatter — treat weight as the primary numeric value and
  // append the metric's unit. Mile time stored as decimal minutes
  // (5.5 = 5:30) — render as mm:ss.
  if (metric.id === 'mile_time') {
    const mins = Math.floor(weight);
    const secs = Math.round((weight - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  if (metric.secondary && reps) {
    return `Lv ${weight} (${reps} sh)`;
  }
  return `${weight}${metric.unit}`;
}

const CATEGORY_ORDER: JuniorMetricCategory[] = ['speed', 'jump', 'agility', 'endurance', 'isometric'];
const CATEGORY_LABEL: Record<JuniorMetricCategory, string> = {
  speed: 'SPEED',
  jump: 'JUMP / POWER',
  agility: 'AGILITY',
  endurance: 'ENDURANCE',
  isometric: 'ISOMETRIC / CONTROL',
};

export default function JuniorPRBoard({ operator, onUpdateOperator }: JuniorPRBoardProps) {
  const [activeCategory, setActiveCategory] = useState<JuniorMetricCategory>('speed');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string>('10m_sprint');
  const [weightInput, setWeightInput] = useState<string>('');
  const [secondaryInput, setSecondaryInput] = useState<string>('');
  const [dateInput, setDateInput] = useState<string>(getLocalDateStr());
  const [notesInput, setNotesInput] = useState<string>('');

  // Filter operator.prs to junior entries only (those with [metric_id] prefix)
  const juniorPrs = useMemo(
    () =>
      (operator.prs || [])
        .map(pr => ({ pr, metric: getMetricFromNotes(pr.notes) }))
        .filter((x): x is { pr: PRRecord; metric: JuniorMetricDef } => !!x.metric),
    [operator.prs]
  );

  const visibleMetrics = JUNIOR_METRICS.filter(m => m.category === activeCategory);

  const handleAddPr = () => {
    const wt = parseFloat(weightInput);
    if (!Number.isFinite(wt) || wt <= 0) return;
    const metric = JUNIOR_METRICS.find(m => m.id === selectedMetric);
    if (!metric) return;
    const newPr: PRRecord = {
      id: `pr-junior-${Date.now()}`,
      exercise: metric.label,
      weight: wt,
      reps: secondaryInput ? parseInt(secondaryInput, 10) || 0 : 0,
      date: dateInput || getLocalDateStr(),
      notes: `[${metric.id}] ${notesInput.trim()}`.trim(),
      type: metric.category === 'endurance' ? 'endurance' : 'milestone',
    };
    const updated: Operator = {
      ...operator,
      prs: [...(operator.prs || []), newPr],
    };
    onUpdateOperator(updated);
    // Reset form
    setWeightInput('');
    setSecondaryInput('');
    setNotesInput('');
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    const updated: Operator = {
      ...operator,
      prs: (operator.prs || []).filter(p => p.id !== id),
    };
    onUpdateOperator(updated);
  };

  // For each visible metric, find the best ever + most recent
  const metricStats = useMemo(() => {
    const map: Record<string, { best: PRRecord | null; recent: PRRecord | null; all: PRRecord[] }> = {};
    for (const m of visibleMetrics) {
      const entries = juniorPrs.filter(x => x.metric.id === m.id).map(x => x.pr);
      const sorted = [...entries].sort((a, b) => (m.invertGood ? a.weight - b.weight : b.weight - a.weight));
      const best = sorted[0] || null;
      const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
      map[m.id] = { best, recent, all: entries };
    }
    return map;
  }, [visibleMetrics, juniorPrs]);

  const s: Record<string, React.CSSProperties> = {
    container: { width: '100%', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace" },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' as const },
    title: { fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', letterSpacing: 1 },
    subtitle: { fontSize: 11, color: '#888', letterSpacing: 1, marginTop: 4 },
    categoryRow: { display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' as const },
    categoryBtn: { padding: '8px 12px', background: '#0a0a0a', border: '1px solid #333', color: '#888', fontFamily: 'Orbitron, sans-serif', fontSize: 10, letterSpacing: 1, borderRadius: 3, cursor: 'pointer' },
    categoryBtnActive: { background: '#0a1a0a', border: '1px solid #00ff41', color: '#00ff41' },
    metricCard: { padding: 14, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4, marginBottom: 10 },
    metricCardActive: { borderLeft: '3px solid #00ff41' },
    metricLabel: { fontSize: 12, color: '#e0e0e0', letterSpacing: 1, fontWeight: 700, marginBottom: 2 },
    metricDesc: { fontSize: 11, color: '#666', lineHeight: 1.4, marginBottom: 8 },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 },
    statBox: { padding: '8px', background: '#050505', borderRadius: 3, textAlign: 'center' as const },
    statValue: { fontFamily: 'Orbitron, sans-serif', fontSize: 16, color: '#00ff41', marginBottom: 2 },
    statValueDim: { fontFamily: 'Orbitron, sans-serif', fontSize: 16, color: '#555', marginBottom: 2 },
    statLabel: { fontSize: 9, color: '#666', letterSpacing: 1, textTransform: 'uppercase' as const },
    historyRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid #1a1a1a', fontSize: 12 },
    historyDate: { color: '#888', fontSize: 11, letterSpacing: 1 },
    historyVal: { color: '#e0e0e0' },
    deleteBtn: { padding: '2px 8px', background: 'transparent', border: '1px solid #444', color: '#666', fontSize: 10, borderRadius: 3, cursor: 'pointer' },
    addBtn: { padding: '8px 14px', background: '#0a1a0a', border: '1px solid #00ff41', color: '#00ff41', fontFamily: 'Orbitron, sans-serif', fontSize: 11, letterSpacing: 1, borderRadius: 3, cursor: 'pointer' },
    formCard: { padding: 14, background: '#0a0a0a', border: '1px solid #00ff41', borderRadius: 4, marginBottom: 16 },
    label: { display: 'block', fontSize: 10, color: '#888', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' as const },
    input: { width: '100%', padding: '8px 10px', background: '#050505', border: '1px solid #333', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace", fontSize: 13, borderRadius: 3, marginBottom: 10, outline: 'none', boxSizing: 'border-box' as const },
    select: { width: '100%', padding: '8px 10px', background: '#050505', border: '1px solid #333', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace", fontSize: 13, borderRadius: 3, marginBottom: 10, outline: 'none', boxSizing: 'border-box' as const },
    formRow: { display: 'flex', gap: 8 },
    note: { fontSize: 11, color: '#666', lineHeight: 1.5, fontStyle: 'italic' as const, marginTop: 12 },
  };

  return (
    <div style={s.container}>
      <div style={s.headerRow}>
        <div>
          <div style={s.title}>SPORT PERFORMANCE LOG</div>
          <div style={s.subtitle}>Speed · Power · Agility · Endurance — never 1RM</div>
        </div>
        <button style={s.addBtn} onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? '× CANCEL' : '+ LOG NEW'}
        </button>
      </div>

      {showAddForm && (
        <div style={s.formCard}>
          <label style={s.label}>METRIC</label>
          <select
            style={s.select}
            value={selectedMetric}
            onChange={e => {
              setSelectedMetric(e.target.value);
              setWeightInput('');
              setSecondaryInput('');
            }}
          >
            {CATEGORY_ORDER.map(cat => (
              <optgroup key={cat} label={CATEGORY_LABEL[cat]}>
                {JUNIOR_METRICS.filter(m => m.category === cat).map(m => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.unit})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <div style={s.formRow}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>
                VALUE ({JUNIOR_METRICS.find(m => m.id === selectedMetric)?.unit})
              </label>
              <input
                type="number"
                step="0.01"
                style={s.input}
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                placeholder="1.78"
              />
            </div>
            {JUNIOR_METRICS.find(m => m.id === selectedMetric)?.secondary && (
              <div style={{ flex: 1 }}>
                <label style={s.label}>
                  {JUNIOR_METRICS.find(m => m.id === selectedMetric)?.secondary?.label.toUpperCase()}
                </label>
                <input
                  type="number"
                  style={s.input}
                  value={secondaryInput}
                  onChange={e => setSecondaryInput(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
          </div>

          <label style={s.label}>DATE</label>
          <input type="date" style={s.input} value={dateInput} onChange={e => setDateInput(e.target.value)} />

          <label style={s.label}>NOTES (optional)</label>
          <input
            type="text"
            style={s.input}
            value={notesInput}
            onChange={e => setNotesInput(e.target.value)}
            placeholder="e.g. windy, after warm-up only"
          />

          <button style={s.addBtn} onClick={handleAddPr}>
            SAVE PR
          </button>
        </div>
      )}

      <div style={s.categoryRow}>
        {CATEGORY_ORDER.map(cat => (
          <button
            key={cat}
            style={{ ...s.categoryBtn, ...(activeCategory === cat ? s.categoryBtnActive : {}) }}
            onClick={() => setActiveCategory(cat)}
          >
            {CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      {visibleMetrics.map(metric => {
        const stats = metricStats[metric.id] || { best: null, recent: null, all: [] };
        const hasData = stats.all.length > 0;
        return (
          <div key={metric.id} style={{ ...s.metricCard, ...(hasData ? s.metricCardActive : {}) }}>
            <div style={s.metricLabel}>{metric.label}</div>
            <div style={s.metricDesc}>{metric.desc}</div>

            <div style={s.statsRow}>
              <div style={s.statBox}>
                <div style={hasData ? s.statValue : s.statValueDim}>
                  {stats.best ? formatValue(metric, stats.best.weight, stats.best.reps) : '—'}
                </div>
                <div style={s.statLabel}>BEST</div>
              </div>
              <div style={s.statBox}>
                <div style={hasData ? s.statValue : s.statValueDim}>
                  {stats.recent ? formatValue(metric, stats.recent.weight, stats.recent.reps) : '—'}
                </div>
                <div style={s.statLabel}>RECENT</div>
              </div>
              <div style={s.statBox}>
                <div style={hasData ? s.statValue : s.statValueDim}>{stats.all.length || '—'}</div>
                <div style={s.statLabel}>LOGGED</div>
              </div>
            </div>

            {stats.all.length > 0 && (
              <div style={{ marginTop: 12, maxHeight: 180, overflowY: 'auto' }}>
                {[...stats.all]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(pr => (
                    <div key={pr.id} style={s.historyRow}>
                      <span style={s.historyDate}>{pr.date}</span>
                      <span style={s.historyVal}>{formatValue(metric, pr.weight, pr.reps)}</span>
                      <span style={{ ...s.historyDate, flex: 1, marginLeft: 8 }}>
                        {stripMetricPrefix(pr.notes)}
                      </span>
                      <button style={s.deleteBtn} onClick={() => handleDelete(pr.id)}>
                        DEL
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}

      <div style={s.note}>
        Junior operators don&apos;t track 1RM strength loads — performance is measured on the field. Speed, jump, agility, and endurance metrics are the right benchmarks for ages 10–18 (NSCA YPD model + AAP).
      </div>
    </div>
  );
}
