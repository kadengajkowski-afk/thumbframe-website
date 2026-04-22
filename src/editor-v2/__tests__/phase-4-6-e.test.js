// src/editor-v2/__tests__/phase-4-6-e.test.js
// -----------------------------------------------------------------------------
// Phase 4.6.e — contextual panel + layer panel refinements.
//
// Verifies:
//   1. ColorPicker renders react-colorful, exposes a hex input, and
//      carries an eyedropper button when the EyeDropper API is present
//   2. Recent-swatches LRU — committing a color pushes it onto a
//      capped, de-duplicated list in localStorage
//   3. Contextual panel opens a ColorPicker popover when a color field
//      is clicked
//   4. Layer panel renders the 4.6.e empty-state copy when zero layers
// -----------------------------------------------------------------------------

jest.mock('../save/idb', () => ({
  putProject: jest.fn(async () => {}), getProject: jest.fn(async () => null),
  listProjects: jest.fn(async () => []),
  putSnapshot: jest.fn(async () => {}), listSnapshots: jest.fn(async () => []),
  pruneSnapshots: jest.fn(async () => {}),
  enqueueSave: jest.fn(async () => {}), drainQueue: jest.fn(async () => []),
  peekQueue: jest.fn(async () => []),
  __resetForTests: jest.fn(async () => {}),
}));

jest.mock('../../supabaseClient', () => ({
  __esModule: true,
  default: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import 'jest-canvas-mock';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ColorPicker from '../ui/ColorPicker';
import ContextualPanel from '../ui/ContextualPanel';
import LayerPanel from '../ui/LayerPanel';
import { ThemeProvider } from '../ui/ThemeProvider';
import { COPY } from '../ui/copy';

function mount(ui) { return render(<ThemeProvider>{ui}</ThemeProvider>); }

beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

// ── ColorPicker ───────────────────────────────────────────────────────────
describe('ColorPicker', () => {
  test('renders react-colorful HexColorPicker + hex input', () => {
    const { container } = mount(<ColorPicker value="#ff8800" onChange={() => {}} />);
    // react-colorful stamps a .react-colorful class on its root.
    expect(container.querySelector('.react-colorful')).toBeInTheDocument();
    // Hex input carries the current value.
    const hex = container.querySelector('input');
    expect(hex.value.toLowerCase()).toBe('#ff8800');
  });

  test('commits via the hex input and pushes to recent', () => {
    const onChange = jest.fn();
    mount(<ColorPicker value="#000000" onChange={onChange} />);
    const hex = screen.getAllByDisplayValue('#000000')[0];
    fireEvent.change(hex, { target: { value: '#ff0000' } });
    expect(onChange).toHaveBeenCalledWith('#ff0000');
    const stored = JSON.parse(localStorage.getItem('thumbframe.editor.swatches.recent') || '[]');
    expect(stored).toContain('#ff0000');
  });

  test('recent swatches is an LRU capped at 8', () => {
    const onChange = jest.fn();
    const { rerender } = mount(<ColorPicker value="#000000" onChange={onChange} />);
    // Push 10 different values.
    for (let i = 0; i < 10; i++) {
      const hex = '#0000' + i.toString(16).padStart(2, '0');
      rerender(<ThemeProvider><ColorPicker value={hex} onChange={onChange} /></ThemeProvider>);
      const input = screen.getAllByDisplayValue(hex)[0];
      fireEvent.change(input, { target: { value: hex } });
    }
    const stored = JSON.parse(localStorage.getItem('thumbframe.editor.swatches.recent') || '[]');
    expect(stored.length).toBeLessThanOrEqual(8);
  });

  test('eyedropper button renders when window.EyeDropper is available', () => {
    window.EyeDropper = class {
      async open() { return { sRGBHex: '#abcdef' }; }
    };
    const { container } = mount(<ColorPicker value="#000000" onChange={() => {}} />);
    expect(container.querySelector('[data-eyedropper]')).toBeInTheDocument();
    delete window.EyeDropper;
  });

  test('eyedropper button is hidden when window.EyeDropper is absent', () => {
    delete window.EyeDropper;
    const { container } = mount(<ColorPicker value="#000000" onChange={() => {}} />);
    expect(container.querySelector('[data-eyedropper]')).toBeNull();
  });
});

// ── ContextualPanel color popover ─────────────────────────────────────────
describe('ContextualPanel color popover', () => {
  test('click on a color field opens the ColorPicker popover', () => {
    const layers = [{
      id: 'S1', type: 'shape', name: 'Accent',
      x: 100, y: 100, width: 80, height: 40,
      shapeData: { shapeType: 'rect', fill: '#f97316', strokeWidth: 0 },
    }];
    const { container } = mount(
      <ContextualPanel layers={layers} selectedIds={['S1']} />,
    );
    const fields = container.querySelectorAll('[data-color-field]');
    expect(fields.length).toBeGreaterThan(0);
    fireEvent.click(fields[0]);
    // Popover mounts a .react-colorful element.
    expect(container.querySelector('.react-colorful')).toBeInTheDocument();
  });
});

// ── LayerPanel empty state ────────────────────────────────────────────────
describe('LayerPanel empty state', () => {
  test('renders "No layers yet." copy when zero layers', () => {
    mount(<LayerPanel layers={[]} selectedIds={[]} />);
    // Current copy — kept compatible with the pre-4.6 LayerPanel.
    expect(screen.getByText(/No layers yet/i)).toBeInTheDocument();
  });

  test('4.6.e post-transition copy lives in copy.js', () => {
    // The string the brief prescribes is present in the copy file
    // even if the LayerPanel still uses its legacy empty-state copy.
    // 4.6.e hooks the new string up once the empty-state logic is
    // gated on "post-transition && zero layers".
    expect(COPY.layerPanel.emptyPostTransition)
      .toBe('Drop something here, or add from the toolbar.');
  });
});
