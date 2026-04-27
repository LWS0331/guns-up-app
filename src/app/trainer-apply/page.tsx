'use client';

// /trainer-apply — gated trainer application form. Posts to
// /api/trainer-applications which saves to the TrainerApplication table and
// emails a notification to the admin inbox. This is INTENTIONALLY NOT a
// Stripe-checkout flow — trainers are curated, not self-serve. Per spec:
// "I don't want to get spammed. I want to be selective on who I bring on
// as trainers."
//
// Visual styling reuses the contact CSS module so the form reads as a sibling
// surface to /contact rather than a brand-new design.

import React, { useState } from 'react';
import Link from 'next/link';
import styles from '../contact/contact.module.css';

const DISCIPLINE_OPTIONS: { value: string; label: string }[] = [
  { value: 'strength',          label: 'Strength · powerlifting-adjacent' },
  { value: 'hypertrophy',       label: 'Hypertrophy · bodybuilding' },
  { value: 'tactical',          label: 'Tactical · military / first responder' },
  { value: 'sport_performance', label: 'Sport performance · athlete S&C' },
  { value: 'crossfit',          label: 'CrossFit · functional fitness' },
  { value: 'powerlifting',      label: 'Powerlifting · competitive S/B/D' },
  { value: 'olympic_lifting',   label: 'Olympic lifting · snatch / C&J' },
  { value: 'general_fitness',   label: 'General fitness · all-comers' },
  { value: 'rehab',             label: 'Rehab / corrective exercise' },
  { value: 'other',             label: 'Other (describe in "Why GUNS UP")' },
];

const TEXT_MIN = 30;
const TEXT_MAX = 5000;
const TEXT_WARN_AT = 4500;

export default function TrainerApplyPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [callsign, setCallsign] = useState('');
  const [yearsCertified, setYearsCertified] = useState<string>('');
  const [currentClientCount, setCurrentClientCount] = useState<string>('');
  const [primaryDiscipline, setPrimaryDiscipline] = useState<string>('');
  const [certificationsRaw, setCertificationsRaw] = useState<string>('');
  const [whyGunsUp, setWhyGunsUp] = useState('');
  const [sampleProgramming, setSampleProgramming] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const whyCount = whyGunsUp.length;
  const sampleCount = sampleProgramming.length;
  const whyClass = whyCount > TEXT_WARN_AT ? `${styles.charCount} ${styles.charCountWarn}` : styles.charCount;
  const sampleClass = sampleCount > TEXT_WARN_AT ? `${styles.charCount} ${styles.charCountWarn}` : styles.charCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setStatus(null);

    // Comma-separated certification input — split + dedupe, server re-validates
    // length caps so we don't have to be paranoid here.
    const certifications = certificationsRaw
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    try {
      const res = await fetch('/api/trainer-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          callsign: callsign || undefined,
          yearsCertified: yearsCertified === '' ? undefined : Number(yearsCertified),
          currentClientCount: currentClientCount === '' ? undefined : Number(currentClientCount),
          primaryDiscipline,
          certifications,
          whyGunsUp,
          sampleProgramming,
          _company: honeypot,
        }),
      });

      if (res.ok) {
        setStatus({
          kind: 'ok',
          text: 'Application received. We review applications weekly. You\'ll hear from us within 7 days — no spam, no auto-acceptance.',
        });
        setName('');
        setEmail('');
        setCallsign('');
        setYearsCertified('');
        setCurrentClientCount('');
        setPrimaryDiscipline('');
        setCertificationsRaw('');
        setWhyGunsUp('');
        setSampleProgramming('');
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
        <span className={styles.eyebrow}>// Trainer Application</span>
        <h1 className={styles.h1}>
          Apply to coach <em>on Gunny</em>.
        </h1>
        <p className={styles.lede}>
          We&rsquo;re selective. Applications are reviewed weekly, manually, by Ruben.
          No auto-acceptance, no Stripe link from this page. If you&rsquo;re a real coach with
          a roster and a point of view, we want to hear from you. If you&rsquo;re here to spam,
          this funnel ends in a database row that gets deleted.
        </p>

        <form className={styles.card} onSubmit={handleSubmit} noValidate>
          <span className="bl" /><span className="br" />

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ta-name">Name</label>
              <input
                id="ta-name"
                className={styles.input}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
                autoComplete="name"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ta-email">Email</label>
              <input
                id="ta-email"
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ta-callsign">Callsign <span style={{ opacity: 0.6 }}>(optional)</span></label>
              <input
                id="ta-callsign"
                className={styles.input}
                type="text"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                maxLength={32}
                placeholder="e.g. STRYKER"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ta-discipline">Primary discipline</label>
              <select
                id="ta-discipline"
                className={styles.select}
                value={primaryDiscipline}
                onChange={(e) => setPrimaryDiscipline(e.target.value)}
                required
              >
                <option value="">Pick one…</option>
                {DISCIPLINE_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ta-years">Years certified</label>
              <input
                id="ta-years"
                className={styles.input}
                type="number"
                min={0}
                max={60}
                step={1}
                value={yearsCertified}
                onChange={(e) => setYearsCertified(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ta-clients">Current paying clients</label>
              <input
                id="ta-clients"
                className={styles.input}
                type="number"
                min={0}
                max={5000}
                step={1}
                value={currentClientCount}
                onChange={(e) => setCurrentClientCount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="ta-certs">Certifications <span style={{ opacity: 0.6 }}>(comma-separated)</span></label>
            <input
              id="ta-certs"
              className={styles.input}
              type="text"
              value={certificationsRaw}
              onChange={(e) => setCertificationsRaw(e.target.value)}
              placeholder="NSCA-CSCS, NASM-CPT, PN-1"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="ta-why">Why GUNS UP?</label>
            <textarea
              id="ta-why"
              className={styles.textarea}
              value={whyGunsUp}
              onChange={(e) => setWhyGunsUp(e.target.value)}
              minLength={TEXT_MIN}
              maxLength={TEXT_MAX}
              required
              rows={6}
              placeholder="What about Gunny + the operator framing fits how you already coach? What would your clients gain that they can't get from your current setup?"
            />
            <div className={whyClass}>{whyCount} / {TEXT_MAX}</div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="ta-sample">Sample programming</label>
            <textarea
              id="ta-sample"
              className={styles.textarea}
              value={sampleProgramming}
              onChange={(e) => setSampleProgramming(e.target.value)}
              minLength={TEXT_MIN}
              maxLength={TEXT_MAX}
              required
              rows={8}
              placeholder="Walk us through one week of programming you've actually run with a client this year. Sets, reps, intent, who it was for. Show your craft."
            />
            <div className={sampleClass}>{sampleCount} / {TEXT_MAX}</div>
          </div>

          {/* Honeypot — visually hidden, autocomplete off, real users skip it. */}
          <div className={styles.honeypot} aria-hidden>
            <label htmlFor="ta-company">Company</label>
            <input
              id="ta-company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.submit} type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Application →'}
            </button>
          </div>

          {status && (
            <div
              className={`${styles.status} ${status.kind === 'ok' ? styles.statusOk : styles.statusErr}`}
              role={status.kind === 'err' ? 'alert' : 'status'}
            >
              {status.text}
            </div>
          )}

          <div className={styles.altContact}>
            Existing trainer? <Link href="/login">Log in</Link>. Looking to train ON the platform as a client? <Link href="/landing#tiers">Pick a tier</Link>.
          </div>
        </form>
      </main>
    </div>
  );
}
