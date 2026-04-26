import { useState } from "react";
import type { TextLayer } from "@/state/types";
import { MAX_TEXT_STROKES, TEXT_EFFECT_DEFAULTS } from "@/state/types";
import { history } from "@/lib/history";
import { hexToPixi, pixiToHex } from "@/lib/color";
import {
  Section,
  EffectRow,
  NumberInput,
  effectColumn,
  colorField,
  removeButton,
  addButton,
} from "./TextEffects.shared";

/** Day 13 commit 6 — collapsible Drop Shadow / Outer Glow / Strokes
 * sections for text layers. Section state is local React (collapsed/
 * expanded is ephemeral UI; doesn't need uiStore persistence). Each
 * header shows a one-line summary when collapsed so the user can scan
 * which effects are active without opening every section. */
export function TextEffects({ layer }: { layer: TextLayer }) {
  return (
    <>
      <ShadowSection layer={layer} />
      <GlowSection layer={layer} />
      <StrokesSection layer={layer} />
    </>
  );
}

// ── Drop shadow ───────────────────────────────────────────────────────

function ShadowSection({ layer }: { layer: TextLayer }) {
  const D = TEXT_EFFECT_DEFAULTS;
  const enabled = layer.shadowEnabled ?? D.shadowEnabled;
  const blur = layer.shadowBlur ?? D.shadowBlur;
  const offX = layer.shadowOffsetX ?? D.shadowOffsetX;
  const offY = layer.shadowOffsetY ?? D.shadowOffsetY;
  const summary = enabled ? `${blur}px blur · ${offX},${offY}` : "off";
  const [open, setOpen] = useState(enabled);

  return (
    <Section
      title="Shadow"
      summary={summary}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      enabled={enabled}
      onEnableChange={(v) => {
        history.setShadowEnabled(layer.id, v);
        if (v) setOpen(true);
      }}
    >
      <div style={effectColumn}>
        <EffectRow label="Color">
          <input
            type="color"
            value={pixiToHex(layer.shadowColor ?? D.shadowColor)}
            onChange={(e) => history.setShadowColor(layer.id, hexToPixi(e.target.value))}
            style={colorField}
          />
        </EffectRow>
        <EffectRow label="Opacity">
          <NumberInput
            min={0}
            max={1}
            step={0.05}
            value={layer.shadowAlpha ?? D.shadowAlpha}
            onCommit={(v) => history.setShadowAlpha(layer.id, v)}
            decimals={2}
          />
        </EffectRow>
        <EffectRow label="Blur">
          <NumberInput
            min={0}
            max={50}
            step={0.5}
            value={blur}
            onCommit={(v) => history.setShadowBlur(layer.id, v)}
            decimals={1}
            suffix="px"
          />
        </EffectRow>
        <EffectRow label="Offset X">
          <NumberInput
            min={-50}
            max={50}
            step={1}
            value={offX}
            onCommit={(v) => history.setShadowOffset(layer.id, v, offY)}
            decimals={0}
            suffix="px"
          />
        </EffectRow>
        <EffectRow label="Offset Y">
          <NumberInput
            min={-50}
            max={50}
            step={1}
            value={offY}
            onCommit={(v) => history.setShadowOffset(layer.id, offX, v)}
            decimals={0}
            suffix="px"
          />
        </EffectRow>
      </div>
    </Section>
  );
}

// ── Outer glow ────────────────────────────────────────────────────────

function GlowSection({ layer }: { layer: TextLayer }) {
  const D = TEXT_EFFECT_DEFAULTS;
  const enabled = layer.glowEnabled ?? D.glowEnabled;
  const distance = layer.glowDistance ?? D.glowDistance;
  const outer = layer.glowOuterStrength ?? D.glowOuterStrength;
  const summary = enabled ? `${distance}px · ${outer.toFixed(1)} outer` : "off";
  const [open, setOpen] = useState(enabled);

  return (
    <Section
      title="Glow"
      summary={summary}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      enabled={enabled}
      onEnableChange={(v) => {
        history.setGlowEnabled(layer.id, v);
        if (v) setOpen(true);
      }}
    >
      <div style={effectColumn}>
        <EffectRow label="Color">
          <input
            type="color"
            value={pixiToHex(layer.glowColor ?? D.glowColor)}
            onChange={(e) => history.setGlowColor(layer.id, hexToPixi(e.target.value))}
            style={colorField}
          />
        </EffectRow>
        <EffectRow label="Opacity">
          <NumberInput
            min={0}
            max={1}
            step={0.05}
            value={layer.glowAlpha ?? D.glowAlpha}
            onCommit={(v) => history.setGlowAlpha(layer.id, v)}
            decimals={2}
          />
        </EffectRow>
        <EffectRow label="Distance">
          <NumberInput
            min={0}
            max={50}
            step={0.5}
            value={distance}
            onCommit={(v) => history.setGlowDistance(layer.id, v)}
            decimals={1}
            suffix="px"
          />
        </EffectRow>
        <EffectRow label="Outer">
          <NumberInput
            min={0}
            max={10}
            step={0.25}
            value={outer}
            onCommit={(v) => history.setGlowOuterStrength(layer.id, v)}
            decimals={2}
          />
        </EffectRow>
        <EffectRow label="Inner">
          <NumberInput
            min={0}
            max={10}
            step={0.25}
            value={layer.glowInnerStrength ?? D.glowInnerStrength}
            onCommit={(v) => history.setGlowInnerStrength(layer.id, v)}
            decimals={2}
          />
        </EffectRow>
        <EffectRow label="Quality">
          <NumberInput
            min={0.1}
            max={1}
            step={0.1}
            value={layer.glowQuality ?? D.glowQuality}
            onCommit={(v) => history.setGlowQuality(layer.id, v)}
            decimals={2}
          />
        </EffectRow>
      </div>
    </Section>
  );
}

// ── Stacked strokes ───────────────────────────────────────────────────

function StrokesSection({ layer }: { layer: TextLayer }) {
  const strokes = layer.strokes ?? [];
  const canAdd = strokes.length < MAX_TEXT_STROKES;
  const summary = strokes.length === 0 ? "off" : `${strokes.length}/${MAX_TEXT_STROKES}`;
  const [open, setOpen] = useState(strokes.length > 0);

  return (
    <Section
      title="Strokes"
      summary={summary}
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <div style={effectColumn}>
        {strokes.map((stroke, i) => (
          <div key={i} style={strokeRow}>
            <span style={strokeRowLabel}>#{i + 1}</span>
            <input
              type="color"
              value={pixiToHex(stroke.color)}
              onChange={(e) =>
                history.setStroke(layer.id, i, { color: hexToPixi(e.target.value) })
              }
              style={colorField}
              title="Color"
            />
            <NumberInput
              min={1}
              max={50}
              step={1}
              value={stroke.width}
              onCommit={(v) => history.setStroke(layer.id, i, { width: v })}
              decimals={0}
              suffix="px"
              compact
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
              const last = strokes[strokes.length - 1];
              const nextWidth = last ? Math.min(50, last.width + 4) : 4;
              history.addStroke(layer.id, {
                color: 0x000000,
                width: nextWidth,
                alpha: 1,
              });
              setOpen(true);
            }}
            style={addButton}
          >
            + Add stroke
          </button>
        )}
      </div>
    </Section>
  );
}

const strokeRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
} as const;

const strokeRowLabel = {
  flex: 1,
  fontSize: 12,
  color: "var(--text-secondary)",
} as const;
