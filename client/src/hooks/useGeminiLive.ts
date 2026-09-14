// ============================================================
// useGeminiLive — Main orchestration hook
// State machine + audio pipeline + session management
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceState, OnboardingState } from '../types/voice';
import type { SessionProfile, ConversationTurn, VoiceMetrics } from '../types/voice';
import { GeminiLiveSession } from '../services/geminiLive';
import { loadProfile, updateProfile, detectLanguageFromText, getGreetingText, getFarmerContext, type SupportedLanguage } from '../services/sessionManager';
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
  const scheduleReconnectRef = useRef<() => void>(() => {});
  const hasGreetedRef = useRef(false);

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
  // Called ONLY when ALL 5 conditions are satisfied:
  // 1. geminiGenerationComplete === true
  // 2. audioReceivingComplete === true
  // 3. audioQueue.length === 0
  // 4. activeSources === 0
  // 5. audioPlaybackComplete === true
  const finishSpeaking = useCallback(() => {
    clearProcessingWatchdog();

    console.log(`[TURN ${turnNumberRef.current}] audio playback complete`);
    console.log(`[TURN ${turnNumberRef.current}] microphone unlocked`);

    userInputLockedRef.current = false;
    updateMetric('userInputLocked', false);

    // Cleanly purge any energy/silence timers accumulated during speaking
    micRef.current?.resetVAD();

    if (onboardingStateRef.current === OnboardingState.LANGUAGE_QUESTION) {
      // AI has finished asking "Which language would you like to speak in?"
      updateOnboardingState(OnboardingState.WAITING_FOR_LANGUAGE);
      updateState(VoiceState.READY_FOR_USER);
      console.log('[INPUT] microphone unlocked — waiting for user language choice');
      turnNumberRef.current += 1;
      sessionRef.current?.setTurnNumber(turnNumberRef.current);
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

      updateState(VoiceState.READY_FOR_USER);
      console.log('[INPUT] microphone unlocked — ready for normal conversation');
      turnNumberRef.current += 1;
      sessionRef.current?.setTurnNumber(turnNumberRef.current);
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

    turnNumberRef.current += 1;
    sessionRef.current?.setTurnNumber(turnNumberRef.current);

    // Prompt, seamless transition to LISTENING
    setTimeout(() => {
      if (voiceStateRef.current === VoiceState.READY_FOR_USER) {
        updateState(VoiceState.LISTENING);
        console.log('[STATE] LISTENING');
      }
    }, 100);
  }, [updateState, updateMetric, clearProcessingWatchdog, updateOnboardingState]);

  // ─── Single Authoritative Completion Condition Check ────────
  // Strict half-duplex requirement:
  // Unlock microphone ONLY after Gemini generation is complete AND complete physical audio has finished.
  const checkConversationCompletion = useCallback(() => {
    const isReceivingDone = playbackRef.current?.isReceivingComplete?.() ?? false;
    const qLen = playbackRef.current?.getQueueLength?.() ?? 0;
    const activeSources = playbackRef.current?.getActiveSourcesCount?.() ?? 0;
    const isAudioComplete = audioPlaybackCompleteRef.current;

    const canUnlock =
      geminiGenerationCompleteRef.current &&
      isReceivingDone &&
      qLen === 0 &&
      activeSources === 0 &&
      isAudioComplete;

    if (canUnlock && !conversationCompletionHandledRef.current) {
      conversationCompletionHandledRef.current = true;
      finishSpeaking();
    }
  }, [finishSpeaking]);

  // ─── Stuck State Recovery ──────────────────────────────────
  const recoverStuckState = useCallback(
    (reason: string) => {
      const pDiag = playbackRef.current?.getDiagnostics?.();
      const now = Date.now();
      const lastProgress = Math.max(
        sessionRef.current?.lastMessageTime ?? 0,
        pDiag?.lastAudioChunkTime ?? 0,
        pDiag?.lastAudioPlaybackTime ?? 0,
        turnStartTimeRef.current
      );
      const idleMs = now - lastProgress;

      console.error(
        `[VOICE ERROR]\n` +
        `turn=${turnNumberRef.current}\n` +
        `state=${voiceStateRef.current}\n` +
        `geminiConnected=${sessionRef.current?.isHealthy() ?? false}\n` +
        `audioContext=${pDiag?.audioContextState ?? 'unknown'}\n` +
        `queue=${pDiag?.queueLength ?? 0}\n` +
        `activeSources=${pDiag?.activeSources ?? 0}\n` +
        `lastAudio=${idleMs}ms ago\n` +
        `reason=${reason}`
      );

      clearProcessingWatchdog();
      updateState(VoiceState.RECOVERING);

      // 1. Stop stale playback & clean active sources
      playbackRef.current?.stopAll();

      // 2. Reset turn flags
      geminiGenerationCompleteRef.current = false;
      audioPlaybackCompleteRef.current = false;
      conversationCompletionHandledRef.current = false;

      // 3. Ensure AudioContext is running
      playbackRef.current?.prewarmAudioContext();

      // 4. Ensure microphone is healthy & reset VAD
      micRef.current?.ensureHealthyTrack();
      micRef.current?.resetVAD();

      // 5. Check session health
      if (sessionRef.current?.isHealthy()) {
        console.log('[RECOVERY] Gemini session is healthy. Audio pipeline recovered without reconnection.');
        userInputLockedRef.current = false;
        updateMetric('userInputLocked', false);
        updateState(VoiceState.READY_FOR_USER);
        setTimeout(() => {
          if (
            voiceStateRef.current === VoiceState.READY_FOR_USER ||
            voiceStateRef.current === VoiceState.RECOVERING
          ) {
            updateState(VoiceState.LISTENING);
            console.log('[STATE] LISTENING (pipeline recovered)');
          }
        }, 200);
      } else {
        console.log('[RECOVERY] Gemini session is unhealthy. Reconnecting Live session...');
        scheduleReconnectRef.current();
      }
    },
    [updateState, updateMetric, clearProcessingWatchdog]
  );

  // ─── Audio Playback ────────────────────────────────────────
  const playback = useAudioPlayback({
    onPlaybackStart: () => {
      clearProcessingWatchdog();
      // Lock user input during playback
      userInputLockedRef.current = true;
      updateMetric('userInputLocked', true);
      updateState(VoiceState.AI_SPEAKING);
      console.log(`[TURN ${turnNumberRef.current}] audio playback started`);
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
      console.log(`[TURN ${turnNumberRef.current}] user speech start`);
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

      console.log(`[TURN ${turnNumberRef.current}] user speech end`);
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

        // Reset playback queue and state cleanly for this turn
        playback.resetForNewTurn(turnNumberRef.current, sessionRef.current?.currentGenerationId ?? 0);
        sessionRef.current?.setTurnNumber(turnNumberRef.current);

        // Verify microphone track health
        mic.ensureHealthyTrack();

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
      if (reconnectCountRef.current === 0) {
        hasGreetedRef.current = false;
      }

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

              if (!hasGreetedRef.current) {
                hasGreetedRef.current = true;
                const currentP = loadProfile();
                const hasLang = Boolean(currentP.selectedLanguage || currentP.language);
                const farmerCtx = getFarmerContext();

                if (hasLang) {
                  const langCodeOrName = currentP.languageCode || currentP.selectedLanguage || currentP.language || 'hi';
                  const greetingText = getGreetingText(langCodeOrName, farmerCtx.currentCrop);
                  console.log(`[useGeminiLive] Auto-greeting triggered (${langCodeOrName}, crop=${farmerCtx.currentCrop || 'none'}): "${greetingText}"`);
                  updateOnboardingState(OnboardingState.NORMAL_CONVERSATION);

                  // Lock microphone while AI produces and speaks the greeting
                  userInputLockedRef.current = true;
                  updateMetric('userInputLocked', true);
                  updateState(VoiceState.PROCESSING);

                  sessionRef.current?.sendClientContent(
                    `[Greeting request] Speak ONLY this exact short greeting now and nothing else: "${greetingText}"`
                  );
                } else {
                  // No language selected: ask language question
                  console.log('[useGeminiLive] No language selected. Asking language question.');
                  updateOnboardingState(OnboardingState.LANGUAGE_QUESTION);

                  // Lock microphone while AI asks language question
                  userInputLockedRef.current = true;
                  updateMetric('userInputLocked', true);
                  updateState(VoiceState.PROCESSING);

                  sessionRef.current?.sendClientContent(
                    `[First interaction] Start now by asking ONLY the short bilingual question: 'नमस्ते! आप कौन सी भाषा में बात करना चाहते हैं? Which language would you like to speak in?' Do not say anything else.`
                  );
                }
              } else {
                console.log('[useGeminiLive] Session reconnected or greeting already played — skipping duplicate greeting.');
              }
            },
            onSetupSent: () => {
              profiler.mark('LIVE_SETUP_SENT');
            },
            onFirstResponseEvent: () => {
              console.log(`[TURN ${turnNumberRef.current}] Gemini response started`);
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
                generationId ?? sessionRef.current?.currentGenerationId ?? 0,
                turnNumberRef.current
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
              const activeTurn = turnNumberRef.current;
              console.log(`[TURN ${activeTurn}] turnComplete`);
              geminiGenerationCompleteRef.current = true;

              playback.markTurnComplete(
                generationId ?? sessionRef.current?.currentGenerationId ?? 0,
                activeTurn
              );

              // Safety timeout: If 0 audio chunks were received from Gemini, ensure UI recovers
              setTimeout(() => {
                const diag = playback.getDiagnostics();
                if (diag.chunksReceived === 0 && voiceStateRef.current === VoiceState.PROCESSING) {
                  console.warn(`[TURN ${activeTurn}] [TIMEOUT] 0 audio chunks received for turn complete. Recovering UI...`);
                  checkConversationCompletion();
                }
              }, 2000);

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
  scheduleReconnectRef.current = scheduleReconnect;

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
    hasGreetedRef.current = false;
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

  // ─── Diagnostics Heartbeat for Live Observability ──────────
  useEffect(() => {
    const timer = setInterval(() => {
      const pDiag = playbackRef.current?.getDiagnostics?.();
      const mDiag = micRef.current?.getDiagnostics?.();
      const live = sessionRef.current;

      setMetrics((prev) => ({
        ...prev,
        sessionId: live?.sessionId ?? null,
        sessionState: live?.connectionState ?? (live?.connected ? 'OPEN' : 'CLOSED'),
        lastMessageTime: live?.lastMessageTime ?? null,
        audioContextState: pDiag?.audioContextState ?? null,
        queueLength: pDiag?.queueLength ?? 0,
        activeSources: pDiag?.activeSources ?? 0,
        schedulerState: pDiag?.schedulerState ?? 'idle',
        currentTurnId: turnNumberRef.current,
        chunksReceived: pDiag?.chunksReceived ?? 0,
        chunksPlayed: pDiag?.chunksPlayed ?? 0,
        chunksRemaining: pDiag?.chunksRemaining ?? 0,
        geminiGenerationStatus: geminiGenerationCompleteRef.current
          ? 'complete'
          : voiceStateRef.current === VoiceState.PROCESSING
          ? 'generating'
          : 'idle',
        audioPlaybackStatus: playbackRef.current?.isPlaying?.()
          ? 'playing'
          : audioPlaybackCompleteRef.current
          ? 'complete'
          : 'idle',
        geminiMessageListeners: live?.connected ? 1 : 0,
        micListeners: 1,
        liveSessionCount: live?.connected ? 1 : 0,
        audioContextCount: 1,
        micStreamCount: mDiag?.streamActive ? 1 : 0,
        micTrackState: mDiag?.trackReadyState ?? 'none',
        micStreamActive: mDiag?.streamActive ?? false,
        sessionConnected: live?.connected ?? false,
        lastGeminiEventTime: live?.lastMessageTime ?? null,
        lastAudioChunkTime: pDiag?.lastAudioChunkTime ?? null,
        lastAudioPlaybackTime: pDiag?.lastAudioPlaybackTime ?? null,
        audioReceivingComplete: pDiag?.audioReceivingComplete ?? false,
      }));
    }, 500);

    return () => clearInterval(timer);
  }, []);

  // ─── Progress-Based Playback & Session Watchdog ─────────────
  // Does NOT cut off normal long responses (>15s) as long as audio is streaming or playing.
  // Only intervenes if zero progress occurs for >12s while in AI_SPEAKING or PROCESSING.
  useEffect(() => {
    const watchdogInterval = setInterval(() => {
      const currentState = voiceStateRef.current;
      if (currentState === VoiceState.AI_SPEAKING || currentState === VoiceState.PROCESSING) {
        const now = Date.now();
        const pDiag = playbackRef.current?.getDiagnostics?.();
        const lastMsg = sessionRef.current?.lastMessageTime ?? 0;
        const lastChunk = pDiag?.lastAudioChunkTime ?? 0;
        const lastPlayback = pDiag?.lastAudioPlaybackTime ?? 0;
        const lastProgress = Math.max(lastMsg, lastChunk, lastPlayback, turnStartTimeRef.current);
        const idleMs = now - lastProgress;

        if (idleMs > 12000) {
          const qLen = pDiag?.queueLength ?? 0;
          const activeSources = pDiag?.activeSources ?? 0;

          // Self-heal: if generation is complete and queue is fully drained, finish speaking!
          if (geminiGenerationCompleteRef.current && qLen === 0 && activeSources === 0) {
            console.warn('[WATCHDOG] Generation complete and queue drained. Auto-completing turn speaking...');
            finishSpeaking();
          } else {
            recoverStuckState(`Idle timeout in ${currentState} (${idleMs}ms without progress)`);
          }
        }
      }
    }, 1000);

    return () => clearInterval(watchdogInterval);
  }, [finishSpeaking, recoverStuckState]);

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
