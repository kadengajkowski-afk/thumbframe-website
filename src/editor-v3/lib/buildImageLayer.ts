import { nanoid } from "nanoid";
import type { ImageLayer } from "@/state/types";

/** Day 4 — image-layer factory split out of lib/history.ts so that
 * file stays under the 400-line ceiling. Centers the image on the
 * canvas, scaling down to CANVAS_FILL of the canvas if it's larger.
 *
 * Canvas size is hardcoded today (Day 1 fixed at 1280×720). When
 * canvas resize lands (Cycle 2 export work) this needs to read from
 * docStore.canvas. */

const CANVAS_W = 1280;
const CANVAS_H = 720;
const CANVAS_FILL = 0.9;

export function buildImageLayer(bitmap: ImageBitmap, name: string): ImageLayer {
  const natW = bitmap.width;
  const natH = bitmap.height;

  let width = natW;
  let height = natH;
  if (natW >= CANVAS_W || natH >= CANVAS_H) {
    const scale = Math.min(
      (CANVAS_W * CANVAS_FILL) / natW,
      (CANVAS_H * CANVAS_FILL) / natH,
    );
    width = Math.round(natW * scale);
    height = Math.round(natH * scale);
  }
  const x = Math.round((CANVAS_W - width) / 2);
  const y = Math.round((CANVAS_H - height) / 2);

  return {
    id: nanoid(),
    type: "image",
    x,
    y,
    width,
    height,
    opacity: 1,
    name,
    hidden: false,
    locked: false,
    blendMode: "normal",
    bitmap,
    naturalWidth: natW,
    naturalHeight: natH,
  };
}
