// ============================================================
// DebugPanel — Developer Diagnostics Overlay (Ctrl+Shift+D)
// Categorized Sections: SESSION, AUDIO, PLAYBACK, TURN, LISTENERS, RESOURCES
// ============================================================

import { useEffect, useState } from 'react';
import type { VoiceMetrics } from '../../types/voice';
import { VoiceState } from '../../types/voice';

interface DebugPanelProps {
  metrics: VoiceMetrics;
  voiceState: VoiceState;
}

export function DebugPanel({ metrics, voiceState }: DebugPanelProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!visible) return null;

  const fmt = (v: number | null | undefined, unit = 'ms') =>
    v == null ? '—' : `${Math.round(v)}${unit}`;

  const lastMsgAgo = metrics.lastMessageTime
    ? `${Math.max(0, Math.round((Date.now() - metrics.lastMessageTime) / 1000))}s ago`
    : '—';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        zIndex: 9999,
        background: 'rgba(10,12,16,0.92)',
        color: '#00ff88',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '11px',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid #00ff8840',
        backdropFilter: 'blur(10px)',
        lineHeight: 1.6,
        minWidth: '280px',
        maxWidth: '340px',
        maxHeight: '85vh',
        overflowY: 'auto',
        userSelect: 'none',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #00ff8830', paddingBottom: '4px' }}>
        <span style={{ fontWeight: 'bold', letterSpacing: '0.05em', color: '#fff' }}>
          🛠 VOICE DIAGNOSTICS
        </span>
        <span style={{ color: '#ffffff50', fontSize: '10px' }}>Ctrl+Shift+D</span>
      </div>

      {/* ── SESSION ── */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>
          [SESSION]
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Connected:</span>
          <span>{metrics.sessionConnected ? 'YES' : 'NO'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Session ID:</span>
          <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={metrics.sessionId || ''}>
            {metrics.sessionId ? metrics.sessionId.slice(0, 16) + '...' : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>State:</span>
          <span>{metrics.sessionState || 'CLOSED'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Last Msg:</span>
          <span>{lastMsgAgo}</span>
        </div>
      </div>

      {/* ── AUDIO ── */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>
          [AUDIO]
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>AudioContext:</span>
          <span style={{ color: metrics.audioContextState === 'running' ? '#00ff88' : '#f59e0b' }}>
            {metrics.audioContextState || 'closed'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Mic:</span>
          <span>{metrics.micTrackState === 'live' ? 'live' : metrics.micTrackState || 'inactive'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Output:</span>
          <span>{metrics.audioPlaybackStatus === 'playing' ? 'active' : 'idle'}</span>
        </div>
      </div>

      {/* ── PLAYBACK ── */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>
          [PLAYBACK]
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Queue:</span>
          <span>{metrics.queueLength ?? 0}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Active sources:</span>
          <span>{metrics.activeSources ?? 0}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Scheduler:</span>
          <span>{metrics.schedulerState || 'idle'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Chunks (Rx/Play/Rem):</span>
          <span>{metrics.chunksReceived ?? 0} / {metrics.chunksPlayed ?? 0} / {metrics.chunksRemaining ?? 0}</span>
        </div>
      </div>

      {/* ── TURN ── */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>
          [TURN]
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Current turn:</span>
          <span>{metrics.currentTurnId ?? 1}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Voice State:</span>
          <span>{voiceState}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Mic Lock:</span>
          <span>{metrics.userInputLocked ? '🔒 Locked' : '🔓 Unlocked'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Gemini generation:</span>
          <span>{metrics.geminiGenerationStatus || 'idle'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Audio playback:</span>
          <span>{metrics.audioPlaybackStatus || 'idle'}</span>
        </div>
      </div>

      {/* ── LISTENERS ── */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>
          [LISTENERS]
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Gemini message listeners:</span>
          <span>{metrics.geminiMessageListeners ?? (metrics.sessionConnected ? 1 : 0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Microphone listeners:</span>
          <span>{metrics.micListeners ?? 1}</span>
        </div>
      </div>

      {/* ── RESOURCES ── */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>
          [RESOURCES]
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Live sessions:</span>
          <span>{metrics.liveSessionCount ?? (metrics.sessionConnected ? 1 : 0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>AudioContexts:</span>
          <span>{metrics.audioContextCount ?? 2}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Mic streams:</span>
          <span>{metrics.micStreamCount ?? (metrics.micStreamActive ? 1 : 0)}</span>
        </div>
      </div>

      {/* ── TIMING ── */}
      <div>
        <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>
          [PERFORMANCE]
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>TTFA (Current):</span>
          <span>{fmt(metrics.ttfaMs)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Turn 1 TTFA:</span>
          <span>{fmt(metrics.turn1TTFAMs)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Turn 2 TTFA:</span>
          <span>{fmt(metrics.turn2TTFAMs)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#ffffff80' }}>Reconnects:</span>
          <span>{String(metrics.reconnectCount)}</span>
        </div>
      </div>
    </div>
  );
}

