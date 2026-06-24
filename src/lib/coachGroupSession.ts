// Coach-led group session — pure helpers (no SDK, no network) so the
// generation logic is unit-testable without an Anthropic call or an API route.
//
// A coach runs ONE shared youth-soccer drill flow for a small group of young
// juniors (4–7). This module produces a runnable `Workout` two ways:
//   1. buildGroupSessionTemplate(...) — a deterministic, guardrail-safe,
//      group-appropriate session that ALWAYS works (the reliable backbone /
//      offline + LLM-failure fallback).
//   2. buildCoachGroupPrompt(...) + coerceGroupWorkout(...) — generate a
//      tailored session via Gunny, then coerce its JSON into the Workout shape.
//
// Both outputs pass through applyJuniorGuardrailsToWorkout per-kid at fan-out
// time (see src/app/api/coach/group-session/route.ts).

import type { Sport, SportProfile, Workout, WorkoutBlock, WorkoutResults } from './types';

export type GroupAgeBand = '4-7' | '4-10';

export type EffortLevel = 'effortful' | 'engaged' | 'distracted' | 'refused';

// Effort → sRPE, mirroring ParentLedWorkoutMode so coach-led group sessions
// feed Foster's autoregulation engine on the same scale.
export const EFFORT_TO_SRPE: Record<EffortLevel, number> = {
  effortful: 8,
  engaged: 6,
  distracted: 4,
  refused: 2,
};

export interface KidSessionInput {
  attended: boolean;
  completed: boolean;
  effort?: EffortLevel;
  note?: string;
  durationMin?: number;
  nowIso: string;
}

/**
 * Build ONE kid's Workout record from the (already guardrail-capped) shared
 * session + that kid's attendance/effort/note. Pure — the fan-out route calls
 * this per member. Absentees get a completed:false "[COACH] Absent" record so
 * compliance reflects a planned-but-missed session.
 */
export function buildKidWorkoutRecord(capped: Workout, input: KidSessionInput): Workout {
  const attended = input.attended !== false;
  const didComplete = attended && input.completed === true;

  const blockResults: WorkoutResults['blockResults'] = {};
  for (const b of capped.blocks) {
    blockResults[b.id] = { sets: [{ completed: didComplete }] };
  }

  const noteParts: string[] = [];
  if (!attended) noteParts.push('Absent');
  if (input.note && input.note.trim()) noteParts.push(input.note.trim());
  const notes = noteParts.length
    ? `${capped.notes || ''}${capped.notes ? '\n\n' : ''}[COACH] ${noteParts.join(' — ')}`
    : capped.notes;

  return {
    ...capped,
    completed: didComplete,
    results: { startTime: input.nowIso, endTime: input.nowIso, blockResults },
    sessionRpe: attended ? EFFORT_TO_SRPE[input.effort ?? 'engaged'] : undefined,
    sessionDurationMin: attended && input.durationMin ? input.durationMin : undefined,
    notes,
  };
}

export interface GroupSessionInput {
  sport: Sport;
  ageBand: GroupAgeBand;
  memberCount: number;
  dateISO: string;
}

let blockSeq = 0;
function blockId(prefix: string): string {
  blockSeq += 1;
  return `${prefix}-${blockSeq}`;
}

function exerciseBlock(name: string, cue: string, sortOrder: number): WorkoutBlock {
  return {
    type: 'exercise',
    id: blockId('grp-ex'),
    sortOrder,
    exerciseName: name,
    prescription: cue,
    isLinkedToNext: false,
  };
}

function conditioningBlock(format: string, description: string, sortOrder: number): WorkoutBlock {
  return {
    type: 'conditioning',
    id: blockId('grp-cond'),
    sortOrder,
    format,
    description,
    isLinkedToNext: false,
  };
}

/**
 * A representative junior profile for guardrail application at generation time
 * (the shared flow is age-banded, not per-kid). Per-kid caps are re-applied at
 * fan-out using each child's real sportProfile + age.
 */
export function representativeSportProfile(sport: Sport): SportProfile {
  return {
    sport,
    position: 'unsure',
    level: 'recreational',
    yearsPlaying: 0,
    trainingDaysPerWeek: 1,
    gameDay: 'sat',
    noTrainingDays: [],
    trainingWindow: '',
    multiSport: false,
    otherSports: [],
    focusAreas: [],
    coachNotes: '',
    maturationStage: 'pre_phv',
    estimatedPeakHeightVelocity: null,
  };
}

/** Representative age used when guardrail-capping the shared (not per-kid) flow. */
export function representativeAge(ageBand: GroupAgeBand): number {
  return ageBand === '4-7' ? 6 : 8;
}

/**
 * Deterministic, group-runnable youth-soccer session for the littles. Built to
 * be guardrail-safe by construction: short, play-based, no load, no plyo, no
 * RPE tokens, ends on a game. Every drill works with several kids at once
 * (no long lines, no elimination). This is the reliable fallback the runner
 * always has, even with no network.
 */
export function buildGroupSessionTemplate(input: GroupSessionInput): Workout {
  blockSeq = 0;
  const { ageBand, memberCount, dateISO } = input;
  const n = Number.isFinite(memberCount) && memberCount > 0 ? memberCount : 4;

  // Soccer is the only sport this group mode ships content for today.
  const blocks: WorkoutBlock[] = [
    exerciseBlock(
      'Sharks & Minnows (dribbling)',
      `5 min · every kid has a ball, dribble across the grid, coach is the "shark." Cue: "little touches, head up." No one is ever out — tagged kids do 3 toe-taps and rejoin.`,
      1,
    ),
    exerciseBlock(
      'Traffic Lights (ball control)',
      `5 min · GREEN = dribble, RED = freeze with foot on the ball, YELLOW = slow tip-taps. Cue: "stop it dead." Everyone moves at once.`,
      2,
    ),
    exerciseBlock(
      'Pass & Count (partners)',
      `5 min · pair up (${n >= 4 ? `${Math.floor(n / 2)} pairs` : 'pairs'}), pass back and forth, count out loud as a team. Cue: "open foot, gentle push."`,
      3,
    ),
    conditioningBlock(
      'Mini Game — small-sided, no keepers',
      `8 min · split into 2–3 tiny teams, small goals (cones), everyone plays, switch teams every 2 min so it stays fun. End on the game.`,
      4,
    ),
  ];

  return {
    id: `grp-session-${dateISO}`,
    date: dateISO,
    title: ageBand === '4-7' ? 'Little Ballers — Group Soccer (4–7)' : 'Group Soccer (4–10)',
    notes:
      'Coach-led group session. Mastery climate — praise effort ("you tried five times!") over outcome. Water break every 10–15 min. Keep it moving, keep it fun.',
    warmup:
      'Animal Movements (5 min): bear crawls, bunny hops, crab walks across the grid. Everyone moving together, no lines.',
    blocks,
    cooldown: 'Stretch & Cheer (3 min): reach for the sky, slow toe-touches, big team cheer. Water.',
    completed: false,
  };
}

/**
 * System prompt for a Gunny call that generates ONE shared group session.
 * Mirrors the parent-coach youth-safety floor (no body comp, no load, mastery
 * climate, water breaks) but addresses a COACH running N kids on one device,
 * and constrains every drill to be group-runnable. Instructs the model to emit
 * a single <group_session_json> block in the simple shape coerceGroupWorkout
 * expects.
 */
export function buildCoachGroupPrompt(input: Omit<GroupSessionInput, 'dateISO'>): string {
  const { ageBand, memberCount } = input;
  const tier =
    ageBand === '4-7'
      ? 'Tier 1–2 (4–7) — foundational / play-based; 5–10 min per drill, ~25–30 min total'
      : 'Tier 1–3 (4–10) — play-based to skill-refinement; 8–12 min per drill, ~35–40 min total';

  return `You are GUNNY in COACH-GROUP MODE.

═══ WHO YOU'RE TALKING TO ═══
You are advising a COACH who runs ONE shared youth-soccer session on a single device for a GROUP of ${memberCount} young kids at the same time. The kids have no app access. The coach reads your cues aloud and runs the drills for the whole group together.

THE GROUP
- Sport: soccer
- Group size: ${memberCount} kids
- Age band: ${ageBand}
- Programming tier: ${tier}

═══ NON-NEGOTIABLE RULES ═══
1. EVERY drill must work with ${memberCount} kids AT ONCE — use shared-ball games, stations, or small-sided games. NO long lines, NO single-file waiting, NO elimination games (no one sits out).
2. Play-based and short. Big, simple cues (3–4 words) a coach shouts across a field.
3. Mastery climate, process praise ("you tried five times!" beats "great job"). Keep it fun; end on a game.
4. HARD SAFETY FLOOR: NO body composition, NO calorie/nutrition prescriptions, NO supplements, NO 1RM / heavy load, NO plyometric contact counts for this age. Water break every 10–15 min. The kids are ${ageBand}.
5. If asked anything about injury, pain, or head impact: STOP and refer to a parent/medical pro — do not coach through it.

═══ WHAT YOU OUTPUT ═══
Emit EXACTLY ONE block, nothing else, in this shape:

<group_session_json>
{
  "title": "short session title",
  "warmup": "one warm-up game with a read-aloud cue (~5 min)",
  "blocks": [
    { "name": "Drill name", "cue": "read-aloud coaching cue + minutes", "kind": "drill" },
    { "name": "Mini game", "cue": "read-aloud cue + minutes", "kind": "game" }
  ],
  "cooldown": "short cooldown + water"
}
</group_session_json>

Use 3–5 blocks. Mark the closing small-sided game with "kind":"game". Keep cues short and shoutable.`;
}

interface ParsedGroupSession {
  title?: unknown;
  warmup?: unknown;
  cooldown?: unknown;
  notes?: unknown;
  blocks?: unknown;
}

const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

/**
 * Coerce the model's <group_session_json> payload into a valid Workout.
 * Defensive: any missing/wrong field falls back so a partial LLM response
 * still yields a runnable session. Returns null only when there are no usable
 * blocks at all (caller then uses the template).
 */
export function coerceGroupWorkout(
  parsed: ParsedGroupSession | null | undefined,
  input: GroupSessionInput,
): Workout | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  blockSeq = 0;
  const blocks: WorkoutBlock[] = [];
  rawBlocks.forEach((b, i) => {
    if (!b || typeof b !== 'object') return;
    const rec = b as Record<string, unknown>;
    const name = asStr(rec.name);
    const cue = asStr(rec.cue);
    if (!name && !cue) return;
    const isGame = asStr(rec.kind).toLowerCase() === 'game' || /game|scrimmage|match/i.test(name);
    blocks.push(
      isGame
        ? conditioningBlock(name || 'Mini game', cue || name, i + 1)
        : exerciseBlock(name || `Drill ${i + 1}`, cue || name, i + 1),
    );
  });
  if (blocks.length === 0) return null;

  return {
    id: `grp-session-${input.dateISO}`,
    date: input.dateISO,
    title: asStr(parsed.title, input.ageBand === '4-7' ? 'Group Soccer (4–7)' : 'Group Soccer (4–10)'),
    notes: asStr(
      parsed.notes,
      'Coach-led group session. Mastery climate — praise effort over outcome. Water every 10–15 min.',
    ),
    warmup: asStr(parsed.warmup, 'Animal movements (5 min): bear crawls, bunny hops, crab walks. Everyone moving.'),
    blocks,
    cooldown: asStr(parsed.cooldown, 'Stretch & team cheer (3 min). Water.'),
    completed: false,
  };
}

export const GROUP_SESSION_JSON_RE = /<group_session_json>([\s\S]*?)<\/group_session_json>/;
