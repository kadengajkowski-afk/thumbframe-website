// src/editor-v2/__tests__/phase-2c.test.js
// -----------------------------------------------------------------------------
// Phase 2.c regression suite. Covers:
//   • Contrast.parseColor for hex, short hex, rgba, named colors
//   • relativeLuminance monotonic + bounds (black=0, white=1)
//   • wcagContrast: white/black = 21; identical colors = 1
//   • buildLegibilityPreview produces a canvas + contrast summary
//   • warnings emitted when contrast < AA threshold or font too small
// -----------------------------------------------------------------------------

import 'jest-canvas-mock';
import {
  parseColor,
  relativeLuminance,
  wcagContrast,
  WCAG_AA, WCAG_AA_LARGE, WCAG_AAA,
} from '../engine/Contrast';
import {
  buildLegibilityPreview,
  averageBackgroundColor,
} from '../engine/LegibilityPreview';

// ── parseColor ─────────────────────────────────────────────────────────────
describe('parseColor', () => {
  test('6-digit hex', () => {
    expect(parseColor('#ff8800')).toEqual({ r: 255, g: 136, b: 0 });
  });

  test('3-digit shorthand', () => {
    expect(parseColor('#f80')).toEqual({ r: 255, g: 136, b: 0 });
  });

  test('rgb() / rgba() variants', () => {
    expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30 });
    expect(parseColor('rgba(10,20,30,0.5)')).toEqual({ r: 10, g: 20, b: 30 });
  });

  test('named colors (black / white / orange)', () => {
    expect(parseColor('black')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('orange')).toEqual({ r: 255, g: 165, b: 0 });
  });

  test('invalid input returns null', () => {
    expect(parseColor(null)).toBeNull();
    expect(parseColor('')).toBeNull();
    expect(parseColor('bogus')).toBeNull();
    expect(parseColor(42)).toBeNull();
  });
});

// ── relativeLuminance ──────────────────────────────────────────────────────
describe('relativeLuminance', () => {
  test('black = 0, white = 1', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });

  test('grey is between', () => {
    const l = relativeLuminance({ r: 128, g: 128, b: 128 });
    expect(l).toBeGreaterThan(0);
    expect(l).toBeLessThan(1);
  });
});

// ── wcagContrast ───────────────────────────────────────────────────────────
describe('wcagContrast', () => {
  test('black vs white = 21 (maximum)', () => {
    const c = wcagContrast('#000', '#fff');
    expect(c.ratio).toBe(21);
    expect(c.AAA).toBe(true);
    expect(c.AA).toBe(true);
  });

  test('identical colors = 1 (minimum)', () => {
    const c = wcagContrast('#888', '#888');
    expect(c.ratio).toBe(1);
    expect(c.AAA).toBe(false);
    expect(c.AA).toBe(false);
  });

  test('AA thresholds are exposed + respected', () => {
    expect(WCAG_AA).toBe(4.5);
    expect(WCAG_AA_LARGE).toBe(3.0);
    expect(WCAG_AAA).toBe(7.0);
  });

  test('unparseable color returns null', () => {
    expect(wcagContrast('#000', 'bogus')).toBeNull();
  });
});

// ── LegibilityPreview ──────────────────────────────────────────────────────
describe('buildLegibilityPreview', () => {
  const sampleLayer = (overrides = {}) => ({
    type: 'text',
    x: 640, y: 360, width: 900, height: 160,
    textData: {
      content: 'THIS IS A TITLE',
      fontSize: 96,
      fontWeight: '800',
      fontFamily: 'Inter, sans-serif',
      fill: '#faecd0',
      align: 'center',
      ...overrides,
    },
  });

  test('non-text layer → null', () => {
    expect(buildLegibilityPreview({ type: 'shape' }, { bgColor: '#000' })).toBeNull();
    expect(buildLegibilityPreview(null, { bgColor: '#000' })).toBeNull();
  });

  test('emits a canvas + contrast summary on happy path', () => {
    const preview = buildLegibilityPreview(sampleLayer(), { bgColor: '#000' });
    expect(preview).toBeDefined();
    expect(preview.canvas.width).toBe(180);
    expect(preview.ratio).toBeGreaterThan(10);
    expect(preview.wcagAA).toBe(true);
    expect(preview.warnings).toEqual([]);
  });

  test('low-contrast combo emits a contrast warning', () => {
    const preview = buildLegibilityPreview(
      sampleLayer({ fill: '#666' }),
      { bgColor: '#555' },
    );
    expect(preview.warnings.some(w => w.includes('contrast'))).toBe(true);
  });

  test('tiny font size triggers the 18px warning', () => {
    const preview = buildLegibilityPreview(
      sampleLayer({ fontSize: 12 }),
      { bgColor: '#000' },
    );
    expect(preview.warnings.some(w => w.includes('font size'))).toBe(true);
  });

  test('large text flag flips on 24px+', () => {
    expect(buildLegibilityPreview(sampleLayer({ fontSize: 14 }), { bgColor: '#000' }).isLargeText).toBe(false);
    expect(buildLegibilityPreview(sampleLayer({ fontSize: 24 }), { bgColor: '#000' }).isLargeText).toBe(true);
  });

  test('preview respects custom target dimensions', () => {
    const preview = buildLegibilityPreview(sampleLayer(), {
      bgColor: '#000', targetWidth: 360, targetHeight: 200,
    });
    expect(preview.canvas.width).toBe(360);
    expect(preview.canvas.height).toBe(200);
  });
});

describe('averageBackgroundColor', () => {
  test('handles missing ctx / unsupported getImageData gracefully', () => {
    expect(averageBackgroundColor(null, { x: 0, y: 0, width: 1, height: 1 })).toBe('#000000');
    expect(averageBackgroundColor({ }, { x: 0, y: 0, width: 1, height: 1 })).toBe('#000000');
  });

  test('returns a hex string from a fake ctx that supports getImageData', () => {
    // jest-canvas-mock's getImageData behaviour isn't fully round-
    // trippable for our paint pipeline — we exercise the function with
    // a hand-rolled ctx. Real-browser coverage lives in the Phase 4
    // manual harness.
    const ctx = {
      getImageData: () => ({
        // 1px, fully red.
        data: new Uint8ClampedArray([255, 0, 0, 255]),
      }),
    };
    const out = averageBackgroundColor(ctx, { x: 0, y: 0, width: 1, height: 1 });
    expect(out).toBe('#ff0000');
  });
});
