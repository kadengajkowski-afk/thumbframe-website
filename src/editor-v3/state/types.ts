/** Layer schema per docs/spikes/react-pixi-wiring.md. Cycle 1 Day 4
 * introduced image layers (discriminated union on `type`). Day 8
 * adds `blendMode` to all variants. Cycle 2 Day 11 adds ellipse;
 * Day 12 adds text. */

/** Day 17: full PixiJS v8 blend-mode surface — 25 distinct modes
 * grouped into 6 visual families. Photoshop's "Hue", "Darker Color",
 * and "Lighter Color" aren't in Pixi v8's advanced-blend-modes set;
 * documented in DEFERRED. Advanced modes require the layer node to
 * be a render group (sceneHelpers.createNode sets isRenderGroup). */
export type BlendMode =
  | "normal"
  // Darken
  | "multiply"
  | "darken"
  | "color-burn"
  | "linear-burn"
  // Lighten
  | "screen"
  | "lighten"
  | "color-dodge"
  | "linear-dodge"
  | "add"
  // Contrast
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "vivid-light"
  | "linear-light"
  | "pin-light"
  | "hard-mix"
  // Inversion
  | "difference"
  | "exclusion"
  | "subtract"
  | "divide"
  | "negation"
  // Component
  | "saturation"
  | "color"
  | "luminosity";

type BaseLayer = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  name: string;
  hidden: boolean;
  locked: boolean;
  blendMode: BlendMode;
};

export type RectLayer = BaseLayer & {
  type: "rect";
  color: number;
  /** Fill color alpha, 0..1. Distinct from layer.opacity which
   * multiplies the entire rendered layer. */
  fillAlpha: number;
  /** Stroke color, 0xRRGGBB. Ignored when strokeWidth is 0. */
  strokeColor: number;
  /** Stroke width in canvas pixels, 0..50 integer. 0 means no stroke. */
  strokeWidth: number;
  /** Stroke color alpha, 0..1. */
  strokeAlpha: number;
};

/** Ellipse inscribed in the bounding box (x, y, width, height). x/y =
 * top-left of the bounding box (consistent with rect). The ellipse
 * geometry — cx, cy, rx, ry — is derived inside the Graphics in
 * sceneHelpers.paintNode, so layer fields stay box-shaped and the
 * select/move/resize/reorder/blend code paths apply unchanged. */
export type EllipseLayer = BaseLayer & {
  type: "ellipse";
  color: number;
  fillAlpha: number;
  strokeColor: number;
  strokeWidth: number;
  strokeAlpha: number;
};

export type ImageLayer = BaseLayer & {
  type: "image";
  bitmap: ImageBitmap;
  naturalWidth: number;
  naturalHeight: number;
};

export type TextAlign = "left" | "center" | "right";
export type FontStyle = "normal" | "italic";
/** Day 12 shipped 6 OFL fonts; Day 13 expands to 25 across six
 * categories. The literal union exists for the font picker; loose
 * strings are accepted on the layer so we don't churn the schema
 * each font drop. */
export const BUNDLED_FONTS = [
  // Sans
  "Inter",
  "Roboto",
  "Montserrat",
  "Poppins",
  "Lato",
  "Open Sans",
  "Raleway",
  "Source Sans 3",
  "Nunito",
  "Work Sans",
  "Rubik",
  // Serif
  "DM Serif Display",
  "Playfair Display",
  "Merriweather",
  "Lora",
  // Display
  "Anton",
  "Bebas Neue",
  "Archivo Black",
  "Oswald",
  "Bangers",
  "Russo One",
  "Squada One",
  "Black Ops One",
  // Handwritten
  "Permanent Marker",
  // Pixel / retro
  "Press Start 2P",
] as const;
export type BundledFont = (typeof BUNDLED_FONTS)[number];

export type FontCategory =
  | "sans"
  | "serif"
  | "display"
  | "handwritten"
  | "pixel"
  | "mono";

/** Day 13 — extra strokes layered behind the primary text for the
 * chunky YouTube-thumbnail outline look. The single stroke
 * (strokeColor/Width/Alpha) carried over from Day 12 stays as the
 * "primary" stroke (innermost). Each entry in `strokes` renders as a
 * separate Text node sitting BEHIND the primary, with progressively
 * thicker strokes — outermost first. Capped at 3. */
export type TextStrokeStack = {
  color: number;
  width: number;
  alpha: number;
};

/** Auto-sized text box. width/height are written by Compositor after
 * the Pixi Text node measures itself — they exist on the layer so
 * selection / drag / hit-test / reorder code paths reuse rect logic.
 *
 * Day 13 additions: shadow*, glow*, and `strokes`. All optional —
 * pre-Day-13 layers in the wild (and tests) keep working because
 * read sites default at point of use. */
export type TextLayer = BaseLayer & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: FontStyle;
  align: TextAlign;
  /** Fill color, 0xRRGGBB. */
  color: number;
  fillAlpha: number;
  strokeColor: number;
  strokeWidth: number;
  strokeAlpha: number;
  lineHeight: number;
  letterSpacing: number;
  // ── Day 13: drop shadow ────────────────────────────────────────
  shadowEnabled?: boolean;
  /** 0xRRGGBB. */
  shadowColor?: number;
  /** 0..1. */
  shadowAlpha?: number;
  /** 0..50, in canvas px. */
  shadowBlur?: number;
  /** -50..50, in canvas px. */
  shadowOffsetX?: number;
  /** -50..50, in canvas px. */
  shadowOffsetY?: number;
  // ── Day 13: outer glow ─────────────────────────────────────────
  glowEnabled?: boolean;
  /** 0xRRGGBB. */
  glowColor?: number;
  /** 0..1. */
  glowAlpha?: number;
  /** 0..50, in canvas px. */
  glowDistance?: number;
  /** 0.1..1 — higher = smoother + slower. */
  glowQuality?: number;
  /** 0..10. */
  glowOuterStrength?: number;
  /** 0..10. */
  glowInnerStrength?: number;
  // ── Day 13: stacked strokes (outer rings) ──────────────────────
  strokes?: TextStrokeStack[];
};

/** Defaults for Day 13 text-effect fields. Used at every read site so
 * pre-existing layers without these fields render cleanly. */
export const TEXT_EFFECT_DEFAULTS = {
  shadowEnabled: false,
  shadowColor: 0x000000,
  shadowAlpha: 0.5,
  shadowBlur: 4,
  shadowOffsetX: 4,
  shadowOffsetY: 4,
  glowEnabled: false,
  glowColor: 0xffffff,
  glowAlpha: 0.7,
  glowDistance: 8,
  glowQuality: 0.5,
  glowOuterStrength: 2,
  glowInnerStrength: 0,
  strokes: [] as TextStrokeStack[],
} as const;
export const MAX_TEXT_STROKES = 3;

/** Subset of TextLayer fields that can be batch-applied via
 * history.applyTextPreset. Excludes id / type / position / size /
 * geometry; presets only restyle, never reposition. */
export type TextLayerPatch = Partial<
  Omit<
    TextLayer,
    "id" | "type" | "x" | "y" | "width" | "height" | "name" | "hidden" | "locked"
  >
>;

export type Layer = RectLayer | EllipseLayer | TextLayer | ImageLayer;
