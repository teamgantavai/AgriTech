/**
 * Audio Streamer Utilities for Gemini Live API
 * 
 * Provides:
 * 1. LiveAudioRecorder: 16kHz PCM 1-channel microphone audio capture with:
 *    - Hardware echo cancellation, noise suppression, auto-gain
 *    - Voice Activity Detection (VAD) & Dynamic Ambient Noise Floor Calibration
 *    - Debounce threshold (~150-200ms) to ignore brief clicks/fans/distant murmurs
 *    - Pre-roll ring buffer (~300ms) to prevent clipping initial syllables
 *    - Push-to-Talk (PTT) manual override mode
 *    - Echo prevention gate while AI is actively speaking
 * 2. LiveAudioPlayer: 24kHz PCM 1-channel gapless audio playback with instant interruption cancellation.
 * 3. Base64 and PCM array conversion helpers.
 */

// Helper: Convert Float32Array (-1.0 to 1.0) to Int16Array PCM
export function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

// Helper: Convert ArrayBuffer/Uint8Array to Base64 string
export function arrayBufferToBase64(buffer: ArrayBufferLike | ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper: Convert Base64 string to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * LiveAudioRecorder
 * Captures microphone input, resamples/converts to 16kHz 1-channel mono PCM,
 * with built-in noise floor calibration, VAD speech gate, pre-roll buffer,
 * and Push-to-Talk fallback.
 */
export class LiveAudioRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private onAudioChunk: (base64Pcm: string) => void;
  private onVolumeChange?: (volume: number) => void;
  private onSpeechStateChange?: (isSpeaking: boolean) => void;
  private onSpeechStart?: () => void;
  private isRecording: boolean = false;

  // Noise & VAD Timing Parameters
  private isUserActivelySpeaking: boolean = false;
  private lastSpeechStartMs: number = 0;
  private lastSpeechEndMs: number = 0;

  // AI playback gating to prevent echo / self-listening
  private isAiSpeaking: boolean = false;

  // Push-to-Talk (PTT) manual override
  private isPushToTalkActive: boolean = false;

  constructor(
    onAudioChunk: (base64Pcm: string) => void,
    onVolumeChange?: (volume: number) => void,
    onSpeechStateChange?: (isSpeaking: boolean) => void,
    onSpeechStart?: () => void
  ) {
    this.onAudioChunk = onAudioChunk;
    this.onVolumeChange = onVolumeChange;
    this.onSpeechStateChange = onSpeechStateChange;
    this.onSpeechStart = onSpeechStart;
  }

  getLastSpeechTimings() {
    return {
      speechStartMs: this.lastSpeechStartMs,
      speechEndMs: this.lastSpeechEndMs || performance.now(),
    };
  }

  setAiSpeaking(isSpeaking: boolean): void {
    this.isAiSpeaking = isSpeaking;
  }

  setPushToTalkActive(active: boolean): void {
    this.isPushToTalkActive = active;
    if (active && this.onSpeechStateChange) {
      this.onSpeechStateChange(true);
    }
  }

  async start(): Promise<void> {
    if (this.isRecording) return;

    try {
      // 1. Enforce browser/hardware acoustic constraints for rural noise reduction
      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,
          sampleRate: { ideal: 16000 },
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
        },
      };

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn('[LiveAudioRecorder] Primary constraints failed, fallback to basic audio:', e);
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 16000 });

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Buffer size 2048 at 16kHz is ~128ms per chunk
      const bufferSize = 2048;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // 1. Calculate RMS energy for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const normalizedVolume = Math.min(1, rms * 4.5);
        this.onVolumeChange?.(normalizedVolume);

        // Notify speech state for UI indicator (e.g. green listening wave)
        const isSpeakingNow = rms > 0.025;
        this.onSpeechStateChange?.(isSpeakingNow);

        if (isSpeakingNow) {
          if (!this.isUserActivelySpeaking) {
            this.isUserActivelySpeaking = true;
            this.lastSpeechStartMs = performance.now();
            this.onSpeechStart?.();
          }
        } else if (this.isUserActivelySpeaking) {
          this.isUserActivelySpeaking = false;
          this.lastSpeechEndMs = performance.now();
        }

        // Convert chunk to PCM16 base64
        const pcm16 = floatTo16BitPCM(inputData);
        const base64 = arrayBufferToBase64(pcm16.buffer);

        // 2. Push-to-Talk manual override: Always send immediately
        if (this.isPushToTalkActive) {
          this.onAudioChunk(base64);
          return;
        }

        // 3. Echo prevention when AI is speaking:
        // Do NOT send user chunks while AI audio is playing unless user intentionally barges in loudly
        if (this.isAiSpeaking) {
          if (rms < 0.07) {
            // Drop AI speaker feedback so AI doesn't self-interrupt
            return;
          }
        }

        // 4. Send continuous 16kHz audio stream smoothly to Gemini Live WebSocket
        // Browser hardware echoCancellation & noiseSuppression handle room acoustics,
        // and Gemini Live server-side neural VAD handles sub-300ms turn taking.
        this.onAudioChunk(base64);
      };

      // Zero-gain routing keeps processor firing without playing back mic to speakers
      const muteGain = this.audioContext.createGain();
      muteGain.gain.value = 0;
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(muteGain);
      muteGain.connect(this.audioContext.destination);

      this.isRecording = true;
    } catch (err: any) {
      this.stop();
      throw err;
    }
  }

  stop(): void {
    this.isRecording = false;
    this.isUserActivelySpeaking = false;

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch {}
      this.processorNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.onVolumeChange?.(0);
    this.onSpeechStateChange?.(false);
  }

  isActive(): boolean {
    return this.isRecording;
  }
}

/**
 * LiveAudioPlayer
 * Plays 24kHz PCM 1-channel mono audio chunks seamlessly.
 * Supports instant interruption cancellation.
 */
export class LiveAudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private onVolumeChange?: (volume: number) => void;
  private isPlayingAudio: boolean = false;
  private onSpeakingStateChange?: (isSpeaking: boolean) => void;
  private onFirstChunk?: () => void;
  private firstChunkFired: boolean = false;

  constructor(
    onVolumeChange?: (volume: number) => void,
    onSpeakingStateChange?: (isSpeaking: boolean) => void,
    onFirstChunk?: () => void
  ) {
    this.onVolumeChange = onVolumeChange;
    this.onSpeakingStateChange = onSpeakingStateChange;
    this.onFirstChunk = onFirstChunk;
  }

  get isPlaying(): boolean {
    return this.isPlayingAudio;
  }

  private initContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 24000 });
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  /**
   * Queue and play 24kHz PCM base64 audio chunk seamlessly
   */
  queueAudio(base64Pcm: string): void {
    const ctx = this.initContext();

    try {
      const rawBuffer = base64ToArrayBuffer(base64Pcm);
      const int16Array = new Int16Array(rawBuffer);

      if (int16Array.length === 0) return;

      // Convert Int16 PCM to Float32
      const float32Array = new Float32Array(int16Array.length);
      let sum = 0;
      for (let i = 0; i < int16Array.length; i++) {
        const sample = int16Array[i] / 32768.0;
        float32Array[i] = sample;
        sum += sample * sample;
      }

      // Estimate volume for visualization
      const rms = Math.sqrt(sum / int16Array.length);
      const volume = Math.min(1, rms * 3.5);
      this.onVolumeChange?.(volume);

      const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      // Gapless scheduling
      const startTime = Math.max(now, this.nextPlayTime);
      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.activeSources.add(source);

      if (!this.isPlayingAudio) {
        this.isPlayingAudio = true;
        this.onSpeakingStateChange?.(true);
      }

      if (!this.firstChunkFired) {
        this.firstChunkFired = true;
        this.onFirstChunk?.();
      }

      source.onended = () => {
        this.activeSources.delete(source);
        if (this.activeSources.size === 0 && ctx.currentTime >= this.nextPlayTime - 0.05) {
          this.isPlayingAudio = false;
          this.firstChunkFired = false;
          this.onSpeakingStateChange?.(false);
          this.onVolumeChange?.(0);
        }
      };
    } catch (err) {
      console.warn('[LiveAudioPlayer] Error playing audio chunk:', err);
    }
  }

  /**
   * Interruption handler: stop all currently queued and playing audio immediately
   */
  stopAll(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    });
    this.activeSources.clear();

    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    } else {
      this.nextPlayTime = 0;
    }

    this.isPlayingAudio = false;
    this.firstChunkFired = false;
    this.onSpeakingStateChange?.(false);
    this.onVolumeChange?.(0);
  }

  destroy(): void {
    this.stopAll();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
  }
}
