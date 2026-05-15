'use client';

// FormAnalysis — IntelCenter FORM_CHECK tab. Operator records or
// uploads a short clip, the browser extracts ~6 evenly-spaced frames
// from it (HTMLVideoElement → canvas → JPEG base64), and we POST the
// frames to /api/gunny/analyze-form for a structured form review.
//
// Why client-side frame extraction:
//   - No server-side ffmpeg dependency.
//   - Payload stays small (~6 JPEGs vs raw 30s MP4 = 5-30 MB).
//   - Works on every Next.js runtime (edge/serverless/standalone).
//
// WARFIGHTER tier-gated (matches feature #47 in the Feature Report).

import React, { useCallback, useRef, useState } from 'react';
import { Operator } from '@/lib/types';
import { getAuthToken } from '@/lib/authClient';
import { hasWarfighterAccess } from '@/lib/tierGates';
import UpgradeCard from '@/components/UpgradeCard';

interface BreakdownEntry {
  phase: string;
  observation: string;
  severity: 'green' | 'yellow' | 'red';
}

interface AnalysisResult {
  refusal?: boolean;
  message?: string;
  exercise?: string;
  view?: string | null;
  framesAnalyzed?: number;
  repsVisible: number;
  formScore: number;
  severity: 'green' | 'yellow' | 'red';
  breakdown: BreakdownEntry[];
  primaryFix: string;
  secondaryFixes: string[];
  cuesToTry: string[];
  safetyFlags: string[];
  encouragement: string;
}

interface FormAnalysisProps {
  operator: Operator;
  currentUser?: Operator;
  onOpenBilling?: () => void;
}

const SEVERITY_COLOR: Record<'green' | 'yellow' | 'red', string> = {
  green: '#00ff41',
  yellow: '#facc15',
  red: '#ff4d4d',
};

const SEVERITY_LABEL: Record<'green' | 'yellow' | 'red', string> = {
  green: 'CLEAN',
  yellow: 'CORRECT',
  red: 'STOP',
};

const EXERCISE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'back squat', label: 'Back Squat' },
  { value: 'front squat', label: 'Front Squat' },
  { value: 'bench press', label: 'Bench Press' },
  { value: 'deadlift', label: 'Deadlift' },
  { value: 'sumo deadlift', label: 'Sumo Deadlift' },
  { value: 'overhead press', label: 'Overhead Press' },
  { value: 'barbell row', label: 'Barbell Row' },
  { value: 'pull-up', label: 'Pull-up / Chin-up' },
  { value: 'clean', label: 'Clean' },
  { value: 'snatch', label: 'Snatch' },
  { value: 'jerk', label: 'Jerk' },
  { value: 'kettlebell swing', label: 'KB Swing' },
  { value: 'box jump', label: 'Box Jump' },
  { value: 'sprint', label: 'Sprint Mechanics' },
  { value: 'other', label: 'Other (specify in notes)' },
];

const VIEW_OPTIONS: Array<{ value: 'side' | 'front' | 'three_quarter' | 'rear'; label: string }> = [
  { value: 'side', label: 'Side' },
  { value: 'front', label: 'Front' },
  { value: 'three_quarter', label: '3/4' },
  { value: 'rear', label: 'Rear' },
];

const TARGET_FRAMES = 6;
const MAX_VIDEO_BYTES = 75 * 1024 * 1024;  // 75MB upper bound — phone clips
const MAX_DURATION_S = 60;                  // anything longer is excessive
const FRAME_MAX_WIDTH = 720;                // downscale to keep payload small
const JPEG_QUALITY = 0.72;

/**
 * Pull `count` evenly-spaced JPEG frames out of a video file using
 * <video> + <canvas>. Resolves to an array of { data, timestamp }.
 */
async function extractFrames(file: File, count: number): Promise<Array<{ data: string; timestamp: number }>> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    // Some browsers need crossOrigin set for canvas reads even on blob URLs.
    video.crossOrigin = 'anonymous';

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Could not load video. Format may be unsupported (try MP4/MOV/WebM).'));
    };

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!isFinite(duration) || duration <= 0) {
        cleanup();
        reject(new Error('Video has invalid duration. Try a different clip.'));
        return;
      }
      if (duration > MAX_DURATION_S) {
        cleanup();
        reject(new Error(`Clip is ${duration.toFixed(0)}s — keep it under ${MAX_DURATION_S}s for best results.`));
        return;
      }

      // Compute target frame timestamps. Skip the very first/last
      // frame — they're often black or motion-blurred during the cue.
      const margin = Math.min(0.2, duration * 0.05);
      const span = duration - margin * 2;
      const timestamps: number[] = [];
      for (let i = 0; i < count; i++) {
        const t = margin + (span * i) / Math.max(1, count - 1);
        timestamps.push(t);
      }

      // Compute canvas size (downscale to FRAME_MAX_WIDTH, preserve aspect).
      const vw = video.videoWidth || 720;
      const vh = video.videoHeight || 1280;
      const scale = vw > FRAME_MAX_WIDTH ? FRAME_MAX_WIDTH / vw : 1;
      const cw = Math.round(vw * scale);
      const ch = Math.round(vh * scale);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cleanup();
        reject(new Error('Canvas not available — your browser cannot extract video frames.'));
        return;
      }

      const frames: Array<{ data: string; timestamp: number }> = [];

      const seekTo = (t: number) => new Promise<void>((res, rej) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onErr);
          res();
        };
        const onErr = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onErr);
          rej(new Error(`Seek failed at t=${t}`));
        };
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onErr, { once: true });
        // Clamp to [0, duration - epsilon] — seeking exactly to
        // duration sometimes hangs in Safari.
        video.currentTime = Math.min(Math.max(0, t), duration - 0.01);
      });

      try {
        for (const t of timestamps) {
          await seekTo(t);
          // Give the renderer a tick to actually paint — Safari
          // occasionally fires `seeked` before the frame is decoded.
          await new Promise(r => setTimeout(r, 30));
          ctx.drawImage(video, 0, 0, cw, ch);
          const data = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          if (data && data.length > 200) {
            frames.push({ data, timestamp: t });
          }
        }
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error('Frame extraction failed.'));
        return;
      }

      cleanup();
      if (frames.length < 2) {
        reject(new Error('Only got ' + frames.length + ' frame(s). Re-shoot with steadier framing.'));
        return;
      }
      resolve(frames);
    };
  });
}

export default function FormAnalysis({ operator, currentUser, onOpenBilling }: FormAnalysisProps) {
  const viewer = currentUser ?? operator;
  const canAccess = hasWarfighterAccess(viewer);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [exercise, setExercise] = useState<string>('back squat');
  const [view, setView] = useState<'side' | 'front' | 'three_quarter' | 'rear'>('side');
  const [notes, setNotes] = useState<string>('');
  const [extractedFrames, setExtractedFrames] = useState<Array<{ data: string; timestamp: number }> | null>(null);
  const [stage, setStage] = useState<'idle' | 'extracting' | 'analyzing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  if (!canAccess) {
    return (
      <UpgradeCard
        feature="AI Form Analysis (Video)"
        requiredTier="white_glove"
        description="Upload a short clip of your lift — Gunny extracts keyframes, scores your form 0-100, calls out the single most important fix, and flags safety risks (knee cave, lumbar flexion, bar drift). Side-view squats, benches, deadlifts, OHP, oly lifts."
        onUpgrade={onOpenBilling}
      />
    );
  }

  const onPick = (f: File | null) => {
    setError(null);
    setResult(null);
    setExtractedFrames(null);
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!f.type.startsWith('video/')) {
      setError('Please select a video file.');
      return;
    }
    if (f.size > MAX_VIDEO_BYTES) {
      setError(`Clip is ${(f.size / 1024 / 1024).toFixed(0)} MB — keep it under ${(MAX_VIDEO_BYTES / 1024 / 1024).toFixed(0)} MB.`);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setExtractedFrames(null);
    setResult(null);
    setError(null);
    setStage('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyze = useCallback(async () => {
    if (!file) {
      setError('Pick a video first.');
      return;
    }
    setError(null);
    setResult(null);
    setStage('extracting');
    let frames: Array<{ data: string; timestamp: number }>;
    try {
      frames = await extractFrames(file, TARGET_FRAMES);
      setExtractedFrames(frames);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Frame extraction failed.');
      setStage('idle');
      return;
    }

    setStage('analyzing');
    try {
      const token = getAuthToken();
      const res = await fetch('/api/gunny/analyze-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          operatorId: operator.id,
          exercise,
          view,
          notes,
          frames,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error || `Request failed (${res.status})`);
        setStage('idle');
        return;
      }
      const json = await res.json();
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setStage('idle');
    }
  }, [file, operator.id, exercise, view, notes]);

  const busy = stage !== 'idle';

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#00ff41', letterSpacing: 2 }}>
          // FORM ANALYSIS · VIDEO
        </div>
        {(file || result) && (
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            style={{
              padding: '4px 10px',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 9,
              letterSpacing: 1.5,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: '#888',
              cursor: busy ? 'wait' : 'pointer',
              textTransform: 'uppercase',
              borderRadius: 3,
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Upload + setup panel */}
      <div style={{ padding: 14, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,65,0.2)', borderRadius: 4, marginBottom: 12 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          onChange={e => onPick(e.target.files?.[0] || null)}
          disabled={busy}
          style={{
            width: '100%',
            color: '#aaa',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 12,
            marginBottom: 12,
          }}
        />

        {previewUrl && (
          <video
            src={previewUrl}
            controls
            playsInline
            style={{
              width: '100%',
              maxHeight: 320,
              background: '#000',
              borderRadius: 3,
              border: '1px solid rgba(0,255,65,0.2)',
              marginBottom: 12,
            }}
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
          <label style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#888' }}>
            Exercise
            <select
              value={exercise}
              onChange={e => setExercise(e.target.value)}
              disabled={busy}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(0,255,65,0.3)',
                color: '#e0e0e0',
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 12,
                borderRadius: 3,
              }}
            >
              {EXERCISE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          <label style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#888' }}>
            Camera view
            <select
              value={view}
              onChange={e => setView(e.target.value as typeof view)}
              disabled={busy}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(0,255,65,0.3)',
                color: '#e0e0e0',
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 12,
                borderRadius: 3,
              }}
            >
              {VIEW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          disabled={busy}
          placeholder="Optional notes — load, RPE, what you're working on, anything that hurts..."
          rows={2}
          style={{
            width: '100%',
            padding: 8,
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(0,255,65,0.3)',
            color: '#e0e0e0',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 12,
            borderRadius: 3,
            resize: 'vertical',
            marginBottom: 10,
          }}
        />

        <button
          type="button"
          onClick={analyze}
          disabled={busy || !file}
          style={{
            width: '100%',
            padding: '10px 14px',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 11,
            letterSpacing: 1.5,
            border: '1px solid #00ff41',
            background: busy || !file ? 'rgba(0,255,65,0.05)' : 'rgba(0,255,65,0.15)',
            color: '#00ff41',
            cursor: busy ? 'wait' : !file ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase',
            borderRadius: 3,
            opacity: busy || !file ? 0.6 : 1,
          }}
        >
          {stage === 'extracting' ? 'Extracting frames…'
           : stage === 'analyzing' ? 'Gunny analyzing…'
           : 'Run Form Analysis'}
        </button>

        <div style={{ marginTop: 8, fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#555', lineHeight: 1.5 }}>
          Tip: side view, full body in frame, 5-30s clip, 2-5 reps. Steady camera. Good lighting beats fancy framing.
        </div>
      </div>

      {error && (
        <div style={{ padding: 10, background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)', color: '#ff8888', fontFamily: 'Share Tech Mono, monospace', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Extracted frame thumbnails — show during extraction so the
          operator sees something is happening even before the model
          replies. */}
      {extractedFrames && extractedFrames.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#888', letterSpacing: 2, marginBottom: 6 }}>
            // {extractedFrames.length} KEYFRAMES
          </div>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
            {extractedFrames.map((f, i) => (
              <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={f.data}
                  alt={`Frame ${i + 1}`}
                  style={{
                    width: 88,
                    height: 88,
                    objectFit: 'cover',
                    borderRadius: 3,
                    border: '1px solid rgba(0,255,65,0.3)',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  fontFamily: 'Share Tech Mono, monospace',
                  fontSize: 8,
                  color: '#00ff41',
                  background: 'rgba(0,0,0,0.7)',
                  padding: '1px 4px',
                  borderRadius: 2,
                }}>
                  {f.timestamp.toFixed(1)}s
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result?.refusal && (
        <div style={{ padding: 12, background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.4)', color: '#ffb800', fontFamily: 'Share Tech Mono, monospace', fontSize: 12, lineHeight: 1.5 }}>
          {result.message}
        </div>
      )}

      {result && !result.refusal && (
        <>
          {/* Severity banner with score */}
          <div
            style={{
              padding: 16,
              background: `${SEVERITY_COLOR[result.severity]}11`,
              border: `1px solid ${SEVERITY_COLOR[result.severity]}`,
              borderLeft: `4px solid ${SEVERITY_COLOR[result.severity]}`,
              borderRadius: 4,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 22,
                letterSpacing: 3,
                color: SEVERITY_COLOR[result.severity],
                fontWeight: 800,
              }}>
                {SEVERITY_LABEL[result.severity]}
              </div>
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#aaa', marginTop: 4 }}>
                {result.repsVisible} {result.repsVisible === 1 ? 'rep' : 'reps'} visible · {result.framesAnalyzed || 0} frames
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 28, color: SEVERITY_COLOR[result.severity], fontWeight: 700 }}>
                {result.formScore}<span style={{ fontSize: 14, color: '#666' }}>/100</span>
              </div>
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#666', letterSpacing: 1.5 }}>FORM SCORE</div>
            </div>
          </div>

          {/* Primary fix — most prominent */}
          {result.primaryFix && (
            <div style={{
              padding: 14,
              background: 'rgba(0,0,0,0.4)',
              borderLeft: `4px solid ${SEVERITY_COLOR[result.severity]}`,
              borderRadius: 3,
              marginBottom: 12,
            }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#666', letterSpacing: 2, marginBottom: 6 }}>
                // PRIMARY FIX
              </div>
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 14, color: '#e0e0e0', lineHeight: 1.5 }}>
                {result.primaryFix}
              </div>
            </div>
          )}

          {/* Safety flags — render only if present, always red */}
          {result.safetyFlags.length > 0 && (
            <div style={{
              padding: 12,
              background: 'rgba(255,77,77,0.08)',
              border: '1px solid rgba(255,77,77,0.5)',
              borderRadius: 3,
              marginBottom: 12,
            }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#ff4d4d', letterSpacing: 2, marginBottom: 8 }}>
                ⚠ SAFETY FLAGS
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: '#ff8888', lineHeight: 1.6 }}>
                {result.safetyFlags.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {/* Phase breakdown */}
          {result.breakdown.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#888', letterSpacing: 2, marginBottom: 6 }}>
                // PHASE BREAKDOWN
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {result.breakdown.map((b, i) => (
                  <div key={i} style={{
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderLeft: `3px solid ${SEVERITY_COLOR[b.severity]}`,
                    borderRadius: 3,
                  }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: SEVERITY_COLOR[b.severity], letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
                      {b.phase}
                    </div>
                    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: '#bbb', lineHeight: 1.5 }}>
                      {b.observation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Secondary fixes */}
          {result.secondaryFixes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#888', letterSpacing: 2, marginBottom: 6 }}>
                // ALSO ADDRESS
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>
                {result.secondaryFixes.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {/* Cues */}
          {result.cuesToTry.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#22d3ee', letterSpacing: 2, marginBottom: 6 }}>
                // CUES TO TRY
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.cuesToTry.map((c, i) => (
                  <div key={i} style={{
                    padding: '6px 10px',
                    background: 'rgba(34,211,238,0.08)',
                    border: '1px solid rgba(34,211,238,0.3)',
                    borderRadius: 3,
                    fontFamily: 'Share Tech Mono, monospace',
                    fontSize: 11,
                    color: '#88dcef',
                  }}>
                    "{c}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Encouragement — only if present, in green */}
          {result.encouragement && (
            <div style={{
              padding: 10,
              background: 'rgba(0,255,65,0.05)',
              borderLeft: '2px solid rgba(0,255,65,0.4)',
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 11,
              color: '#88ee99',
              lineHeight: 1.5,
              fontStyle: 'italic',
            }}>
              {result.encouragement}
            </div>
          )}
        </>
      )}
    </div>
  );
}
