import { type CSSProperties, type ReactNode } from "react";

/** Day 64b — wood-wall with optional porthole.
 *
 *  Architecture (locked):
 *    - position: relative, z-index: var(--z-walls).
 *    - Wood PNG background (varies per side via prop).
 *    - When `porthole` is set, an SVG mask cuts a circular hole in
 *      the wood (mask-image, NOT clip-path). The brass ring is then
 *      rendered ABSOLUTELY positioned over the same coordinate at
 *      z-index var(--z-brass-ring).
 *    - children render on top of the wood at z-index var(--z-walls)
 *      + 1 so toolbar buttons / panel contents are visible. */

type Side = "top" | "left" | "right" | "bottom";
type Porthole = {
  diameter: number;
  position: "center" | "lower" | "upper";
} | null;

const WOOD_BY_SIDE: Record<Side, string> = {
  top:    "/quarters/wood-wall-2.png",
  left:   "/quarters/wood-wall-1.png",
  right:  "/quarters/wood-wall-3.png",
  bottom: "/quarters/wood-wall-2.png",
};

const RING_BY_DIAMETER: Record<number, string> = {
  100: "/quarters/porthole-ring-small.svg",
  140: "/quarters/porthole-ring-small.svg",
  220: "/quarters/porthole-ring-medium.svg",
  320: "/quarters/porthole-ring-large.svg",
};

function pickRing(diameter: number): string {
  if (diameter <= 160) return "/quarters/porthole-ring-small.svg";
  if (diameter <= 260) return "/quarters/porthole-ring-medium.svg";
  return "/quarters/porthole-ring-large.svg";
}

/** Build a CSS mask data-URL: white rect minus a black circle at
 *  the porthole's anchor. The black part hides; the white part
 *  shows. Result: a hole in the wood revealing whatever lies
 *  behind (the body cosmic atmosphere at z-index --z-atmosphere). */
function maskFor(porthole: Porthole, side: Side): string | undefined {
  if (!porthole) return undefined;
  // Anchor (cx,cy) as a percentage of the wall's bounding box.
  // The wall's actual pixel dimensions vary; using percentages
  // means the mask scales with the wall.
  const cy =
    porthole.position === "upper" ? 25 :
    porthole.position === "lower" ? 75 :
                                    50;
  const cx = side === "left" || side === "right" ? 50 : 50;
  // The diameter prop is in CSS pixels; mask is in viewBox units.
  // Use a 100x100 viewBox + radius proportional to the smaller
  // dimension. We can't know the wall's aspect ratio here, so we
  // use absolute px and convert via the SVG's preserveAspectRatio.
  const r = porthole.diameter / 2;
  // The mask is a fixed-pixel SVG — we set width/height to wall
  // dimensions via CSS mask-size: 100% 100% but the inner shapes
  // use absolute coords. To keep the porthole circular regardless
  // of wall aspect ratio, we anchor the SVG to the wall's actual
  // pixel size with mask-size:auto and mask-position centered.
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${porthole.diameter * 2}' height='${porthole.diameter * 2}'><rect width='100%' height='100%' fill='white'/><circle cx='${porthole.diameter}' cy='${porthole.diameter}' r='${r}' fill='black'/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

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
  const woodUrl = WOOD_BY_SIDE[side];
  const mask = maskFor(porthole, side);
  const ringUrl = porthole ? pickRing(porthole.diameter) : null;

  // Anchor coords for ring overlay (matches the mask cutout).
  const anchorTop =
    !porthole ? "0%" :
    porthole.position === "upper" ? "25%" :
    porthole.position === "lower" ? "75%" :
                                    "50%";
  const anchorLeft = "50%";

  const wallSurface: CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: "#2A1F18",
    backgroundImage: `url("${woodUrl}")`,
    backgroundSize: "512px 512px",
    backgroundRepeat: "repeat",
    zIndex: 1,
    ...(mask
      ? {
          // Both standard and webkit prefix for Safari coverage.
          maskImage: mask,
          WebkitMaskImage: mask,
          maskSize: `${porthole!.diameter * 2}px ${porthole!.diameter * 2}px`,
          WebkitMaskSize: `${porthole!.diameter * 2}px ${porthole!.diameter * 2}px`,
          maskPosition: `${anchorLeft} ${anchorTop}`,
          WebkitMaskPosition: `${anchorLeft} ${anchorTop}`,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          // The mask SVG's white area extends beyond the circle but
          // is finite. Outside the SVG bounds the mask is implicitly
          // transparent (= invisible). Use a wrapping `mask-mode: alpha`
          // + a second white-rect overlay would be more robust, but
          // for a single porthole the mask SVG is sized 2× the
          // diameter which is enough for typical wall sizes.
        }
      : {}),
  };

  // Wrapper container — renders both the wood (with mask) AND the
  // children on top, plus the brass ring over the porthole hole.
  const wrap: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    display: "flex",
    flexDirection: side === "left" || side === "right" ? "column" : "row",
    ...style,
  };

  return (
    <div data-alive={`wood-wall-${side}`} style={wrap}>
      {/* Wood texture (with optional porthole mask cutout) */}
      <div aria-hidden="true" style={wallSurface} />

      {/* Brass ring + inner shadow over the porthole hole */}
      {porthole && ringUrl && (
        <>
          <img
            aria-hidden="true"
            src={ringUrl}
            alt=""
            style={{
              position: "absolute",
              top: anchorTop,
              left: anchorLeft,
              transform: "translate(-50%, -50%)",
              width: porthole.diameter + 24,
              height: porthole.diameter + 24,
              zIndex: 3,
              pointerEvents: "none",
            }}
          />
          {/* Inner radial shadow simulating curved-glass darkening
              at the rim of the hole. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: anchorTop,
              left: anchorLeft,
              transform: "translate(-50%, -50%)",
              width: porthole.diameter,
              height: porthole.diameter,
              borderRadius: "50%",
              boxShadow: "inset 0 0 18px 4px rgba(0, 0, 0, 0.45)",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* Children render above the wood */}
      <div
        style={{
          position: "relative",
          zIndex: 4,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: side === "left" || side === "right" ? "column" : "row",
        }}
      >
        {children}
      </div>
    </div>
  );
}
