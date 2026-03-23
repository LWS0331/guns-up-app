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

    const modelMap: Record<string, string> = {
      haiku: 'claude-haiku-4-5-20251001',
      sonnet: 'claude-sonnet-4-6',
      opus: 'claude-opus-4-6',
      white_glove: 'claude-opus-4-6',
    };
    const model = modelMap[tier] || 'claude-sonnet-4-6';

    // Compact operator data — strip nulls to reduce prompt size
    const compactContext = JSON.stringify(operatorContext);

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are GUNNY — elite tactical AI fitness coach. Generate an initial SITREP battle plan for this operator. This is their FIRST DAY. Tomorrow's workout will be auto-generated based on today's results.

OPERATOR: ${compactContext}

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
    "dayName": "${new Date().toLocaleDateString('en-US', { weekday: 'long' })}",
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
4. Nutrition aligns with goals and dietary restrictions
5. Beginners get conservative volume
6. Today's workout must be appropriate for Day 1
7. Sample nutrition day totals must match calorie target
8. Address operator by CALLSIGN`,
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
