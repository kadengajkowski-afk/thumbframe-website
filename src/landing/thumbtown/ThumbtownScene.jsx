// Thumbtown scene compositor — Phase 2 rebuild.
//
// Architecture:
//   A "MountainCanvas" container is sized via JS so the baked mountain-
//   main.png fills the viewport by COVER math (scales to whichever
//   dimension is larger, crops the excess). Every sprite + the Frame
//   doorway stub is parented inside this container and positioned as a
//   percentage of the NATURAL image dimensions (816 × 1456). Sprites
//   therefore always attach to scene content — no floating-in-void.
//
//   An outer absolute-fill div with overflow:hidden clips the cover
//   overflow to viewport bounds. No gradient stubs, no placeholder
//   fills, no decorative polygons. Only real PNG assets render.

import React, { useLayoutEffect, useState } from 'react';
import { FRAME_DOORWAY } from './frameConstants';

const ASSETS = '/assets/thumbtown';

// Image dimensions mirrored from frameConstants so the cover math stays
// in sync with the doorway registration math.
const IMG_W = FRAME_DOORWAY.imageWidth;   // 816
const IMG_H = FRAME_DOORWAY.imageHeight;  // 1456
const IMG_ASPECT = IMG_W / IMG_H;

// Y anchor — the fraction of the natural image (0 = top, 1 = bottom) we
// align with the same fraction of the viewport. 0.65 lands the Frame
// doorway (at image-Y 0.62) near the middle-lower of the viewport at
// 16:9 desktop, reading as the focal point without cramping the sky.
const Y_ANCHOR = 0.65;

// ── Sprite layer configuration ──
// Every position + size is a percentage of the NATURAL image's
// dimensions (not the viewport). Because the MountainCanvas container
// matches image proportions, a sprite at "top: 72%" sits at 72% down the
// image — same scene feature at every viewport size.
const SCENE_LAYERS = [
  // Single floating island — small accent in the upper sky, ~18% of
  // mountain height per spec. height drives size, width auto preserves
  // the island's aspect.
  {
    key: 'islands',
    src: `${ASSETS}/floating-islands/floating-islands.png`,
    style: { top: '5%', left: '28%', height: '18%', width: 'auto', opacity: 0.95 },
  },
  // Bird flock — upper-right sky.
  {
    key: 'birds',
    src: `${ASSETS}/effects/birds.png`,
    style: { top: '13%', right: '16%', width: '14%', height: 'auto', opacity: 0.88 },
  },
  // Village cluster — river mouth, slightly left of centre.
  {
    key: 'village',
    src: `${ASSETS}/village/village.png`,
    style: { top: '72%', left: '37%', width: '26%', height: 'auto' },
  },
  // Painter — on the cliff near the Frame, above and slightly right.
  {
    key: 'painter',
    src: `${ASSETS}/characters/painter.png`,
    style: { top: '52%', left: '60%', width: '5.5%', height: 'auto' },
  },
  // Fisherman — by the river, right of village.
  {
    key: 'fisherman',
    src: `${ASSETS}/characters/fisherman.png`,
    style: { top: '79%', left: '64%', width: '6%', height: 'auto' },
  },
  // Gnome — tucked into the low foreground, left of village.
  {
    key: 'gnome',
    src: `${ASSETS}/characters/gnome.png`,
    style: { top: '86%', left: '24%', width: '5%', height: 'auto' },
  },
];

// ── JS-computed cover bounds ──
// Returns { w, h, left, top } in pixels for a div that renders the image
// at the same size & position as object-fit:cover would, using Y_ANCHOR
// instead of object-position's default centre. Updates on resize.
function useCoverBounds() {
  const [bounds, setBounds] = useState({ w: 0, h: 0, left: 0, top: 0 });

  useLayoutEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const vAspect = vw / vh;

      let w;
      let h;
      if (vAspect > IMG_ASPECT) {
        // Viewport wider than image — scale by width, overflow height.
        w = vw;
        h = vw / IMG_ASPECT;
      } else {
        // Viewport narrower than image — scale by height, overflow width.
        h = vh;
        w = vh * IMG_ASPECT;
      }

      const left = (vw - w) / 2;
      const top  = Y_ANCHOR * (vh - h);
      setBounds({ w, h, left, top });
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return bounds;
}

// ───────────────────────────────────────────────────────────────────── //

export default function ThumbtownScene() {
  const { w, h, left, top } = useCoverBounds();

  return (
    <div
      className="absolute inset-0 overflow-hidden select-none"
      style={{ background: '#0a0714' }}
      aria-hidden
    >
      {/* MountainCanvas — sized to match cover-rendered image bounds.
          All sprites + Frame stub parent inside, positioned by % of
          natural image dimensions so they stay attached to scene
          content at every viewport size. */}
      <div
        style={{
          position: 'absolute',
          width: w,
          height: h,
          left,
          top,
          pointerEvents: 'none',
        }}
      >
        {/* Baked hero base — mountain, sky, river, Frame niche. */}
        <img
          src={`${ASSETS}/backgrounds/mountain-main.png`}
          alt=""
          draggable={false}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            userSelect: 'none',
          }}
        />

        {/* Sprite layers — driven by SCENE_LAYERS config. */}
        {SCENE_LAYERS.map((cfg) => (
          <img
            key={cfg.key}
            src={cfg.src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              userSelect: 'none',
              ...cfg.style,
            }}
          />
        ))}

        {/* Frame doorway stub — replaced by 3D FrameWarp in Phase 6. */}
        <FrameDoorwayStub />
      </div>
    </div>
  );
}

// ── Frame doorway stub ──
// Positioned by % of natural image dimensions (not vh). Because the
// parent MountainCanvas matches image proportions, these percentages
// align with the actual doorway geometry baked into mountain-main.png
// at every viewport.
function FrameDoorwayStub() {
  const { doorway } = FRAME_DOORWAY;
  const leftPct = (doorway.topLeft.x / IMG_W) * 100;
  const topPct  = (doorway.topLeft.y / IMG_H) * 100;
  const widthPct  = doorway.widthPct  * 100;
  const heightPct = doorway.heightPct * 100;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left:   `${leftPct}%`,
          top:    `${topPct}%`,
          width:  `${widthPct}%`,
          height: `${heightPct}%`,
          border: '1.5px solid rgba(249, 180, 80, 0.65)',
          boxShadow:
            '0 0 24px -4px rgba(249, 180, 80, 0.55), inset 0 0 20px rgba(249, 180, 80, 0.25)',
          borderRadius: 3,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left:    `${leftPct}%`,
          top:     `calc(${topPct + heightPct}% + 6px)`,
          width:   `${widthPct}%`,
          textAlign: 'center',
          color: '#f0e4d0',
          fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
          fontSize: 'calc(10px + 0.4vw)',
          fontWeight: 500,
          letterSpacing: '0.42em',
          textShadow: '0 1px 6px rgba(10, 7, 20, 0.9)',
          pointerEvents: 'none',
        }}
      >
        EDITOR
      </div>
    </>
  );
}
