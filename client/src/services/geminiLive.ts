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

  // Session diagnostics
  private readonly _sessionId: string;
  private lastMessageTimestamp: number = 0;
  private currentTurnNumber = 1;

  // Debug counters
  private chunkRxCount = 0;
  private generationId = 0;

  private pendingClientContent: string[] = [];
  private pendingAudioQueue: string[] = [];

  constructor(options: GeminiLiveSessionOptions) {
    this._sessionId = `gemini-live-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
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
              prefixPaddingMs: 60,
              silenceDurationMs: 320,
            },
          },

        },
        callbacks: {
          onopen: () => {
            if (this.isDisposed) return;
            this.isConnected = true;
            this.lastMessageTimestamp = Date.now();
            const connectionMs = Date.now() - this.connectStartTime;
            this.onMetric?.('connectionTimeMs', connectionMs);
            this.onMetric?.('sessionConnected', true);
            console.log(`[GeminiLive] WebSocket socket open in ${connectionMs}ms (session=${this._sessionId})`);
            console.log(`[Gemini] session=${this._sessionId} state=OPEN turn=${this.currentTurnNumber}`);
            this.events.onSetupSent?.();
          },

          onmessage: (message: any) => {
            if (this.isDisposed) return;
            this.lastMessageTimestamp = Date.now();
            if (!this.firstResponseEventFired) {
              this.firstResponseEventFired = true;
              this.events.onFirstResponseEvent?.();
            }
            this.handleMessage(message);
          },

          onerror: (error: ErrorEvent) => {
            if (this.isDisposed) return;
            console.error(`[GeminiLive] WebSocket error (session=${this._sessionId}):`, error);
            this.isConnected = false;
            this.onMetric?.('sessionConnected', false);
            this.events.onError(new Error(error.message || 'WebSocket error'));
          },

          onclose: (event: CloseEvent) => {
            if (this.isDisposed) return;
            console.log(`[GeminiLive] Connection closed: code=${event.code} reason=${event.reason} (session=${this._sessionId})`);
            console.log(`[Gemini] session=${this._sessionId} state=CLOSED turn=${this.currentTurnNumber}`);
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
      console.log(`[GeminiLive] Live session connected & setupComplete acknowledged (session=${this._sessionId})`);

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
      console.error(`[GeminiLive] Connect failed (session=${this._sessionId}):`, err);
      throw err;
    }
  }

  private handleMessage(message: any) {
    // ── Audio data ─────────────────────────────────────────
    // Extract base64 audio chunks: check modelTurn.parts inlineData, fallback to message.data
    const audioDataChunks: string[] = [];
    if (message?.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part?.inlineData?.data) {
          audioDataChunks.push(part.inlineData.data);
        }
      }
    }
    if (audioDataChunks.length === 0 && message?.data) {
      audioDataChunks.push(message.data);
    }

    if (audioDataChunks.length > 0) {
      if (!this.firstAudioTime) {
        this.firstAudioTime = Date.now();
        this.onMetric?.('firstAudioReceived', this.firstAudioTime);
      }

      for (const base64Audio of audioDataChunks) {
        try {
          const decoded = base64ToInt16(base64Audio);
          const pcm = new Int16Array(decoded.buffer.slice(0));

          this.chunkRxCount++;
          console.log(
            `[TURN ${this.currentTurnNumber}] audio chunk received (chunk ${this.chunkRxCount}, generation=${this.generationId}, samples=${pcm.length})`
          );

          this.events.onAudioChunk(pcm, this.generationId);
        } catch (e) {
          console.warn('[GeminiLive] Error decoding audio chunk:', e);
        }
      }
    }

    // ── Turn complete ─────────────────────────────────────
    if (message?.serverContent?.turnComplete) {
      console.log(`[TURN ${this.currentTurnNumber}] turnComplete (totalChunks=${this.chunkRxCount}, generation=${this.generationId})`);
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
    let assistantTextChunk = '';
    const outputT = message?.serverContent?.outputTranscription;
    if (outputT?.text && outputT.text.trim()) {
      assistantTextChunk = outputT.text;
    } else if (message?.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part?.text && part.text.trim()) {
          assistantTextChunk = part.text;
          break;
        }
      }
    }

    if (assistantTextChunk) {
      this.events.onTranscript?.(assistantTextChunk, false, !message?.serverContent?.turnComplete);
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
    return this.isConnected && !this.isDisposed;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get lastMessageTime(): number {
    return this.lastMessageTimestamp;
  }

  get turnNumber(): number {
    return this.currentTurnNumber;
  }

  setTurnNumber(turn: number): void {
    this.currentTurnNumber = turn;
  }

  get connectionState(): 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED' | 'UNKNOWN' {
    if (!this.session) {
      return this.isConnected ? 'CONNECTING' : 'CLOSED';
    }
    const ws = (this.session as any)?.conn;
    if (ws && typeof ws.readyState === 'number') {
      switch (ws.readyState) {
        case 0: return 'CONNECTING';
        case 1: return 'OPEN';
        case 2: return 'CLOSING';
        case 3: return 'CLOSED';
        default: return 'UNKNOWN';
      }
    }
    return this.isConnected ? 'OPEN' : 'CLOSED';
  }

  isHealthy(): boolean {
    if (this.isDisposed || !this.isConnected || !this.session) return false;
    const ws = (this.session as any)?.conn;
    if (ws && typeof ws.readyState === 'number') {
      return ws.readyState === 1; // WebSocket.OPEN
    }
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
      const ws = (this.session as any)?.conn;
      if (ws && typeof ws.close === 'function') {
        ws.close();
      }
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
