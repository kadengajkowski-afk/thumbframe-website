// src/editor-v2/selection/ColorRange.js
// -----------------------------------------------------------------------------
// Purpose:  Color-range selection — pick a hue from the canvas, select
//           every pixel whose hue is within a tolerance. Unlike magic
//           wand's contiguous flood fill, this operates globally.
// Exports:  buildColorRangeMask, rgbToHsl
// Depends:  nothing
// -----------------------------------------------------------------------------

/**
 * @param {{ r:number, g:number, b:number }} rgb
 * @returns {{ h:number, s:number, l:number }}  h in 0..360, s/l in 0..1
 */
export function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if      (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
    else if (max === gn) h = ((bn - rn) / d + 2);
    else                 h = ((rn - gn) / d + 4);
    h *= 60;
  }
  return { h, s, l };
}

/**
 * @param {{ data: Uint8ClampedArray|Uint8Array, width:number, height:number }} imageData
 * @param {{ r:number, g:number, b:number }} target
 * @param {{ hueTolerance?:number, satTolerance?:number, lumTolerance?:number }} [opts]
 * @returns {Uint8ClampedArray}
 */
export function buildColorRangeMask(imageData, target, opts = {}) {
  const W = imageData.width  | 0;
  const H = imageData.height | 0;
  const data = imageData.data;
  const mask = new Uint8ClampedArray(W * H);
  if (!data || data.length < W * H * 4 || !target) return mask;

  const t = rgbToHsl(target);
  const hTol = Math.max(0, opts.hueTolerance ?? 30);   // degrees
  const sTol = Math.max(0, opts.satTolerance ?? 0.35); // 0..1
  const lTol = Math.max(0, opts.lumTolerance ?? 0.35);

  for (let i = 0; i < W * H; i++) {
    const ci = i * 4;
    const p = rgbToHsl({ r: data[ci], g: data[ci + 1], b: data[ci + 2] });
    const dh = _hueDelta(p.h, t.h);
    const ds = Math.abs(p.s - t.s);
    const dl = Math.abs(p.l - t.l);
    if (dh <= hTol && ds <= sTol && dl <= lTol) mask[i] = 255;
  }
  return mask;
}

function _hueDelta(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
