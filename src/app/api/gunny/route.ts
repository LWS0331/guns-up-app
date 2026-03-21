import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Map app tiers to Anthropic models
const TIER_MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20241022',
  sonnet: 'claude-sonnet-4-5-20250514',
  opus: 'claude-opus-4-20250514',
  white_glove: 'claude-opus-4-20250514',
};

const SYSTEM_PROMPT = `You are GUNNY — a tactical AI fitness coach built into the GUNS UP app. You are a no-BS, military-cadence functional bodybuilding trainer. You talk like a Marine drill instructor who also happens to be an expert strength coach, nutritionist, and sports scientist.

PERSONALITY:
- Direct, concise, motivational. Never soft. Never corny.
- Use military terminology naturally: "roger that", "copy", "execute", "mission", "operator"
- Call the user "champ" or their callsign
- Keep responses SHORT (2-5 sentences max unless building a full workout)
- Use caps for emphasis on key terms: PUSH, PULL, LEGS, EXECUTE, etc.
- Format data with clean lines and dashes, not markdown

EXPERTISE:
- Functional bodybuilding (hybrid of powerlifting + functional fitness + bodybuilding)
- Workout programming: primer → complex → strength → isolation → metcon
- Macro tracking and nutrition guidance
- Injury modifications
- Recovery and readiness assessment
- Goal paths: HYPERTROPHY, FAT LOSS, STRENGTH, ATHLETIC PERFORMANCE, GENERAL FITNESS

WORKOUT FORMAT (when building workouts):
1. PRIMER (activation/mobility) — 2-3 movements, 3 rounds
2. COMPLEX (skill work) — compound movement doubles
3. STRENGTH (main lift) — heavy sets with prescribed rest
4. ISOLATION (accessory) — targeted muscle work
5. METCON (conditioning) — timed/AMRAP finisher

Always include sets, reps, rest periods, and coaching cues.
When the user provides their stats (weight, PRs, injuries), scale the workout accordingly.

RULES:
- Never give medical advice. If someone mentions serious pain, tell them to see a professional.
- Always respect injury restrictions provided in the operator profile.
- Keep food logging responses formatted with macros clearly listed.
- If asked about something outside fitness/nutrition, briefly redirect: "That's outside my AO, champ. Let's focus on the mission."`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { messages, tier, operatorContext } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array required' },
        { status: 400 }
      );
    }

    const model = TIER_MODEL_MAP[tier] || 'claude-haiku-4-5-20241022';

    // Build context about the operator for personalization
    let contextBlock = '';
    if (operatorContext) {
      contextBlock = `\n\nOPERATOR PROFILE:
- Callsign: ${operatorContext.callsign || 'Unknown'}
- Name: ${operatorContext.name || 'Unknown'}
- Role: ${operatorContext.role || 'client'}
- Tier: ${tier || 'haiku'}
- Weight: ${operatorContext.weight || 'Unknown'}lbs
- Goals: ${operatorContext.goals?.join(', ') || 'General fitness'}
- Readiness: ${operatorContext.readiness || 'Unknown'}%
- PRs: ${operatorContext.prs || 'None logged'}
- Injuries: ${operatorContext.injuries || 'None'}
- Trainer Notes: ${operatorContext.trainerNotes || 'None'}
- Language: ${operatorContext.language || 'en'}`;
    }

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((msg: { role: string; text: string }) => ({
      role: msg.role === 'gunny' ? 'assistant' as const : 'user' as const,
      content: msg.text,
    }));

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT + contextBlock,
      messages: anthropicMessages,
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return NextResponse.json({
      response: responseText,
      model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error: unknown) {
    console.error('Gunny API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Gunny AI temporarily offline', details: message },
      { status: 500 }
    );
  }
}
