// src/editor-v2/ui/keyboardShortcuts.js
// -----------------------------------------------------------------------------
// Purpose:  Phase 4.6.g keyboard shortcut registry. One canonical map of
//           every shortcut → action the editor supports, plus a
//           registerShortcuts() helper that installs them globally via
//           tinykeys (research-cited as the correct KeyboardEvent.key
//           library).
//
//           EditorV2 calls registerShortcuts() once on mount with a
//           handler map; the returned function removes the listeners.
//
// Exports:  SHORTCUTS, registerShortcuts, shortcutList
// Depends:  tinykeys
// -----------------------------------------------------------------------------

import { tinykeys } from 'tinykeys';

/**
 * tinykeys accepts multi-key chords joined by "+", and the "$mod"
 * token maps to Cmd on mac and Ctrl on win/linux.
 *
 * Each entry: handlerKey → tinykeys binding string.
 */
export const SHORTCUTS = Object.freeze({
  // Tools
  'tool.move':          'v',
  'tool.brush':         'b',
  'tool.eraser':        'e',
  'tool.text':          't',
  'tool.magicWand':     'w',
  'tool.lasso':         'l',
  'tool.samSelect':     's',
  'tool.crop':          'c',
  'tool.hand':          'h',
  'tool.zoom':          'z',
  'shape.rect':         'r',
  'shape.ellipse':      'o',

  // Editing
  'history.undo':       '$mod+z',
  'history.redo':       '$mod+Shift+z',
  'save.force':         '$mod+s',
  'export.open':        '$mod+e',
  'selection.deselect': '$mod+d',
  'selection.all':      '$mod+a',
  'layer.group':        '$mod+g',
  'layer.ungroup':      '$mod+Shift+g',
  'layer.delete':       'Delete',
  'layer.deleteBack':   'Backspace',
  'editor.escape':      'Escape',

  // Command palette
  'palette.open':       '$mod+k',
});

/**
 * Register every shortcut on the given target (default: window).
 * `handlers` is { [handlerKey]: (event) => void }. Unknown keys are
 * silently ignored so EditorV2 can wire only what it cares about.
 *
 * @param {Record<string, (e: KeyboardEvent) => void>} handlers
 * @param {Window|HTMLElement} [target=window]
 * @returns {() => void} unsubscribe
 */
export function registerShortcuts(handlers, target = typeof window !== 'undefined' ? window : null) {
  if (!target) return () => {};
  const bindings = {};
  for (const [handlerKey, binding] of Object.entries(SHORTCUTS)) {
    const fn = handlers?.[handlerKey];
    if (typeof fn !== 'function') continue;
    // If two entries share the same binding (Delete / Backspace for
    // layer.delete*), merge them into one listener that calls both.
    if (bindings[binding]) {
      const prev = bindings[binding];
      bindings[binding] = (e) => { prev(e); fn(e); };
    } else {
      bindings[binding] = fn;
    }
  }
  return tinykeys(target, bindings);
}

/**
 * Flatten the shortcut map into a presentation-friendly list for
 * the 4.6.f "keyboard reference" modal.
 */
export function shortcutList() {
  return Object.entries(SHORTCUTS).map(([handlerKey, binding]) => ({
    id: handlerKey,
    binding,
    // Human-readable form: Cmd+Z on mac, Ctrl+Z on win.
    display: _displayBinding(binding),
  }));
}

function _displayBinding(b) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return b
    .replace(/\$mod/g, isMac ? '⌘' : 'Ctrl')
    .replace(/Shift/g, '⇧')
    .replace(/\+/g, isMac ? '' : '+')
    .trim();
}
