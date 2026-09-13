// ============================================================
// useAudioPlayback — Streaming PCM playback with gap-free chaining
//
// Architecture:
//   Gemini audio chunk (Int16Array)
//     → enqueueChunk(pcm, generationId)
//     → validate generationId (discard stale chunks)
//     → decode to Float32 + create AudioBuffer
//     → schedule on AudioContext timeline (gapless)
//     → AudioBufferSourceNode.onended → track completion
//   markTurnComplete(generationId)
//     → once all scheduled nodes for that generation have ended
//     → fire onPlaybackComplete
//
// Rules:
//   - ONE AudioContext (persistent, never re-created per chunk)
//   - ONE scheduling timeline (nextPlayTimeRef, never reset mid-response)
//   - Chunks are played EXACTLY ONCE (no double-dispatch guard needed here
//     because geminiLive.ts now emits each chunk exactly once)
//   - stopAll() is the ONLY way to flush the pipeline (real interruptions only)
// ============================================================

import { useRef, useCallback } from 'react';
import { int16ToFloat32 } from '../services/audioProcessor';

const OUTPUT_SAMPLE_RATE = 24000; // Gemini Live native audio output rate
// Small lookahead applied only for the very first chunk of a new response.
// Subsequent chunks are chained with zero gap using the scheduled end time.
const FIRST_CHUNK_LOOKAHEAD_S = 0.05;

const DEBUG_AUDIO = import.meta.env.DEV;

interface PlaybackOptions {
  onPlaybackStart?: () => void;
  onPlaybackComplete?: () => void;
  onAnalyserData?: (data: Uint8Array) => void;
  onFirstAudioPlayback?: (generationId: number) => void;
}

export function useAudioPlayback(options: PlaybackOptions = {}) {
  const { onPlaybackStart, onPlaybackComplete, onAnalyserData, onFirstAudioPlayback } = options;

  // ── Single persistent AudioContext ───────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserFrameRef = useRef<number | null>(null);

  // ── Scheduling state ─────────────────────────────────────
  // nextPlayTimeRef: the AudioContext time at which the next chunk should start.
  // Never reset this mid-response — only reset after stopAll() or when a
  // completely new response begins (i.e. after the previous generation ends).
  const nextPlayTimeRef = useRef<number>(0);

  // ── Playback lifecycle state ──────────────────────────────
  const isPlayingRef = useRef(false);
  // Count of scheduled nodes that have not yet fired onended
  const pendingSourceCountRef = useRef(0);
  // Whether the turn is complete (no more chunks expected for current gen)
  const turnCompleteRef = useRef(false);
  // The generation ID for which turnComplete was received
  const turnCompleteGenRef = useRef(-1);
  // Guard against firing completion multiple times for the same turn
  const turnCompletedFiredRef = useRef(false);

  // ── Active AudioBufferSourceNodes (for stopAll) ───────────
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // ── Current accepted generation ──────────────────────────
  // Chunks with a different generationId are discarded (stale barge-in audio).
  const currentGenerationRef = useRef<number>(-1);

  // ── Debug counters ────────────────────────────────────────
  const chunkPlayedCountRef = useRef(0);

  // ─────────────────────────────────────────────────────────
  // AudioContext — create once, reuse forever
  // ─────────────────────────────────────────────────────────
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      // Set up analyser for visualisation
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyser.connect(audioCtxRef.current.destination);
      analyserRef.current = analyser;
    }
    return audioCtxRef.current;
  }, []);

  /**
   * Pre-warm AudioContext inside a user gesture (e.g. click "Talk with AI").
   * Guarantees context is resumed ahead of receiving Gemini's first audio chunk.
   */
  const prewarmAudioContext = useCallback(async (): Promise<void> => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (err) {
      console.warn('[useAudioPlayback] prewarmAudioContext error:', err);
    }
  }, [getAudioContext]);

  // ─────────────────────────────────────────────────────────
  // Analyser loop (visualisation only — does NOT control playback)
  // ─────────────────────────────────────────────────────────
  const startAnalyserLoop = useCallback(() => {
    if (!analyserRef.current || !onAnalyserData) return;
    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const loop = () => {
      analyser.getByteFrequencyData(data);
      onAnalyserData(data);
      analyserFrameRef.current = requestAnimationFrame(loop);
    };
    if (!analyserFrameRef.current) {
      analyserFrameRef.current = requestAnimationFrame(loop);
    }
  }, [onAnalyserData]);

  const stopAnalyserLoop = useCallback(() => {
    if (analyserFrameRef.current) {
      cancelAnimationFrame(analyserFrameRef.current);
      analyserFrameRef.current = null;
    }
  }, []);

  // ─────────────────────────────────────────────────────────
  // Internal: check whether all audio for the current generation has finished
  // Single completion condition:
  // turnComplete === true AND pendingSourceCount === 0 AND not already handled
  // ─────────────────────────────────────────────────────────
  const checkPlaybackCompletion = useCallback(() => {
    if (
      turnCompleteRef.current &&
      pendingSourceCountRef.current === 0 &&
      !turnCompletedFiredRef.current
    ) {
      turnCompletedFiredRef.current = true;
      console.log('[AUDIO] playback complete');
      isPlayingRef.current = false;
      stopAnalyserLoop();
      nextPlayTimeRef.current = 0;
      onPlaybackComplete?.();
    }
  }, [stopAnalyserLoop, onPlaybackComplete]);

  // ─────────────────────────────────────────────────────────
  // enqueueChunk — the ONE entry point for audio data
  //
  // Called for every received Gemini audio chunk.
  // Schedules it on the Web Audio timeline for gapless playback.
  // ─────────────────────────────────────────────────────────
  const enqueueChunk = useCallback(
    (pcm: Int16Array, generationId: number) => {
      // ── Stale generation check ──────────────────────────
      if (generationId < currentGenerationRef.current && currentGenerationRef.current !== -1) {
        if (DEBUG_AUDIO) {
          console.log(
            `[DISCARD] stale chunk generation=${generationId} current=${currentGenerationRef.current}`
          );
        }
        return;
      }

      // ── Accept new generation or new response turn ────────
      if (
        generationId > currentGenerationRef.current ||
        currentGenerationRef.current === -1 ||
        turnCompletedFiredRef.current
      ) {
        // A new generation starts — reset scheduling so this chunk
        // begins playback promptly, not at the end of a previous response.
        currentGenerationRef.current = generationId;
        chunkPlayedCountRef.current = 0;
        turnCompleteRef.current = false;
        turnCompletedFiredRef.current = false;
        turnCompleteGenRef.current = -1;
        // Reset scheduled time so first chunk gets the lookahead
        nextPlayTimeRef.current = 0;
        if (DEBUG_AUDIO) {
          console.log(`[NEW GEN] generation=${generationId}`);
        }
      }

      const ctx = getAudioContext();

      // Resume context if suspended (mobile browsers require user gesture)
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const float32 = int16ToFloat32(pcm);
      const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Connect through analyser for visualisation
      if (analyserRef.current) {
        source.connect(analyserRef.current);
      } else {
        source.connect(ctx.destination);
      }

      // ── Gapless scheduling ──────────────────────────────
      // For the FIRST chunk of a response, apply a tiny lookahead so the
      // AudioContext has time to prepare the buffer.
      // For ALL subsequent chunks, chain exactly to the end of the previous.
      const isFirstChunk = nextPlayTimeRef.current <= ctx.currentTime;
      const startTime = isFirstChunk
        ? ctx.currentTime + FIRST_CHUNK_LOOKAHEAD_S
        : nextPlayTimeRef.current;

      const chunkDuration = float32.length / OUTPUT_SAMPLE_RATE;
      source.start(startTime);
      nextPlayTimeRef.current = startTime + chunkDuration;

      chunkPlayedCountRef.current++;
      pendingSourceCountRef.current++;
      activeSourcesRef.current.push(source);

      const chunkNum = chunkPlayedCountRef.current;
      if (DEBUG_AUDIO) {
        console.log(
          `[PLAY] generation=${generationId} chunk=${chunkNum} ` +
          `startAt=${startTime.toFixed(3)}s duration=${chunkDuration.toFixed(3)}s ` +
          `nextAt=${nextPlayTimeRef.current.toFixed(3)}s`
        );
      }

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        pendingSourceCountRef.current = Math.max(0, pendingSourceCountRef.current - 1);

        if (DEBUG_AUDIO) {
          console.log(
            `[END] generation=${generationId} chunk=${chunkNum} pending=${pendingSourceCountRef.current}`
          );
        }

        checkPlaybackCompletion();
      };

      // ── Playback lifecycle ──────────────────────────────
      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        startAnalyserLoop();
        onPlaybackStart?.();
        onFirstAudioPlayback?.(generationId);
      }
    },
    [getAudioContext, startAnalyserLoop, checkPlaybackCompletion, onPlaybackStart, onFirstAudioPlayback]
  );

  // ─────────────────────────────────────────────────────────
  // markTurnComplete — called when Gemini signals end of generation
  //
  // Does NOT stop audio. Marks that no more chunks are coming,
  // then lets onended callbacks naturally finish the pipeline.
  // ─────────────────────────────────────────────────────────
  const markTurnComplete = useCallback(
    (generationId: number) => {
      turnCompleteRef.current = true;
      turnCompleteGenRef.current = generationId;

      if (DEBUG_AUDIO) {
        console.log(
          `[TURN COMPLETE] generation=${generationId} pending=${pendingSourceCountRef.current}`
        );
      }

      // If all sources already ended (or 0 sources scheduled), fire completion immediately
      if (pendingSourceCountRef.current === 0) {
        checkPlaybackCompletion();
        return;
      }

      if (generationId !== currentGenerationRef.current && currentGenerationRef.current !== -1) {
        // Stale turnComplete — ignore
        if (DEBUG_AUDIO) {
          console.log(
            `[TURN COMPLETE STALE] generation=${generationId} current=${currentGenerationRef.current}`
          );
        }
        return;
      }

      checkPlaybackCompletion();
    },
    [checkPlaybackCompletion]
  );

  // ─────────────────────────────────────────────────────────
  // stopAll — ONLY for genuine user interruptions or session teardown
  //
  // Immediately halts all scheduled audio and resets the pipeline.
  // ─────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    if (DEBUG_AUDIO) {
      console.log(
        `[STOP ALL] generation=${currentGenerationRef.current} pending=${pendingSourceCountRef.current}`
      );
    }

    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // already stopped — ignore
      }
    }
    activeSourcesRef.current = [];
    pendingSourceCountRef.current = 0;
    turnCompleteRef.current = false;
    turnCompleteGenRef.current = -1;
    turnCompletedFiredRef.current = false;

    const ctx = audioCtxRef.current;
    nextPlayTimeRef.current = ctx ? ctx.currentTime : 0;

    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      stopAnalyserLoop();
      // Note: we do NOT call onPlaybackComplete here — this is an interruption,
      // not a natural end. The caller (useGeminiLive) handles state transition.
    }
  }, [stopAnalyserLoop]);

  // ─────────────────────────────────────────────────────────
  // acceptGeneration — call when starting a barge-in so new chunks
  // from the next generation are accepted immediately
  // ─────────────────────────────────────────────────────────
  const acceptGeneration = useCallback((generationId: number) => {
    currentGenerationRef.current = generationId;
    chunkPlayedCountRef.current = 0;
    turnCompleteRef.current = false;
    turnCompleteGenRef.current = -1;
    nextPlayTimeRef.current = 0;
  }, []);

  /**
   * Get the AnalyserNode for external visualisation.
   */
  const getAnalyser = useCallback((): AnalyserNode | null => {
    return analyserRef.current;
  }, []);

  const isPlaying = () => isPlayingRef.current;

  /**
   * Clean up audio context on unmount.
   */
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
    stopAll,
    acceptGeneration,
    getAnalyser,
    isPlaying,
    dispose,
    getAudioContext,
    prewarmAudioContext,
  };
}
