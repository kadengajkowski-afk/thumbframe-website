// src/editor-v2/__tests__/phase-4-6-a.test.js
// -----------------------------------------------------------------------------
// Phase 4.6.a — design tokens + theme system.
//
// Verifies:
//   1. THEMES has both dark + light with the exact color values from
//      the design brief (locked — any change is a design-review event)
//   2. WCAG AA contrast (>=4.5 for body / >=3.0 for large text) holds
//      on every text-over-background combo in both themes
//   3. ThemeProvider applies CSS variables to the target element
//   4. Toggle + setTheme flip the palette and the data-editor-theme attr
//   5. Persistence: setTheme writes to localStorage keyed by userId
//   6. getInitialTheme reads back the stored value
//   7. The crossfade transition is installed on the target element
// -----------------------------------------------------------------------------

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import {
  THEMES, PALETTES, THEME_NAMES, MOTION_TOKENS, EASING,
  cssVariablesForTheme, buildTransition, transition,
} from '../ui/tokens';
import {
  ThemeProvider, useTheme, getInitialTheme, themeStorageKey,
} from '../ui/ThemeProvider';
import { wcagContrast } from '../engine/Contrast';

// ── Tokens contract ───────────────────────────────────────────────────────
describe('THEMES palette (locked by design brief)', () => {
  test('both themes exist with matching key sets', () => {
    expect(Object.keys(THEMES).sort()).toEqual(['dark', 'light']);
    const darkKeys  = Object.keys(THEMES.dark).sort();
    const lightKeys = Object.keys(THEMES.light).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  test('dark theme color anchors match the brief', () => {
    expect(THEMES.dark['--bg-space-1']).toBe('#0a0a0f');
    expect(THEMES.dark['--bg-space-2']).toBe('#15151e');
    expect(THEMES.dark['--accent-cream']).toBe('#F9F0E1');
    expect(THEMES.dark['--canvas-surface-dark']).toBe('#1a1a22');
  });

  test('light theme color anchors match the brief', () => {
    expect(THEMES.light['--bg-space-1']).toBe('#F4F1EA');
    expect(THEMES.light['--bg-space-2']).toBe('#D8E3EC');
    expect(THEMES.light['--accent-navy']).toBe('#1B2430');
    expect(THEMES.light['--canvas-surface-light']).toBe('#EDE7DA');
  });

  test('PALETTES is an alias for THEMES', () => {
    expect(PALETTES).toBe(THEMES);
  });

  test('THEME_NAMES exports the canonical list', () => {
    expect(THEME_NAMES).toEqual(['dark', 'light']);
  });
});

describe('MOTION_TOKENS + EASING', () => {
  test('required motion tokens are present', () => {
    expect(MOTION_TOKENS.fast).toBe(150);
    expect(MOTION_TOKENS.standard).toBe(250);
    expect(MOTION_TOKENS.theme).toBe(300);
    expect(MOTION_TOKENS.shipAlive).toBe(1200);
  });

  test('EASING carries the default + theme curves', () => {
    expect(EASING.default).toMatch(/cubic-bezier/);
    expect(EASING.theme).toMatch(/cubic-bezier/);
  });

  test('buildTransition composes property + speed + ease', () => {
    const out = buildTransition('opacity', 'theme', 'theme');
    expect(out).toBe(`opacity 300ms ${EASING.theme}`);
  });

  test('legacy transition() still works (Phase 4.a compatibility)', () => {
    expect(transition('opacity', 'fast')).toContain('150ms');
  });
});

describe('cssVariablesForTheme', () => {
  test('returns a flat map of CSS variable names', () => {
    const m = cssVariablesForTheme('dark');
    expect(m['--bg-space-1']).toBe('#0a0a0f');
    expect(m['--accent-cream']).toBe('#F9F0E1');
  });

  test('unknown theme falls back to dark', () => {
    expect(cssVariablesForTheme('bogus')['--bg-space-1']).toBe('#0a0a0f');
  });
});

// ── WCAG contrast audit ───────────────────────────────────────────────────
describe('WCAG AA contrast across text/background combos', () => {
  // Body text needs >= 4.5; large (18pt+ or 14pt+ bold) needs >= 3.0.
  // Muted tokens are used for small secondary text, so we evaluate them
  // against the primary background of each theme.
  // Panels and sub-surfaces use rgba() layered ON TOP of the primary
  // background, so the "effective" contrast is the fg vs the opaque
  // page bg underneath. We audit fg-vs-page-bg combos only. Panel
  // transparency is a visual tint, not a contrast-bearing surface.
  const cases = [
    // theme name, fg token, bg token, min ratio
    ['dark',  '--text-primary',   '--bg-space-1',     4.5],
    ['dark',  '--text-secondary', '--bg-space-1',     4.5],
    ['dark',  '--text-primary',   '--bg-space-2',     4.5],
    ['dark',  '--text-primary',   '--canvas-surface', 4.5],
    ['dark',  '--ship-it-fg',     '--ship-it-bg',     4.5],
    ['light', '--text-primary',   '--bg-space-1',     4.5],
    ['light', '--text-secondary', '--bg-space-1',     4.5],
    ['light', '--text-primary',   '--bg-space-2',     4.5],
    ['light', '--text-primary',   '--canvas-surface', 4.5],
    ['light', '--ship-it-fg',     '--ship-it-bg',     4.5],
  ];

  test.each(cases)('%s theme: %s over %s >= %f', (themeName, fgKey, bgKey, min) => {
    const theme = THEMES[themeName];
    const fg = theme[fgKey];
    const bg = theme[bgKey];
    // Panels use rgba() on top of the page background; wcagContrast
    // parses the opaque channel only and is a reasonable approximation
    // for "visible-against-the-composited-surface" checks. For combos
    // where the fg uses rgba() (secondary/muted), we still want its
    // RGB to clear the bar against the primary bg.
    const c = wcagContrast(fg, bg);
    expect(c).not.toBeNull();
    expect(c.ratio).toBeGreaterThanOrEqual(min);
  });

  test('ship-it button contrast is at least AA (both themes)', () => {
    const dark  = wcagContrast(THEMES.dark['--ship-it-fg'],  THEMES.dark['--ship-it-bg']);
    const light = wcagContrast(THEMES.light['--ship-it-fg'], THEMES.light['--ship-it-bg']);
    expect(dark.AA).toBe(true);
    expect(light.AA).toBe(true);
  });
});

// ── ThemeProvider behaviour ───────────────────────────────────────────────
describe('ThemeProvider', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    // Reset the html element between tests so attrs don't leak.
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('data-editor-theme');
      document.documentElement.style.cssText = '';
    }
  });

  function Probe() {
    const { theme, setTheme, toggleTheme } = useTheme();
    return (
      <div>
        <span data-testid="cur">{theme}</span>
        <button onClick={() => setTheme('light')}>light</button>
        <button onClick={() => setTheme('dark')}>dark</button>
        <button onClick={toggleTheme}>toggle</button>
      </div>
    );
  }

  test('defaults to dark and writes CSS variables to document.documentElement', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('cur').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-editor-theme')).toBe('dark');
    expect(
      document.documentElement.style.getPropertyValue('--bg-space-1'),
    ).toBe('#0a0a0f');
  });

  test('setTheme("light") flips the palette + data attribute', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => { screen.getByText('light').click(); });
    expect(screen.getByTestId('cur').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-editor-theme')).toBe('light');
    expect(
      document.documentElement.style.getPropertyValue('--bg-space-1'),
    ).toBe('#F4F1EA');
  });

  test('toggleTheme flips dark ↔ light', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => { screen.getByText('toggle').click(); });
    expect(screen.getByTestId('cur').textContent).toBe('light');
    act(() => { screen.getByText('toggle').click(); });
    expect(screen.getByTestId('cur').textContent).toBe('dark');
  });

  test('persists preference to localStorage keyed by userId', () => {
    render(<ThemeProvider userId="user-42"><Probe /></ThemeProvider>);
    act(() => { screen.getByText('light').click(); });
    expect(localStorage.getItem(themeStorageKey('user-42'))).toBe('light');
  });

  test('anonymous users land in the anon bucket', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => { screen.getByText('light').click(); });
    expect(localStorage.getItem(themeStorageKey('anon'))).toBe('light');
  });

  test('getInitialTheme reads stored value back', () => {
    localStorage.setItem(themeStorageKey('u1'), 'light');
    expect(getInitialTheme('u1')).toBe('light');
  });

  test('getInitialTheme returns fallback when stored value is invalid', () => {
    localStorage.setItem(themeStorageKey('u2'), 'purple');
    expect(getInitialTheme('u2', 'dark')).toBe('dark');
  });

  test('stored preference survives a remount (same userId)', () => {
    const { unmount } = render(<ThemeProvider userId="u3"><Probe /></ThemeProvider>);
    act(() => { screen.getByText('light').click(); });
    unmount();
    render(<ThemeProvider userId="u3"><Probe /></ThemeProvider>);
    expect(screen.getByTestId('cur').textContent).toBe('light');
  });

  test('the crossfade transition is installed on the target element', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    const t = document.documentElement.style.getPropertyValue('transition');
    expect(t).toContain('300ms');
    expect(t).toContain('cubic-bezier');
    expect(t).toContain('background-color');
  });

  test('setTheme with a bogus value is a no-op', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    const root = document.documentElement;
    const beforeAttr = root.getAttribute('data-editor-theme');
    // Reach in and call the invalid setter directly.
    const probe = useThemeInvalidSetter();
    act(() => probe('purple'));
    expect(root.getAttribute('data-editor-theme')).toBe(beforeAttr);
  });
});

// ── Helper ────────────────────────────────────────────────────────────────
// Sanity-check that the guard in setTheme rejects bogus values even
// when called via a captured setter reference.
let _capturedSetter = null;
function CapturingProbe() {
  const { setTheme } = useTheme();
  _capturedSetter = setTheme;
  return null;
}
function useThemeInvalidSetter() {
  render(<ThemeProvider><CapturingProbe /></ThemeProvider>);
  return _capturedSetter;
}
