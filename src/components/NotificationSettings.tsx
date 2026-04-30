'use client';

import React, { useState, useEffect } from 'react';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  getNotificationPermission,
  requestNotificationPermission,
  NotificationPreferences,
} from '@/lib/notifications';
import { useLanguage } from '@/lib/i18n';

interface NotificationSettingsProps {
  operatorId: string;
  callsign: string;
}

// Custom toggle switch component
const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => {
  const toggleId = `toggle-${label.replace(/\s+/g, '-')}`;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid rgba(0,255,65,0.08)',
      }}
    >
      <div style={{ flex: 1 }}>
        <label
          htmlFor={toggleId}
          style={{
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '13px',
            color: '#e0e0e0',
            cursor: 'pointer',
            display: 'block',
          }}
        >
          {label}
        </label>
        {description && (
          <div style={{ fontSize: '10px', color: '#666', marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
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
          flexShrink: 0,
          marginLeft: 12,
        }}
      />
    </div>
  );
};

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  operatorId,
  callsign,
}) => {
  const { t } = useLanguage();
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

  const handleTimeChange = (field: 'reminderTime' | 'eveningCheckInTime', value: string) => {
    if (!prefs) return;
    const updated = { ...prefs, [field]: value };
    setPrefs(updated);
    saveNotificationPrefs(operatorId, updated);
  };

  const handleHydrationInterval = (value: number) => {
    if (!prefs) return;
    const updated = { ...prefs, hydrationInterval: value };
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

  const timeInputStyle: React.CSSProperties = {
    padding: '6px 8px',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(0,255,65,0.2)',
    borderRadius: '3px',
    color: '#00ff41',
    fontFamily: 'Share Tech Mono, monospace',
    fontSize: '12px',
    outline: 'none',
    width: '100%',
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '9px',
    letterSpacing: '1.5px',
    color: '#555',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 4,
    paddingTop: 8,
    borderTop: '1px solid rgba(0,255,65,0.05)',
  };

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
        {t('notif.heading')}
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
          {permissionStatus === 'granted' && t('notif.status_enabled')}
          {permissionStatus === 'denied' && t('notif.status_blocked')}
          {permissionStatus === 'default' && t('notif.status_pending')}
          {permissionStatus === 'unsupported' && t('notif.status_unsupported')}
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
            {isRequestingPermission ? t('notif.requesting') : t('notif.request_permission')}
          </button>
        )}
      </div>

      {/* Training Reminders */}
      <div style={sectionLabelStyle}>{t('notif.section_training')}</div>
      <ToggleSwitch
        checked={prefs.workoutReminders}
        onChange={(val) => handleToggle('workoutReminders', val)}
        label={t('notif.workout_reminders')}
        description={t('notif.workout_reminders_desc')}
      />
      <ToggleSwitch
        checked={prefs.streakWarnings}
        onChange={(val) => handleToggle('streakWarnings', val)}
        label={t('notif.streak_warnings')}
        description={t('notif.streak_warnings_desc')}
      />
      <ToggleSwitch
        checked={prefs.prAlerts}
        onChange={(val) => handleToggle('prAlerts', val)}
        label={t('notif.pr_alerts')}
        description={t('notif.pr_alerts_desc')}
      />

      {/* Nutrition Reminders */}
      <div style={sectionLabelStyle}>{t('notif.section_nutrition')}</div>
      <ToggleSwitch
        checked={prefs.mealReminders}
        onChange={(val) => handleToggle('mealReminders', val)}
        label={t('notif.meal_reminders')}
        description={t('notif.meal_reminders_desc')}
      />
      <ToggleSwitch
        checked={prefs.hydrationReminders}
        onChange={(val) => handleToggle('hydrationReminders', val)}
        label={t('notif.hydration_reminders')}
        description={t('notif.hydration_reminders_desc').replace('{hours}', String(prefs.hydrationInterval))}
      />

      {/* Compliance & Motivation */}
      <div style={sectionLabelStyle}>{t('notif.section_compliance')}</div>
      <ToggleSwitch
        checked={prefs.dailyBriefAlerts}
        onChange={(val) => handleToggle('dailyBriefAlerts', val)}
        label={t('notif.daily_brief_alerts')}
        description={t('notif.daily_brief_alerts_desc')}
      />
      <ToggleSwitch
        checked={prefs.complianceAlerts}
        onChange={(val) => handleToggle('complianceAlerts', val)}
        label={t('notif.compliance_alerts')}
        description={t('notif.compliance_alerts_desc')}
      />
      <ToggleSwitch
        checked={prefs.eveningCheckIn}
        onChange={(val) => handleToggle('eveningCheckIn', val)}
        label={t('notif.evening_check_in')}
        description={t('notif.evening_check_in_desc')}
      />
      <ToggleSwitch
        checked={prefs.gunnyCheckIns}
        onChange={(val) => handleToggle('gunnyCheckIns', val)}
        label={t('notif.gunny_check_ins')}
        description={t('notif.gunny_check_ins_desc')}
      />

      {/* Time Settings */}
      <div style={sectionLabelStyle}>{t('notif.section_schedule')}</div>
      <div style={{ padding: '8px 0' }}>
        <label style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '12px', color: '#e0e0e0', display: 'block', marginBottom: 4 }}>
          {t('notif.morning_reminder')}
        </label>
        <input
          type="time"
          value={prefs.reminderTime}
          onChange={(e) => handleTimeChange('reminderTime', e.target.value)}
          style={timeInputStyle}
        />
      </div>
      <div style={{ padding: '8px 0' }}>
        <label style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '12px', color: '#e0e0e0', display: 'block', marginBottom: 4 }}>
          {t('notif.evening_check_in_time')}
        </label>
        <input
          type="time"
          value={prefs.eveningCheckInTime}
          onChange={(e) => handleTimeChange('eveningCheckInTime', e.target.value)}
          style={timeInputStyle}
        />
      </div>
      <div style={{ padding: '8px 0' }}>
        <label style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '12px', color: '#e0e0e0', display: 'block', marginBottom: 4 }}>
          {t('notif.hydration_interval')}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4].map((h) => (
            <button
              key={h}
              onClick={() => handleHydrationInterval(h)}
              style={{
                flex: 1,
                padding: '6px',
                background: prefs.hydrationInterval === h ? '#00ff41' : 'rgba(0,0,0,0.3)',
                color: prefs.hydrationInterval === h ? '#000' : '#888',
                border: `1px solid ${prefs.hydrationInterval === h ? '#00ff41' : 'rgba(0,255,65,0.15)'}`,
                borderRadius: 3,
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {h}{t('notif.hours_suffix')}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div
        style={{
          marginTop: '12px',
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '10px',
          color: '#555',
          fontStyle: 'italic',
        }}
      >
        {t('notif.footer').replace('{callsign}', callsign)}
      </div>
    </div>
  );
};

export default NotificationSettings;
