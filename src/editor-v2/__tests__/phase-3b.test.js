// src/editor-v2/__tests__/phase-3b.test.js
// -----------------------------------------------------------------------------
// Phase 3.b — advanced color grading. Each primitive verified on a
// small RGBA buffer: 3-wheel grade, split toning, tone sliders,
// clarity, dehaze, gradient map, match colors.
// -----------------------------------------------------------------------------

import {
  threeWheelGrade,
  splitToning,
  toneSliders,
  clarity,
  dehaze,
  gradientMap,
  matchColors,
} from '../adjustments/Grading';

function makeRgbaBuffer(colors) {
  const out = new Uint8ClampedArray(colors.length * 4);
  for (let i = 0; i < colors.length; i++) {
    out[i*4]   = colors[i][0];
    out[i*4+1] = colors[i][1];
    out[i*4+2] = colors[i][2];
    out[i*4+3] = colors[i][3] ?? 255;
  }
  return out;
}

describe('threeWheelGrade', () => {
  test('shadow tint shifts dark pixels; highlights untouched', () => {
    const buf = makeRgbaBuffer([[20, 20, 20], [240, 240, 240]]);
    threeWheelGrade(buf, {
      shadows:    { color: { r: 120, g: 0, b: 0 }, strength: 1 },
      midtones:   { color: { r: 0,   g: 0, b: 0 }, strength: 0 },
      highlights: { color: { r: 0,   g: 0, b: 0 }, strength: 0 },
    });
    expect(buf[0]).toBeGreaterThan(20);    // shadow got red tint
    expect(buf[4]).toBeCloseTo(240, -1);   // highlight ~unchanged
  });

  test('no-strength tints = no changes', () => {
    const orig = [40, 60, 80, 255];
    const buf = makeRgbaBuffer([orig]);
    threeWheelGrade(buf, {
      shadows:    { color: { r: 255, g: 0, b: 0 }, strength: 0 },
      midtones:   { color: { r: 0,   g: 255, b: 0 }, strength: 0 },
      highlights: { color: { r: 0,   g: 0, b: 255 }, strength: 0 },
    });
    expect([...buf]).toEqual(orig);
  });
});

describe('splitToning', () => {
  test('shadow + highlight colors bleed into dark + light pixels respectively', () => {
    const buf = makeRgbaBuffer([[20, 20, 20], [200, 200, 200]]);
    splitToning(buf, {
      shadowColor:      '#0000ff',
      shadowStrength:   1,
      highlightColor:   '#ffaa00',
      highlightStrength:1,
    });
    expect(buf[2]).toBeGreaterThan(20);     // shadow picked up blue
    expect(buf[4]).toBeGreaterThan(200);    // highlight picked up warmth
  });

  test('non-hex colors are ignored', () => {
    const orig = [50, 50, 50, 255];
    const buf = makeRgbaBuffer([orig]);
    splitToning(buf, {
      shadowColor:      'not-a-color',
      shadowStrength:   1,
      highlightColor:   'also-not',
      highlightStrength:1,
    });
    expect([...buf]).toEqual(orig);
  });
});

describe('toneSliders', () => {
  test('blacks slider lifts very-dark pixels, leaves others alone', () => {
    const buf = makeRgbaBuffer([[10, 10, 10], [128, 128, 128], [230, 230, 230]]);
    toneSliders(buf, { blacks: 100, shadows: 0, highlights: 0, whites: 0 });
    expect(buf[0]).toBeGreaterThan(10);
    expect(Math.abs(buf[4] - 128)).toBeLessThanOrEqual(2);
  });

  test('whites slider lifts very-bright pixels', () => {
    const buf = makeRgbaBuffer([[230, 230, 230]]);
    toneSliders(buf, { whites: 100, highlights: 0, shadows: 0, blacks: 0 });
    expect(buf[0]).toBeGreaterThan(230);
  });
});

describe('clarity', () => {
  test('positive amount on a flat image is close to a no-op', () => {
    const buf = makeRgbaBuffer(Array(16).fill([128, 128, 128]));
    const orig = [...buf];
    clarity(buf, 4, 4, 50);
    // Flat input has no local contrast, so the output should closely match.
    for (let i = 0; i < buf.length; i++) {
      expect(Math.abs(buf[i] - orig[i])).toBeLessThanOrEqual(2);
    }
  });
});

describe('dehaze', () => {
  test('positive amount alters pixel values on a gradient', () => {
    const buf = makeRgbaBuffer(Array.from({ length: 16 }, (_, i) => [i * 16, i * 16, i * 16]));
    const copy = new Uint8ClampedArray(buf);
    dehaze(buf, 4, 4, 50);
    // Some pixels should have moved.
    let diff = 0;
    for (let i = 0; i < buf.length; i++) diff += Math.abs(buf[i] - copy[i]);
    expect(diff).toBeGreaterThan(0);
  });
});

describe('gradientMap', () => {
  test('black→white gradient ≈ identity on a grayscale image (within luma rounding)', () => {
    const buf = makeRgbaBuffer([[0,0,0], [128,128,128], [255,255,255]]);
    gradientMap(buf, [
      { color: '#000000', offset: 0 },
      { color: '#ffffff', offset: 1 },
    ]);
    expect(buf[0]).toBe(0);
    expect(Math.abs(buf[4] - 128)).toBeLessThanOrEqual(2);
    expect(buf[8]).toBeGreaterThanOrEqual(250);
  });

  test('two-stop black→red gradient remaps luma to red', () => {
    const buf = makeRgbaBuffer([[255, 255, 255]]);
    gradientMap(buf, [
      { color: '#000000', offset: 0 },
      { color: '#ff0000', offset: 1 },
    ]);
    expect(buf[0]).toBeGreaterThanOrEqual(250);
    expect(buf[1]).toBe(0);
    expect(buf[2]).toBe(0);
  });

  test('fewer than 2 stops is a no-op', () => {
    const orig = [20, 30, 40, 255];
    const buf = makeRgbaBuffer([orig]);
    gradientMap(buf, [{ color: '#ff0000', offset: 0 }]);
    expect([...buf]).toEqual(orig);
  });
});

describe('matchColors', () => {
  test('matching target to a bluer source pushes blue channel up', () => {
    const target = makeRgbaBuffer([
      [100, 100, 100], [120, 120, 120], [140, 140, 140], [160, 160, 160],
    ]);
    const source = makeRgbaBuffer([
      [100, 100, 200], [120, 120, 220], [140, 140, 240], [160, 160, 255],
    ]);
    const origBlueMean = (100 + 120 + 140 + 160) / 4;
    matchColors(target, source, 1);
    const newBlueMean = (target[2] + target[6] + target[10] + target[14]) / 4;
    expect(newBlueMean).toBeGreaterThan(origBlueMean);
  });

  test('strength=0 is identity', () => {
    const target = makeRgbaBuffer([[50, 60, 70]]);
    const source = makeRgbaBuffer([[200, 100, 100]]);
    const orig = [...target];
    matchColors(target, source, 0);
    expect([...target]).toEqual(orig);
  });
});
