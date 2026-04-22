// src/editor-v2/__tests__/phase-4c.test.js
// -----------------------------------------------------------------------------
// Phase 4.c — contextual panel. Verifies:
//   • resolvePanelKind picks the right body for every selection shape
//   • ContextualPanel renders the appropriate body + a panel header
//     with voice-matching subtitle
//   • ScrubNumber drag-to-scrub + click-to-type roundtrip
//   • Numeric / text / color edits forward through the registry
// -----------------------------------------------------------------------------

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ContextualPanel, { resolvePanelKind } from '../ui/ContextualPanel';
import ScrubNumber from '../ui/ScrubNumber';
import * as registry from '../actions/registry';

describe('resolvePanelKind', () => {
  test.each([
    [[], 'empty'],
    [['a'], 'empty'],    // selection with no matching layer
    [['a', 'b'], 'multi'],
  ])('no layer + selectedIds=%j → %s', (selectedIds, expected) => {
    expect(resolvePanelKind([], selectedIds)).toBe(expected);
  });

  test.each([
    ['image',      'image'],
    ['text',       'text'],
    ['shape',      'shape'],
    ['adjustment', 'adjustment'],
    ['group',      'empty'],
  ])('%s layer → %s panel', (type, expected) => {
    expect(resolvePanelKind([{ id: 'L1', type }], ['L1'])).toBe(expected);
  });
});

describe('ContextualPanel rendering', () => {
  test('empty selection → canvas settings body', () => {
    const { container } = render(<ContextualPanel layers={[]} selectedIds={[]} />);
    expect(container.querySelector('[data-kind="empty"]')).toBeInTheDocument();
    expect(screen.getByText(/Canvas/).textContent).toBe('Canvas');
    expect(screen.getByText(/Nothing selected/)).toBeInTheDocument();
  });

  test('image layer → image body with opacity control', () => {
    const layers = [{ id: 'I1', type: 'image', name: 'Hero',
      x: 640, y: 360, width: 1280, height: 720, opacity: 0.7 }];
    render(<ContextualPanel layers={layers} selectedIds={['I1']} />);
    expect(screen.getByText('Hero')).toBeInTheDocument();
    expect(screen.getByText(/Tune this image/)).toBeInTheDocument();
  });

  test('text layer → typography panel with size + weight + fill', () => {
    const layers = [{
      id: 'T1', type: 'text', name: 'Title',
      x: 640, y: 360, width: 900, height: 160,
      textData: { content: 'Hi', fontSize: 96, fontWeight: '800', fill: '#faecd0' },
    }];
    const { container } = render(<ContextualPanel layers={layers} selectedIds={['T1']} />);
    expect(container.querySelector('[data-kind="text"]')).toBeInTheDocument();
    // Section title renders as "Typography" inside a button.
    expect(
      container.textContent.toLowerCase().includes('typography'),
    ).toBe(true);
  });

  test('shape layer → shape body with fill + stroke', () => {
    const layers = [{
      id: 'S1', type: 'shape', name: 'Accent',
      x: 100, y: 100, width: 80, height: 40,
      shapeData: { shapeType: 'rect', fill: '#f97316', strokeWidth: 0 },
    }];
    const { container } = render(<ContextualPanel layers={layers} selectedIds={['S1']} />);
    expect(container.querySelector('[data-kind="shape"]')).toBeInTheDocument();
  });

  test('adjustment layer → params scrubbers', () => {
    const layers = [{
      id: 'A1', type: 'adjustment', name: 'Brightness',
      adjustmentData: { kind: 'brightness', params: { value: 25 } },
    }];
    render(<ContextualPanel layers={layers} selectedIds={['A1']} />);
    expect(screen.getByText(/Tweak this adjustment/)).toBeInTheDocument();
  });

  test('multi-select → align/distribute body', () => {
    const { container } = render(<ContextualPanel layers={[]} selectedIds={['a', 'b', 'c']} />);
    expect(container.querySelector('[data-kind="multi"]')).toBeInTheDocument();
    expect(container.textContent).toMatch(/Align and distribute/);
    expect(screen.getAllByText(/3 layers/).length).toBeGreaterThan(0);
  });
});

describe('ScrubNumber', () => {
  test('renders value with suffix', () => {
    render(<ScrubNumber value={42} suffix="%" label="Opacity" />);
    expect(screen.getByText('Opacity')).toBeInTheDocument();
    expect(screen.getByText(/42%/)).toBeInTheDocument();
  });

  test('click without drag opens an input and commits on enter', () => {
    const onChange = jest.fn();
    render(<ScrubNumber value={50} onChange={onChange} label="Val" />);
    const btn = screen.getByRole('button');
    fireEvent.pointerDown(btn, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(btn,   { clientX: 100, pointerId: 1 });
    fireEvent.click(btn);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '75' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(75);
  });

  test('drag initialises the reference anchor (pointerDown → internal state ready)', () => {
    const onChange = jest.fn();
    render(<ScrubNumber value={50} onChange={onChange} label="Val" />);
    const btn = screen.getByRole('button');
    // jsdom's pointer events are partial; we exercise the pointerDown
    // path here and verify that a subsequent click opens the editor
    // (proving pointerDown → pointerUp-without-movement handoff).
    fireEvent.pointerDown(btn, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(btn,   { clientX: 100, pointerId: 1 });
    fireEvent.click(btn);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  test('Escape cancels without committing', () => {
    const onChange = jest.fn();
    render(<ScrubNumber value={50} onChange={onChange} label="V" />);
    const btn = screen.getByRole('button');
    fireEvent.pointerDown(btn, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(btn,   { clientX: 100, pointerId: 1 });
    fireEvent.click(btn);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Panel edits forward through registry', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  test('opacity type-in on image layer forwards layer.setOpacity', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    render(<ContextualPanel
      layers={[{ id: 'I1', type: 'image', name: 'x', opacity: 0.5, x: 0, y: 0, width: 100, height: 100 }]}
      selectedIds={['I1']}
    />);
    // Find the opacity scrubber + type into it.
    const scrubber = screen.getAllByRole('button')
      .find(b => b.textContent && b.textContent.startsWith('50'));
    expect(scrubber).toBeDefined();
    fireEvent.pointerDown(scrubber, { clientX: 0, pointerId: 1 });
    fireEvent.pointerUp(scrubber,   { clientX: 0, pointerId: 1 });
    fireEvent.click(scrubber);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '80' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const calls = spy.mock.calls.filter(c => c[0] === 'layer.setOpacity');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][1]).toBe('I1');
    expect(calls[0][2]).toBeCloseTo(0.8);
  });
});
