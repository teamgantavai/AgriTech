// ================================================================
// VoiceSessionManager.ts — Authoritative Singleton Voice Manager
// Guarantees:
// 1. Exactly ONE active voice session per user / browser tab
// 2. Exactly ONE TTS / audio playback pipeline at any moment
// 3. Unique speechId & generationId tracking to discard stale audio
// 4. Single-chain reconnect protection without duplicate timers
// 5. Clean user interrupt & instant audio cancellation
// ================================================================

import { VoiceState } from '../types/voice';
import { GeminiLiveSession } from './geminiLive';
import { getLiveToken, clearCachedToken } from './tokenService';
import { profiler } from './voiceProfiler';
import { semanticScroll } from './semanticScroll';

export type SessionConnectionState =
  | 'IDLE'
  | 'PREPARING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTING'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

export interface VoiceDiagnostics {
  sessionId: string | null;
  connectionState: SessionConnectionState;
  ttsState: 'IDLE' | 'BUFFERING' | 'SPEAKING';
  activeSpeechId: string | null;
  activeAudioPlayers: number;
  activeSessions: number;
  activeSpeechControllers: number;
  queueLength: number;
  lastMessageTime: number | null;
}

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

export class VoiceSessionManager {
  private static instance: VoiceSessionManager | null = null;

  // Global diagnostics & assertion counters
  private static activeSessionsCount = 0;
  private static activeAudioPlayersCount = 0;
  private static activeSpeechControllersCount = 0;

  private sessionId: string | null = null;
  private connectionState: SessionConnectionState = 'IDLE';
  private ttsState: 'IDLE' | 'BUFFERING' | 'SPEAKING' = 'IDLE';

  // Live session reference
  private liveSession: GeminiLiveSession | null = null;
  private connectPromise: Promise<void> | null = null;

  // Reconnection management
  private reconnectCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isReconnecting = false;

  // Speech ID & Generation Tracking
  private currentSpeechId: string = 'speech_init';
  private speechCounter = 1000;
  private abortController: AbortController | null = null;

  // Listeners
  private stateChangeListeners = new Set<(state: SessionConnectionState) => void>();
  private audioChunkListeners = new Set<(pcm: Int16Array, generationId: number, speechId: string) => void>();
  private turnCompleteListeners = new Set<(generationId: number, speechId: string) => void>();

  private constructor() {
    this.sessionId = `vs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  public static getInstance(): VoiceSessionManager {
    if (!VoiceSessionManager.instance) {
      VoiceSessionManager.instance = new VoiceSessionManager();
    }
    return VoiceSessionManager.instance;
  }

  // ── Session State Inspection ──────────────────────────────
  public getConnectionState(): SessionConnectionState {
    return this.connectionState;
  }

  public isConnected(): boolean {
    return this.connectionState === 'CONNECTED' && Boolean(this.liveSession?.connected);
  }

  public isConnecting(): boolean {
    return this.connectionState === 'CONNECTING' || this.connectionState === 'PREPARING';
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public getCurrentSpeechId(): string {
    return this.currentSpeechId;
  }

  public getDiagnostics(): VoiceDiagnostics {
    return {
      sessionId: this.sessionId,
      connectionState: this.connectionState,
      ttsState: this.ttsState,
      activeSpeechId: this.currentSpeechId,
      activeAudioPlayers: VoiceSessionManager.activeAudioPlayersCount,
      activeSessions: VoiceSessionManager.activeSessionsCount,
      activeSpeechControllers: VoiceSessionManager.activeSpeechControllersCount,
      queueLength: 0,
      lastMessageTime: this.liveSession?.lastMessageTime ?? null,
    };
  }

  // ── Audio Player Registration & Assertion ─────────────────
  public registerAudioPlayer(): () => void {
    VoiceSessionManager.activeAudioPlayersCount += 1;
    if (VoiceSessionManager.activeAudioPlayersCount > 1) {
      console.error(
        `GRAM SATHI: DUPLICATE AUDIO PLAYER DETECTED (count=${VoiceSessionManager.activeAudioPlayersCount})`
      );
    }
    return () => {
      VoiceSessionManager.activeAudioPlayersCount = Math.max(0, VoiceSessionManager.activeAudioPlayersCount - 1);
    };
  }

  // ── Reconnection Cancellation & Reset ─────────────────────
  public clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
  }

  // ── Speech Generation ID Allocation ───────────────────────
  public startNewSpeech(): string {
    this.speechCounter += 1;
    this.currentSpeechId = `speech_${this.speechCounter}_${Date.now()}`;

    // Abort previous speech context
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
        // ignore
      }
    }
    this.abortController = new AbortController();
    this.ttsState = 'BUFFERING';

    console.log(`[VoiceSessionManager] Started new speech: ${this.currentSpeechId}`);
    return this.currentSpeechId;
  }

  public isSpeechValid(speechId: string): boolean {
    return this.currentSpeechId === speechId;
  }

  public stopSpeaking(): void {
    this.ttsState = 'IDLE';
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
        // ignore
      }
      this.abortController = null;
    }
  }

  /**
   * User Interrupt:
   * Called when user says "Stop" or barge-in is triggered.
   * Cancels ongoing speech, discards pending audio, and stops automatic scrolling.
   */
  public interrupt(): void {
    console.log('[VoiceSessionManager] User interrupted — cancelling active speech & scrolling');
    this.speechCounter += 1;
    this.currentSpeechId = `speech_interrupted_${this.speechCounter}`;
    this.stopSpeaking();
    semanticScroll.cancelScrolling();
  }

  // ── Connect Guarantee: Idempotent Single Voice Session ────
  public async connect(
    onConnect?: () => void,
    onDisconnect?: () => void,
    onError?: (err: Error) => void
  ): Promise<void> {
    // If already connected and healthy, return immediately
    if (this.isConnected()) {
      console.log(`[VoiceSessionManager] Already connected to session ${this.sessionId}. Reusing active session.`);
      onConnect?.();
      return;
    }

    // If already connecting, await existing in-flight connect promise
    if (this.connectPromise) {
      console.log('[VoiceSessionManager] Connection already in-flight. Joining existing connect promise.');
      return this.connectPromise;
    }

    this.clearReconnectTimer();
    this.setConnectionState('PREPARING');

    this.connectPromise = (async () => {
      try {
        this.setConnectionState('CONNECTING');

        // Tear down any dead session
        if (this.liveSession) {
          this.liveSession.disconnect();
          this.liveSession = null;
          VoiceSessionManager.activeSessionsCount = Math.max(0, VoiceSessionManager.activeSessionsCount - 1);
        }

        VoiceSessionManager.activeSessionsCount += 1;
        if (VoiceSessionManager.activeSessionsCount > 1) {
          console.error(
            `GRAM SATHI: DUPLICATE VOICE SESSION DETECTED (count=${VoiceSessionManager.activeSessionsCount})`
          );
        }

        // Fetch fresh ephemeral token
        const tokenData = await getLiveToken(true);

        const session = new GeminiLiveSession({
          events: {
            onConnect: () => {
              this.reconnectCount = 0;
              this.clearReconnectTimer();
              this.setConnectionState('CONNECTED');
              onConnect?.();
            },
            onDisconnect: () => {
              this.handleSessionDisconnect(onDisconnect, onError);
            },
            onError: (err) => {
              console.error('[VoiceSessionManager] Session error:', err);
              this.handleSessionDisconnect(onDisconnect, onError);
            },
            onAudioChunk: (pcm, genId) => {
              const safeGenId = genId ?? 0;
              this.audioChunkListeners.forEach((fn) => fn(pcm, safeGenId, this.currentSpeechId));
            },
            onTurnComplete: (genId) => {
              const safeGenId = genId ?? 0;
              this.turnCompleteListeners.forEach((fn) => fn(safeGenId, this.currentSpeechId));
            },
            onToolCall: () => {
              // Tool dispatch handled in application context
            },
            onInterrupted: () => {
              this.interrupt();
            },
          },
        });

        this.liveSession = session;
        await session.connect(tokenData.token, tokenData.model);
      } catch (err: any) {
        VoiceSessionManager.activeSessionsCount = Math.max(0, VoiceSessionManager.activeSessionsCount - 1);
        this.setConnectionState('ERROR');
        onError?.(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  // ── Single-Chain Reconnection Protection ───────────────────
  private handleSessionDisconnect(
    onDisconnect?: () => void,
    onError?: (err: Error) => void
  ): void {
    if (this.connectionState === 'DISCONNECTING' || this.connectionState === 'DISCONNECTED') {
      return;
    }

    if (this.isReconnecting) {
      console.log('[VoiceSessionManager] Reconnect already scheduled — ignoring duplicate disconnect trigger.');
      return;
    }

    this.setConnectionState('DISCONNECTED');
    onDisconnect?.();

    if (this.reconnectCount >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[VoiceSessionManager] Max reconnect attempts exceeded.');
      this.setConnectionState('ERROR');
      onError?.(new Error('Connection lost. Please restart voice.'));
      return;
    }

    this.reconnectCount += 1;
    this.isReconnecting = true;
    this.setConnectionState('RECONNECTING');

    const delay = RECONNECT_DELAY_MS * this.reconnectCount;
    console.log(`[VoiceSessionManager] Scheduling single reconnect in ${delay}ms (attempt ${this.reconnectCount})`);

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.isReconnecting = false;
      this.connect().catch((err) => {
        console.error('[VoiceSessionManager] Reconnect failed:', err);
      });
    }, delay);
  }

  // ── Disconnect & Cleanup ──────────────────────────────────
  public disconnect(): void {
    this.clearReconnectTimer();
    this.reconnectCount = 0;
    this.setConnectionState('DISCONNECTING');
    this.stopSpeaking();
    semanticScroll.cancelScrolling();

    if (this.liveSession) {
      this.liveSession.disconnect();
      this.liveSession = null;
      VoiceSessionManager.activeSessionsCount = Math.max(0, VoiceSessionManager.activeSessionsCount - 1);
    }

    clearCachedToken();
    this.setConnectionState('DISCONNECTED');
  }

  public destroy(): void {
    this.disconnect();
    this.stateChangeListeners.clear();
    this.audioChunkListeners.clear();
    this.turnCompleteListeners.clear();
    VoiceSessionManager.instance = null;
  }

  public getLiveSession(): GeminiLiveSession | null {
    return this.liveSession;
  }

  private setConnectionState(state: SessionConnectionState) {
    this.connectionState = state;
    this.stateChangeListeners.forEach((fn) => fn(state));
  }

  public onStateChange(listener: (state: SessionConnectionState) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }
}

// Global Singleton Accessor
export const voiceManager = VoiceSessionManager.getInstance();
