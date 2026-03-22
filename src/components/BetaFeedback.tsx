'use client';

import { useEffect, useState, useRef } from 'react';

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

const CATEGORY_COLORS: Record<string, string> = {
  CRITICAL: '#FF4444',
  HIGH: '#FF8800',
  MEDIUM: '#FFD700',
  LOW: '#888888',
};

const STATUS_COLORS: Record<string, string> = {
  NEW: '#00FF41',
  REVIEWING: '#00BCD4',
  FIXED: '#E040FB',
  WONTFIX: '#555555',
};

const TYPE_COLORS: Record<string, string> = {
  BUG: '#FF4444',
  RECOMMENDATION: '#00BCD4',
  'UI/UX': '#E040FB',
  PERFORMANCE: '#FFD700',
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
        const res = await fetch(`/api/beta-feedback?operatorId=${operatorId}`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.feedback || []);
        }
      } catch (err) {
        console.error('Error fetching feedback:', err);
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
        headers: { 'Content-Type': 'application/json' },
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
      const refreshRes = await fetch(`/api/beta-feedback?operatorId=${operatorId}`);
      if (refreshRes.ok) {
        const newData = await refreshRes.json();
        setEntries(newData.feedback || []);
      }
    } catch (err) {
      console.error('Submit error:', err);
      setToast('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const badge = (text: string, color: string) => (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10,
      fontWeight: 700, letterSpacing: 1, backgroundColor: color + '22', color, border: `1px solid ${color}44`,
    }}>{text}</span>
  );

  const selectStyle: React.CSSProperties = {
    background: '#1a1a1a', border: '1px solid #00ff4144', color: '#00ff41',
    padding: '6px 10px', fontSize: 13, borderRadius: 3, width: '100%', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, background: '#0a0a0a', borderRadius: 6, border: '1px solid #00ff4133' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 20px', background: '#1a1a1a', border: '1px solid #00ff41', color: '#00ff41', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 700, color: '#00ff41', letterSpacing: 1 }}>SUBMIT FEEDBACK</div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 10, color: '#00bcd4', marginBottom: 4, letterSpacing: 1 }}>TYPE</div>
          <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value as typeof feedbackType)} style={selectStyle}>
            <option value="BUG">BUG</option>
            <option value="RECOMMENDATION">RECOMMENDATION</option>
            <option value="UI/UX">UI/UX</option>
            <option value="PERFORMANCE">PERFORMANCE</option>
          </select>
        </div>
        <div style={{ flex: 0 }}>
          <div style={{ fontSize: 10, color: '#00bcd4', marginBottom: 4, letterSpacing: 1 }}>SEVERITY</div>
          {badge(category, CATEGORY_COLORS[category])}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, color: '#00bcd4', marginBottom: 4, letterSpacing: 1 }}>DESCRIPTION ({description.length}/1000)</div>
        <textarea
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Describe the issue or suggestion... (min 10 characters)"
          maxLength={1000}
          style={{ width: '100%', minHeight: 100, background: '#1a1a1a', border: '1px solid #00ff4144', color: '#fff', padding: 10, fontSize: 13, borderRadius: 3, resize: 'vertical', outline: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleScreenshotChange} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current?.click()} style={{ padding: '6px 12px', fontSize: 11, background: '#00ff4122', color: '#00ff41', border: '1px solid #00ff4144', borderRadius: 3, cursor: 'pointer' }}>
          {screenshot ? '✓ SCREENSHOT ADDED' : 'UPLOAD SCREENSHOT'}
        </button>
        {screenshot && (
          <button onClick={() => { setScreenshot(undefined); if (fileInputRef.current) fileInputRef.current.value = ''; }} style={{ padding: '6px 12px', fontSize: 11, background: 'transparent', color: '#FF4444', border: '1px solid #FF444444', borderRadius: 3, cursor: 'pointer' }}>
            REMOVE
          </button>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={description.length < 10 || submitting}
        style={{
          width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 700, letterSpacing: 1,
          background: description.length >= 10 ? '#00ff41' : '#333', color: description.length >= 10 ? '#0a0a0a' : '#666',
          border: 'none', borderRadius: 3, cursor: description.length >= 10 ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? 'SUBMITTING...' : 'SUBMIT FEEDBACK'}
      </button>

      <div style={{ borderTop: '1px solid #00ff4122', paddingTop: 16, marginTop: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#00ff41', letterSpacing: 1, marginBottom: 12 }}>FEEDBACK HISTORY ({entries.length})</div>

        {loading ? (
          <div style={{ color: '#00ff4155', textAlign: 'center', padding: 20 }}>Loading...</div>
        ) : entries.length === 0 ? (
          <div style={{ color: '#00ff4155', textAlign: 'center', padding: 20, fontSize: 12 }}>No feedback entries yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((entry) => (
              <div key={entry.id} style={{ padding: 12, background: '#1a1a1a', border: '1px solid #00ff4122', borderRadius: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {badge(entry.type, TYPE_COLORS[entry.type] || '#888')}
                    {badge(entry.category, CATEGORY_COLORS[entry.category])}
                  </div>
                  {badge(entry.status, STATUS_COLORS[entry.status] || '#888')}
                </div>
                <div style={{ color: '#fff', fontSize: 13, marginBottom: 6 }}>{entry.description}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#00ff4155' }}>
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
