// src/editor-v2/__tests__/phase-4-5-a.test.js
// -----------------------------------------------------------------------------
// Phase 4.5.a — demand-driven rendering.
//
// Rebuilds the Renderer's frame loop per TECHNICAL_RESEARCH.md section
// "The rendering pipeline". The contract this suite locks in:
//
//   1. idle  — exactly one render is issued for a single mutation
//      through requestRender(); no further frames are produced until
//      another mutation or gesture begin
//   2. gesture — beginGesture() drives continuous renders (one per RAF
//      tick) until endGesture() drops the depth to zero
//   3. nesting — gesture depth counts; balanced begin/end pairs unwind
//      cleanly, unbalanced ends saturate at 0 without underflow
//   4. registry forwarders (renderer.beginGesture / endGesture /
//      requestRender) route through the injected renderer handle
//   5. legacy markDirty() still functions (backwards compat)
//
// Renderer runs without a real Pixi Application; tests stub the app
// surface with an in-memory mock so the RAF loop + gesture state can
// be exercised in jsdom.
// -----------------------------------------------------------------------------

// Mock pixi.js — its ESM deps (earcut) break jest-babel transform. We
// only need the constructors to exist as stubs; the makeMockApp() below
// supplies the working surface.
jest.mock('pixi.js', () => {
  class Stub {
    constructor() {
      this.children = []; this.addChild = jest.fn();
      this.removeChild = jest.fn(); this.destroy = jest.fn();
    }
  }
  return {
    __esModule: true,
    Application: class { async init() {} destroy() {} },
    Container:   Stub,
    Graphics:    class extends Stub { rect() { return this; } fill() { return this; } },
    Sprite:      Stub,
  };
}, { virtual: false });

import 'jest-canvas-mock';
import { Renderer } from '../engine/Renderer';
import {
  __resetRegistry,
  registerFoundationActions,
  executeAction,
} from '../actions/registry';
import { useStore, SAVE_STATUS } from '../store/Store';
import { History } from '../history/History';
import { PaintCanvases } from '../engine/PaintCanvases';

jest.mock('../save/idb', () => {
  const db = { projects: new Map(), snapshots: new Map(), queue: new Map() };
  return {
    putProject: jest.fn(async () => {}),
    getProject: jest.fn(async () => null),
    listProjects: jest.fn(async () => []),
    putSnapshot: jest.fn(async () => {}),
    listSnapshots: jest.fn(async () => []),
    pruneSnapshots: jest.fn(async () => {}),
    enqueueSave: jest.fn(async () => {}),
    drainQueue: jest.fn(async () => []),
    peekQueue: jest.fn(async () => []),
    __resetForTests: jest.fn(async () => {
      db.projects.clear(); db.snapshots.clear(); db.queue.clear();
    }),
  };
});

jest.mock('../../supabaseClient', () => ({
  __esModule: true,
  default: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

// ── Mock Pixi Application ──────────────────────────────────────────────────
// Replaces Application.init()'s side effects. We only care about the
// surfaces the RAF loop touches: renderer.render, ticker.start/stop,
// canvas, stage.
function makeMockApp() {
  const tickerHandlers = [];
  return {
    canvas: (() => {
      const c = document.createElement('canvas');
      c.style = {};
      return c;
    })(),
    stage: { addChild: jest.fn(), removeChild: jest.fn() },
    renderer: {
      render: jest.fn(),
      on:     jest.fn(),
      off:    jest.fn(),
    },
    ticker: {
      autoStart: false,
      started:   false,
      add: (fn) => tickerHandlers.push(fn),
      remove: jest.fn(),
      start() { this.started = true; },
      stop()  { this.started = false; },
      _handlers: tickerHandlers,
    },
    destroy: jest.fn(),
    init: jest.fn(async () => {}),
  };
}

// Intercept requestAnimationFrame so we can drive the loop manually.
function installRafStub() {
  const queue = [];
  const origRaf    = global.requestAnimationFrame;
  const origCancel = global.cancelAnimationFrame;
  global.requestAnimationFrame = (cb) => {
    const id = queue.length + 1;
    queue.push({ id, cb });
    return id;
  };
  global.cancelAnimationFrame = (id) => {
    const idx = queue.findIndex(e => e.id === id);
    if (idx >= 0) queue.splice(idx, 1);
  };
  const tick = () => {
    const e = queue.shift();
    if (e) e.cb(performance.now());
  };
  const drain = () => {
    // Drain all currently queued entries; new enqueues from the drained
    // callbacks land on the tail so each run of the RAF loop adds exactly
    // one new entry.
    const count = queue.length;
    for (let i = 0; i < count; i++) {
      const e = queue.shift();
      if (e) e.cb(performance.now());
    }
  };
  const uninstall = () => {
    global.requestAnimationFrame = origRaf;
    global.cancelAnimationFrame  = origCancel;
  };
  return { tick, drain, queueLength: () => queue.length, uninstall };
}

// Build a Renderer with the mock Application pre-swapped in so init()
// doesn't touch the real Pixi renderer path.
async function makeRenderer() {
  const r = new Renderer();
  const app = makeMockApp();
  // Patch the private init to use the mock app.
  r._app = app;
  r._viewport = { addChild: jest.fn(), removeChild: jest.fn() };
  r._layerContainer = { addChild: jest.fn(), removeChild: jest.fn() };
  r._canvasEl = app.canvas;
  // Register the RAF loop just like init() would.
  r._rafId = requestAnimationFrame(r._onRaf);
  // Make the store a no-op subscriber so mutations can still call
  // requestRender() through the bound subscribe handler.
  r._store = {
    getState: () => useStore.getState(),
    subscribe: () => () => {},
  };
  r._unsubStore = r._store.subscribe(() => r.requestRender());
  app.ticker.add(r._onTick);
  // Pixi's init leaves the stage-render queued exactly once.
  r._needsRender = true;
  return { renderer: r, app };
}

// ── Suite ──────────────────────────────────────────────────────────────────
describe('Renderer demand-driven frame loop', () => {
  let raf;

  beforeEach(() => { raf = installRafStub(); });
  afterEach(()  => { raf.uninstall(); });

  test('idle — a single requestRender() issues exactly one render', async () => {
    const { renderer, app } = await makeRenderer();
    // Drain the RAF queue three times to prove the loop doesn't idle-tick.
    raf.drain();                                 // 1st frame: needsRender=true
    const afterFirst = app.renderer.render.mock.calls.length;
    raf.drain(); raf.drain(); raf.drain();       // three idle frames
    expect(app.renderer.render.mock.calls.length).toBe(afterFirst);
    renderer.destroy();
  });

  test('requestRender() collapses to one render regardless of call count', async () => {
    const { renderer, app } = await makeRenderer();
    raf.drain();                                 // consume initial
    const baseline = app.renderer.render.mock.calls.length;
    for (let i = 0; i < 100; i++) renderer.requestRender();
    raf.drain();                                 // one frame
    expect(app.renderer.render.mock.calls.length).toBe(baseline + 1);
    raf.drain();
    expect(app.renderer.render.mock.calls.length).toBe(baseline + 1);
    renderer.destroy();
  });

  test('gesture mode renders every frame until endGesture drops depth to 0', async () => {
    const { renderer, app } = await makeRenderer();
    raf.drain();                                 // consume initial
    const baseline = app.renderer.render.mock.calls.length;

    renderer.beginGesture();
    expect(app.ticker.started).toBe(true);

    // Five drained RAF frames → five renders even without further mutations.
    raf.drain(); raf.drain(); raf.drain(); raf.drain(); raf.drain();
    const duringGesture = app.renderer.render.mock.calls.length - baseline;
    expect(duringGesture).toBeGreaterThanOrEqual(5);

    renderer.endGesture();
    expect(app.ticker.started).toBe(false);

    const afterStop = app.renderer.render.mock.calls.length;
    raf.drain(); raf.drain();
    expect(app.renderer.render.mock.calls.length).toBe(afterStop);
    renderer.destroy();
  });

  test('gesture depth nests cleanly; balanced begin/end pairs', async () => {
    const { renderer, app } = await makeRenderer();
    renderer.beginGesture();
    renderer.beginGesture();
    renderer.beginGesture();
    expect(renderer.stats().gestureDepth).toBe(3);
    renderer.endGesture();
    renderer.endGesture();
    expect(renderer.stats().gestureDepth).toBe(1);
    expect(app.ticker.started).toBe(true);
    renderer.endGesture();
    expect(renderer.stats().gestureDepth).toBe(0);
    expect(app.ticker.started).toBe(false);
    renderer.destroy();
  });

  test('endGesture below zero saturates at 0 — no underflow / no negative depth', async () => {
    const { renderer } = await makeRenderer();
    renderer.endGesture();
    renderer.endGesture();
    renderer.endGesture();
    expect(renderer.stats().gestureDepth).toBe(0);
    renderer.destroy();
  });

  test('legacy markDirty() still forwards through requestRender()', async () => {
    const { renderer, app } = await makeRenderer();
    raf.drain();
    const baseline = app.renderer.render.mock.calls.length;
    renderer.markDirty();
    raf.drain();
    expect(app.renderer.render.mock.calls.length).toBe(baseline + 1);
    renderer.destroy();
  });

  test('destroy() cancels the RAF loop and no further renders are issued', async () => {
    const { renderer, app } = await makeRenderer();
    raf.drain();                                 // consume initial
    renderer.destroy();
    const afterDestroy = app.renderer.render.mock.calls.length;
    raf.drain(); raf.drain();
    // Mock .destroy() zeroes _app to null internally; render can't be
    // reached anyway — but verify the queue is empty and no mock
    // renders accumulated.
    expect(app.renderer.render.mock.calls.length).toBe(afterDestroy);
  });

  test('stats() reports coherent render counters + gesture state', async () => {
    const { renderer } = await makeRenderer();
    const s0 = renderer.stats();
    expect(s0.gestureDepth).toBe(0);
    expect(s0.gestureActive).toBe(false);
    raf.drain();
    const s1 = renderer.stats();
    expect(s1.rendersIssued).toBeGreaterThan(s0.rendersIssued);
    expect(typeof s1.lastRenderTs).toBe('number');
    renderer.destroy();
  });
});

// ── Registry forwarders ───────────────────────────────────────────────────
describe('Registry gesture forwarders', () => {
  let renderer;
  beforeEach(async () => {
    __resetRegistry();
    useStore.setState({
      projectId: null, projectName: 'Untitled',
      layers: [], selectedLayerIds: [],
      saveStatus: SAVE_STATUS.SAVED,
      lastSavedAt: null, rendererReady: false,
      activeTool: 'brush',
      toolParams: useStore.getState().toolParams,
      strokeActive: false,
    });
    const history = new History({ store: useStore, projectId: 't', max: 10 });
    await history.load();
    const paintCanvases = new PaintCanvases();
    renderer = {
      beginGesture:  jest.fn(),
      endGesture:    jest.fn(),
      requestRender: jest.fn(),
    };
    registerFoundationActions({ store: useStore, history, paintCanvases, renderer });
    await history.seed('Initial state');
  });

  test('renderer.beginGesture action calls the injected renderer', () => {
    executeAction('renderer.beginGesture');
    expect(renderer.beginGesture).toHaveBeenCalledTimes(1);
  });

  test('renderer.endGesture action calls the injected renderer', () => {
    executeAction('renderer.endGesture');
    expect(renderer.endGesture).toHaveBeenCalledTimes(1);
  });

  test('renderer.requestRender action calls the injected renderer', () => {
    executeAction('renderer.requestRender');
    expect(renderer.requestRender).toHaveBeenCalledTimes(1);
  });

  test('paint.beginStroke opens a gesture; paint.endStroke closes it', async () => {
    const layerId = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    await executeAction('paint.beginStroke', {
      layerId, target: 'layer', x: 0, y: 0, pressure: 1,
    });
    expect(renderer.beginGesture).toHaveBeenCalledTimes(1);
    expect(renderer.endGesture).toHaveBeenCalledTimes(0);
    await executeAction('paint.endStroke');
    expect(renderer.endGesture).toHaveBeenCalledTimes(1);
  });
});
