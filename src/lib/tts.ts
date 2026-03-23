// GUNS UP — Text-to-Speech utility
// Uses OpenAI TTS API with fallback to browser speechSynthesis
// Voices: "onyx" (male, deep, authoritative) | "nova" (female, clear, confident)

let audioQueue: HTMLAudioElement[] = [];
let isPlaying = false;

export type GunnyVoice = 'onyx' | 'nova';

// Play next audio in queue
function playNext() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    return;
  }
  isPlaying = true;
  const audio = audioQueue.shift()!;
  audio.onended = () => playNext();
  audio.onerror = () => playNext();
  audio.play().catch(() => playNext());
}

// Speak text using OpenAI TTS (with browser fallback)
export async function speak(text: string, voice: GunnyVoice = 'onyx') {
  if (!text || typeof window === 'undefined') return;

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, speed: 1.1 }),
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
    browserSpeak(text, voice);
  } catch {
    // Network error — fallback to browser TTS
    browserSpeak(text, voice);
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
  utterance.pitch = voice === 'onyx' ? 0.85 : 1.0;
  utterance.volume = 0.9;

  const voices = window.speechSynthesis.getVoices();
  if (voice === 'onyx') {
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
