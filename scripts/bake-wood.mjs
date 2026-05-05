#!/usr/bin/env node
/** Day 63 — bake wood-wall texture as a 1024x1024 tileable SVG.
 *
 * Pure-SVG approach (no node-canvas / native deps): we build the
 * planks programmatically + use feTurbulence for paper grain + SVG
 * gradients for plank base colors + paths for streaks/knots. The
 * browser renders this natively as a background-image.
 *
 * Output: public/editor/wood-wall-{1,2,3}.svg with different seeds.
 *
 * Run: `node scripts/bake-wood.mjs`
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(REPO_ROOT, "public", "quarters");

// Tiny seeded LCG so each candidate is reproducible.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function planksSpec(seed) {
  const rand = rng(seed);
  const planks = [];
  // Irregular widths: 120-200 px
  let y = 0;
  while (y < 1024) {
    const h = 120 + Math.floor(rand() * 80);
    planks.push({ y, h: Math.min(h, 1024 - y) });
    y += h;
  }
  // Per-plank styling
  return planks.map((p, i) => {
    const hue = 28 + rand() * 6;       // 28-34, warm charcoal
    const sat = 18 + rand() * 4;       // 18-22%
    const lum = 28 + rand() * 12;      // 28-40%
    const lumDark = lum - 6;
    return {
      ...p,
      idx: i,
      gradTop: `hsl(${hue.toFixed(1)}, ${sat.toFixed(1)}%, ${lum.toFixed(1)}%)`,
      gradBot: `hsl(${hue.toFixed(1)}, ${sat.toFixed(1)}%, ${lumDark.toFixed(1)}%)`,
      streaks: Array.from({ length: 12 }, () => ({
        x1: rand() * 1024,
        x2: rand() * 1024,
        y: p.y + rand() * p.h,
        w: 0.8 + rand() * 1.4,
        lum: lum + (rand() * 16 - 8),
        op: 0.3 + rand() * 0.1,
      })),
      knots: rand() < 0.5
        ? [{ cx: rand() * 1024, cy: p.y + rand() * p.h, r: 8 + rand() * 12 }]
        : rand() < 0.3
          ? [
              { cx: rand() * 1024, cy: p.y + rand() * p.h, r: 8 + rand() * 12 },
              { cx: rand() * 1024, cy: p.y + rand() * p.h, r: 6 + rand() * 8 },
            ]
          : [],
    };
  });
}

function bakeWood(seed) {
  const planks = planksSpec(seed);
  const grainId = `g${seed}`;
  const knotId = `k${seed}`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" preserveAspectRatio="none">
  <defs>
    <!-- Paper grain (matches landing's feel) -->
    <filter id="${grainId}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed}" />
      <feColorMatrix values="0 0 0 0 0.96 0 0 0 0 0.92 0 0 0 0 0.83 0 0 0 0.08 0" />
    </filter>
    <radialGradient id="${knotId}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="hsl(28, 22%, 12%)" />
      <stop offset="60%" stop-color="hsl(28, 22%, 22%)" />
      <stop offset="100%" stop-color="hsl(28, 22%, 32%)" stop-opacity="0" />
    </radialGradient>
    ${planks.map((p) => `
    <linearGradient id="p${seed}_${p.idx}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.gradTop}" />
      <stop offset="100%" stop-color="${p.gradBot}" />
    </linearGradient>`).join("")}
  </defs>`;

  // Plank rectangles
  for (const p of planks) {
    svg += `\n  <rect x="0" y="${p.y}" width="1024" height="${p.h}" fill="url(#p${seed}_${p.idx})" />`;
  }

  // Streaks (painted brush hints)
  for (const p of planks) {
    for (const s of p.streaks) {
      svg += `\n  <line x1="${s.x1.toFixed(0)}" y1="${s.y.toFixed(0)}" x2="${s.x2.toFixed(0)}" y2="${s.y.toFixed(0)}" stroke="hsl(28, 20%, ${s.lum.toFixed(1)}%)" stroke-width="${s.w.toFixed(1)}" stroke-linecap="round" opacity="${s.op.toFixed(2)}" />`;
    }
  }

  // Knots
  for (const p of planks) {
    for (const k of p.knots) {
      svg += `\n  <circle cx="${k.cx.toFixed(0)}" cy="${k.cy.toFixed(0)}" r="${k.r.toFixed(1)}" fill="url(#${knotId})" />`;
    }
  }

  // Plank seams (dark hairline at the bottom of each plank)
  for (const p of planks) {
    svg += `\n  <line x1="0" y1="${p.y + p.h}" x2="1024" y2="${p.y + p.h}" stroke="rgba(20, 14, 8, 0.45)" stroke-width="2" />`;
  }

  // Paper grain overlay
  svg += `\n  <rect width="1024" height="1024" filter="url(#${grainId})" opacity="0.55" style="mix-blend-mode: multiply" />`;
  svg += `\n</svg>`;
  return svg;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const seeds = [11, 23, 41];
  for (let i = 0; i < seeds.length; i++) {
    const svg = bakeWood(seeds[i]);
    const out = resolve(OUT_DIR, `wood-wall-${i + 1}.svg`);
    writeFileSync(out, svg, "utf8");
    console.log(`[bake-wood] wrote ${out} (${svg.length} bytes, seed=${seeds[i]})`);
  }
}

main();
