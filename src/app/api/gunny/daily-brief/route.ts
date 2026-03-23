import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { operatorContext, sitrep, yesterdayData, todayDateStr, tier } = body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured on server' }, { status: 500 });
    }

    if (!operatorContext || !sitrep) {
      return NextResponse.json({ error: 'Missing operator context or SITREP' }, { status: 400 });
    }

    // Tier-based model selection for Daily Briefs
    // RECON (haiku): Haiku — fast, cheap, runs every login
    // OPERATOR (sonnet): Sonnet — sharper daily adjustments, better adaptation logic
    // COMMANDER (opus): Opus — premium daily coaching with deep personalization
    // WARFIGHTER (white_glove): Opus — premier white-glove daily intel
    const modelMap: Record<string, string> = {
      haiku: 'claude-haiku-4-5-20251001',
      sonnet: 'claude-sonnet-4-6',
      opus: 'claude-opus-4-6',
      white_glove: 'claude-opus-4-6',
    };
    const model = modelMap[tier] || 'claude-haiku-4-5-20251001';

    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are GUNNY — elite tactical AI fitness coach. Generate today's DAILY BRIEF for this operator.

OPERATOR: ${operatorContext.callsign}
FITNESS LEVEL: ${operatorContext.fitnessLevel || 'beginner'}
TODAY: ${todayDateStr}

ACTIVE SITREP (their current plan):
${JSON.stringify(sitrep, null, 2)}

YESTERDAY'S PERFORMANCE DATA:
${JSON.stringify(yesterdayData, null, 2)}

Generate today's adaptive daily brief. Adjust the plan based on yesterday's compliance.

Return ONLY valid JSON:
{
  "greeting": "short Gunny greeting addressing operator by callsign — reference time of day, their streak, or yesterday's performance",
  "todaysFocus": "one sentence: what today is about",
  "workout": null (if rest day) OR {
    "dayNumber": number,
    "dayName": "day name",
    "type": "training",
    "title": "workout title",
    "exercises": [
      { "name": "exercise", "sets": number, "reps": "rep range", "weight": "weight", "rest": "rest", "notes": "notes", "superset": false }
    ],
    "warmup": "warmup",
    "cooldown": "cooldown",
    "duration": "duration"
  },
  "nutritionReminder": "specific nutrition action for today based on their plan and yesterday's compliance",
  "adjustments": ["list of any changes from the original SITREP plan and why"],
  "motivation": "Gunny-voice motivational message — short, punchy, personalized",
  "complianceScore": number 0-100 (based on yesterday: did they train? log meals? hit macros?),
  "streakDays": number (consecutive days of compliance)
}

ADAPTATION RULES:
- If they MISSED yesterday's workout: don't shame, but adjust — offer to combine or reschedule
- If they CRUSHED it: acknowledge, push slightly harder today
- If they under-ate protein: remind them specifically about protein
- If they logged zero meals: gentle nudge to track nutrition today
- If it's a rest day: give recovery tips (stretch, hydrate, sleep)
- Keep greeting and motivation SHORT — 1-2 sentences max
- Always address operator by CALLSIGN`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    let parsed;
    try {
      let jsonStr = text;
      const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]+)\n?\s*```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      } else {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = text.substring(firstBrace, lastBrace + 1);
        }
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: 'Failed to parse daily brief', raw: text.substring(0, 500) }, { status: 500 });
    }

    parsed.date = todayDateStr;

    return NextResponse.json({ success: true, brief: parsed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Daily brief error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
