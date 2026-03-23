import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { operatorContext, tier } = body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured on server' }, { status: 500 });
    }

    if (!operatorContext) {
      return NextResponse.json({ error: 'Missing operator context' }, { status: 400 });
    }

    // Tier-based model selection for SITREP generation
    // RECON (haiku): Haiku — fast, solid plans for entry-level operators
    // OPERATOR (sonnet): Sonnet — smarter programming, better periodization
    // COMMANDER (opus): Opus — elite-tier precision, deep personalization
    // WARFIGHTER (white_glove): Opus — premier white-glove service
    const modelMap: Record<string, string> = {
      haiku: 'claude-haiku-4-5-20251001',
      sonnet: 'claude-sonnet-4-6',
      opus: 'claude-opus-4-6',
      white_glove: 'claude-opus-4-6',
    };
    const model = modelMap[tier] || 'claude-sonnet-4-6';

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are GUNNY — elite tactical AI fitness coach. Generate a comprehensive SITREP (situation report) battle plan for this operator based on their intake data.

OPERATOR DATA:
${JSON.stringify(operatorContext, null, 2)}

Generate a COMPLETE training and nutrition battle plan. Return ONLY valid JSON — no markdown, no backticks, no explanation.

The JSON must match this EXACT structure:
{
  "summary": "2-3 sentence Gunny-voice assessment of where this operator stands and the game plan",
  "nutritionPlan": {
    "dailyCalories": number,
    "protein": number (grams),
    "carbs": number (grams),
    "fat": number (grams),
    "mealsPerDay": number,
    "hydrationOz": number,
    "approach": "brief nutrition strategy description",
    "sampleDay": [
      { "time": "7:00 AM", "name": "Meal 1 — Breakfast", "description": "food items", "calories": number, "protein": number, "carbs": number, "fat": number }
    ],
    "notes": "Gunny nutrition notes and tips"
  },
  "trainingPlan": {
    "split": "training split name (e.g. Upper/Lower 4-Day)",
    "daysPerWeek": number,
    "sessionDuration": "45-60 min",
    "weeks": [
      {
        "weekNumber": 1,
        "focus": "week focus theme",
        "days": [
          {
            "dayNumber": 1,
            "dayName": "Monday",
            "type": "training" | "rest" | "active_recovery" | "conditioning",
            "title": "workout title",
            "exercises": [
              { "name": "exercise name", "sets": number, "reps": "rep range", "weight": "weight suggestion", "rest": "rest period", "notes": "form cues or substitutions", "superset": false }
            ],
            "warmup": "warmup description",
            "cooldown": "cooldown description",
            "duration": "estimated duration"
          }
        ]
      }
    ],
    "progressionStrategy": "how to progress week over week",
    "deloadProtocol": "when and how to deload"
  },
  "restrictions": ["injury-based movement restrictions"],
  "priorityFocus": ["top 3 priorities for this operator"],
  "milestones30Day": ["4-5 realistic 30-day targets"],
  "gunnyMessage": "motivational closing message in Gunny voice — address operator by callsign"
}

CRITICAL RULES:
1. ALWAYS respect injuries and restrictions — NEVER program movements that could aggravate listed injuries
2. Match training volume and intensity to their fitness level — beginners get 3-4 exercises per session, advanced get 5-7
3. Use ONLY equipment they have access to — if they only have dumbbells, program dumbbell movements
4. Nutrition must align with their stated goals, dietary restrictions, and current diet approach
5. If operator is sedentary/beginner, first 2 weeks should be conservative — build the habit before building intensity
6. Include REST DAYS — beginners need more rest, advanced can train more frequently
7. Generate exactly 2 weeks of programming (Week 1 = foundation, Week 2 = slight progression)
8. Each week must have exactly 7 days (including rest days)
9. Sample nutrition day must total close to the daily calorie target
10. Address the operator by their CALLSIGN in the summary and gunnyMessage`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    let parsed;
    try {
      const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: 'Failed to parse SITREP', raw: text }, { status: 500 });
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
