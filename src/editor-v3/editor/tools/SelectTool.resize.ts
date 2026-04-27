import type { Container } from "pixi.js";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { unionBounds, type LayerBounds } from "@/lib/bounds";
import {
  HANDLE_KINDS,
  MIN_LAYER_SIZE_PX,
  type HandleKind,
} from "../resizeHandles";
import type { Layer } from "@/state/types";
import type { ToolCtx } from "./ToolTypes";

/** Day 16 — resize state machine + math. Lives in its own file so
 * SelectTool stays under the 400-line ceiling. The contract:
 *   1. SelectTool reads `isHandleTarget(ctx.target)` on pointerdown;
 *      if it returns a HandleKind, route to `startResize`.
 *   2. pointermove → `applyResize` mutates docStore via the open stroke.
 *   3. pointerup → `endResize`. ESC / cancel → `cancelResize`. */

type LayerStart = {
  id: string;
  type: Layer["type"];
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
};

export type ResizeState = {
  handle: HandleKind;
  /** Captured per-layer state at gesture start. Locked layers in the
   * selection are filtered out — they remain selected but don't move
   * (matches Day 15's multi-drag rule). */
  starts: LayerStart[];
  /** Union AABB of `starts` at gesture start. Multi-select scales each
   * child by the new-union / start-union ratio; single-select uses
   * this directly as the layer's start box. */
  startUnion: LayerBounds;
  startPoint: { x: number; y: number };
};

function captureStart(l: Layer): LayerStart {
  const out: LayerStart = {
    id: l.id,
    type: l.type,
    x: l.x,
    y: l.y,
    width: l.width,
    height: l.height,
  };
  if (l.type === "text") out.fontSize = l.fontSize;
  return out;
}

const dragsLeft = (h: HandleKind) => h === "nw" || h === "w" || h === "sw";
const dragsRight = (h: HandleKind) => h === "ne" || h === "e" || h === "se";
const dragsTop = (h: HandleKind) => h === "nw" || h === "n" || h === "ne";
const dragsBottom = (h: HandleKind) => h === "sw" || h === "s" || h === "se";

/** Read a Pixi target's label and decode it into a HandleKind, or
 * null if the target isn't a resize handle. */
export function isHandleTarget(target: Container | null): HandleKind | null {
  if (!target) return null;
  const label = target.label;
  if (typeof label !== "string" || !label.startsWith("handle:")) return null;
  const kind = label.slice("handle:".length) as HandleKind;
  return HANDLE_KINDS.includes(kind) ? kind : null;
}

/** Begin a resize gesture. Captures every non-locked selected layer,
 * opens a history stroke, flips uiStore.isResizing so the handle
 * chrome hides during the gesture. Returns null when nothing's
 * resizable (e.g. all members locked). */
export function startResize(handle: HandleKind, ctx: ToolCtx): ResizeState | null {
  const ui = useUiStore.getState();
  const ids = ui.selectedLayerIds;
  if (ids.length === 0) return null;
  const docLayers = useDocStore.getState().layers;
  const movable = ids
    .map((id) => docLayers.find((l) => l.id === id))
    .filter((l): l is Layer => !!l && !l.hidden && !l.locked);
  if (movable.length === 0) return null;
  const startUnion = unionBounds(movable);
  if (!startUnion) return null;
  const starts = movable.map(captureStart);
  history.beginStroke(starts.length === 1 ? "Resize layer" : `Resize ${starts.length} layers`);
  ui.setIsResizing(true);
  return {
    handle,
    starts,
    startUnion,
    startPoint: { ...ctx.canvasPoint },
  };
}

/** Compute the new union AABB for the gesture given the cursor delta
 * + modifiers. Pure — used by tests + applyResize. */
export function computeNewUnion(state: ResizeState, ctx: ToolCtx): LayerBounds {
  const U = state.startUnion;
  const h = state.handle;
  const dxRaw = ctx.canvasPoint.x - state.startPoint.x;
  const dyRaw = ctx.canvasPoint.y - state.startPoint.y;

  const xDir = dragsLeft(h) ? -1 : dragsRight(h) ? 1 : 0;
  const yDir = dragsTop(h) ? -1 : dragsBottom(h) ? 1 : 0;

  // Per-axis dimension delta. Edge handles set the orthogonal delta
  // to 0 so width / height stays at the start value (until Shift
  // proportionally scales it below).
  let dW = xDir * dxRaw;
  let dH = yDir * dyRaw;
  if (ctx.alt) {
    // Resize from center — opposite side moves the inverse amount,
    // so the dimension changes by 2× the cursor delta.
    dW *= 2;
    dH *= 2;
  }
  let newW = U.width + dW;
  let newH = U.height + dH;

  // Shift = aspect-lock. Corner: master ratio = max abs of the two.
  // Edge: the dragged axis decides; the other follows proportionally.
  if (ctx.shift) {
    if (xDir !== 0 && yDir !== 0) {
      const wRatio = newW / U.width;
      const hRatio = newH / U.height;
      const masterRatio =
        Math.abs(wRatio) >= Math.abs(hRatio) ? wRatio : hRatio;
      newW = U.width * masterRatio;
      newH = U.height * masterRatio;
    } else if (xDir !== 0) {
      newH = U.height * (newW / U.width);
    } else if (yDir !== 0) {
      newW = U.width * (newH / U.height);
    }
  }

  // Clamp ≥ MIN. Inverted boxes (negative w/h) are clamped here — we
  // never let a drag flip the box; it just hits min and stays.
  if (newW < MIN_LAYER_SIZE_PX) newW = MIN_LAYER_SIZE_PX;
  if (newH < MIN_LAYER_SIZE_PX) newH = MIN_LAYER_SIZE_PX;

  let left: number;
  let top: number;
  if (ctx.alt) {
    // Center stays fixed.
    left = U.centerX - newW / 2;
    top = U.centerY - newH / 2;
  } else {
    // Anchor on the OPPOSITE side(s) of the dragged edge. Edges with
    // unchanged dimension stay at their start positions; if Shift
    // changed the orthogonal dimension on an edge handle, center it
    // around the start centerX / centerY.
    if (xDir < 0) left = U.right - newW;
    else if (xDir > 0) left = U.left;
    else if (newW !== U.width) left = U.centerX - newW / 2;
    else left = U.left;

    if (yDir < 0) top = U.bottom - newH;
    else if (yDir > 0) top = U.top;
    else if (newH !== U.height) top = U.centerY - newH / 2;
    else top = U.top;
  }

  return {
    left,
    top,
    width: newW,
    height: newH,
    right: left + newW,
    bottom: top + newH,
    centerX: left + newW / 2,
    centerY: top + newH / 2,
  };
}

/** Mutate every captured layer to its new box. Single-select: the
 * union IS the layer, write directly. Multi-select: scale each child
 * by sx, sy relative to the union's start position.
 *
 * Text layers route through history.setLayerBox here; their visual
 * fontSize stays at the start value (Compositor's auto-resize will
 * overwrite width/height next tick). Step 8 layers fontSize scaling
 * on top of this for proper text-resize visuals. */
export function applyResize(state: ResizeState, ctx: ToolCtx) {
  const newU = computeNewUnion(state, ctx);
  const U = state.startUnion;
  if (state.starts.length === 1) {
    const s = state.starts[0]!;
    history.setLayerBox(s.id, newU.left, newU.top, newU.width, newU.height);
    if (s.type === "text" && s.fontSize !== undefined) {
      const scale = Math.max(newU.width / U.width, newU.height / U.height);
      history.setFontSize(s.id, Math.max(8, s.fontSize * scale));
    }
    return;
  }
  const sx = newU.width / U.width;
  const sy = newU.height / U.height;
  for (const s of state.starts) {
    const nx = newU.left + (s.x - U.left) * sx;
    const ny = newU.top + (s.y - U.top) * sy;
    const nw = s.width * sx;
    const nh = s.height * sy;
    history.setLayerBox(s.id, nx, ny, nw, nh);
    if (s.type === "text" && s.fontSize !== undefined) {
      const scale = Math.max(sx, sy);
      history.setFontSize(s.id, Math.max(8, s.fontSize * scale));
    }
  }
}

export function endResize(_state: ResizeState) {
  history.endStroke();
  useUiStore.getState().setIsResizing(false);
}

export function cancelResize(_state: ResizeState) {
  // Drop the open stroke + restore layers to their pre-resize state
  // in one operation. cancelStroke handles the immer reference issue
  // that endStroke can't avoid (new refs created on every mutate).
  history.cancelStroke();
  useUiStore.getState().setIsResizing(false);
}
