import {
  applyPatches,
  enablePatches,
  produceWithPatches,
  type Patch,
} from "immer";
import { nanoid } from "nanoid";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type { BlendMode, ImageLayer, Layer } from "@/state/types";

// Canvas logical size. Lives here until docStore gains a `canvas` field
// (Cycle 2 when export + resize are in scope).
const CANVAS_W = 1280;
const CANVAS_H = 720;
// Images bigger than the canvas scale down to this fraction.
const CANVAS_FILL = 0.9;

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

  addImageLayer(bitmap: ImageBitmap, name: string) {
    const layer = buildImageLayer(bitmap, name);
    commit(`Add ${layer.name}`, (layers) => {
      layers.push(layer);
    });
    return layer;
  },

  deleteLayer(id: string) {
    commit("Delete layer", (layers) => {
      const idx = layers.findIndex((l) => l.id === id);
      if (idx >= 0) layers.splice(idx, 1);
    });
    // Stale selection cleanup. Every deletion path routes through
    // history, so any caller that deletes a layer gets this for free.
    const ui = useUiStore.getState();
    if (ui.selectedLayerIds.includes(id)) {
      ui.setSelectedLayerIds(ui.selectedLayerIds.filter((x) => x !== id));
    }
  },

  moveLayer(id: string, x: number, y: number) {
    const run = (layers: Layer[]) => {
      const layer = layers.find((l) => l.id === id);
      if (layer) {
        layer.x = x;
        layer.y = y;
      }
    };
    if (openStroke) mutate(run);
    else commit("Move layer", run);
  },

  setLayerOpacity(id: string, opacity: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l) l.opacity = opacity;
    };
    if (openStroke) mutate(run);
    else commit("Opacity", run);
  },

  toggleLayerVisibility(id: string) {
    commit("Toggle visibility", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l) l.hidden = !l.hidden;
    });
  },

  toggleLayerLock(id: string) {
    commit("Toggle lock", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l) l.locked = !l.locked;
    });
  },

  setLayerName(id: string, name: string) {
    commit("Rename layer", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l) l.name = name;
    });
  },

  setLayerBlendMode(id: string, mode: BlendMode) {
    commit("Blend mode", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l) l.blendMode = mode;
    });
  },

  reorderLayer(id: string, toIndex: number) {
    commit("Reorder layer", (layers) => {
      const from = layers.findIndex((l) => l.id === id);
      if (from < 0) return;
      const clamped = Math.max(0, Math.min(layers.length - 1, toIndex));
      if (from === clamped) return;
      const [moved] = layers.splice(from, 1);
      if (moved) layers.splice(clamped, 0, moved);
    });
  },

  /** Clone `id` into a new layer offset by +20px. Selects the dup.
   * Returns the new layer's id (or null if `id` wasn't found). */
  duplicateLayer(id: string): string | null {
    const current = useDocStore.getState().layers;
    const source = current.find((l) => l.id === id);
    if (!source) return null;
    const newId = nanoid();
    // ImageLayer carries a non-plain ImageBitmap — share the same
    // reference, which is fine because layers are append-only and we
    // never mutate a bitmap through the layer.
    const copy: Layer = {
      ...source,
      id: newId,
      x: source.x + 20,
      y: source.y + 20,
      name: `${source.name} copy`,
    };
    commit(`Duplicate ${source.name}`, (layers) => {
      const idx = layers.findIndex((l) => l.id === id);
      if (idx < 0) return;
      layers.splice(idx + 1, 0, copy);
    });
    useUiStore.getState().setSelectedLayerIds([newId]);
    return newId;
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

function buildImageLayer(bitmap: ImageBitmap, name: string): ImageLayer {
  const natW = bitmap.width;
  const natH = bitmap.height;

  let width = natW;
  let height = natH;
  if (natW >= CANVAS_W || natH >= CANVAS_H) {
    const scale = Math.min(
      (CANVAS_W * CANVAS_FILL) / natW,
      (CANVAS_H * CANVAS_FILL) / natH,
    );
    width = Math.round(natW * scale);
    height = Math.round(natH * scale);
  }
  const x = Math.round((CANVAS_W - width) / 2);
  const y = Math.round((CANVAS_H - height) / 2);

  return {
    id: nanoid(),
    type: "image",
    x,
    y,
    width,
    height,
    opacity: 1,
    name,
    hidden: false,
    locked: false,
    blendMode: "normal",
    bitmap,
    naturalWidth: natW,
    naturalHeight: natH,
  };
}
