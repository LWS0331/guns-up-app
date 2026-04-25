'use client';

import { useEffect, useState, useRef } from 'react';
import { getAuthToken } from '@/lib/authClient';

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
      setToast('Screenshot added');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (description.length < 10) {
      setToast('Description too short (min 10 chars)');
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
      setToast(data.alert === 'CRITICAL' ? 'CRITICAL ISSUE FLAGGED' : 'Feedback submitted');
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
      setToast('Failed to submit feedback');
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

      <div className="t-eyebrow">// Submit Feedback</div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="t-label" style={{ marginBottom: 4 }}>Type</div>
          <select
            className="ds-input"
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value as typeof feedbackType)}
          >
            <option value="BUG">BUG</option>
            <option value="RECOMMENDATION">RECOMMENDATION</option>
            <option value="UI/UX">UI/UX</option>
            <option value="PERFORMANCE">PERFORMANCE</option>
          </select>
        </div>
        <div style={{ flex: 0 }}>
          <div className="t-label" style={{ marginBottom: 4 }}>Severity</div>
          {badge(category, CATEGORY_TONE[category].color)}
        </div>
      </div>

      <div>
        <div className="t-label" style={{ marginBottom: 4 }}>
          Description ({description.length}/1000)
        </div>
        <textarea
          className="ds-input"
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Describe the issue or suggestion... (min 10 characters)"
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
          {screenshot ? 'Screenshot Added' : 'Upload Screenshot'}
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
            Remove
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
        {submitting ? 'Submitting...' : 'Submit Feedback'}
      </button>

      <div
        style={{
          borderTop: '1px solid var(--border-green-soft)',
          paddingTop: 18,
          marginTop: 4,
        }}
      >
        <div className="t-eyebrow" style={{ marginBottom: 12 }}>
          // Feedback History ({entries.length})
        </div>

        {loading ? (
          <div
            style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 22 }}
          >
            Loading...
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
            No feedback entries yet
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
                      entry.type,
                      TYPE_TONE[entry.type]?.color || 'var(--text-tertiary)'
                    )}
                    {badge(entry.category, CATEGORY_TONE[entry.category].color)}
                  </div>
                  {badge(
                    entry.status,
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
