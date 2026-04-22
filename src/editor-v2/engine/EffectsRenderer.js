// src/editor-v2/engine/EffectsRenderer.js
// -----------------------------------------------------------------------------
// Purpose:  Normalise a layer's effects array into a rendering plan.
//           For Phase 1.d the plan is a flat list of canvas-2D draw
//           operations consumable by EITHER the Canvas 2D pre-composer
//           (used by text/shape paths) OR the Pixi-filter pipeline
//           (wired incrementally as each effect gets a GPU path).
//
// Exports:  EFFECT_TYPES, defaultEffectParams, buildEffectPlan,
//           composeEffectsOnCanvas
// Depends:  nothing
//
// Why a plan object? Each effect needs to answer the same set of
// questions ("which blend layer does it sit in?", "does it need the
// alpha of the base as a mask?", "what color/blur does it own?"). The
// plan is a transport-independent representation of those answers. Both
// the Canvas 2D composer (below) and the eventual Pixi filter graph
// (Phase 4.c polish) consume the same plan.
// -----------------------------------------------------------------------------

/**
 * @typedef {'stroke'|'outerGlow'|'innerGlow'|'dropShadow'|'innerShadow'
 *          |'bevel'|'colorOverlay'|'gradientOverlay'} EffectType
 */

export const EFFECT_TYPES = Object.freeze(/** @type {EffectType[]} */ ([
  'stroke', 'outerGlow', 'innerGlow',
  'dropShadow', 'innerShadow',
  'bevel', 'colorOverlay', 'gradientOverlay',
]));

/**
 * Canonical defaults for every effect type. The registry's
 * layer.effects.add action merges overrides on top of these.
 *
 * @param {EffectType} type
 */
export function defaultEffectParams(type) {
  switch (type) {
    case 'stroke':
      return {
        color:    '#000000',
        width:    2,
        opacity:  1,
        position: 'outside',  // 'inside' | 'center' | 'outside'
      };
    case 'outerGlow':
      return { color: '#ffffff', blur: 16, spread: 0, opacity: 0.8 };
    case 'innerGlow':
      return { color: '#ffffff', blur: 12, spread: 0, opacity: 0.8 };
    case 'dropShadow':
      return { color: '#000000', blur: 10, offsetX: 4, offsetY: 4, opacity: 0.6 };
    case 'innerShadow':
      return { color: '#000000', blur: 8,  offsetX: 2, offsetY: 2, opacity: 0.6 };
    case 'bevel':
      return {
        highlightColor: '#ffffff',
        shadowColor:    '#000000',
        depth:          4,
        angle:          135,   // degrees; light direction
        softness:       3,
        opacity:        0.7,
      };
    case 'colorOverlay':
      return { color: '#ff4477', opacity: 1, blendMode: 'normal' };
    case 'gradientOverlay':
      return {
        stops: [
          { color: '#ff4477', offset: 0 },
          { color: '#5532ff', offset: 1 },
        ],
        angle:     90,
        opacity:   1,
        blendMode: 'normal',
      };
    default:
      return {};
  }
}

/**
 * Given a layer's effects array, produce an ordered render plan. The
 * plan describes each effect's layer ('behind'|'on'|'infront' relative
 * to the base) and the parameters the compositor needs.
 *
 * @param {Array<{type:EffectType, enabled:boolean, params:object}>} effects
 */
export function buildEffectPlan(effects) {
  const plan = { behind: [], onBase: [], inFront: [] };
  if (!Array.isArray(effects)) return plan;

  for (const fx of effects) {
    if (!fx || fx.enabled === false) continue;
    const entry = { type: fx.type, params: fx.params || {} };
    switch (fx.type) {
      case 'dropShadow':
      case 'outerGlow':
        plan.behind.push(entry); break;
      case 'innerShadow':
      case 'innerGlow':
      case 'colorOverlay':
      case 'gradientOverlay':
      case 'bevel':
        plan.onBase.push(entry); break;
      case 'stroke':
        // 'outside' sits in front; 'inside' sits on base; 'center' straddles.
        if (entry.params.position === 'inside') plan.onBase.push(entry);
        else plan.inFront.push(entry);
        break;
      default:
        plan.onBase.push(entry);
    }
  }
  return plan;
}

/**
 * Compose an effect plan onto a Canvas 2D ctx given the base layer's
 * alpha texture (as a CanvasImageSource — typically a pre-rendered
 * text or shape canvas). This is the Phase 1.d rendering path — a
 * Pixi-filter-based replacement lands in Phase 4 polish after the HSL
 * shaders prove the multi-pass pattern.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} baseSource
 * @param {number} width
 * @param {number} height
 * @param {ReturnType<typeof buildEffectPlan>} plan
 */
export function composeEffectsOnCanvas(ctx, baseSource, width, height, plan) {
  if (!ctx || !baseSource) return;

  // 1. Behind effects (drop shadow, outer glow). Each one renders the
  //    base alpha with a blur + color-replace + optional offset, behind
  //    the final base layer.
  for (const fx of plan.behind) {
    _drawBehindEffect(ctx, baseSource, width, height, fx);
  }

  // 2. The base itself.
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(baseSource, 0, 0, width, height);
  ctx.restore();

  // 3. OnBase effects (inner glow/shadow, color/gradient overlay, bevel).
  //    These are masked to the base alpha by using 'source-atop'.
  for (const fx of plan.onBase) {
    _drawOnBaseEffect(ctx, baseSource, width, height, fx);
  }

  // 4. InFront effects (outside stroke, center stroke).
  for (const fx of plan.inFront) {
    _drawInFrontEffect(ctx, baseSource, width, height, fx);
  }
}

// ── internals ──────────────────────────────────────────────────────────────

function _drawBehindEffect(ctx, base, w, h, fx) {
  ctx.save();
  try {
    if ('filter' in ctx) {
      ctx.filter = `blur(${_num(fx.params.blur, 8)}px)`;
    }
    ctx.globalAlpha = _num(fx.params.opacity, 1);
    if (fx.type === 'dropShadow') {
      ctx.translate(_num(fx.params.offsetX, 0), _num(fx.params.offsetY, 0));
    }
    ctx.drawImage(base, 0, 0, w, h);
    // Colorise: paint the effect color with source-in so only the alpha
    // of the blurred base stays, tinted.
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = fx.params.color || '#000000';
    ctx.fillRect(0, 0, w, h);
  } finally { ctx.restore(); }
}

function _drawOnBaseEffect(ctx, base, w, h, fx) {
  ctx.save();
  try {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = _num(fx.params.opacity, 1);

    if (fx.type === 'colorOverlay') {
      ctx.fillStyle = fx.params.color || '#ff4477';
      ctx.fillRect(0, 0, w, h);
      return;
    }
    if (fx.type === 'gradientOverlay') {
      const grad = _buildLinearGradient(ctx, fx.params, w, h);
      if (grad) { ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h); }
      return;
    }
    if (fx.type === 'innerShadow' || fx.type === 'innerGlow') {
      if ('filter' in ctx) ctx.filter = `blur(${_num(fx.params.blur, 8)}px)`;
      ctx.translate(
        _num(fx.params.offsetX, 0),
        _num(fx.params.offsetY, 0),
      );
      ctx.drawImage(base, 0, 0, w, h);
      // Colorise
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = fx.params.color || '#000000';
      ctx.fillRect(0, 0, w, h);
      return;
    }
    if (fx.type === 'bevel') {
      const angle    = (_num(fx.params.angle, 135) * Math.PI) / 180;
      const depth    = _num(fx.params.depth, 4);
      const dx = Math.cos(angle) * depth;
      const dy = Math.sin(angle) * depth;

      if ('filter' in ctx) ctx.filter = `blur(${_num(fx.params.softness, 2)}px)`;
      // highlight
      ctx.translate(-dx, -dy);
      ctx.drawImage(base, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = fx.params.highlightColor || '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore(); ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = _num(fx.params.opacity, 0.7);
      if ('filter' in ctx) ctx.filter = `blur(${_num(fx.params.softness, 2)}px)`;
      ctx.translate(dx, dy);
      ctx.drawImage(base, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = fx.params.shadowColor || '#000000';
      ctx.fillRect(0, 0, w, h);
      return;
    }
    if (fx.type === 'stroke' && fx.params.position === 'inside') {
      // Inside stroke: draw the base, then overlay a solid fill with
      // source-atop so only the outline (alpha edge) shows through.
      // A perceptually-correct inside stroke needs edge detection
      // and falls into the 1.f polish pass.
      ctx.globalCompositeOperation = 'source-atop';
      ctx.strokeStyle = fx.params.color || '#000000';
      ctx.lineWidth   = _num(fx.params.width, 2);
      ctx.strokeRect(0, 0, w, h);
    }
  } finally { ctx.restore(); }
}

function _drawInFrontEffect(ctx, base, w, h, fx) {
  if (fx.type !== 'stroke') return;
  ctx.save();
  try {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = _num(fx.params.opacity, 1);
    ctx.strokeStyle = fx.params.color || '#000000';
    ctx.lineWidth   = _num(fx.params.width, 2);
    ctx.strokeRect(0, 0, w, h);
  } finally { ctx.restore(); }
}

function _buildLinearGradient(ctx, params, w, h) {
  if (typeof ctx.createLinearGradient !== 'function') return null;
  const angle = (_num(params.angle, 90) * Math.PI) / 180;
  const cx = w / 2, cy = h / 2;
  const r = Math.hypot(w, h) / 2;
  const x0 = cx - Math.cos(angle) * r;
  const y0 = cy - Math.sin(angle) * r;
  const x1 = cx + Math.cos(angle) * r;
  const y1 = cy + Math.sin(angle) * r;
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  if (!grad || typeof grad.addColorStop !== 'function') return null;
  const stops = Array.isArray(params.stops) && params.stops.length >= 2
    ? params.stops
    : defaultEffectParams('gradientOverlay').stops;
  for (const stop of stops) {
    grad.addColorStop(
      Math.max(0, Math.min(1, Number(stop.offset) || 0)),
      stop.color || '#ffffff',
    );
  }
  return grad;
}

function _num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
