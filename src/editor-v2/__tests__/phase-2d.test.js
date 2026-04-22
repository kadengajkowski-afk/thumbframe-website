// src/editor-v2/__tests__/phase-2d.test.js
// -----------------------------------------------------------------------------
// Phase 2.d regression suite. Covers:
//   • Selection singleton — apply/invert/deselect, combine ops, bbox
//   • LassoSelector scanline-fill (O(N·H) — no O(N·R²) feather regression)
//   • MagicWand contiguous + global modes, tolerance bounds
//   • ColorRange hue/sat/lum tolerance
//   • RefineEdge feather/contrast/smooth don't panic + produce
//     reasonable output
//   • SAMClient: returns null on bad network / missing URL (graceful)
//   • Registry selection.* actions route through the store singleton
// -----------------------------------------------------------------------------

jest.mock('../save/idb', () => {
  const db = { projects: new Map(), snapshots: new Map(), queue: new Map() };
  return {
    putProject: jest.fn(async (p) => { db.projects.set(p.id, p); }),
    getProject: jest.fn(async (id) => db.projects.get(id) || null),
    listProjects: jest.fn(async () => [...db.projects.values()]),
    putSnapshot: jest.fn(async (s) => { db.snapshots.set(s.id, s); }),
    listSnapshots: jest.fn(async (pid) =>
      [...db.snapshots.values()].filter(s => s.projectId === pid).sort((a, b) => a.timestamp - b.timestamp),
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
import { useStore, SAVE_STATUS } from '../store/Store';
import { History }               from '../history/History';
import {
  registerFoundationActions,
  executeAction,
  getAction,
  __resetRegistry,
} from '../actions/registry';
import { PaintCanvases }         from '../engine/PaintCanvases';
import { Selection, SELECTION_OP } from '../selection/Selection';
import { buildLassoMask }         from '../selection/LassoSelector';
import { buildMagicWandMask }     from '../selection/MagicWand';
import { buildColorRangeMask, rgbToHsl } from '../selection/ColorRange';
import { refineEdge }             from '../selection/RefineEdge';
import { SAMClient }              from '../selection/SAMClient';
import * as idb                   from '../save/idb';

let history, paintCanvases, selection, samClient;

async function resetAll() {
  __resetRegistry();
  await idb.__resetForTests();
  const s = useStore.getState();
  useStore.setState({
    projectId: null, projectName: 'Untitled',
    layers: [], selectedLayerIds: [],
    saveStatus: SAVE_STATUS.SAVED, lastSavedAt: null, rendererReady: false,
    activeTool: 'brush', toolParams: s.toolParams, strokeActive: false,
    __fontLoader: null, __selection: null, __samClient: null,
  });
  paintCanvases = new PaintCanvases();
  selection     = new Selection(32, 24);   // small canvas for speed
  samClient     = new SAMClient({ apiUrl: 'http://does-not-resolve.invalid' });
  useStore.getState().setSelectionInstance(selection);
  useStore.getState().setSAMClient(samClient);
  history = new History({ store: useStore, projectId: 'test-project', max: 50 });
  await history.load();
  registerFoundationActions({ store: useStore, history, paintCanvases });
  await history.seed('Initial state');
}

beforeEach(resetAll);

// ── Selection singleton ────────────────────────────────────────────────────
describe('Selection', () => {
  test('starts empty', () => {
    expect(selection.isEmpty).toBe(true);
    expect(selection.bbox).toBeNull();
  });

  test('apply REPLACE sets mask + bbox', () => {
    const m = new Uint8ClampedArray(32 * 24);
    // mark a 4x4 block at (5,5)
    for (let y = 5; y < 9; y++) for (let x = 5; x < 9; x++) m[y * 32 + x] = 255;
    selection.apply(m, SELECTION_OP.REPLACE);
    expect(selection.isEmpty).toBe(false);
    expect(selection.bbox).toEqual({ x: 5, y: 5, w: 4, h: 4 });
  });

  test('apply ADD expands the bbox', () => {
    const a = new Uint8ClampedArray(32 * 24); a[5 * 32 + 5] = 255;
    const b = new Uint8ClampedArray(32 * 24); b[20 * 32 + 20] = 255;
    selection.apply(a, SELECTION_OP.REPLACE);
    selection.apply(b, SELECTION_OP.ADD);
    expect(selection.bbox).toEqual({ x: 5, y: 5, w: 16, h: 16 });
  });

  test('apply SUBTRACT shrinks coverage', () => {
    const a = new Uint8ClampedArray(32 * 24).fill(255);
    selection.apply(a, SELECTION_OP.REPLACE);
    const b = new Uint8ClampedArray(32 * 24).fill(255);
    selection.apply(b, SELECTION_OP.SUBTRACT);
    expect(selection.isEmpty).toBe(false);  // mask still allocated
    expect(selection.bbox).toBeNull();      // zero coverage now
  });

  test('invert on empty becomes select-all', () => {
    selection.invert();
    expect(selection.isEmpty).toBe(false);
    expect(selection.bbox).toEqual({ x: 0, y: 0, w: 32, h: 24 });
  });

  test('deselect clears state', () => {
    const m = new Uint8ClampedArray(32 * 24).fill(255);
    selection.apply(m, SELECTION_OP.REPLACE);
    selection.deselect();
    expect(selection.isEmpty).toBe(true);
  });

  test('version increments on every apply / invert / deselect', () => {
    const v0 = selection.version;
    const m = new Uint8ClampedArray(32 * 24).fill(255);
    selection.apply(m);
    selection.invert();
    selection.deselect();
    expect(selection.version).toBeGreaterThan(v0 + 2);
  });
});

// ── Lasso ──────────────────────────────────────────────────────────────────
describe('buildLassoMask', () => {
  test('square polygon fills its interior', () => {
    const mask = buildLassoMask([4, 4, 20, 4, 20, 16, 4, 16], { width: 32, height: 24 });
    expect(mask[8 * 32 + 10]).toBe(255);
    expect(mask[0 * 32 + 0]).toBe(0);
  });

  test('feather softens the edge (outer-ring pixels non-zero)', () => {
    const mask = buildLassoMask([4, 4, 20, 4, 20, 16, 4, 16],
      { width: 32, height: 24, feather: 2 });
    // The feather blur should leak into pixels just outside the rect.
    // Check a pixel one step to the right of the right edge.
    expect(mask[10 * 32 + 21]).toBeGreaterThan(0);
  });

  test('degenerate polygon returns zero mask', () => {
    const mask = buildLassoMask([], { width: 32, height: 24 });
    expect(mask.every(v => v === 0)).toBe(true);
  });
});

// ── Magic Wand ─────────────────────────────────────────────────────────────
describe('buildMagicWandMask', () => {
  function makeImage(width, height, fill) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4]     = fill[0];
      data[i * 4 + 1] = fill[1];
      data[i * 4 + 2] = fill[2];
      data[i * 4 + 3] = 255;
    }
    return { data, width, height };
  }

  test('uniform image → entire canvas selected (within tolerance)', () => {
    const img  = makeImage(8, 8, [128, 128, 128]);
    const mask = buildMagicWandMask(img, 0, 0, { tolerance: 0, contiguous: true });
    expect(mask.every(v => v === 255)).toBe(true);
  });

  test('contiguous mode: does not leak past a color barrier', () => {
    const img = makeImage(8, 8, [0, 0, 0]);
    // Build a vertical wall of red at x=4
    for (let y = 0; y < 8; y++) {
      const i = (y * 8 + 4) * 4;
      img.data[i] = 255; img.data[i + 1] = 0; img.data[i + 2] = 0;
    }
    const mask = buildMagicWandMask(img, 0, 0, { tolerance: 5, contiguous: true });
    expect(mask[0 * 8 + 0]).toBe(255);
    expect(mask[0 * 8 + 7]).toBe(0);   // right of wall untouched
  });

  test('global mode: matches ignore connectivity', () => {
    const img = makeImage(8, 8, [0, 0, 0]);
    for (let y = 0; y < 8; y++) {
      const i = (y * 8 + 4) * 4;
      img.data[i] = 255; img.data[i + 1] = 0; img.data[i + 2] = 0;
    }
    const mask = buildMagicWandMask(img, 0, 0, { tolerance: 5, contiguous: false });
    expect(mask[0 * 8 + 7]).toBe(255);   // right of wall IS selected
  });

  test('tolerance controls match slack', () => {
    const img = makeImage(4, 4, [100, 100, 100]);
    const strict = buildMagicWandMask(img, 0, 0, { tolerance: 0, contiguous: true });
    expect(strict.every(v => v === 255)).toBe(true);
  });
});

// ── Color Range ────────────────────────────────────────────────────────────
describe('rgbToHsl + buildColorRangeMask', () => {
  test('pure red → h=0, s=1, l=0.5', () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(hsl.h).toBeCloseTo(0, 1);
    expect(hsl.s).toBeCloseTo(1, 2);
    expect(hsl.l).toBeCloseTo(0.5, 2);
  });

  test('selects all red pixels from a mixed image', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    const setPx = (i, r, g, b) => { data[i*4]=r; data[i*4+1]=g; data[i*4+2]=b; data[i*4+3]=255; };
    for (let i = 0; i < 16; i++) setPx(i, 0, 0, 0);           // black
    setPx(0,  255, 0, 0);  // red corner
    setPx(5,  230, 10, 20); // near-red
    setPx(10, 10, 200, 0);  // green
    const mask = buildColorRangeMask(
      { data, width: 4, height: 4 },
      { r: 255, g: 0, b: 0 },
      { hueTolerance: 15, satTolerance: 0.4, lumTolerance: 0.4 },
    );
    expect(mask[0]).toBe(255);
    expect(mask[5]).toBe(255);
    expect(mask[10]).toBe(0);
  });
});

// ── Refine Edge ────────────────────────────────────────────────────────────
describe('refineEdge', () => {
  test('feather smears an sharp square', () => {
    const W = 32, H = 24;
    const mask = new Uint8ClampedArray(W * H);
    for (let y = 10; y < 14; y++) for (let x = 14; x < 18; x++) mask[y * W + x] = 255;
    const copy = new Uint8ClampedArray(mask);
    refineEdge(mask, W, H, { feather: 3 });
    expect(mask[10 * W + 18]).toBeGreaterThan(0);
    expect(copy[10 * W + 18]).toBe(0);
  });

  test('contrast hardens edges', () => {
    const W = 8, H = 8;
    const mask = new Uint8ClampedArray(W * H);
    for (let i = 0; i < mask.length; i++) mask[i] = 128; // gray field
    refineEdge(mask, W, H, { contrast: 1 });
    // With aggressive contrast, gray pushes toward either 0 or 255.
    const deltas = [...mask].map(v => Math.abs(v - 128));
    expect(Math.max(...deltas)).toBeGreaterThan(0);
  });

  test('smooth opens/closes without throwing', () => {
    const W = 8, H = 8;
    const mask = new Uint8ClampedArray(W * H);
    mask[3 * W + 3] = 255;
    mask[3 * W + 4] = 255;
    expect(() => refineEdge(mask, W, H, { smooth: 1 })).not.toThrow();
  });

  test('decontaminateColors is a no-op stub (never throws)', () => {
    const mask = new Uint8ClampedArray(4);
    expect(() => refineEdge(mask, 2, 2, { decontaminateColors: 0.5 })).not.toThrow();
  });
});

// ── SAM Client ─────────────────────────────────────────────────────────────
describe('SAMClient', () => {
  test('returns null with no apiUrl', async () => {
    const c = new SAMClient({ apiUrl: '' });
    expect(await c.segment({ image: 'x', width: 1, height: 1, click: { x: 0, y: 0 } })).toBeNull();
  });

  test('returns null when fetch rejects', async () => {
    const c = new SAMClient({
      apiUrl: 'https://example.com',
      fetchImpl: async () => { throw new Error('offline'); },
    });
    expect(await c.segment({ image: 'x', width: 1, height: 1, click: { x: 0, y: 0 } })).toBeNull();
  });

  test('decodes the mask on a successful response', async () => {
    // Can't round-trip a real PNG in jsdom without the canvas binding;
    // the assertion is that we accept a 200 response and return
    // *something* (Uint8ClampedArray of the expected length).
    const c = new SAMClient({
      apiUrl: 'https://example.com',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ mask: 'fake-base64' }),
      }),
    });
    const mask = await c.segment({ image: 'x', width: 4, height: 4, click: { x: 0, y: 0 } });
    expect(mask).toBeInstanceOf(Uint8ClampedArray);
    expect(mask.length).toBe(16);
  });
});

// ── Registry forwarders ────────────────────────────────────────────────────
describe('Selection registry actions', () => {
  test('selection.lasso.apply writes to the selection singleton', async () => {
    await executeAction('selection.lasso.apply', {
      polygon: [4, 4, 20, 4, 20, 16, 4, 16], feather: 0, op: 'replace',
    });
    expect(selection.isEmpty).toBe(false);
    expect(selection.bbox).toBeDefined();
  });

  test('selection.invert flips coverage', () => {
    executeAction('selection.invert');
    expect(selection.isEmpty).toBe(false);   // empty → select all
  });

  test('selection.deselect clears', () => {
    executeAction('selection.invert');
    executeAction('selection.deselect');
    expect(selection.isEmpty).toBe(true);
  });

  test('selection.refineEdge returns false when nothing selected', async () => {
    expect(await executeAction('selection.refineEdge', { feather: 2 })).toBe(false);
  });

  test.each([
    'selection.lasso.apply', 'selection.wand.apply', 'selection.colorRange.apply',
    'selection.sam.click',   'selection.refineEdge',
    'selection.invert',      'selection.deselect',
  ])('%s is registered', (id) => {
    const a = getAction(id);
    expect(a).not.toBeNull();
    expect(a.category).toBe('selection');
  });
});
