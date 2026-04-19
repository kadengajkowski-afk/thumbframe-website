// Thumbtown scene compositor — Phase 2 static layout (rebuild).
//
// Stacked PNG layers + colour stubs for un-generated MJ assets. No
// animation, no parallax, no click handlers (Phase 3 / 4 / 5). The
// baked hero base is mountain-main.png (sky + mountain + river +
// Frame doorway in one image). Around it we compose:
//
//   • floating islands in the upper-centre sky band
//   • a bird flock further right
//   • the village cluster in the river valley
//   • painter / fisherman / gnome sprites at scene-appropriate spots
//
// All positions + sizes live in SCENE_LAYERS below for fast iteration.
// Sprites size by `widthVh` so they scale in lockstep with the baked
// mountain image (which also uses 100vh height), keeping proportions
// consistent at any viewport.

import React from 'react';
import { FRAME_DOORWAY } from './frameConstants';

const ASSETS = '/assets/thumbtown';

// ── Base image y-offset (applied to mountain-main AND the Frame stub
//    so they stay aligned when you nudge). Negative = image shifts up. ──
const BASE_Y_OFFSET_PCT = -2;   // %

// ── Sprite layer configuration. Each layer renders as an <img> with:
//    • top OR bottom in %
//    • left OR right in %
//    • width expressed in vh so it scales with the base image (which is
//      h-100vh); or vw for items that should match viewport width
//    • maxWidth px cap so sprites don't go comically large on ultrawide
//    • mobile: true renders on <768px; false hides via md:block.
// ───────────────────────────────────────────────────────────────────── */
const SCENE_LAYERS = [
  // Floating islands — upper sky band, a bit left of centre.
  {
    key: 'islands',
    src: `${ASSETS}/floating-islands/floating-islands.png`,
    top:    '6%',
    left:   '30%',
    widthVh:  45,     // ~45% of viewport height
    maxWidth: 520,
    opacity:  0.95,
    mobile: false,
  },
  // Bird flock — right side of the sky, smaller.
  {
    key: 'birds',
    src: `${ASSETS}/effects/birds.png`,
    top:    '10%',
    right:  '14%',
    widthVh:  20,
    maxWidth: 280,
    opacity:  0.88,
    mobile: false,
  },
  // Village cluster — in the river valley, slightly left of centre.
  {
    key: 'village',
    src: `${ASSETS}/village/village.png`,
    bottom: '16%',
    left:   '36%',
    widthVh:  28,
    maxWidth: 420,
    opacity:  1.0,
    mobile: true,           // keep on mobile — centres the composition
  },
  // Painter — on cliff edge, just right of village, above it in z-stack.
  {
    key: 'painter',
    src: `${ASSETS}/characters/painter.png`,
    bottom: '30%',
    left:   '52%',
    widthVh:   6.5,
    maxWidth: 110,
    opacity:  1.0,
    mobile: false,
  },
  // Fisherman — on rocky outcrop in the coast area, right third.
  {
    key: 'fisherman',
    src: `${ASSETS}/characters/fisherman.png`,
    bottom: '14%',
    right:  '11%',
    widthVh:   7,
    maxWidth: 120,
    opacity:  1.0,
    mobile: false,
  },
  // Gnome — tucked in the forest, left third.
  {
    key: 'gnome',
    src: `${ASSETS}/characters/gnome.png`,
    bottom: '18%',
    left:   '11%',
    widthVh:   6,
    maxWidth: 100,
    opacity:  1.0,
    mobile: false,
  },
];

// Convert a SCENE_LAYERS entry to inline CSS.
function layerStyle(cfg) {
  const style = {
    position: 'absolute',
    pointerEvents: 'none',
    userSelect: 'none',
    opacity: cfg.opacity,
    width: cfg.widthVh !== undefined ? `${cfg.widthVh}vh` : undefined,
    maxWidth: cfg.maxWidth,
    height: 'auto',
  };
  if (cfg.top    !== undefined) style.top    = cfg.top;
  if (cfg.bottom !== undefined) style.bottom = cfg.bottom;
  if (cfg.left   !== undefined) style.left   = cfg.left;
  if (cfg.right  !== undefined) style.right  = cfg.right;
  return style;
}

// ───────────────────────────────────────────────────────────────────── //

export default function ThumbtownScene() {
  return (
    <div
      className="absolute inset-0 overflow-hidden select-none"
      style={{ background: '#141024' }}
      aria-hidden
    >
      {/* ── Stubs for un-generated MJ assets (spec §11 items 4–9) ── */}
      <Stubs />

      {/* ── Baked hero base — mountain-main.png ──
          Portrait 816×1456, rendered at 100vh height (auto width), centred
          horizontally. Occupies ~31% of a 16:9 viewport width; stubs flank. */}
      <img
        src={`${ASSETS}/backgrounds/mountain-main.png`}
        alt=""
        draggable={false}
        className="absolute top-0 left-1/2 h-full w-auto max-w-none select-none"
        style={{
          transform: `translateX(-50%) translateY(${BASE_Y_OFFSET_PCT}%)`,
          willChange: 'transform',
        }}
      />

      {/* ── Frame doorway stub + EDITOR label (placeholder for Phase-6
            3D FrameWarp). Anchored in vh so it tracks the base image. */}
      <FrameDoorwayStub />

      {/* ── Sprite layers ──
          Each driven by SCENE_LAYERS config above. */}
      {SCENE_LAYERS.map((cfg) => (
        <img
          key={cfg.key}
          src={cfg.src}
          alt=""
          draggable={false}
          className={cfg.mobile ? 'absolute' : 'absolute hidden md:block'}
          style={layerStyle(cfg)}
        />
      ))}
    </div>
  );
}

// ── Colour-gradient stubs — replace with real PNGs as they arrive. ────
function Stubs() {
  return (
    <>
      {/* Forest panel — LEFT third (spec §3 Enchanted Forest). */}
      <div
        className="absolute inset-y-0 left-0 pointer-events-none hidden md:block"
        style={{
          width: '38%',
          background:
            'linear-gradient(90deg, #1a2620 0%, #1d3328 22%, #20382c 45%, rgba(30, 48, 38, 0.55) 80%, transparent 100%)',
        }}
      />
      {/* Coast panel — RIGHT third (spec §3 Coast + Mountain area). */}
      <div
        className="absolute inset-y-0 right-0 pointer-events-none hidden md:block"
        style={{
          width: '34%',
          background:
            'linear-gradient(270deg, #3a2818 0%, #4a3020 28%, #583a22 55%, rgba(70, 46, 28, 0.45) 82%, transparent 100%)',
        }}
      />
      {/* Distant mountain range silhouette — polygon right-bottom. */}
      <div
        className="absolute pointer-events-none hidden md:block"
        style={{
          right: 0,
          bottom: '20%',
          width: '28%',
          height: '24%',
          background:
            'linear-gradient(180deg, rgba(74, 58, 82, 0.65) 0%, rgba(46, 32, 58, 0.75) 100%)',
          clipPath:
            'polygon(0% 100%, 10% 40%, 22% 60%, 38% 20%, 52% 50%, 70% 25%, 85% 55%, 100% 40%, 100% 100%)',
          filter: 'blur(1px)',
        }}
      />
      {/* Foreground grass band — bottom 8%, warm olive gradient. */}
      <div
        className="absolute left-0 right-0 bottom-0 pointer-events-none"
        style={{
          height: '8%',
          background:
            'linear-gradient(180deg, transparent 0%, rgba(58, 40, 22, 0.7) 45%, #3a2818 100%)',
        }}
      />
    </>
  );
}

// ── Frame doorway stub ──────────────────────────────────────────────
// Converts the image-space doorway rect (from frameConstants) to a
// vh-based overlay on the mountain-main base image. For Phase 2 we draw
// an outlined rectangle + EDITOR label so the registration point is
// visible during layout iteration. Phase 6 replaces this with the
// real 3D FrameWarp mesh.
function FrameDoorwayStub() {
  const { imageWidth, imageHeight, doorway } = FRAME_DOORWAY;

  // Everything expressed in vh because the base image renders at height
  // 100vh → a horizontal distance of imagePx == (imagePx/imageHeight)·100vh.
  const toVh = (imagePx) => `${(imagePx / imageHeight) * 100}vh`;
  const leftFromImgCenter = toVh(doorway.topLeft.x - imageWidth / 2);
  const topVh             = toVh(doorway.topLeft.y - imageHeight * Math.abs(BASE_Y_OFFSET_PCT) / 100);
  const widthVh           = toVh(imageWidth  * doorway.widthPct);
  const heightVh          = toVh(imageHeight * doorway.heightPct);

  return (
    <>
      <div
        className="absolute pointer-events-none hidden md:block"
        style={{
          left: `calc(50% + ${leftFromImgCenter})`,
          top: topVh,
          width: widthVh,
          height: heightVh,
          border: '1.5px solid rgba(249, 180, 80, 0.65)',
          boxShadow:
            '0 0 24px -4px rgba(249, 180, 80, 0.55), inset 0 0 20px rgba(249, 180, 80, 0.25)',
          borderRadius: 3,
        }}
      />
      <div
        className="absolute pointer-events-none hidden md:block"
        style={{
          left: `calc(50% + ${leftFromImgCenter})`,
          top: `calc(${topVh} + ${heightVh} + 0.6vh)`,
          width: widthVh,
          textAlign: 'center',
          color: '#f0e4d0',
          fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
          fontSize: '1.35vh',
          fontWeight: 500,
          letterSpacing: '0.42em',
          textShadow: '0 1px 6px rgba(10, 7, 20, 0.9)',
        }}
      >
        EDITOR
      </div>
    </>
  );
}
