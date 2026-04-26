import type { LayerBounds } from "./bounds";
import type { Guide } from "./smartGuides.types";

/** Equal-spacing detection — looks for the subject slotting between
 * 2+ siblings sharing its row (or column) so the gaps to either side
 * become equal. Pulled out of smartGuides.ts to keep that file
 * within the 250-line spec target. */

const ROW_ALIGN_EPSILON = 2;

export function spacingSnapX(
  s: LayerBounds,
  others: readonly LayerBounds[],
  threshold: number,
): { delta: number; guide: Guide } | null {
  // Pick siblings sharing a row with the subject (top / center /
  // bottom alignment within tolerance — thumbnail layers are
  // visually aligned, not pixel-aligned).
  const row = others.filter(
    (o) =>
      Math.abs(o.top - s.top) < ROW_ALIGN_EPSILON ||
      Math.abs(o.centerY - s.centerY) < ROW_ALIGN_EPSILON ||
      Math.abs(o.bottom - s.bottom) < ROW_ALIGN_EPSILON,
  );
  if (row.length < 2) return null;
  const sorted = [...row].sort((a, b) => a.left - b.left);
  for (let i = 0; i < sorted.length - 1; i++) {
    const left = sorted[i]!;
    const right = sorted[i + 1]!;
    // Subject must conceptually slot BETWEEN left and right.
    if (s.left < left.right) continue;
    if (s.right > right.left) continue;
    const gap = right.left - left.right;
    const targetLeft = left.right + (gap - s.width) / 2;
    const delta = targetLeft - s.left;
    if (Math.abs(delta) > threshold) continue;
    const cross = (s.top + s.bottom) / 2;
    return {
      delta,
      guide: {
        kind: "equal-spacing",
        axis: "x",
        gaps: [
          {
            center: (left.right + targetLeft) / 2,
            cross,
            width: targetLeft - left.right,
          },
          {
            center: (targetLeft + s.width + right.left) / 2,
            cross,
            width: right.left - (targetLeft + s.width),
          },
        ],
      },
    };
  }
  return null;
}

export function spacingSnapY(
  s: LayerBounds,
  others: readonly LayerBounds[],
  threshold: number,
): { delta: number; guide: Guide } | null {
  const col = others.filter(
    (o) =>
      Math.abs(o.left - s.left) < ROW_ALIGN_EPSILON ||
      Math.abs(o.centerX - s.centerX) < ROW_ALIGN_EPSILON ||
      Math.abs(o.right - s.right) < ROW_ALIGN_EPSILON,
  );
  if (col.length < 2) return null;
  const sorted = [...col].sort((a, b) => a.top - b.top);
  for (let i = 0; i < sorted.length - 1; i++) {
    const top = sorted[i]!;
    const bot = sorted[i + 1]!;
    if (s.top < top.bottom) continue;
    if (s.bottom > bot.top) continue;
    const gap = bot.top - top.bottom;
    const targetTop = top.bottom + (gap - s.height) / 2;
    const delta = targetTop - s.top;
    if (Math.abs(delta) > threshold) continue;
    const cross = (s.left + s.right) / 2;
    return {
      delta,
      guide: {
        kind: "equal-spacing",
        axis: "y",
        gaps: [
          {
            center: (top.bottom + targetTop) / 2,
            cross,
            width: targetTop - top.bottom,
          },
          {
            center: (targetTop + s.height + bot.top) / 2,
            cross,
            width: bot.top - (targetTop + s.height),
          },
        ],
      },
    };
  }
  return null;
}
