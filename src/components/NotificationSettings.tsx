'use client';

import React, { useState, useEffect } from 'react';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  getNotificationPermission,
  requestNotificationPermission,
  NotificationPreferences,
} from '@/lib/notifications';

interface NotificationSettingsProps {
  operatorId: string;
  callsign: string;
}

// Custom toggle switch component
const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => {
  const toggleId = `toggle-${label.replace(/\s+/g, '-')}`;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid rgba(0,255,65,0.08)',
      }}
    >
      <label
        htmlFor={toggleId}
        style={{
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '14px',
          color: '#e0e0e0',
          cursor: 'pointer',
          flex: 1,
        }}
      >
        {label}
      </label>
      <input
        id={toggleId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          cursor: 'pointer',
          width: '40px',
          height: '20px',
          appearance: 'none',
          backgroundColor: checked ? '#00ff41' : '#444',
          border: 'none',
          borderRadius: '10px',
          outline: 'none',
          position: 'relative',
          transition: 'background-color 0.3s ease',
        }}
      />
    </div>
  );
};

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  operatorId,
  callsign,
}) => {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('unsupported');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    const loaded = loadNotificationPrefs(operatorId);
    setPrefs(loaded);
    setPermissionStatus(getNotificationPermission());
  }, [operatorId]);

  const handleToggle = (field: keyof NotificationPreferences, value: boolean) => {
    if (!prefs) return;
    const updated = { ...prefs, [field]: value };
    setPrefs(updated);
    saveNotificationPrefs(operatorId, updated);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!prefs) return;
    const updated = { ...prefs, reminderTime: e.target.value };
    setPrefs(updated);
    saveNotificationPrefs(operatorId, updated);
  };

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
      await requestNotificationPermission();
      setPermissionStatus(getNotificationPermission());
    } catch {
      // ignore
    }
    setIsRequestingPermission(false);
  };

  if (!prefs) return null;

  return (
    <div
      style={{
        border: '1px solid rgba(0,255,65,0.1)',
        borderRadius: '4px',
        background: 'linear-gradient(135deg, rgba(17,17,17,0.8) 0%, rgba(26,26,46,0.6) 100%)',
        padding: '16px',
        marginTop: '20px',
        maxWidth: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '13px',
          letterSpacing: '2px',
          color: '#00ff41',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>📢</span> PUSH NOTIFICATIONS
      </div>

      {/* Permission Status */}
      <div
        style={{
          padding: '12px',
          marginBottom: '16px',
          background: 'rgba(0,0,0,0.3)',
          border: `1px solid ${
            permissionStatus === 'granted'
              ? 'rgba(0,255,65,0.3)'
              : 'rgba(255,180,0,0.3)'
          }`,
          borderRadius: '4px',
        }}
      >
        <div
          style={{
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '12px',
            color:
              permissionStatus === 'granted'
                ? '#00ff41'
                : permissionStatus === 'denied'
                  ? '#ff6b6b'
                  : '#ffb800',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {permissionStatus === 'granted' && '✓ NOTIFICATIONS ENABLED'}
          {permissionStatus === 'denied' && '✗ NOTIFICATIONS BLOCKED'}
          {permissionStatus === 'default' && '⚠ PERMISSION PENDING'}
          {permissionStatus === 'unsupported' && '⚠ NOT SUPPORTED'}
        </div>
        {(permissionStatus === 'default' || permissionStatus === 'denied') && (
          <button
            onClick={handleRequestPermission}
            disabled={isRequestingPermission}
            style={{
              marginTop: '8px',
              padding: '8px 12px',
              background: '#00ff41',
              color: '#000',
              border: 'none',
              borderRadius: '3px',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '12px',
              fontWeight: 700,
              cursor: isRequestingPermission ? 'not-allowed' : 'pointer',
              opacity: isRequestingPermission ? 0.5 : 1,
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            {isRequestingPermission ? 'REQUESTING...' : 'REQUEST PERMISSION'}
          </button>
        )}
      </div>

      {/* Toggles */}
      <div style={{ marginBottom: '16px' }}>
        <ToggleSwitch
          checked={prefs.workoutReminders}
          onChange={(val) => handleToggle('workoutReminders', val)}
          label="Workout Reminders"
        />
        <ToggleSwitch
          checked={prefs.streakWarnings}
          onChange={(val) => handleToggle('streakWarnings', val)}
          label="Streak Warnings"
        />
        <ToggleSwitch
          checked={prefs.prAlerts}
          onChange={(val) => handleToggle('prAlerts', val)}
          label="PR Alerts"
        />
        <ToggleSwitch
          checked={prefs.gunnyCheckIns}
          onChange={(val) => handleToggle('gunnyCheckIns', val)}
          label="Gunny Check-ins"
        />
      </div>

      {/* Reminder Time Picker */}
      <div
        style={{
          paddingTop: '12px',
          borderTop: '1px solid rgba(0,255,65,0.08)',
        }}
      >
        <label
          htmlFor="reminder-time"
          style={{
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '13px',
            color: '#e0e0e0',
            display: 'block',
            marginBottom: '8px',
          }}
        >
          REMINDER TIME
        </label>
        <input
          id="reminder-time"
          type="time"
          value={prefs.reminderTime}
          onChange={handleTimeChange}
          style={{
            width: '100%',
            padding: '8px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(0,255,65,0.2)',
            borderRadius: '3px',
            color: '#00ff41',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>

      {/* Note */}
      <div
        style={{
          marginTop: '12px',
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '11px',
          color: '#666',
          fontStyle: 'italic',
        }}
      >
        Changes saved automatically. {callsign}, keep those notifications tuned.
      </div>
    </div>
  );
};

export default NotificationSettings;
