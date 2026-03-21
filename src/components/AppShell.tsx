'use client';

import React, { useState } from 'react';
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

  // Keep selectedOperator in sync with operators state
  const currentSelectedOp = operators.find(op => op.id === selectedOperator.id) || selectedOperator;

  const tabs: { id: AppTab; label: string }[] = [
    { id: 'coc', label: 'COC' },
    { id: 'planner', label: 'PLANNER' },
    { id: 'intel', label: 'INTEL' },
    { id: 'gunny', label: 'GUNNY' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'coc':
        return (
          <COCDashboard
            operator={currentSelectedOp}
            allOperators={accessibleUsers}
          />
        );
      case 'planner':
        return (
          <Planner
            operator={currentSelectedOp}
            onUpdateOperator={onUpdateOperator}
          />
        );
      case 'intel':
        return (
          <IntelCenter
            operator={currentSelectedOp}
            onUpdateOperator={onUpdateOperator}
          />
        );
      case 'gunny':
        return (
          <GunnyChat
            operator={currentSelectedOp}
            allOperators={accessibleUsers}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100vh',
        backgroundColor: '#030303',
        color: '#00ff41',
        fontFamily: '"Chakra Petch", sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header Bar */}
      <header
        style={{
          height: '48px',
          backgroundColor: '#080808',
          borderBottom: '1px solid rgba(0, 255, 65, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: '16px',
          paddingRight: '16px',
          flexShrink: 0,
        }}
      >
        {/* Left: Logo and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Logo size={28} color="#00ff41" />
          <span
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '2px',
              color: '#00ff41',
              textTransform: 'uppercase',
            }}
          >
            GUNS UP
          </span>
        </div>

        {/* Center: Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '4px', flex: 1, justifyContent: 'center' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '8px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase' as const,
                fontWeight: activeTab === tab.id ? 800 : 400,
                color: activeTab === tab.id ? '#00ff41' : '#3a3a3a',
                backgroundColor: activeTab === tab.id ? 'rgba(0, 255, 65, 0.08)' : 'transparent',
                border: activeTab === tab.id ? '1px solid rgba(0, 255, 65, 0.2)' : '1px solid transparent',
                padding: '6px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                outline: 'none',
                clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right: User Switcher */}
        <UserSwitcher
          currentUser={currentUser}
          accessibleUsers={accessibleUsers}
          selectedUser={currentSelectedOp}
          onSelectUser={setSelectedOperator}
          onLogout={onLogout}
        />
      </header>

      {/* Amber Gradient Accent Line */}
      <div
        style={{
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #ffb800 30%, #ffb800 70%, transparent)',
          flexShrink: 0,
        }}
      />

      {/* Content Area */}
      <main style={{ flex: 1, overflow: 'auto', backgroundColor: '#030303' }}>
        {renderTabContent()}
      </main>
    </div>
  );
};

export default AppShell;
