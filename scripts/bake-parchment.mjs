#!/usr/bin/env node
/** Day 63 — bake parchment-scroll texture as a 1024x1024 SVG.
 * Cream base + organic noise fibers + edge-darkening vignette +
 * paper grain overlay. */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(REPO_ROOT, "public", "quarters");

function bakeParchment() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" preserveAspectRatio="none">
  <defs>
    <!-- Organic fiber pattern via low-frequency turbulence -->
    <filter id="fiber" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018 0.024" numOctaves="3" seed="29" />
      <feColorMatrix values="0 0 0 0 0.85 0 0 0 0 0.78 0 0 0 0 0.62 0 0 0 0.32 0" />
    </filter>
    <!-- High-frequency paper grain -->
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="13" />
      <feColorMatrix values="0 0 0 0 0.78 0 0 0 0 0.70 0 0 0 0 0.55 0 0 0 0.10 0" />
    </filter>
    <!-- Edge vignette -->
    <radialGradient id="vignette" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="rgba(232, 220, 192, 0)" />
      <stop offset="60%" stop-color="rgba(232, 220, 192, 0)" />
      <stop offset="100%" stop-color="rgba(140, 110, 60, 0.32)" />
    </radialGradient>
  </defs>
  <!-- Cream base -->
  <rect width="1024" height="1024" fill="#E8DCC0" />
  <!-- Organic fiber overlay (multiply for warmth) -->
  <rect width="1024" height="1024" filter="url(#fiber)" style="mix-blend-mode: multiply" />
  <!-- Edge vignette -->
  <rect width="1024" height="1024" fill="url(#vignette)" />
  <!-- Paper grain -->
  <rect width="1024" height="1024" filter="url(#grain)" opacity="0.5" style="mix-blend-mode: multiply" />
</svg>`;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const svg = bakeParchment();
  const out = resolve(OUT_DIR, "parchment-scroll.svg");
  writeFileSync(out, svg, "utf8");
  console.log(`[bake-parchment] wrote ${out} (${svg.length} bytes)`);
}

main();
