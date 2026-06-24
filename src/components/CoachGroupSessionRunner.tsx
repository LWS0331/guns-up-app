'use client';

// CoachGroupSessionRunner — full-screen takeover where a coach runs ONE shared
// youth-soccer session for a small group of young juniors on a single device.
//
// Flow: ATTENDANCE (who's here) → DRILLS (shared stepper, mark each done) →
// FINISH (per-kid effort/note/safety-flag) → POST /api/coach/group-session,
// which fans the one session out into each member's workouts[date].
//
// Patterned on ParentLedWorkoutMode (stepper + per-kid effort → sRPE + safety
// quick-log), but the save is a single server fan-out (never a per-kid loop —
// the app's debounced save would collapse those; see the route's header).

import React, { useEffect, useMemo, useState } from 'react';
import type { CoachGroup, JuniorSafetyEventType, Operator, Workout, WorkoutBlock } from '@/lib/types';
import { getAuthToken } from '@/lib/authClient';
import { getLocalDateStr } from '@/lib/dateUtils';
import Icon from '@/components/Icons';

type EffortLevel = 'effortful' | 'engaged' | 'distracted' | 'refused';

const EFFORT_OPTS: Array<{ id: EffortLevel; label: string }> = [
  { id: 'effortful', label: 'Crushed it' },
  { id: 'engaged', label: 'Engaged' },
  { id: 'distracted', label: 'Distracted' },
  { id: 'refused', label: 'Refused' },
];

const SAFETY_BTNS: Array<{ type: JuniorSafetyEventType; label: string }> = [
  { type: 'pain_report', label: 'Pain' },
  { type: 'concussion_keyword', label: 'Head/Concussion' },
  { type: 'refusal', label: 'Refusal' },
];

interface Props {
  coach: Operator;
  group: CoachGroup;
  members: Operator[];
  onExit: () => void;
  /** Fired after a successful fan-out so the parent can refresh + toast. */
  onComplete?: (result: { written: number; dateISO: string }) => void;
}

const card: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #1a1a1a',
  borderRadius: 8,
  padding: 14,
};
const btn = (active: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  borderRadius: 6,
  border: `1px solid ${active ? '#00ff41' : '#2a2a2a'}`,
  background: active ? 'rgba(0,255,65,0.12)' : 'transparent',
  color: active ? '#00ff41' : '#aaa',
  fontFamily: 'Share Tech Mono, monospace',
  fontSize: 12,
  cursor: 'pointer',
});

export default function CoachGroupSessionRunner({ coach, group, members, onExit, onComplete }: Props) {
  const dateISO = useMemo(() => getLocalDateStr(), []);
  const [phase, setPhase] = useState<'attendance' | 'drills' | 'finish'>('attendance');

  // Generated shared session.
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [genLoading, setGenLoading] = useState(true);
  const [genError, setGenError] = useState<string | null>(null);

  // Per-kid state.
  const [attendance, setAttendance] = useState<Record<string, boolean>>(
    () => Object.fromEntries(members.map((m) => [m.id, true])),
  );
  const [effort, setEffort] = useState<Record<string, EffortLevel>>(
    () => Object.fromEntries(members.map((m) => [m.id, 'engaged' as EffortLevel])),
  );
  const [kidNotes, setKidNotes] = useState<Record<string, string>>({});
  const [kidFlags, setKidFlags] = useState<Record<string, Array<{ type: JuniorSafetyEventType; detail: string }>>>({});

  // Drill stepper.
  const [blockDone, setBlockDone] = useState<Record<string, boolean>>({});
  const [stepIdx, setStepIdx] = useState(0);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Generate the shared session on mount (template fallback guarantees a
  // runnable workout even if Gunny/network fails).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/coach/group-session/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
          body: JSON.stringify({
            groupId: group.id,
            sport: group.sport,
            ageBand: group.ageBand,
            memberCount: members.length,
            dateISO,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data?.workout) {
          setGenError(data?.error || 'Could not generate a session.');
        } else {
          setWorkout(data.workout as Workout);
        }
      } catch {
        if (!cancelled) setGenError('Network error generating the session.');
      } finally {
        if (!cancelled) setGenLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [group.id, group.sport, group.ageBand, members.length, dateISO]);

  const steps = useMemo(() => {
    if (!workout) return [] as Array<{ kind: 'warmup' | 'cooldown' } | { kind: 'block'; block: WorkoutBlock }>;
    const out: Array<{ kind: 'warmup' | 'cooldown' } | { kind: 'block'; block: WorkoutBlock }> = [];
    if (workout.warmup?.trim()) out.push({ kind: 'warmup' });
    workout.blocks.forEach((b) => out.push({ kind: 'block', block: b }));
    if (workout.cooldown?.trim()) out.push({ kind: 'cooldown' });
    return out;
  }, [workout]);

  const present = members.filter((m) => attendance[m.id]);

  const toggleFlag = (memberId: string, type: JuniorSafetyEventType, label: string) => {
    setKidFlags((prev) => {
      const cur = prev[memberId] || [];
      const exists = cur.some((f) => f.type === type);
      const next = exists ? cur.filter((f) => f.type !== type) : [...cur, { type, detail: `${label} flagged during group session` }];
      return { ...prev, [memberId]: next };
    });
  };

  const finish = async () => {
    if (!workout) return;
    setSaving(true);
    setSaveError(null);
    try {
      const perKid = members.map((m) => ({
        juniorId: m.id,
        attended: !!attendance[m.id],
        completed: !!attendance[m.id], // drills run for the whole present group
        effort: effort[m.id] || 'engaged',
        note: kidNotes[m.id]?.trim() || undefined,
        safetyFlags: kidFlags[m.id]?.length ? kidFlags[m.id] : undefined,
      }));
      const res = await fetch('/api/coach/group-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ groupId: group.id, dateISO, sharedWorkout: workout, perKid }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data?.error || 'Failed to save the session.');
        setSaving(false);
        return;
      }
      onComplete?.({ written: (data.written || []).length, dateISO });
      onExit();
    } catch {
      setSaveError('Network error saving the session.');
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, color: '#00ff41', letterSpacing: 1 }}>
          {group.name}
        </div>
        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#888' }}>
          Coach: {coach.callsign} · {members.length} kids · {group.ageBand} · {group.sport}
        </div>
      </div>
      <button onClick={onExit} style={{ ...btn(false), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon.X size={12} /> Exit
      </button>
    </div>
  );

  return (
    <div style={{ padding: 16, maxWidth: 680, margin: '0 auto', minHeight: '100%' }}>
      {header}

      {/* ── ATTENDANCE ── */}
      {phase === 'attendance' && (
        <div style={card}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, color: '#eee', marginBottom: 10 }}>
            WHO&apos;S HERE?
          </div>
          {members.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ color: '#ddd', fontFamily: 'Share Tech Mono, monospace', fontSize: 13 }}>
                {m.callsign}{typeof m.juniorAge === 'number' ? ` · ${m.juniorAge}` : ''}
              </span>
              <button onClick={() => setAttendance((p) => ({ ...p, [m.id]: !p[m.id] }))} style={btn(!!attendance[m.id])}>
                {attendance[m.id] ? 'Present' : 'Absent'}
              </button>
            </div>
          ))}
          {genError && (
            <div style={{ color: '#ffb800', fontSize: 11, marginTop: 8 }}>
              {genError} A backup session will be used.
            </div>
          )}
          <button
            onClick={() => setPhase('drills')}
            disabled={present.length === 0 || (genLoading && !workout)}
            style={{
              ...btn(true),
              width: '100%',
              marginTop: 12,
              opacity: present.length === 0 || (genLoading && !workout) ? 0.5 : 1,
            }}
          >
            {genLoading && !workout ? 'Preparing session…' : `Start Session (${present.length} present)`}
          </button>
        </div>
      )}

      {/* ── DRILLS ── */}
      {phase === 'drills' && workout && (
        <div>
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#888', marginBottom: 4 }}>
              {workout.title}
            </div>
            {steps.map((s, i) => {
              const active = i === stepIdx;
              const blk = s.kind === 'block' ? s.block : null;
              const id = blk ? blk.id : s.kind;
              const name = s.kind === 'warmup' ? 'Warm-up'
                : s.kind === 'cooldown' ? 'Cooldown'
                : blk && blk.type === 'exercise' ? blk.exerciseName
                : blk && blk.type === 'conditioning' ? blk.format : 'Drill';
              const detail = s.kind === 'warmup' ? workout.warmup
                : s.kind === 'cooldown' ? workout.cooldown
                : blk && blk.type === 'exercise' ? blk.prescription
                : blk && blk.type === 'conditioning' ? blk.description : '';
              const done = blk ? !!blockDone[blk.id] : false;
              return (
                <div
                  key={id}
                  onClick={() => setStepIdx(i)}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    marginBottom: 6,
                    cursor: 'pointer',
                    border: `1px solid ${active ? '#00ff41' : '#1f1f1f'}`,
                    background: active ? 'rgba(0,255,65,0.06)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: done ? '#00ff41' : '#ddd', fontFamily: 'Orbitron, sans-serif', fontSize: 12 }}>
                      {done && <Icon.Check size={12} color="#00ff41" />} {name}
                    </span>
                    {blk && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setBlockDone((p) => ({ ...p, [blk.id]: !p[blk.id] })); }}
                        style={btn(done)}
                      >
                        {done ? 'Done' : 'Mark done'}
                      </button>
                    )}
                  </div>
                  {active && detail && (
                    <div style={{ color: '#aaa', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{detail}</div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={() => setPhase('finish')} style={{ ...btn(true), width: '100%' }}>
            Finish &amp; Log →
          </button>
        </div>
      )}

      {/* ── FINISH ── */}
      {phase === 'finish' && (
        <div>
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, color: '#eee', marginBottom: 4 }}>
              QUICK DEBRIEF
            </div>
            <div style={{ color: '#888', fontSize: 11, marginBottom: 10 }}>
              One tap per kid. Absent kids are logged as missed. Flags alert their parent + coach.
            </div>
            {members.map((m) => {
              const here = !!attendance[m.id];
              const flags = kidFlags[m.id] || [];
              return (
                <div key={m.id} style={{ borderTop: '1px solid #1a1a1a', padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: here ? '#ddd' : '#666', fontFamily: 'Share Tech Mono, monospace', fontSize: 13 }}>
                      {m.callsign}{here ? '' : ' · absent'}
                    </span>
                  </div>
                  {here && (
                    <>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {EFFORT_OPTS.map((o) => (
                          <button key={o.id} onClick={() => setEffort((p) => ({ ...p, [m.id]: o.id }))} style={btn(effort[m.id] === o.id)}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                      <input
                        value={kidNotes[m.id] || ''}
                        onChange={(e) => setKidNotes((p) => ({ ...p, [m.id]: e.target.value }))}
                        placeholder="Note (optional)"
                        style={{
                          width: '100%', marginTop: 8, padding: '6px 8px', borderRadius: 6,
                          border: '1px solid #2a2a2a', background: '#050505', color: '#ddd', fontSize: 12,
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {SAFETY_BTNS.map((s) => (
                          <button
                            key={s.type}
                            onClick={() => toggleFlag(m.id, s.type, s.label)}
                            style={{
                              ...btn(flags.some((f) => f.type === s.type)),
                              borderColor: flags.some((f) => f.type === s.type) ? '#ff4444' : '#2a2a2a',
                              color: flags.some((f) => f.type === s.type) ? '#ff4444' : '#888',
                            }}
                          >
                            <Icon.Warning size={11} /> {s.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {saveError && <div style={{ color: '#ff4444', fontSize: 12, marginBottom: 8 }}>{saveError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPhase('drills')} disabled={saving} style={{ ...btn(false), flex: 1 }}>← Back</button>
            <button onClick={finish} disabled={saving} style={{ ...btn(true), flex: 2, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : `Log Session for ${present.length}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
