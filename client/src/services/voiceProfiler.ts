// ============================================================
// Voice Profiler — High-precision latency & timestamp breakdown
// ============================================================

export type TimestampKey =
  | 'PAGE_LOAD'
  | 'VOICE_BUTTON_CLICK'
  | 'MIC_PERMISSION_REQUEST'
  | 'MIC_PERMISSION_GRANTED'
  | 'AUDIO_CONTEXT_CREATED'
  | 'VAD_INITIALIZED'
  | 'LIVE_SESSION_START'
  | 'LIVE_SESSION_CONNECTED'
  | 'LIVE_SETUP_SENT'
  | 'FIRST_USER_AUDIO_SENT'
  | 'USER_SPEECH_ENDED'
  | 'FIRST_GEMINI_RESPONSE_EVENT'
  | 'FIRST_GEMINI_AUDIO_RECEIVED'
  | 'FIRST_AUDIO_PLAYBACK';

export interface TurnMetrics {
  turnNumber: number;
  speechEndTime: number;
  firstAudioReceivedTime: number | null;
  firstAudioPlaybackTime: number | null;
  ttfaMs: number | null;
  totalTurnLatencyMs: number | null;
}

class VoiceProfiler {
  public pageLoadTime: number = Date.now();
  private timestamps: Partial<Record<TimestampKey, number>> = {};
  private turnHistory: TurnMetrics[] = [];
  private currentTurnNumber: number = 0;
  private currentTurnSpeechEnd: number = 0;
  private onMetricsUpdated?: (metrics: Record<string, any>) => void;

  constructor() {
    this.timestamps['PAGE_LOAD'] = this.pageLoadTime;
  }

  setMetricsCallback(cb: (metrics: Record<string, any>) => void) {
    this.onMetricsUpdated = cb;
  }

  mark(key: TimestampKey, time: number = Date.now()): void {
    if (!this.timestamps[key]) {
      this.timestamps[key] = time;
    }

    if (key === 'VOICE_BUTTON_CLICK') {
      // Reset timestamps for new activation while keeping PAGE_LOAD
      const pageLoad = this.timestamps['PAGE_LOAD'];
      this.timestamps = { PAGE_LOAD: pageLoad, VOICE_BUTTON_CLICK: time };
      this.currentTurnNumber = 1;
    }

    if (key === 'USER_SPEECH_ENDED') {
      this.currentTurnSpeechEnd = time;
    }

    if (key === 'FIRST_AUDIO_PLAYBACK' && this.currentTurnNumber === 1) {
      this.computeAndLogFirstTurnReport();
    }
  }

  getTimestamp(key: TimestampKey): number | null {
    return this.timestamps[key] ?? null;
  }

  recordTurnSpeechEnd(turnNumber: number, time: number = Date.now()): void {
    this.currentTurnNumber = turnNumber;
    this.currentTurnSpeechEnd = time;
    if (turnNumber === 1) {
      this.mark('USER_SPEECH_ENDED', time);
    }
  }

  recordTurnFirstAudio(turnNumber: number, rxTime: number = Date.now()): void {
    if (turnNumber === 1) {
      this.mark('FIRST_GEMINI_AUDIO_RECEIVED', rxTime);
    }
    const ttfa = this.currentTurnSpeechEnd > 0 ? rxTime - this.currentTurnSpeechEnd : null;

    let turn = this.turnHistory.find((t) => t.turnNumber === turnNumber);
    if (!turn) {
      turn = {
        turnNumber,
        speechEndTime: this.currentTurnSpeechEnd,
        firstAudioReceivedTime: rxTime,
        firstAudioPlaybackTime: null,
        ttfaMs: ttfa,
        totalTurnLatencyMs: null,
      };
      this.turnHistory.push(turn);
    } else {
      turn.firstAudioReceivedTime = rxTime;
      turn.ttfaMs = ttfa;
    }

    if (this.onMetricsUpdated) {
      const turnKey = turnNumber === 1 ? 'turn1TTFAMs' : 'turn2TTFAMs';
      this.onMetricsUpdated({ [turnKey]: ttfa, ttfaMs: ttfa });
    }
  }

  recordTurnPlaybackStart(turnNumber: number, playTime: number = Date.now()): void {
    if (turnNumber === 1) {
      this.mark('FIRST_AUDIO_PLAYBACK', playTime);
    }
    const turn = this.turnHistory.find((t) => t.turnNumber === turnNumber);
    if (turn) {
      turn.firstAudioPlaybackTime = playTime;
      if (turn.speechEndTime > 0) {
        turn.totalTurnLatencyMs = playTime - turn.speechEndTime;
      }
    }

    if (turnNumber >= 2) {
      this.logTurnComparison();
    }
  }

  private computeAndLogFirstTurnReport(): void {
    const t = this.timestamps;
    const click = t['VOICE_BUTTON_CLICK'] || this.pageLoadTime;

    const micInit =
      (t['VAD_INITIALIZED'] ?? 0) - (t['MIC_PERMISSION_REQUEST'] ?? click);
    const liveConn =
      (t['LIVE_SESSION_CONNECTED'] ?? 0) - (t['LIVE_SESSION_START'] ?? click);
    const liveSetup =
      (t['LIVE_SETUP_SENT'] ?? 0) - (t['LIVE_SESSION_CONNECTED'] ?? 0);
    const ttfa =
      (t['FIRST_GEMINI_AUDIO_RECEIVED'] ?? 0) - (t['USER_SPEECH_ENDED'] ?? click);
    const totalLatency =
      (t['FIRST_AUDIO_PLAYBACK'] ?? 0) - (t['USER_SPEECH_ENDED'] ?? click);

    const rel = (ts?: number) =>
      ts ? `+${Math.max(0, ts - click)} ms` : '—';

    console.group('%c🚀 [VOICE PROFILER] FIRST TURN STARTUP BREAKDOWN', 'color: #10b981; font-weight: bold; font-size: 12px;');
    console.log(`Voice clicked: 0 ms`);
    console.log(`AudioContext ready: ${rel(t['AUDIO_CONTEXT_CREATED'])}`);
    console.log(`Microphone ready: ${rel(t['VAD_INITIALIZED'])}`);
    console.log(`Gemini connection started: ${rel(t['LIVE_SESSION_START'])}`);
    console.log(`Gemini connected: ${rel(t['LIVE_SESSION_CONNECTED'])}`);
    console.log(`Session setup complete: ${rel(t['LIVE_SETUP_SENT'])}`);
    console.log(`First user audio sent: ${rel(t['FIRST_USER_AUDIO_SENT'])}`);
    console.log(`User finished speaking: ${rel(t['USER_SPEECH_ENDED'])}`);
    console.log(`First Gemini response event: ${rel(t['FIRST_GEMINI_RESPONSE_EVENT'])}`);
    console.log(`First Gemini audio received: ${rel(t['FIRST_GEMINI_AUDIO_RECEIVED'])}`);
    console.log(`First audio playback: ${rel(t['FIRST_AUDIO_PLAYBACK'])}`);
    console.log('────────────────────────────────────────');
    console.log(`Microphone init time: ${Math.max(0, micInit)} ms`);
    console.log(`Live connection time: ${Math.max(0, liveConn)} ms`);
    console.log(`Live setup time: ${Math.max(0, liveSetup)} ms`);
    console.log(`TTFA (Speech End → First Audio): ${Math.max(0, ttfa)} ms`);
    console.log(`Total Response Latency: ${Math.max(0, totalLatency)} ms`);
    console.groupEnd();

    const summaryReport = `Turn 1 TTFA: ${Math.max(0, ttfa)}ms | Total: ${Math.max(0, totalLatency)}ms (Mic: ${Math.max(0, micInit)}ms, Conn: ${Math.max(0, liveConn)}ms)`;

    if (this.onMetricsUpdated) {
      this.onMetricsUpdated({
        microphoneInitTimeMs: Math.max(0, micInit),
        liveConnectionTimeMs: Math.max(0, liveConn),
        liveSetupTimeMs: Math.max(0, liveSetup),
        timeFromSpeechEndToFirstAudioMs: Math.max(0, ttfa),
        totalFirstResponseLatencyMs: Math.max(0, totalLatency),
        turn1TTFAMs: Math.max(0, ttfa),
        firstTurnReport: summaryReport,
      });
    }
  }

  private logTurnComparison(): void {
    const turn1 = this.turnHistory.find((t) => t.turnNumber === 1);
    const turn2 = this.turnHistory.find((t) => t.turnNumber === 2);

    if (turn1 && turn2) {
      console.group('%c📊 [VOICE PROFILER] TURN 1 vs TURN 2 LATENCY COMPARISON', 'color: #3b82f6; font-weight: bold;');
      console.table([
        {
          Turn: 'First Turn (T1)',
          'TTFA (ms)': turn1.ttfaMs ?? '—',
          'Total Latency (ms)': turn1.totalTurnLatencyMs ?? '—',
          Notes: 'Includes warm-up / parallel setup',
        },
        {
          Turn: 'Second Turn (T2)',
          'TTFA (ms)': turn2.ttfaMs ?? '—',
          'Total Latency (ms)': turn2.totalTurnLatencyMs ?? '—',
          Notes: 'Warm connection',
        },
      ]);
      console.groupEnd();

      if (this.onMetricsUpdated) {
        this.onMetricsUpdated({
          turn2TTFAMs: turn2.ttfaMs,
        });
      }
    }
  }
}

export const profiler = new VoiceProfiler();
