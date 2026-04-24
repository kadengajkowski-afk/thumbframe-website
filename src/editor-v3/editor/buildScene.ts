import { Container, Graphics } from "pixi.js";
import { buildPixelGrid } from "./sceneHelpers";

/** Builds the static pieces of the scene graph the Compositor plants
 * inside the viewport — worldBg, canvasGroup, canvasFill, toolPreview,
 * pixelGrid — wired up in the right order. Returning a bundle keeps
 * the Compositor constructor short. */

const BG_SPACE_0 = 0x050510;
const CANVAS_SURFACE = 0x0a0a0f;
const BORDER_GHOST = 0xf9f0e1;
const BORDER_GHOST_ALPHA = 0.08;

export type SceneBundle = {
  worldBg: Graphics;
  canvasGroup: Container;
  canvasFill: Graphics;
  toolPreview: Container;
  pixelGrid: Graphics;
};

export function buildScene(
  canvasW: number,
  canvasH: number,
  worldW: number,
  worldH: number,
  canvasOriginX: number,
  canvasOriginY: number,
): SceneBundle {
  const worldBg = new Graphics();
  worldBg.rect(0, 0, worldW, worldH);
  worldBg.fill({ color: BG_SPACE_0, alpha: 1 });
  worldBg.eventMode = "none";

  const canvasGroup = new Container();
  canvasGroup.label = "canvas-group";
  canvasGroup.x = canvasOriginX;
  canvasGroup.y = canvasOriginY;
  canvasGroup.eventMode = "static";

  const canvasFill = new Graphics();
  canvasFill.rect(0, 0, canvasW, canvasH);
  canvasFill.fill({ color: CANVAS_SURFACE, alpha: 1 });
  canvasFill.stroke({
    color: BORDER_GHOST,
    alpha: BORDER_GHOST_ALPHA,
    width: 1,
    alignment: 0,
  });
  canvasFill.eventMode = "static";
  canvasFill.label = "canvas-fill";

  const toolPreview = new Container();
  toolPreview.label = "tool-preview";
  toolPreview.eventMode = "none";

  const pixelGrid = buildPixelGrid(canvasW, canvasH);

  canvasGroup.addChild(canvasFill);
  canvasGroup.addChild(pixelGrid);
  canvasGroup.addChild(toolPreview);

  return { worldBg, canvasGroup, canvasFill, toolPreview, pixelGrid };
}
