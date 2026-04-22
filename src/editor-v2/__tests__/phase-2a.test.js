// src/editor-v2/__tests__/phase-2a.test.js
// -----------------------------------------------------------------------------
// Phase 2.a regression suite. Covers:
//   • WARP_PRESETS coverage + applyWarp pure-math sanity
//   • textPathSampler returns deterministic (x,y,angle) along a path
//   • mergeStrokeList / perCharacterOverride data helpers
//   • variableFontCSS produces the CSS font-variation-settings format
//   • outlineTextToShapes with a fake opentype Font produces 1 shape
//     per glyph
//   • Registry: text.stroke.add/remove, text.warp.set, text.gradient.set,
//     text.variableAxis.set, text.path.set, text.perChar.set,
//     text.outline.toShapes
// -----------------------------------------------------------------------------

jest.mock('../save/idb', () => {
  const db = { projects: new Map(), snapshots: new Map(), queue: new Map() };
  return {
    putProject: jest.fn(async (p) => { db.projects.set(p.id, p); }),
    getProject: jest.fn(async (id) => db.projects.get(id) || null),
    listProjects: jest.fn(async () => [...db.projects.values()]),
    putSnapshot: jest.fn(async (s) => { db.snapshots.set(s.id, s); }),
    listSnapshots: jest.fn(async (projectId) =>
      [...db.snapshots.values()]
        .filter(s => s.projectId === projectId)
        .sort((a, b) => a.timestamp - b.timestamp),
    ),
    pruneSnapshots: jest.fn(async () => {}),
    enqueueSave: jest.fn(async () => {}),
    drainQueue:  jest.fn(async () => []),
    peekQueue:   jest.fn(async () => []),
    __resetForTests: jest.fn(async () => {
      db.projects.clear(); db.snapshots.clear(); db.queue.clear();
    }),
  };
});

jest.mock('../../supabaseClient', () => ({
  __esModule: true,
  default: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import 'jest-canvas-mock';
import { useStore, SAVE_STATUS }  from '../store/Store';
import { History }                from '../history/History';
import {
  registerFoundationActions,
  executeAction,
  getAction,
  __resetRegistry,
} from '../actions/registry';
import { PaintCanvases }          from '../engine/PaintCanvases';
import { WARP_PRESETS, applyWarp, textPathSampler } from '../engine/TextWarp';
import {
  DEFAULT_TEXT_EXTENSIONS,
  mergeStrokeList,
  perCharacterOverride,
  buildTextGradient,
  variableFontCSS,
} from '../engine/TextSystem';
import { outlineTextToShapes } from '../engine/TextOutline';
import * as idb                from '../save/idb';

let history, paintCanvases;

async function resetAll() {
  __resetRegistry();
  await idb.__resetForTests();
  const s = useStore.getState();
  useStore.setState({
    projectId: null, projectName: 'Untitled',
    layers: [], selectedLayerIds: [],
    saveStatus: SAVE_STATUS.SAVED, lastSavedAt: null, rendererReady: false,
    activeTool: 'brush', toolParams: s.toolParams, strokeActive: false,
  });
  paintCanvases = new PaintCanvases();
  history = new History({ store: useStore, projectId: 'test-project', max: 50 });
  await history.load();
  registerFoundationActions({ store: useStore, history, paintCanvases });
  await history.seed('Initial state');
}

beforeEach(resetAll);

// ── TextWarp ────────────────────────────────────────────────────────────────
describe('applyWarp', () => {
  test.each(WARP_PRESETS)('%s preset returns finite coords within the text box', (preset) => {
    const r = applyWarp(preset, 50, 25, 100, 50, { bend: 0.7 });
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
  });

  test('unknown preset passes through unchanged', () => {
    const r = applyWarp('nope', 10, 20, 100, 50);
    expect(r).toEqual({ x: 10, y: 20 });
  });

  test('arc with bend>0 displaces the edges of the box upward', () => {
    // Center (u=0) stays put; the edges (u=±1) curve upward by ~h/2.
    const center = applyWarp('arc', 50, 0, 100, 50, { bend: 1 });
    const edge   = applyWarp('arc', 0,  0, 100, 50, { bend: 1 });
    expect(center.y).toBeCloseTo(0);
    expect(edge.y).toBeLessThan(0);
  });

  test('rise with bend>0 shears the top-left to the left', () => {
    const topLeft     = applyWarp('rise', 0, 0,  100, 50, { bend: 1 });
    const bottomLeft  = applyWarp('rise', 0, 50, 100, 50, { bend: 1 });
    // Top (v=-1): dx = bend*(w/3)*(-1) = negative ⇒ x shifts left.
    expect(topLeft.x).toBeLessThan(0);
    // Bottom (v=+1): dx positive ⇒ x shifts right.
    expect(bottomLeft.x).toBeGreaterThan(0);
  });
});

describe('textPathSampler', () => {
  test('empty / short paths return a safe zero sampler', () => {
    const s = textPathSampler([]);
    expect(s(42)).toEqual({ x: 0, y: 0, angle: 0 });
  });

  test('horizontal line path: distance-along gives correct x and zero angle', () => {
    const s = textPathSampler([0, 0, 100, 0]);
    const mid = s(50);
    expect(mid.x).toBeCloseTo(50);
    expect(mid.y).toBeCloseTo(0);
    expect(mid.angle).toBeCloseTo(0);
  });

  test('L-shape path: angle flips at the corner', () => {
    const s = textPathSampler([0, 0, 100, 0, 100, 100]);
    const mid1 = s(50);
    const mid2 = s(150);
    expect(mid1.angle).toBeCloseTo(0);
    expect(mid2.angle).toBeCloseTo(Math.PI / 2);
  });
});

// ── TextSystem ─────────────────────────────────────────────────────────────
describe('TextSystem helpers', () => {
  test('DEFAULT_TEXT_EXTENSIONS covers every field', () => {
    expect(DEFAULT_TEXT_EXTENSIONS.multiStroke).toEqual([]);
    expect(DEFAULT_TEXT_EXTENSIONS.perCharacter).toEqual([]);
    expect(DEFAULT_TEXT_EXTENSIONS.variableAxes).toEqual({});
    expect(DEFAULT_TEXT_EXTENSIONS.warp).toBeNull();
    expect(DEFAULT_TEXT_EXTENSIONS.pathId).toBeNull();
    expect(DEFAULT_TEXT_EXTENSIONS.gradientFill).toBeNull();
    expect(DEFAULT_TEXT_EXTENSIONS.gradientStroke).toBeNull();
  });

  test('mergeStrokeList appends and clamps', () => {
    const first = mergeStrokeList([], { color: '#f00', width: -3, opacity: 2 });
    expect(first).toHaveLength(1);
    expect(first[0].width).toBe(0);
    expect(first[0].opacity).toBe(1);
    expect(first[0].position).toBe('outside');
  });

  test('mergeStrokeList preserves prior strokes', () => {
    const a = mergeStrokeList([],      { color: '#f00', width: 2 });
    const b = mergeStrokeList(a,       { color: '#0f0', width: 4, position: 'inside' });
    expect(b).toHaveLength(2);
    expect(b[0].color).toBe('#f00');
    expect(b[1].color).toBe('#0f0');
    expect(b[1].position).toBe('inside');
  });

  test('perCharacterOverride upserts and merges overrides', () => {
    const a = perCharacterOverride([],  3, { color: '#f00' });
    const b = perCharacterOverride(a,   3, { fontSize: 120 });
    expect(b).toHaveLength(1);
    expect(b[0].overrides).toEqual({ color: '#f00', fontSize: 120 });
    const c = perCharacterOverride(b, 0, { color: '#0f0' });
    // Sorted by index: 0 then 3.
    expect(c.map(e => e.index)).toEqual([0, 3]);
  });

  test('variableFontCSS serialises 4-char axes, drops bad entries', () => {
    expect(variableFontCSS({ wght: 700, wdth: 110 })).toBe(`"wght" 700, "wdth" 110`);
    expect(variableFontCSS({ wght: 'bad' })).toBe('');
    expect(variableFontCSS({ foo: 100 })).toBe('');  // wrong-length tag
    expect(variableFontCSS(null)).toBe('');
  });

  test('buildTextGradient emits a usable Canvas linear gradient', () => {
    const calls = [];
    const ctx = {
      createLinearGradient: (x0, y0, x1, y1) => {
        calls.push({ x0, y0, x1, y1 });
        return { addColorStop: (o, c) => calls.push({ o, c }) };
      },
    };
    const g = buildTextGradient(ctx, {
      stops: [{ color: '#000', offset: 0 }, { color: '#fff', offset: 1 }],
      angle: 45,
    }, 100, 50);
    expect(g).not.toBeNull();
    expect(calls.find(c => c.x0 !== undefined)).toBeDefined();
  });

  test('buildTextGradient returns null for invalid input', () => {
    expect(buildTextGradient(null, { stops: [], angle: 0 }, 10, 10)).toBeNull();
    expect(buildTextGradient({ createLinearGradient: () => null }, { stops: [{ color: '#000', offset: 0 }] }, 10, 10)).toBeNull();
  });
});

// ── TextOutline ────────────────────────────────────────────────────────────
describe('outlineTextToShapes', () => {
  // A minimal fake opentype.Font — captures the shape of what the real
  // one returns so we don't drag the full OTF parser into the test.
  const fakeFont = {
    unitsPerEm: 1000,
    charToGlyph: () => ({ advanceWidth: 500 }),
    getPath: (ch, x, y, size) => ({
      commands: [
        { type: 'M', x,            y            },
        { type: 'L', x: x + size,  y            },
        { type: 'L', x: x + size,  y: y + size  },
        { type: 'L', x,            y: y + size  },
        { type: 'Z' },
      ],
      getBoundingBox: () => ({ x1: x, y1: y, x2: x + size, y2: y + size }),
    }),
  };

  test('returns one shape per non-whitespace character', () => {
    const out = outlineTextToShapes(fakeFont, 'Hi there', {
      x: 0, y: 0, fontSize: 40, fill: '#fff',
    });
    // 7 letters (spaces skipped).
    expect(out).toHaveLength(7);
  });

  test('each emitted override is a vectorPath shape with commands', () => {
    const [first] = outlineTextToShapes(fakeFont, 'A', { fontSize: 40 });
    expect(first.type).toBe('shape');
    expect(first.shapeData.shapeType).toBe('vectorPath');
    expect(Array.isArray(first.shapeData.commands)).toBe(true);
    expect(first.shapeData.commands.length).toBeGreaterThan(0);
  });

  test('no-op on empty string', () => {
    expect(outlineTextToShapes(fakeFont, '', {})).toEqual([]);
  });

  test('no-op on falsy font', () => {
    expect(outlineTextToShapes(null, 'hi', {})).toEqual([]);
  });
});

// ── Registry ───────────────────────────────────────────────────────────────
describe('text.stroke.add / remove', () => {
  test('text.stroke.add appends + snapshots', async () => {
    const id = await executeAction('text.create', {});
    const before = history.size();
    await executeAction('text.stroke.add', id, { color: '#000', width: 4 });
    await executeAction('text.stroke.add', id, { color: '#fff', width: 2, position: 'inside' });
    const layer = useStore.getState().layers.find(l => l.id === id);
    expect(layer.textData.multiStroke).toHaveLength(2);
    expect(history.size()).toBe(before + 2);
  });

  test('text.stroke.remove drops the indexed stroke', async () => {
    const id = await executeAction('text.create', {});
    await executeAction('text.stroke.add', id, { color: '#000', width: 4 });
    await executeAction('text.stroke.add', id, { color: '#fff', width: 2 });
    await executeAction('text.stroke.remove', id, 0);
    const layer = useStore.getState().layers.find(l => l.id === id);
    expect(layer.textData.multiStroke).toHaveLength(1);
    expect(layer.textData.multiStroke[0].color).toBe('#fff');
  });
});

describe('text.warp.set / text.path.set', () => {
  test('text.warp.set sets a warp config + snapshots', async () => {
    const id = await executeAction('text.create', {});
    const before = history.size();
    await executeAction('text.warp.set', id, { preset: 'arc', bend: 0.8 });
    expect(history.size()).toBe(before + 1);
    const layer = useStore.getState().layers.find(l => l.id === id);
    expect(layer.textData.warp).toEqual({ preset: 'arc', bend: 0.8 });
  });

  test('text.warp.set with null clears', async () => {
    const id = await executeAction('text.create', {});
    await executeAction('text.warp.set', id, { preset: 'bulge', bend: 1 });
    await executeAction('text.warp.set', id, null);
    expect(useStore.getState().layers.find(l => l.id === id).textData.warp).toBeNull();
  });

  test('text.path.set stores the path id', async () => {
    const id = await executeAction('text.create', {});
    await executeAction('text.path.set', id, 'path-abc');
    expect(useStore.getState().layers.find(l => l.id === id).textData.pathId).toBe('path-abc');
  });
});

describe('text.gradient.set', () => {
  test('fill gradient stored and visible on the layer', async () => {
    const id = await executeAction('text.create', {});
    await executeAction('text.gradient.set', id, 'fill', {
      stops: [{ color: '#f00', offset: 0 }, { color: '#00f', offset: 1 }],
      angle: 90,
    });
    const fx = useStore.getState().layers.find(l => l.id === id).textData.gradientFill;
    expect(fx.stops).toHaveLength(2);
    expect(fx.angle).toBe(90);
  });

  test('unknown target is a no-op', async () => {
    const id = await executeAction('text.create', {});
    await executeAction('text.gradient.set', id, 'bogus', { stops: [] });
    const layer = useStore.getState().layers.find(l => l.id === id);
    expect(layer.textData.gradientFill).toBeNull();
    expect(layer.textData.gradientStroke).toBeNull();
  });
});

describe('text.variableAxis.set', () => {
  test('merges axes, does not snapshot per keystroke', async () => {
    const id = await executeAction('text.create', {});
    const before = history.size();
    await executeAction('text.variableAxis.set', id, { wght: 600 });
    await executeAction('text.variableAxis.set', id, { wdth: 110 });
    const layer = useStore.getState().layers.find(l => l.id === id);
    expect(layer.textData.variableAxes).toEqual({ wght: 600, wdth: 110 });
    expect(history.size()).toBe(before);
  });
});

describe('text.perChar.set', () => {
  test('upsert style at a given glyph index', async () => {
    const id = await executeAction('text.create', {});
    await executeAction('text.perChar.set', id, 2, { color: '#ff0' });
    const layer = useStore.getState().layers.find(l => l.id === id);
    expect(layer.textData.perCharacter).toEqual([{ index: 2, overrides: { color: '#ff0' } }]);
  });
});

describe('text.outline.toShapes', () => {
  const fakeFont = {
    unitsPerEm: 1000,
    charToGlyph: () => ({ advanceWidth: 500 }),
    getPath: (ch, x, y, size) => ({
      commands: [
        { type: 'M', x, y },
        { type: 'L', x: x + size, y: y + size },
        { type: 'Z' },
      ],
      getBoundingBox: () => ({ x1: x, y1: y, x2: x + size, y2: y + size }),
    }),
  };

  test('destroys source text, creates shape layers, snapshots', async () => {
    const id = await executeAction('text.create', { textData: { content: 'Hi' } });
    const before = history.size();
    const newIds = await executeAction('text.outline.toShapes', id, fakeFont);
    expect(Array.isArray(newIds)).toBe(true);
    expect(newIds.length).toBe(2);
    expect(useStore.getState().layers.find(l => l.id === id)).toBeUndefined();
    expect(history.size()).toBe(before + 1);
  });

  test('returns null on a non-text layer', async () => {
    const id = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    const out = await executeAction('text.outline.toShapes', id, fakeFont);
    expect(out).toBeNull();
  });
});

// ── Registry surface health ────────────────────────────────────────────────
describe('Phase 2.a registry surface', () => {
  test.each([
    'text.stroke.add', 'text.stroke.remove',
    'text.warp.set', 'text.gradient.set',
    'text.variableAxis.set', 'text.path.set',
    'text.perChar.set', 'text.outline.toShapes',
  ])('%s registered', (id) => {
    const a = getAction(id);
    expect(a).not.toBeNull();
    expect(typeof a.handler).toBe('function');
    expect(a.category).toBe('text');
  });
});
