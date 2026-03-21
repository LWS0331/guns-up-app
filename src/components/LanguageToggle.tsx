'use client';

import React from 'react';
import { useLanguage } from '@/lib/i18n';

interface LanguageToggleProps {
  compact?: boolean;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ compact = false }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 255, 65, 0.03)',
      border: '1px solid rgba(0, 255, 65, 0.15)',
      borderRadius: '4px',
      padding: compact ? '4px' : '6px',
      gap: '2px',
    }}>
      <button
        onClick={() => setLanguage('en')}
        style={{
          padding: compact ? '4px 10px' : '6px 12px',
          fontSize: compact ? '12px' : '13px',
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: language === 'en' ? 700 : 400,
          letterSpacing: '1px',
          border: 'none',
          background: language === 'en' ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
          color: language === 'en' ? '#00ff41' : '#666',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          borderRadius: '2px',
          textTransform: 'uppercase',
          boxShadow: language === 'en' ? '0 0 8px rgba(0, 255, 65, 0.2)' : 'none',
        }}
      >
        EN
      </button>
      <div style={{
        width: '1px',
        height: '16px',
        backgroundColor: 'rgba(0, 255, 65, 0.1)',
      }} />
      <button
        onClick={() => setLanguage('es')}
        style={{
          padding: compact ? '4px 10px' : '6px 12px',
          fontSize: compact ? '12px' : '13px',
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: language === 'es' ? 700 : 400,
          letterSpacing: '1px',
          border: 'none',
          background: language === 'es' ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
          color: language === 'es' ? '#00ff41' : '#666',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          borderRadius: '2px',
          textTransform: 'uppercase',
          boxShadow: language === 'es' ? '0 0 8px rgba(0, 255, 65, 0.2)' : 'none',
        }}
      >
        ES
      </button>
    </div>
  );
};

export default LanguageToggle;
