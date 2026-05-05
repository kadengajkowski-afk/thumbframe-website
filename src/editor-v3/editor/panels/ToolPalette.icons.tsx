import type { ToolId } from "@/editor/tools/tools";

/** Day 59 — maritime tool icons. Each icon is a hand-authored SVG
 * with painterly imperfections (curves that aren't perfectly
 * geometric, stroke variation suggesting brush weight). Cream
 * strokes via currentColor; the active-tool amber tint cascades from
 * the parent button. 22px viewBox; rendered at 22px in the rail.
 *
 *   Select  — quill nib
 *   Hand    — open palm with anchor wrist tag (pan/grab metaphor)
 *   Rect    — porthole-rimmed rectangle (brass dot at corners)
 *   Ellipse — porthole (circle with brass rivets)
 *   Text    — quill + ink drop
 *   Upload  — scroll/parchment unfurling
 *
 * NOTE: these are vector-painterly, not Lucide. The brush wobble is
 * achieved with quadratic curves rather than straight lines wherever
 * a real painter would lift the brush.
 */

const ICON_SIZE = 22;

export function ToolIcon({ id }: { id: ToolId }) {
  if (id === "select") return <QuillNibIcon />;
  if (id === "hand") return <HelmHandIcon />;
  if (id === "ellipse") return <PortholeIcon />;
  if (id === "text") return <QuillInkIcon />;
  return <PortholeRectIcon />;
}

/** Upload action icon — parchment scroll unfurling, not a generic
 *  arrow-into-tray. Sits in the left rail alongside tools. */
export function UploadIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 22 22" aria-hidden="true">
      {/* Scroll body — slight wobble suggesting paper curl */}
      <path
        d="M5 5 Q5 4 6 4 H15 Q17 4 17 6 V14 Q17 16 15 16 H6 Q5 16 5 15 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Furled top edge */}
      <path
        d="M5 5 Q7 4 9 5 Q11 4 13 5 Q15 4 17 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Lines on the parchment */}
      <path
        d="M7.5 8 H14 M7.5 10.5 H14"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* Brass wax seal */}
      <circle cx="14.5" cy="13" r="1.6" fill="#f97316" opacity="0.85" />
    </svg>
  );
}

/** Selection — quill nib. The classic dip-pen tip. */
function QuillNibIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 22 22" aria-hidden="true">
      {/* Nib body — long teardrop down-right */}
      <path
        d="M5 4 L17 16 L14 18 L11 15 Q9.5 13.5 8 11 Q6 8.5 5 4 Z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Slit down the center of the nib */}
      <path
        d="M7 6 L13 14"
        stroke="#050818"
        strokeWidth="0.7"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* Brass shoulder bead */}
      <circle cx="6" cy="5" r="1" fill="#f97316" opacity="0.7" />
      {/* Tip */}
      <circle cx="13.5" cy="17" r="0.7" fill="currentColor" />
    </svg>
  );
}

/** Hand — four-finger palm with subtle wobble. */
function HelmHandIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 22 22" aria-hidden="true">
      {/* Fingers */}
      <path
        d="M6 11 Q6 6 7 6 Q8 6 8 11
           M9 11 Q9 4 10 4 Q11 4 11 11
           M12 11 Q12 5 13 5 Q14 5 14 11
           M15 11 Q15 7 16 7 Q17 7 17 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Palm */}
      <path
        d="M5 10 Q5 14 7 16 Q10 18 13 18 Q17 18 17 14 V11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Wrist anchor pip — brass */}
      <circle cx="11" cy="20" r="1.1" fill="#f97316" opacity="0.7" />
    </svg>
  );
}

/** Rect — brass-rimmed rectangle (suggests a chart frame on the
 *  captain's table). */
function PortholeRectIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 22 22" aria-hidden="true">
      <rect
        x="4"
        y="6"
        width="14"
        height="11"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {/* Brass rivets at the corners */}
      <circle cx="5.5" cy="7.5" r="0.7" fill="#f97316" opacity="0.75" />
      <circle cx="16.5" cy="7.5" r="0.7" fill="#f97316" opacity="0.75" />
      <circle cx="5.5" cy="15.5" r="0.7" fill="#f97316" opacity="0.75" />
      <circle cx="16.5" cy="15.5" r="0.7" fill="#f97316" opacity="0.75" />
    </svg>
  );
}

/** Ellipse — porthole (circle with brass rim rivets). */
function PortholeIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 22 22" aria-hidden="true">
      {/* Outer rim */}
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {/* Inner glass hint */}
      <circle cx="11" cy="11" r="4.5" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
      {/* Four brass rivets at compass points */}
      <circle cx="11" cy="3.5" r="0.8" fill="#f97316" opacity="0.8" />
      <circle cx="18.5" cy="11" r="0.8" fill="#f97316" opacity="0.8" />
      <circle cx="11" cy="18.5" r="0.8" fill="#f97316" opacity="0.8" />
      <circle cx="3.5" cy="11" r="0.8" fill="#f97316" opacity="0.8" />
    </svg>
  );
}

/** Text — quill with ink drop. */
function QuillInkIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 22 22" aria-hidden="true">
      {/* Quill feather — long teardrop top-right to bottom-left */}
      <path
        d="M16 3 Q14 5 12 7 Q10 9 8 11 Q6 13 5 16 Q4 18 5 19 Q7 19 9 17 Q11 15 13 13 Q15 11 17 9 Q19 7 16 3 Z"
        fill="currentColor"
        opacity="0.7"
      />
      {/* Feather quill spine */}
      <path
        d="M16 3 Q11 9 5 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Ink drop */}
      <path
        d="M5 19 Q4 20 4 21 Q5.5 21 5.5 19.5 Z"
        fill="#f97316"
        opacity="0.85"
      />
    </svg>
  );
}
