'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { speak, stopSpeaking, getPreferredVoice, setPreferredVoice, VOICE_OPTIONS, GunnyVoice, unlockAudioContext } from '@/lib/tts';
import { Operator } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════
// TACTICAL RADIO COMMS — Guns Up Command Center
// Push-to-talk voice interface with radio simulation audio
// Protocol: Operator callsign ↔ GUNNY
// ═══════════════════════════════════════════════════════════════

// Web Speech API TypeScript declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  length: number;
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

// Radio audio effect generator using Web Audio API
class RadioAudioEngine {
  private ctx: AudioContext | null = null;
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this.initialized = true;
  }

  playKeyTone(duration = 0.15) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playReleaseTone() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playStatic(duration = 0.4) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.08;
    }
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 0.5;
    gainNode.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    source.start();
  }

  playIncomingTone() {
    if (!this.ctx) return;
    [0, 0.12].forEach((delay) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1400;
      gain.gain.setValueAtTime(0, this.ctx!.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.3, this.ctx!.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + delay + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(this.ctx!.currentTime + delay);
      osc.stop(this.ctx!.currentTime + delay + 0.1);
    });
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CommsEntry {
  id: number;
  callsign: string;
  message: string;
  direction: 'TX' | 'RX';
  timestamp: string;
}

interface TacticalRadioProps {
  operator: Operator;
  allOperators?: Operator[];
  onUpdateOperator?: (updated: Operator) => void;
}

export default function TacticalRadio({ operator }: TacticalRadioProps) {
  const userCallsign = operator.callsign || 'OPERATOR';
  const [status, setStatus] = useState<'STANDBY' | 'TX' | 'PROCESSING' | 'RX'>('STANDBY');
  const [commsLog, setCommsLog] = useState<CommsEntry[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [channelFreq] = useState('138.500');
  const [selectedVoice, setSelectedVoice] = useState<GunnyVoice>(getPreferredVoice());
  const [showSettings, setShowSettings] = useState(false);
  const [textInput, setTextInput] = useState('');

  const audioRef = useRef<RadioAudioEngine | null>(null);
  const voiceRef = useRef<SpeechRecognition | null>(null);
  const isHolding = useRef(false);
  const liveTranscriptRef = useRef('');
  const chatHistoryRef = useRef<ChatMessage[]>([]);
  const commsLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    audioRef.current = new RadioAudioEngine();
    if ('speechSynthesis' in window) {
      speechSynthesis.getVoices();
    }
  }, []);

  // Auto-scroll comms log
  useEffect(() => {
    if (commsLogRef.current) {
      commsLogRef.current.scrollTop = commsLogRef.current.scrollHeight;
    }
  }, [commsLog, liveTranscript]);

  const addToLog = useCallback((callsign: string, message: string, direction: 'TX' | 'RX') => {
    setCommsLog((prev) => [
      ...prev,
      {
        id: Date.now(),
        callsign,
        message,
        direction,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      },
    ]);
  }, []);

  // Build operator context for Gunny
  const buildContext = useCallback(() => {
    const op = operator;
    const parts: string[] = [];
    parts.push(`Callsign: ${op.callsign || 'OPERATOR'}`);
    if (op.profile?.weight) parts.push(`Weight: ${op.profile.weight}lbs`);
    if (op.profile?.goals?.length) parts.push(`Goals: ${op.profile.goals.join(', ')}`);
    if (op.profile?.fitnessLevel) parts.push(`Level: ${op.profile.fitnessLevel}`);
    if ((op.prs || []).length) {
      const prStr = (op.prs || []).slice(0, 5).map(pr => `${pr.exercise}: ${pr.weight}lbs`).join(', ');
      parts.push(`PRs: ${prStr}`);
    }
    return parts.join(' | ');
  }, [operator]);

  // Send transcript to Gunny via /api/gunny
  const sendToGunny = useCallback(
    async (transcript: string) => {
      setStatus('PROCESSING');
      addToLog(userCallsign, transcript, 'TX');

      // Add to chat history
      chatHistoryRef.current.push({ role: 'user', content: transcript });

      try {
        const response = await fetch('/api/gunny', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''}` },
          body: JSON.stringify({
            messages: chatHistoryRef.current.map(m => ({
              role: m.role === 'assistant' ? 'gunny' : 'user',
              text: m.content,
              timestamp: Date.now(),
            })),
            operatorContext: buildContext(),
            tier: operator.tier || 'standard',
            mode: 'radio',
            screenContext: 'Operator is on the Tactical Radio comms screen. Using push-to-talk voice interface. Keep responses SHORT — 2-3 sentences max. Radio brevity.',
          }),
        });

        const data = await response.json();
        const gunnyResponse = data.response || data.message || data.text || 'Gunny to all stations. Comms error. Say again. Over.';

        // Add to chat history
        chatHistoryRef.current.push({ role: 'assistant', content: gunnyResponse });

        // Keep history manageable
        if (chatHistoryRef.current.length > 30) {
          chatHistoryRef.current = chatHistoryRef.current.slice(-20);
        }

        setStatus('RX');
        addToLog('GUNNY', gunnyResponse, 'RX');

        // Play radio incoming tone, then speak via OpenAI TTS
        audioRef.current?.playIncomingTone();
        setTimeout(() => {
          audioRef.current?.playStatic(0.3);
          setTimeout(() => {
            speak(gunnyResponse, selectedVoice).then(() => {
              // After speech finishes, play release tone
              setTimeout(() => {
                audioRef.current?.playReleaseTone();
                setTimeout(() => {
                  audioRef.current?.playStatic(0.2);
                  setStatus('STANDBY');
                }, 200);
              }, 300);
            });
          }, 350);
        }, 250);

      } catch {
        const errMsg = `Gunny to ${userCallsign}. Comms down. Check your connection. Over.`;
        addToLog('GUNNY', errMsg, 'RX');
        setStatus('STANDBY');
      }
    },
    [addToLog, userCallsign, buildContext, operator.tier, selectedVoice]
  );

  // PTT handlers
  const startTransmission = useCallback(() => {
    if (isHolding.current || status === 'RX' || status === 'PROCESSING') return;
    isHolding.current = true;
    audioRef.current?.init();
    unlockAudioContext();
    audioRef.current?.playKeyTone();
    setStatus('TX');
    setLiveTranscript('');
    liveTranscriptRef.current = '';

    if (typeof window === 'undefined') return;
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      liveTranscriptRef.current = transcript;
      setLiveTranscript(transcript);
    };

    recognition.onend = () => {};
    voiceRef.current = recognition;
    setTimeout(() => {
      try { recognition.start(); } catch { /* ignore */ }
    }, 200);
  }, [status]);

  const endTransmission = useCallback(() => {
    if (!isHolding.current) return;
    isHolding.current = false;
    audioRef.current?.playReleaseTone();
    try { voiceRef.current?.stop(); } catch { /* ignore */ }

    const finalTranscript = liveTranscriptRef.current.trim();
    if (finalTranscript) {
      audioRef.current?.playStatic(0.3);
      setTimeout(() => sendToGunny(finalTranscript), 400);
    } else {
      setStatus('STANDBY');
    }
    setLiveTranscript('');
  }, [sendToGunny]);

  // Text input send
  const sendTextMessage = useCallback(() => {
    const msg = textInput.trim();
    if (!msg || status === 'PROCESSING' || status === 'RX') return;
    setTextInput('');
    sendToGunny(msg);
  }, [textInput, status, sendToGunny]);

  // Keyboard PTT (spacebar) — only when text input not focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Don't capture spacebar if user is typing
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        startTransmission();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        endTransmission();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startTransmission, endTransmission]);

  const statusColors: Record<string, string> = {
    STANDBY: '#00ff41',
    TX: '#ff3333',
    PROCESSING: '#ffaa00',
    RX: '#00aaff',
  };

  return (
    <div
      style={{
        background: '#0a0e14',
        height: '100%',
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
        color: '#00ff41',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Scanline overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.03) 2px, rgba(0,255,65,0.03) 4px)',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* Header */}
      <div
        style={{
          borderBottom: '1px solid #00ff4133',
          paddingBottom: '10px',
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        <div>
          <div style={{ fontSize: '10px', opacity: 0.5, letterSpacing: '3px' }}>
            TACTICAL COMMS INTERFACE
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '2px', fontFamily: "'Orbitron', sans-serif" }}>
            RADIO — CH {channelFreq}
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Voice selector */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: 'rgba(0,255,65,0.05)',
              border: '1px solid rgba(0,255,65,0.15)',
              borderRadius: '4px',
              padding: '4px 8px',
              color: '#00ff41',
              fontSize: '9px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              letterSpacing: '1px',
            }}
          >
            VOICE: {selectedVoice.toUpperCase()}
          </button>
          <div>
            <div style={{ fontSize: '9px', opacity: 0.5 }}>STATUS</div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: statusColors[status],
                textShadow: `0 0 10px ${statusColors[status]}`,
              }}
            >
              {status === 'TX' ? '◉ TRANSMITTING'
                : status === 'RX' ? '◉ RECEIVING'
                : status === 'PROCESSING' ? '◎ PROCESSING'
                : '○ STANDBY'}
            </div>
          </div>
        </div>
      </div>

      {/* Voice settings dropdown */}
      {showSettings && (
        <div style={{
          background: '#0d1117',
          border: '1px solid #00ff4133',
          borderRadius: '4px',
          padding: '10px',
          marginBottom: '10px',
          flexShrink: 0,
          zIndex: 2,
        }}>
          <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '6px', letterSpacing: '2px' }}>
            GUNNY VOICE SELECT
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {VOICE_OPTIONS.map(v => (
              <button
                key={v.id}
                onClick={() => {
                  setSelectedVoice(v.id);
                  setPreferredVoice(v.id);
                  setShowSettings(false);
                }}
                style={{
                  padding: '4px 10px',
                  fontSize: '10px',
                  fontFamily: 'inherit',
                  background: selectedVoice === v.id ? 'rgba(0,255,65,0.15)' : 'rgba(0,255,65,0.03)',
                  border: `1px solid ${selectedVoice === v.id ? '#00ff41' : 'rgba(0,255,65,0.1)'}`,
                  borderRadius: '3px',
                  color: selectedVoice === v.id ? '#00ff41' : '#666',
                  cursor: 'pointer',
                  letterSpacing: '1px',
                }}
              >
                {v.label} — {v.desc}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Comms Log */}
      <div
        ref={commsLogRef}
        style={{
          background: '#0d1117',
          border: '1px solid #00ff4122',
          borderRadius: '4px',
          padding: '12px',
          flex: 1,
          overflowY: 'auto',
          marginBottom: '12px',
          zIndex: 2,
        }}
      >
        {commsLog.length === 0 && (
          <div style={{ opacity: 0.3, textAlign: 'center', paddingTop: '15vh', fontSize: '12px' }}>
            HOLD SPACEBAR OR PTT BUTTON TO TRANSMIT
            <br />
            <span style={{ fontSize: '10px' }}>
              &quot;{userCallsign} to Gunny, over.&quot;
            </span>
          </div>
        )}
        {commsLog.map((entry) => (
          <div
            key={entry.id}
            style={{
              marginBottom: '10px',
              paddingLeft: '10px',
              borderLeft: `2px solid ${entry.direction === 'TX' ? '#ff3333' : '#00aaff'}`,
            }}
          >
            <div style={{ fontSize: '9px', opacity: 0.5 }}>
              [{entry.timestamp}] {entry.direction}
            </div>
            <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
              <span
                style={{
                  fontWeight: 700,
                  color: entry.direction === 'TX' ? '#ff3333' : '#00aaff',
                }}
              >
                {entry.callsign}:
              </span>{' '}
              {entry.message}
            </div>
          </div>
        ))}
        {status === 'TX' && liveTranscript && (
          <div
            style={{
              marginBottom: '10px',
              paddingLeft: '10px',
              borderLeft: '2px solid #ff3333',
              opacity: 0.7,
            }}
          >
            <div style={{ fontSize: '9px', opacity: 0.5 }}>LIVE</div>
            <div style={{ fontSize: '12px', fontStyle: 'italic' }}>
              <span style={{ color: '#ff3333', fontWeight: 700 }}>
                {userCallsign}:
              </span>{' '}
              {liveTranscript}
            </div>
          </div>
        )}
      </div>

      {/* Controls Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, zIndex: 2 }}>
        {/* Text input fallback */}
        <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendTextMessage(); }}
            placeholder="Type message..."
            disabled={status === 'PROCESSING' || status === 'RX'}
            style={{
              flex: 1,
              background: '#0d1117',
              border: '1px solid #00ff4122',
              borderRadius: '4px',
              padding: '10px 12px',
              color: '#00ff41',
              fontSize: '12px',
              fontFamily: 'inherit',
              outline: 'none',
              opacity: status === 'PROCESSING' || status === 'RX' ? 0.4 : 1,
            }}
          />
          <button
            onClick={sendTextMessage}
            disabled={!textInput.trim() || status === 'PROCESSING' || status === 'RX'}
            style={{
              padding: '10px 16px',
              background: 'rgba(0,255,65,0.1)',
              border: '1px solid rgba(0,255,65,0.3)',
              borderRadius: '4px',
              color: '#00ff41',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              letterSpacing: '1px',
              opacity: !textInput.trim() || status === 'PROCESSING' || status === 'RX' ? 0.3 : 1,
            }}
          >
            SEND
          </button>
        </div>

        {/* PTT Button */}
        <button
          onMouseDown={startTransmission}
          onMouseUp={endTransmission}
          onTouchStart={(e) => { e.preventDefault(); startTransmission(); }}
          onTouchEnd={(e) => { e.preventDefault(); endTransmission(); }}
          disabled={status === 'RX' || status === 'PROCESSING'}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            border: `3px solid ${status === 'TX' ? '#ff3333' : '#00ff41'}`,
            background:
              status === 'TX'
                ? 'radial-gradient(circle, #ff333344, #0a0e14)'
                : 'radial-gradient(circle, #00ff4111, #0a0e14)',
            color: status === 'TX' ? '#ff3333' : '#00ff41',
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: 'inherit',
            letterSpacing: '2px',
            cursor: status === 'RX' || status === 'PROCESSING' ? 'not-allowed' : 'pointer',
            opacity: status === 'RX' || status === 'PROCESSING' ? 0.4 : 1,
            boxShadow:
              status === 'TX'
                ? '0 0 30px #ff333355, inset 0 0 20px #ff333322'
                : '0 0 20px #00ff4122',
            transition: 'all 0.2s ease',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            flexShrink: 0,
          }}
        >
          {status === 'TX' ? 'TX' : 'PTT'}
        </button>
      </div>

      {/* Footer hint */}
      <div style={{
        textAlign: 'center',
        fontSize: '9px',
        opacity: 0.3,
        marginTop: '8px',
        letterSpacing: '1px',
        flexShrink: 0,
        zIndex: 2,
      }}>
        HOLD TO TRANSMIT — SPACEBAR OR PRESS PTT &nbsp;|&nbsp; {userCallsign} ↔ GUNNY
      </div>
    </div>
  );
}
