import { useState, useRef, useCallback, useEffect } from 'react';
import { LanguageCode } from '../types';
import { speakText, stopSpeaking as stopServiceSpeaking } from '../services/textToSpeech';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

// Minimal SpeechRecognition type definitions (not fully in TS DOM lib)
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionConstructor = new () => ISpeechRecognition;

// Map language codes to BCP-47 tags for Web Speech API
const LANG_TO_BCP47: Record<string, string> = {
  'hi': 'hi-IN',
  'hi-Latn': 'hi-IN',
  'en': 'en-IN',
  'pa': 'pa-IN',
  'bn': 'bn-IN',
  'mr': 'mr-IN',
  'gu': 'gu-IN',
  'ta': 'ta-IN',
  'te': 'te-IN',
  'kn': 'kn-IN',
  'ml': 'ml-IN',
  'or': 'or-IN',
  'ur': 'ur-IN',
  'as': 'as-IN',
};

function cleanMarkdownForSpeech(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/^\s*\d+\.\s/gm, '')
    .replace(/>{1,}\s/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getSpeechRecognitionClass(): SpeechRecognitionConstructor | null {
  const w = window as unknown as Record<string, unknown>;
  return (w['SpeechRecognition'] as SpeechRecognitionConstructor) ||
    (w['webkitSpeechRecognition'] as SpeechRecognitionConstructor) ||
    null;
}

function getBestVoice(langCode: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const bcp47 = LANG_TO_BCP47[langCode] || 'en-IN';
  const langPrefix = bcp47.split('-')[0];
  return voices.find(v => v.lang === bcp47)
    || voices.find(v => v.lang.startsWith(langPrefix))
    || voices.find(v => v.lang === 'en-IN')
    || voices.find(v => v.lang.startsWith('en'))
    || null;
}

export function useVoice() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isTTSSupported, setIsTTSSupported] = useState(false);
  const [isSTTSupported, setIsSTTSupported] = useState(false);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsSTTSupported(!!getSpeechRecognitionClass());
    setIsTTSSupported('speechSynthesis' in window);
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  const startListening = useCallback((language: LanguageCode = 'auto') => {
    const Ctor = getSpeechRecognitionClass();
    if (!Ctor) {
      setVoiceState('error');
      setErrorMessage('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setTranscript('');
    setErrorMessage('');

    const recognition = new Ctor();
    recognitionRef.current = recognition;

    const bcp47 = language !== 'auto' ? (LANG_TO_BCP47[language] || 'hi-IN') : 'hi-IN';
    recognition.lang = bcp47;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onstart = () => setVoiceState('listening');

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let combined = '';
      for (let i = 0; i < event.results.length; i++) {
        combined += event.results[i][0].transcript + ' ';
      }
      const text = combined.trim();
      setTranscript(text);

      if (text) {
        // Reset 3-second silence confirmation timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          console.log('[useVoice] 3-second silence watchdog confirmed. Stopping listening.');
          setVoiceState('processing');
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
        }, 3000);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setVoiceState('error');
      if (event.error === 'not-allowed') {
        setErrorMessage('Microphone permission denied. Please allow microphone access in browser settings.');
      } else if (event.error === 'no-speech') {
        setErrorMessage('No speech detected. Please try again.');
      } else {
        setErrorMessage(`Voice recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setVoiceState(prev => prev === 'listening' ? 'idle' : prev);
    };

    try {
      recognition.start();
    } catch {
      setVoiceState('error');
      setErrorMessage('Failed to start voice recognition.');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setVoiceState('idle');
  }, []);

  const speak = useCallback((text: string, langCode: LanguageCode = 'en') => {
    speakText(text, langCode, {
      onStart: () => setVoiceState('speaking'),
      onEnd: () => setVoiceState('idle'),
      onError: () => setVoiceState('idle'),
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    stopServiceSpeaking();
    setVoiceState('idle');
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setVoiceState('idle');
    setErrorMessage('');
  }, []);

  return {
    voiceState,
    transcript,
    errorMessage,
    isTTSSupported,
    isSTTSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    resetTranscript,
  };
}
