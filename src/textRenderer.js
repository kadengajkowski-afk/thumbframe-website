/**
 * textRenderer.js — opentype.js-powered text renderer for ThumbFrame canvas export.
 *
 * Architecture:
 *  - loadOtFont(family, weight): fetches font binary from Google Fonts, parses with opentype
 *  - renderTextLayer(ctx, obj, scaleX, scaleY, fallback): main async renderer
 *    • Uses opentype paths for: gradient fill, precise letter spacing, multiple strokes
 *    • Falls back to drawProText (existing system) if font cannot be loaded
 *  - applyTextTransform(text, transform): uppercase / lowercase / capitalize
 *
 * The live canvas preview (DOM) still uses CSS — opentype is only used during export.
 */

import opentype from 'opentype.js';

// ── Hex to RGB ────────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function hexToRgba(hex, alpha = 1) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Font cache ────────────────────────────────────────────────────────────────
const fontCache    = new Map(); // key → Font | null (resolved)
const fontPromises = new Map(); // key → Promise<Font | null> (in-flight)

// Google Fonts gstatic CDN is CORS-enabled (Access-Control-Allow-Origin: *).
// We fetch the CSS2 API to discover the binary URL, then load the ArrayBuffer.
async function resolveFontBinaryUrl(family, weight) {
  const encoded = family.replace(/ /g, '+');
  // Request CSS2 — returns woff2 in browsers. opentype 1.3.4 can parse woff2 via its
  // bundled inflate; fall through to woff or ttf if woff2 fails.
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encoded}:wght@${weight}&display=swap`;
  try {
    const res = await fetch(cssUrl);
    const css = await res.text();
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1].replace(/['"]/g, ''));
    // Prefer formats opentype.js handles well
    return (
      urls.find(u => /\.(ttf|otf)(\?|$)/i.test(u)) ||
      urls.find(u => /\.woff(\?|$)/i.test(u) && !/woff2/i.test(u)) ||
      urls.find(u => /\.woff2(\?|$)/i.test(u)) ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Load a font via opentype.js.
 * Returns the Font object or null (on failure / CORS / format mismatch).
 */
export async function loadOtFont(family, weight = 700) {
  const key = `${family}:${weight}`;
  if (fontCache.has(key)) return fontCache.get(key);
  if (fontPromises.has(key)) return fontPromises.get(key);

  const promise = (async () => {
    try {
      const url = await resolveFontBinaryUrl(family, weight);
      if (!url) { fontCache.set(key, null); return null; }

      const buf = await fetch(url).then(r => r.arrayBuffer());
      const font = opentype.parse(buf);
      fontCache.set(key, font);
      return font;
    } catch (e) {
      console.warn(`[textRenderer] Cannot load ${key}:`, e.message || e);
      fontCache.set(key, null);
      return null;
    }
  })();

  fontPromises.set(key, promise);
  return promise;
}

// ── Text transform ────────────────────────────────────────────────────────────
export function applyTextTransform(text, transform) {
  if (!text) return '';
  switch (transform) {
    case 'uppercase':   return text.toUpperCase();
    case 'lowercase':   return text.toLowerCase();
    case 'capitalize':  return text.replace(/\b\w/g, c => c.toUpperCase());
    default:            return text;
  }
}

// ── Build a canvas linear gradient for text ───────────────────────────────────
function buildTextGradient(ctx, x, y, w, h, colors, angleDeg = 0) {
  if (!colors || colors.length < 2) return null;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const len = Math.abs(w * cos) + Math.abs(h * sin);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const grad = ctx.createLinearGradient(
    cx - (cos * len) / 2, cy - (sin * len) / 2,
    cx + (cos * len) / 2, cy + (sin * len) / 2,
  );
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
  return grad;
}

// ── Render one line using opentype paths ──────────────────────────────────────
function renderLineOt(ctx, font, lineText, x, y, fs, opts) {
  const {
    fill = '#ffffff',
    gradient = null,
    strokeWidth = 0,
    stroke = '#000000',
    textStrokes = [],      // [{enabled,color,width}]
    glowColor = null,
    glowBlur = 0,
    shadowColor = null,
    shadowBlur = 0,
    shadowX = 0,
    shadowY = 0,
    letterSpacingPx = 0,  // px at export scale
  } = opts;

  // opentype letterSpacing is a fraction of EM
  const lsFrac = letterSpacingPx / fs;
  const path  = font.getPath(lineText, 0, 0, fs, { kerning: true, letterSpacing: lsFrac });
  const p2d   = new Path2D(path.toPathData(2));

  ctx.save();
  ctx.translate(x, y);

  // Pass 1: Drop shadow
  if (shadowColor && shadowBlur > 0) {
    ctx.save();
    ctx.shadowColor   = shadowColor;
    ctx.shadowBlur    = shadowBlur;
    ctx.shadowOffsetX = shadowX;
    ctx.shadowOffsetY = shadowY;
    ctx.fillStyle     = gradient || fill;
    ctx.fill(p2d);
    ctx.restore();
  }

  // Pass 2: Glow (3-pass multi-blur)
  if (glowColor && glowBlur > 0) {
    for (let pass = 0; pass < 3; pass++) {
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur  = glowBlur * (pass + 1) / 3;
      ctx.fillStyle   = glowColor;
      ctx.fill(p2d);
      ctx.restore();
    }
  }

  // Pass 3: All stroke passes (widest first so narrower strokes layer on top)
  const allStrokes = [];
  // Extra textStrokes (outermost first = widest width)
  for (const st of [...textStrokes].sort((a, b) => (b.width || 0) - (a.width || 0))) {
    if (st.enabled && st.width > 0) allStrokes.push(st);
  }
  // Primary stroke
  if (strokeWidth > 0) allStrokes.push({ color: stroke, width: strokeWidth });

  for (const st of allStrokes) {
    ctx.save();
    ctx.strokeStyle = st.color || stroke;
    ctx.lineWidth   = st.width * 2; // half on each side
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.stroke(p2d);
    ctx.restore();
  }

  // Pass 4: Clean fill
  ctx.fillStyle = gradient || fill;
  ctx.fill(p2d);

  ctx.restore();
}

// ── Measure a line width with opentype ───────────────────────────────────────
function measureLineOt(font, text, fs, lsFrac) {
  return font.getAdvanceWidth(text, fs, { kerning: true, letterSpacing: lsFrac });
}

// ── Main render entry point ───────────────────────────────────────────────────
/**
 * Render a ThumbFrame text layer to a canvas 2D context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} obj  — text layer from layers[]
 * @param {number} scaleX
 * @param {number} scaleY
 * @param {function} fallbackDrawProText  — existing drawProText(ctx,text,x,y,opts) function
 */
export async function renderTextLayer(ctx, obj, scaleX, scaleY, fallbackDrawProText) {
  const scale  = Math.min(scaleX, scaleY);
  const rawText = applyTextTransform(obj.text || '', obj.textTransform);
  const lines   = rawText.split('\n');
  const fs      = (obj.fontSize || 48) * scale;
  const lh      = (obj.lineHeight || 1.2) * fs;
  const lsPx    = (obj.letterSpacing || 0) * scale;

  // Attempt to load the opentype font
  const family = (obj.fontFamily || 'Anton').split(',')[0].trim().replace(/['"]/g, '');
  const weight = obj.fontWeight || 700;
  const font   = await loadOtFont(family, weight);

  const gradColors  = Array.isArray(obj.gradientColors) && obj.gradientColors.length >= 2
    ? obj.gradientColors : null;
  const isGradient  = obj.fillType === 'gradient' && !!gradColors;

  // ── OPENTYPE PATH ─────────────────────────────────────────────────────────
  if (font) {
    const lsFrac = lsPx / fs;

    // Measure total width for gradient and textAlign
    const longestLine = lines.reduce((best, l) =>
      measureLineOt(font, l, fs, lsFrac) > measureLineOt(font, best, fs, lsFrac) ? l : best, lines[0] || '');
    const totalW = measureLineOt(font, longestLine, fs, lsFrac);
    const totalH = lines.length * lh;

    // Build gradient once (spans all lines)
    let grad = null;
    if (isGradient) {
      const gx = obj.textAlign === 'center' ? -totalW / 2
        : obj.textAlign === 'right' ? -totalW : 0;
      grad = buildTextGradient(ctx, gx, 0, totalW, totalH, gradColors, obj.gradientAngle || 0);
    }

    const renderOpts = {
      fill:            obj.textColor || '#ffffff',
      gradient:        grad,
      strokeWidth:     (obj.strokeWidth || 0) * scale,
      stroke:          obj.strokeColor || '#000000',
      textStrokes:     (obj.textStrokes || []).map(st => ({ ...st, width: (st.width || 0) * scale })),
      glowColor:       obj.glowEnabled ? (obj.glowColor || '#f97316') : null,
      glowBlur:        obj.glowEnabled ? 24 * scale : 0,
      shadowColor:     obj.shadowEnabled ? (obj.shadowColor || 'rgba(0,0,0,0.95)') : null,
      shadowBlur:      obj.shadowEnabled ? (obj.shadowBlur || 14) * scale : 0,
      shadowX:         obj.shadowEnabled ? (obj.shadowX || 2) * scale : 0,
      shadowY:         obj.shadowEnabled ? (obj.shadowY || 2) * scale : 0,
      letterSpacingPx: lsPx,
    };

    for (let li = 0; li < lines.length; li++) {
      const lineText = lines[li];
      const lineW    = measureLineOt(font, lineText, fs, lsFrac);
      let lineX = 0;
      if (obj.textAlign === 'center') lineX = -lineW / 2;
      else if (obj.textAlign === 'right') lineX = -lineW;

      renderLineOt(ctx, font, lineText, lineX, fs + li * lh, fs, renderOpts);
    }
    return;
  }

  // ── FALLBACK: canvas fillText via drawProText ─────────────────────────────
  await import('./Editor').catch(() => {}); // no-op, just safety
  const fontStr = `${obj.fontItalic ? 'italic ' : ''}${weight} ${fs}px ${family}`;
  ctx.font = fontStr;

  for (let li = 0; li < lines.length; li++) {
    const lineText = lines[li];
    const lineW    = ctx.measureText(lineText).width;
    let lineX = 0;
    if (obj.textAlign === 'center') lineX = -lineW / 2;
    else if (obj.textAlign === 'right') lineX = -lineW;

    // Build gradient fillStyle for fallback
    let gradStyle = obj.textColor || '#ffffff';
    if (isGradient) {
      gradStyle = buildTextGradient(ctx, lineX, 0, lineW, lh, gradColors, obj.gradientAngle || 0) || gradStyle;
    }

    fallbackDrawProText(ctx, lineText, lineX, fs + li * lh, {
      fill:        gradStyle,
      stroke:      obj.strokeColor || '#000000',
      strokeWidth: (obj.strokeWidth || 0) * scale,
      glowColor:   obj.glowEnabled ? (obj.glowColor || '#f97316') : null,
      glowBlur:    obj.glowEnabled ? 24 * scale : 0,
      shadowColor: obj.shadowEnabled ? (obj.shadowColor || 'rgba(0,0,0,0.95)') : null,
      shadowBlur:  obj.shadowEnabled ? (obj.shadowBlur || 14) * scale : 0,
      shadowX:     obj.shadowEnabled ? (obj.shadowX || 2) * scale : 0,
      shadowY:     obj.shadowEnabled ? (obj.shadowY || 2) * scale : 0,
    });
  }
}
