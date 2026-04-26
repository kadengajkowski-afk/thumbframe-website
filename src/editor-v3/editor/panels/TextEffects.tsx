import type { CSSProperties } from "react";
import type { TextLayer } from "@/state/types";
import { TEXT_EFFECT_DEFAULTS } from "@/state/types";
import { history } from "@/lib/history";
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
