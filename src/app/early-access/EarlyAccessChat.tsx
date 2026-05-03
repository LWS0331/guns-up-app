'use client';

// Gunny-Lite — anonymous Q&A surface for /early-access prospects.
//
// Two-message rate limit (enforced server-side per-IP). After the
// 2nd reply, the input is replaced with a big IG-DM CTA to route
// the conversation to Ruben directly.
//
// The opening greeting is a static UI primer (rendered before the
// messages array), NOT part of the conversation history sent to
// the API — the system prompt already carries the bot's identity,
// so we don't need to re-anchor it in every request.

import { useEffect, useRef, useState } from 'react';
import styles from './early-access.module.css';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const IG_DM_URL = 'https://ig.me/m/gunnyai_fit';

const GREETING =
  "I'm Gunny-Lite — the AI receptionist for GUNS UP. Ask me about pricing, what's in each tier, the onboarding flow, or how the coach actually works. Two questions on the house, then I route you to Ruben directly.";

export default function EarlyAccessChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new messages / loading state changes.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading || limitReached) return;

    const next: Msg[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/early-access/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        limitReached?: boolean;
        error?: string;
      };

      const reply =
        data.reply ||
        "Comms hiccup — DM @gunnyai_fit on Instagram and Ruben will get back to you.";
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      if (data.limitReached) setLimitReached(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Network error — DM @gunnyai_fit on Instagram for a direct reply.',
        },
      ]);
      setLimitReached(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.chatSection}>
      <div className={styles.chatHead}>
        <span className={styles.eyebrow}>// ASK GUNNY-LITE</span>
        <p className={styles.chatLede}>
          AI receptionist. Pricing, tiers, onboarding, the philosophy.
          Two questions, then I route you to Ruben.
        </p>
      </div>

      <div className={styles.chatPanel}>
        <div className={styles.chatLog} ref={logRef} aria-live="polite">
          {/* Static greeting — UI primer, not part of API history */}
          <div className={`${styles.chatMsg} ${styles.chatMsgBot}`}>
            <span className={styles.chatRole}>// GUNNY-LITE</span>
            <span className={styles.chatText}>{GREETING}</span>
          </div>

          {messages.map((m, i) => (
            <div
              key={i}
              className={`${styles.chatMsg} ${
                m.role === 'user' ? styles.chatMsgUser : styles.chatMsgBot
              }`}
            >
              <span className={styles.chatRole}>
                {m.role === 'user' ? '> YOU' : '// GUNNY-LITE'}
              </span>
              <span className={styles.chatText}>{m.content}</span>
            </div>
          ))}

          {loading && (
            <div className={`${styles.chatMsg} ${styles.chatMsgBot}`}>
              <span className={styles.chatRole}>// GUNNY-LITE</span>
              <span className={styles.chatText}>
                <span className={styles.chatTyping}>processing...</span>
              </span>
            </div>
          )}
        </div>

        {limitReached ? (
          <a
            className={styles.chatLimitCta}
            href={IG_DM_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            DM @gunnyai_fit for the rest →
          </a>
        ) : (
          <form className={styles.chatInputRow} onSubmit={send}>
            <input
              type="text"
              maxLength={800}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={styles.chatInput}
              placeholder="Ask anything..."
              disabled={loading}
              aria-label="Ask Gunny-Lite a question"
            />
            <button
              type="submit"
              className={styles.chatSendBtn}
              disabled={loading || !input.trim()}
            >
              {loading ? '...' : 'SEND →'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
