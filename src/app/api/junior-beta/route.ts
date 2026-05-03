// POST /api/junior-beta — beta-list signup intake for the Junior
// Operator landing page (/junior-operator).
//
// Pipeline: validate → persist → notify.
//   1. Validate body (role + email + name + optional lifter exp).
//   2. Persist to JuniorBetaLead via Prisma. Source-of-truth so a
//      lead is never lost — even if email delivery fails the
//      record exists for manual recovery.
//   3. Send a notification email to the founder inbox via Resend.
//      Best-effort, non-blocking — applicant gets the success
//      response regardless of delivery status (we don't lie about
//      "received" if the inbox notify failed; the row is in the DB).
//
// GET (admin) — list leads, gated on ADMIN_SECRET header (matches
// the existing /api/admin/* + /api/trainer-applications convention).
// Optional ?status= filter ("pending" | "invited" | "rejected") and
// ?role= filter ("parent" | "coach" | "athlete" | "lifter").
//
// Spam protection (mirrors /api/trainer-applications):
//   1. Honeypot field `_company` — silently drops bot traffic.
//   2. In-memory IP rate limit (5 / hour per Node instance).
//   3. Server-side input length caps + email format check.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/sendEmail';

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
const VALID_ROLES = new Set(['parent', 'coach', 'athlete', 'lifter']);

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_LIFTER_TEXT = 500;

interface JuniorBetaPayload {
  role?: string;
  email?: string;
  name?: string;
  lifterExperience?: string;
  /** Honeypot — bots fill this; humans never see it. */
  _company?: string;
}

export async function POST(req: NextRequest) {
  let body: JuniorBetaPayload;
  try {
    body = (await req.json()) as JuniorBetaPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Honeypot — return 200 so the bot doesn't retry; we silently drop.
  if (typeof body._company === 'string' && body._company.trim().length > 0) {
    console.warn('[api/junior-beta] honeypot tripped — silently dropping');
    return NextResponse.json({ ok: true, id: 'honeypot' });
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Too many submissions — try again in an hour.' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    );
  }

  // Validate role
  const role = (body.role || '').toString();
  if (!VALID_ROLES.has(role)) {
    return NextResponse.json(
      { ok: false, error: 'Pick a role: parent, coach, athlete, or lifter.' },
      { status: 400 },
    );
  }

  // Validate email
  const email = (body.email || '').trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: 'Enter a valid email address.' },
      { status: 400 },
    );
  }

  // Validate name
  const name = (body.name || '').trim();
  if (name.length === 0 || name.length > MAX_NAME) {
    return NextResponse.json(
      { ok: false, error: 'Tell us your name (under 120 chars).' },
      { status: 400 },
    );
  }

  // Optional lifter follow-up — only persist when the role implies it
  let lifterExperience: string | null = null;
  if (role === 'lifter' && typeof body.lifterExperience === 'string') {
    const v = body.lifterExperience.trim();
    if (v.length > 0) lifterExperience = v.slice(0, MAX_LIFTER_TEXT);
  }

  // Persist
  const userAgent = req.headers.get('user-agent') || null;
  let lead;
  try {
    lead = await prisma.juniorBetaLead.create({
      data: {
        email,
        name,
        role,
        lifterExperience,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    console.error('[api/junior-beta] persist failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Could not submit. Try again in a minute.' },
      { status: 500 },
    );
  }

  // Notify admin — best-effort, never blocks the response. The
  // applicant gets the success message regardless of email delivery
  // because the DB row already exists; if the founder inbox doesn't
  // get the ping, manual recovery from the DB is one query away.
  try {
    const tag = '[GUNS UP · JR. OPERATOR · BETA]';
    const subject = `${tag} ${role.toUpperCase()} — ${name}`;
    const text = [
      'New Junior Operator beta lead.',
      '',
      `ID:    ${lead.id}`,
      `Role:  ${role}`,
      `Name:  ${name}`,
      `Email: ${email}`,
      ...(lifterExperience ? ['', '── Lifter experience ──', lifterExperience] : []),
      '',
      `IP: ${ip}`,
      `Time: ${new Date().toISOString()}`,
      '',
      '── Next step ──',
      `Reply to this email to reach the lead directly, or invite them via the founder dashboard once Wave 01 has room.`,
    ].join('\n');
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<pre style="font-family: ui-monospace, monospace; font-size: 13px; line-height: 1.5; white-space: pre-wrap; max-width: 720px;">${escapeHtml(text)}</pre>`;

    await sendEmail({
      subject,
      text,
      html,
      replyTo: email,
    });
  } catch (err) {
    console.warn('[api/junior-beta] notify email failed (non-blocking):', err);
  }

  return NextResponse.json({ ok: true, id: lead.id });
}

// Admin-only list. Same gate as /api/trainer-applications.
// Optional filters: ?status=pending | ?role=parent
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const role = url.searchParams.get('role');
  const where: Record<string, string> = {};
  if (status) where.status = status;
  if (role) where.role = role;
  try {
    const leads = await prisma.juniorBetaLead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return NextResponse.json({ leads });
  } catch (err) {
    console.error('[api/junior-beta] list failed:', err);
    return NextResponse.json({ error: 'Could not list.' }, { status: 500 });
  }
}
