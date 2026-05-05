import { type CSSProperties, type ReactNode } from "react";

/** Day 64a — wood-wall scaffold. Parameterized container for the
 *  4 walls of the captain's quarters editor (top / left / right /
 *  bottom). Today this is a structural stub; 64b adds the wood PNG
 *  background + porthole mask cutout + brass ring overlay.
 *
 *  Architecture (locked):
 *    - position: relative, z-index: var(--z-walls).
 *    - children render INSIDE the wall on top of the wood texture.
 *    - Inner panel components (TopBar contents / Toolbar buttons /
 *      Properties cards / Layers scroll tab) keep their existing
 *      transparent surfaces; the wood texture is the wall, the
 *      panels are decoration ON the wall.
 *    - For 64a the wall is fully transparent so existing panels
 *      keep their visible wood treatment from Day 61-fix. Day 64b
 *      moves the wood from panels to walls. */

type Side = "top" | "left" | "right" | "bottom";
type Porthole = {
  diameter: number;
  position: "center" | "lower" | "upper";
} | null;

export function WoodWall({
  side,
  porthole = null,
  children,
  style,
}: {
  side: Side;
  porthole?: Porthole;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const wall: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    // Day 64a — transparent today. 64b drops in the wood PNG +
    // mask + ring. Existing panels (TopBar / ToolPalette /
    // ContextPanel) still carry their own wood treatment from
    // Day 61-fix so this scaffolding is visually a no-op.
    background: "transparent",
    overflow: side === "top" || side === "bottom" ? "visible" : "hidden",
    display: "flex",
    flexDirection: side === "left" || side === "right" ? "column" : "row",
    ...style,
  };
  return (
    <div
      data-alive={`wood-wall-${side}`}
      data-porthole={porthole ? `${porthole.diameter}-${porthole.position}` : undefined}
      style={wall}
    >
      {children}
    </div>
  );
}
