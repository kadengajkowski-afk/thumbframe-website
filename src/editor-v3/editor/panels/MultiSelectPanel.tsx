import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";
import type { BlendMode, Layer } from "@/state/types";
import { BlendModeSelect } from "./BlendModeSelect";
import { OpacityControl } from "./OpacityControl";
import * as s from "./ContextPanel.styles";

/** Day 15 — context-panel section rendered when 2+ layers are
 * selected. Limited to properties that make sense to set on a
 * heterogeneous selection: opacity, blend mode, visibility, lock,
 * delete. Each "shared" value reads as the common value when every
 * selected layer agrees, or "Mixed" when they differ. Setting a
 * value applies to ALL selected layers via the existing per-layer
 * setters wrapped in beginStroke/endStroke for one undo entry. */
export function MultiSelectPanel() {
  const ids = useUiStore((u) => u.selectedLayerIds);
  const layers = useDocStore((d) =>
    d.layers.filter((l) => ids.includes(l.id)),
  );

  if (layers.length < 2) return null;

  const sharedOpacity = sharedNumber(layers, (l) => l.opacity);
  const sharedBlend = sharedString<BlendMode>(layers, (l) => l.blendMode);
  const allHidden = layers.every((l) => l.hidden);
  const allLocked = layers.every((l) => l.locked);
  // Day 49 — Reset on Mixed opacity now snaps to the MOST-COMMON
  // value across the selection instead of an arbitrary 100%. Tighter
  // intuition: clicking Reset usually means "make these match,"
  // not "make these all visible." Falls back to 1 (full opacity) on
  // perfect-N-way-tie.
  const opacityModeValue = modeNumber(layers.map((l) => l.opacity), 1);

  return (
    <aside
      style={s.panel}
      aria-label="Multi-selection properties"
      data-alive="contextpanel"
    >
      <header style={s.panelHeader}>{layers.length} layers selected</header>

      <section style={s.section}>
        <label style={s.fieldLabel}>Opacity</label>
        {sharedOpacity === null ? (
          <div style={mixedRow} title="Different across selected layers">
            <span style={mixedText}>Mixed</span>
            <button
              type="button"
              style={resetButton}
              onClick={() => applyOpacity(layers, opacityModeValue)}
              title={`Match all to ${Math.round(opacityModeValue * 100)}%`}
            >
              Match
            </button>
          </div>
        ) : (
          <OpacityControl
            value={sharedOpacity}
            onChange={(v) => applyOpacity(layers, v)}
            onBeginStroke={() => history.beginStroke("Opacity")}
            onEndStroke={() => history.endStroke()}
          />
        )}
      </section>

      <section style={s.section}>
        <label style={s.fieldLabel}>Blend</label>
        {sharedBlend === null ? (
          <div style={mixedRow}>
            <span style={mixedText}>Mixed</span>
          </div>
        ) : (
          <BlendModeSelect
            value={sharedBlend}
            onChange={(mode) => applyBlend(layers, mode)}
          />
        )}
      </section>

      <section style={s.section}>
        <div style={buttonRow}>
          <button
            type="button"
            style={actionButton}
            onClick={() => toggleVisibility(layers, !allHidden)}
            title={allHidden ? "Show all" : "Hide all"}
          >
            {allHidden ? "Show all" : "Hide all"}
          </button>
          <button
            type="button"
            style={actionButton}
            onClick={() => toggleLock(layers, !allLocked)}
            title={allLocked ? "Unlock all" : "Lock all"}
          >
            {allLocked ? "Unlock all" : "Lock all"}
          </button>
        </div>
        <button
          type="button"
          style={deleteButton}
          onClick={() => history.deleteLayers(layers.map((l) => l.id))}
        >
          Delete {layers.length} layers
        </button>
      </section>
    </aside>
  );
}

/** Returns the common numeric value across all layers, or null if
 * any layer differs. Tolerates tiny float drift (1e-3) so layers
 * that differ only by rounding don't read as "Mixed". */
function sharedNumber(
  layers: readonly Layer[],
  pick: (l: Layer) => number,
): number | null {
  if (layers.length === 0) return null;
  const first = pick(layers[0]!);
  for (let i = 1; i < layers.length; i++) {
    if (Math.abs(pick(layers[i]!) - first) > 1e-3) return null;
  }
  return first;
}

/** Day 49 — return the most-common value in a numeric list, with a
 * fallback for empty arrays / N-way ties. Buckets values to 2-decimal
 * resolution so 0.5 and 0.5000001 count as the same value. */
function modeNumber(values: readonly number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const counts = new Map<number, number>();
  for (const v of values) {
    const key = Math.round(v * 100) / 100;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = fallback;
  let bestCount = 0;
  for (const [k, c] of counts) {
    if (c > bestCount) { best = k; bestCount = c; }
  }
  // True tie (every value distinct) → fall back to the supplied
  // default rather than picking arbitrarily.
  if (bestCount === 1 && counts.size === values.length) return fallback;
  return best;
}

function sharedString<T extends string>(
  layers: readonly Layer[],
  pick: (l: Layer) => T,
): T | null {
  if (layers.length === 0) return null;
  const first = pick(layers[0]!);
  for (let i = 1; i < layers.length; i++) {
    if (pick(layers[i]!) !== first) return null;
  }
  return first;
}

function applyOpacity(layers: readonly Layer[], v: number) {
  history.beginStroke("Opacity");
  for (const l of layers) history.setLayerOpacity(l.id, v);
  history.endStroke();
}

function applyBlend(layers: readonly Layer[], mode: BlendMode) {
  history.beginStroke("Blend mode");
  for (const l of layers) history.setLayerBlendMode(l.id, mode);
  history.endStroke();
}

function toggleVisibility(layers: readonly Layer[], hidden: boolean) {
  history.beginStroke(hidden ? "Hide layers" : "Show layers");
  for (const l of layers) {
    if (l.hidden !== hidden) history.toggleLayerVisibility(l.id);
  }
  history.endStroke();
}

function toggleLock(layers: readonly Layer[], locked: boolean) {
  history.beginStroke(locked ? "Lock layers" : "Unlock layers");
  for (const l of layers) {
    if (l.locked !== locked) history.toggleLayerLock(l.id);
  }
  history.endStroke();
}

const mixedRow = { display: "flex", alignItems: "center", gap: 8 } as const;
const mixedText = { flex: 1, fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" } as const;
const resetButton = { height: 24, padding: "0 10px", background: "var(--bg-space-2)", color: "var(--text-secondary)", border: "1px solid var(--border-ghost)", borderRadius: 4, cursor: "pointer", fontSize: 11 } as const;
const buttonRow = { display: "flex", gap: 6, marginBottom: 6 } as const;
const actionButton = { flex: 1, height: 28, background: "var(--bg-space-2)", color: "var(--text-primary)", border: "1px solid var(--border-ghost)", borderRadius: 4, cursor: "pointer", fontSize: 12 } as const;
const deleteButton = { width: "100%", height: 28, background: "transparent", color: "#ff8a6c", border: "1px solid #ff8a6c44", borderRadius: 4, cursor: "pointer", fontSize: 12 } as const;
