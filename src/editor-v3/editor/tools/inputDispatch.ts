import type { Container, FederatedPointerEvent } from "pixi.js";
import type { Viewport } from "pixi-viewport";
import type { ToolCtx } from "./ToolTypes";

/** Adapts Pixi federated pointer events and DOM pointer events into a
 * tool-facing ToolCtx with canvas-local coords. Separated out of
 * Compositor so the class body fits the 400-line ceiling. */

export function pixiEventToCtx(
  e: FederatedPointerEvent,
  viewport: Viewport,
  preview: Container,
  originX: number,
  originY: number,
): ToolCtx {
  const world = viewport.toWorld(e.global.x, e.global.y);
  return {
    canvasPoint: { x: world.x - originX, y: world.y - originY },
    button: e.button,
    shift: e.shiftKey,
    alt: e.altKey,
    meta: e.ctrlKey || e.metaKey,
    target: e.target as Container | null,
    preview,
  };
}

export function domEventToCtx(
  e: PointerEvent,
  canvas: HTMLCanvasElement,
  viewport: Viewport,
  preview: Container,
  originX: number,
  originY: number,
): ToolCtx {
  const rect = canvas.getBoundingClientRect();
  const world = viewport.toWorld(
    e.clientX - rect.left,
    e.clientY - rect.top,
  );
  return {
    canvasPoint: { x: world.x - originX, y: world.y - originY },
    button: e.button,
    shift: e.shiftKey,
    alt: e.altKey,
    meta: e.ctrlKey || e.metaKey,
    target: null,
    preview,
  };
}
