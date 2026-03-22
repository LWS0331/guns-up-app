'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Operator, AppTab, OPS_CENTER_ACCESS } from '@/lib/types';
import Logo from '@/components/Logo';
import OpsCenter from '@/components/OpsCenter';
import UserSwitcher from '@/components/UserSwitcher';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/lib/i18n';
import COCDashboard from '@/components/COCDashboard';
import Planner from '@/components/Planner';
import IntelCenter from '@/components/IntelCenter';
import { GunnyChat } from '@/components/GunnyChat';
import IntakeForm from '@/components/IntakeForm';
import Leaderboard from '@/components/Leaderboard';
import Achievements from '@/components/Achievements';
import SocialFeed from '@/components/SocialFeed';

// ═══ Matrix Code Rain Background ═══
const DataRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const chars = '01アイウエオカキクケコサシスセソABCDEF0123456789ΣΩΔλ{}[]<>/\\=+*&#@';
    const fontSize = 13;
    let columns: number;
    let drops: number[];
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = Array.from({ length: columns }, () => Math.random() * -100);
    };
    resize();
    window.addEventListener('resize', resize);
    const draw = () => {
      ctx.fillStyle = 'rgba(3,3,3,0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px 'Share Tech Mono', monospace`;
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,255,65,0.12)' : 'rgba(0,255,65,0.06)';
        ctx.fillText(char, x, y);
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += Math.random() > 0.5 ? 1 : 0.5;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />;
};

// ═══ Gunny Chat Message Types ═══
interface ChatMessage {
  role: 'user' | 'gunny';
  text: string;
  timestamp?: number;
}

interface OperatorContextData {
  callsign: string;
  name: string;
  role: string;
  weight?: number;
  goals?: string[];
  readiness?: number;
  prs?: Array<{ exercise: string; weight: number }>;
  injuries?: Array<{ id: string; name: string; status: string; notes?: string; restrictions?: string[] }>;
  trainerNotes?: string;
  language?: string;
}

interface AppShellProps {
  currentUser: Operator;
  accessibleUsers: Operator[];
  operators: Operator[];
  onUpdateOperator: (updated: Operator) => void;
  onLogout: () => void;
}

const AppShell: React.FC<AppShellProps> = ({
  currentUser,
  accessibleUsers,
  operators,
  onUpdateOperator,
  onLogout,
}) => {
  const { t, language } = useLanguage();
  // Check if intake is completed
  const intakeCompleted = currentUser.intake?.completed === true;
  const [showIntake, setShowIntake] = useState(!intakeCompleted);
  // Auto-switch to Gunny tab if profile is incomplete (onboarding needed)
  const profileIncomplete = !currentUser.profile?.age || !currentUser.profile?.weight || !currentUser.profile?.goals?.length || !currentUser.preferences?.daysPerWeek;
  const [activeTab, setActiveTab] = useState<AppTab>(profileIncomplete && intakeCompleted ? 'gunny' : 'coc');
  const [selectedOperator, setSelectedOperator] = useState<Operator>(currentUser);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const lastWidthRef = useRef(0);

  // Gunny AI panel state
  const [showGunnyPanel, setShowGunnyPanel] = useState(false);
  const [gunnyMessages, setGunnyMessages] = useState<ChatMessage[]>([]);
  const [gunnyInput, setGunnyInput] = useState('');
  const [gunnyLoading, setGunnyLoading] = useState(false);
  const [gunnyGreeted, setGunnyGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelInitRef = useRef<string>(''); // track which operator panel was initialized for

  // Initialize mounted state and responsive detection
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

  // Auto-scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gunnyMessages]);

  // Load saved panel chat or generate greeting when panel opens
  useEffect(() => {
    if (!showGunnyPanel) return;
    // Only initialize once per operator
    if (panelInitRef.current === selectedOperator.id) return;
    panelInitRef.current = selectedOperator.id;

    const loadPanelChat = async () => {
      // Try API first
      try {
        const res = await fetch(`/api/chat?operatorId=${selectedOperator.id}&chatType=gunny-panel`);
        if (res.ok) {
          const data = await res.json();
          const msgs = data.messages as ChatMessage[];
          if (Array.isArray(msgs) && msgs.length > 0) {
            setGunnyMessages(msgs);
            setGunnyGreeted(true);
            return;
          }
        }
      } catch { /* API unavailable */ }

      // Fallback to localStorage
      try {
        const key = `gunny-panel-${selectedOperator.id}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const saved = JSON.parse(raw) as ChatMessage[];
          if (Array.isArray(saved) && saved.length > 0) {
            setGunnyMessages(saved);
            setGunnyGreeted(true);
            // Migrate to API
            fetch('/api/chat', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ operatorId: selectedOperator.id, chatType: 'gunny-panel', messages: saved }),
            }).catch(() => {});
            return;
          }
        }
      } catch { /* ignore */ }

      // No saved history — show context-aware greeting
      setGunnyGreeted(true);
      const tab = activeTab;
      let greeting = '';
      if (tab === 'coc') {
        greeting = `Eyes on your dashboard, ${selectedOperator.callsign}. Need help reading your stats, planning today's session, or adjusting anything?`;
      } else if (tab === 'planner') {
        greeting = `I can see your planner, ${selectedOperator.callsign}. Need to modify a workout, swap an exercise, adjust volume, or build something new?`;
      } else if (tab === 'intel') {
        greeting = `Reviewing your Intel, ${selectedOperator.callsign}. Want to update your profile, adjust targets, log a new PR, or check your injury status?`;
      } else {
        greeting = `Standing by, ${selectedOperator.callsign}. I can see what you're working on — what do you need?`;
      }
      setGunnyMessages([{
        role: 'gunny',
        text: greeting,
        timestamp: Date.now(),
      }]);
    };
    loadPanelChat();
  }, [showGunnyPanel, selectedOperator.id, selectedOperator.callsign]);

  // Persist panel messages (API + localStorage fallback)
  const prevPanelMsgCountRef = useRef(0);
  useEffect(() => {
    if (gunnyMessages.length > 0 && gunnyMessages.length !== prevPanelMsgCountRef.current) {
      prevPanelMsgCountRef.current = gunnyMessages.length;
      // Save to API (non-blocking)
      fetch('/api/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: selectedOperator.id, chatType: 'gunny-panel', messages: gunnyMessages }),
      }).catch(() => {});
      // Also save to localStorage as fallback
      try {
        localStorage.setItem(`gunny-panel-${selectedOperator.id}`, JSON.stringify(gunnyMessages));
      } catch { /* storage full */ }
    }
  }, [gunnyMessages, selectedOperator.id]);

  // Focus input when panel opens
  useEffect(() => {
    if (showGunnyPanel && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showGunnyPanel]);

  // ═══ Screen Context for Side-Panel Gunny ═══
  // Reads what the user is currently looking at and builds a text summary
  const getScreenContext = (): string => {
    const op = currentSelectedOp;
    const today = new Date().toISOString().split('T')[0];
    const todayWorkout = op.workouts?.[today];

    let context = `CURRENT SCREEN: ${activeTab.toUpperCase()} tab\n`;

    if (activeTab === 'coc') {
      // COC Dashboard — show summary stats
      const totalWorkouts = Object.keys(op.workouts || {}).length;
      const thisWeekWorkouts = Object.keys(op.workouts || {}).filter(d => {
        const diff = (new Date().getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff < 7;
      }).length;
      context += `The operator is viewing their Command Center dashboard.\n`;
      context += `Total workouts logged: ${totalWorkouts}\n`;
      context += `Workouts this week: ${thisWeekWorkouts}\n`;
      context += `Readiness: ${op.profile?.readiness || 'unknown'}/10\n`;
      if (todayWorkout) {
        context += `Today's workout: "${todayWorkout.title}" — ${todayWorkout.blocks.length} blocks\n`;
      } else {
        context += `No workout scheduled for today.\n`;
      }
    } else if (activeTab === 'planner') {
      // Planner — show today's workout details if exists
      context += `The operator is viewing their workout planner.\n`;
      if (todayWorkout) {
        context += `Today's workout: "${todayWorkout.title}"\n`;
        if (todayWorkout.warmup) context += `Warmup: ${todayWorkout.warmup}\n`;
        todayWorkout.blocks.forEach((block, i) => {
          if (block.type === 'exercise') {
            context += `  ${String.fromCharCode(65 + i)}) ${block.exerciseName} — ${block.prescription}\n`;
          } else {
            context += `  ${String.fromCharCode(65 + i)}) [Conditioning] ${block.format}: ${block.description}\n`;
          }
        });
        if (todayWorkout.cooldown) context += `Cooldown: ${todayWorkout.cooldown}\n`;
        if (todayWorkout.notes) context += `Coach's Notes: ${todayWorkout.notes}\n`;
      } else {
        context += `No workout scheduled for today. The operator may be browsing other days.\n`;
      }
      // Recent workout history
      const recentDates = Object.keys(op.workouts || {}).sort().reverse().slice(0, 5);
      if (recentDates.length > 0) {
        context += `Recent workouts: ${recentDates.map(d => `${d}: "${op.workouts[d].title}"`).join(', ')}\n`;
      }
    } else if (activeTab === 'intel') {
      // Intel Center — profile, nutrition, PRs, injuries
      context += `The operator is viewing their Intel Center (profile/data hub).\n`;
      context += `Profile: ${op.profile?.age}yo, ${op.profile?.height}, ${op.profile?.weight}lbs, ${op.profile?.bodyFat}% BF, Training age: ${op.profile?.trainingAge}\n`;
      context += `Goals: ${op.profile?.goals?.join(', ') || 'none set'}\n`;
      if (op.prs?.length > 0) {
        context += `PRs: ${op.prs.map(pr => `${pr.exercise}: ${pr.weight}lbs`).join(', ')}\n`;
      }
      if (op.injuries?.length > 0) {
        context += `Injuries: ${op.injuries.map(inj => `${inj.name} (${inj.status})${inj.restrictions?.length ? ' — avoid: ' + inj.restrictions.join(', ') : ''}`).join('; ')}\n`;
      }
      const nutri = op.nutrition?.targets;
      if (nutri) {
        context += `Nutrition targets: ${nutri.calories} cal, ${nutri.protein}g protein, ${nutri.carbs}g carbs, ${nutri.fat}g fat\n`;
      }
    } else if (activeTab === 'gunny') {
      context += `The operator has the full Gunny AI tab open (gameplan/programming mode). They opened the side panel for quick contextual help.\n`;
    }

    return context;
  };

  // Build operator context for API
  const buildOperatorContext = (): OperatorContextData => {
    const op = selectedOperator;
    return {
      callsign: op.callsign,
      name: op.name,
      role: op.role || 'operator',
      weight: op.profile?.weight,
      goals: op.profile?.goals,
      readiness: op.profile?.readiness,
      prs: op.prs?.map(pr => ({ exercise: pr.exercise, weight: pr.weight })),
      injuries: op.injuries?.map(inj => ({
        id: inj.id,
        name: inj.name,
        status: inj.status,
        notes: inj.notes,
        restrictions: inj.restrictions,
      })),
      trainerNotes: op.trainerNotes,
      language: language || 'en',
    };
  };

  // Send message to Gunny API (side panel — context-aware mode)
  const sendGunnyMessage = async () => {
    if (!gunnyInput.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      text: gunnyInput,
      timestamp: Date.now(),
    };

    setGunnyMessages(prev => [...prev, userMessage]);
    setGunnyInput('');
    setGunnyLoading(true);

    try {
      // Build trainer dataset for sidebar assistant
      const trainer = selectedOperator.trainerId ? operators.find(op => op.id === selectedOperator.trainerId) : null;
      const trainerData = trainer ? {
        workouts: trainer.workouts,
        preferences: trainer.preferences,
        prs: trainer.prs,
        profile: trainer.profile,
        trainerNotes: selectedOperator.trainerNotes,
      } : null;

      const response = await fetch('/api/gunny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...gunnyMessages, userMessage],
          operatorContext: buildOperatorContext(),
          tier: selectedOperator.tier || 'standard',
          mode: 'assistant',
          screenContext: getScreenContext(),
          ...(trainerData && { trainerData }),
        }),
      });

      if (!response.ok) throw new Error('Gunny API error');

      const data = await response.json();
      const gunnyReply: ChatMessage = {
        role: 'gunny',
        text: data.response || data.message || data.text || 'Copy that, soldier.',
        timestamp: Date.now(),
      };
      setGunnyMessages(prev => [...prev, gunnyReply]);
    } catch (error) {
      console.error('Gunny API error:', error);
      // Only add error message if the last message isn't already an error
      setGunnyMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'gunny' && lastMsg.text.includes('temporarily offline')) {
          return prev; // Don't duplicate error messages
        }
        return [...prev, {
          role: 'gunny' as const,
          text: `Comms disrupted, ${selectedOperator.callsign}. Check your connection and try again. If this persists, the API key may need attention.`,
          timestamp: Date.now(),
        }];
      });
    } finally {
      setGunnyLoading(false);
    }
  };

  const currentSelectedOp = operators.find(op => op.id === selectedOperator.id) || selectedOperator;

  const baseTabs: { id: AppTab; label: string; labelKey: string; icon: string }[] = [
    { id: 'coc', label: t('nav.coc_short'), labelKey: 'nav.coc_short', icon: '◆' },
    { id: 'planner', label: t('nav.planner'), labelKey: 'nav.planner', icon: '▦' },
    { id: 'intel', label: t('nav.intel_short'), labelKey: 'nav.intel_short', icon: '◈' },
    { id: 'gunny', label: t('nav.gunny_short'), labelKey: 'nav.gunny_short', icon: '▶' },
  ];

  // Conditionally add OPS CENTER tab for admin users only
  const tabs = OPS_CENTER_ACCESS.includes(currentUser.id)
    ? [...baseTabs, { id: 'ops' as AppTab, label: 'OPS', labelKey: 'nav.ops', icon: '⬡' }]
    : baseTabs;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'coc':
        return (
          <>
            <COCDashboard operator={currentSelectedOp} allOperators={accessibleUsers} />
            <Leaderboard operators={operators} currentUser={currentUser} />
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#e040fb', letterSpacing: 1, marginBottom: 12 }}>ACHIEVEMENTS</h3>
              <Achievements operator={currentSelectedOp} />
            </div>
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00bcd4', letterSpacing: 1, marginBottom: 12 }}>SQUAD FEED</h3>
              <SocialFeed operators={operators} currentOperator={currentSelectedOp} />
            </div>
          </>
        );
      case 'planner':
        return <Planner operator={currentSelectedOp} onUpdateOperator={onUpdateOperator} />;
      case 'intel':
        return <IntelCenter operator={currentSelectedOp} currentUser={currentUser} onUpdateOperator={onUpdateOperator} />;
      case 'gunny':
        return <GunnyChat operator={currentSelectedOp} allOperators={accessibleUsers} onUpdateOperator={onUpdateOperator} />;
      case 'ops':
        return <OpsCenter currentUser={currentUser} operators={operators} />;
      default:
        return null;
    }
  };

  // Show intake form if not completed
  if (showIntake && !intakeCompleted) {
    return (
      <div style={{ width: '100%', minHeight: '100dvh', backgroundColor: '#030303', color: '#00ff41', fontFamily: '"Chakra Petch", sans-serif', overflow: 'auto' }}>
        <DataRain />
        <div style={{ position: 'relative', zIndex: 1, padding: '20px 0' }}>
          <IntakeForm
            operator={currentUser}
            onComplete={(updated) => {
              onUpdateOperator(updated);
              setShowIntake(false);
            }}
            onSkip={() => setShowIntake(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100dvh',
      backgroundColor: '#030303',
      color: '#00ff41',
      fontFamily: '"Chakra Petch", sans-serif',
      overflow: 'hidden',
    }}>

      <style>{`
        @keyframes breathingGlow {
          0%, 100% { text-shadow: 0 0 8px rgba(0,255,65,0.3), 0 0 12px rgba(0,255,65,0.1); }
          50% { text-shadow: 0 0 12px rgba(0,255,65,0.5), 0 0 20px rgba(0,255,65,0.2); }
        }

        @keyframes accentPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }

        @keyframes cornerBracketIn {
          from { opacity: 0; }
          to { opacity: 0.4; }
        }

        .guns-up-breathing {
          animation: breathingGlow 3s ease-in-out infinite;
        }

        .accent-pulse {
          animation: accentPulse 2.5s ease-in-out infinite;
        }

        .bracket-decoration {
          position: absolute;
          pointer-events: none;
          animation: cornerBracketIn 0.6s ease-out forwards;
        }

        .bracket-tl::before, .bracket-tl::after { content: ''; position: absolute; background: #ffb800; }
        .bracket-tl::before { width: 12px; height: 2px; top: 0; left: 0; }
        .bracket-tl::after { width: 2px; height: 12px; top: 0; left: 0; }

        .bracket-tr::before, .bracket-tr::after { content: ''; position: absolute; background: #ffb800; }
        .bracket-tr::before { width: 12px; height: 2px; top: 0; right: 0; }
        .bracket-tr::after { width: 2px; height: 12px; top: 0; right: 0; }

        .bracket-bl::before, .bracket-bl::after { content: ''; position: absolute; background: #ffb800; }
        .bracket-bl::before { width: 12px; height: 2px; bottom: 0; left: 0; }
        .bracket-bl::after { width: 2px; height: 12px; bottom: 0; left: 0; }

        .bracket-br::before, .bracket-br::after { content: ''; position: absolute; background: #ffb800; }
        .bracket-br::before { width: 12px; height: 2px; bottom: 0; right: 0; }
        .bracket-br::after { width: 2px; height: 12px; bottom: 0; right: 0; }

        .nav-tab {
          position: relative;
          font-family: 'Orbitron', sans-serif;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          border: none;
          outline: none;
          background: transparent;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .nav-tab .tab-indicator {
          position: absolute;
          bottom: 0;
          left: 10%;
          right: 10%;
          height: 2px;
          background: #00ff41;
          box-shadow: 0 0 8px rgba(0,255,65,0.4);
          transform: scaleX(0);
          transition: transform 0.25s ease;
        }
        .nav-tab.active .tab-indicator {
          transform: scaleX(1);
        }
        .nav-tab:hover { color: #00ff41 !important; }
        .nav-tab .tab-icon { transition: opacity 0.2s ease; }

        /* Mobile bottom nav */
        .bottom-nav {
          display: none;
        }
        .desktop-nav {
          display: flex;
        }

        /* Gunny panel styles */
        .gunny-panel-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 300;
          animation: fadeIn 0.3s ease;
        }

        .gunny-panel {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 380px;
          background: rgba(3, 3, 3, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-right: 3px solid #ffb800;
          box-shadow: 8px 0 32px rgba(0, 0, 0, 0.8);
          display: flex;
          flex-direction: column;
          z-index: 310;
          animation: slideInLeft 0.35s cubic-bezier(0.25, 1, 0.5, 1);
        }

        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .gunny-header {
          padding: 16px;
          border-bottom: 1px solid rgba(255, 184, 0, 0.2);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }

        .gunny-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .gunny-message {
          padding: 12px;
          border-radius: 4px;
          font-size: 14px;
          line-height: 1.5;
          max-width: 100%;
          word-wrap: break-word;
          animation: messageSlideIn 0.3s ease;
        }

        @keyframes messageSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .gunny-message.user {
          align-self: flex-end;
          background: rgba(0, 255, 65, 0.12);
          border-left: 2px solid #00ff41;
          color: #00ff41;
          max-width: 90%;
        }

        .gunny-message.gunny {
          align-self: flex-start;
          background: rgba(255, 184, 0, 0.08);
          border-left: 2px solid #ffb800;
          color: #ffb800;
          max-width: 90%;
        }

        .gunny-input-area {
          padding: 12px;
          border-top: 1px solid rgba(255, 184, 0, 0.2);
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .gunny-input {
          flex: 1;
          padding: 10px 12px;
          background: rgba(255, 184, 0, 0.06);
          border: 1px solid rgba(255, 184, 0, 0.3);
          border-radius: 4px;
          color: #ffb800;
          font-family: 'Share Tech Mono', monospace;
          font-size: 16px;
          transition: all 0.2s ease;
          outline: none;
        }

        .gunny-input:focus {
          background: rgba(255, 184, 0, 0.1);
          border-color: #ffb800;
          box-shadow: 0 0 12px rgba(255, 184, 0, 0.2);
        }

        .gunny-input::placeholder {
          color: rgba(255, 184, 0, 0.4);
        }

        .gunny-send-btn {
          padding: 10px 16px;
          background: rgba(255, 184, 0, 0.15);
          border: 1px solid #ffb800;
          border-radius: 4px;
          color: #ffb800;
          cursor: pointer;
          font-family: 'Orbitron', sans-serif;
          font-size: 12px;
          font-weight: 700;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .gunny-send-btn:hover:not(:disabled) {
          background: rgba(255, 184, 0, 0.25);
          box-shadow: 0 0 12px rgba(255, 184, 0, 0.3);
        }

        .gunny-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .gunny-toggle-btn {
          position: fixed;
          left: 8px;
          bottom: 70px;
          padding: 6px 12px;
          background: linear-gradient(135deg, rgba(255,184,0,0.2), rgba(255,184,0,0.1));
          border: 1px solid rgba(255,184,0,0.5);
          border-radius: 6px;
          color: #ffb800;
          cursor: pointer;
          font-family: 'Orbitron', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
          writing-mode: horizontal-tb;
          z-index: 9997;
          transition: all 0.3s ease;
          box-shadow: 0 2px 12px rgba(255,184,0,0.15);
          animation: togglePulse 3s ease-in-out infinite;
        }

        .gunny-toggle-btn:hover {
          background: linear-gradient(135deg, rgba(255,184,0,0.35), rgba(255,184,0,0.2));
          box-shadow: 0 2px 20px rgba(255,184,0,0.3);
        }

        @keyframes togglePulse {
          0%, 100% { box-shadow: 4px 0 20px rgba(255,184,0,0.15); }
          50% { box-shadow: 4px 0 24px rgba(255,184,0,0.3); }
        }

        .classification-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 16px;
          background: rgba(3, 3, 3, 0.95);
          border-top: 1px solid rgba(0, 255, 65, 0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          color: rgba(0, 255, 65, 0.15);
          letter-spacing: 2px;
          z-index: 50;
          pointer-events: none;
        }

        @media (max-width: 768px) {
          .bottom-nav {
            display: flex !important;
          }
          .desktop-nav {
            display: none !important;
          }
          .desktop-user-switcher {
            display: none !important;
          }

          .gunny-panel {
            width: 85%;
            max-width: 340px;
            animation: slideInLeft 0.35s cubic-bezier(0.25, 1, 0.5, 1);
          }

          .gunny-toggle-btn {
            bottom: 64px;
            left: 6px;
            padding: 5px 10px;
            font-size: 9px;
          }

          .classification-bar {
            display: none !important;
          }
        }
      `}</style>

      {/* ═══ OVERWATCH-style background overlays ═══ */}
      {/* Scanline overlay */}
      <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,.012) 2px, rgba(0,255,65,.012) 4px)', mixBlendMode: 'screen', pointerEvents: 'none', zIndex: 999 }} />
      {/* Background grid + radar ellipses */}
      <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
        <defs><pattern id="gu-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(0,255,65,0.03)" strokeWidth="0.5" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#gu-grid)" />
        <g opacity=".05" stroke="#00ff41" fill="none" strokeWidth=".4">
          <ellipse cx="50%" cy="55%" rx="350" ry="200"/>
          <ellipse cx="50%" cy="55%" rx="270" ry="150"/>
          <ellipse cx="50%" cy="55%" rx="190" ry="100"/>
          <ellipse cx="50%" cy="55%" rx="110" ry="55"/>
        </g>
      </svg>
      {/* Matrix code rain */}
      <DataRain />

      {/* Top Header Bar */}
      <header style={{
        height: isMobile ? '44px' : '52px',
        background: 'linear-gradient(180deg, rgba(10,10,10,0.95) 0%, rgba(5,5,5,0.98) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0, 255, 65, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: isMobile ? '12px' : '20px',
        paddingRight: isMobile ? '12px' : '20px',
        flexShrink: 0,
        position: 'relative',
        zIndex: 100,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}>
        {/* Left: Logo and Title */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '8px' : '12px',
        }}>
          <Logo size={isMobile ? 22 : 26} color="#00ff41" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span className="guns-up-breathing" style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: isMobile ? '10px' : '11px',
              fontWeight: 700,
              letterSpacing: '3px',
              color: '#00ff41',
            }}>
              GUNS UP
            </span>
            <span style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: '15px',
              color: '#666',
              letterSpacing: '1px',
            }}>
              {currentSelectedOp.callsign}
            </span>
          </div>
        </div>

        {/* Center: Desktop Navigation Tabs */}
        <nav className="desktop-nav" style={{
          gap: '2px',
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isOps = tab.id === 'ops';
            const activeColor = isOps ? '#ff2020' : '#00ff41';
            return (
              <button
                key={tab.id}
                className={`nav-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  fontSize: '15px',
                  padding: '8px 20px',
                  fontWeight: isActive ? 800 : 500,
                  color: isActive ? activeColor : '#3a3a3a',
                  backgroundColor: isActive ? (isOps ? 'rgba(255, 32, 32, 0.06)' : 'rgba(0, 255, 65, 0.04)') : 'transparent',
                }}
              >
                <span className="tab-icon" style={{
                  fontSize: '15px',
                  opacity: isActive ? 1 : 0.3,
                  color: isActive ? activeColor : '#888',
                }}>
                  {tab.icon}
                </span>
                {t(tab.labelKey)}
                <div className="tab-indicator" style={isOps ? { background: '#ff2020', boxShadow: '0 0 8px rgba(255,32,32,0.4)' } : undefined} />
              </button>
            );
          })}
        </nav>

        {/* Right: Language Toggle + User Switcher (desktop) */}
        <div className="desktop-user-switcher" style={{ minWidth: '280px', display: 'flex', justifyContent: 'flex-end', gap: '16px', alignItems: 'center' }}>
          <LanguageToggle compact={true} />
          <UserSwitcher
            currentUser={currentUser}
            accessibleUsers={accessibleUsers}
            selectedUser={currentSelectedOp}
            onSelectUser={setSelectedOperator}
            onLogout={onLogout}
          />
        </div>

        {/* Mobile: compact user switcher */}
        {isMobile && (
          <UserSwitcher
            currentUser={currentUser}
            accessibleUsers={accessibleUsers}
            selectedUser={currentSelectedOp}
            onSelectUser={setSelectedOperator}
            onLogout={onLogout}
          />
        )}
      </header>

      {/* Accent Line with pulse animation */}
      <div className="accent-pulse" style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent 5%, rgba(255,184,0,0.6) 30%, #ffb800 50%, rgba(255,184,0,0.6) 70%, transparent 95%)',
        boxShadow: '0 1px 8px rgba(255,184,0,0.15)',
        flexShrink: 0,
      }} />

      {/* Content Area */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#030303',
        position: 'relative',
        paddingBottom: isMobile ? '56px' : '0',
      }}>
        {renderTabContent()}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="bottom-nav" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '56px',
        background: 'linear-gradient(180deg, rgba(8,8,8,0.98) 0%, rgba(3,3,3,1) 100%)',
        borderTop: '1px solid rgba(0,255,65,0.08)',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 200,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 0',
                background: isActive ? 'rgba(0, 255, 65, 0.08)' : 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                minHeight: '44px',
                borderRadius: '4px',
                margin: '0 4px',
              }}
            >
              {/* Active top indicator */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '25%',
                  right: '25%',
                  height: '2px',
                  backgroundColor: '#00ff41',
                  boxShadow: '0 0 8px rgba(0,255,65,0.4)',
                }} />
              )}
              <span style={{
                fontSize: '26px',
                color: isActive ? '#00ff41' : '#666',
                transition: 'color 0.2s ease',
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '15px',
                fontWeight: isActive ? 800 : 500,
                color: isActive ? '#00ff41' : '#666',
                letterSpacing: '1px',
                transition: 'color 0.2s ease',
              }}>
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Gunny AI Toggle — left edge tab, hidden on Gunny tab */}
      {!showGunnyPanel && activeTab !== 'gunny' && (
        <button
          className="gunny-toggle-btn"
          onClick={() => setShowGunnyPanel(true)}
          title="Open Gunny AI"
        >
          ⚡ GUNNY
        </button>
      )}

      {/* Gunny AI Panel Overlay (mobile) */}
      {showGunnyPanel && isMobile && (
        <div
          className="gunny-panel-overlay"
          onClick={() => setShowGunnyPanel(false)}
        />
      )}

      {/* Gunny AI Side Panel */}
      {showGunnyPanel && (
        <div className="gunny-panel">
          {/* Header with Logo and close button */}
          <div className="gunny-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <Logo size={20} color="#ffb800" />
              <span style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                color: '#ffb800',
                letterSpacing: '2px',
              }}>
                GUNNY ASSIST
              </span>
            </div>
            <button
              onClick={() => setShowGunnyPanel(false)}
              style={{
                background: 'rgba(255,68,68,0.1)',
                border: '1px solid rgba(255,68,68,0.3)',
                borderRadius: '4px',
                color: '#ff4444',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '6px 12px',
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700,
                letterSpacing: '1px',
                transition: 'all 0.2s ease',
                minWidth: '44px',
                minHeight: '36px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,68,68,0.2)'; e.currentTarget.style.borderColor = '#ff4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,68,68,0.3)'; }}
            >
              CLOSE
            </button>
          </div>

          {/* Messages Container */}
          <div className="gunny-messages">
            {gunnyMessages.length === 0 && !gunnyGreeted && (
              <div style={{
                textAlign: 'center',
                color: 'rgba(255, 184, 0, 0.4)',
                fontSize: '13px',
                marginTop: '20px',
              }}>
                {t('gunny.waiting') || 'Awaiting orders...'}
              </div>
            )}
            {gunnyMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`gunny-message ${msg.role}`}
              >
                {msg.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="gunny-input-area">
            <input
              ref={inputRef}
              type="text"
              className="gunny-input"
              placeholder="Ask about what you see..."
              value={gunnyInput}
              onChange={(e) => setGunnyInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !gunnyLoading) {
                  sendGunnyMessage();
                }
              }}
              disabled={gunnyLoading}
            />
            <button
              className="gunny-send-btn"
              onClick={sendGunnyMessage}
              disabled={gunnyLoading || !gunnyInput.trim()}
            >
              {gunnyLoading ? '⋯' : '▶'}
            </button>
          </div>
        </div>
      )}

      {/* Classification Bar */}
      <div className="classification-bar">
        GUNS UP — EYES ONLY
      </div>
    </div>
  );
};

export default AppShell;
