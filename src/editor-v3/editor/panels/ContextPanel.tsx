import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";
import { BlendModeSelect } from "./BlendModeSelect";
import { OpacityControl } from "./OpacityControl";
import * as s from "./ContextPanel.styles";
import "./blend-select.css";

/**
 * Right-side contextual panel. Day 8: blend mode dropdown + pointer-
 * driven OpacityControl. Shows primary-selected layer only; multi-
 * select UI is a Cycle 2 concern.
 */
export function ContextPanel() {
  const primarySelectedId = useUiStore((u) => u.selectedLayerIds[0] ?? null);
  const layer = useDocStore(
    (d) => d.layers.find((l) => l.id === primarySelectedId) ?? null,
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
          {layer.type === "rect" ? (
            <span style={s.swatch(layer.color)} aria-hidden="true" />
          ) : (
            <span style={s.imageSwatch} aria-hidden="true" />
          )}
          <span style={s.layerName} title={layer.name}>
            {layer.name}
          </span>
        </div>
      </section>

      {layer.type === "rect" && (
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
      )}

      {layer.type === "image" && (
        <section style={s.section}>
          <label style={s.fieldLabel}>Source</label>
          <div style={s.sourceMeta}>
            <code style={s.hexText}>
              {layer.naturalWidth} × {layer.naturalHeight}
            </code>
          </div>
        </section>
      )}

      <section style={s.section}>
        <label style={s.fieldLabel}>Blend</label>
        <BlendModeSelect
          value={layer.blendMode}
          onChange={(mode) => history.setLayerBlendMode(layer.id, mode)}
        />
      </section>

      <section style={s.section}>
        <label style={s.fieldLabel}>Opacity</label>
        <OpacityControl
          value={layer.opacity}
          onChange={(v) => history.setLayerOpacity(layer.id, v)}
          onBeginStroke={() => history.beginStroke("Opacity")}
          onEndStroke={() => history.endStroke()}
        />
      </section>
    </aside>
  );
}

function hex(color: number): string {
  return color.toString(16).padStart(6, "0").toUpperCase();
}
