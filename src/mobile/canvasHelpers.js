// src/mobile/canvasHelpers.js

export function getSafeDPR() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function getSafeCanvasSize(width, height) {
  const MAX = isIOS() ? 12000000 : 16777216;
  const pixels = width * height;
  if (pixels <= MAX) return { width, height };
  const scale = Math.sqrt(MAX / pixels);
  return { width: Math.floor(width * scale), height: Math.floor(height * scale) };
}

export function releaseCanvas(canvas) {
  if (!canvas) return;
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, 1, 1);
}
