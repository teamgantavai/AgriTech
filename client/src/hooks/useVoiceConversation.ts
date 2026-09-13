import { useState, useRef, useCallback, useEffect } from 'react';
import { LanguageCode, Message } from '../types';
import { streamChatMessage } from '../services/api';
import { speakText, stopSpeaking, LANGUAGE_BCP47_MAP } from '../services/textToSpeech';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'ready' | 'error';

export interface VoiceTranscriptItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  language?: string;
  timestamp: Date;
  suggestions?: string[];
}

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
  message?: string;
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

function getSpeechRecognitionClass(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w['SpeechRecognition'] as SpeechRecognitionConstructor) ||
    (w['webkitSpeechRecognition'] as SpeechRecognitionConstructor) ||
    null
  );
}

const STORAGE_KEY = 'sahkar_sathi_conversations';

function appendToLocalStorageChat(userText: string, assistantText: string, assistantLang?: LanguageCode) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const convs = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const userMsg: Message = {
      id: Date.now().toString(36) + 'u',
      role: 'user',
      content: userText,
      timestamp: now,
    };
    const botMsg: Message = {
      id: Date.now().toString(36) + 'b',
      role: 'assistant',
      content: assistantText,
      language: assistantLang,
      timestamp: now,
      sourceType: 'knowledge_base_and_ai',
    };

    if (convs.length > 0 && convs[0].title.startsWith('🎙')) {
      convs[0].messages.push(userMsg, botMsg);
      convs[0].updatedAt = now;
    } else {
      const newConv = {
        id: Date.now().toString(36),
        title: `🎙 Voice: ${userText.slice(0, 30)}${userText.length > 30 ? '…' : ''}`,
        createdAt: now,
        updatedAt: now,
        messages: [userMsg, botMsg],
      };
      convs.unshift(newConv);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch (err) {
    console.warn('[Voice] Failed to append to localStorage chat:', err);
  }
}

// Regex to extract complete sentences from streaming text (supports Latin & Indic scripts)
function extractNextSentence(buffer: string): { sentence: string; rest: string } | null {
  // Matches sentence ending with ., ?, !, newline, or Hindi purna viram (।) followed by whitespace or boundary
  const match = buffer.match(/^([\s\S]+?[.?!।\n]+)([\s\S]*)$/);
  if (match && match[1].trim().length > 3) {
    return {
      sentence: match[1].trim(),
      rest: match[2].trimStart(),
    };
  }
  return null;
}

export function useVoiceConversation(initialLanguage: LanguageCode = 'auto', isActive: boolean = false) {
  const [state, setState] = useState<VoiceState>('idle');
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(initialLanguage);
  const [transcripts, setTranscripts] = useState<VoiceTranscriptItem[]>([]);
  const [interimUserText, setInterimUserText] = useState('');
  const [currentAssistantText, setCurrentAssistantText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  // Gemini history array for multi-turn context
  const geminiHistoryRef = useRef<Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>>([]);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const isActiveRef = useRef(isActive);
  const currentLanguageRef = useRef(currentLanguage);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRetryCountRef = useRef(0);

  // Latency and VAD timing refs
  const speechDetectedRef = useRef(false);
  const vadStartMsRef = useRef<number>(0);
  const vadEndMsRef = useRef<number>(0);
  const currentInterimRef = useRef<string>('');

  // Streaming & TTS pipelining refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const ttsSentenceQueueRef = useRef<string[]>([]);
  const isTtsSpeakingRef = useRef<boolean>(false);
  const firstTokenLoggedRef = useRef<boolean>(false);
  const firstPlaybackLoggedRef = useRef<boolean>(false);

  // Keep refs in sync
  isActiveRef.current = isActive;
  currentLanguageRef.current = currentLanguage;

  // Check Web Speech API support
  useEffect(() => {
    const Ctor = getSpeechRecognitionClass();
    if (!Ctor) {
      setIsSupported(false);
      setErrorMessage('Voice recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
    }
  }, []);

  // Update language if initialLanguage changes
  useEffect(() => {
    if (initialLanguage && initialLanguage !== 'auto') {
      setCurrentLanguage(initialLanguage);
    }
  }, [initialLanguage]);

  // Clean up on unmount or when modal closes
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  // Safe helper to stop microphone recognition
  const stopRecognition = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    isListeningRef.current = false;
    speechDetectedRef.current = false;
  }, []);

  // Play next queued sentence in the TTS pipeline
  const playNextTtsSentence = useCallback((detectedLang: string, onCompleteAll: () => void) => {
    if (ttsSentenceQueueRef.current.length === 0) {
      isTtsSpeakingRef.current = false;
      onCompleteAll();
      return;
    }

    isTtsSpeakingRef.current = true;
    const sentence = ttsSentenceQueueRef.current.shift()!;

    if (!firstPlaybackLoggedRef.current) {
      console.log(`⏱️ [TTS START] Commencing speech synthesis for first sentence at +${(performance.now() - vadEndMsRef.current).toFixed(1)}ms`);
    }

    speakText(sentence, detectedLang, {
      rate: 1.02,
      onStart: () => {
        if (!firstPlaybackLoggedRef.current) {
          firstPlaybackLoggedRef.current = true;
          const playbackTime = performance.now();
          const latency = playbackTime - vadEndMsRef.current;
          console.log(`🔊 [AUDIO PLAYBACK START] First TTS audio playback started at +${latency.toFixed(1)}ms`);
          console.log(`🚀 [TOTAL LATENCY] User stopped speaking → AI audio playback: ${latency.toFixed(1)}ms`);
        }
        if (isActiveRef.current) setState('speaking');
      },
      onEnd: () => {
        if (!isActiveRef.current) return;
        playNextTtsSentence(detectedLang, onCompleteAll);
      },
      onError: (err) => {
        console.warn('[Voice] Sentence TTS error:', err);
        if (!isActiveRef.current) return;
        playNextTtsSentence(detectedLang, onCompleteAll);
      },
    });
  }, []);

  // Process user speech with streaming LLM & sentence-pipelined streaming TTS
  const processUserSpeech = useCallback(async (spokenText: string, vadEndTimestamp?: number) => {
    if (!spokenText.trim() || !isActiveRef.current) return;

    const trimmed = spokenText.trim();
    const vadEndMs = vadEndTimestamp || performance.now();
    vadEndMsRef.current = vadEndMs;

    setInterimUserText('');
    setState('processing');
    setErrorMessage(null);

    console.log(`⏱️ [STT START] Finalizing audio transcript at ${vadEndMs.toFixed(1)}ms`);
    console.log(`⏱️ [STT END] Final transcript: "${trimmed}"`);

    // Add user question to transcript
    const userItem: VoiceTranscriptItem = {
      id: Date.now().toString(36) + 'u',
      role: 'user',
      text: trimmed,
      timestamp: new Date(),
    };
    setTranscripts(prev => [...prev, userItem]);

    // Reset streaming state
    firstTokenLoggedRef.current = false;
    firstPlaybackLoggedRef.current = false;
    ttsSentenceQueueRef.current = [];
    isTtsSpeakingRef.current = false;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const forceLang = currentLanguageRef.current !== 'auto' ? currentLanguageRef.current : undefined;
    let accumulatedText = '';
    let sentenceBuffer = '';
    let responseLanguage: LanguageCode = forceLang || 'hi';
    let isStreamDone = false;

    const handleAllSentencesFinished = () => {
      if (!isStreamDone || ttsSentenceQueueRef.current.length > 0) return;
      if (!isActiveRef.current) return;

      setCurrentAssistantText('');
      setState('ready');

      // Auto-restart listening after short 200ms turnaround
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        if (isActiveRef.current) {
          startListening();
        }
      }, 200);
    };

    try {
      await streamChatMessage(
        {
          message: trimmed,
          history: geminiHistoryRef.current.slice(-6),
          forceLanguage: forceLang,
          voiceMode: true,
        },
        {
          signal: abortController.signal,
          onMeta: (meta) => {
            if (meta.language) responseLanguage = meta.language as LanguageCode;
          },
          onChunk: (chunk) => {
            if (!isActiveRef.current) return;

            if (!firstTokenLoggedRef.current) {
              firstTokenLoggedRef.current = true;
              const tokenTime = performance.now();
              console.log(`⏱️ [LLM FIRST TOKEN] Streamed first token at +${(tokenTime - vadEndMs).toFixed(1)}ms`);
            }

            accumulatedText += chunk;
            sentenceBuffer += chunk;
            setCurrentAssistantText(accumulatedText);

            // Check if a full sentence is ready for immediate TTS streaming
            let extracted = extractNextSentence(sentenceBuffer);
            while (extracted) {
              const sentenceToSpeak = extracted.sentence;
              sentenceBuffer = extracted.rest;

              ttsSentenceQueueRef.current.push(sentenceToSpeak);
              if (!isTtsSpeakingRef.current) {
                playNextTtsSentence(responseLanguage, handleAllSentencesFinished);
              }

              extracted = extractNextSentence(sentenceBuffer);
            }
          },
        }
      );

      isStreamDone = true;

      if (!isActiveRef.current) return;

      // Flush any trailing text that didn't end with sentence punctuation
      const remaining = sentenceBuffer.trim();
      if (remaining.length > 0) {
        ttsSentenceQueueRef.current.push(remaining);
        if (!isTtsSpeakingRef.current) {
          playNextTtsSentence(responseLanguage, handleAllSentencesFinished);
        }
      } else if (!isTtsSpeakingRef.current) {
        handleAllSentencesFinished();
      }

      const finalText = accumulatedText.trim() || 'जी, मैं आपकी सहायता के लिए तैयार हूँ।';

      // Update multi-turn history & localStorage
      geminiHistoryRef.current.push(
        { role: 'user', parts: [{ text: trimmed }] },
        { role: 'model', parts: [{ text: finalText }] }
      );
      appendToLocalStorageChat(trimmed, finalText, responseLanguage as LanguageCode);

      const assistantItem: VoiceTranscriptItem = {
        id: Date.now().toString(36) + 'a',
        role: 'assistant',
        text: finalText,
        language: responseLanguage,
        timestamp: new Date(),
      };
      setTranscripts(prev => [...prev, assistantItem]);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[Voice] Streaming was aborted.');
        return;
      }
      console.error('[Voice] Error in streaming chat processing:', err);
      if (!isActiveRef.current) return;
      setState('error');
      setErrorMessage('Failed to connect to Sahkar Sathi. Please check your connection.');
    }
  }, [playNextTtsSentence]);

  // Start continuous listening with active 3-second silence watchdog
  const startListening = useCallback(() => {
    if (!isActiveRef.current) return;

    const Ctor = getSpeechRecognitionClass();
    if (!Ctor) {
      setState('error');
      setErrorMessage('Speech recognition is not supported in this browser.');
      return;
    }

    stopRecognition();
    stopSpeaking();
    ttsSentenceQueueRef.current = [];
    isTtsSpeakingRef.current = false;
    setInterimUserText('');
    setErrorMessage(null);
    speechDetectedRef.current = false;
    currentInterimRef.current = '';

    try {
      const recognition = new Ctor();
      recognitionRef.current = recognition;

      const bcp47 = currentLanguageRef.current !== 'auto'
        ? (LANGUAGE_BCP47_MAP[currentLanguageRef.current] || 'hi-IN')
        : 'hi-IN';

      recognition.lang = bcp47;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = true; // Keep listening continuously for active silence detection

      recognition.onstart = () => {
        isListeningRef.current = true;
        setState('listening');
        autoRetryCountRef.current = 0;
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Fast Barge-In: If user speaks while AI is talking, immediately silence AI and listen!
        if (state === 'speaking' || isTtsSpeakingRef.current) {
          console.log('🛑 [BARGE-IN] User voice detected while AI speaking. Cutting audio immediately.');
          stopSpeaking();
          ttsSentenceQueueRef.current = [];
          isTtsSpeakingRef.current = false;
          if (abortControllerRef.current) abortControllerRef.current.abort();
          setState('listening');
        }

        let combined = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          combined += res[0].transcript + ' ';
        }

        const trimmed = combined.trim();
        if (trimmed.length > 0) {
          currentInterimRef.current = trimmed;
          setInterimUserText(trimmed);

          // User speech start detection
          if (!speechDetectedRef.current) {
            speechDetectedRef.current = true;
            vadStartMsRef.current = performance.now();
            console.log(`🎤 [VAD START] Speech detected at ${vadStartMsRef.current.toFixed(1)}ms: "${trimmed}"`);
          }

          // Reset the 3-SECOND SILENCE WATCHDOG
          // "After the user stops speaking, wait for approximately 3 seconds of silence maximum, then immediately process"
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          silenceTimerRef.current = setTimeout(() => {
            const vadEnd = performance.now();
            console.log(`⏱️ [VAD END] 3-second maximum silence confirmed at ${vadEnd.toFixed(1)}ms. Proceeding to STT.`);

            const capturedText = currentInterimRef.current.trim();
            if (capturedText.length > 0) {
              // Stop recognition cleanly to prevent echo loop during AI answer
              stopRecognition();
              processUserSpeech(capturedText, vadEnd);
            }
          }, 3000);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('[Voice] SpeechRecognition error:', event.error);
        if (!isActiveRef.current) return;

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setState('error');
          setErrorMessage('Microphone access was denied. Please allow microphone permissions in browser settings.');
        } else if (event.error === 'no-speech') {
          if (autoRetryCountRef.current < 2) {
            autoRetryCountRef.current += 1;
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
            restartTimerRef.current = setTimeout(() => {
              if (isActiveRef.current) startListening();
            }, 500);
          } else {
            setState('ready');
          }
        } else if (event.error !== 'aborted') {
          setState('ready');
        }
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        recognitionRef.current = null;

        // If recognition closed while user was actively speaking and had pending text, confirm and process
        if (speechDetectedRef.current && currentInterimRef.current.trim().length > 0) {
          const vadEnd = performance.now();
          const capturedText = currentInterimRef.current.trim();
          speechDetectedRef.current = false;
          processUserSpeech(capturedText, vadEnd);
        }
      };

      recognition.start();
    } catch (err) {
      console.error('[Voice] Failed to start recognition:', err);
      setState('error');
      setErrorMessage('Could not access microphone. Please check your browser settings.');
    }
  }, [state, processUserSpeech, stopRecognition]);

  // Interrupt / Barge-In feature
  const interrupt = useCallback(() => {
    console.log('🛑 [INTERRUPT] User explicitly interrupted.');
    stopSpeaking();
    ttsSentenceQueueRef.current = [];
    isTtsSpeakingRef.current = false;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setCurrentAssistantText('');
    startListening();
  }, [startListening]);

  // Toggle listening button
  const toggleListening = useCallback(() => {
    if (state === 'speaking') {
      interrupt();
    } else if (state === 'listening') {
      stopRecognition();
      setState('ready');
    } else {
      startListening();
    }
  }, [state, interrupt, stopRecognition, startListening]);

  // Language switch
  const switchLanguage = useCallback((newLang: LanguageCode) => {
    setCurrentLanguage(newLang);
    currentLanguageRef.current = newLang;
    if (state === 'listening') {
      startListening();
    }
  }, [state, startListening]);

  // Reset conversation
  const resetConversation = useCallback(() => {
    stopSpeaking();
    stopRecognition();
    ttsSentenceQueueRef.current = [];
    isTtsSpeakingRef.current = false;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    geminiHistoryRef.current = [];
    setTranscripts([]);
    setInterimUserText('');
    setCurrentAssistantText('');
    setErrorMessage(null);
    setState('ready');
    setTimeout(() => {
      if (isActiveRef.current) startListening();
    }, 200);
  }, [stopRecognition, startListening]);

  // End conversation
  const endConversation = useCallback(() => {
    stopSpeaking();
    stopRecognition();
    ttsSentenceQueueRef.current = [];
    isTtsSpeakingRef.current = false;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setState('idle');
    setInterimUserText('');
    setCurrentAssistantText('');
  }, [stopRecognition]);

  return {
    state,
    currentLanguage,
    transcripts,
    interimUserText,
    currentAssistantText,
    errorMessage,
    isSupported,
    startListening,
    interrupt,
    toggleListening,
    switchLanguage,
    resetConversation,
    endConversation,
    askQuestion: processUserSpeech,
  };
}
