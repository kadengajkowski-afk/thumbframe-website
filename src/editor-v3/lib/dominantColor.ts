/** Day 52 — naive dominant-color extraction for the onboarding
 * upload step. Samples a small grid of pixels from the bitmap,
 * keeps the most-saturated non-near-black/white sample as the
 * "accent" color. Returns "#RRGGBB" or null when nothing is salient
 * enough to use.
 *
 * Not a serious color analysis — Brand Kit uses sharp + LAB k-means
 * server-side for that. This is just enough to give the user a
 * sensible canvas accent right after upload. */

const GRID = 8;        // sample 8x8 grid = 64 pixels
const NEAR_BLACK = 24;  // r+g+b channel sum below this → near-black, ignore
const NEAR_WHITE = 731; // r+g+b channel sum above this → near-white, ignore (3*245)

export async function dominantColorFromBitmap(
  bitmap: ImageBitmap,
): Promise<string | null> {
  // Defensive: bitmap with no usable dimensions (test fakes,
  // failed decode) → null.
  if (!bitmap || !bitmap.width || !bitmap.height) return null;
  // Downscale to a tiny canvas so we don't read megabytes of pixel
  // data for a 1MP photo.
  const w = GRID;
  const ratio = bitmap.height / bitmap.width;
  const h = Number.isFinite(ratio) ? Math.max(1, Math.round(ratio * GRID)) : GRID;
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : (() => {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          return c;
        })();
  const ctx = (canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null);
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let bestHex: string | null = null;
  let bestSat = -1;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (a < 200) continue;
    const sum = r + g + b;
    if (sum < NEAR_BLACK || sum > NEAR_WHITE) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // Approximate saturation. Hue-agnostic; we only care about
    // colorfulness vs grey.
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat > bestSat) {
      bestSat = sat;
      bestHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }

  // Reject low-saturation winners — a near-grey picture wouldn't
  // produce a useful accent.
  if (bestSat < 0.25) return null;
  return bestHex;
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0").toUpperCase();
}
