import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Day 53 — shared tooltip wrapper.
 *
 * Renders the trigger child untouched plus an absolutely-positioned
 * label that appears 400ms after pointer hover OR keyboard focus.
 * Position defaults to "right" (left toolbar) but accepts "below"
 * for top-bar / horizontal contexts.
 *
 * Accessibility:
 *   - Tooltip text is wired to the trigger via aria-describedby so
 *     screen readers announce it after the trigger's own label.
 *   - Visibility tracks both :hover and :focus-visible, so keyboard
 *     users see the same hint mouse users get.
 *   - The tooltip is non-interactive (pointerEvents: none) so it
 *     never traps the pointer or affects focus order.
 *
 * The wrapper is a span with display: inline-flex so the trigger's
 * layout is unchanged. */

type Position = "right" | "below";

const SHOW_DELAY_MS = 400;

export type TooltipProps = {
  /** Visible label, e.g. "Select". */
  label: string;
  /** Optional shortcut, e.g. "V" or "⌘I". Rendered in monospace. */
  shortcut?: string;
  /** Where to render the bubble. Defaults to "right". */
  position?: Position;
  /** The interactive element being labelled. Should be a single
   *  focusable child (button / link / etc.). */
  children: ReactNode;
  /** When true, the wrapper itself receives no display style — useful
   *  inside flex containers that want to control sizing. */
  inline?: boolean;
};

export function Tooltip({
  label,
  shortcut,
  position = "right",
  children,
  inline = false,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const id = useId();

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
  }, []);

  function show() {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
  }
  function hide() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  }

  return (
    <span
      style={inline ? wrapInline : wrap}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
      // The wrapper itself isn't focusable; the child is. We wire
      // aria-describedby on the wrapper so any focusable descendant
      // inherits it via the AT relationship.
      aria-describedby={open ? id : undefined}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        style={{
          ...bubble,
          ...(position === "below" ? bubbleBelow : bubbleRight),
          opacity: open ? 1 : 0,
        }}
      >
        {label}
        {shortcut && <span style={kbd}>{shortcut}</span>}
      </span>
    </span>
  );
}

const wrap: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const wrapInline: CSSProperties = {
  position: "relative",
};

const bubble: CSSProperties = {
  position: "absolute",
  background: "var(--bg-space-2)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)",
  padding: "4px 10px",
  borderRadius: 5,
  fontSize: 12,
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  boxShadow: "0 6px 14px rgba(0, 0, 0, 0.35)",
  transition: "opacity var(--motion-fast) var(--ease-standard)",
  zIndex: 100,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const bubbleRight: CSSProperties = {
  left: "calc(100% + 10px)",
  top: "50%",
  transform: "translateY(-50%)",
};

const bubbleBelow: CSSProperties = {
  top: "calc(100% + 10px)",
  left: "50%",
  transform: "translateX(-50%)",
};

const kbd: CSSProperties = {
  color: "var(--text-tertiary)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
};
