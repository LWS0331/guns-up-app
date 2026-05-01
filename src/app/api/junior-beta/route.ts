// POST /api/junior-beta — beta-list signup intake for the Junior
// Operator landing page (/junior-operator).
//
// Currently a stub: validates the body, lowercases the email,
// console.logs the lead with a structured tag so it shows up in
// Railway logs, and acks 200. We don't yet write to a leads table
// or call out to a provider (Beehiiv / ConvertKit / etc.) — same
// rationale as the OPS Center MARKETING tab: lead-capture provider
// integration ships alongside paid revenue. Until then, log + ack
// is honest about what's happening.
//
// When we wire a provider, the change is contained to this file:
//   1) parse + validate (current logic stays)
//   2) call the provider's create-subscriber API
//   3) on failure, fall back to console.log so we never lose a
//      lead silently
//
// No auth on this route (it's a public marketing form). Rate
// limiting will need a proxy layer (Vercel/Railway middleware) if
// abuse becomes a problem; one row per minute per IP is the
// expected ceiling.

import { NextRequest, NextResponse } from 'next/server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = new Set(['parent', 'coach', 'athlete', 'lifter']);

interface JuniorBetaPayload {
  role?: string;
  email?: string;
  name?: string;
  lifterExperience?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as JuniorBetaPayload;

    // Validate role
    if (!body.role || !VALID_ROLES.has(body.role)) {
      return NextResponse.json(
        { error: 'Pick a role: parent, coach, athlete, or lifter.' },
        { status: 400 },
      );
    }

    // Validate email
    const email = (body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'Enter a valid email address.' },
        { status: 400 },
      );
    }

    // Validate name (just non-empty; any further normalization
    // happens at provider write time so we don't accidentally
    // mangle a legit unicode name here).
    const name = (body.name || '').trim();
    if (name.length === 0) {
      return NextResponse.json(
        { error: 'Tell us your name.' },
        { status: 400 },
      );
    }

    // Optional follow-up — only meaningful when role === 'lifter'
    const lifterExperience =
      body.role === 'lifter' && typeof body.lifterExperience === 'string'
        ? body.lifterExperience.trim()
        : undefined;

    // Log the lead. Railway / Vercel log search will pick this up
    // by the [junior-beta] tag. Includes a timestamp so we can
    // reconstruct the wave-01 funnel before the provider is wired.
    console.log('[junior-beta]', JSON.stringify({
      ts: new Date().toISOString(),
      role: body.role,
      email,
      name,
      lifterExperience,
    }));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[junior-beta] failed:', err);
    return NextResponse.json(
      { error: 'Submission failed. Try again or DM @gunnyai_fit.' },
      { status: 500 },
    );
  }
}
