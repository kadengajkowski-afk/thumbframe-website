/* eslint-disable no-restricted-globals */
/**
 * Warp Worker — applies a displacement mesh to ImageData.
 * Receives: { pixels, width, height, mesh, meshW, meshH }
 *   mesh: Float32Array of [x0,y0, x1,y1, ...] per grid point (meshW * meshH * 2 floats)
 *   meshW/meshH: number of grid columns/rows
 * Returns: { processedPixels: ArrayBuffer }
 */
self.onmessage = (e) => {
  const { pixels, width, height, mesh, meshW, meshH } = e.data;
  const src = new Uint8ClampedArray(pixels);
  const dst = new Uint8ClampedArray(src.length);
  const meshArr = new Float32Array(mesh);

  const W = width, H = height;
  const cellW = W / (meshW - 1);
  const cellH = H / (meshH - 1);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Find grid cell
      const gx = Math.min(x / cellW, meshW - 2);
      const gy = Math.min(y / cellH, meshH - 2);
      const gxi = Math.floor(gx), gyi = Math.floor(gy);
      const tx = gx - gxi, ty = gy - gyi;

      // Bilinear interpolation of mesh displacements
      const idx = (r, c) => (r * meshW + c) * 2;
      const tlx = meshArr[idx(gyi, gxi)],   tly = meshArr[idx(gyi, gxi)+1];
      const trx = meshArr[idx(gyi, gxi+1)], try_ = meshArr[idx(gyi, gxi+1)+1];
      const blx = meshArr[idx(gyi+1, gxi)], bly = meshArr[idx(gyi+1, gxi)+1];
      const brx = meshArr[idx(gyi+1, gxi+1)], bry = meshArr[idx(gyi+1, gxi+1)+1];

      const sx = tlx*(1-tx)*(1-ty) + trx*tx*(1-ty) + blx*(1-tx)*ty + brx*tx*ty;
      const sy = tly*(1-tx)*(1-ty) + try_*tx*(1-ty) + bly*(1-tx)*ty + bry*tx*ty;

      // Sample source at (sx, sy)
      const sx2 = Math.max(0, Math.min(W-1, sx));
      const sy2 = Math.max(0, Math.min(H-1, sy));
      const sx0 = Math.floor(sx2), sy0 = Math.floor(sy2);
      const fx = sx2-sx0, fy = sy2-sy0;
      const sx1 = Math.min(sx0+1, W-1), sy1 = Math.min(sy0+1, H-1);

      for (let c = 0; c < 4; c++) {
        const tl = src[(sy0*W+sx0)*4+c], tr = src[(sy0*W+sx1)*4+c];
        const bl = src[(sy1*W+sx0)*4+c], br = src[(sy1*W+sx1)*4+c];
        dst[(y*W+x)*4+c] = tl*(1-fx)*(1-fy)+tr*fx*(1-fy)+bl*(1-fx)*fy+br*fx*fy;
      }
    }
  }

  self.postMessage({ processedPixels: dst.buffer }, [dst.buffer]);
};
