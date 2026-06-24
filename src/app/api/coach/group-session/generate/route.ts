import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { requireTrainerAuth } from '@/lib/requireTrainerAuth';
import { OPS_CENTER_ACCESS, isHeadTrainer } from '@/lib/types';
import type { Sport } from '@/lib/types';
import { isJuniorOperatorEnabledServer } from '@/lib/featureFlags';
import { applyJuniorGuardrailsToWorkout } from '@/lib/juniorGuardrails';
import { SITREP_MODEL_FALLBACK } from '@/lib/models';
import {
  buildCoachGroupPrompt,
  buildGroupSessionTemplate,
  coerceGroupWorkout,
  representativeAge,
  representativeSportProfile,
  GROUP_SESSION_JSON_RE,
  type GroupAgeBand,
} from '@/lib/coachGroupSession';

// POST /api/coach/group-session/generate — produce ONE shared group session
// for the coach to run. Tries Gunny for a tailored session; ALWAYS falls back
// to the deterministic age-appropriate template so the coach is never left
// without a runnable session (network / API hiccups included). Isolated from
// the main /api/gunny streaming route on purpose — the coach is not a junior,
// so that route's junior-guardrail path wouldn't apply, and this generation is
// simple, one-shot, and easy to reason about + test.

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

interface GenerateBody {
  groupId?: string;
  sport?: Sport;
  ageBand?: GroupAgeBand;
  memberCount?: number;
  dateISO?: string;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  const auth = requireTrainerAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!isJuniorOperatorEnabledServer()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const coachId = auth.operatorId;
    // Only a coach (head_trainer/admin, or a trainer who has at least one
    // assigned junior) may generate group sessions. Cheap gate; the actual
    // per-member ownership is enforced again at fan-out (the LOG endpoint).
    const isAdmin = OPS_CENTER_ACCESS.includes(coachId);
    const isHead = isHeadTrainer(coachId);
    if (!isAdmin && !isHead) {
      const assigned = await prisma.operator.count({
        where: { trainerId: coachId, isJunior: true },
      });
      if (assigned === 0) {
        return NextResponse.json({ error: 'Forbidden — not a coach of any junior.' }, { status: 403 });
      }
    }

    const body = (await req.json()) as GenerateBody;
    const sport: Sport = body.sport === 'football' ? 'football' : 'soccer';
    const ageBand: GroupAgeBand = body.ageBand === '4-10' ? '4-10' : '4-7';
    const memberCount = Number.isFinite(body.memberCount) && (body.memberCount as number) > 0
      ? Math.floor(body.memberCount as number)
      : 4;
    const dateISO = body.dateISO && DATE_KEY_RE.test(body.dateISO) ? body.dateISO : null;
    if (!dateISO) {
      return NextResponse.json({ error: 'dateISO must be a YYYY-MM-DD local key' }, { status: 400 });
    }

    const input = { sport, ageBand, memberCount, dateISO };
    const guardJunior = {
      isJunior: true as const,
      sportProfile: representativeSportProfile(sport),
      juniorAge: representativeAge(ageBand),
    };

    // ── Try Gunny; fall back to the template on any failure ──────────────
    let source: 'gunny' | 'template' = 'template';
    let workout = buildGroupSessionTemplate(input);

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const resp = await client.messages.create({
          model: SITREP_MODEL_FALLBACK,
          max_tokens: 1200,
          system: buildCoachGroupPrompt({ sport, ageBand, memberCount }),
          messages: [
            {
              role: 'user',
              content: `Build today's ${memberCount}-kid ${ageBand} ${sport} group session. Emit only the <group_session_json> block.`,
            },
          ],
        });
        const text = resp.content
          .map((c) => (c.type === 'text' ? c.text : ''))
          .join('');
        const m = text.match(GROUP_SESSION_JSON_RE);
        if (m) {
          const parsed = JSON.parse(m[1].trim());
          const coerced = coerceGroupWorkout(parsed, input);
          if (coerced) {
            workout = coerced;
            source = 'gunny';
          }
        }
      } catch (err) {
        console.warn('[coach/group-session/generate] Gunny generation failed, using template:', err);
      }
    }

    // Guardrail-cap the shared flow (representative age). Per-kid caps re-apply
    // at fan-out (the LOG endpoint).
    const guarded = applyJuniorGuardrailsToWorkout(workout, guardJunior);

    return NextResponse.json({
      ok: true,
      source,
      groupId: body.groupId ?? null,
      workout: guarded.workout,
      modifications: guarded.modificationsApplied,
    });
  } catch (error) {
    console.error('[api/coach/group-session/generate POST] Failed:', error);
    return NextResponse.json({ error: 'Failed to generate group session' }, { status: 500 });
  }
}
