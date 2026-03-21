'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Operator, AppTab } from '@/lib/types';
import Logo from '@/components/Logo';
import UserSwitcher from '@/components/UserSwitcher';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/lib/i18n';
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
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AppTab>('coc');
  const [selectedOperator, setSelectedOperator] = useState<Operator>(currentUser);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const lastWidthRef = useRef(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

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

    // Use visualViewport API to detect keyboard open/close on iOS/Android
    const vv = window.visualViewport;
    if (vv) {
      const initialHeight = vv.height;
      const handleViewportResize = () => {
        const currentHeight = vv.height;
        const heightDiff = initialHeight - currentHeight;
        // If viewport shrunk by more than 150px, keyboard is likely open
        const isKeyboard = heightDiff > 150;
        setKeyboardOpen(isKeyboard);
        setViewportHeight(currentHeight);
      };
      vv.addEventListener('resize', handleViewportResize);
      return () => {
        window.removeEventListener('resize', check);
        vv.removeEventListener('resize', handleViewportResize);
      };
    }

    return () => window.removeEventListener('resize', check);
  }, []);

  const currentSelectedOp = operators.find(op => op.id === selectedOperator.id) || selectedOperator;

  const tabs: { id: AppTab; label: string; labelKey: string; icon: string }[] = [
    { id: 'coc', label: t('nav.coc_short'), labelKey: 'nav.coc_short', icon: '◆' },
    { id: 'planner', label: t('nav.planner'), labelKey: 'nav.planner', icon: '▦' },
    { id: 'intel', label: t('nav.intel_short'), labelKey: 'nav.intel_short', icon: '◈' },
    { id: 'gunny', label: t('nav.gunny_short'), labelKey: 'nav.gunny_short', icon: '▶' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'coc':
        return <COCDashboard operator={currentSelectedOp} allOperators={accessibleUsers} />;
      case 'planner':
        return <Planner operator={currentSelectedOp} onUpdateOperator={onUpdateOperator} />;
      case 'intel':
        return <IntelCenter operator={currentSelectedOp} currentUser={currentUser} onUpdateOperator={onUpdateOperator} />;
      case 'gunny':
        return <GunnyChat operator={currentSelectedOp} allOperators={accessibleUsers} onUpdateOperator={onUpdateOperator} />;
      default:
        return null;
    }
  };

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

        @media (max-width: 768px) {
          .bottom-nav {
            display: flex !important;
          }
          .bottom-nav.keyboard-open {
            display: none !important;
          }
          .desktop-nav {
            display: none !important;
          }
          .desktop-user-switcher {
            display: none !important;
          }
        }
      `}</style>

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
            <span style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: isMobile ? '10px' : '11px',
              fontWeight: 700,
              letterSpacing: '3px',
              color: '#00ff41',
              textShadow: '0 0 8px rgba(0,255,65,0.3)',
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
            return (
              <button
                key={tab.id}
                className={`nav-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  fontSize: '15px',
                  padding: '8px 20px',
                  fontWeight: isActive ? 800 : 500,
                  color: isActive ? '#00ff41' : '#3a3a3a',
                  backgroundColor: isActive ? 'rgba(0, 255, 65, 0.04)' : 'transparent',
                }}
              >
                <span className="tab-icon" style={{
                  fontSize: '15px',
                  opacity: isActive ? 1 : 0.3,
                  color: isActive ? '#00ff41' : '#888',
                }}>
                  {tab.icon}
                </span>
                {t(tab.labelKey)}
                <div className="tab-indicator" />
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

      {/* Accent Line */}
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
        paddingBottom: isMobile && !keyboardOpen ? '56px' : '0',
        ...(viewportHeight && keyboardOpen ? { height: `${viewportHeight - (isMobile ? 44 : 52) - 1}px` } : {}),
      }}>
        {renderTabContent()}
      </main>

      {/* Mobile Bottom Tab Bar — hidden when keyboard is open */}
      <nav className={`bottom-nav${keyboardOpen ? ' keyboard-open' : ''}`} style={{
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
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                minHeight: '44px',
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
    </div>
  );
};

export default AppShell;
