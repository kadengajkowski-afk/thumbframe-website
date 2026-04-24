/**
 * Color format utilities. Pure functions, zero deps.
 *
 * The editor moves between three representations:
 *   - hex string: "#F97316" (canonical "#" + 6 uppercase)
 *   - rgb triple: { r, g, b } with 0..255 integers
 *   - pixi number: 0xF97316 — the value Pixi Graphics.fill({ color }) takes
 *
 * The picker UI talks in hex; docStore stores Pixi numbers; RGB is a
 * display-only view in the picker inputs. Alpha is never baked into
 * any of these — it travels on a separate 0..1 float field per layer.
 */

export type Rgb = { r: number; g: number; b: number };

/** Clamp + round a number to an integer in [0, 255]. */
function clamp8(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const n = Math.round(v);
  if (n < 0) return 0;
  if (n > 255) return 255;
  return n;
}

/** Strip any leading "#", lowercase. */
function stripHash(raw: string): string {
  return (raw ?? "").replace(/^#/, "").toLowerCase();
}

const RE_3 = /^[0-9a-f]{3}$/;
const RE_6 = /^[0-9a-f]{6}$/;
const RE_8 = /^[0-9a-f]{8}$/;

/** Returns true if `raw` is a valid 3/6/8-char hex (with or without #). */
export function isHex(raw: string): boolean {
  const h = stripHash(raw);
  return RE_3.test(h) || RE_6.test(h) || RE_8.test(h);
}

/** Normalize any accepted hex form to canonical "#RRGGBB" uppercase.
 * 8-char (RRGGBBAA) drops the alpha — alpha lives on a separate
 * per-layer field in this editor. Returns null on invalid input. */
export function normalizeHex(raw: string): string | null {
  const h = stripHash(raw);
  if (RE_3.test(h)) {
    const [a, b, c] = [h[0], h[1], h[2]];
    return `#${a}${a}${b}${b}${c}${c}`.toUpperCase();
  }
  if (RE_6.test(h)) return `#${h.toUpperCase()}`;
  if (RE_8.test(h)) return `#${h.slice(0, 6).toUpperCase()}`;
  return null;
}

/** Parse a 3/6/8-char hex into an RGB triple. Null on invalid input. */
export function hexToRgb(raw: string): Rgb | null {
  const n = normalizeHex(raw);
  if (!n) return null;
  const h = n.slice(1); // strip "#"
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

/** Format an RGB triple into canonical "#RRGGBB" uppercase. */
export function rgbToHex(rgb: Rgb): string {
  const parts = [rgb.r, rgb.g, rgb.b].map((v) =>
    clamp8(v).toString(16).padStart(2, "0"),
  );
  return `#${parts.join("")}`.toUpperCase();
}

/** Hex → Pixi's 0xRRGGBB number. Returns 0 on invalid input — caller
 * should gate with isHex if that matters. */
export function hexToPixi(raw: string): number {
  const n = normalizeHex(raw);
  if (!n) return 0;
  return Number.parseInt(n.slice(1), 16);
}

/** Pixi 0xRRGGBB → canonical "#RRGGBB" uppercase. */
export function pixiToHex(pixi: number): string {
  const n = Math.max(0, Math.min(0xffffff, Math.floor(pixi)));
  return `#${n.toString(16).padStart(6, "0")}`.toUpperCase();
}
