'use client';

// /contact — landing-page contact form. Posts to /api/contact which
// emails the submission to CONTACT_TO_EMAIL via Resend (or logs it
// server-side if RESEND_API_KEY isn't configured yet — see lib/sendEmail.ts).
//
// CTAs that route here:
//   /contact             — generic
//   /contact?subject=brief    — hero "REQUEST BRIEF"
//   /contact?subject=trainer  — trainer apply / one-pager downloads
//   /contact?subject=beta     — beta program signup
//   /contact?subject=press    — press inquiries
//
// The component is a client component because the form needs local state
// for input values + submission status. Wrapped in <Suspense> in page.tsx
// because useSearchParams suspends during static prerender.

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from './contact.module.css';

const SUBJECT_OPTIONS = [
  { value: 'general',  label: 'General · question or feedback' },
  { value: 'brief',    label: 'Request a brief · how it works' },
  { value: 'trainer',  label: 'Trainer · revenue-share program' },
  { value: 'beta',     label: 'Beta · early access' },
  { value: 'support',  label: 'Support · already a member' },
  { value: 'press',    label: 'Press · interview / quote' },
];

const MESSAGE_MAX = 5000;
const MESSAGE_WARN_AT = 4500;

function ContactInner() {
  const params = useSearchParams();
  const initialSubject = useMemo(() => {
    const q = (params?.get('subject') || '').toLowerCase();
    return SUBJECT_OPTIONS.some((o) => o.value === q) ? q : 'general';
  }, [params]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState(''); // bots fill this
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // If the user lands at /contact?subject=brief and then changes the dropdown,
  // we keep their pick. The query-string default only applies on first mount.
  useEffect(() => {
    setSubject(initialSubject);
  }, [initialSubject]);

  const charCount = message.length;
  const charCountClass =
    charCount > MESSAGE_WARN_AT ? `${styles.charCount} ${styles.charCountWarn}` : styles.charCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          // Forward the honeypot value so the server can also catch it.
          // This is intentionally a real field name so bots fill it.
          _company: honeypot,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.id === 'honeypot') {
          // Server caught a bot — pretend it worked, because our humans
          // never see this branch (their honeypot is always empty).
          setStatus({ kind: 'ok', text: 'Message received. Stand by — we\'ll be in touch.' });
        } else {
          setStatus({ kind: 'ok', text: 'Message received. Stand by — we\'ll be in touch.' });
          setName('');
          setEmail('');
          setMessage('');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus({ kind: 'err', text: data?.error || 'Something went wrong. Try again in a minute.' });
      }
    } catch {
      setStatus({ kind: 'err', text: 'Network error. Check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.scanlines} aria-hidden />

      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.brand}>
            <img src="/logo-glow.png" alt="" />
            <span>GUNS UP</span>
          </Link>
          <Link href="/" className={styles.backLink}>← Back to brief</Link>
        </div>
      </nav>

      <main className={styles.wrap}>
        <span className={styles.eyebrow}>// Contact</span>
        <h1 className={styles.h1}>
          Send us a <em>signal</em>.
        </h1>
        <p className={styles.lede}>
          Questions about the platform, the trainer revenue share, beta access, or press?
          Drop a message and we&apos;ll route it to the right operator.
        </p>

        <form className={styles.card} onSubmit={handleSubmit} noValidate>
          <span className="bl" /><span className="br" />

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="contact-name">Name</label>
              <input
                id="contact-name"
                className={styles.input}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Operator name"
                required
                maxLength={120}
                autoComplete="name"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="contact-email">Email</label>
              <input
                id="contact-email"
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                maxLength={254}
                autoComplete="email"
                inputMode="email"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="contact-subject">Subject</label>
            <select
              id="contact-subject"
              className={styles.select}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              {SUBJECT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              className={styles.textarea}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
              placeholder="Tell us what you need. We read every one."
              required
              minLength={10}
              maxLength={MESSAGE_MAX}
            />
          </div>

          {/* Honeypot — visually + a11y hidden, but bots scraping the markup
              will fill it. Server side (route.ts) drops any submission where
              this is non-empty. Tab-index and aria are intentional so real
              users never reach it. */}
          <div className={styles.honeypot} aria-hidden>
            <label>
              Company
              <input
                type="text"
                name="_company"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </label>
          </div>

          <div className={styles.actions}>
            <span className={charCountClass}>
              {charCount} / {MESSAGE_MAX}
            </span>
            <button
              type="submit"
              className={styles.submit}
              disabled={submitting}
              aria-busy={submitting || undefined}
            >
              {submitting ? 'TRANSMITTING…' : 'SEND MESSAGE →'}
            </button>
          </div>

          {status && (
            <div
              className={`${styles.status} ${status.kind === 'ok' ? styles.statusOk : styles.statusErr}`}
              role="status"
              aria-live="polite"
            >
              {status.text}
            </div>
          )}
        </form>

        <p className={styles.altContact}>
          Form goes straight to the founder. Average reply window: 24h.
        </p>
      </main>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#030303' }} />}>
      <ContactInner />
    </Suspense>
  );
}
