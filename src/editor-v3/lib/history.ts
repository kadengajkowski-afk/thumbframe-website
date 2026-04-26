import {
  applyPatches,
  enablePatches,
  produceWithPatches,
  type Patch,
} from "immer";
import { nanoid } from "nanoid";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type {
  BlendMode,
  FontStyle,
  ImageLayer,
  Layer,
  TextAlign,
  TextStrokeStack,
} from "@/state/types";
import { MAX_TEXT_STROKES } from "@/state/types";

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

  // ── Text-layer setters ──────────────────────────────────────────────

  setText(id: string, text: string) {
    commit("Edit text", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.text = text;
    });
  },

  setFontFamily(id: string, fontFamily: string) {
    commit("Font", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.fontFamily = fontFamily;
    });
  },

  setFontSize(id: string, fontSize: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.fontSize = fontSize;
    };
    if (openStroke) mutate(run);
    else commit("Font size", run);
  },

  setFontWeight(id: string, fontWeight: number) {
    commit("Font weight", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.fontWeight = fontWeight;
    });
  },

  setFontStyle(id: string, fontStyle: FontStyle) {
    commit("Italic", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.fontStyle = fontStyle;
    });
  },

  setTextAlign(id: string, align: TextAlign) {
    commit("Text align", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.align = align;
    });
  },

  setLineHeight(id: string, lineHeight: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.lineHeight = lineHeight;
    };
    if (openStroke) mutate(run);
    else commit("Line height", run);
  },

  setLetterSpacing(id: string, letterSpacing: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.letterSpacing = letterSpacing;
    };
    if (openStroke) mutate(run);
    else commit("Letter spacing", run);
  },

  // ── Day 13: drop shadow ──────────────────────────────────────────────
  setShadowEnabled(id: string, enabled: boolean) {
    commit(enabled ? "Enable shadow" : "Disable shadow", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.shadowEnabled = enabled;
    });
  },

  setShadowColor(id: string, color: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.shadowColor = color;
    };
    if (openStroke) mutate(run);
    else commit("Shadow color", run);
  },

  setShadowAlpha(id: string, alpha: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.shadowAlpha = alpha;
    };
    if (openStroke) mutate(run);
    else commit("Shadow opacity", run);
  },

  setShadowBlur(id: string, blur: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.shadowBlur = blur;
    };
    if (openStroke) mutate(run);
    else commit("Shadow blur", run);
  },

  setShadowOffset(id: string, offsetX: number, offsetY: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") {
        l.shadowOffsetX = offsetX;
        l.shadowOffsetY = offsetY;
      }
    };
    if (openStroke) mutate(run);
    else commit("Shadow offset", run);
  },

  // ── Day 13: outer glow ───────────────────────────────────────────────
  setGlowEnabled(id: string, enabled: boolean) {
    commit(enabled ? "Enable glow" : "Disable glow", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowEnabled = enabled;
    });
  },

  setGlowColor(id: string, color: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowColor = color;
    };
    if (openStroke) mutate(run);
    else commit("Glow color", run);
  },

  setGlowAlpha(id: string, alpha: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowAlpha = alpha;
    };
    if (openStroke) mutate(run);
    else commit("Glow opacity", run);
  },

  setGlowDistance(id: string, distance: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowDistance = distance;
    };
    if (openStroke) mutate(run);
    else commit("Glow distance", run);
  },

  setGlowQuality(id: string, quality: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowQuality = quality;
    };
    if (openStroke) mutate(run);
    else commit("Glow quality", run);
  },

  setGlowOuterStrength(id: string, strength: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowOuterStrength = strength;
    };
    if (openStroke) mutate(run);
    else commit("Glow outer strength", run);
  },

  setGlowInnerStrength(id: string, strength: number) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowInnerStrength = strength;
    };
    if (openStroke) mutate(run);
    else commit("Glow inner strength", run);
  },

  // ── Day 13: stacked strokes (multi-stroke wiring lands commit 3) ────
  addStroke(id: string, stroke: TextStrokeStack) {
    commit("Add stroke", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (!l || l.type !== "text") return;
      const stack = l.strokes ?? [];
      if (stack.length >= MAX_TEXT_STROKES) return;
      l.strokes = [...stack, stroke];
    });
  },

  removeStroke(id: string, index: number) {
    commit("Remove stroke", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (!l || l.type !== "text" || !l.strokes) return;
      if (index < 0 || index >= l.strokes.length) return;
      l.strokes = l.strokes.filter((_, i) => i !== index);
    });
  },

  setStroke(id: string, index: number, patch: Partial<TextStrokeStack>) {
    const run = (layers: Layer[]) => {
      const l = layers.find((x) => x.id === id);
      if (!l || l.type !== "text" || !l.strokes) return;
      const cur = l.strokes[index];
      if (!cur) return;
      l.strokes[index] = { ...cur, ...patch };
    };
    if (openStroke) mutate(run);
    else commit("Edit stroke", run);
  },

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
