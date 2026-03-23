'use client';

import React, { useMemo, useState } from 'react';
import { Operator } from '@/lib/types';

interface SocialFeedProps {
  operators: Operator[];
  currentOperator: Operator;
}

interface FeedItem {
  id: string;
  operatorId: string;
  callsign: string;
  teamId?: string;
  type: 'workout' | 'pr' | 'streak' | 'intake' | 'badge';
  title: string;
  detail: string;
  timestamp: number;
  icon: string;
}

const SocialFeed: React.FC<SocialFeedProps> = ({ operators, currentOperator }) => {
  const [filter, setFilter] = useState<'all' | 'team' | 'mine'>('all');

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    operators.forEach(op => {
      // Workout completions
      Object.entries(op.workouts || {}).forEach(([dateStr, workout]) => {
        if (workout.completed) {
          items.push({
            id: `wk-${op.id}-${dateStr}`,
            operatorId: op.id,
            callsign: op.callsign,
            teamId: op.teamId,
            type: 'workout',
            title: `completed ${workout.title}`,
            detail: `${workout.blocks?.length || 0} exercises`,
            timestamp: new Date(dateStr).getTime(),
            icon: '💪',
          });
        }
      });

      // PRs
      (op.prs || []).forEach(pr => {
        items.push({
          id: `pr-${op.id}-${pr.id}`,
          operatorId: op.id,
          callsign: op.callsign,
          teamId: op.teamId,
          type: 'pr',
          title: `hit a new PR on ${pr.exercise}`,
          detail: `${pr.weight} lbs x ${pr.reps}`,
          timestamp: new Date(pr.date).getTime(),
          icon: '🏆',
        });
      });

      // Intake completion
      if (op.intake && (op.intake as unknown as Record<string, unknown>).completed !== false) {
        items.push({
          id: `intake-${op.id}`,
          operatorId: op.id,
          callsign: op.callsign,
          teamId: op.teamId,
          type: 'intake',
          title: 'completed intake assessment',
          detail: `Fitness Level: ${op.fitnessLevel || 'assessed'}`,
          timestamp: Date.now() - 86400000, // approximate
          icon: '📋',
        });
      }
    });

    // Sort by most recent
    items.sort((a, b) => b.timestamp - a.timestamp);

    // Filter
    if (filter === 'team') {
      return items.filter(i => i.teamId === currentOperator.teamId);
    }
    if (filter === 'mine') {
      return items.filter(i => i.operatorId === currentOperator.id);
    }
    return items;
  }, [operators, currentOperator, filter]);

  const getTeamBadge = (teamId?: string) => {
    if (teamId === 'team-wolf-pack') return { name: 'WOLF PACK', color: '#00ff41' };
    if (teamId === 'team-madheart') return { name: 'MADHEART', color: '#FF8C00' };
    return null;
  };

  const getTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  };

  const typeColors: Record<string, string> = {
    workout: '#00ff41',
    pr: '#ffb800',
    streak: '#ff6600',
    intake: '#00ff41',
    badge: '#FF8C00',
  };

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['all', 'team', 'mine'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700,
            background: filter === f ? '#00ff41' : '#0a0a0a',
            color: filter === f ? '#000' : '#888',
            border: `1px solid ${filter === f ? '#00ff41' : '#333'}`,
            borderRadius: 4, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
          }}>
            {f === 'team' ? 'MY SQUAD' : f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {feedItems.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#555', fontFamily: 'Share Tech Mono', fontSize: 12 }}>
            No activity yet. Start training to see the feed come alive.
          </div>
        )}
        {feedItems.slice(0, 50).map(item => {
          const team = getTeamBadge(item.teamId);
          const isMe = item.operatorId === currentOperator.id;
          return (
            <div key={item.id} style={{
              padding: '10px 14px', background: isMe ? '#0a1a0a' : '#0a0a0a',
              border: `1px solid ${isMe ? 'rgba(0,255,65,0.15)' : '#1a1a1a'}`,
              borderLeft: `3px solid ${typeColors[item.type] || '#333'}`,
              borderRadius: 4,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'Chakra Petch, sans-serif', fontSize: 13 }}>
                      <span style={{ color: '#00ff41', fontWeight: 700 }}>{item.callsign}</span>
                      {team && (
                        <span style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: team.color, marginLeft: 6, padding: '1px 4px', border: `1px solid ${team.color}33`, borderRadius: 2 }}>
                          {team.name}
                        </span>
                      )}
                      <span style={{ color: '#888', marginLeft: 4 }}>{item.title}</span>
                    </div>
                    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: typeColors[item.type], marginTop: 2 }}>
                      {item.detail}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#555', whiteSpace: 'nowrap' }}>
                  {getTimeAgo(item.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SocialFeed;
