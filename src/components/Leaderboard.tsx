'use client';

import React, { useState, useMemo } from 'react';
import { Operator, TEAMS, LEADERBOARD_POINTS } from '@/lib/types';
import { getLocalDateStr, toLocalDateStr } from '@/lib/dateUtils';

interface LeaderboardProps {
  operators: Operator[];
  currentUser: Operator;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ operators, currentUser }) => {
  const [teamFilter, setTeamFilter] = useState<string>('all');

  // Calculate points for each operator
  const leaderboardData = useMemo(() => {
    return operators.map(op => {
      const workoutsCompleted = Object.values(op.workouts || {}).filter(w => w.completed).length;
      const todayStr = getLocalDateStr();
      const mealsLogged = Object.values(op.nutrition?.meals || {}).reduce((sum, meals) => sum + (Array.isArray(meals) ? meals.length : 0), 0);
      // Exclude milestone-type PRs that are explicitly not yet achieved
      const prsHit = (op.prs || []).filter(pr => pr.achieved !== false).length;
      // Wearable counts as connected if intake recorded a device other than "none"
      const wearable = (op.intake?.wearableDevice ?? '').toLowerCase();
      const wearableConnected = wearable !== '' && wearable !== 'none' && wearable !== 'no';

      // Calculate streak (consecutive days with completed workout)
      let streak = 0;
      const date = new Date();
      for (let i = 0; i < 365; i++) {
        const dateStr = toLocalDateStr(date);
        const workout = op.workouts?.[dateStr];
        if (workout?.completed) {
          streak++;
          date.setDate(date.getDate() - 1);
        } else if (i === 0) {
          // Today might not be done yet, check yesterday
          date.setDate(date.getDate() - 1);
          continue;
        } else {
          break;
        }
      }

      // Calculate points
      let points = 0;
      points += workoutsCompleted * LEADERBOARD_POINTS.workoutCompleted;
      points += mealsLogged * LEADERBOARD_POINTS.mealLogged;
      points += prsHit * LEADERBOARD_POINTS.prHit;
      if (streak >= 30) points += LEADERBOARD_POINTS.streakBonus30;
      else if (streak >= 7) points += LEADERBOARD_POINTS.streakBonus7;
      if (op.intake?.completed) points += LEADERBOARD_POINTS.intakeCompleted;
      if (wearableConnected) points += LEADERBOARD_POINTS.wearableConnected;

      // Find team
      const team = TEAMS.find(t => t.memberIds.includes(op.id));

      // Consistency score: workouts / expected workouts
      const daysActive = Math.max(1, Math.floor((Date.now() - new Date(op.betaStartDate || '2026-03-01').getTime()) / (1000 * 60 * 60 * 24)));
      const expectedWorkouts = Math.floor(daysActive * (op.preferences?.daysPerWeek || 3) / 7);
      const consistencyScore = expectedWorkouts > 0 ? Math.min(100, Math.round((workoutsCompleted / expectedWorkouts) * 100)) : 0;

      return {
        operatorId: op.id,
        callsign: op.callsign,
        name: op.name,
        teamId: team?.id || '',
        teamName: team?.name || 'UNASSIGNED',
        points,
        streak,
        workoutsCompleted,
        mealsLogged,
        prsHit,
        consistencyScore,
        avatar: op.avatar,
        fitnessLevel: op.fitnessLevel,
      };
    }).sort((a, b) => b.points - a.points);
  }, [operators]);

  const filteredData = teamFilter === 'all'
    ? leaderboardData
    : leaderboardData.filter(d => d.teamId === teamFilter);

  // Team totals
  const teamTotals = useMemo(() => {
    return TEAMS.map(team => {
      const members = leaderboardData.filter(d => d.teamId === team.id);
      return {
        ...team,
        totalPoints: members.reduce((sum, m) => sum + m.points, 0),
        memberCount: members.length,
        avgConsistency: members.length > 0 ? Math.round(members.reduce((sum, m) => sum + m.consistencyScore, 0) / members.length) : 0,
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [leaderboardData]);

  const getRankColor = (idx: number) => {
    if (idx === 0) return '#ffd700'; // gold
    if (idx === 1) return '#888888'; // silver
    if (idx === 2) return '#cd7f32'; // bronze
    return '#888';
  };

  const getRankIcon = (idx: number) => {
    if (idx === 0) return '🥇';
    if (idx === 1) return '🥈';
    if (idx === 2) return '🥉';
    return `#${idx + 1}`;
  };

  return (
    <div style={{ padding: '0 16px 80px', maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#00ff41', letterSpacing: 2, marginBottom: 16 }}>
        LEADERBOARD
      </h2>

      {/* Team Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setTeamFilter('all')}
          style={{ padding: '6px 14px', background: teamFilter === 'all' ? '#00ff41' : '#0a0a0a', color: teamFilter === 'all' ? '#000' : '#888', border: `1px solid ${teamFilter === 'all' ? '#00ff41' : '#333'}`, fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, cursor: 'pointer', borderRadius: 4, letterSpacing: 1 }}>
          ALL
        </button>
        {TEAMS.map(team => (
          <button key={team.id} onClick={() => setTeamFilter(team.id)}
            style={{ padding: '6px 14px', background: teamFilter === team.id ? '#00ff41' : '#0a0a0a', color: teamFilter === team.id ? '#000' : '#888', border: `1px solid ${teamFilter === team.id ? '#00ff41' : '#333'}`, fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, cursor: 'pointer', borderRadius: 4, letterSpacing: 1 }}>
            {team.name}
          </button>
        ))}
      </div>

      {/* Team Standings */}
      {teamFilter === 'all' && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#ffb800', letterSpacing: 1, marginBottom: 10 }}>TEAM STANDINGS</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {teamTotals.map((team, idx) => (
              <div key={team.id} style={{ flex: 1, padding: 12, background: '#0a0a0a', border: `1px solid ${idx === 0 ? '#ffb800' : '#333'}`, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, color: idx === 0 ? '#ffb800' : '#00ff41', marginBottom: 4 }}>{team.name}</div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 22, color: '#e0e0e0', fontWeight: 700 }}>{team.totalPoints}</div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#666' }}>{team.memberCount} members | {team.avgConsistency}% consistency</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual Rankings */}
      <div>
        {filteredData.map((entry, idx) => {
          const isCurrentUser = entry.operatorId === currentUser.id;
          return (
            <div key={entry.operatorId} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 4,
              background: isCurrentUser ? 'rgba(0, 255, 65, 0.05)' : '#0a0a0a',
              border: `1px solid ${isCurrentUser ? 'rgba(0, 255, 65, 0.2)' : '#1a1a1a'}`,
              borderRadius: 4, transition: 'all 0.2s',
            }}>
              {/* Rank */}
              <div style={{ width: 36, textAlign: 'center', fontFamily: 'Share Tech Mono', fontSize: 14, color: getRankColor(idx) }}>
                {getRankIcon(idx)}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: isCurrentUser ? '#00ff41' : '#e0e0e0', letterSpacing: 1 }}>
                    {entry.callsign}
                  </span>
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#666', padding: '1px 6px', background: '#1a1a1a', borderRadius: 3 }}>
                    {entry.teamName}
                  </span>
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#666', marginTop: 2 }}>
                  {entry.workoutsCompleted} workouts | {entry.mealsLogged} meals | {entry.prsHit} PRs | {entry.streak}d streak | {entry.consistencyScore}% consistency
                </div>
              </div>

              {/* Points */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, color: '#ffb800', fontWeight: 700 }}>{entry.points}</div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#666' }}>PTS</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Points Legend */}
      <div style={{ marginTop: 20, padding: 12, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4 }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#666', letterSpacing: 1, marginBottom: 8 }}>HOW POINTS WORK</div>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: '#888', lineHeight: 1.8 }}>
          Workout Completed: +{LEADERBOARD_POINTS.workoutCompleted} | Meal Logged: +{LEADERBOARD_POINTS.mealLogged} | PR Hit: +{LEADERBOARD_POINTS.prHit} | 7-Day Streak: +{LEADERBOARD_POINTS.streakBonus7} | 30-Day Streak: +{LEADERBOARD_POINTS.streakBonus30} | Intake Done: +{LEADERBOARD_POINTS.intakeCompleted} | Wearable Connected: +{LEADERBOARD_POINTS.wearableConnected}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
