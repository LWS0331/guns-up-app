import React from 'react';

interface LogoProps {
  size?: number;
  color?: string;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({
  size = 40,
  color = '#00ff41',
  className = ''
}) => {
  // Calculate height based on size (aspect ratio ~100x120)
  const height = size;
  const width = (size * 100) / 120;

  const strokeWidth = (size / 40) * 2.5; // Scale stroke proportionally

  return (
    <svg
      viewBox="0 0 100 120"
      width={width}
      height={height}
      className={className}
      style={{ display: 'inline-block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer asymmetric triangle */}
      <path
        d="M 65 8 L 15 95 L 80 95 Z"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Inner upward arrow/chevron */}
      <path
        d="M 42 35 L 55 55 M 58 35 L 45 55"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Vertical trunk extending down from chevron point */}
      <line
        x1="50"
        y1="55"
        x2="50"
        y2="105"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Upper crossbar (wider) */}
      <line
        x1="38"
        y1="80"
        x2="62"
        y2="80"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Lower crossbar (narrower) */}
      <line
        x1="42"
        y1="95"
        x2="58"
        y2="95"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
};

export default Logo;
