'use client';

import React, { useState, useRef, useEffect } from 'react';
import LogoFull from '@/components/LogoFull';
import { Operator } from '@/lib/types';
import { OPERATORS } from '@/data/operators';

interface LoginScreenProps {
  onLogin: (operator: Operator) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (pin.length === 4) {
      const operator = OPERATORS.find((op) => op.pin === pin);
      if (operator) {
        setSuccess(true);
        setError(false);
        setTimeout(() => {
          onLogin(operator);
        }, 600);
      } else {
        setError(true);
        setSuccess(false);
        setTimeout(() => {
          setPin('');
          setError(false);
          if (hiddenInputRef.current) {
            hiddenInputRef.current.focus();
          }
        }, 800);
      }
    }
  }, [pin, onLogin]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (/^[0-9]$/.test(e.key)) {
      if (pin.length < 4) {
        setPin(pin + e.key);
      }
      e.preventDefault();
    } else if (e.key === 'Backspace') {
      setPin(pin.slice(0, -1));
      setError(false);
      e.preventDefault();
    } else if (e.key === 'Enter' && pin.length === 4) {
      e.preventDefault();
    }
  };

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100vh',
    backgroundColor: '#030303',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'monospace',
    color: '#00ff41',
    overflow: 'hidden',
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '32px',
  };

  const logoStyle: React.CSSProperties = {
    marginBottom: '16px',
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: 'Orbitron, monospace',
    fontSize: '8px',
    letterSpacing: '2px',
    color: '#555',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: '16px',
  };

  const scanlineStyle: React.CSSProperties = {
    width: '200px',
    height: '1px',
    background: 'linear-gradient(to right, transparent, #00ff41, transparent)',
    marginBottom: '24px',
  };

  const pinContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    marginBottom: '16px',
  };

  const getPinBoxStyle = (index: number): React.CSSProperties => {
    let borderColor = 'rgba(0,255,65,0.06)';

    if (error) {
      borderColor = '#ff4444';
    } else if (success) {
      borderColor = '#00ff41';
    } else if (index < pin.length) {
      borderColor = 'rgba(0,255,65,0.2)';
    } else if (index === pin.length) {
      borderColor = 'rgba(0,255,65,0.2)';
    }

    return {
      width: '40px',
      height: '48px',
      backgroundColor: 'rgba(0,255,65,0.02)',
      border: `1px solid ${borderColor}`,
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '24px',
      color: '#00ff41',
      textAlign: 'center',
      lineHeight: '48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      transition: 'border-color 0.1s ease',
      animation: error ? `redFlash 0.15s ease 0s, redFlash 0.15s ease 0.2s` : undefined,
      boxShadow: success && index < pin.length ? '0 0 12px rgba(0,255,65,0.5)' : undefined,
    };
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Chakra Petch, monospace',
    fontSize: '9px',
    color: '#555',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: '1px',
    marginBottom: '8px',
  };

  const errorMessageStyle: React.CSSProperties = {
    fontFamily: 'Chakra Petch, monospace',
    fontSize: '11px',
    color: '#ff4444',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: '1px',
    opacity: error ? 1 : 0,
    transition: 'opacity 0.2s ease',
    minHeight: '16px',
  };

  const hiddenInputStyle: React.CSSProperties = {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
    width: 0,
    height: 0,
  };

  return (
    <div style={containerStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600&display=swap');

        @keyframes redFlash {
          0% {
            border-color: #ff4444;
            box-shadow: 0 0 8px rgba(255, 68, 68, 0.6);
          }
          100% {
            border-color: #ff4444;
            box-shadow: 0 0 2px rgba(255, 68, 68, 0.2);
          }
        }

        @keyframes greenPulse {
          0% {
            box-shadow: 0 0 8px rgba(0, 255, 65, 0.3);
          }
          50% {
            box-shadow: 0 0 16px rgba(0, 255, 65, 0.8);
          }
          100% {
            box-shadow: 0 0 8px rgba(0, 255, 65, 0.3);
          }
        }
      `}</style>

      <input
        ref={hiddenInputRef}
        type="text"
        style={hiddenInputStyle}
        onKeyDown={handleKeyDown}
        autoFocus
        aria-label="PIN input"
      />

      <div style={contentStyle}>
        <div style={logoStyle}>
          <LogoFull />
        </div>

        <div style={titleStyle}>Tactical Workout Command Center</div>

        <div style={scanlineStyle} />

        <div>
          <div style={labelStyle}>Enter Access Code</div>
          <div style={pinContainerStyle}>
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                style={getPinBoxStyle(index)}
              >
                {pin[index] || ''}
              </div>
            ))}
          </div>
        </div>

        <div style={errorMessageStyle}>
          {error ? 'Access Denied' : ''}
        </div>
      </div>
    </div>
  );
}
