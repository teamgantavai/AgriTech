// ============================================================
// useGeminiLive — Main orchestration hook
// State machine + audio pipeline + session management
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceState, OnboardingState } from '../types/voice';
import type { SessionProfile, ConversationTurn, VoiceMetrics } from '../types/voice';
import { GeminiLiveSession } from '../services/geminiLive';
import { loadProfile, updateProfile, detectLanguageFromText, type SupportedLanguage } from '../services/sessionManager';
import { getLiveToken, clearCachedToken } from '../services/tokenService';
import { profiler } from '../services/voiceProfiler';
import { useMicrophone } from './useMicrophone';
import { useAudioPlayback } from './useAudioPlayback';

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

interface UseGeminiLiveOptions {
  onToolCall?: (tool: string, args: Record<string, unknown>) => void;
  onAnalyserData?: (data: Uint8Array) => void;
  onMicAnalyserData?: (rms: number) => void;
}

export function useGeminiLive(options: UseGeminiLiveOptions = {}) {
  const { onAnalyserData, onMicAnalyserData } = options;

  const [voiceState, setVoiceState] = useState<VoiceState>(VoiceState.IDLE);
  const [profile, setProfile] = useState<SessionProfile>(loadProfile);
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(() => {
    const p = loadProfile();
    const isReturning = Boolean((p.onboardingComplete || p.onboardingDone) && (p.selectedLanguage || p.language));
    return isReturning ? OnboardingState.NORMAL_CONVERSATION : OnboardingState.FIRST_START;
  });
  const onboardingStateRef = useRef<OnboardingState>(onboardingState);

  const updateOnboardingState = useCallback((nextState: OnboardingState) => {
    console.log(`[ONBOARDING STATE] ${onboardingStateRef.current} -> ${nextState}`);
    onboardingStateRef.current = nextState;
    setOnboardingState(nextState);
  }, []);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<VoiceMetrics>({
    connectionTimeMs: null,
    ttfaMs: null,
    lastTurnDurationMs: null,
    userSpeechDurationMs: null,
    assistantResponseDurationMs: null,
    interruptionCount: 0,
    reconnectCount: 0,
    vadFalseActivations: 0,
    vadActive: false,
    sessionConnected: false,
    audioSampleRate: 16000,
    microphoneInitTimeMs: null,
    liveConnectionTimeMs: null,
    liveSetupTimeMs: null,
    timeFromSpeechEndToFirstAudioMs: null,
    totalFirstResponseLatencyMs: null,
    turn1TTFAMs: null,
    turn2TTFAMs: null,
    firstTurnReport: null,
  });

  const sessionRef = useRef<GeminiLiveSession | null>(null);
  const voiceStateRef = useRef<VoiceState>(VoiceState.IDLE);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnStartTimeRef = useRef<number>(0);
  const speechStartTimeRef = useRef<number>(0);
  const partialAssistantTextRef = useRef('');
  const isConnectingRef = useRef(false);
  const ephemeralTokenRef = useRef<{ token: string; model: string } | null>(null);

  // ─── First-turn & First-word Protection Refs ───────────────
  const earlyAudioBufferRef = useRef<string[]>([]);
  const turnNumberRef = useRef<number>(1);

  // ─── Strict Turn-Taking State Flags ────────────────────────
  const userInputLockedRef = useRef(false);
  const geminiGenerationCompleteRef = useRef(false);
  const audioPlaybackCompleteRef = useRef(false);
  const conversationCompletionHandledRef = useRef(false);
  const processingWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    profiler.setMetricsCallback((updates) => {
      setMetrics((prev) => ({ ...prev, ...updates }));
    });
  }, []);

  const clearProcessingWatchdog = useCallback(() => {
    if (processingWatchdogRef.current) {
      clearTimeout(processingWatchdogRef.current);
      processingWatchdogRef.current = null;
    }
  }, []);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updateState = useCallback((newState: VoiceState) => {
    voiceStateRef.current = newState;
    setVoiceState(newState);
  }, []);

  const updateMetric = useCallback((key: string, value: number | boolean | string) => {
    setMetrics((prev) => ({ ...prev, [key]: value }));
  }, []);

  const playbackRef = useRef<any>(null);
  const micRef = useRef<any>(null);

  // ─── Finish Speaking & Unlock Microphone ───────────────────
  // Called ONLY when BOTH geminiGenerationComplete AND audioPlaybackComplete are true
  const finishSpeaking = useCallback(() => {
    clearProcessingWatchdog();

    if (onboardingStateRef.current === OnboardingState.LANGUAGE_QUESTION) {
      // AI has finished asking "Which language would you like to speak in?"
      updateOnboardingState(OnboardingState.WAITING_FOR_LANGUAGE);
      userInputLockedRef.current = false;
      updateMetric('userInputLocked', false);
      micRef.current?.resetVAD();
      updateState(VoiceState.READY_FOR_USER);
      console.log('[INPUT] microphone unlocked — waiting for user language choice');
      setTimeout(() => {
        if (voiceStateRef.current === VoiceState.READY_FOR_USER) {
          updateState(VoiceState.LISTENING);
          console.log('[STATE] LISTENING (waiting for language)');
        }
      }, 100);
      return;
    }

    if (
      onboardingStateRef.current === OnboardingState.LANGUAGE_SELECTED ||
      onboardingStateRef.current === OnboardingState.READY_FOR_HELP
    ) {
      // AI has finished asking "Sure! How can I help you?" in the selected language
      updateOnboardingState(OnboardingState.NORMAL_CONVERSATION);
      const updated = updateProfile({
        onboardingComplete: true,
        onboardingDone: true,
      });
      setProfile(updated);
      console.log('[useGeminiLive] Language onboarding complete! Saved profile:', updated);

      userInputLockedRef.current = false;
      updateMetric('userInputLocked', false);
      micRef.current?.resetVAD();
      updateState(VoiceState.READY_FOR_USER);
      console.log('[INPUT] microphone unlocked — ready for normal conversation');
      setTimeout(() => {
        if (voiceStateRef.current === VoiceState.READY_FOR_USER) {
          updateState(VoiceState.LISTENING);
          console.log('[STATE] LISTENING (normal conversation)');
        }
      }, 100);
      return;
    }

    // Normal conversation turn:
    updateState(VoiceState.READY_FOR_USER);
    console.log('[STATE] READY_FOR_USER');

    userInputLockedRef.current = false;
    updateMetric('userInputLocked', false);
    console.log('[INPUT] microphone unlocked');

    // Cleanly purge any energy/silence timers accumulated during speaking
    micRef.current?.resetVAD();

    // Prompt, seamless transition to LISTENING
    setTimeout(() => {
      if (voiceStateRef.current === VoiceState.READY_FOR_USER) {
        updateState(VoiceState.LISTENING);
        console.log('[STATE] LISTENING');
      }
    }, 100);
  }, [updateState, updateMetric, clearProcessingWatchdog, updateOnboardingState]);

  // ─── Single Completion Condition Check ─────────────────────
  const checkConversationCompletion = useCallback(() => {
    const isActuallyPlaying = playbackRef.current?.isPlaying?.() ?? false;
    if (
      geminiGenerationCompleteRef.current &&
      (audioPlaybackCompleteRef.current || !isActuallyPlaying) &&
      !conversationCompletionHandledRef.current
    ) {
      conversationCompletionHandledRef.current = true;
      finishSpeaking();
    }
  }, [finishSpeaking]);

  // ─── Audio Playback ────────────────────────────────────────
  const playback = useAudioPlayback({
    onPlaybackStart: () => {
      clearProcessingWatchdog();
      // Lock user input during playback
      userInputLockedRef.current = true;
      updateMetric('userInputLocked', true);
      updateState(VoiceState.AI_SPEAKING);
      console.log('[STATE] AI_SPEAKING');
    },
    onPlaybackComplete: () => {
      audioPlaybackCompleteRef.current = true;
      checkConversationCompletion();
    },
    onFirstAudioPlayback: () => {
      profiler.recordTurnPlaybackStart(turnNumberRef.current);
    },
    onAnalyserData,
  });
  playbackRef.current = playback;

  // ─── Microphone ────────────────────────────────────────────
  const mic = useMicrophone({
    isInputLocked: () => userInputLockedRef.current,
    onPermissionRequest: () => profiler.mark('MIC_PERMISSION_REQUEST'),
    onPermissionGranted: () => profiler.mark('MIC_PERMISSION_GRANTED'),
    onAudioContextCreated: () => profiler.mark('AUDIO_CONTEXT_CREATED'),
    onVADInitialized: () => profiler.mark('VAD_INITIALIZED'),
    onAudioChunk: (base64: string) => {
      // Never send microphone audio to Gemini if input is locked (AI speaking)
      if (userInputLockedRef.current) {
        return;
      }
      if (!sessionRef.current?.connected) {
        // Critical first-word protection: buffer audio while Live session is connecting
        if (earlyAudioBufferRef.current.length < 35) {
          earlyAudioBufferRef.current.push(base64);
        }
        return;
      }
      sessionRef.current.sendAudio(base64);
      profiler.mark('FIRST_USER_AUDIO_SENT');
    },
    onVADChange: (isSpeech, rms) => {
      if (userInputLockedRef.current) {
        updateMetric('vadActive', false);
        onMicAnalyserData?.(0);
        return;
      }
      updateMetric('vadActive', isSpeech);
      onMicAnalyserData?.(rms);
    },
    onSpeechStart: () => {
      // Strictly ignore speech while user input is locked
      if (userInputLockedRef.current) {
        return;
      }
      speechStartTimeRef.current = Date.now();
      // If user resumed speaking while in PROCESSING before Gemini responded, return to LISTENING
      if (voiceStateRef.current === VoiceState.PROCESSING) {
        clearProcessingWatchdog();
        updateState(VoiceState.LISTENING);
      }
    },
    onSpeechEnd: () => {
      // Strictly ignore speech while user input is locked
      if (userInputLockedRef.current) {
        return;
      }

      const duration = Date.now() - speechStartTimeRef.current;
      updateMetric('userSpeechDurationMs', duration);

      if (
        voiceStateRef.current === VoiceState.LISTENING ||
        voiceStateRef.current === VoiceState.READY_FOR_USER
      ) {
        // Note: Do NOT lock user input here!
        // Silence frames must continue to be sent to Gemini so server-side VAD
        // detects the 600ms trailing silence and triggers generation.
        geminiGenerationCompleteRef.current = false;
        audioPlaybackCompleteRef.current = false;
        conversationCompletionHandledRef.current = false;

        updateState(VoiceState.PROCESSING);
        console.log('[STATE] PROCESSING');

        profiler.recordTurnSpeechEnd(turnNumberRef.current);

        // Explicitly notify Gemini server that the user's speech utterance has concluded
        sessionRef.current?.signalAudioStreamEnd();

        sessionRef.current?.resetFirstAudioTimer();
        turnStartTimeRef.current = Date.now();

        // 15s watchdog so UI never hangs in "Thinking..." if Gemini fails to answer
        clearProcessingWatchdog();
        processingWatchdogRef.current = setTimeout(() => {
          if (voiceStateRef.current === VoiceState.PROCESSING) {
            console.warn('[GeminiLive] Response timeout in PROCESSING, returning to LISTENING');
            userInputLockedRef.current = false;
            updateMetric('userInputLocked', false);
            updateState(VoiceState.LISTENING);
            console.log('[STATE] LISTENING');
          }
        }, 15000);
      }
    },
    onError: (err) => {
      console.error('[useGeminiLive] Mic error:', err);
      handleError(err.message || 'Microphone error');
    },
  });
  micRef.current = mic;

  const handleError = useCallback((msg: string) => {
    clearProcessingWatchdog();
    setError(msg);
    userInputLockedRef.current = false;
    updateMetric('userInputLocked', false);
    updateState(VoiceState.ERROR);
    playback.stopAll();
  }, [updateState, updateMetric, playback, clearProcessingWatchdog]);

  // ─── Profile Extraction ────────────────────────────────────
  const extractProfileUpdates = useCallback((text: string) => {
    // Detect occupation mentions (saved contextually only when relevant/mentioned)
    const occupationPatterns: [RegExp, string][] = [
      [/\b(farmer|kisan|किसान|ਕਿਸਾਨ|खेती|ਖੇਤੀ)\b/i, 'farmer'],
      [/\b(student|छात्र|विद्यार्थी|ਵਿਦਿਆਰਥੀ)\b/i, 'student'],
      [/\b(teacher|शिक्षक|ਅਧਿਆਪਕ)\b/i, 'teacher'],
      [/\b(shopkeeper|dukaan|दुकानदार|ਦੁਕਾਨਦਾਰ|व्यापारी)\b/i, 'shopkeeper'],
      [/\b(worker|labour|मजदूर|ਮਜ਼ਦੂਰ|mazdoor)\b/i, 'worker'],
      [/\b(homemaker|housewife|गृहिणी|ਘਰੇਲੂ)\b/i, 'homemaker'],
      [/\b(business|व्यवसाय|businessman|ਕਾਰੋਬਾਰ)\b/i, 'business owner'],
    ];

    let occupationFound: string | null = null;
    for (const [pattern, occupation] of occupationPatterns) {
      if (pattern.test(text)) {
        occupationFound = occupation;
        break;
      }
    }

    // Name pattern: "my name is X", "main X hoon"
    const nameMatch =
      text.match(/my name is (\w+)/i) ||
      text.match(/मेरा नाम (\S+)/i) ||
      text.match(/ਮੇਰਾ ਨਾਮ (\S+)/i) ||
      text.match(/I am (\w+)/i);

    let updated = false;
    const currentProfile = loadProfile();

    if (occupationFound && !currentProfile.occupation) {
      const newProfile = updateProfile({
        occupation: occupationFound,
      });
      setProfile(newProfile);
      updated = true;
    }

    if (nameMatch?.[1] && !currentProfile.nameIfProvided) {
      const newProfile = updateProfile({ nameIfProvided: nameMatch[1] });
      setProfile(newProfile);
      updated = true;
    }

    // Language detection from user utterance or language switch intent
    const detectedLang = detectLanguageFromText(text);
    if (detectedLang) {
      const currentLang = currentProfile.selectedLanguage || currentProfile.language;
      if (currentLang !== detectedLang.name) {
        const newProfile = updateProfile({
          selectedLanguage: detectedLang.name,
          language: detectedLang.name,
          languageCode: detectedLang.code,
        });
        setProfile(newProfile);
        updated = true;
      }
    }

    if (updated) {
      console.log('[useGeminiLive] Profile updated:', loadProfile());
    }
  }, []);

  // ─── Connect Session (Parallel Initialization) ──────────────
  const connect = useCallback(async () => {
    if (isConnectingRef.current || voiceStateRef.current === VoiceState.CONNECTING) return;
    isConnectingRef.current = true;
    clearProcessingWatchdog();
    profiler.mark('VOICE_BUTTON_CLICK');
    updateState(VoiceState.PREPARING);
    console.log('[STATE] PREPARING (voice button clicked)');
    setError(null);

    // 1. Immediately pre-warm AudioContext synchronously within user click event
    playback.prewarmAudioContext();

    try {
      // Disconnect any existing session
      sessionRef.current?.disconnect();
      sessionRef.current = null;
      playback.stopAll();
      earlyAudioBufferRef.current = [];

      profiler.mark('LIVE_SESSION_START');

      // 2. Concurrently start microphone and Gemini Live session
      const micPromise = mic.start();

      const sessionPromise = (async () => {
        // Always fetch a guaranteed fresh token when connecting or reconnecting
        const tokenData = await getLiveToken(true);
        ephemeralTokenRef.current = tokenData;

        const liveSession = new GeminiLiveSession({
          events: {
            onConnect: () => {
              profiler.mark('LIVE_SESSION_CONNECTED');
              isConnectingRef.current = false;
              reconnectCountRef.current = 0;
              updateMetric('sessionConnected', true);

              const currentP = loadProfile();
              const hasLang = Boolean(currentP.selectedLanguage || currentP.language);
              const isComplete = Boolean(currentP.onboardingComplete || currentP.onboardingDone);

              if (isComplete && hasLang) {
                // ── RETURNING USER: Greet directly in chosen language ──
                const langName = currentP.selectedLanguage || currentP.language;
                console.log(`[useGeminiLive] Returning user session connected (${langName})`);
                updateOnboardingState(OnboardingState.NORMAL_CONVERSATION);

                // Lock microphone while AI produces and speaks the greeting
                userInputLockedRef.current = true;
                updateMetric('userInputLocked', true);
                updateState(VoiceState.PROCESSING);

                sessionRef.current?.sendClientContent(
                  `[Returning user connected] Greet the returning user in ${langName} with a short natural question equivalent to: 'How can I help you?' (e.g. in Hindi: 'ठीक है! मैं आपकी कैसे मदद कर सकता हूँ?', Punjabi: 'ਠੀਕ ਹੈ! ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?', English: 'Sure! How can I help you?'). Do NOT ask for their language.`
                );
              } else {
                // ── FIRST-TIME USER: Immediately ask for language ──
                console.log('[useGeminiLive] First-time user connected. Asking language question.');
                updateOnboardingState(OnboardingState.LANGUAGE_QUESTION);

                // Lock microphone while AI asks language question
                userInputLockedRef.current = true;
                updateMetric('userInputLocked', true);
                updateState(VoiceState.PROCESSING);

                sessionRef.current?.sendClientContent(
                  `[First interaction] Start now by asking ONLY the short English question: 'Which language would you like to speak in?' Do not say anything else.`
                );
              }
            },
            onSetupSent: () => {
              profiler.mark('LIVE_SETUP_SENT');
            },
            onFirstResponseEvent: () => {
              profiler.mark('FIRST_GEMINI_RESPONSE_EVENT');
            },
            onAudioChunk: (pcm, generationId) => {
              clearProcessingWatchdog();
              profiler.recordTurnFirstAudio(turnNumberRef.current);

              // 🔒 Lock user input as soon as Gemini begins producing an answer
              if (!userInputLockedRef.current) {
                userInputLockedRef.current = true;
                updateMetric('userInputLocked', true);
                console.log('[INPUT] microphone locked');
              }
              playback.enqueueChunk(
                pcm,
                generationId ?? sessionRef.current?.currentGenerationId ?? 0
              );
              // Track TTFA
              if (voiceStateRef.current === VoiceState.PROCESSING) {
                const ttfa = Date.now() - turnStartTimeRef.current;
                updateMetric('ttfaMs', ttfa);
                setMetrics((prev) => ({ ...prev, ttfaMs: ttfa }));
              }
            },
            onTurnComplete: (generationId) => {
              clearProcessingWatchdog();
              console.log(`[GEMINI] generation complete for turn ${turnNumberRef.current}`);
              geminiGenerationCompleteRef.current = true;

              playback.markTurnComplete(
                generationId ?? sessionRef.current?.currentGenerationId ?? 0
              );

              // In case audio already finished (or 0 chunks received)
              checkConversationCompletion();

              // Finalize assistant turn text
              if (partialAssistantTextRef.current.trim()) {
                setTurns((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant' && last.isPartial) {
                    return [
                      ...prev.slice(0, -1),
                      { ...last, isPartial: false, text: partialAssistantTextRef.current },
                    ];
                  }
                  return prev;
                });
                partialAssistantTextRef.current = '';
              }

              turnNumberRef.current += 1;
            },
            onInterrupted: () => {
              // Barge-in disabled for strict turn-taking
              console.log('[GeminiLive] Interrupted event ignored (strict turn-taking active)');
            },
            onToolCall: (toolCall) => {
              optionsRef.current.onToolCall?.(toolCall.name, toolCall.args);
            },
            onError: (err) => {
              isConnectingRef.current = false;
              clearCachedToken();
              console.error('[useGeminiLive] Session error:', err);
              scheduleReconnect();
            },
            onDisconnect: () => {
              isConnectingRef.current = false;
              clearCachedToken();
              updateMetric('sessionConnected', false);
              if (
                voiceStateRef.current !== VoiceState.IDLE &&
                voiceStateRef.current !== VoiceState.ERROR
              ) {
                scheduleReconnect();
              }
            },
            onTranscript: (text, isUser, isPartial) => {
              if (!text) return;
              if (isUser) {
                // Add user turn
                setTurns((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'user' && isPartial) {
                    return [
                      ...prev.slice(0, -1),
                      { ...last, text, isPartial: true },
                    ];
                  }
                  return [
                    ...prev,
                    {
                      id: `user-${Date.now()}`,
                      role: 'user' as const,
                      text,
                      timestamp: Date.now(),
                      isPartial,
                    },
                  ];
                });

                // Detect chosen language from user speech
                const detected = detectLanguageFromText(text);
                if (detected) {
                  console.log('[useGeminiLive] Detected language from user utterance:', detected.name);
                  const updated = updateProfile({
                    selectedLanguage: detected.name,
                    language: detected.name,
                    languageCode: detected.code,
                  });
                  setProfile(updated);

                  if (
                    onboardingStateRef.current === OnboardingState.WAITING_FOR_LANGUAGE ||
                    onboardingStateRef.current === OnboardingState.LANGUAGE_QUESTION ||
                    onboardingStateRef.current === OnboardingState.FIRST_START
                  ) {
                    updateOnboardingState(OnboardingState.LANGUAGE_SELECTED);
                  }
                }

                // Extract occupation or other profile details if mentioned
                extractProfileUpdates(text);
              } else {
                // Assistant turn
                partialAssistantTextRef.current = text;
                setTurns((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant' && last.isPartial) {
                    return [
                      ...prev.slice(0, -1),
                      { ...last, text, isPartial: true },
                    ];
                  }
                  return [
                    ...prev,
                    {
                      id: `asst-${Date.now()}`,
                      role: 'assistant' as const,
                      text,
                      timestamp: Date.now(),
                      isPartial: true,
                    },
                  ];
                });

                // If in onboarding, verify detected language from assistant confirmation
                if (
                  onboardingStateRef.current === OnboardingState.LANGUAGE_SELECTED ||
                  onboardingStateRef.current === OnboardingState.WAITING_FOR_LANGUAGE
                ) {
                  const detectedFromAsst = detectLanguageFromText(text);
                  if (detectedFromAsst) {
                    const updated = updateProfile({
                      selectedLanguage: detectedFromAsst.name,
                      language: detectedFromAsst.name,
                      languageCode: detectedFromAsst.code,
                    });
                    setProfile(updated);
                  }
                  updateOnboardingState(OnboardingState.READY_FOR_HELP);
                }
              }
            },
          },
          onMetric: updateMetric,
        });

        sessionRef.current = liveSession;
        await liveSession.connect(tokenData.token, tokenData.model);
      })();

      // Concurrently wait for mic and live session
      await Promise.all([micPromise, sessionPromise]);
    } catch (err: any) {
      isConnectingRef.current = false;
      console.error('[useGeminiLive] Connect failed:', err);

      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
        handleError('Microphone permission denied. Please allow mic access and try again.');
      } else {
        handleError(msg || 'Connection failed');
      }
    }
  }, [mic, playback, updateState, updateMetric, handleError, checkConversationCompletion, clearProcessingWatchdog, extractProfileUpdates]);

  // ─── Reconnect Logic ───────────────────────────────────────
  const scheduleReconnect = useCallback(() => {
    if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
      handleError('Connection lost. Please try again.');
      return;
    }
    reconnectCountRef.current += 1;
    updateState(VoiceState.RECONNECTING);
    setMetrics((prev) => ({
      ...prev,
      reconnectCount: reconnectCountRef.current,
    }));

    const delay = RECONNECT_DELAY_MS * reconnectCountRef.current;
    console.log(`[useGeminiLive] Reconnecting in ${delay}ms (attempt ${reconnectCountRef.current})`);

    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect, handleError, updateState]);

  // ─── Set Language (Manual Selection / Switching) ─────────────
  const setLanguage = useCallback((lang: SupportedLanguage | null) => {
    const updated = updateProfile({
      selectedLanguage: lang ? lang.name : null,
      language: lang ? lang.name : null,
      languageCode: lang ? lang.code : null,
      onboardingComplete: true,
      onboardingDone: true,
    });
    setProfile(updated);
    updateOnboardingState(OnboardingState.NORMAL_CONVERSATION);

    if (sessionRef.current?.connected) {
      if (lang) {
        sessionRef.current.sendClientContent(
          `[Language switched by user] The user has selected ${lang.name} (${lang.nativeName}). Please respond entirely in ${lang.name} from now on.`
        );
      } else {
        sessionRef.current.sendClientContent(
          `[Language mode: Auto-detect] Please auto-detect the language from whatever I say and respond in that exact same language.`
        );
      }
    }
  }, [updateOnboardingState]);

  // ─── Disconnect ────────────────────────────────────────────
  const disconnect = useCallback(() => {
    clearProcessingWatchdog();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    turnNumberRef.current = 1;
    earlyAudioBufferRef.current = [];
    userInputLockedRef.current = false;
    geminiGenerationCompleteRef.current = false;
    audioPlaybackCompleteRef.current = false;
    conversationCompletionHandledRef.current = false;
    updateMetric('userInputLocked', false);
    mic.stop();
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    clearCachedToken();
    playback.stopAll();
    updateState(VoiceState.IDLE);
    setError(null);

    const currentP = loadProfile();
    const isComplete = Boolean(
      (currentP.onboardingComplete || currentP.onboardingDone) &&
      (currentP.selectedLanguage || currentP.language)
    );
    updateOnboardingState(isComplete ? OnboardingState.NORMAL_CONVERSATION : OnboardingState.FIRST_START);
  }, [mic, playback, updateState, updateMetric, clearProcessingWatchdog, updateOnboardingState]);

  // ─── Cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      clearProcessingWatchdog();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      sessionRef.current?.disconnect();
      mic.stop();
      playback.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    voiceState,
    onboardingState,
    profile,
    turns,
    error,
    metrics,
    connect,
    disconnect,
    setLanguage,
  };
}
