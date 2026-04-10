export function getTouchDistance(t1, t2) {
  return Math.sqrt((t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2);
}

export function getTouchMidpoint(t1, t2) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

// Gesture state machine
export const GESTURE = {
  NONE: 'none',
  TAP: 'tap',
  DRAG: 'drag',
  PINCH: 'pinch',
};

export function resolveGesture(touchCount, moveDistance, duration) {
  if (touchCount >= 2) return GESTURE.PINCH;
  if (moveDistance > 8) return GESTURE.DRAG;
  if (duration < 300 && moveDistance < 8) return GESTURE.TAP;
  return GESTURE.NONE;
}
