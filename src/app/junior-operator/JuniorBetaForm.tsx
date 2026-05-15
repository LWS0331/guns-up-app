'use client';

// JuniorBetaForm — client-side beta-list signup form for the Junior
// Operator landing page. Lives in its own client component so the
// rest of the page stays a server component (faster TTFB, smaller
// JS bundle on the marketing route).
//
// State: a single role segmented control + email + name + a
// role-conditional "lifter experience" field. Posts to
// /api/junior-beta which writes to a closed-beta lead table (or
// for now: console.log on the server; we'll wire a real provider
// when revenue is in flight — see the OpsCenter Marketing tab
// banner for the same deferral pattern).
//
// Analytics: emits junior_beta_form_start on first focus and
// junior_beta_form_submit on success. Both events go through the
// existing PostHog wrapper at @/lib/analytics; failure to load
// PostHog is silent (best-effort, won't block submission).

import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import styles from './junior-operator.module.css';

type Role = 'parent' | 'coach' | 'athlete' | 'lifter';

const ROLES: { id: Role; ico: string; label: string }[] = [
  { id: 'parent',  ico: '// 01', label: 'Parent' },
  { id: 'coach',   ico: '// 02', label: 'Coach' },
  { id: 'athlete', ico: '// 03', label: 'Athlete' },
  { id: 'lifter',  ico: '// 04', label: 'Lifter' },
];

function track(event: string, props?: Record<string, unknown>) {
  try {
    trackEvent(event, props);
  } catch {
    /* analytics is best-effort */
  }
}

export default function JuniorBetaForm() {
  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [lifter, setLifter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [touchedStart, setTouchedStart] = useState(false);

  const onFirstFocus = () => {
    if (!touchedStart) {
      track('junior_beta_form_start');
      setTouchedStart(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!role) {
      setError('Pick a role to continue.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!name.trim()) {
      setError('Tell us your name.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/junior-beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          email: email.trim().toLowerCase(),
          name: name.trim(),
          lifterExperience: role === 'lifter' ? lifter.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Submission failed.');
      }
      track('junior_beta_form_submit', { role });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className={`${styles.formCard} ${styles.brackets}`}>
        <div className={styles.headLine}>
          <div className={styles.head}>JUNIOR OPERATOR · WAVE 01</div>
          <div className={styles.headStatus}>RECEIVED</div>
        </div>
        <div className={styles.formSuccess}>
          <div className={styles.ok}>YOU&rsquo;RE IN.</div>
          <div className={styles.next}>
            // CHECK YOUR EMAIL · ALSO DM <b>@gunnyai_fit</b> &ldquo;EARLY ACCESS&rdquo; FOR FAST-LANE
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.formCard} ${styles.brackets}`}>
      <div className={styles.headLine}>
        <div className={styles.head}>JUNIOR OPERATOR · WAVE 01</div>
        <div className={styles.headStatus}>ENROLLING</div>
      </div>

      <form onSubmit={handleSubmit} autoComplete="on" noValidate onFocus={onFirstFocus}>
        <div className={styles.field}>
          <label htmlFor="jo-email">Email</label>
          <input
            id="jo-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@domain.com"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="jo-name">Name</label>
          <input
            id="jo-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="First last"
          />
        </div>

        <div className={styles.field}>
          {/* Role segmented control. Values match the discriminator
              the API stores on the lead row. Drives a conditional
              "lifter experience" follow-up field so we can prioritize
              wave-01 invites for serious lifters first. */}
          <label>Role</label>
          <div className={styles.roleGrid}>
            {ROLES.map((r) => (
              <label
                key={r.id}
                className={`${styles.roleOpt} ${role === r.id ? styles.roleOptActive : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.id}
                  checked={role === r.id}
                  onChange={() => setRole(r.id)}
                />
                <div className={styles.ico}>{r.ico}</div>
                <div className={styles.nm}>{r.label}</div>
              </label>
            ))}
          </div>
        </div>

        {role === 'lifter' && (
          <div className={styles.field}>
            <label htmlFor="jo-lifter">Lifting experience</label>
            <input
              id="jo-lifter"
              type="text"
              value={lifter}
              onChange={(e) => setLifter(e.target.value)}
              placeholder="e.g. 2 years · novice · serious"
            />
          </div>
        )}

        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? 'TRANSMITTING…' : 'DEPLOY ME · BETA WAVE 01 →'}
        </button>
        <div className={styles.submitFoot}>
          // no spam · we onboard in waves · email <b>once a wave</b>
        </div>
        {error && <div className={styles.formError}>{error}</div>}
      </form>
    </div>
  );
}
