// src/editor/utils/textRenderer.js
// Renders text to an offscreen canvas at 2x resolution for GPU crispness.
// Returns { canvas, displayWidth, displayHeight } — canvas is a regular
// HTMLCanvasElement that can be used with PixiJS ImageSource.
//
// Effects order: shadow → glow → stroke → fill
// This file has zero PixiJS dependencies — pure Canvas 2D API.

const SCALE = 2; // 2x supersample for crisp text at zoom

export function renderTextToCanvas(textData) {
  const fontSize = textData.fontSize * SCALE;

  // ── Measure text to determine canvas size ─────────────────────────────────
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  mCtx.font = `${textData.fontWeight} ${fontSize}px ${textData.fontFamily}`;

  const lines = (textData.content || '').split('\n');
  const lineHeight = fontSize * (textData.lineHeight || 1.2);

  const lineWidths = lines.map(l => mCtx.measureText(l).width);
  const maxWidth = Math.max(...lineWidths, 1);

  // Padding so effects don't clip
  const strokePad = textData.stroke?.enabled
    ? (textData.stroke.width * SCALE * 2)
    : 0;
  const shadowPad = textData.shadow?.enabled
    ? (Math.max(Math.abs(textData.shadow.offsetX || 0), Math.abs(textData.shadow.offsetY || 0)) * SCALE +
       (textData.shadow.blur || 0) * SCALE)
    : 0;
  const glowPad = textData.glow?.enabled
    ? ((textData.glow.blur || 0) * SCALE * 2)
    : 0;
  const pad = Math.max(strokePad, shadowPad, glowPad) + 24;

  const canvasW = Math.ceil(maxWidth + pad * 2);
  const canvasH = Math.ceil(lineHeight * lines.length + pad * 2);

  // ── Draw ──────────────────────────────────────────────────────────────────
  const offscreen = document.createElement('canvas');
  offscreen.width  = Math.max(canvasW, 1);
  offscreen.height = Math.max(canvasH, 1);
  const ctx = offscreen.getContext('2d');

  ctx.font         = `${textData.fontWeight} ${fontSize}px ${textData.fontFamily}`;
  ctx.textBaseline = 'top';

  lines.forEach((line, i) => {
    const y = pad + i * lineHeight;
    let x = pad;
    const align = textData.align || 'left';
    if (align === 'center') x = canvasW / 2;
    if (align === 'right')  x = canvasW - pad;
    ctx.textAlign = align;

    // 1. DROP SHADOW
    if (textData.shadow?.enabled) {
      ctx.save();
      ctx.shadowColor   = textData.shadow.color   || '#000000';
      ctx.shadowBlur    = (textData.shadow.blur    || 0) * SCALE;
      ctx.shadowOffsetX = (textData.shadow.offsetX || 0) * SCALE;
      ctx.shadowOffsetY = (textData.shadow.offsetY || 0) * SCALE;
      ctx.globalAlpha   = textData.shadow.opacity  ?? 0.8;
      ctx.fillStyle     = textData.shadow.color    || '#000000';
      ctx.fillText(line, x, y);
      ctx.restore();
    }

    // 2. OUTER GLOW
    if (textData.glow?.enabled) {
      ctx.save();
      ctx.shadowColor   = textData.glow.color  || '#f97316';
      ctx.shadowBlur    = (textData.glow.blur  || 12) * SCALE;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.globalAlpha   = textData.glow.opacity ?? 0.8;
      const passes = textData.glow.strength || 3;
      for (let g = 0; g < passes; g++) {
        ctx.fillStyle = textData.glow.color || '#f97316';
        ctx.fillText(line, x, y);
      }
      ctx.restore();
    }

    // 3. STROKE (behind fill so fill sits on top)
    if (textData.stroke?.enabled && (textData.stroke.width || 0) > 0) {
      ctx.save();
      ctx.strokeStyle = textData.stroke.color || '#000000';
      ctx.lineWidth   = textData.stroke.width * SCALE;
      ctx.lineJoin    = 'round';
      ctx.miterLimit  = 2;
      ctx.globalAlpha = 1;
      ctx.strokeText(line, x, y);
      ctx.restore();
    }

    // 4. FILL
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle   = textData.fill || '#FFFFFF';
    ctx.fillText(line, x, y);
    ctx.restore();
  });

  return {
    canvas:       offscreen,
    displayWidth:  canvasW / SCALE,   // size in world-space canvas pixels (1x)
    displayHeight: canvasH / SCALE,
  };
}

// ── Font loader ───────────────────────────────────────────────────────────────
// Injects a Google Fonts stylesheet and waits for the font to be ready.
// Returns true on success, false on timeout.
export async function loadFont(family) {
  // Already available (system font or previously loaded)
  if (document.fonts.check(`bold 48px "${family}"`)) return true;

  try {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700;900&display=swap`;
    document.head.appendChild(link);

    await Promise.race([
      document.fonts.load(`bold 48px "${family}"`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      ),
    ]);
    return true;
  } catch (e) {
    console.warn(`[textRenderer] Font "${family}" failed to load:`, e);
    return false;
  }
}

// ── Default text layer data ───────────────────────────────────────────────────
export const DEFAULT_TEXT_DATA = {
  content:       'Type here',
  fontFamily:    'Impact',
  fontSize:      96,
  fontWeight:    '900',
  fill:          '#FFFFFF',
  align:         'center',
  lineHeight:    1.2,
  letterSpacing: 0,
  stroke: {
    enabled: true,
    color:   '#000000',
    width:   4,
  },
  shadow: {
    enabled:  true,
    color:    '#000000',
    blur:     8,
    offsetX:  3,
    offsetY:  3,
    opacity:  0.8,
  },
  glow: {
    enabled:  false,
    color:    '#f97316',
    blur:     12,
    strength: 3,
    opacity:  0.8,
  },
};
