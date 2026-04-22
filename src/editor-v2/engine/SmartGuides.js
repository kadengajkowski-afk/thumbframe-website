// src/editor-v2/engine/SmartGuides.js
// -----------------------------------------------------------------------------
// Purpose:  Compute snap targets for a dragged layer and apply snapping.
//           Targets come from: canvas center, rule-of-thirds lines,
//           canvas edges, safe zone edges (YouTube-standard), pixel grid,
//           and sibling layer edges/centers.
// Exports:  computeGuides, snapRect, DEFAULT_SNAP_THRESHOLD_PX
// Depends:  nothing
//
// Contract:
//   • computeGuides({ canvasWidth, canvasHeight, siblings }) returns
//     { verticals: number[], horizontals: number[] } of candidate snap
//     lines in canvas coordinates.
//   • snapRect(rect, guides, threshold) returns a new rect whose x/y
//     have been nudged onto the nearest guide within threshold px.
//
// Snap priority (closest-line wins, with priority as tiebreaker):
//   1. center (canvas + sibling center)
//   2. thirds
//   3. edges (canvas + sibling)
//   4. safe zones
//   5. pixel grid
// -----------------------------------------------------------------------------

// YouTube safe-zone constants — must stay in sync with the values in
// CLAUDE.md. Duplicated here rather than imported so the snap module
// is self-contained.
const SAFE_DESKTOP = { width: 1100, height: 620 };
const SAFE_MOBILE  = { width: 960,  height: 540 };
const SAFE_TEXT    = { width: 1235, height: 338 };

export const DEFAULT_SNAP_THRESHOLD_PX = 6;

/**
 * Compute candidate snap lines for a drag on a 1280x720 (or custom)
 * canvas. `siblings` is the list of OTHER layers on the canvas.
 *
 * @param {{
 *   canvasWidth: number,
 *   canvasHeight: number,
 *   siblings?: Array<{ x:number, y:number, width:number, height:number }>,
 *   includeSafeZones?: boolean,
 *   includePixelGrid?: boolean,
 *   gridStep?: number,
 * }} opts
 * @returns {{ verticals: Array<{value:number, priority:number, source:string}>,
 *            horizontals: Array<{value:number, priority:number, source:string}> }}
 */
export function computeGuides(opts) {
  const W = opts.canvasWidth,  H = opts.canvasHeight;
  const V = [], Ho = [];

  // Canvas center (priority 1).
  V.push({ value: W / 2, priority: 1, source: 'canvas-center' });
  Ho.push({ value: H / 2, priority: 1, source: 'canvas-center' });

  // Rule of thirds (priority 2).
  V.push({ value: W / 3,     priority: 2, source: 'thirds' });
  V.push({ value: 2 * W / 3, priority: 2, source: 'thirds' });
  Ho.push({ value: H / 3,     priority: 2, source: 'thirds' });
  Ho.push({ value: 2 * H / 3, priority: 2, source: 'thirds' });

  // Canvas edges (priority 3).
  V.push({ value: 0, priority: 3, source: 'canvas-edge' });
  V.push({ value: W, priority: 3, source: 'canvas-edge' });
  Ho.push({ value: 0, priority: 3, source: 'canvas-edge' });
  Ho.push({ value: H, priority: 3, source: 'canvas-edge' });

  // Safe zones (priority 4).
  if (opts.includeSafeZones !== false) {
    for (const [name, zone] of [['desktop', SAFE_DESKTOP], ['mobile', SAFE_MOBILE], ['text', SAFE_TEXT]]) {
      const padX = (W - zone.width)  / 2;
      const padY = (H - zone.height) / 2;
      V.push({ value: padX,         priority: 4, source: `safe-${name}` });
      V.push({ value: W - padX,     priority: 4, source: `safe-${name}` });
      Ho.push({ value: padY,        priority: 4, source: `safe-${name}` });
      Ho.push({ value: H - padY,    priority: 4, source: `safe-${name}` });
    }
  }

  // Sibling layer edges + centers (priority 3).
  if (Array.isArray(opts.siblings)) {
    for (const s of opts.siblings) {
      if (!s || typeof s.x !== 'number') continue;
      V.push({ value: s.x,                 priority: 1, source: 'sibling-center' });
      V.push({ value: s.x - s.width  / 2,  priority: 3, source: 'sibling-edge' });
      V.push({ value: s.x + s.width  / 2,  priority: 3, source: 'sibling-edge' });
      Ho.push({ value: s.y,                 priority: 1, source: 'sibling-center' });
      Ho.push({ value: s.y - s.height / 2,  priority: 3, source: 'sibling-edge' });
      Ho.push({ value: s.y + s.height / 2,  priority: 3, source: 'sibling-edge' });
    }
  }

  // Pixel grid (priority 5). Emitting a finite set would explode the list;
  // instead we return the step so snapRect can compute the nearest at
  // evaluation time.
  const gridStep = opts.includePixelGrid !== false ? (opts.gridStep || 8) : 0;
  if (gridStep > 0) {
    V.push({ value: NaN, priority: 5, source: `pixel-grid`, gridStep });
    Ho.push({ value: NaN, priority: 5, source: `pixel-grid`, gridStep });
  }

  return { verticals: V, horizontals: Ho };
}

/**
 * Snap a rect's center to the nearest guide within threshold.
 * @param {{x:number,y:number,width:number,height:number}} rect
 * @param {ReturnType<typeof computeGuides>} guides
 * @param {number} [thresholdPx]
 * @returns {{ x:number, y:number, snappedX:string|null, snappedY:string|null }}
 */
export function snapRect(rect, guides, thresholdPx = DEFAULT_SNAP_THRESHOLD_PX) {
  const xCandidates = [
    rect.x,                       // center
    rect.x - rect.width  / 2,     // left
    rect.x + rect.width  / 2,     // right
  ];
  const yCandidates = [
    rect.y,                       // center
    rect.y - rect.height / 2,     // top
    rect.y + rect.height / 2,     // bottom
  ];
  const xOffsets = [0, rect.width / 2, -rect.width / 2];
  const yOffsets = [0, rect.height / 2, -rect.height / 2];

  const { dx, source: snappedX } = _bestSnap(guides.verticals, xCandidates, xOffsets, thresholdPx);
  const { dx: dy, source: snappedY } = _bestSnap(guides.horizontals, yCandidates, yOffsets, thresholdPx);

  return {
    x: rect.x + dx,
    y: rect.y + dy,
    snappedX,
    snappedY,
  };
}

function _bestSnap(guides, candidates, offsets, threshold) {
  let bestDx = 0;
  let bestDist = threshold + 1;
  let bestPri = 99;
  let bestSource = null;

  for (const g of guides) {
    // Pixel grid: resolve to nearest multiple of gridStep for each candidate.
    if (g.source === 'pixel-grid' && g.gridStep > 0) {
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const snapped = Math.round(c / g.gridStep) * g.gridStep;
        const dist = Math.abs(snapped - c);
        const delta = snapped - c;
        if (_better(dist, g.priority, bestDist, bestPri, threshold)) {
          bestDx = delta - offsets[i] + offsets[i]; // no offset correction needed; keep literal
          bestDx = delta;                            // explicit, for clarity
          bestDist = dist; bestPri = g.priority; bestSource = g.source;
        }
      }
      continue;
    }

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const dist = Math.abs(g.value - c);
      if (_better(dist, g.priority, bestDist, bestPri, threshold)) {
        bestDx = g.value - c;
        bestDist = dist; bestPri = g.priority; bestSource = g.source;
      }
    }
  }
  return { dx: bestDx, source: bestSource };
}

function _better(dist, priority, bestDist, bestPri, threshold) {
  if (dist > threshold) return false;
  if (priority < bestPri) return true;
  if (priority > bestPri) return false;
  return dist < bestDist;
}
