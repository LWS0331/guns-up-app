'use client';

import React, { useState, useEffect } from 'react';
import LogoFull from '@/components/LogoFull';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/lib/i18n';
import { Operator } from '@/lib/types';
import { TermsOfService, PrivacyPolicy } from '@/components/LegalPages';

interface LoginScreenProps {
  onLogin: (operator: Operator) => void;
  operators: Operator[];
}

// PIN login is being phased out — Google OAuth is the primary path,
// email/password is the legacy fallback for accounts that pre-date the
// SSO migration. The /api/auth/login endpoint still accepts PINs as a
// server-side backstop, but the UI no longer surfaces a PIN entry.
type LoginMode = 'email' | 'register';

// Floating particle for background
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  delay: number;
}

export default function LoginScreen({ onLogin, operators }: LoginScreenProps) {
  const { t } = useLanguage();
  const [loginMode, setLoginMode] = useState<LoginMode>('email');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [callsign, setCallsign] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [matchedOperator, setMatchedOperator] = useState<Operator | null>(null);
  const [showRegistrationClosedModal, setShowRegistrationClosedModal] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  const [showTOS, setShowTOS] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 20 + 15,
      opacity: Math.random() * 0.4 + 0.1,
      delay: Math.random() * 10,
    }))
  );
  // PIN-related refs and handlers were removed when the PIN UI was retired.
  // The /api/auth/login endpoint still accepts PINs server-side as a backstop
  // for any account that hasn't been migrated to email yet — there's just no
  // longer a UI for entering one.

  useEffect(() => {
    setMounted(true);
  }, []);

  // Container click used to focus a hidden PIN input — now a no-op so the
  // background tap doesn't accidentally trigger anything. Kept on the
  // wrapper so the "cursor: pointer" styling still feels intentional.
  const handleContainerClick = () => {
    /* intentionally empty — see comment above */
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('authToken', data.token);
        setSuccess(true);
        setMatchedOperator(data.operator);
        setTimeout(() => {
          onLogin(data.operator);
        }, 1400);
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, callsign }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('authToken', data.token);
        setSuccess(true);
        setMatchedOperator(data.operator);
        setTimeout(() => {
          onLogin(data.operator);
        }, 1400);
      } else {
        const data = await res.json();
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      backgroundColor: '#030303',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
      cursor: 'pointer',
    }} onClick={handleContainerClick}>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes matrixDrop {
          0% { transform: translateY(-100vh); opacity: 0.6; }
          90% { opacity: 0.2; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes gridFade {
          0%, 100% { opacity: 0.03; }
          50% { opacity: 0.06; }
        }
        @keyframes logoGlow {
          0%, 100% { filter: brightness(1) drop-shadow(0 0 8px rgba(0,255,65,0.3)); }
          50% { filter: brightness(1.15) drop-shadow(0 0 20px rgba(0,255,65,0.5)); }
        }
        @keyframes pinBoxIdle {
          0%, 100% { border-color: rgba(0,255,65,0.15); }
          50% { border-color: rgba(0,255,65,0.3); }
        }
        @keyframes operatorSlideIn {
          0% { opacity: 0; transform: translateY(20px) scale(0.9); filter: blur(8px); }
          50% { opacity: 1; filter: blur(2px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes callsignGlow {
          0% { text-shadow: 0 0 4px rgba(0,255,65,0.3); }
          50% { text-shadow: 0 0 20px rgba(0,255,65,0.8), 0 0 40px rgba(0,255,65,0.4); }
          100% { text-shadow: 0 0 4px rgba(0,255,65,0.3); }
        }
        @keyframes successFlash {
          0% { background: rgba(0,255,65,0); }
          50% { background: rgba(0,255,65,0.03); }
          100% { background: rgba(0,255,65,0); }
        }
        @keyframes accessTextPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>

      {/* Ambient grid background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'linear-gradient(rgba(0,255,65,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.025) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        animation: 'gridFade 8s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Floating particles */}
      {particles.map((p) => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`,
          top: `${p.y}%`,
          width: `${p.size}px`,
          height: `${p.size}px`,
          borderRadius: '50%',
          backgroundColor: '#00ff41',
          opacity: p.opacity,
          animation: `float ${p.speed}s ease-in-out infinite`,
          animationDelay: `${p.delay}s`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Matrix rain columns */}
      {[10, 25, 40, 55, 70, 85].map((x, i) => (
        <div key={`rain-${i}`} style={{
          position: 'absolute',
          left: `${x}%`,
          top: 0,
          width: '1px',
          height: '80px',
          background: 'linear-gradient(180deg, transparent, rgba(0,255,65,0.15), transparent)',
          animation: `matrixDrop ${12 + i * 3}s linear infinite`,
          animationDelay: `${i * 2}s`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Horizontal scan line */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(0,255,65,0.08), transparent)',
        animation: 'matrixDrop 6s linear infinite',
        pointerEvents: 'none',
      }} />

      {/* Hidden PIN input removed — see LoginMode comment at top of file. */}

      {/* Language Toggle (top-right) */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 50,
      }}>
        <LanguageToggle compact={true} />
      </div>

      {/* Main content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        position: 'relative',
        zIndex: 10,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}>

        {/* Logo with glow animation */}
        <div style={{
          animation: mounted ? 'logoGlow 4s ease-in-out infinite' : 'none',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'scale(1)' : 'scale(0.8)',
          transition: 'opacity 0.8s ease, transform 0.8s ease',
        }}>
          <LogoFull size={80} />
        </div>

        {/* Subtitle */}
        <div style={{
          fontFamily: 'Orbitron, monospace',
          fontSize: '15px',
          letterSpacing: '4px',
          color: '#777',
          textTransform: 'uppercase',
          textAlign: 'center',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s',
        }}>
          Tactical Workout Command Center
        </div>

        {/* Scanline divider */}
        <div style={{
          width: '240px',
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(0,255,65,0.5), transparent)',
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.6s ease 0.5s',
        }} />

        {/* Continue with Google — primary auth path. PIN/email tabs below
            stay as fallbacks for legacy operators until the SSO migration
            backfills emails (see Phase 3 in the auth plan). The button
            window.location's to the OAuth start endpoint, which sets a
            CSRF cookie and redirects to Google's consent screen. */}
        {!success && (
          <button
            onClick={() => {
              // Pass through tier/cycle params if we landed here via a
              // landing-page tier card so checkout resumes after auth.
              const url = new URL(window.location.href);
              const tier = url.searchParams.get('tier');
              const cycle = url.searchParams.get('cycle');
              const next = url.searchParams.get('next');
              const start = new URL('/api/auth/google/start', window.location.origin);
              if (tier) start.searchParams.set('tier', tier);
              if (cycle) start.searchParams.set('cycle', cycle);
              if (next) start.searchParams.set('next', next);
              window.location.href = start.toString();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '14px 24px',
              backgroundColor: '#fff',
              color: '#1f1f1f',
              border: 'none',
              borderRadius: 4,
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: '0 0 0 1px rgba(0,255,65,0.35), 0 0 18px rgba(0,255,65,0.2)',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.6s ease 0.4s, transform 0.6s ease 0.4s',
            }}
            aria-label={t('login.continue_google')}
          >
            {/* Google "G" logo as inline SVG so we don't pull a brand asset
                into the build. Colors per Google Identity guidelines. */}
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            <span>{t('login.continue_google')}</span>
          </button>
        )}

        {/* `?oauth_error=…` query param: surfaced when the OAuth callback
            rejects the round-trip (state mismatch, email_not_verified,
            not_authorized, etc.). Translate the raw reason into a user-
            facing message so we don't leak machine codes. */}
        {(() => {
          if (success) return null;
          if (typeof window === 'undefined') return null;
          const reason = new URLSearchParams(window.location.search).get('oauth_error');
          if (!reason) return null;
          const friendly =
            reason === 'not_authorized'
              ? 'This account is not yet active for the closed beta. Contact Ruben to request access.'
              : reason === 'email_not_verified'
                ? 'Your Google account email isn’t verified. Verify it with Google and try again.'
                : reason === 'state_mismatch'
                  ? 'Sign-in session expired. Try again from the login button below.'
                  : reason === 'not_configured'
                    ? 'Google sign-in is not configured on this server. Contact Ruben — likely missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / NEXT_PUBLIC_APP_URL env vars.'
                    : reason === 'token_exchange_failed'
                      ? 'Google authentication failed at the token exchange step. Likely a redirect URI mismatch in Google Cloud Console — should be exactly $APP_URL/api/auth/google/callback. Contact Ruben.'
                      : `Google sign-in failed (${reason}). Try again or use email/password below.`;
          return (
            <div
              style={{
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 11,
                color: '#ff4444',
                padding: '8px 12px',
                border: '1px solid rgba(255,68,68,0.35)',
                borderRadius: 4,
                maxWidth: 360,
                textAlign: 'center',
              }}
              role="alert"
            >
              {friendly}
            </div>
          );
        })()}

        {/* Mode Selector Tabs — Login + Register (PIN UI was retired) */}
        {!success && (
          <div style={{
            display: 'flex',
            gap: '16px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.6s ease 0.5s, transform 0.6s ease 0.5s',
          }}>
            <button
              onClick={() => {
                setLoginMode('email');
                setError('');
                setEmail('');
                setPassword('');
              }}
              style={{
                fontFamily: 'Orbitron, monospace',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                padding: '8px 16px',
                border: `1px solid ${loginMode === 'email' ? '#00ff41' : 'rgba(0,255,65,0.2)'}`,
                backgroundColor: loginMode === 'email' ? 'rgba(0,255,65,0.1)' : 'transparent',
                color: loginMode === 'email' ? '#00ff41' : '#666',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              EMAIL LOGIN
            </button>
          </div>
        )}

        {/* PIN Section */}
        {/* PIN UI removed — see LoginMode comment at top of file. The
            entire PIN entry block (digit boxes + auto-submit on 4th digit)
            was deleted as part of the SSO migration. /api/auth/login still
            accepts a PIN payload server-side as a backstop in case any
            client-side caller is still POSTing one. */}
        {!success && loginMode === 'email' ? (
          <form onSubmit={handleEmailLogin} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.6s ease 0.6s, transform 0.6s ease 0.6s',
            width: '100%',
            maxWidth: '300px',
          }}>
            {/* Email input */}
            <input
              type="email"
              placeholder={t('login.email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: '14px',
                padding: '12px 16px',
                backgroundColor: 'rgba(0,255,65,0.02)',
                border: '1px solid rgba(0,255,65,0.2)',
                color: '#00ff41',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />

            {/* Password input */}
            <input
              type="password"
              placeholder={t('login.password_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: '14px',
                padding: '12px 16px',
                backgroundColor: 'rgba(0,255,65,0.02)',
                border: '1px solid rgba(0,255,65,0.2)',
                color: '#00ff41',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />

            {/* Error message */}
            {error && (
              <div style={{
                fontFamily: 'Orbitron, monospace',
                fontSize: '12px',
                color: '#ff4444',
                textAlign: 'center',
                textShadow: '0 0 8px rgba(255,68,68,0.4)',
              }}>
                {error}
              </div>
            )}

            {/* Login button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                fontFamily: 'Orbitron, monospace',
                fontSize: '13px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                padding: '12px 32px',
                backgroundColor: isLoading ? 'rgba(0,255,65,0.2)' : 'rgba(0,255,65,0.1)',
                border: '1px solid #00ff41',
                color: '#00ff41',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {isLoading ? 'LOGGING IN...' : 'LOGIN'}
            </button>

            {/* Register link — closed beta. Public registration starts
                June 2026. Until then, clicking the button surfaces an
                explainer popup instead of switching to the register form. */}
            <div style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: '11px',
              color: '#666',
            }}>
              New operator?{' '}
              <button
                type="button"
                onClick={() => setShowRegistrationClosedModal(true)}
                style={{
                  fontFamily: 'Orbitron, monospace',
                  fontSize: '11px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#00ff41',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                REGISTER
              </button>
            </div>
          </form>
        ) : !success && loginMode === 'register' ? (
          <form onSubmit={handleRegister} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.6s ease 0.6s, transform 0.6s ease 0.6s',
            width: '100%',
            maxWidth: '300px',
          }}>
            {/* Name input */}
            <input
              type="text"
              placeholder={t('login.fullname_placeholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: '14px',
                padding: '12px 16px',
                backgroundColor: 'rgba(0,255,65,0.02)',
                border: '1px solid rgba(0,255,65,0.2)',
                color: '#00ff41',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />

            {/* Callsign input */}
            <input
              type="text"
              placeholder={t('login.callsign_placeholder')}
              value={callsign}
              onChange={(e) => setCallsign(e.target.value.toUpperCase())}
              style={{
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: '14px',
                padding: '12px 16px',
                backgroundColor: 'rgba(0,255,65,0.02)',
                border: '1px solid rgba(0,255,65,0.2)',
                color: '#00ff41',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />

            {/* Email input */}
            <input
              type="email"
              placeholder={t('login.email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: '14px',
                padding: '12px 16px',
                backgroundColor: 'rgba(0,255,65,0.02)',
                border: '1px solid rgba(0,255,65,0.2)',
                color: '#00ff41',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />

            {/* Password input */}
            <input
              type="password"
              placeholder={t('login.password_min_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: '14px',
                padding: '12px 16px',
                backgroundColor: 'rgba(0,255,65,0.02)',
                border: '1px solid rgba(0,255,65,0.2)',
                color: '#00ff41',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />

            {/* Error message */}
            {error && (
              <div style={{
                fontFamily: 'Orbitron, monospace',
                fontSize: '12px',
                color: '#ff4444',
                textAlign: 'center',
                textShadow: '0 0 8px rgba(255,68,68,0.4)',
              }}>
                {error}
              </div>
            )}

            {/* Register button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                fontFamily: 'Orbitron, monospace',
                fontSize: '13px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                padding: '12px 32px',
                backgroundColor: isLoading ? 'rgba(0,255,65,0.2)' : 'rgba(0,255,65,0.1)',
                border: '1px solid #00ff41',
                color: '#00ff41',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {isLoading ? 'REGISTERING...' : 'REGISTER'}
            </button>

            {/* Login link */}
            <div style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: '11px',
              color: '#666',
            }}>
              Already have access?{' '}
              <button
                type="button"
                onClick={() => {
                  setLoginMode('email');
                  setError('');
                  setEmail('');
                  setPassword('');
                }}
                style={{
                  fontFamily: 'Orbitron, monospace',
                  fontSize: '11px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#00ff41',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                LOGIN
              </button>
            </div>
          </form>
        ) : (
          /* Success - Operator reveal */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            animation: 'operatorSlideIn 0.8s ease-out forwards',
          }}>
            {/* Callsign */}
            <div style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: '30px',
              fontWeight: 900,
              color: '#00ff41',
              letterSpacing: '6px',
              textTransform: 'uppercase',
              animation: 'callsignGlow 1.5s ease-in-out infinite',
            }}>
              {matchedOperator?.callsign}
            </div>

            {/* Real name */}
            <div style={{
              fontFamily: 'Chakra Petch, sans-serif',
              fontSize: '15px',
              color: '#aaa',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              opacity: 0,
              animation: 'operatorSlideIn 0.6s ease-out 0.3s forwards',
            }}>
              {matchedOperator?.name}
            </div>

            {/* Status bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: 0,
              animation: 'operatorSlideIn 0.6s ease-out 0.5s forwards',
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#00ff41',
                boxShadow: '0 0 8px rgba(0,255,65,0.6)',
              }} />
              <div style={{
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: '15px',
                color: '#00ff41',
                letterSpacing: '2px',
                textTransform: 'uppercase',
              }}>
                {t('login.access_granted')}
              </div>
            </div>

            {/* Loading bar */}
            <div style={{
              width: '200px',
              height: '2px',
              backgroundColor: 'rgba(0,255,65,0.1)',
              overflow: 'hidden',
              opacity: 0,
              animation: 'operatorSlideIn 0.6s ease-out 0.7s forwards',
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#00ff41',
                boxShadow: '0 0 8px rgba(0,255,65,0.5)',
                transformOrigin: 'left',
                animation: 'progressBar 0.8s ease-out 0.8s forwards',
                transform: 'scaleX(0)',
              }} />
            </div>
          </div>
        )}

        {/* Legal Footer — positioned at bottom of viewport, outside content flow */}
        <div style={{
          marginTop: '40px',
          textAlign: 'center',
          fontSize: '11px',
          color: '#555',
          fontFamily: 'Chakra Petch, sans-serif',
          maxWidth: '90%',
        }}>
          <p style={{ margin: 0 }}>
            By logging in, you agree to our{' '}
            <button
              onClick={(e) => { e.stopPropagation(); setShowTOS(true); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#00ff41',
                cursor: 'pointer',
                textDecoration: 'underline',
                font: 'inherit',
                padding: 0,
              }}
            >
              Terms of Service
            </button>
            {' '}and{' '}
            <button
              onClick={(e) => { e.stopPropagation(); setShowPrivacy(true); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#00ff41',
                cursor: 'pointer',
                textDecoration: 'underline',
                font: 'inherit',
                padding: 0,
              }}
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </div>

      {/* Legal Pages Overlays */}
      {showTOS && <TermsOfService onClose={() => setShowTOS(false)} />}
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}

      {/* Registration-closed modal — closed-beta period.
          Public registration starts June 2026 per Pricing Strategy v2 §6.
          Until then, REGISTER buttons surface this explainer instead of
          opening the create-account form. */}
      {showRegistrationClosedModal && (
        <div
          onClick={() => setShowRegistrationClosedModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 480,
              width: '100%',
              padding: 32,
              background: '#0a0a0a',
              border: '2px solid #00ff41',
              borderRadius: 6,
              textAlign: 'center',
              boxShadow: '0 0 60px rgba(0,255,65,0.15)',
            }}
          >
            <div style={{
              display: 'inline-block',
              padding: '4px 12px',
              border: '1px solid #00ff41',
              color: '#00ff41',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 10,
              letterSpacing: 3,
              marginBottom: 18,
              borderRadius: 3,
            }}>
              // CLOSED BETA
            </div>
            <h2 style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 22,
              color: '#fff',
              letterSpacing: 2,
              margin: '0 0 14px',
              fontWeight: 800,
            }}>
              REGISTRATION OPENS JUNE 2026
            </h2>
            <p style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 13,
              color: '#bbb',
              lineHeight: 1.6,
              marginBottom: 22,
            }}>
              GUNS UP is currently in closed beta with a hand-picked roster of
              operators. Public registration goes live June 2026. Until then,
              new accounts are added one-by-one as the founder team approves them.
            </p>
            <p style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 12,
              color: '#888',
              lineHeight: 1.6,
              marginBottom: 22,
            }}>
              Already approved? Sign in with the email Ruben gave you.
              <br />
              Want in early? Contact Ruben directly.
            </p>
            <button
              type="button"
              onClick={() => setShowRegistrationClosedModal(false)}
              style={{
                padding: '10px 24px',
                background: '#00ff41',
                color: '#0a0a0a',
                border: 'none',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 2,
                cursor: 'pointer',
                textTransform: 'uppercase',
                borderRadius: 3,
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.1; }
        }
        @keyframes progressBar {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
