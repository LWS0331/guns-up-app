'use client';
// ═══════════════════════════════════════════════════════════════════════════
// WorkoutPTT — Floating Push-To-Talk button for Workout Mode
// ───────────────────────────────────────────────────────────────────────────
// Replaces the dead "USE THE RADIO TAB" banner. Captures speech via Web
// Speech API, routes local commands (start_timer / next_exercise / log_set /
// complete_workout) to Planner.handleVoiceCommand, and ships everything else
// to AppShell's sendGunnyVoiceMessage — which already has full workout
// execution context via the onWorkoutModeChange broadcast.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { parseVoiceCommand, VoiceCommand } from '@/components/VoiceInput';

// Minimal Web Speech API typings — scoped to this file.
// We don't re-declare Window.SpeechRecognition here because VoiceInput.tsx
// already does it globally. Instead we cast via unknown when reading window.
interface SRResult { transcript: string; confidence: number }
interface SRResultEntry { isFinal: boolean; 0: SRResult; length: number }
interface SREvent { resultIndex: number; results: { [index: number]: SRResultEntry; length: number } }
interface SRInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
interface SRCtor { new (): SRInstance }

// ─── Mini radio audio engine (inline, self-contained) ────────────────────
class PTTAudio {
  private ctx: AudioContext | null = null;
  init() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    } catch (err) {
      console.error('[WorkoutPTT:PTTAudio] init failed:', err);
    }
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
  private tone(freq: number, duration: number, peakGain: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(peakGain, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
  keyTone() { this.tone(1200, 0.12, 0.25); }
  releaseTone() { this.tone(800, 0.1, 0.2); }
}

// ─── Component ───────────────────────────────────────────────────────────
export interface WorkoutPTTProps {
  /** Route free-form speech ("ask_gunny" / "text") to AppShell's sendGunnyVoiceMessage */
  onSend?: (text: string) => void;
  /** Route parsed local commands (timer, next exercise, log set, complete) to Planner */
  onLocalCommand?: (command: VoiceCommand) => void;
  /** Hide the button (e.g., while rest timer dialog is visible) */
  disabled?: boolean;
}

const PULSE_KEYFRAMES = `
@keyframes workoutPttPulse {
  0%   { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.55); }
  70%  { box-shadow: 0 0 0 14px rgba(255, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
}
`;

let keyframesInjected = false;
function ensureKeyframes() {
  if (keyframesInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.setAttribute('data-workout-ptt', 'true');
  style.textContent = PULSE_KEYFRAMES;
  document.head.appendChild(style);
  keyframesInjected = true;
}

const WorkoutPTT: React.FC<WorkoutPTTProps> = ({ onSend, onLocalCommand, disabled }) => {
  const [supported, setSupported] = useState<boolean>(true);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SRInstance | null>(null);
  const audioRef = useRef<PTTAudio | null>(null);
  const transcriptRef = useRef('');
  const submittedRef = useRef(false);

  useEffect(() => {
    ensureKeyframes();
    audioRef.current = new PTTAudio();
    if (typeof window !== 'undefined') {
      const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      setSupported(!!SR);
    }
    return () => {
      try { recognitionRef.current?.abort(); } catch { /* noop */ }
    };
  }, []);

  const submit = useCallback((text: string) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const cmd = parseVoiceCommand(trimmed);
      const isLocal = cmd.type === 'start_timer'
        || cmd.type === 'next_exercise'
        || cmd.type === 'log_set'
        || cmd.type === 'complete_workout';
      if (isLocal && onLocalCommand) {
        onLocalCommand(cmd);
      } else if (onSend) {
        // ask_gunny / swap_exercise / text → AppShell's Gunny pipeline.
        // Workout execution context is injected server-side via screenContext.
        onSend(trimmed);
      } else if (onLocalCommand) {
        onLocalCommand(cmd);
      }
    } catch (err) {
      console.error('[WorkoutPTT:submit] routing failed:', err);
    }
  }, [onSend, onLocalCommand]);

  const startRecording = useCallback(() => {
    if (disabled || !supported || recording) return;
    audioRef.current?.init();
    audioRef.current?.resume();
    audioRef.current?.keyTone();

    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    submittedRef.current = false;
    transcriptRef.current = '';
    setTranscript('');

    let instance: SRInstance;
    try { instance = new SR(); } catch (err) {
      console.error('[WorkoutPTT] SR construction failed:', err);
      return;
    }
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = 'en-US';
    instance.onresult = (e) => {
      let finalText = transcriptRef.current;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const entry = e.results[i];
        const txt = entry[0].transcript;
        if (entry.isFinal) finalText += txt + ' ';
        else interim += txt;
      }
      transcriptRef.current = finalText;
      setTranscript((finalText + interim).trim());
    };
    instance.onerror = (e) => {
      console.warn('[WorkoutPTT] SR error:', e.error || e);
    };
    instance.onend = () => {
      setRecording(false);
      submit(transcriptRef.current);
    };
    recognitionRef.current = instance;
    try {
      instance.start();
      setRecording(true);
    } catch (err) {
      console.error('[WorkoutPTT] SR start failed:', err);
    }
  }, [disabled, supported, recording, submit]);

  const stopRecording = useCallback(() => {
    if (!recording) return;
    audioRef.current?.releaseTone();
    try {
      recognitionRef.current?.stop();
    } catch (err) {
      console.warn('[WorkoutPTT] SR stop failed:', err);
      setRecording(false);
      submit(transcriptRef.current);
    }
  }, [recording, submit]);

  // Spacebar PTT on desktop — hold space to transmit
  useEffect(() => {
    if (!supported) return;
    const isEditable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isEditable(e.target)) return;
      e.preventDefault();
      startRecording();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isEditable(e.target)) return;
      e.preventDefault();
      stopRecording();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [supported, startRecording, stopRecording]);

  if (!supported) return null;
  const btnSize = 64;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
        right: 16,
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: disabled ? 'none' : 'auto',
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 160ms ease',
      }}
    >
      {recording && transcript && (
        <div
          style={{
            position: 'absolute',
            bottom: btnSize + 28,
            right: 0,
            maxWidth: 260,
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.92)',
            border: '1px solid rgba(255,140,0,0.5)',
            borderRadius: 8,
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 12,
            color: '#FF8C00',
            lineHeight: 1.35,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          {transcript}
        </div>
      )}

      <button
        type="button"
        aria-label={recording ? 'Recording — release to send' : 'Hold to talk to Gunny'}
        onMouseDown={(e) => { e.preventDefault(); startRecording(); }}
        onMouseUp={(e) => { e.preventDefault(); stopRecording(); }}
        onMouseLeave={() => { if (recording) stopRecording(); }}
        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
        onTouchCancel={() => { if (recording) stopRecording(); }}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: btnSize,
          height: btnSize,
          borderRadius: '50%',
          background: recording
            ? 'radial-gradient(circle, #ff4444 0%, #aa0000 100%)'
            : 'radial-gradient(circle, #FF8C00 0%, #aa5500 100%)',
          border: recording ? '3px solid #ff4444' : '2px solid #FF8C00',
          boxShadow: recording
            ? '0 0 22px rgba(255,68,68,0.55)'
            : '0 0 12px rgba(255,140,0,0.35)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: recording ? 'workoutPttPulse 1.1s infinite' : 'none',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          userSelect: 'none',
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
      <div
        style={{
          marginTop: 4,
          textAlign: 'center',
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 7,
          fontWeight: 700,
          letterSpacing: 1.5,
          color: recording ? '#ff6666' : '#6B7B6B',
          textShadow: recording ? '0 0 6px rgba(255,68,68,0.5)' : 'none',
          userSelect: 'none',
        }}
      >
        {recording ? 'TRANSMITTING' : 'HOLD TO TALK'}
      </div>
    </div>
  );
};

export default WorkoutPTT;
