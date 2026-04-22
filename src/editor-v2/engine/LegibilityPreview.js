// src/editor-v2/engine/LegibilityPreview.js
// -----------------------------------------------------------------------------
// Purpose:  Render a text layer at 180px width (the YouTube postage-stamp
//           minimum) and return a contrast + warning summary so the
//           contextual panel (Phase 4.c) can flag unreadable text before
//           the creator publishes.
// Exports:  buildLegibilityPreview, averageBackgroundColor
// Depends:  ./Contrast
//
// Contract:
//   • buildLegibilityPreview(layer, { bgColor, targetWidth?, targetHeight? })
//     → { canvas, contrast, ratio, warnings: string[] }
//   • averageBackgroundColor(ctx, rect) reads back ImageData in a
//     sub-region and returns the mean #rrggbb color.
//
// Phase 2.c scope: the data structures + math. The contextual panel
// that renders the preview visually is Phase 4.c.
// -----------------------------------------------------------------------------

import { wcagContrast, WCAG_AA_LARGE, WCAG_AA } from './Contrast.js';

const POSTAGE_STAMP_WIDTH  = 180;
const POSTAGE_STAMP_HEIGHT = Math.round(180 * (9 / 16));

/**
 * Render a text layer to a 180px-wide offscreen canvas and return a
 * legibility summary.
 *
 * @param {any} textLayer               A Phase 2.a text layer
 * @param {{
 *   bgColor: string,                   background color the text sits on
 *   targetWidth?: number,
 *   targetHeight?: number,
 * }} opts
 */
export function buildLegibilityPreview(textLayer, opts) {
  if (!textLayer || textLayer.type !== 'text') return null;
  const W = Math.round(opts.targetWidth  || POSTAGE_STAMP_WIDTH);
  const H = Math.round(opts.targetHeight || POSTAGE_STAMP_HEIGHT);

  const canvas = _newCanvas(W, H);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Paint background + the text sample so the panel can diff against it.
    ctx.fillStyle = opts.bgColor || '#000000';
    ctx.fillRect(0, 0, W, H);

    const td = textLayer.textData || {};
    const scale = W / (textLayer.width || W);
    const fontSize = Math.max(8, (td.fontSize || 24) * scale);
    ctx.fillStyle = td.fill || '#ffffff';
    ctx.font = `${td.fontWeight || '700'} ${fontSize}px ${td.fontFamily || 'system-ui'}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = td.align || 'center';
    const tx = td.align === 'left'  ? 6
             : td.align === 'right' ? W - 6
             : W / 2;
    ctx.fillText(td.content || '', tx, H / 2, W - 12);
  }

  const contrast = wcagContrast(textLayer.textData?.fill || '#ffffff', opts.bgColor || '#000000');
  const warnings = [];
  const isLargeText = (textLayer.textData?.fontSize || 24) >= 24
    || ((textLayer.textData?.fontSize || 24) >= 19 && /^[7-9]00$/.test(textLayer.textData?.fontWeight || ''));
  if (contrast) {
    const threshold = isLargeText ? WCAG_AA_LARGE : WCAG_AA;
    if (contrast.ratio < threshold) {
      warnings.push(`contrast ${contrast.ratio} below WCAG AA (${threshold} required)`);
    }
    if (contrast.ratio < 2) {
      warnings.push('severely low contrast — likely unreadable at postage-stamp size');
    }
  } else {
    warnings.push('could not parse fg/bg colors');
  }
  if ((textLayer.textData?.fontSize || 24) < 18) {
    warnings.push('font size below 18px reads poorly when downscaled to 180px');
  }

  return {
    canvas,
    contrast,
    ratio:    contrast?.ratio ?? null,
    wcagAA:   !!contrast?.AA,
    wcagAAA:  !!contrast?.AAA,
    isLargeText,
    warnings,
  };
}

/**
 * Read back the mean RGB value of a rect on a canvas. Returns '#rrggbb'
 * in normalised hex. Falls back to '#000000' when getImageData is not
 * available (jsdom).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number,width:number,height:number}} rect
 */
export function averageBackgroundColor(ctx, rect) {
  if (!ctx || typeof ctx.getImageData !== 'function') return '#000000';
  try {
    const img = ctx.getImageData(rect.x | 0, rect.y | 0, Math.max(1, rect.width | 0), Math.max(1, rect.height | 0));
    const data = img.data;
    if (!data || data.length === 0) return '#000000';
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    if (n === 0) return '#000000';
    const avg = (c) => Math.round(c / n).toString(16).padStart(2, '0');
    return `#${avg(r)}${avg(g)}${avg(b)}`;
  } catch {
    return '#000000';
  }
}

function _newCanvas(w, h) {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  // Node fallback — minimal stub so tests don't explode when run without jsdom.
  return { width: w, height: h, getContext: () => null };
}
