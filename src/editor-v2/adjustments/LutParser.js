// src/editor-v2/adjustments/LutParser.js
// -----------------------------------------------------------------------------
// Purpose:  Parser for the Adobe / DaVinci .cube LUT format. Produces a
//           { size, data: Float32Array } object that LutApply consumes.
// Exports:  parseCubeLut, applyLut
// Depends:  nothing
//
// .cube 3D LUT spec (abbreviated):
//   TITLE "…"
//   LUT_3D_SIZE <N>             — N in [2, 256]
//   DOMAIN_MIN / DOMAIN_MAX      — optional
//   <N*N*N rows of "r g b" triples in row-major B→G→R order>
// Comments start with #. Whitespace lines are skipped.
// -----------------------------------------------------------------------------

/**
 * @param {string} cubeStr
 * @returns {{ size:number, data:Float32Array, domain:[[number,number,number],[number,number,number]] } | null}
 */
export function parseCubeLut(cubeStr) {
  if (typeof cubeStr !== 'string' || !cubeStr.length) return null;
  const lines = cubeStr.split(/\r?\n/);
  let size = 0;
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];
  /** @type {number[]} */
  const vals = [];

  for (const raw of lines) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    if (/^TITLE\b/i.test(line)) continue;
    const szMatch = line.match(/^LUT_3D_SIZE\s+(\d+)/i);
    if (szMatch) { size = Number(szMatch[1]); continue; }
    const lutIndMatch = line.match(/^LUT_1D_SIZE\s+(\d+)/i);
    if (lutIndMatch) return null; // 1D LUTs out of scope for Phase 3.c
    if (/^DOMAIN_MIN\b/i.test(line)) {
      domainMin = line.split(/\s+/).slice(1).map(Number);
      continue;
    }
    if (/^DOMAIN_MAX\b/i.test(line)) {
      domainMax = line.split(/\s+/).slice(1).map(Number);
      continue;
    }
    const parts = line.split(/\s+/).map(Number);
    if (parts.length === 3 && parts.every(n => Number.isFinite(n))) {
      vals.push(parts[0], parts[1], parts[2]);
    }
  }

  if (!size || vals.length !== size * size * size * 3) return null;
  return {
    size,
    data:   new Float32Array(vals),
    domain: [domainMin, domainMax],
  };
}

/**
 * Apply a parsed LUT to an RGBA Uint8ClampedArray in place, using
 * trilinear interpolation.
 *
 * @param {Uint8ClampedArray} data
 * @param {{ size:number, data:Float32Array }} lut
 * @param {number} [strength]   0..1 — blend between original and LUT
 */
export function applyLut(data, lut, strength = 1) {
  if (!(data instanceof Uint8ClampedArray) || !lut || !lut.data || !lut.size) return;
  const N = lut.size;
  const lutData = lut.data;
  const s = Math.max(0, Math.min(1, Number(strength) || 0));
  const stride = N;
  const strideSq = N * N;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const gr = r * (N - 1);
    const gg = g * (N - 1);
    const gb = b * (N - 1);
    const ir = Math.floor(gr), ig = Math.floor(gg), ib = Math.floor(gb);
    const fr = gr - ir,         fg = gg - ig,         fb = gb - ib;
    const ir1 = Math.min(N - 1, ir + 1);
    const ig1 = Math.min(N - 1, ig + 1);
    const ib1 = Math.min(N - 1, ib + 1);

    const idx = (x, y, z) => (z * strideSq + y * stride + x) * 3;
    const c000 = idx(ir,  ig,  ib);
    const c100 = idx(ir1, ig,  ib);
    const c010 = idx(ir,  ig1, ib);
    const c110 = idx(ir1, ig1, ib);
    const c001 = idx(ir,  ig,  ib1);
    const c101 = idx(ir1, ig,  ib1);
    const c011 = idx(ir,  ig1, ib1);
    const c111 = idx(ir1, ig1, ib1);

    for (let c = 0; c < 3; c++) {
      const v00 = lutData[c000 + c] + fr * (lutData[c100 + c] - lutData[c000 + c]);
      const v10 = lutData[c010 + c] + fr * (lutData[c110 + c] - lutData[c010 + c]);
      const v01 = lutData[c001 + c] + fr * (lutData[c101 + c] - lutData[c001 + c]);
      const v11 = lutData[c011 + c] + fr * (lutData[c111 + c] - lutData[c011 + c]);
      const v0  = v00 + fg * (v10 - v00);
      const v1  = v01 + fg * (v11 - v01);
      const v   = v0  + fb * (v1 - v0);
      const orig = data[i + c];
      data[i + c] = Math.max(0, Math.min(255, Math.round(orig + (v * 255 - orig) * s)));
    }
  }
}
