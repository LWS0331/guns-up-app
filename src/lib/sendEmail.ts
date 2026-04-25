// Server-side email helper.
//
// Uses Resend's HTTP API directly (https://resend.com/docs/api-reference/emails/send-email)
// — no `resend` npm package is needed, which keeps the dependency tree
// unchanged. The free tier (100 emails/day, 3,000/month) is plenty for
// landing-page contact submissions in beta.
//
// Configuration (set on Railway):
//   RESEND_API_KEY       — required for delivery. If unset the helper
//                          logs the email server-side and returns ok:true
//                          so the contact form still works during setup.
//   CONTACT_FROM_EMAIL   — verified-domain "From" address. Defaults to
//                          a Resend placeholder; replace once a domain is
//                          verified in the Resend dashboard.
//   CONTACT_TO_EMAIL     — destination inbox for landing-page contact
//                          submissions. Falls back to a hard-coded address
//                          so submissions never silently disappear.

const DEFAULT_FROM = 'GUNS UP <[email protected]>';
const DEFAULT_TO = '[email protected]';

export interface SendEmailInput {
  to?: string;          // override CONTACT_TO_EMAIL
  subject: string;
  html: string;
  text: string;
  /** Set this to the visitor's email so a one-click reply hits them, not Resend. */
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** True when an email was actually handed to Resend; false when we no-op'd
   *  because RESEND_API_KEY isn't configured. Callers use this to distinguish
   *  "queued for manual follow-up" from "actually delivered" and tell the
   *  user the truth. */
  delivered: boolean;
  /** Resend message id when delivery succeeded; "noop" when no API key was set. */
  id?: string;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = input.to || process.env.CONTACT_TO_EMAIL || DEFAULT_TO;
  const from = process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM;

  if (!apiKey) {
    // No-op fallback so the contact form is shippable before Resend is set up.
    // The submission isn't silently swallowed — it's logged with a grep-able
    // prefix + the FULL message body so the founder can recover any
    // submission from Railway logs and reply manually until Resend is wired.
    //
    // The console output is deliberately one big block so it's obvious in
    // a log stream. Searching Railway for [CONTACT_QUEUED] surfaces every
    // pre-Resend submission.
    console.warn(
      '\n========== [CONTACT_QUEUED] RESEND_API_KEY not set — submission logged only ==========\n' +
      `To:        ${to}\n` +
      `From:      ${from}\n` +
      `ReplyTo:   ${input.replyTo || '(none)'}\n` +
      `Subject:   ${input.subject}\n` +
      `--- body (text) ---\n${input.text}\n` +
      '======================================================================================\n'
    );
    return { ok: true, delivered: false, id: 'noop' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        // Resend uses snake_case here while everything else is camelCase.
        reply_to: input.replyTo,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[sendEmail] Resend rejected:', res.status, detail.slice(0, 300));
      return { ok: false, delivered: false, error: `resend_${res.status}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, delivered: true, id: data?.id };
  } catch (err) {
    console.error('[sendEmail] network/parse error:', err);
    return { ok: false, delivered: false, error: 'network_error' };
  }
}
