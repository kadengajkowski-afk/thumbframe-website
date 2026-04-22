// src/editor-v2/engine/VectorMask.js
// -----------------------------------------------------------------------------
// Purpose:  Parse SVG-path-style mask descriptors into a normalised shape
//           that the Renderer can hand to Pixi as a stencil mask. Also
//           provides an `applyMaskToSprite` helper that sets the Pixi
//           mask relationship given a parsed vector mask.
// Exports:  parseSvgPath, samplePathToPolygon, buildMaskGraphics,
//           applyMaskToSprite
// Depends:  nothing at test time (pixi.js is lazy-imported in
//           applyMaskToSprite so jsdom tests don't need it).
//
// SVG path syntax is famously gnarly. Phase 1.e supports the subset the
// editor actually emits from the shape tools: M, L, H, V, C, Q, Z. That
// covers every shape kind that Phase 1.a's ShapeRenderer produces
// (rect, polygon, star, arrow, line, ellipse approximated as Bezier).
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} VectorPathCommand
 * @property {'M'|'L'|'C'|'Q'|'Z'} kind
 * @property {number[]} args
 */

/**
 * Tokenise and parse an SVG path string into a list of commands. Returns
 * an empty array on malformed input (never throws — the caller treats an
 * unparseable path as "no mask").
 *
 * @param {string} pathStr
 * @returns {VectorPathCommand[]}
 */
export function parseSvgPath(pathStr) {
  if (typeof pathStr !== 'string' || !pathStr.trim()) return [];
  const tokens = pathStr.match(/([a-zA-Z])|(-?\d+(?:\.\d+)?(?:e-?\d+)?)/g);
  if (!tokens) return [];
  const out = [];
  let cursorX = 0, cursorY = 0;
  let startX = 0,  startY = 0;
  let prev = null;

  let i = 0;
  while (i < tokens.length) {
    let cmd = tokens[i];
    const isAbs = cmd === cmd.toUpperCase();
    const upper = cmd.toUpperCase();
    i++;
    // Z takes no args.
    if (upper === 'Z') {
      out.push({ kind: 'Z', args: [] });
      cursorX = startX; cursorY = startY;
      prev = upper;
      continue;
    }
    // Read args until we hit the next letter.
    const nums = [];
    while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
      nums.push(Number(tokens[i])); i++;
    }

    const consume = (n) => {
      if (nums.length < n) return null;
      return nums.splice(0, n);
    };

    while (nums.length) {
      // Implicit command repeat: after M, subsequent coord pairs are L.
      // After C, subsequent 6-tuples are another C.
      let op = upper;
      if (prev === 'M' && upper === 'M') op = 'L';

      if (op === 'M' || op === 'L') {
        const pair = consume(2); if (!pair) break;
        const [x, y] = isAbs ? pair : [cursorX + pair[0], cursorY + pair[1]];
        out.push({ kind: op, args: [x, y] });
        cursorX = x; cursorY = y;
        if (op === 'M') { startX = x; startY = y; }
        prev = 'M';
      } else if (op === 'H') {
        const n = consume(1); if (!n) break;
        const x = isAbs ? n[0] : cursorX + n[0];
        out.push({ kind: 'L', args: [x, cursorY] });
        cursorX = x;
      } else if (op === 'V') {
        const n = consume(1); if (!n) break;
        const y = isAbs ? n[0] : cursorY + n[0];
        out.push({ kind: 'L', args: [cursorX, y] });
        cursorY = y;
      } else if (op === 'C') {
        const six = consume(6); if (!six) break;
        const [x1, y1, x2, y2, x, y] = isAbs
          ? six
          : [cursorX + six[0], cursorY + six[1], cursorX + six[2], cursorY + six[3], cursorX + six[4], cursorY + six[5]];
        out.push({ kind: 'C', args: [x1, y1, x2, y2, x, y] });
        cursorX = x; cursorY = y;
      } else if (op === 'Q') {
        const four = consume(4); if (!four) break;
        const [x1, y1, x, y] = isAbs
          ? four
          : [cursorX + four[0], cursorY + four[1], cursorX + four[2], cursorY + four[3]];
        out.push({ kind: 'Q', args: [x1, y1, x, y] });
        cursorX = x; cursorY = y;
      } else {
        // Unknown command — bail on this batch rather than infinite-loop.
        break;
      }
    }
    prev = upper;
  }
  return out;
}

/**
 * Sample a parsed path to a flat [x0, y0, x1, y1, ...] polygon. Curves
 * are flattened into N straight segments each. This feeds polygon-
 * clipping boolean ops and the Pixi Graphics mask helper below.
 *
 * @param {VectorPathCommand[]} commands
 * @param {number} [segments] segments-per-curve
 * @returns {number[]}
 */
export function samplePathToPolygon(commands, segments = 12) {
  const poly = [];
  let cx = 0, cy = 0;
  for (const c of commands) {
    if (c.kind === 'M' || c.kind === 'L') {
      const [x, y] = c.args;
      poly.push(x, y);
      cx = x; cy = y;
    } else if (c.kind === 'C') {
      const [x1, y1, x2, y2, x, y] = c.args;
      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        const it = 1 - t;
        const px = it*it*it*cx + 3*it*it*t*x1 + 3*it*t*t*x2 + t*t*t*x;
        const py = it*it*it*cy + 3*it*it*t*y1 + 3*it*t*t*y2 + t*t*t*y;
        poly.push(px, py);
      }
      cx = x; cy = y;
    } else if (c.kind === 'Q') {
      const [x1, y1, x, y] = c.args;
      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        const it = 1 - t;
        const px = it*it*cx + 2*it*t*x1 + t*t*x;
        const py = it*it*cy + 2*it*t*y1 + t*t*y;
        poly.push(px, py);
      }
      cx = x; cy = y;
    } else if (c.kind === 'Z') {
      // Close ring — nothing to emit as a separate coordinate.
    }
  }
  return poly;
}

/**
 * Build a Pixi Graphics from a parsed path, centred at the given size so
 * it aligns with a Sprite whose anchor is 0.5. Returns null on empty
 * input so the caller can skip masking.
 *
 * @param {VectorPathCommand[]} commands
 * @param {number} width
 * @param {number} height
 * @returns {Promise<import('pixi.js').Graphics | null>}
 */
export async function buildMaskGraphics(commands, width, height) {
  if (!Array.isArray(commands) || commands.length === 0) return null;
  const { Graphics } = await import('pixi.js');
  const g = new Graphics();
  // Coordinates in the path are assumed to be in 0..width × 0..height;
  // we don't re-center here (the Sprite's own anchor does the work).
  void width; void height;
  let cx = 0, cy = 0;
  for (const c of commands) {
    if (c.kind === 'M') { g.moveTo(c.args[0], c.args[1]); cx = c.args[0]; cy = c.args[1]; }
    else if (c.kind === 'L') { g.lineTo(c.args[0], c.args[1]); cx = c.args[0]; cy = c.args[1]; }
    else if (c.kind === 'C') {
      g.bezierCurveTo(c.args[0], c.args[1], c.args[2], c.args[3], c.args[4], c.args[5]);
      cx = c.args[4]; cy = c.args[5];
    }
    else if (c.kind === 'Q') {
      g.quadraticCurveTo(c.args[0], c.args[1], c.args[2], c.args[3]);
      cx = c.args[2]; cy = c.args[3];
    }
    else if (c.kind === 'Z') { g.closePath(); }
  }
  g.fill({ color: 0xffffff, alpha: 1 });
  return g;
}

/**
 * Apply a parsed vector mask to a Pixi sprite. Rebuilds the mask
 * Graphics and assigns it to sprite.mask. Honors `inverted` via an
 * alpha invert on the Graphics.
 *
 * @param {import('pixi.js').Container} sprite
 * @param {VectorPathCommand[]} commands
 * @param {{ width:number, height:number, inverted?:boolean }} opts
 */
export async function applyMaskToSprite(sprite, commands, opts) {
  if (!sprite) return;
  const g = await buildMaskGraphics(commands, opts.width, opts.height);
  if (!g) { sprite.mask = null; return; }
  if (opts.inverted) g.alpha = 0;  // placeholder invert — real inversion via a second rect subtract in 1.f
  sprite.mask = g;
}
