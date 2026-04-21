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
// Each tendril is a SHORT, independently positioned ribbon. Path geometry
// is built in ribbon-local space (x: 0..length, y: 0 centerline, noise-
// displaced) and placed into the viewport by a per-ribbon <g translate +
// rotate> transform. Each tendril has its own stroke-width, blur, linear
// gradient (end-fade), drift direction, and phase — so the six ribbons
// read as distinct light ribbons in different places, not one band.

// Smooth hash-based value noise, 1-D.
function hash(n) { return (Math.sin(n * 43758.5453) + 1) / 2; }
function smooth(x) { return x * x * (3 - 2 * x); }
function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  return hash(i) * (1 - smooth(f)) + hash(i + 1) * smooth(f);
}

// Six tendrils — independent positions, angles, sizes, drift vectors.
// homeX/homeY are viewport-relative (0..1); driftX/driftY are viewport
// fractions traveled across one period before wrapping.
const TENDRILS = [
  { color: '#3afa9a', homeX: 0.15, homeY: 0.22, angle: -22, length: 400, thickness: 60, blur: 24, period: 52, driftX: 0.35, driftY: -0.06, phase: 0.00, shape: 'S' },
  { color: '#3afa9a', homeX: 0.78, homeY: 0.48, angle:  14, length: 320, thickness: 54, blur: 22, period: 56, driftX:-0.30, driftY:  0.08, phase: 0.22, shape: 'curve' },
  { color: '#9060e0', homeX: 0.46, homeY: 0.12, angle: -72, length: 360, thickness: 50, blur: 26, period: 60, driftX: 0.10, driftY:  0.20, phase: 0.44, shape: 'curve' },
  { color: '#9060e0', homeX: 0.26, homeY: 0.68, angle:  28, length: 280, thickness: 46, blur: 22, period: 50, driftX: 0.26, driftY: -0.05, phase: 0.66, shape: 'S' },
  { color: '#f890c8', homeX: 0.62, homeY: 0.28, angle: -10, length: 340, thickness: 52, blur: 24, period: 54, driftX:-0.22, driftY:  0.10, phase: 0.11, shape: 'curve' },
  { color: '#5ad0d8', homeX: 0.38, homeY: 0.54, angle: -58, length: 300, thickness: 48, blur: 22, period: 58, driftX: 0.18, driftY: -0.14, phase: 0.88, shape: 'S' },
];

const PATH_SAMPLES = 14;

// Build a ribbon path in LOCAL space: starts at (0,0), ends at (L,0),
// centerline displaced by noise. 'S' shape adds an extra low-frequency
// swing so the ribbon curves back on itself; 'curve' is a simpler arc.
function buildLocalRibbonPath(t, tendril) {
  const { length, phase, shape } = tendril;
  const swing = length * 0.22;  // how far y can deviate from the axis
  const seed = phase * 17.3;

  const pts = [];
  for (let i = 0; i <= PATH_SAMPLES; i++) {
    const u = i / PATH_SAMPLES;
    const x = u * length;

    // Base curve — either S or a single arc — parameterised by u.
    let base;
    if (shape === 'S') {
      base = Math.sin(u * Math.PI * 1.6) * 0.8;   // double curve
    } else {
      base = Math.sin(u * Math.PI) * 0.65;        // single arc
    }

    // Morph: low-frequency noise shifts the shape over time.
    const n1 = noise1(u * 2.6 + t * 0.22 + seed);
    const n2 = noise1(u * 1.1 + t * 0.11 + seed * 0.6);
    const noiseDisp = (n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.2;

    const y = (base + noiseDisp) * swing;
    pts.push([x, y]);
  }

  // Catmull-Rom → cubic bezier conversion through the sampled points.
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

// Resolve ribbon position in viewport space, with wrap so ribbons
// continuously drift through their home area without piling up.
function ribbonPosition(t, w, h, tendril) {
  const { homeX, homeY, driftX, driftY, period, phase, length } = tendril;
  // 0..1 progress through the drift cycle.
  const prog = ((t / period) + phase) % 1;
  // Signed offset centered on 0 so the ribbon passes through its home
  // position; drift vector scales with viewport dimensions.
  const ox = (prog - 0.5) * driftX * (w + length);
  const oy = (prog - 0.5) * driftY * h;
  return { x: homeX * w + ox, y: homeY * h + oy };
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

// Per-ribbon renderer. Each tendril gets its own <g> whose transform is
// updated every frame to drift + rotate it independently. Inside that
// group the ribbon path lives in LOCAL space (origin at one end of the
// ribbon) with two strokes: a wide soft halo + a tighter bright core.
function AuroraOverlayBoth() {
  const groupRefs = useRef(TENDRILS.map(() => null));
  const haloRefs  = useRef(TENDRILS.map(() => null));
  const coreRefs  = useRef(TENDRILS.map(() => null));

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
        const { x, y } = ribbonPosition(t, dims.w, dims.h, tendril);
        const g = groupRefs.current[i];
        if (g) g.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${tendril.angle})`);

        const d = buildLocalRibbonPath(t, tendril);
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
            <filter id={`aurora-blur-${i}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation={tendril.blur} />
            </filter>
            {/* End-fade: ribbon-local x runs 0..length, gradient fades
                both ends so the ribbon reads as a short glowing streak
                rather than a hard-capped stroke. */}
            <linearGradient
              id={`aurora-grad-${i}`}
              gradientUnits="userSpaceOnUse"
              x1="0" y1="0" x2={tendril.length} y2="0"
            >
              <stop offset="0"    stopColor={tendril.color} stopOpacity="0" />
              <stop offset="0.18" stopColor={tendril.color} stopOpacity="0.75" />
              <stop offset="0.5"  stopColor={tendril.color} stopOpacity="0.95" />
              <stop offset="0.82" stopColor={tendril.color} stopOpacity="0.75" />
              <stop offset="1"    stopColor={tendril.color} stopOpacity="0" />
            </linearGradient>
          </React.Fragment>
        ))}
      </defs>
      {TENDRILS.map((tendril, i) => (
        <g key={i} ref={(el) => { groupRefs.current[i] = el; }}>
          {/* Wide soft halo — thickness * 1.6, higher blur via filter */}
          <path
            ref={(el) => { haloRefs.current[i] = el; }}
            d=""
            fill="none"
            stroke={`url(#aurora-grad-${i})`}
            strokeWidth={tendril.thickness * 1.6}
            strokeLinecap="round"
            filter={`url(#aurora-blur-${i})`}
            opacity={0.55}
          />
          {/* Bright core — the target thickness per spec (40-80px) */}
          <path
            ref={(el) => { coreRefs.current[i] = el; }}
            d=""
            fill="none"
            stroke={`url(#aurora-grad-${i})`}
            strokeWidth={tendril.thickness}
            strokeLinecap="round"
            filter={`url(#aurora-blur-${i})`}
            opacity={0.95}
          />
        </g>
      ))}
    </svg>
  );
}
