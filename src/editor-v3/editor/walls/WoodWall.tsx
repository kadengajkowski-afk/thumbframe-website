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
  /** Day 64d — extra brass-ring overhead beyond the porthole hole.
   *  Defaults to 24 (matches the original Day 64a-fix rings). For
   *  narrow walls (e.g. 64px left/right rails) drop to 8 so the
   *  ring doesn't extend past the wall edge and get clipped by
   *  `overflow: hidden`. */
  ringPadding?: number;
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

/** Build a CSS mask: opaque everywhere (wood shows) MINUS a circular
 *  hole at the porthole's anchor (cosmic shows through). Day 64a-fix-2
 *  switched from a fixed-pixel SVG (which only painted the area within
 *  diameter*2 around the porthole — the rest of the wall was outside
 *  the mask = hidden, leaving dark voids above/below the porthole on
 *  the left + right walls) to a radial-gradient mask that always
 *  spans the entire wall. Black = visible (wood); transparent = hidden
 *  (porthole hole). */
function maskFor(porthole: Porthole, side: Side): string | undefined {
  if (!porthole) return undefined;
  // Anchor (cx,cy) as a percentage of the wall's bounding box.
  const cy =
    porthole.position === "upper" ? 25 :
    porthole.position === "lower" ? 75 :
                                    50;
  const cx = 50;
  void side;
  const r = porthole.diameter / 2;
  // Hard transition: transparent (= hides wood) inside r, black (=
  // shows wood) outside. The 0.5px feather between r-0.5 and r is
  // anti-aliasing for the rim — without it the circle edge looks
  // jagged.
  return (
    `radial-gradient(circle ${r}px at ${cx}% ${cy}%, ` +
    `transparent 0, transparent ${r - 0.5}px, ` +
    `black ${r}px, black 100%)`
  );
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
    // Day 64a-tone — dim + desaturate + slight cool shift so wood
    // reads as weathered grey-brown driftwood in shadow, not
    // saturated caramel-cartoon. Filter applies BEFORE the porthole
    // mask, so the cut-out circle is unaffected.
    filter: "brightness(0.75) saturate(0.55) hue-rotate(-8deg)",
    zIndex: 1,
    ...(mask
      ? {
          // Day 64a-fix-2: radial-gradient mask spans the whole wall
          // by definition — no maskSize / maskPosition / maskRepeat
          // needed. Black covers the entire wall; the porthole circle
          // at anchor (cx,cy) is the only transparent (= cut out)
          // region. Both standard and webkit prefix for Safari.
          maskImage: mask,
          WebkitMaskImage: mask,
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
              width: porthole.diameter + (porthole.ringPadding ?? 24),
              height: porthole.diameter + (porthole.ringPadding ?? 24),
              zIndex: 3,
              pointerEvents: "none",
              // Day 64a-tone — brass ring was pulling focus from the
              // canvas. Dim + desaturate so it reads as background
              // detail, not focal element.
              opacity: 0.65,
              filter: "saturate(0.7) brightness(0.85)",
            }}
          />
          {/* Day 64a-tone — porthole interior overlay. Two layers:
              1) subtle radial-gradient tint (charcoal center → amber
                 edge at 15% opacity) so the hole reads as glass over
                 cosmic, not solid black, even when the body
                 atmosphere is sparse;
              2) softer rim darkening (was rgba(0,0,0,0.45) — too
                 bruise-y; now rgba(0,0,0,0.30) for a calmer vignette).
              Both inside the same circle, sitting over whatever
              shows through the wood mask cutout. */}
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
              background:
                "radial-gradient(circle, " +
                "rgba(8, 12, 24, 0.15) 0%, " +
                "rgba(184, 134, 75, 0.15) 100%)",
              boxShadow: "inset 0 0 18px 4px rgba(0, 0, 0, 0.30)",
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
