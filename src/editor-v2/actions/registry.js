// src/editor-v2/actions/registry.js
// -----------------------------------------------------------------------------
// Purpose:  Central registry for every user-facing editor action. A single
//           handler with a stable id makes three Phase-4+ features trivial:
//             • command palette (searches by label)
//             • keyboard shortcuts (lookup by shortcut string)
//             • analytics (every handler call is one place to instrument)
// Exports:  register, executeAction, getAction, listActions,
//           findByShortcut, registerFoundationActions
// Depends:  ../history/History, ../store/Store (indirectly through the
//           handlers registered by registerFoundationActions)
//
// The registry is module-private state. There is intentionally no global
// instance exposed on window; consumers import the exported functions.
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} Action
 * @property {string}   id          - Stable, namespaced: 'layer.add', 'history.undo'
 * @property {string}   label       - Human-readable, for palette / menus
 * @property {string}   category    - 'layer'|'history'|'project'|'selection'|'view'|...
 * @property {string|null} shortcut - Keyboard shortcut like 'Cmd+Z', 'Delete', or null
 * @property {(...args: any[]) => any} handler
 * @property {string}   [description]
 */

import { BrushTool }         from '../tools/BrushTool.js';
import { EraserTool }        from '../tools/EraserTool.js';
import { StrokeSession }     from '../tools/StrokeSession.js';
import { BlurTool, SharpenTool } from '../tools/ConvolutionTools.js';
import { DodgeTool, BurnTool, SpongeTool } from '../tools/ToneTools.js';
import { SmudgeTool, CloneStampTool, SpotHealTool } from '../tools/SamplingTools.js';
import { LightPaintingTool } from '../tools/LightPaintingTool.js';

/**
 * Central tool registry. The registry + StrokeSession look up tools by id
 * through this map — never via eager string-switch. New tools land here
 * and in Store.toolParams simultaneously.
 */
const _tools = {
  brush:         BrushTool,
  eraser:        EraserTool,
  blur:          BlurTool,
  sharpen:       SharpenTool,
  dodge:         DodgeTool,
  burn:          BurnTool,
  sponge:        SpongeTool,
  smudge:        SmudgeTool,
  cloneStamp:    CloneStampTool,
  spotHeal:      SpotHealTool,
  lightPainting: LightPaintingTool,
};

/** @type {Map<string, Action>} */
const _actions = new Map();

// ── Paint-session state (Phase 1.b) ────────────────────────────────────────
// One stroke at a time. The session is created by paint.beginStroke and
// cleared by paint.endStroke. It lives at module scope so the three
// handlers (begin / addPoint / endStroke) can share it without passing
// a handle through every call. Tests reset it via __resetRegistry.
/** @type {import('../tools/StrokeSession.js').StrokeSession | null} */
let _activeSession    = null;
let _activeSessionCtx = /** @type {CanvasRenderingContext2D | null} */ (null);
let _activeSessionMeta = /** @type {{ layerId:string, target:'layer'|'mask', tool:string } | null} */ (null);

/**
 * Register a single action. Throws on duplicate id — duplicates are
 * almost always a bug, and silent overwrites cause deeply confusing
 * behaviour when two registrations differ in subtle ways.
 *
 * @param {Action} action
 */
export function register(action) {
  if (!action || !action.id) throw new Error('[actions] action.id is required');
  if (typeof action.handler !== 'function') throw new Error('[actions] action.handler must be a function');
  if (_actions.has(action.id)) {
    throw new Error(`[actions] duplicate action id: ${action.id}`);
  }
  _actions.set(action.id, action);
}

/**
 * Run a registered action by id. Unknown ids log a warning and return
 * undefined rather than throwing — a wrong shortcut shouldn't crash the
 * editor.
 *
 * @param {string} id
 * @param {...any} args
 */
export function executeAction(id, ...args) {
  const action = _actions.get(id);
  if (!action) {
    console.warn('[actions] unknown action:', id);
    return undefined;
  }
  return action.handler(...args);
}

/** @param {string} id */
export function getAction(id) {
  return _actions.get(id) || null;
}

/** @param {string} [category] */
export function listActions(category) {
  const all = [..._actions.values()];
  return category ? all.filter(a => a.category === category) : all;
}

/**
 * Find the first action whose shortcut matches. Shortcuts are compared
 * case-insensitively, with Cmd/Ctrl normalised to 'Mod' so callers can
 * pass platform-neutral strings.
 *
 * @param {string} shortcut
 */
export function findByShortcut(shortcut) {
  const needle = normaliseShortcut(shortcut);
  for (const a of _actions.values()) {
    if (a.shortcut && normaliseShortcut(a.shortcut) === needle) return a;
  }
  return null;
}

/** Drop every registered action. Test helper. */
export function __resetRegistry() {
  _actions.clear();
  _activeSession     = null;
  _activeSessionCtx  = null;
  _activeSessionMeta = null;
}

// ── Foundation actions ──────────────────────────────────────────────────────
// The Phase 0 set: enough to exercise the store + history + save without
// needing UI. Later phases will register tools, adjustments, AI ops, etc.

/**
 * Register the core set of actions. Call once during editor boot with a
 * store + history instance so the handlers can route through them.
 *
 * @param {{
 *   store: import('zustand').StoreApi<any>,
 *   history: import('../history/History.js').History,
 *   paintCanvases?: import('../engine/PaintCanvases.js').PaintCanvases,
 * }} deps
 */
export function registerFoundationActions({ store, history, paintCanvases }) {
  // ── Layer
  register({
    id: 'layer.add',
    label: 'Add layer',
    category: 'layer',
    shortcut: null,
    description: 'Append a new layer to the current document.',
    handler: async (overrides) => {
      const id = store.getState().addLayer(overrides);
      await history.snapshot('Add layer');
      return id;
    },
  });

  register({
    id: 'layer.remove',
    label: 'Delete layer',
    category: 'layer',
    shortcut: 'Delete',
    description: 'Remove a layer. Post-mutation snapshot captured for redo.',
    handler: async (id) => {
      store.getState().removeLayer(id);
      await history.snapshot('Delete layer');
    },
  });

  register({
    id: 'layer.update',
    label: 'Update layer',
    category: 'layer',
    shortcut: null,
    description: 'Patch fields on a layer. Does not snapshot — call only for transient edits.',
    handler: (id, changes) => {
      store.getState().updateLayer(id, changes);
    },
  });

  register({
    id: 'layer.move',
    label: 'Reorder layer',
    category: 'layer',
    shortcut: null,
    handler: async (id, newIndex) => {
      store.getState().moveLayer(id, newIndex);
      await history.snapshot('Reorder layer');
    },
  });

  // ── Selection
  register({
    id: 'selection.set',
    label: 'Set selection',
    category: 'selection',
    shortcut: null,
    handler: (ids) => { store.getState().setSelection(ids); },
  });

  register({
    id: 'selection.clear',
    label: 'Clear selection',
    category: 'selection',
    shortcut: 'Escape',
    handler: () => { store.getState().clearSelection(); },
  });

  // ── History
  register({
    id: 'history.undo',
    label: 'Undo',
    category: 'history',
    shortcut: 'Mod+Z',
    handler: () => history.undo(),
  });

  register({
    id: 'history.redo',
    label: 'Redo',
    category: 'history',
    shortcut: 'Mod+Shift+Z',
    handler: () => history.redo(),
  });

  register({
    id: 'history.snapshot',
    label: 'Take snapshot',
    category: 'history',
    shortcut: null,
    handler: (label) => history.snapshot(label || ''),
  });

  // ── Project
  register({
    id: 'project.rename',
    label: 'Rename project',
    category: 'project',
    shortcut: null,
    handler: (name) => { store.getState().setProjectName(name); },
  });

  // ── Shapes (Phase 1.a) ─────────────────────────────────────────────────
  register({
    id: 'shape.create',
    label: 'Add shape',
    category: 'shape',
    shortcut: null,
    description:
      'Add a shape layer. overrides.shapeData.shapeType selects the kind '
      + '(rect, circle, ellipse, polygon, star, arrow, line, speechBubble).',
    handler: async (overrides) => {
      const id = store.getState().addLayer({
        type: 'shape',
        name: overrides?.name || defaultShapeName(overrides?.shapeData?.shapeType),
        width:  overrides?.width  ?? 240,
        height: overrides?.height ?? 160,
        ...overrides,
        shapeData: {
          shapeType: 'rect',
          fill: '#f97316',
          stroke: null,
          strokeWidth: 0,
          cornerRadius: 0,
          ...overrides?.shapeData,
        },
      });
      await history.snapshot(`Add ${defaultShapeName(overrides?.shapeData?.shapeType).toLowerCase()}`);
      return id;
    },
  });

  // ── Text (Phase 1.a — basic only; stroke/glow/shadow/warp land in Phase 2)
  register({
    id: 'text.create',
    label: 'Add text',
    category: 'text',
    shortcut: null,
    handler: async (overrides) => {
      const id = store.getState().addLayer({
        type: 'text',
        name: overrides?.name || 'Text',
        width:  overrides?.width  ?? 640,
        height: overrides?.height ?? 160,
        ...overrides,
        textData: {
          content:       'Your text',
          fontFamily:    'Inter, sans-serif',
          fontSize:      96,
          fontWeight:    '800',
          fill:          '#faecd0',
          align:         'center',
          lineHeight:    1.1,
          letterSpacing: 0,
          stroke: { enabled: false, color: '#000000', width: 0 },
          shadow: { enabled: false, color: '#000000', blur: 0, offsetX: 0, offsetY: 0, opacity: 0 },
          glow:   { enabled: false, color: '#ffffff', blur: 0, strength: 0, opacity: 0 },
          ...overrides?.textData,
        },
      });
      await history.snapshot('Add text');
      return id;
    },
  });

  // ── Blend mode (Phase 1.a) ─────────────────────────────────────────────
  register({
    id: 'layer.setBlendMode',
    label: 'Set blend mode',
    category: 'layer',
    shortcut: null,
    description:
      'Set layer.blendMode. Accepts any id from BLEND_MODE_IDS — HSL '
      + 'modes resolve to normal until Phase 1.d ships the HSL shaders.',
    handler: async (id, blendMode) => {
      store.getState().updateLayer(id, { blendMode });
      await history.snapshot(`Blend mode: ${blendMode}`);
    },
  });

  register({
    id: 'layer.setOpacity',
    label: 'Set opacity',
    category: 'layer',
    shortcut: null,
    handler: async (id, opacity) => {
      // No snapshot — slider drags are continuous; the caller is expected
      // to snapshot at drag start if they want undo granularity.
      const clamped = Math.max(0, Math.min(1, Number(opacity) || 0));
      store.getState().updateLayer(id, { opacity: clamped });
    },
  });

  register({
    id: 'layer.setVisible',
    label: 'Toggle visibility',
    category: 'layer',
    shortcut: null,
    handler: (id, visible) => {
      store.getState().updateLayer(id, { visible: !!visible });
    },
  });

  register({
    id: 'layer.setLocked',
    label: 'Toggle lock',
    category: 'layer',
    shortcut: null,
    handler: (id, locked) => {
      store.getState().updateLayer(id, { locked: !!locked });
    },
  });

  // ── Layer group / ungroup (Phase 1.a — data model only) ───────────────
  register({
    id: 'layer.group.create',
    label: 'Group layers',
    category: 'layer',
    shortcut: 'Mod+G',
    description:
      'Create a group layer that owns the given layer ids. Children '
      + 'stay in the flat layers[] array; the group tracks them via '
      + 'groupData.childIds.',
    handler: async (childIds, name) => {
      if (!Array.isArray(childIds) || childIds.length === 0) return null;
      const s = store.getState();
      // Derive the group position from the bounding box of its children so
      // the group's own x/y/width/height are sensible defaults.
      const children = childIds
        .map(id => s.layers.find(l => l.id === id))
        .filter(Boolean);
      const bbox = _bboxFor(children);
      const groupId = s.addLayer({
        type: 'group',
        name: name || 'Group',
        x: bbox.cx, y: bbox.cy,
        width: bbox.w, height: bbox.h,
        groupData: { childIds: childIds.slice(), collapsed: false },
      });
      await history.snapshot(`Group ${children.length} layers`);
      return groupId;
    },
  });

  register({
    id: 'layer.group.ungroup',
    label: 'Ungroup',
    category: 'layer',
    shortcut: 'Mod+Shift+G',
    handler: async (groupId) => {
      const s = store.getState();
      const group = s.layers.find(l => l.id === groupId);
      if (!group || group.type !== 'group') return;
      // Just remove the group layer — its children were always in the flat
      // layers[] array alongside it and will surface at the top level
      // again automatically on the next sync.
      s.removeLayer(groupId);
      await history.snapshot('Ungroup');
    },
  });

  // ── Adjustment layer (Phase 1.a — data model stub; rendering lands 1.e)
  register({
    id: 'layer.adjustment.add',
    label: 'Add adjustment layer',
    category: 'layer',
    shortcut: null,
    handler: async (kind, params) => {
      const id = store.getState().addLayer({
        type: 'adjustment',
        name: _adjustmentName(kind),
        adjustmentData: {
          kind: kind || 'brightness',
          params: params || {},
        },
      });
      await history.snapshot(`Add ${_adjustmentName(kind).toLowerCase()} adjustment`);
      return id;
    },
  });

  // ── Effects data-model actions (rendering pipeline lands in Phase 1.d)
  register({
    id: 'layer.effects.add',
    label: 'Add effect',
    category: 'effects',
    shortcut: null,
    description:
      'Append a layer effect (stroke / outerGlow / dropShadow / etc.). '
      + 'Phase 1.a wires the data model only — visual rendering of '
      + 'these effects ships in Phase 1.d.',
    handler: async (layerId, effect) => {
      const s = store.getState();
      const layer = s.layers.find(l => l.id === layerId);
      if (!layer) return;
      const type = effect?.type || 'dropShadow';
      const effects = [
        ...(layer.effects || []),
        {
          id: _newId(),
          type,
          enabled: effect?.enabled !== false,
          params: effect?.params || {},
        },
      ];
      s.updateLayer(layerId, { effects });
      await history.snapshot(`Add ${type} effect`);
    },
  });

  register({
    id: 'layer.effects.update',
    label: 'Update effect',
    category: 'effects',
    shortcut: null,
    handler: (layerId, effectId, changes) => {
      const s = store.getState();
      const layer = s.layers.find(l => l.id === layerId);
      if (!layer) return;
      const effects = (layer.effects || []).map(fx =>
        fx.id === effectId ? { ...fx, ...changes, params: { ...(fx.params || {}), ...(changes?.params || {}) } } : fx,
      );
      s.updateLayer(layerId, { effects });
    },
  });

  register({
    id: 'layer.effects.remove',
    label: 'Remove effect',
    category: 'effects',
    shortcut: null,
    handler: async (layerId, effectId) => {
      const s = store.getState();
      const layer = s.layers.find(l => l.id === layerId);
      if (!layer) return;
      const effects = (layer.effects || []).filter(fx => fx.id !== effectId);
      s.updateLayer(layerId, { effects });
      await history.snapshot('Remove effect');
    },
  });

  register({
    id: 'layer.effects.toggle',
    label: 'Toggle effect',
    category: 'effects',
    shortcut: null,
    handler: (layerId, effectId) => {
      const s = store.getState();
      const layer = s.layers.find(l => l.id === layerId);
      if (!layer) return;
      const effects = (layer.effects || []).map(fx =>
        fx.id === effectId ? { ...fx, enabled: !fx.enabled } : fx,
      );
      s.updateLayer(layerId, { effects });
    },
  });

  // ── Mask data-model actions (compositing lands in Phase 1.b) ──────────
  register({
    id: 'layer.mask.add',
    label: 'Add mask',
    category: 'mask',
    shortcut: null,
    handler: async (layerId, kind) => {
      store.getState().updateLayer(layerId, {
        mask: {
          kind: kind === 'vector' ? 'vector' : 'raster',
          dataRef: null,
          path: null,
          inverted: false,
        },
      });
      await history.snapshot('Add mask');
    },
  });

  register({
    id: 'layer.mask.remove',
    label: 'Remove mask',
    category: 'mask',
    shortcut: null,
    handler: async (layerId) => {
      store.getState().updateLayer(layerId, { mask: null });
      await history.snapshot('Remove mask');
    },
  });

  register({
    id: 'layer.mask.invert',
    label: 'Invert mask',
    category: 'mask',
    shortcut: null,
    handler: async (layerId) => {
      const s = store.getState();
      const layer = s.layers.find(l => l.id === layerId);
      if (!layer?.mask) return;
      s.updateLayer(layerId, { mask: { ...layer.mask, inverted: !layer.mask.inverted } });
      await history.snapshot('Invert mask');
    },
  });

  // ── Tool selection (Phase 1.b) ─────────────────────────────────────────
  register({
    id: 'tool.brush.select',
    label: 'Brush',
    category: 'tool',
    shortcut: 'B',
    description: 'Make the brush the active paint tool.',
    handler: () => { store.getState().setActiveTool('brush'); },
  });

  register({
    id: 'tool.eraser.select',
    label: 'Eraser',
    category: 'tool',
    shortcut: 'E',
    handler: () => { store.getState().setActiveTool('eraser'); },
  });

  // Phase 1.c — register a tool.<id>.select action for every non-brush,
  // non-eraser tool defined in _tools. Keeps the switch logic in one
  // place so Phase 4.b's toolbar can list(...) actions by category and
  // render icons + shortcuts without bespoke plumbing.
  for (const [toolId, tool] of Object.entries(_tools)) {
    if (toolId === 'brush' || toolId === 'eraser') continue;
    const actionId = `tool.${toolId}.select`;
    register({
      id: actionId,
      label: tool.label || toolId,
      category: 'tool',
      shortcut: tool.shortcut || null,
      handler: () => { store.getState().setActiveTool(toolId); },
    });
  }

  register({
    id: 'tool.params.update',
    label: 'Update tool params',
    category: 'tool',
    shortcut: null,
    description:
      'Merge a partial params patch into store.toolParams[toolId]. '
      + 'Non-snapshotting — callers are expected to snapshot manually '
      + 'if they want size/hardness adjustments in undo history.',
    handler: (toolId, patch) => {
      store.getState().updateToolParams(toolId, patch);
    },
  });

  // ── Paint stroke lifecycle (Phase 1.b) ─────────────────────────────────
  register({
    id: 'paint.beginStroke',
    label: 'Begin paint stroke',
    category: 'paint',
    shortcut: null,
    description:
      'Open a brush/eraser stroke session on the given layer + target '
      + '(layer|mask). Does not snapshot — the post-stroke snapshot is '
      + 'issued by paint.endStroke.',
    handler: async ({ layerId, target, x, y, pressure }) => {
      if (_activeSession) _endSessionNoSnapshot();
      if (!paintCanvases) {
        console.warn('[actions] paint.beginStroke: no paintCanvases injected; strokes are a no-op');
        return false;
      }
      const s = store.getState();
      const layer = s.layers.find(l => l.id === layerId);
      if (!layer) return false;
      const tgt = target === 'mask' ? 'mask' : 'layer';

      // Choose a tool object from the current activeTool. Lazy-require
      // so the registry file has no eager dependency on tool modules
      // (keeps existing Phase 1.a consumers unaffected when tools are
      // not used).
      const toolId = s.activeTool || 'brush';
      const tool   = _resolveTool(toolId);
      const params = s.toolParams?.[toolId] || {};

      const canvas = paintCanvases.getOrCreate(
        layerId,
        tgt,
        layer.width  || 1280,
        layer.height || 720,
      );
      let ctx = canvas.getContext('2d');
      if (!ctx) {
        // jsdom Canvas2D returns null for getContext in stock config.
        // Use a recording stub so the stroke lifecycle still proceeds;
        // stamp output in that environment is a no-op but the registry
        // flow, history snapshot, and paint-canvas routing all exercise
        // correctly. Real browsers hit the real 2D context above.
        ctx = _noopCtx();
      }

      _activeSession = new StrokeSession({
        ctx, tool, target: tgt, params,
      });
      _activeSessionCtx  = ctx;
      _activeSessionMeta = { layerId, target: tgt, tool: toolId };

      s.setStrokeActive(true);
      _activeSession.begin(
        Number.isFinite(x) ? x : 0,
        Number.isFinite(y) ? y : 0,
        Number.isFinite(pressure) ? pressure : 1,
      );
      return true;
    },
  });

  register({
    id: 'paint.addPoint',
    label: 'Paint point',
    category: 'paint',
    shortcut: null,
    handler: ({ x, y, pressure } = {}) => {
      if (!_activeSession) return false;
      _activeSession.addPoint(
        Number.isFinite(x) ? x : 0,
        Number.isFinite(y) ? y : 0,
        Number.isFinite(pressure) ? pressure : 1,
      );
      return true;
    },
  });

  register({
    id: 'paint.endStroke',
    label: 'End paint stroke',
    category: 'paint',
    shortcut: null,
    description:
      'Close the active stroke session, bake the paint canvas into '
      + 'layer.paintSrc (target=layer) or layer.maskSrc (target=mask), '
      + 'then issue a single post-stroke history snapshot.',
    handler: async () => {
      if (!_activeSession) return false;
      const meta = _activeSessionMeta;
      const summary = _activeSession.end();
      const s = store.getState();
      s.setStrokeActive(false);

      // Bake: read the paint canvas back into the layer record so the
      // snapshot + IDB payload carries the pixels.
      if (paintCanvases && meta) {
        const canvas = paintCanvases.get(meta.layerId, meta.target);
        const src = _canvasToDataURL(canvas);
        if (src !== undefined) {
          const patch = meta.target === 'mask' ? { maskSrc: src } : { paintSrc: src };
          s.updateLayer(meta.layerId, patch);
        }
      }

      _activeSession     = null;
      _activeSessionCtx  = null;
      _activeSessionMeta = null;

      await history.snapshot('Paint stroke');
      return { stampCount: summary.stampCount, points: summary.points.length };
    },
  });

  // Allow tests to probe the active session state without importing
  // private module state.
  register({
    id: 'paint.__debug.isActive',
    label: '[debug] stroke active?',
    category: 'paint',
    shortcut: null,
    handler: () => !!_activeSession,
  });

  register({
    id: 'paint.__debug.activeToolId',
    label: '[debug] active stroke tool id',
    category: 'paint',
    shortcut: null,
    handler: () => _activeSessionMeta?.tool ?? null,
  });

  register({
    id: 'paint.__debug.activeCompositeOp',
    label: '[debug] active stroke composite op',
    category: 'paint',
    shortcut: null,
    handler: () => _activeSessionCtx?.globalCompositeOperation ?? null,
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function defaultShapeName(kind) {
  const map = {
    rect: 'Rectangle', rectangle: 'Rectangle',
    circle: 'Circle',   ellipse: 'Ellipse',
    polygon: 'Polygon', star: 'Star',
    arrow: 'Arrow',     line: 'Line',
    speechBubble: 'Speech bubble', 'speech-bubble': 'Speech bubble',
  };
  return (kind && map[kind]) || 'Shape';
}

function _adjustmentName(kind) {
  const map = {
    brightness: 'Brightness',
    contrast:   'Contrast',
    saturation: 'Saturation',
    hueSaturation: 'Hue / Saturation',
    curves:     'Curves',
    levels:     'Levels',
    colorBalance: 'Color balance',
  };
  return map[kind] || 'Adjustment';
}

function _bboxFor(layers) {
  if (layers.length === 0) return { cx: 640, cy: 360, w: 200, h: 200 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const l of layers) {
    const lx = l.x - (l.width || 0) / 2;
    const rx = l.x + (l.width || 0) / 2;
    const ty = l.y - (l.height || 0) / 2;
    const by = l.y + (l.height || 0) / 2;
    if (lx < minX) minX = lx;
    if (rx > maxX) maxX = rx;
    if (ty < minY) minY = ty;
    if (by > maxY) maxY = by;
  }
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w:  Math.max(1, maxX - minX),
    h:  Math.max(1, maxY - minY),
  };
}

function _newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normaliseShortcut(shortcut) {
  return String(shortcut)
    .trim()
    .toLowerCase()
    .replace(/\s*\+\s*/g, '+')
    .replace(/\b(cmd|command|ctrl|control)\b/g, 'mod');
}

/** @param {string} toolId */
function _resolveTool(toolId) {
  return _tools[toolId] || BrushTool;
}

function _endSessionNoSnapshot() {
  try { _activeSession?.end(); } catch { /* noop */ }
  _activeSession     = null;
  _activeSessionCtx  = null;
  _activeSessionMeta = null;
}

/** Safely get a dataURL off a canvas-like object, returning undefined on error. */
function _canvasToDataURL(canvas) {
  if (!canvas || typeof canvas.toDataURL !== 'function') return undefined;
  try { return canvas.toDataURL('image/png'); }
  catch { return undefined; }
}

/**
 * Fallback Canvas 2D ctx used in test environments where jsdom declines
 * to provide one. Records composite-op / globalAlpha / fillStyle writes
 * so downstream assertions can verify routing; draw calls are no-ops.
 * This keeps the stroke lifecycle, history snapshot, and paint-canvas
 * registry all exercised end-to-end in jest without a native canvas.
 */
function _noopCtx() {
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
    save() {}, restore() {},
    translate() {}, rotate() {}, scale() {},
    beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {},
    arc() {}, fillRect() {}, fill() {}, stroke() {},
    createRadialGradient() { return null; },
    createLinearGradient() { return null; },
    createPattern() { return null; },
  };
  return ctx;
}
