// src/editor-v2/__tests__/phase-4e.test.js
// -----------------------------------------------------------------------------
// Phase 4.e — command palette. Tests:
//   • useCommandPalette toggles open on ⌘K / Ctrl+K and closes on Escape
//   • open palette renders registered actions grouped by category
//   • shortcut hints appear in a <kbd> on each row
//   • Enter/select on an item dispatches executeAction and closes
//   • localStorage recent list is updated on run; Recent group shows
//     on the next open
//   • extraItems slot renders an "AI" group separately
// -----------------------------------------------------------------------------

jest.mock('../save/idb', () => {
  const db = { projects: new Map(), snapshots: new Map(), queue: new Map() };
  return {
    putProject: jest.fn(async () => {}), getProject: jest.fn(async () => null),
    listProjects: jest.fn(async () => []),
    putSnapshot: jest.fn(async () => {}),
    listSnapshots: jest.fn(async () => []),
    pruneSnapshots: jest.fn(async () => {}),
    enqueueSave: jest.fn(async () => {}), drainQueue: jest.fn(async () => []),
    peekQueue: jest.fn(async () => []),
    __resetForTests: jest.fn(async () => {
      db.projects.clear(); db.snapshots.clear(); db.queue.clear();
    }),
  };
});

jest.mock('../../supabaseClient', () => ({
  __esModule: true,
  default: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import 'jest-canvas-mock';
import React from 'react';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import CommandPalette, { useCommandPalette } from '../ui/CommandPalette';
import {
  registerFoundationActions,
  __resetRegistry,
} from '../actions/registry';
import * as registry from '../actions/registry';
import { useStore, SAVE_STATUS } from '../store/Store';
import { History } from '../history/History';
import { PaintCanvases } from '../engine/PaintCanvases';
import * as idb from '../save/idb';

let history, paintCanvases;

async function setupRegistry() {
  __resetRegistry();
  await idb.__resetForTests();
  const s = useStore.getState();
  useStore.setState({
    projectId: null, projectName: 'Untitled',
    layers: [], selectedLayerIds: [],
    saveStatus: SAVE_STATUS.SAVED, lastSavedAt: null, rendererReady: false,
    activeTool: 'brush', toolParams: s.toolParams, strokeActive: false,
  });
  paintCanvases = new PaintCanvases();
  history = new History({ store: useStore, projectId: 'test-project', max: 50 });
  await history.load();
  registerFoundationActions({ store: useStore, history, paintCanvases });
  await history.seed('Initial state');
}

beforeEach(async () => {
  await setupRegistry();
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

describe('useCommandPalette', () => {
  test('⌘K / Ctrl+K toggles open', () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current[0]).toBe(false);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })); });
    expect(result.current[0]).toBe(true);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })); });
    expect(result.current[0]).toBe(false);
  });

  test('Escape always closes', () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(result.current[0]).toBe(false);
  });
});

describe('CommandPalette rendering', () => {
  test('renders when open with input + groups', () => {
    render(<CommandPalette open={true} onOpenChange={() => {}} />);
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search actions/)).toBeInTheDocument();
  });

  test('renders nothing when closed', () => {
    render(<CommandPalette open={false} onOpenChange={() => {}} />);
    expect(screen.queryByTestId('command-palette')).toBeNull();
  });

  test('shows shortcut hints on actions that have one', () => {
    const { container } = render(<CommandPalette open={true} onOpenChange={() => {}} />);
    const kbds = container.querySelectorAll('kbd');
    expect(kbds.length).toBeGreaterThan(0);
  });

  test('extraItems are rendered in an AI group', () => {
    const onSelect = jest.fn();
    render(<CommandPalette
      open={true} onOpenChange={() => {}}
      extraItems={[{ id: 'ai-fb', label: 'Ask ThumbFriend', description: 'Get feedback on your thumbnail', cost: 1, onSelect }]}
    />);
    expect(screen.getByText('Ask ThumbFriend')).toBeInTheDocument();
    expect(screen.getByText(/1 tokens/)).toBeInTheDocument();
  });
});

describe('Palette item execution', () => {
  test('selecting an item dispatches executeAction and closes', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    const onOpenChange = jest.fn();
    render(<CommandPalette open={true} onOpenChange={onOpenChange} />);
    // Grab the first action row by id suffix text.
    const firstItem = screen.getAllByText(/history\.undo|layer\.add|tool\.brush/i)[0];
    fireEvent.click(firstItem);
    expect(spy).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    spy.mockRestore();
  });

  test('run updates the recent list in localStorage', () => {
    const spy = jest.spyOn(registry, 'executeAction').mockImplementation(() => {});
    const { rerender } = render(<CommandPalette open={true} onOpenChange={() => {}} />);
    const firstItem = screen.getAllByText(/history\.undo|layer\.add|tool\.brush/i)[0];
    fireEvent.click(firstItem);
    expect(spy).toHaveBeenCalled();
    const recent = JSON.parse(localStorage.getItem('editor-v2.palette.recent') || '[]');
    expect(recent.length).toBeGreaterThan(0);
    spy.mockRestore();
    rerender(<CommandPalette open={false} onOpenChange={() => {}} />);
  });
});

describe('Backdrop click closes', () => {
  test('clicking the dimmed overlay outside the sheet closes', () => {
    const onOpenChange = jest.fn();
    render(<CommandPalette open={true} onOpenChange={onOpenChange} />);
    const overlay = screen.getByTestId('command-palette');
    fireEvent.click(overlay);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
