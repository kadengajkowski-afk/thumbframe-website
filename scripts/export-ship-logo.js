#!/usr/bin/env node
/* eslint-disable no-console */

// export-ship-logo.js
//
// Renders public/brand/ship-preview.html in a headless Chromium and
// saves the canvas as a PNG at public/brand/ship-hero.png.
//
// Why: the ship is a Three.js scene with a custom shader sail; there's
// no static source we can export to PNG directly. This script visits
// the standalone preview HTML, waits for the scene to settle, then
// screenshots the transparent canvas element.
//
// USAGE
//   1. Make sure the dev server is running (npm run dev) so
//      http://localhost:3000/brand/ship-preview.html is reachable.
//   2. Install puppeteer locally (not a project dependency — install
//      only when you actually need to re-export):
//        npm install --no-save puppeteer
//   3. Run this script:
//        node scripts/export-ship-logo.js
//
// Optional env:
//   SHIP_SIZE=2048                 output resolution (default 1024)
//   SHIP_URL=http://.../ship-preview.html  override preview URL
//   SHIP_OUT=public/brand/ship-hero.png    override output path
//
// If puppeteer is not installed the script prints manual-export
// instructions instead of crashing.

const path = require('path');
const fs   = require('fs');

const SIZE = parseInt(process.env.SHIP_SIZE || '1024', 10);
const URL  = process.env.SHIP_URL || `http://localhost:3000/brand/ship-preview.html?size=${SIZE}&bg=none&hint=0`;
const OUT  = process.env.SHIP_OUT || path.join('public', 'brand', 'ship-hero.png');

async function main() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    console.error([
      '',
      'puppeteer is not installed.',
      '',
      'You have two options:',
      '',
      '  A) Install puppeteer and re-run:',
      '       npm install --no-save puppeteer',
      '       node scripts/export-ship-logo.js',
      '',
      '  B) Export manually from a browser:',
      `       1. Start dev server:  npm run dev`,
      `       2. Open: ${URL}`,
      `       3. In DevTools console run:  window.exportShipPNG()`,
      `          -> downloads ship-hero-${SIZE}.png`,
      `       4. Move that file to ${OUT}`,
      '',
    ].join('\n'));
    process.exit(1);
  }

  console.log(`[ship-export] launching headless Chromium @ ${SIZE}x${SIZE}`);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--allow-file-access-from-files', '--disable-web-security'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width:  SIZE,
      height: SIZE,
      deviceScaleFactor: 1,
    });

    console.log(`[ship-export] loading ${URL}`);
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });

    // Give shaders a beat to compile + animation to settle on a visually
    // stable frame (sail billow cycles slowly so any moment works).
    await new Promise((r) => setTimeout(r, 1200));

    // Screenshot the canvas only so surrounding page whitespace isn't captured.
    const canvas = await page.$('#stage canvas');
    if (!canvas) throw new Error('Could not find #stage canvas in preview page.');

    const outDir = path.dirname(OUT);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    await canvas.screenshot({ path: OUT, omitBackground: true });
    console.log(`[ship-export] wrote ${OUT}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[ship-export] failed:', err);
  process.exit(1);
});
