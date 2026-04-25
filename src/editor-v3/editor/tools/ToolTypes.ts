import type { Container } from "pixi.js";

export type ToolId = "select" | "hand" | "rect" | "ellipse" | "text";

/** Canvas-local coords (0..CANVAS_W, 0..CANVAS_H) + modifier state +
 * the Pixi hit target and the shared tool-preview container. Tools
 * treat ctx as read-only per-event snapshot. `detail` mirrors
 * MouseEvent.detail (2 = double-click) so tools can branch on it. */
export type ToolCtx = {
  canvasPoint: { x: number; y: number };
  button: number;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  /** MouseEvent.detail (click count). Optional — older tools don't
   * read it; defaults to 1 when missing. */
  detail?: number;
  target: Container | null;
  preview: Container;
};

export interface Tool {
  id: ToolId;
  label: string;
  shortcut: string;
  cursor: string;
  onPointerDown?(ctx: ToolCtx): void;
  onPointerMove?(ctx: ToolCtx): void;
  onPointerUp?(ctx: ToolCtx): void;
  onCancel?(): void;
}
