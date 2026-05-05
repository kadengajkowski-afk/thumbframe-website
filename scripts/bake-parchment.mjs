#!/usr/bin/env node
/** Day 63 retry — bake parchment-scroll.png via sharp.
 * Cream base + organic noise fibers + edge vignette + paper grain
 * overlay (composite blend=overlay). */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(REPO_ROOT, "public", "quarters");

const BASE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <filter id="fiber" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018 0.024" numOctaves="3" seed="29" stitchTiles="stitch" />
      <feColorMatrix values="0 0 0 0 0.85, 0 0 0 0 0.78, 0 0 0 0 0.62, 0 0 0 0.32 0" />
    </filter>
    <radialGradient id="vignette" cx="50%" cy="50%" r="65%">
      <stop offset="0%"  stop-color="rgba(232, 220, 192, 0)" />
      <stop offset="60%" stop-color="rgba(232, 220, 192, 0)" />
      <stop offset="100%" stop-color="rgba(180, 145, 90, 0.30)" />
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="#E8DCC0" />
  <rect width="1024" height="1024" filter="url(#fiber)" style="mix-blend-mode: multiply" />
  <rect width="1024" height="1024" fill="url(#vignette)" />
</svg>`;

const PAPER_GRAIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <filter id="paper-grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
    <feColorMatrix values="0 0 0 0 0.9, 0 0 0 0 0.85, 0 0 0 0 0.75, 0 0 0 0.4 0" />
  </filter>
  <rect width="100%" height="100%" filter="url(#paper-grain)" opacity="0.18" />
</svg>`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const baseBuffer = await sharp(Buffer.from(BASE_SVG)).png().toBuffer();
  const grainBuffer = await sharp(Buffer.from(PAPER_GRAIN_SVG)).png().toBuffer();
  const out = resolve(OUT_DIR, "parchment-scroll.png");
  await sharp(baseBuffer)
    .composite([{ input: grainBuffer, blend: "overlay" }])
    .png()
    .toFile(out);
  console.log(`[bake-parchment] wrote ${out}`);
}

main().catch((err) => {
  console.error("[bake-parchment] failed:", err);
  process.exit(1);
});
