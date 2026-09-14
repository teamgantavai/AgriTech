// ============================================================
// Voice Assistant — Core Types
// ============================================================

export enum VoiceState {
  IDLE = 'IDLE',
  PREPARING = 'PREPARING',
  CONNECTING = 'CONNECTING',
  READY = 'READY',
  READY_FOR_USER = 'READY',
  LISTENING = 'LISTENING',
  PROCESSING = 'PROCESSING',
  AI_SPEAKING = 'AI_SPEAKING',
  RECOVERING = 'RECOVERING',
  RECONNECTING = 'RECOVERING',
  ERROR = 'ERROR',
  DISCONNECTED = 'DISCONNECTED',
}

export enum OnboardingState {
  FIRST_START = 'FIRST_START',
  LANGUAGE_QUESTION = 'LANGUAGE_QUESTION',
  WAITING_FOR_LANGUAGE = 'WAITING_FOR_LANGUAGE',
  LANGUAGE_SELECTED = 'LANGUAGE_SELECTED',
  READY_FOR_HELP = 'READY_FOR_HELP',
  NORMAL_CONVERSATION = 'NORMAL_CONVERSATION',
}

export interface SessionProfile {
  selectedLanguage: string | null;     // e.g. 'Hindi', 'English', 'Punjabi'
  language: string | null;             // alias for selectedLanguage
  languageCode: string | null;         // e.g. 'hi', 'en', 'pa'
  occupation: string | null;           // e.g. 'farmer', 'student', 'shopkeeper'
  nameIfProvided: string | null;
  onboardingComplete: boolean;         // true once language onboarding done
  onboardingDone: boolean;             // alias for onboardingComplete
  currentTopic: string | null;
  preferences: Record<string, string>;
}

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  isPartial?: boolean;
}

export enum AISubState {
  IDLE = 'IDLE',
  AI_GENERATING = 'AI_GENERATING',
  AI_AUDIO_RECEIVING = 'AI_AUDIO_RECEIVING',
  AI_SPEAKING = 'AI_SPEAKING',
  AI_PLAYBACK_COMPLETE = 'AI_PLAYBACK_COMPLETE',
}

export interface VoiceMetrics {
  connectionTimeMs: number | null;
  ttfaMs: number | null;             // Time To First Audio
  lastTurnDurationMs: number | null;
  userSpeechDurationMs: number | null;
  assistantResponseDurationMs: number | null;
  interruptionCount: number;
  reconnectCount: number;
  vadFalseActivations: number;
  vadActive: boolean;
  userInputLocked?: boolean;
  sessionConnected: boolean;
  audioSampleRate: number;
  // Startup & First-turn specific profiling metrics
  microphoneInitTimeMs?: number | null;
  liveConnectionTimeMs?: number | null;
  liveSetupTimeMs?: number | null;
  timeFromSpeechEndToFirstAudioMs?: number | null;
  totalFirstResponseLatencyMs?: number | null;
  turn1TTFAMs?: number | null;
  turn2TTFAMs?: number | null;
  firstTurnReport?: string | null;

  // Diagnostics & Health Metrics (20+ turns pipeline observability)
  sessionId?: string | null;
  sessionState?: 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED' | 'UNKNOWN';
  lastMessageTime?: number | null;
  audioContextState?: 'running' | 'suspended' | 'closed' | null;
  queueLength?: number;
  activeSources?: number;
  schedulerState?: 'idle' | 'running' | 'scheduled';
  currentTurnId?: number;
  chunksReceived?: number;
  chunksPlayed?: number;
  chunksRemaining?: number;
  geminiGenerationStatus?: 'idle' | 'generating' | 'complete';
  audioPlaybackStatus?: 'idle' | 'playing' | 'complete';
  geminiMessageListeners?: number;
  micListeners?: number;
  liveSessionCount?: number;
  audioContextCount?: number;
  micStreamCount?: number;
  micTrackState?: 'live' | 'ended' | 'muted' | 'none';
  micStreamActive?: boolean;
  lastGeminiEventTime?: number | null;
  lastAudioChunkTime?: number | null;
  lastAudioPlaybackTime?: number | null;
  audioReceivingComplete?: boolean;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolCallResponse {
  id: string;
  result: unknown;
  error?: string;
}
