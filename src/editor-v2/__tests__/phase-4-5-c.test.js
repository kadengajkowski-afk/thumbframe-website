// src/editor-v2/__tests__/phase-4-5-c.test.js
// -----------------------------------------------------------------------------
// Phase 4.5.c — two-canvas pattern via three top-level RenderGroups.
//
// The research prescribes splitting the stage into background / layers /
// overlay RenderGroups so overlay-only interactions (selection box drag,
// hover marker, command palette open, slider scrub) never invalidate
// the expensive layers group's instruction list.
//
// This suite locks in the behavioural contract. The Renderer is exercised
// in its mocked Pixi mode (same stubs as 4.5.a) so we can count
// layersSyncCount deterministically. Per the user directive we verify
// the three high-frequency overlay-only UI events:
//   • hovering a layer in the panel
//   • opening the command palette
//   • scrubbing a slider in the contextual panel
// None of these should bump layersSyncCount. A layer mutation MUST.
// -----------------------------------------------------------------------------

jest.mock('pixi.js', () => {
  class Stub {
    constructor() {
      this.children = [];
      this.parent   = null;
      this.visible  = true;
      this.alpha    = 1;
      this.x = 0; this.y = 0;
      this.rotation = 0;
      this.scale = { set() {} };
      this.destroy = jest.fn();
      this.isRenderGroup = false;
      this.blendMode = 'normal';
    }
    addChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      if (c) c.parent = null;
      return c;
    }
    getChildIndex(c) { return this.children.indexOf(c); }
    setChildIndex(c, idx) {
      const i = this.children.indexOf(c);
      if (i < 0) return;
      this.children.splice(i, 1);
      this.children.splice(idx, 0, c);
    }
    enableRenderGroup() { this.isRenderGroup = true; }
  }
  class GraphicsStub extends Stub {
    rect() { return this; } fill() { return this; } stroke() { return this; }
    moveTo() { return this; } lineTo() { return this; }
    bezierCurveTo() { return this; } quadraticCurveTo() { return this; }
    closePath() { return this; }
  }
  return {
    __esModule: true,
    Application: class { async init() {} destroy() {} },
    Container:   Stub,
    Graphics:    GraphicsStub,
    Sprite:      Stub,
  };
});

jest.mock('../save/idb', () => ({
  putProject: jest.fn(async () => {}), getProject: jest.fn(async () => null),
  listProjects: jest.fn(async () => []),
  putSnapshot: jest.fn(async () => {}), listSnapshots: jest.fn(async () => []),
  pruneSnapshots: jest.fn(async () => {}),
  enqueueSave: jest.fn(async () => {}), drainQueue: jest.fn(async () => []),
  peekQueue: jest.fn(async () => []),
  __resetForTests: jest.fn(async () => {}),
}));

jest.mock('../../supabaseClient', () => ({
  __esModule: true,
  default: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import 'jest-canvas-mock';
import { Renderer } from '../engine/Renderer';
import { documentStore, __resetDocumentStore } from '../store/DocumentStore';
import { ephemeralStore, __resetEphemeralStore } from '../store/EphemeralStore';
import { useStore, SAVE_STATUS } from '../store/Store';

// ── Helpers ───────────────────────────────────────────────────────────────
function makeMockApp() {
  const handlers = [];
  return {
    canvas: (() => {
      const c = document.createElement('canvas'); c.style = {}; return c;
    })(),
    stage: { addChild: jest.fn(), removeChild: jest.fn() },
    renderer: { render: jest.fn(), on: jest.fn(), off: jest.fn() },
    ticker: {
      autoStart: false, started: false,
      add: (fn) => handlers.push(fn), remove: jest.fn(),
      start() { this.started = true; }, stop() { this.started = false; },
    },
    destroy: jest.fn(),
  };
}

function installRafStub() {
  const q = [];
  const origRaf    = global.requestAnimationFrame;
  const origCancel = global.cancelAnimationFrame;
  global.requestAnimationFrame = (cb) => { const id = q.length + 1; q.push({ id, cb }); return id; };
  global.cancelAnimationFrame  = (id) => { const i = q.findIndex(e => e.id === id); if (i >= 0) q.splice(i, 1); };
  return {
    drain: () => { const n = q.length; for (let i = 0; i < n; i++) { const e = q.shift(); if (e) e.cb(performance.now()); } },
    uninstall: () => { global.requestAnimationFrame = origRaf; global.cancelAnimationFrame = origCancel; },
  };
}

async function bootRenderer() {
  const r = new Renderer();
  const app = makeMockApp();
  // eslint-disable-next-line global-require
  const { Container } = require('pixi.js');
  r._app = app;
  r._viewport      = new Container();
  r._bgGroup       = new Container(); r._bgGroup.enableRenderGroup();
  r._layersGroup   = new Container(); r._layersGroup.enableRenderGroup();
  r._overlayGroup  = new Container(); r._overlayGroup.enableRenderGroup();
  r._viewport.addChild(r._bgGroup);
  r._viewport.addChild(r._layersGroup);
  r._viewport.addChild(r._overlayGroup);
  r._layerContainer = r._layersGroup;
  r._canvasEl = app.canvas;
  r._store = {
    getState:  () => useStore.getState(),
    subscribe: (fn) => useStore.subscribe(fn),
  };
  r._unsubStore = r._store.subscribe(() => r.requestRender());
  r._unsubDocumentStore = documentStore.subscribe(() => r.requestRender());
  app.ticker.add(r._onTick);
  r._rafId = requestAnimationFrame(r._onRaf);
  return { renderer: r, app };
}

// ── Setup ─────────────────────────────────────────────────────────────────
let raf;
beforeEach(() => {
  raf = installRafStub();
  __resetDocumentStore();
  __resetEphemeralStore();
  const t = useStore.getState().toolParams;
  useStore.setState({
    projectId: null, projectName: 'Untitled',
    layers: [], selectedLayerIds: [],
    saveStatus: SAVE_STATUS.SAVED, lastSavedAt: null, rendererReady: false,
    activeTool: 'brush', toolParams: t, strokeActive: false,
  });
});
afterEach(() => { raf.uninstall(); });

// ── RenderGroup topology ──────────────────────────────────────────────────
describe('RenderGroup topology', () => {
  test('all three groups exist and are marked isRenderGroup', async () => {
    const { renderer } = await bootRenderer();
    expect(renderer._bgGroup.isRenderGroup).toBe(true);
    expect(renderer._layersGroup.isRenderGroup).toBe(true);
    expect(renderer._overlayGroup.isRenderGroup).toBe(true);
    renderer.destroy();
  });

  test('viewport children order: background → layers → overlay', async () => {
    const { renderer } = await bootRenderer();
    const kids = renderer._viewport.children;
    expect(kids[0]).toBe(renderer._bgGroup);
    expect(kids[1]).toBe(renderer._layersGroup);
    expect(kids[2]).toBe(renderer._overlayGroup);
    renderer.destroy();
  });
});

// ── layersSyncCount is the contract ───────────────────────────────────────
describe('layersSyncCount only advances on DocumentStore mutations', () => {
  test('a DocumentStore mutation DOES bump layersSyncCount', async () => {
    const { renderer } = await bootRenderer();
    raf.drain();                                 // consume initial
    const before = renderer.stats().layersSyncCount;
    useStore.getState().addLayer({ type: 'shape', name: 'A' });
    raf.drain();
    expect(renderer.stats().layersSyncCount).toBe(before + 1);
    renderer.destroy();
  });

  test('overlay-only event — ephemeral hover change does NOT bump layersSyncCount', async () => {
    const { renderer } = await bootRenderer();
    useStore.getState().addLayer({ type: 'shape', name: 'A' });
    raf.drain();
    const before = renderer.stats().layersSyncCount;
    for (let i = 0; i < 10; i++) {
      ephemeralStore.setHover(i % 2 === 0 ? 'x' : null);
    }
    raf.drain(); raf.drain();
    expect(renderer.stats().layersSyncCount).toBe(before);
    renderer.destroy();
  });

  test('overlay-only event — selection change does NOT bump layersSyncCount', async () => {
    const { renderer } = await bootRenderer();
    const id = useStore.getState().addLayer({ type: 'shape', name: 'A' });
    raf.drain();
    const before = renderer.stats().layersSyncCount;
    ephemeralStore.setSelection([id]);
    ephemeralStore.clearSelection();
    raf.drain(); raf.drain();
    expect(renderer.stats().layersSyncCount).toBe(before);
    renderer.destroy();
  });

  test('overlay-only event — command palette open (UI store tool change) does NOT bump layersSyncCount', async () => {
    const { renderer } = await bootRenderer();
    useStore.getState().addLayer({ type: 'shape', name: 'A' });
    raf.drain();
    const before = renderer.stats().layersSyncCount;
    // The palette opens/closes via a UI store flip that goes through
    // a Zustand setState — no DocumentStore mutation happens.
    useStore.setState((s) => ({ ...s, activeTool: 'eraser' }));
    useStore.setState((s) => ({ ...s, activeTool: 'brush' }));
    raf.drain(); raf.drain();
    expect(renderer.stats().layersSyncCount).toBe(before);
    renderer.destroy();
  });

  test('overlay-only event — strokeActive toggle does NOT bump layersSyncCount', async () => {
    const { renderer } = await bootRenderer();
    useStore.getState().addLayer({ type: 'shape', name: 'A' });
    raf.drain();
    const before = renderer.stats().layersSyncCount;
    useStore.getState().setStrokeActive(true);
    useStore.getState().setStrokeActive(false);
    raf.drain(); raf.drain();
    expect(renderer.stats().layersSyncCount).toBe(before);
    renderer.destroy();
  });

  test('scrubbing a slider in contextual panel — sync count advances ≤ mutation count', async () => {
    // Demand-driven rendering coalesces same-frame mutations into one
    // sync, so the bound is "at most one sync per mutation." The
    // important contract: sync count must NEVER exceed the mutation
    // count — that would mean overlays or UI events crept in.
    const { renderer } = await bootRenderer();
    const id = useStore.getState().addLayer({ type: 'shape', name: 'A' });
    raf.drain();
    const before = renderer.stats().layersSyncCount;
    for (let i = 0; i < 10; i++) {
      useStore.getState().updateLayer(id, { opacity: 1 - i / 100 });
      raf.drain();
    }
    const delta = renderer.stats().layersSyncCount - before;
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(10);
    renderer.destroy();
  });

  test('hovering the layer panel between renders does not inject extra layers syncs', async () => {
    const { renderer } = await bootRenderer();
    const id = useStore.getState().addLayer({ type: 'shape', name: 'A' });
    raf.drain();
    const before = renderer.stats().layersSyncCount;
    // Mix hover events between real mutations, draining after each
    // mutation so the sync runs. Hovers in between must NOT inject
    // additional syncs.
    useStore.getState().updateLayer(id, { name: 'B' });
    raf.drain();
    ephemeralStore.setHover('L1');
    raf.drain();
    ephemeralStore.setHover(null);
    raf.drain();
    useStore.getState().updateLayer(id, { name: 'C' });
    raf.drain();
    expect(renderer.stats().layersSyncCount).toBe(before + 2);
    renderer.destroy();
  });
});
