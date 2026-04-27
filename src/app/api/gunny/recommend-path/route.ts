// POST /api/gunny/recommend-path
//
// Picks the optimal training path for an operator based on their
// intake answers + goals + experience + equipment + injuries.
//
// Why this exists: the IntakeForm offers a "LET GUNNY DECIDE" option
// (`trainingPath: 'gunny_pick'`). Until now that was a stub — selecting
// it just stored the literal string `gunny_pick` and no actual
// recommendation ran. This endpoint closes the loop: when the client
// finishes intake with `gunny_pick`, it calls here, gets back a
// concrete path + rationale, and saves them to operator.preferences.
//
// Auth: caller must be self (the operator getting the recommendation)
// or an admin/trainer-of-target.
//
// Output is a tight structured JSON, NOT free-form chat — the client
// uses it to update preferences directly without parsing prose.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import { resolveTierModel } from '@/lib/models';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

type PathKey = 'bodybuilding' | 'crossfit' | 'powerlifting' | 'athletic' | 'tactical' | 'hybrid';

const VALID_PATHS: PathKey[] = ['bodybuilding', 'crossfit', 'powerlifting', 'athletic', 'tactical', 'hybrid'];

interface RecommendationResult {
  path: PathKey;
  rationale: string;
  alternates: { path: PathKey; reason: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeJson(s: any): Record<string, unknown> {
  try { return s ? JSON.parse(JSON.stringify(s)) : {}; } catch { return {}; }
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const operatorId: string | undefined = body?.operatorId;
    if (!operatorId) {
      return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
    }

    const isSelf = auth.operatorId === operatorId;
    const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);
    let isTrainerOfTarget = false;
    if (!isSelf && !isAdmin) {
      const t = await prisma.operator.findUnique({ where: { id: operatorId }, select: { trainerId: true } });
      isTrainerOfTarget = !!t && t.trainerId === auth.operatorId;
    }
    if (!isSelf && !isAdmin && !isTrainerOfTarget) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const op = await prisma.operator.findUnique({ where: { id: operatorId } });
    if (!op) return NextResponse.json({ error: 'Operator not found' }, { status: 404 });

    // Build a tight intake summary. We feed Gunny ONLY what's relevant
    // to picking a path — not the full chat-context kitchen sink.
    const intake = safeJson(op.intake);
    const profile = safeJson(op.profile);
    const prefs = safeJson(op.preferences);
    const injuries = (op.injuries as unknown[]) || [];
    const prs = (op.prs as unknown[]) || [];

    const intakeSummary = [
      `Age: ${profile.age || intake.age || 'unknown'}`,
      `Weight: ${profile.weight || 'unknown'}lbs`,
      `Training experience: ${intake.experienceYears != null ? intake.experienceYears + ' years' : 'unknown'}`,
      `Exercise history: ${intake.exerciseHistory || 'unknown'}`,
      `Activity level: ${intake.currentActivity || 'unknown'}`,
      `Primary goal: ${intake.primaryGoal || 'unknown'}`,
      `Secondary goals: ${(intake.secondaryGoals as string[] | undefined)?.join(', ') || 'none'}`,
      `Movement screen score: ${intake.movementScreenScore || 'unknown'}/10`,
      `Available equipment: ${(intake.availableEquipment as string[] | undefined)?.join(', ') || 'unknown'}`,
      `Preferred workout time: ${intake.preferredWorkoutTime || 'unknown'}`,
      `Days per week available: ${intake.daysPerWeek || prefs.daysPerWeek || 'unknown'}`,
      `Session duration preference: ${intake.sessionDuration || prefs.sessionDuration || 'unknown'} min`,
      `Sleep quality: ${intake.sleepQuality || profile.sleep || 'unknown'}/10`,
      `Stress level: ${intake.stressLevel || profile.stress || 'unknown'}/10`,
      `Health conditions: ${(intake.healthConditions as string[] | undefined)?.join(', ') || 'none'}`,
      `Active injuries (count): ${injuries.filter((i: unknown) => (i as { status?: string })?.status === 'active').length}`,
      `Logged PRs (count): ${prs.length}`,
    ].join('\n');

    const systemPrompt = `You are GUNNY's training-path recommendation engine. You analyze an operator's intake and pick ONE optimal training path from the catalog below.

PATH CATALOG:
- bodybuilding — Hypertrophy focus. Sculpt physique, maximize muscle size, controlled tempos, higher-rep volume work.
- crossfit — Functional fitness / WODs. Varied movements, conditioning + strength blend, compete against the clock.
- powerlifting — Squat, bench, deadlift maximal strength. Lower rep, higher load, longer rest periods, periodized peaking.
- athletic — Speed, agility, power. Train like a pro athlete: plyos, sprints, change-of-direction, sport-specific.
- tactical — Rucking, calisthenics, military-style PT, endurance + strength hybrid for selection / first responder prep.
- hybrid — Mix of strength + conditioning + muscle. Great for general fitness without committing to one specialty.

DECISION HEURISTICS:
- Primary goal "muscle_gain" → bodybuilding (or hybrid if endurance also matters)
- Primary goal "strength" → powerlifting (or hybrid for novices)
- Primary goal "athletic" / "sport_specific" → athletic
- Primary goal "endurance" → crossfit or hybrid
- Primary goal "weight_loss" → hybrid or crossfit (volume + conditioning)
- Primary goal "general_health" → hybrid
- Tactical / military / first-responder context → tactical
- Beginner (experienceYears < 1) → hybrid first, then specialize after 6 months
- Severe equipment limits (bodyweight only, no rack) → calisthenics-friendly path → hybrid or athletic
- Significant injury history → conservative path matching their goal (avoid powerlifting if back/knee injuries; avoid CrossFit if shoulder/hip injuries)

RETURN STRUCTURED JSON ONLY. No prose outside the JSON. Format:
{
  "path": "bodybuilding" | "crossfit" | "powerlifting" | "athletic" | "tactical" | "hybrid",
  "rationale": "1-2 sentence direct explanation referencing the operator's specific intake answers",
  "alternates": [
    { "path": "<one of the 6>", "reason": "1 short sentence why this is plan B" }
  ]
}

The rationale should reference the operator BY THEIR CALLSIGN if helpful. Be direct, no fluff.`;

    const userPrompt = `OPERATOR: ${op.callsign}
ROLE: ${op.role}

INTAKE SNAPSHOT:
${intakeSummary}

Pick the optimal training path. Return JSON only.`;

    const tier = op.tier || 'opus';
    const model = resolveTierModel(tier);

    const response = await client.messages.create({
      model,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    // Extract JSON — be lenient since some models wrap in markdown fences.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'No JSON in recommendation', raw: text }, { status: 500 });
    }
    let parsed: Partial<RecommendationResult>;
    try {
      parsed = JSON.parse(jsonMatch[0]) as Partial<RecommendationResult>;
    } catch (e) {
      return NextResponse.json({ error: 'Bad JSON in recommendation', raw: text }, { status: 500 });
    }

    if (!parsed.path || !VALID_PATHS.includes(parsed.path as PathKey)) {
      return NextResponse.json({ error: 'Invalid path returned', raw: text }, { status: 500 });
    }

    const result: RecommendationResult = {
      path: parsed.path as PathKey,
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
      alternates: Array.isArray(parsed.alternates)
        ? parsed.alternates.filter((a): a is { path: PathKey; reason: string } =>
            !!a && VALID_PATHS.includes((a as { path?: string }).path as PathKey) && typeof (a as { reason?: string }).reason === 'string'
          )
        : [],
    };

    return NextResponse.json({ ok: true, ...result, model });
  } catch (error) {
    console.error('[recommend-path] error', error);
    return NextResponse.json({ error: 'Failed to generate recommendation', details: String(error) }, { status: 500 });
  }
}
