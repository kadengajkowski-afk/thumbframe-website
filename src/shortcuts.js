/**
 * shortcuts.js — ThumbFrame keyboard shortcut definitions.
 *
 * Single source of truth for:
 *  - SHORTCUT_GROUPS : grouped list used by the reference modal
 *  - TOOL_SHORTCUT_MAP : toolKey → shortcut letter (for toolbar tooltips)
 */

// ── Reference modal groups ────────────────────────────────────────────────────
export const SHORTCUT_GROUPS = [
  {
    label: 'Tools',
    shortcuts: [
      { keys: 'V',     description: 'Move / Select' },
      { keys: 'M',     description: 'Marquee select' },
      { keys: 'L',     description: 'Lasso mask' },
      { keys: 'W',     description: 'Smart cutout' },
      { keys: 'C',     description: 'Crop' },
      { keys: 'B',     description: 'Brush' },
      { keys: 'E',     description: 'Eraser / Draw' },
      { keys: 'T',     description: 'Text' },
      { keys: 'I',     description: 'Eyedropper' },
      { keys: 'G',     description: 'AI Background' },
      { keys: 'S',     description: 'Smart cutout (clone)' },
      { keys: 'O',     description: 'Effects (dodge/burn)' },
      { keys: 'Z',     description: 'Zoom' },
      { keys: 'H',     description: 'Hand (pan)' },
    ],
  },
  {
    label: 'Canvas',
    shortcuts: [
      { keys: 'Space + Drag', description: 'Pan canvas' },
      { keys: 'Ctrl + Scroll', description: 'Zoom in/out at cursor' },
      { keys: 'Ctrl + 0',      description: 'Fit to screen' },
      { keys: 'Ctrl + +',      description: 'Zoom in' },
      { keys: 'Ctrl + −',      description: 'Zoom out' },
    ],
  },
  {
    label: 'Layers',
    shortcuts: [
      { keys: 'Ctrl + J',       description: 'Duplicate layer' },
      { keys: 'Ctrl + G',       description: 'Group layers' },
      { keys: 'Ctrl + E',       description: 'Export' },
      { keys: 'Ctrl + Shift + E', description: 'Export (all sizes)' },
      { keys: 'Delete',          description: 'Delete selected layer' },
      { keys: '↑ ↓ ← →',         description: 'Nudge layer 1 px' },
      { keys: 'Shift + Arrow',   description: 'Nudge layer 10 px' },
      { keys: '1 – 9',           description: 'Set opacity 10 % – 90 %' },
      { keys: '0',               description: 'Set opacity 100 %' },
    ],
  },
  {
    label: 'Edit',
    shortcuts: [
      { keys: 'Ctrl + Z',         description: 'Undo' },
      { keys: 'Ctrl + Shift + Z', description: 'Redo' },
      { keys: 'Ctrl + C',         description: 'Copy layer' },
      { keys: 'Ctrl + V',         description: 'Paste layer' },
      { keys: 'Ctrl + D',         description: 'Deselect' },
      { keys: 'Ctrl + A',         description: 'Select all layers' },
      { keys: 'Ctrl + T',         description: 'Free transform' },
      { keys: 'Ctrl + Shift + I', description: 'Invert selection' },
      { keys: 'Escape',           description: 'Cancel / Deselect' },
    ],
  },
  {
    label: 'Brush',
    shortcuts: [
      { keys: '[',         description: 'Decrease brush size' },
      { keys: ']',         description: 'Increase brush size' },
      { keys: 'Shift + [', description: 'Decrease brush hardness' },
      { keys: 'Shift + ]', description: 'Increase brush hardness' },
    ],
  },
  {
    label: 'Colors',
    shortcuts: [
      { keys: 'D', description: 'Reset to default colors' },
      { keys: 'X', description: 'Swap foreground / background' },
      { keys: 'Q', description: 'Quick mask toggle' },
    ],
  },
  {
    label: 'File',
    shortcuts: [
      { keys: 'Ctrl + S', description: 'Save' },
    ],
  },
  {
    label: 'View',
    shortcuts: [
      { keys: '?  or  Ctrl + /', description: 'Show keyboard shortcuts' },
      { keys: 'Shift + ;',        description: 'Toggle smart snap' },
    ],
  },
];

// ── Tool → shortcut key mapping (used for toolbar tooltips) ──────────────────
export const TOOL_SHORTCUT_MAP = {
  select:     'V',
  move:       'H',
  crop:       'C',
  zoom:       'Z',
  text:       'T',
  brush:      'B',
  freehand:   'E',
  lasso:      'L',
  segment:    'W',
  bggen:      'G',
  effects:    'O',
  removebg:   'E',
};
