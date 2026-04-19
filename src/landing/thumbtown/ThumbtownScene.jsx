// Thumbtown scene compositor — Phase 2 static layout.
//
// Stacked PNG layers + a few colour/gradient stubs where MJ assets haven't
// landed yet. Everything is absolute-positioned on top of a single full-
// viewport container.
//
// No animation. No parallax. No click handlers. Those live in Phase 3+.
//
// Composition strategy (see spec §3):
//   • mountain-main.png is the baked hero base — sky, mountain, river,
//     and the Frame doorway are all in this one image. Because the image
//     is portrait-aspect (0.56), it occupies the central ~32% of a 16:9
//     viewport (full height, auto width). Left and right thirds are
//     stubs for forest / coast panels that land later.
//   • Floating islands + birds overlay the upper sky band.
//   • Village + painter + fisherman + gnome are foreground sprites sized
//     small relative to the world — spec §2 "characters are tiny."
//   • Mobile hides most sprites and scales the mountain to fit.

import React from 'react';
import { FRAME_DOORWAY } from './frameConstants';

const ASSETS = '/assets/thumbtown';

export default function ThumbtownScene() {
  return (
    <div
      className="absolute inset-0 overflow-hidden select-none"
      style={{ background: '#141024' }}
      aria-hidden
    >
      {/* ─── Stub regions for un-generated MJ assets (spec §11 list) ──── */}

      {/* Forest panel — LEFT third (spec §3 "Left third — Enchanted Forest").
          Stubbed with a cool-shifted teal gradient until the forest PNG
          arrives; positioned so it feathers into the central mountain base. */}
      <div
        className="absolute inset-y-0 left-0 pointer-events-none hidden md:block"
        style={{
          width: '38%',
          background:
            'linear-gradient(90deg, #1a2620 0%, #1d3328 22%, #20382c 45%, rgba(30, 48, 38, 0.55) 80%, transparent 100%)',
        }}
      />

      {/* Coast panel — RIGHT third (spec §3 "Right third — Coast +
          Mountain"). Our mountain IS the main mountain, so this is really
          the coast/beach area on the right. Warm peach-amber gradient. */}
      <div
        className="absolute inset-y-0 right-0 pointer-events-none hidden md:block"
        style={{
          width: '34%',
          background:
            'linear-gradient(270deg, #3a2818 0%, #4a3020 28%, #583a22 55%, rgba(70, 46, 28, 0.45) 82%, transparent 100%)',
        }}
      />

      {/* Distant mountain range — pulled from the right beyond the coast
          panel, faint lavender silhouette. Stubbed with a two-triangle
          clip-path div. */}
      <div
        className="absolute pointer-events-none hidden md:block"
        style={{
          right: 0,
          bottom: '20%',
          width: '28%',
          height: '24%',
          background: 'linear-gradient(180deg, rgba(74, 58, 82, 0.65) 0%, rgba(46, 32, 58, 0.75) 100%)',
          clipPath: 'polygon(0% 100%, 10% 40%, 22% 60%, 38% 20%, 52% 50%, 70% 25%, 85% 55%, 100% 40%, 100% 100%)',
          filter: 'blur(1px)',
        }}
      />

      {/* Foreground grass / flowers band — bottom ~8% of viewport. Warm
          olive-amber, gradient rising into transparent. */}
      <div
        className="absolute left-0 right-0 bottom-0 pointer-events-none"
        style={{
          height: '8%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(58, 40, 22, 0.7) 45%, #3a2818 100%)',
        }}
      />

      {/* ─── Baked hero base ─────────────────────────────────────────── */}
      {/* mountain-main.png: sky + mountain + river + Frame all in one
          image. Positioned centre-horizontal, full viewport height, auto
          width. object-position anchors the Frame doorway into the frame
          at roughly viewport-centre when the image overhangs the sides. */}
      <img
        src={`${ASSETS}/backgrounds/mountain-main.png`}
        alt=""
        draggable={false}
        className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-auto max-w-none select-none"
        style={{
          // Slight y-shift so the Frame doorway centre (62.0% image-Y) lands
          // closer to 58% viewport-Y — gives the hero copy visual weight.
          transform: 'translateX(-50%) translateY(-2%)',
          willChange: 'transform',
        }}
      />

      {/* ─── Frame doorway hotspot (Phase-2 stub — just a labelled
            marker; the 3D FrameWarp mesh lands here in Phase 6) ────── */}
      <FrameDoorwayStub />

      {/* ─── Upper-sky elements ────────────────────────────────────── */}

      {/* Floating islands composite — upper-left-of-centre band. */}
      <img
        src={`${ASSETS}/floating-islands/islands.png`}
        alt=""
        draggable={false}
        className="absolute pointer-events-none hidden sm:block"
        style={{
          top: '7%',
          left: '32%',
          width: '30%',
          maxWidth: 480,
          opacity: 0.94,
        }}
      />

      {/* Bird flock — right side of sky band, smaller, warm tint. */}
      <img
        src={`${ASSETS}/effects/birds.png`}
        alt=""
        draggable={false}
        className="absolute pointer-events-none hidden sm:block"
        style={{
          top: '12%',
          right: '18%',
          width: '14%',
          maxWidth: 260,
          opacity: 0.85,
        }}
      />

      {/* ─── Village + characters ──────────────────────────────────── */}

      {/* Village cluster — positioned in the river-valley band, slightly
          left of centre where the river meanders through. */}
      <img
        src={`${ASSETS}/village/village.png`}
        alt=""
        draggable={false}
        className="absolute pointer-events-none"
        style={{
          bottom: '18%',
          left: '38%',
          width: '22%',
          maxWidth: 360,
        }}
      />

      {/* Painter — at easel on cliff edge, right of village (spec §3). */}
      <img
        src={`${ASSETS}/characters/painter.png`}
        alt=""
        draggable={false}
        className="absolute pointer-events-none hidden md:block"
        style={{
          bottom: '32%',
          left: '54%',
          width: '5%',
          maxWidth: 90,
        }}
      />

      {/* Fisherman — on rocky outcrop, right-third / coast area. */}
      <img
        src={`${ASSETS}/characters/fisherman.png`}
        alt=""
        draggable={false}
        className="absolute pointer-events-none hidden md:block"
        style={{
          bottom: '16%',
          right: '12%',
          width: '6%',
          maxWidth: 100,
        }}
      />

      {/* Gnome — tucked in the forest, left third. */}
      <img
        src={`${ASSETS}/characters/gnome.png`}
        alt=""
        draggable={false}
        className="absolute pointer-events-none hidden md:block"
        style={{
          bottom: '20%',
          left: '12%',
          width: '4%',
          maxWidth: 80,
        }}
      />
    </div>
  );
}

// ── Frame doorway stub ──────────────────────────────────────────────
// Converts the image-space doorway rect (from frameConstants) to a
// percentage overlay on the mountain-main base image. The base image is
// positioned absolute top-0, left-50%, h-100%, w-auto — so doorway left
// edge = (image-centre on screen) + (doorwayLeft-imageCentre) scaled by
// (viewport_height / image_height). For Phase 2 we draw an outlined
// rectangle + EDITOR label so the registration point is visible during
// layout iteration. Phase 6 replaces this with the real 3D FrameWarp.
function FrameDoorwayStub() {
  const { imageWidth, imageHeight, doorway } = FRAME_DOORWAY;

  // Baked image renders at (top 0, height 100vh, width auto). Its CSS
  // width is therefore H·aspect, and a horizontal distance of imagePx
  // equals (imagePx / imageHeight)·100vh on screen. Expressing every
  // offset in vh keeps the stub locked to the image under viewport resize.
  const toVh = (imagePx) => `${(imagePx / imageHeight) * 100}vh`;
  const leftFromImgCenter = toVh(doorway.topLeft.x - imageWidth / 2);
  const topVh             = toVh(doorway.topLeft.y - imageHeight * 0.02); // -2% matches image y-offset
  const widthVh           = toVh(imageWidth * doorway.widthPct);
  const heightVh          = toVh(imageHeight * doorway.heightPct);

  return (
    <>
      {/* Doorway rectangle — thin amber outline, warm glow underneath. */}
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
      {/* EDITOR label below */}
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
