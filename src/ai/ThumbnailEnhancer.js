// src/ai/ThumbnailEnhancer.js
// Pixel-level enhancement functions. Each takes a canvas, modifies it in-place, returns it.

export function autoBrighten(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const totalPixels = canvas.width * canvas.height;

  // Calculate current average brightness (luma-weighted, all channels equal)
  let avgBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    avgBrightness += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  avgBrightness /= totalPixels;

  // Uniform additive shift toward target — preserves color relationships, no artifacts
  const target = 120;
  const adjustment = target - avgBrightness;
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.min(255, Math.max(0, data[i]     + adjustment));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + adjustment));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + adjustment));
  }

  // Only add a gentle contrast boost when the image was very dark (needed big push)
  if (adjustment > 30) {
    let mean = 0;
    for (let i = 0; i < data.length; i += 4) {
      mean += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
    mean /= totalPixels;
    const factor = 1.15;
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = Math.min(255, Math.max(0, Math.round(mean + (data[i]     - mean) * factor)));
      data[i + 1] = Math.min(255, Math.max(0, Math.round(mean + (data[i + 1] - mean) * factor)));
      data[i + 2] = Math.min(255, Math.max(0, Math.round(mean + (data[i + 2] - mean) * factor)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function autoContrast(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const totalPixels = canvas.width * canvas.height;

  // Luma-weighted mean — expand contrast around it uniformly, no color shift
  let mean = 0;
  for (let i = 0; i < data.length; i += 4) {
    mean += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  mean /= totalPixels;

  const factor = 1.3;
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.min(255, Math.max(0, Math.round(mean + (data[i]     - mean) * factor)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(mean + (data[i + 1] - mean) * factor)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(mean + (data[i + 2] - mean) * factor)));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function autoSaturate(canvas, amount = 0.25) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q-p)*6*t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q-p)*(2/3-t)*6;
    return p;
  };

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]/255, g = data[i+1]/255, b = data[i+2]/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const l = (max+min)/2;
    if (max === min) continue;
    const d = max - min;
    let s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    let h;
    switch (max) {
      case r: h = ((g-b)/d + (g<b?6:0)) / 6; break;
      case g: h = ((b-r)/d + 2) / 6; break;
      default: h = ((r-g)/d + 4) / 6;
    }
    // Vibrance: boost undersaturated pixels more
    const vibranceBoost = amount * (1 - s);
    s = Math.min(1, s + vibranceBoost);
    const q = l < 0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l - q;
    data[i]   = Math.round(hue2rgb(p,q,h+1/3)*255);
    data[i+1] = Math.round(hue2rgb(p,q,h)*255);
    data[i+2] = Math.round(hue2rgb(p,q,h-1/3)*255);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function autoDesaturate(canvas) {
  return autoSaturate(canvas, -0.15);
}

export function autoVignette(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w/2, cy = h/2;
  const maxDist = Math.sqrt(cx*cx + cy*cy);
  const gradient = ctx.createRadialGradient(cx,cy,maxDist*0.5, cx,cy,maxDist);
  gradient.addColorStop(0,   'rgba(0,0,0,0)');
  gradient.addColorStop(0.7, 'rgba(0,0,0,0.1)');
  gradient.addColorStop(1,   'rgba(0,0,0,0.4)');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,w,h);
  ctx.restore();
  return canvas;
}

export function autoWhiteBalance(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const count = canvas.width * canvas.height;
  let avgR=0, avgG=0, avgB=0;
  for (let i = 0; i < data.length; i += 4) {
    avgR += data[i]; avgG += data[i+1]; avgB += data[i+2];
  }
  avgR /= count; avgG /= count; avgB /= count;
  const avg = (avgR+avgG+avgB)/3;
  const sR = avg/avgR, sG = avg/avgG, sB = avg/avgB;
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.min(255, Math.round(data[i]*sR));
    data[i+1] = Math.min(255, Math.round(data[i+1]*sG));
    data[i+2] = Math.min(255, Math.round(data[i+2]*sB));
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function autoSharpen(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width, h = canvas.height;
  const src = new Uint8ClampedArray(data);
  const amount = 0.8, threshold = 3;
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      const i = (y*w+x)*4;
      for (let c = 0; c < 3; c++) {
        const blurred = (
          src[((y-1)*w+x-1)*4+c] + src[((y-1)*w+x)*4+c]   + src[((y-1)*w+x+1)*4+c] +
          src[(y*w+x-1)*4+c]     + src[i+c]                 + src[(y*w+x+1)*4+c] +
          src[((y+1)*w+x-1)*4+c] + src[((y+1)*w+x)*4+c]   + src[((y+1)*w+x+1)*4+c]
        ) / 9;
        const diff = src[i+c] - blurred;
        if (Math.abs(diff) > threshold) {
          data[i+c] = Math.min(255, Math.max(0, Math.round(src[i+c] + diff*amount)));
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function gamingEnhance(canvas) {
  autoSaturate(canvas, 0.3);
  autoContrast(canvas);
  autoVignette(canvas);
  return canvas;
}

// ── Web Worker path (used on mobile to avoid main-thread blocking) ────────────
let _worker = null;
let _nextId = 0;
const _pending = {};

function getWorker() {
  if (!_worker) {
    _worker = new Worker(new URL('../workers/enhanceWorker.js', import.meta.url));
    _worker.onmessage = (e) => {
      const { id, buffer, error } = e.data;
      const resolve = _pending[id];
      delete _pending[id];
      if (resolve) resolve({ buffer, error });
    };
  }
  return _worker;
}

/**
 * Runs all enhancement actions off the main thread via a Web Worker.
 * Falls back to synchronous autoFixAll if Workers aren't available.
 * Uses willReadFrequently:true on the processing canvas for CPU-side reads.
 */
export async function enhanceWithWorker(canvas, recommendations) {
  const actions = recommendations
    .filter(r => r.action && !['show_safe_zones','crop_to_face','resize_canvas'].includes(r.action))
    .map(r => r.action);
  if (!actions.length) return canvas;

  // Processing canvas: willReadFrequently avoids Chrome GPU-disable heuristic
  const proc = document.createElement('canvas');
  proc.width = canvas.width;
  proc.height = canvas.height;
  const pCtx = proc.getContext('2d', { willReadFrequently: true });
  pCtx.drawImage(canvas, 0, 0);
  const imageData = pCtx.getImageData(0, 0, proc.width, proc.height);

  if (typeof Worker === 'undefined') {
    // No Worker support — fall back to sync (e.g. some webviews)
    autoFixAll(canvas, recommendations);
    return canvas;
  }

  const id = _nextId++;
  const worker = getWorker();
  const result = await new Promise((resolve) => {
    _pending[id] = resolve;
    // Transfer the ArrayBuffer so the main thread doesn't block on a copy
    worker.postMessage(
      { id, buffer: imageData.data.buffer, width: proc.width, height: proc.height, actions },
      [imageData.data.buffer]
    );
  });

  if (result.error) {
    console.error('[enhanceWorker]', result.error);
    return canvas;
  }

  // Write result from worker back to the display canvas
  const outData = new ImageData(new Uint8ClampedArray(result.buffer), proc.width, proc.height);
  const displayCtx = canvas.getContext('2d');
  displayCtx.putImageData(outData, 0, 0);

  // Release processing canvas memory (Safari hoards canvas memory)
  proc.width = 1; proc.height = 1;

  return canvas;
}

export function autoFixAll(canvas, recommendations) {
  const actionMap = {
    auto_brighten:     autoBrighten,
    auto_darken:       autoContrast,
    auto_contrast:     autoContrast,
    auto_saturate:     autoSaturate,
    auto_desaturate:   autoDesaturate,
    auto_vignette:     autoVignette,
    auto_white_balance:autoWhiteBalance,
    gaming_enhance:    gamingEnhance,
  };
  for (const rec of recommendations) {
    if (rec.action && actionMap[rec.action]) {
      actionMap[rec.action](canvas);
    }
  }
  return canvas;
}
