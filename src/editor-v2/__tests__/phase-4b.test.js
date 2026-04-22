// src/editor-v2/__tests__/phase-4b.test.js
// -----------------------------------------------------------------------------
// Phase 4.b — tool palette. Tests:
//   • TOOL_GROUPS contains the required categories and tools
//   • Every tool has a tooltip hint + label
//   • Voice contract: tooltips are direct address (no "Brush tool"
//     filler), keyboard shortcuts shown as bracketed suffix
//   • Click dispatches the registry action for the tool
//   • Active tool gets the glow / aria-pressed flag
// -----------------------------------------------------------------------------

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolPalette, { TOOL_GROUPS } from '../ui/ToolPalette';
import * as registry from '../actions/registry';

describe('TOOL_GROUPS', () => {
  test('contains selection / shapes / brushes / text / transform groups', () => {
    const ids = TOOL_GROUPS.map(g => g.id);
    expect(ids).toEqual(expect.arrayContaining(['select', 'shapes', 'brushes', 'text', 'transform']));
  });

  test('every tool has id + label + hint + icon', () => {
    for (const group of TOOL_GROUPS) {
      for (const tool of group.tools) {
        expect(typeof tool.id).toBe('string');
        expect(typeof tool.label).toBe('string');
        expect(typeof tool.hint).toBe('string');
        expect(typeof tool.icon).toBe('string');
      }
    }
  });

  test('voice contract: hints are direct-address, not "X tool" filler', () => {
    const hints = TOOL_GROUPS.flatMap(g => g.tools.map(t => t.hint));
    for (const hint of hints) {
      // No "Foo tool", no "Click to foo" corporate phrasing.
      expect(hint).not.toMatch(/\btool\b/i);
    }
  });

  test('shortcut-bearing tools expose a string shortcut', () => {
    const withShortcuts = TOOL_GROUPS.flatMap(g => g.tools).filter(t => t.shortcut);
    expect(withShortcuts.length).toBeGreaterThan(3);
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

  test('tooltip only appears on hover', () => {
    render(<ToolPalette activeToolId="tool.brush" />);
    // Before hover: no tooltip in the document.
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(screen.getByLabelText('Brush').parentElement);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByRole('tooltip').textContent).toMatch(/Paint on the canvas/);
  });

  test('clicking a tool dispatches its registered action', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    render(<ToolPalette />);
    fireEvent.click(screen.getByLabelText('Brush'));
    expect(spy).toHaveBeenCalledWith('tool.brush.select', undefined);
    spy.mockRestore();
  });

  test('shape tool clicks forward actionArgs to the registry', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    render(<ToolPalette />);
    fireEvent.click(screen.getByLabelText('Rectangle'));
    expect(spy).toHaveBeenCalledWith(
      'shape.create',
      expect.objectContaining({ shapeData: expect.objectContaining({ shapeType: 'rect' }) }),
    );
    spy.mockRestore();
  });

  test('onSelect callback is invoked with the tool object', () => {
    const onSelect = jest.fn();
    render(<ToolPalette onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('Eraser'));
    expect(onSelect).toHaveBeenCalled();
    expect(onSelect.mock.calls[0][0].id).toBe('tool.eraser');
  });
});
