// src/editor-v2/__tests__/phase-4a.test.js
// -----------------------------------------------------------------------------
// Phase 4.a — cockpit layout shell. Renders CockpitShell and asserts
// the five regions exist + the design tokens are stable (any change
// to colors/spacing/motion is a visual-identity change and needs a
// conscious PR — this is the guard).
// -----------------------------------------------------------------------------

import React from 'react';
import { render, screen } from '@testing-library/react';
import CockpitShell from '../ui/CockpitShell';
import {
  COLORS, TYPOGRAPHY, SPACING, RADII, SHADOWS, MOTION, transition,
} from '../ui/tokens';

describe('tokens', () => {
  test('COLORS carries the cream accent from the landing', () => {
    expect(COLORS.cream).toBe('#faecd0');
    expect(COLORS.orange).toBe('#f97316');
    expect(COLORS.bgDeepSpace).toBe('#0a0a0f');
  });

  test('SPACING is a 4px grid', () => {
    expect(SPACING.xs).toBe(4);
    expect(SPACING.sm).toBe(8);
    expect(SPACING.md).toBe(12);
    expect(SPACING.lg).toBe(16);
    expect(SPACING.xl).toBe(24);
    expect(SPACING.xxl).toBe(32);
    expect(SPACING.xxxl).toBe(48);
  });

  test('RADII values match spec (6/10/16)', () => {
    expect(RADII.sm).toBe(6);
    expect(RADII.md).toBe(10);
    expect(RADII.lg).toBe(16);
  });

  test('MOTION: fast 150ms / standard 250ms / ease-out default', () => {
    expect(MOTION.fast).toBe(150);
    expect(MOTION.standard).toBe(250);
    expect(typeof MOTION.ease).toBe('string');
    expect(MOTION.ease).toContain('cubic-bezier');
  });

  test('SHADOWS.activeToolGlow uses cream glow color (RGB form)', () => {
    // 250, 236, 208 is cream in RGB.
    expect(SHADOWS.activeToolGlow).toMatch(/rgba\(250,\s*236,\s*208/);
  });

  test('transition helper composes property + speed + ease', () => {
    expect(transition('opacity', 'fast')).toBe(`opacity 150ms ${MOTION.ease}`);
    expect(transition('transform')).toContain('250ms');
  });

  test('TYPOGRAPHY declares Inter for body and Geist for numeric', () => {
    expect(TYPOGRAPHY.body).toContain('Inter');
    expect(TYPOGRAPHY.numeric).toContain('Geist');
  });
});

describe('CockpitShell', () => {
  test('renders canvas, tool, panel, layer, status regions', () => {
    const { container } = render(
      <CockpitShell
        canvas={<div data-testid="canvas-slot">canvas</div>}
        toolPalette={<div data-testid="tools-slot">tools</div>}
        contextualPanel={<div data-testid="panel-slot">panel</div>}
        layerPanel={<div data-testid="layers-slot">layers</div>}
        projectName="demo"
        layerCount={3}
        saveStatus="saved"
        zoomPercent={87}
      />,
    );
    expect(screen.getByTestId('canvas-slot')).toBeInTheDocument();
    expect(screen.getByTestId('tools-slot')).toBeInTheDocument();
    expect(screen.getByTestId('panel-slot')).toBeInTheDocument();
    expect(screen.getByTestId('layers-slot')).toBeInTheDocument();
    expect(container.querySelector('[data-status]')).toBeInTheDocument();
  });

  test('status bar renders project / layer count / zoom / save', () => {
    render(
      <CockpitShell
        canvas={null} toolPalette={null} contextualPanel={null} layerPanel={null}
        projectName="Hero Thumbnail"
        layerCount={7}
        saveStatus="saving"
        zoomPercent={125}
      />,
    );
    expect(screen.getByText(/Hero Thumbnail/)).toBeInTheDocument();
    expect(screen.getByText(/layers: 7/)).toBeInTheDocument();
    expect(screen.getByText(/zoom: 125%/)).toBeInTheDocument();
    expect(screen.getByLabelText('save: saving')).toBeInTheDocument();
  });

  test('cockpit grid uses 56px tool column + 320px panel column', () => {
    const { container } = render(
      <CockpitShell canvas={null} toolPalette={null} contextualPanel={null} layerPanel={null} />,
    );
    const root = container.querySelector('[data-cockpit]');
    expect(root).toBeInTheDocument();
    const style = root.getAttribute('style') || '';
    expect(style).toMatch(/grid-template-columns/);
    expect(style).toContain('56px');
    expect(style).toContain('320px');
  });
});
