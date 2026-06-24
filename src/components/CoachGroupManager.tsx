'use client';

// CoachGroupManager — coach surface for creating/editing the rosters they run
// as shared group sessions, and launching the runner. Groups live on the
// coach's own Operator (coachGroups JSON), edited via onUpdateCoach → profile
// PATCH (SELF path). Member pool = juniors the coach is the trainer of (or any
// junior, for head_trainer/admin).

import React, { useMemo, useState } from 'react';
import type { CoachGroup, Operator } from '@/lib/types';
import Icon from '@/components/Icons';

interface Props {
  coach: Operator;
  allOperators: Operator[];
  /** head_trainer / admin may build groups from ANY junior, not just their assigned ones. */
  canSeeAllJuniors: boolean;
  onUpdateCoach: (updated: Operator) => void;
  onRunGroup: (group: CoachGroup, members: Operator[]) => void;
}

const card: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #1a1a1a',
  borderRadius: 8,
  padding: 14,
  marginBottom: 12,
};
const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 6,
  border: `1px solid ${active ? '#00ff41' : '#2a2a2a'}`,
  background: active ? 'rgba(0,255,65,0.12)' : 'transparent',
  color: active ? '#00ff41' : '#aaa',
  fontFamily: 'Share Tech Mono, monospace',
  fontSize: 12,
  cursor: 'pointer',
});

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `grp-${crypto.randomUUID()}`;
  } catch { /* fall through */ }
  return `grp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export default function CoachGroupManager({ coach, allOperators, canSeeAllJuniors, onUpdateCoach, onRunGroup }: Props) {
  const groups = useMemo<CoachGroup[]>(() => coach.coachGroups || [], [coach.coachGroups]);

  const eligibleJuniors = useMemo(
    () => allOperators.filter((o) => o.isJunior && (canSeeAllJuniors || o.trainerId === coach.id)),
    [allOperators, canSeeAllJuniors, coach.id],
  );

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [ageBand, setAgeBand] = useState<'4-7' | '4-10'>('4-7');
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const memberOf = (g: CoachGroup): Operator[] =>
    g.memberIds.map((id) => allOperators.find((o) => o.id === id)).filter(Boolean) as Operator[];

  const resetForm = () => { setCreating(false); setName(''); setAgeBand('4-7'); setPicked({}); };

  const saveGroup = () => {
    const memberIds = Object.keys(picked).filter((id) => picked[id]);
    if (!name.trim() || memberIds.length === 0) return;
    const group: CoachGroup = {
      id: newId(),
      name: name.trim(),
      sport: 'soccer',
      ageBand,
      memberIds,
      createdAt: new Date().toISOString(),
    };
    onUpdateCoach({ ...coach, coachGroups: [...groups, group] });
    resetForm();
  };

  const deleteGroup = (id: string) => {
    onUpdateCoach({ ...coach, coachGroups: groups.filter((g) => g.id !== id) });
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 15, color: '#00ff41', letterSpacing: 1 }}>
          GROUP SESSIONS
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} style={{ ...chip(true), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon.Plus size={12} /> New group
          </button>
        )}
      </div>

      {eligibleJuniors.length === 0 && (
        <div style={{ ...card, color: '#888', fontSize: 12 }}>
          No junior athletes are assigned to you yet. Provision them (or have an admin set their trainer to you) to build a group.
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div style={card}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, color: '#eee', marginBottom: 10 }}>NEW GROUP</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name (e.g. Littles — Saturday AM)"
            style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #2a2a2a', background: '#050505', color: '#ddd', fontSize: 13, marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <span style={{ color: '#888', fontSize: 11, alignSelf: 'center' }}>Age band:</span>
            <button onClick={() => setAgeBand('4-7')} style={chip(ageBand === '4-7')}>4–7</button>
            <button onClick={() => setAgeBand('4-10')} style={chip(ageBand === '4-10')}>4–10</button>
          </div>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>Members:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {eligibleJuniors.map((j) => (
              <button key={j.id} onClick={() => setPicked((p) => ({ ...p, [j.id]: !p[j.id] }))} style={chip(!!picked[j.id])}>
                {j.callsign}{typeof j.juniorAge === 'number' ? ` · ${j.juniorAge}` : ''}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={resetForm} style={{ ...chip(false), flex: 1 }}>Cancel</button>
            <button
              onClick={saveGroup}
              disabled={!name.trim() || Object.values(picked).every((v) => !v)}
              style={{ ...chip(true), flex: 2, opacity: !name.trim() || Object.values(picked).every((v) => !v) ? 0.5 : 1 }}
            >
              Save group
            </button>
          </div>
        </div>
      )}

      {/* Existing groups */}
      {groups.map((g) => {
        const members = memberOf(g);
        return (
          <div key={g.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, color: '#eee' }}>{g.name}</div>
                <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#888', marginTop: 2 }}>
                  {members.length} kids · {g.ageBand} · {g.sport}
                </div>
                <div style={{ color: '#aaa', fontSize: 11, marginTop: 6 }}>
                  {members.map((m) => m.callsign).join(' · ') || 'No members'}
                </div>
              </div>
              <button onClick={() => deleteGroup(g.id)} style={{ ...chip(false), borderColor: '#3a2020', color: '#ff6b6b' }}>
                <Icon.Trash size={12} />
              </button>
            </div>
            <button
              onClick={() => onRunGroup(g, members)}
              disabled={members.length === 0}
              style={{ ...chip(true), width: '100%', marginTop: 12, opacity: members.length === 0 ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Icon.Play size={12} /> Run session
            </button>
          </div>
        );
      })}
    </div>
  );
}
