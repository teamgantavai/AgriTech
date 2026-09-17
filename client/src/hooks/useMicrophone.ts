// ============================================================
// useMicrophone — Microphone capture + audio pipeline
// ============================================================

import { useRef, useCallback } from 'react';
import { float32ToInt16, downsample, int16ToBase64 } from '../services/audioProcessor';
import { useVoiceActivity } from './useVoiceActivity';

const MIC_SAMPLE_RATE = 16000; // Gemini Live input rate
const CHUNK_DURATION_MS = 100;  // Send 100ms chunks for low latency

interface MicrophoneOptions {
  onAudioChunk: (base64: string) => void;
  onVADChange?: (isSpeech: boolean, rms: number) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (err: Error) => void;
  isInputLocked?: () => boolean;
  onPermissionRequest?: () => void;
  onPermissionGranted?: () => void;
  onAudioContextCreated?: () => void;
  onVADInitialized?: () => void;
}

export function useMicrophone(options: MicrophoneOptions) {
  const {
    onAudioChunk,
    onVADChange,
    onSpeechStart,
    onSpeechEnd,
    onError,
    isInputLocked,
    onPermissionRequest,
    onPermissionGranted,
    onAudioContextCreated,
    onVADInitialized,
  } = options;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isActiveRef = useRef(false);
  const nativeSampleRateRef = useRef(44100);
  const workletLoadedRef = useRef(false);

  const vad = useVoiceActivity({
    threshold: 0.012,
    silenceMs: 650,
    activityMs: 120,
    onSpeechStart: () => optionsRef.current.onSpeechStart?.(),
    onSpeechEnd: () => optionsRef.current.onSpeechEnd?.(),
    onActivity: (rms, isSpeech) => optionsRef.current.onVADChange?.(isSpeech, rms),
  });

  const start = useCallback(async (): Promise<void> => {
    if (isActiveRef.current) return;

    try {
      onPermissionRequest?.();

      // Reuse existing media stream if tracks are still active
      let stream = streamRef.current;
      if (!stream || !stream.getTracks().some((t) => t.readyState === 'live')) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: { ideal: MIC_SAMPLE_RATE },
          },
          video: false,
        });
        streamRef.current = stream;
      }

      onPermissionGranted?.();

      let ctx = audioCtxRef.current;
      if (!ctx || ctx.state === 'closed') {
        ctx = new AudioContext();
        nativeSampleRateRef.current = ctx.sampleRate;
        audioCtxRef.current = ctx;
        workletLoadedRef.current = false;
        onAudioContextCreated?.();
      } else if (ctx.state === 'suspended') {
        await ctx.resume();
        onAudioContextCreated?.();
      }

      // Load AudioWorklet processor only once per AudioContext
      if (!workletLoadedRef.current) {
        await ctx.audioWorklet.addModule('/mic-worklet.js');
        workletLoadedRef.current = true;
      }

      // Disconnect previous nodes if any
      try {
        sourceNodeRef.current?.disconnect();
        workletNodeRef.current?.disconnect();
      } catch {
        // ignore
      }

      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const workletNode = new AudioWorkletNode(ctx, 'microphone-processor');
      workletNodeRef.current = workletNode;

      // Accumulate samples until we have CHUNK_DURATION_MS worth
      const samplesPerChunk = Math.floor((MIC_SAMPLE_RATE * CHUNK_DURATION_MS) / 1000);
      let accumulatedSamples: Float32Array[] = [];
      let accumulatedLength = 0;

      workletNode.port.onmessage = (event) => {
        if (!isActiveRef.current) return;
        const { samples } = event.data as { samples: Float32Array };

        // If input is locked (AI speaking or processing) or track is muted, discard audio and pause VAD
        if (
          optionsRef.current.isInputLocked?.() ||
          streamRef.current?.getAudioTracks().some((t) => !t.enabled)
        ) {
          accumulatedSamples = [];
          accumulatedLength = 0;
          return;
        }

        // Downsample from native rate to 16 kHz if needed
        const downsampled =
          nativeSampleRateRef.current !== MIC_SAMPLE_RATE
            ? downsample(samples, nativeSampleRateRef.current, MIC_SAMPLE_RATE)
            : samples;

        accumulatedSamples.push(downsampled);
        accumulatedLength += downsampled.length;

        while (accumulatedLength >= samplesPerChunk) {
          // Merge accumulated samples
          const merged = new Float32Array(accumulatedLength);
          let offset = 0;
          for (const s of accumulatedSamples) {
            merged.set(s, offset);
            offset += s.length;
          }

          const chunk = merged.slice(0, samplesPerChunk);
          const remainder = merged.slice(samplesPerChunk);
          accumulatedSamples = remainder.length ? [remainder] : [];
          accumulatedLength = remainder.length;

          // Double check input lock before processing VAD or sending
          if (optionsRef.current.isInputLocked?.()) {
            return;
          }

          // VAD check
          vad.processChunk(chunk);

          // Forward PCM audio chunk to Gemini
          const int16 = float32ToInt16(chunk);
          const base64 = int16ToBase64(int16);
          optionsRef.current.onAudioChunk(base64);
        }
      };

      source.connect(workletNode);
      // Do NOT connect workletNode to ctx.destination — we don't want to hear ourselves

      isActiveRef.current = true;
      vad.reset();
      onVADInitialized?.();
    } catch (err: any) {
      console.error('[useMicrophone] Start error:', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [
    onAudioChunk,
    vad,
    onError,
    isInputLocked,
    onPermissionRequest,
    onPermissionGranted,
    onAudioContextCreated,
    onVADInitialized,
  ]);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    vad.reset();

    try {
      workletNodeRef.current?.port.close();
      workletNodeRef.current?.disconnect();
    } catch { /* ignore */ }
    workletNodeRef.current = null;

    try {
      sourceNodeRef.current?.disconnect();
    } catch { /* ignore */ }
    sourceNodeRef.current = null;

    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch { /* ignore */ }
    streamRef.current = null;

    try {
      audioCtxRef.current?.close();
    } catch { /* ignore */ }
    audioCtxRef.current = null;
  }, [vad]);

  const mute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
    vad.reset();
  }, [vad]);

  const unmute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }
    vad.reset();
  }, [vad]);

  const isMuted = useCallback(() => {
    if (!streamRef.current) return true;
    return streamRef.current.getAudioTracks().every((track) => !track.enabled);
  }, []);

  const getVADState = useCallback(() => vad.getState(), [vad]);

  const resetVAD = useCallback(() => {
    vad.reset();
  }, [vad]);

  const getDiagnostics = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()?.[0];
    return {
      streamActive: streamRef.current?.active ?? false,
      trackReadyState: (track?.readyState ?? 'none') as 'live' | 'ended' | 'muted' | 'none',
      audioContextState: (audioCtxRef.current?.state ?? 'closed') as 'running' | 'suspended' | 'closed',
      isActive: isActiveRef.current,
      isMuted: isMuted(),
    };
  }, [isMuted]);

  const ensureHealthyTrack = useCallback(async (): Promise<boolean> => {
    if (!isActiveRef.current) return false;
    const track = streamRef.current?.getAudioTracks()?.[0];
    if (!streamRef.current || !track || track.readyState === 'ended') {
      console.warn('[Microphone] Audio track ended unexpectedly, recovering...');
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: { ideal: MIC_SAMPLE_RATE },
          },
          video: false,
        });
        streamRef.current = newStream;
        if (audioCtxRef.current && workletNodeRef.current) {
          sourceNodeRef.current?.disconnect();
          const newSource = audioCtxRef.current.createMediaStreamSource(newStream);
          sourceNodeRef.current = newSource;
          newSource.connect(workletNodeRef.current);
        }
        return true;
      } catch (e) {
        console.error('[Microphone] Failed to recover audio track:', e);
        return false;
      }
    }
    return true;
  }, []);

  return { start, stop, mute, unmute, isMuted, getVADState, resetVAD, getDiagnostics, ensureHealthyTrack };
}
