'use client';

import { useEffect, useState, useRef } from 'react';
import { getAuthToken } from '@/lib/authClient';
import { useLanguage } from '@/lib/i18n';

interface FeedbackEntry {
  id: string;
  operatorId: string;
  callsign: string;
  type: 'BUG' | 'RECOMMENDATION' | 'UI/UX' | 'PERFORMANCE';
  category: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  screenshot?: string;
  timestamp: string;
  status: 'NEW' | 'REVIEWING' | 'FIXED' | 'WONTFIX';
}

interface BetaFeedbackProps {
  operatorId: string;
  callsign: string;
}

const CRITICAL_KEYWORDS = ['crash', 'data loss', 'broken', "can't login", "won't load"];
const HIGH_KEYWORDS = ['error', 'wrong', 'missing', 'stuck'];
const MEDIUM_KEYWORDS = ['slow', 'confusing', 'hard to find', 'unclear'];

const getCategoryFromDescription = (description: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' => {
  const lower = description.toLowerCase();
  if (CRITICAL_KEYWORDS.some(k => lower.includes(k))) return 'CRITICAL';
  if (HIGH_KEYWORDS.some(k => lower.includes(k))) return 'HIGH';
  if (MEDIUM_KEYWORDS.some(k => lower.includes(k))) return 'MEDIUM';
  return 'LOW';
};

// Tone routing — every chip drives off design tokens (var(--green) /
// var(--amber) / var(--danger) / var(--text-tertiary)) so the color
// never falls outside the palette.
const CATEGORY_TONE: Record<string, { color: string; tone: string }> = {
  CRITICAL: { color: 'var(--danger)', tone: 'danger' },
  HIGH: { color: 'var(--amber)', tone: 'amber' },
  MEDIUM: { color: 'var(--amber)', tone: 'amber' },
  LOW: { color: 'var(--text-tertiary)', tone: 'neutral' },
};

const STATUS_TONE: Record<string, { color: string; tone: string }> = {
  NEW: { color: 'var(--green)', tone: 'green' },
  REVIEWING: { color: 'var(--green)', tone: 'green' },
  FIXED: { color: 'var(--amber)', tone: 'amber' },
  WONTFIX: { color: 'var(--text-tertiary)', tone: 'neutral' },
};

const TYPE_TONE: Record<string, { color: string; tone: string }> = {
  BUG: { color: 'var(--danger)', tone: 'danger' },
  RECOMMENDATION: { color: 'var(--green)', tone: 'green' },
  'UI/UX': { color: 'var(--amber)', tone: 'amber' },
  PERFORMANCE: { color: 'var(--amber)', tone: 'amber' },
};

export default function BetaFeedback({ operatorId, callsign }: BetaFeedbackProps) {
  const { t } = useLanguage();
  const [feedbackType, setFeedbackType] = useState<'BUG' | 'RECOMMENDATION' | 'UI/UX' | 'PERFORMANCE'>('BUG');
  const [category, setCategory] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('LOW');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | undefined>();
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/beta-feedback?operatorId=${operatorId}`, {
          headers: { 'Authorization': `Bearer ${getAuthToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setEntries(data.feedback || []);
        }
      } catch (err) {
        console.error('[BetaFeedback:fetchFeedback] Failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeedback();
  }, [operatorId]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setCategory(getCategoryFromDescription(value));
  };

  const handleScreenshotChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setScreenshot(e.target?.result as string);
      setToast(t('feedback.toast_screenshot'));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (description.length < 10) {
      setToast(t('feedback.toast_too_short'));
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch('/api/beta-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ operatorId, callsign, type: feedbackType, category, description, screenshot }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setToast(data.alert === 'CRITICAL' ? t('feedback.toast_critical') : t('feedback.toast_submitted'));
      setDescription('');
      setScreenshot(undefined);
      setFeedbackType('BUG');
      setCategory('LOW');
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Refresh
      const refreshRes = await fetch(`/api/beta-feedback?operatorId=${operatorId}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` },
      });
      if (refreshRes.ok) {
        const newData = await refreshRes.json();
        setEntries(newData.feedback || []);
      }
    } catch (err) {
      setToast(t('feedback.toast_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Token-driven badge — borrows the .chip palette without forcing
  // a class because tone keys map 1:1 to design-system colors.
  const badge = (text: string, color: string) => (
    <span
      className="t-mono-sm"
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 27%, transparent)`,
      }}
    >
      {text}
    </span>
  );

  const canSubmit = description.length >= 10 && !submitting;

  // Type/severity/status display labels — translate the visible text but
  // keep the stored value English (DB-stored). When the value can't be
  // translated, fall back to the stored uppercase string.
  const typeLabel = (val: string): string => {
    const key = val === 'UI/UX' ? 'feedback.type.uiux' : `feedback.type.${val.toLowerCase()}`;
    const translated = t(key);
    return translated === key ? val : translated;
  };
  const severityLabel = (val: string): string => {
    const translated = t(`feedback.severity.${val.toLowerCase()}`);
    return translated.startsWith('feedback.') ? val : translated;
  };
  const statusLabel = (val: string): string => {
    const translated = t(`feedback.status.${val.toLowerCase()}`);
    return translated.startsWith('feedback.') ? val : translated;
  };

  return (
    <div className="ds-card bracket" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {toast && (
        <div
          className="t-mono"
          style={{
            position: 'fixed',
            top: 22,
            right: 22,
            zIndex: 9999,
            padding: '12px 18px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-green-strong)',
            color: 'var(--green)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          {toast}
        </div>
      )}

      <div className="t-eyebrow">{t('feedback.submit_eyebrow')}</div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="t-label" style={{ marginBottom: 4 }}>{t('feedback.type_label')}</div>
          <select
            className="ds-input"
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value as typeof feedbackType)}
          >
            <option value="BUG">{typeLabel('BUG')}</option>
            <option value="RECOMMENDATION">{typeLabel('RECOMMENDATION')}</option>
            <option value="UI/UX">{typeLabel('UI/UX')}</option>
            <option value="PERFORMANCE">{typeLabel('PERFORMANCE')}</option>
          </select>
        </div>
        <div style={{ flex: 0 }}>
          <div className="t-label" style={{ marginBottom: 4 }}>{t('feedback.severity_label')}</div>
          {badge(severityLabel(category), CATEGORY_TONE[category].color)}
        </div>
      </div>

      <div>
        <div className="t-label" style={{ marginBottom: 4 }}>
          {t('feedback.description_label')} ({description.length}/1000)
        </div>
        <textarea
          className="ds-input"
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder={t('feedback.description_placeholder')}
          maxLength={1000}
          style={{ minHeight: 100, resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleScreenshotChange}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => fileInputRef.current?.click()}
        >
          {screenshot ? t('feedback.screenshot_added') : t('feedback.upload_screenshot')}
        </button>
        {screenshot && (
          <button
            type="button"
            className="btn btn-sm btn-danger-outline"
            onClick={() => {
              setScreenshot(undefined);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          >
            {t('feedback.remove')}
          </button>
        )}
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{ width: '100%' }}
      >
        {submitting ? t('feedback.submitting') : t('feedback.submit_btn')}
      </button>

      <div
        style={{
          borderTop: '1px solid var(--border-green-soft)',
          paddingTop: 18,
          marginTop: 4,
        }}
      >
        <div className="t-eyebrow" style={{ marginBottom: 12 }}>
          {t('feedback.history_eyebrow')} ({entries.length})
        </div>

        {loading ? (
          <div
            style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 22 }}
          >
            {t('feedback.history_loading')}
          </div>
        ) : entries.length === 0 ? (
          <div
            style={{
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              padding: 22,
              fontSize: 12,
            }}
          >
            {t('feedback.history_empty')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="ds-card"
                style={{ padding: 12 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                    flexWrap: 'wrap',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', gap: 6 }}>
                    {badge(
                      typeLabel(entry.type),
                      TYPE_TONE[entry.type]?.color || 'var(--text-tertiary)'
                    )}
                    {badge(severityLabel(entry.category), CATEGORY_TONE[entry.category].color)}
                  </div>
                  {badge(
                    statusLabel(entry.status),
                    STATUS_TONE[entry.status]?.color || 'var(--text-tertiary)'
                  )}
                </div>
                <div
                  style={{
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  {entry.description}
                </div>
                <div
                  className="t-mono-sm"
                  style={{
                    display: 'flex',
                    gap: 12,
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <span>{entry.callsign}</span>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
