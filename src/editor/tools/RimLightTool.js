// src/editor/tools/RimLightTool.js
// NOT a brush tool — generates a rim light effect layer from a subject canvas.
// Algorithm: Sobel edge detection on alpha → directional dot product →
// dilate → blur → render to OffscreenCanvas.

/**
 * Generate rim light from subject canvas.
 * @param {HTMLCanvasElement|OffscreenCanvas} subjectCanvas
 * @param {{ color: string, width: number, softness: number, intensity: number, angle: number, spread: number }} params
 * @returns {OffscreenCanvas}
 */
export function generateRimLight(subjectCanvas, params = {}) {
  const {
    color     = '#ffffff',
    width     = 8,
    softness  = 4,
    intensity = 1.0,
    angle     = 45,     // degrees — light direction
    spread    = 90,     // degrees — cone width
  } = params;

  const W = subjectCanvas.width;
  const H = subjectCanvas.height;

  // Read alpha channel
  const ctx    = subjectCanvas.getContext('2d');
  const pixels = ctx.getImageData(0, 0, W, H).data;
  const alpha  = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    alpha[i] = pixels[i * 4 + 3] / 255;
  }

  // Sobel edge detection on alpha
  const edgeX = new Float32Array(W * H);
  const edgeY = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = y * W + x;
      edgeX[idx] = (
        -alpha[(y-1)*W + (x-1)] - 2*alpha[y*W + (x-1)] - alpha[(y+1)*W + (x-1)] +
         alpha[(y-1)*W + (x+1)] + 2*alpha[y*W + (x+1)] + alpha[(y+1)*W + (x+1)]
      );
      edgeY[idx] = (
        -alpha[(y-1)*W + (x-1)] - 2*alpha[(y-1)*W + x] - alpha[(y-1)*W + (x+1)] +
         alpha[(y+1)*W + (x-1)] + 2*alpha[(y+1)*W + x] + alpha[(y+1)*W + (x+1)]
      );
    }
  }

  // Light direction vector from angle
  const rad  = (angle * Math.PI) / 180;
  const lx   = Math.cos(rad);
  const ly   = -Math.sin(rad); // screen Y is inverted

  // Spread cone threshold
  const spreadRad = (spread / 2 * Math.PI) / 180;
  const spreadCos = Math.cos(spreadRad);

  // Build rimMask: directional edge strength
  const rimMask = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const ex  = edgeX[i];
    const ey  = edgeY[i];
    const len = Math.sqrt(ex * ex + ey * ey);
    if (len < 0.01) continue;
    const nx   = ex / len;
    const ny   = ey / len;
    const dot  = nx * lx + ny * ly;
    if (dot < spreadCos) continue;
    const cone = (dot - spreadCos) / Math.max(0.001, 1 - spreadCos);
    rimMask[i] = Math.min(1, len * cone * intensity);
  }

  // Dilate by width
  const dilated = dilateFloatMask(rimMask, W, H, Math.max(1, Math.round(width)));

  // Blur by softness
  const blurred = blurFloatMask(dilated, W, H, Math.max(0.5, softness));

  // Render to OffscreenCanvas: fill with color at rimMask alpha
  const out    = new OffscreenCanvas(W, H);
  const outCtx = out.getContext('2d');
  const outImg = outCtx.createImageData(W, H);
  const { r, g, b } = hexToRgb(color);

  for (let i = 0; i < W * H; i++) {
    const a = Math.min(1, blurred[i]);
    outImg.data[i*4]   = r;
    outImg.data[i*4+1] = g;
    outImg.data[i*4+2] = b;
    outImg.data[i*4+3] = Math.round(a * 255);
  }
  outCtx.putImageData(outImg, 0, 0);
  return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dilateFloatMask(mask, W, H, radius) {
  const out = new Float32Array(W * H);
  const r   = Math.round(radius);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let max = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          if (dx*dx + dy*dy > r*r) continue;
          const v = mask[ny * W + nx];
          if (v > max) max = v;
        }
      }
      out[y * W + x] = max;
    }
  }
  return out;
}

function blurFloatMask(mask, W, H, radius) {
  // Separable box blur approximation (3 passes)
  const k  = Math.max(1, Math.round(radius));
  let buf  = mask.slice();
  const tmp = new Float32Array(W * H);

  for (let pass = 0; pass < 3; pass++) {
    // Horizontal
    for (let y = 0; y < H; y++) {
      let sum = 0;
      let cnt = 0;
      for (let x = 0; x < k; x++) { sum += buf[y*W+x]; cnt++; }
      for (let x = 0; x < W; x++) {
        if (x + k < W) { sum += buf[y*W + x + k]; cnt++; }
        if (x - k - 1 >= 0) { sum -= buf[y*W + x - k - 1]; cnt--; }
        tmp[y*W+x] = sum / Math.max(1, cnt);
      }
    }
    // Vertical
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let cnt = 0;
      for (let y = 0; y < k; y++) { sum += tmp[y*W+x]; cnt++; }
      for (let y = 0; y < H; y++) {
        if (y + k < H) { sum += tmp[(y+k)*W+x]; cnt++; }
        if (y - k - 1 >= 0) { sum -= tmp[(y-k-1)*W+x]; cnt--; }
        buf[y*W+x] = sum / Math.max(1, cnt);
      }
    }
  }
  return buf;
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
