'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Operator } from '@/lib/types';

interface COCDashboardProps {
  operator: Operator;
  allOperators: Operator[];
}

// Animated counter hook
function useCountUp(target: number, duration: number = 1200, delay: number = 0): number {
  const [count, setCount] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startRef.current) startRef.current = timestamp;
        const progress = Math.min((timestamp - startRef.current) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        setCount(Math.floor(eased * target));
        if (progress < 1) requestAnimationFrame(step);
      };
      startRef.current = null;
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);

  return count;
}

// Progress Ring SVG component
function ProgressRing({ value, max, size = 80, color = '#00ff41', label }: {
  value: number; max: number; size?: number; color?: string; label: string;
}) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = Math.min(value / max, 1);
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(circumference - percent * circumference);
    }, 300);
    return () => clearTimeout(timer);
  }, [percent, circumference]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background ring */}
          <circle cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(0,255,65,0.06)" strokeWidth={strokeWidth} />
          {/* Progress ring */}
          <circle cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: `drop-shadow(0 0 4px ${color}40)`,
            }}
          />
        </svg>
        {/* Center value */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '26px',
          color: color,
          textShadow: `0 0 8px ${color}60`,
        }}>
          {value}
        </div>
      </div>
      <div style={{
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '15px',
        letterSpacing: '1.5px',
        color: '#888',
        textTransform: 'uppercase',
        fontWeight: 700,
      }}>
        {label}
      </div>
    </div>
  );
}

function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekDates(): { date: Date; key: string; dayName: string }[] {
  const weekStart = getWeekStart();
  const dates = [];
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    dates.push({ date, key: formatDateKey(date), dayName: dayNames[i] });
  }
  return dates;
}

function countWorkoutsThisWeek(operator: Operator): number {
  return getWeekDates().filter((d) => operator.workouts[d.key]).length;
}

function calculateStreak(operator: Operator): number {
  const today = new Date();
  let streak = 0;
  const currentDate = new Date(today);
  while (true) {
    const key = formatDateKey(currentDate);
    if (operator.workouts[key]) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else break;
  }
  return streak;
}

function parseReps(prescription: string): number {
  const match = prescription.match(/(\d+)\s*x\s*(\d+)/);
  return match ? parseInt(match[2], 10) : 0;
}

function calculateWeeklyVolume(operator: Operator): number {
  let totalVolume = 0;
  getWeekDates().forEach((d) => {
    const workout = operator.workouts[d.key];
    if (workout) {
      workout.blocks.forEach((block) => {
        if (block.type === 'exercise') totalVolume += parseReps(block.prescription) * 135;
      });
    }
  });
  return totalVolume;
}

function getRecentPRs(operator: Operator, limit: number = 5) {
  return [...operator.prs]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

function formatPRDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

export const COCDashboard: React.FC<COCDashboardProps> = ({ operator }) => {
  const { t } = useLanguage();
  const workoutsThisWeek = countWorkoutsThisWeek(operator);
  const streak = calculateStreak(operator);
  const volume = calculateWeeklyVolume(operator);
  const prCount = operator.prs.length;
  const recentPRs = getRecentPRs(operator);
  const weekDates = getWeekDates();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const lastWidthRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    const check = () => {
      const w = window.innerWidth;
      if (w !== lastWidthRef.current) {
        lastWidthRef.current = w;
        setIsMobile(w < 768);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Animated counters
  const animWorkouts = useCountUp(workoutsThisWeek, 800, 200);
  const animStreak = useCountUp(streak, 800, 400);
  const animVolume = useCountUp(volume, 1200, 600);
  const animPRs = useCountUp(prCount, 800, 800);

  const stats = [
    { label: t('dashboard.workouts'), labelKey: 'dashboard.workouts', value: animWorkouts, suffix: '', sub: 'THIS WEEK', color: '#00ff41', delay: 0 },
    { label: t('dashboard.streak'), labelKey: 'dashboard.streak', value: animStreak, suffix: 'D', sub: 'CONSECUTIVE', color: '#00ff41', delay: 1 },
    { label: 'VOLUME', value: animVolume, suffix: '', sub: 'LBS MOVED', color: '#ffb800', delay: 2 },
    { label: t('dashboard.pr_records'), labelKey: 'dashboard.pr_records', value: animPRs, suffix: '', sub: 'LIFETIME', color: '#00bcd4', delay: 3 },
  ];

  return (
    <div style={{
      backgroundColor: '#030303',
      color: '#ddd',
      fontFamily: 'Chakra Petch, sans-serif',
      padding: isMobile ? '16px' : '24px',
      minHeight: '100vh',
      position: 'relative',
    }}>

      {/* Ambient grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'linear-gradient(rgba(0,255,65,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.015) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        pointerEvents: 'none',
      }} />

      {/* Operator banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'all 0.5s ease',
        position: 'relative',
      }}>
        <div>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '26px',
            fontWeight: 900,
            color: '#00ff41',
            letterSpacing: '4px',
            textShadow: '0 0 12px rgba(0,255,65,0.3)',
          }}>
            {operator.callsign}
          </div>
          <div style={{
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '15px',
            color: '#777',
            letterSpacing: '1px',
            marginTop: '4px',
          }}>
            {operator.name} // {operator.role.toUpperCase()} // {operator.profile.goals.join(' + ').toUpperCase()}
          </div>
        </div>
        <div style={{
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '15px',
          color: '#666',
          textAlign: 'right',
        }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
        </div>
      </div>

      {/* Hero Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '8px' : '12px',
        marginBottom: '24px',
        position: 'relative',
      }}>
        {stats.map((stat, i) => (
          <div key={stat.labelKey} style={{
            border: '1px solid rgba(0,255,65,0.06)',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(15px)',
            transition: `all 0.5s ease ${i * 0.1}s`,
            background: 'linear-gradient(135deg, rgba(10,10,10,0.8) 0%, rgba(5,5,5,0.95) 100%)',
          }}>
            {/* Top-left corner accent */}
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: '12px', height: '12px',
              borderTop: `2px solid ${stat.color}30`,
              borderLeft: `2px solid ${stat.color}30`,
            }} />
            {/* Bottom-right corner accent */}
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: '12px', height: '12px',
              borderBottom: `2px solid ${stat.color}30`,
              borderRight: `2px solid ${stat.color}30`,
            }} />

            <div style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '15px',
              letterSpacing: '2px',
              color: '#888',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: '12px',
            }}>
              {stat.label}
            </div>
            <div style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: isMobile ? (stat.label === 'VOLUME' ? '22px' : '28px') : (stat.label === 'VOLUME' ? '32px' : '42px'),
              color: stat.color,
              lineHeight: '1',
              marginBottom: '8px',
              textShadow: `0 0 8px ${stat.color}60, 0 0 20px ${stat.color}25`,
              fontWeight: 'bold',
            }}>
              {stat.label === 'VOLUME' ? stat.value.toLocaleString() : stat.value}{stat.suffix}
            </div>
            <div style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: '15px',
              color: '#3a3a3a',
              letterSpacing: '1px',
            }}>
              // {stat.sub}
            </div>

            {/* Subtle shimmer line at bottom */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '1px',
              background: `linear-gradient(90deg, transparent, ${stat.color}20, transparent)`,
            }} />
          </div>
        ))}
      </div>

      {/* Scanline Divider */}
      <div style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(0,255,65,0.3), transparent)',
        marginBottom: '24px',
      }} />

      {/* Two-Column Layout */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '16px' : '24px', marginBottom: '24px', position: 'relative' }}>

        {/* Left Column: Weekly Overview */}
        <div style={{ flex: isMobile ? '1' : '0 0 58%' }}>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '15px',
            letterSpacing: '2px',
            color: '#888',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ color: '#00ff41', fontSize: '15px' }}>▶</span>
            {t('dashboard.weekly_ops')}
          </div>

          <div style={{
            border: '1px solid rgba(0,255,65,0.05)',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, rgba(8,8,8,0.5) 0%, rgba(3,3,3,0.5) 100%)',
          }}>
            {weekDates.map((dayInfo, i) => {
              const workout = operator.workouts[dayInfo.key];
              const today = isToday(dayInfo.date);

              return (
                <div key={dayInfo.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  borderBottom: i < 6 ? '1px solid rgba(0,255,65,0.03)' : 'none',
                  backgroundColor: today ? 'rgba(0,255,65,0.03)' : 'transparent',
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateX(0)' : 'translateX(-10px)',
                  transition: `all 0.4s ease ${0.3 + i * 0.05}s`,
                  position: 'relative',
                }}>
                  {/* Today indicator */}
                  {today && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '2px',
                      backgroundColor: '#00ff41',
                      boxShadow: '0 0 6px rgba(0,255,65,0.4)',
                    }} />
                  )}

                  <div style={{
                    fontFamily: 'Orbitron, sans-serif',
                    fontSize: '15px',
                    color: today ? '#00ff41' : '#777',
                    width: '40px',
                    fontWeight: today ? 800 : 600,
                    letterSpacing: '1px',
                  }}>
                    {dayInfo.dayName}
                  </div>

                  <div style={{
                    fontFamily: 'Share Tech Mono, monospace',
                    fontSize: '15px',
                    color: '#666',
                    width: '30px',
                  }}>
                    {dayInfo.date.getDate()}
                  </div>

                  {workout ? (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      paddingLeft: '10px',
                      borderLeft: '2px solid rgba(0,255,65,0.3)',
                    }}>
                      <div style={{
                        fontFamily: 'Chakra Petch, sans-serif',
                        fontSize: '15px',
                        color: '#bbb',
                        flex: 1,
                      }}>
                        {workout.title}
                      </div>
                      <div style={{
                        fontFamily: 'Share Tech Mono, monospace',
                        fontSize: '15px',
                        color: '#00bcd4',
                        padding: '2px 8px',
                        border: '1px solid rgba(0,188,212,0.2)',
                        backgroundColor: 'rgba(0,188,212,0.04)',
                      }}>
                        {workout.blocks.length} BLOCKS
                      </div>
                      {workout.completed && (
                        <div style={{
                          fontFamily: 'Share Tech Mono, monospace',
                          fontSize: '15px',
                          color: '#00ff41',
                          padding: '2px 6px',
                          border: '1px solid rgba(0,255,65,0.2)',
                          backgroundColor: 'rgba(0,255,65,0.04)',
                        }}>
                          ✓
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      flex: 1,
                      fontFamily: 'Chakra Petch, sans-serif',
                      fontSize: '15px',
                      color: '#222',
                      paddingLeft: '10px',
                      borderLeft: '2px solid rgba(0,255,65,0.05)',
                    }}>
                      {today ? 'NO SESSION LOGGED' : '—'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: PRs + Readiness */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* PR Board */}
          <div>
            <div style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '15px',
              letterSpacing: '2px',
              color: '#888',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ color: '#ffb800', fontSize: '15px' }}>◆</span>
              RECENT {t('dashboard.pr_records')}
            </div>

            <div style={{
              border: '1px solid rgba(0,255,65,0.05)',
              overflow: 'hidden',
              background: 'linear-gradient(180deg, rgba(8,8,8,0.5) 0%, rgba(3,3,3,0.5) 100%)',
            }}>
              {recentPRs.length > 0 ? recentPRs.map((pr, i) => (
                <div key={pr.id} style={{
                  padding: '12px 16px',
                  borderBottom: i < recentPRs.length - 1 ? '1px solid rgba(0,255,65,0.03)' : 'none',
                  borderLeft: '2px solid #ffb800',
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateX(0)' : 'translateX(10px)',
                  transition: `all 0.4s ease ${0.5 + i * 0.08}s`,
                }}>
                  <div style={{
                    fontFamily: 'Chakra Petch, sans-serif',
                    fontSize: '15px',
                    color: '#bbb',
                    marginBottom: '4px',
                  }}>
                    {pr.exercise}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div style={{
                      fontFamily: 'Share Tech Mono, monospace',
                      fontSize: '15px',
                      color: '#ffb800',
                      textShadow: '0 0 6px rgba(255,184,0,0.3)',
                    }}>
                      {pr.weight}lbs × {pr.reps}
                    </div>
                    <div style={{
                      fontFamily: 'Share Tech Mono, monospace',
                      fontSize: '15px',
                      color: '#777',
                    }}>
                      {formatPRDate(pr.date)}
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{
                  padding: '24px 16px',
                  fontFamily: 'Share Tech Mono, monospace',
                  fontSize: '15px',
                  color: '#666',
                  textAlign: 'center',
                }}>
                  NO RECORDS LOGGED
                </div>
              )}
            </div>
          </div>

          {/* Readiness Panel with Rings */}
          <div style={{
            border: '1px solid rgba(0,255,65,0.05)',
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(8,8,8,0.5) 0%, rgba(3,3,3,0.5) 100%)',
          }}>
            <div style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '15px',
              letterSpacing: '2px',
              color: '#888',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ color: '#00bcd4', fontSize: '15px' }}>◈</span>
              OPERATOR {t('dashboard.readiness')}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
            }}>
              <ProgressRing
                value={operator.profile.readiness}
                max={100}
                size={72}
                color="#00ff41"
                label="READINESS"
              />
              <ProgressRing
                value={operator.profile.sleep}
                max={10}
                size={72}
                color="#00bcd4"
                label="SLEEP"
              />
              <ProgressRing
                value={operator.profile.stress}
                max={10}
                size={72}
                color="#ffb800"
                label="STRESS"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default COCDashboard;
