'use client';

import React, { useState, useMemo } from 'react';
import { Operator, PRRecord } from '@/lib/types';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { hasOperatorAccess } from '@/lib/tierGates';
import UpgradeCard from '@/components/UpgradeCard';

interface ProgressChartsProps {
  operator: Operator;
  // Viewer (the logged-in user). Gating uses the VIEWER's tier — a
  // trainer/admin viewing a client can always see charts even if the
  // client is on a lower tier. Defaults to `operator` for backwards
  // compat (self-view of own profile).
  currentUser?: Operator;
  onOpenBilling?: () => void;
}

type ChartView = 'volume' | 'strength' | 'bodyComp' | 'frequency' | 'nutrition';

const ProgressCharts: React.FC<ProgressChartsProps> = ({ operator, currentUser, onOpenBilling }) => {
  const viewer = currentUser ?? operator;
  const canViewCharts = hasOperatorAccess(viewer);

  if (!canViewCharts) {
    return (
      <UpgradeCard
        feature="Analytics & Progression Charts"
        requiredTier="sonnet"
        description="Volume tracking, strength curves, workout frequency, body composition, and 14-day nutrition trends. Upgrade to OPERATOR to unlock the full analytics surface."
        onUpgrade={onOpenBilling}
      />
    );
  }


  const [activeChart, setActiveChart] = useState<ChartView>('volume');

  // Build workout frequency data (last 12 weeks)
  const frequencyData = useMemo(() => {
    const weeks: { week: string; workouts: number; completed: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      let count = 0;
      let completed = 0;
      Object.entries(operator.workouts || {}).forEach(([dateStr]) => {
        const d = new Date(dateStr);
        if (d >= weekStart && d <= weekEnd) {
          count++;
          if (operator.workouts[dateStr]?.completed) completed++;
        }
      });

      const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      weeks.push({ week: label, workouts: count, completed });
    }
    return weeks;
  }, [operator.workouts]);

  // Build volume data (total sets x reps x weight per workout, last 30 days)
  const volumeData = useMemo(() => {
    const data: { date: string; volume: number; sets: number }[] = [];
    const workoutEntries = Object.entries(operator.workouts || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30);

    workoutEntries.forEach(([dateStr, workout]) => {
      let totalVolume = 0;
      let totalSets = 0;
      (workout.blocks || []).forEach(block => {
        if (block.type === 'exercise' && block.prescription) {
          const setsMatch = block.prescription.match(/(\d+)\s*x\s*(\d+)/);
          const weightMatch = block.prescription.match(/@\s*(\d+)/);
          if (setsMatch) {
            const sets = parseInt(setsMatch[1]);
            const reps = parseInt(setsMatch[2]);
            const weight = weightMatch ? parseInt(weightMatch[1]) : 0;
            totalSets += sets;
            totalVolume += sets * reps * weight;
          }
        }
      });
      const label = dateStr.slice(5); // MM-DD
      data.push({ date: label, volume: totalVolume, sets: totalSets });
    });
    return data;
  }, [operator.workouts]);

  // Build strength curves from PR data
  const strengthData = useMemo(() => {
    const exerciseMap: Record<string, { date: string; weight: number }[]> = {};
    (operator.prs || []).forEach((pr: PRRecord) => {
      if (!exerciseMap[pr.exercise]) exerciseMap[pr.exercise] = [];
      exerciseMap[pr.exercise].push({ date: pr.date.slice(5), weight: pr.weight });
    });
    // Sort by date
    Object.values(exerciseMap).forEach(arr => arr.sort((a, b) => a.date.localeCompare(b.date)));
    return exerciseMap;
  }, [operator.prs]);

  // Build body comp data from profile snapshots (simulated from available data)
  const bodyCompData = useMemo(() => {
    const data: { date: string; weight: number; bodyFat: number }[] = [];
    // Use current profile data as the most recent point
    const profile = operator.profile;
    if (profile?.weight) {
      data.push({
        date: 'Current',
        weight: typeof profile.weight === 'number' ? profile.weight : parseInt(profile.weight as string) || 0,
        bodyFat: typeof profile.bodyFat === 'number' ? profile.bodyFat : parseFloat(profile.bodyFat as string) || 0,
      });
    }
    // If intake data exists, use it as baseline
    if (operator.intake) {
      const intakeData = operator.intake as unknown as Record<string, unknown>;
      const intakeWeight = intakeData.weight || intakeData.currentWeight;
      if (intakeWeight) {
        const intakeBf = intakeData.bodyFat;
        data.unshift({
          date: 'Intake',
          weight: typeof intakeWeight === 'number' ? intakeWeight : parseInt(intakeWeight as string) || 0,
          bodyFat: typeof intakeBf === 'number' ? intakeBf : parseFloat(intakeBf as string) || 0,
        });
      }
    }
    return data;
  }, [operator.profile, operator.intake]);

  // Build nutrition data from meal logs
  const nutritionData = useMemo(() => {
    const data: { date: string; calories: number; protein: number }[] = [];
    const meals = operator.nutrition?.meals || {};
    Object.entries(meals)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14) // Last 2 weeks
      .forEach(([dateStr, dayMeals]) => {
        let totalCal = 0;
        let totalPro = 0;
        (dayMeals as Array<{ calories: number; protein: number }>).forEach(m => {
          totalCal += m.calories || 0;
          totalPro += m.protein || 0;
        });
        data.push({ date: dateStr.slice(5), calories: totalCal, protein: totalPro });
      });
    return data;
  }, [operator.nutrition]);

  const chartTabs: { key: ChartView; label: string; icon: string }[] = [
    { key: 'volume', label: 'VOLUME', icon: '📊' },
    { key: 'strength', label: 'STRENGTH', icon: '💪' },
    { key: 'frequency', label: 'FREQUENCY', icon: '📅' },
    { key: 'nutrition', label: 'NUTRITION', icon: '🍗' },
    { key: 'bodyComp', label: 'BODY COMP', icon: '⚖️' },
  ];

  const strengthExercises = Object.keys(strengthData);
  const [selectedExercise, setSelectedExercise] = useState(strengthExercises[0] || '');

  const tooltipStyle = {
    backgroundColor: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: 4,
    fontFamily: 'Share Tech Mono, monospace',
    fontSize: 11,
  };

  return (
    <div style={{ padding: '0 0 16px 0' }}>
      {/* Chart tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {chartTabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveChart(tab.key)} style={{
            padding: '6px 12px', fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700,
            background: activeChart === tab.key ? '#00ff41' : '#0a0a0a',
            color: activeChart === tab.key ? '#000' : '#888',
            border: `1px solid ${activeChart === tab.key ? '#00ff41' : '#333'}`,
            borderRadius: 4, cursor: 'pointer', letterSpacing: 1,
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Volume Chart */}
      {activeChart === 'volume' && (
        <div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#00ff41', marginBottom: 12, letterSpacing: 1 }}>
            TRAINING VOLUME (LAST 30 DAYS)
          </div>
          {volumeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 10, fontFamily: 'Share Tech Mono' }} />
                <YAxis stroke="#555" tick={{ fontSize: 10, fontFamily: 'Share Tech Mono' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="volume" stroke="#00ff41" fill="rgba(0,255,65,0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#555', fontFamily: 'Share Tech Mono', fontSize: 12 }}>
              No workout data yet. Complete workouts to see volume trends.
            </div>
          )}
        </div>
      )}

      {/* Strength Curves */}
      {activeChart === 'strength' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#ffb800', letterSpacing: 1 }}>
              STRENGTH CURVES (PR HISTORY)
            </div>
            {strengthExercises.length > 0 && (
              <select value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)} style={{
                padding: '4px 8px', background: '#0a0a0a', border: '1px solid #333', color: '#ccc',
                fontFamily: 'Share Tech Mono', fontSize: 11, borderRadius: 4,
              }}>
                {strengthExercises.map(ex => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            )}
          </div>
          {selectedExercise && strengthData[selectedExercise]?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={strengthData[selectedExercise]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 10, fontFamily: 'Share Tech Mono' }} />
                <YAxis stroke="#555" tick={{ fontSize: 10, fontFamily: 'Share Tech Mono' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="weight" stroke="#ffb800" strokeWidth={2} dot={{ fill: '#ffb800', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#555', fontFamily: 'Share Tech Mono', fontSize: 12 }}>
              Log PRs to see strength progression curves.
            </div>
          )}
        </div>
      )}

      {/* Frequency Chart */}
      {activeChart === 'frequency' && (
        <div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#00ff41', marginBottom: 12, letterSpacing: 1 }}>
            WORKOUT FREQUENCY (12 WEEKS)
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={frequencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="week" stroke="#555" tick={{ fontSize: 10, fontFamily: 'Share Tech Mono' }} />
              <YAxis stroke="#555" tick={{ fontSize: 10, fontFamily: 'Share Tech Mono' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="workouts" fill="#00ff41" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" fill="#00ff41" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontFamily: 'Share Tech Mono', fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Nutrition Chart */}
      {activeChart === 'nutrition' && (
        <div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#FF8C00', marginBottom: 12, letterSpacing: 1 }}>
            NUTRITION TRACKING (14 DAYS)
          </div>
          {nutritionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={nutritionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 10, fontFamily: 'Share Tech Mono' }} />
                <YAxis yAxisId="cal" orientation="left" stroke="#555" tick={{ fontSize: 10, fontFamily: 'Share Tech Mono' }} />
                <YAxis yAxisId="pro" orientation="right" stroke="#555" tick={{ fontSize: 10, fontFamily: 'Share Tech Mono' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar yAxisId="cal" dataKey="calories" fill="rgba(255,140,0,0.6)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="pro" dataKey="protein" fill="rgba(0,255,65,0.6)" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontFamily: 'Share Tech Mono', fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#555', fontFamily: 'Share Tech Mono', fontSize: 12 }}>
              Log meals to see nutrition trends.
            </div>
          )}
        </div>
      )}

      {/* Body Comp Chart */}
      {activeChart === 'bodyComp' && (
        <div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#ff6600', marginBottom: 12, letterSpacing: 1 }}>
            BODY COMPOSITION TRACKER
          </div>
          {bodyCompData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={bodyCompData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 10, fontFamily: 'Share Tech Mono' }} />
                <YAxis yAxisId="weight" orientation="left" stroke="#555" tick={{ fontSize: 10, fontFamily: 'Share Tech Mono' }} />
                <YAxis yAxisId="bf" orientation="right" stroke="#555" tick={{ fontSize: 10, fontFamily: 'Share Tech Mono' }} domain={[0, 40]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="#ff6600" strokeWidth={2} dot={{ fill: '#ff6600', r: 4 }} name="Weight (lbs)" />
                <Line yAxisId="bf" type="monotone" dataKey="bodyFat" stroke="#00ff41" strokeWidth={2} dot={{ fill: '#00ff41', r: 4 }} name="Body Fat %" />
                <Legend wrapperStyle={{ fontFamily: 'Share Tech Mono', fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#555', fontFamily: 'Share Tech Mono', fontSize: 12 }}>
              Complete intake assessment to set baseline body comp data.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressCharts;
