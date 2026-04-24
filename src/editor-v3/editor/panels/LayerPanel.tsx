import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";
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
                    style={{
                      background:
                        layer.type === "rect"
                          ? `#${layer.color.toString(16).padStart(6, "0")}`
                          : "linear-gradient(135deg, var(--bg-space-2) 0%, var(--accent-navy) 100%)",
                    }}
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

type ToggleProps = {
  onClick: (e: React.MouseEvent) => void;
};

function VisibilityToggle({ hidden, onClick }: ToggleProps & { hidden: boolean }) {
  return (
    <button
      type="button"
      className={
        "layer-row__toggle" +
        (hidden ? "" : " layer-row__toggle--active")
      }
      onClick={onClick}
      aria-label={hidden ? "Show layer" : "Hide layer"}
      title={hidden ? "Show layer" : "Hide layer"}
    >
      {hidden ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

function LockToggle({ locked, onClick }: ToggleProps & { locked: boolean }) {
  return (
    <button
      type="button"
      className={
        "layer-row__toggle" +
        (locked ? " layer-row__toggle--active" : "")
      }
      onClick={onClick}
      aria-label={locked ? "Unlock layer" : "Lock layer"}
      title={locked ? "Unlock layer" : "Lock layer"}
    >
      {locked ? <LockClosedIcon /> : <LockOpenIcon />}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M1 7 C 3 3, 11 3, 13 7 C 11 11, 3 11, 1 7 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="7" cy="7" r="2" fill="currentColor" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M1 7 C 3 3, 11 3, 13 7 C 11 11, 3 11, 1 7 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.6"
      />
      <line
        x1="2"
        y1="12"
        x2="12"
        y2="2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockClosedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect
        x="3"
        y="6"
        width="8"
        height="6"
        rx="1"
        fill="currentColor"
      />
      <path
        d="M4.5 6 V4.5 a2.5 2.5 0 0 1 5 0 V6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

function LockOpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect
        x="3"
        y="6"
        width="8"
        height="6"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        d="M4.5 6 V4.5 a2.5 2.5 0 0 1 5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.6"
      />
    </svg>
  );
}
