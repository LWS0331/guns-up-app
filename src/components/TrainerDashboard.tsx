'use client';

import React, { useState } from 'react';
import { Operator, TIER_CONFIGS, TEAMS, getTrainerRank, TRAINER_RANKS } from '@/lib/types';
import { formatLocalDateKey } from '@/lib/dateUtils';

interface TrainerDashboardProps {
  trainer: Operator;
  allOperators: Operator[];
  onUpdateOperator: (op: Operator) => void;
}

const TrainerDashboard: React.FC<TrainerDashboardProps> = ({ trainer, allOperators, onUpdateOperator }) => {
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [directiveText, setDirectiveText] = useState('');

  // Get all clients for this trainer
  const clients = allOperators.filter(op => op.trainerId === trainer.id && op.role === 'client');

  // Calculate revenue metrics
  const calculateRevenue = () => {
    let totalMonthly = 0;
    const byTier: Record<string, { count: number; monthly: number }> = {};

    clients.forEach(client => {
      const tierKey = client.tier as keyof typeof TIER_CONFIGS;
      const tierConfig = TIER_CONFIGS[tierKey];
      const monthlyShare = tierConfig.trainerShare;

      totalMonthly += monthlyShare;

      if (!byTier[tierKey]) {
        byTier[tierKey] = { count: 0, monthly: 0 };
      }
      byTier[tierKey].count += 1;
      byTier[tierKey].monthly += monthlyShare;
    });

    return { totalMonthly, byTier };
  };

  // Get last workout date for a client. The workouts record is keyed by
  // YYYY-MM-DD in the operator's local timezone; passing that to new Date()
  // parses as UTC and shifts the display date west for non-UTC viewers.
  // formatLocalDateKey constructs the Date at local midnight so "Apr 22"
  // stays "Apr 22" for PST (and everywhere else).
  const getLastWorkoutDate = (client: Operator): string => {
    const workouts = Object.keys(client.workouts || {}).sort().reverse();
    if (workouts.length === 0) return 'Never';
    return formatLocalDateKey(workouts[0]);
  };

  // Get workouts this week
  const getWorkoutsThisWeek = (client: Operator): number => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return Object.keys(client.workouts || {}).filter(dateStr => {
      const workoutDate = new Date(dateStr);
      return workoutDate >= weekAgo && workoutDate <= today;
    }).length;
  };

  // Calculate streak
  const getStreak = (client: Operator): number => {
    const dates = Object.keys(client.workouts || {}).sort().reverse();
    if (dates.length === 0) return 0;

    let streak = 1;
    const today = new Date();
    let currentDate = new Date(dates[0]);

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i]);
      const dayDiff = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (dayDiff === 1) {
        streak++;
        currentDate = prevDate;
      } else {
        break;
      }
    }

    // Check if streak is still active
    const daysSinceLastWorkout = Math.floor((today.getTime() - new Date(dates[0]).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLastWorkout > 1) return 0;

    return streak;
  };

  // Get client status
  const getClientStatus = (client: Operator): string => {
    const lastWorkoutDate = new Date(Object.keys(client.workouts || {}).sort().reverse()[0] || '');
    const daysSince = Math.floor((new Date().getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince <= 7 ? 'ACTIVE' : 'INACTIVE';
  };

  // Handle sending directive
  const handleSendDirective = () => {
    if (!selectedClientId || !directiveText.trim()) return;

    const client = allOperators.find(op => op.id === selectedClientId);
    if (!client) return;

    const updated = {
      ...client,
      trainerNotes: directiveText.trim(),
    };

    onUpdateOperator(updated);
    setDirectiveText('');
    setSelectedClientId(null);
  };

  const { totalMonthly, byTier } = calculateRevenue();
  const clientCount = clients.length;
  const trainerRank = getTrainerRank(clientCount);
  const rankConfig = TRAINER_RANKS[trainerRank];
  const projectedAnnual = totalMonthly * 12;

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#0a0a0a',
      color: '#e0e0e0',
      fontFamily: '"Chakra Petch", sans-serif',
      minHeight: '100%',
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '2px solid #1a1a2e',
      }}>
        <h1 style={{
          fontSize: '28px',
          fontFamily: '"Orbitron", sans-serif',
          color: '#00ff41',
          margin: '0 0 10px 0',
          letterSpacing: '2px',
        }}>
          TRAINER COMMAND CENTER
        </h1>
        <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>
          {trainer.callsign} • {clientCount} CLIENTS • {trainerRank.toUpperCase()}
        </p>
      </div>

      {/* Revenue Breakdown */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '30px',
      }}>
        {/* Total Revenue Card */}
        <div style={{
          backgroundColor: '#111',
          border: '1px solid #1a1a2e',
          padding: '20px',
          borderRadius: '4px',
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>
            Monthly Revenue
          </p>
          <div style={{
            fontSize: '32px',
            fontFamily: '"Orbitron", sans-serif',
            color: '#00ff41',
            margin: '0 0 8px 0',
          }}>
            ${totalMonthly.toFixed(2)}
          </div>
          <p style={{ margin: 0, fontSize: '10px', color: '#666' }}>
            Annual: ${projectedAnnual.toFixed(2)}
          </p>
        </div>

        {/* Rank Card */}
        <div style={{
          backgroundColor: '#111',
          border: '1px solid #1a1a2e',
          padding: '20px',
          borderRadius: '4px',
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>
            Rank
          </p>
          <div style={{
            fontSize: '28px',
            fontFamily: '"Orbitron", sans-serif',
            color: '#00ff41',
            margin: '0 0 8px 0',
          }}>
            {rankConfig.name}
          </div>
          <p style={{ margin: 0, fontSize: '10px', color: '#666' }}>
            {rankConfig.shareBonus}% bonus on trainer share
          </p>
        </div>

        {/* By Tier */}
        {Object.entries(byTier).map(([tierKey, tierData]) => {
          const tierConfig = TIER_CONFIGS[tierKey as keyof typeof TIER_CONFIGS];
          return (
            <div key={tierKey} style={{
              backgroundColor: '#111',
              border: '1px solid #1a1a2e',
              padding: '20px',
              borderRadius: '4px',
            }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>
                {tierConfig.name}
              </p>
              <div style={{
                fontSize: '24px',
                fontFamily: '"Orbitron", sans-serif',
                color: '#00ff41',
                margin: '0 0 8px 0',
              }}>
                {tierData.count} CLIENTS
              </div>
              <p style={{ margin: 0, fontSize: '10px', color: '#666' }}>
                ${tierData.monthly.toFixed(2)}/month
              </p>
            </div>
          );
        })}
      </div>

      {/* Team Overview */}
      <div style={{
        backgroundColor: '#111',
        border: '1px solid #1a1a2e',
        padding: '20px',
        marginBottom: '30px',
        borderRadius: '4px',
      }}>
        <h2 style={{
          fontSize: '14px',
          fontFamily: '"Orbitron", sans-serif',
          color: '#00ff41',
          margin: '0 0 15px 0',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          TEAM OVERVIEW
        </h2>
        {trainer.teamId ? (
          (() => {
            const team = TEAMS.find(t => t.id === trainer.teamId);
            return team ? (
              <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>
                  <strong>{team.name}</strong>
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>
                  {team.memberIds.length} members
                </p>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>No team assigned</p>
            );
          })()
        ) : (
          <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>No team assigned</p>
        )}
      </div>

      {/* Client Roster Table */}
      <div style={{
        marginBottom: '30px',
      }}>
        <h2 style={{
          fontSize: '14px',
          fontFamily: '"Orbitron", sans-serif',
          color: '#00ff41',
          margin: '0 0 15px 0',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          CLIENT ROSTER
        </h2>

        {clients.length === 0 ? (
          <div style={{
            backgroundColor: '#111',
            border: '1px solid #1a1a2e',
            padding: '20px',
            borderRadius: '4px',
            textAlign: 'center',
            color: '#888',
          }}>
            No clients assigned yet
          </div>
        ) : (
          <div style={{
            overflowX: 'auto',
            backgroundColor: '#111',
            borderRadius: '4px',
            border: '1px solid #1a1a2e',
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            }}>
              <thead>
                <tr style={{
                  backgroundColor: '#0a0a0a',
                  borderBottom: '1px solid #1a1a2e',
                }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#00ff41', fontWeight: 'bold' }}>CALLSIGN</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#00ff41', fontWeight: 'bold' }}>TIER</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#00ff41', fontWeight: 'bold' }}>LAST WORKOUT</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#00ff41', fontWeight: 'bold' }}>THIS WEEK</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#00ff41', fontWeight: 'bold' }}>STREAK</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#00ff41', fontWeight: 'bold' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const tierConfig = TIER_CONFIGS[client.tier as keyof typeof TIER_CONFIGS];
                  const status = getClientStatus(client);
                  const isExpanded = expandedClientId === client.id;

                  return (
                    <React.Fragment key={client.id}>
                      <tr
                        onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                        style={{
                          backgroundColor: isExpanded ? '#1a1a2e' : 'transparent',
                          borderBottom: '1px solid #1a1a2e',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isExpanded) {
                            (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#0f0f1a';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isExpanded) {
                            (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <td style={{ padding: '12px', color: '#00ff41' }}>{client.callsign}</td>
                        <td style={{ padding: '12px', color: '#888' }}>
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#1a1a2e',
                            borderRadius: '3px',
                            fontSize: '10px',
                          }}>
                            {tierConfig.name}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: '#888' }}>{getLastWorkoutDate(client)}</td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#00ff41' }}>{getWorkoutsThisWeek(client)}</td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#00ff41' }}>{getStreak(client)}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            color: status === 'ACTIVE' ? '#00ff41' : '#ff6666',
                            fontWeight: 'bold',
                            fontSize: '10px',
                          }}>
                            {status}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded client details */}
                      {isExpanded && (
                        <tr style={{
                          backgroundColor: '#1a1a2e',
                          borderBottom: '1px solid #1a1a2e',
                        }}>
                          <td colSpan={6} style={{ padding: '20px' }}>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '20px',
                            }}>
                              {/* Client Info */}
                              <div>
                                <h3 style={{ margin: '0 0 12px 0', color: '#00ff41', fontSize: '12px', textTransform: 'uppercase' }}>
                                  CLIENT INFO
                                </h3>
                                <p style={{ margin: '6px 0', fontSize: '11px' }}>
                                  <strong>Name:</strong> {client.name}
                                </p>
                                <p style={{ margin: '6px 0', fontSize: '11px' }}>
                                  <strong>Weight:</strong> {client.profile?.weight || 'N/A'} lbs
                                </p>
                                <p style={{ margin: '6px 0', fontSize: '11px' }}>
                                  <strong>Tier:</strong> {tierConfig.name}
                                </p>
                                {client.profile?.goals && client.profile.goals.length > 0 && (
                                  <p style={{ margin: '6px 0', fontSize: '11px' }}>
                                    <strong>Goals:</strong> {client.profile.goals.slice(0, 2).join(', ')}
                                  </p>
                                )}
                              </div>

                              {/* Directive Section */}
                              <div>
                                <h3 style={{ margin: '0 0 12px 0', color: '#00ff41', fontSize: '12px', textTransform: 'uppercase' }}>
                                  SEND DIRECTIVE
                                </h3>
                                <textarea
                                  value={selectedClientId === client.id ? directiveText : (client.trainerNotes || '')}
                                  onChange={(e) => {
                                    if (selectedClientId === client.id) {
                                      setDirectiveText(e.target.value);
                                    }
                                  }}
                                  onFocus={() => setSelectedClientId(client.id)}
                                  placeholder="Enter directives for Gunny AI..."
                                  style={{
                                    width: '100%',
                                    height: '80px',
                                    padding: '10px',
                                    backgroundColor: '#0a0a0a',
                                    border: '1px solid #333',
                                    color: '#e0e0e0',
                                    fontFamily: '"Chakra Petch", sans-serif',
                                    fontSize: '11px',
                                    borderRadius: '3px',
                                    resize: 'vertical',
                                    marginBottom: '10px',
                                  }}
                                  readOnly={selectedClientId !== client.id}
                                />
                                {selectedClientId === client.id && (
                                  <button
                                    onClick={handleSendDirective}
                                    disabled={!directiveText.trim()}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      backgroundColor: directiveText.trim() ? '#00ff41' : '#333',
                                      color: directiveText.trim() ? '#000' : '#666',
                                      border: 'none',
                                      borderRadius: '3px',
                                      cursor: directiveText.trim() ? 'pointer' : 'not-allowed',
                                      fontFamily: '"Orbitron", sans-serif',
                                      fontSize: '11px',
                                      fontWeight: 'bold',
                                      textTransform: 'uppercase',
                                      letterSpacing: '1px',
                                      transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (directiveText.trim()) {
                                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 10px rgba(0,255,65,0.3)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                                    }}
                                  >
                                    SEND DIRECTIVE
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerDashboard;
