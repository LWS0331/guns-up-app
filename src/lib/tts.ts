// GUNS UP — Text-to-Speech utility
// Uses OpenAI TTS API with fallback to browser speechSynthesis
// Voices: onyx (deep male), nova (clear female), echo (warm male), fable (british), shimmer (soft female), alloy (neutral)

let audioQueue: HTMLAudioElement[] = [];
let isPlaying = false;
let audioContextUnlocked = false;

export type GunnyVoice = 'onyx' | 'nova' | 'echo' | 'fable' | 'shimmer' | 'alloy';

export const VOICE_OPTIONS: { id: GunnyVoice; label: string; desc: string }[] = [
  { id: 'onyx', label: 'ONYX', desc: 'Deep male — drill sergeant' },
  { id: 'echo', label: 'ECHO', desc: 'Warm male — coach' },
  { id: 'fable', label: 'FABLE', desc: 'British male — officer' },
  { id: 'alloy', label: 'ALLOY', desc: 'Neutral — tactical' },
  { id: 'nova', label: 'NOVA', desc: 'Clear female — operator' },
  { id: 'shimmer', label: 'SHIMMER', desc: 'Soft female — medic' },
];

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

// Pre-warm audio context — call on a user gesture (e.g., START workout button)
// iOS requires a user-initiated play() to unlock the audio context
export function unlockAudioContext() {
  if (audioContextUnlocked) return;
  try {
    const audio = new Audio();
    // Create a tiny silent audio data URI
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    audio.volume = 0.01;
    const p = audio.play();
    if (p) p.then(() => { audio.pause(); audioContextUnlocked = true; }).catch(() => {});
  } catch {
    // Ignore — we tried
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
    // Notify listeners that all speech is done
    onQueueEmptyCallbacks.forEach(cb => { try { cb(); } catch {} });
    return;
  }
  isPlaying = true;
  const audio = audioQueue.shift()!;
  audio.onended = () => playNext();
  audio.onerror = () => playNext();
  audio.play().catch(() => {
    // If play fails (iOS autoplay block), try browser TTS fallback
    playNext();
  });
}

// Speak text using OpenAI TTS (with browser fallback)
export async function speak(text: string, voice?: GunnyVoice) {
  if (!text || typeof window === 'undefined') return;

  const selectedVoice = voice || getPreferredVoice();

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': typeof localStorage !== 'undefined'
          ? `Bearer ${localStorage.getItem('authToken') || ''}`
          : '',
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

    // Fallback to browser TTS
    browserSpeak(text, selectedVoice);
  } catch {
    // Network error — fallback to browser TTS
    browserSpeak(text, selectedVoice);
  }
}

// Browser speechSynthesis fallback
function browserSpeak(text: string, voice: GunnyVoice) {
  if (!window.speechSynthesis) return;

  const clean = text
    .replace(/[*_#━═\-]{2,}/g, '')
    .replace(/\n+/g, '. ')
    .trim();

  const short = clean.length > 200 ? clean.slice(0, 200) + '...' : clean;
  const utterance = new SpeechSynthesisUtterance(short);
  utterance.rate = 1.1;
  utterance.pitch = (voice === 'onyx' || voice === 'echo' || voice === 'fable') ? 0.85 : 1.0;
  utterance.volume = 0.9;

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
    if (audioQueue.length === 0) {
      isPlaying = false;
      onQueueEmptyCallbacks.forEach(cb => { try { cb(); } catch {} });
    }
  };
  window.speechSynthesis.speak(utterance);
}

// Stop all speech
export function stopSpeaking() {
  audioQueue = [];
  isPlaying = false;
  if (typeof window !== 'undefined') {
    // Stop any playing audio elements
    document.querySelectorAll('audio').forEach(a => { a.pause(); a.currentTime = 0; });
    // Stop browser TTS
    window.speechSynthesis?.cancel();
  }
}
