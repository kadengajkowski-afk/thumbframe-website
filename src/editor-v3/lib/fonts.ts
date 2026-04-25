import { BUNDLED_FONTS, type BundledFont } from "@/state/types";

/** Day 12 font registry. Keep ContextPanel + TextTool defaults +
 * font-loading in lock-step with @/state/types BUNDLED_FONTS so a
 * single source of truth governs which fonts ship today. Day 13
 * expands with extended Unicode subsets + ~25-30 fonts.
 *
 * Each entry lists the weights we expose in the dropdown. Inter +
 * Oswald are variable, so we expose the canonical 100/300/400 ladder
 * even though any value in the range renders. The single-weight
 * fonts (Anton, Bebas Neue, Permanent Marker = 400; Archivo Black =
 * 900) restrict the dropdown to that one weight. */
export type FontMeta = {
  family: BundledFont;
  weights: readonly number[];
  /** True when the woff2 carries a full variable axis. */
  variable: boolean;
};

export const FONT_REGISTRY: readonly FontMeta[] = [
  { family: "Inter", weights: [400, 500, 600, 700, 800, 900], variable: true },
  { family: "Anton", weights: [400], variable: false },
  { family: "Bebas Neue", weights: [400], variable: false },
  { family: "Archivo Black", weights: [900], variable: false },
  { family: "Oswald", weights: [200, 300, 400, 500, 600, 700], variable: true },
  { family: "Permanent Marker", weights: [400], variable: false },
];

const REGISTRY_BY_FAMILY = new Map(FONT_REGISTRY.map((m) => [m.family, m]));

export function getFontMeta(family: string): FontMeta | undefined {
  return REGISTRY_BY_FAMILY.get(family as BundledFont);
}

/** Snap a requested weight to the nearest weight the font actually
 * carries. Variable fonts pass through unchanged inside their range;
 * single-weight fonts always return their one weight. */
export function snapWeight(family: string, weight: number): number {
  const meta = getFontMeta(family);
  if (!meta) return weight;
  if (meta.variable) {
    const min = meta.weights[0]!;
    const max = meta.weights[meta.weights.length - 1]!;
    return Math.max(min, Math.min(max, Math.round(weight)));
  }
  let best = meta.weights[0]!;
  for (const w of meta.weights) {
    if (Math.abs(w - weight) < Math.abs(best - weight)) best = w;
  }
  return best;
}

/** Cache of in-flight + resolved font loads. Key is `${weight} ${family}`.
 * `document.fonts.load` returns the same FontFace[] on repeat calls
 * but caching the promise short-circuits the await, important for the
 * paint-on-every-keystroke path in Compositor. */
const loadCache = new Map<string, Promise<FontFace[]>>();

export function ensureFontLoaded(
  family: string,
  weight: number,
  size = 16,
): Promise<FontFace[]> {
  if (typeof document === "undefined" || !document.fonts) {
    return Promise.resolve([]);
  }
  const key = `${weight} ${family}`;
  let pending = loadCache.get(key);
  if (!pending) {
    // The size in the spec is what document.fonts.load matches against;
    // 16px is sufficient — once loaded, the font is available at any
    // size. The family must be quoted exactly as used in CSS.
    pending = document.fonts.load(`${weight} ${size}px "${family}"`);
    loadCache.set(key, pending);
  }
  return pending;
}

/** Eagerly load every bundled font's first weight on app boot so the
 * font dropdown previews + first-text-place feel instant. Fire-and-
 * forget — caller doesn't need to await. */
export function preloadBundledFonts(): void {
  for (const family of BUNDLED_FONTS) {
    const meta = getFontMeta(family);
    if (meta) ensureFontLoaded(family, meta.weights[0]!);
  }
}
