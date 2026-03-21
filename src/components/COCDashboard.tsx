'use client';

import React from 'react';
import { Operator } from '@/lib/types';

interface COCDashboardProps {
  operator: Operator;
  allOperators: Operator[];
}

// Helper: Get current week's Monday date
function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Helper: Format date as YYYY-MM-DD
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Get all dates in current week (Mon-Sun)
function getWeekDates(): { date: Date; key: string; dayName: string }[] {
  const weekStart = getWeekStart();
  const dates = [];
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    dates.push({
      date,
      key: formatDateKey(date),
      dayName: dayNames[i],
    });
  }

  return dates;
}

// Helper: Count workouts in current week
function countWorkoutsThisWeek(operator: Operator): number {
  const weekDates = getWeekDates();
  return weekDates.filter((d) => operator.workouts[d.key]).length;
}

// Helper: Calculate streak (consecutive days with workouts ending at today)
function calculateStreak(operator: Operator): number {
  const today = new Date();
  let streak = 0;
  let currentDate = new Date(today);

  while (true) {
    const key = formatDateKey(currentDate);
    if (operator.workouts[key]) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// Helper: Parse prescription to extract reps
function parseReps(prescription: string): number {
  // Prescription format examples: "5 x 5", "3 x 8-10", "AMRAP 10 min", etc.
  const match = prescription.match(/(\d+)\s*x\s*(\d+)/);
  if (match) {
    return parseInt(match[2], 10);
  }
  return 0;
}

// Helper: Calculate total volume for the week
function calculateWeeklyVolume(operator: Operator): number {
  const weekDates = getWeekDates();
  let totalVolume = 0;

  weekDates.forEach((d) => {
    const workout = operator.workouts[d.key];
    if (workout) {
      workout.blocks.forEach((block) => {
        if (block.type === 'exercise') {
          const reps = parseReps(block.prescription);
          // In a real app, we'd look up weight from history/form data
          // For now, we estimate from a standard baseline or use a default
          // This is a simplified calculation
          totalVolume += reps * 135; // Assuming 135 lbs baseline per exercise
        }
      });
    }
  });

  return totalVolume;
}

// Helper: Count PRs
function countPRs(operator: Operator): number {
  return operator.prs.length;
}

// Helper: Get last 5 PRs sorted by date descending
function getRecentPRs(operator: Operator, limit: number = 5) {
  return operator.prs
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

// Helper: Format date for display
function formatPRDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Helper: Check if date is today
function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export const COCDashboard: React.FC<COCDashboardProps> = ({
  operator,
  allOperators,
}) => {
  const workoutsThisWeek = countWorkoutsThisWeek(operator);
  const streak = calculateStreak(operator);
  const volume = calculateWeeklyVolume(operator);
  const prCount = countPRs(operator);
  const recentPRs = getRecentPRs(operator);
  const weekDates = getWeekDates();

  const containerStyle: React.CSSProperties = {
    backgroundColor: '#030303',
    color: '#ccc',
    fontFamily: 'Chakra Petch, sans-serif',
    padding: '24px',
    minHeight: '100vh',
  };

  const heroRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    justifyContent: 'space-between',
  };

  const statCardStyle: React.CSSProperties = {
    flex: '1 1 0',
    border: '1px solid rgba(0, 255, 65, 0.06)',
    borderRadius: '0px',
    padding: '16px 24px',
    backgroundColor: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  };

  const statLabelStyle: React.CSSProperties = {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '8px',
    letterSpacing: '1px',
    color: '#555',
    textTransform: 'uppercase',
    marginBottom: '8px',
    fontWeight: 'bold',
  };

  const statNumberStyle: React.CSSProperties = {
    fontFamily: 'Share Tech Mono, monospace',
    fontSize: '48px',
    color: '#00ff41',
    lineHeight: '1',
    marginBottom: '8px',
    textShadow: '0 0 8px #00ff41, 0 0 16px rgba(0, 255, 65, 0.5)',
    fontWeight: 'bold',
  };

  const statSubtextStyle: React.CSSProperties = {
    fontFamily: 'Chakra Petch, sans-serif',
    fontSize: '9px',
    color: '#555',
    textTransform: 'uppercase',
  };

  const scanlineDividerStyle: React.CSSProperties = {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #00ff41, transparent)',
    marginBottom: '24px',
  };

  const twoColumnLayoutStyle: React.CSSProperties = {
    display: 'flex',
    gap: '24px',
    marginBottom: '24px',
  };

  const leftColumnStyle: React.CSSProperties = {
    flex: '0 0 60%',
  };

  const rightColumnStyle: React.CSSProperties = {
    flex: '0 0 40%',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '8px',
    letterSpacing: '1px',
    color: '#555',
    textTransform: 'uppercase',
    marginBottom: '16px',
    fontWeight: 'bold',
  };

  const weeklyRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '8px',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(0, 255, 65, 0.02)',
  };

  const weeklyRowHighlightStyle: React.CSSProperties = {
    ...weeklyRowStyle,
    backgroundColor: 'rgba(0, 255, 65, 0.04)',
  };

  const dayNameStyle: React.CSSProperties = {
    fontFamily: 'Chakra Petch, sans-serif',
    fontSize: '9px',
    color: '#555',
    textTransform: 'uppercase',
    width: '60px',
    fontWeight: 'bold',
  };

  const workoutCellStyle: React.CSSProperties = {
    flex: '1',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingLeft: '8px',
    borderLeft: '3px solid #00ff41',
  };

  const workoutTitleStyle: React.CSSProperties = {
    fontFamily: 'Chakra Petch, sans-serif',
    fontSize: '9px',
    color: '#ccc',
    flex: '1',
  };

  const blockCountBadgeStyle: React.CSSProperties = {
    fontFamily: 'Share Tech Mono, monospace',
    fontSize: '8px',
    color: '#00ff41',
    border: '1px solid rgba(0, 255, 65, 0.3)',
    padding: '2px 6px',
    clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
  };

  const emptyDayStyle: React.CSSProperties = {
    flex: '1',
    color: '#333',
    fontFamily: 'Chakra Petch, sans-serif',
    fontSize: '9px',
  };

  const prListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  const prRowStyle: React.CSSProperties = {
    borderLeft: '2px solid #00ff41',
    paddingLeft: '12px',
    paddingTop: '8px',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(0, 255, 65, 0.02)',
  };

  const prExerciseStyle: React.CSSProperties = {
    fontFamily: 'Chakra Petch, sans-serif',
    fontSize: '11px',
    color: '#ccc',
    marginBottom: '4px',
  };

  const prStatsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const prWeightRepsStyle: React.CSSProperties = {
    fontFamily: 'Share Tech Mono, monospace',
    fontSize: '11px',
    color: '#00ff41',
  };

  const prDateStyle: React.CSSProperties = {
    fontFamily: 'Chakra Petch, sans-serif',
    fontSize: '9px',
    color: '#555',
  };

  const readinessPanelStyle: React.CSSProperties = {
    border: '1px solid rgba(0, 255, 65, 0.06)',
    borderRadius: '0px',
    padding: '16px 24px',
    backgroundColor: 'transparent',
  };

  const readinessTitleStyle: React.CSSProperties = {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '8px',
    letterSpacing: '1px',
    color: '#555',
    textTransform: 'uppercase',
    marginBottom: '16px',
    fontWeight: 'bold',
  };

  const readinessBarContainerStyle: React.CSSProperties = {
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const readinessLabelStyle: React.CSSProperties = {
    fontFamily: 'Chakra Petch, sans-serif',
    fontSize: '9px',
    color: '#888',
    textTransform: 'uppercase',
    width: '80px',
  };

  const readinessTrackStyle: React.CSSProperties = {
    flex: '1',
    height: '6px',
    backgroundColor: 'rgba(0, 255, 65, 0.04)',
    borderRadius: '0px',
    overflow: 'hidden',
    border: '1px solid rgba(0, 255, 65, 0.1)',
  };

  const readinessValueStyle: React.CSSProperties = {
    fontFamily: 'Share Tech Mono, monospace',
    fontSize: '11px',
    color: '#00ff41',
    width: '40px',
    textAlign: 'right',
  };

  const readinessBarFillGreenStyle: (percent: number) => React.CSSProperties = (
    percent
  ) => ({
    height: '100%',
    backgroundColor: '#00ff41',
    width: `${Math.min(percent, 100)}%`,
    transition: 'width 0.3s ease',
  });

  const readinessBarFillCyanStyle: (percent: number) => React.CSSProperties = (
    percent
  ) => ({
    height: '100%',
    backgroundColor: '#00d4ff',
    width: `${Math.min(percent, 100)}%`,
    transition: 'width 0.3s ease',
  });

  const readinessBarFillAmberStyle: (percent: number) => React.CSSProperties = (
    percent
  ) => ({
    height: '100%',
    backgroundColor: '#ffaa00',
    width: `${Math.min(percent, 100)}%`,
    transition: 'width 0.3s ease',
  });

  // Readiness metrics
  const readinessValue = operator.profile.readiness;
  const sleepPercent = (operator.profile.sleep / 10) * 100;
  const stressPercent = (operator.profile.stress / 10) * 100;

  return (
    <div style={containerStyle}>
      {/* Hero Stats Row */}
      <div style={heroRowStyle}>
        {/* Workouts This Week */}
        <div style={statCardStyle}>
          <div style={statLabelStyle}>WORKOUTS THIS WEEK</div>
          <div style={statNumberStyle}>{workoutsThisWeek}</div>
          <div style={statSubtextStyle}>// THIS WEEK'S SESSIONS</div>
        </div>

        {/* Streak */}
        <div style={statCardStyle}>
          <div style={statLabelStyle}>STREAK</div>
          <div style={statNumberStyle}>{streak}</div>
          <div style={statSubtextStyle}>// CONSECUTIVE DAYS</div>
        </div>

        {/* Volume */}
        <div style={statCardStyle}>
          <div style={statLabelStyle}>VOLUME</div>
          <div style={statNumberStyle}>{volume.toLocaleString()}</div>
          <div style={statSubtextStyle}>// LBS MOVED THIS WEEK</div>
        </div>

        {/* Personal Records */}
        <div style={statCardStyle}>
          <div style={statLabelStyle}>PERSONAL RECORDS</div>
          <div style={statNumberStyle}>{prCount}</div>
          <div style={statSubtextStyle}>// LIFETIME RECORDS</div>
        </div>
      </div>

      {/* Scanline Divider */}
      <div style={scanlineDividerStyle}></div>

      {/* Two-Column Layout */}
      <div style={twoColumnLayoutStyle}>
        {/* Left Column: Weekly Overview */}
        <div style={leftColumnStyle}>
          <div style={sectionHeaderStyle}>WEEKLY OPERATIONS</div>

          {weekDates.map((dayInfo) => {
            const workout = operator.workouts[dayInfo.key];
            const isTodayFlag = isToday(dayInfo.date);
            const rowStyle = isTodayFlag ? weeklyRowHighlightStyle : weeklyRowStyle;

            return (
              <div key={dayInfo.key} style={rowStyle}>
                <div style={dayNameStyle}>{dayInfo.dayName}</div>
                {workout ? (
                  <div style={workoutCellStyle}>
                    <div style={workoutTitleStyle}>{workout.title}</div>
                    <div style={blockCountBadgeStyle}>
                      {workout.blocks.length}
                    </div>
                  </div>
                ) : (
                  <div style={emptyDayStyle}>—</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column: Recent PRs */}
        <div style={rightColumnStyle}>
          <div style={sectionHeaderStyle}>RECENT PR BOARD</div>

          {recentPRs.length > 0 ? (
            <div style={prListStyle}>
              {recentPRs.map((pr) => (
                <div key={pr.id} style={prRowStyle}>
                  <div style={prExerciseStyle}>{pr.exercise}</div>
                  <div style={prStatsStyle}>
                    <div style={prWeightRepsStyle}>
                      {pr.weight}lbs x {pr.reps}
                    </div>
                    <div style={prDateStyle}>{formatPRDate(pr.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                fontFamily: 'Chakra Petch, sans-serif',
                fontSize: '9px',
                color: '#555',
                textAlign: 'center',
                padding: '32px 16px',
              }}
            >
              NO RECORDS LOGGED YET
            </div>
          )}
        </div>
      </div>

      {/* Readiness Panel */}
      <div style={readinessPanelStyle}>
        <div style={readinessTitleStyle}>OPERATOR READINESS</div>

        {/* Readiness Bar */}
        <div style={readinessBarContainerStyle}>
          <div style={readinessLabelStyle}>READINESS</div>
          <div style={readinessTrackStyle}>
            <div style={readinessBarFillGreenStyle(readinessValue)}></div>
          </div>
          <div style={readinessValueStyle}>{readinessValue}%</div>
        </div>

        {/* Sleep Bar */}
        <div style={readinessBarContainerStyle}>
          <div style={readinessLabelStyle}>SLEEP</div>
          <div style={readinessTrackStyle}>
            <div style={readinessBarFillCyanStyle(sleepPercent)}></div>
          </div>
          <div style={readinessValueStyle}>
            {operator.profile.sleep}/10
          </div>
        </div>

        {/* Stress Bar */}
        <div style={readinessBarContainerStyle}>
          <div style={readinessLabelStyle}>STRESS</div>
          <div style={readinessTrackStyle}>
            <div style={readinessBarFillAmberStyle(stressPercent)}></div>
          </div>
          <div style={readinessValueStyle}>
            {operator.profile.stress}/10
          </div>
        </div>
      </div>
    </div>
  );
};

export default COCDashboard;
