import type { ToolId } from "@/editor/tools/tools";

/** Tool icons. 20px viewBox, strokes use currentColor so the button
 * can tint them via CSS. Placeholder set — Cycle 6 gets real art. */

const ICON_SIZE = 20;

export function ToolIcon({ id }: { id: ToolId }) {
  if (id === "select") return <SelectIcon />;
  if (id === "hand") return <HandIcon />;
  if (id === "ellipse") return <EllipseIcon />;
  if (id === "text") return <TextIcon />;
  return <RectIcon />;
}

/** Upload-image action icon. Not a tool — shipped alongside tools in
 * the left rail as a one-shot action that opens the file picker. */
export function UploadIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        d="M4 14 V16 Q4 17 5 17 H15 Q16 17 16 16 V14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 13 V4 M6.5 7.5 L10 4 L13.5 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SelectIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        d="M4 3 L4 15 L8 12 L10.5 17 L13 15.8 L10.5 11 L15 11 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HandIcon() {
  // Four parallel finger pads + a thumb-anchor — reads as "open hand"
  // without trying to draw realistic anatomy at 20×20.
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        d="M6 10 V5 M9 10 V4 M12 10 V5 M14.5 10 V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5 9 Q5 14 8 16 H13 Q16 16 16 12 V8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RectIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="5"
        width="12"
        height="10"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        d="M3 5 H17 M10 5 V16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EllipseIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <ellipse
        cx="10"
        cy="10"
        rx="6"
        ry="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
