import React from 'react';

interface LogoProps {
  size?: number;
  color?: string;
  className?: string;
  glow?: boolean;
}

const Logo: React.FC<LogoProps> = ({
  size = 40,
  className = '',
  glow = true,
}) => {
  return (
    <img
      src={glow ? '/logo-glow.png' : '/logo-white.png'}
      alt="GUNS UP"
      width={size}
      height={size}
      className={className}
      style={{
        display: 'inline-block',
        objectFit: 'contain',
      }}
    />
  );
};

export default Logo;
