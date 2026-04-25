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
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        d="M6 9 V4 a1 1 0 0 1 2 0 V9 M8 9 V3 a1 1 0 0 1 2 0 V9 M10 9 V4 a1 1 0 0 1 2 0 V9 M12 9 V5 a1 1 0 0 1 2 0 V11 Q14 15 10.5 15 Q7 15 6 12 L4.5 9 a1 1 0 0 1 1.7 -1 L7 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
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
