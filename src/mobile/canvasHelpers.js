export function getSafeDPR() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function getSafeCanvasSize(cssWidth, cssHeight) {
  const MAX_PIXELS = isIOS() ? 12000000 : 16777216;
  const dpr = getSafeDPR();
  let width = Math.round(cssWidth * dpr);
  let height = Math.round(cssHeight * dpr);
  if (width * height > MAX_PIXELS) {
    const scale = Math.sqrt(MAX_PIXELS / (width * height));
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
  }
  return { width, height, dpr };
}

export function releaseCanvas(canvas) {
  if (!canvas) return;
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, 1, 1);
}

export function getCanvasDisplaySize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight - 48 - 60; // minus top bar and bottom bar
  const aspect = 1280 / 720;
  let w = vw - 16;
  let h = w / aspect;
  if (h > vh - 16) { h = vh - 16; w = h * aspect; }
  return { w: Math.round(w), h: Math.round(h) };
}
