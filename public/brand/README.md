# ThumbFrame brand assets

## Files

| File | Purpose | Status |
|---|---|---|
| `ship-mark.svg` | Flat vector silhouette of the solar sailship. Favicon, navbar, any small-scale use. | Hand-authored vector. Transparent background. Scalable. |
| `ship-preview.html` | Standalone Three.js renderer of the full painterly ship on a transparent canvas. Live shader sail, warm lanterns, painterly lighting. | Static HTML, CDN Three.js, no build step. |
| `ship-hero.png` | High-resolution raster of the painterly ship for hero sections / social cards. | **Not committed.** Produced from `ship-preview.html` via the export script below. |

## Why split?

The ship in the landing scene (`src/landing/scenes/shared/SpaceStation.jsx`)
is a Three.js scene graph with a custom GLSL shader on the sail — there is
no SVG source to extract. So:

- **`ship-mark.svg`** is a hand-drawn vector that matches the ship's
  composition (hull proportions, mast, yard/boom, sail with the painted T,
  two stern lanterns, engine nozzle). Coordinates come directly from the
  mesh positions in `SpaceStation.jsx`. Use this for anywhere a vector is
  required (favicon, inline logo, small sizes).
- **`ship-hero.png`** is captured from the actual runtime shader via the
  preview HTML so the painterly sail and warm lantern bloom are real, not
  approximated.

## Generating `ship-hero.png`

### A) Automated (puppeteer)

1. Make sure the dev server is running:
   ```
   npm run dev
   ```
2. Install puppeteer locally (not a project dependency — install only
   when you need to re-export):
   ```
   npm install --no-save puppeteer
   ```
3. Run:
   ```
   node scripts/export-ship-logo.js
   ```
   Output lands at `public/brand/ship-hero.png`.

   Override resolution:
   ```
   SHIP_SIZE=2048 node scripts/export-ship-logo.js
   ```

### B) Manual (no install)

1. `npm run dev`
2. Open:
   ```
   http://localhost:3000/brand/ship-preview.html?size=1024&bg=none&hint=0
   ```
3. In DevTools console:
   ```
   window.exportShipPNG()
   ```
   The browser downloads `ship-hero-1024.png`.
4. Move/rename it to `public/brand/ship-hero.png`.

## Query parameters on `ship-preview.html`

- `?size=1024` — canvas dimensions (default 1024).
- `?bg=none` — hide the transparency checkerboard (do this before
  screenshotting).
- `?hint=0` — hide the on-screen usage hint.

## Using the assets in code

```jsx
// Small inline logo — SVG mark
<img src="/brand/ship-mark.svg" alt="ThumbFrame" width="32" height="32" />

// Large hero / social — PNG
<img src="/brand/ship-hero.png" alt="ThumbFrame sailship" />
```
