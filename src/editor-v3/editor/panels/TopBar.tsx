import { type CSSProperties } from "react";
import { nanoid } from "nanoid";
import { history } from "@/lib/history";

/**
 * Cycle 1 Day 3 TopBar. Sailship logo left, project name center,
 * "Ship it" button right (locked until Cycle 2), and a dev-only
 * "Add test rect" shortcut that the real Rectangle tool replaces
 * on Day 6.
 */
export function TopBar() {
  return (
    <header style={bar} data-alive="topbar">
      <div style={leftGroup}>
        <Logo />
      </div>
      <div style={centerGroup}>
        <span style={projectName}>Untitled</span>
        <button
          type="button"
          onClick={addTestRect}
          style={devBtn}
          data-testid="add-test-rect"
          title="Dev only — removed Day 6"
        >
          + Add test rect
        </button>
      </div>
      <div style={rightGroup}>
        <button
          type="button"
          disabled
          style={shipItBtn}
          title="Export unlocks Cycle 2"
          aria-disabled="true"
        >
          Ship it
        </button>
      </div>
    </header>
  );
}

function addTestRect() {
  const shortId = Math.random().toString(36).slice(2, 6);
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
    hidden: false,
    locked: false,
  });
}

function Logo() {
  // Placeholder sailship mark — real art lands Cycle 6.
  return (
    <div style={logoGroup} aria-label="thumbframe">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <line
          x1="10"
          y1="2.5"
          x2="10"
          y2="17"
          stroke="var(--accent-cream)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          d="M 10.5 4 L 17 14.5 L 10.5 14.5 Z"
          fill="var(--accent-cream)"
          fillOpacity="0.9"
        />
        <path
          d="M 3 15 L 17 15 L 14.5 17.5 L 5.5 17.5 Z"
          fill="var(--accent-cream)"
          fillOpacity="0.72"
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
  padding: "0 16px",
  height: 48,
  borderBottom: "1px solid var(--border-ghost)",
  background: "var(--bg-space-1)",
  color: "var(--text-primary)",
};

const leftGroup: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 200,
};

const centerGroup: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
};

const rightGroup: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 200,
  justifyContent: "flex-end",
};

const logoGroup: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const wordmark: CSSProperties = {
  fontSize: 13,
  letterSpacing: "0.06em",
  fontWeight: 500,
  color: "var(--accent-cream)",
  textTransform: "lowercase",
};

const projectName: CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  letterSpacing: "0.01em",
};

const devBtn: CSSProperties = {
  background: "transparent",
  color: "var(--text-tertiary)",
  border: "1px dashed var(--border-ghost)",
  borderRadius: 5,
  padding: "3px 8px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.02em",
  cursor: "pointer",
  opacity: 0.55,
  transition:
    "color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), opacity var(--motion-fast) var(--ease-standard)",
};

const shipItBtn: CSSProperties = {
  background: "var(--accent-orange)",
  color: "var(--bg-space-0)",
  border: "none",
  borderRadius: 6,
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.04em",
  cursor: "not-allowed",
  opacity: 0.4,
  transition: "opacity var(--motion-fast) var(--ease-standard)",
};
