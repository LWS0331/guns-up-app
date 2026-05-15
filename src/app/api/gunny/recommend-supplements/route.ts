// POST /api/gunny/recommend-supplements
//
// Generates a structured supplement stack recommendation for an operator
// based on their goals, training path, intake, current diet, and any
// flagged health conditions / restrictions. Conversational supplement
// guidance has been live in Gunny chat for a while (anti-snake-oil
// filter); this endpoint produces a deterministic, dose-specific stack
// that the client can persist + display in IntelCenter.
//
// Hard rules baked into the system prompt:
//   - Food-first, evidence-backed compounds only (creatine, whey,
//     vitamin D when deficient, magnesium glycinate, omega-3, caffeine
//     pre-workout). Reject snake oil (BCAAs, fat burners, T-boosters,
//     test boosters, mass gainers, multi-blends).
//   - JUNIOR OPERATORS (under 18): refer to sports RD/MD only. Refuse
//     to issue a stack. Surface the "consult a sports dietitian"
//     fallback.
//   - Anyone with eating-disorder / RED-S flags: refuse, refer to
//     clinician.
//   - No prescription compounds (TRT, anabolics, peptides). Refuse.
//
// Output JSON:
//   {
//     "ok": true,
//     "stack": [
//       { "name": "Creatine Monohydrate", "dose": "5g daily",
//         "timing": "any time", "rationale": "...", "tier": "core" },
//       ...
//     ],
//     "avoid": [{ "name": "BCAA", "reason": "..." }],
//     "notes": "Bloodwork-first reminder, consult MD if pregnant, etc."
//   }

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import { resolveTierModel } from '@/lib/models';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeJson(s: any): Record<string, unknown> {
  try { return s ? JSON.parse(JSON.stringify(s)) : {}; } catch { return {}; }
}

interface StackItem {
  name: string;
  dose: string;
  timing: string;
  rationale: string;
  tier: 'core' | 'situational' | 'optional';
}

interface AvoidItem { name: string; reason: string; }

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

    // Hard refusal: junior operators get a referral, not a stack.
    if (op.isJunior) {
      return NextResponse.json({
        ok: true,
        refusal: true,
        message: 'Junior operators (under 18) are not issued supplement stacks. Refer to a sports RD or pediatrician for evidence-based youth sports nutrition. The only category that may be appropriate is a basic multivitamin in restricted-diet contexts — and even that should be cleared by a clinician.',
        stack: [],
        avoid: [],
      });
    }

    const intake = safeJson(op.intake);
    const profile = safeJson(op.profile);
    const prefs = safeJson(op.preferences);
    const nutrition = safeJson(op.nutrition);

    const restrictions = (intake.dietaryRestrictions as string[] | undefined) || [];
    const conditions = (intake.healthConditions as string[] | undefined) || [];
    const supps = (intake.supplements as string[] | undefined) || [];

    const intakeSummary = [
      `Sex/age: ${profile.age || intake.age || '?'}yr`,
      `Weight: ${profile.weight || '?'}lbs`,
      `Goal: ${intake.primaryGoal || 'unknown'}`,
      `Training path: ${prefs.trainingPath || 'unknown'}`,
      `Experience: ${intake.experienceYears != null ? intake.experienceYears + 'y' : 'unknown'}`,
      `Diet approach: ${intake.currentDiet || 'no_plan'}`,
      `Daily calories target: ${(nutrition as { targets?: { calories?: number } }).targets?.calories || 'unknown'}`,
      `Daily protein target: ${(nutrition as { targets?: { protein?: number } }).targets?.protein || 'unknown'}g`,
      `Sleep quality (1-10): ${intake.sleepQuality || profile.sleep || '?'}`,
      `Stress (1-10): ${intake.stressLevel || profile.stress || '?'}`,
      `Dietary restrictions: ${restrictions.join(', ') || 'none'}`,
      `Health conditions: ${conditions.join(', ') || 'none reported'}`,
      `Currently taking: ${supps.length ? supps.join(', ') : 'nothing'}`,
    ].join('\n');

    // Refusal triggers in the intake (eating-disorder language, RED-S
    // signs, prescription-compound questions). Pre-flight before
    // calling the LLM.
    const redFlags: string[] = [];
    const conditionsLower = conditions.map(c => c.toLowerCase());
    if (conditionsLower.some(c => /eating|anorex|bulim|red.?s|amenorr/i.test(c))) {
      redFlags.push('eating disorder / RED-S flag in health conditions');
    }
    if (conditionsLower.some(c => /pregnan|nursing|breastfeed/i.test(c))) {
      redFlags.push('pregnancy / nursing — supplement protocol needs OB/GYN clearance');
    }
    if (redFlags.length > 0) {
      return NextResponse.json({
        ok: true,
        refusal: true,
        message: `Cannot issue a supplement stack — flagged conditions: ${redFlags.join('; ')}. Refer to a registered dietitian (CSSD) and your physician before starting any supplement protocol.`,
        stack: [],
        avoid: [],
      });
    }

    const systemPrompt = `You are GUNNY's supplement stack engine. You produce evidence-based, dose-specific supplement protocols for adult fitness operators (18+). Your output is consumed by structured UI — return STRICT JSON only.

EVIDENCE BASE (the only compounds you may recommend):
- Creatine Monohydrate (5g/d, any time, post-loading); skip if kidney issues
- Whey Protein Isolate (20-40g/serving, post-training or to hit daily protein target); skip if dairy allergy
- Casein (30-40g pre-sleep) for overnight MPS; skip if dairy allergy
- Vitamin D3 (1000-2000 IU/d if 25(OH)D < 30 ng/mL); food-first if no labs
- Magnesium Glycinate (200-400mg pre-bed) for sleep + recovery
- Omega-3 EPA/DHA (2-3g combined per day) for inflammation + recovery
- Caffeine (3-6mg/kg, 30-45 min pre-training) ONLY for training days
- Beta-Alanine (3.2-6.4g/d split doses) for high-rep / metcon training paths
- Citrulline Malate (6-8g pre-training) for endurance / hypertrophy paths
- Multivitamin (one a day) ONLY if dietary restrictions reduce micronutrient coverage

ALWAYS REJECT (list these in "avoid"):
- BCAAs (worthless if hitting daily protein)
- Mass gainers (just sugar)
- Test boosters / "T-optimizers" (snake oil, none are clinically meaningful)
- Fat burners / thermogenics (mostly just caffeine + filler)
- Pre-workout proprietary blends (use solo caffeine + creatine instead)
- Glutamine for recovery (gym-bro myth)
- Tribulus, ZMA, ashwagandha for "test boost"
- Anything that requires a prescription (TRT, peptides, SARMs, anabolics)

DECISION HEURISTICS:
- Goal "muscle_gain" → core: creatine + whey + casein; situational: magnesium, vitamin D
- Goal "strength" / powerlifting → core: creatine + whey; situational: caffeine on heavy days
- Goal "endurance" / crossfit → core: creatine + beta-alanine + caffeine; situational: omega-3
- Goal "weight_loss" → core: whey (preserve LBM) + omega-3; situational: caffeine pre-cardio
- Goal "general_health" → core: omega-3 + magnesium + vitamin D; whey if protein target unmet
- Vegan / vegetarian → swap whey for plant protein blend; flag B12 + creatine + omega-3 as essential
- Sleep score < 6 → bump magnesium glycinate to "core"
- Stress > 7 → magnesium core
- Already taking creatine → skip from "core" (note: continue current protocol)

OUTPUT FORMAT (strict — no prose outside the JSON):
{
  "stack": [
    {
      "name": "<compound>",
      "dose": "<amount/day with unit>",
      "timing": "<when to take>",
      "rationale": "<1 sentence tied to operator's specific goal/profile>",
      "tier": "core" | "situational" | "optional"
    }
  ],
  "avoid": [
    { "name": "<compound>", "reason": "<short reason tailored to operator>" }
  ],
  "notes": "<1-2 sentence overall guidance: bloodwork-first, food-first, consult MD reminders>"
}

KEEP THE STACK SMALL: 3-6 items maximum. Quality over quantity. Every item must directly serve the operator's primary goal or a measurable deficit. If they're already taking the right things, return a short stack and call out what to drop in "avoid".`;

    const userPrompt = `OPERATOR: ${op.callsign}

INTAKE SNAPSHOT:
${intakeSummary}

Generate the supplement stack as JSON only.`;

    const tier = op.tier || 'opus';
    const model = resolveTierModel(tier);

    const response = await client.messages.create({
      model,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'No JSON in response', raw: text }, { status: 500 });
    }

    let parsed: { stack?: StackItem[]; avoid?: AvoidItem[]; notes?: string };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: 'Bad JSON', raw: text }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      refusal: false,
      stack: Array.isArray(parsed.stack) ? parsed.stack : [],
      avoid: Array.isArray(parsed.avoid) ? parsed.avoid : [],
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      model,
    });
  } catch (error) {
    console.error('[recommend-supplements] error', error);
    return NextResponse.json({ error: 'Failed to generate stack', details: String(error) }, { status: 500 });
  }
}
