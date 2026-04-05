/* eslint-disable no-restricted-globals */
self.onmessage = (e) => {
  const { tool, tilePixels, tileW, tileH, strength, exposure, range, prevTilePixels, brushMask } = e.data;
  const pixels = new Uint8ClampedArray(tilePixels);
  const prev = prevTilePixels ? new Uint8ClampedArray(prevTilePixels) : null;
  const mask = brushMask ? new Float32Array(brushMask) : null;

  if (tool === 'dodge' || tool === 'burn') {
    const exp = (exposure || 50) / 100;
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = mask ? mask[i / 4] : 1;
      if (alpha <= 0) continue;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      let rangeFactor = 1;
      if (range === 'shadows') rangeFactor = lum < 85 ? 1 : lum < 170 ? (170 - lum) / 85 : 0;
      else if (range === 'highlights') rangeFactor = lum > 170 ? 1 : lum > 85 ? (lum - 85) / 85 : 0;
      else rangeFactor = lum < 85 ? lum / 85 : lum > 170 ? (255 - lum) / 85 : 1; // midtones
      const factor = alpha * exp * rangeFactor * 0.3;
      if (tool === 'dodge') {
        pixels[i]     = Math.min(255, r + (255 - r) * factor);
        pixels[i + 1] = Math.min(255, g + (255 - g) * factor);
        pixels[i + 2] = Math.min(255, b + (255 - b) * factor);
      } else {
        pixels[i]     = Math.max(0, r - r * factor);
        pixels[i + 1] = Math.max(0, g - g * factor);
        pixels[i + 2] = Math.max(0, b - b * factor);
      }
    }
  } else if (tool === 'blur') {
    const radius = Math.max(1, Math.round((strength || 50) / 100 * 4));
    const out = new Uint8ClampedArray(pixels);
    const w = tileW, h = tileH;
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const mi = (y * w + x) * 4;
          const alpha = mask ? mask[mi / 4] : 1;
          if (alpha <= 0) continue;
          let sr = 0, sg = 0, sb = 0, cnt = 0;
          for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const ni = (ny * w + nx) * 4;
            sr += pixels[ni]; sg += pixels[ni + 1]; sb += pixels[ni + 2]; cnt++;
          }
          const t = alpha * (strength || 50) / 100;
          out[mi]     = pixels[mi]     * (1 - t) + (sr / cnt) * t;
          out[mi + 1] = pixels[mi + 1] * (1 - t) + (sg / cnt) * t;
          out[mi + 2] = pixels[mi + 2] * (1 - t) + (sb / cnt) * t;
        }
      }
      pixels.set(out);
    }
  } else if (tool === 'sharpen') {
    const str = (strength || 50) / 200;
    const w = tileW, h = tileH;
    const out = new Uint8ClampedArray(pixels);
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const mi = (y * w + x) * 4;
      const alpha = mask ? mask[mi / 4] : 1;
      if (alpha <= 0) continue;
      for (let c = 0; c < 3; c++) {
        let v = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          v += pixels[((y + dy) * w + (x + dx)) * 4 + c] * kernel[(dy + 1) * 3 + (dx + 1)];
        }
        const orig = pixels[mi + c];
        out[mi + c] = Math.min(255, Math.max(0, orig + (v - orig) * str * alpha));
      }
    }
    pixels.set(out);
  } else if (tool === 'smudge') {
    const str = (strength || 50) / 100;
    const w = tileW, h = tileH;
    const src = prev || pixels;
    const out = new Uint8ClampedArray(src);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const mi = (y * w + x) * 4;
      const alpha = mask ? mask[mi / 4] : 1;
      if (alpha <= 0) continue;
      for (let c = 0; c < 3; c++) {
        const neighbors = pixels[((y - 1) * w + x) * 4 + c] + pixels[((y + 1) * w + x) * 4 + c] +
                          pixels[(y * w + x - 1) * 4 + c] + pixels[(y * w + x + 1) * 4 + c];
        out[mi + c] = Math.min(255, Math.max(0, pixels[mi + c] * (1 - str * alpha) + (neighbors / 4) * str * alpha));
      }
    }
    pixels.set(out);
  }

  self.postMessage({ processedPixels: pixels.buffer }, [pixels.buffer]);
};
