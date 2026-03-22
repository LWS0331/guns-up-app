'use client';

import React, { useState } from 'react';
import { Operator, TIER_CONFIGS, AiTier } from '@/lib/types';

interface ClientOnboardingProps {
  operator: Operator;
  allOperators: Operator[];
  onUpdateOperator: (op: Operator) => void;
}

type OnboardingStep = 1 | 2 | 3;

const ClientOnboarding: React.FC<ClientOnboardingProps> = ({ operator, allOperators, onUpdateOperator }) => {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<AiTier | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);

  // Get all trainers
  const trainers = allOperators.filter(op => op.role === 'trainer');

  // Get the selected trainer
  const selectedTrainer = trainers.find(t => t.id === selectedTrainerId);

  // Get tier config
  const tierConfig = selectedTier ? TIER_CONFIGS[selectedTier] : null;
  const price = isAnnual && tierConfig ? tierConfig.annualPrice : tierConfig?.monthlyPrice || 0;
  const priceLabel = isAnnual ? 'per year' : 'per month';

  // Get client count for a trainer
  const getClientCount = (trainerId: string): number => {
    return allOperators.filter(op => op.trainerId === trainerId && op.role === 'client').length;
  };

  // Handle next step
  const handleNext = () => {
    if (step === 1 && selectedTrainerId) {
      setStep(2);
    } else if (step === 2 && selectedTier) {
      setStep(3);
    }
  };

  // Handle back step
  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as OnboardingStep);
    }
  };

  // Handle start beta
  const handleStartBeta = () => {
    if (!selectedTrainerId || !selectedTier) return;

    const updated: Operator = {
      ...operator,
      trainerId: selectedTrainerId,
      tier: selectedTier,
      betaUser: true,
      betaStartDate: new Date().toISOString(),
    };

    onUpdateOperator(updated);
  };

  // Progress bar styling
  const getProgressStyle = () => {
    const progress = ((step - 1) / 2) * 100;
    return {
      width: `${progress}%`,
      backgroundColor: '#00ff41',
      height: '100%',
      transition: 'width 0.3s ease',
    };
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(3, 3, 3, 0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: '"Chakra Petch", sans-serif',
      color: '#e0e0e0',
      padding: '20px',
    }}>
      {/* Modal Container */}
      <div style={{
        width: '100%',
        maxWidth: '700px',
        backgroundColor: '#0a0a0a',
        border: '1px solid #1a1a2e',
        borderRadius: '4px',
        padding: '40px',
        boxShadow: '0 0 30px rgba(0, 255, 65, 0.1)',
      }}>
        {/* Header */}
        <h1 style={{
          fontSize: '28px',
          fontFamily: '"Orbitron", sans-serif',
          color: '#00ff41',
          margin: '0 0 10px 0',
          letterSpacing: '2px',
          textAlign: 'center',
        }}>
          OPERATOR ONBOARDING
        </h1>

        <p style={{
          fontSize: '12px',
          color: '#888',
          textAlign: 'center',
          margin: '0 0 30px 0',
        }}>
          Complete your profile • Select a trainer • Choose your tier
        </p>

        {/* Progress Bar */}
        <div style={{
          backgroundColor: '#111',
          height: '4px',
          borderRadius: '2px',
          marginBottom: '30px',
          overflow: 'hidden',
          border: '1px solid #1a1a2e',
        }}>
          <div style={getProgressStyle()} />
        </div>

        {/* Step Indicator */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '30px',
          gap: '10px',
        }}>
          {[1, 2, 3].map(s => (
            <div
              key={s}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '12px',
                color: s === step ? '#00ff41' : s < step ? '#00ff41' : '#666',
                fontWeight: s === step ? 'bold' : 'normal',
              }}
            >
              STEP {s}
            </div>
          ))}
        </div>

        {/* Step 1: Select Trainer */}
        {step === 1 && (
          <div style={{ minHeight: '400px' }}>
            <h2 style={{
              fontSize: '16px',
              fontFamily: '"Orbitron", sans-serif',
              color: '#00ff41',
              margin: '0 0 20px 0',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              SELECT YOUR TRAINER
            </h2>

            <p style={{
              fontSize: '12px',
              color: '#888',
              margin: '0 0 20px 0',
            }}>
              Choose a trainer to guide your fitness journey
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: '30px',
            }}>
              {trainers.length === 0 ? (
                <div style={{
                  gridColumn: '1 / -1',
                  padding: '20px',
                  backgroundColor: '#111',
                  border: '1px solid #1a1a2e',
                  borderRadius: '4px',
                  textAlign: 'center',
                  color: '#888',
                }}>
                  No trainers available
                </div>
              ) : (
                trainers.map(trainer => {
                  const isSelected = selectedTrainerId === trainer.id;
                  const clientCount = getClientCount(trainer.id);
                  const team = trainer.teamId; // Optional team display

                  return (
                    <div
                      key={trainer.id}
                      onClick={() => setSelectedTrainerId(trainer.id)}
                      style={{
                        padding: '20px',
                        backgroundColor: '#111',
                        border: isSelected ? '2px solid #00ff41' : '1px solid #1a1a2e',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? '0 0 15px rgba(0, 255, 65, 0.2)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLDivElement).style.borderColor = '#00ff41';
                          (e.currentTarget as HTMLDivElement).style.opacity = '0.8';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLDivElement).style.borderColor = '#1a1a2e';
                          (e.currentTarget as HTMLDivElement).style.opacity = '1';
                        }
                      }}
                    >
                      <h3 style={{
                        margin: '0 0 8px 0',
                        fontSize: '14px',
                        color: '#00ff41',
                        fontFamily: '"Orbitron", sans-serif',
                      }}>
                        {trainer.callsign}
                      </h3>
                      <p style={{
                        margin: '6px 0',
                        fontSize: '11px',
                        color: '#888',
                      }}>
                        {trainer.name}
                      </p>
                      <p style={{
                        margin: '6px 0',
                        fontSize: '10px',
                        color: '#666',
                      }}>
                        {clientCount} clients
                      </p>
                      {team && (
                        <p style={{
                          margin: '6px 0',
                          fontSize: '10px',
                          color: '#666',
                        }}>
                          {team}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Step 2: Choose Tier */}
        {step === 2 && (
          <div style={{ minHeight: '400px' }}>
            <h2 style={{
              fontSize: '16px',
              fontFamily: '"Orbitron", sans-serif',
              color: '#00ff41',
              margin: '0 0 20px 0',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              CHOOSE YOUR TIER
            </h2>

            <p style={{
              fontSize: '12px',
              color: '#888',
              margin: '0 0 20px 0',
            }}>
              Select the AI model that powers your Gunny experience
            </p>

            {/* Annual Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '15px',
              marginBottom: '30px',
            }}>
              <span style={{ fontSize: '12px', color: isAnnual ? '#888' : '#00ff41' }}>Monthly</span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                style={{
                  padding: '6px 15px',
                  backgroundColor: isAnnual ? '#00ff41' : 'transparent',
                  border: '1px solid #00ff41',
                  color: isAnnual ? '#000' : '#00ff41',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontFamily: '"Chakra Petch", sans-serif',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                }}
              >
                {isAnnual ? 'ANNUAL (17% OFF)' : 'SWITCH TO ANNUAL'}
              </button>
              <span style={{ fontSize: '12px', color: !isAnnual ? '#888' : '#00ff41' }}>Annual</span>
            </div>

            {/* Tier Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '15px',
              marginBottom: '30px',
            }}>
              {(Object.entries(TIER_CONFIGS) as Array<[AiTier, typeof TIER_CONFIGS['haiku']]>).map(([tierKey, tierConfig]) => {
                const isSelected = selectedTier === tierKey;
                const displayPrice = isAnnual ? tierConfig.annualPrice : tierConfig.monthlyPrice;

                return (
                  <div
                    key={tierKey}
                    onClick={() => setSelectedTier(tierKey as AiTier)}
                    style={{
                      padding: '20px',
                      backgroundColor: '#111',
                      border: isSelected ? '2px solid #00ff41' : '1px solid #1a1a2e',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 0 15px rgba(0, 255, 65, 0.2)' : 'none',
                      textAlign: 'center',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLDivElement).style.borderColor = '#00ff41';
                        (e.currentTarget as HTMLDivElement).style.opacity = '0.8';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLDivElement).style.borderColor = '#1a1a2e';
                        (e.currentTarget as HTMLDivElement).style.opacity = '1';
                      }
                    }}
                  >
                    <h3 style={{
                      margin: '0 0 12px 0',
                      fontSize: '14px',
                      color: '#00ff41',
                      fontFamily: '"Orbitron", sans-serif',
                    }}>
                      {tierConfig.name}
                    </h3>
                    <div style={{
                      fontSize: '20px',
                      color: '#00ff41',
                      fontFamily: '"Orbitron", sans-serif',
                      margin: '0 0 8px 0',
                    }}>
                      ${displayPrice.toFixed(2)}
                    </div>
                    <p style={{
                      margin: '0 0 12px 0',
                      fontSize: '10px',
                      color: '#666',
                    }}>
                      {priceLabel}
                    </p>
                    <ul style={{
                      margin: 0,
                      padding: '0 0 0 15px',
                      fontSize: '9px',
                      color: '#888',
                      textAlign: 'left',
                      lineHeight: '1.4',
                    }}>
                      {tierConfig.features.slice(0, 2).map((feature, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>
                          {feature}
                        </li>
                      ))}
                      {tierConfig.features.length > 2 && (
                        <li style={{ marginBottom: '4px', color: '#666' }}>
                          +{tierConfig.features.length - 2} more
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Confirm & Subscribe */}
        {step === 3 && selectedTrainer && tierConfig && (
          <div style={{ minHeight: '400px' }}>
            <h2 style={{
              fontSize: '16px',
              fontFamily: '"Orbitron", sans-serif',
              color: '#00ff41',
              margin: '0 0 20px 0',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              CONFIRM & SUBSCRIBE
            </h2>

            {/* Summary Card */}
            <div style={{
              backgroundColor: '#111',
              border: '1px solid #1a1a2e',
              borderRadius: '4px',
              padding: '20px',
              marginBottom: '30px',
            }}>
              <h3 style={{
                fontSize: '12px',
                color: '#00ff41',
                margin: '0 0 15px 0',
                fontFamily: '"Orbitron", sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}>
                YOUR SETUP
              </h3>

              {/* Trainer Summary */}
              <div style={{
                marginBottom: '20px',
                paddingBottom: '20px',
                borderBottom: '1px solid #1a1a2e',
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#888' }}>TRAINER</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#00ff41', fontFamily: '"Orbitron", sans-serif' }}>
                  {selectedTrainer.callsign}
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#666' }}>
                  {selectedTrainer.name}
                </p>
              </div>

              {/* Tier Summary */}
              <div style={{
                marginBottom: '20px',
                paddingBottom: '20px',
                borderBottom: '1px solid #1a1a2e',
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#888' }}>TIER</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#00ff41', fontFamily: '"Orbitron", sans-serif' }}>
                  {tierConfig.name}
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#666' }}>
                  {tierConfig.features.join(' • ')}
                </p>
              </div>

              {/* Price Summary */}
              <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#888' }}>BILLING</p>
                <div style={{
                  fontSize: '24px',
                  color: '#00ff41',
                  fontFamily: '"Orbitron", sans-serif',
                  margin: '0 0 8px 0',
                }}>
                  ${price.toFixed(2)}
                </div>
                <p style={{ margin: 0, fontSize: '10px', color: '#666' }}>
                  {isAnnual ? 'Billed annually' : 'Billed monthly'}
                </p>
              </div>
            </div>

            {/* Info Box */}
            <div style={{
              backgroundColor: '#1a1a2e',
              border: '1px solid #333',
              borderRadius: '4px',
              padding: '15px',
              marginBottom: '30px',
              fontSize: '11px',
              color: '#888',
              lineHeight: '1.6',
            }}>
              You are currently in BETA. Click "START FREE BETA" to begin your onboarding without charge. Your trainer will guide you through intake and programming.
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          gap: '15px',
          justifyContent: 'flex-end',
        }}>
          {step > 1 && (
            <button
              onClick={handleBack}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                border: '1px solid #333',
                color: '#888',
                borderRadius: '3px',
                cursor: 'pointer',
                fontFamily: '"Orbitron", sans-serif',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#00ff41';
                (e.currentTarget as HTMLButtonElement).style.color = '#00ff41';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#333';
                (e.currentTarget as HTMLButtonElement).style.color = '#888';
              }}
            >
              BACK
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={
                (step === 1 && !selectedTrainerId) ||
                (step === 2 && !selectedTier)
              }
              style={{
                padding: '10px 20px',
                backgroundColor:
                  (step === 1 && !selectedTrainerId) || (step === 2 && !selectedTier)
                    ? '#333'
                    : '#00ff41',
                color:
                  (step === 1 && !selectedTrainerId) || (step === 2 && !selectedTier)
                    ? '#666'
                    : '#000',
                border: 'none',
                borderRadius: '3px',
                cursor:
                  (step === 1 && !selectedTrainerId) || (step === 2 && !selectedTier)
                    ? 'not-allowed'
                    : 'pointer',
                fontFamily: '"Orbitron", sans-serif',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (
                  !((step === 1 && !selectedTrainerId) || (step === 2 && !selectedTier))
                ) {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    '0 0 10px rgba(0, 255, 65, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              NEXT
            </button>
          ) : (
            <button
              onClick={handleStartBeta}
              style={{
                padding: '10px 30px',
                backgroundColor: '#00ff41',
                color: '#000',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontFamily: '"Orbitron", sans-serif',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 0 15px rgba(0, 255, 65, 0.3)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              START FREE BETA
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientOnboarding;
