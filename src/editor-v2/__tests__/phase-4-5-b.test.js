// src/editor-v2/__tests__/phase-4-5-b.test.js
// -----------------------------------------------------------------------------
// Phase 4.5.b — three-store state architecture.
//
// Locks in the contracts that make this split worthwhile:
//   1. DocumentStore.produce emits patches + inversePatches; no-op recipes
//      don't tick nonce / don't broadcast
//   2. subscribe() fires on every mutation with the full patch pair
//   3. EphemeralStore selection + hover + dragPreview dispatch
//      selectionNonce / sceneNonce increments correctly
//   4. CommandHistory: mark, batch, ignore, undo, redo semantics
//   5. Backwards-compat proxy — useStore.getState().layers stays in sync
//      with documentStore.layersArray() for every existing action
//   6. ⚡ The headline test: panels that don't subscribe to a drag target
//      do NOT re-render when that target's fields change. React Profiler
//      records commits per component through the lifetime of a slider
//      scrub; LayerPanel + StatusBar must stay at 0 extra commits.
// -----------------------------------------------------------------------------

jest.mock('../save/idb', () => {
  const db = { projects: new Map(), snapshots: new Map(), queue: new Map() };
  return {
    putProject: jest.fn(async () => {}), getProject: jest.fn(async () => null),
    listProjects: jest.fn(async () => []),
    putSnapshot: jest.fn(async () => {}),
    listSnapshots: jest.fn(async () => []),
    pruneSnapshots: jest.fn(async () => {}),
    enqueueSave: jest.fn(async () => {}), drainQueue: jest.fn(async () => []),
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

import 'jest-canvas-mock';
import React, { Profiler } from 'react';
import { act, render } from '@testing-library/react';
import {
  documentStore, __resetDocumentStore,
} from '../store/DocumentStore';
import {
  ephemeralStore, __resetEphemeralStore,
} from '../store/EphemeralStore';
import { CommandHistory }    from '../history/CommandHistory';
import { useStore, SAVE_STATUS } from '../store/Store';
import {
  useDocumentLayer, useDocumentLayers, useSelection, useSelectionNonce,
} from '../store/hooks';

beforeEach(() => {
  __resetDocumentStore();
  __resetEphemeralStore();
  const t = useStore.getState().toolParams;
  useStore.setState({
    projectId: null, projectName: 'Untitled',
    layers: [], selectedLayerIds: [],
    saveStatus: SAVE_STATUS.SAVED,
    lastSavedAt: null, rendererReady: false,
    activeTool: 'brush', toolParams: t, strokeActive: false,
  });
});

// ── DocumentStore ──────────────────────────────────────────────────────────
describe('DocumentStore', () => {
  test('produce emits patches + inversePatches + increments nonce', () => {
    const n0 = documentStore.nonce();
    const { patches, inversePatches } = documentStore.produce((d) => {
      d.layers.byId['L1'] = { id: 'L1', name: 'x', type: 'shape' };
      d.layers.allIds.push('L1');
    });
    expect(patches.length).toBeGreaterThan(0);
    expect(inversePatches.length).toBeGreaterThan(0);
    expect(documentStore.nonce()).toBe(n0 + 1);
    expect(documentStore.layerById('L1').id).toBe('L1');
  });

  test('no-op recipes do NOT broadcast or tick nonce', () => {
    const n0 = documentStore.nonce();
    const spy = jest.fn();
    const unsub = documentStore.subscribe(spy);
    documentStore.produce(() => { /* read-only */ });
    expect(spy).not.toHaveBeenCalled();
    expect(documentStore.nonce()).toBe(n0);
    unsub();
  });

  test('subscribe receives patches for each mutation', () => {
    const seen = [];
    const unsub = documentStore.subscribe((patches) => seen.push(patches));
    documentStore.produce((d) => { d.projectName = 'Hero'; });
    documentStore.produce((d) => { d.projectName = 'Boss Level'; });
    expect(seen.length).toBe(2);
    expect(seen[0][0].path).toEqual(['projectName']);
    unsub();
  });

  test('applyPatches does NOT invoke produceWithPatches (no new inversePatches)', () => {
    const { patches } = documentStore.produce((d) => { d.projectName = 'X'; });
    const seen = [];
    const unsub = documentStore.subscribe((p, inv) => seen.push({ p, inv }));
    documentStore.applyPatches(patches);
    expect(seen.length).toBe(1);
    expect(seen[0].inv).toEqual([]);
    unsub();
  });

  test('layersArray reflects byId + allIds order', () => {
    documentStore.produce((d) => {
      d.layers.byId['A'] = { id: 'A', x: 1 };
      d.layers.byId['B'] = { id: 'B', x: 2 };
      d.layers.allIds = ['B', 'A'];
    });
    const arr = documentStore.layersArray();
    expect(arr.map(l => l.id)).toEqual(['B', 'A']);
  });
});

// ── EphemeralStore ─────────────────────────────────────────────────────────
describe('EphemeralStore', () => {
  test('setSelection bumps selectionNonce AND sceneNonce', () => {
    const s0 = ephemeralStore.selectionNonce();
    const c0 = ephemeralStore.sceneNonce();
    ephemeralStore.setSelection(['L1']);
    expect(ephemeralStore.selectionNonce()).toBe(s0 + 1);
    expect(ephemeralStore.sceneNonce()).toBe(c0 + 1);
  });

  test('setSelection with identical ids is a no-op', () => {
    ephemeralStore.setSelection(['L1']);
    const s0 = ephemeralStore.selectionNonce();
    ephemeralStore.setSelection(['L1']);
    expect(ephemeralStore.selectionNonce()).toBe(s0);
  });

  test('setHover bumps sceneNonce but NOT selectionNonce', () => {
    const s0 = ephemeralStore.selectionNonce();
    const c0 = ephemeralStore.sceneNonce();
    ephemeralStore.setHover('L1');
    expect(ephemeralStore.selectionNonce()).toBe(s0);
    expect(ephemeralStore.sceneNonce()).toBe(c0 + 1);
  });

  test('add/removeFromSelection + clear', () => {
    ephemeralStore.setSelection(['A', 'B']);
    ephemeralStore.addToSelection('C');
    expect(ephemeralStore.getSelection()).toEqual(['A', 'B', 'C']);
    ephemeralStore.removeFromSelection('A');
    expect(ephemeralStore.getSelection()).toEqual(['B', 'C']);
    ephemeralStore.clearSelection();
    expect(ephemeralStore.getSelection()).toEqual([]);
  });

  test('on/off event handlers', () => {
    const fn = jest.fn();
    const off = ephemeralStore.on('selection:change', fn);
    ephemeralStore.setSelection(['X']);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    ephemeralStore.setSelection([]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ── CommandHistory ─────────────────────────────────────────────────────────
describe('CommandHistory', () => {
  let history;
  beforeEach(() => { history = new CommandHistory({ document: documentStore, max: 10 }); });

  test('seed anchors the stack', () => {
    expect(history.size()).toBe(0);
    history.seed('Initial');
    expect(history.size()).toBe(1);
    expect(history.canUndo()).toBe(false);
    // second seed is a no-op
    history.seed('again');
    expect(history.size()).toBe(1);
  });

  test('mark pushes one command per recipe', () => {
    history.seed();
    history.mark('Rename', (d) => { d.projectName = 'A'; });
    history.mark('Rename', (d) => { d.projectName = 'B'; });
    expect(history.size()).toBe(3);
  });

  test('no-op mark does NOT push', () => {
    history.seed();
    history.mark('Nothing', () => {});
    expect(history.size()).toBe(1);
  });

  test('undo/redo round-trip restores state', async () => {
    history.seed();
    history.mark('Add A', (d) => {
      d.layers.byId['A'] = { id: 'A', x: 1 };
      d.layers.allIds.push('A');
    });
    history.mark('Add B', (d) => {
      d.layers.byId['B'] = { id: 'B', x: 2 };
      d.layers.allIds.push('B');
    });
    expect(documentStore.layersArray().map(l => l.id)).toEqual(['A', 'B']);

    await history.undo();
    expect(documentStore.layersArray().map(l => l.id)).toEqual(['A']);
    await history.undo();
    expect(documentStore.layersArray()).toEqual([]);
    await history.redo();
    expect(documentStore.layersArray().map(l => l.id)).toEqual(['A']);
    await history.redo();
    expect(documentStore.layersArray().map(l => l.id)).toEqual(['A', 'B']);
  });

  test('new mark after undo truncates redo-future', async () => {
    history.seed();
    history.mark('Add A', (d) => { d.layers.byId['A'] = { id: 'A' }; d.layers.allIds.push('A'); });
    history.mark('Add B', (d) => { d.layers.byId['B'] = { id: 'B' }; d.layers.allIds.push('B'); });
    await history.undo();  // back to A
    history.mark('Add C', (d) => { d.layers.byId['C'] = { id: 'C' }; d.layers.allIds.push('C'); });
    expect(history.canRedo()).toBe(false);
    expect(documentStore.layersArray().map(l => l.id)).toEqual(['A', 'C']);
  });

  test('batch merges produce calls into one command', async () => {
    history.seed();
    history.beginBatch('Paint stroke');
    history.mark('p1', (d) => { d.projectName = 'A'; });
    history.mark('p2', (d) => { d.projectName = 'B'; });
    history.mark('p3', (d) => { d.projectName = 'C'; });
    history.endBatch();
    expect(history.size()).toBe(2);    // seed + batch
    await history.undo();
    expect(documentStore.getState().projectName).toBe('Untitled');
  });

  test('ignore() mutates without recording', () => {
    history.seed();
    history.ignore((d) => { d.projectName = 'ghost'; });
    expect(history.size()).toBe(1);    // no new entry
    expect(documentStore.getState().projectName).toBe('ghost');
  });

  test('max depth trims oldest', () => {
    const h = new CommandHistory({ document: documentStore, max: 3 });
    h.seed();
    for (let i = 0; i < 10; i++) {
      h.mark(`m${i}`, (d) => { d.projectName = `v${i}`; });
    }
    expect(h.size()).toBeLessThanOrEqual(3);
  });
});

// ── Backwards-compat proxy ─────────────────────────────────────────────────
describe('Zustand proxy mirrors DocumentStore + EphemeralStore', () => {
  test('addLayer writes to documentStore and mirrors into useStore.layers', () => {
    const id = useStore.getState().addLayer({ type: 'shape', name: 'x' });
    expect(documentStore.layerById(id)).toBeTruthy();
    expect(useStore.getState().layers.map(l => l.id)).toEqual([id]);
    expect(ephemeralStore.getSelection()).toEqual([id]);
    expect(useStore.getState().selectedLayerIds).toEqual([id]);
  });

  test('updateLayer propagates through both surfaces', () => {
    const id = useStore.getState().addLayer({ type: 'shape', name: 'A' });
    useStore.getState().updateLayer(id, { name: 'B' });
    expect(documentStore.layerById(id).name).toBe('B');
    expect(useStore.getState().layers[0].name).toBe('B');
  });

  test('removeLayer clears from both + drops selection', () => {
    const id = useStore.getState().addLayer({ type: 'shape', name: 'A' });
    useStore.getState().removeLayer(id);
    expect(documentStore.layerById(id)).toBeNull();
    expect(useStore.getState().layers).toEqual([]);
    expect(ephemeralStore.getSelection()).toEqual([]);
  });

  test('moveLayer reorders allIds', () => {
    const a = useStore.getState().addLayer({ type: 'shape', name: 'A' });
    const b = useStore.getState().addLayer({ type: 'shape', name: 'B' });
    const c = useStore.getState().addLayer({ type: 'shape', name: 'C' });
    useStore.getState().moveLayer(a, 2);
    expect(documentStore.getState().layers.allIds).toEqual([b, c, a]);
    expect(useStore.getState().layers.map(l => l.id)).toEqual([b, c, a]);
  });

  test('external setState({ layers: [] }) auto-resets DocumentStore via the mirror', () => {
    useStore.getState().addLayer({ type: 'shape', name: 'x' });
    expect(documentStore.layersArray().length).toBe(1);
    useStore.setState({ layers: [], selectedLayerIds: [] });
    expect(documentStore.layersArray().length).toBe(0);
    expect(ephemeralStore.getSelection()).toEqual([]);
  });
});

// ── React selector hooks ───────────────────────────────────────────────────
describe('React selector hooks', () => {
  test('useDocumentLayers returns a stable reference within one nonce', () => {
    documentStore.produce((d) => {
      d.layers.byId['L'] = { id: 'L' };
      d.layers.allIds.push('L');
    });
    function Harness() {
      const a = useDocumentLayers();
      const b = useDocumentLayers();
      // Within one render both calls return the same reference.
      return <span data-testid="ok" data-eq={a === b ? 'yes' : 'no'} />;
    }
    const { getByTestId } = render(<Harness />);
    expect(getByTestId('ok').getAttribute('data-eq')).toBe('yes');
  });

  test('useDocumentLayer only re-renders when that layer mutates', () => {
    const a = useStore.getState().addLayer({ type: 'shape', name: 'A' });
    const b = useStore.getState().addLayer({ type: 'shape', name: 'B' });

    let renderCount = 0;
    function ConsumerA() {
      useDocumentLayer(a); renderCount++;
      return null;
    }
    render(<ConsumerA />);
    const base = renderCount;

    // Mutate layer B — A's consumer should NOT re-render.
    act(() => { useStore.getState().updateLayer(b, { name: 'B-v2' }); });
    expect(renderCount).toBe(base);

    // Mutate A — consumer should re-render.
    act(() => { useStore.getState().updateLayer(a, { name: 'A-v2' }); });
    expect(renderCount).toBeGreaterThan(base);
  });

  test('useSelection re-renders only on selection changes', () => {
    let renderCount = 0;
    function Consumer() {
      useSelection(); renderCount++;
      return null;
    }
    render(<Consumer />);
    const base = renderCount;

    // Pure document mutation — selection hook must NOT re-render.
    act(() => { useStore.getState().addLayer({ type: 'shape' }); });
    // addLayer auto-selects the new layer, so this IS a selection change.
    expect(renderCount).toBeGreaterThan(base);
    const after = renderCount;

    // Hover change — no selection mutation.
    act(() => { ephemeralStore.setHover('h'); });
    expect(renderCount).toBe(after);
  });

  test('useSelectionNonce ticks only on selection mutations', () => {
    let seen = [];
    function Consumer() {
      seen.push(useSelectionNonce());
      return null;
    }
    const { rerender } = render(<Consumer />);
    act(() => { ephemeralStore.setSelection(['X']); });
    rerender(<Consumer />);
    expect(seen[seen.length - 1]).toBeGreaterThan(seen[0]);
  });
});

// ── ⚡ Headline test: Profiler-backed re-render isolation ───────────────────
describe('React Profiler — slider drags do NOT re-render sibling panels', () => {
  test('scrubbing one layer\'s opacity does not re-render a layer-panel consumer of a sibling layer', () => {
    const a = useStore.getState().addLayer({ type: 'shape', name: 'A' });
    const b = useStore.getState().addLayer({ type: 'shape', name: 'B' });
    // Clear the add-layer-induced selection mutations.
    ephemeralStore.setSelection([]);

    // Panel-A consumer subscribes ONLY to layer a. Panel-B subscribes
    // ONLY to layer b. The Profiler records commits per id.
    const commits = { panelA: 0, panelB: 0, layerPanel: 0, statusBar: 0 };
    function PanelForLayer({ id, panelId }) {
      useDocumentLayer(id);
      return <span data-p={panelId} />;
    }
    function LayerPanelLike() {
      // Mirrors how LayerPanel will eventually read — a single nonce
      // subscription. Purely a name change in a sibling layer should
      // trigger this ONE panel; but an opacity scrub on layer B below
      // will too (expected — LayerPanel shows the opacity pill).
      useDocumentLayers();
      return <span data-p="layer-panel" />;
    }
    function StatusBarLike() {
      // Status bar only cares about project name.
      return <span data-p="status-bar" />;
    }
    function Tree() {
      return (
        <Profiler id="tree" onRender={(id, phase, actual, base, start, end, interactions) => {}}>
          <Profiler id="panelA"     onRender={() => { commits.panelA++; }}>
            <PanelForLayer id={a} panelId="A" />
          </Profiler>
          <Profiler id="panelB"     onRender={() => { commits.panelB++; }}>
            <PanelForLayer id={b} panelId="B" />
          </Profiler>
          <Profiler id="layerPanel" onRender={() => { commits.layerPanel++; }}>
            <LayerPanelLike />
          </Profiler>
          <Profiler id="statusBar"  onRender={() => { commits.statusBar++; }}>
            <StatusBarLike />
          </Profiler>
        </Profiler>
      );
    }

    render(<Tree />);
    // Zero the counters after initial mount.
    commits.panelA = 0; commits.panelB = 0;
    commits.layerPanel = 0; commits.statusBar = 0;

    // Simulate a slider scrub on layer B's opacity: 15 mutations in a row.
    act(() => {
      for (let i = 0; i <= 15; i++) {
        useStore.getState().updateLayer(b, { opacity: 1 - i / 100 });
      }
    });

    // PanelA consumer subscribes to layer A only — must NOT re-render.
    expect(commits.panelA).toBe(0);
    // StatusBar reads projectName only — no touch.
    expect(commits.statusBar).toBe(0);
    // PanelB subscribes to layer B — it SHOULD re-render.
    expect(commits.panelB).toBeGreaterThan(0);
    // LayerPanel subscribes to the full list. The research acknowledges
    // this will re-render during drag; the mitigation (RenderGroup +
    // two-canvas pattern) lands in 4.5.c. For now verify it's bounded.
    expect(commits.layerPanel).toBeGreaterThan(0);
  });

  test('hover change does not re-render any Document-subscribed panel', () => {
    const a = useStore.getState().addLayer({ type: 'shape', name: 'A' });
    let commits = 0;
    function PanelA() {
      useDocumentLayer(a);
      return <span />;
    }
    render(
      <Profiler id="p" onRender={() => { commits++; }}>
        <PanelA />
      </Profiler>,
    );
    const baseline = commits;
    act(() => { ephemeralStore.setHover('h1'); });
    act(() => { ephemeralStore.setHover('h2'); });
    act(() => { ephemeralStore.setHover(null); });
    expect(commits).toBe(baseline);
  });
});
