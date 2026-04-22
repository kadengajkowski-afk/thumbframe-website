// src/editor-v2/__tests__/phase-4-5-d.test.js
// -----------------------------------------------------------------------------
// Phase 4.5.d — safety + memory hardening.
//
// Contracts verified:
//   1. importImage() caps ingested dimensions at MAX_IMPORT_DIMENSION
//      (4096px) and calls createImageBitmap with resizeQuality: 'high'
//   2. Small images pass through unresized
//   3. Null / invalid blobs resolve to null (never throw)
//   4. Renderer disposal audit:
//      - canvas is resized to 1x1 before app.destroy (iOS Safari
//        pqina.nl pattern)
//      - app.destroy receives { children: true, texture: true,
//        baseTexture: true }
//      - _disposeLayer calls obj.destroy with the same full options
//   5. WebGL context-loss handler preventDefaults and clears the
//      GPU-backed TexturePool entries
// -----------------------------------------------------------------------------

jest.mock('pixi.js', () => {
  class Stub {
    constructor() {
      this.children = []; this.parent = null;
      this.visible = true; this.alpha = 1;
      this.x = 0; this.y = 0; this.rotation = 0;
      this.scale = { set() {} };
      this.destroy = jest.fn();
      this.isRenderGroup = false;
    }
    addChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); if (c) c.parent = null; return c; }
    getChildIndex(c) { return this.children.indexOf(c); }
    setChildIndex(c, idx) { const i = this.children.indexOf(c); if (i < 0) return; this.children.splice(i, 1); this.children.splice(idx, 0, c); }
    enableRenderGroup() { this.isRenderGroup = true; }
  }
  class GraphicsStub extends Stub { rect() { return this; } fill() { return this; } stroke() { return this; } moveTo() { return this; } lineTo() { return this; } bezierCurveTo() { return this; } quadraticCurveTo() { return this; } closePath() { return this; } }
  return {
    __esModule: true,
    Application: class { async init() {} destroy() {} },
    Container:   Stub,
    Graphics:    GraphicsStub,
    Sprite:      Stub,
  };
});

import 'jest-canvas-mock';
import { Renderer } from '../engine/Renderer';
import { importImage, MAX_IMPORT_DIMENSION } from '../engine/imageImport';

// ── importImage ────────────────────────────────────────────────────────────
describe('importImage', () => {
  const realCreateImageBitmap = global.createImageBitmap;

  beforeEach(() => {
    // Default-pass-through stub.
    global.createImageBitmap = jest.fn(async (blob, opts) => {
      // Simulate a 5000x3000 native image.
      const naturalW = 5000, naturalH = 3000;
      if (opts && opts.resizeWidth) {
        return { width: opts.resizeWidth, height: opts.resizeHeight, close() {} };
      }
      return { width: naturalW, height: naturalH, close() {} };
    });
  });

  afterEach(() => {
    global.createImageBitmap = realCreateImageBitmap;
  });

  test('5000x3000 input gets capped at 4096px longest side', async () => {
    const blob = new Blob(['fake'], { type: 'image/png' });
    const result = await importImage(blob);
    expect(result).toBeTruthy();
    expect(result.originalWidth).toBe(5000);
    expect(result.originalHeight).toBe(3000);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(MAX_IMPORT_DIMENSION);
    expect(result.wasResized).toBe(true);
    // createImageBitmap was called at least once with resize options.
    const calls = global.createImageBitmap.mock.calls;
    const resizedCalls = calls.filter(c => c[1] && c[1].resizeQuality === 'high');
    expect(resizedCalls.length).toBeGreaterThan(0);
  });

  test('800x600 input is not resized', async () => {
    global.createImageBitmap = jest.fn(async (blob, opts) => {
      if (opts && opts.resizeWidth) {
        return { width: opts.resizeWidth, height: opts.resizeHeight, close() {} };
      }
      return { width: 800, height: 600, close() {} };
    });
    const blob = new Blob(['fake'], { type: 'image/png' });
    const result = await importImage(blob);
    expect(result.wasResized).toBe(false);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  test('null / undefined blob resolves to null — does not throw', async () => {
    expect(await importImage(null)).toBeNull();
    expect(await importImage(undefined)).toBeNull();
  });

  test('custom maxDim opt is respected within [256, 8192]', async () => {
    const blob = new Blob(['fake'], { type: 'image/png' });
    const result = await importImage(blob, { maxDim: 2048 });
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(2048);
  });

  test('honors resizeQuality: high (cited by research)', async () => {
    const blob = new Blob(['fake'], { type: 'image/png' });
    await importImage(blob);
    const calls = global.createImageBitmap.mock.calls;
    const withOpts = calls.find(c => c[1] && 'resizeQuality' in c[1]);
    expect(withOpts[1].resizeQuality).toBe('high');
  });
});

// ── Renderer disposal audit ────────────────────────────────────────────────
describe('Renderer disposal audit', () => {
  function makeMockApp() {
    const canvas = document.createElement('canvas');
    canvas.width  = 1280;
    canvas.height = 720;
    canvas.style  = {};
    return {
      canvas,
      stage: { addChild: jest.fn(), removeChild: jest.fn() },
      renderer: { render: jest.fn(), on: jest.fn(), off: jest.fn() },
      ticker: {
        autoStart: false, started: false,
        add: jest.fn(), remove: jest.fn(),
        start() { this.started = true; }, stop() { this.started = false; },
      },
      destroy: jest.fn(),
    };
  }

  test('canvas is resized to 1x1 before app.destroy is called', () => {
    const r = new Renderer();
    const app = makeMockApp();
    r._app = app;
    r._canvasEl = app.canvas;
    r._layerStates = new Map();
    r._pool = { clear: jest.fn() };
    // Record the order: resize must happen BEFORE destroy.
    const order = [];
    const origDestroy = app.destroy;
    app.destroy = jest.fn((...args) => {
      order.push({ kind: 'destroy', w: app.canvas.width, h: app.canvas.height });
      origDestroy.apply(app, args);
    });
    r.destroy();
    expect(order.length).toBe(1);
    expect(order[0].w).toBe(1);
    expect(order[0].h).toBe(1);
  });

  test('app.destroy receives the full options { children, texture, baseTexture }', () => {
    const r = new Renderer();
    const app = makeMockApp();
    r._app = app;
    r._canvasEl = app.canvas;
    r._layerStates = new Map();
    r._pool = { clear: jest.fn() };
    r.destroy();
    expect(app.destroy).toHaveBeenCalledTimes(1);
    const args = app.destroy.mock.calls[0];
    expect(args[0]).toBe(true);
    expect(args[1]).toEqual(expect.objectContaining({
      children:    true,
      texture:     true,
      baseTexture: true,
    }));
  });

  test('_disposeLayer destroys the object with the full options object', () => {
    const r = new Renderer();
    r._layerStates = new Map();
    r._pool = { release: jest.fn() };
    const fakeObj = {
      children: [], parent: null,
      removeChild: jest.fn(),
      destroy: jest.fn(),
    };
    r._layerStates.set('L1', { obj: fakeObj, fingerprint: 'x', ownedTexture: null });
    r._disposeLayer('L1');
    expect(fakeObj.destroy).toHaveBeenCalledTimes(1);
    expect(fakeObj.destroy.mock.calls[0][0]).toEqual(expect.objectContaining({
      children:    true,
      texture:     true,
      baseTexture: true,
    }));
    expect(r._layerStates.has('L1')).toBe(false);
  });

  test('destroy without an _app is a safe no-op', () => {
    const r = new Renderer();
    expect(() => r.destroy()).not.toThrow();
  });
});

// ── WebGL context-loss handler ─────────────────────────────────────────────
describe('WebGL context-loss handler', () => {
  test('preventDefault is called so the browser will fire contextrestored', () => {
    const r = new Renderer();
    r._pool = { clearGPU: jest.fn() };
    const e = { preventDefault: jest.fn() };
    r._onContextLost(e);
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  test('texture pool GPU cache is cleared on context loss', () => {
    const r = new Renderer();
    const clearGPU = jest.fn();
    r._pool = { clearGPU };
    r._onContextLost({ preventDefault: () => {} });
    expect(clearGPU).toHaveBeenCalledTimes(1);
  });
});
