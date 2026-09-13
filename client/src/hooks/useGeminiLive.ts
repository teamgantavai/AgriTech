import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { LiveAudioRecorder, LiveAudioPlayer } from '../utils/audioStreamer';

export type GeminiLiveState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'disconnected'
  | 'error';

export interface LiveTranscriptItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

/**
 * Fast, accurate script and lexicon language detector
 * Supports Indian regional languages and English/Hinglish
 */
export function detectLanguageFromText(text: string): string {
  if (!text || text.trim().length === 0) return '';
  const clean = text.trim();

  // Gurmukhi script -> Punjabi
  if (/[\u0A00-\u0A7F]/.test(clean)) return 'Punjabi';

  // Gujarati script
  if (/[\u0A80-\u0AFF]/.test(clean)) return 'Gujarati';

  // Bengali / Assamese script
  if (/[\u0980-\u09FF]/.test(clean)) return 'Bengali';

  // Tamil script
  if (/[\u0B80-\u0BFF]/.test(clean)) return 'Tamil';

  // Telugu script
  if (/[\u0C00-\u0C7F]/.test(clean)) return 'Telugu';

  // Kannada script
  if (/[\u0C80-\u0CFF]/.test(clean)) return 'Kannada';

  // Malayalam script
  if (/[\u0D00-\u0D7F]/.test(clean)) return 'Malayalam';

  // Odia script
  if (/[\u0B00-\u0B7F]/.test(clean)) return 'Odia';

  // Devanagari script (Hindi, Marathi, Bhojpuri, Maithili, Nepali, etc.)
  if (/[\u0900-\u097F]/.test(clean)) {
    // Specific Bhojpuri / Maithili phonemes & common dialect vocabulary
    if (/(बानी|का हाल|कइसे|रउरा|तोहार|हमरा|काहे|बावे|भइल|करब|गइल|देखब|बबुआ|भैया|बाटे|का हो|हमार|ठीक बानी|कइसन)/i.test(clean)) {
      return 'Bhojpuri';
    }
    // Specific Marathi phonemes / vocabulary
    if (/[\u0933\u0934]|(आहे|नाही|काय|करा|होते|झाले|पाहिजे|कसे)/i.test(clean)) {
      return 'Marathi';
    }
    return 'Hindi';
  }

  // Latin characters (English or Hinglish / mixed)
  if (/[a-zA-Z]/.test(clean)) {
    const hinglishWords = /\b(kya|kaise|karo|nahi|haan|bhai|sahkar|samiti|aap|mera|meri|kisan|pacs|ji|theek|kuch|chahiye|namaste|sat|sri|akal|kem|cho)\b/i;
    if (hinglishWords.test(clean)) {
      return 'Hinglish';
    }
    return 'English';
  }

  return '';
}

/**
 * Strips out any internal AI reasoning, markdown headers, and thoughts,
 * ensuring only the concise, actual spoken words are displayed.
 */
export function cleanSpokenText(raw: string): string {
  if (!raw) return '';
  return raw
    // Remove markdown bold thought headers e.g. **Responding to Bhojpuri**
    .replace(/\*\*[^*]+\*\*/g, '')
    // Remove italic headers e.g. *Responding to Bhojpuri*
    .replace(/\*[^*]+\*/g, '')
    // Remove thought headers like "Responding to ...:" or "Thinking:"
    .replace(/^(?:Responding to|Thinking|Reasoning)[^\n:]*[:\n]?/gi, '')
    // Remove thought monologues like "I've processed the user's...", "My response will..."
    .replace(/(?:I've|I have)\s+processed[^\n.]+[.]?/gi, '')
    .replace(/(?:My response will|I'll convey|I will convey|I will respond)[^\n.]+[.]?/gi, '')
    .replace(/^[ \t\r\n]+/gm, '')
    .trim();
}

const SAHKAR_SAATHI_SYSTEM_INSTRUCTION = `You are Sahkar Saathi, a friendly, ultra-fast and concise multilingual conversational voice assistant for Indian cooperatives, farmers, PACS (Primary Agricultural Credit Societies), crop insurance, agricultural credit, and government welfare schemes.

CRITICAL INSTRUCTIONS:
1. Detect and respond in the EXACT same language or dialect the user speaks:
   - If the user speaks Bhojpuri (e.g. "का हाल बा", "रउरा कइसे बानी", "हम ठीक बानी"), respond warmly and concisely in pure Bhojpuri (e.g. "हम ठीक बानी। रउरा कइसे बानी?").
   - If the user speaks Punjabi, respond in Punjabi.
   - If the user speaks Hindi, respond in Hindi.
   - If the user speaks English, respond in English.
   - If the user speaks Gujarati, respond in Gujarati.
   - If the user speaks Tamil, Telugu, Bengali, Marathi, Kannada, Malayalam, Odia, or any other Indian language or regional dialect (like Maithili, Magahi, Marwari, Haryanvi), respond directly in that language/dialect.
   - Never default to Hindi if the user speaks another language or dialect.
2. KEEP RESPONSES VERY SHORT AND CONCISE (1 to 2 short spoken sentences only). NEVER speak too much text.
3. NEVER OUTPUT INTERNAL THOUGHTS OR REASONING:
   - Do NOT output commentary like "**Responding to Bhojpuri**" or "I've processed the user's greeting...".
   - Speak ONLY the direct spoken response to the user.
4. When the user speaks while you are talking, immediately stop speaking and listen.
5. LIVE WEBSITE CONTROL:
   - You have direct control over the website. When the user asks to open any scheme or page (e.g., "PM Kisan kholo", "KCC page dikhao", "chat kholo", "home page jao", "dastavez dikhao", "neeche scroll karo", "band karo"), the website automatically opens, navigates, scrolls, or highlights that section on their screen in real time.
   - Confirm warmly and briefly in 1 spoken sentence (e.g., 'जी, मैंने पीएम किसान का पेज खोल दिया है।' or 'जी, चैट पेज पर आ गए हैं।').
6. CORE SCHEME KNOWLEDGE ACROSS ALL CATEGORIES (Spoken concisely in max 2 sentences):
   - PM-KISAN (Farmers): ₹6,000 yearly in 3 equal installments of ₹2,000 directly to bank accounts. Aadhaar and eKYC required.
   - Kisan Credit Card (KCC): Crop loan up to ₹3 Lakh at 4% effective interest with timely repayment. Apply at bank or PACS.
   - PM Fasal Bima (PMFBY): Crop insurance at 1.5% to 2% premium against flood, drought, or pest damage. Report crop loss within 72 hours.
   - Tractor & Equipment Subsidy: 40% to 50% subsidy under SMAM for modern farm equipment.
   - PACS: Village cooperative society providing subsidized fertilizer, certified seeds, crop credit, and fair market storage.
   - PM-KUSUM: Up to 60% subsidy for solar water pumps for eco-friendly farm irrigation.
   - PM Vishwakarma (Artisans & Craftsmen): ₹15,000 free toolkit e-voucher, 5-7 days skill training with ₹500/day stipend, and ₹3 Lakh collateral-free loan at only 5% interest for 18 traditional trades (carpenter, blacksmith, tailor, potter, barber, etc.).
   - PM SVANidhi (Shopkeepers & Vendors): Collateral-free working capital loans of ₹10,000, ₹20,000, and ₹50,000 with 7% interest subsidy directly into bank account.
   - PMMY Mudra Loan (Traders & Businesses): Collateral-free enterprise credit up to ₹10 Lakh (Shishu, Kishor, Tarun).
   - Pashu KCC (Dairy & Livestock): Up to ₹1.60 Lakh collateral-free loan at 4% interest for cattle fodder, dairy care, and goat/poultry farming.
   - Lakhpati Didi & Drone Didi (Women SHG): Empowering rural women with ₹1 Lakh annual income goal, skill training, and 80% subsidy on agricultural drones.`;

export function useGeminiLive(autoStart: boolean = false) {
  const [connectionState, setConnectionState] = useState<GeminiLiveState>('idle');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [userVolume, setUserVolume] = useState(0);
  const [aiVolume, setAiVolume] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptHistory, setTranscriptHistory] = useState<LiveTranscriptItem[]>([]);
  const [currentAssistantText, setCurrentAssistantText] = useState('');
  const [currentUserText, setCurrentUserText] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');

  const sessionRef = useRef<any>(null);
  const recorderRef = useRef<LiveAudioRecorder | null>(null);
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const isComponentMounted = useRef(true);
  const isMutedRef = useRef(false);
  const isSessionTerminatedRef = useRef(false);
  const activeAssistantTextRef = useRef('');
  const activeUserTextRef = useRef('');
  const vadEndMsRef = useRef<number>(0);
  const turnStartMsRef = useRef<number>(0);
  const firstAudioChunkLoggedRef = useRef<boolean>(false);

  // Keep mute ref in sync
  useEffect(() => {
    isMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  // Clean stop of audio engines
  const cleanupAudio = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch {}
      sessionRef.current = null;
    }
  }, []);

  /**
   * Request ephemeral token from server and establish Gemini Live Session
   */
  const startSession = useCallback(async () => {
    isSessionTerminatedRef.current = false;
    cleanupAudio();
    setErrorMessage(null);
    setConnectionState('connecting');
    console.log('[GeminiLive] Connection state: connecting');

    try {
      // 1. Fetch short-lived ephemeral token from secure server endpoint
      const tokenResponse = await fetch('/api/live/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!tokenResponse.ok) {
        const errJson = await tokenResponse.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to authenticate with Gemini Live server.');
      }

      const { token, model } = await tokenResponse.json();

      if (!token) {
        throw new Error('No ephemeral authentication token received from server.');
      }

      // 2. Initialize @google/genai client using ephemeral token and v1alpha
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1alpha' },
      });

      // 3. Initialize Audio Player (24kHz playback with seamless gapless queuing)
      const player = new LiveAudioPlayer(
        (vol) => {
          if (isComponentMounted.current) setAiVolume(vol);
        },
        (isSpeaking) => {
          if (isComponentMounted.current) {
            setConnectionState(isSpeaking ? 'speaking' : 'listening');
          }
          // Coordinate with recorder so AI audio is not heard as user speech
          if (recorderRef.current) {
            recorderRef.current.setAiSpeaking(isSpeaking);
          }
        },
        () => {
          const tNow = performance.now();
          const vadEnd = vadEndMsRef.current || turnStartMsRef.current;
          console.log(`🔊 [AUDIO PLAYBACK START] Gemini Live first audio packet playback started at +${(tNow - vadEnd).toFixed(1)}ms`);
          if (vadEnd > 0) {
            console.log(`🚀 [TOTAL LATENCY] User speech stopped → Gemini Live audio playing: ${(tNow - vadEnd).toFixed(1)}ms`);
          }
        }
      );
      playerRef.current = player;

      // 4. Initialize Audio Recorder (16kHz PCM capture with browser echo cancellation & VAD noise suppression)
      const recorder = new LiveAudioRecorder(
        (base64Chunk) => {
          if (isMutedRef.current) return;
          if (sessionRef.current) {
            try {
              // Real-time bidirectional streaming
              sessionRef.current.sendRealtimeInput({
                media: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64Chunk,
                },
              });
            } catch (err) {
              console.warn('[GeminiLive] Error sending audio chunk:', err);
            }
          }
        },
        (vol) => {
          if (isComponentMounted.current) {
            setUserVolume(vol);
          }
        },
        (isSpeaking) => {
          if (isComponentMounted.current && !playerRef.current?.isPlaying) {
            if (isSpeaking) {
              setConnectionState('listening');
            }
          }
        }
      );
      recorderRef.current = recorder;

      // 5. Connect to Gemini Live WebSocket with tuned VAD & Multilingual Transcription
      const liveModel = model || 'gemini-2.5-flash-native-audio-latest';
      console.log(`[GeminiLive] Connecting to model: ${liveModel}`);

      const session = await ai.live.connect({
        model: liveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: {
            parts: [{ text: SAHKAR_SAATHI_SYSTEM_INSTRUCTION }],
          },
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede', // Natural, clear multilingual voice
              },
            },
          },
          thinkingConfig: {
            thinkingBudget: 0,
          },
          // Enable input & output transcription for real-time speech-to-text & language detection
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('✅ [GeminiLive] WebSocket session opened.');
            if (isComponentMounted.current) {
              setConnectionState('listening');
            }
          },

          onmessage: (message: any) => {
            // Handle server content (audio + text + interruption events)
            if (message?.serverContent) {
              const { modelTurn, interrupted, turnComplete, outputTranscription, inputTranscription } =
                message.serverContent;

              // Genuine server VAD detected that user intentionally started speaking -> Barge-in
              if (interrupted) {
                console.log('🗣️ [GeminiLive] Interruption detected: User intentional speech started.');
                player.stopAll();
                if (recorderRef.current) {
                  recorderRef.current.setAiSpeaking(false);
                }
                const spokenText = cleanSpokenText(activeAssistantTextRef.current);
                if (spokenText) {
                  const finalMsg: LiveTranscriptItem = {
                    id: 'ai-' + Date.now(),
                    role: 'assistant',
                    text: spokenText,
                    timestamp: new Date(),
                  };
                  if (isComponentMounted.current) {
                    setTranscriptHistory((prev) => [...prev, finalMsg]);
                  }
                }
                activeAssistantTextRef.current = '';
                if (isComponentMounted.current) {
                  setCurrentAssistantText('');
                  setConnectionState('listening');
                }
              }

              // Process model output audio chunks
              if (modelTurn?.parts) {
                if (!firstAudioChunkLoggedRef.current) {
                  firstAudioChunkLoggedRef.current = true;
                  turnStartMsRef.current = performance.now();
                  const vadEnd = vadEndMsRef.current || turnStartMsRef.current;
                  console.log(`⏱️ [FIRST AUDIO CHUNK] Model response packet arrived at +${(turnStartMsRef.current - vadEnd).toFixed(1)}ms`);
                }
                for (const part of modelTurn.parts) {
                  // Audio Part -> Queue for smooth 24kHz playback
                  if (part.inlineData?.data) {
                    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
                      try { window.speechSynthesis.cancel(); } catch {}
                    }
                    player.queueAudio(part.inlineData.data);
                  }
                  // Internal reasoning / thoughts emitted by model -> SKIP completely!
                  if (part.thought) {
                    continue;
                  }
                  // Fallback: If not thought and outputTranscription isn't active
                  if (part.text && !outputTranscription) {
                    const cleaned = cleanSpokenText(part.text);
                    if (cleaned && !activeAssistantTextRef.current.includes(cleaned)) {
                      activeAssistantTextRef.current += cleaned;
                      if (isComponentMounted.current) {
                        setCurrentAssistantText(cleanSpokenText(activeAssistantTextRef.current));
                        const lang = detectLanguageFromText(activeAssistantTextRef.current);
                        if (lang) setDetectedLanguage(lang);
                      }
                    }
                  }
                }
              }

              // Real-time output transcription (exact words spoken by AI audio)
              if (outputTranscription?.text) {
                activeAssistantTextRef.current += outputTranscription.text;
                const cleanDisplay = cleanSpokenText(activeAssistantTextRef.current);
                if (isComponentMounted.current) {
                  setCurrentAssistantText(cleanDisplay);
                  const lang = detectLanguageFromText(cleanDisplay);
                  if (lang) {
                    console.log(`[GeminiLive] Selected response language: ${lang}`);
                    setDetectedLanguage(lang);
                  }
                }
              }

              // Real-time user input transcription (words spoken by user)
              if (inputTranscription?.parts) {
                vadEndMsRef.current = performance.now();
                firstAudioChunkLoggedRef.current = false;
                for (const part of inputTranscription.parts) {
                  if (part.text) {
                    console.log(`[GeminiLive] User speech activity detected: "${part.text}"`);
                    activeUserTextRef.current += part.text;
                    if (isComponentMounted.current) {
                      setCurrentUserText(activeUserTextRef.current);
                      const userLang = detectLanguageFromText(activeUserTextRef.current);
                      if (userLang) {
                        console.log(`[GeminiLive] User speech language detected: ${userLang}`);
                        setDetectedLanguage(userLang);
                      }
                    }
                  }
                }
              }

              // Turn Complete -> Commit to transcript history
              if (turnComplete) {
                console.log('[GeminiLive] Turn completed.');
                firstAudioChunkLoggedRef.current = false;
                const spokenText = cleanSpokenText(activeAssistantTextRef.current);
                if (spokenText) {
                  const finalMsg: LiveTranscriptItem = {
                    id: 'ai-' + Date.now(),
                    role: 'assistant',
                    text: spokenText,
                    timestamp: new Date(),
                  };
                  if (isComponentMounted.current) {
                    setTranscriptHistory((prev) => [...prev, finalMsg]);
                  }
                }
                activeAssistantTextRef.current = '';
                if (isComponentMounted.current) {
                  setCurrentAssistantText('');
                }
              }
            }
          },

          onerror: (err: any) => {
            console.error('[GeminiLive] WebSocket error:', err);
            if (isComponentMounted.current) {
              setErrorMessage('Gemini Live connection encountered an error.');
              setConnectionState('error');
            }
          },

          onclose: (event: any) => {
            console.log('[GeminiLive] WebSocket connection closed:', event?.code, event?.reason || '');
            if (isComponentMounted.current) {
              setConnectionState(isSessionTerminatedRef.current ? 'idle' : 'disconnected');
            }
            cleanupAudio();
          },
        },
      });

      sessionRef.current = session;

      // Start recording from microphone once session is ready
      try {
        await recorder.start();
        console.log('🎤 [GeminiLive] Microphone recording started with VAD filtering.');
      } catch (micErr: any) {
        console.error('[GeminiLive] Microphone access error:', micErr);
        if (isComponentMounted.current) {
          setErrorMessage(
            micErr?.name === 'NotAllowedError'
              ? 'Microphone permission denied. Please allow microphone access to talk.'
              : 'Could not access microphone.'
          );
          setConnectionState('error');
        }
      }

      // NOTE: We deliberately do NOT inject any hardcoded Hindi turn here!
      // The session starts in an unbiased, neutral listening state.
      // The first utterance spoken by the user determines the language immediately!
    } catch (err: any) {
      console.error('[GeminiLive] Session start failed:', err);
      cleanupAudio();
      if (isComponentMounted.current) {
        setErrorMessage(err?.message || 'Failed to connect to Gemini Live.');
        setConnectionState('error');
      }
    }
  }, [cleanupAudio]);

  /**
   * End current live conversation
   */
  const endSession = useCallback(() => {
    isSessionTerminatedRef.current = true;
    cleanupAudio();
    setConnectionState('idle');
    setUserVolume(0);
    setAiVolume(0);
    setCurrentAssistantText('');
    setCurrentUserText('');
  }, [cleanupAudio]);

  /**
   * Toggle microphone mute
   */
  const toggleMicMute = useCallback(() => {
    setIsMicMuted((prev) => !prev);
  }, []);

  /**
   * Interrupt AI speech manually and silence any competing voice
   */
  const interruptAI = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    if (playerRef.current) {
      playerRef.current.stopAll();
      setConnectionState('listening');
    }
  }, []);

  /**
   * Push to talk active state toggle
   */
  const setPushToTalkActive = useCallback((active: boolean) => {
    if (recorderRef.current) {
      recorderRef.current.setPushToTalkActive(active);
    }
  }, []);

  /**
   * Reconnect to session
   */
  const reconnect = useCallback(() => {
    startSession();
  }, [startSession]);

  /**
   * Send a client prompt / query to the live session
   * Automatically connects if session is not active yet
   */
  const sendUserPrompt = useCallback(
    async (promptText: string) => {
      if (!promptText.trim()) return;
      if (isSessionTerminatedRef.current) return;

      // Immediately silence any active SpeechSynthesis utterance and live audio
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch {}
      }
      if (playerRef.current) {
        playerRef.current.stopAll();
      }

      if (!sessionRef.current) {
        await startSession();
      }

      // Wait up to 3 seconds for session to initialize if starting fresh
      let retries = 0;
      while (!sessionRef.current && retries < 15) {
        await new Promise((r) => setTimeout(r, 200));
        retries++;
      }

      if (sessionRef.current) {
        try {
          console.log(`[GeminiLive] Sending user prompt: "${promptText}"`);
          sessionRef.current.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{ text: promptText }],
              },
            ],
            turnComplete: true,
          });
          setCurrentUserText(promptText);
          setTranscriptHistory((prev) => [
            ...prev,
            {
              id: 'u-' + Date.now(),
              role: 'user',
              text: promptText,
              timestamp: new Date(),
            },
          ]);
        } catch (err) {
          console.error('[GeminiLive] Error sending client prompt:', err);
        }
      }
    },
    [startSession]
  );

  // Auto-start if requested
  useEffect(() => {
    isComponentMounted.current = true;
    if (autoStart) {
      startSession();
    }
    return () => {
      isComponentMounted.current = false;
      cleanupAudio();
    };
  }, [autoStart, startSession, cleanupAudio]);

  // Listen for global stop-all-audio event (e.g. triggered when SpeechSynthesis starts)
  useEffect(() => {
    const handleGlobalStop = () => {
      if (playerRef.current) {
        playerRef.current.stopAll();
      }
    };
    window.addEventListener('sahkar-stop-all-audio', handleGlobalStop);
    return () => window.removeEventListener('sahkar-stop-all-audio', handleGlobalStop);
  }, []);

  return {
    connectionState,
    isLiveConnected: connectionState === 'listening' || connectionState === 'speaking',
    isMicMuted,
    userVolume,
    aiVolume,
    errorMessage,
    transcriptHistory,
    currentAssistantText,
    currentUserText,
    detectedLanguage,
    startSession,
    endSession,
    toggleMicMute,
    interruptAI,
    reconnect,
    sendUserPrompt,
    setPushToTalkActive,
  };
}
