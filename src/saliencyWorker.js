/* eslint-disable no-restricted-globals */
self.onmessage = (e) => {
  const { pixels, width, height } = e.data;
  const data = new Uint8ClampedArray(pixels);
  const W = width, H = height;

  // Step 1: Grayscale
  const gray = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    gray[i] = 0.299*data[i*4] + 0.587*data[i*4+1] + 0.114*data[i*4+2];
  }

  // Step 2: Sobel edges
  const edges = new Float32Array(W * H);
  for (let y = 1; y < H-1; y++) {
    for (let x = 1; x < W-1; x++) {
      const gx = -gray[(y-1)*W+(x-1)] + gray[(y-1)*W+(x+1)]
                 -2*gray[y*W+(x-1)]   + 2*gray[y*W+(x+1)]
                 -gray[(y+1)*W+(x-1)] + gray[(y+1)*W+(x+1)];
      const gy = -gray[(y-1)*W+(x-1)] - 2*gray[(y-1)*W+x] - gray[(y-1)*W+(x+1)]
                 +gray[(y+1)*W+(x-1)] + 2*gray[(y+1)*W+x] + gray[(y+1)*W+(x+1)];
      edges[y*W+x] = Math.sqrt(gx*gx + gy*gy);
    }
  }

  // Step 3: Gaussian blur (box blur approximation, 3 passes, radius=15)
  const blurred = new Float32Array(W * H);
  const temp = new Float32Array(W * H);
  const r = 15;
  // Horizontal pass
  for (let y = 0; y < H; y++) {
    let sum = 0, cnt = 0;
    for (let x = 0; x < Math.min(r, W); x++) { sum += edges[y*W+x]; cnt++; }
    for (let x = 0; x < W; x++) {
      if (x + r < W) { sum += edges[y*W+x+r]; cnt++; }
      if (x - r - 1 >= 0) { sum -= edges[y*W+x-r-1]; cnt--; }
      temp[y*W+x] = sum / cnt;
    }
  }
  // Vertical pass
  for (let x = 0; x < W; x++) {
    let sum = 0, cnt = 0;
    for (let y = 0; y < Math.min(r, H); y++) { sum += temp[y*W+x]; cnt++; }
    for (let y = 0; y < H; y++) {
      if (y + r < H) { sum += temp[(y+r)*W+x]; cnt++; }
      if (y - r - 1 >= 0) { sum -= temp[(y-r-1)*W+x]; cnt--; }
      blurred[y*W+x] = sum / cnt;
    }
  }

  // Step 4: Center-bias Gaussian
  const cx = W/2, cy = H/2;
  const sx = W*0.4, sy = H*0.4;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x-cx)/sx, dy = (y-cy)/sy;
      const centerBias = Math.exp(-(dx*dx + dy*dy)/2);
      blurred[y*W+x] *= (0.5 + 0.5*centerBias);
    }
  }

  // Step 5: Normalize to 0-1
  let maxV = 0;
  for (let i = 0; i < blurred.length; i++) if (blurred[i] > maxV) maxV = blurred[i];
  if (maxV > 0) for (let i = 0; i < blurred.length; i++) blurred[i] /= maxV;

  self.postMessage({ heatMap: blurred.buffer }, [blurred.buffer]);
};
