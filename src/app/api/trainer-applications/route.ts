import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/sendEmail';

// /api/trainer-applications
//
// POST (public) — landing-page /trainer-apply form submission.
//   Curated funnel — applications go to a DB queue and are reviewed manually.
//   No auto-acceptance, no Stripe checkout for trainers. Spec'd to keep the
//   trainer side selective ("I don't want to get spammed").
//
// GET (admin) — list applications, gated on ADMIN_SECRET header to match the
//   existing /api/admin/* convention until a formal admin role lands.
//
// Spam protection (mirrors /api/contact):
//   1. Honeypot field `_company` — real users never see it; bots fill it.
//   2. In-memory IP rate limit (5 / hour) per Node instance.
//   3. Server-side input length caps + email format check.

const RATE_LIMIT_PER_HOUR = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const ipHits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const arr = (ipHits.get(ip) || []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_PER_HOUR) {
    ipHits.set(ip, arr);
    return true;
  }
  arr.push(now);
  ipHits.set(ip, arr);
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Disciplines we currently program for. Anything else gets rejected at the
// form so the funnel stays focused — "yoga" or "pilates" applicants won't
// match the product.
const ALLOWED_DISCIPLINES = new Set([
  'strength',
  'hypertrophy',
  'tactical',
  'sport_performance',
  'crossfit',
  'powerlifting',
  'olympic_lifting',
  'general_fitness',
  'rehab',
  'other',
]);

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_CALLSIGN = 32;
const MAX_TEXT = 5000;
const MIN_TEXT = 30;
const MAX_CERTS = 12;
const MAX_CERT_LEN = 80;
const MAX_YEARS = 60;
const MAX_CLIENTS = 5000;

interface TrainerApplyPayload {
  name?: string;
  email?: string;
  callsign?: string;
  yearsCertified?: number;
  currentClientCount?: number;
  primaryDiscipline?: string;
  certifications?: string[];
  whyGunsUp?: string;
  sampleProgramming?: string;
  /** Honeypot — bots fill this, humans never see it. */
  _company?: string;
}

export async function POST(req: NextRequest) {
  let body: TrainerApplyPayload;
  try {
    body = (await req.json()) as TrainerApplyPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Honeypot — return 200 so the bot doesn't retry; we silently drop.
  if (typeof body._company === 'string' && body._company.trim().length > 0) {
    console.warn('[api/trainer-applications] honeypot tripped — silently dropping');
    return NextResponse.json({ ok: true, id: 'honeypot' });
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Too many submissions — try again in an hour.' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    );
  }

  // Validate
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const callsignRaw = (body.callsign || '').trim();
  const callsign = callsignRaw.length > 0 ? callsignRaw : null;
  const yearsCertified = Number.isFinite(body.yearsCertified)
    ? Math.max(0, Math.min(MAX_YEARS, Math.floor(body.yearsCertified as number)))
    : -1;
  const currentClientCount = Number.isFinite(body.currentClientCount)
    ? Math.max(0, Math.min(MAX_CLIENTS, Math.floor(body.currentClientCount as number)))
    : -1;
  const primaryDiscipline = (body.primaryDiscipline || '').trim().toLowerCase();
  const whyGunsUp = (body.whyGunsUp || '').trim();
  const sampleProgramming = (body.sampleProgramming || '').trim();
  const certificationsRaw = Array.isArray(body.certifications) ? body.certifications : [];
  const certifications = certificationsRaw
    .map((c) => String(c).trim())
    .filter((c) => c.length > 0 && c.length <= MAX_CERT_LEN)
    .slice(0, MAX_CERTS);

  if (!name || name.length > MAX_NAME) {
    return NextResponse.json({ ok: false, error: 'Name is required (under 120 chars).' }, { status: 400 });
  }
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'Valid email is required.' }, { status: 400 });
  }
  if (callsign && callsign.length > MAX_CALLSIGN) {
    return NextResponse.json({ ok: false, error: 'Callsign too long (32 char max).' }, { status: 400 });
  }
  if (yearsCertified < 0) {
    return NextResponse.json({ ok: false, error: 'Years certified is required (0+).' }, { status: 400 });
  }
  if (currentClientCount < 0) {
    return NextResponse.json({ ok: false, error: 'Current client count is required (0+).' }, { status: 400 });
  }
  if (!ALLOWED_DISCIPLINES.has(primaryDiscipline)) {
    return NextResponse.json({ ok: false, error: 'Pick a primary discipline.' }, { status: 400 });
  }
  if (!whyGunsUp || whyGunsUp.length < MIN_TEXT || whyGunsUp.length > MAX_TEXT) {
    return NextResponse.json(
      { ok: false, error: `"Why GUNS UP" must be ${MIN_TEXT}–${MAX_TEXT} characters.` },
      { status: 400 },
    );
  }
  if (!sampleProgramming || sampleProgramming.length < MIN_TEXT || sampleProgramming.length > MAX_TEXT) {
    return NextResponse.json(
      { ok: false, error: `Sample programming must be ${MIN_TEXT}–${MAX_TEXT} characters.` },
      { status: 400 },
    );
  }

  // Persist
  const userAgent = req.headers.get('user-agent') || null;
  let app;
  try {
    app = await prisma.trainerApplication.create({
      data: {
        email,
        name,
        callsign,
        yearsCertified,
        currentClientCount,
        primaryDiscipline,
        certifications,
        whyGunsUp,
        sampleProgramming,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    console.error('[api/trainer-applications] create failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Could not submit. Try again in a minute.' },
      { status: 500 },
    );
  }

  // Notify admin — best-effort, never blocks the submission. The applicant
  // gets the success message regardless of email delivery so the funnel
  // doesn't lie to them.
  try {
    const tag = '[GUNS UP · TRAINER APPLY]';
    const subject = `${tag} ${name} — ${yearsCertified}yr cert, ${currentClientCount} clients`;
    const text = [
      'New trainer application — review at your leisure.',
      '',
      `ID:    ${app.id}`,
      `Name:  ${name}`,
      `Email: ${email}`,
      `Callsign: ${callsign || '(none yet)'}`,
      `Years certified:       ${yearsCertified}`,
      `Current client count:  ${currentClientCount}`,
      `Primary discipline:    ${primaryDiscipline}`,
      `Certifications:        ${certifications.join(', ') || '(none listed)'}`,
      '',
      '── Why GUNS UP ──',
      whyGunsUp,
      '',
      '── Sample programming ──',
      sampleProgramming,
      '',
      `IP: ${ip}`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n');
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<pre style="font-family: ui-monospace, monospace; font-size: 13px; line-height: 1.5; white-space: pre-wrap; max-width: 720px;">${escapeHtml(text)}</pre>`;

    await sendEmail({
      subject,
      text,
      html,
      replyTo: email, // one-click reply lands at the applicant
    });
  } catch (err) {
    console.warn('[api/trainer-applications] notify email failed (non-blocking):', err);
  }

  return NextResponse.json({ ok: true, id: app.id });
}

// Admin-only list. Matches existing /api/admin/* gate via ADMIN_SECRET header.
// Optional ?status= filter ("pending" | "approved" | "rejected").
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const where = status ? { status } : {};
  try {
    const apps = await prisma.trainerApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ applications: apps });
  } catch (err) {
    console.error('[api/trainer-applications] list failed:', err);
    return NextResponse.json({ error: 'Could not list.' }, { status: 500 });
  }
}
