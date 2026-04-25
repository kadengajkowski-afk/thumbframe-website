import type { CSSProperties } from "react";
import type { TextLayer, TextAlign } from "@/state/types";
import { history } from "@/lib/history";
import { useUiStore } from "@/state/uiStore";
import { FONT_REGISTRY, snapWeight } from "@/lib/fonts";
import * as s from "./ContextPanel.styles";

/**
 * Text-specific section of the ContextPanel. Keeps the rect/ellipse
 * fill+stroke+opacity+blend controls in the parent and adds:
 *   - Font family dropdown (the 6 bundled fonts)
 *   - Font size (numeric, 8-512)
 *   - Font weight (dropdown of weights the font carries)
 *   - Italic toggle
 *   - Align: left / center / right (icon buttons)
 *   - Line height (0.8-3.0, 0.05 step)
 *   - Letter spacing (-10 to 50 px, 0.5 step)
 *
 * Persists family + size + weight to uiStore so the next text layer
 * picks up where the user left off.
 */
export function TextProperties({ layer }: { layer: TextLayer }) {
  const meta = FONT_REGISTRY.find((f) => f.family === layer.fontFamily);
  const weights = meta?.weights ?? [400];

  return (
    <>
      <section style={s.section}>
        <label style={s.fieldLabel}>Font</label>
        <select
          style={fontSelect}
          value={layer.fontFamily}
          onChange={(e) => {
            const family = e.target.value;
            history.setFontFamily(layer.id, family);
            const snapped = snapWeight(family, layer.fontWeight);
            if (snapped !== layer.fontWeight) {
              history.setFontWeight(layer.id, snapped);
            }
            useUiStore.getState().setLastFontFamily(family);
          }}
        >
          {FONT_REGISTRY.map((f) => (
            <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
              {f.family}
            </option>
          ))}
        </select>
      </section>

      <section style={s.section}>
        <label style={s.fieldLabel}>Size</label>
        <div style={s.fillRow}>
          <input
            type="number"
            min={8}
            max={512}
            step={1}
            value={Math.round(layer.fontSize)}
            onChange={(e) => {
              const v = clamp(Number(e.target.value), 8, 512);
              if (Number.isFinite(v)) {
                history.setFontSize(layer.id, v);
                useUiStore.getState().setLastFontSize(v);
              }
            }}
            style={numField}
          />
          <span style={s.hexText}>px</span>
        </div>
      </section>

      <section style={s.section}>
        <label style={s.fieldLabel}>Weight</label>
        <select
          style={fontSelect}
          value={layer.fontWeight}
          onChange={(e) => {
            const w = Number(e.target.value);
            history.setFontWeight(layer.id, w);
            useUiStore.getState().setLastFontWeight(w);
          }}
          disabled={weights.length === 1}
        >
          {weights.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </section>

      <section style={s.section}>
        <label style={s.fieldLabel}>Style</label>
        <div style={s.fillRow}>
          <button
            type="button"
            style={italicButton(layer.fontStyle === "italic")}
            onClick={() =>
              history.setFontStyle(
                layer.id,
                layer.fontStyle === "italic" ? "normal" : "italic",
              )
            }
            aria-pressed={layer.fontStyle === "italic"}
            title="Italic"
          >
            <em style={{ fontFamily: layer.fontFamily }}>I</em>
          </button>
          <AlignGroup
            value={layer.align}
            onChange={(a) => history.setTextAlign(layer.id, a)}
          />
        </div>
      </section>

      <section style={s.section}>
        <label style={s.fieldLabel}>Line height</label>
        <input
          type="number"
          min={0.8}
          max={3}
          step={0.05}
          value={Number(layer.lineHeight.toFixed(2))}
          onChange={(e) => {
            const v = clamp(Number(e.target.value), 0.8, 3);
            if (Number.isFinite(v)) history.setLineHeight(layer.id, v);
          }}
          style={numField}
        />
      </section>

      <section style={s.section}>
        <label style={s.fieldLabel}>Letter spacing</label>
        <div style={s.fillRow}>
          <input
            type="number"
            min={-10}
            max={50}
            step={0.5}
            value={Number(layer.letterSpacing.toFixed(1))}
            onChange={(e) => {
              const v = clamp(Number(e.target.value), -10, 50);
              if (Number.isFinite(v)) history.setLetterSpacing(layer.id, v);
            }}
            style={numField}
          />
          <span style={s.hexText}>px</span>
        </div>
      </section>
    </>
  );
}

function AlignGroup({
  value,
  onChange,
}: {
  value: TextAlign;
  onChange: (a: TextAlign) => void;
}) {
  const items: { id: TextAlign; label: string; icon: string }[] = [
    { id: "left", label: "Align left", icon: "⫷" },
    { id: "center", label: "Align center", icon: "≡" },
    { id: "right", label: "Align right", icon: "⫸" },
  ];
  return (
    <div style={alignGroupStyle} role="radiogroup" aria-label="Text alignment">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="radio"
          aria-checked={value === it.id}
          aria-label={it.label}
          title={it.label}
          onClick={() => onChange(it.id)}
          style={alignButton(value === it.id)}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

const fontSelect: CSSProperties = {
  width: "100%",
  height: 28,
  padding: "0 8px",
  background: "var(--bg-space-2)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 4,
  fontSize: 13,
};

const numField: CSSProperties = {
  width: 64,
  height: 28,
  padding: "0 8px",
  background: "var(--bg-space-2)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "var(--font-mono)",
};

const alignGroupStyle: CSSProperties = {
  display: "inline-flex",
  marginLeft: "auto",
  border: "1px solid var(--border-ghost)",
  borderRadius: 4,
  overflow: "hidden",
};

function alignButton(active: boolean): CSSProperties {
  return {
    width: 28,
    height: 28,
    background: active ? "var(--accent-orange)" : "var(--bg-space-2)",
    color: active ? "#fff" : "var(--text-secondary)",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
  };
}

function italicButton(active: boolean): CSSProperties {
  return {
    width: 28,
    height: 28,
    background: active ? "var(--accent-orange)" : "var(--bg-space-2)",
    color: active ? "#fff" : "var(--text-secondary)",
    border: "1px solid var(--border-ghost)",
    borderRadius: 4,
    cursor: "pointer",
    fontStyle: "italic",
    fontWeight: 600,
    fontSize: 13,
    padding: 0,
  };
}
