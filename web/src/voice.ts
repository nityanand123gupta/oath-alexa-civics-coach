/** Web Speech API wrappers (Chrome). Degrades gracefully to text input. */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

export function sttSupported(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createRecognizer(onFinal: (text: string) => void, onState: (listening: boolean) => void, onError: (msg: string) => void) {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  let active = false;
  rec.onresult = (e) => {
    const last = e.results[e.results.length - 1];
    const transcript = last?.[0]?.transcript?.trim();
    if (transcript) onFinal(transcript);
  };
  rec.onend = () => {
    active = false;
    onState(false);
  };
  rec.onerror = (e) => {
    active = false;
    onState(false);
    if (e.error !== "no-speech" && e.error !== "aborted") onError(e.error);
  };
  return {
    start() {
      if (active) return;
      try {
        stopSpeaking(); // barge-in
        rec.start();
        active = true;
        onState(true);
      } catch {
        /* already started */
      }
    },
    stop() {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    },
  };
}

let preferredVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (preferredVoice) return preferredVoice;
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  preferredVoice =
    voices.find((v) => v.name.includes("Aria")) ??
    voices.find((v) => v.name.includes("Jenny")) ??
    voices.find((v) => v.lang === "en-US" && v.name.toLowerCase().includes("female")) ??
    voices.find((v) => v.lang === "en-US") ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null;
  return preferredVoice;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => pickVoice();
}

export function speak(text: string, onDone?: () => void, onStart?: () => void): void {
  if (!window.speechSynthesis) {
    onDone?.();
    return;
  }
  stopSpeaking();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  utter.rate = 1.04;
  utter.pitch = 1.0;
  utter.onstart = () => onStart?.();
  utter.onend = () => onDone?.();
  utter.onerror = () => onDone?.();
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}
