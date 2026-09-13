// ============================================================
// AudioVisualizer — Animated canvas waveform
// ============================================================

import { useRef, useEffect, useCallback } from 'react';

interface AudioVisualizerProps {
  analyserData?: Uint8Array | null;
  rms?: number;
  isActive: boolean;
  variant?: 'bars' | 'wave' | 'orb';
  color?: string;
  className?: string;
}

export function AudioVisualizer({
  analyserData,
  rms = 0,
  isActive,
  variant = 'bars',
  color = '#22c55e',
  className = '',
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef(0);

  const drawBars = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array | null, phase: number) => {
      ctx.clearRect(0, 0, w, h);

      const barCount = 32;
      const barWidth = w / barCount - 2;
      const centerY = h / 2;

      for (let i = 0; i < barCount; i++) {
        let amplitude: number;
        if (data && isActive) {
          const idx = Math.floor((i / barCount) * data.length);
          amplitude = (data[idx] / 255) * (h * 0.45);
          // Add subtle wave motion
          amplitude += Math.sin(phase + i * 0.4) * 3;
        } else {
          // Idle breathing animation
          amplitude = Math.sin(phase * 0.8 + i * 0.5) * (h * 0.06) + h * 0.04;
        }

        amplitude = Math.max(amplitude, 2);
        const x = i * (barWidth + 2) + 1;
        const alpha = isActive ? 0.9 : 0.35;

        // Gradient fill for each bar
        const grad = ctx.createLinearGradient(x, centerY - amplitude, x, centerY + amplitude);
        grad.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`);
        grad.addColorStop(0.5, `${color}ff`);
        grad.addColorStop(1, `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, centerY - amplitude, barWidth, amplitude * 2, barWidth / 2);
        ctx.fill();
      }
    },
    [color, isActive]
  );

  const drawOrb = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, energy: number, phase: number) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const baseRadius = Math.min(w, h) * 0.28;
      const pulse = isActive ? energy * Math.min(w, h) * 0.18 : 0;
      const radius = baseRadius + pulse + Math.sin(phase * 1.2) * (isActive ? 4 : 2);

      // Outer glow
      for (let i = 3; i >= 1; i--) {
        const glowRadius = radius + i * 8;
        const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, glowRadius);
        glowGrad.addColorStop(0, `${color}30`);
        glowGrad.addColorStop(1, `${color}00`);
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core orb
      const orbGrad = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.25, 0, cx, cy, radius);
      orbGrad.addColorStop(0, '#ffffff60');
      orbGrad.addColorStop(0.4, `${color}cc`);
      orbGrad.addColorStop(1, `${color}88`);
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight
      const hlGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius * 0.6);
      hlGrad.addColorStop(0, '#ffffff40');
      hlGrad.addColorStop(1, '#ffffff00');
      ctx.fillStyle = hlGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    },
    [color, isActive]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      phaseRef.current += 0.06;
      const { width: w, height: h } = canvas;

      if (variant === 'orb') {
        drawOrb(ctx, w, h, rms * 4, phaseRef.current);
      } else {
        drawBars(ctx, w, h, analyserData || null, phaseRef.current);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [analyserData, rms, isActive, variant, drawBars, drawOrb]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={300}
      height={120}
      style={{ display: 'block' }}
    />
  );
}
