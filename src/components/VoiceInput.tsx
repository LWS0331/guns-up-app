'use client';

import { useEffect, useRef, useState } from 'react';

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

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  isListening?: boolean;
  disabled?: boolean;
}

export default function VoiceInput({
  onTranscript,
  isListening: controlledListening,
  disabled = false,
}: VoiceInputProps) {
  const [internalListening, setInternalListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef('');

  const isListening = controlledListening !== undefined ? controlledListening : internalListening;

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
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim);

      // Reset silence timeout on any speech
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      // Auto-stop after 10 seconds of silence
      silenceTimeoutRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      }, 10000);
    };

    recognition.onerror = (event: Event & { error: string }) => {
      if (event.error === 'no-speech') {
        setError('No speech detected. Try again.');
      } else if (event.error === 'network') {
        setError('Network error. Check your connection.');
      } else if (event.error === 'aborted') {
        setError(null);
      } else {
        setError(`Error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setInternalListening(false);
      setInterimTranscript('');

      // Send final transcript
      if (finalTranscriptRef.current.trim()) {
        onTranscript(finalTranscriptRef.current.trim());
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
    };
  }, [onTranscript]);

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          color: '#FF4444',
          fontSize: '12px',
          textAlign: 'center',
        }}
      >
        Voice not supported
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(0, 255, 65, 0.7);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(0, 255, 65, 0);
          }
        }

        .voice-input-mic-button {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #1a1a1a;
          border: 2px solid #00FF41;
          color: #00FF41;
          font-size: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          font-family: 'Chakra Petch', inherit;
          font-weight: 600;
          position: relative;
        }

        .voice-input-mic-button:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 0 8px rgba(0, 255, 65, 0.5);
        }

        .voice-input-mic-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .voice-input-mic-button.listening {
          border-color: #FF4444;
          color: #FF4444;
          animation: pulse 1.5s infinite;
        }

        .voice-input-container {
          position: relative;
          display: inline-block;
        }

        .voice-input-interim {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          background: rgba(0, 255, 65, 0.1);
          border: 1px solid #00FF41;
          border-radius: 4px;
          padding: 6px 10px;
          color: #00FF41;
          font-size: 12px;
          max-width: 200px;
          word-break: break-word;
          font-family: 'Chakra Petch', monospace;
          white-space: normal;
          z-index: 10;
          animation: fadeIn 0.2s ease-in;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .voice-input-error {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          background: rgba(255, 68, 68, 0.1);
          border: 1px solid #FF4444;
          border-radius: 4px;
          padding: 6px 10px;
          color: #FF4444;
          font-size: 12px;
          max-width: 200px;
          word-break: break-word;
          font-family: 'Chakra Petch', monospace;
          white-space: normal;
          z-index: 10;
          animation: fadeIn 0.2s ease-in;
        }
      `}</style>

      <div className="voice-input-container">
        <button
          className={`voice-input-mic-button ${isListening ? 'listening' : ''}`}
          onClick={toggleListening}
          disabled={disabled}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          type="button"
        >
          {isListening ? '🎤' : '🎙️'}
        </button>

        {interimTranscript && (
          <div className="voice-input-interim">{interimTranscript}</div>
        )}

        {error && <div className="voice-input-error">{error}</div>}
      </div>
    </>
  );
}
