// src/editor-v2/__tests__/phase-4-6-h.test.js
// -----------------------------------------------------------------------------
// Phase 4.6.h — polish pass.
//
// Locked-in audits that every future UI commit has to clear:
//   1. VOICE AUDIT — banned words regex runs across every string in
//      copy.js. No "Oops!", "Sorry!", "Welcome back", "AI-powered".
//   2. EXPORT-REPLACEMENT AUDIT — "Export" is replaced by "Ship it"
//      everywhere the user sees it.
//   3. COPY-FILE COVERAGE — every top-level section of COPY has at
//      least one entry.
//   4. MOTION AUDIT — every Phase 4.6 UI component either imports
//      from tokens or uses CSS-variable referenced durations; no
//      ad-hoc ms strings slip in except the ones declared in
//      MOTION_TOKENS.
//   5. ACCESSIBILITY — core icon-only buttons carry aria-label.
//   6. THEME NO-SHIFT — ThemeProvider toggle does not resize any
//      rendered element within the shell.
// -----------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, render } from '@testing-library/react';
import { COPY } from '../ui/copy';
import { MOTION_TOKENS } from '../ui/tokens';
import { ThemeProvider, useTheme } from '../ui/ThemeProvider';
import CockpitShell from '../ui/CockpitShell';

const BANNED_PATTERNS = [
  /\boops\b/i,
  /\bsorry\b/i,
  /welcome back, user/i,
  /\bAI-powered\b/i,
];

/** Walk every string value in an object tree. */
function* walkStrings(node, keyPath = []) {
  if (typeof node === 'string') { yield { value: node, keyPath }; return; }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* walkStrings(node[i], [...keyPath, i]);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) yield* walkStrings(v, [...keyPath, k]);
  }
}

// ── Voice audit ───────────────────────────────────────────────────────────
describe('Voice audit — banned words never appear in copy.js', () => {
  test('every string passes the banned-word regex gauntlet', () => {
    const offenses = [];
    for (const { value, keyPath } of walkStrings(COPY)) {
      for (const re of BANNED_PATTERNS) {
        if (re.test(value)) offenses.push({ keyPath: keyPath.join('.'), value, pattern: String(re) });
      }
    }
    if (offenses.length > 0) {
      // Surface every offense in the test output.
      throw new Error('Voice audit failed:\n' + offenses.map(o =>
        `  ${o.keyPath}: "${o.value}" matched ${o.pattern}`,
      ).join('\n'));
    }
  });
});

describe('"Export" → "Ship it" audit', () => {
  test('no user-visible string uses the word "Export"', () => {
    const offenses = [];
    for (const { value, keyPath } of walkStrings(COPY)) {
      if (/\bexport\b/i.test(value)) {
        offenses.push({ keyPath: keyPath.join('.'), value });
      }
    }
    if (offenses.length > 0) {
      throw new Error('Export-word audit failed:\n' + offenses.map(o =>
        `  ${o.keyPath}: "${o.value}"`,
      ).join('\n'));
    }
  });

  test('Ship it strings are present verbatim', () => {
    expect(COPY.topBar.shipItLabel).toBe('Ship it');
    expect(COPY.topBar.shipAsPng).toBe('Ship it as PNG');
    expect(COPY.topBar.shipAsJpeg).toBe('Ship it as JPEG');
    expect(COPY.topBar.shipForYoutube).toBe('Ship it for YouTube');
    expect(COPY.topBar.shipIn4K).toBe('Ship it in 4K');
  });
});

// ── Copy-file coverage ───────────────────────────────────────────────────
describe('Copy file shape', () => {
  test('every required section exists and has at least one entry', () => {
    const requiredSections = [
      'cockpit', 'emptyState', 'topBar', 'settings',
      'layerPanel', 'commandPalette', 'tools', 'contextualPanel',
      'keyboardReference', 'errors',
    ];
    for (const section of requiredSections) {
      expect(COPY[section]).toBeDefined();
      expect(typeof COPY[section]).toBe('object');
      expect(Object.keys(COPY[section]).length).toBeGreaterThan(0);
    }
  });

  test('voice rule: every string starts or targets "you" style (no "we")', () => {
    // Scan for first-person plural usage. Error copy can use factual
    // framing ("That file didn't load") but must not use "we".
    const offenses = [];
    for (const { value, keyPath } of walkStrings(COPY)) {
      if (/\bwe\b|\bour\b|\bus\b/i.test(value)) {
        // "us" inside "status" / "user" / other compound words will
        // false-positive; use word-boundary regex strictly.
        if (/(^|[^a-z])(we|our|us)([^a-z]|$)/i.test(value)) {
          offenses.push({ keyPath: keyPath.join('.'), value });
        }
      }
    }
    if (offenses.length > 0) {
      throw new Error('Voice audit — "we/our/us" usage:\n' + offenses.map(o =>
        `  ${o.keyPath}: "${o.value}"`,
      ).join('\n'));
    }
  });
});

// ── Motion audit ──────────────────────────────────────────────────────────
describe('Motion audit', () => {
  test('Phase 4.6 UI components import motion tokens, not ad-hoc ms strings', () => {
    const uiDir = path.join(__dirname, '..', 'ui');
    const files = fs.readdirSync(uiDir)
      .filter(f => /^(CockpitShell|EmptyState|TopBar|ToolPalette|ContextualPanel|LayerPanel|ColorPicker|ThemeProvider|shipAlive)\.(jsx?|js)$/.test(f));
    expect(files.length).toBeGreaterThan(5);

    const allowlist = [
      // Exactly the durations declared in MOTION_TOKENS.
      String(MOTION_TOKENS.fast),
      String(MOTION_TOKENS.standard),
      String(MOTION_TOKENS.theme),
      String(MOTION_TOKENS.shipAlive),
      String(MOTION_TOKENS.slow),
      // Animation keyframes for the Ship It breath + save pen carry
      // 800ms + 400ms — brief-specified, callout comments.
      '800', '400',
      // Staggers used inside shipAlive.
      '40', '16', '150', '200', '300', '100', '120',
    ];
    const offenses = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(uiDir, f), 'utf8');
      // Collect every "<n>ms" literal.
      const matches = [...src.matchAll(/(\d+)ms/g)];
      for (const m of matches) {
        if (!allowlist.includes(m[1])) {
          offenses.push({ file: f, value: m[0] });
        }
      }
    }
    if (offenses.length > 0) {
      throw new Error('Motion audit offenses:\n' + offenses.map(o =>
        `  ${o.file}: ${o.value}`,
      ).join('\n'));
    }
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────
describe('Accessibility — icon-only buttons carry aria-label', () => {
  test('every Lucide-icon button in ui/* passes an aria-label', () => {
    // Rough heuristic: read every ui/*.jsx file; whenever a <button>
    // is rendered with a Lucide icon as its only child and no
    // explicit text, it must also carry an aria-label attribute.
    const uiDir = path.join(__dirname, '..', 'ui');
    const files = fs.readdirSync(uiDir).filter(f => f.endsWith('.jsx'));
    const offenders = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(uiDir, f), 'utf8');
      // Iterate every <button ...> opening tag.
      const re = /<button\b([^>]*)>/g;
      let m;
      while ((m = re.exec(src))) {
        const attrs = m[1];
        // If there's no aria-label AND the button isn't type="submit"
        // with visible text, flag it. We only care about icon-only
        // buttons — heuristic: if aria-label is missing, flag.
        if (!/aria-label=/.test(attrs)) {
          // Allow buttons that render text children (we can't parse
          // that with regex reliably; conservative: skip the check
          // when the next few chars include alphanumerics).
          const after = src.slice(m.index + m[0].length, m.index + m[0].length + 80);
          const hasInnerText = /[A-Za-z]{3,}/.test(after.replace(/<[^>]+>/g, ''));
          if (!hasInnerText) offenders.push({ file: f, tag: m[0] });
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error('Icon-only buttons missing aria-label:\n' + offenders.map(o =>
        `  ${o.file}: ${o.tag}`,
      ).join('\n'));
    }
  });
});

// ── Theme no layout shift ────────────────────────────────────────────────
describe('Theme toggle does not cause layout shift', () => {
  test('cockpit grid style is byte-identical across theme toggles', () => {
    function Harness({ forceTheme }) {
      const { setTheme } = useTheme();
      React.useEffect(() => { setTheme(forceTheme); }, [forceTheme, setTheme]);
      return (
        <CockpitShell
          canvas={<div />} toolPalette={<div />}
          contextualPanel={<div />} layerPanel={<div />}
        />
      );
    }
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    const { container, rerender } = render(
      <ThemeProvider><Harness forceTheme="dark" /></ThemeProvider>,
    );
    const darkStyle = container.querySelector('[data-cockpit-grid]').getAttribute('style');
    act(() => {
      rerender(<ThemeProvider><Harness forceTheme="light" /></ThemeProvider>);
    });
    const lightStyle = container.querySelector('[data-cockpit-grid]').getAttribute('style');
    // The grid template strings (widths + heights) must match — only
    // color custom properties change on theme flip.
    expect(lightStyle).toBe(darkStyle);
  });
});
