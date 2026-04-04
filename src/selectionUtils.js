/**
 * selectionUtils.js — pixel-level selection mask operations.
 * All masks are Uint8Array of length W*H where index = y*W+x.
 * Values: 0=unselected, 255=selected (supports soft/feathered edges).
 */

// Create rectangular mask
export function rectMask(x, y, w, h, canvW, canvH) {
  const mask = new Uint8Array(canvW * canvH);
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(canvW, Math.round(x + w));
  const y1 = Math.min(canvH, Math.round(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      mask[py * canvW + px] = 255;
    }
  }
  return mask;
}

// Create elliptical mask (x,y = top-left corner, w,h = size)
export function ellipseMask(x, y, w, h, canvW, canvH) {
  const mask = new Uint8Array(canvW * canvH);
  if (w <= 0 || h <= 0) return mask;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(canvW, Math.ceil(x + w));
  const y1 = Math.min(canvH, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const dx = (px + 0.5 - cx) / rx;
      const dy = (py + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        mask[py * canvW + px] = 255;
      }
    }
  }
  return mask;
}

// Create mask from polygon points using canvas fill
export function pathMask(points, canvW, canvH) {
  const mask = new Uint8Array(canvW * canvH);
  if (!points || points.length < 3) return mask;
  const canvas = document.createElement('canvas');
  canvas.width = canvW;
  canvas.height = canvH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();
  const imgData = ctx.getImageData(0, 0, canvW, canvH);
  const data = imgData.data;
  for (let i = 0; i < canvW * canvH; i++) {
    // Use red channel (filled as #ffffff → r=255)
    mask[i] = data[i * 4] > 127 ? 255 : 0;
  }
  return mask;
}

// BFS flood-fill magic wand. imageData is a flat canvas ImageData.
// tolerance: 0-255 squared color distance threshold
export function magicWandMask(imageData, startX, startY, tolerance) {
  const { width: W, height: H, data } = imageData;
  const mask = new Uint8Array(W * H);
  if (startX < 0 || startX >= W || startY < 0 || startY >= H) return mask;

  const threshSq = tolerance * tolerance * 3;
  const si = (startY * W + startX) * 4;
  const sr = data[si];
  const sg = data[si + 1];
  const sb = data[si + 2];

  const visited = new Uint8Array(W * H);
  const stack = [];
  stack.push(startX, startY);
  visited[startY * W + startX] = 1;

  while (stack.length > 0) {
    const py = stack.pop();
    const px = stack.pop();
    const idx = py * W + px;
    const di = idx * 4;
    const dr = data[di] - sr;
    const dg = data[di + 1] - sg;
    const db = data[di + 2] - sb;
    const distSq = dr * dr + dg * dg + db * db;
    if (distSq > threshSq) continue;
    mask[idx] = 255;

    const neighbors = [
      [px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
        const ni = ny * W + nx;
        if (!visited[ni]) {
          visited[ni] = 1;
          stack.push(nx, ny);
        }
      }
    }
  }
  return mask;
}

// Combine masks: mode = 'new' | 'add' | 'subtract' | 'intersect'
export function combineMasks(existing, next, mode) {
  if (!next) return existing || new Uint8Array(0);
  const len = next.length;
  const result = new Uint8Array(len);
  if (mode === 'new' || !existing || existing.length !== len) {
    for (let i = 0; i < len; i++) result[i] = next[i];
    return result;
  }
  switch (mode) {
    case 'add':
      for (let i = 0; i < len; i++) result[i] = Math.min(255, existing[i] + next[i]);
      break;
    case 'subtract':
      for (let i = 0; i < len; i++) result[i] = Math.max(0, existing[i] - next[i]);
      break;
    case 'intersect':
      for (let i = 0; i < len; i++) result[i] = Math.min(existing[i], next[i]);
      break;
    default:
      for (let i = 0; i < len; i++) result[i] = next[i];
  }
  return result;
}

// Invert mask
export function invertMask(mask) {
  const result = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) result[i] = 255 - mask[i];
  return result;
}

// Select all (fill entire mask with 255)
export function selectAllMask(w, h) {
  const mask = new Uint8Array(w * h);
  mask.fill(255);
  return mask;
}

// Get bounding box of non-zero mask pixels, returns {x,y,w,h} or null
export function maskBounds(mask, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (mask[py * w + px]) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
  }
  if (maxX === -1) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// 3-pass box-blur Gaussian approximation for feathering
export function featherMask(mask, w, h, radius) {
  if (radius <= 0) return mask;
  let src = new Float32Array(mask);
  let dst = new Float32Array(w * h);
  const r = Math.round(radius);

  // Horizontal pass
  for (let py = 0; py < h; py++) {
    let sum = 0;
    let count = 0;
    // Initialize window
    for (let px = 0; px <= r && px < w; px++) {
      sum += src[py * w + px];
      count++;
    }
    for (let px = 0; px < w; px++) {
      dst[py * w + px] = sum / count;
      // Remove left edge
      const leftIdx = px - r;
      if (leftIdx >= 0) { sum -= src[py * w + leftIdx]; count--; }
      // Add right edge
      const rightIdx = px + r + 1;
      if (rightIdx < w) { sum += src[py * w + rightIdx]; count++; }
    }
  }

  // Vertical pass
  let src2 = dst;
  let dst2 = new Float32Array(w * h);
  for (let px = 0; px < w; px++) {
    let sum = 0;
    let count = 0;
    for (let py = 0; py <= r && py < h; py++) {
      sum += src2[py * w + px];
      count++;
    }
    for (let py = 0; py < h; py++) {
      dst2[py * w + px] = sum / count;
      const topIdx = py - r;
      if (topIdx >= 0) { sum -= src2[topIdx * w + px]; count--; }
      const botIdx = py + r + 1;
      if (botIdx < h) { sum += src2[botIdx * w + px]; count++; }
    }
  }

  // Convert back to Uint8Array, clamped
  const result = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    result[i] = Math.min(255, Math.max(0, Math.round(dst2[i])));
  }
  return result;
}

const DASH_SIZE = 6;

// Draw marching ants on a canvas 2D context.
// Uses pixel-level edge detection: edge pixels of selection alternate
// black/white based on (x+y+dashOffset) / DASH_SIZE. Classic marching look.
export function drawMarchingAnts(ctx, mask, W, H, dashOffset) {
  if (!mask || mask.length !== W * H) return;

  const imageData = ctx.createImageData(W, H);
  const pixels = imageData.data;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const idx = py * W + px;
      if (!mask[idx]) continue;

      // Check if this is an edge pixel: any 4-neighbor is unselected or at border
      const isEdge =
        px === 0 || px === W - 1 || py === 0 || py === H - 1 ||
        !mask[(py - 1) * W + px] ||
        !mask[(py + 1) * W + px] ||
        !mask[py * W + (px - 1)] ||
        !mask[py * W + (px + 1)];

      if (!isEdge) continue;

      const phase = Math.floor((px + py + dashOffset) / DASH_SIZE) % 2;
      const c = phase === 0 ? 255 : 0;
      const pi = idx * 4;
      pixels[pi] = c;
      pixels[pi + 1] = c;
      pixels[pi + 2] = c;
      pixels[pi + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
