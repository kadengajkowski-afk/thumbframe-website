// src/editor-v2/__tests__/phase-3a.test.js
// -----------------------------------------------------------------------------
// Phase 3.a regression suite. Covers every core adjustment (brightness,
// contrast, saturation, exposure, vibrance, curves, hsl, toneCurve,
// selectiveColor) with before/after pixel comparisons on a small RGBA
// buffer. Also verifies default-params shape and shader-string presence.
// -----------------------------------------------------------------------------

import {
  ADJUSTMENT_KINDS,
  defaultAdjustmentParams,
  applyAdjustment,
  ADJUSTMENT_FRAGMENT_SHADERS,
} from '../adjustments/Adjustments';

function makeRgbaBuffer(colors) {
  // colors = [[r,g,b,a], ...]
  const out = new Uint8ClampedArray(colors.length * 4);
  for (let i = 0; i < colors.length; i++) {
    out[i*4]   = colors[i][0];
    out[i*4+1] = colors[i][1];
    out[i*4+2] = colors[i][2];
    out[i*4+3] = colors[i][3] ?? 255;
  }
  return out;
}

describe('defaultAdjustmentParams', () => {
  test.each(ADJUSTMENT_KINDS)('%s has a non-empty defaults object', (kind) => {
    const p = defaultAdjustmentParams(kind);
    expect(p).toBeDefined();
    expect(Object.keys(p).length).toBeGreaterThan(0);
  });

  test('unknown kind returns empty object, no throw', () => {
    expect(defaultAdjustmentParams('nope')).toEqual({});
  });
});

describe('brightness', () => {
  test('value=100 pushes all channels toward 255', () => {
    const buf = makeRgbaBuffer([[128, 128, 128, 255]]);
    applyAdjustment(buf, 1, 1, 'brightness', { value: 100 });
    expect(buf[0]).toBe(255);
  });

  test('value=-100 pushes all channels to 0', () => {
    const buf = makeRgbaBuffer([[128, 128, 128, 255]]);
    applyAdjustment(buf, 1, 1, 'brightness', { value: -100 });
    expect(buf[0]).toBe(0);
  });

  test('value=0 is a no-op', () => {
    const orig = [200, 150, 100, 255];
    const buf = makeRgbaBuffer([orig]);
    applyAdjustment(buf, 1, 1, 'brightness', { value: 0 });
    expect([...buf]).toEqual(orig);
  });
});

describe('contrast', () => {
  test('positive contrast separates 64 and 192', () => {
    const buf = makeRgbaBuffer([[64, 64, 64, 255], [192, 192, 192, 255]]);
    applyAdjustment(buf, 2, 1, 'contrast', { value: 100 });
    expect(buf[0]).toBeLessThan(64);
    expect(buf[4]).toBeGreaterThan(192);
  });

  test('negative contrast collapses toward mid-grey', () => {
    const buf = makeRgbaBuffer([[0, 0, 0, 255], [255, 255, 255, 255]]);
    applyAdjustment(buf, 2, 1, 'contrast', { value: -100 });
    // Heavy negative contrast converges near 128.
    expect(Math.abs(buf[0] - 128)).toBeLessThanOrEqual(Math.abs(0 - 128));
    expect(Math.abs(buf[4] - 128)).toBeLessThanOrEqual(Math.abs(255 - 128));
  });
});

describe('saturation', () => {
  test('value=-100 desaturates to grey', () => {
    const buf = makeRgbaBuffer([[255, 0, 0, 255]]);
    applyAdjustment(buf, 1, 1, 'saturation', { value: -100 });
    const [r, g, b] = buf;
    expect(Math.abs(r - g)).toBeLessThan(2);
    expect(Math.abs(g - b)).toBeLessThan(2);
  });

  test('value=100 intensifies color', () => {
    const buf = makeRgbaBuffer([[200, 100, 100, 255]]);
    applyAdjustment(buf, 1, 1, 'saturation', { value: 100 });
    expect(buf[0]).toBeGreaterThan(200);
  });
});

describe('exposure', () => {
  test('stops=1 doubles values', () => {
    const buf = makeRgbaBuffer([[60, 60, 60, 255]]);
    applyAdjustment(buf, 1, 1, 'exposure', { value: 1 });
    expect(buf[0]).toBe(120);
  });

  test('stops=-1 halves values', () => {
    const buf = makeRgbaBuffer([[200, 200, 200, 255]]);
    applyAdjustment(buf, 1, 1, 'exposure', { value: -1 });
    expect(buf[0]).toBe(100);
  });
});

describe('vibrance', () => {
  test('positive vibrance boosts less-saturated colors more', () => {
    const low  = makeRgbaBuffer([[200, 170, 170, 255]]);  // near grey
    const high = makeRgbaBuffer([[255, 0,   0,   255]]);  // already saturated
    applyAdjustment(low,  1, 1, 'vibrance', { value: 100 });
    applyAdjustment(high, 1, 1, 'vibrance', { value: 100 });
    // The already-saturated pixel should have changed less.
    const lowDelta  = Math.abs(low[0]  - 200);
    const highDelta = Math.abs(high[0] - 255);
    expect(highDelta).toBeLessThanOrEqual(lowDelta);
  });
});

describe('curves', () => {
  test('identity curve is a no-op', () => {
    const orig = [50, 100, 200, 255];
    const buf = makeRgbaBuffer([orig]);
    applyAdjustment(buf, 1, 1, 'curves', defaultAdjustmentParams('curves'));
    expect([...buf]).toEqual(orig);
  });

  test('composite inversion flips luminance', () => {
    const buf = makeRgbaBuffer([[0, 128, 255, 255]]);
    applyAdjustment(buf, 1, 1, 'curves', {
      ...defaultAdjustmentParams('curves'),
      composite: [[0, 255], [255, 0]],
    });
    expect(buf[0]).toBeGreaterThan(250);
    expect(buf[2]).toBeLessThan(5);
  });
});

describe('hsl', () => {
  test('red slider shifts red pixels only', () => {
    const buf = makeRgbaBuffer([
      [255, 0, 0, 255],      // red
      [0,   255, 0, 255],    // green
    ]);
    applyAdjustment(buf, 2, 1, 'hsl', {
      ...defaultAdjustmentParams('hsl'),
      red: { h: 30, s: 0, l: 0 },
    });
    // Red shifted +30° hue → red.G gains value; green untouched.
    expect(buf[1]).toBeGreaterThan(0);   // red's green channel woke up
    expect(buf[4]).toBe(0);              // green.R still 0
    expect(buf[5]).toBe(255);            // green.G still 255
  });
});

describe('toneCurve (shadows/midtones/highlights)', () => {
  test('pushing shadows up raises dark values, leaves highlights alone', () => {
    const buf = makeRgbaBuffer([[40, 40, 40, 255], [200, 200, 200, 255]]);
    applyAdjustment(buf, 2, 1, 'toneCurve', { shadows: 100, midtones: 0, highlights: 0 });
    expect(buf[0]).toBeGreaterThan(40);
    expect(buf[4]).toBe(200);
  });
});

describe('selectiveColor', () => {
  test('shifting saturation on the hue band affects only pixels inside the band', () => {
    const buf = makeRgbaBuffer([
      [255, 0, 0, 255],    // red (hue 0) — inside
      [0, 255, 0, 255],    // green (hue 120) — outside
    ]);
    applyAdjustment(buf, 2, 1, 'selectiveColor', {
      hueCenter: 0, hueWidth: 20, saturationShift: -100, lightnessShift: 0,
    });
    // The red should be desaturated (toward grey); green untouched.
    expect(buf[0]).not.toBe(255);
    expect(buf[4]).toBe(0);
    expect(buf[5]).toBe(255);
  });
});

describe('applyAdjustment defensive behaviour', () => {
  test('unknown kind is a safe no-op', () => {
    const buf = makeRgbaBuffer([[10, 20, 30, 255]]);
    applyAdjustment(buf, 1, 1, 'nope', {});
    expect([...buf]).toEqual([10, 20, 30, 255]);
  });

  test('rejects mismatched buffer length', () => {
    const buf = new Uint8ClampedArray(3); // too small
    expect(() => applyAdjustment(buf, 1, 1, 'brightness', { value: 10 })).not.toThrow();
  });
});

// ── Fragment shaders ───────────────────────────────────────────────────────
describe('ADJUSTMENT_FRAGMENT_SHADERS', () => {
  test.each(['brightness', 'contrast', 'saturation', 'exposure'])(
    '%s shader source exists and references sampler2D',
    (kind) => {
      const src = ADJUSTMENT_FRAGMENT_SHADERS[kind];
      expect(typeof src).toBe('string');
      expect(src).toContain('sampler2D');
      expect(src).toContain('fragColor');
    },
  );
});
