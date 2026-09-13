// ============================================================
// useVoiceActivity — Energy-based Voice Activity Detection
// ============================================================

import { useRef, useCallback } from 'react';
import { calculateRMS } from '../services/audioProcessor';

interface VADOptions {
  /** RMS threshold above which we consider speech active (0–1 scale) */
  threshold?: number;
  /** ms of silence before declaring speech ended */
  silenceMs?: number;
  /** ms of activity before declaring speech started */
  activityMs?: number;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onActivity?: (rms: number, isSpeech: boolean) => void;
}

interface VADState {
  isSpeech: boolean;
  rms: number;
}

export function useVoiceActivity(options: VADOptions = {}) {
  const {
    threshold = 0.015,
    silenceMs = 700,
    activityMs = 120,
    onSpeechStart,
    onSpeechEnd,
    onActivity,
  } = options;

  const stateRef = useRef<VADState>({ isSpeech: false, rms: 0 });
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSpeechStartRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
      activityTimerRef.current = null;
    }
  }, []);

  /**
   * Process a chunk of audio samples.
   * Returns true if chunk should be forwarded (speech detected).
   */
  const processChunk = useCallback(
    (samples: Float32Array): boolean => {
      const rms = calculateRMS(samples);
      stateRef.current.rms = rms;

      const isAboveThreshold = rms > threshold;

      if (isAboveThreshold) {
        // Clear any pending silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        if (!stateRef.current.isSpeech) {
          // Start activity confirmation timer
          if (!pendingSpeechStartRef.current) {
            pendingSpeechStartRef.current = true;
            activityTimerRef.current = setTimeout(() => {
              if (pendingSpeechStartRef.current) {
                stateRef.current.isSpeech = true;
                pendingSpeechStartRef.current = false;
                onSpeechStart?.();
              }
            }, activityMs);
          }
        }
      } else {
        // Below threshold — potential silence
        pendingSpeechStartRef.current = false;
        if (activityTimerRef.current) {
          clearTimeout(activityTimerRef.current);
          activityTimerRef.current = null;
        }

        if (stateRef.current.isSpeech && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            stateRef.current.isSpeech = false;
            silenceTimerRef.current = null;
            onSpeechEnd?.();
          }, silenceMs);
        }
      }

      onActivity?.(rms, stateRef.current.isSpeech);
      return stateRef.current.isSpeech || pendingSpeechStartRef.current;
    },
    [threshold, silenceMs, activityMs, onSpeechStart, onSpeechEnd, onActivity]
  );

  const reset = useCallback(() => {
    clearTimers();
    stateRef.current = { isSpeech: false, rms: 0 };
    pendingSpeechStartRef.current = false;
  }, [clearTimers]);

  const getState = useCallback(() => ({ ...stateRef.current }), []);

  return { processChunk, reset, getState };
}
