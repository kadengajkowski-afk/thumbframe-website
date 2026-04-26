import type { CSSProperties } from "react";
import type { TextLayer } from "@/state/types";
import { MAX_TEXT_STROKES, TEXT_EFFECT_DEFAULTS } from "@/state/types";
import { history } from "@/lib/history";
import { hexToPixi, pixiToHex } from "@/lib/color";
import * as s from "./ContextPanel.styles";

/** Day 13 commit 2: minimal shadow + glow controls so the filter
 * pipeline (sceneHelpers.applyTextEffects → DropShadowFilter +
 * GlowFilter) is verifiable in browser. Commit 6 adds collapsible
 * sections, summaries, and color pickers, and folds in the strokes
 * (multi-stroke) controls once commit 3 lands. */
export function TextEffects({ layer }: { layer: TextLayer }) {
  return (
    <>
      <ShadowSection layer={layer} />
      <GlowSection layer={layer} />
      <StrokesSection layer={layer} />
    </>
  );
}

function ShadowSection({ layer }: { layer: TextLayer }) {
  const D = TEXT_EFFECT_DEFAULTS;
  const enabled = layer.shadowEnabled ?? D.shadowEnabled;
  return (
    <section style={s.section}>
      <label style={s.fieldLabel}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => history.setShadowEnabled(layer.id, e.target.checked)}
          style={{ marginRight: 6 }}
        />
        Shadow
      </label>
      {enabled && (
        <div style={effectColumn}>
          <EffectRow label="Blur">
            <input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={Number((layer.shadowBlur ?? D.shadowBlur).toFixed(1))}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), 0, 50);
                if (Number.isFinite(v)) history.setShadowBlur(layer.id, v);
              }}
              style={numField}
            />
          </EffectRow>
          <EffectRow label="Offset X">
            <input
              type="number"
              min={-50}
              max={50}
              step={1}
              value={Math.round(layer.shadowOffsetX ?? D.shadowOffsetX)}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), -50, 50);
                if (Number.isFinite(v)) {
                  history.setShadowOffset(
                    layer.id,
                    v,
                    layer.shadowOffsetY ?? D.shadowOffsetY,
                  );
                }
              }}
              style={numField}
            />
          </EffectRow>
          <EffectRow label="Offset Y">
            <input
              type="number"
              min={-50}
              max={50}
              step={1}
              value={Math.round(layer.shadowOffsetY ?? D.shadowOffsetY)}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), -50, 50);
                if (Number.isFinite(v)) {
                  history.setShadowOffset(
                    layer.id,
                    layer.shadowOffsetX ?? D.shadowOffsetX,
                    v,
                  );
                }
              }}
              style={numField}
            />
          </EffectRow>
          <EffectRow label="Opacity">
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={Number((layer.shadowAlpha ?? D.shadowAlpha).toFixed(2))}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), 0, 1);
                if (Number.isFinite(v)) history.setShadowAlpha(layer.id, v);
              }}
              style={numField}
            />
          </EffectRow>
        </div>
      )}
    </section>
  );
}

function GlowSection({ layer }: { layer: TextLayer }) {
  const D = TEXT_EFFECT_DEFAULTS;
  const enabled = layer.glowEnabled ?? D.glowEnabled;
  return (
    <section style={s.section}>
      <label style={s.fieldLabel}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => history.setGlowEnabled(layer.id, e.target.checked)}
          style={{ marginRight: 6 }}
        />
        Glow
      </label>
      {enabled && (
        <div style={effectColumn}>
          <EffectRow label="Distance">
            <input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={Number((layer.glowDistance ?? D.glowDistance).toFixed(1))}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), 0, 50);
                if (Number.isFinite(v)) history.setGlowDistance(layer.id, v);
              }}
              style={numField}
            />
          </EffectRow>
          <EffectRow label="Outer">
            <input
              type="number"
              min={0}
              max={10}
              step={0.25}
              value={Number(
                (layer.glowOuterStrength ?? D.glowOuterStrength).toFixed(2),
              )}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), 0, 10);
                if (Number.isFinite(v)) history.setGlowOuterStrength(layer.id, v);
              }}
              style={numField}
            />
          </EffectRow>
          <EffectRow label="Inner">
            <input
              type="number"
              min={0}
              max={10}
              step={0.25}
              value={Number(
                (layer.glowInnerStrength ?? D.glowInnerStrength).toFixed(2),
              )}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), 0, 10);
                if (Number.isFinite(v)) history.setGlowInnerStrength(layer.id, v);
              }}
              style={numField}
            />
          </EffectRow>
          <EffectRow label="Quality">
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.1}
              value={Number((layer.glowQuality ?? D.glowQuality).toFixed(2))}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), 0.1, 1);
                if (Number.isFinite(v)) history.setGlowQuality(layer.id, v);
              }}
              style={numField}
            />
          </EffectRow>
          <EffectRow label="Opacity">
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={Number((layer.glowAlpha ?? D.glowAlpha).toFixed(2))}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), 0, 1);
                if (Number.isFinite(v)) history.setGlowAlpha(layer.id, v);
              }}
              style={numField}
            />
          </EffectRow>
        </div>
      )}
    </section>
  );
}

function StrokesSection({ layer }: { layer: TextLayer }) {
  const strokes = layer.strokes ?? [];
  const canAdd = strokes.length < MAX_TEXT_STROKES;

  return (
    <section style={s.section}>
      <label style={s.fieldLabel}>
        Stacked strokes ({strokes.length}/{MAX_TEXT_STROKES})
      </label>
      <div style={effectColumn}>
        {strokes.map((stroke, i) => (
          <div key={i} style={effectRow}>
            <span style={effectRowLabel}>#{i + 1}</span>
            <input
              type="color"
              value={pixiToHex(stroke.color)}
              onChange={(e) =>
                history.setStroke(layer.id, i, {
                  color: hexToPixi(e.target.value),
                })
              }
              style={colorField}
              title="Color"
            />
            <input
              type="number"
              min={1}
              max={50}
              step={1}
              value={Math.round(stroke.width)}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), 1, 50);
                if (Number.isFinite(v)) {
                  history.setStroke(layer.id, i, { width: v });
                }
              }}
              style={numField}
              title="Width (px)"
            />
            <button
              type="button"
              onClick={() => history.removeStroke(layer.id, i)}
              style={removeButton}
              title="Remove stroke"
            >
              ×
            </button>
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => {
              // Each new stroke defaults a few px wider than the
              // previous one so the stack reads as concentric rings.
              const last = strokes[strokes.length - 1];
              const nextWidth = last ? Math.min(50, last.width + 4) : 4;
              history.addStroke(layer.id, {
                color: 0x000000,
                width: nextWidth,
                alpha: 1,
              });
            }}
            style={addButton}
          >
            + Add stroke
          </button>
        )}
      </div>
    </section>
  );
}

function EffectRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={effectRow}>
      <span style={effectRowLabel}>{label}</span>
      {children}
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

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

const effectColumn: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 6,
  paddingLeft: 22,
};

const effectRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const effectRowLabel: CSSProperties = {
  flex: 1,
  fontSize: 12,
  color: "var(--text-secondary)",
};

const colorField: CSSProperties = {
  width: 32,
  height: 28,
  padding: 0,
  background: "transparent",
  border: "1px solid var(--border-ghost)",
  borderRadius: 4,
  cursor: "pointer",
};

const removeButton: CSSProperties = {
  width: 24,
  height: 24,
  background: "var(--bg-space-2)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
};

const addButton: CSSProperties = {
  height: 28,
  background: "var(--bg-space-2)",
  color: "var(--text-primary)",
  border: "1px dashed var(--border-ghost)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
};
