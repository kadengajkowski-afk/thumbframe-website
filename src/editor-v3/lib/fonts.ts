import {
  BUNDLED_FONTS,
  type BundledFont,
  type FontCategory,
} from "@/state/types";

/** Day 13 font registry: 25 OFL fonts across six categories. The
 * editor stays in lock-step with @/state/types BUNDLED_FONTS so a
 * single source of truth governs which fonts are available.
 *
 * Variable fonts expose a wght axis and accept any integer in their
 * declared range (Pixi snaps; the picker shows the canonical ladder).
 * Single-weight families restrict the picker to that one weight. */
export type FontMeta = {
  family: BundledFont;
  category: FontCategory;
  weights: readonly number[];
  /** True when the woff2 carries a full variable wght axis. */
  variable: boolean;
};

export const FONT_REGISTRY: readonly FontMeta[] = [
  // ── Sans ──
  { family: "Inter", category: "sans", weights: [400, 500, 600, 700, 800, 900], variable: true },
  { family: "Roboto", category: "sans", weights: [100, 300, 400, 500, 700, 900], variable: true },
  { family: "Montserrat", category: "sans", weights: [100, 300, 400, 500, 600, 700, 800, 900], variable: true },
  { family: "Poppins", category: "sans", weights: [300, 400, 600, 700, 900], variable: false },
  { family: "Lato", category: "sans", weights: [400, 700, 900], variable: false },
  { family: "Open Sans", category: "sans", weights: [300, 400, 500, 600, 700, 800], variable: true },
  { family: "Raleway", category: "sans", weights: [100, 300, 400, 500, 600, 700, 800, 900], variable: true },
  { family: "Source Sans 3", category: "sans", weights: [200, 300, 400, 500, 600, 700, 800, 900], variable: true },
  { family: "Nunito", category: "sans", weights: [200, 300, 400, 500, 600, 700, 800, 900], variable: true },
  { family: "Work Sans", category: "sans", weights: [100, 300, 400, 500, 600, 700, 800, 900], variable: true },
  { family: "Rubik", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900], variable: true },
  // ── Serif ──
  { family: "DM Serif Display", category: "serif", weights: [400], variable: false },
  { family: "Playfair Display", category: "serif", weights: [400, 500, 600, 700, 800, 900], variable: true },
  { family: "Merriweather", category: "serif", weights: [300, 400, 700, 900], variable: false },
  { family: "Lora", category: "serif", weights: [400, 500, 600, 700], variable: true },
  // ── Display ──
  { family: "Anton", category: "display", weights: [400], variable: false },
  { family: "Bebas Neue", category: "display", weights: [400], variable: false },
  { family: "Archivo Black", category: "display", weights: [900], variable: false },
  { family: "Oswald", category: "display", weights: [200, 300, 400, 500, 600, 700], variable: true },
  { family: "Bangers", category: "display", weights: [400], variable: false },
  { family: "Russo One", category: "display", weights: [400], variable: false },
  { family: "Squada One", category: "display", weights: [400], variable: false },
  { family: "Black Ops One", category: "display", weights: [400], variable: false },
  // ── Handwritten ──
  { family: "Permanent Marker", category: "handwritten", weights: [400], variable: false },
  // ── Pixel / retro ──
  { family: "Press Start 2P", category: "pixel", weights: [400], variable: false },
];

const REGISTRY_BY_FAMILY = new Map(FONT_REGISTRY.map((m) => [m.family, m]));

/** Order categories appear in the picker. */
export const CATEGORY_ORDER: readonly FontCategory[] = [
  "sans",
  "serif",
  "display",
  "handwritten",
  "pixel",
  "mono",
];

export const CATEGORY_LABEL: Record<FontCategory, string> = {
  sans: "Sans",
  serif: "Serif",
  display: "Display",
  handwritten: "Handwritten",
  pixel: "Pixel",
  mono: "Mono",
};

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
 * font picker previews + first-text-place feel instant. Fire-and-
 * forget — caller doesn't need to await. With 25 fonts this issues
 * 25 small woff2 fetches in parallel; the network coalesces them
 * cheaply and they're all cache-hit on later sessions. */
export function preloadBundledFonts(): void {
  for (const family of BUNDLED_FONTS) {
    const meta = getFontMeta(family);
    if (meta) ensureFontLoaded(family, meta.weights[0]!);
  }
}
