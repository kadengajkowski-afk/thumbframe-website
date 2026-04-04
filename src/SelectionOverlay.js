import React, { useRef, useEffect, useCallback } from 'react';
import { drawMarchingAnts } from './selectionUtils';

/**
 * SelectionOverlay — renders marching ants animation over the canvas.
 * Props:
 *   maskRef  — React ref containing current Uint8Array mask (null if no selection)
 *   W, H     — canvas dimensions
 *   active   — boolean, whether a selection is active
 */
function SelectionOverlay({ maskRef, W, H, active }) {
  const canvasRef = useRef(null);
  const dashRef = useRef(0);
  const intervalRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    if (maskRef.current) {
      drawMarchingAnts(ctx, maskRef.current, W, H, dashRef.current);
    }
  }, [maskRef, W, H]);

  const startAnimation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    draw(); // immediate first draw
    intervalRef.current = setInterval(() => {
      dashRef.current = (dashRef.current + 1) % 24;
      draw();
    }, 125);
  }, [draw]);

  const stopAnimation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, W, H);
    }
  }, [W, H]);

  useEffect(() => {
    if (active) {
      startAnimation();
    } else {
      stopAnimation();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, startAnimation, stopAnimation]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        width: W,
        height: H,
      }}
    />
  );
}

export default SelectionOverlay;
