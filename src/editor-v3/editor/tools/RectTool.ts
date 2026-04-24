import { Graphics } from "pixi.js";
import { nanoid } from "nanoid";
import { history } from "@/lib/history";
import type { Tool, ToolCtx } from "./ToolTypes";

const DRAFT_COLOR = 0xf97316; // --accent-orange
const MIN_SIZE = 2;

type Draft = {
  start: { x: number; y: number };
  last: { x: number; y: number };
  shift: boolean;
  alt: boolean;
  preview: Graphics;
};

/**
 * Click-drag to draw a rectangle. Shift = square, Alt = draw from
 * center (Shift+Alt = square from center). Escape while mid-draw
 * cancels via Tool.onCancel.
 *
 * The preview lives in the compositor's toolPreview Container (passed
 * through ctx.preview). Commit on pointerup only, and only if the
 * resulting rect is at least MIN_SIZE × MIN_SIZE (a stray click
 * shouldn't create a 0×0 layer).
 */
class RectToolImpl implements Tool {
  id = "rect" as const;
  label = "Rectangle";
  shortcut = "R";
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
    };
  }

  onPointerMove(ctx: ToolCtx) {
    if (!this.draft) return;
    this.draft.last = { ...ctx.canvasPoint };
    this.draft.shift = ctx.shift;
    this.draft.alt = ctx.alt;
    const rect = resolveRect(this.draft);
    this.draft.preview.clear();
    this.draft.preview.rect(rect.x, rect.y, rect.w, rect.h);
    this.draft.preview.fill({ color: DRAFT_COLOR, alpha: 1 });
  }

  onPointerUp(ctx: ToolCtx) {
    if (!this.draft) return;
    this.draft.last = { ...ctx.canvasPoint };
    this.draft.shift = ctx.shift;
    this.draft.alt = ctx.alt;
    const rect = resolveRect(this.draft);
    this.clearDraft();
    if (rect.w < MIN_SIZE || rect.h < MIN_SIZE) return;
    history.addLayer({
      id: nanoid(),
      type: "rect",
      x: rect.x,
      y: rect.y,
      width: rect.w,
      height: rect.h,
      color: DRAFT_COLOR,
      opacity: 1,
      name: `Rect ${shortId()}`,
      hidden: false,
      locked: false,
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

function resolveRect(draft: Draft): { x: number; y: number; w: number; h: number } {
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

export const RectTool = new RectToolImpl();
