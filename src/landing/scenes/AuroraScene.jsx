// AuroraScene — composite backdrop for the logged-in account area.
//
// Three stacked layers, back to front:
//
//   1. <NebulaBackdrop />      — three-fiber Canvas running the near-black
//                                Nebula inside PainterlyPost (Kuwahara,
//                                outline, grain, grade). Atmospheric
//                                watercolor base only.
//
//   2. <StarfieldOverlay />    — plain 2D <canvas> positioned above. Dense
//                                starfield (tiered sizes, independent
//                                twinkle) drawn with crisp radial
//                                gradients. No post-process — stars render
//                                as clean bright pinpricks.
//
//   3. <AuroraOverlay />       — SVG with 5 morphing bezier tendrils.
//                                Each ribbon is a stroke with a
//                                per-tendril radial gradient head and
//                                heavy Gaussian blur; mix-blend-mode
//                                'screen' on the container so overlaps
//                                brighten. No post-process — flowing,
//                                glowy, ethereal.
//
// Pages mount this single component; it renders all three layers inside
// a fixed inset-0 wrapper behind the page content.

import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Nebula from './shared/Nebula';
import PainterlyPost from '../shaders/painterly/PainterlyPost';

const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

// ── Nebula backdrop (inside painterly pipeline) ───────────────────────────────
const NEBULA_PALETTE = {
  core:       '#020210',
  mid:        '#050515',
  highlight:  '#0a0a1a',
  accent:     '#0a0a1a',
  noiseScale: 1.5,
  octaves:    3,
  turbulence: 0.2,
};

function NebulaBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#020308',
      }}
    >
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, 0, 9] }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Nebula palette={NEBULA_PALETTE} driftSpeed={0.07} />
          <ambientLight color="#0a0e20" intensity={0.2} />
          <directionalLight color="#3a4068" position={[3, 2, 4]} intensity={0.15} />
          {!POST_DISABLED && <PainterlyPost />}
        </Suspense>
      </Canvas>
    </div>
  );
}

// ── Starfield overlay (plain canvas — skips painterly) ───────────────────────
const STAR_COUNT = isMobile ? 1200 : 1800;

function StarfieldOverlay() {
  const canvasRef = useRef(null);

  const stars = useMemo(() => {
    const arr = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = Math.random();
      let size;
      if (r < 0.90)      size = 0.5 + Math.random() * 0.8;   // tiny
      else if (r < 0.98) size = 1.2 + Math.random() * 0.6;   // small
      else               size = 1.8 + Math.random() * 1.0;   // bright

      const warm = r >= 0.98 && Math.random() < 0.5;
      const color = warm
        ? { r: 255, g: 230, b: 195 }   // warm amber tint
        : { r: 255, g: 250, b: 240 };  // warm white

      arr.push({
        x: Math.random(),          // 0..1 viewport-relative
        y: Math.random(),
        size,
        color,
        phase: Math.random() * Math.PI * 2,
        period: 2 + Math.random() * 4,   // 2-6s twinkle period
      });
    }
    return arr;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0;

    let width = 0, height = 0, dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();

    function draw() {
      const t = (performance.now() - start) / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';  // additive-ish — overlaps brighten

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        // Independent twinkle — period in [2, 6]s, amplitude clamped 0.4..1.0.
        const w = (Math.PI * 2) / s.period;
        const osc = Math.sin(t * w + s.phase) * 0.3 + 0.7;
        const alpha = Math.max(0.4, Math.min(1.0, osc));

        const cx = s.x * width;
        const cy = s.y * height;
        const rad = s.size;

        // Soft radial glow — small bright core, gentle halo.
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 3.2);
        const { r, g, b } = s.color;
        grad.addColorStop(0,   `rgba(${r},${g},${b},${alpha})`);
        grad.addColorStop(0.35, `rgba(${r},${g},${b},${alpha * 0.35})`);
        grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [stars]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Aurora overlay (SVG — skips painterly) ───────────────────────────────────
//
// Each tendril is an SVG path driven by a small number of control points
// that drift via summed-noise offsets. The shape is built as a smooth
// cubic-bezier through those points. Stroke uses a per-tendril radial
// gradient (bright core, transparent ends) + heavy Gaussian blur; the
// outer container uses mix-blend-mode 'screen' so overlapping tendrils
// brighten additively.

const TENDRILS = [
  { color: '#3afa9a', baseY: 0.16, amp: 0.10, period: 52, phase: 0.00, waveFreq: 1.3, waveAmp: 0.08, blur: 22, opacity: 0.85 },
  { color: '#3afa9a', baseY: 0.28, amp: 0.08, period: 58, phase: 0.42, waveFreq: 1.0, waveAmp: 0.06, blur: 20, opacity: 0.70 },
  { color: '#9060e0', baseY: 0.10, amp: 0.07, period: 60, phase: 0.18, waveFreq: 1.6, waveAmp: 0.09, blur: 24, opacity: 0.82 },
  { color: '#f890c8', baseY: 0.34, amp: 0.06, period: 50, phase: 0.71, waveFreq: 0.9, waveAmp: 0.05, blur: 22, opacity: 0.72 },
  { color: '#5ad0d8', baseY: 0.22, amp: 0.09, period: 55, phase: 0.56, waveFreq: 1.2, waveAmp: 0.07, blur: 22, opacity: 0.78 },
];

const PATH_SAMPLES = 32;

// Smooth hash-based value noise, 1-D.
function hash(n) { return (Math.sin(n * 43758.5453) + 1) / 2; }
function smooth(x) { return x * x * (3 - 2 * x); }
function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  return hash(i) * (1 - smooth(f)) + hash(i + 1) * smooth(f);
}

// Build an SVG cubic-bezier path that traces a wavy line across the
// viewport at the tendril's current snapshot.
function buildTendrilPath(t, w, h, tendril, offsetX) {
  const {
    baseY,
    amp,
    waveFreq,
    waveAmp,
    phase,
  } = tendril;

  const yCenter = baseY * h;
  const slowDrift = (noise1(t * 0.06 + phase * 3.1) - 0.5) * amp * h;

  // Sample points across the viewport width.
  const pts = [];
  for (let i = 0; i <= PATH_SAMPLES; i++) {
    const u = i / PATH_SAMPLES;
    const xWorld = u * 1.6 - 0.3;  // extend beyond viewport edges
    // Displace along the ribbon axis using x-keyed noise + time.
    const n1 = noise1(xWorld * waveFreq * 3.0 + t * 0.17 + phase * 5.7);
    const n2 = noise1(xWorld * waveFreq * 1.4 + t * 0.09 + phase * 2.3);
    const disp = (n1 - 0.5) * waveAmp * 1.0 + (n2 - 0.5) * waveAmp * 0.45;
    const x = (u * w) + offsetX;
    const y = yCenter + slowDrift + disp * h;
    pts.push([x, y]);
  }

  // Build a smooth cubic-bezier path through the sampled points using the
  // Catmull-Rom → Bezier conversion for tension 0.5.
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

// ── Exported composite ────────────────────────────────────────────────────────
export default function AuroraScene() {
  return (
    <>
      <NebulaBackdrop />
      <StarfieldOverlay />
      <AuroraOverlayBoth />
    </>
  );
}

// Two-pass tendril renderer — one <g> per tendril with halo + core paths;
// both paths animate to the same d each frame.
function AuroraOverlayBoth() {
  const haloRefs = useRef(TENDRILS.map(() => null));
  const coreRefs = useRef(TENDRILS.map(() => null));

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dims = { w: window.innerWidth, h: window.innerHeight };
    const onResize = () => { dims.w = window.innerWidth; dims.h = window.innerHeight; };
    window.addEventListener('resize', onResize);

    function tick() {
      const t = (performance.now() - start) / 1000;
      for (let i = 0; i < TENDRILS.length; i++) {
        const tendril = TENDRILS[i];
        const driftPhase = ((t / tendril.period) + tendril.phase) % 1;
        const offsetX = (driftPhase - 0.5) * dims.w * 1.2;
        const d = buildTendrilPath(t, dims.w, dims.h, tendril, offsetX);
        const halo = haloRefs.current[i];
        const core = coreRefs.current[i];
        if (halo) halo.setAttribute('d', d);
        if (core) core.setAttribute('d', d);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <svg
      aria-hidden
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    >
      <defs>
        {TENDRILS.map((tendril, i) => (
          <React.Fragment key={i}>
            <filter id={`aurora-blur-${i}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={tendril.blur} />
            </filter>
            <linearGradient id={`aurora-grad-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0"    stopColor={tendril.color} stopOpacity="0" />
              <stop offset="0.15" stopColor={tendril.color} stopOpacity={tendril.opacity * 0.7} />
              <stop offset="0.5"  stopColor={tendril.color} stopOpacity={tendril.opacity} />
              <stop offset="0.85" stopColor={tendril.color} stopOpacity={tendril.opacity * 0.7} />
              <stop offset="1"    stopColor={tendril.color} stopOpacity="0" />
            </linearGradient>
          </React.Fragment>
        ))}
      </defs>
      {TENDRILS.map((tendril, i) => (
        <g key={i}>
          <path
            ref={(el) => { haloRefs.current[i] = el; }}
            d=""
            fill="none"
            stroke={`url(#aurora-grad-${i})`}
            strokeWidth={100}
            strokeLinecap="round"
            filter={`url(#aurora-blur-${i})`}
            opacity={0.55}
          />
          <path
            ref={(el) => { coreRefs.current[i] = el; }}
            d=""
            fill="none"
            stroke={`url(#aurora-grad-${i})`}
            strokeWidth={34}
            strokeLinecap="round"
            filter={`url(#aurora-blur-${i})`}
            opacity={0.95}
          />
        </g>
      ))}
    </svg>
  );
}
