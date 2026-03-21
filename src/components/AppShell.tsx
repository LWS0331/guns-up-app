'use client';

import React, { useState, useEffect } from 'react';
import { Operator, AppTab } from '@/lib/types';
import Logo from '@/components/Logo';
import UserSwitcher from '@/components/UserSwitcher';
import COCDashboard from '@/components/COCDashboard';
import Planner from '@/components/Planner';
import IntelCenter from '@/components/IntelCenter';
import { GunnyChat } from '@/components/GunnyChat';

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
  const [activeTab, setActiveTab] = useState<AppTab>('coc');
  const [selectedOperator, setSelectedOperator] = useState<Operator>(currentUser);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const currentSelectedOp = operators.find(op => op.id === selectedOperator.id) || selectedOperator;

  const tabs: { id: AppTab; label: string; icon: string }[] = [
    { id: 'coc', label: 'COC', icon: '◆' },
    { id: 'planner', label: 'PLANNER', icon: '▦' },
    { id: 'intel', label: 'INTEL', icon: '◈' },
    { id: 'gunny', label: 'GUNNY', icon: '▶' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'coc':
        return <COCDashboard operator={currentSelectedOp} allOperators={accessibleUsers} />;
      case 'planner':
        return <Planner operator={currentSelectedOp} onUpdateOperator={onUpdateOperator} />;
      case 'intel':
        return <IntelCenter operator={currentSelectedOp} onUpdateOperator={onUpdateOperator} />;
      case 'gunny':
        return <GunnyChat operator={currentSelectedOp} allOperators={accessibleUsers} />;
      default:
        return null;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100vh',
      backgroundColor: '#030303',
      color: '#00ff41',
      fontFamily: '"Chakra Petch", sans-serif',
      overflow: 'hidden',
    }}>

      <style>{`
        .nav-tab {
          position: relative;
          font-family: 'Orbitron', sans-serif;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 8px 20px;
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
        .nav-tab:hover {
          color: #00ff41 !important;
        }
        .nav-tab .tab-icon {
          font-size: 7px;
          transition: opacity 0.2s ease;
        }
      `}</style>

      {/* Header Bar */}
      <header style={{
        height: '52px',
        background: 'linear-gradient(180deg, rgba(10,10,10,0.95) 0%, rgba(5,5,5,0.98) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0, 255, 65, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '20px',
        paddingRight: '20px',
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
          gap: '12px',
          minWidth: '140px',
        }}>
          <Logo size={26} color="#00ff41" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '3px',
              color: '#00ff41',
              textShadow: '0 0 8px rgba(0,255,65,0.3)',
            }}>
              GUNS UP
            </span>
            <span style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: '7px',
              color: '#333',
              letterSpacing: '1px',
            }}>
              v2.0 // {currentSelectedOp.callsign}
            </span>
          </div>
        </div>

        {/* Center: Navigation Tabs */}
        <nav style={{
          display: 'flex',
          gap: '2px',
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`nav-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  fontWeight: isActive ? 800 : 500,
                  color: isActive ? '#00ff41' : '#3a3a3a',
                  backgroundColor: isActive ? 'rgba(0, 255, 65, 0.04)' : 'transparent',
                }}
              >
                <span className="tab-icon" style={{
                  opacity: isActive ? 1 : 0.3,
                  color: isActive ? '#00ff41' : '#555',
                }}>
                  {tab.icon}
                </span>
                {tab.label}
                <div className="tab-indicator" />
              </button>
            );
          })}
        </nav>

        {/* Right: User Switcher */}
        <div style={{ minWidth: '140px', display: 'flex', justifyContent: 'flex-end' }}>
          <UserSwitcher
            currentUser={currentUser}
            accessibleUsers={accessibleUsers}
            selectedUser={currentSelectedOp}
            onSelectUser={setSelectedOperator}
            onLogout={onLogout}
          />
        </div>
      </header>

      {/* Accent Line — gradient with glow */}
      <div style={{
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
      }}>
        {renderTabContent()}
      </main>
    </div>
  );
};

export default AppShell;
