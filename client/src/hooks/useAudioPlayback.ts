// ============================================================
// useAudioPlayback — Resilient Streaming PCM Playback Manager
//
// Pipeline Architecture:
//   Gemini Live chunk (Int16Array PCM 24kHz)
//     → enqueueChunk(pcm, generationId, turnId)
//     → In-Memory Audio Queue (audioQueueRef)
//     → Resilient Playback Scheduler (drainQueue loop with try/catch/finally)
//     → Persistent AudioContext (with auto-resume and recovery)
//     → Gapless AudioBufferSourceNode scheduling on Web Audio timeline
//     → AudioBufferSourceNode.onended → active source cleanup
//   markTurnComplete(generationId, turnId)
//     → waits for queue to drain and all active sources to finish
//     → watchdog safety timer guards against throttled onended callbacks
//     → fires onPlaybackComplete exactly once per turn
// ============================================================

import { useRef, useCallback, useEffect } from 'react';
import { int16ToFloat32 } from '../services/audioProcessor';
import { voiceManager } from '../services/VoiceSessionManager';

const OUTPUT_SAMPLE_RATE = 24000; // Gemini Live native audio output rate
const FIRST_CHUNK_LOOKAHEAD_S = 0.05; // 50ms lookahead for initial chunk
const WATCHDOG_MARGIN_MS = 2500; // Safety watchdog margin

interface PlaybackOptions {
  onPlaybackStart?: () => void;
  onPlaybackComplete?: () => void;
  onAnalyserData?: (data: Uint8Array) => void;
  onFirstAudioPlayback?: (generationId: number) => void;
}

interface AudioQueueItem {
  pcm: Int16Array;
  generationId: number;
  turnId: number;
  chunkId: number;
  speechId?: string;
}

export function useAudioPlayback(options: PlaybackOptions = {}) {
  // Store options in ref to avoid stale closures across re-renders
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ── Single persistent AudioContext ───────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserFrameRef = useRef<number | null>(null);

  // ── Audio Queue & Scheduler state ─────────────────────────
  const audioQueueRef = useRef<AudioQueueItem[]>([]);
  const isPlaybackLoopRunningRef = useRef(false);
  const nextPlayTimeRef = useRef<number>(0);

  // ── Playback lifecycle state ──────────────────────────────
  const isPlayingRef = useRef(false);
  const pendingSourceCountRef = useRef(0);
  const turnCompleteRef = useRef(false);
  const turnCompleteGenRef = useRef(-1);
  const turnCompletedFiredRef = useRef(false);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Active AudioBufferSourceNodes (for tracking and stopAll)
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // ── Generation and turn tracking ──────────────────────────
  const currentGenerationRef = useRef<number>(-1);
  const currentTurnIdRef = useRef<number>(1);
  const receivedChunksCountRef = useRef<number>(0);
  const playedChunksCountRef = useRef<number>(0);

  // ── Progress & Health Timestamps ──────────────────────────
  const lastAudioChunkTimeRef = useRef<number>(0);
  const lastAudioPlaybackTimeRef = useRef<number>(0);
  const audioReceivingCompleteRef = useRef<boolean>(false);

  // ─────────────────────────────────────────────────────────
  // AudioContext — persistent lifecycle with recovery
  // ─────────────────────────────────────────────────────────
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      console.log('[AudioPlayback] Initializing new AudioContext (sampleRate=24000)');
      audioCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });

      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyser.connect(audioCtxRef.current.destination);
      analyserRef.current = analyser;
    }
    return audioCtxRef.current;
  }, []);

  /**
   * Pre-warm AudioContext inside a user gesture.
   */
  const prewarmAudioContext = useCallback(async (): Promise<void> => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
        console.log('[AudioPlayback] AudioContext pre-warmed & resumed');
      }
    } catch (err) {
      console.warn('[AudioPlayback] prewarmAudioContext warning:', err);
    }
  }, [getAudioContext]);

  // ─────────────────────────────────────────────────────────
  // Analyser loop (visualisation only)
  // ─────────────────────────────────────────────────────────
  const startAnalyserLoop = useCallback(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const loop = () => {
      analyser.getByteFrequencyData(data);
      optionsRef.current.onAnalyserData?.(data);
      analyserFrameRef.current = requestAnimationFrame(loop);
    };

    if (!analyserFrameRef.current) {
      analyserFrameRef.current = requestAnimationFrame(loop);
    }
  }, []);

  const stopAnalyserLoop = useCallback(() => {
    if (analyserFrameRef.current) {
      cancelAnimationFrame(analyserFrameRef.current);
      analyserFrameRef.current = null;
    }
  }, []);

  // ─────────────────────────────────────────────────────────
  // Clear safety watchdog timer
  // ─────────────────────────────────────────────────────────
  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  // ─────────────────────────────────────────────────────────
  // Check Playback Completion
  // Fired when:
  // 1. turnComplete / audioReceivingComplete is true
  // 2. pendingSourceCount === 0 AND activeSources is empty
  // 3. audioQueue is empty
  // 4. completion hasn't already fired for this turn
  // ─────────────────────────────────────────────────────────
  const checkPlaybackCompletion = useCallback(() => {
    const isReceivingDone = turnCompleteRef.current || audioReceivingCompleteRef.current;
    if (
      isReceivingDone &&
      pendingSourceCountRef.current === 0 &&
      activeSourcesRef.current.length === 0 &&
      audioQueueRef.current.length === 0 &&
      !turnCompletedFiredRef.current
    ) {
      turnCompletedFiredRef.current = true;
      clearWatchdog();
      isPlayingRef.current = false;
      stopAnalyserLoop();
      nextPlayTimeRef.current = 0;
      activeSourcesRef.current = [];

      console.log(
        `[TURN ${currentTurnIdRef.current}] audio playback completed (received=${receivedChunksCountRef.current}, played=${playedChunksCountRef.current})`
      );
      console.log(
        `[QUEUE] received=${receivedChunksCountRef.current} played=${playedChunksCountRef.current} remaining=0`
      );

      optionsRef.current.onPlaybackComplete?.();
    }
  }, [clearWatchdog, stopAnalyserLoop]);

  // Register singleton audio player with VoiceSessionManager
  useEffect(() => {
    const unregister = voiceManager.registerAudioPlayer();
    return () => unregister();
  }, []);

  // ─────────────────────────────────────────────────────────
  // stopAll — Flush audio for interruption or teardown
  // ─────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    clearWatchdog();
    audioQueueRef.current = [];

    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // already stopped
      }
    }
    activeSourcesRef.current = [];
    pendingSourceCountRef.current = 0;
    turnCompleteRef.current = false;
    audioReceivingCompleteRef.current = false;
    turnCompleteGenRef.current = -1;
    turnCompletedFiredRef.current = false;
    isPlaybackLoopRunningRef.current = false;

    const ctx = audioCtxRef.current;
    nextPlayTimeRef.current = ctx ? ctx.currentTime : 0;

    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      stopAnalyserLoop();
    }
  }, [clearWatchdog, stopAnalyserLoop]);

  // ─────────────────────────────────────────────────────────
  // Resilient Playback Scheduler Loop
  // Drains audioQueueRef and schedules chunks onto AudioContext timeline
  // ─────────────────────────────────────────────────────────
  const drainQueue = useCallback(async () => {
    if (isPlaybackLoopRunningRef.current) return;
    if (audioQueueRef.current.length === 0) {
      checkPlaybackCompletion();
      return;
    }

    isPlaybackLoopRunningRef.current = true;

    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (e) {
          console.warn('[AudioPlayback] Failed to resume AudioContext:', e);
        }
      }

      while (audioQueueRef.current.length > 0) {
        const item = audioQueueRef.current.shift()!;

        // Validate speech ID — discard if superseded or cancelled
        if (item.speechId && !voiceManager.isSpeechValid(item.speechId)) {
          console.warn(`[AudioPlayback] Discarding queued chunk from cancelled speech ${item.speechId}`);
          continue;
        }

        const float32 = int16ToFloat32(item.pcm);

        const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
        buffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        if (analyserRef.current) {
          source.connect(analyserRef.current);
        } else {
          source.connect(ctx.destination);
        }

        // Gapless scheduling
        const isFirstChunk = nextPlayTimeRef.current <= ctx.currentTime;
        const startTime = isFirstChunk
          ? ctx.currentTime + FIRST_CHUNK_LOOKAHEAD_S
          : nextPlayTimeRef.current;

        const chunkDuration = float32.length / OUTPUT_SAMPLE_RATE;
        source.start(startTime);
        nextPlayTimeRef.current = startTime + chunkDuration;

        lastAudioPlaybackTimeRef.current = Date.now();
        playedChunksCountRef.current++;
        pendingSourceCountRef.current++;
        activeSourcesRef.current.push(source);

        // Trigger playback start lifecycle on first chunk
        if (!isPlayingRef.current) {
          isPlayingRef.current = true;
          startAnalyserLoop();
          console.log(`[TURN ${item.turnId}] audio playback started`);
          optionsRef.current.onPlaybackStart?.();
          optionsRef.current.onFirstAudioPlayback?.(item.generationId);
        }

        source.onended = () => {
          try {
            source.disconnect();
          } catch {
            // ignore
          }
          lastAudioPlaybackTimeRef.current = Date.now();
          activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
          pendingSourceCountRef.current = Math.max(0, pendingSourceCountRef.current - 1);

          checkPlaybackCompletion();
        };
      }
    } catch (error) {
      console.error('[AudioPlayback] Error in scheduler loop:', error);
    } finally {
      isPlaybackLoopRunningRef.current = false;

      // Self-healing: if more audio entered the queue while running, restart loop
      if (audioQueueRef.current.length > 0) {
        setTimeout(() => {
          drainQueue();
        }, 0);
      } else {
        checkPlaybackCompletion();
      }
    }
  }, [getAudioContext, startAnalyserLoop, checkPlaybackCompletion]);

  // ─────────────────────────────────────────────────────────
  // enqueueChunk — The entry point for incoming Gemini audio
  // ─────────────────────────────────────────────────────────
  const enqueueChunk = useCallback(
    (pcm: Int16Array, generationId: number, turnId?: number, speechId?: string) => {
      // Discard older generation chunks
      if (
        generationId < currentGenerationRef.current &&
        currentGenerationRef.current !== -1 &&
        !turnCompletedFiredRef.current
      ) {
        return;
      }

      // Discard chunks from cancelled speech
      if (speechId && !voiceManager.isSpeechValid(speechId)) {
        return;
      }

      const activeTurn = turnId ?? currentTurnIdRef.current;
      currentTurnIdRef.current = activeTurn;

      // If a newer generation arrives while an older one was playing, stop prior playback immediately
      if (generationId > currentGenerationRef.current && currentGenerationRef.current !== -1 && isPlayingRef.current) {
        console.log(`[AudioPlayback] Superseding generation ${currentGenerationRef.current} with ${generationId}`);
        stopAll();
      }

      // If a new generation begins or turnCompleted previously fired, synchronize
      if (
        generationId > currentGenerationRef.current ||
        currentGenerationRef.current === -1 ||
        turnCompletedFiredRef.current
      ) {
        currentGenerationRef.current = generationId;
        turnCompleteRef.current = false;
        audioReceivingCompleteRef.current = false;
        turnCompletedFiredRef.current = false;
        turnCompleteGenRef.current = -1;
        receivedChunksCountRef.current = 0;
        playedChunksCountRef.current = 0;
        nextPlayTimeRef.current = 0;
      }

      lastAudioChunkTimeRef.current = Date.now();
      audioReceivingCompleteRef.current = false;
      receivedChunksCountRef.current++;
      const chunkId = receivedChunksCountRef.current;

      audioQueueRef.current.push({
        pcm,
        generationId,
        turnId: activeTurn,
        chunkId,
        speechId,
      });

      // Kick scheduler
      drainQueue();
    },
    [drainQueue, stopAll]
  );

  // ─────────────────────────────────────────────────────────
  // markTurnComplete — Signals that Gemini generation ended
  // ─────────────────────────────────────────────────────────
  const markTurnComplete = useCallback(
    (generationId: number, turnId?: number) => {
      const activeTurn = turnId ?? currentTurnIdRef.current;
      turnCompleteRef.current = true;
      audioReceivingCompleteRef.current = true;
      turnCompleteGenRef.current = generationId;

      console.log(
        `[TURN ${activeTurn}] turnComplete marked (pendingSources=${pendingSourceCountRef.current}, activeSources=${activeSourcesRef.current.length}, queued=${audioQueueRef.current.length}, rx=${receivedChunksCountRef.current})`
      );

      // If nothing pending or queued, complete immediately
      if (pendingSourceCountRef.current === 0 && activeSourcesRef.current.length === 0 && audioQueueRef.current.length === 0) {
        checkPlaybackCompletion();
        return;
      }

      // Schedule watchdog safety timer
      clearWatchdog();
      const ctx = audioCtxRef.current;
      const remainingTimeS = ctx && nextPlayTimeRef.current > ctx.currentTime
        ? nextPlayTimeRef.current - ctx.currentTime
        : 1.0;
      const watchdogMs = Math.max(1500, Math.ceil(remainingTimeS * 1000) + WATCHDOG_MARGIN_MS);

      watchdogTimerRef.current = setTimeout(() => {
        if (!turnCompletedFiredRef.current && (turnCompleteRef.current || audioReceivingCompleteRef.current)) {
          console.warn(
            `[TURN ${activeTurn}] [WATCHDOG] Force completing turn playback after ${watchdogMs}ms`
          );
          // Clean up any remaining sources
          for (const s of activeSourcesRef.current) {
            try {
              s.stop();
              s.disconnect();
            } catch {
              // ignore
            }
          }
          activeSourcesRef.current = [];
          pendingSourceCountRef.current = 0;
          audioQueueRef.current = [];
          checkPlaybackCompletion();
        }
      }, watchdogMs);

      checkPlaybackCompletion();
    },
    [clearWatchdog, checkPlaybackCompletion]
  );

  // ─────────────────────────────────────────────────────────
  // resetForNewTurn — Cleanly synchronizes per-turn state
  // ─────────────────────────────────────────────────────────
  const resetForNewTurn = useCallback((turnId: number, generationId?: number) => {
    clearWatchdog();
    currentTurnIdRef.current = turnId;
    if (typeof generationId === 'number') {
      currentGenerationRef.current = generationId;
    }
    turnCompleteRef.current = false;
    audioReceivingCompleteRef.current = false;
    turnCompletedFiredRef.current = false;
    turnCompleteGenRef.current = -1;
    receivedChunksCountRef.current = 0;
    playedChunksCountRef.current = 0;
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;
    lastAudioChunkTimeRef.current = 0;
    lastAudioPlaybackTimeRef.current = 0;
  }, [clearWatchdog]);


  // ─────────────────────────────────────────────────────────
  // acceptGeneration
  // ─────────────────────────────────────────────────────────
  const acceptGeneration = useCallback((generationId: number) => {
    currentGenerationRef.current = generationId;
    turnCompleteRef.current = false;
    audioReceivingCompleteRef.current = false;
    turnCompleteGenRef.current = -1;
    turnCompletedFiredRef.current = false;
    nextPlayTimeRef.current = 0;
  }, []);

  const getAnalyser = useCallback((): AnalyserNode | null => {
    return analyserRef.current;
  }, []);

  const isPlaying = () => isPlayingRef.current;

  // ─────────────────────────────────────────────────────────
  // Diagnostics inspection
  // ─────────────────────────────────────────────────────────
  const getDiagnostics = useCallback(() => {
    const queueLen = audioQueueRef.current.length;
    const activeSources = activeSourcesRef.current.length;
    const schedulerState = isPlaybackLoopRunningRef.current
      ? ('running' as const)
      : queueLen > 0
      ? ('scheduled' as const)
      : ('idle' as const);

    return {
      audioContextState: (audioCtxRef.current?.state || 'closed') as 'running' | 'suspended' | 'closed',
      queueLength: queueLen,
      activeSources,
      schedulerState,
      chunksReceived: receivedChunksCountRef.current,
      chunksPlayed: playedChunksCountRef.current,
      chunksRemaining: queueLen + pendingSourceCountRef.current,
      lastAudioChunkTime: lastAudioChunkTimeRef.current,
      lastAudioPlaybackTime: lastAudioPlaybackTimeRef.current,
      audioReceivingComplete: turnCompleteRef.current || audioReceivingCompleteRef.current,
      isPlaying: isPlayingRef.current,
    };
  }, []);

  const dispose = useCallback(() => {
    stopAll();
    stopAnalyserLoop();
    try {
      audioCtxRef.current?.close();
    } catch {
      // ignore
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, [stopAll, stopAnalyserLoop]);

  return {
    enqueueChunk,
    markTurnComplete,
    resetForNewTurn,
    stopAll,
    acceptGeneration,
    getAnalyser,
    isPlaying,
    isAudioActive: () => audioQueueRef.current.length > 0 || activeSourcesRef.current.length > 0 || isPlayingRef.current,
    isReceivingComplete: () => turnCompleteRef.current || audioReceivingCompleteRef.current,
    getQueueLength: () => audioQueueRef.current.length,
    getActiveSourcesCount: () => activeSourcesRef.current.length,
    getLastProgressTime: () => Math.max(lastAudioChunkTimeRef.current, lastAudioPlaybackTimeRef.current),
    dispose,
    getAudioContext,
    prewarmAudioContext,
    getDiagnostics,
  };
}
