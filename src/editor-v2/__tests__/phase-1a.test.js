// src/editor-v2/__tests__/phase-1a.test.js
// -----------------------------------------------------------------------------
// Phase 1.a regression suite. Covers:
//   • shape creation (all 8 types)
//   • text creation
//   • blend-mode set (all 16, including HSL fallback)
//   • opacity clamp
//   • group create / ungroup topology
//   • undo / redo correctness, including group topology preservation
//   • nested undo/redo chains
//   • undo past seed is a safe no-op
//   • new action after undo truncates the redo future
//   • store-subscribe notifications fire on every mutation (save engine path)
//
// Jest runs in jsdom. IndexedDB and the Supabase client are mocked at the
// module level so we exercise the real History / Store / registry code
// paths without a browser.
// -----------------------------------------------------------------------------

// ── Module mocks (hoisted by Jest before any imports) ─────────────────────
jest.mock('../save/idb', () => {
  // In-memory IDB replacement. Implements just enough of the real API.
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
    pruneSnapshots: jest.fn(async (projectId, keep) => {
      const all = [...db.snapshots.values()]
        .filter(s => s.projectId === projectId)
        .sort((a, b) => a.timestamp - b.timestamp);
      const toDelete = all.slice(0, Math.max(0, all.length - keep));
      for (const s of toDelete) db.snapshots.delete(s.id);
    }),

    enqueueSave: jest.fn(async (e) => { db.queue.set(e.id, e); }),
    drainQueue:  jest.fn(async () => {
      const all = [...db.queue.values()];
      db.queue.clear();
      return all;
    }),
    peekQueue:   jest.fn(async () => [...db.queue.values()]),

    __resetForTests: jest.fn(async () => {
      db.projects.clear();
      db.snapshots.clear();
      db.queue.clear();
    }),
  };
});

jest.mock('../../supabaseClient', () => ({
  __esModule: true,
  default: {
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}));

// ── Imports ─────────────────────────────────────────────────────────────────
import { useStore, SAVE_STATUS }       from '../store/Store';
import { History }                      from '../history/History';
import {
  registerFoundationActions,
  executeAction,
  listActions,
  getAction,
  __resetRegistry,
} from '../actions/registry';
import { BLEND_MODES, resolveBlendMode } from '../engine/BlendModes';
import * as idb from '../save/idb';

// ── Shared setup ────────────────────────────────────────────────────────────
let history;

async function resetAll() {
  __resetRegistry();
  await idb.__resetForTests();
  useStore.setState({
    projectId:        null,
    projectName:      'Untitled',
    layers:           [],
    selectedLayerIds: [],
    saveStatus:       SAVE_STATUS.SAVED,
    lastSavedAt:      null,
    rendererReady:    false,
  });
  history = new History({ store: useStore, projectId: 'test-project', max: 50 });
  await history.load();
  registerFoundationActions({ store: useStore, history });
  await history.seed('Initial state');
}

beforeEach(resetAll);

// ── Shape creation ──────────────────────────────────────────────────────────
describe('shape.create', () => {
  test.each([
    'rect', 'circle', 'ellipse', 'polygon', 'star', 'arrow', 'line', 'speechBubble',
  ])('creates a %s shape', async (shapeType) => {
    const id = await executeAction('shape.create', { shapeData: { shapeType } });
    const layers = useStore.getState().layers;
    expect(layers).toHaveLength(1);
    expect(layers[0].id).toBe(id);
    expect(layers[0].type).toBe('shape');
    expect(layers[0].shapeData.shapeType).toBe(shapeType);
  });

  test('respects width/height overrides', async () => {
    await executeAction('shape.create', {
      width: 500, height: 300,
      shapeData: { shapeType: 'rect' },
    });
    const layer = useStore.getState().layers[0];
    expect(layer.width).toBe(500);
    expect(layer.height).toBe(300);
  });
});

// ── Text creation ───────────────────────────────────────────────────────────
describe('text.create', () => {
  test('creates a text layer with defaults', async () => {
    const id = await executeAction('text.create', {});
    const layer = useStore.getState().layers[0];
    expect(layer.id).toBe(id);
    expect(layer.type).toBe('text');
    expect(layer.textData.content).toBe('Your text');
    expect(layer.textData.fontSize).toBe(96);
  });

  test('respects content override', async () => {
    await executeAction('text.create', { textData: { content: 'Hello' } });
    expect(useStore.getState().layers[0].textData.content).toBe('Hello');
  });
});

// ── Blend modes ─────────────────────────────────────────────────────────────
describe('blend modes', () => {
  test('all 16 canonical ids accepted and stored on the layer', async () => {
    const id = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    for (const mode of BLEND_MODES) {
      await executeAction('layer.setBlendMode', id, mode.id);
      expect(useStore.getState().layers[0].blendMode).toBe(mode.id);
    }
  });

  test('resolveBlendMode: 12 native modes map to their Pixi string', () => {
    const native = [
      ['normal', 'normal'], ['multiply', 'multiply'], ['screen', 'screen'],
      ['overlay', 'overlay'], ['darken', 'darken'], ['lighten', 'lighten'],
      ['color-dodge', 'color-dodge'], ['color-burn', 'color-burn'],
      ['hard-light', 'hard-light'], ['soft-light', 'soft-light'],
      ['difference', 'difference'], ['exclusion', 'exclusion'],
    ];
    for (const [id, pixi] of native) {
      const r = resolveBlendMode(id);
      expect(r.pixi).toBe(pixi);
      expect(r.native).toBe(true);
    }
  });

  test('resolveBlendMode: 4 HSL modes resolve to normal with native=false', () => {
    for (const id of ['hue', 'saturation', 'color', 'luminosity']) {
      const r = resolveBlendMode(id);
      expect(r.pixi).toBe('normal');
      expect(r.native).toBe(false);
    }
  });

  test('resolveBlendMode: legacy aliases (color_dodge, add) map correctly', () => {
    expect(resolveBlendMode('color_dodge').pixi).toBe('color-dodge');
    expect(resolveBlendMode('add').pixi).toBe('screen');      // documented alias
    expect(resolveBlendMode(undefined).pixi).toBe('normal');
    expect(resolveBlendMode('bogus').pixi).toBe('normal');
  });
});

// ── Opacity ─────────────────────────────────────────────────────────────────
describe('opacity', () => {
  test('layer.setOpacity stores a valid value and clamps out-of-range inputs', async () => {
    const id = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    await executeAction('layer.setOpacity', id, 0.5);
    expect(useStore.getState().layers[0].opacity).toBe(0.5);

    await executeAction('layer.setOpacity', id, 2);
    expect(useStore.getState().layers[0].opacity).toBe(1);

    await executeAction('layer.setOpacity', id, -1);
    expect(useStore.getState().layers[0].opacity).toBe(0);
  });

  test('layer.setOpacity is NOT snapshotted (transient slider edits)', async () => {
    const id = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    const before = history.size();
    await executeAction('layer.setOpacity', id, 0.5);
    await executeAction('layer.setOpacity', id, 0.3);
    await executeAction('layer.setOpacity', id, 0.8);
    // Opacity changes should not push history entries — otherwise a
    // slider drag would flood the stack.
    expect(history.size()).toBe(before);
  });
});

// ── Group + ungroup ─────────────────────────────────────────────────────────
describe('group / ungroup', () => {
  test('layer.group.create attaches childIds and keeps children in the flat array', async () => {
    const a = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    const b = await executeAction('shape.create', { shapeData: { shapeType: 'circle' } });
    const g = await executeAction('layer.group.create', [a, b], 'Hero');

    const layers = useStore.getState().layers;
    expect(layers).toHaveLength(3);
    const group = layers.find(l => l.id === g);
    expect(group.type).toBe('group');
    expect(group.groupData.childIds).toEqual([a, b]);
    // Children still present in the flat array
    expect(layers.find(l => l.id === a)).toBeDefined();
    expect(layers.find(l => l.id === b)).toBeDefined();
  });

  test('layer.group.ungroup removes only the group layer', async () => {
    const a = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    const b = await executeAction('shape.create', { shapeData: { shapeType: 'circle' } });
    const g = await executeAction('layer.group.create', [a, b]);
    await executeAction('layer.group.ungroup', g);

    const layers = useStore.getState().layers;
    expect(layers.map(l => l.id)).toEqual([a, b]);
  });
});

// ── Undo / redo ─────────────────────────────────────────────────────────────
describe('undo / redo', () => {
  test('single create → undo removes; redo restores', async () => {
    const id = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    expect(useStore.getState().layers).toHaveLength(1);

    await executeAction('history.undo');
    expect(useStore.getState().layers).toHaveLength(0);

    await executeAction('history.redo');
    const layers = useStore.getState().layers;
    expect(layers).toHaveLength(1);
    expect(layers[0].id).toBe(id);
  });

  test('three creates → three undos → three redos round-trip', async () => {
    const a = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    const b = await executeAction('shape.create', { shapeData: { shapeType: 'circle' } });
    const c = await executeAction('shape.create', { shapeData: { shapeType: 'star' } });
    expect(useStore.getState().layers.map(l => l.id)).toEqual([a, b, c]);

    await executeAction('history.undo');
    await executeAction('history.undo');
    await executeAction('history.undo');
    expect(useStore.getState().layers).toHaveLength(0);

    await executeAction('history.redo');
    await executeAction('history.redo');
    await executeAction('history.redo');
    expect(useStore.getState().layers.map(l => l.id)).toEqual([a, b, c]);
  });

  test('undo past seed is a safe no-op', async () => {
    await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    await executeAction('history.undo');                     // back to seed
    const ok1 = await executeAction('history.undo');         // should no-op
    const ok2 = await executeAction('history.undo');         // still no-op
    expect(useStore.getState().layers).toHaveLength(0);
    expect(ok1).toBe(false);
    expect(ok2).toBe(false);
    expect(history.canUndo()).toBe(false);
  });

  test('redo past latest is a safe no-op', async () => {
    await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    const ok = await executeAction('history.redo');  // nothing newer
    expect(ok).toBe(false);
    expect(useStore.getState().layers).toHaveLength(1);
  });

  test('new action after undo clears the redo stack', async () => {
    const a = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    const b = await executeAction('shape.create', { shapeData: { shapeType: 'circle' } });
    await executeAction('history.undo');  // drop b
    expect(useStore.getState().layers.map(l => l.id)).toEqual([a]);

    const c = await executeAction('shape.create', { shapeData: { shapeType: 'star' } });
    expect(useStore.getState().layers.map(l => l.id)).toEqual([a, c]);

    // The old b-future was truncated. Redo should be a no-op.
    const canRedo = history.canRedo();
    expect(canRedo).toBe(false);
    await executeAction('history.redo');
    expect(useStore.getState().layers.map(l => l.id)).toEqual([a, c]);
    expect(useStore.getState().layers.find(l => l.id === b)).toBeUndefined();
  });

  test('group.create undo/redo preserves topology', async () => {
    const a = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    const b = await executeAction('shape.create', { shapeData: { shapeType: 'circle' } });
    const g = await executeAction('layer.group.create', [a, b], 'Hero');
    expect(useStore.getState().layers.map(l => l.id)).toEqual([a, b, g]);

    await executeAction('history.undo');
    expect(useStore.getState().layers.map(l => l.id)).toEqual([a, b]);
    expect(useStore.getState().layers.find(l => l.type === 'group')).toBeUndefined();

    await executeAction('history.redo');
    const layers = useStore.getState().layers;
    expect(layers.map(l => l.id)).toEqual([a, b, g]);
    const group = layers.find(l => l.type === 'group');
    expect(group).toBeDefined();
    expect(group.groupData.childIds).toEqual([a, b]);
  });

  test('undo/redo preserves layer identity (same ids across round-trip)', async () => {
    const id = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    await executeAction('history.undo');
    await executeAction('history.redo');
    expect(useStore.getState().layers[0].id).toBe(id);
  });

  test('undo after ungroup restores the group', async () => {
    const a = await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
    const b = await executeAction('shape.create', { shapeData: { shapeType: 'circle' } });
    const g = await executeAction('layer.group.create', [a, b]);
    await executeAction('layer.group.ungroup', g);
    expect(useStore.getState().layers.find(l => l.type === 'group')).toBeUndefined();

    await executeAction('history.undo');
    const group = useStore.getState().layers.find(l => l.type === 'group');
    expect(group).toBeDefined();
    expect(group.id).toBe(g);
    expect(group.groupData.childIds).toEqual([a, b]);
  });
});

// ── Store subscribe (save-engine path) ──────────────────────────────────────
describe('store subscribe', () => {
  test('every mutation emits a layers-change notification', async () => {
    const layerChanges = [];
    const unsub = useStore.subscribe((state, prev) => {
      if (state.layers !== prev.layers) layerChanges.push(state.layers.length);
    });

    try {
      await executeAction('shape.create', { shapeData: { shapeType: 'rect' } });
      await executeAction('text.create',  {});
      await executeAction('history.undo');
      await executeAction('history.redo');
      expect(layerChanges).toEqual([1, 2, 1, 2]);
    } finally { unsub(); }
  });

  test('SAVE_STATUS enum values are stable', () => {
    expect(SAVE_STATUS.SAVED).toBe('saved');
    expect(SAVE_STATUS.SAVING).toBe('saving');
    expect(SAVE_STATUS.OFFLINE).toBe('offline');
    expect(SAVE_STATUS.ERROR).toBe('error');
  });
});

// ── Registry health ─────────────────────────────────────────────────────────
describe('action registry', () => {
  test('foundation + phase-1a actions are registered with required fields', () => {
    const required = [
      'layer.add', 'layer.remove', 'layer.update', 'layer.move',
      'selection.set', 'selection.clear',
      'history.undo', 'history.redo', 'history.snapshot',
      'project.rename',
      'shape.create', 'text.create',
      'layer.setBlendMode', 'layer.setOpacity',
      'layer.setVisible', 'layer.setLocked',
      'layer.group.create', 'layer.group.ungroup',
      'layer.adjustment.add',
      'layer.effects.add', 'layer.effects.update',
      'layer.effects.remove', 'layer.effects.toggle',
      'layer.mask.add', 'layer.mask.remove', 'layer.mask.invert',
    ];
    for (const id of required) {
      const a = getAction(id);
      expect(a).not.toBeNull();
      expect(typeof a.handler).toBe('function');
      expect(typeof a.label).toBe('string');
      expect(typeof a.category).toBe('string');
    }
  });

  test('listActions returns at least the required set', () => {
    const count = listActions().length;
    expect(count).toBeGreaterThanOrEqual(26);
  });

  test('unknown action id returns undefined without throwing', () => {
    const result = executeAction('nope.does.not.exist');
    expect(result).toBeUndefined();
  });
});
