import type { LayerBounds } from "./bounds";
import type { Guide, SnapCandidate } from "./smartGuides.types";

/** Per-axis snap candidates against canvas edges, sibling centers,
 * and sibling edges. Pulled out of smartGuides.ts to keep the main
 * file under the 250-line spec target. */

export function pickBest(
  candidates: readonly SnapCandidate[],
  threshold: number,
): SnapCandidate | null {
  let best: SnapCandidate | null = null;
  for (const c of candidates) {
    if (c.abs > threshold) continue;
    if (!best || c.abs < best.abs) best = c;
  }
  return best;
}

export function canvasCandidatesX(
  s: LayerBounds,
  c: LayerBounds,
): SnapCandidate[] {
  const lines: { pos: number; subjectPos: number }[] = [
    { pos: c.left, subjectPos: s.left },
    { pos: c.right, subjectPos: s.right },
    { pos: c.centerX, subjectPos: s.centerX },
  ];
  return lines.map(({ pos, subjectPos }) => mkCanvasCandidate(s, c, pos, subjectPos, "x"));
}

export function canvasCandidatesY(
  s: LayerBounds,
  c: LayerBounds,
): SnapCandidate[] {
  const lines: { pos: number; subjectPos: number }[] = [
    { pos: c.top, subjectPos: s.top },
    { pos: c.bottom, subjectPos: s.bottom },
    { pos: c.centerY, subjectPos: s.centerY },
  ];
  return lines.map(({ pos, subjectPos }) => mkCanvasCandidate(s, c, pos, subjectPos, "y"));
}

export function centerCandidatesX(
  s: LayerBounds,
  o: LayerBounds,
): SnapCandidate[] {
  const delta = o.centerX - s.centerX;
  return [
    {
      abs: Math.abs(delta),
      delta,
      guide: spanGuide("edge-align", "x", o.centerX, s, o),
    },
  ];
}

export function centerCandidatesY(
  s: LayerBounds,
  o: LayerBounds,
): SnapCandidate[] {
  const delta = o.centerY - s.centerY;
  return [
    {
      abs: Math.abs(delta),
      delta,
      guide: spanGuide("edge-align", "y", o.centerY, s, o),
    },
  ];
}

/** Each subject edge can snap to each sibling edge — left↔left,
 * left↔right, right↔left, right↔right. Total: 4 candidates per
 * sibling per axis. */
export function edgeCandidatesX(
  s: LayerBounds,
  o: LayerBounds,
): SnapCandidate[] {
  const edges: { pos: number; subjectPos: number }[] = [
    { pos: o.left, subjectPos: s.left },
    { pos: o.right, subjectPos: s.right },
    { pos: o.left, subjectPos: s.right },
    { pos: o.right, subjectPos: s.left },
  ];
  return edges.map(({ pos, subjectPos }) => ({
    abs: Math.abs(pos - subjectPos),
    delta: pos - subjectPos,
    guide: spanGuide("edge-align", "x", pos, s, o),
  }));
}

export function edgeCandidatesY(
  s: LayerBounds,
  o: LayerBounds,
): SnapCandidate[] {
  const edges: { pos: number; subjectPos: number }[] = [
    { pos: o.top, subjectPos: s.top },
    { pos: o.bottom, subjectPos: s.bottom },
    { pos: o.top, subjectPos: s.bottom },
    { pos: o.bottom, subjectPos: s.top },
  ];
  return edges.map(({ pos, subjectPos }) => ({
    abs: Math.abs(pos - subjectPos),
    delta: pos - subjectPos,
    guide: spanGuide("edge-align", "y", pos, s, o),
  }));
}

function mkCanvasCandidate(
  s: LayerBounds,
  c: LayerBounds,
  pos: number,
  subjectPos: number,
  axis: "x" | "y",
): SnapCandidate {
  const delta = pos - subjectPos;
  return {
    abs: Math.abs(delta),
    delta,
    guide: spanGuide("canvas-edge", axis, pos, s, c),
  };
}

/** Build an edge-align or canvas-edge guide whose span covers the
 * union of subject + reference bounds, plus 10px overhang each side
 * (per spec — gives the line a visible lead-in/out past the boxes). */
function spanGuide(
  kind: "edge-align" | "canvas-edge",
  axis: "x" | "y",
  pos: number,
  s: LayerBounds,
  ref: LayerBounds,
): Guide {
  if (axis === "x") {
    return {
      kind,
      axis,
      pos,
      start: Math.min(s.top, ref.top) - 10,
      end: Math.max(s.bottom, ref.bottom) + 10,
    };
  }
  return {
    kind,
    axis,
    pos,
    start: Math.min(s.left, ref.left) - 10,
    end: Math.max(s.right, ref.right) + 10,
  };
}
