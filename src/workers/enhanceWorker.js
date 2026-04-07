// src/workers/enhanceWorker.js
// Pure pixel-math versions of all ThumbnailEnhancer operations.
// Runs off the main thread to prevent UI hangs on mobile.
// Receives { action, buffer, width, height, amount? }
// Returns  { buffer } via transferable ArrayBuffer.

function autoBrighten(data, totalPixels) {
  let avg = 0;
  for (let i = 0; i < data.length; i += 4)
    avg += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  avg /= totalPixels;
  const adj = 120 - avg;
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.min(255, Math.max(0, data[i]     + adj));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + adj));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + adj));
  }
  if (adj > 30) {
    let mean = 0;
    for (let i = 0; i < data.length; i += 4)
      mean += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    mean /= totalPixels;
    const f = 1.15;
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = Math.min(255, Math.max(0, Math.round(mean + (data[i]     - mean) * f)));
      data[i + 1] = Math.min(255, Math.max(0, Math.round(mean + (data[i + 1] - mean) * f)));
      data[i + 2] = Math.min(255, Math.max(0, Math.round(mean + (data[i + 2] - mean) * f)));
    }
  }
}

function autoContrast(data, totalPixels) {
  let mean = 0;
  for (let i = 0; i < data.length; i += 4)
    mean += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  mean /= totalPixels;
  const f = 1.3;
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.min(255, Math.max(0, Math.round(mean + (data[i]     - mean) * f)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(mean + (data[i + 1] - mean) * f)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(mean + (data[i + 2] - mean) * f)));
  }
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1; if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}

function autoSaturate(data, amount) {
  const amt = amount !== undefined ? amount : 0.25;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]/255, g = data[i+1]/255, b = data[i+2]/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const l = (max + min) / 2;
    if (max === min) continue;
    const d = max - min;
    let s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else                h = ((r - g) / d + 4) / 6;
    s = Math.min(1, s + amt * (1 - s));
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    data[i]   = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    data[i+1] = Math.round(hue2rgb(p, q, h)       * 255);
    data[i+2] = Math.round(hue2rgb(p, q, h - 1/3) * 255);
  }
}

function autoDesaturate(data) {
  autoSaturate(data, -0.15);
}

function autoWhiteBalance(data, totalPixels) {
  let avgR=0, avgG=0, avgB=0;
  for (let i = 0; i < data.length; i += 4) {
    avgR += data[i]; avgG += data[i+1]; avgB += data[i+2];
  }
  avgR /= totalPixels; avgG /= totalPixels; avgB /= totalPixels;
  const avg = (avgR + avgG + avgB) / 3;
  const sR = avg/avgR, sG = avg/avgG, sB = avg/avgB;
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.min(255, Math.round(data[i]   * sR));
    data[i+1] = Math.min(255, Math.round(data[i+1] * sG));
    data[i+2] = Math.min(255, Math.round(data[i+2] * sB));
  }
}

function autoVignette(data, w, h) {
  const cx = w/2, cy = h/2;
  const maxDist = Math.sqrt(cx*cx + cy*cy);
  const inner = maxDist * 0.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.sqrt((x-cx)*(x-cx) + (y-cy)*(y-cy));
      if (dist > inner) {
        const t = Math.min(1, (dist - inner) / (maxDist - inner));
        const factor = 1 - t * 0.4;
        const i = (y * w + x) * 4;
        data[i]   = Math.round(data[i]   * factor);
        data[i+1] = Math.round(data[i+1] * factor);
        data[i+2] = Math.round(data[i+2] * factor);
      }
    }
  }
}

function autoSharpen(data, w, h) {
  const src = new Uint8ClampedArray(data);
  const amount = 0.8, threshold = 3;
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      const i = (y*w+x)*4;
      for (let c = 0; c < 3; c++) {
        const blurred = (
          src[((y-1)*w+x-1)*4+c] + src[((y-1)*w+x)*4+c]   + src[((y-1)*w+x+1)*4+c] +
          src[(y*w+x-1)*4+c]     + src[i+c]                + src[(y*w+x+1)*4+c] +
          src[((y+1)*w+x-1)*4+c] + src[((y+1)*w+x)*4+c]   + src[((y+1)*w+x+1)*4+c]
        ) / 9;
        const diff = src[i+c] - blurred;
        if (Math.abs(diff) > threshold)
          data[i+c] = Math.min(255, Math.max(0, Math.round(src[i+c] + diff*amount)));
      }
    }
  }
}

const ACTION_MAP = {
  auto_brighten:      (d, w, h, tp) => autoBrighten(d, tp),
  auto_darken:        (d, w, h, tp) => autoContrast(d, tp),
  auto_contrast:      (d, w, h, tp) => autoContrast(d, tp),
  auto_saturate:      (d)           => autoSaturate(d),
  auto_desaturate:    (d)           => autoDesaturate(d),
  auto_vignette:      (d, w, h)     => autoVignette(d, w, h),
  auto_white_balance: (d, w, h, tp) => autoWhiteBalance(d, tp),
  auto_sharpen:       (d, w, h)     => autoSharpen(d, w, h),
  gaming_enhance:     (d, w, h, tp) => {
    autoSaturate(d, 0.3);
    autoContrast(d, tp);
    autoVignette(d, w, h);
  },
};

/* eslint-disable no-restricted-globals */
self.onmessage = function(e) {
  const { id, buffer, width, height, actions } = e.data;
  try {
    const data = new Uint8ClampedArray(buffer);
    const totalPixels = width * height;
    for (const action of actions) {
      const fn = ACTION_MAP[action];
      if (fn) fn(data, width, height, totalPixels);
    }
    // Transfer the buffer back (zero-copy)
    self.postMessage({ id, buffer: data.buffer }, [data.buffer]);
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
/* eslint-enable no-restricted-globals */
