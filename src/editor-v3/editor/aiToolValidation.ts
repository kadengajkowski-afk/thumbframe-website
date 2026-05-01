import { normalizeHex } from "@/lib/color";

/** Day 47 — pre-flight tool input validation.
 *
 * Validators return a short error string on failure (which the AI
 * sees in tool_result + can self-correct), or `null` when input is
 * acceptable. Each error is one sentence + the rule the input
 * violated, so the model has a concrete pivot for the retry. */

const CANVAS_W = 1280;
const CANVAS_H = 720;
const TEXT_FONT_MIN = 40;
const TEXT_FONT_MAX = 250;
// Spec said 50px floor. Existing build patterns use thin accent rects
// (underlines, divider bars, frame edges) at heights as low as 4-8px.
// 50 would block those. Keep the floor low enough to permit accents
// while still blocking zero-size / invisible-tiny rects.
const RECT_MIN = 4;
const ELLIPSE_RADIUS_MIN = 20;
const ELLIPSE_RADIUS_MAX = 600;

/** Approximate width of rendered text. The Compositor auto-resizes
 * to actual glyph metrics on first paint, but for validation we need
 * a quick estimator that errs on the SAFE side (rejects ambiguous
 * cases). 0.6 char-width-ratio handles most sans-serif display fonts;
 * monospace + ultra-wide fonts come back narrower than reality but
 * that bias is acceptable (false-positive over false-negative). */
export function estimateTextWidth(content: string, fontSize: number): number {
  return Math.round(content.length * fontSize * 0.6);
}

export function validateAddText(input: Record<string, unknown>): string | null {
  const content = typeof input.content === "string" ? input.content.trim() : "";
  if (!content) return "Missing required field 'content'.";

  const fontSize = asNumber(input.size);
  if (fontSize !== null) {
    if (fontSize < TEXT_FONT_MIN) {
      return `font_size ${fontSize} is below the ${TEXT_FONT_MIN}px floor — text would be illegible at 168×94 thumbnail size. Try ${TEXT_FONT_MIN}-180.`;
    }
    if (fontSize > TEXT_FONT_MAX) {
      return `font_size ${fontSize} is above the ${TEXT_FONT_MAX}px ceiling for a 1280×720 canvas. Try 100-180 for titles.`;
    }
  }
  const sizeForWidth = fontSize ?? 80;
  const estW = estimateTextWidth(content, sizeForWidth);

  const x = asNumber(input.x);
  if (x !== null) {
    // Default 40px right margin per the canvas rules (outer "danger zone").
    if (x + estW > CANVAS_W - 40) {
      return `Text "${truncate(content)}" at x=${x} with size=${sizeForWidth} would overflow the canvas right edge (estimated width ${estW}px). Lower x, shorten content, or reduce font_size.`;
    }
    if (x < 0) {
      return `x=${x} is off the canvas left edge. Use x ≥ 40 to keep text inside the safe zone.`;
    }
  }
  const y = asNumber(input.y);
  if (y !== null) {
    if (y < 0 || y > CANVAS_H - sizeForWidth) {
      return `y=${y} would push text off-canvas (canvas is ${CANVAS_W}×${CANVAS_H}). Use y in roughly 40..${CANVAS_H - 80}.`;
    }
  }
  return null;
}

export function validateAddRect(input: Record<string, unknown>): string | null {
  const colorHex = typeof input.color === "string" ? normalizeHex(input.color) : null;
  if (!colorHex) return "Missing or invalid 'color' — must be #RRGGBB hex (e.g. \"#FF0000\").";

  const pos = typeof input.position === "string" ? input.position : null;
  let width = asNumber(input.width);
  let height = asNumber(input.height);

  // 'background' position implies a full-canvas rect — width/height
  // are recomputed by the runner. Skip size validation in that case.
  if (pos === "background") return null;

  width = width ?? 400;
  height = height ?? 200;

  if (width < RECT_MIN) {
    return `width=${width} is below the ${RECT_MIN}px floor — too small to register on a thumbnail. Use ≥ ${RECT_MIN}.`;
  }
  if (width > CANVAS_W) {
    return `width=${width} exceeds the canvas width (${CANVAS_W}). Use ≤ ${CANVAS_W}.`;
  }
  if (height < RECT_MIN) {
    return `height=${height} is below the ${RECT_MIN}px floor. Use ≥ ${RECT_MIN}.`;
  }
  if (height > CANVAS_H) {
    return `height=${height} exceeds the canvas height (${CANVAS_H}). Use ≤ ${CANVAS_H}.`;
  }
  const x = asNumber(input.x);
  const y = asNumber(input.y);
  if (x !== null && x + width > CANVAS_W) {
    return `Rect at x=${x} with width=${width} would extend past canvas right edge (${CANVAS_W}). Reduce width or x.`;
  }
  if (y !== null && y + height > CANVAS_H) {
    return `Rect at y=${y} with height=${height} would extend past canvas bottom edge (${CANVAS_H}). Reduce height or y.`;
  }
  if (x !== null && x < 0) return `x=${x} is off the canvas left edge.`;
  if (y !== null && y < 0) return `y=${y} is off the canvas top edge.`;
  return null;
}

export function validateAddEllipse(input: Record<string, unknown>): string | null {
  const colorHex = typeof input.color === "string" ? normalizeHex(input.color) : null;
  if (!colorHex) return "Missing or invalid 'color' — must be #RRGGBB hex.";

  const radius = asNumber(input.radius) ?? 100;
  if (radius < ELLIPSE_RADIUS_MIN) {
    return `radius=${radius} is below ${ELLIPSE_RADIUS_MIN}px — too small to register. Use ≥ ${ELLIPSE_RADIUS_MIN}.`;
  }
  if (radius > ELLIPSE_RADIUS_MAX) {
    return `radius=${radius} exceeds the ${ELLIPSE_RADIUS_MAX}px ceiling. Use ≤ ${ELLIPSE_RADIUS_MAX}.`;
  }
  const size = radius * 2;
  const x = asNumber(input.x);
  const y = asNumber(input.y);
  if (x !== null) {
    if (x < 0 || x + size > CANVAS_W) {
      return `Ellipse at x=${x} with radius=${radius} (size ${size}) extends past canvas. Use x in 0..${CANVAS_W - size}.`;
    }
  }
  if (y !== null) {
    if (y < 0 || y + size > CANVAS_H) {
      return `Ellipse at y=${y} with radius=${radius} (size ${size}) extends past canvas. Use y in 0..${CANVAS_H - size}.`;
    }
  }
  return null;
}

export function validateSetCanvasBackground(
  input: Record<string, unknown>,
): string | null {
  const colorHex = typeof input.color === "string" ? normalizeHex(input.color) : null;
  if (!colorHex) return "Invalid color format. Use #RRGGBB hex (e.g. \"#0A0A0A\").";
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function truncate(s: string): string {
  return s.length > 24 ? s.slice(0, 24) + "…" : s;
}

/** Convenience entrypoint — dispatch by tool name. Returns null when
 * the tool doesn't have a Day 47 validator (existing modify-tools
 * already validate inline in the executor). */
export function validateToolInput(
  tool: string,
  input: Record<string, unknown>,
): string | null {
  switch (tool) {
    case "add_text_layer":          return validateAddText(input);
    case "add_rect_layer":          return validateAddRect(input);
    case "add_ellipse_layer":       return validateAddEllipse(input);
    case "set_canvas_background":   return validateSetCanvasBackground(input);
    default: return null;
  }
}
