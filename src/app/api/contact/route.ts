import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/sendEmail';

// POST /api/contact — landing-page contact form submission.
// Public (no auth) — visitors haven't signed up yet, that's the whole point.
// Spam protection:
//   1. Honeypot field `_company` — real users don't fill it; bots do.
//   2. In-memory IP rate limit (5 / hour) — survives a single Node instance.
//      Multi-instance deploys leak through, but this is a low-value target
//      and the email destination + From restrictions in Resend cap impact.
//   3. Server-side input length caps + email format check.

const RATE_LIMIT_PER_HOUR = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

// Module-scoped IP → submission timestamps. Cleared on Node restart.
const ipHits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  // Railway / Vercel forward through x-forwarded-for. Trust the leftmost.
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

// Subject categories the landing page CTAs can request. Anything else is
// labeled "general" so the inbox is always sortable.
const ALLOWED_SUBJECTS = new Set([
  'general',
  'brief',           // hero "REQUEST BRIEF"
  'trainer',         // "Apply as Trainer" / "Download One-Pager"
  'beta',            // footer "Beta Program"
  'support',         // misc product support
  'press',           // press inquiries
]);

const MAX_NAME = 120;
const MAX_EMAIL = 254;     // RFC 5321
const MAX_MESSAGE = 5000;  // ~one printed page

interface ContactPayload {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  /** Honeypot — bots fill this, humans never see it. */
  _company?: string;
}

export async function POST(req: NextRequest) {
  let body: ContactPayload;
  try {
    body = (await req.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Honeypot: any value at all in `_company` means it's a bot. Return 200 so
  // the bot thinks it succeeded and doesn't retry — no email is sent.
  if (typeof body._company === 'string' && body._company.trim().length > 0) {
    console.warn('[api/contact] honeypot tripped — silently dropping');
    return NextResponse.json({ ok: true, id: 'honeypot' });
  }

  // Rate limit by IP.
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Too many submissions — try again in an hour.' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    );
  }

  // Validate.
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const subjectRaw = (body.subject || 'general').trim().toLowerCase();
  const message = (body.message || '').trim();
  const subject = ALLOWED_SUBJECTS.has(subjectRaw) ? subjectRaw : 'general';

  if (!name || name.length > MAX_NAME) {
    return NextResponse.json({ ok: false, error: 'Name is required (under 120 chars).' }, { status: 400 });
  }
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'Valid email is required.' }, { status: 400 });
  }
  if (!message || message.length < 10 || message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { ok: false, error: 'Message must be 10–5000 characters.' },
      { status: 400 },
    );
  }

  // Build the email. Subject line is prefixed with the routing tag so the
  // inbox can be filtered without parsing the body.
  const tag = `[GUNS UP · ${subject.toUpperCase()}]`;
  const emailSubject = `${tag} ${name}`;
  const text = [
    `New contact-form submission from gunnyai.fit`,
    ``,
    `Subject category: ${subject}`,
    `Name:  ${name}`,
    `Email: ${email}`,
    `IP:    ${ip}`,
    `User-Agent: ${req.headers.get('user-agent') || 'unknown'}`,
    `Time:  ${new Date().toISOString()}`,
    ``,
    `── Message ──`,
    message,
  ].join('\n');

  // Plain HTML so the inbox preview is readable. Escape user input — text
  // node escaping handles `< > &` for us, so we just split on \n for <br>.
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
      <div style="background: #030303; color: #00ff41; padding: 16px 20px; font-family: 'Share Tech Mono', monospace; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">
        // Guns Up · Contact Form · ${subject}
      </div>
      <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr><td style="padding: 4px 0; width: 100px; color: #666;">Name</td><td>${escapeHtml(name)}</td></tr>
          <tr><td style="padding: 4px 0; color: #666;">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
          <tr><td style="padding: 4px 0; color: #666;">Subject</td><td>${escapeHtml(subject)}</td></tr>
          <tr><td style="padding: 4px 0; color: #666;">IP</td><td>${escapeHtml(ip)}</td></tr>
          <tr><td style="padding: 4px 0; color: #666;">Time</td><td>${new Date().toISOString()}</td></tr>
        </table>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;" />
        <div style="white-space: pre-wrap; line-height: 1.55; font-size: 14px;">
          ${escapeHtml(message).replace(/\n/g, '<br />')}
        </div>
      </div>
    </div>
  `;

  const result = await sendEmail({
    subject: emailSubject,
    text,
    html,
    replyTo: email, // one-click reply lands back at the visitor
  });

  if (!result.ok) {
    // 502 — upstream (Resend) failed. Don't leak Resend error details to the
    // public form; just say something went wrong and log it server-side.
    return NextResponse.json(
      { ok: false, error: 'Could not send your message. Try again or email us directly.' },
      { status: 502 },
    );
  }

  // `delivered: false` means Resend isn't configured yet — the message was
  // logged server-side but no email went out. The client uses this flag to
  // tell the user the truth ("we got your message, our pipeline is being set
  // up, we'll follow up shortly") instead of falsely promising delivery.
  return NextResponse.json({ ok: true, delivered: result.delivered, id: result.id });
}
