// src/editor-v2/save/SaveEngine.js
// -----------------------------------------------------------------------------
// Purpose:  Persist store state to IDB immediately (local-first) and sync to
//           the Railway API on a 3-second debounce. Queues saves when
//           offline; flushes the queue on reconnect. Conflict detection is
//           last-write-wins with a visible warning (saveStatus -> 'error').
// Exports:  SaveEngine class
// Depends:  ./idb.js, ../store/Store.js, supabase client
//
// The engine subscribes to the store on start() and reacts to layer /
// projectName / projectId changes. It sets saveStatus through the store
// rather than via callbacks — the TopBar (or any UI) just reads
// useStore(s => s.saveStatus) and renders accordingly.
// -----------------------------------------------------------------------------

import * as idb from './idb.js';
import { SAVE_STATUS, getDocumentSnapshot } from '../store/Store.js';
import supabase from '../../supabaseClient';

const DEBOUNCE_MS = 3000;

/**
 * @typedef {Object} SaveEngineOptions
 * @property {import('zustand').StoreApi<any>} store    - Zustand store-api
 * @property {string} apiUrl                            - Railway API base URL (no trailing /)
 * @property {string} [platform]                        - Defaults to 'youtube'
 */

export class SaveEngine {
  /** @param {SaveEngineOptions} opts */
  constructor(opts) {
    this._store    = opts.store;
    this._apiUrl   = opts.apiUrl.replace(/\/$/, '');
    this._platform = opts.platform || 'youtube';

    /** @type {ReturnType<typeof setTimeout>|null} */
    this._debounceTimer = null;

    this._saving  = false;
    this._pending = false;
    this._online  = typeof navigator !== 'undefined' ? navigator.onLine : true;

    /** @type {null | (() => void)} */
    this._unsubStore = null;

    this._onOnline  = this._onOnline.bind(this);
    this._onOffline = this._onOffline.bind(this);
  }

  /** Begin observing store changes + online/offline events. */
  start() {
    if (this._unsubStore) return; // idempotent

    // Subscribe to the store; trigger a save whenever a persistable field
    // changes. Using full-state subscribe rather than selector-subscribe
    // so we can compare multiple fields cheaply.
    let prev = this._store.getState();
    this._unsubStore = this._store.subscribe((state) => {
      const changed =
        state.layers      !== prev.layers      ||
        state.projectName !== prev.projectName ||
        state.projectId   !== prev.projectId;
      prev = state;
      if (changed) this._scheduleSave();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online',  this._onOnline);
      window.addEventListener('offline', this._onOffline);
    }

    // If we came up offline, reflect that.
    if (!this._online) {
      this._store.getState().setSaveStatus(SAVE_STATUS.OFFLINE);
    }
  }

  /** Tear down subscriptions. Idempotent. */
  dispose() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
    if (this._unsubStore) this._unsubStore();
    this._unsubStore = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('online',  this._onOnline);
      window.removeEventListener('offline', this._onOffline);
    }
  }

  /** Force an immediate save, skipping the debounce window. */
  async saveImmediate() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    await this._doSave();
  }

  /**
   * Hydrate the store from the most recent IDB record for a project id.
   * Does NOT push history; caller is responsible if they need one.
   *
   * @param {string} projectId
   * @returns {Promise<boolean>} true if a record was found and applied
   */
  async loadFromIDB(projectId) {
    const record = await idb.getProject(projectId);
    if (!record?.data) return false;
    const d = record.data;
    this._store.getState().replaceAll({
      projectId:   d.projectId ?? projectId,
      projectName: d.projectName ?? record.name ?? 'Untitled',
      layers:      Array.isArray(d.layers) ? d.layers : [],
    });
    this._store.getState().setSaveStatus(SAVE_STATUS.SAVED);
    return true;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** @private */
  _scheduleSave() {
    // Only mark as 'saving' if we're online — offline stays offline until
    // we reconnect. Network-error state is set by _doSave on failure.
    if (this._online) {
      this._store.getState().setSaveStatus(SAVE_STATUS.SAVING);
    }
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._doSave();
    }, DEBOUNCE_MS);
  }

  /** @private */
  async _doSave() {
    if (this._saving) {
      this._pending = true;
      return;
    }
    this._saving = true;
    try {
      const snapshot = getDocumentSnapshot();
      // Don't save an empty new doc (no id + no layers) — nothing meaningful yet.
      if (!snapshot.projectId && (!snapshot.layers || snapshot.layers.length === 0)) {
        this._store.getState().setSaveStatus(SAVE_STATUS.SAVED);
        return;
      }

      // 1. Local-first: always write to IDB so a crash or reload doesn't
      //    lose changes. Key is either the design id (once we have one
      //    from the server) or a stable local fallback.
      const idbKey = snapshot.projectId || 'local-draft';
      await idb.putProject({
        id:        idbKey,
        name:      snapshot.projectName,
        updatedAt: Date.now(),
        data:      snapshot,
      });

      // 2. If offline, enqueue for later and bail.
      if (!this._online) {
        await idb.enqueueSave({
          id:         `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          enqueuedAt: Date.now(),
          payload:    snapshot,
        });
        this._store.getState().setSaveStatus(SAVE_STATUS.OFFLINE);
        return;
      }

      // 3. Sync to server.
      const result = await this._postToServer(snapshot);

      if (result.skipped) {
        // Guest / not logged in — IDB-only is fine.
        this._store.getState().setSaveStatus(SAVE_STATUS.SAVED);
      } else if (result.conflict) {
        // Last-write-wins with warning. IDB still has the local write;
        // the UI (Phase 4+) can surface a "server has newer version"
        // toast once we have toast infra in v2.
        this._store.getState().setSaveStatus(SAVE_STATUS.ERROR);
        console.warn('[SaveEngine] server-side conflict:', result);
      } else {
        // Success — mirror the returned id into the store so subsequent
        // saves carry it and the URL layer (in EditorV2.jsx) can sync.
        if (result.returnedId && result.returnedId !== snapshot.projectId) {
          this._store.getState().setProjectId(result.returnedId);
        }
        this._store.getState().setSaveStatus(SAVE_STATUS.SAVED);
      }
    } catch (err) {
      // Network failure → queue the snapshot for retry; keep IDB write.
      try {
        const snapshot = getDocumentSnapshot();
        await idb.enqueueSave({
          id:         `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          enqueuedAt: Date.now(),
          payload:    snapshot,
        });
      } catch { /* ignore */ }
      this._store.getState().setSaveStatus(SAVE_STATUS.ERROR);
      console.error('[SaveEngine] save failed:', err);
    } finally {
      this._saving = false;
      if (this._pending) {
        this._pending = false;
        setTimeout(() => this._doSave(), 0);
      }
    }
  }

  /**
   * POST one snapshot to the Railway /designs/save endpoint.
   * @private
   * @param {ReturnType<typeof getDocumentSnapshot>} snapshot
   */
  async _postToServer(snapshot) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      return { skipped: true };
    }

    const res = await fetch(`${this._apiUrl}/designs/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id:         snapshot.projectId || undefined,
        name:       snapshot.projectName,
        platform:   this._platform,
        user_email: session.user.email,
        user_id:    session.user.id,
        json_data: {
          projectName: snapshot.projectName,
          platform:    this._platform,
          layers:      snapshot.layers,
        },
      }),
    });

    if (res.status === 409) {
      // Server advertises a conflict (newer version on disk).
      const body = await res.json().catch(() => ({}));
      return { conflict: true, serverLastEdited: body?.last_edited ?? null };
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const body = await res.json().catch(() => ({}));
    const returnedId = body?.data?.id || body?.id || body?.design?.id || null;
    return { returnedId };
  }

  /** @private */
  async _flushQueue() {
    const queued = await idb.drainQueue();
    if (queued.length === 0) return;
    for (const entry of queued) {
      try {
        await this._postToServer(entry.payload);
      } catch (err) {
        // Re-queue on failure so we don't lose it.
        try { await idb.enqueueSave(entry); } catch { /* noop */ }
        console.warn('[SaveEngine] queue flush failed:', err);
        return; // stop early on failure — try again later
      }
    }
    this._store.getState().setSaveStatus(SAVE_STATUS.SAVED);
  }

  /** @private */
  async _onOnline() {
    this._online = true;
    try { await this._flushQueue(); } catch { /* noop */ }
    // Run one save to publish anything IDB has that the queue didn't.
    this._scheduleSave();
  }

  /** @private */
  _onOffline() {
    this._online = false;
    this._store.getState().setSaveStatus(SAVE_STATUS.OFFLINE);
  }
}
