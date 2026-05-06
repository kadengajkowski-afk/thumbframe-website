#!/usr/bin/env node
/** Day 63 retry — bake wood-wall textures as 1024x1024 PNGs.
 *
 * Per locked spec: SVG composition → sharp rasterizes → composites
 * the paper-grain SVG overlay at blend=overlay → PNG output.
 * Three seeded variants. The result is opaque PNG that the editor
 * panels reference as background-image with no chance of cosmic
 * body bg bleed-through.
 *
 * Run: `node scripts/bake-wood.mjs`
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(REPO_ROOT, "public", "quarters");

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// Tiny gradient noise approximation good enough for streak wobble.
// Real simplex would add a dep we don't need here.
function noise2(seed, x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n) - 0.5;
}

function planksSpec(seed) {
  const rand = rng(seed);
  const planks = [];
  const widthChoices = [140, 160, 180, 200, 220];
  let y = 0;
  while (y < 1024) {
    const w = widthChoices[Math.floor(rand() * widthChoices.length)];
    planks.push({ y, h: Math.min(w, 1024 - y) });
    y += w;
  }
  // Last plank: stretch to fill 1024
  if (planks.length > 0) {
    const last = planks[planks.length - 1];
    last.h = 1024 - last.y;
  }
  return planks.map((p, i) => {
    const hueChoices = [22, 24, 26, 28, 30];
    const satChoices = [16, 18, 20, 22];
    const lumChoices = [22, 24, 26, 28];
    const hue = hueChoices[Math.floor(rand() * hueChoices.length)];
    const sat = satChoices[Math.floor(rand() * satChoices.length)];
    const lumBase = lumChoices[Math.floor(rand() * lumChoices.length)];
    return {
      ...p,
      idx: i,
      hue,
      sat,
      lumBase,
      streaks: Array.from({ length: 14 }, () => {
        const yPos = p.y + rand() * p.h;
        const lighter = rand() < 0.5;
        const lumDelta = (lighter ? 1 : -1) * 8;
        const w = 0.6 + rand() * 1.4;
        // Build path with organic wobble via faux noise
        let path = `M 0 ${yPos.toFixed(1)} `;
        for (let x = 4; x <= 1024; x += 4) {
          const wobble = noise2(seed + i, x * 0.004, yPos * 0.01) * 6;
          path += `L ${x} ${(yPos + wobble).toFixed(2)} `;
        }
        return {
          path,
          color: `hsla(${hue}, ${sat}%, ${lumBase + lumDelta}%, 0.32)`,
          w: w.toFixed(2),
        };
      }),
      knots: rand() < 0.6
        ? [{ cx: rand() * 1024, cy: p.y + 20 + rand() * (p.h - 40), r: 6 + rand() * 10 }]
        : (rand() < 0.4
            ? [
                { cx: rand() * 1024, cy: p.y + 20 + rand() * (p.h - 40), r: 6 + rand() * 10 },
                { cx: rand() * 1024, cy: p.y + 20 + rand() * (p.h - 40), r: 4 + rand() * 8 },
              ]
            : []),
    };
  });
}

function bakeWoodSvg(seed) {
  const planks = planksSpec(seed);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    ${planks.map((p) => `
    <linearGradient id="p${seed}_${p.idx}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="hsl(${p.hue}, ${p.sat}%, ${p.lumBase - 4}%)" />
      <stop offset="50%"  stop-color="hsl(${p.hue}, ${p.sat}%, ${p.lumBase}%)" />
      <stop offset="100%" stop-color="hsl(${p.hue}, ${p.sat}%, ${p.lumBase - 6}%)" />
    </linearGradient>
    <radialGradient id="k${seed}_${p.idx}" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="hsl(${p.hue}, ${p.sat + 10}%, ${p.lumBase - 16}%)" />
      <stop offset="100%" stop-color="hsl(${p.hue}, ${p.sat}%, ${p.lumBase}%)" stop-opacity="0" />
    </radialGradient>`).join("")}
  </defs>`;

  for (const p of planks) {
    svg += `\n  <rect x="0" y="${p.y}" width="1024" height="${p.h}" fill="url(#p${seed}_${p.idx})" />`;
  }
  for (const p of planks) {
    for (const s of p.streaks) {
      svg += `\n  <path d="${s.path}" stroke="${s.color}" stroke-width="${s.w}" fill="none" stroke-linecap="round" />`;
    }
  }
  for (const p of planks) {
    for (const k of p.knots) {
      svg += `\n  <circle cx="${k.cx.toFixed(0)}" cy="${k.cy.toFixed(0)}" r="${k.r.toFixed(1)}" fill="url(#k${seed}_${p.idx})" />`;
    }
  }
  // Plank seams — Day 64a-tone softened. Seam darkness 0.55 → 0.25
  // and height 2 → 1 so plank divisions read as subtle joins, not
  // sharp horizontal stripes. Brass nails fill-opacity 1 → 0.4 so
  // they recede into background detail.
  for (let i = 0; i < planks.length - 1; i++) {
    const seamY = planks[i].y + planks[i].h;
    svg += `\n  <rect x="0" y="${seamY - 0.5}" width="1024" height="1" fill="rgba(20, 14, 8, 0.25)" />`;
    const nailCount = 4 + Math.floor(rng(seed + i * 31)() * 3);
    for (let n = 0; n < nailCount; n++) {
      const x = (1024 / (nailCount + 1)) * (n + 1);
      svg += `\n  <circle cx="${x.toFixed(0)}" cy="${seamY.toFixed(0)}" r="2" fill="#D4A55C" fill-opacity="0.4" />`;
      svg += `\n  <circle cx="${x.toFixed(0)}" cy="${seamY.toFixed(0)}" r="2" fill="none" stroke="#8B6633" stroke-width="0.6" stroke-opacity="0.4" />`;
    }
  }
  svg += `\n</svg>`;
  return svg;
}

const PAPER_GRAIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <filter id="paper-grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
    <feColorMatrix values="0 0 0 0 0.9, 0 0 0 0 0.85, 0 0 0 0 0.75, 0 0 0 0.4 0" />
  </filter>
  <rect width="100%" height="100%" filter="url(#paper-grain)" opacity="0.18" />
</svg>`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const seeds = [11, 23, 41];
  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    const woodSvg = bakeWoodSvg(seed);
    const woodBuffer = await sharp(Buffer.from(woodSvg)).png().toBuffer();
    const grainBuffer = await sharp(Buffer.from(PAPER_GRAIN_SVG)).png().toBuffer();
    const out = resolve(OUT_DIR, `wood-wall-${i + 1}.png`);
    await sharp(woodBuffer)
      .composite([{ input: grainBuffer, blend: "overlay" }])
      .png()
      .toFile(out);
    console.log(`[bake-wood] wrote ${out} (seed=${seed})`);
  }
}

main().catch((err) => {
  console.error("[bake-wood] failed:", err);
  process.exit(1);
});
