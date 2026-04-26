import { nanoid } from "nanoid";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type { BlendMode, Layer } from "@/state/types";
import { textHistory } from "./history.text";
import { buildImageLayer } from "./buildImageLayer";
import {
  beginStroke,
  canRedo,
  canUndo,
  commit,
  endStroke,
  isStrokeOpen,
  mutate,
  redo,
  undo,
  _resetInternals,
} from "./history.internal";

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
    if (isStrokeOpen()) mutate(run);
    else commit("Move layer", run);
  },

  setLayerOpacity(id: string, opacity: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l) l.opacity = opacity;
    };
    if (isStrokeOpen()) mutate(run);
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
    if (isStrokeOpen()) mutate(run);
    else commit("Fill color", run);
  },

  setLayerFillAlpha(id: string, alpha: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && (l.type === "rect" || l.type === "ellipse" || l.type === "text")) l.fillAlpha = alpha;
    };
    if (isStrokeOpen()) mutate(run);
    else commit("Fill alpha", run);
  },

  setLayerStrokeColor(id: string, color: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && (l.type === "rect" || l.type === "ellipse" || l.type === "text")) l.strokeColor = color;
    };
    if (isStrokeOpen()) mutate(run);
    else commit("Stroke color", run);
  },

  setLayerStrokeWidth(id: string, width: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && (l.type === "rect" || l.type === "ellipse" || l.type === "text")) l.strokeWidth = width;
    };
    if (isStrokeOpen()) mutate(run);
    else commit("Stroke width", run);
  },

  setLayerStrokeAlpha(id: string, alpha: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && (l.type === "rect" || l.type === "ellipse" || l.type === "text")) l.strokeAlpha = alpha;
    };
    if (isStrokeOpen()) mutate(run);
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

  beginStroke,
  endStroke,
  undo,
  redo,
  canUndo,
  canRedo,

  /** Testing hook: wipe stacks + reset docStore. Do not call in prod. */
  _reset: _resetInternals,
};

// Day 13 text-effect setters live in lib/history.text.ts to keep
// this file under the 400-line ceiling. Folded back into the public
// `history` object so callers see one merged API.
export const history: typeof baseHistory & typeof textHistory = Object.assign(
  baseHistory,
  textHistory,
);

