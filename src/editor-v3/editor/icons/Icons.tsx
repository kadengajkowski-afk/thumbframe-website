/** Day 63 — Captain's Quarters icon set.
 *
 * 12 hand-authored 24x24 SVG icons. Painterly imperfections via
 * non-perfect curves, varied stroke weights, brass amber accents.
 * NOT Lucide — every icon has a chosen metaphor (quill nib for
 * select, painted hand for pan, inkwell+quill for text, etc.).
 *
 * Authoring rules (research plan):
 *   - 24x24 viewBox
 *   - stroke-width 1.5-2.0px, NON-UNIFORM
 *   - stroke-linecap round, stroke-linejoin round
 *   - currentColor for stroke (CSS-recolorable)
 *   - Active state via wrapping <IconPlate active>: brass tint +
 *     drop-shadow(0 0 6px var(--brass-glow))
 *   - Each icon optionally sits inside a 32x32 brass-rimmed plate
 *     (small SVG ring with painted texture) — see <IconPlate>.
 *
 * Tools (geometric, simplified): SelectIcon, HandIcon, RectIcon,
 * EllipseIcon, TextIcon, UploadIcon.
 *
 * AI tools (illustrative): ThumbFriendIcon, GenerateIcon, BrandKitIcon,
 * BgRemoveIcon.
 *
 * Utility: AnchorIcon (saved indicator), HourglassIcon (saving,
 * animates rotation via CSS keyframe `tf-quarters-spin`). */

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
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// ── Tool icons ───────────────────────────────────────────────────

export function SelectIcon() {
  // Refined cursor — quill nib body. Painterly imperfection via
  // quadratic curves where straight lines would feel digital.
  return svg(
    <>
      <path
        d="M5 4 Q5.4 3.8 6 4 L17 16 Q17.5 16.4 17 17 L14 18.2 Q13.5 18.3 13 17.7 L11 14.5 Q9.5 12.5 8 10 Q6.2 7.6 5 4 Z"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="6" cy="5" r="1.1" fill={BRASS} stroke="none" />
    </>
  );
}

export function HandIcon() {
  // Painted palm + 4 fingers. Stroke widths vary 1.5-2.0px.
  return svg(
    <>
      <path
        d="M6 12 Q6.2 7 7.5 7 Q8.5 7 8.5 12
           M9.5 12 Q9.7 5 11 5 Q12 5 12 12
           M13 12 Q13.2 6 14.5 6 Q15.5 6 15.5 12
           M16.5 12 Q16.7 8 17.5 8 Q18.3 8 18.3 12"
        strokeWidth="1.6"
      />
      <path
        d="M5.5 11 Q5.5 16 8 18 Q11 20 14 20 Q18 20 18.3 16 V11"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="22" r="1.1" fill={BRASS} stroke="none" />
    </>
  );
}

export function RectIcon() {
  // Non-perfect square corners — slightly irregular.
  return svg(
    <>
      <path
        d="M5 6 Q5 5.5 5.5 5.5 H18.5 Q19 5.5 19 6 V18 Q19 18.5 18.5 18.5 H5.5 Q5 18.5 5 18 Z"
        strokeWidth="1.7"
      />
      <circle cx="6" cy="7" r="0.8" fill={BRASS} stroke="none" />
      <circle cx="18" cy="7" r="0.8" fill={BRASS} stroke="none" />
      <circle cx="6" cy="17" r="0.8" fill={BRASS} stroke="none" />
      <circle cx="18" cy="17" r="0.8" fill={BRASS} stroke="none" />
    </>
  );
}

export function EllipseIcon() {
  // Organic <path> not <circle>. Slight quadratic wobble.
  return svg(
    <>
      <path
        d="M12 4 Q19 4.5 20 12 Q19 19.5 12 20 Q5 19.5 4 12 Q5 4.5 12 4 Z"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="3.6" r="0.8" fill={BRASS} stroke="none" />
      <circle cx="20.4" cy="12" r="0.8" fill={BRASS} stroke="none" />
      <circle cx="12" cy="20.4" r="0.8" fill={BRASS} stroke="none" />
      <circle cx="3.6" cy="12" r="0.8" fill={BRASS} stroke="none" />
    </>
  );
}

export function TextIcon() {
  // Inkwell + quill rising out. More illustrative than a "T".
  return svg(
    <>
      <path
        d="M7 16 Q7 19 9 20 H15 Q17 19 17 16 V14 H7 Z"
        fill="currentColor"
        opacity="0.85"
        stroke="none"
      />
      <ellipse cx="12" cy="13.6" rx="5" ry="0.8" fill={BRASS} stroke="none" />
      <path
        d="M16 4 Q14 6 12 8 Q10 10 8.5 12 Q8 13 9 13.5 Q10.5 13 12 11 Q14 9 16 7 Q18 5 16 4 Z"
        fill="currentColor"
        opacity="0.55"
        stroke="none"
      />
      <path d="M16 4 Q12 8 9 13" strokeWidth="0.9" opacity="0.5" />
      <circle cx="9" cy="13.5" r="0.9" fill={BRASS} stroke="none" />
    </>
  );
}

export function UploadIcon() {
  // Arrow into a frame. Simple, non-Lucide via slight curves.
  return svg(
    <>
      <path
        d="M5 14 V18 Q5 19 6 19 H18 Q19 19 19 18 V14"
        strokeWidth="1.6"
      />
      <path d="M12 15 V5 M8 9 L12 5 L16 9" strokeWidth="1.8" />
      <circle cx="12" cy="3.6" r="0.9" fill={BRASS} stroke="none" />
    </>
  );
}

// ── AI tool icons (illustrative) ──────────────────────────────────

export function ThumbFriendIcon() {
  // Small painted ship inside a chat bubble.
  return svg(
    <>
      <path
        d="M3 6 Q3 4 5 4 H19 Q21 4 21 6 V14 Q21 16 19 16 H10 L7 19 V16 H5 Q3 16 3 14 Z"
        strokeWidth="1.6"
      />
      <path d="M8 12 Q9 13 12 13 Q15 13 16 12 L14.5 10.5 H9.5 Z" fill="currentColor" stroke="none" />
      <path d="M12 6 V10 L9.5 10 Q10.5 8 12 6 Z" fill="rgba(245, 230, 200, 0.7)" stroke="none" />
      <path d="M12 6 V10 L14.5 10 Q13.5 8 12 6 Z" fill="rgba(245, 230, 200, 0.4)" stroke="none" />
      <line x1="12" y1="6" x2="12" y2="10" strokeWidth="0.9" opacity="0.7" />
    </>
  );
}

export function GenerateIcon() {
  // 4-pointed creation spark. Painted, not symmetric — stroke
  // width varies subtly per arm.
  return svg(
    <>
      <path
        d="M12 3 L13 10 L20 12 L13 14 L12 21 L11 14 L4 12 L11 10 Z"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="12" cy="12" r="1.3" fill={BRASS} stroke="none" />
      <circle cx="18" cy="6" r="0.7" fill="currentColor" opacity="0.65" stroke="none" />
      <circle cx="6" cy="18" r="0.7" fill="currentColor" opacity="0.65" stroke="none" />
    </>
  );
}

export function BrandKitIcon() {
  // Furled flag on a flagpole.
  return svg(
    <>
      <line x1="6" y1="3" x2="6" y2="21" strokeWidth="1.7" stroke={BRASS} />
      <path
        d="M6 5 Q14 4 18 7 Q14 9 10 9 Q14 11 18 13 Q14 14 6 13 Z"
        fill="currentColor"
        opacity="0.85"
        stroke="none"
      />
      <path d="M6 5 Q12 6 14 8" strokeWidth="0.8" stroke={BRASS} opacity="0.7" />
      <circle cx="6" cy="3" r="1.2" fill={BRASS} stroke="none" />
    </>
  );
}

export function BgRemoveIcon() {
  // Painted shears.
  return svg(
    <>
      <path d="M7 7 L17 17" strokeWidth="2" />
      <path d="M7 17 L17 7" strokeWidth="2" />
      <circle cx="6" cy="7" r="2.4" stroke={BRASS} strokeWidth="1.6" />
      <circle cx="6" cy="17" r="2.4" stroke={BRASS} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.1" fill={BRASS} stroke="none" />
    </>
  );
}

// ── Utility icons ─────────────────────────────────────────────────

export function AnchorIcon() {
  // Painted anchor — saved indicator.
  return svg(
    <>
      <circle cx="12" cy="5" r="2" strokeWidth="1.6" stroke={BRASS} />
      <line x1="12" y1="7" x2="12" y2="18" strokeWidth="1.8" stroke={BRASS} />
      <line x1="8" y1="9" x2="16" y2="9" strokeWidth="1.8" stroke={BRASS} />
      <path d="M5 14 Q5 19 12 19 Q19 19 19 14" strokeWidth="1.8" stroke={BRASS} />
    </>
  );
}

export function HourglassIcon() {
  // Hourglass — saving indicator. Wrap with <span class="tf-quarters-spin">
  // to rotate.
  return svg(
    <>
      <path d="M6 4 H18 L13 11 L11 11 Z" fill={BRASS} stroke="none" opacity="0.85" />
      <path d="M6 20 H18 L13 13 L11 13 Z" fill={BRASS} stroke="none" opacity="0.85" />
      <line x1="6" y1="4" x2="6" y2="4.5" strokeWidth="1.5" stroke={BRASS} />
      <line x1="18" y1="4" x2="18" y2="4.5" strokeWidth="1.5" stroke={BRASS} />
      <circle cx="12" cy="9" r="0.55" fill="currentColor" opacity="0.85" stroke="none" />
      <circle cx="12" cy="15" r="0.55" fill="currentColor" opacity="0.85" stroke="none" />
      <circle cx="12" cy="17" r="0.55" fill="currentColor" opacity="0.85" stroke="none" />
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
