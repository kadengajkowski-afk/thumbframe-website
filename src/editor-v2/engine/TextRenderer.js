// src/editor-v2/engine/TextRenderer.js
// -----------------------------------------------------------------------------
// Purpose:  Basic text-to-texture pipeline for Phase 1.a. Canvas 2D draws
//           the text, the result is wrapped in an OffscreenCanvas and
//           converted to a PixiJS v8 Texture via ImageSource. Renders at
//           2× CSS resolution so thumbnail exports stay crisp.
// Exports:  renderText(textData) -> { texture, width, height }
//           measureText(textData) -> { width, height }
// Depends:  pixi.js (Texture, ImageSource)
//
// Scope: Phase 1.a is deliberately basic — font family/size/weight, fill
// color, align, multi-line wrapping via explicit \n. No stroke, glow,
// shadow, warp, or text-on-path. That's Phase 2.
// -----------------------------------------------------------------------------

import { Texture, ImageSource } from 'pixi.js';

const SUPERSAMPLE = 2;
const MIN_WIDTH_PX = 16;
const MIN_HEIGHT_PX = 16;

/**
 * @typedef {import('./Layer.js').TextData} TextData
 */

/**
 * Split content on explicit newlines. Phase 1.a does not wrap — the
 * caller specifies a fixed width via layer.width and anything longer
 * just overflows. Word-wrap belongs in Phase 2 with the full text
 * system.
 *
 * @param {string} content
 */
function splitLines(content) {
  if (!content) return [''];
  return String(content).split(/\r\n|\r|\n/);
}

/**
 * Build a Canvas 2D font string from TextData.
 * @param {TextData} td
 * @param {number} pxSize  Supersampled pixel size.
 */
function buildFontString(td, pxSize) {
  const weight = td.fontWeight || '400';
  const family = td.fontFamily || 'Inter, sans-serif';
  return `${weight} ${pxSize}px "${family}"`;
}

/**
 * Measure the rendered size of text at 1× resolution. Used by layer
 * factory / editing UI to choose sensible default dimensions.
 *
 * @param {TextData} td
 * @returns {{ width: number, height: number, lineHeights: number[] }}
 */
export function measureText(td) {
  const fontSize = Math.max(8, td.fontSize || 48);
  const lines = splitLines(td.content || '');
  const lineHeight = (td.lineHeight || 1.2) * fontSize;

  // Use a shared OffscreenCanvas for measurement to avoid cost per call.
  const oc = new OffscreenCanvas(32, 32);
  const ctx = oc.getContext('2d');
  ctx.font = buildFontString(td, fontSize);
  ctx.textBaseline = 'alphabetic';

  let maxW = 0;
  const lineHeights = [];
  for (const line of lines) {
    const m = ctx.measureText(line);
    const w = Math.ceil(m.width + (td.letterSpacing || 0) * Math.max(0, line.length - 1));
    if (w > maxW) maxW = w;
    lineHeights.push(lineHeight);
  }
  const height = Math.max(MIN_HEIGHT_PX, Math.ceil(lineHeight * lines.length));
  const width  = Math.max(MIN_WIDTH_PX,  maxW);
  return { width, height, lineHeights };
}

/**
 * Render TextData to a PixiJS Texture. The texture resolution is
 * SUPERSAMPLE× the display size, so a 48px text with width 320 produces
 * a 640×{2×lineHeight} canvas.
 *
 * @param {TextData} td
 * @param {{ width?: number, height?: number }} [layout]  Optional explicit display dims.
 * @returns {{ texture: import('pixi.js').Texture, width: number, height: number, source: OffscreenCanvas }}
 */
export function renderText(td, layout) {
  const measure = measureText(td);
  const displayW = Math.max(MIN_WIDTH_PX,  Math.ceil(layout?.width  ?? measure.width));
  const displayH = Math.max(MIN_HEIGHT_PX, Math.ceil(layout?.height ?? measure.height));

  const canvasW = displayW * SUPERSAMPLE;
  const canvasH = displayH * SUPERSAMPLE;

  const oc = new OffscreenCanvas(canvasW, canvasH);
  const ctx = oc.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const fontSizeScaled = Math.max(8, (td.fontSize || 48)) * SUPERSAMPLE;
  const lineHeightScaled = (td.lineHeight || 1.2) * fontSizeScaled;

  ctx.font         = buildFontString(td, fontSizeScaled);
  ctx.fillStyle    = td.fill || '#ffffff';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign    = (td.align === 'left' || td.align === 'right' || td.align === 'center')
    ? td.align
    : 'center';

  const letterSpacingScaled = (td.letterSpacing || 0) * SUPERSAMPLE;
  const lines = splitLines(td.content || '');

  // Choose anchor x based on alignment.
  let anchorX;
  if (ctx.textAlign === 'left')   anchorX = 0;
  else if (ctx.textAlign === 'right') anchorX = canvasW;
  else                             anchorX = canvasW / 2;

  // Vertical center the block.
  const totalH = lineHeightScaled * lines.length;
  const topY   = (canvasH - totalH) / 2;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Baseline of this line — position the alphabetic baseline near the
    // bottom of its slot so ascenders have room.
    const baselineY = topY + (i + 1) * lineHeightScaled - (lineHeightScaled * 0.25);
    if (letterSpacingScaled > 0.01) {
      // Per-glyph placement to honor letter-spacing.
      const widths = [];
      let total = 0;
      for (const ch of line) {
        const w = ctx.measureText(ch).width;
        widths.push(w);
        total += w;
      }
      total += letterSpacingScaled * Math.max(0, line.length - 1);
      let x;
      if (ctx.textAlign === 'left')   x = 0;
      else if (ctx.textAlign === 'right') x = canvasW - total;
      else                                x = (canvasW - total) / 2;
      ctx.textAlign = 'left';  // we've computed positions already
      for (let j = 0; j < line.length; j++) {
        ctx.fillText(line[j], x, baselineY);
        x += widths[j] + letterSpacingScaled;
      }
      // Restore for next line.
      ctx.textAlign = (td.align === 'left' || td.align === 'right') ? td.align : 'center';
    } else {
      ctx.fillText(line, anchorX, baselineY);
    }
  }

  const source  = new ImageSource({ resource: oc });
  const texture = new Texture({ source });
  return { texture, width: displayW, height: displayH, source: oc };
}

/**
 * Fingerprint string — when any field changes, the renderer's reconciler
 * recreates the Texture. Keep this in sync with the fields renderText()
 * actually reads.
 *
 * @param {TextData|null|undefined} td
 * @param {{ width?: number, height?: number }} [layout]
 */
export function textFingerprint(td, layout) {
  if (!td) return 'text:empty';
  return [
    'text',
    td.content || '',
    td.fontFamily || '',
    td.fontSize || 0,
    td.fontWeight || '',
    td.fill || '',
    td.align || '',
    td.lineHeight || 0,
    td.letterSpacing || 0,
    layout?.width || 0,
    layout?.height || 0,
  ].join('|');
}
