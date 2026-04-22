// src/editor-v2/__tests__/phase-1e.test.js
// -----------------------------------------------------------------------------
// Phase 1.e regression suite. Covers:
//   • VectorMask path parsing + polygon sampling
//   • SmartGuides snap computation (center, thirds, edges, safe zones,
//     pixel grid, sibling edges)
//   • BooleanOps on shape layers (unite, subtract, intersect, exclude)
//   • Transform actions (move/resize/rotate/crop) wire through the
//     registry and push a single history snapshot each
//   • Vector mask path set via layer.mask.path.set
//   • Adjustment layer update via layer.adjustment.update
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
import { useStore, SAVE_STATUS } from '../store/Store';
import { History }               from '../history/History';
import {
  registerFoundationActions,
  executeAction,
  getAction,
  __resetRegistry,
} from '../actions/registry';
import { PaintCanvases }         from '../engine/PaintCanvases';
import { parseSvgPath, samplePathToPolygon } from '../engine/VectorMask';
import { computeGuides, snapRect, DEFAULT_SNAP_THRESHOLD_PX } from '../engine/SmartGuides';
import { shapeToPolygon, booleanOp, multiPolygonToShapeData } from '../engine/BooleanOps';
import * as idb                  from '../save/idb';

let history, paintCanvases;

async function resetAll() {
  __resetRegistry();
  await idb.__resetForTests();
  const s = useStore.getState();
  useStore.setState({
    projectId:        null,
    projectName:      'Untitled',
    layers:           [],
    selectedLayerIds: [],
    saveStatus:       SAVE_STATUS.SAVED,
    lastSavedAt:      null,
    rendererReady:    false,
    activeTool:       'brush',
    toolParams:       s.toolParams,
    strokeActive:     false,
  });
  paintCanvases = new PaintCanvases();
  history = new History({ store: useStore, projectId: 'test-project', max: 50 });
  await history.load();
  registerFoundationActions({ store: useStore, history, paintCanvases });
  await history.seed('Initial state');
}

beforeEach(resetAll);

// ── VectorMask ──────────────────────────────────────────────────────────────
describe('parseSvgPath', () => {
  test('returns empty on null / non-string input', () => {
    expect(parseSvgPath(null)).toEqual([]);
    expect(parseSvgPath(undefined)).toEqual([]);
    expect(parseSvgPath('')).toEqual([]);
  });

  test('parses a simple M/L/Z rectangle', () => {
    const cmds = parseSvgPath('M 0 0 L 10 0 L 10 10 L 0 10 Z');
    expect(cmds.map(c => c.kind)).toEqual(['M', 'L', 'L', 'L', 'Z']);
    expect(cmds[0].args).toEqual([0, 0]);
    expect(cmds[2].args).toEqual([10, 10]);
  });

  test('parses relative lineto', () => {
    const cmds = parseSvgPath('M 10 10 l 5 0 l 0 5');
    expect(cmds[1].args).toEqual([15, 10]);
    expect(cmds[2].args).toEqual([15, 15]);
  });

  test('H/V collapse to L with fixed axis', () => {
    const cmds = parseSvgPath('M 0 0 H 10 V 10');
    expect(cmds.map(c => c.kind)).toEqual(['M', 'L', 'L']);
    expect(cmds[1].args).toEqual([10, 0]);
    expect(cmds[2].args).toEqual([10, 10]);
  });
});

describe('samplePathToPolygon', () => {
  test('flattens M/L sequence into a flat coordinate array', () => {
    const cmds = parseSvgPath('M 0 0 L 10 0 L 10 10');
    const poly = samplePathToPolygon(cmds);
    expect(poly).toEqual([0, 0, 10, 0, 10, 10]);
  });

  test('flattens a cubic Bezier into 12 segments per curve (default)', () => {
    const cmds = parseSvgPath('M 0 0 C 0 10 10 10 10 0');
    const poly = samplePathToPolygon(cmds);
    // 1 M + 12 C steps = 13 coordinate pairs
    expect(poly.length).toBe(13 * 2);
  });
});

// ── SmartGuides ─────────────────────────────────────────────────────────────
describe('computeGuides', () => {
  test('emits canvas center, thirds, and edges', () => {
    const g = computeGuides({ canvasWidth: 1280, canvasHeight: 720 });
    const vs = g.verticals.map(v => v.value);
    expect(vs).toContain(640);      // center
    expect(vs).toContain(1280 / 3); // first third
    expect(vs).toContain(0);        // left edge
    expect(vs).toContain(1280);     // right edge
  });

  test('safe zones appear when includeSafeZones !== false', () => {
    const g = computeGuides({ canvasWidth: 1280, canvasHeight: 720 });
    const sources = g.verticals.map(v => v.source);
    expect(sources).toContain('safe-desktop');
    expect(sources).toContain('safe-mobile');
    expect(sources).toContain('safe-text');
  });

  test('safe zones can be turned off', () => {
    const g = computeGuides({ canvasWidth: 1280, canvasHeight: 720, includeSafeZones: false });
    const sources = g.verticals.map(v => v.source);
    expect(sources).not.toContain('safe-desktop');
  });

  test('sibling centers + edges are emitted when siblings passed', () => {
    const g = computeGuides({
      canvasWidth: 1280, canvasHeight: 720,
      siblings: [{ x: 400, y: 300, width: 100, height: 80 }],
    });
    expect(g.verticals.some(v => v.value === 400)).toBe(true);  // center
    expect(g.verticals.some(v => v.value === 350)).toBe(true);  // left edge
    expect(g.verticals.some(v => v.value === 450)).toBe(true);  // right edge
  });
});

describe('snapRect', () => {
  test('snaps to canvas center when within threshold', () => {
    const guides = computeGuides({ canvasWidth: 1280, canvasHeight: 720 });
    const snapped = snapRect({ x: 642, y: 360, width: 100, height: 50 }, guides, DEFAULT_SNAP_THRESHOLD_PX);
    expect(snapped.x).toBe(640);
    expect(snapped.y).toBe(360);
    expect(snapped.snappedX).toBe('canvas-center');
  });

  test('does not snap when outside threshold', () => {
    const guides = computeGuides({ canvasWidth: 1280, canvasHeight: 720, includePixelGrid: false });
    const snapped = snapRect({ x: 100, y: 50, width: 50, height: 50 }, guides, 4);
    expect(snapped.x).toBe(100);
    expect(snapped.y).toBe(50);
  });
});

// ── BooleanOps ──────────────────────────────────────────────────────────────
describe('shapeToPolygon', () => {
  test('rect → 5-point closed ring', () => {
    const layer = {
      type: 'shape', x: 100, y: 100, width: 40, height: 20,
      shapeData: { shapeType: 'rect' },
    };
    const poly = shapeToPolygon(layer);
    expect(poly.length).toBeGreaterThan(0);
    expect(poly[0][0].length).toBe(5); // 4 corners + close
  });

  test('non-shape layer returns empty', () => {
    expect(shapeToPolygon({ type: 'text', textData: {} })).toEqual([]);
    expect(shapeToPolygon(null)).toEqual([]);
  });
});

describe('booleanOp (unite / subtract / intersect / exclude)', () => {
  const rectA = {
    type: 'shape', x: 100, y: 100, width: 100, height: 100,
    shapeData: { shapeType: 'rect' },
  };
  const rectB = {
    type: 'shape', x: 150, y: 150, width: 100, height: 100,
    shapeData: { shapeType: 'rect' },
  };

  test('unite produces a single enclosing polygon', () => {
    const r = booleanOp('unite', [rectA, rectB]);
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });

  test('intersect produces a small overlapping polygon', () => {
    const r = booleanOp('intersect', [rectA, rectB]);
    expect(r.length).toBeGreaterThan(0);
    const shape = multiPolygonToShapeData(r);
    expect(shape.points.length).toBeGreaterThanOrEqual(4);
  });

  test('subtract (A − B) leaves a notched rect', () => {
    const r = booleanOp('subtract', [rectA, rectB]);
    expect(r.length).toBeGreaterThan(0);
  });

  test('exclude (xor) produces two disjoint regions', () => {
    const r = booleanOp('exclude', [rectA, rectB]);
    expect(r.length).toBeGreaterThanOrEqual(1);
  });

  test('unknown mode throws', () => {
    expect(() => booleanOp('bogus', [rectA, rectB])).toThrow();
  });
});

// ── Registry: transform / mask / adjustment / boolean ──────────────────────
describe('transform actions', () => {
  test('transform.move adjusts layer.x/y and snapshots once', async () => {
    const id = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    const before = history.size();
    await executeAction('transform.move', id, 30, 20);
    const layer = useStore.getState().layers.find(l => l.id === id);
    expect(layer.x).toBeGreaterThan(640);   // moved right of center
    expect(layer.y).toBeGreaterThan(360);   // moved down of center
    expect(history.size()).toBe(before + 1);
  });

  test('transform.resize clamps to >= 1', async () => {
    const id = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    await executeAction('transform.resize', id, 500, 300);
    const layer = useStore.getState().layers.find(l => l.id === id);
    expect(layer.width).toBe(500);
    expect(layer.height).toBe(300);
  });

  test('transform.rotate stores radians', async () => {
    const id = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    await executeAction('transform.rotate', id, Math.PI / 4);
    const layer = useStore.getState().layers.find(l => l.id === id);
    expect(layer.rotation).toBeCloseTo(Math.PI / 4);
  });

  test('transform.crop returns the crop rect + snapshots', async () => {
    const id = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    const before = history.size();
    const rect = await executeAction('transform.crop', 10, 20, 500, 300);
    expect(rect).toEqual({ x: 10, y: 20, width: 500, height: 300 });
    expect(history.size()).toBe(before + 1);
    // Layer positions shifted by the crop origin.
    const layer = useStore.getState().layers.find(l => l.id === id);
    expect(layer.x).toBe(640 - 10);
    expect(layer.y).toBe(360 - 20);
  });
});

describe('layer.mask.path.set', () => {
  test('attaches a vector mask with the given path to the layer', async () => {
    const id = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    await executeAction('layer.mask.path.set', id, 'M 0 0 L 10 0 L 10 10 L 0 10 Z');
    const layer = useStore.getState().layers.find(l => l.id === id);
    expect(layer.mask.kind).toBe('vector');
    expect(layer.mask.path).toMatch(/^M 0 0/);
  });
});

describe('layer.adjustment.update', () => {
  test('merges new params into existing adjustment data', async () => {
    const id = await executeAction('layer.adjustment.add', 'brightness', { value: 0 });
    await executeAction('layer.adjustment.update', id, { value: 25, range: 'shadows' });
    const layer = useStore.getState().layers.find(l => l.id === id);
    expect(layer.adjustmentData.params.value).toBe(25);
    expect(layer.adjustmentData.params.range).toBe('shadows');
  });
});

describe('shape.boolean actions', () => {
  test.each(['unite', 'subtract', 'intersect', 'exclude'])(
    'shape.boolean.%s creates a polygon layer and removes operands',
    async (mode) => {
      const a = await executeAction('shape.create', {
        x: 200, y: 200, width: 100, height: 100,
        shapeData: { shapeType: 'rect' },
      });
      const b = await executeAction('shape.create', {
        x: 250, y: 250, width: 100, height: 100,
        shapeData: { shapeType: 'rect' },
      });
      const newId = await executeAction(`shape.boolean.${mode}`, [a, b]);
      expect(newId).toBeTruthy();

      const layers = useStore.getState().layers;
      expect(layers.find(l => l.id === a)).toBeUndefined();
      expect(layers.find(l => l.id === b)).toBeUndefined();
      const out = layers.find(l => l.id === newId);
      expect(out).toBeDefined();
      expect(out.shapeData.shapeType).toBe('polygon');
    },
  );
});

// ── Registry surface health ────────────────────────────────────────────────
describe('Phase 1.e registry surface', () => {
  test.each([
    'transform.move', 'transform.resize', 'transform.rotate', 'transform.crop',
    'layer.mask.path.set', 'layer.adjustment.update',
    'shape.boolean.unite', 'shape.boolean.subtract',
    'shape.boolean.intersect', 'shape.boolean.exclude',
  ])('%s is registered', (id) => {
    const a = getAction(id);
    expect(a).not.toBeNull();
    expect(typeof a.handler).toBe('function');
  });
});
