// src/editor-v2/__tests__/phase-4-6-g.test.js
// -----------------------------------------------------------------------------
// Phase 4.6.g — command palette + keyboard shortcuts.
//
// Verifies:
//   1. SHORTCUTS map covers every brief-mandated binding
//   2. registerShortcuts wires a single handler, triggering it via
//      a synthetic keydown event
//   3. Unknown handler keys are silently ignored (lets EditorV2 wire
//      subsets)
//   4. Returned unsubscribe removes listeners
//   5. shortcutList() renders a display-friendly binding with ⌘ on
//      mac / Ctrl+ on non-mac
//   6. Existing command palette still opens with Cmd+K (palette.open
//      binding is live)
// -----------------------------------------------------------------------------

import { SHORTCUTS, registerShortcuts, shortcutList } from '../ui/keyboardShortcuts';

describe('SHORTCUTS map', () => {
  test('every brief-mandated binding exists', () => {
    // Tools
    expect(SHORTCUTS['tool.move']).toBe('v');
    expect(SHORTCUTS['tool.brush']).toBe('b');
    expect(SHORTCUTS['tool.eraser']).toBe('e');
    expect(SHORTCUTS['tool.text']).toBe('t');
    expect(SHORTCUTS['tool.magicWand']).toBe('w');
    expect(SHORTCUTS['tool.lasso']).toBe('l');
    expect(SHORTCUTS['tool.samSelect']).toBe('s');
    expect(SHORTCUTS['tool.crop']).toBe('c');
    expect(SHORTCUTS['tool.hand']).toBe('h');
    expect(SHORTCUTS['tool.zoom']).toBe('z');
    expect(SHORTCUTS['shape.rect']).toBe('r');
    expect(SHORTCUTS['shape.ellipse']).toBe('o');

    // Editing — $mod maps to Cmd/Ctrl via tinykeys.
    expect(SHORTCUTS['history.undo']).toBe('$mod+z');
    expect(SHORTCUTS['history.redo']).toBe('$mod+Shift+z');
    expect(SHORTCUTS['save.force']).toBe('$mod+s');
    expect(SHORTCUTS['export.open']).toBe('$mod+e');
    expect(SHORTCUTS['selection.deselect']).toBe('$mod+d');
    expect(SHORTCUTS['selection.all']).toBe('$mod+a');
    expect(SHORTCUTS['layer.group']).toBe('$mod+g');
    expect(SHORTCUTS['layer.ungroup']).toBe('$mod+Shift+g');
    expect(SHORTCUTS['layer.delete']).toBe('Delete');
    expect(SHORTCUTS['layer.deleteBack']).toBe('Backspace');
    expect(SHORTCUTS['editor.escape']).toBe('Escape');
    expect(SHORTCUTS['palette.open']).toBe('$mod+k');
  });
});

describe('registerShortcuts', () => {
  test('fires the matching handler on keydown', () => {
    const onBrush = jest.fn();
    const unsub   = registerShortcuts({ 'tool.brush': onBrush });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    expect(onBrush).toHaveBeenCalledTimes(1);
    unsub();
  });

  test('unsubscribe removes the listener', () => {
    const onBrush = jest.fn();
    const unsub   = registerShortcuts({ 'tool.brush': onBrush });
    unsub();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    expect(onBrush).toHaveBeenCalledTimes(0);
  });

  test('unknown handler keys are ignored without throwing', () => {
    expect(() => registerShortcuts({ 'nope.not.real': () => {} })).not.toThrow();
  });

  test('$mod+Z is a distinct binding from plain z', () => {
    const onUndo  = jest.fn();
    const onZoom  = jest.fn();
    const unsub   = registerShortcuts({
      'history.undo': onUndo,
      'tool.zoom':    onZoom,
    });
    // jsdom's navigator.platform is '' so tinykeys resolves $mod
    // to Control. Passing both ctrl+meta would be rejected by
    // tinykeys' "no extra modifiers" rule — pick ctrlKey only.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    expect(onUndo).toHaveBeenCalled();
    expect(onZoom).toHaveBeenCalled();
    unsub();
  });

  test('Delete + Backspace both fire layer.delete / layer.deleteBack handlers', () => {
    const onDelete     = jest.fn();
    const onDeleteBack = jest.fn();
    const unsub = registerShortcuts({
      'layer.delete':     onDelete,
      'layer.deleteBack': onDeleteBack,
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDeleteBack).toHaveBeenCalledTimes(1);
    unsub();
  });
});

describe('shortcutList()', () => {
  test('renders display strings with ⌘ on mac / Ctrl+ on non-mac', () => {
    const realPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });
    const macList = shortcutList();
    const undoMac = macList.find(s => s.id === 'history.undo');
    expect(undoMac.display).toContain('⌘');

    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
    const winList = shortcutList();
    const undoWin = winList.find(s => s.id === 'history.undo');
    expect(undoWin.display).toContain('Ctrl');

    if (realPlatform) Object.defineProperty(navigator, 'platform', realPlatform);
  });

  test('every entry carries id / binding / display', () => {
    const list = shortcutList();
    expect(list.length).toBeGreaterThan(10);
    for (const s of list) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.binding).toBe('string');
      expect(typeof s.display).toBe('string');
    }
  });
});

describe('Cmd+K palette.open binding', () => {
  test('registers through the shortcut registry', () => {
    const onOpen = jest.fn();
    const unsub  = registerShortcuts({ 'palette.open': onOpen });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(onOpen).toHaveBeenCalled();
    unsub();
  });
});
