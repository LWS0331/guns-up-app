'use client';

// NotesFormPopover — focused popover for the active exercise card.
// Surfaces three things that used to live in-line on the long-scroll
// Workout Mode but now sit behind a single icon tap so the active set
// fits cleanly above the fold:
//
//   1. NOTES — free-text input bound to results[blockId].notes (e.g.
//      "banded felt hard, left knee tracked in"). Same field as the
//      old inline input — just relocated.
//
//   2. FORM DEMO — opens the existing exercise-video modal (curated
//      URL or YouTube fallback). Same handler as the inline Demo
//      button on inactive cards.
//
//   3. UPLOAD FORM CHECK — sends a still photo of the user's form
//      (mid-rep) to Gunny's vision endpoint (/api/gunny accepts
//      base64 images today, see route.ts:1090-1104). Gunny replies
//      with a coaching note — bar path, depth, knee tracking, etc.
//      Currently still-image only; video keyframe extraction is
//      queued as a parallel task (see spawn_task: video form
//      analysis).
//
// The popover is portal-mounted via fixed positioning so it sits
// above the VitalsSticky HUD + tab bar without needing a parent z-
// stack adjustment. Tap the dim background or the × to close.

import React, { useRef, useState } from 'react';
import Icon from '@/components/Icons';

export interface NotesFormPopoverProps {
  open: boolean;
  onClose: () => void;
  exerciseName: string;
  /** Bound notes value for the active block. */
  notes: string;
  onNotesChange: (next: string) => void;
  /** Open the curated/YouTube demo video modal for this exercise. */
  onPlayDemo?: () => void;
  /** Send a base64 image to Gunny for form review. Image is data-URL form
   *  (`data:image/jpeg;base64,...`). The handler should append a chat
   *  message with the image attached and set Gunny's panel/chat as the
   *  reply target so the operator sees the response. */
  onUploadForm?: (imageDataUrl: string, prompt: string) => Promise<void> | void;
}

export default function NotesFormPopover({
  open,
  onClose,
  exerciseName,
  notes,
  onNotesChange,
  onPlayDemo,
  onUploadForm,
}: NotesFormPopoverProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  if (!open) return null;

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!onUploadForm) return;

    // 6MB ceiling — Claude vision works fine on smaller stills and we
    // don't want runaway upload costs / latency on the workout
    // critical path. Larger files get rejected with a clear toast.
    if (file.size > 6 * 1024 * 1024) {
      setUploadStatus('FILE TOO LARGE — UNDER 6MB PLEASE');
      setTimeout(() => setUploadStatus(null), 3000);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    try {
      setUploading(true);
      setUploadStatus('READING FILE…');
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(file);
      });

      setUploadStatus('SENDING TO GUNNY…');
      const prompt = `Form check on ${exerciseName}. Look at bar path, depth, joint tracking, and posture. Call out anything you'd correct.`;
      await onUploadForm(dataUrl, prompt);
      setUploadStatus('SENT — CHECK GUNNY FOR REPLY');
      setTimeout(() => {
        setUploadStatus(null);
        onClose();
      }, 1800);
    } catch (err) {
      console.error('[NotesFormPopover:handleFile] upload failed:', err);
      setUploadStatus('UPLOAD FAILED — TRY AGAIN');
      setTimeout(() => setUploadStatus(null), 3000);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      {/* Backdrop — dims the workout-mode body and closes on tap. */}
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 1000,
        }}
      />

      {/* Popover panel — bottom-sheet style on phone, centered on
          tablet+. Width caps so it stays scannable on iPad. */}
      <div
        role="dialog"
        aria-label={`Notes and form check for ${exerciseName}`}
        className="ds-card bracket"
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: 480,
          zIndex: 1001,
          padding: 16,
          background: 'var(--bg-card)',
        }}
      >
        <span className="bl" />
        <span className="br" />

        <div className="row-between" style={{ marginBottom: 10, alignItems: 'center' }}>
          <span className="t-eyebrow">// Notes &amp; Form Check</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close popover"
            className="btn btn-sm btn-ghost"
            style={{ padding: '4px 8px' }}
          >
            <Icon.X size={11} />
          </button>
        </div>

        <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: 1 }}>
          {exerciseName}
        </div>

        {/* Notes input — same string as the legacy inline notes
            field, just relocated behind the icon. Submits on every
            keystroke via onNotesChange so the parent state stays
            authoritative. */}
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="np-notes" className="t-label">Notes</label>
          <textarea
            id="np-notes"
            className="ds-input"
            placeholder="e.g. banded felt hard, left knee tracked in, dropped to 215 from 225"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            style={{ resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 13 }}
          />
        </div>

        {/* Action row — Form Demo (video) + Upload Form Check (photo) */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: uploadStatus ? 8 : 0 }}>
          {onPlayDemo && (
            <button
              type="button"
              onClick={() => { onPlayDemo(); onClose(); }}
              className="btn btn-amber btn-sm"
              style={{ flex: '1 1 140px' }}
            >
              <Icon.Play size={11} /> Form Demo
            </button>
          )}
          {onUploadForm && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFile}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="btn btn-primary btn-sm"
                style={{ flex: '1 1 160px' }}
                aria-label="Upload form-check photo to Gunny"
              >
                <Icon.Camera size={11} /> {uploading ? 'Uploading…' : 'Upload Form Check'}
              </button>
            </>
          )}
        </div>

        {uploadStatus && (
          <div
            className="t-mono-sm"
            style={{
              color: uploadStatus.includes('FAILED') || uploadStatus.includes('TOO LARGE')
                ? 'var(--danger)'
                : uploadStatus.includes('SENT')
                  ? 'var(--green)'
                  : 'var(--amber)',
              letterSpacing: 1,
              marginTop: 4,
              fontSize: 11,
            }}
          >
            {uploadStatus}
          </div>
        )}
      </div>
    </>
  );
}
