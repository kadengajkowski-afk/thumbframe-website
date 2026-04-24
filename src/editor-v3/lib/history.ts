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
    setLayers([]);
  },
};
