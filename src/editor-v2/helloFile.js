// src/editor-v2/helloFile.js
// -----------------------------------------------------------------------------
// Purpose:  Build the "Your first thumbnail" starter project. Created
//           on editor mount when the store is empty, it demonstrates
//           every core feature with inline hints instead of a tour.
// Exports:  buildHelloFile, shouldMountHelloFile
// Depends:  nothing — returns plain layer descriptors the store consumes
// -----------------------------------------------------------------------------

/**
 * @returns {Array} layer descriptors ready for addLayer()
 */
export function buildHelloFile() {
  return [
    // Accent rectangle behind the title — demonstrates shapes + blend.
    {
      type: 'shape', name: 'Accent bar',
      x: 640, y: 420, width: 640, height: 80,
      opacity: 0.9, blendMode: 'multiply',
      shapeData: { shapeType: 'rect', fill: '#f97316', cornerRadius: 8 },
    },
    // Star sticker top-right — demonstrates shape variety.
    {
      type: 'shape', name: 'Hero sticker',
      x: 1100, y: 140, width: 140, height: 140,
      shapeData: { shapeType: 'star', fill: '#faecd0' },
    },
    // Title headline — demonstrates text + effects.
    {
      type: 'text', name: 'Headline',
      x: 640, y: 320, width: 960, height: 180,
      textData: {
        content: '← Double-click to edit this headline',
        fontFamily: 'Inter, sans-serif',
        fontSize: 92, fontWeight: '900',
        fill: '#faecd0',
        align: 'center', lineHeight: 1.1, letterSpacing: -1,
        multiStroke: [
          { color: '#000000', width: 6, opacity: 1, position: 'outside' },
        ],
        shadow: { enabled: true, color: '#000', blur: 14, offsetX: 6, offsetY: 6, opacity: 0.8 },
      },
      effects: [
        { id: 'fx-1', type: 'dropShadow',
          enabled: true, params: { color: '#000', blur: 18, offsetX: 8, offsetY: 8, opacity: 0.85 } },
      ],
    },
    // Supporting hint text — demonstrates per-char styling potential.
    {
      type: 'text', name: 'Subtitle hint',
      x: 640, y: 520, width: 800, height: 60,
      textData: {
        content: "Try the tools on the left — ⌘K opens everything else.",
        fontFamily: 'Inter, sans-serif',
        fontSize: 26, fontWeight: '500',
        fill: 'rgba(250, 236, 208, 0.7)',
        align: 'center', lineHeight: 1.2, letterSpacing: 0,
      },
    },
  ];
}

/**
 * Decide whether to drop the hello file on mount. Rule: only when the
 * store arrives empty AND the URL doesn't carry a ?project= id (which
 * indicates the user is loading an existing project).
 *
 * @param {{ layers:any[], projectId:string|null }} state
 */
export function shouldMountHelloFile(state) {
  if (!state) return false;
  if (state.projectId) return false;
  return !Array.isArray(state.layers) || state.layers.length === 0;
}
