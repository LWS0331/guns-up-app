import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '@/lib/requireAuth';
import { PHOTO_ANALYSIS_MODEL } from '@/lib/models';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(req: NextRequest) {
  // Auth required — this route burns Anthropic API credits
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { image, mimeType } = await req.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const response = await client.messages.create({
      model: PHOTO_ANALYSIS_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType || 'image/jpeg',
                data: image,
              },
            },
            {
              type: 'text',
              text: `Analyze this food photo and estimate the macronutrient breakdown. Be as accurate as possible.

Return ONLY valid JSON in this exact format — no markdown, no explanation, no backticks:
{
  "items": [
    {
      "name": "food item name",
      "portion": "estimated portion size (e.g. '6 oz', '1 cup')",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number
    }
  ],
  "totals": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number
  },
  "confidence": "low" | "medium" | "high",
  "notes": "brief note about estimation quality, hidden ingredients, etc."
}

Estimation rules:
- Use USDA standard reference data for common foods
- Estimate portion sizes based on plate/bowl size, utensil reference, and food density
- For mixed dishes, break down visible components individually
- Always note if oils, sauces, or hidden calorie sources are likely present
- Set confidence to "low" for mixed/complex dishes, "medium" for identifiable but hard-to-portion items, "high" for simple clearly portioned items
- Round all numbers to whole integers
- Err slightly high on calories (better to overestimate than under for tracking)`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse the JSON response — handle potential markdown wrapping
    let parsed;
    try {
      const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      // Log the raw LLM output server-side (truncated) for debugging, but do
      // NOT return it to the client. Returning raw model output to the caller
      // leaks whatever the model generated — could be hallucinated content,
      // partial prompt echoes, or unbounded text — and expands the UI's
      // exposure to whatever shape a future model decides to emit.
      const preview = typeof text === 'string' ? text.slice(0, 400) : '';
      console.error('[api/nutrition/analyze-photo] JSON parse failed:', err, '| preview:', preview);
      return NextResponse.json(
        { error: 'Could not parse nutrition data from image. Try a clearer photo or log the meal manually.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      accuracy: 'photo_ai',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Photo analysis error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
