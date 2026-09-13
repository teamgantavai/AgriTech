// ============================================================
// AnimatedGlobe — 3D-like glassy animated sphere with fluid
// multi-colored aura clouds inside, responsive to voice & audio
// ============================================================

import { useRef, useEffect } from 'react';

interface AnimatedGlobeProps {
  analyserData?: Uint8Array | null;
  rms?: number;
  isActive: boolean;
  isSpeaking?: boolean;
  size?: number;
  className?: string;
}

export function AnimatedGlobe({
  analyserData,
  rms = 0,
  isActive,
  isSpeaking = false,
  size = 300,
  className = '',
}: AnimatedGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);
  const smoothedEnergyRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const globeRadius = size * 0.44;

    const render = () => {
      // Audio energy calculation
      let currentEnergy = 0;
      if (isSpeaking && analyserData && analyserData.length > 0) {
        // AI speaking: sample frequencies
        let sum = 0;
        const count = Math.min(64, analyserData.length);
        for (let i = 0; i < count; i++) {
          sum += analyserData[i];
        }
        currentEnergy = (sum / (count * 255)) * 1.5;
      } else if (isActive && rms > 0) {
        // User speaking: mic RMS
        currentEnergy = Math.min(rms * 4.5, 2.0);
      }

      // Smooth energy with lerp
      smoothedEnergyRef.current += (currentEnergy - smoothedEnergyRef.current) * 0.12;
      const energy = smoothedEnergyRef.current;

      // Speed up animation with voice energy
      const speed = 0.02 + energy * 0.035;
      timeRef.current += speed;
      const t = timeRef.current;

      ctx.clearRect(0, 0, size, size);

      // ── Outer Soft Ambient Drop Shadow on White BG ──
      ctx.save();
      const shadowGrad = ctx.createRadialGradient(cx, cy + globeRadius * 0.2, globeRadius * 0.7, cx, cy + globeRadius * 0.2, globeRadius * 1.15);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.07)');
      shadowGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.03)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy + globeRadius * 0.2, globeRadius * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── Clip to Globe Sphere ──
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
      ctx.clip();

      // ── Globe Inner Base (Soft translucent pearlescent glass) ──
      const baseGrad = ctx.createRadialGradient(
        cx - globeRadius * 0.2,
        cy - globeRadius * 0.2,
        0,
        cx,
        cy,
        globeRadius
      );
      baseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      baseGrad.addColorStop(0.5, 'rgba(250, 250, 252, 0.85)');
      baseGrad.addColorStop(0.85, 'rgba(238, 240, 246, 0.75)');
      baseGrad.addColorStop(1, 'rgba(220, 224, 235, 0.6)');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, size, size);

      // ── Fluid Clouds Swirling Inside ──
      // Color Palettes matching reference:
      // 1. Cyan / Aqua
      // 2. Bright Magenta / Rose Pink
      // 3. Electric Purple / Violet
      // 4. Soft Sunny Amber / Peach
      const fluidCenterRadius = globeRadius * 0.7;
      const pulseFactor = 1 + energy * 0.35;

      // Enable composite mode for rich ethereal color blending
      ctx.globalCompositeOperation = 'multiply';

      // Blob 1: Cyan / Aqua cloud (center-left)
      const b1x = cx + Math.cos(t * 1.1) * (fluidCenterRadius * 0.25) - 10;
      const b1y = cy + Math.sin(t * 0.9) * (fluidCenterRadius * 0.22);
      const b1r = (globeRadius * 0.42 + Math.sin(t * 1.4) * 8) * pulseFactor;
      const grad1 = ctx.createRadialGradient(b1x, b1y, 0, b1x, b1y, b1r);
      grad1.addColorStop(0, 'rgba(0, 195, 255, 0.9)');
      grad1.addColorStop(0.45, 'rgba(0, 160, 245, 0.65)');
      grad1.addColorStop(0.8, 'rgba(0, 220, 255, 0.25)');
      grad1.addColorStop(1, 'rgba(0, 200, 255, 0)');
      ctx.fillStyle = grad1;
      ctx.beginPath();
      ctx.arc(b1x, b1y, b1r, 0, Math.PI * 2);
      ctx.fill();

      // Blob 2: Vibrant Pink / Magenta cloud (top-right / center)
      const b2x = cx + Math.sin(t * 0.85) * (fluidCenterRadius * 0.28) + 12;
      const b2y = cy - Math.cos(t * 1.2) * (fluidCenterRadius * 0.25) - 8;
      const b2r = (globeRadius * 0.44 + Math.cos(t * 1.1) * 10) * pulseFactor;
      const grad2 = ctx.createRadialGradient(b2x, b2y, 0, b2x, b2y, b2r);
      grad2.addColorStop(0, 'rgba(255, 75, 150, 0.85)');
      grad2.addColorStop(0.5, 'rgba(255, 110, 175, 0.55)');
      grad2.addColorStop(0.85, 'rgba(255, 160, 200, 0.2)');
      grad2.addColorStop(1, 'rgba(255, 120, 180, 0)');
      ctx.fillStyle = grad2;
      ctx.beginPath();
      ctx.arc(b2x, b2y, b2r, 0, Math.PI * 2);
      ctx.fill();

      // Blob 3: Royal Purple / Violet cloud (bottom / center-right)
      const b3x = cx + Math.cos(t * 0.95 + 1.8) * (fluidCenterRadius * 0.22) + 15;
      const b3y = cy + Math.sin(t * 1.05 + 1.2) * (fluidCenterRadius * 0.26) + 16;
      const b3r = (globeRadius * 0.38 + Math.sin(t * 1.3 + 0.5) * 8) * pulseFactor;
      const grad3 = ctx.createRadialGradient(b3x, b3y, 0, b3x, b3y, b3r);
      grad3.addColorStop(0, 'rgba(150, 60, 235, 0.85)');
      grad3.addColorStop(0.48, 'rgba(165, 85, 245, 0.5)');
      grad3.addColorStop(0.85, 'rgba(180, 120, 255, 0.18)');
      grad3.addColorStop(1, 'rgba(160, 80, 240, 0)');
      ctx.fillStyle = grad3;
      ctx.beginPath();
      ctx.arc(b3x, b3y, b3r, 0, Math.PI * 2);
      ctx.fill();

      // Blob 4: Warm Gold / Peach Amber cloud (surrounding aura)
      const b4x = cx - Math.sin(t * 0.7 + 0.4) * (fluidCenterRadius * 0.3);
      const b4y = cy - Math.cos(t * 0.8 + 0.7) * (fluidCenterRadius * 0.28);
      const b4r = (globeRadius * 0.52 + Math.cos(t * 0.9) * 12) * pulseFactor;
      const grad4 = ctx.createRadialGradient(b4x, b4y, 0, b4x, b4y, b4r);
      grad4.addColorStop(0, 'rgba(255, 185, 80, 0.75)');
      grad4.addColorStop(0.4, 'rgba(255, 210, 110, 0.45)');
      grad4.addColorStop(0.75, 'rgba(255, 230, 160, 0.2)');
      grad4.addColorStop(1, 'rgba(255, 200, 100, 0)');
      ctx.fillStyle = grad4;
      ctx.beginPath();
      ctx.arc(b4x, b4y, b4r, 0, Math.PI * 2);
      ctx.fill();

      // Reset composite mode for glass shading
      ctx.globalCompositeOperation = 'source-over';

      // ── Inner Rim Depth & Frosted Soft Glow ──
      const innerRim = ctx.createRadialGradient(
        cx,
        cy,
        globeRadius * 0.7,
        cx,
        cy,
        globeRadius
      );
      innerRim.addColorStop(0, 'rgba(255, 255, 255, 0)');
      innerRim.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
      innerRim.addColorStop(0.92, 'rgba(255, 255, 255, 0.7)');
      innerRim.addColorStop(1, 'rgba(200, 210, 225, 0.5)');
      ctx.fillStyle = innerRim;
      ctx.fillRect(0, 0, size, size);

      // ── Specular Highlight: Curved Glass Arc on Upper-Left Rim ──
      // This gives the exact crystalline glass sphere look from the photo
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(
        cx - globeRadius * 0.38,
        cy - globeRadius * 0.38,
        globeRadius * 0.42,
        globeRadius * 0.22,
        -Math.PI / 4,
        0,
        Math.PI * 2
      );
      const highlightGrad = ctx.createRadialGradient(
        cx - globeRadius * 0.38,
        cy - globeRadius * 0.38,
        0,
        cx - globeRadius * 0.38,
        cy - globeRadius * 0.38,
        globeRadius * 0.4
      );
      highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      highlightGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.5)');
      highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = highlightGrad;
      ctx.fill();
      ctx.restore();

      // Secondary soft reflection on bottom-right edge
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(
        cx + globeRadius * 0.42,
        cy + globeRadius * 0.42,
        globeRadius * 0.3,
        globeRadius * 0.12,
        -Math.PI / 4,
        0,
        Math.PI * 2
      );
      const secHighlightGrad = ctx.createRadialGradient(
        cx + globeRadius * 0.42,
        cy + globeRadius * 0.42,
        0,
        cx + globeRadius * 0.42,
        cy + globeRadius * 0.42,
        globeRadius * 0.25
      );
      secHighlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      secHighlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = secHighlightGrad;
      ctx.fill();
      ctx.restore();

      ctx.restore(); // end clip

      // ── Crisp Glass Perimeter Border ──
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.stroke();

      // Outer delicate subtle outline
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius + 0.5, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.stroke();
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [size, isActive, isSpeaking, analyserData, rms]);

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'block',
        }}
      />
    </div>
  );
}
