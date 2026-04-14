'use client';

import React from 'react';

/**
 * Icons.tsx — SVG icon system for Guns Up.
 *
 * Replaces ad-hoc emoji usage with consistent, monochrome SVG icons.
 * Each icon takes { size, color, className, style } — defaults to 16px / currentColor.
 *
 * Usage:
 *   <Icon.Flame size={18} color="#ff8a3c" />
 *   <Icon.Radio />
 *
 * Add new icons as single functional components with the same signature.
 */

export interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

const base = (size: number, style?: React.CSSProperties): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  style: { display: 'inline-block', verticalAlign: 'middle', ...style },
});

function make(
  paths: React.ReactNode,
  displayName: string,
  defaultStroke = 2,
) {
  const Comp: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, style, strokeWidth }) => (
    <svg
      {...base(size, style)}
      className={className}
      stroke={color}
      strokeWidth={strokeWidth ?? defaultStroke}
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
  );
  Comp.displayName = displayName;
  return Comp;
}

/* ─── Core glyphs ───────────────────────────────────────────────────────── */

export const Flame = make(
  <path d="M12 2s4 5 4 9a4 4 0 1 1-8 0c0-1.5.5-3 1-4-.5 1.5-3 3.5-3 7a6 6 0 0 0 12 0c0-5-3-9-6-12z" />,
  'FlameIcon',
);

export const Bolt = make(
  <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  'BoltIcon',
);

export const Check = make(<polyline points="20 6 9 17 4 12" />, 'CheckIcon', 3);
export const X = make(<g><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></g>, 'XIcon', 2.5);

export const Play = make(<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />, 'PlayIcon');
export const Pause = make(<g><rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none" /><rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none" /></g>, 'PauseIcon');

export const Radio = make(
  <g>
    <circle cx="12" cy="12" r="2" />
    <path d="M4.9 4.9 A10 10 0 0 0 4.9 19.1" />
    <path d="M19.1 4.9 A10 10 0 0 1 19.1 19.1" />
    <path d="M8 8 A5.7 5.7 0 0 0 8 16" />
    <path d="M16 8 A5.7 5.7 0 0 1 16 16" />
  </g>,
  'RadioIcon',
);

export const Heart = make(
  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  'HeartIcon',
);

export const Dumbbell = make(
  <g>
    <path d="M6.5 6.5h11v11h-11z" />
    <path d="M2 9h4v6H2z" />
    <path d="M18 9h4v6h-4z" />
  </g>,
  'DumbbellIcon',
);

export const Timer = make(
  <g>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2 2" />
    <path d="M9 2h6" />
    <path d="M12 2v2" />
  </g>,
  'TimerIcon',
);

export const Target = make(
  <g>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </g>,
  'TargetIcon',
);

export const Trophy = make(
  <g>
    <path d="M6 4h12v4a6 6 0 0 1-12 0V4z" />
    <path d="M6 6H3v2a3 3 0 0 0 3 3" />
    <path d="M18 6h3v2a3 3 0 0 1-3 3" />
    <path d="M10 14v3h4v-3" />
    <path d="M8 20h8" />
  </g>,
  'TrophyIcon',
);

export const Stats = make(
  <g>
    <line x1="4" y1="20" x2="4" y2="10" />
    <line x1="10" y1="20" x2="10" y2="4" />
    <line x1="16" y1="20" x2="16" y2="14" />
    <line x1="22" y1="20" x2="2" y2="20" />
  </g>,
  'StatsIcon',
);

export const Food = make(
  <g>
    <path d="M7 2v20" />
    <path d="M5 2v7a2 2 0 0 0 4 0V2" />
    <path d="M17 2c-2 0-3 2-3 5s1 5 3 5v10" />
  </g>,
  'FoodIcon',
);

export const User = make(
  <g>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" />
  </g>,
  'UserIcon',
);

export const Lock = make(
  <g>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </g>,
  'LockIcon',
);

export const Settings = make(
  <g>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9A1.7 1.7 0 0 0 10 3.1V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </g>,
  'SettingsIcon',
);

export const Bell = make(
  <g>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </g>,
  'BellIcon',
);

export const ChevronRight = make(<polyline points="9 6 15 12 9 18" />, 'ChevronRightIcon');
export const ChevronDown = make(<polyline points="6 9 12 15 18 9" />, 'ChevronDownIcon');
export const ChevronLeft = make(<polyline points="15 6 9 12 15 18" />, 'ChevronLeftIcon');
export const ChevronUp = make(<polyline points="18 15 12 9 6 15" />, 'ChevronUpIcon');

export const ArrowRight = make(<g><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></g>, 'ArrowRightIcon');
export const ArrowLeft = make(<g><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></g>, 'ArrowLeftIcon');

export const Plus = make(<g><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></g>, 'PlusIcon');
export const Minus = make(<line x1="5" y1="12" x2="19" y2="12" />, 'MinusIcon');

export const Calendar = make(
  <g>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </g>,
  'CalendarIcon',
);

export const Clock = make(
  <g>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </g>,
  'ClockIcon',
);

export const Info = make(
  <g>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="8" />
  </g>,
  'InfoIcon',
);

export const Warning = make(
  <g>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12" y2="17" />
  </g>,
  'WarningIcon',
);

export const Send = make(<g><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></g>, 'SendIcon');

export const Mic = make(
  <g>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M19 10a7 7 0 0 1-14 0" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </g>,
  'MicIcon',
);

export const Trash = make(
  <g>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </g>,
  'TrashIcon',
);

export const Edit = make(
  <g>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </g>,
  'EditIcon',
);

/* ─── Namespaced default export ─────────────────────────────────────────── */

const Icon = {
  Flame, Bolt, Check, X, Play, Pause, Radio, Heart, Dumbbell, Timer, Target, Trophy,
  Stats, Food, User, Lock, Settings, Bell,
  ChevronRight, ChevronDown, ChevronLeft, ChevronUp,
  ArrowRight, ArrowLeft, Plus, Minus, Calendar, Clock, Info, Warning, Send, Mic, Trash, Edit,
};

// Legacy named exports (back-compat with callers using *Icon suffix)
export const FlameIcon = Flame;
export const BoltIcon = Bolt;
export const CheckIcon = Check;
export const XIcon = X;
export const PlayIcon = Play;
export const PauseIcon = Pause;
export const RadioIcon = Radio;
export const HeartIcon = Heart;
export const DumbbellIcon = Dumbbell;
export const TimerIcon = Timer;
export const TargetIcon = Target;
export const TrophyIcon = Trophy;
export const StatsIcon = Stats;
export const FoodIcon = Food;
export const UserIcon = User;
export const LockIcon = Lock;
export const SettingsIcon = Settings;
export const BellIcon = Bell;
export const SendIcon = Send;
export const MicIcon = Mic;
export const TrashIcon = Trash;
export const EditIcon = Edit;
export const CalendarIcon = Calendar;
export const ClockIcon = Clock;
export const InfoIcon = Info;
export const WarningIcon = Warning;
export const PlusIcon = Plus;
export const MinusIcon = Minus;

export default Icon;
