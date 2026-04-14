// src/editor/tools/SelectTool.js
// Pure functions for hit testing and transform math.
// No React, no store access — all functions are deterministic given their inputs.
//
// Coordinate system:
//   layer.x, layer.y = CENTER of the layer in canvas space (anchor 0.5, 0.5)
//   layer.rotation = radians, clockwise

// ── Hit testing ───────────────────────────────────────────────────────────────

/**
 * Test whether canvas world point (wx, wy) is inside a layer's bounding box.
 * Correctly handles rotation.
 */
export function hitTestLayer(layer, wx, wy) {
  const cx = layer.x;
  const cy = layer.y;
  const hw = layer.width / 2;
  const hh = layer.height / 2;
  const r = -(layer.rotation || 0);

  // Translate to layer-local space, then rotate by -rotation
  const dx = wx - cx;
  const dy = wy - cy;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;

  return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
}

/**
 * Hit test all layers from top to bottom (highest index = topmost).
 * Returns the ID of the topmost matching visible layer, or null.
 */
export function hitTestLayers(layers, wx, wy) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible) continue;
    if (hitTestLayer(layer, wx, wy)) return layer.id;
  }
  return null;
}

/**
 * Convert a screen position to canvas world coordinates.
 *
 * @param {number} screenX  - clientX of pointer event
 * @param {number} screenY  - clientY of pointer event
 * @param {DOMRect} containerRect - getBoundingClientRect() of the canvas container
 * @param {{ zoom: number, panX: number, panY: number }} viewport
 */
export function screenToWorld(screenX, screenY, containerRect, viewport) {
  return {
    x: (screenX - containerRect.left - viewport.panX) / viewport.zoom,
    y: (screenY - containerRect.top - viewport.panY) / viewport.zoom,
  };
}

// ── Move ──────────────────────────────────────────────────────────────────────

/**
 * Compute new layer center after a move drag.
 */
export function computeMove(startLayerX, startLayerY, startWX, startWY, currentWX, currentWY) {
  return {
    x: startLayerX + (currentWX - startWX),
    y: startLayerY + (currentWY - startWY),
  };
}

// ── Corner resize ─────────────────────────────────────────────────────────────

/**
 * Compute new layer bounds when dragging a corner handle.
 * The OPPOSITE corner remains fixed in world space.
 *
 * @param {Object} startLayer  - snapshot of layer at drag start
 * @param {string} handle      - 'tl' | 'tr' | 'bl' | 'br'
 * @param {{ x: number, y: number }} mouseWorld  - current mouse in canvas world coords
 * @param {boolean} keepAspect - true when Shift is held
 */
export function computeCornerResize(startLayer, handle, mouseWorld, keepAspect = false) {
  const r = startLayer.rotation || 0;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const hw = startLayer.width / 2;
  const hh = startLayer.height / 2;

  // Local coords of the OPPOSITE corner (the one that stays fixed)
  const oppLocal = {
    br: [-hw, -hh], // dragging br → tl fixed
    bl: [ hw, -hh], // dragging bl → tr fixed
    tr: [-hw,  hh], // dragging tr → bl fixed
    tl: [ hw,  hh], // dragging tl → br fixed
  }[handle];

  if (!oppLocal) return { x: startLayer.x, y: startLayer.y, width: startLayer.width, height: startLayer.height };

  const [ox, oy] = oppLocal;
  // Fixed corner in world space: world = center + rotate(local)
  const fixedWX = startLayer.x + ox * cos - oy * sin;
  const fixedWY = startLayer.y + ox * sin + oy * cos;

  // Delta from fixed corner to mouse, in world space
  const dxW = mouseWorld.x - fixedWX;
  const dyW = mouseWorld.y - fixedWY;

  // Project onto layer's local axes
  const localDX = dxW * cos + dyW * sin;
  const localDY = -dxW * sin + dyW * cos;

  let newWidth = Math.max(10, Math.abs(localDX));
  let newHeight = Math.max(10, Math.abs(localDY));

  if (keepAspect) {
    const ratio = startLayer.width / startLayer.height;
    if (newWidth / ratio >= newHeight) {
      newHeight = newWidth / ratio;
    } else {
      newWidth = newHeight * ratio;
    }
  }

  // New center = midpoint of fixed corner and mouse
  const newCX = (fixedWX + mouseWorld.x) / 2;
  const newCY = (fixedWY + mouseWorld.y) / 2;

  return { x: newCX, y: newCY, width: newWidth, height: newHeight };
}

// ── Midpoint resize ───────────────────────────────────────────────────────────

/**
 * Compute new layer bounds when dragging a midpoint (edge) handle.
 * Only one axis changes; the opposite edge remains fixed.
 *
 * @param {Object} startLayer  - snapshot of layer at drag start
 * @param {string} handle      - 'tm' | 'bm' | 'lm' | 'rm'
 * @param {{ x: number, y: number }} mouseWorld
 */
export function computeMidResize(startLayer, handle, mouseWorld) {
  const r = startLayer.rotation || 0;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const cx = startLayer.x;
  const cy = startLayer.y;
  const hw = startLayer.width / 2;
  const hh = startLayer.height / 2;

  // Mouse in layer-local space (relative to current center)
  const dxW = mouseWorld.x - cx;
  const dyW = mouseWorld.y - cy;
  const localMX = dxW * cos + dyW * sin;
  const localMY = -dxW * sin + dyW * cos;

  let newWidth = startLayer.width;
  let newHeight = startLayer.height;
  let newCX = cx;
  let newCY = cy;

  switch (handle) {
    case 'bm': {
      // Fixed: top edge at local Y = -hh
      const rawH = localMY - (-hh);
      newHeight = Math.max(10, rawH);
      const newHH = newHeight / 2;
      const fixedWX = cx + hh * sin;
      const fixedWY = cy - hh * cos;
      newCX = fixedWX - newHH * sin;
      newCY = fixedWY + newHH * cos;
      break;
    }
    case 'tm': {
      // Fixed: bottom edge at local Y = +hh
      const rawH = hh - localMY;
      newHeight = Math.max(10, rawH);
      const newHH = newHeight / 2;
      const fixedWX = cx - hh * sin;
      const fixedWY = cy + hh * cos;
      newCX = fixedWX + newHH * sin;
      newCY = fixedWY - newHH * cos;
      break;
    }
    case 'rm': {
      // Fixed: left edge at local X = -hw
      const rawW = localMX - (-hw);
      newWidth = Math.max(10, rawW);
      const newHW = newWidth / 2;
      const fixedWX = cx - hw * cos;
      const fixedWY = cy - hw * sin;
      newCX = fixedWX + newHW * cos;
      newCY = fixedWY + newHW * sin;
      break;
    }
    case 'lm': {
      // Fixed: right edge at local X = +hw
      const rawW = hw - localMX;
      newWidth = Math.max(10, rawW);
      const newHW = newWidth / 2;
      const fixedWX = cx + hw * cos;
      const fixedWY = cy + hw * sin;
      newCX = fixedWX - newHW * cos;
      newCY = fixedWY - newHW * sin;
      break;
    }
    default: break;
  }

  return { x: newCX, y: newCY, width: newWidth, height: newHeight };
}

// ── Rotation ──────────────────────────────────────────────────────────────────

/**
 * Compute new rotation angle from a rotation handle drag.
 *
 * @param {{ x: number, y: number }} layerCenter  - layer.x, layer.y
 * @param {number} startAngle     - atan2 angle at drag start (mouse → center)
 * @param {number} startRotation  - layer.rotation at drag start (radians)
 * @param {{ x: number, y: number }} mouseWorld   - current mouse in canvas world
 */
export function computeRotation(layerCenter, startAngle, startRotation, mouseWorld) {
  const currentAngle = Math.atan2(
    mouseWorld.y - layerCenter.y,
    mouseWorld.x - layerCenter.x
  );
  // Add π/2 offset because the rotation handle is above (−Y direction)
  return startRotation + (currentAngle - startAngle);
}

/**
 * Snap rotation to 15° increments when Shift is held.
 */
export function snapRotation(radians) {
  const step = Math.PI / 12; // 15°
  return Math.round(radians / step) * step;
}
