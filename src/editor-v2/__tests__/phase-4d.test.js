// src/editor-v2/__tests__/phase-4d.test.js
// -----------------------------------------------------------------------------
// Phase 4.d — Layer panel. Tests:
//   • empty state text
//   • renders a row per layer with thumbnail + name
//   • selection click dispatches selection.set (replace / shift-range /
//     cmd-toggle)
//   • visibility + lock toggle buttons dispatch layer.setVisible /
//     layer.setLocked
//   • double-click name to rename → layer.update with { name }
//   • right-click opens the context menu with Delete / Group / Mask /
//     Effect items
//   • drag drop dispatches layer.move to the drop target index
// -----------------------------------------------------------------------------

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LayerPanel from '../ui/LayerPanel';
import * as registry from '../actions/registry';

function makeLayers(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `L${i}`, type: i % 2 === 0 ? 'shape' : 'text',
    name: `Layer ${i}`, x: 0, y: 0, width: 100, height: 100,
    visible: true, locked: false, opacity: 1, blendMode: 'normal',
    shapeData: { shapeType: 'rect', fill: '#f97316' },
    textData:  { content: 'hi' },
  }));
}

afterEach(() => { jest.restoreAllMocks(); });

describe('empty state', () => {
  test('renders prompt when layers is empty', () => {
    render(<LayerPanel layers={[]} />);
    expect(screen.getByText(/Drop an image to get started/i)).toBeInTheDocument();
  });
});

describe('row rendering', () => {
  test('one row per layer with thumbnail', () => {
    const layers = makeLayers(3);
    const { container } = render(<LayerPanel layers={layers} />);
    expect(container.querySelectorAll('[data-layer-id]').length).toBe(3);
    expect(container.querySelectorAll('[data-thumbnail]').length).toBe(3);
  });

  test('selected layer shows aria-selected', () => {
    const layers = makeLayers(2);
    const { container } = render(<LayerPanel layers={layers} selectedIds={['L1']} />);
    const row = container.querySelector('[data-layer-id="L1"]');
    expect(row.getAttribute('data-selected')).toBe('true');
  });

  test('non-normal blend mode gets the amber badge', () => {
    const layers = makeLayers(1);
    layers[0].blendMode = 'multiply';
    const { container } = render(<LayerPanel layers={layers} />);
    expect(container.textContent.toLowerCase()).toContain('multiply');
  });
});

describe('selection clicks', () => {
  test('plain click → selection.set with a single id', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    const layers = makeLayers(3);
    render(<LayerPanel layers={layers} selectedIds={[]} />);
    fireEvent.click(screen.getAllByText(/Layer 1/)[0]);
    expect(spy).toHaveBeenCalledWith('selection.set', ['L1']);
  });

  test('cmd-click toggles a layer in/out of selection', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    const layers = makeLayers(3);
    render(<LayerPanel layers={layers} selectedIds={['L0']} />);
    fireEvent.click(screen.getAllByText(/Layer 2/)[0], { metaKey: true });
    expect(spy).toHaveBeenCalledWith('selection.set', ['L0', 'L2']);
  });

  test('shift-click selects a contiguous range', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    const layers = makeLayers(4);
    render(<LayerPanel layers={layers} selectedIds={['L1']} />);
    fireEvent.click(screen.getAllByText(/Layer 3/)[0], { shiftKey: true });
    expect(spy).toHaveBeenCalledWith('selection.set', ['L1', 'L2', 'L3']);
  });
});

describe('visibility + lock toggles', () => {
  test('visibility click → layer.setVisible(false)', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    const layers = makeLayers(1);
    const { container } = render(<LayerPanel layers={layers} />);
    const vis = container.querySelector('[data-role="visibility"]');
    fireEvent.click(vis);
    expect(spy).toHaveBeenCalledWith('layer.setVisible', 'L0', false);
  });

  test('lock click → layer.setLocked(true)', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    const layers = makeLayers(1);
    const { container } = render(<LayerPanel layers={layers} />);
    const lock = container.querySelector('[data-role="lock"]');
    fireEvent.click(lock);
    expect(spy).toHaveBeenCalledWith('layer.setLocked', 'L0', true);
  });

  test('toggle clicks do NOT change selection', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    const layers = makeLayers(1);
    const { container } = render(<LayerPanel layers={layers} selectedIds={[]} />);
    fireEvent.click(container.querySelector('[data-role="visibility"]'));
    expect(spy.mock.calls.every(c => c[0] !== 'selection.set')).toBe(true);
  });
});

describe('rename', () => {
  test('double-click opens an input; Enter dispatches layer.update', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    const layers = makeLayers(1);
    render(<LayerPanel layers={layers} />);
    fireEvent.doubleClick(screen.getAllByText(/Layer 0/)[0]);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hero' } });
    fireEvent.blur(input);
    expect(spy).toHaveBeenCalledWith('layer.update', 'L0', { name: 'Hero' });
  });
});

describe('context menu', () => {
  test('right-click opens the menu with Delete / Group / Add mask / Add effect', () => {
    const layers = makeLayers(1);
    const { container } = render(<LayerPanel layers={layers} />);
    fireEvent.contextMenu(container.querySelector('[data-layer-id="L0"]'), {
      clientX: 10, clientY: 10,
    });
    const menu = screen.getByRole('menu');
    expect(menu.textContent).toMatch(/Delete/);
    expect(menu.textContent).toMatch(/Group/);
    expect(menu.textContent).toMatch(/mask/i);
    expect(menu.textContent).toMatch(/effect/i);
  });

  test('clicking Delete dispatches layer.remove', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    const layers = makeLayers(1);
    const { container } = render(<LayerPanel layers={layers} />);
    fireEvent.contextMenu(container.querySelector('[data-layer-id="L0"]'));
    fireEvent.click(screen.getByText('Delete'));
    expect(spy).toHaveBeenCalledWith('layer.remove', 'L0');
  });
});

describe('drag to reorder', () => {
  test('drop onto a different row dispatches layer.move', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    const layers = makeLayers(3);
    const { container } = render(<LayerPanel layers={layers} />);
    const l0 = container.querySelector('[data-layer-id="L0"]');
    const l2 = container.querySelector('[data-layer-id="L2"]');
    const dt = { effectAllowed: null };
    fireEvent.dragStart(l0, { dataTransfer: dt });
    fireEvent.dragOver(l2,  { dataTransfer: dt });
    fireEvent.drop(l2,      { dataTransfer: dt });
    expect(spy).toHaveBeenCalledWith('layer.move', 'L0', 2);
  });
});
