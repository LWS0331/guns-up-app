// POST /api/early-access — reservation intake for the May 2026 IG reel
// campaign. 20 total seats: 15 commander + 5 warfighter.
//
// Pipeline: validate → seat-check → persist → notify.
//   1. Honeypot + per-IP rate-limit pre-checks (spam defense).
//   2. Validate body (name + email + tier).
//   3. Re-check seat availability under the row count (defensive — UI
//      counter could be stale by 30s vs. an actual race condition).
//   4. Idempotency check — same email+tier returns existing row.
//   5. Persist EarlyAccessReservation. Source-of-truth.
//   6. Send notification email to founder. Best-effort, non-blocking.
//
// GET — admin-only list, gated on ADMIN_SECRET header. Mirrors
// /api/junior-beta and /api/trainer-applications conventions.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/sendEmail';

const COMMANDER_TOTAL = 15;
const WARFIGHTER_TOTAL = 5;

// In-memory rate limit per Node instance. Same shape as junior-beta —
// not perfect at multi-replica scale but sufficient for spam defense
// of a campaign expected to peak at low double-digit reservations/hour.
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
const VALID_TIERS = new Set(['commander', 'warfighter']);

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_CALLSIGN = 40;
const MAX_NOTE = 500;

interface Payload {
  name?: string;
  email?: string;
  tier?: string;
  callsign?: string;
  note?: string;
  /** Honeypot — bots fill this; humans never see it. */
  _company?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Honeypot
  if (typeof body._company === 'string' && body._company.trim().length > 0) {
    // eslint-disable-next-line no-console
    console.warn('[api/early-access] honeypot tripped — silently dropping');
    return NextResponse.json({ ok: true, id: 'honeypot' });
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Too many submissions — try again in an hour or DM "OPS" on Instagram.',
      },
      { status: 429, headers: { 'Retry-After': '3600' } },
    );
  }

  // Validate name
  const name = (body.name || '').toString().trim();
  if (!name || name.length > MAX_NAME) {
    return NextResponse.json(
      { ok: false, error: 'Name is required.' },
      { status: 400 },
    );
  }

  // Validate email
  const email = (body.email || '').toString().trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: 'Valid email required.' },
      { status: 400 },
    );
  }

  // Validate tier
  const tier = (body.tier || '').toString().toLowerCase();
  if (!VALID_TIERS.has(tier)) {
    return NextResponse.json(
      { ok: false, error: 'Pick a tier: COMMANDER or WARFIGHTER.' },
      { status: 400 },
    );
  }

  const callsign =
    (body.callsign || '').toString().trim().slice(0, MAX_CALLSIGN) || null;
  const note = (body.note || '').toString().trim().slice(0, MAX_NOTE) || null;

  try {
    // Defensive seat check before insert — prevents oversell on a
    // tight race between two simultaneous submissions.
    const total = tier === 'commander' ? COMMANDER_TOTAL : WARFIGHTER_TOTAL;
    const taken = await prisma.earlyAccessReservation.count({
      where: { tier, status: { in: ['reserved', 'onboarded'] } },
    });
    if (taken >= total) {
      return NextResponse.json(
        {
          ok: false,
          error: `${tier.toUpperCase()} seats are filled. Try the other tier or DM "OPS" on Instagram for the waitlist.`,
        },
        { status: 409 },
      );
    }

    // Idempotency — if same email already reserved same tier, return
    // the existing row rather than creating a duplicate.
    const existing = await prisma.earlyAccessReservation.findFirst({
      where: { email, tier },
    });
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, idempotent: true });
    }

    const created = await prisma.earlyAccessReservation.create({
      data: {
        name,
        email,
        tier,
        callsign,
        note,
        status: 'reserved',
        source: 'ig-reel-may-2026',
      },
    });

    // Notify founder — non-blocking. A delivery failure must never
    // surface as a reservation failure to the user; the row in the DB
    // is the source-of-truth.
    try {
      const adminEmail =
        process.env.ADMIN_NOTIFY_EMAIL || 'ruben@hirewithfox.com';
      const subject = `[GUNS UP] New ${tier.toUpperCase()} reservation — ${name}`;
      const remaining =
        tier === 'commander'
          ? COMMANDER_TOTAL - (taken + 1)
          : WARFIGHTER_TOTAL - (taken + 1);
      const totalForTier =
        tier === 'commander' ? COMMANDER_TOTAL : WARFIGHTER_TOTAL;
      const html = `
<h2>New early-access reservation</h2>
<table style="border-collapse:collapse;font-family:monospace">
<tr><td><strong>Tier</strong></td><td>${escapeHtml(tier.toUpperCase())}</td></tr>
<tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
<tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
${callsign ? `<tr><td><strong>Callsign</strong></td><td>${escapeHtml(callsign)}</td></tr>` : ''}
${note ? `<tr><td><strong>Note</strong></td><td><pre style="white-space:pre-wrap;font-family:monospace">${escapeHtml(note)}</pre></td></tr>` : ''}
<tr><td><strong>Source</strong></td><td>ig-reel-may-2026</td></tr>
<tr><td><strong>Reservation #</strong></td><td>${escapeHtml(created.id)}</td></tr>
</table>
<p><strong>${remaining}</strong> ${tier} seats remaining out of ${totalForTier}.</p>
<p>Send Stripe link to <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a> within 24 hours.</p>
      `.trim();
      const text = [
        `New early-access reservation`,
        ``,
        `Tier:           ${tier.toUpperCase()}`,
        `Name:           ${name}`,
        `Email:          ${email}`,
        callsign ? `Callsign:       ${callsign}` : null,
        note ? `Note:\n${note}` : null,
        `Source:         ig-reel-may-2026`,
        `Reservation #:  ${created.id}`,
        ``,
        `${remaining} ${tier} seats remaining out of ${totalForTier}.`,
        `Send Stripe link to ${email} within 24 hours.`,
      ]
        .filter(Boolean)
        .join('\n');
      await sendEmail({
        to: adminEmail,
        subject,
        html,
        text,
        replyTo: email,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[api/early-access] notify email failed (non-blocking):',
        err,
      );
    }

    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/early-access] create failed:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'Reservation failed. Try again or DM "OPS" on Instagram.',
      },
      { status: 500 },
    );
  }
}

// Admin list — gated on ADMIN_SECRET header (matches /api/junior-beta).
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const tier = url.searchParams.get('tier');
  const where: { status?: string; tier?: string } = {};
  if (status) where.status = status;
  if (tier) where.tier = tier;
  try {
    const rows = await prisma.earlyAccessReservation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/early-access] list failed:', err);
    return NextResponse.json(
      { ok: false, error: 'List failed' },
      { status: 500 },
    );
  }
}
