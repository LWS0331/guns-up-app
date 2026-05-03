'use client';

import { useState } from 'react';
import styles from './early-access.module.css';

interface Props {
  commanderAvailable: boolean;
  warfighterAvailable: boolean;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'ok' }
  | { kind: 'err'; msg: string };

export default function EarlyAccessForm({
  commanderAvailable,
  warfighterAvailable,
}: Props) {
  const defaultTier: 'commander' | 'warfighter' = commanderAvailable
    ? 'commander'
    : 'warfighter';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<'commander' | 'warfighter'>(defaultTier);
  const [callsign, setCallsign] = useState('');
  const [note, setNote] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const submitting = status.kind === 'submitting';
  const submitted = status.kind === 'ok';

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || submitted) return;
    setStatus({ kind: 'submitting' });
    try {
      const res = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          tier,
          callsign,
          note,
          _company: honeypot,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus({
          kind: 'err',
          msg:
            data.error ||
            'Reservation failed. Try again or DM "OPS" on Instagram.',
        });
        return;
      }
      setStatus({ kind: 'ok' });
    } catch {
      setStatus({
        kind: 'err',
        msg: 'Network error. Try again or DM "OPS" on Instagram.',
      });
    }
  };

  if (submitted) {
    return (
      <div className={styles.successBox}>
        <div className={styles.successTitle}>// SEAT RESERVED</div>
        <p>
          Got it, <strong>{name || 'operator'}</strong>. I email you within
          24 hours with the Stripe link to lock in your{' '}
          <strong>{tier.toUpperCase()}</strong> seat. Check{' '}
          <strong>{email}</strong> — including spam.
        </p>
        <p className={styles.successSecondary}>
          If you want to fast-track, DM <strong>&ldquo;OPS&rdquo;</strong>{' '}
          to{' '}
          <a
            href="https://instagram.com/gunnyai_fit"
            target="_blank"
            rel="noopener noreferrer"
          >
            @gunnyai_fit
          </a>{' '}
          on Instagram.
        </p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.formHead}>
        <span className={styles.eyebrow}>// RESERVE YOUR SEAT</span>
        <p className={styles.formLede}>
          One-line reservation. I email you back within 24 hours with the
          Stripe link.
        </p>
      </div>

      {/* Honeypot — bots fill this; humans never see it */}
      <input
        type="text"
        name="_company"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
        }}
      />

      <div className={styles.field}>
        <label htmlFor="ea-name" className={styles.label}>
          Name <span className={styles.required}>*</span>
        </label>
        <input
          id="ea-name"
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={styles.input}
          placeholder="Ruben Rodriguez"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="ea-email" className={styles.label}>
          Email <span className={styles.required}>*</span>
        </label>
        <input
          id="ea-email"
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
          placeholder="operator@gunnyai.fit"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          Tier <span className={styles.required}>*</span>
        </label>
        <div className={styles.tierRadio}>
          <label
            className={`${styles.tierRadioOption} ${
              !commanderAvailable ? styles.tierRadioDisabled : ''
            }`}
          >
            <input
              type="radio"
              name="tier"
              value="commander"
              checked={tier === 'commander'}
              onChange={() => setTier('commander')}
              disabled={!commanderAvailable}
            />
            <span className={styles.tierRadioName}>COMMANDER</span>
            <span className={styles.tierRadioPrice}>
              $39.99/mo {!commanderAvailable && '· FILLED'}
            </span>
          </label>
          <label
            className={`${styles.tierRadioOption} ${
              !warfighterAvailable ? styles.tierRadioDisabled : ''
            }`}
          >
            <input
              type="radio"
              name="tier"
              value="warfighter"
              checked={tier === 'warfighter'}
              onChange={() => setTier('warfighter')}
              disabled={!warfighterAvailable}
            />
            <span className={styles.tierRadioName}>WARFIGHTER</span>
            <span className={styles.tierRadioPrice}>
              $149/mo {!warfighterAvailable && '· FILLED'}
            </span>
          </label>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="ea-callsign" className={styles.label}>
          Callsign <span className={styles.optional}>(optional)</span>
        </label>
        <input
          id="ea-callsign"
          type="text"
          maxLength={40}
          value={callsign}
          onChange={(e) => setCallsign(e.target.value)}
          className={styles.input}
          placeholder="GHOST-11"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="ea-note" className={styles.label}>
          One thing about you{' '}
          <span className={styles.optional}>(optional)</span>
        </label>
        <textarea
          id="ea-note"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={styles.textarea}
          placeholder="Goal, sport, injury history, current rep maxes — anything relevant. Helps me onboard you faster."
          rows={3}
        />
      </div>

      {status.kind === 'err' && (
        <div className={styles.errorBox}>{status.msg}</div>
      )}

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={submitting}
      >
        {submitting ? 'RESERVING...' : 'RESERVE MY SEAT →'}
      </button>

      <p className={styles.altCta}>
        Prefer to skip the form? DM <strong>&ldquo;OPS&rdquo;</strong> to{' '}
        <a
          href="https://instagram.com/gunnyai_fit"
          target="_blank"
          rel="noopener noreferrer"
        >
          @gunnyai_fit
        </a>{' '}
        on Instagram.
      </p>
    </form>
  );
}
