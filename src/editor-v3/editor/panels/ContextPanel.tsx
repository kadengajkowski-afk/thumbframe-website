import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";
import * as s from "./ContextPanel.styles";

/**
 * Cycle 1 Day 3 ContextPanel. 280px wide. Empty state: "Select
 * something" italic centered tertiary. When a layer is selected,
 * show its name, a color swatch (picker lands Day 9), and a
 * stroke-coalesced opacity slider.
 */
export function ContextPanel() {
  const selectedLayerId = useUiStore((u) => u.selectedLayerId);
  const layer = useDocStore(
    (d) => d.layers.find((l) => l.id === selectedLayerId) ?? null,
  );

  if (!layer) {
    return (
      <aside
        style={s.panel}
        aria-label="Layer properties"
        data-alive="contextpanel"
      >
        <header style={s.panelHeader}>Properties</header>
        <div style={s.emptyHint}>Select something</div>
      </aside>
    );
  }

  return (
    <aside
      style={s.panel}
      aria-label="Layer properties"
      data-alive="contextpanel"
    >
      <header style={s.panelHeader}>Properties</header>
      <section style={s.section}>
        <div style={s.layerNameRow}>
          <span style={s.swatch(layer.color)} aria-hidden="true" />
          <span style={s.layerName} title={layer.name}>
            {layer.name}
          </span>
        </div>
      </section>

      <section style={s.section}>
        <label style={s.fieldLabel}>Fill</label>
        <div style={s.fillRow}>
          <button
            type="button"
            style={s.swatchBig(layer.color)}
            aria-label={`Fill color ${hex(layer.color)}`}
            title="Color picker opens Day 9"
          />
          <code style={s.hexText}>#{hex(layer.color)}</code>
        </div>
      </section>

      <section style={s.section}>
        <div style={s.fieldHeader}>
          <label style={s.fieldLabel} htmlFor="opacity-slider">
            Opacity
          </label>
          <span style={s.fieldValue}>{Math.round(layer.opacity * 100)}%</span>
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
          style={s.slider}
        />
      </section>
    </aside>
  );
}

function hex(color: number): string {
  return color.toString(16).padStart(6, "0").toUpperCase();
}
