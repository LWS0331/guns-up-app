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
}

export const GunnyChat: React.FC<GunnyChatProps> = ({ operator, allOperators }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with greeting message
  useEffect(() => {
    const greeting: Message = {
      id: 'greeting-' + Date.now(),
      role: 'gunny',
      text: "Gunny reporting for duty. I've got your full intel loaded — profile, PRs, nutrition, injury status. What's the mission, champ?",
      timestamp: new Date(),
    };
    setMessages([greeting]);
    inputRef.current?.focus();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateGunnyResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    // PROGRAM / WEEK / PLAN
    if (
      lowerMessage.includes('program') ||
      lowerMessage.includes('week') ||
      lowerMessage.includes('plan')
    ) {
      const split = operator.preferences?.split || 'Full Body';
      const daysPerWeek = operator.preferences?.daysPerWeek || 4;
      const weakPoints = operator.preferences?.weakPoints || 'lagging muscle groups';
      const injuries = operator.injuries || [];
      const injuryNote =
        injuries.length > 0
          ? `Keeping ${injuries.map((inj) => inj.name).join(', ')} restrictions in mind.`
          : 'You\'re injury-free, champ.';

      return `Roger that, champ. Based on your ${split} split and ${daysPerWeek} days/week, here's your op plan:\n\nDay 1: Push — focus on ${weakPoints}\nDay 2: Pull — max strength work\nDay 3: Legs — heavy compound focus\nDay 4: Accessories — weak point assault\n\n${injuryNote} Let's get after it.`;
    }

    // TODAY / WHAT SHOULD / CHECK
    if (
      lowerMessage.includes('today') ||
      lowerMessage.includes('what should') ||
      lowerMessage.includes('what\'s today')
    ) {
      const readiness = operator.profile?.readiness || 75;
      const sleep = operator.profile?.sleep || 7;

      if (readiness > 80) {
        return `You're green-lit, champ. Readiness at ${readiness}%, sleep at ${sleep}/10. Time to push hard. Execute your primary lift today and stay locked in.`;
      } else if (readiness >= 60) {
        return `Readiness at ${readiness}%, sleep at ${sleep}/10. You're operational. Stick to your plan but watch form — don't chase ego lifts. Get after it.`;
      } else {
        return `Readiness at ${readiness}%, sleep at ${sleep}/10. You're in the yellow zone, champ. Recommend a recovery session today — mobility, light conditioning, or active rest. Stay in the fight.`;
      }
    }

    // PR / READY / ATTEMPT
    if (
      lowerMessage.includes('pr') ||
      lowerMessage.includes('ready') ||
      lowerMessage.includes('attempt')
    ) {
      const readiness = operator.profile?.readiness || 75;
      const recentPRs = operator.prs || [];

      if (recentPRs.length > 0) {
        const lastPR = recentPRs[0];
        const exercise = lastPR.exercise || 'your lift';
        const weight = lastPR.weight || '???';
        const date = lastPR.date
          ? new Date(lastPR.date).toLocaleDateString()
          : 'recently';

        if (readiness > 75) {
          return `Outstanding, champ. Your last ${exercise} PR was ${weight}lbs on ${date}. Readiness at ${readiness}% — you're locked in. Attack that lift with intensity. Mission ready.`;
        } else {
          return `Your last ${exercise} PR was ${weight}lbs on ${date}. Readiness at ${readiness}% — you're not quite peak condition. Hit reps, dial in form, chase the lift in a few days when you're greener.`;
        }
      } else {
        return `No PR data in the system yet, champ. Readiness at ${readiness}%. Get in there, establish your baseline on your main lifts. Every PR starts with a first attempt. Get after it.`;
      }
    }

    // DELOAD
    if (lowerMessage.includes('deload')) {
      const stress = operator.profile?.stress || 5;
      const workoutDates = Object.keys(operator.workouts || {});
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const workoutsThisWeek = workoutDates.filter(d => new Date(d) >= startOfWeek).length;

      let recommendation = '';
      if (stress > 7) {
        recommendation =
          'Stress level is high. Time for a deload. Cut volume by 40%, hit lighter weights, focus on movement quality and recovery.';
      } else if (workoutsThisWeek >= 5) {
        recommendation =
          'You\'ve logged heavy volume this week. Deload protocol: 3 sessions of light work, high reps (8-12), no near-max attempts.';
      } else {
        recommendation = "You're not showing deload signals yet, but monitor your readiness. Stay in the fight.";
      }

      return `Stress level at ${stress}/10, ${workoutsThisWeek} workouts logged this week. ${recommendation}`;
    }

    // NUTRITION / MACRO / FOOD / EAT
    if (
      lowerMessage.includes('nutrition') ||
      lowerMessage.includes('macro') ||
      lowerMessage.includes('food') ||
      lowerMessage.includes('eat')
    ) {
      const nutrition = operator.nutrition;
      const today = new Date().toISOString().split('T')[0];
      const todayMeals = nutrition?.meals?.[today] || [];
      const currentCalories = todayMeals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
      const targetCalories = nutrition?.targets?.calories || 2500;
      const currentProtein = todayMeals.reduce((sum: number, m: any) => sum + (m.protein || 0), 0);
      const targetProtein = nutrition?.targets?.protein || 150;

      let recommendation = '';
      if (currentCalories < targetCalories * 0.9) {
        recommendation = 'You\'re under your calorie target. Fuel up — add a meal or snack. Get after it.';
      } else if (currentCalories > targetCalories * 1.1) {
        recommendation =
          'You\'re above target. Watch portion control on your next meal. Stay disciplined.';
      } else {
        recommendation = 'You\'re tracking solid on calories. Keep the discipline.';
      }

      return `Today's intake: ${currentCalories}/${targetCalories} calories. Protein at ${currentProtein}g/${targetProtein}g. ${recommendation}`;
    }

    // INJURY / HURT / PAIN
    if (
      lowerMessage.includes('injury') ||
      lowerMessage.includes('hurt') ||
      lowerMessage.includes('pain')
    ) {
      const injuries = operator.injuries || [];

      if (injuries.length > 0) {
        const injuryList = injuries
          .map((inj) => `${inj.name} (${inj.restrictions?.join(', ') || 'avoid heavy loading'})`)
          .join(', ');
        return `Active injuries on the books: ${injuryList}. Follow your restrictions, champ. No heroes. Stay smart, stay in the fight.`;
      } else {
        return `No injuries logged, champ. You're clean. Keep that body healthy — mobility work, form checks, listen to the signals.`;
      }
    }

    // DEFAULT
    return "Stay in the fight, champ. What do you need — programming, nutrition check, readiness report, or injury status?";
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

    // Generate Gunny response
    setTimeout(() => {
      const gunnyResponse: Message = {
        id: 'gunny-' + Date.now(),
        role: 'gunny',
        text: generateGunnyResponse(inputValue),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, gunnyResponse]);
    }, 300);

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
    'Program my week',
    'What today?',
    'PR ready?',
    'Deload check',
    'Nutrition check',
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0a0a0a',
        color: '#ccc',
        fontFamily: '"Chakra Petch", monospace',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid rgba(0,255,65,0.15)',
          backgroundColor: 'rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontFamily: '"Orbitron", sans-serif',
            color: '#00ff41',
            fontWeight: 700,
            textShadow: '0 0 10px #00ff41, 0 0 20px rgba(0,255,65,0.5)',
            marginBottom: '4px',
            letterSpacing: '2px',
          }}
        >
          GUNNY
        </div>
        <div
          style={{
            fontSize: '9px',
            fontFamily: '"Chakra Petch", monospace',
            color: '#555',
            letterSpacing: '1px',
            marginBottom: '8px',
          }}
        >
          AI TACTICAL TRAINER // CONTEXT-AWARE
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
              boxShadow: '0 0 8px #00ff41, inset 0 0 4px rgba(255,255,255,0.3)',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#00ff41',
              letterSpacing: '1px',
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
          borderBottom: '1px solid rgba(0,255,65,0.08)',
          backgroundColor: 'rgba(0,255,65,0.01)',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickAction(action)}
            style={{
              padding: '8px 12px',
              fontSize: '9px',
              fontFamily: '"Chakra Petch", monospace',
              color: '#00ff41',
              backgroundColor: 'rgba(0,255,65,0.02)',
              border: '1px solid rgba(0,255,65,0.08)',
              clipPath: 'polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
            onMouseEnter={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.backgroundColor = 'rgba(0,255,65,0.06)';
              target.style.boxShadow = '0 0 8px rgba(0,255,65,0.2)';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.backgroundColor = 'rgba(0,255,65,0.02)';
              target.style.boxShadow = 'none';
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
          backgroundColor: '#0a0a0a',
        }}
      >
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
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#0a0a0a',
                  flexShrink: 0,
                  boxShadow: '0 0 12px rgba(0,255,65,0.4)',
                }}
              >
                G
              </div>
            )}

            <div
              style={{
                maxWidth: '70%',
                padding: '12px 14px',
                borderRadius: '2px',
                fontSize: '12px',
                lineHeight: '1.5',
                backgroundColor:
                  message.role === 'user'
                    ? 'rgba(0,150,255,0.08)'
                    : 'rgba(0,255,65,0.02)',
                border:
                  message.role === 'user'
                    ? '1px solid rgba(0,150,255,0.2)'
                    : '1px solid rgba(0,255,65,0.06)',
                color: '#ccc',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
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
          borderTop: '1px solid rgba(0,255,65,0.15)',
          backgroundColor: 'rgba(0,0,0,0.6)',
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
          placeholder="Talk to Gunny, champ..."
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: '12px',
            fontFamily: '"Chakra Petch", monospace',
            backgroundColor: 'rgba(0,255,65,0.02)',
            border: '1px solid rgba(0,255,65,0.06)',
            color: '#ccc',
            outline: 'none',
            transition: 'all 0.2s ease',
            borderRadius: '2px',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,255,65,0.2)';
            e.currentTarget.style.boxShadow = '0 0 8px rgba(0,255,65,0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,255,65,0.06)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <button
          onClick={handleSendMessage}
          style={{
            padding: '10px 14px',
            fontSize: '11px',
            fontFamily: '"Chakra Petch", monospace',
            color: '#0a0a0a',
            backgroundColor: '#00ff41',
            border: 'none',
            clipPath: 'polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)',
            cursor: 'pointer',
            fontWeight: 700,
            transition: 'all 0.2s ease',
            letterSpacing: '1px',
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.boxShadow = '0 0 12px rgba(0,255,65,0.6)';
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
