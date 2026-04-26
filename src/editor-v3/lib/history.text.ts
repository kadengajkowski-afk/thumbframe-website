import type {
  FontStyle,
  Layer,
  TextAlign,
  TextLayerPatch,
  TextStrokeStack,
} from "@/state/types";
import { MAX_TEXT_STROKES } from "@/state/types";
import { commit, isStrokeOpen, mutate } from "./history.internal";

/** Day 13 text-effect setters split out of lib/history.ts so the
 * main file stays under the 400-line ceiling. The shared
 * commit / mutate / openStroke machinery lives in history.internal
 * (Day 15 split) so this file and history.ts both import from there
 * — neither imports the other, no circular dep. */

function strokeAware(label: string, run: (layers: Layer[]) => void) {
  if (isStrokeOpen()) mutate(run);
  else commit(label, run);
}

export const textHistory = {
  // ── Day 12: text content + typography setters ────────────────────
  setText(id: string, text: string) {
    commit("Edit text", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.text = text;
    });
  },

  setFontFamily(id: string, fontFamily: string) {
    commit("Font", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.fontFamily = fontFamily;
    });
  },

  setFontSize(id: string, fontSize: number) {
    strokeAware("Font size", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.fontSize = fontSize;
    });
  },

  setFontWeight(id: string, fontWeight: number) {
    commit("Font weight", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.fontWeight = fontWeight;
    });
  },

  setFontStyle(id: string, fontStyle: FontStyle) {
    commit("Italic", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.fontStyle = fontStyle;
    });
  },

  setTextAlign(id: string, align: TextAlign) {
    commit("Text align", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.align = align;
    });
  },

  setLineHeight(id: string, lineHeight: number) {
    strokeAware("Line height", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.lineHeight = lineHeight;
    });
  },

  setLetterSpacing(id: string, letterSpacing: number) {
    strokeAware("Letter spacing", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.letterSpacing = letterSpacing;
    });
  },

  // ── Day 13: drop shadow ──────────────────────────────────────────
  setShadowEnabled(id: string, enabled: boolean) {
    commit(enabled ? "Enable shadow" : "Disable shadow", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.shadowEnabled = enabled;
    });
  },

  setShadowColor(id: string, color: number) {
    strokeAware("Shadow color", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.shadowColor = color;
    });
  },

  setShadowAlpha(id: string, alpha: number) {
    strokeAware("Shadow opacity", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.shadowAlpha = alpha;
    });
  },

  setShadowBlur(id: string, blur: number) {
    strokeAware("Shadow blur", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.shadowBlur = blur;
    });
  },

  setShadowOffset(id: string, offsetX: number, offsetY: number) {
    strokeAware("Shadow offset", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") {
        l.shadowOffsetX = offsetX;
        l.shadowOffsetY = offsetY;
      }
    });
  },

  // ── Day 13: outer glow ───────────────────────────────────────────
  setGlowEnabled(id: string, enabled: boolean) {
    commit(enabled ? "Enable glow" : "Disable glow", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowEnabled = enabled;
    });
  },

  setGlowColor(id: string, color: number) {
    strokeAware("Glow color", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowColor = color;
    });
  },

  setGlowAlpha(id: string, alpha: number) {
    strokeAware("Glow opacity", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowAlpha = alpha;
    });
  },

  setGlowDistance(id: string, distance: number) {
    strokeAware("Glow distance", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowDistance = distance;
    });
  },

  setGlowQuality(id: string, quality: number) {
    strokeAware("Glow quality", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowQuality = quality;
    });
  },

  setGlowOuterStrength(id: string, strength: number) {
    strokeAware("Glow outer strength", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowOuterStrength = strength;
    });
  },

  setGlowInnerStrength(id: string, strength: number) {
    strokeAware("Glow inner strength", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (l && l.type === "text") l.glowInnerStrength = strength;
    });
  },

  // ── Day 13: stacked strokes ──────────────────────────────────────
  addStroke(id: string, stroke: TextStrokeStack) {
    commit("Add stroke", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (!l || l.type !== "text") return;
      const stack = l.strokes ?? [];
      if (stack.length >= MAX_TEXT_STROKES) return;
      l.strokes = [...stack, stroke];
    });
  },

  removeStroke(id: string, index: number) {
    commit("Remove stroke", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (!l || l.type !== "text" || !l.strokes) return;
      if (index < 0 || index >= l.strokes.length) return;
      l.strokes = l.strokes.filter((_, i) => i !== index);
    });
  },

  setStroke(id: string, index: number, patch: Partial<TextStrokeStack>) {
    strokeAware("Edit stroke", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (!l || l.type !== "text" || !l.strokes) return;
      const cur = l.strokes[index];
      if (!cur) return;
      l.strokes[index] = { ...cur, ...patch };
    });
  },

  /** Apply a text-style preset in ONE history entry. The patch is
   * shallow-merged onto the layer; arrays in the patch (e.g.
   * `strokes`) replace whole. Use this instead of calling many
   * setters in a loop — that would push N history entries. */
  applyTextPreset(id: string, patch: Partial<TextLayerPatch>, label: string) {
    commit(label, (layers) => {
      const l = layers.find((x) => x.id === id);
      if (!l || l.type !== "text") return;
      Object.assign(l, patch);
    });
  },
};
