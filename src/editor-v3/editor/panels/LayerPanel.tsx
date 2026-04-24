import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";
import {
  EyeIcon,
  EyeOffIcon,
  LockClosedIcon,
  LockOpenIcon,
} from "./LayerPanel.icons";
import "./layer-panel.css";

/**
 * Cycle 1 Day 3 LayerPanel. Full width, 200px tall. Rows reverse the
 * docStore.layers array so newest lands on top. Each row has a 16px
 * swatch, layer name, visibility toggle (eye), lock toggle (padlock).
 * Lock is cosmetic for Cycle 1 — tools don't check it yet.
 */
export function LayerPanel() {
  const layers = useDocStore((s) => s.layers);
  const selectedLayerId = useUiStore((s) => s.selectedLayerId);
  const setSelectedLayerId = useUiStore((s) => s.setSelectedLayerId);

  return (
    <section className="layer-panel" aria-label="Layers" data-alive="layerpanel">
      <header className="layer-panel__header">Layers</header>
      {layers.length === 0 ? (
        <div className="layer-panel__empty">
          Drop something here, or add from the toolbar.
        </div>
      ) : (
        <ul className="layer-panel__list">
          {[...layers].reverse().map((layer) => {
            const selected = layer.id === selectedLayerId;
            const classes = [
              "layer-row",
              selected ? "layer-row--selected" : "",
              layer.hidden ? "layer-row--hidden" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={layer.id} style={{ listStyle: "none" }}>
                <div
                  className={classes}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  onClick={() =>
                    setSelectedLayerId(selected ? null : layer.id)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedLayerId(selected ? null : layer.id);
                    }
                  }}
                >
                  <span
                    className="layer-row__swatch"
                    style={{ background: swatchBackground(layer) }}
                    aria-hidden="true"
                  />
                  <span className="layer-row__name">{layer.name}</span>
                  <VisibilityToggle
                    hidden={layer.hidden}
                    onClick={(e) => {
                      e.stopPropagation();
                      history.toggleLayerVisibility(layer.id);
                    }}
                  />
                  <LockToggle
                    locked={layer.locked}
                    onClick={(e) => {
                      e.stopPropagation();
                      history.toggleLayerLock(layer.id);
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function swatchBackground(layer: {
  type: "rect" | "image";
  color?: number;
}): string {
  if (layer.type === "rect" && typeof layer.color === "number") {
    return `#${layer.color.toString(16).padStart(6, "0")}`;
  }
  return "linear-gradient(135deg, var(--bg-space-2) 0%, var(--accent-navy) 100%)";
}

type ToggleProps = { onClick: (e: React.MouseEvent) => void };

function VisibilityToggle({
  hidden,
  onClick,
}: ToggleProps & { hidden: boolean }) {
  const cls =
    "layer-row__toggle" + (hidden ? "" : " layer-row__toggle--active");
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-label={hidden ? "Show layer" : "Hide layer"}
      title={hidden ? "Show layer" : "Hide layer"}
    >
      {hidden ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

function LockToggle({
  locked,
  onClick,
}: ToggleProps & { locked: boolean }) {
  const cls =
    "layer-row__toggle" + (locked ? " layer-row__toggle--active" : "");
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-label={locked ? "Unlock layer" : "Lock layer"}
      title={locked ? "Unlock layer" : "Lock layer"}
    >
      {locked ? <LockClosedIcon /> : <LockOpenIcon />}
    </button>
  );
}
