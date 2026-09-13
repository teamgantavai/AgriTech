// ============================================================
// DebugPanel — Developer metrics overlay (Ctrl+Shift+D)
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

  const rows: [string, string][] = [
    ['State', voiceState],
    ['Mic Lock', metrics.userInputLocked ? '🔒 Locked' : '🔓 Unlocked'],
    ['Session', metrics.sessionConnected ? '✅ Connected' : '❌ Disconnected'],
    ['Connection', fmt(metrics.connectionTimeMs)],
    ['Mic Init Time', fmt(metrics.microphoneInitTimeMs)],
    ['Live Setup Time', fmt(metrics.liveSetupTimeMs)],
    ['Turn 1 TTFA', fmt(metrics.turn1TTFAMs)],
    ['Turn 2 TTFA', fmt(metrics.turn2TTFAMs)],
    ['Total 1st Latency', fmt(metrics.totalFirstResponseLatencyMs)],
    ['TTFA (Current)', fmt(metrics.ttfaMs)],
    ['User Speech', fmt(metrics.userSpeechDurationMs)],
    ['AI Response', fmt(metrics.assistantResponseDurationMs)],
    ['Last Turn', fmt(metrics.lastTurnDurationMs)],
    ['VAD', metrics.vadActive ? '🔴 Active' : '⚪ Idle'],
    ['Audio In', '16 kHz PCM'],
    ['Audio Out', '24 kHz PCM'],
    ['Interruptions', String(metrics.interruptionCount)],
    ['Reconnects', String(metrics.reconnectCount)],
  ];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        zIndex: 9999,
        background: 'rgba(0,0,0,0.88)',
        color: '#00ff88',
        fontFamily: 'monospace',
        fontSize: '11px',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid #00ff8840',
        backdropFilter: 'blur(8px)',
        lineHeight: 1.7,
        minWidth: '220px',
        userSelect: 'none',
      }}
    >
      <div style={{ color: '#ffffff80', marginBottom: '6px', letterSpacing: '0.05em' }}>
        🛠 VOICE DEBUG <span style={{ color: '#ffffff40', fontSize: '10px' }}>Ctrl+Shift+D</span>
      </div>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ color: '#ffffff60' }}>{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}
