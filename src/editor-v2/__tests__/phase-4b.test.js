// src/editor-v2/__tests__/phase-4b.test.js
// -----------------------------------------------------------------------------
// Phase 4.b (updated for Phase 4.6 group structure) — tool palette.
// Locks in the Phase 4.6.d tool-group topology (select / shapes / paint /
// text / crop / viewport), voice-compliant tooltips sourced from
// copy.js, and the aria-pressed + glow active state.
// -----------------------------------------------------------------------------

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolPalette, { TOOL_GROUPS } from '../ui/ToolPalette';
import { COPY } from '../ui/copy';
import * as registry from '../actions/registry';

describe('TOOL_GROUPS (Phase 4.6 topology)', () => {
  test('contains select / shapes / paint / text / crop / viewport groups', () => {
    const ids = TOOL_GROUPS.map(g => g.id);
    expect(ids).toEqual(expect.arrayContaining(
      ['select', 'shapes', 'paint', 'text', 'crop', 'viewport'],
    ));
  });

  test('every tool has id + label + icon (label is a copy.js key)', () => {
    for (const group of TOOL_GROUPS) {
      for (const tool of group.tools) {
        expect(typeof tool.id).toBe('string');
        expect(typeof tool.label).toBe('string');
        expect(COPY.tools[tool.label]).toBeDefined();   // voice file coverage
        expect(tool.icon).toBeTruthy();                  // Lucide component
      }
    }
  });

  test('voice contract: copy.js tooltips are direct-address, no "tool" filler', () => {
    for (const group of TOOL_GROUPS) {
      for (const tool of group.tools) {
        const label = COPY.tools[tool.label];
        expect(label).not.toMatch(/\btool\b/i);
      }
    }
  });

  test('mandatory brief strings are present verbatim', () => {
    expect(COPY.tools.brush).toBe('Brush [B]');
    expect(COPY.tools.eraser).toBe('Erase the deck [E]');
    expect(COPY.tools.text).toBe('Text [T]');
    expect(COPY.tools.magicWand).toBe('Magic wand [W]');
    expect(COPY.tools.crop).toBe('Crop [C]');
    expect(COPY.tools.hand).toBe('Hand [H]');
    expect(COPY.tools.zoom).toBe('Zoom [Z]');
    expect(COPY.tools.samSelect).toBe('Click to select [S]');
  });

  test('shortcut-bearing tools expose a string shortcut', () => {
    const withShortcuts = TOOL_GROUPS.flatMap(g => g.tools).filter(t => t.shortcut);
    expect(withShortcuts.length).toBeGreaterThan(6);
    for (const t of withShortcuts) expect(typeof t.shortcut).toBe('string');
  });
});

describe('ToolPalette rendering', () => {
  test('renders a button per tool', () => {
    render(<ToolPalette />);
    const total = TOOL_GROUPS.reduce((acc, g) => acc + g.tools.length, 0);
    const buttons = document.querySelectorAll('[data-tool-id]');
    expect(buttons.length).toBe(total);
  });

  test('active tool receives aria-pressed=true + glow shadow', () => {
    const { container } = render(<ToolPalette activeToolId="tool.brush" />);
    const brush = container.querySelector('[data-tool-id="tool.brush"]');
    expect(brush).toBeInTheDocument();
    expect(brush.getAttribute('aria-pressed')).toBe('true');
    expect(brush.getAttribute('style')).toMatch(/box-shadow/);
  });

  test('tooltip only appears on hover + shows the copy.js string', () => {
    render(<ToolPalette activeToolId="tool.brush" />);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(screen.getByLabelText(COPY.tools.brush).parentElement);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByRole('tooltip').textContent).toBe(COPY.tools.brush);
  });

  test('clicking a tool dispatches its registered action', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    render(<ToolPalette />);
    fireEvent.click(screen.getByLabelText(COPY.tools.brush));
    expect(spy).toHaveBeenCalledWith('tool.brush.select', undefined);
    spy.mockRestore();
  });

  test('shape tool clicks forward actionArgs to the registry', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    render(<ToolPalette />);
    fireEvent.click(screen.getByLabelText(COPY.tools.rectangle));
    expect(spy).toHaveBeenCalledWith(
      'shape.create',
      expect.objectContaining({ shapeData: expect.objectContaining({ shapeType: 'rect' }) }),
    );
    spy.mockRestore();
  });

  test('onSelect callback fires with the tool object', () => {
    const onSelect = jest.fn();
    render(<ToolPalette onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText(COPY.tools.eraser));
    expect(onSelect).toHaveBeenCalled();
    expect(onSelect.mock.calls[0][0].id).toBe('tool.eraser');
  });

  test('collapsed state narrows the strip + hides tool buttons', () => {
    const { container } = render(<ToolPalette />);
    const root = container.querySelector('[data-tool-palette]');
    const toggle = container.querySelector('[data-tool-palette-toggle]');
    // Default: 48px wide, tools visible.
    expect(root.getAttribute('data-collapsed')).toBe('false');
    expect(container.querySelectorAll('[data-tool-id]').length).toBeGreaterThan(0);
    fireEvent.click(toggle);
    expect(root.getAttribute('data-collapsed')).toBe('true');
    // Collapsed: only the toggle button remains.
    expect(container.querySelectorAll('[data-tool-id]').length).toBe(0);
  });
});
