// src/editor-v2/ui/copy.js
// -----------------------------------------------------------------------------
// Purpose:  Single source for every user-visible UI string in the
//           Phase 4.6 editor. Voice compliance is audited here so
//           voice drift can't hide in component files. When a
//           component wants to render a string, it imports from
//           COPY — never inlines.
//
// Exports:  COPY (grouped by component)
//
// Voice rules (from PHASE_4_6_QUEUE.md):
//   • Direct address: "you" — never "we"
//   • Technical but warm
//   • Short, action-oriented
//   • Playful only where it fits naturally ("Erase the deck", "Ship it")
//   • Never lies, never apologizes, never infantilizes
//
// Banned words (asserted in phase-4-6-h.test.js):
//   • "Oops!" / "Sorry!" / "Welcome back, user" / "AI-powered"
// -----------------------------------------------------------------------------

export const COPY = Object.freeze({
  cockpit: {
    layersHeader:   'Layers',
    collapseLayers: 'Collapse layers',
    expandLayers:   'Expand layers',
    crampedBanner:
      "ThumbFrame works best at 1280px and up. It'll work here but some panels are tight.",
  },

  emptyState: {
    headline:        'Upload to set sail',
    secondary:       'or start blank →',
    uploadLabel:     'Choose an image',
    dragHint:        'Drop anywhere',
  },

  topBar: {
    projectPlaceholder: 'Untitled',
    savingText:         'Logging…',
    savedText:          'Logged',
    shipItLabel:        'Ship it',
    themeToDark:        'Switch to space',
    themeToLight:       'Switch to ocean',
    openSettings:       'Settings',
    // The "Ship it" dropdown rows:
    shipAsPng:          'Ship it as PNG',
    shipAsJpeg:         'Ship it as JPEG',
    shipForYoutube:     'Ship it for YouTube',
    shipIn4K:           'Ship it in 4K',
    proLockHint:        'Pro unlocks 4K exports',
  },

  settings: {
    theme:        'Theme',
    soundEffects: 'Sound effects',
    shortcuts:    'Keyboard shortcuts',
    account:      'Account settings',
    signOut:      'Sign out',
  },

  layerPanel: {
    emptyPostTransition: 'Drop something here, or add from the toolbar.',
    renameHint:          'Double-click to rename',
  },

  commandPalette: {
    placeholder:         'Search actions, layers, templates…',
    emptyResult:         'Nothing matches. Try fewer letters.',
    groupActions:        'Actions',
    groupTemplates:      'Templates',
    groupLayers:         'Layers',
    groupNavigate:       'Navigate',
    groupTools:          'Tools',
    groupSettings:       'Settings',
    groupRecent:         'Recent',
  },

  tools: {
    // Mandatory strings from the brief. Format: "Label [Shortcut]"
    brush:        'Brush [B]',
    eraser:       'Erase the deck [E]',
    text:         'Text [T]',
    magicWand:    'Magic wand [W]',
    crop:         'Crop [C]',
    hand:         'Hand [H]',
    zoom:         'Zoom [Z]',
    samSelect:    'Click to select [S]',

    // Plain labels — no forced metaphor.
    move:         'Move [V]',
    lasso:        'Lasso [L]',
    rectangle:    'Rectangle [R]',
    ellipse:      'Ellipse [O]',
    polygon:      'Polygon',
    star:         'Star',
    arrow:        'Arrow',
    line:         'Line',
    speechBubble: 'Speech bubble',
    dodge:        'Dodge [O]',
    burn:         'Burn',
    sponge:       'Sponge',
    blur:         'Blur',
    sharpen:      'Sharpen',
    smudge:       'Smudge',
    clone:        'Clone',
    spotHeal:     'Spot heal',
    lightPainting:'Light painting',

    groupHeaders: {
      selection:  'Selection',
      shapes:     'Shapes',
      paint:      'Paint',
      text:       'Text',
      crop:       'Crop',
      viewport:   'Viewport',
    },
  },

  contextualPanel: {
    emptyTitle:          'Canvas',
    emptySubtitle:       "Nothing selected — here's the canvas.",
    imageSubtitle:       'Tune this image.',
    textSubtitle:        'Type, weight, colour — the whole typography stack.',
    shapeSubtitle:       'Shape, fill, stroke, gradient.',
    adjustmentSubtitle:  'Tweak this adjustment.',
    multiSubtitle:       'Align and distribute the selection.',
    groupSubtitle:       'Group — nested layers live here.',
    advanced:            'Advanced',
  },

  keyboardReference: {
    title:     'Keyboard shortcuts',
    sections:  {
      tools:    'Tools',
      editing:  'Editing',
      navigate: 'Navigate',
      shipIt:   'Ship it',
    },
  },

  // Error / recovery copy — honest, not apologetic. No "Oops!".
  errors: {
    mountFailed:  'Something prevented the editor from starting. Refresh to try again.',
    uploadFailed: "That file didn't load. Try a PNG, JPEG, or WebP under 50MB.",
    saveFailed:   "Couldn't log that change. The next save will try again.",
  },
});

export default COPY;
