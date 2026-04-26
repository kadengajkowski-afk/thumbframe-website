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
  // Each entry carries an optional label = distance from the
  // subject's OPPOSITE edge to the corresponding canvas edge. Gives
  // the user situational awareness — "snapped to the left, with
  // 320px room on the right". Center snap has no useful label.
  const lines: { pos: number; subjectPos: number; label: string | null }[] = [
    { pos: c.left, subjectPos: s.left, label: `${Math.round(c.right - s.right)}px` },
    { pos: c.right, subjectPos: s.right, label: `${Math.round(s.left - c.left)}px` },
    { pos: c.centerX, subjectPos: s.centerX, label: null },
  ];
  return lines.map(({ pos, subjectPos, label }) =>
    mkCanvasCandidate(s, c, pos, subjectPos, "x", label),
  );
}

export function canvasCandidatesY(
  s: LayerBounds,
  c: LayerBounds,
): SnapCandidate[] {
  const lines: { pos: number; subjectPos: number; label: string | null }[] = [
    { pos: c.top, subjectPos: s.top, label: `${Math.round(c.bottom - s.bottom)}px` },
    { pos: c.bottom, subjectPos: s.bottom, label: `${Math.round(s.top - c.top)}px` },
    { pos: c.centerY, subjectPos: s.centerY, label: null },
  ];
  return lines.map(({ pos, subjectPos, label }) =>
    mkCanvasCandidate(s, c, pos, subjectPos, "y", label),
  );
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
  label: string | null,
): SnapCandidate {
  const delta = pos - subjectPos;
  const guide = spanGuide("canvas-edge", axis, pos, s, c);
  if (label && guide.kind === "canvas-edge") guide.label = label;
  return { abs: Math.abs(delta), delta, guide };
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
