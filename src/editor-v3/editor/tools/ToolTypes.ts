import type { Container } from "pixi.js";

export type ToolId = "select" | "hand" | "rect";

/** Canvas-local coords (0..CANVAS_W, 0..CANVAS_H) + modifier state +
 * the Pixi hit target and the shared tool-preview container. Tools
 * treat ctx as read-only per-event snapshot. */
export type ToolCtx = {
  canvasPoint: { x: number; y: number };
  button: number;
  shift: boolean;
  alt: boolean;
  meta: boolean;
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
