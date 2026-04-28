// POST /api/gunny/recovery-readout
//
// Returns a structured recovery readout for an operator based on the
// LATEST wearable data. The recovery protocol logic itself has been
// implicit in the Gunny chat layer since the wearable enrichment
// commit — this endpoint surfaces it deterministically so IntelCenter
// can render an explicit "should I train hard today?" answer without
// the operator having to start a chat.
//
// Inputs: operator.id (auth: self / admin / trainer-of-target)
// Output: {
//   recommendation: 'GO_HARD' | 'NORMAL' | 'DELOAD' | 'REST',
//   headline: '<one short sentence>',
//   factors: [{ label, value, signal: 'good'|'warn'|'bad' }],
//   guidance: '<2-3 sentences from the prompt>',
//   wearableConnected: boolean,
// }
//
// COMMANDER+ tier (since it requires wearable data which is COMMANDER+).

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import { resolveTierModel } from '@/lib/models';
import { readinessScore } from '@/lib/readiness';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

type Recommendation = 'GO_HARD' | 'NORMAL' | 'DELOAD' | 'REST';
type Signal = 'good' | 'warn' | 'bad';

interface ReadoutFactor {
  label: string;
  value: string;
  signal: Signal;
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

    // Load latest wearable data
    const conns = await prisma.wearableConnection.findMany({
      where: { operatorId, active: true },
      orderBy: { lastSyncAt: 'desc' },
      take: 1,
    });

    const wearableConnected = conns.length > 0;

    if (!wearableConnected) {
      // Fall back to the intake self-report. Still produce a readout,
      // but flag that the data is self-reported and ask the operator
      // to connect a wearable for the live version.
      const profile = (op.profile || {}) as Record<string, unknown>;
      const intake = (op.intake || {}) as Record<string, unknown>;
      const sleep = Number(profile.sleep || intake.sleepQuality || 0);
      const stress = Number(profile.stress || intake.stressLevel || 0);
      const readiness = Number(profile.readiness || intake.readiness || 0);

      const factors: ReadoutFactor[] = [
        { label: 'Sleep quality (self-report)', value: `${sleep}/10`, signal: sleep >= 7 ? 'good' : sleep >= 5 ? 'warn' : 'bad' },
        { label: 'Stress level', value: `${stress}/10`, signal: stress <= 4 ? 'good' : stress <= 7 ? 'warn' : 'bad' },
        { label: 'Self-rated readiness', value: `${readiness}/10`, signal: readiness >= 7 ? 'good' : readiness >= 5 ? 'warn' : 'bad' },
      ];

      const score = sleep + readiness - stress;
      let recommendation: Recommendation;
      let headline: string;
      if (score >= 12) { recommendation = 'GO_HARD'; headline = 'Self-report says you\'re primed. Push it.'; }
      else if (score >= 6) { recommendation = 'NORMAL'; headline = 'Run your normal session.'; }
      else if (score >= 2) { recommendation = 'DELOAD'; headline = 'Dial intensity back ~30%. Volume over load.'; }
      else { recommendation = 'REST'; headline = 'Skip the session. Mobility + walk only.'; }

      return NextResponse.json({
        ok: true,
        wearableConnected: false,
        recommendation,
        headline,
        factors,
        guidance: 'Connect a wearable (Apple Watch / WHOOP / Garmin / Fitbit / Oura) for live HRV, sleep duration, and recovery score — that\'s when this readout becomes truly accurate.',
      });
    }

    // Wearable connected — read the latest syncData.
    const syncData = (conns[0].syncData || {}) as Record<string, unknown>;
    const sleep = (syncData.sleep || {}) as Record<string, unknown>;
    const recovery = (syncData.recovery || {}) as Record<string, unknown>;

    const sleepHours = typeof sleep.duration === 'number' ? Number(sleep.duration) / 3600 : null;
    const sleepEfficiency = typeof sleep.efficiency === 'number' ? Number(sleep.efficiency) : null;
    const hrv = typeof recovery.hrv === 'number' ? Number(recovery.hrv) : null;
    const recoveryScore = typeof recovery.score === 'number' ? Number(recovery.score) : null;
    const restingHr = typeof recovery.restingHr === 'number' ? Number(recovery.restingHr) : null;

    const factors: ReadoutFactor[] = [];
    if (sleepHours != null) {
      factors.push({
        label: 'Sleep duration',
        value: `${sleepHours.toFixed(1)}h`,
        signal: sleepHours >= 7 ? 'good' : sleepHours >= 6 ? 'warn' : 'bad',
      });
    }
    if (sleepEfficiency != null) {
      factors.push({
        label: 'Sleep efficiency',
        value: `${sleepEfficiency}%`,
        signal: sleepEfficiency >= 85 ? 'good' : sleepEfficiency >= 75 ? 'warn' : 'bad',
      });
    }
    if (hrv != null) {
      factors.push({
        label: 'HRV',
        value: `${hrv}ms`,
        signal: hrv >= 60 ? 'good' : hrv >= 40 ? 'warn' : 'bad',
      });
    }
    if (recoveryScore != null) {
      factors.push({
        label: 'Recovery score',
        value: `${recoveryScore}/100`,
        signal: recoveryScore >= 67 ? 'good' : recoveryScore >= 34 ? 'warn' : 'bad',
      });
    }
    if (restingHr != null) {
      factors.push({
        label: 'Resting HR',
        value: `${restingHr}bpm`,
        signal: restingHr <= 60 ? 'good' : restingHr <= 75 ? 'warn' : 'bad',
      });
    }

    // Recommendation derivation — autoregulation engine first, then
    // hardcoded fallback. The engine returns a confidence-graded
    // ReadinessScore; if confidence is `baseline_only` (< 7 days of
    // data), we use the deterministic thresholds below. Otherwise we
    // honor the engine's call.
    //
    // Engine status → Recommendation mapping:
    //   go_hard  → GO_HARD
    //   normal   → NORMAL
    //   caution  → DELOAD
    //   rest     → REST  (only at confidence ≥ medium; engine itself
    //                     softens to caution at low confidence)
    let recommendation: Recommendation;
    let engineRationale: string | null = null;
    let engineConfidence: string | null = null;
    let engineBaselineDays: number | null = null;

    const readiness = await readinessScore({ operatorId });
    engineConfidence = readiness.confidence;
    engineBaselineDays = readiness.baselineDays;

    if (readiness.fallbackToHardcoded) {
      // Deterministic thresholds from the original wearable-enrichment
      // block in gunny/route.ts:
      //   recovery score < 33  → REST
      //   recovery score 33-66 OR sleep < 6h → DELOAD
      //   recovery score 67+ AND sleep ≥ 7h AND HRV not crashed → GO_HARD
      //   otherwise → NORMAL
      if (recoveryScore != null && recoveryScore < 33) {
        recommendation = 'REST';
      } else if ((sleepHours != null && sleepHours < 6) || (recoveryScore != null && recoveryScore < 67)) {
        recommendation = 'DELOAD';
      } else if (recoveryScore != null && recoveryScore >= 67 && (sleepHours == null || sleepHours >= 7)) {
        recommendation = 'GO_HARD';
      } else {
        recommendation = 'NORMAL';
      }
    } else {
      // Engine-driven call.
      switch (readiness.status) {
        case 'go_hard': recommendation = 'GO_HARD'; break;
        case 'normal':  recommendation = 'NORMAL'; break;
        case 'caution': recommendation = 'DELOAD'; break;
        case 'rest':    recommendation = 'REST'; break;
        default:        recommendation = 'NORMAL';
      }
      engineRationale = readiness.rationale;

      // Merge engine factors into the surfaced factors list so the
      // /welcome readout shows what specifically drove the call —
      // ACWR, HRV vs baseline, etc. — not just the raw wearable
      // numbers we already had.
      for (const f of readiness.factors) {
        // Skip duplicates already present from the wearable raw block.
        if (factors.some(existing => existing.label.toLowerCase() === f.label.toLowerCase())) continue;
        factors.push({
          label: f.label,
          value: f.value,
          signal: f.signal === 'neutral' ? 'warn' : f.signal,
        });
      }
    }

    // Ask Gunny for the headline + 2-3 sentence guidance — short LLM
    // call so the language matches the rest of the coaching surface.
    const tier = op.tier || 'opus';
    const model = resolveTierModel(tier);

    const factorLines = factors.map(f => `- ${f.label}: ${f.value} (${f.signal})`).join('\n');
    const systemPrompt = `You are GUNNY's recovery readout. Return strict JSON:
{
  "headline": "<one short punchy sentence (max 12 words) in operator's voice>",
  "guidance": "<2-3 sentences explaining what to do today and why>"
}

The mechanical recommendation (${recommendation}) has already been computed from the data — your job is just to write the human copy. Match the GUNS UP voice: tactical, direct, coaching, no filler. Reference specific numbers from the factors when relevant. No markdown.`;

    const userPrompt = `OPERATOR: ${op.callsign}
RECOMMENDATION: ${recommendation}

WEARABLE FACTORS:
${factorLines}

Write the headline + guidance JSON.`;

    const response = await client.messages.create({
      model,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let headline = '';
    let guidance = '';
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        headline = typeof parsed.headline === 'string' ? parsed.headline : '';
        guidance = typeof parsed.guidance === 'string' ? parsed.guidance : '';
      } catch { /* ignore — fall through to defaults */ }
    }

    // Defaults if LLM fails
    if (!headline) {
      const defaults: Record<Recommendation, string> = {
        GO_HARD: 'Green light. Push it today.',
        NORMAL: 'Run your normal session.',
        DELOAD: 'Dial intensity back. Volume over load.',
        REST: 'Recovery day. Walk + mobility only.',
      };
      headline = defaults[recommendation];
    }
    if (!guidance) {
      const defaults: Record<Recommendation, string> = {
        GO_HARD: 'Sleep + recovery markers are dialed. Hit your top sets, push tempo on conditioning, and don\'t cut volume short.',
        NORMAL: 'Recovery is solid but not exceptional. Run your prescribed work as written. Don\'t chase PRs unless it feels easy.',
        DELOAD: 'Recovery markers are below your baseline. Cut working weights ~20-30%, drop top sets, prioritize mobility and movement quality. You\'ll come back stronger faster than you\'d gain by grinding today.',
        REST: 'Skip the session entirely. 20-30 minutes easy walk + mobility. Real rest beats junk volume. Hydrate, eat protein, get to bed early — pick it up tomorrow.',
      };
      guidance = defaults[recommendation];
    }

    return NextResponse.json({
      ok: true,
      wearableConnected: true,
      recommendation,
      headline,
      guidance,
      factors,
      // Engine metadata — UI can surface "Day X of 14 — building
      // baseline" or "(Low confidence)" disclaimers when present.
      engine: {
        confidence: engineConfidence,
        baselineDays: engineBaselineDays,
        rationale: engineRationale,
        usedEngine: !readiness.fallbackToHardcoded,
        acwr: readiness.acwr ?? null,
      },
    });
  } catch (error) {
    console.error('[recovery-readout] error', error);
    return NextResponse.json({ error: 'Failed to generate readout', details: String(error) }, { status: 500 });
  }
}
