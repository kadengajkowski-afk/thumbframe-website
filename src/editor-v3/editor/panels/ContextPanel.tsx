import { type CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";

/**
 * Cycle 1 Day 3 ContextPanel. 280px wide. Empty state: "Select
 * something" italic centered tertiary. When a layer is selected,
 * show its name, a color swatch (picker lands Day 9), and a
 * stroke-coalesced opacity slider.
 */
export function ContextPanel() {
  const selectedLayerId = useUiStore((s) => s.selectedLayerId);
  const layer = useDocStore(
    (s) => s.layers.find((l) => l.id === selectedLayerId) ?? null,
  );

  if (!layer) {
    return (
      <aside
        style={panel}
        aria-label="Layer properties"
        data-alive="contextpanel"
      >
        <header style={panelHeader}>Properties</header>
        <div style={emptyHint}>Select something</div>
      </aside>
    );
  }

  return (
    <aside
      style={panel}
      aria-label="Layer properties"
      data-alive="contextpanel"
    >
      <header style={panelHeader}>Properties</header>
      <section style={section}>
        <div style={layerNameRow}>
          <span style={swatch(layer.color)} aria-hidden="true" />
          <span style={layerName} title={layer.name}>
            {layer.name}
          </span>
        </div>
      </section>

      <section style={section}>
        <label style={fieldLabel}>Fill</label>
        <div style={fillRow}>
          <button
            type="button"
            style={swatchBig(layer.color)}
            aria-label={`Fill color ${hex(layer.color)}`}
            title="Color picker opens Day 9"
          />
          <code style={hexText}>#{hex(layer.color)}</code>
        </div>
      </section>

      <section style={section}>
        <div style={fieldHeader}>
          <label style={fieldLabel} htmlFor="opacity-slider">
            Opacity
          </label>
          <span style={fieldValue}>{Math.round(layer.opacity * 100)}%</span>
        </div>
        <input
          id="opacity-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(layer.opacity * 100)}
          onPointerDown={() => history.beginStroke("Opacity")}
          onPointerUp={() => history.endStroke()}
          onPointerCancel={() => history.endStroke()}
          onBlur={() => history.endStroke()}
          onChange={(e) =>
            history.setLayerOpacity(layer.id, Number(e.target.value) / 100)
          }
          style={slider}
        />
      </section>
    </aside>
  );
}

function hex(color: number): string {
  return color.toString(16).padStart(6, "0").toUpperCase();
}

const panel: CSSProperties = {
  width: 280,
  flexShrink: 0,
  borderLeft: "1px solid var(--border-ghost)",
  background: "var(--bg-space-1)",
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
  color: "var(--text-primary)",
  overflowY: "auto",
};

const panelHeader: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-tertiary)",
  fontWeight: 500,
};

const emptyHint: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  color: "var(--text-tertiary)",
  fontStyle: "italic",
};

const section: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const layerNameRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "6px 0",
  borderBottom: "1px solid var(--border-ghost)",
};

const layerName: CSSProperties = {
  flex: 1,
  fontSize: 13,
  color: "var(--text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const fieldHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const fieldLabel: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
};

const fieldValue: CSSProperties = {
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  color: "var(--text-secondary)",
};

const fillRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const hexText: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-secondary)",
  letterSpacing: "0.02em",
};

const slider: CSSProperties = {
  width: "100%",
  accentColor: "var(--accent-orange)",
  cursor: "pointer",
};

function swatch(color: number): CSSProperties {
  return {
    width: 12,
    height: 12,
    borderRadius: 3,
    background: `#${color.toString(16).padStart(6, "0")}`,
    border: "1px solid rgba(0,0,0,0.25)",
    flexShrink: 0,
  };
}

function swatchBig(color: number): CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 5,
    background: `#${color.toString(16).padStart(6, "0")}`,
    border: "1px solid var(--border-ghost-hover)",
    cursor: "pointer",
    padding: 0,
  };
}
