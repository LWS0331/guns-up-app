'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useShakeToTalk } from '@/lib/useShakeToTalk';
import { onSpeechDone, offSpeechDone } from '@/lib/tts';

// Web Speech API TypeScript declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

// Voice command types for smart workout logging
export interface VoiceCommand {
  type: 'log_set' | 'swap_exercise' | 'next_exercise' | 'start_timer' | 'ask_gunny' | 'complete_workout' | 'text';
  weight?: number;
  reps?: number;
  duration?: number;
  rawText: string;
}

// Parse voice input for workout commands
export function parseVoiceCommand(text: string): VoiceCommand {
  const lower = text.toLowerCase().trim();

  const logPatterns = [
    /(?:log|done|finished|completed|hit|got|did)\s.*?(\d+)\s*(?:lbs?|pounds?)?\s*(?:for|by|times|x|at)\s*(\d+)\s*(?:reps?)?/i,
    /(\d+)\s*(?:lbs?|pounds?)?\s*(?:for|by|times|x)\s*(\d+)\s*(?:reps?)?/i,
    /(?:log|record|save)\s.*?set.*?(\d+)\s*(?:lbs?|pounds?)?\s*(?:for|by|times|x|at)\s*(\d+)/i,
    /(?:log|record|save)\s*(?:it|that|the set|my set|last set)?\s*(?:at\s*)?(\d+)\s*(?:lbs?|pounds?)?\s*(?:for|by|times|x)\s*(\d+)/i,
  ];

  for (const pattern of logPatterns) {
    const match = lower.match(pattern);
    if (match) {
      return { type: 'log_set', weight: parseInt(match[1]), reps: parseInt(match[2]), rawText: text };
    }
  }

  if (/(?:log|record|save)\s*(?:it|that|the set|my set|last set|this set)/i.test(lower)) {
    return { type: 'log_set', rawText: text };
  }

  if (/(?:next\s*(?:exercise|movement|one|set)|move\s*on|skip)/i.test(lower)) {
    return { type: 'next_exercise', rawText: text };
  }

  const timerMatch = lower.match(/(?:start\s*)?(?:timer|rest)\s*(?:for\s*)?(\d+)\s*(?:seconds?|secs?|s\b|minutes?|mins?|m\b)/i);
  if (timerMatch) {
    let secs = parseInt(timerMatch[1]);
    if (/min/i.test(timerMatch[0])) secs *= 60;
    return { type: 'start_timer', duration: secs, rawText: text };
  }

  if (/(?:swap|replace|switch|change)\s*(?:this|it|that)?\s*(?:for|with|to)/i.test(lower)) {
    return { type: 'ask_gunny', rawText: text };
  }

  if (/(?:finish|complete|done\s*with|end)\s*(?:the\s*)?workout/i.test(lower) || lower === "i'm done" || lower === 'im done') {
    return { type: 'complete_workout', rawText: text };
  }

  return { type: 'text', rawText: text };
}

// ═══ COMMS PROTOCOL ═══
function stripOverFromEnd(text: string): { cleaned: string; hasOver: boolean } {
  const trimmed = text.trim();
  const overPattern = /\s*(?:over\s*(?:and\s*out)?|copy\s*that)\s*$/i;
  if (overPattern.test(trimmed)) {
    return { cleaned: trimmed.replace(overPattern, '').trim(), hasOver: true };
  }
  return { cleaned: trimmed, hasOver: false };
}

function detectCallSign(text: string, callSign: string): boolean {
  if (!callSign) return false;
  const lower = text.toLowerCase();
  const cs = callSign.toLowerCase();
  return lower.includes(cs) || /\b(?:hey\s+)?gunny\b/i.test(lower);
}

function stripCallSign(text: string, callSign: string): string {
  let cleaned = text;
  if (callSign) {
    const csRegex = new RegExp(callSign.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    cleaned = cleaned.replace(csRegex, '');
  }
  cleaned = cleaned.replace(/\b(?:hey\s+)?gunny\s*/gi, '');
  // Strip common radio protocol filler phrases
  cleaned = cleaned.replace(/\b(?:come\s+in|do\s+you\s+copy|do\s+you\s+read|how\s+copy|radio\s+check|this\s+is|to)\b/gi, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  return cleaned.trim();
}

// Detect mobile (iOS/Android) — these need push-to-talk instead of continuous
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

type CommsState = 'standby' | 'hot' | 'buffering';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onVoiceCommand?: (command: VoiceCommand) => void;
  onSendMessage?: (text: string) => void;
  onWakeGunny?: () => void;
  callSign?: string;
  activeListening?: boolean;
  isListening?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export default function VoiceInput({
  onTranscript,
  onVoiceCommand,
  onSendMessage,
  onWakeGunny,
  callSign = '',
  activeListening = false,
  isListening: controlledListening,
  disabled = false,
  compact = false,
}: VoiceInputProps) {
  const [internalListening, setInternalListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const [commsState, setCommsState] = useState<CommsState>('standby');
  const [messageBuffer, setMessageBuffer] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef('');
  const activeListeningRef = useRef(activeListening);
  const callSignRef = useRef(callSign);
  const commsStateRef = useRef<CommsState>('standby');
  const messageBufferRef = useRef('');
  const onSendMessageRef = useRef(onSendMessage);
  const onWakeGunnyRef = useRef(onWakeGunny);
  const onVoiceCommandRef = useRef(onVoiceCommand);

  activeListeningRef.current = activeListening;
  callSignRef.current = callSign;
  onSendMessageRef.current = onSendMessage;
  onWakeGunnyRef.current = onWakeGunny;
  onVoiceCommandRef.current = onVoiceCommand;

  // Detect mobile on mount
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  const updateCommsState = useCallback((state: CommsState) => {
    commsStateRef.current = state;
    setCommsState(state);
  }, []);

  const updateBuffer = useCallback((text: string) => {
    messageBufferRef.current = text;
    setMessageBuffer(text);
  }, []);

  const isListening = controlledListening !== undefined ? controlledListening : internalListening;

  const showFeedback = useCallback((msg: string) => {
    setCommandFeedback(msg);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setCommandFeedback(null), 3000);
  }, []);

  // ═══ SHAKE-TO-TALK ═══
  // On mobile: double-shake activates the mic (push-to-talk)
  // Works with headphones + music — no audio session conflict
  useShakeToTalk({
    enabled: isMobile && activeListening && !internalListening, // Only when standby on mobile
    onShake: () => {
      if (!recognitionRef.current || internalListening) return;
      showFeedback('SHAKE DETECTED — MIC ON');
      finalTranscriptRef.current = '';
      setError(null);
      updateCommsState('standby');
      updateBuffer('');
      try {
        recognitionRef.current.start();
      } catch {
        // Already started
      }
    },
    threshold: 22,   // Tuned: sharp phone shake, not barbell movement
    shakeWindow: 800, // 2 shakes within 800ms
    cooldown: 2000,   // 2s cooldown between triggers
  });

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      setError('Voice input not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setInternalListening(true);
      setError(null);
      setInterimTranscript('');
      finalTranscriptRef.current = '';
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          const phrase = transcript.trim();
          if (!phrase) continue;

          // ═══ COMMS PROTOCOL PROCESSING ═══
          if (activeListeningRef.current && onVoiceCommandRef.current) {
            const { cleaned, hasOver } = stripOverFromEnd(phrase);

            // In HOT/BUFFERING — collecting message for Gunny
            if (commsStateRef.current === 'hot' || commsStateRef.current === 'buffering') {
              const newBuffer = messageBufferRef.current + (messageBufferRef.current ? ' ' : '') + cleaned;
              updateBuffer(newBuffer);

              if (hasOver && onSendMessageRef.current) {
                const finalMsg = stripCallSign(newBuffer, callSignRef.current);
                if (finalMsg) {
                  showFeedback('TRANSMITTED');
                  onSendMessageRef.current(finalMsg);
                }
                updateBuffer('');
                updateCommsState('standby');
                finalTranscriptRef.current = '';
                // On mobile push-to-talk: stop mic after transmit
                if (isMobileDevice()) {
                  setTimeout(() => recognitionRef.current?.stop(), 200);
                }
                continue;
              }

              updateCommsState('buffering');
              finalTranscriptRef.current = '';
              continue;
            }

            // STANDBY — check for call sign wake word
            if (detectCallSign(phrase, callSignRef.current)) {
              updateCommsState('hot');
              showFeedback('SEND YOUR TRAFFIC');
              // DON'T open Gunny panel — just go hot, stay on workout screen
              if (onWakeGunnyRef.current) onWakeGunnyRef.current();

              const afterCallSign = stripCallSign(phrase, callSignRef.current);
              const { cleaned: afterCleaned, hasOver: afterHasOver } = stripOverFromEnd(afterCallSign);

              if (afterCleaned) {
                updateBuffer(afterCleaned);
                if (afterHasOver && onSendMessageRef.current) {
                  onSendMessageRef.current(afterCleaned);
                  updateBuffer('');
                  updateCommsState('standby');
                  showFeedback('TRANSMITTED');
                  if (isMobileDevice()) {
                    setTimeout(() => recognitionRef.current?.stop(), 200);
                  }
                } else {
                  updateCommsState('buffering');
                }
              }
              finalTranscriptRef.current = '';
              continue;
            }

            // STANDBY — check for direct workout commands (no call sign needed)
            const command = parseVoiceCommand(phrase);
            if (command.type !== 'text') {
              if (command.type === 'log_set' && command.weight) {
                showFeedback(`LOGGED: ${command.weight}lbs x ${command.reps} reps`);
              } else if (command.type === 'start_timer' && command.duration) {
                showFeedback(`TIMER: ${command.duration}s`);
              } else if (command.type === 'next_exercise') {
                showFeedback('NEXT EXERCISE');
              } else if (command.type === 'complete_workout') {
                showFeedback('COMPLETING WORKOUT');
              }
              onVoiceCommandRef.current(command);
              finalTranscriptRef.current = '';
              // On mobile: stop mic after command
              if (isMobileDevice()) {
                setTimeout(() => recognitionRef.current?.stop(), 200);
              }
              continue;
            }

            // Unrecognized speech in standby — ignore
            finalTranscriptRef.current = '';
          } else {
            // Not in active listening — legacy behavior
            finalTranscriptRef.current += transcript + ' ';

            if (onSendMessageRef.current) {
              const { cleaned, hasOver } = stripOverFromEnd(finalTranscriptRef.current.trim());
              if (hasOver && cleaned) {
                showFeedback('TRANSMITTED');
                onSendMessageRef.current(cleaned);
                finalTranscriptRef.current = '';
                continue;
              }
            }
          }
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim);

      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      // On mobile push-to-talk: auto-stop after 8s silence
      // On desktop continuous: only auto-stop in non-active mode
      if (isMobileDevice() && activeListeningRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
        }, 8000);
      } else if (!activeListeningRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
        }, 10000);
      }
    };

    recognition.onerror = (event: Event & { error: string }) => {
      if (event.error === 'no-speech') {
        setError(null);
      } else if (event.error === 'network') {
        setError('Network error');
      } else if (event.error === 'aborted') {
        setError(null);
        // On mobile, if aborted while in HOT/BUFFERING (TTS killed mic), onend will handle restart
      } else if (event.error === 'not-allowed') {
        setError('Mic permission denied');
      } else {
        setError(null); // Don't show cryptic errors during workout
      }
    };

    recognition.onend = () => {
      setInternalListening(false);
      setInterimTranscript('');

      // Send final transcript (for non-command text in non-active mode)
      if (finalTranscriptRef.current.trim() && !activeListeningRef.current) {
        onTranscript(finalTranscriptRef.current.trim());
      }

      if (activeListeningRef.current) {
        if (isMobileDevice()) {
          // Mobile: if in HOT/BUFFERING, TTS killed the mic — restart after TTS finishes
          if (commsStateRef.current === 'hot' || commsStateRef.current === 'buffering') {
            const restartMic = () => {
              offSpeechDone(restartMic);
              setTimeout(() => {
                try {
                  finalTranscriptRef.current = '';
                  recognition.start();
                } catch { /* ignore */ }
              }, 500);
            };
            // Wait for TTS to finish, or restart after 3s safety timeout
            onSpeechDone(restartMic);
            setTimeout(() => {
              offSpeechDone(restartMic);
              // If mic is still off, force restart
              if (!recognitionRef.current) return;
              try {
                finalTranscriptRef.current = '';
                recognition.start();
              } catch { /* ignore */ }
            }, 3000);
          }
          // STANDBY on mobile: don't auto-restart (PTT — tap or shake)
        } else {
          // Desktop: always auto-restart
          setTimeout(() => {
            try {
              finalTranscriptRef.current = '';
              recognition.start();
            } catch { /* ignore */ }
          }, 300);
        }
      }

      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [onTranscript, showFeedback, updateCommsState, updateBuffer]);

  const toggleListening = () => {
    if (!isSupported || disabled) return;

    if (isListening) {
      recognitionRef.current?.stop();
      updateCommsState('standby');
      updateBuffer('');
    } else {
      // Abort first to clear any zombie state (critical for iPad)
      try { recognitionRef.current?.abort(); } catch { /* ignore */ }
      finalTranscriptRef.current = '';
      setError(null);
      updateCommsState('standby');
      updateBuffer('');
      setTimeout(() => {
        try { recognitionRef.current?.start(); } catch { /* ignore */ }
      }, 100);
    }
  };

  if (!isSupported) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', color: '#ff2020', fontSize: '11px' }}>
        Voice not supported
      </div>
    );
  }

  const displayText = error
    || commandFeedback
    || (commsState === 'buffering' && messageBuffer ? messageBuffer : null)
    || (commsState === 'hot' ? 'AWAITING TRANSMISSION...' : null)
    || interimTranscript
    || null;

  const isHot = commsState === 'hot' || commsState === 'buffering';
  const bubbleColor = error ? '#ff2020'
    : commandFeedback ? '#00ff41'
    : isHot ? '#FF8C00'
    : '#FF8C00';
  const bubbleBg = error ? 'rgba(255,32,32,0.1)'
    : commandFeedback ? 'rgba(0,255,65,0.08)'
    : isHot ? 'rgba(255,140,0,0.1)'
    : 'rgba(255,140,0,0.06)';
  const bubbleBorder = error ? 'rgba(255,32,32,0.4)'
    : commandFeedback ? 'rgba(0,255,65,0.4)'
    : isHot ? 'rgba(255,140,0,0.5)'
    : 'rgba(255,140,0,0.3)';

  return (
    <>
      <style>{`
        @keyframes voicePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 32, 32, 0.6); }
          50% { box-shadow: 0 0 0 8px rgba(255, 32, 32, 0); }
        }
        @keyframes commsHot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 140, 0, 0.5); }
          50% { box-shadow: 0 0 0 6px rgba(255, 140, 0, 0); }
        }
        @keyframes commsGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes scanline {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes feedbackFlash {
          0% { opacity: 0; transform: translateY(4px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
        @keyframes transcriptFadeIn {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes hotBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
      }}>
        {/* Transcript bubble — above mic */}
        {displayText && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: bubbleBg,
            border: `1px solid ${bubbleBorder}`,
            borderRadius: 4,
            padding: '3px 8px',
            whiteSpace: 'nowrap',
            maxWidth: compact ? 180 : 260,
            overflow: 'hidden',
            zIndex: 20,
            animation: commandFeedback
              ? 'feedbackFlash 3s ease-in-out'
              : 'transcriptFadeIn 0.15s ease-out',
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: bubbleColor, flexShrink: 0,
              boxShadow: `0 0 4px ${bubbleColor}`,
              animation: isHot && !commandFeedback ? 'hotBlink 1s infinite' : undefined,
            }} />
            {!commandFeedback && !error && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                overflow: 'hidden', borderRadius: 4, pointerEvents: 'none',
              }}>
                <div style={{
                  width: '30%', height: '100%',
                  background: `linear-gradient(90deg, transparent, ${bubbleBg}, transparent)`,
                  animation: 'scanline 2s linear infinite',
                }} />
              </div>
            )}
            <span style={{
              fontFamily: 'Share Tech Mono, monospace', fontSize: 10,
              color: bubbleColor, letterSpacing: 0.5,
              overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase',
            }}>
              {displayText}
            </span>
            <div style={{
              position: 'absolute', bottom: -4, left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 7, height: 7, background: bubbleBg,
              borderRight: `1px solid ${bubbleBorder}`,
              borderBottom: `1px solid ${bubbleBorder}`,
            }} />
          </div>
        )}

        {/* Comms button */}
        <button
          onClick={toggleListening}
          disabled={disabled}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          type="button"
          style={{
            width: compact ? 36 : 44,
            height: compact ? 36 : 44,
            borderRadius: compact ? 6 : 8,
            background: isHot
              ? 'radial-gradient(circle, rgba(255,140,0,0.2) 0%, rgba(255,140,0,0.05) 100%)'
              : isListening
                ? 'radial-gradient(circle, rgba(0,255,65,0.1) 0%, rgba(0,255,65,0.02) 100%)'
                : 'rgba(0,255,65,0.05)',
            border: `1.5px solid ${
              isHot ? '#FF8C00'
              : isListening ? 'rgba(0,255,65,0.5)'
              : 'rgba(0,255,65,0.35)'
            }`,
            color: isHot ? '#FF8C00' : isListening ? '#00ff41' : '#00ff41',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            opacity: disabled ? 0.4 : 1,
            animation: isHot
              ? 'commsHot 1.5s infinite'
              : isListening && !activeListening
                ? 'voicePulse 1.5s infinite' : undefined,
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <svg
            width={compact ? 16 : 20}
            height={compact ? 16 : 20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: isHot ? 'commsGlow 1s ease-in-out infinite' : undefined,
            }}
          >
            {isHot ? (
              <>
                <path d="M12 18v-6" />
                <path d="M12 6V4" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <path d="M7.5 7.5a6.36 6.36 0 0 1 9 0" />
                <path d="M5.1 5.1a10 10 0 0 1 13.8 0" />
                <path d="M16.5 16.5a6.36 6.36 0 0 1-9 0" />
                <path d="M18.9 18.9a10 10 0 0 1-13.8 0" />
              </>
            ) : (
              <>
                <rect x="6" y="4" width="12" height="16" rx="2" />
                <line x1="10" y1="8" x2="14" y2="8" />
                <line x1="10" y1="11" x2="14" y2="11" />
                <circle cx="12" cy="16" r="1.5" />
                <line x1="12" y1="2" x2="12" y2="4" />
                <line x1="9" y1="1" x2="12" y2="2" />
                {isListening && activeListening && (
                  <circle cx="18" cy="6" r="1" fill="currentColor" opacity="0.5" />
                )}
              </>
            )}
          </svg>

          {activeListening && isListening && !isHot && (
            <div style={{
              position: 'absolute', top: -3, right: -3,
              width: 8, height: 8, borderRadius: '50%',
              background: '#00ff41', border: '1.5px solid #0a0a0a',
              boxShadow: '0 0 6px rgba(0,255,65,0.8)',
            }} />
          )}
          {isHot && (
            <div style={{
              position: 'absolute', top: -3, right: -3,
              width: 8, height: 8, borderRadius: '50%',
              background: '#FF8C00', border: '1.5px solid #0a0a0a',
              boxShadow: '0 0 6px rgba(255,140,0,0.8)',
              animation: 'hotBlink 1s infinite',
            }} />
          )}
        </button>

        {/* State label */}
        {activeListening && isListening && (
          <div style={{
            marginTop: 2,
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 7, letterSpacing: 1,
            color: isHot ? '#FF8C00' : '#00ff41',
            opacity: isHot ? 1 : 0.5,
            textTransform: 'uppercase',
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}>
            {isHot ? 'HOT' : isMobile ? 'PTT' : 'STANDBY'}
          </div>
        )}
      </div>
    </>
  );
}
