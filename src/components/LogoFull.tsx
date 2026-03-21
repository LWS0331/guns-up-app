import React from 'react';
import Logo from './Logo';

interface LogoFullProps {
  size?: number;
  color?: string;
  className?: string;
  textClassName?: string;
}

const LogoFull: React.FC<LogoFullProps> = ({
  size = 40,
  color = '#00ff41',
  className = '',
  textClassName = ''
}) => {
  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
    >
      <Logo size={size} color={color} />
      <span
        className={textClassName}
        style={{
          fontFamily: 'Orbitron, monospace',
          fontSize: `${(size * 24) / 40}px`,
          fontWeight: 700,
          letterSpacing: '3px',
          color: color,
          textTransform: 'uppercase',
          lineHeight: 1
        }}
      >
        GUNS UP
      </span>
    </div>
  );
};

export default LogoFull;
