import { type CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";

/**
 * Right-side contextual panel. Cycle 1 Day 2: read-only preview of
 * the selected layer's fill + opacity. Scrubbable inputs land Day 9.
 */
export function ContextPanel() {
  const selectedLayerId = useUiStore((s) => s.selectedLayerId);
  const layer = useDocStore((s) =>
    s.layers.find((l) => l.id === selectedLayerId) ?? null,
  );

  if (!layer) {
    return (
      <aside
        style={panel}
        aria-label="Layer properties"
        data-alive="contextpanel"
      >
        <header style={panelHeader}>Properties</header>
        <div style={hint}>Select something</div>
      </aside>
    );
  }

  return (
    <aside
      style={panel}
      aria-label="Layer properties"
      data-alive="contextpanel"
    >
      <header style={panelHeader}>{layer.name}</header>
      <div style={row}>
        <span style={label}>Fill</span>
        <span style={value}>
          <span style={swatch(layer.color)} aria-hidden="true" />
          <code style={codeText}>#{hex(layer.color)}</code>
        </span>
      </div>
      <div style={row}>
        <span style={label}>Opacity</span>
        <span style={value}>{Math.round(layer.opacity * 100)}%</span>
      </div>
    </aside>
  );
}

function hex(color: number): string {
  return color.toString(16).padStart(6, "0").toUpperCase();
}

const panel: CSSProperties = {
  width: 260,
  flexShrink: 0,
  borderLeft: "1px solid var(--rail-border)",
  background: "var(--rail-bg)",
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  color: "var(--text-1)",
  overflowY: "auto",
};

const panelHeader: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  fontWeight: 500,
};

const hint: CSSProperties = {
  fontSize: 13,
  color: "var(--text-3)",
};

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 13,
};

const label: CSSProperties = {
  color: "var(--text-2)",
};

const value: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "var(--text-1)",
};

const codeText: CSSProperties = {
  fontFamily:
    '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  letterSpacing: "0.02em",
};

function swatch(color: number): CSSProperties {
  return {
    width: 14,
    height: 14,
    borderRadius: 3,
    background: `#${color.toString(16).padStart(6, "0")}`,
    border: "1px solid rgba(0,0,0,0.3)",
  };
}
