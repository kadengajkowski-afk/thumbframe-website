import {
  applyPatches,
  enablePatches,
  produceWithPatches,
  type Patch,
} from "immer";
import { nanoid } from "nanoid";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type { BlendMode, Layer } from "@/state/types";
import { textHistory } from "./history.text";
import { buildImageLayer } from "./buildImageLayer";

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

/** Day 15 split: shared by lib/history.text.ts so the text-effect
 * setters can route through the same commit / mutate / openStroke
 * machinery without duplicating it. Internal use only — not part of
 * the public history API. */
export const _historyInternals = {
  commit,
  mutate,
  isStrokeOpen: () => openStroke !== null,
};

const baseHistory = {
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

  /** Day 15: batch delete — ONE history entry covering all removals.
   * Calling deleteLayer in a loop would push N entries; this folds the
   * splice for every id into a single immer block. */
  deleteLayers(ids: readonly string[]) {
    if (ids.length === 0) return;
    const set = new Set(ids);
    commit(ids.length === 1 ? "Delete layer" : `Delete ${ids.length} layers`, (layers) => {
      // Walk back-to-front so splices don't invalidate later indices.
      for (let i = layers.length - 1; i >= 0; i--) {
        if (set.has(layers[i]!.id)) layers.splice(i, 1);
      }
    });
    const ui = useUiStore.getState();
    const remaining = ui.selectedLayerIds.filter((id) => !set.has(id));
    if (remaining.length !== ui.selectedLayerIds.length) {
      ui.setSelectedLayerIds(remaining);
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

  setLayerFillColor(id: string, color: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && (l.type === "rect" || l.type === "ellipse" || l.type === "text")) l.color = color;
    };
    if (openStroke) mutate(run);
    else commit("Fill color", run);
  },

  setLayerFillAlpha(id: string, alpha: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && (l.type === "rect" || l.type === "ellipse" || l.type === "text")) l.fillAlpha = alpha;
    };
    if (openStroke) mutate(run);
    else commit("Fill alpha", run);
  },

  setLayerStrokeColor(id: string, color: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && (l.type === "rect" || l.type === "ellipse" || l.type === "text")) l.strokeColor = color;
    };
    if (openStroke) mutate(run);
    else commit("Stroke color", run);
  },

  setLayerStrokeWidth(id: string, width: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && (l.type === "rect" || l.type === "ellipse" || l.type === "text")) l.strokeWidth = width;
    };
    if (openStroke) mutate(run);
    else commit("Stroke width", run);
  },

  setLayerStrokeAlpha(id: string, alpha: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && (l.type === "rect" || l.type === "ellipse" || l.type === "text")) l.strokeAlpha = alpha;
    };
    if (openStroke) mutate(run);
    else commit("Stroke alpha", run);
  },

  // ── Text-layer setters live in lib/history.text.ts (Day 12+13) ──
  // Spread back in below the `history` export so callers see one API.

  /** Compositor-driven auto-resize. Writes layer.width / height after
   * Pixi Text measures its bounds. Skips history (size is derived
   * state, not a user edit) by mutating directly. */
  setLayerSize(id: string, width: number, height: number) {
    mutate((layers) => {
      const l = layers.find((x) => x.id === id);
      if (l) {
        l.width = width;
        l.height = height;
      }
    });
  },

  /** Day 16: atomic box write — position + size in one mutation so
   * resize handles produce a single immer step per drag tick.
   * Stroke-aware: inside an open stroke (the resize gesture) it
   * mutates without pushing history; outside a stroke it commits as
   * one entry. Used by the Day 16 resize-handle pipeline. */
  setLayerBox(id: string, x: number, y: number, width: number, height: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l) {
        l.x = x;
        l.y = y;
        l.width = width;
        l.height = height;
      }
    };
    if (openStroke) mutate(run);
    else commit("Resize layer", run);
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

  /** Day 15: batch duplicate — ONE history entry, all duplicates
   * inserted right after their source, selection switches to the new
   * copies. Returns the new ids in source order. */
  duplicateLayers(ids: readonly string[]): string[] {
    if (ids.length === 0) return [];
    const current = useDocStore.getState().layers;
    // Pre-compute the source-id → new-id mapping in stable order so
    // the immer mutator doesn't re-derive anything from random order.
    const sources: { src: Layer; newId: string }[] = [];
    for (const id of ids) {
      const src = current.find((l) => l.id === id);
      if (src) sources.push({ src, newId: nanoid() });
    }
    if (sources.length === 0) return [];
    commit(
      sources.length === 1 ? `Duplicate ${sources[0]!.src.name}` : `Duplicate ${sources.length} layers`,
      (layers) => {
        // Walk back-to-front so each splice's insert position remains
        // valid for the next one.
        for (let i = sources.length - 1; i >= 0; i--) {
          const { src, newId } = sources[i]!;
          const idx = layers.findIndex((l) => l.id === src.id);
          if (idx < 0) continue;
          const copy: Layer = {
            ...src,
            id: newId,
            x: src.x + 20,
            y: src.y + 20,
            name: `${src.name} copy`,
          };
          layers.splice(idx + 1, 0, copy);
        }
      },
    );
    const newIds = sources.map((s) => s.newId);
    useUiStore.getState().setSelectedLayerIds(newIds);
    return newIds;
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

  /** Day 16: drop the open stroke and revert docStore.layers to its
   * pre-stroke state in one shot. Used by ESC / onCancel paths so a
   * canceled gesture never lands on the undo stack — even if immer
   * created new array references during the gesture. */
  cancelStroke() {
    if (!openStroke) return;
    const { startLayers } = openStroke;
    openStroke = null;
    setLayers(startLayers);
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

// Day 13 text-effect setters live in lib/history.text.ts to keep
// this file under the 400-line ceiling. Folded back into the public
// `history` object so callers see one merged API.
export const history: typeof baseHistory & typeof textHistory = Object.assign(
  baseHistory,
  textHistory,
);

