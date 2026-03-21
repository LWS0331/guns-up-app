'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Operator } from '@/lib/types';

interface GunnyChatProps {
  operator: Operator;
  allOperators: Operator[];
}

interface Message {
  id: string;
  role: 'user' | 'gunny';
  text: string;
  timestamp: Date;
  isWorkout?: boolean;
}

interface WorkoutSession {
  muscleGroup: string;
  goal: string;
  warmup: string;
  primer: { movements: string[]; rounds: string };
  complex: { movement: string; reps: string; timing: string };
  strength: { exercise: string; sets: string; rest: string };
  isolation: { exercise: string; reps: string; rest: string; rounds: string };
  metcon: { format: string; movements: string[] };
}

const GOAL_PATHS = {
  HYPERTROPHY: { name: 'HYPERTROPHY', description: 'Muscle building focus. Higher reps (8-12), moderate weight, constant tension.', primerRounds: '3-4', complexReps: '3-4', strengthSets: '4-5', isolationRounds: '4', metconStyle: 'moderate-weight high-volume' },
  FAT_LOSS: { name: 'FAT LOSS', description: 'Metabolic conditioning focus. Moderate reps (6-10), heavier weight, shorter rest.', primerRounds: '3', complexReps: '3', strengthSets: '3-4', isolationRounds: '3', metconStyle: 'high-intensity short-duration' },
  STRENGTH: { name: 'STRENGTH', description: 'Powerlifting focus. Lower reps (1-5), heavy weight, full recovery.', primerRounds: '2-3', complexReps: '2-3', strengthSets: '5-6', isolationRounds: '3', metconStyle: 'heavy-singles-doubles' },
  ATHLETIC_PERFORMANCE: { name: 'ATHLETIC PERFORMANCE', description: 'Sport-specific focus. Power, explosivity, functional movement patterns.', primerRounds: '3', complexReps: '4-5', strengthSets: '4', isolationRounds: '3-4', metconStyle: 'explosive-functional' },
  GENERAL_FITNESS: { name: 'GENERAL FITNESS', description: 'Balanced approach. Mixed rep ranges, balanced progression.', primerRounds: '3', complexReps: '3-4', strengthSets: '4', isolationRounds: '3', metconStyle: 'moderate-mixed' },
};

const MUSCLE_GROUP_TEMPLATES = {
  CHEST: { primerMovements: ['Scapular Push-ups', 'Band Pull-aparts', 'Pec Flyes'], complexMovement: 'Bench Press Doubles', strengthExercise: 'Barbell Bench Press', isolationExercise: 'DB Incline Press', metconExample: 'Run 400m, 15 Burpees, 20 Push-ups' },
  BACK: { primerMovements: ['Dead Bugs', 'Scapular Rows', 'Band Rows'], complexMovement: 'Deadlift Doubles', strengthExercise: 'Conventional Deadlift', isolationExercise: 'Barbell Rows', metconExample: 'Run 400m, 10 Deadlifts, 15 Box Jump Overs' },
  LEGS: { primerMovements: ['Leg Swings', 'Goblet Squats', 'Single-Leg RDLs'], complexMovement: 'Squat Clean Doubles', strengthExercise: 'Back Squat', isolationExercise: 'DB Walking Lunges', metconExample: 'Run 400m, 15 Box Jumps, 10 Squat Cleans at 95lbs' },
  SHOULDERS: { primerMovements: ['Arm Circles', 'Band Pull-aparts', 'Pike Push-ups'], complexMovement: 'Push Press Doubles', strengthExercise: 'Overhead Press', isolationExercise: 'DB Shoulder Raises', metconExample: '5 Rounds for Time: 10 Thrusters, 15 Overhead Walks' },
  ARMS: { primerMovements: ['Scapular Hangs', 'Resistance Band Curls', 'Tricep Dips'], complexMovement: 'Power Clean Doubles', strengthExercise: 'Barbell Curls', isolationExercise: 'DB Hammer Curls', metconExample: '4 Rounds for Time: 12 Barbell Curls, 15 Dips, 400m Run' },
};

export const GunnyChat: React.FC<GunnyChatProps> = ({ operator, allOperators }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const greeting: Message = {
      id: 'greeting-' + Date.now(),
      role: 'gunny',
      text: "Gunny reporting for duty. Full intel loaded — ready to build you a training plan that works, champ. What's the mission? Ask me to BUILD A WORKOUT, check your READINESS, review GOAL PATHS, or just talk training.",
      timestamp: new Date(),
    };
    setMessages([greeting]);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const calculateTrainingAge = (): number => {
    const parsed = parseInt(operator.profile?.trainingAge || '0');
    return isNaN(parsed) ? 0 : parsed;
  };

  const getGoalPath = (userInput: string): string | null => {
    const lower = userInput.toLowerCase();
    if (lower.includes('hypertrophy') || lower.includes('muscle building') || lower.includes('size')) return 'HYPERTROPHY';
    if (lower.includes('fat loss') || lower.includes('cut') || lower.includes('lean')) return 'FAT_LOSS';
    if (lower.includes('strength') || lower.includes('powerlifting') || lower.includes('max')) return 'STRENGTH';
    if (lower.includes('athletic') || lower.includes('sport') || lower.includes('performance')) return 'ATHLETIC_PERFORMANCE';
    if (lower.includes('general') || lower.includes('balanced') || lower.includes('fitness')) return 'GENERAL_FITNESS';
    return null;
  };

  const getMuscleGroup = (userInput: string): string | null => {
    const lower = userInput.toLowerCase();
    if (lower.includes('chest') || lower.includes('bench') || lower.includes('push day')) return 'CHEST';
    if (lower.includes('back') || lower.includes('deadlift') || lower.includes('row') || lower.includes('pull day')) return 'BACK';
    if (lower.includes('leg') || lower.includes('squat') || lower.includes('lunge')) return 'LEGS';
    if (lower.includes('shoulder') || lower.includes('ohp')) return 'SHOULDERS';
    if (lower.includes('arm') || lower.includes('bicep') || lower.includes('tricep')) return 'ARMS';
    return null;
  };

  const buildWorkout = (muscleGroup: string, goalKey: string | null): WorkoutSession => {
    const template = MUSCLE_GROUP_TEMPLATES[muscleGroup as keyof typeof MUSCLE_GROUP_TEMPLATES];
    const goal = goalKey ? GOAL_PATHS[goalKey as keyof typeof GOAL_PATHS] : GOAL_PATHS.GENERAL_FITNESS;
    const readiness = operator.profile?.readiness || 75;
    return {
      muscleGroup, goal: goal.name,
      warmup: '10 MIN CARDIO WARMUP\nLight jog, rowing machine, or assault bike. Dynamic mobility work.',
      primer: { movements: template.primerMovements, rounds: goal.primerRounds },
      complex: { movement: template.complexMovement, reps: `${goal.complexReps} reps`, timing: 'every 90 seconds x 4 sets' },
      strength: { exercise: template.strengthExercise, sets: goal.strengthSets, rest: readiness > 75 ? '60 seconds' : '90 seconds' },
      isolation: { exercise: template.isolationExercise, reps: '10-12 reps', rest: '45 seconds', rounds: goal.isolationRounds },
      metcon: { format: '3 rounds for time', movements: [template.metconExample] },
    };
  };

  const formatWorkout = (workout: WorkoutSession): string => {
    return `════════════════════════════════════════
WORKOUT OF THE DAY — ${workout.muscleGroup} FOCUS
Goal Path: ${workout.goal}
════════════════════════════════════════

A. WARMUP
${workout.warmup}

B. PRIMER — ${workout.primer.rounds} rounds (not for time)
${workout.primer.movements.map((m) => `   • ${m}`).join('\n')}
Rest 60-90 sec between rounds.

C. COMPLEX MOVEMENT
${workout.complex.movement} — ${workout.complex.reps} ${workout.complex.timing}
Rest 90 sec between sets.

D. STRENGTH
${workout.strength.exercise}
Sets: ${workout.strength.sets} | Rest: ${workout.strength.rest}
Target: challenging weight, technical execution

E. ISOLATION
${workout.isolation.exercise} — ${workout.isolation.reps}
${workout.isolation.rounds} rounds | Rest: ${workout.isolation.rest}

F. METCON
${workout.metcon.format}
${workout.metcon.movements.map((m) => `   ${m}`).join('\n')}
Track splits — compete with yesterday's time.

════════════════════════════════════════
Notes: Follow form over ego. Hydrate. Stay locked in.
════════════════════════════════════════`;
  };

  const generateGunnyResponse = (userMessage: string): string => {
    const lower = userMessage.toLowerCase();

    if (lower.includes('build') || lower.includes('workout') || lower.includes('wod') || lower.includes('program')) {
      const muscleGroup = getMuscleGroup(userMessage);
      const goalKey = getGoalPath(userMessage);
      if (muscleGroup) {
        return formatWorkout(buildWorkout(muscleGroup, goalKey));
      }
      return "Roger that, champ. Need to know your target — CHEST, BACK, LEGS, SHOULDERS, or ARMS? Ask me to BUILD A CHEST WORKOUT or similar and I'll lock it in.";
    }

    if (lower.includes('goal path') || lower.includes('goal paths') || lower.includes('paths')) {
      return `Roger that, champ. Here's what I've got:\n\nHYPERTROPHY — ${GOAL_PATHS.HYPERTROPHY.description}\n\nFAT LOSS — ${GOAL_PATHS.FAT_LOSS.description}\n\nSTRENGTH — ${GOAL_PATHS.STRENGTH.description}\n\nATHLETIC PERFORMANCE — ${GOAL_PATHS.ATHLETIC_PERFORMANCE.description}\n\nGENERAL FITNESS — ${GOAL_PATHS.GENERAL_FITNESS.description}\n\nTell me your target and I'll build accordingly. Copy that?`;
    }

    if (lower.includes('readiness') || lower.includes('check readiness') || lower.includes('how am i')) {
      const readiness = operator.profile?.readiness || 75;
      const sleep = operator.profile?.sleep || 7;
      const stress = operator.profile?.stress || 5;
      const trainingAge = calculateTrainingAge();
      let assessment = readiness > 85 ? 'GREEN ZONE. All systems go. Push hard today.'
        : readiness > 70 ? 'OPERATIONAL. Execute your primary lift and stay disciplined.'
        : readiness > 55 ? 'YELLOW ZONE. Dial it back — lighter weight, perfect form, no ego.'
        : 'RED ZONE. Recovery session recommended — mobility, light conditioning, rest.';
      return `READINESS REPORT:\nReadiness: ${readiness}% | Sleep: ${sleep}/10 | Stress: ${stress}/10\nTraining Age: ${trainingAge} years\n\n${assessment}\n\nRecommendation: ${readiness > 75 ? 'Push intensity' : readiness > 55 ? 'Moderate effort' : 'Focus on recovery'}.`;
    }

    if (lower.includes('weekly') || lower.includes('week plan') || lower.includes('plan my week')) {
      const split = operator.preferences?.split || 'Push/Pull/Legs';
      const daysPerWeek = operator.preferences?.daysPerWeek || 4;
      return `WEEKLY OPERATION PLAN — ${split} split, ${daysPerWeek} days/week\n\nDay 1: PUSH (Chest, Shoulders, Triceps)\nDay 2: PULL (Back, Biceps)\nDay 3: LEGS (Quads, Hamstrings, Glutes)\nDay 4: ACCESSORIES (Weak points)\n${daysPerWeek >= 5 ? 'Day 5: CONDITIONING (Metcon focus)\n' : ''}\nTell me which day and I'll build that workout, champ.`;
    }

    if (lower.includes('injury') || lower.includes('hurt') || lower.includes('pain') || lower.includes('restriction')) {
      const injuries = operator.injuries || [];
      if (injuries.length > 0) {
        const injuryList = injuries.map((inj) => `${inj.name}: ${inj.restrictions?.join(', ') || 'avoid heavy loading'}`).join('\n');
        return `ACTIVE INJURIES LOGGED:\n${injuryList}\n\nNo heroes, champ. Follow your restrictions. We'll modify workouts around this.`;
      }
      return "No injuries on the books, champ. You're clean. Keep that body healthy.";
    }

    if (lower.includes('nutrition') || lower.includes('macro') || lower.includes('food') || lower.includes('eat')) {
      const nutrition = operator.nutrition;
      const today = new Date().toISOString().split('T')[0];
      const todayMeals = nutrition?.meals?.[today] || [];
      const currentCalories = todayMeals.reduce((sum: number, m: { calories?: number }) => sum + (m.calories || 0), 0);
      const targetCalories = nutrition?.targets?.calories || 2500;
      const currentProtein = todayMeals.reduce((sum: number, m: { protein?: number }) => sum + (m.protein || 0), 0);
      const targetProtein = nutrition?.targets?.protein || 150;
      const rec = currentCalories < targetCalories * 0.85 ? 'UNDER. Fuel up before training.'
        : currentCalories > targetCalories * 1.15 ? 'OVER. Tighten it up.'
        : 'Tracking solid. Discipline.';
      return `NUTRITION STATUS:\nCalories: ${currentCalories}/${targetCalories} | Protein: ${currentProtein}g/${targetProtein}g\n\n${rec}`;
    }

    if (lower.includes('pr') || lower.includes('personal record') || lower.includes('best')) {
      const prs = operator.prs || [];
      if (prs.length > 0) {
        const prList = prs.slice(0, 3).map((pr) => `${pr.exercise}: ${pr.weight}lbs x${pr.reps}`).join('\n');
        return `RECENT PRs:\n${prList}\n\nChase those numbers, champ. Build on the foundation.`;
      }
      return "No PRs logged yet. Establish your baseline on main lifts. First attempt counts.";
    }

    return "Stay in the fight, champ. What's the mission? BUILD A WORKOUT, check READINESS, review GOAL PATHS, or plan your WEEK?";
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    const text = inputValue;
    const userMessage: Message = { id: 'user-' + Date.now(), role: 'user', text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const responseText = generateGunnyResponse(text);
      const isWorkout = text.toLowerCase().includes('build') || text.toLowerCase().includes('workout') || text.toLowerCase().includes('wod');
      const gunnyResponse: Message = { id: 'gunny-' + Date.now(), role: 'gunny', text: responseText, timestamp: new Date(), isWorkout };
      setIsTyping(false);
      setMessages((prev) => [...prev, gunnyResponse]);
    }, 800 + Math.random() * 600);

    inputRef.current?.focus();
  };

  const handleQuickAction = (action: string) => {
    const userMessage: Message = { id: 'user-' + Date.now(), role: 'user', text: action, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    setTimeout(() => {
      const responseText = generateGunnyResponse(action);
      const isWorkout = action.toLowerCase().includes('build') || action.toLowerCase().includes('wod');
      const gunnyResponse: Message = { id: 'gunny-' + Date.now(), role: 'gunny', text: responseText, timestamp: new Date(), isWorkout };
      setIsTyping(false);
      setMessages((prev) => [...prev, gunnyResponse]);
    }, 600 + Math.random() * 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    { label: 'BUILD WOD', icon: '▶' },
    { label: 'GOAL PATHS', icon: '◆' },
    { label: 'CHECK READINESS', icon: '◈' },
    { label: 'WEEKLY PLAN', icon: '▦' },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#030303',
      color: '#ddd',
      fontFamily: '"Chakra Petch", sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes workoutCardGlow {
          0%, 100% { border-color: rgba(255,184,0,0.15); }
          50% { border-color: rgba(255,184,0,0.3); }
        }
        .quick-btn {
          padding: 8px 16px;
          font-size: 15px;
          font-family: 'Share Tech Mono', monospace;
          color: #00ff41;
          background: rgba(0,255,65,0.03);
          border: 1px solid rgba(0,255,65,0.1);
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 700;
          letter-spacing: 1px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .quick-btn:hover {
          background: rgba(0,255,65,0.08);
          border-color: rgba(0,255,65,0.3);
          box-shadow: 0 0 12px rgba(0,255,65,0.15);
        }
        .send-btn {
          padding: 10px 20px;
          font-size: 15px;
          font-family: 'Orbitron', sans-serif;
          color: #030303;
          background: #00ff41;
          border: none;
          cursor: pointer;
          font-weight: 800;
          letter-spacing: 2px;
          transition: all 0.2s ease;
        }
        .send-btn:hover {
          background: #33ff77;
          box-shadow: 0 0 20px rgba(0,255,65,0.5);
        }
        .chat-input {
          flex: 1;
          padding: 12px 16px;
          font-size: 15px;
          font-family: 'Chakra Petch', sans-serif;
          background: rgba(0,255,65,0.02);
          border: 1px solid rgba(0,255,65,0.08);
          color: #ddd;
          outline: none;
          transition: all 0.2s ease;
        }
        .chat-input:focus {
          border-color: rgba(0,255,65,0.25);
          box-shadow: 0 0 12px rgba(0,255,65,0.08);
          background: rgba(0,255,65,0.03);
        }
        .chat-input::placeholder { color: #333; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(0,255,65,0.08)',
        background: 'linear-gradient(180deg, rgba(8,8,8,0.95) 0%, rgba(3,3,3,0.98) 100%)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }}>
        {/* Avatar */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #00ff41 0%, #00cc33 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
          fontWeight: 900,
          color: '#030303',
          fontFamily: '"Orbitron", sans-serif',
          boxShadow: '0 0 16px rgba(0,255,65,0.3)',
          flexShrink: 0,
        }}>
          G
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '26px',
            fontFamily: '"Orbitron", sans-serif',
            color: '#00ff41',
            fontWeight: 900,
            letterSpacing: '3px',
            textShadow: '0 0 8px rgba(0,255,65,0.3)',
          }}>
            GUNNY
          </div>
          <div style={{
            fontSize: '15px',
            fontFamily: '"Share Tech Mono", monospace',
            color: '#888',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginTop: '2px',
          }}>
            FUNCTIONAL BODYBUILDER TRAINER
          </div>
        </div>

        {/* Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          border: '1px solid rgba(0,255,65,0.15)',
          backgroundColor: 'rgba(0,255,65,0.03)',
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#00ff41',
            boxShadow: '0 0 8px #00ff41',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{
            fontSize: '15px',
            fontWeight: 700,
            color: '#00ff41',
            letterSpacing: '1.5px',
            fontFamily: '"Share Tech Mono", monospace',
          }}>
            ONLINE
          </span>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '6px',
        padding: '10px 20px',
        borderBottom: '1px solid rgba(0,255,65,0.05)',
        backgroundColor: 'rgba(0,255,65,0.01)',
      }}>
        {quickActions.map((action, idx) => (
          <button key={idx} className="quick-btn" onClick={() => handleQuickAction(action.label)}>
            <span style={{ color: '#00ff41', fontSize: '15px', opacity: 0.6 }}>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {messages.map((message) => (
          <div key={message.id} style={{
            display: 'flex',
            justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            alignItems: 'flex-start',
            gap: '10px',
            animation: 'msgSlideIn 0.3s ease-out',
          }}>
            {message.role === 'gunny' && (
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00ff41, #00cc33)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 900,
                color: '#030303',
                flexShrink: 0,
                fontFamily: '"Orbitron", sans-serif',
                boxShadow: '0 0 8px rgba(0,255,65,0.2)',
                marginTop: '2px',
              }}>
                G
              </div>
            )}

            <div style={{
              maxWidth: '75%',
              padding: message.isWorkout ? '16px' : '10px 14px',
              fontSize: '15px',
              lineHeight: '1.65',
              backgroundColor: message.role === 'user'
                ? 'rgba(0,150,255,0.05)'
                : message.isWorkout
                  ? 'rgba(255,184,0,0.03)'
                  : 'rgba(0,255,65,0.02)',
              border: message.role === 'user'
                ? '1px solid rgba(0,150,255,0.15)'
                : message.isWorkout
                  ? '1px solid rgba(255,184,0,0.15)'
                  : '1px solid rgba(0,255,65,0.08)',
              color: message.isWorkout ? '#e0a800' : message.role === 'user' ? '#bbb' : '#ccc',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              fontFamily: message.isWorkout ? '"Share Tech Mono", monospace' : '"Chakra Petch", sans-serif',
              animation: message.isWorkout ? 'workoutCardGlow 3s ease-in-out infinite' : 'none',
              position: 'relative',
            }}>
              {/* Workout card header accent */}
              {message.isWorkout && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #ffb800, transparent)',
                }} />
              )}
              {message.text}
              {/* Timestamp */}
              <div style={{
                fontSize: '15px',
                color: '#666',
                marginTop: '6px',
                fontFamily: '"Share Tech Mono", monospace',
                textAlign: message.role === 'user' ? 'right' : 'left',
              }}>
                {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'msgSlideIn 0.2s ease-out',
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00ff41, #00cc33)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              fontWeight: 900,
              color: '#030303',
              flexShrink: 0,
              fontFamily: '"Orbitron", sans-serif',
              opacity: 0.7,
            }}>
              G
            </div>
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(0,255,65,0.02)',
              border: '1px solid rgba(0,255,65,0.08)',
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
            }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: '#00ff41',
                  animation: `typingDot 1.2s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid rgba(0,255,65,0.08)',
        background: 'linear-gradient(180deg, rgba(5,5,5,0.98) 0%, rgba(3,3,3,1) 100%)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <div style={{
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: '15px',
          color: '#222',
          marginRight: '4px',
        }}>
          {'>>'}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's the mission, champ?"
          className="chat-input"
        />
        <button onClick={handleSendMessage} className="send-btn" disabled={!inputValue.trim()}>
          SEND
        </button>
      </div>
    </div>
  );
};
