import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '@/lib/requireAuth';
import { TIER_MODEL_MAP, SITREP_MODEL_FALLBACK } from '@/lib/models';
import { checkAndIncrement, capExceededBody } from '@/lib/usageCaps';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { operatorContext, tier, clientDayName, clientDate, clientTimezone } = body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured on server' }, { status: 500 });
    }

    if (!operatorContext) {
      return NextResponse.json({ error: 'Missing operator context' }, { status: 400 });
    }

    // Free RECON workout-generation cap (Pricing Strategy v2 — 5 sitreps
    // per 7d for free users). SITREP is the heaviest single AI call
    // in the app since it generates an entire week of programming, so
    // this is the right enforcement point. Paid tiers / admins / trainers
    // bypass automatically via the helper.
    const reconCap = await checkAndIncrement(auth.operatorId, 'workout');
    if (!reconCap.allowed) {
      return NextResponse.json(
        capExceededBody(reconCap),
        { status: 429, headers: { 'Retry-After': String(Math.max(60, Math.ceil(((reconCap.resetAt?.getTime() || Date.now()) - Date.now()) / 1000))) } }
      );
    }

    // Sitrep generation floors at sonnet even for haiku-tier users because
    // the output is a long-lived battle plan, not a chat turn.
    const model = (tier && tier in TIER_MODEL_MAP)
      ? TIER_MODEL_MAP[tier as keyof typeof TIER_MODEL_MAP]
      : SITREP_MODEL_FALLBACK;

    // Compact operator data — strip nulls to reduce prompt size
    const compactContext = JSON.stringify(operatorContext);

    // Extract pre-calculated macro targets from intake — these are the source of truth
    const macros = operatorContext.macroTargets;
    const macroBlock = macros ? `
═══ OPERATOR'S CALCULATED MACRO TARGETS (from intake) ═══
These are the operator's ACTUAL targets calculated from their intake form. Use these EXACT numbers as your nutrition plan baseline:
- Daily Calories: ${macros.calories}
- Protein: ${macros.protein}g
- Carbs: ${macros.carbs}g
- Fat: ${macros.fat}g
- Meals/Day: ${operatorContext.mealsPerDay || 3}
- Daily Water: ${operatorContext.dailyWaterOz || 64}oz
- Estimated Current Intake: ${operatorContext.estimatedCalories || macros.calories} cal
DO NOT default to 2000 calories. Use the numbers above.
` : '';

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are GUNNY — elite tactical AI fitness coach. Generate an initial SITREP battle plan for this operator. This is their FIRST DAY. Tomorrow's workout will be auto-generated based on today's results.

OPERATOR: ${compactContext}
${macroBlock}
TODAY IS: ${clientDayName || 'Sunday'}, ${clientDate || new Date().toLocaleDateString('en-US')}
TIMEZONE: ${clientTimezone || 'America/Chicago'}

Return ONLY valid JSON — no markdown, no backticks, no text before or after the JSON.

{
  "summary": "2-3 sentence Gunny assessment + game plan",
  "nutritionPlan": {
    "dailyCalories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "mealsPerDay": number,
    "hydrationOz": number,
    "approach": "brief strategy",
    "sampleDay": [
      { "time": "7:00 AM", "name": "Meal 1", "description": "foods", "calories": number, "protein": number, "carbs": number, "fat": number }
    ],
    "notes": "tips"
  },
  "trainingPlan": {
    "split": "training split name",
    "daysPerWeek": number,
    "sessionDuration": "45-60 min",
    "progressionStrategy": "how to progress",
    "deloadProtocol": "when to deload"
  },
  "today": {
    "dayNumber": 1,
    "dayName": "${clientDayName || new Date().toLocaleDateString('en-US', { weekday: 'long' })}",
    "type": "training",
    "title": "workout title",
    "exercises": [
      { "name": "exercise", "sets": number, "reps": "rep range", "weight": "suggestion", "rest": "rest", "notes": "cues", "superset": false }
    ],
    "warmup": "warmup",
    "cooldown": "cooldown",
    "duration": "est duration"
  },
  "restrictions": ["injury restrictions"],
  "priorityFocus": ["top 3 priorities"],
  "milestones30Day": ["4-5 targets"],
  "gunnyMessage": "motivational close — use callsign"
}

RULES:
1. Respect injuries — never program aggravating movements
2. Match volume to fitness level (beginners: 3-4 exercises, advanced: 5-7)
3. Use ONLY their available equipment
4. NUTRITION: Use the operator's CALCULATED MACRO TARGETS above as your dailyCalories, protein, carbs, and fat values. Do NOT invent your own numbers. The intake form already calculated these from their weight, goals, and protein priority.
5. Beginners get conservative volume
6. Today's workout must be appropriate for Day 1
7. Sample nutrition day meal totals MUST add up to the dailyCalories target
8. Address operator by CALLSIGN
9. mealsPerDay must match the operator's intake preference`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    let parsed;
    try {
      let jsonStr = text;
      // Extract from code fence if present
      const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]+)\n?\s*```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      } else {
        // Find first { and last }
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = text.substring(firstBrace, lastBrace + 1);
        }
      }
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('SITREP parse error:', parseErr, 'Raw (first 300):', text.substring(0, 300));
      return NextResponse.json({ error: 'Failed to parse SITREP', raw: text.substring(0, 500) }, { status: 500 });
    }

    // Add metadata
    parsed.generatedDate = new Date().toISOString();
    parsed.operatorLevel = operatorContext.fitnessLevel || 'beginner';

    return NextResponse.json({ success: true, sitrep: parsed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('SITREP generation error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
