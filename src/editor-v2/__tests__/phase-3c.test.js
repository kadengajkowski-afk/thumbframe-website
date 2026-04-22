// src/editor-v2/__tests__/phase-3c.test.js
// -----------------------------------------------------------------------------
// Phase 3.c regression suite. Covers:
//   • .cube LUT parser: identity LUT, titles + comments, size mismatch,
//     1D LUT rejection
//   • applyLut roundtrip (identity = no change) + full-saturation map
//   • BundledLuts: registry size + every entry builds cleanly
//   • Presets: normalize, apply, default catalog covers all categories
// -----------------------------------------------------------------------------

import { parseCubeLut, applyLut } from '../adjustments/LutParser';
import {
  BUNDLED_LUTS,
  listBundledLuts,
  buildBundledLut,
} from '../adjustments/BundledLuts';
import {
  PRESET_CATEGORIES,
  DEFAULT_PRESETS,
  normalizePreset,
  applyPreset,
} from '../adjustments/Presets';

function makeRgbaBuffer(colors) {
  const out = new Uint8ClampedArray(colors.length * 4);
  for (let i = 0; i < colors.length; i++) {
    out[i*4]   = colors[i][0];
    out[i*4+1] = colors[i][1];
    out[i*4+2] = colors[i][2];
    out[i*4+3] = 255;
  }
  return out;
}

// ── .cube parser ───────────────────────────────────────────────────────────
describe('parseCubeLut', () => {
  function buildIdentityCube(size) {
    const lines = [`TITLE "identity"`, `LUT_3D_SIZE ${size}`];
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          lines.push(`${r / (size - 1)} ${g / (size - 1)} ${b / (size - 1)}`);
        }
      }
    }
    return lines.join('\n');
  }

  test('parses a 2-sized identity cube', () => {
    const out = parseCubeLut(buildIdentityCube(2));
    expect(out).not.toBeNull();
    expect(out.size).toBe(2);
    expect(out.data.length).toBe(8 * 3);
  });

  test('skips comments and blank lines', () => {
    const src = `# header\n\nTITLE "x"\n# comment\nLUT_3D_SIZE 2\n\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n`;
    const out = parseCubeLut(src);
    expect(out.size).toBe(2);
  });

  test('rejects 1D LUTs', () => {
    expect(parseCubeLut(`LUT_1D_SIZE 16\n`)).toBeNull();
  });

  test('rejects size mismatch', () => {
    const src = `LUT_3D_SIZE 2\n0 0 0\n1 0 0\n`;
    expect(parseCubeLut(src)).toBeNull();
  });

  test('null / empty input returns null', () => {
    expect(parseCubeLut(null)).toBeNull();
    expect(parseCubeLut('')).toBeNull();
  });
});

describe('applyLut', () => {
  const identity2 = parseCubeLut(
    `LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n`,
  );

  test('identity LUT roundtrips the input', () => {
    const buf = makeRgbaBuffer([[50, 100, 200]]);
    applyLut(buf, identity2, 1);
    expect(Math.abs(buf[0] - 50)).toBeLessThanOrEqual(2);
    expect(Math.abs(buf[1] - 100)).toBeLessThanOrEqual(2);
    expect(Math.abs(buf[2] - 200)).toBeLessThanOrEqual(2);
  });

  test('strength=0 is an identity blend', () => {
    const buf = makeRgbaBuffer([[50, 100, 200]]);
    applyLut(buf, identity2, 0);
    expect([...buf]).toEqual([50, 100, 200, 255]);
  });

  test('invert LUT flips rgb', () => {
    const src = `LUT_3D_SIZE 2\n1 1 1\n0 1 1\n1 0 1\n0 0 1\n1 1 0\n0 1 0\n1 0 0\n0 0 0\n`;
    const lut = parseCubeLut(src);
    const buf = makeRgbaBuffer([[0, 0, 0]]);
    applyLut(buf, lut, 1);
    expect(buf[0]).toBe(255);
    expect(buf[1]).toBe(255);
    expect(buf[2]).toBe(255);
  });
});

// ── Bundled LUTs ───────────────────────────────────────────────────────────
describe('BundledLuts', () => {
  test('listBundledLuts returns at least 10 entries', () => {
    expect(listBundledLuts().length).toBeGreaterThanOrEqual(10);
  });

  test('every bundled id builds a 17³ LUT', () => {
    for (const id of listBundledLuts()) {
      const lut = buildBundledLut(id);
      expect(lut).toBeDefined();
      expect(lut.size).toBe(17);
      expect(lut.data.length).toBe(17 * 17 * 17 * 3);
    }
  });

  test('identity LUT produces near-identity output', () => {
    const lut = buildBundledLut('identity');
    const buf = makeRgbaBuffer([[50, 100, 200]]);
    applyLut(buf, lut, 1);
    expect(Math.abs(buf[0] - 50)).toBeLessThanOrEqual(2);
  });

  test('make-it-pop boosts saturation on a muted pixel', () => {
    const lut = buildBundledLut('make-it-pop');
    const buf = makeRgbaBuffer([[120, 100, 80]]);
    applyLut(buf, lut, 1);
    // Output should have higher max-min channel spread.
    const origSpread = 120 - 80;
    const newSpread  = Math.max(buf[0], buf[1], buf[2]) - Math.min(buf[0], buf[1], buf[2]);
    expect(newSpread).toBeGreaterThan(origSpread);
  });

  test('bw LUT collapses channels to a single value', () => {
    const lut = buildBundledLut('bw');
    const buf = makeRgbaBuffer([[200, 50, 100]]);
    applyLut(buf, lut, 1);
    expect(Math.abs(buf[0] - buf[1])).toBeLessThanOrEqual(2);
    expect(Math.abs(buf[1] - buf[2])).toBeLessThanOrEqual(2);
  });

  test('buildBundledLut with unknown id returns null', () => {
    expect(buildBundledLut('nope')).toBeNull();
  });
});

// ── Presets ────────────────────────────────────────────────────────────────
describe('Presets', () => {
  test('PRESET_CATEGORIES has the 8 required categories', () => {
    expect(PRESET_CATEGORIES.length).toBe(8);
    expect(PRESET_CATEGORIES).toEqual(
      expect.arrayContaining(['Make It Pop', 'Cinema', 'Warm', 'Cool', 'Vintage', 'Neon', 'Moody', 'Gaming']),
    );
  });

  test('DEFAULT_PRESETS has at least one preset per category', () => {
    for (const cat of PRESET_CATEGORIES) {
      const found = DEFAULT_PRESETS.some(p => p.category === cat);
      expect(found).toBe(true);
    }
  });

  test('normalizePreset fills missing id + name defaults, keeps adjustments', () => {
    const n = normalizePreset({
      adjustments: [{ kind: 'brightness', params: { value: 10 } }],
    });
    expect(n.id).toBeDefined();
    expect(n.name).toBeDefined();
    expect(n.adjustments).toHaveLength(1);
  });

  test('normalizePreset rejects inputs without adjustments', () => {
    expect(normalizePreset(null)).toBeNull();
    expect(normalizePreset({})).toBeNull();
    expect(normalizePreset({ name: 'x' })).toBeNull();
  });

  test('applyPreset composes multiple adjustments in order', () => {
    const buf = makeRgbaBuffer([[100, 100, 100]]);
    applyPreset(buf, 1, 1, {
      adjustments: [
        { kind: 'brightness', params: { value: 20 } },
        { kind: 'brightness', params: { value: 20 } },
      ],
    });
    // Two +20s ≈ roughly +40*255/100 = +102 brighter, clamped.
    expect(buf[0]).toBeGreaterThan(100);
  });

  test('every default preset applies without error', () => {
    for (const p of DEFAULT_PRESETS) {
      const buf = makeRgbaBuffer([[120, 80, 200]]);
      expect(() => applyPreset(buf, 1, 1, p)).not.toThrow();
    }
  });
});
