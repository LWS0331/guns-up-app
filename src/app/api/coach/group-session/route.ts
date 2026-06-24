import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTrainerAuth } from '@/lib/requireTrainerAuth';
import { OPS_CENTER_ACCESS, isHeadTrainer } from '@/lib/types';
import type {
  Workout,
  JuniorSafetyEvent,
  JuniorSafetyEventType,
  JuniorSafetyFlags,
  SportProfile,
} from '@/lib/types';
import { applyJuniorGuardrailsToWorkout } from '@/lib/juniorGuardrails';
import { isJuniorOperatorEnabledServer } from '@/lib/featureFlags';
import { buildKidWorkoutRecord, type EffortLevel } from '@/lib/coachGroupSession';

// POST /api/coach/group-session — run + log ONE shared group session.
//
// A coach (trainer-of-members, or any head_trainer/admin) runs a single shared
// youth-soccer drill flow on one device for a small group of young juniors who
// have no app login. This endpoint fans the one session out into EACH member's
// workouts[date] so per-kid history/compliance keep working — and it MUST be a
// single server transaction, not N client PATCHes: the app's save path shares
// one debounce timer (src/app/page.tsx), so looping onUpdateOperator would
// collapse to a single write for the last kid only.

const PARENT_LED_MIN_AGE = 4;
const PARENT_LED_MAX_AGE = 10;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

interface PerKidInput {
  juniorId: string;
  attended: boolean;
  completed: boolean;
  effort?: EffortLevel;
  note?: string;
  durationMin?: number;
  safetyFlags?: Array<{ type: JuniorSafetyEventType; detail?: string }>;
}

interface GroupSessionBody {
  groupId?: string;
  dateISO?: string;
  sharedWorkout?: Workout;
  perKid?: PerKidInput[];
}

export async function POST(req: NextRequest) {
  const auth = requireTrainerAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Feature-flag short-circuit: the whole junior surface is gated. When off,
  // this route is inert (matches the philosophy in featureFlags.ts).
  if (!isJuniorOperatorEnabledServer()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const coachId = auth.operatorId;
    const body = (await req.json()) as GroupSessionBody;
    const { groupId, dateISO, sharedWorkout, perKid } = body;

    // ── Shape validation ────────────────────────────────────────────────
    if (!dateISO || !DATE_KEY_RE.test(dateISO)) {
      return NextResponse.json({ error: 'dateISO must be a YYYY-MM-DD local key' }, { status: 400 });
    }
    if (!sharedWorkout || typeof sharedWorkout !== 'object' || !Array.isArray(sharedWorkout.blocks)) {
      return NextResponse.json({ error: 'sharedWorkout (with blocks[]) is required' }, { status: 400 });
    }
    if (!Array.isArray(perKid) || perKid.length === 0) {
      return NextResponse.json({ error: 'perKid[] is required' }, { status: 400 });
    }
    const juniorIds = [...new Set(perKid.map((k) => k?.juniorId).filter(Boolean))] as string[];
    if (juniorIds.length === 0) {
      return NextResponse.json({ error: 'perKid[] needs juniorId entries' }, { status: 400 });
    }

    // ── Load members + authorize (never trust the client roster) ─────────
    const isAdmin = OPS_CENTER_ACCESS.includes(coachId);
    const isHead = isHeadTrainer(coachId);
    const members = await prisma.operator.findMany({
      where: { id: { in: juniorIds } },
      select: {
        id: true,
        isJunior: true,
        juniorAge: true,
        trainerId: true,
        sportProfile: true,
        juniorSafety: true,
        workouts: true,
      },
    });
    const byId = new Map(members.map((m) => [m.id, m]));

    // Authz: the coach must own EVERY targeted member (or be head/admin).
    // A roster the coach doesn't own is a 403 for the whole batch — partial
    // success here would mask an attempt to write other people's kids.
    for (const id of juniorIds) {
      const m = byId.get(id);
      if (!m) return NextResponse.json({ error: `Unknown member: ${id}` }, { status: 400 });
      const owns = isAdmin || isHead || m.trainerId === coachId;
      if (!owns) {
        return NextResponse.json({ error: `Forbidden: not the coach of ${id}` }, { status: 403 });
      }
    }

    const today = dateISO;
    const written: Array<{ juniorId: string; completed: boolean }> = [];
    const skipped: Array<{ juniorId: string; reason: string }> = [];

    // Build each kid's update payload (guardrail-capped per-kid), then commit
    // them all atomically.
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    for (const entry of perKid) {
      const m = byId.get(entry.juniorId);
      if (!m) continue;
      // Defense in depth: only juniors in the parent/coach-led band.
      const ageOk =
        typeof m.juniorAge === 'number' &&
        m.juniorAge >= PARENT_LED_MIN_AGE &&
        m.juniorAge <= PARENT_LED_MAX_AGE;
      if (!m.isJunior || !ageOk) {
        skipped.push({ juniorId: entry.juniorId, reason: 'not a junior in the 4-10 band' });
        continue;
      }

      // Per-kid guardrail pass — even an under-cap shared flow gets each
      // child's maturation cap applied (RPE/plyo/duration).
      const sportProfile = (m.sportProfile ?? {}) as unknown as SportProfile;
      const capped = applyJuniorGuardrailsToWorkout(sharedWorkout, {
        isJunior: true,
        sportProfile,
        juniorAge: m.juniorAge ?? undefined,
      }).workout;

      const attended = entry.attended !== false; // default present
      const kidWorkout = buildKidWorkoutRecord(capped, {
        attended,
        completed: entry.completed === true,
        effort: entry.effort,
        note: entry.note,
        durationMin: entry.durationMin,
        nowIso: new Date().toISOString(),
      });
      const didComplete = kidWorkout.completed;

      const existingWorkouts = (m.workouts ?? {}) as unknown as Record<string, Workout>;
      const data: Record<string, unknown> = {
        workouts: { ...existingWorkouts, [today]: kidWorkout },
      };

      // Append any safety flags raised for this kid during the session.
      if (Array.isArray(entry.safetyFlags) && entry.safetyFlags.length) {
        const existingEvents = ((m.juniorSafety as unknown as JuniorSafetyFlags | null)?.events) || [];
        const newEvents: JuniorSafetyEvent[] = entry.safetyFlags.map((f) => ({
          timestamp: new Date().toISOString(),
          type: f.type,
          detail: f.detail?.trim() || `Logged during group session by coach`,
          resolved: false,
          resolvedBy: null,
          resolvedAt: null,
        }));
        data.juniorSafety = { events: [...existingEvents, ...newEvents] };
      }

      updates.push({ id: entry.juniorId, data });
      written.push({ juniorId: entry.juniorId, completed: didComplete });
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No eligible members to log', skipped }, { status: 400 });
    }

    await prisma.$transaction(
      updates.map((u) => prisma.operator.update({ where: { id: u.id }, data: u.data })),
    );

    return NextResponse.json({ ok: true, groupId: groupId ?? null, dateISO: today, written, skipped });
  } catch (error) {
    console.error('[api/coach/group-session POST] Failed:', error);
    return NextResponse.json({ error: 'Failed to log group session' }, { status: 500 });
  }
}
