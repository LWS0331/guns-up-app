// GUNS UP — Text-to-Speech utility
// Uses OpenAI TTS API with fallback to browser speechSynthesis
// Voices: onyx (deep male), nova (clear female), echo (warm male), fable (british), shimmer (soft female), alloy (neutral)

import { getAuthToken } from './authClient';

let audioQueue: HTMLAudioElement[] = [];
let isPlaying = false;
let audioContextUnlocked = false;
let browserVoicesLoaded = false;

// Reference to the Audio element currently playing. Needed because
// `new Audio(url)` elements aren't attached to the DOM, so
// document.querySelectorAll('audio') can't find them. Without this
// reference, stopSpeaking() can only flush the queue — the in-flight
// audio plays to completion. Tracked here so a real stop is possible.
let currentAudio: HTMLAudioElement | null = null;

export type GunnyVoice = 'onyx' | 'nova' | 'echo' | 'fable' | 'shimmer' | 'alloy';

export const VOICE_OPTIONS: { id: GunnyVoice; label: string; desc: string }[] = [
  { id: 'onyx', label: 'ONYX', desc: 'Deep male — drill sergeant' },
  { id: 'echo', label: 'ECHO', desc: 'Warm male — coach' },
  { id: 'fable', label: 'FABLE', desc: 'British male — officer' },
  { id: 'alloy', label: 'ALLOY', desc: 'Neutral — tactical' },
  { id: 'nova', label: 'NOVA', desc: 'Clear female — operator' },
  { id: 'shimmer', label: 'SHIMMER', desc: 'Soft female — medic' },
];

// ═════════════════════════════════════════════════════════════════════
// GLOBAL TTS ENABLED/DISABLED GATE
// ═════════════════════════════════════════════════════════════════════
// One switch controls speech for the entire app — Gunny chat, Gunny panel,
// workout-mode voice feedback (rest-timer countdowns, set logged, workout
// complete), Tactical Radio, etc. The intent is a hands-free experience
// during workouts, gated by a single mute button the user can trust.
//
// Default: enabled. Device-scoped (not per-operator), since muting is almost
// always about the physical environment (in public, phone on speaker, etc.),
// not the user identity.
const TTS_ENABLED_KEY = 'guns-up-tts-enabled';
const TTS_ENABLED_CHANGED_EVENT = 'guns-up-tts-enabled:changed';

export function isTtsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(TTS_ENABLED_KEY);
  // Treat unset as enabled so existing users don't regress.
  if (v === null) return true;
  return v === 'true';
}

export function setTtsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TTS_ENABLED_KEY, String(enabled));
  } catch (err) {
    console.warn('[tts] could not persist enabled state:', err);
  }
  // Cancel any queued speech immediately when muting so the user doesn't
  // hear Gunny keep talking for several seconds after tapping mute.
  if (!enabled) stopSpeaking();
  // Broadcast so components that render a toggle UI can resync without
  // each one having to poll localStorage.
  try {
    window.dispatchEvent(new CustomEvent(TTS_ENABLED_CHANGED_EVENT, { detail: enabled }));
  } catch { /* dispatchEvent may throw in very old browsers */ }
}

/** Subscribe to TTS enable/disable changes. Returns an unsubscribe function. */
export function onTtsEnabledChange(cb: (enabled: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail);
  window.addEventListener(TTS_ENABLED_CHANGED_EVENT, handler);
  return () => window.removeEventListener(TTS_ENABLED_CHANGED_EVENT, handler);
}

// Get/set preferred voice from localStorage
export function getPreferredVoice(): GunnyVoice {
  if (typeof window === 'undefined') return 'onyx';
  return (localStorage.getItem('gunny-voice') as GunnyVoice) || 'onyx';
}

export function setPreferredVoice(voice: GunnyVoice) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gunny-voice', voice);
  }
}

// Pre-warm audio context — call on a user gesture (e.g., START workout button,
// any SEND tap, first PTT press). iOS requires a user-initiated play() to
// unlock the audio context so subsequent TTS can fire without a fresh gesture.
export function unlockAudioContext() {
  if (audioContextUnlocked) return;
  if (typeof window === 'undefined') return;
  try {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    audio.volume = 0.01;
    const p = audio.play();
    if (p) p.then(() => { audio.pause(); audioContextUnlocked = true; }).catch(() => { /* still blocked — next user gesture will retry */ });
  } catch {
    // Ignore — we tried
  }
  // Also warm browser speechSynthesis voices. Safari/Chrome load voices
  // asynchronously and getVoices() returns [] until voiceschanged fires —
  // without warming, the first browserSpeak() call can silently use the wrong
  // voice or no voice at all.
  if (!browserVoicesLoaded && 'speechSynthesis' in window) {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      browserVoicesLoaded = true;
    } else {
      window.speechSynthesis.addEventListener(
        'voiceschanged',
        () => { browserVoicesLoaded = true; },
        { once: true },
      );
    }
  }
}

// Callbacks for when audio queue finishes (used by voice comms to restart mic)
let onQueueEmptyCallbacks: (() => void)[] = [];

export function onSpeechDone(cb: () => void) {
  onQueueEmptyCallbacks.push(cb);
}

export function offSpeechDone(cb: () => void) {
  onQueueEmptyCallbacks = onQueueEmptyCallbacks.filter(c => c !== cb);
}

// Play next audio in queue
function playNext() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    currentAudio = null;
    onQueueEmptyCallbacks.forEach(cb => { try { cb(); } catch (err) { console.warn('[tts] queue-empty callback threw:', err); } });
    return;
  }
  isPlaying = true;
  const audio = audioQueue.shift()!;
  currentAudio = audio;
  audio.onended = () => playNext();
  audio.onerror = () => {
    console.warn('[tts] audio element errored — skipping to next in queue');
    playNext();
  };
  audio.play()
    .then(() => { audioContextUnlocked = true; })
    .catch((err) => {
      // Likely iOS autoplay block with no prior user gesture. Log so it's
      // findable in devtools rather than silently skipping.
      console.warn('[tts] audio.play() rejected — autoplay blocked?', err);
      playNext();
    });
}

// Speak text using OpenAI TTS (with browser fallback)
export async function speak(text: string, voice?: GunnyVoice) {
  if (!text || typeof window === 'undefined') return;
  if (!isTtsEnabled()) return;

  const selectedVoice = voice || getPreferredVoice();

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ text, voice: selectedVoice, speed: 1.1 }),
    });

    // Check if we got audio back (not a JSON fallback response)
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('audio')) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);

      audioQueue.push(audio);
      if (!isPlaying) playNext();
      return;
    }

    // Server returned JSON — likely fallback=true (OPENAI_API_KEY missing or
    // upstream error). Try to surface a useful dev warning before falling
    // back to browser TTS.
    try {
      const body = await res.json();
      if (body?.fallback) {
        console.info('[tts] /api/tts returned fallback — using browser speechSynthesis');
      } else if (!res.ok) {
        console.warn('[tts] /api/tts returned', res.status, body);
      }
    } catch { /* ignore parse errors */ }

    browserSpeak(text, selectedVoice);
  } catch (err) {
    console.warn('[tts] network error hitting /api/tts — falling back to browser TTS:', err);
    browserSpeak(text, selectedVoice);
  }
}

// Browser speechSynthesis fallback.
//
// Two known engine bugs to work around:
//
//   1. Chrome and Safari cut long utterances off at ~10-15 seconds.
//      Workaround: every 10 seconds while .speaking is true, call
//      pause() then resume() — that resets the engine's internal
//      kill-switch. See chromium issue #679437.
//
//   2. Aggressive truncation at 200 chars (the old default) felt
//      like a "cut off" because a typical Gunny response runs
//      400-800 chars even after stripping markdown. Bumped to 1200
//      chars; speech rate 1.1 means that's ~85 seconds of speech,
//      well past the keep-alive horizon.
function browserSpeak(text: string, voice: GunnyVoice) {
  if (!window.speechSynthesis) return;
  if (!isTtsEnabled()) return;

  const clean = text
    .replace(/^\|.*\|$/gm, '')                  // markdown table rows
    .replace(/^[\s|:\-]+$/gm, '')               // table dividers
    .replace(/[*_#━═\-]{2,}/g, '')              // bold/heading/rule
    .replace(/`+/g, '')                         // inline code
    .replace(/```[\s\S]*?```/g, '')             // fenced code blocks
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const short = clean.length > 1200 ? clean.slice(0, 1200) + '…' : clean;
  const utterance = new SpeechSynthesisUtterance(short);
  utterance.rate = 1.1;
  utterance.pitch = (voice === 'onyx' || voice === 'echo' || voice === 'fable') ? 0.85 : 1.0;
  utterance.volume = 0.9;

  // Keep-alive against Chrome / Safari's long-utterance cutoff.
  // pause() + resume() every 10 seconds resets the engine's
  // internal timeout. Cleared on end / error so we don't leak
  // intervals.
  let keepAlive: number | null = null;
  const startKeepAlive = () => {
    if (keepAlive !== null) return;
    keepAlive = window.setInterval(() => {
      const synth = window.speechSynthesis;
      if (!synth) return;
      if (synth.speaking) {
        synth.pause();
        synth.resume();
      } else {
        if (keepAlive !== null) {
          window.clearInterval(keepAlive);
          keepAlive = null;
        }
      }
    }, 10_000);
  };
  const stopKeepAlive = () => {
    if (keepAlive !== null) {
      window.clearInterval(keepAlive);
      keepAlive = null;
    }
  };
  utterance.onstart = startKeepAlive;
  utterance.onerror = stopKeepAlive;

  // Defer until voices load. Without this, Safari picks a wrong-language
  // default or silently drops the utterance on first call.
  const pickVoiceAndSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    if (voice === 'onyx' || voice === 'echo' || voice === 'fable') {
      const preferred = voices.find(v =>
        v.name.includes('Daniel') || v.name.includes('Alex') || v.name.includes('Google US English')
      );
      if (preferred) utterance.voice = preferred;
    } else {
      const preferred = voices.find(v =>
        v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Google UK English Female')
      );
      if (preferred) utterance.voice = preferred;
    }

    utterance.onend = () => {
      stopKeepAlive();
      if (audioQueue.length === 0) {
        isPlaying = false;
        onQueueEmptyCallbacks.forEach(cb => { try { cb(); } catch (err) { console.warn('[tts] queue-empty callback threw:', err); } });
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0 || browserVoicesLoaded) {
    pickVoiceAndSpeak();
  } else {
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => { browserVoicesLoaded = true; pickVoiceAndSpeak(); },
      { once: true },
    );
    // Some browsers never fire voiceschanged if getVoices already returned
    // non-empty later — retry after a short delay as a safety net.
    setTimeout(() => {
      if (!browserVoicesLoaded && window.speechSynthesis.getVoices().length > 0) {
        browserVoicesLoaded = true;
        pickVoiceAndSpeak();
      }
    }, 250);
  }
}

// Stop all speech immediately. Empties the queue, pauses the
// currently-playing Audio (the one tracked at currentAudio — DOM
// querySelector doesn't find it because new Audio(url) elements
// are detached), and cancels any browser-TTS utterance.
//
// Fires the onSpeechDone callbacks so subscribers (per-message
// HEAR IT buttons in the UI) can flip their state.
export function stopSpeaking() {
  audioQueue = [];
  isPlaying = false;
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch { /* element may have errored already */ }
    // Detach the onended handler so playNext() doesn't get called
    // by the pause-induced end event.
    currentAudio.onended = null;
    currentAudio = null;
  }
  if (typeof window !== 'undefined') {
    // Defensive sweep for any audio elements that DID end up in
    // the DOM (other code paths may attach them).
    document.querySelectorAll('audio').forEach(a => { a.pause(); a.currentTime = 0; });
    window.speechSynthesis?.cancel();
  }
  // Notify subscribers — same callbacks used when the queue empties
  // naturally. Lets the UI's HEAR IT button flip back from STOP.
  onQueueEmptyCallbacks.forEach(cb => {
    try { cb(); } catch (err) { console.warn('[tts] queue-empty callback threw:', err); }
  });
}
