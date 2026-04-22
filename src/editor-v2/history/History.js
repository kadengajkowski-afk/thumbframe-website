// src/editor-v2/history/History.js
// -----------------------------------------------------------------------------
// Purpose:  Post-mutation snapshot-based version history. See DESIGN.md in
//           this directory for the full model and invariants.
// Exports:  History class
// Depends:  ../save/idb.js, ../store/Store.js
//
// Contract (see DESIGN.md for the full breakdown):
//   • _stack[_index] is always equal to the live store document.
//   • Action handlers mutate the store FIRST, then call snapshot(label).
//   • Non-mutating actions (opacity drag, selection, visibility toggle)
//     do NOT snapshot.
//   • On mount, call seed() once to anchor the starting state.
//   • Applying a snapshot does not itself snapshot (would produce
//     spurious entries).
// -----------------------------------------------------------------------------

import * as idb from '../save/idb.js';
import { getDocumentSnapshot } from '../store/Store.js';

const DEFAULT_MAX_SNAPSHOTS = 50;

/**
 * @typedef {Object} HistoryOptions
 * @property {import('zustand').StoreApi<any>} store
 * @property {string} [projectId]   - Stable project id for IDB keying. Defaults to 'local-draft'.
 * @property {number} [max]
 */

export class History {
  /** @param {HistoryOptions} opts */
  constructor(opts) {
    this._store     = opts.store;
    this._projectId = opts.projectId || 'local-draft';
    this._max       = opts.max || DEFAULT_MAX_SNAPSHOTS;

    /** @type {import('../save/idb.js').SnapshotRecord[]} */
    this._stack = [];
    this._index = -1;
  }

  /** Rebuild the in-memory stack from IDB. Call once after construction. */
  async load() {
    let snapshots;
    try {
      snapshots = await idb.listSnapshots(this._projectId);
    } catch {
      snapshots = [];
    }
    this._stack = Array.isArray(snapshots) ? snapshots : [];
    this._index = this._stack.length > 0 ? this._stack.length - 1 : -1;
  }

  /**
   * Ensure the stack has at least one entry representing the current
   * store state. Idempotent — no-op if `load()` already populated the
   * stack. Required on mount to satisfy I-4 (a seed entry must exist
   * before any user action so the first undo has somewhere to land).
   *
   * @param {string} [label]
   */
  async seed(label = 'Initial state') {
    if (this._stack.length > 0) return;
    await this._captureSnapshot(label);
  }

  /**
   * Capture the current (post-mutation) document state as a new snapshot.
   * Call AFTER the action has already mutated the store. Truncates any
   * redo-future so a new action after undo discards the old tail.
   *
   * @param {string} [label]
   * @returns {Promise<string>} the new snapshot id
   */
  async snapshot(label = '') {
    return this._captureSnapshot(label);
  }

  canUndo() { return this._index > 0; }
  canRedo() { return this._index >= 0 && this._index < this._stack.length - 1; }

  /** Move one step back in history and apply that snapshot. */
  async undo() {
    if (!this.canUndo()) return false;
    this._index -= 1;
    this._apply(this._stack[this._index]);
    return true;
  }

  /** Move one step forward in history and apply that snapshot. */
  async redo() {
    if (!this.canRedo()) return false;
    this._index += 1;
    this._apply(this._stack[this._index]);
    return true;
  }

  /** Restore a specific snapshot by id. @param {string} id */
  async restore(id) {
    const idx = this._stack.findIndex(s => s.id === id);
    if (idx < 0) return false;
    this._index = idx;
    this._apply(this._stack[idx]);
    return true;
  }

  /** @returns {ReadonlyArray<{id:string,label:string,timestamp:number}>} */
  listEntries() {
    return this._stack.map(s => ({ id: s.id, label: s.label, timestamp: s.timestamp }));
  }

  currentIndex() { return this._index; }
  size()         { return this._stack.length; }

  // ── internals ──────────────────────────────────────────────────────────────

  /**
   * Capture current store state, truncate redo-future, push, prune,
   * persist. Shared by seed() and snapshot() so the behaviour is
   * identical (the only difference between the two is that seed() is a
   * no-op when the stack already has entries).
   *
   * @private
   * @param {string} label
   */
  async _captureSnapshot(label) {
    // Deep-clone via structuredClone if available, fallback to JSON.
    // The snapshot must be decoupled from the live store so subsequent
    // mutations don't retroactively change past entries.
    const live = getDocumentSnapshot();
    const state = _clone({
      projectId:   live.projectId,
      projectName: live.projectName,
      layers:      live.layers,
    });

    const snap = {
      id:        _newSnapshotId(),
      projectId: this._projectId,
      timestamp: Date.now(),
      label,
      state,
    };

    // Truncate the redo-future (branching-after-undo rule).
    if (this._index < this._stack.length - 1) {
      this._stack = this._stack.slice(0, this._index + 1);
    }

    this._stack.push(snap);
    this._index = this._stack.length - 1;
    try { await idb.putSnapshot(snap); } catch { /* non-fatal */ }

    // Enforce max size by trimming oldest entries.
    if (this._stack.length > this._max) {
      const drop = this._stack.length - this._max;
      this._stack = this._stack.slice(drop);
      this._index = Math.max(0, this._index - drop);
      try { await idb.pruneSnapshots(this._projectId, this._max); } catch { /* non-fatal */ }
    }

    return snap.id;
  }

  /**
   * Apply a snapshot's state to the store. Does NOT push a new snapshot
   * (I-5). Subscribers fire once as a result of the replaceAll call.
   *
   * @private
   * @param {import('../save/idb.js').SnapshotRecord} snap
   */
  _apply(snap) {
    const st = snap.state || {};
    // Use _clone so the stack entry is not mutated if the store later
    // changes one of its layers in place.
    this._store.getState().replaceAll({
      projectId:   st.projectId ?? null,
      projectName: st.projectName ?? 'Untitled',
      layers:      _clone(Array.isArray(st.layers) ? st.layers : []),
    });
  }
}

function _newSnapshotId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Deep clone via structuredClone with a JSON fallback. */
function _clone(value) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(value));
}
