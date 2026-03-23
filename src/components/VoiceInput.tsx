'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

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
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Voice command types for smart workout logging
export interface VoiceCommand {
  type: 'log_set' | 'swap_exercise' | 'next_exercise' | 'start_timer' | 'ask_gunny' | 'complete_workout' | 'text';
  weight?: number;
  reps?: number;
  duration?: number; // timer seconds
  rawText: string;
}

// Parse voice input for workout commands
function parseVoiceCommand(text: string): VoiceCommand {
  const lower = text.toLowerCase().trim();

  // LOG SET patterns: "log 135 for 10", "log that set 135 by 10", "set done 135 times 10", "135 for 10 reps"
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

  // "log my last set" / "log that" / "done with that set" (no numbers — confirm last entered)
  if (/(?:log|record|save)\s*(?:it|that|the set|my set|last set|this set)/i.test(lower)) {
    return { type: 'log_set', rawText: text };
  }

  // NEXT EXERCISE: "next exercise", "move on", "next movement"
  if (/(?:next\s*(?:exercise|movement|one|set)|move\s*on|skip)/i.test(lower)) {
    return { type: 'next_exercise', rawText: text };
  }

  // TIMER: "start timer 90 seconds", "rest 2 minutes", "timer 60"
  const timerMatch = lower.match(/(?:start\s*)?(?:timer|rest)\s*(?:for\s*)?(\d+)\s*(?:seconds?|secs?|s\b|minutes?|mins?|m\b)/i);
  if (timerMatch) {
    let secs = parseInt(timerMatch[1]);
    if (/min/i.test(timerMatch[0])) secs *= 60;
    return { type: 'start_timer', duration: secs, rawText: text };
  }

  // SWAP EXERCISE: "swap this for...", "replace with...", "switch to..."
  if (/(?:swap|replace|switch|change)\s*(?:this|it|that)?\s*(?:for|with|to)/i.test(lower)) {
    return { type: 'ask_gunny', rawText: text };
  }

  // COMPLETE: "finish workout", "complete workout", "done with workout", "I'm done"
  if (/(?:finish|complete|done\s*with|end)\s*(?:the\s*)?workout/i.test(lower) || lower === "i'm done" || lower === 'im done') {
    return { type: 'complete_workout', rawText: text };
  }

  // Default: send as text to Gunny
  return { type: 'text', rawText: text };
}

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onVoiceCommand?: (command: VoiceCommand) => void;
  activeListening?: boolean; // Workout mode continuous listening
  isListening?: boolean;
  disabled?: boolean;
  compact?: boolean; // For side panel
}

export default function VoiceInput({
  onTranscript,
  onVoiceCommand,
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

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef('');
  const activeListeningRef = useRef(activeListening);
  activeListeningRef.current = activeListening;

  const isListening = controlledListening !== undefined ? controlledListening : internalListening;

  const showFeedback = useCallback((msg: string) => {
    setCommandFeedback(msg);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setCommandFeedback(null), 3000);
  }, []);

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
          finalTranscriptRef.current += transcript + ' ';

          // In active listening mode, process each final phrase immediately
          if (activeListeningRef.current && onVoiceCommand) {
            const command = parseVoiceCommand(transcript.trim());
            if (command.type !== 'text') {
              // Show command feedback
              if (command.type === 'log_set' && command.weight) {
                showFeedback(`LOGGED: ${command.weight}lbs x ${command.reps} reps`);
              } else if (command.type === 'start_timer' && command.duration) {
                showFeedback(`TIMER: ${command.duration}s`);
              } else if (command.type === 'next_exercise') {
                showFeedback('NEXT EXERCISE');
              } else if (command.type === 'complete_workout') {
                showFeedback('COMPLETING WORKOUT');
              }
              onVoiceCommand(command);
              // Don't send to text input — it was a command
              finalTranscriptRef.current = '';
            }
          }
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim);

      // Reset silence timeout on any speech
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      // In active listening mode, don't auto-stop — keep listening
      // In normal mode, auto-stop after 10s silence
      if (!activeListeningRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
        }, 10000);
      }
    };

    recognition.onerror = (event: Event & { error: string }) => {
      if (event.error === 'no-speech') {
        // In active listening mode, restart silently
        if (activeListeningRef.current) {
          setError(null);
          return;
        }
        setError('No speech detected');
      } else if (event.error === 'network') {
        setError('Network error');
      } else if (event.error === 'aborted') {
        setError(null);
      } else {
        setError(`Error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setInternalListening(false);
      setInterimTranscript('');

      // Send final transcript (for non-command text)
      if (finalTranscriptRef.current.trim()) {
        onTranscript(finalTranscriptRef.current.trim());
      }

      // In active listening mode, auto-restart
      if (activeListeningRef.current) {
        setTimeout(() => {
          try {
            finalTranscriptRef.current = '';
            recognition.start();
          } catch {
            // Already started or error — ignore
          }
        }, 300);
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
  }, [onTranscript, onVoiceCommand, showFeedback]);

  const toggleListening = () => {
    if (!isSupported || disabled) return;

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      finalTranscriptRef.current = '';
      setError(null);
      recognitionRef.current?.start();
    }
  };

  if (!isSupported) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', color: '#ff2020', fontSize: '11px' }}>
        Voice not supported
      </div>
    );
  }

  const showTranscript = interimTranscript || commandFeedback || error;

  return (
    <>
      <style>{`
        @keyframes voicePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 32, 32, 0.6); }
          50% { box-shadow: 0 0 0 8px rgba(255, 32, 32, 0); }
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
      `}</style>

      <div style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
      }}>
        {/* Transcript bubble — positioned above mic */}
        {showTranscript && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: error
              ? 'rgba(255,32,32,0.1)'
              : commandFeedback
                ? 'rgba(0,255,65,0.08)'
                : 'rgba(255,140,0,0.06)',
            border: `1px solid ${
              error
                ? 'rgba(255,32,32,0.4)'
                : commandFeedback
                  ? 'rgba(0,255,65,0.4)'
                  : 'rgba(255,140,0,0.3)'
            }`,
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
            {/* Signal dot */}
            <div style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: error ? '#ff2020' : commandFeedback ? '#00ff41' : '#FF8C00',
              flexShrink: 0,
              boxShadow: `0 0 4px ${error ? 'rgba(255,32,32,0.8)' : commandFeedback ? 'rgba(0,255,65,0.8)' : 'rgba(255,140,0,0.8)'}`,
            }} />
            {/* Scanline overlay */}
            {!commandFeedback && !error && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                overflow: 'hidden',
                borderRadius: 4,
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: '30%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,140,0,0.08), transparent)',
                  animation: 'scanline 2s linear infinite',
                }} />
              </div>
            )}
            {/* Text */}
            <span style={{
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 10,
              color: error ? '#ff2020' : commandFeedback ? '#00ff41' : '#FF8C00',
              letterSpacing: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textTransform: 'uppercase',
            }}>
              {error || commandFeedback || interimTranscript}
            </span>
            {/* Bottom notch/arrow pointing down to mic */}
            <div style={{
              position: 'absolute',
              bottom: -4,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 7,
              height: 7,
              background: error
                ? 'rgba(255,32,32,0.1)'
                : commandFeedback
                  ? 'rgba(0,255,65,0.08)'
                  : 'rgba(255,140,0,0.06)',
              borderRight: `1px solid ${
                error
                  ? 'rgba(255,32,32,0.4)'
                  : commandFeedback
                    ? 'rgba(0,255,65,0.4)'
                    : 'rgba(255,140,0,0.3)'
              }`,
              borderBottom: `1px solid ${
                error
                  ? 'rgba(255,32,32,0.4)'
                  : commandFeedback
                    ? 'rgba(0,255,65,0.4)'
                    : 'rgba(255,140,0,0.3)'
              }`,
            }} />
          </div>
        )}

        {/* Comms button — military radio icon */}
        <button
          onClick={toggleListening}
          disabled={disabled}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          type="button"
          style={{
            width: compact ? 36 : 44,
            height: compact ? 36 : 44,
            borderRadius: compact ? 6 : 8,
            background: isListening
              ? 'radial-gradient(circle, rgba(255,32,32,0.15) 0%, rgba(255,32,32,0.05) 100%)'
              : 'rgba(0,255,65,0.05)',
            border: `1.5px solid ${isListening ? '#ff2020' : 'rgba(0,255,65,0.35)'}`,
            color: isListening ? '#ff2020' : '#00ff41',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            opacity: disabled ? 0.4 : 1,
            animation: isListening ? 'voicePulse 1.5s infinite' : undefined,
            flexShrink: 0,
            position: 'relative',
          }}
        >
          {/* Military radio/comms SVG icon */}
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
              animation: isListening ? 'commsGlow 1s ease-in-out infinite' : undefined,
            }}
          >
            {isListening ? (
              /* Active: radio signal waves */
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
              /* Idle: tactical radio handset */
              <>
                <rect x="6" y="4" width="12" height="16" rx="2" />
                <line x1="10" y1="8" x2="14" y2="8" />
                <line x1="10" y1="11" x2="14" y2="11" />
                <circle cx="12" cy="16" r="1.5" />
                <line x1="12" y1="2" x2="12" y2="4" />
                <line x1="9" y1="1" x2="12" y2="2" />
              </>
            )}
          </svg>

          {/* Active listening badge */}
          {activeListening && isListening && (
            <div style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#00ff41',
              border: '1.5px solid #0a0a0a',
              boxShadow: '0 0 6px rgba(0,255,65,0.8)',
            }} />
          )}
        </button>
      </div>
    </>
  );
}
