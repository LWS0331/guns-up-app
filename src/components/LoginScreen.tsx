'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import LogoFull from '@/components/LogoFull';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/lib/i18n';
import { Operator } from '@/lib/types';
import { TermsOfService, PrivacyPolicy } from '@/components/LegalPages';

interface LoginScreenProps {
  onLogin: (operator: Operator) => void;
  operators: Operator[];
}

type LoginMode = 'pin' | 'email' | 'register';

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
  const [loginMode, setLoginMode] = useState<LoginMode>('pin');
  const [pin, setPin] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [callsign, setCallsign] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [matchedOperator, setMatchedOperator] = useState<Operator | null>(null);
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
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (pin.length === 4) {
      const operator = operators.find((op) => op.pin === pin);
      if (operator) {
        setSuccess(true);
        setError('');
        setMatchedOperator(operator);
        // Fetch JWT token from API so Gunny AI requests are authenticated
        fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.token) {
              localStorage.setItem('authToken', data.token);
            }
          })
          .catch(() => { /* token fetch failed, continue anyway */ });
        setTimeout(() => {
          onLogin(operator);
        }, 1400);
      } else {
        setError('Invalid PIN');
        setSuccess(false);
        setTimeout(() => {
          setPin('');
          setError('');
          if (hiddenInputRef.current) {
            hiddenInputRef.current.focus();
          }
        }, 800);
      }
    }
  }, [pin, operators, onLogin]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (/^[0-9]$/.test(e.key)) {
      setPin(prev => {
        if (prev.length < 4) return prev + e.key;
        return prev;
      });
      e.preventDefault();
    } else if (e.key === 'Backspace') {
      setPin(prev => prev.slice(0, -1));
      setError('');
      e.preventDefault();
    }
  }, []);

  const handleContainerClick = () => {
    if (hiddenInputRef.current && loginMode === 'pin') {
      hiddenInputRef.current.focus();
    }
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

      {/* Hidden input */}
      <input
        ref={hiddenInputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={pin}
        style={{
          position: 'absolute',
          opacity: 0,
          width: '1px',
          height: '1px',
          border: 'none',
          outline: 'none',
          padding: 0,
          margin: 0,
          overflow: 'hidden',
        }}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
          setPin(val);
        }}
        autoFocus
        autoComplete="off"
        aria-label="PIN input"
      />

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

        {/* Mode Selector Tabs */}
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
                setLoginMode('pin');
                setError('');
                setPin('');
              }}
              style={{
                fontFamily: 'Orbitron, monospace',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                padding: '8px 16px',
                border: `1px solid ${loginMode === 'pin' ? '#00ff41' : 'rgba(0,255,65,0.2)'}`,
                backgroundColor: loginMode === 'pin' ? 'rgba(0,255,65,0.1)' : 'transparent',
                color: loginMode === 'pin' ? '#00ff41' : '#666',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              PIN LOGIN (BETA)
            </button>
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
        {!success && loginMode === 'pin' ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.6s ease 0.6s, transform 0.6s ease 0.6s',
          }}>
            {/* Label */}
            <div style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: '15px',
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              animation: 'accessTextPulse 3s ease-in-out infinite',
            }}>
              {t('login.enter_pin')}
            </div>

            {/* PIN boxes */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
            }}>
              {[0, 1, 2, 3].map((index) => {
                const filled = index < pin.length;
                const isActive = index === pin.length;

                let borderColor = 'rgba(0,255,65,0.2)';
                let bgColor = 'rgba(0,255,65,0.03)';
                let shadow = 'none';
                let anim = 'pinBoxIdle 4s ease-in-out infinite';

                if (error) {
                  borderColor = '#ff4444';
                  bgColor = 'rgba(255,68,68,0.05)';
                  shadow = '0 0 12px rgba(255,68,68,0.3)';
                  anim = 'none';
                } else if (filled) {
                  borderColor = 'rgba(0,255,65,0.35)';
                  bgColor = 'rgba(0,255,65,0.04)';
                  shadow = '0 0 8px rgba(0,255,65,0.15)';
                  anim = 'none';
                } else if (isActive) {
                  borderColor = 'rgba(0,255,65,0.25)';
                  bgColor = 'rgba(0,255,65,0.02)';
                }

                return (
                  <div key={index} style={{
                    width: '48px',
                    height: '56px',
                    backgroundColor: bgColor,
                    border: `1px solid ${borderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    animation: anim,
                    animationDelay: `${index * 0.5}s`,
                    boxShadow: shadow,
                  }}>
                    {/* Corner accents */}
                    <div style={{
                      position: 'absolute', top: -1, left: -1,
                      width: '6px', height: '6px',
                      borderTop: `1px solid ${filled ? 'rgba(0,255,65,0.6)' : 'rgba(0,255,65,0.25)'}`,
                      borderLeft: `1px solid ${filled ? 'rgba(0,255,65,0.6)' : 'rgba(0,255,65,0.25)'}`,
                      transition: 'border-color 0.15s ease',
                    }} />
                    <div style={{
                      position: 'absolute', bottom: -1, right: -1,
                      width: '6px', height: '6px',
                      borderBottom: `1px solid ${filled ? 'rgba(0,255,65,0.6)' : 'rgba(0,255,65,0.25)'}`,
                      borderRight: `1px solid ${filled ? 'rgba(0,255,65,0.6)' : 'rgba(0,255,65,0.25)'}`,
                      transition: 'border-color 0.15s ease',
                    }} />

                    {/* Digit or cursor */}
                    {filled ? (
                      <div style={{
                        fontFamily: 'Share Tech Mono, monospace',
                        fontSize: '26px',
                        color: '#00ff41',
                        textShadow: '0 0 8px rgba(0,255,65,0.5)',
                        animation: 'fadeInScale 0.15s ease',
                      }}>
                        {pin[index]}
                      </div>
                    ) : isActive ? (
                      <div style={{
                        width: '2px',
                        height: '20px',
                        backgroundColor: '#00ff41',
                        opacity: 0.6,
                        animation: 'cursorBlink 1s ease-in-out infinite',
                      }} />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Error message */}
            <div style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: '15px',
              color: '#ff4444',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              textAlign: 'center',
              opacity: error ? 1 : 0,
              transform: error ? 'translateY(0)' : 'translateY(-5px)',
              transition: 'opacity 0.2s ease, transform 0.2s ease',
              minHeight: '14px',
              textShadow: error ? '0 0 8px rgba(255,68,68,0.4)' : 'none',
            }}>
              {error ? `// ${t('login.access_denied')}` : ''}
            </div>
          </div>
        ) : !success && loginMode === 'email' ? (
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
              placeholder="Email"
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
              placeholder="Password"
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

            {/* Register link */}
            <div style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: '11px',
              color: '#666',
            }}>
              New operator?{' '}
              <button
                type="button"
                onClick={() => {
                  setLoginMode('register');
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
              placeholder="Full Name"
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
              placeholder="Callsign (UPPERCASE, no spaces)"
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
              placeholder="Email"
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
              placeholder="Password (min 8 chars)"
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
