import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { pixiToHex } from "./color";
import type { Layer } from "@/state/types";
import { detectIssues } from "./nudgeDetectors";

/** Day 40 — compact canvas snapshot for tool-use system prompts.
 *
 * Day 47 quality overhaul — every layer entry now carries computed
 * bounds + percentage_of_canvas + is_off_canvas + overlaps_timestamp_zone
 * + z_order. A new `canvas_summary` block above the layer list gives
 * the model facts about composition (status: empty/sparse/balanced/
 * cluttered) and a `detected_issues` array (off-canvas, dominates,
 * timestamp overlap, stacked, missing title, generic background).
 *
 * The model now starts every turn with FACTS instead of having to
 * infer them from raw layer JSON. */

const CANVAS_W = 1280;
const CANVAS_H = 720;
const CANVAS_AREA = CANVAS_W * CANVAS_H;
const TIMESTAMP_X0 = 1080;
const TIMESTAMP_Y0 = 640;

export type CompositionStatus = "empty" | "sparse" | "balanced" | "cluttered";

export type CanvasSummary = {
  total_layers: number;
  has_image_layer: boolean;
  has_title_text: boolean;
  composition_status: CompositionStatus;
  detected_issues: string[];
};

export type CanvasStateSnapshot = {
  canvas: { width: number; height: number };
  focused_layer_id: string | null;
  layer_count: number;
  canvas_summary: CanvasSummary;
  layers: SerializedLayer[];
};

type SerializedLayer = {
  id: string;
  type: Layer["type"];
  name: string;
  x: number; y: number;
  width: number; height: number;
  /** Day 47 — bottom-right corner (x+width, y+height). Saves the
   * model arithmetic when checking off-canvas. */
  right: number;
  bottom: number;
  opacity: number;
  hidden?: boolean;
  locked?: boolean;
  color?: string; // #RRGGBB for rect/ellipse/text
  text?: string;
  font_family?: string;
  font_size?: number;
  /** Day 47 — fraction of total canvas area this layer covers, 0..1
   * rounded to 2 decimals. Reads as percentage in the prompt. */
  percentage_of_canvas: number;
  /** Day 47 — true if any part of the layer extends past 1280×720
   * with an 8-px tolerance for floating-point drift. */
  is_off_canvas: boolean;
  /** Day 47 — true if the layer overlaps the bottom-right 200×80
   * timestamp zone where YouTube's duration pill sits. */
  overlaps_timestamp_zone: boolean;
  /** Day 47 — index in the layer stack (0 = back, N-1 = front). */
  z_order: number;
};

export function buildCanvasState(): CanvasStateSnapshot {
  const layers = useDocStore.getState().layers;
  const focused = useUiStore.getState().selectedLayerIds[0] ?? null;
  const serialized = layers.map((layer, idx) => serializeLayer(layer, idx));
  return {
    canvas: { width: CANVAS_W, height: CANVAS_H },
    focused_layer_id: focused,
    layer_count: layers.length,
    canvas_summary: buildSummary(layers),
    layers: serialized,
  };
}

function serializeLayer(layer: Layer, zOrder: number): SerializedLayer {
  const x = Math.round(layer.x);
  const y = Math.round(layer.y);
  const width = Math.round(layer.width);
  const height = Math.round(layer.height);
  const right = x + width;
  const bottom = y + height;

  const base: SerializedLayer = {
    id: layer.id,
    type: layer.type,
    name: layer.name,
    x, y, width, height,
    right, bottom,
    opacity: round2(layer.opacity),
    percentage_of_canvas: round2(
      Math.max(0, width) * Math.max(0, height) / CANVAS_AREA,
    ),
    is_off_canvas:
      x < -8 || y < -8 || right > CANVAS_W + 8 || bottom > CANVAS_H + 8,
    overlaps_timestamp_zone: overlapsTimestampZone(x, y, right, bottom),
    z_order: zOrder,
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

function overlapsTimestampZone(x: number, y: number, right: number, bottom: number): boolean {
  return x < CANVAS_W && right > TIMESTAMP_X0 && y < CANVAS_H && bottom > TIMESTAMP_Y0;
}

function buildSummary(layers: Layer[]): CanvasSummary {
  const total = layers.length;
  const status: CompositionStatus =
    total === 0 ? "empty" :
    total <= 2 ? "sparse" :
    total <= 5 ? "balanced" :
                 "cluttered";

  const has_image_layer = layers.some((l) => l.type === "image");
  const has_title_text = layers.some(
    (l) => l.type === "text" && (l as Layer & { fontSize: number }).fontSize >= 80,
  );

  // Reuse Day 44's deterministic detector — same engine the Nudge
  // watcher uses, so Ask + Partner + Nudge all see the same facts.
  const issues = detectIssues(layers);
  // Trim to the issue messages only — the model gets the human-
  // readable string, not the severity tag (severity is a UX hint
  // for the Nudge card; for tool-use mode it's noise).
  const detected_issues = issues.slice(0, 8).map((i) => i.message);

  return {
    total_layers: total,
    has_image_layer,
    has_title_text,
    composition_status: status,
    detected_issues,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
