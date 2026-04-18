import { NextRequest, NextResponse } from 'next/server';

// OpenAI TTS — "onyx" voice for Gunny (deep, authoritative male)
// Voices: alloy, echo, fable, onyx, nova, shimmer
// onyx = deepest male voice, perfect for military DI character

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Fallback: return empty response — client will use browser TTS
      return NextResponse.json({ fallback: true }, { status: 200 });
    }

    const { text, voice = 'onyx', speed = 1.1 } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text required' }, { status: 400 });
    }

    // Truncate long text for TTS (keep it punchy — Gunny doesn't ramble)
    const truncated = text.length > 300 ? text.slice(0, 300) + '...' : text;

    // Clean text for speech — strip formatting chars and markdown tables before synthesis
    const clean = truncated
      // Drop markdown table rows (pipe-delimited lines) so Gunny doesn't read ' pipe pipe pipe '
      .replace(/^\|.*\|$/gm, '')
      // Drop table divider rows like |---|---|
      .replace(/^[\s|:\-]+$/gm, '')
      // Strip bold/italic/heading/rule chars
      .replace(/[*_#━═]{2,}/g, '')
      // Strip inline code backticks
      .replace(/`+/g, '')
      // Collapse newlines into sentence breaks
      .replace(/\n+/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',        // tts-1 for speed, tts-1-hd for quality
        input: clean,
        voice: voice,           // onyx = deep authoritative male
        speed: speed,           // 1.1 = slightly fast, military cadence
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI TTS error:', err);
      return NextResponse.json({ fallback: true, error: err }, { status: 200 });
    }

    // Stream the audio back
    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600', // Cache TTS responses 1hr
      },
    });
  } catch (error) {
    console.error('TTS route error:', error);
    return NextResponse.json({ fallback: true }, { status: 200 });
  }
}
