/* eslint-disable no-restricted-globals */
/**
 * filterWorker.js — Web Worker for all blur & sharpen filter operations.
 *
 * Blur:    Gaussian, Motion, Radial (Zoom/Spin), Surface, Lens/Bokeh
 * Sharpen: Unsharp Mask, High Pass
 *
 * Message in:
 *   { type, pixels: ArrayBuffer, width, height, mask?: ArrayBuffer, fast?: bool, ...params }
 * Message out (final):
 *   { pixels: ArrayBuffer }
 * Message out (progress, slow filters only):
 *   { progress: 0–1 }
 */

// ── Gaussian Blur (separable 1D kernel) ───────────────────────────────────────

function gaussianKernel(radius) {
  const sigma = Math.max(radius / 3, 0.3);
  const half  = Math.ceil(radius * 2);
  const size  = half * 2 + 1;
  const k     = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - half;
    k[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += k[i];
  }
  for (let i = 0; i < size; i++) k[i] /= sum;
  return { k, half };
}

function gaussianBlurImpl(src, width, height, radius) {
  if (radius < 0.3) return new Uint8ClampedArray(src);
  const { k, half } = gaussianKernel(radius);
  const tmp = new Float32Array(src.length);
  const dst = new Uint8ClampedArray(src.length);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = -half; i <= half; i++) {
        const nx = Math.max(0, Math.min(width - 1, x + i));
        const pi = (row + nx) * 4;
        const w  = k[i + half];
        r += src[pi] * w; g += src[pi + 1] * w;
        b += src[pi + 2] * w; a += src[pi + 3] * w;
      }
      const oi = (row + x) * 4;
      tmp[oi] = r; tmp[oi + 1] = g; tmp[oi + 2] = b; tmp[oi + 3] = a;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = -half; i <= half; i++) {
        const ny = Math.max(0, Math.min(height - 1, y + i));
        const pi = (ny * width + x) * 4;
        const w  = k[i + half];
        r += tmp[pi] * w; g += tmp[pi + 1] * w;
        b += tmp[pi + 2] * w; a += tmp[pi + 3] * w;
      }
      const oi = (y * width + x) * 4;
      dst[oi] = r; dst[oi + 1] = g; dst[oi + 2] = b; dst[oi + 3] = a;
    }
  }
  return dst;
}

// ── Motion Blur ───────────────────────────────────────────────────────────────

function motionBlurImpl(src, width, height, angle, distance) {
  const rad  = (angle * Math.PI) / 180;
  const ddx  = Math.cos(rad);
  const ddy  = Math.sin(rad);
  const steps = Math.max(1, Math.round(distance));
  const dst  = new Uint8ClampedArray(src.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0, cnt = 0;
      for (let s = -steps; s <= steps; s++) {
        const nx = Math.round(x + ddx * s);
        const ny = Math.round(y + ddy * s);
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const pi = (ny * width + nx) * 4;
        r += src[pi]; g += src[pi + 1]; b += src[pi + 2]; a += src[pi + 3]; cnt++;
      }
      if (cnt === 0) cnt = 1;
      const oi = (y * width + x) * 4;
      dst[oi] = r / cnt; dst[oi + 1] = g / cnt; dst[oi + 2] = b / cnt; dst[oi + 3] = a / cnt;
    }
  }
  return dst;
}

// ── Radial Blur (Zoom + Spin) ─────────────────────────────────────────────────

function radialBlurImpl(src, width, height, mode, amount, centerX, centerY, fast) {
  const cx    = centerX * width;
  const cy    = centerY * height;
  const steps = fast ? Math.max(3, Math.round(amount / 6)) : Math.max(5, Math.round(amount / 3));
  const dst   = new Uint8ClampedArray(src.length);

  if (mode === 'zoom') {
    const scale = (amount / 100) * 0.25;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let s = 0; s < steps; s++) {
          const t  = (s / steps) * scale;
          const nx = Math.max(0, Math.min(width  - 1, Math.round(cx + (x - cx) * (1 - t))));
          const ny = Math.max(0, Math.min(height - 1, Math.round(cy + (y - cy) * (1 - t))));
          const pi = (ny * width + nx) * 4;
          r += src[pi]; g += src[pi + 1]; b += src[pi + 2]; a += src[pi + 3];
        }
        const oi = (y * width + x) * 4;
        dst[oi] = r / steps; dst[oi + 1] = g / steps; dst[oi + 2] = b / steps; dst[oi + 3] = a / steps;
      }
    }
  } else { // spin
    const maxAngle = (amount / 100) * 0.28;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx   = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const base = Math.atan2(dy, dx);
        let r = 0, g = 0, b = 0, a = 0;
        for (let s = 0; s < steps; s++) {
          const t     = s / (steps - 1) - 0.5;
          const angle = base + t * maxAngle;
          const nx    = Math.max(0, Math.min(width  - 1, Math.round(cx + dist * Math.cos(angle))));
          const ny    = Math.max(0, Math.min(height - 1, Math.round(cy + dist * Math.sin(angle))));
          const pi    = (ny * width + nx) * 4;
          r += src[pi]; g += src[pi + 1]; b += src[pi + 2]; a += src[pi + 3];
        }
        const oi = (y * width + x) * 4;
        dst[oi] = r / steps; dst[oi + 1] = g / steps; dst[oi + 2] = b / steps; dst[oi + 3] = a / steps;
      }
    }
  }
  return dst;
}

// ── Surface Blur (edge-preserving bilateral-style) ────────────────────────────

function surfaceBlurImpl(src, width, height, radius, threshold) {
  const r   = Math.max(1, Math.round(radius));
  const thr = threshold * 3; // sum of RGB channel diffs
  const dst = new Uint8ClampedArray(src.length);
  const step = Math.max(1, Math.ceil(height / 20));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ci = (y * width + x) * 4;
      const cr = src[ci], cg = src[ci + 1], cb = src[ci + 2];
      let sr = 0, sg = 0, sb = 0, sa = 0, wsum = 0;

      for (let dy = -r; dy <= r; dy++) {
        const ny  = Math.max(0, Math.min(height - 1, y + dy));
        const row = ny * width;
        for (let dx = -r; dx <= r; dx++) {
          const nx   = Math.max(0, Math.min(width - 1, x + dx));
          const pi   = (row + nx) * 4;
          const diff = Math.abs(src[pi] - cr) + Math.abs(src[pi + 1] - cg) + Math.abs(src[pi + 2] - cb);
          if (diff > thr) continue;
          sr += src[pi]; sg += src[pi + 1]; sb += src[pi + 2]; sa += src[pi + 3];
          wsum++;
        }
      }

      const oi = ci;
      if (wsum > 0) {
        dst[oi] = sr / wsum; dst[oi + 1] = sg / wsum;
        dst[oi + 2] = sb / wsum; dst[oi + 3] = sa / wsum;
      } else {
        dst[oi] = cr; dst[oi + 1] = cg; dst[oi + 2] = cb; dst[oi + 3] = src[ci + 3];
      }
    }
    if (y % step === 0) self.postMessage({ progress: y / height });
  }
  return dst;
}

// ── Lens Blur / Bokeh ─────────────────────────────────────────────────────────

function buildBokehKernel(radius, shape, bladeCurvature) {
  const r   = Math.ceil(radius);
  const pts = [];
  const bc  = bladeCurvature / 100; // 0-1

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      let polyIn = false;
      if (shape === 'circle') {
        polyIn = dx * dx + dy * dy <= radius * radius;
      } else if (shape === 'hexagon') {
        const ax = Math.abs(dx / radius), ay = Math.abs(dy / radius);
        polyIn = ax <= 1 && ay <= 0.866 && ax * 0.5 + ay * 0.866 <= 1;
      } else if (shape === 'octagon') {
        const ax = Math.abs(dx / radius), ay = Math.abs(dy / radius);
        polyIn = ax <= 1 && ay <= 1 && ax + ay <= 1.414;
      }
      const circIn = dx * dx + dy * dy <= radius * radius;
      // bladeCurvature blends between polygon and circle
      if (bc >= 1 ? circIn : bc > 0 ? (polyIn && circIn) || (bc > 0.5 && circIn) : polyIn) {
        pts.push([dx, dy]);
      }
    }
  }
  return pts;
}

function lensBlurImpl(src, width, height, radius, shape, bladeCurvature, brightness, threshold, fast) {
  const effectiveRadius = fast ? Math.min(radius, 10) : radius;
  const kernel = buildBokehKernel(effectiveRadius, shape, bladeCurvature);
  const cnt    = Math.max(1, kernel.length);
  const dst    = new Uint8ClampedArray(src.length);
  const boost  = brightness / 100;
  const step   = Math.max(1, Math.ceil(height / 20));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0, hr = 0, hg = 0, hb = 0;

      for (const [kdx, kdy] of kernel) {
        const nx = Math.max(0, Math.min(width  - 1, x + kdx));
        const ny = Math.max(0, Math.min(height - 1, y + kdy));
        const pi = (ny * width + nx) * 4;
        r += src[pi]; g += src[pi + 1]; b += src[pi + 2]; a += src[pi + 3];

        if (threshold > 0 && boost > 0) {
          const lum = src[pi] * 0.299 + src[pi + 1] * 0.587 + src[pi + 2] * 0.114;
          if (lum > threshold) {
            const hl = ((lum - threshold) / (255 - threshold + 1)) * boost;
            hr = Math.max(hr, src[pi]     * hl);
            hg = Math.max(hg, src[pi + 1] * hl);
            hb = Math.max(hb, src[pi + 2] * hl);
          }
        }
      }

      const oi = (y * width + x) * 4;
      dst[oi]     = Math.min(255, r / cnt + hr);
      dst[oi + 1] = Math.min(255, g / cnt + hg);
      dst[oi + 2] = Math.min(255, b / cnt + hb);
      dst[oi + 3] = a / cnt;
    }
    if (y % step === 0) self.postMessage({ progress: y / height });
  }
  return dst;
}

// ── Unsharp Mask ──────────────────────────────────────────────────────────────

function unsharpMaskImpl(src, width, height, amount, radius, threshold) {
  const blurred = gaussianBlurImpl(src, width, height, Math.max(0.5, radius));
  const dst     = new Uint8ClampedArray(src.length);
  const factor  = amount / 100;

  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = src[i + c] - blurred[i + c];
      dst[i + c] = Math.abs(diff) > threshold
        ? Math.max(0, Math.min(255, src[i + c] + factor * diff))
        : src[i + c];
    }
    dst[i + 3] = src[i + 3];
  }
  return dst;
}

// ── High Pass ─────────────────────────────────────────────────────────────────

function highPassImpl(src, width, height, radius) {
  const blurred = gaussianBlurImpl(src, width, height, Math.max(0.5, radius));
  const dst     = new Uint8ClampedArray(src.length);

  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      dst[i + c] = Math.max(0, Math.min(255, 128 + (src[i + c] - blurred[i + c])));
    }
    dst[i + 3] = src[i + 3];
  }
  return dst;
}

// ── Selection mask compositing ────────────────────────────────────────────────

function applySelectionMask(original, filtered, mask) {
  if (!mask) return filtered;
  const out = new Uint8ClampedArray(filtered.length);
  for (let i = 0; i < out.length; i += 4) {
    const m = mask[i >> 2] / 255;
    out[i]     = original[i]     * (1 - m) + filtered[i]     * m;
    out[i + 1] = original[i + 1] * (1 - m) + filtered[i + 1] * m;
    out[i + 2] = original[i + 2] * (1 - m) + filtered[i + 2] * m;
    out[i + 3] = original[i + 3] * (1 - m) + filtered[i + 3] * m;
  }
  return out;
}

// ── Message dispatcher ────────────────────────────────────────────────────────

self.onmessage = function (e) {
  const { type, pixels, width, height, mask: maskBuf, fast = false, ...params } = e.data;
  const src  = new Uint8ClampedArray(pixels);
  const mask = maskBuf ? new Uint8ClampedArray(maskBuf) : null;

  let result;
  switch (type) {
    case 'gaussian':
      result = gaussianBlurImpl(src, width, height, params.radius);
      break;
    case 'motion':
      result = motionBlurImpl(src, width, height, params.angle, params.distance);
      break;
    case 'radial':
      result = radialBlurImpl(src, width, height, params.mode, params.amount, params.centerX, params.centerY, fast);
      break;
    case 'surface':
      result = surfaceBlurImpl(src, width, height, params.radius, params.threshold);
      break;
    case 'lens':
      result = lensBlurImpl(src, width, height, params.radius, params.shape, params.bladeCurvature, params.brightness, params.threshold, fast);
      break;
    case 'unsharp':
      result = unsharpMaskImpl(src, width, height, params.amount, params.radius, params.threshold);
      break;
    case 'highpass':
      result = highPassImpl(src, width, height, params.radius);
      break;
    default:
      result = new Uint8ClampedArray(src);
  }

  if (mask) result = applySelectionMask(src, result, mask);

  self.postMessage({ pixels: result.buffer }, [result.buffer]);
};
