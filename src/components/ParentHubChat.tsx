'use client';

// ParentHubChat — slim Gunny chat scoped to a specific linked junior.
//
// Different persona from the parent's own Gunny tab (which is keyed off
// the parent's training context). This surface uses the Parent-Coach
// system prompt in /api/gunny — it addresses the parent, scripts cues
// they read aloud to the kid, restates the youth safety floor inline,
// and routes any safety-language detection onto the JUNIOR's record
// (not the parent's).
//
// Per-junior chat thread isolation: chatType = `gunny-parent-hub-{juniorId}`.
// One parent with multiple linked juniors gets one thread per junior.
//
// Built from scratch — NOT a refactor of GunnyChat — because that
// component is ~4000 LOC tightly coupled to the operator's own
// training context. This surface is much narrower (no streaming, no
// voice, no workout-builder; just chat about the kid).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Operator } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { getAuthToken } from '@/lib/authClient';
import { getLocalDateStr, getLocalTimezone } from '@/lib/dateUtils';

interface ParentHubChatProps {
  parent: Operator;
  junior: Operator;
  /** Bubbled up so the parent dashboard can refresh safety-events state when Gunny logs one server-side. */
  onJuniorMaybeUpdated?: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  ts: string;
}

interface SerializedMessage {
  role: 'user' | 'assistant';
  text?: string;
  content?: string;
  timestamp?: string;
}

const HISTORY_CAP = 20; // tail length sent to /api/gunny — same shape as GunnyChat

export default function ParentHubChat({ parent, junior, onJuniorMaybeUpdated }: ParentHubChatProps) {
  const { t } = useLanguage();
  const chatType = `gunny-parent-hub-${junior.id}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history when the junior changes — keyed by junior.id via chatType.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/chat?operatorId=${encodeURIComponent(parent.id)}&chatType=${encodeURIComponent(chatType)}`,
          { headers: { Authorization: `Bearer ${getAuthToken()}` } },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const loaded: ChatMessage[] = Array.isArray(data.messages)
          ? data.messages
              .map((m: SerializedMessage) => ({
                role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
                text: typeof m.text === 'string' ? m.text : typeof m.content === 'string' ? m.content : '',
                ts: typeof m.timestamp === 'string' ? m.timestamp : new Date().toISOString(),
              }))
              .filter((m: ChatMessage) => m.text.length > 0)
          : [];
        setMessages(loaded);
      } catch {
        // Silent — first-load failure leaves the surface blank, parent
        // can still send a message which will create the history.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parent.id, chatType]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const persist = useCallback(
    async (next: ChatMessage[]) => {
      try {
        await fetch('/api/chat', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({
            operatorId: parent.id,
            chatType,
            messages: next.map((m) => ({ role: m.role, text: m.text, timestamp: m.ts })),
          }),
        });
      } catch (err) {
        console.warn('[ParentHubChat] persist failed:', err);
      }
    },
    [parent.id, chatType],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);
    const now = new Date().toISOString();
    const userMsg: ChatMessage = { role: 'user', text, ts: now };
    const baseHistory = [...messages, userMsg];
    setMessages(baseHistory);
    setInput('');

    try {
      const recent = baseHistory.slice(-HISTORY_CAP).map((m) => ({
        role: m.role,
        content: m.text,
      }));
      const res = await fetch('/api/gunny', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          messages: recent,
          tier: parent.tier,
          mode: 'parent_coaching',
          chatType,
          operatorContext: {
            id: parent.id,
            callsign: parent.callsign,
            tier: parent.tier,
            isJunior: false,
            personaId: parent.personaId ?? null,
          },
          juniorContext: {
            id: junior.id,
            // Backend re-fetches from DB; this is hint only so the route
            // can fail fast on missing id.
          },
          clientDate: getLocalDateStr(),
          clientDateLong: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          clientTimezone: getLocalTimezone(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Gunny call failed (HTTP ${res.status})`);
        return;
      }
      const reply =
        typeof data.message === 'string'
          ? data.message
          : typeof data.text === 'string'
            ? data.text
            : typeof data.content === 'string'
              ? data.content
              : '';
      if (!reply) {
        setError('Empty response from Gunny.');
        return;
      }
      const asstMsg: ChatMessage = {
        role: 'assistant',
        text: reply,
        ts: new Date().toISOString(),
      };
      const nextHistory = [...baseHistory, asstMsg];
      setMessages(nextHistory);
      await persist(nextHistory);
      // If Gunny logged a safety event server-side, give the parent
      // dashboard a chance to re-fetch the junior's safety state so
      // the Safety Events card refreshes without a full page reload.
      if (
        Array.isArray(data.safetyEvents) &&
        data.safetyEvents.length > 0 &&
        onJuniorMaybeUpdated
      ) {
        onJuniorMaybeUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setSending(false);
    }
  }, [input, messages, parent, junior, chatType, sending, persist, onJuniorMaybeUpdated]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div
      style={{
        padding: 14,
        background: '#0a0a0a',
        border: '1px solid rgba(0,184,212,0.30)',
        borderRadius: 4,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 12,
          color: '#00b8d4',
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        {t('parent.chat.title').replace('{callsign}', junior.callsign)}
      </div>
      <div
        style={{
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: 10,
          color: '#666',
          letterSpacing: 0.5,
          marginBottom: 10,
        }}
      >
        {t('parent.chat.subtitle')}
      </div>

      <div
        ref={scrollRef}
        style={{
          maxHeight: 320,
          overflowY: 'auto',
          marginBottom: 10,
          padding: '6px 8px',
          background: '#050505',
          borderRadius: 3,
          border: '1px solid #1a1a1a',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic', padding: '8px 0' }}>
            {t('parent.chat.empty_state').replace('{callsign}', junior.callsign)}
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 8,
                fontSize: 12,
                lineHeight: 1.5,
                color: m.role === 'user' ? '#e0e0e0' : '#00b8d4',
              }}
            >
              <div
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 9,
                  letterSpacing: 1,
                  color: m.role === 'user' ? '#888' : '#0099b0',
                  marginBottom: 2,
                }}
              >
                {m.role === 'user' ? parent.callsign : 'GUNNY'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
            </div>
          ))
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '6px 8px',
            marginBottom: 8,
            background: 'rgba(255,68,68,0.06)',
            border: '1px solid rgba(255,68,68,0.25)',
            color: '#ff8888',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 11,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('parent.chat.placeholder').replace('{callsign}', junior.callsign)}
          disabled={sending}
          rows={2}
          style={{
            flex: 1,
            padding: '8px 10px',
            background: '#050505',
            border: '1px solid #2a2a2a',
            color: '#e0e0e0',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 12,
            borderRadius: 3,
            resize: 'vertical',
          }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !input.trim()}
          style={{
            padding: '10px 16px',
            background: sending || !input.trim() ? '#1a1a1a' : '#00b8d4',
            color: sending || !input.trim() ? '#555' : '#0a0a0a',
            border: 'none',
            borderRadius: 3,
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.5,
            cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? '…' : t('parent.chat.send')}
        </button>
      </div>
    </div>
  );
}
