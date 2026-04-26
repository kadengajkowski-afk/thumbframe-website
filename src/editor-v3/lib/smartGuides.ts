import type { LayerBounds } from "./bounds";
import {
  canvasCandidatesX,
  canvasCandidatesY,
  centerCandidatesX,
  centerCandidatesY,
  edgeCandidatesX,
  edgeCandidatesY,
  pickBest,
} from "./smartGuides.candidates";
import { spacingSnapX, spacingSnapY } from "./smartGuides.spacing";
import type {
  Guide,
  SmartGuideOptions,
  SnapCandidate,
  SnapResult,
} from "./smartGuides.types";

/** Day 14 — pure smart-guides engine. Given a moving subject's box,
 * the boxes of every other layer, the canvas box, and a snap
 * threshold (in WORLD units — caller converts from screen px), this
 * returns the snap-adjusted dx/dy plus the guide lines that should
 * be drawn for the snaps that engaged.
 *
 * No PixiJS dependency. Pure function — easy to unit test.
 *
 * Snap priority (first match per axis wins):
 *   1. Canvas edges + center
 *   2. Subject center ↔ sibling center
 *   3. Subject edge ↔ sibling edge
 *   4. Equal spacing across 3+ siblings (fallback per axis)
 *
 * Implementation lives in the sibling files:
 *   - smartGuides.candidates.ts → priorities 1-3 per axis
 *   - smartGuides.spacing.ts    → priority 4
 *   - smartGuides.types.ts      → public types
 */
export function computeSnap(
  subject: LayerBounds,
  others: readonly LayerBounds[],
  canvas: LayerBounds,
  opts: SmartGuideOptions,
): SnapResult {
  const { threshold, spacingOnly } = opts;
  const guides: Guide[] = [];
  let dx = 0;
  let dy = 0;
  let snappedX = false;
  let snappedY = false;

  if (!spacingOnly) {
    const xCandidates: SnapCandidate[] = [
      ...canvasCandidatesX(subject, canvas),
      ...others.flatMap((o) => centerCandidatesX(subject, o)),
      ...others.flatMap((o) => edgeCandidatesX(subject, o)),
    ];
    const bestX = pickBest(xCandidates, threshold);
    if (bestX) {
      dx = bestX.delta;
      snappedX = true;
      guides.push(bestX.guide);
    }

    const yCandidates: SnapCandidate[] = [
      ...canvasCandidatesY(subject, canvas),
      ...others.flatMap((o) => centerCandidatesY(subject, o)),
      ...others.flatMap((o) => edgeCandidatesY(subject, o)),
    ];
    const bestY = pickBest(yCandidates, threshold);
    if (bestY) {
      dy = bestY.delta;
      snappedY = true;
      guides.push(bestY.guide);
    }
  }

  // Equal spacing only fires on an axis where alignment didn't
  // already snap (unless alwaysCheckSpacing is set or we're in
  // spacing-only mode). Spec: "3+ siblings equally spaced".
  if (!snappedX || opts.alwaysCheckSpacing || spacingOnly) {
    const sg = spacingSnapX(subject, others, threshold);
    if (sg) {
      dx = sg.delta;
      guides.push(sg.guide);
    }
  }
  if (!snappedY || opts.alwaysCheckSpacing || spacingOnly) {
    const sg = spacingSnapY(subject, others, threshold);
    if (sg) {
      dy = sg.delta;
      guides.push(sg.guide);
    }
  }

  return { dx, dy, guides };
}

// Re-export the public types so consumers only import from this file.
export type { Guide, GuideAxis, SnapResult, SmartGuideOptions } from "./smartGuides.types";
