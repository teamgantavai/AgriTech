// ============================================================
// Gemini Live Session — Config Types
// ============================================================

export interface AudioConfig {
  sampleRate: number;        // input: 16000, output: 24000
  channels: number;          // 1 (mono)
  bitsPerSample: number;     // 16
}

export interface GeminiLiveConfig {
  ephemeralToken: string;
  model: string;
  systemInstruction: string;
  tools: GeminiTool[];
  inputAudio: AudioConfig;
  outputAudio: AudioConfig;
}

export interface GeminiTool {
  functionDeclarations: FunctionDeclaration[];
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export interface LiveSessionEvents {
  onAudioChunk: (pcm: Int16Array, generationId?: number) => void;
  onToolCall: (toolCall: { id: string; name: string; args: Record<string, unknown> }) => void;
  onTurnComplete: (generationId?: number) => void;
  onInterrupted: () => void;
  onError: (error: Error) => void;
  onDisconnect: () => void;
  onConnect: () => void;
  onSetupSent?: () => void;
  onFirstResponseEvent?: () => void;
  onTranscript?: (text: string, isUser: boolean, isPartial: boolean) => void;
}
