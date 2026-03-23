import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { operatorContext, sitrep, yesterdayData, todayDateStr, todayDayName, clientTimezone, tier } = body;

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

    // Compact SITREP context — only send what the AI needs for workout generation
    const sitrepContext = {
      trainingPlan: sitrep.trainingPlan,
      nutritionPlan: sitrep.nutritionPlan ? {
        dailyCalories: sitrep.nutritionPlan.dailyCalories,
        protein: sitrep.nutritionPlan.protein,
        carbs: sitrep.nutritionPlan.carbs,
        fat: sitrep.nutritionPlan.fat,
        mealsPerDay: sitrep.nutritionPlan.mealsPerDay,
        hydrationOz: sitrep.nutritionPlan.hydrationOz,
        approach: sitrep.nutritionPlan.approach,
      } : null,
      today: sitrep.today, // Day 1 reference workout
      priorityFocus: sitrep.priorityFocus,
      restrictions: sitrep.restrictions,
    };

    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are GUNNY — elite tactical AI fitness coach. Generate today's DAILY BRIEF for this operator.

OPERATOR: ${operatorContext.callsign}
FITNESS LEVEL: ${operatorContext.fitnessLevel || 'beginner'}
TODAY: ${todayDayName || 'Sunday'}, ${todayDateStr}
TIMEZONE: ${clientTimezone || 'America/Chicago'}
WEIGHT: ${operatorContext.weight || 'unknown'}lbs | AGE: ${operatorContext.age || 'unknown'} | HEIGHT: ${operatorContext.height || 'unknown'}
GOALS: ${JSON.stringify(operatorContext.goals || [])}
INJURIES: ${JSON.stringify(operatorContext.injuries || [])}
EQUIPMENT: ${JSON.stringify(operatorContext.availableEquipment || ['full gym'])}
DIET: ${operatorContext.currentDiet || 'no plan'} | PROTEIN PRIORITY: ${operatorContext.proteinPriority || 'moderate'}
SLEEP: ${operatorContext.sleepQuality || '?'}/10 | STRESS: ${operatorContext.stressLevel || '?'}/10
SUPPLEMENTS: ${JSON.stringify(operatorContext.supplements || [])}
DIETARY RESTRICTIONS: ${JSON.stringify(operatorContext.dietaryRestrictions || [])}

═══ ACTIVE BATTLE PLAN (SITREP) ═══
This is the operator's APPROVED battle plan. You MUST follow this plan's training structure:
- Split: ${sitrepContext.trainingPlan?.split || 'TBD'}
- Days/week: ${sitrepContext.trainingPlan?.daysPerWeek || 4}
- Session duration: ${sitrepContext.trainingPlan?.sessionDuration || '45-60 min'}
- Progression: ${sitrepContext.trainingPlan?.progressionStrategy || 'linear'}
- Deload: ${sitrepContext.trainingPlan?.deloadProtocol || 'every 4th week'}

NUTRITION TARGETS: ${JSON.stringify(sitrepContext.nutritionPlan || {})}
PRIORITY FOCUS: ${JSON.stringify(sitrepContext.priorityFocus || [])}
RESTRICTIONS: ${JSON.stringify(sitrepContext.restrictions || [])}

DAY 1 REFERENCE WORKOUT (from SITREP):
${JSON.stringify(sitrepContext.today || {}, null, 1)}

═══ YESTERDAY'S PERFORMANCE ═══
${JSON.stringify(yesterdayData, null, 1)}

═══ INSTRUCTIONS ═══
Generate today's workout BASED ON the battle plan above. The workout MUST:
1. Follow the SITREP's training split (e.g. if it's Upper/Lower, alternate correctly)
2. Use the same exercise selection style, rep ranges, and progression approach from the SITREP
3. Respect all restrictions and injuries listed in the SITREP
4. Progress logically from yesterday's session — the next day in the split rotation
5. Adjust intensity based on yesterday's compliance data

Return ONLY valid JSON:
{
  "greeting": "short Gunny greeting addressing operator by callsign",
  "todaysFocus": "one sentence: what today is about",
  "workout": null (if rest day) OR {
    "dayNumber": number,
    "dayName": "day name",
    "type": "training",
    "title": "workout title matching the split pattern",
    "exercises": [
      { "name": "exercise", "sets": number, "reps": "rep range", "weight": "weight", "rest": "rest", "notes": "notes", "superset": false }
    ],
    "warmup": "warmup",
    "cooldown": "cooldown",
    "duration": "duration"
  },
  "nutritionReminder": "specific nutrition action for today based on their plan and yesterday's compliance",
  "adjustments": ["list of any changes from the SITREP plan and why"],
  "motivation": "Gunny-voice motivational message — short, punchy",
  "complianceScore": number 0-100 (based on yesterday),
  "streakDays": number (consecutive days of compliance)
}

ADAPTATION RULES:
- ALWAYS follow the SITREP battle plan's split and exercise philosophy
- If they MISSED yesterday: don't shame, adjust — offer to combine or reschedule
- If they CRUSHED it: acknowledge, push slightly harder
- If they under-ate protein: remind them specifically
- If they logged zero meals: gentle nudge to track today
- If it's a rest day per the split: give recovery tips
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
