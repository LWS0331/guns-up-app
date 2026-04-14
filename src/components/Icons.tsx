// Icons.tsx — Clean SVG icon set for Guns Up
// 24x24 viewBox, stroke-based, inherits currentColor so it picks up parent text color.
// Use size prop to override dimensions.

import React from 'react';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

const base = (p: IconProps) => ({
  width: p.size ?? 20,
  height: p.size ?? 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: p.color ?? 'currentColor',
  strokeWidth: p.strokeWidth ?? 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: p.className,
  style: p.style,
});

// ─── Tab Navigation ──────────────────────────────────────────────────────────
export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <path d="M3 12l9-9 9 9" />
    <path d="M5 10v10h14V10" />
  </svg>
);

export const WorkoutIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <path d="M6.5 6.5l11 11" />
    <path d="M21 21l-1-1" />
    <path d="M3 3l1 1" />
    <path d="M18 22l4-4" />
    <path d="M2 6l4-4" />
    <path d="M3 10l7-7 4 4-7 7z" />
    <path d="M14 14l7-7-4-4-7 7" />
  </svg>
);

export const MealIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <path d="M3 11h18" />
    <path d="M3 11a9 9 0 0 0 18 0" />
    <path d="M12 3v4" />
    <path d="M8 21h8" />
    <path d="M12 17v4" />
  </svg>
);

export const ChartIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 4 4 5-6" />
  </svg>
);

export const ProfileIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

export const CalendarIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 3v4M16 3v4" />
  </svg>
);

// ─── Workout Mode ────────────────────────────────────────────────────────────
export const PlayIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />
  </svg>
);

export const PauseIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none" />
    <rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none" />
  </svg>
);

export const StopIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <polyline points="4 12 10 18 20 6" />
  </svg>
);

export const TimerIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l3 2" />
    <path d="M9 2h6" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const MinusIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// ─── Quick Actions ───────────────────────────────────────────────────────────
export const MicIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="18" x2="12" y2="22" />
  </svg>
);

export const SendIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export const EditIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

// ─── Status Indicators ───────────────────────────────────────────────────────
export const FireIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-2 2-3 2-6-2 2-4 0-4-4-1 2-2 0-2 0z" />
    <path d="M12 22a6 6 0 0 0 6-6c0-3-3-4-3-7-2 3-5 3-5 7a3 3 0 0 0 2 6z" />
  </svg>
);

export const TrendUpIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="14 7 21 7 21 14" />
  </svg>
);

export const TrendDownIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <polyline points="3 7 9 13 13 9 21 17" />
    <polyline points="14 17 21 17 21 10" />
  </svg>
);

export const AlertIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <path d="M12 2L2 21h20L12 2z" />
    <line x1="12" y1="9" x2="12" y2="14" />
    <line x1="12" y1="17" x2="12" y2="17.5" />
  </svg>
);

export const StarIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <polygon points="12 2 15 9 22 9 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9 9 9 12 2" />
  </svg>
);

export const BoltIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

// ─── Chat ────────────────────────────────────────────────────────────────────
export const ChatIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const GunnyIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 10h.01M15 10h.01" />
    <path d="M9 15s1 2 3 2 3-2 3-2" />
  </svg>
);

// ─── Misc ────────────────────────────────────────────────────────────────────
export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

export const SettingsIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <polyline points="15 6 9 12 15 18" />
  </svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const ChevronUpIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <polyline points="6 15 12 9 18 15" />
  </svg>
);

export const RefreshIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
  </svg>
);

export const HeartIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export const ScaleIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M9 5V3h6v2" />
    <path d="M12 10v4" />
    <path d="M10 14h4" />
  </svg>
);

export const InjuryIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <rect x="3" y="10" width="18" height="4" rx="1" transform="rotate(-45 12 12)" />
    <path d="M8 8l-2-2M16 16l2 2M8 16l-2 2M16 8l2-2" />
  </svg>
);

export const NoteIcon = (p: IconProps) => (
  <svg {...base(p)} aria-label={p.title}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="15" y2="17" />
  </svg>
);
