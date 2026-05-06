/** Day 64d — Captain's Quarters icon set, refined pass.
 *
 *  Vibe: brass nautical instrument engravings (sextant, compass,
 *  divider calipers, ship's wheel) crossed with photo-editor tool
 *  icons (Photoshop / Photopea). Formal, geometric, professional —
 *  NOT cartoon. Drops the Day 63 painterly-imperfection rule in
 *  favor of uniform stroke weights for a clean engraved feel.
 *
 *  Authoring rules:
 *    - 24x24 viewBox
 *    - stroke-width: 1.5 UNIFORM
 *    - stroke-linecap: round
 *    - stroke-linejoin: round
 *    - stroke="currentColor" (recolorable via CSS)
 *    - fill="none" by default; "currentColor" only where the icon
 *      reads better as a solid silhouette
 *    - Brass amber (var(--brass)) for accent dots / rivets only
 *
 *  The brass-rimmed <IconPlate> wrapper around each icon stays —
 *  it's the active state mechanism the toolbar relies on. */

import { type CSSProperties, type ReactNode } from "react";

const SIZE = 24;
const BRASS = "#B8864B";

function svg(children: ReactNode) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// ── Tool icons ───────────────────────────────────────────────────

export function SelectIcon() {
  // Sharp arrow cursor — refined, slim, NOT chunky. The body is a
  // filled silhouette; a thin stroke outlines it at uniform weight.
  return svg(
    <>
      <path
        d="M5 3.5 L5 18.5 L9.4 14.6 L11.7 19.4 L13.4 18.6 L11.1 13.8 L17 13.8 Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M5 3.5 L5 18.5 L9.4 14.6 L11.7 19.4 L13.4 18.6 L11.1 13.8 L17 13.8 Z" />
    </>
  );
}

export function HandIcon() {
  // Anatomical hand silhouette in the manner of an 18th-century
  // engraving: four fingers + thumb + palm with a single uniform
  // stroke. Fingers slightly fanned, palm rounded.
  return svg(
    <>
      {/* Pinky → ring → middle → index, ascending tip heights */}
      <path d="M7 14 V9.5" />
      <path d="M9.5 14 V7" />
      <path d="M12 14 V5.5" />
      <path d="M14.5 14 V7.5" />
      {/* Thumb arches off the palm to the right */}
      <path d="M14.5 12.5 Q17.2 11.8 17.5 14" />
      {/* Palm + wrist arch */}
      <path d="M5.5 14 Q5.5 19.5 10.5 20.5 Q15.5 20.5 17.5 18 V14" />
      <path d="M5.5 14 V11.5 Q5.5 10 7 10" />
    </>
  );
}

export function RectIcon() {
  // Clean rectangle outline + four corner crop-tick marks.
  return svg(
    <>
      <rect x="5" y="6" width="14" height="12" rx="0.5" />
      {/* Crop ticks at each corner */}
      <path d="M3.5 6 H4.5  M5 4.5 V5.5" />
      <path d="M19.5 4.5 V5.5  M19.5 6 H20.5" />
      <path d="M3.5 18 H4.5  M5 18.5 V19.5" />
      <path d="M19.5 18.5 V19.5  M19.5 18 H20.5" />
    </>
  );
}

export function EllipseIcon() {
  // Clean ellipse outline + four compass-point tick marks. NOT
  // wobbly — uniform strokeWidth, geometric.
  return svg(
    <>
      <ellipse cx="12" cy="12" rx="7.5" ry="6" />
      {/* Compass-point ticks */}
      <path d="M12 4.5 V5.5" />
      <path d="M12 18.5 V19.5" />
      <path d="M3.5 12 H4.5" />
      <path d="M19.5 12 H20.5" />
    </>
  );
}

export function TextIcon() {
  // Formal serif "T" — uppercase glyph with serifs at the top
  // crossbar and the baseline. Clean lines, no inkwell.
  return svg(
    <>
      {/* Top crossbar with end serifs */}
      <path d="M5 5.5 H19" />
      <path d="M5 5.5 V7.5  M19 5.5 V7.5" />
      {/* Vertical stem */}
      <path d="M12 5.5 V18.5" />
      {/* Baseline serif (small horizontal foot) */}
      <path d="M9 18.5 H15" />
    </>
  );
}

export function UploadIcon() {
  // Refined arrow rising into a frame.
  return svg(
    <>
      <path d="M5 14 V18 Q5 19 6 19 H18 Q19 19 19 18 V14" />
      <path d="M12 16 V5" />
      <path d="M8 9 L12 5 L16 9" />
    </>
  );
}

// ── AI tool icons (illustrative) ──────────────────────────────────

export function ThumbFriendIcon() {
  // Refined ship in profile — hull below the waterline, single mast
  // with a triangular sail. Formal naval engraving silhouette.
  return svg(
    <>
      {/* Waterline */}
      <path d="M3 17.5 H21" />
      {/* Hull — broad U-shape with chamfered ends */}
      <path d="M5 17.5 L6 15 H18 L19 17.5" />
      {/* Mast */}
      <path d="M12 15 V5" />
      {/* Triangular sail */}
      <path d="M12 5.5 L17 13.5 H12 Z" fill="currentColor" stroke="none" />
      <path d="M12 5.5 L17 13.5 H12 Z" />
      {/* Pennant flag */}
      <path d="M12 5 L14 4 L12 3.5" />
    </>
  );
}

export function GenerateIcon() {
  // 4-point sparkle star — slim arms, NOT the chunky 8-point flower
  // of Day 63. Formal celestial-chart star.
  return svg(
    <>
      <path d="M12 3.5 L13 11 L20.5 12 L13 13 L12 20.5 L11 13 L3.5 12 L11 11 Z" />
      <circle cx="12" cy="12" r="0.7" fill={BRASS} stroke="none" />
    </>
  );
}

export function BrandKitIcon() {
  // Refined heraldic banner on a pole. Pole is straight; banner has
  // a swallow-tail end, formal flag-of-state silhouette.
  return svg(
    <>
      {/* Pole */}
      <path d="M5 3.5 V20.5" stroke={BRASS} />
      <circle cx="5" cy="3.5" r="0.9" fill={BRASS} stroke="none" />
      {/* Banner — rectangle with swallow-tail right edge */}
      <path d="M5 5.5 H17 L19.5 7.75 L17 10 H5 Z" />
      {/* Single horizontal stripe (heraldic detail) */}
      <path d="M5 7.75 H17" stroke={BRASS} />
    </>
  );
}

export function BgRemoveIcon() {
  // Formal scissors — slim handles with gentle curl, crossed blades.
  return svg(
    <>
      {/* Crossed blades */}
      <path d="M7.5 9 L17 19" />
      <path d="M16.5 9 L7 19" />
      {/* Handle loops, slimmer than Day 63 */}
      <ellipse cx="6" cy="7.5" rx="2" ry="1.6" stroke={BRASS} />
      <ellipse cx="18" cy="7.5" rx="2" ry="1.6" stroke={BRASS} />
      {/* Pivot */}
      <circle cx="12" cy="14" r="0.7" fill={BRASS} stroke="none" />
    </>
  );
}

// ── Utility icons ─────────────────────────────────────────────────

export function AnchorIcon() {
  // Admiralty-pattern anchor: shank + ring at top, crossbar (stock),
  // and curved arms with palm flukes. Formal naval silhouette.
  return svg(
    <>
      {/* Ring at top */}
      <circle cx="12" cy="4.5" r="1.6" stroke={BRASS} />
      {/* Shank */}
      <path d="M12 6.1 V18" stroke={BRASS} />
      {/* Stock (crossbar) */}
      <path d="M8.5 8 H15.5" stroke={BRASS} />
      {/* Crown + curved arms */}
      <path
        d="M5 13 Q5 19 12 19 Q19 19 19 13"
        stroke={BRASS}
      />
      {/* Fluke palms — small inward ticks at arm ends */}
      <path d="M5 13 L7 13.5" stroke={BRASS} />
      <path d="M19 13 L17 13.5" stroke={BRASS} />
    </>
  );
}

export function HourglassIcon() {
  // Clean geometric hourglass — slim 1.5px frame, two triangular
  // chambers, top + bottom caps. Wrap with .tf-quarters-spin to
  // rotate while saving.
  return svg(
    <>
      {/* Top + bottom caps */}
      <path d="M6.5 4.5 H17.5" stroke={BRASS} />
      <path d="M6.5 19.5 H17.5" stroke={BRASS} />
      {/* Top chamber */}
      <path d="M6.5 4.5 L17.5 4.5 L12 11.5 Z" stroke={BRASS} />
      {/* Bottom chamber */}
      <path d="M6.5 19.5 L17.5 19.5 L12 12.5 Z" stroke={BRASS} />
      {/* Two grains of sand mid-flow */}
      <circle cx="12" cy="13.5" r="0.45" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15" r="0.45" fill="currentColor" stroke="none" />
    </>
  );
}

// ── Brass-rimmed plate wrapper ────────────────────────────────────

const PLATE_KEYFRAMES = `
@keyframes tf-quarters-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .tf-quarters-spin { animation: none !important; }
}
`;

/** Wraps an icon in a 32x32 brass-rimmed plate. Active state adds
 *  brass tint + drop-shadow glow. */
export function IconPlate({
  active = false,
  spin = false,
  children,
}: {
  active?: boolean;
  spin?: boolean;
  children: ReactNode;
}) {
  const wrap: CSSProperties = {
    width: 32,
    height: 32,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    background: active ? "rgba(184, 134, 75, 0.18)" : "transparent",
    color: active ? "var(--brass)" : "var(--cream, #F4EAD5)",
    filter: active
      ? "drop-shadow(0 0 6px var(--brass-glow))"
      : undefined,
    transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
  };
  return (
    <span
      style={wrap}
      className={spin ? "tf-quarters-spin" : undefined}
    >
      {children}
      <style>{PLATE_KEYFRAMES}</style>
    </span>
  );
}
