'use client';

// /auth/magic — magic-link consume page.
//
// Lands here from URLs like /auth/magic?token=mlk_xxxxx.yyyy. Posts
// the token to /api/auth/magic-link, gets a session JWT back, stashes
// it in localStorage to match the email/Google login shape, and
// bounces to "/" so the user is signed in.
//
// Two surfaces produce these URLs:
//   - /api/admin/operator-magic-link  (admin OPS button — unblocks
//     locked-out users without admin running curl)
//   - /api/auth/magic-link  (public SEND path — once email provider
//     is wired and the activation cron mails the URL)
//
// Mirrors /auth/oauth-callback in shape — bare status text, no nav,
// 200ms transit.

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Status =
  | { kind: 'pending' }
  | { kind: 'error'; message: string };

function MagicInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>({ kind: 'pending' });

  useEffect(() => {
    const token = params?.get('token');
    if (!token) {
      setStatus({ kind: 'error', message: 'Missing token in link.' });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data?.ok || !data?.sessionToken) {
          setStatus({
            kind: 'error',
            message: data?.error || 'Could not sign you in with this link.',
          });
          return;
        }
        try {
          localStorage.setItem('authToken', data.sessionToken);
        } catch {
          // localStorage unavailable (private mode) — continue anyway;
          // the cookie set by the server-side flow won't help here
          // because magic-link consume doesn't issue a cookie. User
          // will land at "/" and may need to sign in again — better
          // than being stranded on this page.
        }
        // Strip ?token=... from history so it can't be replayed by
        // forward/back navigation.
        router.replace('/');
      } catch (err) {
        if (cancelled) return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Network error.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#030303',
        color: '#00ff41',
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 13,
        letterSpacing: 1,
        padding: 24,
        textAlign: 'center',
      }}
    >
      {status.kind === 'pending' ? (
        <span>SIGNING YOU IN…</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ color: '#ff4444' }}>{status.message}</span>
          <a
            href="/login"
            style={{
              color: '#00ff41',
              textDecoration: 'underline',
              fontSize: 12,
            }}
          >
            BACK TO LOGIN
          </a>
        </div>
      )}
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#030303',
            color: '#00ff41',
            fontFamily: '"Share Tech Mono", monospace',
          }}
        >
          LOADING…
        </div>
      }
    >
      <MagicInner />
    </Suspense>
  );
}
