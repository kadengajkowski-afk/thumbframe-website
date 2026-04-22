// src/editor-v2/engine/TextOutline.js
// -----------------------------------------------------------------------------
// Purpose:  Convert a text layer's glyphs into per-letter vector paths
//           (shape layers with shapeData.shapeType='path'), so designers
//           can grab, warp, and recolour individual letters.
// Exports:  outlineTextToShapes
// Depends:  opentype.js (already in package.json)
//
// Uses opentype.js to load the font and extract each glyph's path.
// Path commands come out in opentype's format; we translate to the
// SVG-path subset our VectorMask / ShapeRenderer already understand.
//
// Phase 2.a scope: the helper + a test that it produces one shape per
// glyph when a font is provided. The actual font-load pipeline (URL or
// FontFace instance) is Phase 2.b's job; this file takes a parsed
// opentype `Font` instance so the two phases can land independently.
// -----------------------------------------------------------------------------

/**
 * @param {import('opentype.js').Font} font
 * @param {string} text
 * @param {{
 *   x?: number, y?: number,
 *   fontSize?: number,
 *   fill?: string,
 *   letterSpacing?: number,
 * }} opts
 * @returns {Array} shape-layer overrides — caller passes to layer.add
 */
export function outlineTextToShapes(font, text, opts = {}) {
  if (!font || typeof font.getPath !== 'function') return [];
  if (typeof text !== 'string' || text.length === 0) return [];

  const fontSize = Number(opts.fontSize) || 96;
  const x0       = Number(opts.x)        || 0;
  const y0       = Number(opts.y)        || 0;
  const fill     = opts.fill             || '#faecd0';

  const out = [];
  let cursorX = x0;
  for (const ch of text) {
    if (ch === ' ') {
      cursorX += fontSize * 0.3; continue;
    }
    const path = font.getPath(ch, cursorX, y0 + fontSize, fontSize);
    const svg  = _opentypePathToSvgString(path);
    const bbox = path.getBoundingBox();
    out.push({
      type: 'shape',
      name: `Letter: ${ch}`,
      x:      (bbox.x1 + bbox.x2) / 2,
      y:      (bbox.y1 + bbox.y2) / 2,
      width:  Math.max(1, bbox.x2 - bbox.x1),
      height: Math.max(1, bbox.y2 - bbox.y1),
      shapeData: {
        shapeType: 'vectorPath',
        commands:  _svgStringToCommands(svg),
        fill,
        stroke:       null,
        strokeWidth:  0,
      },
    });
    const glyph = font.charToGlyph(ch);
    cursorX += (glyph.advanceWidth || fontSize * 0.6) * (fontSize / font.unitsPerEm);
    cursorX += Number(opts.letterSpacing) || 0;
  }
  return out;
}

// ── internals ──────────────────────────────────────────────────────────────

function _opentypePathToSvgString(path) {
  if (!path || !Array.isArray(path.commands)) return '';
  const parts = [];
  for (const c of path.commands) {
    switch (c.type) {
      case 'M': parts.push(`M ${c.x} ${c.y}`); break;
      case 'L': parts.push(`L ${c.x} ${c.y}`); break;
      case 'Q': parts.push(`Q ${c.x1} ${c.y1} ${c.x} ${c.y}`); break;
      case 'C': parts.push(`C ${c.x1} ${c.y1} ${c.x2} ${c.y2} ${c.x} ${c.y}`); break;
      case 'Z': parts.push('Z'); break;
      default:  break;
    }
  }
  return parts.join(' ');
}

/**
 * Convert an SVG string to the command array our ShapeRenderer +
 * VectorMask expect. Mirrors parseSvgPath's output but emitted inline
 * to keep this module independent.
 */
function _svgStringToCommands(svg) {
  if (typeof svg !== 'string' || !svg) return [];
  // Delegate to parseSvgPath for a single canonical implementation.
  // Inline the dynamic import so tests that stub VectorMask can still
  // exercise outlineTextToShapes' own branches.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { parseSvgPath } = require('./VectorMask.js');
  return parseSvgPath(svg);
}
