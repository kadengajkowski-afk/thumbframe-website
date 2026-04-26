import type { CSSProperties } from "react";
import type { TextLayer, TextLayerPatch } from "@/state/types";
import { history } from "@/lib/history";
import { snapWeight } from "@/lib/fonts";

/** Day 13 commit 8 — five quick-style presets for selected text. Each
 * applies a TextLayerPatch via history.applyTextPreset, so all field
 * changes land in ONE undo entry. Presets only restyle — they don't
 * touch position / size / id / hidden / locked. */

type Preset = {
  id: string;
  label: string;
  /** A short-line preview rendered in the preset's own family. */
  preview: string;
  buildPatch: () => TextLayerPatch;
};

const PRESETS: Preset[] = [
  {
    id: "clean-white",
    label: "Clean white",
    preview: "Aa",
    buildPatch: () => ({
      fontFamily: "Inter",
      fontWeight: 700,
      fontStyle: "normal",
      color: 0xffffff,
      fillAlpha: 1,
      strokeWidth: 0,
      shadowEnabled: false,
      glowEnabled: false,
      strokes: [],
    }),
  },
  {
    id: "outline-punch",
    label: "Outline punch",
    preview: "Aa",
    buildPatch: () => ({
      fontFamily: "Anton",
      fontWeight: 400,
      fontStyle: "normal",
      color: 0xffffff,
      fillAlpha: 1,
      strokeColor: 0x000000,
      strokeWidth: 4,
      strokeAlpha: 1,
      shadowEnabled: false,
      glowEnabled: false,
      strokes: [],
    }),
  },
  {
    id: "drop-shadow-pop",
    label: "Drop shadow pop",
    preview: "Aa",
    buildPatch: () => ({
      fontFamily: "Bebas Neue",
      fontWeight: 400,
      fontStyle: "normal",
      color: 0xffffff,
      fillAlpha: 1,
      strokeWidth: 0,
      shadowEnabled: true,
      shadowColor: 0x000000,
      shadowAlpha: 0.7,
      shadowBlur: 6,
      shadowOffsetX: 4,
      shadowOffsetY: 6,
      glowEnabled: false,
      strokes: [],
    }),
  },
  {
    id: "neon-glow",
    label: "Neon glow",
    preview: "Aa",
    buildPatch: () => ({
      fontFamily: "Inter",
      fontWeight: 700,
      fontStyle: "normal",
      color: 0xffffff,
      fillAlpha: 1,
      strokeColor: 0xffffff,
      strokeWidth: 1,
      strokeAlpha: 1,
      shadowEnabled: false,
      glowEnabled: true,
      glowColor: 0xffffff,
      glowAlpha: 0.9,
      glowDistance: 16,
      glowQuality: 0.5,
      glowOuterStrength: 3,
      glowInnerStrength: 0,
      strokes: [],
    }),
  },
  {
    id: "stacked-outline",
    label: "Stacked outline",
    preview: "Aa",
    buildPatch: () => ({
      fontFamily: "Anton",
      fontWeight: 400,
      fontStyle: "normal",
      color: 0xffffff,
      fillAlpha: 1,
      strokeColor: 0x000000,
      strokeWidth: 2,
      strokeAlpha: 1,
      shadowEnabled: false,
      glowEnabled: false,
      strokes: [
        { color: 0x000000, width: 6, alpha: 1 },
        { color: 0x000000, width: 12, alpha: 1 },
      ],
    }),
  },
];

export function TextPresets({ layer }: { layer: TextLayer }) {
  return (
    <section style={section}>
      <div style={header}>Quick styles</div>
      <div style={grid}>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            style={tile}
            onClick={() => {
              const patch = preset.buildPatch();
              // snapWeight against the new family in case 700 isn't
              // a real weight on (e.g.) Permanent Marker.
              if (patch.fontFamily && patch.fontWeight) {
                patch.fontWeight = snapWeight(patch.fontFamily, patch.fontWeight);
              }
              history.applyTextPreset(layer.id, patch, preset.label);
            }}
            title={preset.label}
          >
            <span
              style={{
                ...preview,
                fontFamily: `"${preset.buildPatch().fontFamily}", system-ui, sans-serif`,
                fontWeight: preset.buildPatch().fontWeight,
              }}
            >
              {preset.preview}
            </span>
            <span style={tileLabel}>{preset.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const section: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "8px 10px",
  background: "var(--bg-space-2)",
  borderRadius: 6,
  marginBottom: 8,
};

const header: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-primary)",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 6,
};

const tile: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "8px 4px",
  background: "var(--bg-space-1)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 4,
  cursor: "pointer",
  color: "var(--text-primary)",
  minHeight: 56,
};

const preview: CSSProperties = {
  fontSize: 18,
  lineHeight: 1,
};

const tileLabel: CSSProperties = {
  fontSize: 9,
  color: "var(--text-secondary)",
  textAlign: "center",
  lineHeight: 1.1,
};
