import { LanguageCode } from '../types';

export const LANGUAGE_BCP47_MAP: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  'hi-Latn': 'en-IN',
  pa: 'pa-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  or: 'or-IN',
  as: 'as-IN',
  ur: 'ur-IN',
};

// Known female voice identifiers across Windows SAPI/OneCore, Chrome, Edge, Android, iOS
const FEMALE_INDICATORS = [
  'female', 'woman', 'girl', 'femme', 'donna',
  'zira', 'swara', 'kalpana', 'heera', 'neerja', 'ananya', 'priya',
  'kavya', 'sapna', 'shruti', 'sunita', 'veena', 'vani', 'pallavi',
  'lekha', 'aditi', 'geeta', 'sita', 'radha', 'meera', 'maya'
];

const MALE_INDICATORS = [
  'male', 'david', 'mark', 'george', 'rishi', 'madhav', 'valluvar',
  'ravi', 'ajay', 'man', 'boy', 'guy'
];

function isLikelyFemale(voice: SpeechSynthesisVoice): boolean {
  const name = voice.name.toLowerCase();
  for (const f of FEMALE_INDICATORS) {
    if (name.includes(f)) return true;
  }
  for (const m of MALE_INDICATORS) {
    if (name.includes(m)) return false;
  }
  // If voice contains Microsoft or Google and doesn't match male, many regional ones default female
  return false;
}

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;
let activeUtterance: SpeechSynthesisUtterance | null = null;

export function initVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return resolve([]);
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      voicesLoaded = true;
      return resolve(voices);
    }

    window.speechSynthesis.onvoiceschanged = () => {
      const v = window.speechSynthesis.getVoices();
      cachedVoices = v;
      voicesLoaded = true;
      resolve(v);
    };

    // Safety timeout
    setTimeout(() => {
      cachedVoices = window.speechSynthesis.getVoices();
      voicesLoaded = true;
      resolve(cachedVoices);
    }, 800);
  });
}

// Ensure voices are loaded on file import
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  initVoices();
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  if (cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  return cachedVoices;
}

/**
 * Finds the best available voice with priority:
 * 1. Exact language + Indian locale + female voice
 * 2. Exact language + female voice
 * 3. Exact Indian locale voice
 * 4. Exact language voice (any)
 * 5. Closest regional voice
 */
const LANG_NAME_KEYWORDS: Record<string, string[]> = {
  hi: ['hindi', 'हिन्दी', 'हिंदी', 'kalpana', 'hemant', 'swara'],
  pa: ['punjabi', 'panjabi', 'ਪੰਜਾਬੀ', 'ਗੁਰਮੁਖੀ', 'gurmukhi', 'पंजाबी'],
  bn: ['bengali', 'bangla', 'বাংলা', 'बंगाली', 'tapan', 'bashkar'],
  mr: ['marathi', 'मराठी', 'madhav', 'aarohi'],
  gu: ['gujarati', 'ગુજરાતી', 'गुजराती', 'dhwani', 'niranjan'],
  ta: ['tamil', 'தமிழ்', 'तमिल', 'valluvar', 'pallavi'],
  te: ['telugu', 'తెలుగు', 'तेलुगु', 'mohan', 'chitra'],
  kn: ['kannada', 'ಕನ್ನಡ', 'कन्नड़', 'sapna', 'gagan'],
  ml: ['malayalam', 'മലയാളം', 'मलयालम', 'midhun', 'sobhana'],
  or: ['odia', 'oriya', 'ଓଡ଼ିଆ', 'उड़िया', 'sandeep'],
  as: ['assamese', 'অসমীয়া', 'असमिया', 'asomiya'],
  ur: ['urdu', 'اردو', 'उर्दू', 'asif', 'uzma'],
  en: ['en-in', 'indian', 'india', 'neerja', 'heera', 'ravi', 'english'],
};

export function detectBestVoice(languageCode: LanguageCode | string = 'en'): {
  voice: SpeechSynthesisVoice | null;
  bcp47: string;
} {
  const voices = getAvailableVoices();
  const bcp47 = LANGUAGE_BCP47_MAP[languageCode] || 'hi-IN';
  const langPrefix = bcp47.split('-')[0].toLowerCase();

  if (voices.length === 0) {
    return { voice: null, bcp47 };
  }

  // 1. Matches exact BCP-47 tag (e.g. "hi-IN", "pa-IN", "ta-IN", "gu-IN")
  const exactLocaleVoices = voices.filter(v => v.lang.replace('_', '-').toLowerCase() === bcp47.toLowerCase());

  // 1a. Exact locale + Female
  const exactLocaleFemale = exactLocaleVoices.find(v => isLikelyFemale(v));
  if (exactLocaleFemale) {
    return { voice: exactLocaleFemale, bcp47 };
  }

  // 1b. Exact locale any
  if (exactLocaleVoices.length > 0) {
    return { voice: exactLocaleVoices[0], bcp47 };
  }

  // 2. Matches language prefix (e.g. starts with "hi", "pa", "bn", "ta")
  const langVoices = voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(langPrefix));

  // 2a. Language prefix + Female
  const langFemale = langVoices.find(v => isLikelyFemale(v));
  if (langFemale) {
    return { voice: langFemale, bcp47 };
  }

  // 2b. Language prefix any
  if (langVoices.length > 0) {
    return { voice: langVoices[0], bcp47 };
  }

  // 3. For Indian languages, check if voice name contains language name or native script (e.g. "Google हिन्दी", "Google தமிழ்", "Google ਪੰਜਾਬੀ")
  const keywords = LANG_NAME_KEYWORDS[langPrefix] || [];
  for (const kw of keywords) {
    const namedVoice = voices.find(v => v.name.toLowerCase().includes(kw.toLowerCase()));
    if (namedVoice) {
      return { voice: namedVoice, bcp47 };
    }
  }

  // 4. If language is English, prefer Indian English voice
  if (langPrefix === 'en') {
    const enInFemale = voices.find(v => v.lang.toLowerCase().includes('en-in') && isLikelyFemale(v));
    if (enInFemale) return { voice: enInFemale, bcp47: 'en-IN' };

    const enInAny = voices.find(v => v.lang.toLowerCase().includes('en-in'));
    if (enInAny) return { voice: enInAny, bcp47: 'en-IN' };

    const enFemale = voices.find(v => v.lang.toLowerCase().startsWith('en') && isLikelyFemale(v));
    if (enFemale) return { voice: enFemale, bcp47: 'en-US' };
  }

  // 5. Intelligent Indian Regional Fallback:
  // For Marathi ('mr'), since it shares the Devanagari script, the Indian Hindi voice can read it well if no Marathi voice exists.
  if (langPrefix === 'mr') {
    const indianVoice = voices.find(v => v.lang.toLowerCase().startsWith('hi') || v.name.toLowerCase().includes('hindi') || v.name.includes('हिन्दी'));
    if (indianVoice) {
      return { voice: indianVoice, bcp47: 'mr-IN' };
    }
  }

  // For Hinglish or Indian English, use the Indian English voice
  if (languageCode === 'hi-Latn' || langPrefix === 'en') {
    const indianEnVoice = voices.find(v => v.lang.toLowerCase().includes('en-in') || v.name.toLowerCase().includes('india'));
    if (indianEnVoice) {
      return { voice: indianEnVoice, bcp47: 'en-IN' };
    }
  }

  // For other distinct regional scripts (Punjabi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Odia, Assamese, Urdu):
  // Never force a Devanagari Hindi voice onto them, as the Hindi engine cannot parse non-Devanagari alphabets and chokes.
  // Returning voice: null allows the browser/OS speech synthesizer to pick its native system/online engine for the bcp47 tag.
  return { voice: null, bcp47 };
}

/**
 * Clean markdown symbols, raw URLs, and UI tokens into natural human speech.
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';

  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown headers (#, ##, ###, etc.)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold and italics (**text**, *text*, __text__, _text_)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Convert markdown links [title](url) to title
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Clean raw URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    // Convert bullet lists into distinct sentence pauses
    .replace(/^\s*[-*+]\s+/gm, '. ')
    // Convert numbered lists into natural speech pauses
    .replace(/^\s*\d+\.\s+/gm, '. ')
    // Remove markdown blockquotes
    .replace(/^\s*>\s*/gm, '')
    // Remove table lines and vertical pipes
    .replace(/\|/g, ', ')
    // Remove emojis & UI symbols
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[📚🤖🌾✅⚠️🔊⏹⭐🎯💡📌]/g, '')
    // Replace multiple periods, newlines, and spaces
    .replace(/\.{2,}/g, '.')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

type SpeechListener = (id: string | null) => void;
const speechListeners = new Set<SpeechListener>();
let currentSpeakingId: string | null = null;

export function subscribeSpeech(listener: SpeechListener): () => void {
  speechListeners.add(listener);
  listener(currentSpeakingId);
  return () => {
    speechListeners.delete(listener);
  };
}

let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

function startKeepAlive(): void {
  stopKeepAlive();
  keepAliveTimer = setInterval(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        stopKeepAlive();
      }
    }
  }, 8000);
}

function stopKeepAlive(): void {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

export function getCurrentSpeakingId(): string | null {
  return currentSpeakingId;
}

export function stopSpeaking(): void {
  stopKeepAlive();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
    activeUtterance = null;
    currentSpeakingId = null;
    speechListeners.forEach(l => l(null));
  }
  // Immediately dispatch event to stop any other active WebAudio or Gemini Live audio players
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('sahkar-stop-all-audio'));
    } catch {}
  }
}

export function isSpeaking(): boolean {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return window.speechSynthesis.speaking;
  }
  return false;
}

/**
 * Speaks text using the matching language and preferred female voice.
 */
export function speakText(
  rawText: string,
  languageCode: LanguageCode | string = 'en',
  options: SpeakOptions = {},
  utteranceId?: string
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('[TTS] SpeechSynthesis not supported in this environment.');
    return null;
  }

  // 1. Always stop previous utterance and any background audio first
  stopSpeaking();

  const cleanText = cleanTextForSpeech(rawText);
  if (!cleanText) return null;

  // 2. Detect best voice & BCP-47 tag
  const { voice, bcp47 } = detectBestVoice(languageCode);

  const utterance = new SpeechSynthesisUtterance(cleanText);
  // Match utterance.lang to the voice's lang if available to prevent browser cancellation
  utterance.lang = voice?.lang || bcp47;

  if (voice) {
    utterance.voice = voice;
    console.log(`[TTS] Speaking in ${bcp47} with voice "${voice.name}" (${voice.lang})`);
  } else {
    console.log(`[TTS] Speaking in ${bcp47} using system OS language engine (no specific voice profile)`);
  }

  utterance.rate = options.rate ?? 1.0;
  utterance.pitch = options.pitch ?? 1.0;
  utterance.volume = options.volume ?? 1.0;

  utterance.onstart = () => {
    startKeepAlive();
    if (utteranceId) {
      currentSpeakingId = utteranceId;
      speechListeners.forEach(l => l(utteranceId));
    }
    options.onStart?.();
  };

  utterance.onend = () => {
    stopKeepAlive();
    activeUtterance = null;
    currentSpeakingId = null;
    speechListeners.forEach(l => l(null));
    options.onEnd?.();
  };

  utterance.onerror = (event) => {
    stopKeepAlive();
    activeUtterance = null;
    currentSpeakingId = null;
    speechListeners.forEach(l => l(null));
    // Don't treat manual cancellation as an error
    if (event.error === 'canceled' || event.error === 'interrupted') {
      options.onEnd?.();
      return;
    }
    console.warn('[TTS] SpeechSynthesis error:', event.error);
    options.onError?.(event);
  };

  // Keep a reference to prevent garbage collection bug in Chromium
  activeUtterance = utterance;

  try {
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    stopKeepAlive();
    console.error('[TTS] Failed to execute speak:', err);
    options.onError?.(err);
  }

  return utterance;
}
