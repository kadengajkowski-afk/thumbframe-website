import {
  applyPatches,
  enablePatches,
  produceWithPatches,
  type Patch,
} from "immer";
import { useDocStore } from "@/state/docStore";
import type { Layer } from "@/state/types";

enablePatches();

const MAX_HISTORY = 100;

type Entry = {
  patches: Patch[];
  inverse: Patch[];
  label: string;
};

// Stacks live at module scope: one editor instance per tab, and Zustand
// is the only source of document truth — the stacks just replay patches
// against docStore. No parallel state, no window globals.
let undoStack: Entry[] = [];
let redoStack: Entry[] = [];

// Stroke coalescing: `beginStroke` captures the layer list snapshot; any
// history setters called while a stroke is open mutate docStore directly
// (no undo entry per tick). `endStroke` pushes ONE entry covering the
// full delta. Used by the opacity slider so dragging doesn't create 100
// history entries.
let openStroke: { label: string; startLayers: Layer[] } | null = null;

function setLayers(next: Layer[]) {
  useDocStore.setState({ layers: next });
}

function commit(label: string, mutator: (draft: Layer[]) => void) {
  const current = useDocStore.getState().layers;
  const [next, patches, inverse] = produceWithPatches(current, mutator);
  if (patches.length === 0) return;
  setLayers(next);
  undoStack.push({ patches, inverse, label });
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
}

// Used during an open stroke: applies the change to docStore without
// pushing anything onto the history stacks.
function mutate(mutator: (draft: Layer[]) => void) {
  const current = useDocStore.getState().layers;
  const [next] = produceWithPatches(current, mutator);
  setLayers(next);
}

export const history = {
  addLayer(layer: Layer) {
    commit(`Add ${layer.name}`, (layers) => {
      layers.push(layer);
    });
  },

  deleteLayer(id: string) {
    commit("Delete layer", (layers) => {
      const idx = layers.findIndex((l) => l.id === id);
      if (idx >= 0) layers.splice(idx, 1);
    });
  },

  moveLayer(id: string, x: number, y: number) {
    commit("Move layer", (layers) => {
      const layer = layers.find((l) => l.id === id);
      if (layer) {
        layer.x = x;
        layer.y = y;
      }
    });
  },

  setLayerOpacity(id: string, opacity: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l) l.opacity = opacity;
    };
    if (openStroke) mutate(run);
    else commit("Opacity", run);
  },

  beginStroke(label: string) {
    if (openStroke) return;
    openStroke = { label, startLayers: useDocStore.getState().layers };
  },

  endStroke() {
    if (!openStroke) return;
    const { label, startLayers } = openStroke;
    const endLayers = useDocStore.getState().layers;
    openStroke = null;
    if (startLayers === endLayers) return;
    // Coarse patch: replace the full layer list. Fine for Cycle 1; we
    // can emit per-field patches once more setters are stroke-aware.
    const patches: Patch[] = [{ op: "replace", path: [], value: endLayers }];
    const inverse: Patch[] = [
      { op: "replace", path: [], value: startLayers },
    ];
    undoStack.push({ patches, inverse, label });
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
  },

  undo() {
    const entry = undoStack.pop();
    if (!entry) return;
    setLayers(applyPatches(useDocStore.getState().layers, entry.inverse));
    redoStack.push(entry);
  },

  redo() {
    const entry = redoStack.pop();
    if (!entry) return;
    setLayers(applyPatches(useDocStore.getState().layers, entry.patches));
    undoStack.push(entry);
  },

  canUndo() {
    return undoStack.length > 0;
  },

  canRedo() {
    return redoStack.length > 0;
  },

  /** Testing hook: wipe stacks + reset docStore. Do not call in prod. */
  _reset() {
    undoStack = [];
    redoStack = [];
    openStroke = null;
    setLayers([]);
  },
};
