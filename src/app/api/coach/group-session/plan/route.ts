import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTrainerAuth } from '@/lib/requireTrainerAuth';
import type { Sport, Workout } from '@/lib/types';
import { isJuniorOperatorEnabledServer } from '@/lib/featureFlags';
import { applyJuniorGuardrailsToWorkout } from '@/lib/juniorGuardrails';
import { getAppTodayStr } from '@/lib/dateUtils';
import {
  coerceGroupWorkout,
  representativeAge,
  representativeSportProfile,
  type GroupAgeBand,
} from '@/lib/coachGroupSession';

// /api/coach/group-session/plan — upload / read a pre-authored coach group
// session for a given local date, on the CALLER's own record.
//
// This is the "upload today's workplan" path: a coach authors the group drill
// flow in Claude (claude.ai) and pushes it via the MCP set_my_group_session
// tool, which POSTs here. The runner's generate step then PREFERS the uploaded
// plan over Gunny/template (see /api/coach/group-session/generate). The chat is
// the backup — we store only the latest plan per date, no version history.

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

interface PlanBody {
  dateISO?: string;
  sport?: Sport;
  ageBand?: GroupAgeBand;
  title?: string;
  warmup?: string;
  cooldown?: string;
  notes?: string;
  blocks?: Array<{ name?: string; cue?: string; kind?: string; equipment?: string[] }>;
}

export async function GET(req: NextRequest) {
  const auth = requireTrainerAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!isJuniorOperatorEnabledServer()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const url = new URL(req.url);
    // Server-safe Pacific date (process TZ is UTC on Railway) so the key
    // matches the runner's browser-Pacific date and what the app reads.
    const dateISO = url.searchParams.get('date') || getAppTodayStr();
    if (!DATE_KEY_RE.test(dateISO)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }
    const row = await prisma.operator.findUnique({
      where: { id: auth.operatorId },
      select: { groupSessionPlans: true },
    });
    const plans = (row?.groupSessionPlans ?? {}) as unknown as Record<string, Workout>;
    return NextResponse.json({ ok: true, dateISO, workout: plans[dateISO] ?? null });
  } catch (error) {
    console.error('[api/coach/group-session/plan GET] Failed:', error);
    return NextResponse.json({ error: 'Failed to read group session plan' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireTrainerAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!isJuniorOperatorEnabledServer()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const body = (await req.json()) as PlanBody;
    const dateISO = body.dateISO && DATE_KEY_RE.test(body.dateISO) ? body.dateISO : getAppTodayStr();
    const sport: Sport = body.sport === 'football' ? 'football' : 'soccer';
    const ageBand: GroupAgeBand = body.ageBand === '4-10' ? '4-10' : '4-7';
    if (!Array.isArray(body.blocks) || body.blocks.length === 0) {
      return NextResponse.json({ error: 'blocks[] is required' }, { status: 400 });
    }

    // Reuse the same coercion + youth-safety stripping the LLM path uses, so an
    // uploaded plan is held to the identical shape + safety rules.
    const coerced = coerceGroupWorkout(
      { title: body.title, warmup: body.warmup, cooldown: body.cooldown, notes: body.notes, blocks: body.blocks },
      { sport, ageBand, memberCount: 0, dateISO },
    );
    if (!coerced) {
      return NextResponse.json({ error: 'No usable blocks (each needs a name or cue)' }, { status: 400 });
    }
    // Guardrail-cap at store time so what's persisted is already youth-safe
    // (per-kid caps re-apply at fan-out).
    const workout = applyJuniorGuardrailsToWorkout(coerced, {
      isJunior: true,
      sportProfile: representativeSportProfile(sport),
      juniorAge: representativeAge(ageBand),
    }).workout;

    const row = await prisma.operator.findUnique({
      where: { id: auth.operatorId },
      select: { groupSessionPlans: true },
    });
    if (!row) return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    const plans = (row.groupSessionPlans ?? {}) as unknown as Record<string, Workout>;
    plans[dateISO] = workout;
    await prisma.operator.update({
      where: { id: auth.operatorId },
      data: { groupSessionPlans: plans as object },
    });

    return NextResponse.json({ ok: true, dateISO, source: 'uploaded', workout });
  } catch (error) {
    console.error('[api/coach/group-session/plan POST] Failed:', error);
    return NextResponse.json({ error: 'Failed to save group session plan' }, { status: 500 });
  }
}
