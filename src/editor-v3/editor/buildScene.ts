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
  guides: Graphics;
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
  // Day 12 bug fix: needs to be pickable so clicks in the dark "space"
  // surrounding the 1280×720 canvas-fill area still bubble to the
  // viewport-level pointerdown listener. Otherwise the text tool only
  // fires when the user happens to click inside the canvas-fill rect.
  worldBg.eventMode = "static";

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

  // Day 14: smart-guide layer. Lives ABOVE toolPreview so guides
  // float over an in-progress rect/ellipse draft. Initial alpha 0 —
  // guideRenderer.paintGuides bumps it as soon as any guide lands.
  const guides = new Graphics();
  guides.label = "smart-guides";
  guides.eventMode = "none";
  guides.alpha = 0;

  canvasGroup.addChild(canvasFill);
  canvasGroup.addChild(pixelGrid);
  canvasGroup.addChild(toolPreview);
  canvasGroup.addChild(guides);

  return { worldBg, canvasGroup, canvasFill, toolPreview, pixelGrid, guides };
}
