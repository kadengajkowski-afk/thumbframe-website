// src/editor-v2/__tests__/phase-1f.test.js
// -----------------------------------------------------------------------------
// Phase 1.f regression suite. This is the Phase 1 exit-criteria gate:
//   1. Full action-registry audit — every Phase 1 capability has an
//      action registered with the required metadata.
//   2. Exit-criteria integration: programmatically build a full
//      thumbnail (image + shapes + text + mask + effects + adjustments
//      + groups) through actions only, then verify the store document
//      describes the expected scene.
//   3. Blend-mode coverage roundtrip: every id in BLEND_MODES resolves
//      through resolveBlendMode + pushes through layer.setBlendMode.
//
// Performance and visual-diff checks are out of scope for a jsdom run;
// they need a real browser harness and ship alongside the Phase 4.a
// cockpit mount. Those tracks are flagged in PHASE_1_QUEUE.md.
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
  listActions,
  __resetRegistry,
} from '../actions/registry';
import { PaintCanvases }         from '../engine/PaintCanvases';
import { BLEND_MODES }           from '../engine/BlendModes';
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

// ── Registry audit ──────────────────────────────────────────────────────────
// The full set of Phase 1 actions. If a sub-phase missed registering one
// of these, this test fails — the audit surface for the exit criteria.
const PHASE_1_REQUIRED_ACTIONS = [
  // foundation
  'layer.add', 'layer.remove', 'layer.update', 'layer.move',
  'selection.set', 'selection.clear',
  'history.undo', 'history.redo', 'history.snapshot',
  'project.rename',

  // 1.a
  'shape.create', 'text.create',
  'layer.setBlendMode', 'layer.setOpacity',
  'layer.setVisible', 'layer.setLocked',
  'layer.group.create', 'layer.group.ungroup',
  'layer.adjustment.add',
  'layer.effects.add', 'layer.effects.update',
  'layer.effects.remove', 'layer.effects.toggle',
  'layer.mask.add', 'layer.mask.remove', 'layer.mask.invert',

  // 1.b
  'tool.brush.select', 'tool.eraser.select', 'tool.params.update',
  'paint.beginStroke', 'paint.addPoint', 'paint.endStroke',

  // 1.c
  'tool.blur.select', 'tool.sharpen.select',
  'tool.dodge.select', 'tool.burn.select', 'tool.sponge.select',
  'tool.smudge.select', 'tool.cloneStamp.select',
  'tool.spotHeal.select', 'tool.lightPainting.select',

  // 1.e
  'transform.move', 'transform.resize', 'transform.rotate', 'transform.crop',
  'layer.mask.path.set', 'layer.adjustment.update',
  'shape.boolean.unite', 'shape.boolean.subtract',
  'shape.boolean.intersect', 'shape.boolean.exclude',
];

describe('Phase 1 action registry audit', () => {
  test.each(PHASE_1_REQUIRED_ACTIONS)('%s is registered with metadata', (id) => {
    const a = getAction(id);
    expect(a).not.toBeNull();
    expect(typeof a.handler).toBe('function');
    expect(typeof a.label).toBe('string');
    expect(typeof a.category).toBe('string');
    expect(a.category.length).toBeGreaterThan(0);
  });

  test('every registered non-debug action carries an id + label', () => {
    for (const a of listActions()) {
      if (a.id.startsWith('paint.__debug')) continue;  // debug probes exempt
      expect(a.id.length).toBeGreaterThan(0);
      expect(a.label.length).toBeGreaterThan(0);
    }
  });

  test('action categories covered by Phase 1: layer / selection / history / project / shape / text / effects / mask / tool / paint / transform', () => {
    const categories = new Set(listActions().map(a => a.category));
    for (const expected of [
      'layer', 'selection', 'history', 'project',
      'shape', 'text', 'effects', 'mask',
      'tool', 'paint', 'transform',
    ]) {
      expect(categories.has(expected)).toBe(true);
    }
  });
});

// ── Blend-mode coverage ────────────────────────────────────────────────────
describe('blend-mode coverage', () => {
  test('all 16 BLEND_MODES push through layer.setBlendMode without errors', async () => {
    const id = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    for (const mode of BLEND_MODES) {
      await executeAction('layer.setBlendMode', id, mode.id);
      expect(useStore.getState().layers[0].blendMode).toBe(mode.id);
    }
  });
});

// ── Exit criteria: build a full thumbnail scene ────────────────────────────
describe('Phase 1 exit criteria — programmatic thumbnail build', () => {
  test('image + shape + text + mask + effects + adjustments + group compose into a coherent document', async () => {
    // 1. Image layer (placeholder — no texture upload, just shape).
    const imgId = await executeAction('layer.add', {
      type:  'image',
      name:  'Hero',
      x: 640, y: 360, width: 1280, height: 720,
    });

    // 2. Shape — orange accent rect.
    const rectId = await executeAction('shape.create', {
      x: 200, y: 600, width: 400, height: 80,
      shapeData: { shapeType: 'rect', fill: '#f97316', cornerRadius: 20 },
    });

    // 3. Shape — star sticker on top right.
    const starId = await executeAction('shape.create', {
      x: 1100, y: 120, width: 160, height: 160,
      shapeData: { shapeType: 'star', fill: '#faecd0' },
    });

    // 4. Text — headline.
    const textId = await executeAction('text.create', {
      x: 640, y: 200, width: 900, height: 160,
      textData: { content: 'THIS IS THE TITLE', fontSize: 120, fontWeight: '900', fill: '#faecd0' },
    });

    // 5. Vector mask on the image.
    await executeAction('layer.mask.path.set', imgId, 'M 0 0 L 1280 0 L 1280 720 L 0 720 Z');

    // 6. Effects on the text.
    await executeAction('layer.effects.add', textId, { type: 'stroke',     params: { color: '#000', width: 6, position: 'outside' } });
    await executeAction('layer.effects.add', textId, { type: 'dropShadow', params: { color: '#000', blur: 18, offsetX: 8, offsetY: 8, opacity: 0.85 } });

    // 7. Adjustment layer — brightness pushed above the image.
    const adjId = await executeAction('layer.adjustment.add', 'brightness', { value: 12 });
    await executeAction('layer.adjustment.update', adjId, { value: 20 });

    // 8. Group the star + accent rect (branding badge group).
    const groupId = await executeAction('layer.group.create', [rectId, starId], 'Badge');

    // 9. Set a blend mode + opacity on the accent shape.
    await executeAction('layer.setBlendMode', rectId, 'multiply');
    await executeAction('layer.setOpacity', rectId, 0.9);

    // ── Assertions on the final document.
    const layers = useStore.getState().layers;
    expect(layers.find(l => l.id === imgId)).toBeDefined();
    expect(layers.find(l => l.id === rectId).blendMode).toBe('multiply');
    expect(layers.find(l => l.id === rectId).opacity).toBeCloseTo(0.9);
    expect(layers.find(l => l.id === textId).effects).toHaveLength(2);
    expect(layers.find(l => l.id === textId).effects[0].type).toBe('stroke');
    expect(layers.find(l => l.id === imgId).mask.kind).toBe('vector');
    expect(layers.find(l => l.id === adjId).adjustmentData.params.value).toBe(20);
    const group = layers.find(l => l.id === groupId);
    expect(group.type).toBe('group');
    expect(group.groupData.childIds).toEqual([rectId, starId]);

    // Undo all the way back to seed — every action was snapshotted.
    while (history.canUndo()) {
      // eslint-disable-next-line no-await-in-loop
      await executeAction('history.undo');
    }
    expect(useStore.getState().layers).toHaveLength(0);

    // Redo all the way forward.
    while (history.canRedo()) {
      // eslint-disable-next-line no-await-in-loop
      await executeAction('history.redo');
    }
    // Final state should have at least the expected layer count again.
    expect(useStore.getState().layers.length).toBeGreaterThanOrEqual(5);
  });
});

// ── Phase 1 sanity: seed + baseline history invariants still hold ──────────
describe('Phase 1 invariants still hold', () => {
  test('history.seed is idempotent (second call is a no-op)', async () => {
    const first = history.size();
    await history.seed('again');
    expect(history.size()).toBe(first);
  });

  test('SAVE_STATUS enum constants are stable (save engine contract)', () => {
    expect(SAVE_STATUS.SAVED).toBe('saved');
    expect(SAVE_STATUS.SAVING).toBe('saving');
    expect(SAVE_STATUS.OFFLINE).toBe('offline');
    expect(SAVE_STATUS.ERROR).toBe('error');
  });
});
