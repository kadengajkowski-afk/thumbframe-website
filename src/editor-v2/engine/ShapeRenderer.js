// src/editor-v2/engine/ShapeRenderer.js
// -----------------------------------------------------------------------------
// Purpose:  Build a PixiJS v8 Graphics object for any supported shape
//           type. Handles fill, stroke, gradient fill, gradient stroke,
//           and per-shape geometry (rect with corner radius, polygon with
//           configurable sides, star with inner/outer radius, arrow with
//           head style, line, speech bubble).
// Exports:  buildShapeGraphics(layer) -> Graphics
//           shapeFingerprint(layer) -> string
// Depends:  pixi.js (Graphics, Texture, ImageSource)
//
// Gradients: PixiJS v8 Graphics does not support gradient fills via the
// fill API natively, so we render gradients into an OffscreenCanvas and
// use the resulting Texture as a texture fill. Shape strokes with
// gradients use the same approach.
// -----------------------------------------------------------------------------

import { Graphics, Texture, ImageSource } from 'pixi.js';

/** @typedef {import('./Layer.js').Layer} Layer */
/** @typedef {import('./Layer.js').ShapeData} ShapeData */

/**
 * Gradient descriptor that a shape's `shapeData.fillGradient` or
 * `shapeData.strokeGradient` can carry. Linear or radial with N color
 * stops.
 * @typedef {Object} Gradient
 * @property {'linear'|'radial'} type
 * @property {number} [angle]           - Degrees, CSS convention (0 = top). Linear only.
 * @property {{offset:number,color:string}[]} stops
 */

/**
 * Build or rebuild a Graphics object for the given shape layer. Caller is
 * responsible for adding it to the scene graph and destroying the old
 * instance when shape data changes.
 *
 * @param {Layer} layer
 * @returns {Graphics}
 */
export function buildShapeGraphics(layer) {
  const g = new Graphics();
  const sd = layer.shapeData;
  if (!sd) return g;

  const w = Math.max(1, Math.round(layer.width || 1));
  const h = Math.max(1, Math.round(layer.height || 1));

  switch (sd.shapeType) {
    case 'rect':
    case 'rectangle': drawRect(g, sd, w, h); break;
    case 'circle':    drawCircle(g, sd, w, h); break;
    case 'ellipse':   drawEllipse(g, sd, w, h); break;
    case 'polygon':   drawPolygon(g, sd, w, h); break;
    case 'star':      drawStar(g, sd, w, h); break;
    case 'arrow':     drawArrow(g, sd, w, h); break;
    case 'line':      drawLine(g, sd, w, h); break;
    case 'speechBubble':
    case 'speech-bubble': drawSpeechBubble(g, sd, w, h); break;
    default:          drawRect(g, sd, w, h); break;
  }

  return g;
}

// ── Shape drawers ────────────────────────────────────────────────────────────

/** @param {Graphics} g @param {ShapeData} sd */
function drawRect(g, sd, w, h) {
  const r = Math.max(0, sd.cornerRadius || 0);
  if (r > 0) g.roundRect(0, 0, w, h, Math.min(r, Math.min(w, h) / 2));
  else       g.rect(0, 0, w, h);
  applyFill(g, sd, w, h);
  if (sd.stroke && sd.strokeWidth > 0) {
    if (r > 0) g.roundRect(0, 0, w, h, Math.min(r, Math.min(w, h) / 2));
    else       g.rect(0, 0, w, h);
    applyStroke(g, sd, w, h);
  }
}

function drawCircle(g, sd, w, h) {
  const r = Math.min(w, h) / 2;
  const cx = w / 2, cy = h / 2;
  g.circle(cx, cy, r);
  applyFill(g, sd, w, h);
  if (sd.stroke && sd.strokeWidth > 0) {
    g.circle(cx, cy, r);
    applyStroke(g, sd, w, h);
  }
}

function drawEllipse(g, sd, w, h) {
  const cx = w / 2, cy = h / 2;
  g.ellipse(cx, cy, w / 2, h / 2);
  applyFill(g, sd, w, h);
  if (sd.stroke && sd.strokeWidth > 0) {
    g.ellipse(cx, cy, w / 2, h / 2);
    applyStroke(g, sd, w, h);
  }
}

function drawPolygon(g, sd, w, h) {
  const sides = Math.max(3, sd.sides || 5);
  const cx = w / 2, cy = h / 2;
  const rx = w / 2, ry = h / 2;
  const rot = (sd.rotation || 0) - Math.PI / 2; // start pointing up
  const points = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * Math.PI * 2) / sides;
    points.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  g.poly(points);
  applyFill(g, sd, w, h);
  if (sd.stroke && sd.strokeWidth > 0) {
    g.poly(points);
    applyStroke(g, sd, w, h);
  }
}

function drawStar(g, sd, w, h) {
  const points = Math.max(3, sd.points || 5);
  const innerRatio = typeof sd.innerRadiusRatio === 'number' ? sd.innerRadiusRatio : 0.5;
  const cx = w / 2, cy = h / 2;
  const outerR = Math.min(w, h) / 2;
  const innerR = outerR * Math.max(0.05, Math.min(0.95, innerRatio));
  const rot = -Math.PI / 2;
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.poly(pts);
  applyFill(g, sd, w, h);
  if (sd.stroke && sd.strokeWidth > 0) {
    g.poly(pts);
    applyStroke(g, sd, w, h);
  }
}

function drawLine(g, sd, w, h) {
  const y = h / 2;
  g.moveTo(0, y).lineTo(w, y);
  // Lines don't have fill — stroke only. Default to 2px if unspecified.
  const strokeWidth = Math.max(1, sd.strokeWidth || 2);
  const strokeColor = parseColor(sd.stroke || sd.fill || '#ffffff');
  g.stroke({ color: strokeColor, width: strokeWidth });
}

function drawArrow(g, sd, w, h) {
  // Simple arrow: a shaft spanning most of the width, with a triangular
  // head at the right end. Head style options land in Phase 2; Phase 1.a
  // uses a single filled triangle head.
  const strokeWidth = Math.max(2, sd.strokeWidth || Math.max(2, h * 0.15));
  const headLen = Math.min(w * 0.35, h * 0.6);
  const shaftEndX = Math.max(0, w - headLen);
  const y = h / 2;

  // Shaft
  g.moveTo(0, y).lineTo(shaftEndX, y);
  g.stroke({ color: parseColor(sd.stroke || sd.fill || '#ffffff'), width: strokeWidth });

  // Head (filled triangle)
  g.poly([
    shaftEndX, y - h / 2,
    w, y,
    shaftEndX, y + h / 2,
  ]);
  applyFill(g, sd, w, h, /* fallback */ parseColor(sd.stroke || sd.fill || '#ffffff'));
}

function drawSpeechBubble(g, sd, w, h) {
  // Rounded rectangle body with a triangular tail at the bottom-left.
  const r = Math.max(8, Math.min(w, h) * 0.12);
  const bodyH = h * 0.78;
  const tailX = w * 0.22;
  const tailTopY = bodyH;
  const tailBotY = h;
  const tailTipX = w * 0.12;

  // Body outline
  g.moveTo(r, 0)
    .lineTo(w - r, 0)
    .arcTo(w, 0, w, r, r)
    .lineTo(w, bodyH - r)
    .arcTo(w, bodyH, w - r, bodyH, r)
    .lineTo(tailX + r, bodyH)
    .lineTo(tailX + r, tailTopY)     // tail right edge top
    .lineTo(tailTipX, tailBotY)      // tail tip
    .lineTo(tailX, tailTopY)         // tail left edge top
    .lineTo(r, bodyH)
    .arcTo(0, bodyH, 0, bodyH - r, r)
    .lineTo(0, r)
    .arcTo(0, 0, r, 0, r)
    .closePath();

  applyFill(g, sd, w, h);
  if (sd.stroke && sd.strokeWidth > 0) {
    // Re-draw path for stroke (PixiJS fill/stroke are applied to the
    // current path; closing the path above ensures the same shape
    // receives both).
    g.moveTo(r, 0)
      .lineTo(w - r, 0)
      .arcTo(w, 0, w, r, r)
      .lineTo(w, bodyH - r)
      .arcTo(w, bodyH, w - r, bodyH, r)
      .lineTo(tailX + r, bodyH)
      .lineTo(tailX + r, tailTopY)
      .lineTo(tailTipX, tailBotY)
      .lineTo(tailX, tailTopY)
      .lineTo(r, bodyH)
      .arcTo(0, bodyH, 0, bodyH - r, r)
      .lineTo(0, r)
      .arcTo(0, 0, r, 0, r)
      .closePath();
    applyStroke(g, sd, w, h);
  }
}

// ── Fill + stroke ────────────────────────────────────────────────────────────

/**
 * @param {Graphics} g
 * @param {ShapeData} sd
 * @param {number} w
 * @param {number} h
 * @param {number} [fallback]  Color number to use when fill absent.
 */
function applyFill(g, sd, w, h, fallback) {
  if (sd.fillGradient) {
    const texture = gradientToTexture(sd.fillGradient, w, h);
    g.fill({ texture });
    return;
  }
  if (sd.fill === null || sd.fill === 'none') return; // explicit no-fill
  const color = sd.fill != null ? parseColor(sd.fill) : fallback;
  if (color == null) return;
  g.fill({ color });
}

/**
 * @param {Graphics} g
 * @param {ShapeData} sd
 * @param {number} w
 * @param {number} h
 */
function applyStroke(g, sd, w, h) {
  const width = Math.max(0.5, sd.strokeWidth || 1);
  if (sd.strokeGradient) {
    const texture = gradientToTexture(sd.strokeGradient, w, h);
    g.stroke({ width, texture });
    return;
  }
  const color = parseColor(sd.stroke || '#ffffff');
  g.stroke({ width, color });
}

// ── Gradient → Texture ──────────────────────────────────────────────────────

/**
 * Render a gradient descriptor to an OffscreenCanvas and wrap as Texture.
 * @param {Gradient} gr
 * @param {number} w
 * @param {number} h
 */
function gradientToTexture(gr, w, h) {
  const tw = Math.max(2, Math.min(2048, Math.round(w)));
  const th = Math.max(2, Math.min(2048, Math.round(h)));
  const oc = new OffscreenCanvas(tw, th);
  const ctx = oc.getContext('2d');

  let g;
  if (gr.type === 'radial') {
    g = ctx.createRadialGradient(tw / 2, th / 2, 0, tw / 2, th / 2, Math.max(tw, th) / 2);
  } else {
    const deg = gr.angle ?? 180;
    const rad = (deg - 90) * (Math.PI / 180);
    const len = Math.sqrt(tw * tw + th * th) / 2;
    const cx = tw / 2, cy = th / 2;
    g = ctx.createLinearGradient(
      cx - Math.cos(rad) * len, cy - Math.sin(rad) * len,
      cx + Math.cos(rad) * len, cy + Math.sin(rad) * len,
    );
  }
  for (const stop of (gr.stops || [])) {
    try { g.addColorStop(stop.offset, stop.color); } catch { /* skip invalid */ }
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, tw, th);

  const source  = new ImageSource({ resource: oc });
  return new Texture({ source });
}

/**
 * Parse a CSS color string to a PixiJS color number. Accepts #rgb, #rrggbb,
 * or a named color via a tiny lookup (just the ones we actually use).
 * @param {string|number} input
 */
function parseColor(input) {
  if (typeof input === 'number') return input;
  if (typeof input !== 'string') return 0xffffff;
  const s = input.trim().toLowerCase();
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 6) return parseInt(hex, 16);
    if (hex.length === 8) return parseInt(hex.slice(0, 6), 16); // drop alpha
  }
  // Minimal named-color table — expand as needed.
  const named = /** @type {Record<string, number>} */ ({
    white: 0xffffff, black: 0x000000,
    red:   0xff0000, green: 0x00ff00, blue: 0x0000ff,
    yellow: 0xffff00, cyan: 0x00ffff, magenta: 0xff00ff,
    transparent: 0x000000,
  });
  return named[s] ?? 0xffffff;
}

// ── Fingerprint ──────────────────────────────────────────────────────────────

/**
 * Stable string fingerprint for a shape layer. The renderer recreates
 * the Graphics object whenever this string changes.
 *
 * @param {Layer} layer
 */
export function shapeFingerprint(layer) {
  const sd = layer.shapeData;
  if (!sd) return 'shape:empty';
  const fg = sd.fillGradient
    ? `fg:${sd.fillGradient.type}:${sd.fillGradient.angle ?? ''}:${(sd.fillGradient.stops || []).map(s => s.offset + ':' + s.color).join('|')}`
    : `f:${sd.fill ?? ''}`;
  const sg = sd.strokeGradient
    ? `sg:${sd.strokeGradient.type}:${sd.strokeGradient.angle ?? ''}:${(sd.strokeGradient.stops || []).map(s => s.offset + ':' + s.color).join('|')}`
    : `s:${sd.stroke ?? ''}:${sd.strokeWidth ?? 0}`;
  return [
    'shape',
    sd.shapeType || '',
    layer.width || 0,
    layer.height || 0,
    fg, sg,
    sd.cornerRadius || 0,
    sd.sides || 0,
    sd.points || 0,
    sd.innerRadiusRatio ?? '',
    sd.rotation || 0,
  ].join('|');
}
