// POST /api/gunny/analyze-form
//
// AI Form Analysis (Video) — feature #47 from the Feature Report.
//
// The client extracts ~6 evenly-spaced frames from a video clip
// (HTMLVideoElement → canvas → base64 JPEG) and POSTs them here. The
// server hands the multi-frame batch to Claude vision with a strict
// JSON schema and returns a structured breakdown the UI can render.
//
// Why client-side frame extraction instead of server-side ffmpeg:
//   - Vercel/Next runtimes don't reliably ship ffmpeg; Railway can but
//     it adds a binary dependency to every deploy.
//   - Browser canvas extraction is "free" (already has the video
//     decoded for playback) and keeps payload small (~6 JPEGs vs raw
//     30s MP4 = 5-30 MB).
//   - Same approach Apple uses in their Vision form-check demos.
//
// WARFIGHTER tier-gated (matches the spreadsheet — high-cost call,
// premium-only). Trainer/admin bypass via tierGates helpers.
//
// Input shape:
//   {
//     operatorId: string,
//     exercise: string,                 // 'squat' | 'bench' | 'deadlift' | ...
//     view?: 'side' | 'front' | 'three_quarter' | 'rear',
//     notes?: string,                   // operator's free-text context
//     frames: Array<{ data: string, timestamp?: number }>,
//                                       // base64 JPEGs (data URL or raw b64)
//   }
//
// Output JSON:
//   {
//     ok: true,
//     repsVisible: number,
//     formScore: number,                // 0-100
//     severity: 'green'|'yellow'|'red', // green = clean, red = stop
//     breakdown: [{ phase, observation, severity }],
//     primaryFix: string,               // most important correction
//     secondaryFixes: string[],         // 1-3 supporting fixes
//     cuesToTry: string[],              // 2-4 internal/external cues
//     safetyFlags: string[],            // red-flag concerns (empty = none)
//     encouragement: string,            // what they're doing right
//   }

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import { resolveTierModel } from '@/lib/models';
import { hasWarfighterAccess } from '@/lib/tierGates';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Caps to keep cost / abuse in check.
const MAX_FRAMES = 10;
const MIN_FRAMES = 2;
const MAX_FRAME_BYTES = 800_000;  // ~800KB per frame after base64 decode
const ALLOWED_MEDIA: Array<'image/jpeg' | 'image/png' | 'image/webp'> = [
  'image/jpeg', 'image/png', 'image/webp',
];

interface IncomingFrame {
  data: string;        // data URL or raw base64
  timestamp?: number;  // seconds into clip
}

// Parse a frame payload into Anthropic's image block shape.
// Returns null when the frame is malformed/oversized.
function parseFrame(f: IncomingFrame): {
  type: 'image';
  source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string };
} | null {
  if (!f || typeof f.data !== 'string') return null;
  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg';
  let raw = f.data;
  const m = f.data.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (m) {
    mediaType = m[1] as typeof mediaType;
    raw = m[2];
  }
  if (!ALLOWED_MEDIA.includes(mediaType)) return null;
  // Approximate decoded byte size from base64 length.
  const decodedSize = Math.floor(raw.length * 0.75);
  if (decodedSize > MAX_FRAME_BYTES) return null;
  if (raw.length < 200) return null;  // implausibly small
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data: raw } };
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
    const exercise: string | undefined = (body?.exercise || '').trim();
    const view: string | undefined = body?.view;
    const notes: string = (body?.notes || '').toString().slice(0, 800);
    const frames: IncomingFrame[] = Array.isArray(body?.frames) ? body.frames : [];

    if (!operatorId) {
      return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
    }
    if (!exercise) {
      return NextResponse.json({ error: 'exercise required' }, { status: 400 });
    }
    if (frames.length < MIN_FRAMES) {
      return NextResponse.json({
        error: `Need at least ${MIN_FRAMES} frames — got ${frames.length}. Record a longer clip or check that the video loaded.`,
      }, { status: 400 });
    }
    if (frames.length > MAX_FRAMES) {
      return NextResponse.json({
        error: `Max ${MAX_FRAMES} frames per analysis. Reduce sample rate.`,
      }, { status: 400 });
    }

    // Auth: self / admin / trainer-of-target.
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

    // Hard refusal: junior operators don't get adult-style form
    // analysis surface — sport-coach review by their trainer is the
    // appropriate path. Per docs/youth-soccer-corpus.md.
    if (op.isJunior) {
      return NextResponse.json({
        ok: true,
        refusal: true,
        message: 'Junior operators don\'t get auto form analysis — your trainer reviews technique in person. Have your coach record + walk you through corrections live.',
      });
    }

    // Tier gate: WARFIGHTER (white_glove) or higher. Admins + trainers
    // bypass via the helper.
    const viewer = { id: op.id, tier: op.tier || undefined, role: op.role };
    const adminOrTrainerViewer = isAdmin || isTrainerOfTarget;
    const allowed = adminOrTrainerViewer || hasWarfighterAccess(viewer);
    if (!allowed) {
      return NextResponse.json({
        error: 'WARFIGHTER tier required for AI Form Analysis (Video).',
        upgradeRequired: 'white_glove',
      }, { status: 402 });
    }

    // Parse + sanitize frames.
    const parsedFrames = frames
      .map(parseFrame)
      .filter((f): f is NonNullable<ReturnType<typeof parseFrame>> => f !== null);
    if (parsedFrames.length < MIN_FRAMES) {
      return NextResponse.json({
        error: `Only ${parsedFrames.length} frames passed validation (need ${MIN_FRAMES}+). Frames must be JPEG/PNG/WebP under 800KB each.`,
      }, { status: 400 });
    }

    // Operator context for the prompt — gives Gunny enough to
    // contextualize feedback against the lifter's experience and goal.
    const intake = (op.intake || {}) as Record<string, unknown>;
    const profile = (op.profile || {}) as Record<string, unknown>;
    const prefs = (op.preferences || {}) as Record<string, unknown>;
    const context = [
      `Callsign: ${op.callsign}`,
      `Exercise: ${exercise}`,
      view ? `Camera view: ${view}` : null,
      `Experience: ${intake.experienceYears != null ? intake.experienceYears + 'y' : 'unknown'}`,
      `Goal: ${intake.primaryGoal || 'unknown'}`,
      `Training path: ${prefs.trainingPath || 'unknown'}`,
      `Bodyweight: ${profile.weight ? profile.weight + ' lbs' : 'unknown'}`,
      `Height: ${profile.height || 'unknown'}`,
      `Known injuries: ${(intake.healthConditions as string[] | undefined)?.join(', ') || 'none reported'}`,
      notes ? `Operator notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    const systemPrompt = `You are GUNNY's AI Form Analysis engine. You analyze multi-frame video stills of a lifter performing an exercise and return a STRUCTURED JSON form review for the GUNS UP app's Form Analysis panel.

CORE RULES:
- You are looking at sequential frames extracted from a single video clip. Treat them as time-ordered keyframes of the same set.
- Be SPECIFIC to what is visible. Do not invent corrections that don't apply. If the form is genuinely clean, say so — green severity, short fix list, high formScore.
- Reference observable cues (bar path, hip-knee timing, depth, lockout, neck position, foot pressure) — not vague platitudes.
- Tactical, direct, coaching voice. No filler. Match the GUNS UP voice (operators, missions, tactical metaphors). No markdown in any string.
- Safety FIRST. If you see a red-flag (severe lumbar flexion under load, knee cave at peak load, bar drift over toes on deadlift, dangerous bench position with no spotter, neck hyperextension on squat) — call it out in safetyFlags AND set severity to "red".
- Be honest about visibility limits. If camera angle makes a phase impossible to assess (e.g. side view hides knee tracking), note that in observations rather than guessing.
- repsVisible = how many full reps you can count across the frames. If you only see partials or a setup, that's still useful — say repsVisible: 0 or 1 with appropriate context.
- formScore is 0-100. Calibrate: 90+ = comp-ready execution, 75-89 = solid with minor tweaks, 60-74 = clear corrections needed, 40-59 = major rework, <40 = stop and reset the movement.

OUTPUT: STRICT JSON ONLY. No prose outside the JSON object. Schema:
{
  "repsVisible": <integer>,
  "formScore": <0-100>,
  "severity": "green" | "yellow" | "red",
  "breakdown": [
    { "phase": "setup" | "descent" | "bottom" | "ascent" | "lockout" | "transition",
      "observation": "<1 sentence — what you see in this phase>",
      "severity": "green" | "yellow" | "red" }
  ],
  "primaryFix": "<one short imperative sentence — the single most important correction>",
  "secondaryFixes": ["<short cue>", "..."],
  "cuesToTry": ["<actionable cue, e.g. 'spread the floor with your feet'>", "..."],
  "safetyFlags": ["<red-flag concern>", "..."],
  "encouragement": "<one sentence on what they're doing well — keep it real, not flattering>"
}

If frames are unusable (too dark, lifter not in frame, wrong exercise) return:
{
  "repsVisible": 0,
  "formScore": 0,
  "severity": "yellow",
  "breakdown": [],
  "primaryFix": "Re-shoot — <specific reason: lighting/angle/etc>",
  "secondaryFixes": [],
  "cuesToTry": ["Side angle, full-body in frame, good lighting"],
  "safetyFlags": [],
  "encouragement": ""
}`;

    const userTextHeader = `OPERATOR CONTEXT:
${context}

FRAMES BELOW are time-ordered keyframes from a single video clip of the operator performing ${exercise}${view ? ` (${view} view)` : ''}. Analyze and return the form-review JSON.`;

    // Build content array: leading instruction + all frames in order.
    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string } }
    > = [{ type: 'text', text: userTextHeader }];
    parsedFrames.forEach((frame, i) => {
      userContent.push({ type: 'text', text: `Frame ${i + 1}/${parsedFrames.length}${frames[i].timestamp != null ? ` (t=${frames[i].timestamp!.toFixed(2)}s)` : ''}:` });
      userContent.push(frame);
    });
    userContent.push({ type: 'text', text: 'Return the form-review JSON now.' });

    // Always use the highest-quality model for vision form review,
    // regardless of operator tier. WARFIGHTER+ pay for the best.
    const model = resolveTierModel(op.tier || 'opus');

    const response = await client.messages.create({
      model,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        error: 'Form analysis failed — no JSON in model response. Try again with a clearer clip.',
        raw: text.slice(0, 400),
      }, { status: 500 });
    }

    let parsed: {
      repsVisible?: number;
      formScore?: number;
      severity?: 'green' | 'yellow' | 'red';
      breakdown?: Array<{ phase?: string; observation?: string; severity?: string }>;
      primaryFix?: string;
      secondaryFixes?: string[];
      cuesToTry?: string[];
      safetyFlags?: string[];
      encouragement?: string;
    };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({
        error: 'Form analysis returned malformed JSON. Try again.',
        raw: text.slice(0, 400),
      }, { status: 500 });
    }

    // Coerce + sanitize. We don't trust the model to perfectly comply
    // with the schema — clamp ranges, default empties, drop unknown
    // severity values.
    const validSeverity = (s: unknown): 'green' | 'yellow' | 'red' =>
      s === 'green' || s === 'yellow' || s === 'red' ? s : 'yellow';

    const sanitized = {
      repsVisible: Math.max(0, Math.min(50, Math.floor(Number(parsed.repsVisible) || 0))),
      formScore: Math.max(0, Math.min(100, Math.floor(Number(parsed.formScore) || 0))),
      severity: validSeverity(parsed.severity),
      breakdown: Array.isArray(parsed.breakdown)
        ? parsed.breakdown.slice(0, 8).map(b => ({
            phase: typeof b.phase === 'string' ? b.phase : 'unknown',
            observation: typeof b.observation === 'string' ? b.observation : '',
            severity: validSeverity(b.severity),
          })).filter(b => b.observation.length > 0)
        : [],
      primaryFix: typeof parsed.primaryFix === 'string' ? parsed.primaryFix.slice(0, 240) : '',
      secondaryFixes: Array.isArray(parsed.secondaryFixes)
        ? parsed.secondaryFixes.filter((s): s is string => typeof s === 'string').slice(0, 4)
        : [],
      cuesToTry: Array.isArray(parsed.cuesToTry)
        ? parsed.cuesToTry.filter((s): s is string => typeof s === 'string').slice(0, 6)
        : [],
      safetyFlags: Array.isArray(parsed.safetyFlags)
        ? parsed.safetyFlags.filter((s): s is string => typeof s === 'string').slice(0, 4)
        : [],
      encouragement: typeof parsed.encouragement === 'string' ? parsed.encouragement.slice(0, 240) : '',
    };

    return NextResponse.json({
      ok: true,
      refusal: false,
      exercise,
      view: view || null,
      framesAnalyzed: parsedFrames.length,
      model,
      ...sanitized,
    });
  } catch (error) {
    console.error('[analyze-form] error', error);
    return NextResponse.json({
      error: 'Failed to analyze form',
      details: String(error),
    }, { status: 500 });
  }
}
