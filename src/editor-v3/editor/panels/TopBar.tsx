import { type CSSProperties } from "react";
import { nanoid } from "nanoid";
import { history } from "@/lib/history";

/**
 * Top bar. Cycle 1 Day 2: sailship logo + a dev-only "Add test rect"
 * button that proves docStore → Compositor wiring. The button disappears
 * Day 6 when the real Rectangle tool lands on the left rail.
 */
export function TopBar() {
  return (
    <header style={bar}>
      <Logo />
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={addTestRect}
        style={devBtn}
        data-testid="add-test-rect"
        title="Dev shortcut — will be replaced by the Rectangle tool on Day 6"
      >
        + Add test rect
      </button>
    </header>
  );
}

function addTestRect() {
  const shortId = Math.random().toString(36).slice(2, 6);
  // Canvas is 1280×720; keep rects comfortably inside the frame.
  const x = 80 + Math.floor(Math.random() * 1000);
  const y = 80 + Math.floor(Math.random() * 480);
  history.addLayer({
    id: nanoid(),
    type: "rect",
    x,
    y,
    width: 100,
    height: 80,
    color: 0xf97316,
    opacity: 1,
    name: `Rect ${shortId}`,
  });
}

function Logo() {
  return (
    <div style={logoGroup} aria-label="thumbframe">
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        aria-hidden="true"
        focusable="false"
      >
        {/* Mast */}
        <line
          x1="9"
          y1="2"
          x2="9"
          y2="16"
          stroke="var(--accent-cream)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        {/* Sail (triangle to the right of the mast) */}
        <path
          d="M 9.4 3.4 L 15.2 13 L 9.4 13 Z"
          fill="var(--accent-cream)"
          fillOpacity="0.9"
        />
        {/* Hull */}
        <path
          d="M 3 14 L 15 14 L 13 16 L 5 16 Z"
          fill="var(--accent-cream)"
          fillOpacity="0.7"
        />
      </svg>
      <span style={wordmark}>thumbframe</span>
    </div>
  );
}

const bar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "0 14px",
  height: 48,
  borderBottom: "1px solid var(--rail-border)",
  background: "var(--rail-bg)",
  color: "var(--text-1)",
};

const logoGroup: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const wordmark: CSSProperties = {
  fontSize: 14,
  letterSpacing: "0.02em",
  fontWeight: 500,
  color: "var(--accent-cream)",
};

const devBtn: CSSProperties = {
  background: "transparent",
  color: "var(--text-2)",
  border: "1px solid var(--rail-border)",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 12,
  letterSpacing: "0.02em",
  cursor: "pointer",
  transition:
    "color var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out)",
};
