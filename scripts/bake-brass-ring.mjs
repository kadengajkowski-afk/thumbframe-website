#!/usr/bin/env node
/** Day 63 — bake parameterized brass-ring SVGs for portholes.
 *
 * Three sizes: small (140), medium (220), large (320). Each ring
 * has a brass gradient + 6 rivet "dogs" + inner shadow + outer
 * glow. Used as porthole frames at z-index --z-brass-ring.
 *
 * Output: public/editor/porthole-ring-{small,medium,large}.svg
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(REPO_ROOT, "public", "quarters");

function bakeRing({ size, dogCount = 6 }) {
  const cx = size / 2;
  const cy = size / 2;
  const outer = size * 0.48;
  const ringWidth = size * 0.07;
  const innerOuter = outer - ringWidth;
  const dogRadius = size * 0.018;
  const dogOrbit = outer - ringWidth / 2;

  let dogs = "";
  for (let i = 0; i < dogCount; i++) {
    const a = (i * 2 * Math.PI) / dogCount - Math.PI / 2;
    const dx = cx + Math.cos(a) * dogOrbit;
    const dy = cy + Math.sin(a) * dogOrbit;
    dogs += `\n    <circle cx="${dx.toFixed(2)}" cy="${dy.toFixed(2)}" r="${dogRadius.toFixed(2)}" fill="#3a2818" opacity="0.75" />`;
    dogs += `\n    <circle cx="${dx.toFixed(2)}" cy="${dy.toFixed(2)}" r="${(dogRadius * 0.55).toFixed(2)}" fill="#D4A55C" opacity="0.95" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="brass-${size}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D4A55C" />
      <stop offset="50%" stop-color="#B8864B" />
      <stop offset="100%" stop-color="#7a5430" />
    </linearGradient>
    <radialGradient id="brass-bevel-${size}" cx="50%" cy="50%" r="50%">
      <stop offset="${((innerOuter / outer) * 100).toFixed(1)}%" stop-color="rgba(0,0,0,0.0)" />
      <stop offset="${(((innerOuter + ringWidth * 0.4) / outer) * 100).toFixed(1)}%" stop-color="rgba(0,0,0,0.45)" />
      <stop offset="${(((innerOuter + ringWidth * 0.5) / outer) * 100).toFixed(1)}%" stop-color="rgba(0,0,0,0)" />
    </radialGradient>
    <filter id="outer-glow-${size}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${(size * 0.012).toFixed(1)}" />
    </filter>
  </defs>

  <!-- Outer glow -->
  <circle cx="${cx}" cy="${cy}" r="${outer + size * 0.01}" fill="rgba(184, 134, 75, 0.22)" filter="url(#outer-glow-${size})" />

  <!-- Brass ring (annulus via two circles + even-odd fill workaround) -->
  <path d="M ${cx} ${cy - outer}
           a ${outer} ${outer} 0 1 0 0.001 0 Z
           M ${cx} ${cy - innerOuter}
           a ${innerOuter} ${innerOuter} 0 1 1 -0.001 0 Z"
        fill="url(#brass-${size})"
        fill-rule="evenodd" />

  <!-- Inner-edge bevel shadow -->
  <circle cx="${cx}" cy="${cy}" r="${outer}" fill="url(#brass-bevel-${size})" />

  <!-- Top highlight (suggests overhead light) -->
  <ellipse cx="${cx}" cy="${(cy - outer * 0.6).toFixed(2)}"
           rx="${(outer * 0.45).toFixed(2)}" ry="${(ringWidth * 0.4).toFixed(2)}"
           fill="rgba(255, 240, 200, 0.45)" />

  <!-- Rivets -->
  <g>${dogs}
  </g>
</svg>`;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const sizes = [
    { name: "small",  size: 140 },
    { name: "medium", size: 220 },
    { name: "large",  size: 320 },
  ];
  for (const { name, size } of sizes) {
    const svg = bakeRing({ size });
    const out = resolve(OUT_DIR, `porthole-ring-${name}.svg`);
    writeFileSync(out, svg, "utf8");
    console.log(`[bake-brass-ring] wrote ${out} (${svg.length} bytes, size=${size})`);
  }
}

main();
