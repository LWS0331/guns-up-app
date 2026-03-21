'use client';

import React, { useState, useEffect } from 'react';
import { Operator } from '@/lib/types';
import { OPERATORS, getAccessibleOperators } from '@/data/operators';
import LoginScreen from '@/components/LoginScreen';
import AppShell from '@/components/AppShell';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<Operator | null>(null);
  const [operators, setOperators] = useState<Operator[]>(OPERATORS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load saved state from memory (no localStorage in this env)
    setIsLoaded(true);
  }, []);

  const handleLogin = (operator: Operator) => {
    setCurrentUser(operator);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleUpdateOperator = (updated: Operator) => {
    setOperators(prev => prev.map(op => op.id === updated.id ? updated : op));
  };

  if (!isLoaded) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#030303',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#00ff41',
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '10px',
        letterSpacing: '2px',
      }}>
        INITIALIZING SYSTEMS...
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const accessibleUsers = getAccessibleOperators(currentUser.id, operators);

  return (
    <AppShell
      currentUser={currentUser}
      accessibleUsers={accessibleUsers}
      operators={operators}
      onUpdateOperator={handleUpdateOperator}
      onLogout={handleLogout}
    />
  );
}
