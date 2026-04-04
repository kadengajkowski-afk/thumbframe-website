/**
 * liquifyWorker.js — Web Worker for mesh-based pixel displacement (Liquify).
 *
 * Backward-mapping: for each output pixel, look up displaced source position
 * via bilinear interpolation of the displacement mesh, then sample source
 * with bilinear filtering.
 *
 * Message in:
 *   { pixels: ArrayBuffer (Uint8ClampedArray source),
 *     width, height,
 *     meshDX: ArrayBuffer (Float32Array), meshDY: ArrayBuffer (Float32Array),
 *     gridW, gridH }
 *
 * Message out: { pixels: ArrayBuffer }
 */

/* eslint-disable no-restricted-globals */

self.onmessage = function (e) {
  const { pixels, width, height, meshDX: dxBuf, meshDY: dyBuf, gridW, gridH } = e.data;
  const src = new Uint8ClampedArray(pixels);
  const dst = new Uint8ClampedArray(width * height * 4);
  const dx  = new Float32Array(dxBuf);
  const dy  = new Float32Array(dyBuf);

  const cellW = width  / (gridW - 1);
  const cellH = height / (gridH - 1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // ── Find grid cell ────────────────────────────────────────────────────
      const gxf = x / cellW;
      const gyf = y / cellH;
      const gi  = Math.min(Math.floor(gxf), gridW - 2);
      const gj  = Math.min(Math.floor(gyf), gridH - 2);
      const fx  = gxf - gi;
      const fy  = gyf - gj;

      // ── Bilinear interpolation of displacement ────────────────────────────
      const i00 = gj * gridW + gi;
      const i10 = i00 + 1;
      const i01 = i00 + gridW;
      const i11 = i01 + 1;

      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx       * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx       * fy;

      const dispX = dx[i00]*w00 + dx[i10]*w10 + dx[i01]*w01 + dx[i11]*w11;
      const dispY = dy[i00]*w00 + dy[i10]*w10 + dy[i01]*w01 + dy[i11]*w11;

      // ── Backward-map to source ────────────────────────────────────────────
      const sx = x - dispX;
      const sy = y - dispY;

      // ── Bilinear sample from source ───────────────────────────────────────
      const sx0 = Math.max(0, Math.min(width  - 2, Math.floor(sx)));
      const sy0 = Math.max(0, Math.min(height - 2, Math.floor(sy)));
      const sx1 = sx0 + 1;
      const sy1 = sy0 + 1;
      const sfx = sx - sx0;
      const sfy = sy - sy0;

      const p00 = (sy0 * width + sx0) * 4;
      const p10 = (sy0 * width + sx1) * 4;
      const p01 = (sy1 * width + sx0) * 4;
      const p11 = (sy1 * width + sx1) * 4;

      const sw00 = (1 - sfx) * (1 - sfy);
      const sw10 = sfx       * (1 - sfy);
      const sw01 = (1 - sfx) * sfy;
      const sw11 = sfx       * sfy;

      const di = (y * width + x) * 4;
      dst[di]   = src[p00]   * sw00 + src[p10]   * sw10 + src[p01]   * sw01 + src[p11]   * sw11;
      dst[di+1] = src[p00+1] * sw00 + src[p10+1] * sw10 + src[p01+1] * sw01 + src[p11+1] * sw11;
      dst[di+2] = src[p00+2] * sw00 + src[p10+2] * sw10 + src[p01+2] * sw01 + src[p11+2] * sw11;
      dst[di+3] = src[p00+3] * sw00 + src[p10+3] * sw10 + src[p01+3] * sw01 + src[p11+3] * sw11;
    }
  }

  self.postMessage({ pixels: dst.buffer }, [dst.buffer]);
};
