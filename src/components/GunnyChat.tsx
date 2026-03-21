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
  primer: PrimerBlock;
  complex: ComplexBlock;
  strength: StrengthBlock;
  isolation: IsolationBlock;
  metcon: MetconBlock;
}

interface PrimerBlock {
  movements: string[];
  rounds: string;
}

interface ComplexBlock {
  movement: string;
  reps: string;
  timing: string;
}

interface StrengthBlock {
  exercise: string;
  sets: string;
  rest: string;
}

interface IsolationBlock {
  exercise: string;
  reps: string;
  rest: string;
  rounds: string;
}

interface MetconBlock {
  format: string;
  movements: string[];
}

const GOAL_PATHS = {
  HYPERTROPHY: {
    name: 'HYPERTROPHY',
    description: 'Muscle building focus. Higher reps (8-12), moderate weight, constant tension.',
    primerRounds: '3-4',
    complexReps: '3-4',
    strengthSets: '4-5',
    isolationRounds: '4',
    metconStyle: 'moderate-weight high-volume',
  },
  FAT_LOSS: {
    name: 'FAT LOSS',
    description: 'Metabolic conditioning focus. Moderate reps (6-10), heavier weight, shorter rest.',
    primerRounds: '3',
    complexReps: '3',
    strengthSets: '3-4',
    isolationRounds: '3',
    metconStyle: 'high-intensity short-duration',
  },
  STRENGTH: {
    name: 'STRENGTH',
    description: 'Powerlifting focus. Lower reps (1-5), heavy weight, full recovery.',
    primerRounds: '2-3',
    complexReps: '2-3',
    strengthSets: '5-6',
    isolationRounds: '3',
    metconStyle: 'heavy-singles-doubles',
  },
  ATHLETIC_PERFORMANCE: {
    name: 'ATHLETIC PERFORMANCE',
    description: 'Sport-specific focus. Power, explosivity, functional movement patterns.',
    primerRounds: '3',
    complexReps: '4-5',
    strengthSets: '4',
    isolationRounds: '3-4',
    metconStyle: 'explosive-functional',
  },
  GENERAL_FITNESS: {
    name: 'GENERAL FITNESS',
    description: 'Balanced approach. Mixed rep ranges, balanced progression.',
    primerRounds: '3',
    complexReps: '3-4',
    strengthSets: '4',
    isolationRounds: '3',
    metconStyle: 'moderate-mixed',
  },
};

const MUSCLE_GROUP_TEMPLATES = {
  CHEST: {
    primerMovements: ['Scapular Push-ups', 'Band Pull-aparts', 'Pec Flyes'],
    complexMovement: 'Bench Press Doubles',
    strengthExercise: 'Barbell Bench Press',
    isolationExercise: 'DB Incline Press',
    metconExample: 'Run 400m, 15 Burpees, 20 Push-ups',
  },
  BACK: {
    primerMovements: ['Dead Bugs', 'Scapular Rows', 'Band Rows'],
    complexMovement: 'Deadlift Doubles',
    strengthExercise: 'Conventional Deadlift',
    isolationExercise: 'Barbell Rows',
    metconExample: 'Run 400m, 10 Deadlifts, 15 Box Jump Overs',
  },
  LEGS: {
    primerMovements: ['Leg Swings', 'Goblet Squats', 'Single-Leg RDLs'],
    complexMovement: 'Squat Clean Doubles',
    strengthExercise: 'Back Squat',
    isolationExercise: 'DB Walking Lunges',
    metconExample: 'Run 400m, 15 Box Jumps, 10 Squat Cleans at 95lbs',
  },
  SHOULDERS: {
    primerMovements: ['Arm Circles', 'Band Pull-aparts', 'Pike Push-ups'],
    complexMovement: 'Push Press Doubles',
    strengthExercise: 'Overhead Press',
    isolationExercise: 'DB Shoulder Raises',
    metconExample: '5 Rounds for Time: 10 Thrusters, 15 Overhead Walks',
  },
  ARMS: {
    primerMovements: ['Scapular Hangs', 'Resistance Band Curls', 'Tricep Dips'],
    complexMovement: 'Power Clean Doubles',
    strengthExercise: 'Barbell Curls',
    isolationExercise: 'DB Hammer Curls',
    metconExample: '4 Rounds for Time: 12 Barbell Curls, 15 Dips, 400m Run',
  },
};

const EQUIPMENT_DEFAULTS = {
  barbell: ['Squat', 'Bench Press', 'Deadlift', 'Clean', 'Snatch'],
  dumbbells: ['Bench Press', 'Rows', 'Lunges', 'Shoulder Press', 'Curls'],
  kettlebell: ['Swings', 'Turkish Get-ups', 'Goblet Squats', 'Cleans'],
  machines: ['Leg Press', 'Smith Machine Bench', 'Cable Rows'],
};

export const GunnyChat: React.FC<GunnyChatProps> = ({ operator, allOperators }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
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
    const trainingAgeStr = operator.profile?.trainingAge || '0';
    const parsed = parseInt(trainingAgeStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  const getGoalPath = (userInput: string): string | null => {
    const lower = userInput.toLowerCase();
    if (lower.includes('hypertrophy') || lower.includes('muscle building') || lower.includes('size')) {
      return 'HYPERTROPHY';
    }
    if (lower.includes('fat loss') || lower.includes('cut') || lower.includes('lean')) {
      return 'FAT_LOSS';
    }
    if (lower.includes('strength') || lower.includes('powerlifting') || lower.includes('max')) {
      return 'STRENGTH';
    }
    if (lower.includes('athletic') || lower.includes('sport') || lower.includes('performance')) {
      return 'ATHLETIC_PERFORMANCE';
    }
    if (lower.includes('general') || lower.includes('balanced') || lower.includes('fitness')) {
      return 'GENERAL_FITNESS';
    }
    return null;
  };

  const getMuscleGroup = (userInput: string): string | null => {
    const lower = userInput.toLowerCase();
    if (lower.includes('chest') || lower.includes('bench') || lower.includes('press')) return 'CHEST';
    if (lower.includes('back') || lower.includes('deadlift') || lower.includes('row')) return 'BACK';
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
      muscleGroup,
      goal: goal.name,
      warmup: '10 MIN CARDIO WARMUP\nLight jog, rowing machine, or assault bike. Dynamic mobility work.',
      primer: {
        movements: template.primerMovements,
        rounds: goal.primerRounds,
      },
      complex: {
        movement: template.complexMovement,
        reps: `${goal.complexReps} reps`,
        timing: 'every 90 seconds x 4 sets',
      },
      strength: {
        exercise: template.strengthExercise,
        sets: goal.strengthSets,
        rest: readiness > 75 ? '60 seconds' : '90 seconds',
      },
      isolation: {
        exercise: template.isolationExercise,
        reps: '10-12 reps',
        rest: '45 seconds',
        rounds: goal.isolationRounds,
      },
      metcon: {
        format: '3 rounds for time',
        movements: [template.metconExample],
      },
    };
  };

  const formatWorkout = (workout: WorkoutSession): string => {
    return `
════════════════════════════════════════════════════════════
WORKOUT OF THE DAY — ${workout.muscleGroup} FOCUS
Goal Path: ${workout.goal}
════════════════════════════════════════════════════════════

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

════════════════════════════════════════════════════════════
Notes: Follow form over ego. Hydrate. Stay locked in.
════════════════════════════════════════════════════════════
`;
  };

  const generateGunnyResponse = (userMessage: string): string => {
    const lower = userMessage.toLowerCase();

    if (
      lower.includes('build') ||
      lower.includes('workout') ||
      lower.includes('wod') ||
      lower.includes('program')
    ) {
      const muscleGroup = getMuscleGroup(userMessage);
      const goalKey = getGoalPath(userMessage);

      if (muscleGroup) {
        const workout = buildWorkout(
          muscleGroup,
          goalKey
        );
        return formatWorkout(workout);
      } else {
        return "Roger that, champ. Need to know your target — CHEST, BACK, LEGS, SHOULDERS, or ARMS? Ask me to BUILD A CHEST WORKOUT or similar and I'll lock it in.";
      }
    }

    if (lower.includes('goal path') || lower.includes('goal paths') || lower.includes('paths')) {
      return `Roger that, champ. Here's what I've got:\n
🎯 HYPERTROPHY — ${GOAL_PATHS.HYPERTROPHY.description}

🎯 FAT LOSS — ${GOAL_PATHS.FAT_LOSS.description}

🎯 STRENGTH — ${GOAL_PATHS.STRENGTH.description}

🎯 ATHLETIC PERFORMANCE — ${GOAL_PATHS.ATHLETIC_PERFORMANCE.description}

🎯 GENERAL FITNESS — ${GOAL_PATHS.GENERAL_FITNESS.description}

Tell me your target and I'll build accordingly. Copy that?`;
    }

    if (lower.includes('readiness') || lower.includes('check readiness') || lower.includes('how am i')) {
      const readiness = operator.profile?.readiness || 75;
      const sleep = operator.profile?.sleep || 7;
      const stress = operator.profile?.stress || 5;
      const trainingAge = calculateTrainingAge();

      let assessment = '';
      if (readiness > 85) {
        assessment = 'You\'re in the GREEN ZONE, champ. All systems go. Push hard today.';
      } else if (readiness > 70) {
        assessment = 'You\'re OPERATIONAL. Execute your primary lift and stay disciplined.';
      } else if (readiness > 55) {
        assessment = 'You\'re in the YELLOW ZONE. Dial it back — lighter weight, perfect form, no ego.';
      } else {
        assessment = 'RED ZONE. Recovery session recommended — mobility, light conditioning, rest. Stay smart.';
      }

      return `READINESS REPORT:
Readiness: ${readiness}% | Sleep: ${sleep}/10 | Stress: ${stress}/10
Training Age: ${trainingAge} years

${assessment}

Recommendation: ${readiness > 75 ? 'Push intensity' : readiness > 55 ? 'Moderate effort' : 'Focus on recovery'}.`;
    }

    if (lower.includes('weekly') || lower.includes('week plan') || lower.includes('plan my week')) {
      const split = operator.preferences?.split || 'Push/Pull/Legs';
      const daysPerWeek = operator.preferences?.daysPerWeek || 4;

      return `WEEKLY OPERATION PLAN — ${split} split, ${daysPerWeek} days/week

Day 1: PUSH (Chest, Shoulders, Triceps)
Day 2: PULL (Back, Biceps)
Day 3: LEGS (Quads, Hamstrings, Glutes)
Day 4: ACCESSORIES (Weak points)

${daysPerWeek >= 5 ? 'Day 5: CONDITIONING (Metcon focus)' : ''}

Tell me which day and I'll build that workout, champ. Or ask me to BUILD A PUSH WORKOUT, etc.`;
    }

    if (lower.includes('injury') || lower.includes('hurt') || lower.includes('pain') || lower.includes('restriction')) {
      const injuries = operator.injuries || [];

      if (injuries.length > 0) {
        const injuryList = injuries
          .map((inj) => `${inj.name}: ${inj.restrictions?.join(', ') || 'avoid heavy loading'}`)
          .join('\n');
        return `ACTIVE INJURIES LOGGED:\n${injuryList}\n\nNo heroes, champ. Follow your restrictions. We'll modify workouts around this. What muscle group can we work around your injury?`;
      } else {
        return "No injuries on the books, champ. You're clean. Keep that body healthy — mobility, form checks, listen to the signals. Stay disciplined.";
      }
    }

    if (lower.includes('nutrition') || lower.includes('macro') || lower.includes('food') || lower.includes('eat')) {
      const nutrition = operator.nutrition;
      const today = new Date().toISOString().split('T')[0];
      const todayMeals = nutrition?.meals?.[today] || [];
      const currentCalories = todayMeals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
      const targetCalories = nutrition?.targets?.calories || 2500;
      const currentProtein = todayMeals.reduce((sum: number, m: any) => sum + (m.protein || 0), 0);
      const targetProtein = nutrition?.targets?.protein || 150;

      let rec = '';
      if (currentCalories < targetCalories * 0.85) {
        rec = 'You\'re UNDER. Fuel up — add calories before training.';
      } else if (currentCalories > targetCalories * 1.15) {
        rec = 'You\'re OVER. Tighten it up on next meal. Discipline.';
      } else {
        rec = 'You\'re tracking solid. Keep the discipline.';
      }

      return `NUTRITION STATUS:\nCalories: ${currentCalories}/${targetCalories} | Protein: ${currentProtein}g/${targetProtein}g\n\n${rec}`;
    }

    if (lower.includes('pr') || lower.includes('personal record') || lower.includes('best')) {
      const prs = operator.prs || [];
      if (prs.length > 0) {
        const prList = prs.slice(0, 3).map((pr) => `${pr.exercise}: ${pr.weight}lbs x${pr.reps}`).join('\n');
        return `RECENT PRs:\n${prList}\n\nChase those numbers, champ. You've got the foundation — now build on it. Ready to attempt a new one?`;
      } else {
        return "No PRs logged yet, champ. That's your mission — establish your baseline on main lifts. First attempt counts. Get in there.";
      }
    }

    return "Stay in the fight, champ. What's the mission? BUILD A WORKOUT, check READINESS, review GOAL PATHS, or plan your WEEK?";
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    setTimeout(() => {
      const responseText = generateGunnyResponse(inputValue);
      const isWorkout =
        inputValue.toLowerCase().includes('build') ||
        inputValue.toLowerCase().includes('workout') ||
        inputValue.toLowerCase().includes('wod');

      const gunnyResponse: Message = {
        id: 'gunny-' + Date.now(),
        role: 'gunny',
        text: responseText,
        timestamp: new Date(),
        isWorkout,
      };
      setMessages((prev) => [...prev, gunnyResponse]);
    }, 400);

    setInputValue('');
    inputRef.current?.focus();
  };

  const handleQuickAction = (action: string) => {
    setInputValue(action);
    setTimeout(() => {
      handleSendMessage();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    'Build WOD',
    'Goal Paths',
    'Check Readiness',
    'Weekly Plan',
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#030303',
        color: '#ccc',
        fontFamily: '"Chakra Petch", sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '2px solid rgba(0,255,65,0.3)',
          backgroundColor: 'rgba(3,3,3,0.9)',
        }}
      >
        <div
          style={{
            fontSize: '16px',
            fontFamily: '"Orbitron", sans-serif',
            color: '#00ff41',
            fontWeight: 900,
            textShadow: '0 0 12px #00ff41, 0 0 24px rgba(0,255,65,0.6)',
            marginBottom: '4px',
            letterSpacing: '3px',
          }}
        >
          GUNNY
        </div>
        <div
          style={{
            fontSize: '9px',
            fontFamily: '"Share Tech Mono", monospace',
            color: '#888',
            letterSpacing: '2px',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}
        >
          FUNCTIONAL BODYBUILDER TRAINER
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#00ff41',
              boxShadow: '0 0 10px #00ff41',
              animation: 'pulse 2s infinite',
            }}
          />
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#00ff41',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            ONLINE
          </span>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 16px',
          overflowX: 'auto',
          overflowY: 'hidden',
          borderBottom: '1px solid rgba(0,255,65,0.15)',
          backgroundColor: 'rgba(0,255,65,0.02)',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickAction(action)}
            style={{
              padding: '8px 14px',
              fontSize: '9px',
              fontFamily: '"Share Tech Mono", monospace',
              color: '#00ff41',
              backgroundColor: 'rgba(0,255,65,0.04)',
              border: '1px solid rgba(0,255,65,0.15)',
              clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
            onMouseEnter={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.backgroundColor = 'rgba(0,255,65,0.1)';
              target.style.boxShadow = '0 0 12px rgba(0,255,65,0.3)';
              target.style.borderColor = 'rgba(0,255,65,0.4)';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.backgroundColor = 'rgba(0,255,65,0.04)';
              target.style.boxShadow = 'none';
              target.style.borderColor = 'rgba(0,255,65,0.15)';
            }}
          >
            {action}
          </button>
        ))}
      </div>

      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: '#030303',
        }}
      >
        <style>
          {`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.6; }
            }
          `}
        </style>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              alignItems: message.role === 'gunny' ? 'flex-start' : 'flex-end',
              gap: '8px',
            }}
          >
            {message.role === 'gunny' && (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#00ff41',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 900,
                  color: '#030303',
                  flexShrink: 0,
                  boxShadow: '0 0 16px rgba(0,255,65,0.5)',
                  fontFamily: '"Orbitron", sans-serif',
                }}
              >
                G
              </div>
            )}

            <div
              style={{
                maxWidth: '80%',
                padding: '12px 14px',
                borderRadius: '0px',
                fontSize: '12px',
                lineHeight: '1.6',
                backgroundColor:
                  message.role === 'user'
                    ? 'rgba(0,150,255,0.06)'
                    : 'rgba(0,255,65,0.03)',
                border:
                  message.role === 'user'
                    ? '1px solid rgba(0,150,255,0.2)'
                    : '1px solid rgba(0,255,65,0.12)',
                color: message.isWorkout ? '#ffb800' : '#ddd',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                fontFamily: message.isWorkout ? '"Share Tech Mono", monospace' : '"Chakra Petch", sans-serif',
              }}
            >
              {message.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(0,255,65,0.2)',
          backgroundColor: 'rgba(3,3,3,0.95)',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's the mission, champ?"
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: '12px',
            fontFamily: '"Chakra Petch", sans-serif',
            backgroundColor: 'rgba(0,255,65,0.02)',
            border: '1px solid rgba(0,255,65,0.1)',
            color: '#ddd',
            outline: 'none',
            transition: 'all 0.2s ease',
            borderRadius: '0px',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,255,65,0.3)';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(0,255,65,0.15)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,255,65,0.1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <button
          onClick={handleSendMessage}
          style={{
            padding: '10px 16px',
            fontSize: '11px',
            fontFamily: '"Share Tech Mono", monospace',
            color: '#030303',
            backgroundColor: '#00ff41',
            border: 'none',
            clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)',
            cursor: 'pointer',
            fontWeight: 800,
            transition: 'all 0.2s ease',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.boxShadow = '0 0 16px rgba(0,255,65,0.7)';
            target.style.backgroundColor = '#33ff77';
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.boxShadow = 'none';
            target.style.backgroundColor = '#00ff41';
          }}
        >
          SEND
        </button>
      </div>
    </div>
  );
};
