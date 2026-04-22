// src/editor-v2/__tests__/phase-4-6-c.test.js
// -----------------------------------------------------------------------------
// Phase 4.6.c — empty state + ship-alive transition.
//
// Verifies:
//   1. EmptyState renders the brief copy verbatim (headline + secondary)
//   2. Upload triggers fire via file input, drag-drop, and onBegin
//   3. Start blank fires onStartBlank AND onBegin('blank')
//   4. Sailship brand mark renders with exactly ONE <svg data-sailship>
//   5. useShipAlive drives stage flags in the correct order
//   6. Session flag gates replay — second run short-circuits
//   7. Stages array matches the brief timeline to the millisecond
//   8. skip() finishes immediately and marks the session
// -----------------------------------------------------------------------------

import React, { useEffect } from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import EmptyState from '../ui/EmptyState';
import Sailship   from '../ui/Sailship';
import {
  useShipAlive, SHIP_ALIVE_STAGES, SESSION_FLAG,
  hasPlayedThisSession, __resetShipAliveForTests,
} from '../ui/shipAlive';
import { ThemeProvider } from '../ui/ThemeProvider';
import { MOTION_TOKENS } from '../ui/tokens';
import { COPY } from '../ui/copy';

function mount(ui) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

// ── Sailship ──────────────────────────────────────────────────────────────
describe('Sailship', () => {
  test('renders a single data-sailship SVG with size 24 default', () => {
    const { container } = render(<Sailship />);
    const sailships = container.querySelectorAll('[data-sailship]');
    expect(sailships.length).toBe(1);
    expect(sailships[0].getAttribute('width')).toBe('24');
  });

  test('respects custom size prop', () => {
    const { container } = render(<Sailship size={48} />);
    const svg = container.querySelector('[data-sailship]');
    expect(svg.getAttribute('width')).toBe('48');
  });

  test('carries an aria-label via title for screen readers', () => {
    const { container } = render(<Sailship title="ThumbFrame brand" />);
    expect(container.querySelector('title').textContent).toBe('ThumbFrame brand');
  });
});

// ── EmptyState ────────────────────────────────────────────────────────────
describe('EmptyState', () => {
  test('renders the brief headline + secondary copy verbatim', () => {
    mount(<EmptyState onUpload={() => {}} onStartBlank={() => {}} />);
    expect(screen.getByText(COPY.emptyState.headline)).toBeInTheDocument();
    expect(screen.getByText(COPY.emptyState.secondary)).toBeInTheDocument();
  });

  test('renders sailship watermark', () => {
    const { container } = mount(<EmptyState onUpload={() => {}} onStartBlank={() => {}} />);
    expect(container.querySelector('[data-sailship]')).toBeInTheDocument();
  });

  test('click on start blank fires onStartBlank + onBegin("blank")', () => {
    const onStartBlank = jest.fn();
    const onBegin      = jest.fn();
    mount(<EmptyState onUpload={() => {}} onStartBlank={onStartBlank} onBegin={onBegin} />);
    fireEvent.click(screen.getByText(COPY.emptyState.secondary));
    expect(onStartBlank).toHaveBeenCalledTimes(1);
    expect(onBegin).toHaveBeenCalledWith('blank');
  });

  test('file input change forwards File[] to onUpload + fires onBegin("upload")', async () => {
    const onUpload = jest.fn();
    const onBegin  = jest.fn();
    const { container } = mount(
      <EmptyState onUpload={onUpload} onStartBlank={() => {}} onBegin={onBegin} />,
    );
    const input = container.querySelector('input[type="file"]');
    const file = new File(['x'], 'hero.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(onUpload).toHaveBeenCalledWith([file]);
    expect(onBegin).toHaveBeenCalledWith('upload');
  });

  test('drag-drop forwards files to onUpload', async () => {
    const onUpload = jest.fn();
    const { container } = mount(<EmptyState onUpload={onUpload} onStartBlank={() => {}} />);
    const root = container.querySelector('[data-empty-state]');
    const file = new File(['x'], 'drop.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.drop(root, { dataTransfer: { files: [file] } });
    });
    expect(onUpload).toHaveBeenCalled();
    expect(onUpload.mock.calls[0][0][0].name).toBe('drop.png');
  });

  test('drag-over highlights the placeholder (tinted wash appears)', () => {
    const { container } = mount(<EmptyState onUpload={() => {}} onStartBlank={() => {}} />);
    const root = container.querySelector('[data-empty-state]');
    fireEvent.dragOver(root);
    const placeholder = container.querySelector('[data-empty-canvas-placeholder]');
    const style = placeholder.getAttribute('style') || '';
    // The dragOver effect paints a faint cream wash onto the frame.
    expect(style).toMatch(/background: rgba\(249, 240, 225/);
  });

  test('has an accessible upload label', () => {
    mount(<EmptyState onUpload={() => {}} onStartBlank={() => {}} />);
    expect(screen.getByLabelText(COPY.emptyState.uploadLabel)).toBeInTheDocument();
  });
});

// ── useShipAlive hook ─────────────────────────────────────────────────────
describe('useShipAlive', () => {
  let raf;
  beforeEach(() => {
    __resetShipAliveForTests();
    raf = installRafStub();
  });
  afterEach(() => { raf.uninstall(); });

  test('SHIP_ALIVE_STAGES matches the brief timeline exactly', () => {
    const timeline = SHIP_ALIVE_STAGES.map(s => [s.key, s.t]);
    expect(timeline).toEqual([
      ['canvasEnter',    0],
      ['toolsUnfurl',    200],
      ['panelSlideIn',   600],
      ['layersRise',     700],
      ['bgBrighten',     800],
      ['shipItFadeIn',   900],
      ['savePenAppear',  1000],
      ['settle',         1100],
    ]);
    expect(MOTION_TOKENS.shipAlive).toBe(1200);
  });

  test('stages advance as time elapses', () => {
    const { result } = renderHook(() => useShipAlive(true));
    // RAF stub needs a drain to advance the performance clock.
    raf.advance(0);  expect(result.current.stages.canvasEnter).toBe(true);
    raf.advance(250); expect(result.current.stages.toolsUnfurl).toBe(true);
    raf.advance(700); expect(result.current.stages.layersRise).toBe(true);
    raf.advance(1200); expect(result.current.stages.settle).toBe(true);
  });

  test('onComplete fires once the full duration elapses + session flag set', () => {
    const onComplete = jest.fn();
    renderHook(() => useShipAlive(true, onComplete));
    raf.advance(MOTION_TOKENS.shipAlive + 16);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(hasPlayedThisSession()).toBe(true);
  });

  test('second run in the same tab short-circuits (no replay)', () => {
    const first = jest.fn();
    renderHook(() => useShipAlive(true, first));
    raf.advance(MOTION_TOKENS.shipAlive + 16);
    expect(first).toHaveBeenCalledTimes(1);

    // Simulate another upload — hook re-mounted with active=true.
    const second = jest.fn();
    renderHook(() => useShipAlive(true, second));
    // Without draining RAF, the short-circuit path should already
    // have fired onComplete synchronously on mount.
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('skip() finishes immediately', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useShipAlive(true, onComplete));
    act(() => { result.current.skip(); });
    expect(result.current.running).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(hasPlayedThisSession()).toBe(true);
  });

  test('active=false is a no-op', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useShipAlive(false, onComplete));
    raf.advance(1500);
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.elapsed).toBe(0);
  });

  test('SESSION_FLAG is written to sessionStorage (NOT localStorage)', () => {
    renderHook(() => useShipAlive(true));
    // Even before the RAF advances, nothing is in either store.
    expect(sessionStorage.getItem(SESSION_FLAG)).toBeNull();
    raf.advance(MOTION_TOKENS.shipAlive + 16);
    expect(sessionStorage.getItem(SESSION_FLAG)).toBe('1');
    expect(localStorage.getItem(SESSION_FLAG)).toBeNull();
  });
});

// ── RAF stub with a controlled clock ──────────────────────────────────────
function installRafStub() {
  const queue = [];
  const origRaf    = global.requestAnimationFrame;
  const origCancel = global.cancelAnimationFrame;
  const origPerfNow = performance.now.bind(performance);
  let clock = 0;
  const now = () => clock;
  performance.now = now;
  global.requestAnimationFrame = (cb) => {
    const id = queue.length + 1;
    queue.push({ id, cb });
    return id;
  };
  global.cancelAnimationFrame = (id) => {
    const i = queue.findIndex(e => e.id === id);
    if (i >= 0) queue.splice(i, 1);
  };
  return {
    advance: (ms) => {
      clock = ms;
      act(() => {
        const snapshot = queue.splice(0, queue.length);
        for (const e of snapshot) e.cb(clock);
      });
    },
    uninstall: () => {
      global.requestAnimationFrame = origRaf;
      global.cancelAnimationFrame  = origCancel;
      performance.now = origPerfNow;
    },
  };
}

// Silence React act warnings from useEffect during hook mount.
// eslint-disable-next-line no-unused-vars
function _Warmup() { useEffect(() => {}, []); return null; }
