import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { pixiToHex } from "./color";
import type { Layer } from "@/state/types";

/** Day 40 — compact canvas snapshot for tool-use system prompts.
 *
 * The model needs to know which layers exist (id, type, key
 * properties) and which one is focused so it can pick a layer_id
 * for set_layer_*. Sent as JSON appended to the system prompt by
 * the backend (lib/aiPrompts.js).
 *
 * Kept tiny on purpose — full canvas serialization would blow the
 * input-token budget. We expose just the fields the 10 Day-40 tools
 * actually read (id, type, name, x/y/w/h, color, opacity, plus text
 * content + font for text layers). */

export type CanvasStateSnapshot = {
  canvas: { width: number; height: number };
  focused_layer_id: string | null;
  layer_count: number;
  layers: SerializedLayer[];
};

type SerializedLayer = {
  id: string;
  type: Layer["type"];
  name: string;
  x: number; y: number;
  width: number; height: number;
  opacity: number;
  hidden?: boolean;
  locked?: boolean;
  color?: string; // #RRGGBB for rect/ellipse/text
  text?: string;
  font_family?: string;
  font_size?: number;
};

export function buildCanvasState(): CanvasStateSnapshot {
  const layers = useDocStore.getState().layers;
  const focused = useUiStore.getState().selectedLayerIds[0] ?? null;
  return {
    canvas: { width: 1280, height: 720 },
    focused_layer_id: focused,
    layer_count: layers.length,
    layers: layers.map(serializeLayer),
  };
}

function serializeLayer(layer: Layer): SerializedLayer {
  const base: SerializedLayer = {
    id: layer.id,
    type: layer.type,
    name: layer.name,
    x: Math.round(layer.x),
    y: Math.round(layer.y),
    width: Math.round(layer.width),
    height: Math.round(layer.height),
    opacity: round2(layer.opacity),
  };
  if (layer.hidden) base.hidden = true;
  if (layer.locked) base.locked = true;

  if (layer.type === "rect" || layer.type === "ellipse" || layer.type === "text") {
    base.color = pixiToHex((layer as Layer & { color: number }).color);
  }
  if (layer.type === "text") {
    base.text = layer.text;
    base.font_family = layer.fontFamily;
    base.font_size = Math.round(layer.fontSize);
  }
  return base;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
