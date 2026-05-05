import type { ToolId } from "@/editor/tools/tools";

/** Day 61-fix — full painterly maritime icon set.
 *
 * Hand-authored 24x24 SVGs with painterly imperfections (quadratic
 * curves where a real painter would lift the brush, varied stroke
 * weights, brass color accents). currentColor for cream stroke;
 * brass amber inline for fixed accents. NOT Lucide.
 *
 * Drawing tools (rendered by ToolIcon below):
 *   select  → refined cursor (brass-tipped quill nib)
 *   hand    → painted hand (palm + fingers)
 *   rect    → brass-rimmed chart frame
 *   ellipse → porthole (rim + glass + 4 compass-point rivets)
 *   text    → inkwell with quill rising out
 *
 * Action icons (used in toolbar action row, not bound to ToolId):
 *   UploadIcon       → arrow into a frame (parchment scroll)
 *   ThumbFriendIcon  → small painted ship silhouette
 *   GenerateIcon     → spark/star (creation)
 *   BrandKitIcon     → furled flag (banner)
 *   BgRemoveIcon     → brass shears
 *   SaveAnchorIcon   → painted anchor (saved state)
 *   SaveHourglassIcon→ hourglass (saving state, can rotate via CSS)
 *   HelpIcon         → "?" in painted brass plaque
 */

const ICON_SIZE = 24;
const BRASS = "#c8843e";

function svg(children: React.ReactNode) {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ToolIcon({ id }: { id: ToolId }) {
  if (id === "select") return <CursorQuillIcon />;
  if (id === "hand")   return <PaintedHandIcon />;
  if (id === "ellipse")return <PortholeIcon />;
  if (id === "text")   return <InkwellQuillIcon />;
  return <ChartFrameIcon />;
}

// ── Drawing tools ──────────────────────────────────────────────

function CursorQuillIcon() {
  return svg(
    <>
      {/* Quill-cursor body — refined cursor + nib feel */}
      <path
        d="M5 4 Q5.5 3.8 6 4 L17 16 Q17.5 16.5 17 17 L14 18 Q13.5 18.2 13 17.7 L11 14.5 Q9.5 12.5 8 10 Q6 7.5 5 4 Z"
        fill="currentColor"
        opacity="0.92"
      />
      {/* Slit down center — gives nib feel */}
      <path d="M7 6 L13 14" stroke="#050818" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
      {/* Brass shoulder bead */}
      <circle cx="6" cy="5" r="1.2" fill={BRASS} opacity="0.85" />
      {/* Tip dot */}
      <circle cx="13.5" cy="17" r="0.7" fill="currentColor" />
    </>
  );
}

function PaintedHandIcon() {
  return svg(
    <>
      {/* Four painted fingers — brush-stroke feel via curves */}
      <path
        d="M6 12 Q6.2 7 7.5 7 Q8.5 7 8.5 12
           M9.5 12 Q9.7 5 11 5 Q12 5 12 12
           M13 12 Q13.2 6 14.5 6 Q15.5 6 15.5 12
           M16.5 12 Q16.7 8 17.5 8 Q18.3 8 18.3 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Painted palm — filled curved shape */}
      <path
        d="M5.5 11 Q5.5 16 8 18 Q11 20 14 20 Q18 20 18.3 16 V11 Q17.5 11.5 16.5 11.5 V12 Q15.5 12 14.5 12 Q13.5 12 13 12 Q12 12 11 12 Q10 12 9.5 12 Q8.5 12 8.5 12 Q7.5 12 6 11.5 Z"
        fill="currentColor"
        opacity="0.18"
      />
      {/* Wrist anchor pip — brass */}
      <circle cx="12" cy="22" r="1.1" fill={BRASS} opacity="0.78" />
    </>
  );
}

function ChartFrameIcon() {
  return svg(
    <>
      {/* Brass-rimmed chart frame */}
      <rect
        x="4" y="6" width="16" height="12" rx="1.5"
        fill="rgba(245, 230, 200, 0.10)"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {/* Brass rivets at corners */}
      <circle cx="5.5" cy="7.5" r="0.8" fill={BRASS} opacity="0.8" />
      <circle cx="18.5" cy="7.5" r="0.8" fill={BRASS} opacity="0.8" />
      <circle cx="5.5" cy="16.5" r="0.8" fill={BRASS} opacity="0.8" />
      <circle cx="18.5" cy="16.5" r="0.8" fill={BRASS} opacity="0.8" />
    </>
  );
}

function PortholeIcon() {
  return svg(
    <>
      <circle cx="12" cy="12" r="8" fill="rgba(245, 230, 200, 0.10)" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
      {/* Compass-point brass rivets */}
      <circle cx="12" cy="3.6" r="0.85" fill={BRASS} opacity="0.85" />
      <circle cx="20.4" cy="12" r="0.85" fill={BRASS} opacity="0.85" />
      <circle cx="12" cy="20.4" r="0.85" fill={BRASS} opacity="0.85" />
      <circle cx="3.6" cy="12" r="0.85" fill={BRASS} opacity="0.85" />
    </>
  );
}

function InkwellQuillIcon() {
  return svg(
    <>
      {/* Inkwell body */}
      <path
        d="M7 16 Q7 19 9 20 L15 20 Q17 19 17 16 V14 Q17 13.5 16.5 13.5 H7.5 Q7 13.5 7 14 Z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Inkwell rim */}
      <ellipse cx="12" cy="13.5" rx="5" ry="0.8" fill={BRASS} opacity="0.7" />
      {/* Quill rising out — feathered teardrop */}
      <path
        d="M16 4 Q14 6 12 8 Q10 10 8.5 12 Q8 13 9 13.5 Q10.5 13 12 11 Q14 9 16 7 Q18 5 16 4 Z"
        fill="currentColor"
        opacity="0.6"
      />
      {/* Quill spine */}
      <path d="M16 4 Q12 8 9 13" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
      {/* Ink drop — brass */}
      <circle cx="9" cy="13.5" r="0.9" fill={BRASS} opacity="0.85" />
    </>
  );
}

// ── Action icons (exported individually for ad-hoc use) ─────────

export function UploadIcon() {
  return svg(
    <>
      {/* Parchment scroll body */}
      <path
        d="M5 5 Q5 4 6 4 H16 Q18 4 18 6 V14 Q18 16 16 16 H6 Q5 16 5 15 Z"
        fill="rgba(245, 230, 200, 0.16)"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Furled top edge */}
      <path d="M5 5 Q7 4 9 5 Q11 4 13 5 Q15 4 17 5 Q18 4.5 18 5.5"
        fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.7" />
      {/* Up-arrow into the scroll */}
      <path d="M11.5 13 V8 M9 10.5 L11.5 8 L14 10.5"
        fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* Brass wax seal */}
      <circle cx="15.5" cy="13.5" r="1.4" fill={BRASS} opacity="0.85" />
    </>
  );
}

export function ThumbFriendIcon() {
  return svg(
    <>
      {/* Small painted ship silhouette */}
      <path
        d="M3 16 Q4 18 12 18 Q20 18 21 16 L18 14 H6 Z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Sail — cream painterly */}
      <path
        d="M12 4 L12 14 L7 14 Q8 8 12 4 Z"
        fill="rgba(245, 230, 200, 0.55)"
      />
      <path
        d="M12 4 L12 14 L17 14 Q16 8 12 4 Z"
        fill="rgba(245, 230, 200, 0.35)"
      />
      {/* Mast */}
      <line x1="12" y1="4" x2="12" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      {/* Crew avatar peek — small cream dot at the bow */}
      <circle cx="6" cy="15.5" r="1" fill="rgba(245, 230, 200, 0.95)" />
    </>
  );
}

export function GenerateIcon() {
  return svg(
    <>
      {/* 4-pointed creation spark */}
      <path
        d="M12 3 L13 10 L20 12 L13 14 L12 21 L11 14 L4 12 L11 10 Z"
        fill="currentColor"
      />
      {/* Inner brass glow */}
      <circle cx="12" cy="12" r="1.2" fill={BRASS} opacity="0.95" />
      {/* Tiny accent stars */}
      <circle cx="18" cy="6" r="0.7" fill="currentColor" opacity="0.65" />
      <circle cx="6" cy="18" r="0.7" fill="currentColor" opacity="0.65" />
    </>
  );
}

export function BrandKitIcon() {
  return svg(
    <>
      {/* Flagpole */}
      <line x1="6" y1="3" x2="6" y2="21" stroke={BRASS} strokeWidth="1.6" strokeLinecap="round" />
      {/* Furled flag — painted curve */}
      <path
        d="M6 5 Q14 4 18 7 Q14 9 10 9 Q14 11 18 13 Q14 14 6 13 Z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Flag fold highlight */}
      <path
        d="M6 5 Q12 6 14 8"
        fill="none"
        stroke={BRASS}
        strokeWidth="0.8"
        opacity="0.6"
      />
      {/* Pole tip cap */}
      <circle cx="6" cy="3" r="1.1" fill={BRASS} opacity="0.9" />
    </>
  );
}

export function BgRemoveIcon() {
  return svg(
    <>
      {/* Two scissor blades — painted brass */}
      <path
        d="M7 7 L17 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7 17 L17 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Finger holes — brass loops */}
      <circle cx="6" cy="7" r="2.4" fill="none" stroke={BRASS} strokeWidth="1.6" />
      <circle cx="6" cy="17" r="2.4" fill="none" stroke={BRASS} strokeWidth="1.6" />
      {/* Pivot screw */}
      <circle cx="12" cy="12" r="1.1" fill={BRASS} />
    </>
  );
}

export function SaveAnchorIcon() {
  return svg(
    <>
      {/* Anchor ring */}
      <circle cx="12" cy="5" r="2" fill="none" stroke={BRASS} strokeWidth="1.6" />
      {/* Shaft */}
      <line x1="12" y1="7" x2="12" y2="18" stroke={BRASS} strokeWidth="1.8" strokeLinecap="round" />
      {/* Crossbar */}
      <line x1="8" y1="9" x2="16" y2="9" stroke={BRASS} strokeWidth="1.8" strokeLinecap="round" />
      {/* Curved hooks */}
      <path
        d="M5 14 Q5 19 12 19 Q19 19 19 14"
        fill="none"
        stroke={BRASS}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  );
}

export function SaveHourglassIcon() {
  return svg(
    <>
      {/* Top funnel */}
      <path d="M6 4 H18 L13 11 L11 11 Z" fill={BRASS} opacity="0.85" />
      {/* Bottom funnel */}
      <path d="M6 20 H18 L13 13 L11 13 Z" fill={BRASS} opacity="0.85" />
      {/* Frame */}
      <line x1="6" y1="4" x2="6" y2="4.5" stroke={BRASS} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="4" x2="18" y2="4.5" stroke={BRASS} strokeWidth="1.5" strokeLinecap="round" />
      {/* Sand grains */}
      <circle cx="12" cy="15" r="0.6" fill="currentColor" opacity="0.85" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" opacity="0.85" />
      <circle cx="12" cy="9" r="0.6" fill="currentColor" opacity="0.85" />
    </>
  );
}

export function HelpIcon() {
  return svg(
    <>
      {/* Painted brass plaque */}
      <rect
        x="3.5" y="5" width="17" height="14" rx="2"
        fill="rgba(160, 101, 30, 0.18)"
        stroke={BRASS}
        strokeWidth="1.4"
      />
      {/* Question mark */}
      <path
        d="M9.5 10 Q9.5 8 12 8 Q14.5 8 14.5 10 Q14.5 11.5 12.5 12 Q11.5 12.5 12 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.5" r="0.9" fill="currentColor" />
    </>
  );
}
