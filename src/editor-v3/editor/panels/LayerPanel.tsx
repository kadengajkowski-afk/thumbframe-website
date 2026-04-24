import { type CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";

/**
 * Bottom layer panel. Reads docStore.layers, renders newest-on-top
 * (reversed visually from array order). Click a row to select;
 * click the selected row again to deselect.
 */
export function LayerPanel() {
  const layers = useDocStore((s) => s.layers);
  const selectedLayerId = useUiStore((s) => s.selectedLayerId);
  const setSelectedLayerId = useUiStore((s) => s.setSelectedLayerId);

  return (
    <section style={panel} aria-label="Layers" data-alive="layerpanel">
      <header style={panelHeader}>Layers</header>
      {layers.length === 0 ? (
        <div style={hint}>Drop something here, or add from the toolbar.</div>
      ) : (
        <ul style={list}>
          {[...layers].reverse().map((layer) => {
            const selected = layer.id === selectedLayerId;
            return (
              <li key={layer.id} style={{ listStyle: "none" }}>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedLayerId(selected ? null : layer.id)
                  }
                  aria-pressed={selected}
                  style={selected ? rowSelected : row}
                >
                  <span style={swatch(layer.color)} aria-hidden="true" />
                  <span style={rowName}>{layer.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const panel: CSSProperties = {
  borderTop: "1px solid var(--rail-border)",
  background: "var(--rail-bg)",
  padding: "8px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  overflowY: "auto",
  color: "var(--text-1)",
};

const panelHeader: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  fontWeight: 500,
};

const hint: CSSProperties = {
  fontSize: 12,
  color: "var(--text-3)",
  paddingTop: 4,
};

const list: CSSProperties = {
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--text-1)",
  fontSize: 13,
  cursor: "pointer",
  textAlign: "left",
  transition: "background var(--motion-fast) var(--ease-out)",
};

const rowSelected: CSSProperties = {
  ...row,
  background: "rgba(249, 240, 225, 0.06)",
  borderColor: "rgba(249, 240, 225, 0.18)",
};

const rowName: CSSProperties = {
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function swatch(color: number): CSSProperties {
  return {
    width: 12,
    height: 12,
    borderRadius: 3,
    background: `#${color.toString(16).padStart(6, "0")}`,
    border: "1px solid rgba(0,0,0,0.3)",
    flexShrink: 0,
  };
}
