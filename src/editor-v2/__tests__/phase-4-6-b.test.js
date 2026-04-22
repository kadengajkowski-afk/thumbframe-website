// src/editor-v2/__tests__/phase-4-6-b.test.js
// -----------------------------------------------------------------------------
// Phase 4.6.b — cockpit layout shell.
//
// Verifies:
//   1. Grid dimensions match the brief:
//        - top bar: 44px
//        - tool palette: 48px
//        - contextual panel: 320px default / 240px at tablet width
//        - layer panel: 120px open / 32px collapsed
//   2. All four region slots render
//   3. Canvas frame wraps the canvas child at 1280x720 intrinsic size
//   4. Ambient backdrop element exists and is pointer-events: none
//   5. Cramped viewport banner appears below 1024px
//   6. Layer panel header renders the copy.js strings
//   7. Theme attribute reflects the active theme
// -----------------------------------------------------------------------------

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import CockpitShell from '../ui/CockpitShell';
import { ThemeProvider } from '../ui/ThemeProvider';
import { COPY } from '../ui/copy';

function mount(ui, { width = 1440, height = 900 } = {}) {
  // jsdom defaults to 1024x768 — override for specific breakpoint tests.
  Object.defineProperty(window, 'innerWidth',  { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('CockpitShell region slots', () => {
  test('renders topBar / toolPalette / canvas / contextualPanel / layerPanel', () => {
    mount(
      <CockpitShell
        topBar={<div data-testid="t">top</div>}
        toolPalette={<div data-testid="tools">tools</div>}
        canvas={<div data-testid="canvas">canvas</div>}
        contextualPanel={<div data-testid="panel">panel</div>}
        layerPanel={<div data-testid="layers">layers</div>}
      />,
    );
    expect(screen.getByTestId('t')).toBeInTheDocument();
    expect(screen.getByTestId('tools')).toBeInTheDocument();
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(screen.getByTestId('panel')).toBeInTheDocument();
    expect(screen.getByTestId('layers')).toBeInTheDocument();
  });

  test('renders a canvas frame wrapping the canvas child', () => {
    const { container } = mount(
      <CockpitShell canvas={<div data-testid="canvas">c</div>} />,
    );
    const frame = container.querySelector('[data-canvas-frame]');
    expect(frame).toBeInTheDocument();
    expect(frame.contains(screen.getByTestId('canvas'))).toBe(true);
  });

  test('canvas frame carries intrinsic 1280x720 dimensions', () => {
    const { container } = mount(<CockpitShell canvas={<div />} />);
    const frame = container.querySelector('[data-canvas-frame]');
    const style = frame.getAttribute('style') || '';
    expect(style).toContain('width: 1280px');
    expect(style).toContain('height: 720px');
  });

  test('ambient backdrop exists and is non-interactive', () => {
    const { container } = mount(<CockpitShell canvas={<div />} />);
    const bg = container.querySelector('[data-cockpit-backdrop]');
    expect(bg).toBeInTheDocument();
    expect(bg.getAttribute('style') || '').toContain('pointer-events: none');
  });
});

describe('Grid dimensions', () => {
  test('desktop (>=1280px): 48px tools + 320px panel, 44px topbar + 120px layers', () => {
    const { container } = mount(<CockpitShell canvas={<div />} />, { width: 1440 });
    const grid = container.querySelector('[data-cockpit-grid]');
    const style = grid.getAttribute('style') || '';
    expect(style).toContain('48px 1fr 320px');
    expect(style).toContain('44px 1fr 120px');
  });

  test('tablet (<1280px but >=1024px): panel shrinks to 240px', () => {
    const { container } = mount(<CockpitShell canvas={<div />} />, { width: 1200 });
    const grid = container.querySelector('[data-cockpit-grid]');
    expect(grid.getAttribute('style') || '').toContain('48px 1fr 240px');
  });

  test('layerPanelOpen=false collapses layer row to 32px', () => {
    const { container } = mount(
      <CockpitShell canvas={<div />} layerPanelOpen={false} />,
    );
    const grid = container.querySelector('[data-cockpit-grid]');
    expect(grid.getAttribute('style') || '').toContain('44px 1fr 32px');
  });

  test('showChrome=false zeroes tools/panel/layers + hides the grid', () => {
    const { container } = mount(
      <CockpitShell canvas={<div data-testid="canvas" />} showChrome={false} />,
    );
    expect(container.querySelector('[data-cockpit-grid]')).toBeNull();
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(container.querySelector('[data-cockpit-canvas-only]')).toBeInTheDocument();
  });
});

describe('Cramped viewport banner', () => {
  test('appears below 1024px with the exact copy.js string', () => {
    const { container } = mount(<CockpitShell canvas={<div />} />, { width: 900 });
    const banner = container.querySelector('[data-cockpit-cramped-banner]');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toBe(COPY.cockpit.crampedBanner);
  });

  test('does not appear at exactly 1024px', () => {
    const { container } = mount(<CockpitShell canvas={<div />} />, { width: 1024 });
    expect(container.querySelector('[data-cockpit-cramped-banner]')).toBeNull();
  });

  test('does not appear above 1280px', () => {
    const { container } = mount(<CockpitShell canvas={<div />} />, { width: 1600 });
    expect(container.querySelector('[data-cockpit-cramped-banner]')).toBeNull();
  });
});

describe('Layer panel header', () => {
  test('renders the copy.js "Layers" header', () => {
    mount(
      <CockpitShell canvas={<div />} layerPanel={<div />} />,
    );
    expect(screen.getByText(COPY.cockpit.layersHeader)).toBeInTheDocument();
  });

  test('toggle button carries the correct aria-label when open vs closed', () => {
    const onToggle = jest.fn();
    const { rerender } = mount(
      <CockpitShell canvas={<div />} layerPanel={<div />} layerPanelOpen onLayerPanelToggle={onToggle} />,
    );
    expect(screen.getByLabelText(COPY.cockpit.collapseLayers)).toBeInTheDocument();
    act(() => { screen.getByLabelText(COPY.cockpit.collapseLayers).click(); });
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <ThemeProvider>
        <CockpitShell canvas={<div />} layerPanel={<div />} layerPanelOpen={false} onLayerPanelToggle={onToggle} />
      </ThemeProvider>,
    );
    expect(screen.getByLabelText(COPY.cockpit.expandLayers)).toBeInTheDocument();
  });
});

describe('Theme attribute', () => {
  test('data-theme reflects the active theme', () => {
    const { container } = mount(<CockpitShell canvas={<div />} />);
    const root = container.querySelector('[data-cockpit]');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });
});

describe('Window resize', () => {
  test('resize event updates panel width at the tablet breakpoint', () => {
    const { container } = mount(<CockpitShell canvas={<div />} />, { width: 1440 });
    const grid = () => container.querySelector('[data-cockpit-grid]');
    expect(grid().getAttribute('style') || '').toContain('320px');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1100 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(grid().getAttribute('style') || '').toContain('240px');
  });
});
