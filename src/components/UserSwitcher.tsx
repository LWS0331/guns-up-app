'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Operator } from '@/lib/types';

interface UserSwitcherProps {
  currentUser: Operator;
  accessibleUsers: Operator[];
  selectedUser: Operator;
  onSelectUser: (user: Operator) => void;
  onLogout: () => void;
}

const UserSwitcher: React.FC<UserSwitcherProps> = ({
  currentUser,
  accessibleUsers,
  selectedUser,
  onSelectUser,
  onLogout,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (user: Operator) => {
    onSelectUser(user);
    setIsOpen(false);
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      {/* User Switcher Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '8px',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          fontWeight: 600,
          color: '#00ff41',
          backgroundColor: 'rgba(0, 255, 65, 0.08)',
          border: '1px solid rgba(0, 255, 65, 0.2)',
          padding: '6px 12px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
          clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor =
            'rgba(0, 255, 65, 0.12)';
          (e.target as HTMLButtonElement).style.borderColor =
            'rgba(0, 255, 65, 0.3)';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor =
            'rgba(0, 255, 65, 0.08)';
          (e.target as HTMLButtonElement).style.borderColor =
            'rgba(0, 255, 65, 0.2)';
        }}
      >
        {selectedUser.callsign}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '4px',
            backgroundColor: '#0e0e0e',
            border: '1px solid rgba(0, 255, 65, 0.08)',
            borderRadius: '2px',
            zIndex: 1000,
            minWidth: '180px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8)',
            overflow: 'hidden',
          }}
        >
          {/* User List */}
          <div style={{ padding: '8px 0' }}>
            {accessibleUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor:
                    selectedUser.id === user.id
                      ? 'rgba(0, 255, 65, 0.06)'
                      : 'transparent',
                  border: 'none',
                  color: '#00ff41',
                  fontFamily: '"Chakra Petch", sans-serif',
                  fontSize: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor =
                    'rgba(0, 255, 65, 0.1)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor =
                    selectedUser.id === user.id
                      ? 'rgba(0, 255, 65, 0.06)'
                      : 'transparent';
                }}
              >
                {/* Green Indicator Dot for Active User */}
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor:
                      selectedUser.id === user.id ? '#00ff41' : 'rgba(0, 255, 65, 0.2)',
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <span
                    style={{
                      fontWeight: selectedUser.id === user.id ? 700 : 500,
                      fontSize: '11px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {user.callsign}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'rgba(0, 255, 65, 0.5)',
                      fontWeight: 400,
                    }}
                  >
                    {user.name}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div
            style={{
              height: '1px',
              backgroundColor: 'rgba(0, 255, 65, 0.06)',
              margin: '0',
            }}
          />

          {/* Logout Button */}
          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: 'rgba(255, 68, 68, 0.06)',
              border: 'none',
              color: 'rgba(255, 68, 68, 0.8)',
              fontFamily: '"Chakra Petch", sans-serif',
              fontSize: '12px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              outline: 'none',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor =
                'rgba(255, 68, 68, 0.12)';
              (e.target as HTMLButtonElement).style.color = 'rgba(255, 68, 68, 1)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor =
                'rgba(255, 68, 68, 0.06)';
              (e.target as HTMLButtonElement).style.color = 'rgba(255, 68, 68, 0.8)';
            }}
          >
            LOGOUT
          </button>
        </div>
      )}
    </div>
  );
};

export default UserSwitcher;
