// src/editor-v2/__tests__/phase-4-6-d.test.js
// -----------------------------------------------------------------------------
// Phase 4.6.d — tool palette contract.
//
// This suite is the canonical source for the Phase 4.6 tool-palette
// requirements from the queue (structure, voice, dispatch, collapse).
// phase-4b.test.js carries the original Phase 4 coverage; this file
// layers the 4.6-specific guarantees without duplicating it.
// -----------------------------------------------------------------------------

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import ToolPalette, { TOOL_GROUPS } from '../ui/ToolPalette';
import { COPY } from '../ui/copy';

describe('Phase 4.6.d tool palette', () => {
  test('palette root is the 48px vertical strip by default', () => {
    const { container } = render(<ToolPalette />);
    const root = container.querySelector('[data-tool-palette]');
    expect(root).toBeInTheDocument();
    const style = root.getAttribute('style') || '';
    expect(style).toContain('width: 48px');
    expect(style).toContain('flex-direction: column');
  });

  test('every tool label exists in copy.js (voice-file coverage)', () => {
    for (const group of TOOL_GROUPS) {
      for (const tool of group.tools) {
        expect(COPY.tools[tool.label]).toBeDefined();
      }
    }
  });

  test('no tooltip contains banned filler words', () => {
    const banned = /(oops|sorry|welcome back|user friendly|amazing|powerful)/i;
    for (const group of TOOL_GROUPS) {
      for (const tool of group.tools) {
        const tt = COPY.tools[tool.label];
        expect(tt).not.toMatch(banned);
      }
    }
  });

  test('chevron-at-top collapses to the 12px rail', () => {
    const { container } = render(<ToolPalette />);
    const root = container.querySelector('[data-tool-palette]');
    const toggle = container.querySelector('[data-tool-palette-toggle]');
    fireEvent.click(toggle);
    expect(root.getAttribute('data-collapsed')).toBe('true');
    expect(root.getAttribute('style')).toContain('width: 12px');
  });

  test('paint group includes all 11 Phase 1.b/1.c tools', () => {
    const paint = TOOL_GROUPS.find(g => g.id === 'paint');
    expect(paint).toBeDefined();
    const ids = paint.tools.map(t => t.id);
    expect(ids).toEqual([
      'tool.brush', 'tool.eraser', 'tool.dodge', 'tool.burn',
      'tool.sponge', 'tool.blur', 'tool.sharpen', 'tool.smudge',
      'tool.clone', 'tool.spotHeal', 'tool.lightPainting',
    ]);
  });

  test('shapes group includes all 7 shape types', () => {
    const shapes = TOOL_GROUPS.find(g => g.id === 'shapes');
    expect(shapes.tools.length).toBe(7);
  });

  test('tool aria-label exposes the copy.js string (screen-reader path)', () => {
    render(<ToolPalette />);
    expect(screen.getByLabelText(COPY.tools.brush)).toBeInTheDocument();
    expect(screen.getByLabelText(COPY.tools.eraser)).toBeInTheDocument();
    expect(screen.getByLabelText(COPY.tools.magicWand)).toBeInTheDocument();
    expect(screen.getByLabelText(COPY.tools.samSelect)).toBeInTheDocument();
  });
});
