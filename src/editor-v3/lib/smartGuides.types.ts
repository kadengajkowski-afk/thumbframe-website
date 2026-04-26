/** Day 14 — public types for the smart-guides engine. Lives in its
 * own file so the engine, the candidate generators, and the spacing
 * detector can share types without an import cycle. */

export type GuideAxis = "x" | "y";

/** A guide line to render. Coordinates are in CANVAS space — the
 * Compositor projects to screen-space at draw time so line widths
 * stay constant under zoom. */
export type Guide =
  | {
      kind: "edge-align";
      axis: GuideAxis;
      /** Position of the line on the perpendicular axis (the X for
       * a vertical line, the Y for a horizontal one). */
      pos: number;
      /** Span of the line along its own axis (start / end). */
      start: number;
      end: number;
    }
  | {
      kind: "canvas-edge";
      axis: GuideAxis;
      pos: number;
      start: number;
      end: number;
      /** Distance label (e.g. "12px") rendered next to the guide.
       * Empty for "snapped to edge" — caller decides. */
      label?: string;
    }
  | {
      kind: "equal-spacing";
      axis: GuideAxis;
      /** Each gap between adjacent siblings (centerline of the gap)
       * + the gap width — caller draws "==" markers. */
      gaps: { center: number; cross: number; width: number }[];
    };

export type SnapResult = {
  /** Delta to apply to the subject's position so it snaps. May be 0
   * on either axis if no snap engaged. */
  dx: number;
  dy: number;
  guides: Guide[];
};

export type SmartGuideOptions = {
  /** Snap distance in WORLD units. Caller is responsible for
   * converting screen-space px → world-space px (divide by zoom). */
  threshold: number;
  /** Spacing-only mode: only equal-spacing snaps fire. Per Day 14
   * spec — Alt held = "snap to spacing only". */
  spacingOnly?: boolean;
  /** When true, equal-spacing detection runs even on the axes that
   * already snapped to alignment. Default false. */
  alwaysCheckSpacing?: boolean;
};

export type SnapCandidate = {
  /** Distance from current position to the snap line (absolute). */
  abs: number;
  /** Signed delta to add to the subject's position to land on the snap. */
  delta: number;
  guide: Guide;
};
