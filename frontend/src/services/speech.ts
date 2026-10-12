/**
 * Voice-First Speech Service (TTS & SpeechRecognition) for LINGUA BUDDY AI.
 * Provides honest capability detection, native vs. phonetic fallback voice selection,
 * adjustable speaking speed, and microphone permission handling.
 */

export interface VoiceCapabilityInfo {
  ttsSupported: boolean;
  asrSupported: boolean;
  hasNativeVoiceForLang: boolean;
  matchedVoiceName: string;
  usingPhoneticFallback: boolean;
}

function getSpeechRecognitionConstructor(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function inspectVoiceCapabilities(bcp47: string, speechSupportLevel?: string): VoiceCapabilityInfo {
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const asrSupported = Boolean(getSpeechRecognitionConstructor());

  if (!ttsSupported) {
    return {
      ttsSupported: false,
      asrSupported,
      hasNativeVoiceForLang: false,
      matchedVoiceName: 'Browser TTS Unavailable',
      usingPhoneticFallback: true,
    };
  }

  const voices = window.speechSynthesis.getVoices();
  const langPrefix = bcp47.split('-')[0].toLowerCase();

  const exactVoice = voices.find((v) => v.lang.toLowerCase() === bcp47.toLowerCase());
  const prefixVoice = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
  const matched = exactVoice || prefixVoice;

  const isPhoneticByDesign = speechSupportLevel === 'phonetic-fallback';

  return {
    ttsSupported,
    asrSupported,
    hasNativeVoiceForLang: Boolean(matched) && !isPhoneticByDesign,
    matchedVoiceName: matched ? `${matched.name} (${matched.lang})` : 'Indic / Phonetic Fallback Voice',
    usingPhoneticFallback: !matched || isPhoneticByDesign,
  };
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakPhrase(options: {
  nativeText: string;
  romanizedText: string;
  bcp47: string;
  speed?: number;
  speechSupportLevel?: string;
  onStart?: () => void;
  onEnd?: () => void;
}): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onStart?.();
    setTimeout(() => options.onEnd?.(), 1200);
    return;
  }

  window.speechSynthesis.cancel();

  const voices = window.speechSynthesis.getVoices();
  const langPrefix = options.bcp47.split('-')[0].toLowerCase();
  const exactVoice = voices.find((v) => v.lang.toLowerCase() === options.bcp47.toLowerCase());
  const prefixVoice = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
  const indicFallback =
    voices.find((v) => v.lang.toLowerCase().includes('in')) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en'));

  const chosenVoice = exactVoice || prefixVoice || indicFallback || voices[0];
  const hasNative = Boolean(exactVoice || prefixVoice) && options.speechSupportLevel !== 'phonetic-fallback';

  // If the OS/browser has a genuine voice for this language script, speak nativeText;
  // otherwise speak the clean Romanized pronunciation so it never fails silently!
  const cleanRoman = options.romanizedText.split('/')[0].replace(/\([^)]*\)/g, '').trim();
  const textToSpeak = hasNative && options.nativeText ? options.nativeText : cleanRoman;

  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  if (chosenVoice) {
    utterance.voice = chosenVoice;
    utterance.lang = chosenVoice.lang;
  } else {
    utterance.lang = hasNative ? options.bcp47 : 'en-IN';
  }

  utterance.rate = Math.max(0.5, Math.min(1.5, options.speed ?? 0.95));
  utterance.pitch = 1.05;

  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onEnd?.();

  window.speechSynthesis.speak(utterance);
}

export function startSpeechRecognition(options: {
  bcp47: string;
  preferRomanFallback?: boolean;
  onInterim?: (transcript: string) => void;
  onFinal: (transcript: string) => void;
  onError: (errorMessage: string) => void;
  onEnd?: () => void;
}): () => void {
  const SpeechRecognition = getSpeechRecognitionConstructor();
  if (!SpeechRecognition) {
    options.onError(
      'Speech recognition is not supported in this browser. Please use Chrome/Edge for voice input, or type your pronunciation in the fallback box below.'
    );
    options.onEnd?.();
    return () => {};
  }

  const recognition = new SpeechRecognition();
  // Use en-IN when phonetic fallback is requested so Romanized Indian syllables transcribe reliably
  recognition.lang = options.preferRomanFallback ? 'en-IN' : options.bcp47;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  let finalCaptured = '';

  recognition.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalCaptured += transcript + ' ';
      } else {
        interim += transcript;
      }
    }
    if (interim && options.onInterim) {
      options.onInterim(interim.trim());
    }
    if (finalCaptured.trim()) {
      options.onFinal(finalCaptured.trim());
    }
  };

  recognition.onerror = (event: any) => {
    const code = event?.error || 'unknown';
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      options.onError(
        'Microphone permission was denied. Please allow microphone access in your browser address bar, or use the text input fallback.'
      );
    } else if (code === 'no-speech') {
      options.onError('No speech was detected. Tap the microphone and speak clearly near your mic.');
    } else {
      options.onError(`Speech recognition notice (${code}): You can retry the microphone or use the text fallback.`);
    }
  };

  recognition.onend = () => {
    options.onEnd?.();
  };

  try {
    recognition.start();
  } catch (err: any) {
    options.onError('Could not start microphone recognition. Please check microphone permissions.');
    options.onEnd?.();
  }

  return () => {
    try {
      recognition.stop();
    } catch {
      // ignore
    }
  };
}
