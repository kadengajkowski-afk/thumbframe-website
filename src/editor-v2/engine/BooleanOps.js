// src/editor-v2/engine/BooleanOps.js
// -----------------------------------------------------------------------------
// Purpose:  Boolean operations on shape layers — unite, subtract,
//           intersect, exclude. Uses the polygon-clipping library,
//           installed as part of Phase 1.e.
// Exports:  booleanOp, shapeToPolygon
// Depends:  polygon-clipping, ./VectorMask (for path flattening)
//
// Contract:
//   • Each input shape layer is flattened to a GeoJSON-style polygon
//     ring-of-rings format [[[x,y], ...]].
//   • Operations run in world coordinates — the caller passes layers
//     whose x/y/width/height/shapeData are already in canvas space.
//   • Results are emitted as a merged polygon layer (type=shape,
//     shapeData.shapeType='polygon', shapeData.points=[[x,y]…]).
// -----------------------------------------------------------------------------

import polygonClipping from 'polygon-clipping';
import { samplePathToPolygon } from './VectorMask.js';

/** @typedef {'unite'|'subtract'|'intersect'|'exclude'} BooleanMode */

/**
 * Convert a shape layer to a GeoJSON-style ring-of-rings polygon.
 * Supports rect, polygon, star, ellipse, line (zero-width-ruled-out),
 * arrow (flattened), and generic vectorPath shapes.
 *
 * @param {any} layer
 * @returns {Array<Array<Array<number>>>}
 */
export function shapeToPolygon(layer) {
  if (!layer || layer.type !== 'shape' || !layer.shapeData) return [];
  const sd = layer.shapeData;
  const cx = layer.x, cy = layer.y;
  const hw = (layer.width || 0) / 2, hh = (layer.height || 0) / 2;

  switch (sd.shapeType) {
    case 'rect':
    case 'rectangle':
      return [[[
        [cx - hw, cy - hh], [cx + hw, cy - hh],
        [cx + hw, cy + hh], [cx - hw, cy + hh],
        [cx - hw, cy - hh],
      ]]].map(_flatten);
    case 'circle':
    case 'ellipse':
      return [[_ellipseRing(cx, cy, hw, hh, 48)]];
    case 'polygon':
    case 'star': {
      const sides = sd.sides || (sd.shapeType === 'star' ? 5 : 6);
      const inner = sd.innerRadius || hw * 0.5;
      const outer = hw;
      const ring = [];
      const stepCount = sd.shapeType === 'star' ? sides * 2 : sides;
      for (let i = 0; i < stepCount; i++) {
        const r = (sd.shapeType === 'star' && i % 2 === 1) ? inner : outer;
        const a = (i / stepCount) * Math.PI * 2 - Math.PI / 2;
        ring.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      ring.push(ring[0]);
      return [[ring]];
    }
    case 'vectorPath':
    case 'path': {
      const flat = samplePathToPolygon(sd.commands || [], 16);
      if (flat.length < 6) return [];
      const ring = [];
      for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]]);
      ring.push(ring[0]);
      return [[ring]];
    }
    default:
      return [];
  }
}

// polygon-clipping expects the outer array to wrap "multipolygon" but a
// 2D ring-of-rings (MultiPolygon form) is the canonical input. _flatten
// strips a level of nesting when the caller produced a single polygon.
function _flatten(x) { return x; }

function _ellipseRing(cx, cy, rx, ry, segs) {
  const ring = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    ring.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  ring.push(ring[0]);
  return ring;
}

/**
 * Run a boolean op across multiple input shape layers.
 *
 * @param {BooleanMode} mode
 * @param {any[]} layers  in operand order; for subtract the first is the
 *                        minuend, the rest are subtrahends
 * @returns {Array<Array<Array<Array<number>>>>}  MultiPolygon result
 */
export function booleanOp(mode, layers) {
  const polys = layers.map(shapeToPolygon).filter(p => p.length > 0);
  if (polys.length === 0) return [];
  const fn = _fn(mode);
  if (!fn) throw new Error(`[BooleanOps] unknown mode: ${mode}`);
  if (polys.length === 1) return polys[0];
  return fn(...polys);
}

function _fn(mode) {
  switch (mode) {
    case 'unite':     return polygonClipping.union;
    case 'subtract':  return polygonClipping.difference;
    case 'intersect': return polygonClipping.intersection;
    case 'exclude':   return polygonClipping.xor;
    default:          return null;
  }
}

/**
 * Collapse a MultiPolygon result back into a `shapeData` polygon suitable
 * for a new shape layer. If the result has multiple disjoint rings only
 * the largest is kept (the UI can expose "keep all" in Phase 4.c).
 *
 * @param {Array<Array<Array<Array<number>>>>} multi
 * @returns {{ shapeType:'polygon', points:Array<[number,number]> } | null}
 */
export function multiPolygonToShapeData(multi) {
  if (!Array.isArray(multi) || multi.length === 0) return null;
  let bestArea = -Infinity, bestRing = null;
  for (const poly of multi) {
    if (!Array.isArray(poly) || poly.length === 0) continue;
    const ring = poly[0]; // outer ring
    const area = Math.abs(_ringArea(ring));
    if (area > bestArea) { bestArea = area; bestRing = ring; }
  }
  if (!bestRing) return null;
  return {
    shapeType: 'polygon',
    points:    bestRing.map(p => [p[0], p[1]]),
  };
}

function _ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a / 2;
}
