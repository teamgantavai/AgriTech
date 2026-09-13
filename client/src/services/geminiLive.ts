// ============================================================
// Gemini Live Service — WebSocket session wrapper
// ============================================================

import { GoogleGenAI, type Session, Modality } from '@google/genai';
import { buildSystemInstruction, loadProfile } from './sessionManager';
import { executeToolCall } from './toolManager';
import { VOICE_TOOLS } from './toolManager';
import { base64ToInt16 } from './audioProcessor';
import type { LiveSessionEvents } from '../types/session';

const OUTPUT_SAMPLE_RATE = 24000;
const DEBUG_AUDIO = import.meta.env.DEV;

export interface GeminiLiveSessionOptions {
  events: LiveSessionEvents;
  onMetric?: (key: string, value: number | boolean | string) => void;
}

export class GeminiLiveSession {
  private session: Session | null = null;
  private ai: GoogleGenAI | null = null;
  private isConnected = false;
  private isDisposed = false;
  private connectStartTime = 0;
  private firstAudioTime: number | null = null;
  private firstResponseEventFired = false;
  private events: LiveSessionEvents;
  private onMetric: ((key: string, value: number | boolean | string) => void) | undefined;

  // Debug counters
  private chunkRxCount = 0;
  private generationId = 0;

  private pendingClientContent: string[] = [];
  private pendingAudioQueue: string[] = [];

  constructor(options: GeminiLiveSessionOptions) {
    this.events = options.events;
    this.onMetric = options.onMetric;
  }

  async connect(ephemeralToken: string, model: string): Promise<void> {
    if (this.isDisposed) return;
    this.connectStartTime = Date.now();

    try {
      this.ai = new GoogleGenAI({
        apiKey: ephemeralToken,
        httpOptions: { apiVersion: 'v1alpha' },
      });

      const profile = loadProfile();
      const systemInstruction = buildSystemInstruction(profile);

      const session = await this.ai.live.connect({
        model,
        config: {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' },
            },
          },
          tools: VOICE_TOOLS as any,
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH' as any,
              endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH' as any,
              prefixPaddingMs: 100,
              silenceDurationMs: 600,
            },
          },
        },
        callbacks: {
          onopen: () => {
            if (this.isDisposed) return;
            this.isConnected = true;
            const connectionMs = Date.now() - this.connectStartTime;
            this.onMetric?.('connectionTimeMs', connectionMs);
            this.onMetric?.('sessionConnected', true);
            console.log(`[GeminiLive] WebSocket socket open in ${connectionMs}ms`);
            this.events.onSetupSent?.();
          },

          onmessage: (message: any) => {
            if (this.isDisposed) return;
            if (!this.firstResponseEventFired) {
              this.firstResponseEventFired = true;
              this.events.onFirstResponseEvent?.();
            }
            this.handleMessage(message);
          },

          onerror: (error: ErrorEvent) => {
            if (this.isDisposed) return;
            console.error('[GeminiLive] WebSocket error:', error);
            this.isConnected = false;
            this.onMetric?.('sessionConnected', false);
            this.events.onError(new Error(error.message || 'WebSocket error'));
          },

          onclose: (event: CloseEvent) => {
            if (this.isDisposed) return;
            console.log(`[GeminiLive] Connection closed: ${event.code} ${event.reason}`);
            this.isConnected = false;
            this.onMetric?.('sessionConnected', false);
            this.events.onDisconnect();
          },
        },
      });

      if (this.isDisposed) {
        try {
          session?.close();
        } catch {
          // ignore
        }
        return;
      }

      this.session = session;
      this.isConnected = true;
      console.log('[GeminiLive] Live session connected & setupComplete acknowledged');

      // Flush any queued client content turns
      while (this.pendingClientContent.length > 0) {
        const queuedText = this.pendingClientContent.shift();
        if (queuedText) {
          this.sendClientContent(queuedText);
        }
      }

      // Flush any queued audio
      while (this.pendingAudioQueue.length > 0) {
        const queuedAudio = this.pendingAudioQueue.shift();
        if (queuedAudio) {
          this.sendAudio(queuedAudio);
        }
      }

      // Session is now 100% ready for turns and audio
      this.events.onConnect();
    } catch (err: any) {
      console.error('[GeminiLive] Connect failed:', err);
      throw err;
    }
  }

  private handleMessage(message: any) {
    // ── Audio data ─────────────────────────────────────────
    // Extract base64 audio: first check modelTurn.parts inlineData, fallback to message.data
    let base64Audio: string | undefined;
    if (message?.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part?.inlineData?.data) {
          base64Audio = part.inlineData.data;
          break;
        }
      }
    }
    if (!base64Audio && message?.data) {
      base64Audio = message.data;
    }

    if (base64Audio) {
      if (!this.firstAudioTime) {
        this.firstAudioTime = Date.now();
        this.onMetric?.('firstAudioReceived', this.firstAudioTime);
      }
      try {
        const decoded = base64ToInt16(base64Audio);
        const pcm = new Int16Array(decoded.buffer.slice(0));

        this.chunkRxCount++;
        if (DEBUG_AUDIO) {
          console.log(
            `[RX] generation=${this.generationId} chunk=${this.chunkRxCount} samples=${pcm.length}`
          );
        }

        this.events.onAudioChunk(pcm, this.generationId);
      } catch (e) {
        console.warn('[GeminiLive] Error decoding audio chunk:', e);
      }
    }

    // ── Turn complete ─────────────────────────────────────
    if (message?.serverContent?.turnComplete) {
      if (DEBUG_AUDIO) {
        console.log(`[TURN COMPLETE] generation=${this.generationId} totalChunks=${this.chunkRxCount}`);
      }
      const finishedGen = this.generationId;
      this.events.onTurnComplete(finishedGen);
      this.generationId++;
      this.chunkRxCount = 0;
    }

    // ── Interrupted (barge-in disabled for strict turn taking) ───
    if (message?.serverContent?.interrupted) {
      if (DEBUG_AUDIO) {
        console.log(`[INTERRUPTED IGNORED] generation=${this.generationId} (strict turn-taking active)`);
      }
      // Intentionally do NOT advance generation or stop audio —
      // the complete generated response audio must play to completion.
    }

    // ── Input transcription (user speech) ─────────────────
    // inputTranscription = completed user turn
    // interimInputTranscription = partial while user is speaking
    const inputT = message?.serverContent?.inputTranscription;
    const interimInputT = message?.serverContent?.interimInputTranscription;
    if (inputT?.text) {
      this.events.onTranscript?.(inputT.text, true, false);
    } else if (interimInputT?.text) {
      this.events.onTranscript?.(interimInputT.text, true, true);
    }

    // ── Output transcription (AI speech text) ─────────────
    const outputT = message?.serverContent?.outputTranscription;
    if (outputT?.text) {
      this.events.onTranscript?.(outputT.text, false, !message?.serverContent?.turnComplete);
    }

    // ── Also handle text parts for transcript ─────────────
    // NOTE: We check modelTurn.parts here ONLY for text, not for audio.
    if (message?.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.text) {
          this.events.onTranscript?.(part.text, false, true);
          break; // Only take first text part
        }
        // Intentionally skipping part.inlineData audio — handled exclusively via message.data above
      }
    }

    // ── Tool calls ────────────────────────────────────────
    if (message?.toolCall?.functionCalls?.length) {
      for (const fc of message.toolCall.functionCalls) {
        const toolCallId = fc.id || `tool-${Date.now()}`;
        this.events.onToolCall({
          id: toolCallId,
          name: fc.name,
          args: fc.args || {},
        });

        // Execute tool non-blocking and send result back
        executeToolCall({ id: toolCallId, name: fc.name, args: fc.args || {} })
          .then((response) => {
            if (!this.isConnected || this.isDisposed) return;
            this.session?.sendToolResponse({
              functionResponses: [
                {
                  id: response.id,
                  name: fc.name,
                  response: response.error
                    ? { error: response.error }
                    : { result: response.result },
                },
              ],
            });
          })
          .catch((err) => {
            console.error('[GeminiLive] Tool execution error:', err);
          });
      }
    }
  }

  /**
   * Advance the generation ID. Called by the orchestrator when a new
   * Gemini response begins (e.g. after a barge-in).
   */
  advanceGeneration(): number {
    this.generationId++;
    this.chunkRxCount = 0;
    if (DEBUG_AUDIO) {
      console.log(`[GeminiLive] New generation: ${this.generationId}`);
    }
    return this.generationId;
  }

  get currentGenerationId(): number {
    return this.generationId;
  }

  /**
   * Send a chunk of PCM audio to Gemini Live
   * data: base64-encoded Int16 PCM at 16 kHz mono
   */
  sendAudio(base64Data: string): void {
    if (this.isDisposed) return;
    if (!this.session || !this.isConnected) {
      if (this.pendingAudioQueue.length < 40) {
        this.pendingAudioQueue.push(base64Data);
      }
      return;
    }
    try {
      // @google/genai maps 'media' to 'mediaChunks' in the WebSocket payload
      this.session.sendRealtimeInput({
        media: {
          data: base64Data,
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    } catch (err) {
      console.warn('[GeminiLive] sendAudio error:', err);
    }
  }

  /**
   * Send a text message turn to the live session (e.g. to switch spoken language mid-session)
   */
  sendClientContent(text: string): void {
    if (this.isDisposed) return;
    if (!this.session || !this.isConnected) {
      console.log('[GeminiLive] Queuing clientContent (session connecting):', text);
      this.pendingClientContent.push(text);
      return;
    }
    try {
      this.session.sendClientContent({
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      });
      if (DEBUG_AUDIO) {
        console.log('[GeminiLive] sendClientContent sent:', text);
      }
    } catch (err) {
      console.warn('[GeminiLive] sendClientContent error:', err);
    }
  }

  /**
   * Explicitly notify Gemini that the user has stopped speaking this utterance.
   * This guarantees prompt generation even if background noise delays server VAD.
   */
  signalAudioStreamEnd(): void {
    if (!this.session || !this.isConnected || this.isDisposed) return;
    try {
      this.session.sendRealtimeInput({ audioStreamEnd: true });
      if (DEBUG_AUDIO) {
        console.log('[GeminiLive] audioStreamEnd signaled');
      }
    } catch (err) {
      console.warn('[GeminiLive] audioStreamEnd error:', err);
    }
  }

  /**
   * Signal user activity start (optional explicit signal)
   */
  signalActivityStart(): void {
    if (!this.session || !this.isConnected) return;
    try {
      this.session.sendRealtimeInput({ activityStart: {} });
    } catch {
      // Not all SDK versions support this
    }
  }

  /**
   * Signal user activity end
   */
  signalActivityEnd(): void {
    if (!this.session || !this.isConnected) return;
    try {
      this.session.sendRealtimeInput({ activityEnd: {} });
    } catch {
      // Not all SDK versions support this
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get outputSampleRate(): number {
    return OUTPUT_SAMPLE_RATE;
  }

  disconnect(): void {
    this.isDisposed = true;
    this.isConnected = false;
    this.pendingClientContent = [];
    this.pendingAudioQueue = [];
    try {
      this.session?.close();
    } catch {
      // ignore
    }
    this.session = null;
    this.ai = null;
  }

  resetFirstAudioTimer(): void {
    this.firstAudioTime = null;
  }
}
