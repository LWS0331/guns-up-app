// Server-side email helper.
//
// Uses Resend's HTTP API directly (https://resend.com/docs/api-reference/emails/send-email)
// — no `resend` npm package is needed, which keeps the dependency tree
// unchanged. (The Resend dashboard "Quick Start" snippet uses the official
// SDK; this is the fetch equivalent. Same wire format, fewer dependencies.)
// Free tier covers 100 emails/day, 3,000/month — plenty for landing-page
// contact submissions in beta.
//
// Configuration — set these as RAILWAY ENV VARS (never commit the API key):
//
//   RESEND_API_KEY       — required for delivery. Get one at resend.com →
//                          API Keys → Create. If unset the helper logs the
//                          submission server-side under [CONTACT_QUEUED]
//                          (see route handler) and returns ok:true so the
//                          contact form still works during setup.
//
//   CONTACT_FROM_EMAIL   — "From" header. Defaults to Resend's public
//                          onboarding sender ([email protected]) which
//                          works without domain verification — fine for
//                          immediate testing. Once gunnyai.fit is verified
//                          in the Resend dashboard, override this to
//                          something like 'GUNS UP <noreply@gunnyai.fit>'
//                          so the From line matches the brand.
//
//   CONTACT_TO_EMAIL     — destination inbox. Falls back to the founder's
//                          [email protected] address so submissions
//                          land somewhere even before Railway env is set.
//                          Override per-deployment if you need to route
//                          submissions to a shared inbox.

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
    // The submission isn't silently swallowed — it's logged with enough detail
    // to recover manually if needed.
    console.warn('[sendEmail] RESEND_API_KEY not set — would have sent:', {
      to,
      from,
      subject: input.subject,
      replyTo: input.replyTo,
      preview: input.text.slice(0, 400),
    });
    return { ok: true, id: 'noop' };
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
      return { ok: false, error: `resend_${res.status}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error('[sendEmail] network/parse error:', err);
    return { ok: false, error: 'network_error' };
  }
}
