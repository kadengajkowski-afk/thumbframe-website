import { Graphics } from "pixi.js";
import { nanoid } from "nanoid";
import { history } from "@/lib/history";
import { useUiStore } from "@/state/uiStore";
import { hexToPixi } from "@/lib/color";
import type { Tool, ToolCtx } from "./ToolTypes";

const DRAFT_FALLBACK_COLOR = 0xf97316; // --accent-orange
const MIN_SIZE = 2;

type Draft = {
  start: { x: number; y: number };
  last: { x: number; y: number };
  shift: boolean;
  alt: boolean;
  preview: Graphics;
  color: number;
};

function currentFillColor(): number {
  const last = useUiStore.getState().lastFillColor;
  if (!last) return DRAFT_FALLBACK_COLOR;
  const n = hexToPixi(last);
  return n === 0 && last.toUpperCase() !== "#000000"
    ? DRAFT_FALLBACK_COLOR
    : n;
}

/**
 * Click-drag to draw an ellipse. Shift = circle, Alt = draw from
 * center (Shift+Alt = circle from center). Escape while mid-draw
 * cancels via Tool.onCancel.
 *
 * The bounding-box math is identical to RectTool — the only difference
 * is the preview Graphics calls .ellipse(rx, ry, rx, ry) instead of
 * .rect, and the committed layer uses type: "ellipse".
 */
class EllipseToolImpl implements Tool {
  id = "ellipse" as const;
  label = "Ellipse";
  shortcut = "O";
  cursor = "crosshair";

  private draft: Draft | null = null;

  onPointerDown(ctx: ToolCtx) {
    const preview = new Graphics();
    preview.eventMode = "none";
    ctx.preview.addChild(preview);
    this.draft = {
      start: { ...ctx.canvasPoint },
      last: { ...ctx.canvasPoint },
      shift: ctx.shift,
      alt: ctx.alt,
      preview,
      color: currentFillColor(),
    };
  }

  onPointerMove(ctx: ToolCtx) {
    if (!this.draft) return;
    this.draft.last = { ...ctx.canvasPoint };
    this.draft.shift = ctx.shift;
    this.draft.alt = ctx.alt;
    const box = resolveBox(this.draft);
    this.draft.preview.clear();
    const rx = box.w / 2;
    const ry = box.h / 2;
    this.draft.preview.ellipse(box.x + rx, box.y + ry, rx, ry);
    this.draft.preview.fill({ color: this.draft.color, alpha: 1 });
  }

  onPointerUp(ctx: ToolCtx) {
    if (!this.draft) return;
    this.draft.last = { ...ctx.canvasPoint };
    this.draft.shift = ctx.shift;
    this.draft.alt = ctx.alt;
    const box = resolveBox(this.draft);
    const color = this.draft.color;
    this.clearDraft();
    if (box.w < MIN_SIZE || box.h < MIN_SIZE) return;
    history.addLayer({
      id: nanoid(),
      type: "ellipse",
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      color,
      opacity: 1,
      name: `Ellipse ${shortId()}`,
      hidden: false,
      locked: false,
      blendMode: "normal",
      fillAlpha: 1,
      strokeColor: 0x000000,
      strokeWidth: 0,
      strokeAlpha: 1,
    });
  }

  onCancel() {
    this.clearDraft();
  }

  private clearDraft() {
    if (!this.draft) return;
    this.draft.preview.destroy();
    this.draft = null;
  }
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 6);
}

function resolveBox(draft: Draft): { x: number; y: number; w: number; h: number } {
  let dx = draft.last.x - draft.start.x;
  let dy = draft.last.y - draft.start.y;
  if (draft.shift) {
    const s = Math.max(Math.abs(dx), Math.abs(dy));
    dx = (dx >= 0 ? 1 : -1) * s;
    dy = (dy >= 0 ? 1 : -1) * s;
  }
  if (draft.alt) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    return {
      x: draft.start.x - ax,
      y: draft.start.y - ay,
      w: 2 * ax,
      h: 2 * ay,
    };
  }
  return {
    x: Math.min(draft.start.x, draft.start.x + dx),
    y: Math.min(draft.start.y, draft.start.y + dy),
    w: Math.abs(dx),
    h: Math.abs(dy),
  };
}

export const EllipseTool = new EllipseToolImpl();
