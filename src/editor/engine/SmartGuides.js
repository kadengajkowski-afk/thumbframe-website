// src/editor/engine/SmartGuides.js
// Pure computation: given a dragging layer and the full layer list,
// compute snap positions and guide line data.
// Returns snap-corrected position + guide descriptors for the overlay to render.

const SNAP_THRESHOLD = 4; // px in canvas coordinates
const CW = 1280;
const CH = 720;

/**
 * Get the axis-aligned bounding box of a (possibly rotated) layer.
 * layer.x, layer.y is the CENTER of the layer.
 */
function getLayerAABB(layer) {
  const cx = layer.x;
  const cy = layer.y;
  const hw = layer.width / 2;
  const hh = layer.height / 2;
  const r = layer.rotation || 0;

  if (r === 0) {
    return {
      left: cx - hw,
      right: cx + hw,
      top: cy - hh,
      bottom: cy + hh,
      centerX: cx,
      centerY: cy,
    };
  }

  // Rotated AABB (outer bounding box)
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  const hw2 = hw * cos + hh * sin;
  const hh2 = hw * sin + hh * cos;

  return {
    left: cx - hw2,
    right: cx + hw2,
    top: cy - hh2,
    bottom: cy + hh2,
    centerX: cx,
    centerY: cy,
  };
}

/**
 * computeGuides
 * @param {Object} draggingLayer  Current (live) state of the layer being dragged
 * @param {Array}  allLayers      All layers from the store
 * @param {string} draggingId     ID of the layer being dragged (skip self)
 * @returns {{ snappedX: number, snappedY: number, guides: Array }}
 *   guides: [{ axis: 'x'|'y', position: number, type: 'edge'|'center'|'layer' }]
 */
export function computeGuides(draggingLayer, allLayers, draggingId) {
  const box = getLayerAABB(draggingLayer);

  // Snap candidates on the dragging layer (left edge, center, right / top, center, bottom)
  const dragX = [box.left, box.centerX, box.right];
  const dragY = [box.top, box.centerY, box.bottom];

  // Reference lines: canvas edges + center
  const refX = [0, CW / 2, CW];
  const refY = [0, CH / 2, CH];

  let snappedX = draggingLayer.x;
  let snappedY = draggingLayer.y;
  let bestDX = SNAP_THRESHOLD + 1;
  let bestDY = SNAP_THRESHOLD + 1;
  let guideX = null;
  let guideY = null;

  // ── Check X axis snapping ──────────────────────────────────────────────────
  for (const dragEdge of dragX) {
    // Against canvas reference lines
    for (const line of refX) {
      const d = Math.abs(dragEdge - line);
      if (d < bestDX) {
        bestDX = d;
        snappedX = draggingLayer.x + (line - dragEdge);
        guideX = {
          axis: 'x',
          position: line,
          type: line === CW / 2 ? 'center' : 'edge',
        };
      }
    }
    // Against other layer edges/centers
    for (const layer of allLayers) {
      if (layer.id === draggingId || !layer.visible) continue;
      const ob = getLayerAABB(layer);
      for (const oEdge of [ob.left, ob.centerX, ob.right]) {
        const d = Math.abs(dragEdge - oEdge);
        if (d < bestDX) {
          bestDX = d;
          snappedX = draggingLayer.x + (oEdge - dragEdge);
          guideX = { axis: 'x', position: oEdge, type: 'layer' };
        }
      }
    }
  }

  // ── Check Y axis snapping ──────────────────────────────────────────────────
  for (const dragEdge of dragY) {
    for (const line of refY) {
      const d = Math.abs(dragEdge - line);
      if (d < bestDY) {
        bestDY = d;
        snappedY = draggingLayer.y + (line - dragEdge);
        guideY = {
          axis: 'y',
          position: line,
          type: line === CH / 2 ? 'center' : 'edge',
        };
      }
    }
    for (const layer of allLayers) {
      if (layer.id === draggingId || !layer.visible) continue;
      const ob = getLayerAABB(layer);
      for (const oEdge of [ob.top, ob.centerY, ob.bottom]) {
        const d = Math.abs(dragEdge - oEdge);
        if (d < bestDY) {
          bestDY = d;
          snappedY = draggingLayer.y + (oEdge - dragEdge);
          guideY = { axis: 'y', position: oEdge, type: 'layer' };
        }
      }
    }
  }

  const guides = [];
  if (guideX) guides.push(guideX);
  if (guideY) guides.push(guideY);

  return { snappedX, snappedY, guides };
}

/**
 * Get the combined AABB for a set of layer IDs.
 * Used for multi-select bounding box display.
 */
export function getCombinedAABB(layers, selectedIds) {
  const sel = layers.filter(l => selectedIds.includes(l.id));
  if (sel.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const layer of sel) {
    const b = getLayerAABB(layer);
    if (b.left < minX) minX = b.left;
    if (b.top < minY) minY = b.top;
    if (b.right > maxX) maxX = b.right;
    if (b.bottom > maxY) maxY = b.bottom;
  }

  return {
    left: minX, top: minY, right: maxX, bottom: maxY,
    width: maxX - minX, height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

export { getLayerAABB };
