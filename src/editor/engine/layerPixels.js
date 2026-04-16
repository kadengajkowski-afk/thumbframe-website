// src/editor/engine/layerPixels.js

/**
 * screenToCanvas — convert a screen-space point to PixiJS world-space.
 * canvasRect: the PixiJS canvas element's getBoundingClientRect()
 * viewport: window.__renderer.viewport (Container with .x, .y, .scale.x)
 */
export function screenToCanvas(screenX, screenY, canvasRect, viewport) {
  const relX = screenX - canvasRect.left;
  const relY = screenY - canvasRect.top;
  return {
    x: (relX - viewport.x) / viewport.scale.x,
    y: (relY - viewport.y) / viewport.scale.y,
  };
}

/**
 * canvasToLocal — convert a canvas-world point to layer-local pixel coords.
 * layer.x/y are CENTER-based. imgWidth/imgHeight are the paint canvas pixel dimensions.
 */
export function canvasToLocal(canvasX, canvasY, layer, imgWidth, imgHeight) {
  const topLeftX = layer.x - layer.width / 2;
  const topLeftY = layer.y - layer.height / 2;
  const localX = Math.round((canvasX - topLeftX) / layer.width  * imgWidth);
  const localY = Math.round((canvasY - topLeftY) / layer.height * imgHeight);
  const inBounds = localX >= 0 && localX < imgWidth && localY >= 0 && localY < imgHeight;
  return { localX, localY, inBounds };
}

/**
 * localToCanvas — inverse of canvasToLocal.
 */
export function localToCanvas(localX, localY, layer, imgWidth, imgHeight) {
  const topLeftX = layer.x - layer.width / 2;
  const topLeftY = layer.y - layer.height / 2;
  return {
    x: topLeftX + (localX / imgWidth)  * layer.width,
    y: topLeftY + (localY / imgHeight) * layer.height,
  };
}

/**
 * canvasToScreen — convert world-space to screen-space.
 */
export function canvasToScreen(canvasX, canvasY, viewport) {
  return {
    x: canvasX * viewport.scale.x + viewport.x,
    y: canvasY * viewport.scale.y + viewport.y,
  };
}

/**
 * loadLayerPixels — async. Returns { imageData, canvas, ctx, width, height }.
 * ALWAYS loads at layer display dimensions (layer.width × layer.height) so that
 * the resulting pixel buffer matches the lasso/wand mask which is also built at
 * display size. Loading at natural image size caused mask/pixel dimension mismatch.
 */
export async function loadLayerPixels(layer) {
  if (!layer || layer.type !== 'image') {
    console.warn('[loadLayerPixels] invalid layer', layer?.type);
    return null;
  }

  // Display dimensions — mask is always built at these
  const w = Math.round(layer.width);
  const h = Math.round(layer.height);

  if (!w || !h) {
    console.warn('[loadLayerPixels] layer has no display dimensions', layer.width, layer.height);
    return null;
  }

  // If the layer has been pixel-edited before (_hasPaintData), use the existing
  // paint canvas directly as the pixel base — do NOT composite on top of the
  // original image. The paint canvas is the complete authoritative pixel state
  // (transparent holes must remain transparent, not let the base image show through).
  const existingPaint = window.__paintCanvases?.get(layer.id);
  if (existingPaint && layer._hasPaintData) {
    console.log('[loadLayerPixels] using existing paint canvas as base (hasPaintData)');
    const canvas = document.createElement('canvas');
    canvas.width  = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(existingPaint, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    return { imageData, canvas, ctx, width: w, height: h };
  }

  const imageUrl = layer.imageData?.src || layer.src || layer.imageUrl;
  if (!imageUrl) {
    console.warn('[loadLayerPixels] no imageUrl for layer', layer.id, 'keys:', Object.keys(layer));
    return null;
  }

  console.log('[loadLayerPixels] loading at display size', w, 'x', h, '— url:', imageUrl.slice(0, 80));

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    img.onload  = resolve;
    img.onerror = reject;
    img.src     = imageUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Draw image scaled to display dimensions
  ctx.drawImage(img, 0, 0, w, h);

  // Composite existing paint canvas on top if present
  if (existingPaint && existingPaint.width > 0) {
    ctx.drawImage(existingPaint, 0, 0, w, h);
    console.log('[loadLayerPixels] composited existing paint canvas');
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const testPx    = imageData.data.slice(
    (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4,
    (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4 + 4,
  );
  console.log('[loadLayerPixels] center pixel:', ...testPx, '— size:', w, h);

  return { imageData, canvas, ctx, width: w, height: h };
}
