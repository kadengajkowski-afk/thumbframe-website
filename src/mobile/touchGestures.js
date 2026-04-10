// src/mobile/touchGestures.js

export const GESTURE = {
  NONE: 0,
  TAP: 1,
  DRAG: 2,
  PINCH: 3,
  PAN: 4,
};

export function getTouchDistance(t1, t2) {
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getTouchMidpoint(t1, t2) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}
