import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

// OpenAI TTS — "onyx" voice for Gunny (deep, authoritative male)
// Voices: alloy, echo, fable, onyx, nova, shimmer
// onyx = deepest male voice, perfect for military DI character
//
// AUTH: required. This endpoint burns OpenAI API credits on every call, so we
// gate it behind auth to keep the cost tied to a known operator and so a
// future rate-limit bucket can attribute usage correctly. lib/tts.ts already
// sends the Authorization header via authHeaders().
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

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

    // Clean text FIRST, truncate AFTER. Order matters: a Gunny
    // workout response can be 1500+ chars of mostly markdown table
    // and code fences. Truncating raw text at 300 chars then
    // stripping markdown leaves ~80 speakable chars, which the user
    // hears as a 4-6 second cutoff mid-sentence ("starts speaking
    // but cuts off"). Strip first, then truncate the SPEAKABLE
    // text — that way the cap reflects actual speech length, not
    // raw markdown bytes.
    const clean = text
      // Drop markdown table rows (pipe-delimited lines) so Gunny doesn't read ' pipe pipe pipe '
      .replace(/^\|.*\|$/gm, '')
      // Drop table divider rows like |---|---|
      .replace(/^[\s|:\-]+$/gm, '')
      // Strip bold/italic/heading/rule chars
      .replace(/[*_#━═]{2,}/g, '')
      // Strip inline code backticks
      .replace(/`+/g, '')
      // Drop fenced code blocks entirely (workout JSON, exercise
      // tables, etc.) — Gunny shouldn't recite JSON aloud.
      .replace(/```[\s\S]*?```/g, '')
      // Collapse newlines into sentence breaks
      .replace(/\n+/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Cap at 3500 chars (~4 minutes of speech). OpenAI's hard limit
    // is 4096; staying under leaves room for the cleanup regexes
    // adding "..." or sentence breaks. 300 was too aggressive — a
    // typical Gunny response is 600-1200 chars of speakable text.
    const TTS_MAX_CHARS = 3500;
    const truncated = clean.length > TTS_MAX_CHARS
      ? clean.slice(0, TTS_MAX_CHARS) + '…'
      : clean;

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',         // tts-1 for speed, tts-1-hd for quality
        input: truncated,       // cleaned + length-capped above
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
