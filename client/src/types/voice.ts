// ============================================================
// Voice Assistant — Core Types
// ============================================================

export enum VoiceState {
  IDLE = 'IDLE',
  PREPARING = 'PREPARING',
  CONNECTING = 'CONNECTING',
  READY_FOR_USER = 'READY_FOR_USER',
  LISTENING = 'LISTENING',
  PROCESSING = 'PROCESSING',
  AI_SPEAKING = 'AI_SPEAKING',
  RECONNECTING = 'RECONNECTING',
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
