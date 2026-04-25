import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";
import { pixiToHex } from "@/lib/color";
import { BlendModeSelect } from "./BlendModeSelect";
import { OpacityControl } from "./OpacityControl";
import { ColorSwatchButton } from "./ColorSwatchButton";
import { StrokeWidthInput } from "./StrokeWidthInput";
import { TextProperties } from "./TextProperties";
import * as s from "./ContextPanel.styles";
import "./blend-select.css";
import "./color-picker.css";

/**
 * Right-side contextual panel. Day 9: fill + stroke color pickers,
 * live preview through the stroke-aware history setters, recents +
 * last-fill persisted in uiStore / localStorage.
 */
export function ContextPanel() {
  const selectedCount = useUiStore((u) => u.selectedLayerIds.length);
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

  if (selectedCount > 1) {
    return (
      <aside
        style={s.panel}
        aria-label="Layer properties"
        data-alive="contextpanel"
      >
        <header style={s.panelHeader}>Properties</header>
        <div style={s.emptyHint}>{selectedCount} selected</div>
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
          ) : layer.type === "ellipse" ? (
            <span style={s.swatchEllipse(layer.color)} aria-hidden="true" />
          ) : layer.type === "text" ? (
            <span style={s.swatchText(layer.color)} aria-hidden="true">T</span>
          ) : (
            <span style={s.imageSwatch} aria-hidden="true" />
          )}
          <span style={s.layerName} title={layer.name}>
            {layer.name}
          </span>
        </div>
      </section>

      {layer.type === "text" && <TextProperties layer={layer} />}

      {(layer.type === "rect" || layer.type === "ellipse" || layer.type === "text") && (
        <section style={s.section}>
          <label style={s.fieldLabel}>Fill</label>
          <div style={s.fillRow}>
            <ColorSwatchButton
              color={layer.color}
              alpha={layer.fillAlpha}
              label="Fill"
              onBeginEdit={() => history.beginStroke("Fill")}
              onChange={(color, alpha) => {
                history.setLayerFillColor(layer.id, color);
                history.setLayerFillAlpha(layer.id, alpha);
              }}
              onEndEdit={() => {
                history.endStroke();
                const hex = pixiToHex(
                  (useDocStore
                    .getState()
                    .layers.find((l) => l.id === layer.id) as { color?: number })
                    ?.color ?? layer.color,
                );
                useUiStore.getState().addRecentColor(hex);
                useUiStore.getState().setLastFillColor(hex);
              }}
            />
            <code style={s.hexText}>{pixiToHex(layer.color).slice(1)}</code>
          </div>
        </section>
      )}

      {(layer.type === "rect" || layer.type === "ellipse" || layer.type === "text") && (
        <section style={s.section}>
          <label style={s.fieldLabel}>Stroke</label>
          <div style={s.fillRow}>
            <ColorSwatchButton
              color={layer.strokeColor}
              alpha={layer.strokeAlpha}
              label="Stroke"
              onBeginEdit={() => history.beginStroke("Stroke color")}
              onChange={(color, alpha) => {
                history.setLayerStrokeColor(layer.id, color);
                history.setLayerStrokeAlpha(layer.id, alpha);
              }}
              onEndEdit={() => {
                history.endStroke();
                const hex = pixiToHex(
                  (useDocStore
                    .getState()
                    .layers.find((l) => l.id === layer.id) as {
                    strokeColor?: number;
                  })?.strokeColor ?? layer.strokeColor,
                );
                useUiStore.getState().addRecentColor(hex);
              }}
            />
            <StrokeWidthInput
              value={layer.strokeWidth}
              onBeginStroke={() => history.beginStroke("Stroke width")}
              onChange={(v) => history.setLayerStrokeWidth(layer.id, v)}
              onEndStroke={() => history.endStroke()}
            />
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
