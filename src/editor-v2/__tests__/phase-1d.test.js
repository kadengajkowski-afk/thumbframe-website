// src/editor-v2/__tests__/phase-1d.test.js
// -----------------------------------------------------------------------------
// Phase 1.d regression suite. Covers:
//   • EffectsRenderer.defaultEffectParams for all 8 effect types
//   • buildEffectPlan partitions effects into behind/onBase/inFront
//     correctly, honoring stroke.position
//   • composeEffectsOnCanvas runs to completion on a mock ctx for every
//     effect type (no thrown errors, correct save/restore pairing)
//   • HSL fragment shader sources exist for all four modes, each
//     references the shared preamble + differ in their last lines
//   • Blend-mode registry still maps HSL ids to native:false (until the
//     Pixi filter graph wires them — tracked for 1.f)
// -----------------------------------------------------------------------------

import {
  EFFECT_TYPES,
  defaultEffectParams,
  buildEffectPlan,
  composeEffectsOnCanvas,
} from '../engine/EffectsRenderer';
import {
  HSL_FRAGMENT_SHADERS,
  HSL_VERTEX_SHADER,
} from '../engine/HSLShaders';
import { resolveBlendMode } from '../engine/BlendModes';

// Mock Canvas 2D ctx — records every call so the effect compositor can
// be exercised without a real canvas.
function makeMockCtx() {
  const calls = [];
  const rec = (name) => (...args) => { calls.push({ name, args }); };
  let saveDepth = 0;
  const ctx = {
    calls,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    filter: 'none',
    save() { saveDepth++; calls.push({ name: 'save' }); },
    restore() { saveDepth--; calls.push({ name: 'restore' }); },
    translate: rec('translate'),
    rotate:    rec('rotate'),
    drawImage: rec('drawImage'),
    fillRect:  rec('fillRect'),
    strokeRect:rec('strokeRect'),
    beginPath: rec('beginPath'),
    closePath: rec('closePath'),
    createLinearGradient: (x0, y0, x1, y1) => {
      calls.push({ name: 'createLinearGradient', args: [x0, y0, x1, y1] });
      const stops = [];
      return {
        addColorStop: (off, col) => stops.push({ off, col }),
        stops,
      };
    },
    saveDepth: () => saveDepth,
  };
  return ctx;
}

// A minimal CanvasImageSource — plain object that passes the type guard.
// drawImage in our mock only records the call; never actually reads from
// the source.
function makeBaseSource() { return { type: 'mock-base' }; }

// ── defaults ───────────────────────────────────────────────────────────────
describe('defaultEffectParams', () => {
  test.each(EFFECT_TYPES)('returns a non-empty object for %s', (type) => {
    const p = defaultEffectParams(type);
    expect(p).toBeDefined();
    expect(Object.keys(p).length).toBeGreaterThan(0);
  });

  test('stroke defaults to outside', () => {
    expect(defaultEffectParams('stroke').position).toBe('outside');
  });

  test('gradientOverlay defaults have at least 2 stops', () => {
    const p = defaultEffectParams('gradientOverlay');
    expect(Array.isArray(p.stops)).toBe(true);
    expect(p.stops.length).toBeGreaterThanOrEqual(2);
  });

  test('unknown type returns an empty object (not undefined)', () => {
    expect(defaultEffectParams('bogus')).toEqual({});
  });
});

// ── buildEffectPlan ────────────────────────────────────────────────────────
describe('buildEffectPlan', () => {
  test('null/undefined/non-array inputs produce an empty plan', () => {
    expect(buildEffectPlan(null)).toEqual({ behind: [], onBase: [], inFront: [] });
    expect(buildEffectPlan(undefined)).toEqual({ behind: [], onBase: [], inFront: [] });
    expect(buildEffectPlan('nope')).toEqual({ behind: [], onBase: [], inFront: [] });
  });

  test('disabled effects are skipped', () => {
    const plan = buildEffectPlan([
      { type: 'dropShadow', enabled: false, params: {} },
      { type: 'outerGlow',  enabled: true,  params: {} },
    ]);
    expect(plan.behind).toHaveLength(1);
    expect(plan.behind[0].type).toBe('outerGlow');
  });

  test('partitions effects into correct layers', () => {
    const plan = buildEffectPlan([
      { type: 'dropShadow',     enabled: true,  params: {} },
      { type: 'outerGlow',      enabled: true,  params: {} },
      { type: 'innerShadow',    enabled: true,  params: {} },
      { type: 'innerGlow',      enabled: true,  params: {} },
      { type: 'colorOverlay',   enabled: true,  params: {} },
      { type: 'gradientOverlay',enabled: true,  params: {} },
      { type: 'bevel',          enabled: true,  params: {} },
      { type: 'stroke',         enabled: true,  params: { position: 'outside' } },
    ]);
    expect(plan.behind.map(e => e.type)).toEqual(['dropShadow', 'outerGlow']);
    expect(plan.onBase.map(e => e.type)).toEqual([
      'innerShadow', 'innerGlow', 'colorOverlay', 'gradientOverlay', 'bevel',
    ]);
    expect(plan.inFront.map(e => e.type)).toEqual(['stroke']);
  });

  test('stroke position = inside goes on base, outside/center go in front', () => {
    const inside  = buildEffectPlan([{ type: 'stroke', enabled: true, params: { position: 'inside' } }]);
    const outside = buildEffectPlan([{ type: 'stroke', enabled: true, params: { position: 'outside' } }]);
    const center  = buildEffectPlan([{ type: 'stroke', enabled: true, params: { position: 'center' } }]);
    expect(inside.onBase).toHaveLength(1);
    expect(outside.inFront).toHaveLength(1);
    expect(center.inFront).toHaveLength(1);
  });
});

// ── composeEffectsOnCanvas ─────────────────────────────────────────────────
describe('composeEffectsOnCanvas', () => {
  test('no-op on missing ctx or base', () => {
    expect(() => composeEffectsOnCanvas(null, makeBaseSource(), 100, 100, { behind:[], onBase:[], inFront:[] })).not.toThrow();
    expect(() => composeEffectsOnCanvas(makeMockCtx(), null, 100, 100, { behind:[], onBase:[], inFront:[] })).not.toThrow();
  });

  test('empty plan draws base once', () => {
    const ctx = makeMockCtx();
    composeEffectsOnCanvas(ctx, makeBaseSource(), 200, 100, buildEffectPlan([]));
    const draws = ctx.calls.filter(c => c.name === 'drawImage');
    expect(draws).toHaveLength(1);
  });

  test('save/restore balance across every effect type', () => {
    for (const type of EFFECT_TYPES) {
      const ctx = makeMockCtx();
      const plan = buildEffectPlan([{ type, enabled: true, params: defaultEffectParams(type) }]);
      composeEffectsOnCanvas(ctx, makeBaseSource(), 200, 100, plan);
      expect(ctx.saveDepth()).toBe(0);
    }
  });

  test('gradient overlay calls createLinearGradient', () => {
    const ctx = makeMockCtx();
    const plan = buildEffectPlan([{
      type: 'gradientOverlay', enabled: true, params: defaultEffectParams('gradientOverlay'),
    }]);
    composeEffectsOnCanvas(ctx, makeBaseSource(), 300, 200, plan);
    expect(ctx.calls.find(c => c.name === 'createLinearGradient')).toBeDefined();
  });

  test('drop shadow translates by offsetX / offsetY', () => {
    const ctx = makeMockCtx();
    const plan = buildEffectPlan([{
      type: 'dropShadow', enabled: true,
      params: { ...defaultEffectParams('dropShadow'), offsetX: 11, offsetY: 13 },
    }]);
    composeEffectsOnCanvas(ctx, makeBaseSource(), 200, 100, plan);
    const t = ctx.calls.find(c => c.name === 'translate');
    expect(t).toBeDefined();
    expect(t.args).toEqual([11, 13]);
  });
});

// ── HSL shaders ────────────────────────────────────────────────────────────
describe('HSL fragment shaders', () => {
  test.each(['hue', 'saturation', 'color', 'luminosity'])(
    '%s source exists, references the preamble utilities, and calls setLum',
    (mode) => {
      const src = HSL_FRAGMENT_SHADERS[mode];
      expect(typeof src).toBe('string');
      expect(src.length).toBeGreaterThan(200);
      expect(src).toContain('setLum');
      expect(src).toContain('fragColor');
      expect(src).toContain('vTextureCoord');
    },
  );

  test('vertex shader has filterVertexPosition + filterTextureCoord', () => {
    expect(HSL_VERTEX_SHADER).toContain('filterVertexPosition');
    expect(HSL_VERTEX_SHADER).toContain('filterTextureCoord');
    expect(HSL_VERTEX_SHADER).toContain('aPosition');
  });

  test('each shader has a distinct body — no accidental duplication', () => {
    const sources = ['hue', 'saturation', 'color', 'luminosity']
      .map(m => HSL_FRAGMENT_SHADERS[m].split('void main()')[1] || '');
    const unique = new Set(sources);
    expect(unique.size).toBe(4);
  });
});

// ── Blend-mode registry remains intact for HSL ─────────────────────────────
describe('resolveBlendMode HSL fallback (pending 1.f Pixi filter wiring)', () => {
  test.each(['hue', 'saturation', 'color', 'luminosity'])(
    '%s still resolves to normal with native=false — shader string exists but renderer wiring lands in 1.f',
    (mode) => {
      const r = resolveBlendMode(mode);
      expect(r.native).toBe(false);
      expect(r.pixi).toBe('normal');
    },
  );
});
