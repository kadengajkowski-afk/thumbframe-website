// src/editor-v2/store/EphemeralStore.js
// -----------------------------------------------------------------------------
// Purpose:  Plain-JS + EventEmitter store for ephemeral state that
//           should never flow through undo history or be persisted:
//           layer selection, hover, in-progress drag previews, and
//           (later) remote cursors. Per TECHNICAL_RESEARCH.md §
//           "The three-store state architecture".
//
// Exports:  EphemeralStore class + `ephemeralStore` singleton.
//           Two Excalidraw-style nonces expose memoization keys to
//           React selector hooks: sceneNonce ticks on anything that
//           affects what the overlay renders; selectionNonce ticks
//           only on selection changes.
//
// Events fired:
//   'selection:change'   — payload: { ids: string[] }
//   'hover:change'       — payload: { id: string|null }
//   'dragPreview:change' — payload: { preview: any }
//   'change'             — fired after every mutation; no payload
// -----------------------------------------------------------------------------

export class EphemeralStore {
  constructor() {
    this._selection    = [];     // layer ids
    this._hoverId      = null;
    this._dragPreview  = null;
    this._selectionNonce = 0;
    this._sceneNonce     = 0;
    /** @type {Map<string, Set<Function>>} */
    this._handlers = new Map();
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  getSelection() { return this._selection; }
  setSelection(ids) {
    const next = Array.isArray(ids) ? ids.slice() : [];
    if (_arrayEq(next, this._selection)) return;
    this._selection = next;
    this._selectionNonce += 1;
    this._sceneNonce     += 1;
    this._emit('selection:change', { ids: this._selection });
    this._emit('change');
  }

  addToSelection(id) {
    if (this._selection.includes(id)) return;
    this.setSelection([...this._selection, id]);
  }

  removeFromSelection(id) {
    if (!this._selection.includes(id)) return;
    this.setSelection(this._selection.filter(x => x !== id));
  }

  clearSelection() { this.setSelection([]); }

  // ── Hover ─────────────────────────────────────────────────────────────────
  getHover() { return this._hoverId; }
  setHover(id) {
    if (this._hoverId === id) return;
    this._hoverId = id;
    this._sceneNonce += 1;
    this._emit('hover:change', { id });
    this._emit('change');
  }

  // ── Drag preview ──────────────────────────────────────────────────────────
  getDragPreview() { return this._dragPreview; }
  setDragPreview(preview) {
    this._dragPreview = preview;
    this._sceneNonce += 1;
    this._emit('dragPreview:change', { preview });
    this._emit('change');
  }

  // ── Nonces (Excalidraw pattern) ──────────────────────────────────────────
  selectionNonce() { return this._selectionNonce; }
  sceneNonce()     { return this._sceneNonce; }

  // ── Event API ─────────────────────────────────────────────────────────────
  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) {
    this._handlers.get(event)?.delete(fn);
  }
  /** @private */
  _emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch (err) { console.warn(`[EphemeralStore] handler for ${event} threw:`, err); }
    }
  }
}

export const ephemeralStore = new EphemeralStore();

/** Test helper — beforeEach wipe. */
export function __resetEphemeralStore() {
  ephemeralStore._selection    = [];
  ephemeralStore._hoverId      = null;
  ephemeralStore._dragPreview  = null;
  ephemeralStore._selectionNonce = 0;
  ephemeralStore._sceneNonce     = 0;
  ephemeralStore._handlers.clear();
}

function _arrayEq(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
