// src/editor-v2/save/idb.js
// -----------------------------------------------------------------------------
// Purpose:  Small promise-based wrapper around IndexedDB. Three object
//           stores: projects (full document snapshots), snapshots
//           (version-history entries per project), queue (pending
//           unsynced saves for offline mode).
// Exports:  putProject, getProject, listProjects
//           putSnapshot, listSnapshots, deleteSnapshotsBefore
//           enqueueSave, drainQueue
// Depends:  none (native IndexedDB API)
//
// v1 opened a separate `thumbframe-originals` DB for image blobs. That
// lives at the v1 scope and is not our problem here. v2 uses a fresh DB
// name so there is zero coupling to the legacy editor.
// -----------------------------------------------------------------------------

const DB_NAME    = 'thumbframe-v2';
const DB_VERSION = 1;

const STORE_PROJECTS  = 'projects';
const STORE_SNAPSHOTS = 'snapshots';
const STORE_QUEUE     = 'queue';

/** @type {IDBDatabase|null} */
let _db = null;
/** @type {Promise<IDBDatabase>|null} */
let _opening = null;

/** Open (or reopen) the singleton v2 database. */
function openDB() {
  if (_db) return Promise.resolve(_db);
  if (_opening) return _opening;
  _opening = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = /** @type {IDBDatabase} */ (e.target.result);
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        const store = db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
        store.createIndex('byProject',          'projectId');
        store.createIndex('byProjectTimestamp', ['projectId', 'timestamp']);
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => {
      _db = /** @type {IDBDatabase} */ (e.target.result);
      _opening = null;
      resolve(_db);
    };
    req.onerror = (e) => {
      _opening = null;
      reject(/** @type {any} */ (e.target).error || new Error('IDB open failed'));
    };
  });
  return _opening;
}

/** @param {IDBTransaction} tx */
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error || new Error('transaction aborted'));
  });
}

/** @template T  @param {IDBRequest<T>} req  @returns {Promise<T>} */
function reqDone(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Projects ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ProjectRecord
 * @property {string} id            - Supabase design id OR 'local-draft'
 * @property {string} name
 * @property {number} updatedAt
 * @property {Object} data          - Full document snapshot (getDocumentSnapshot shape)
 */

/** @param {ProjectRecord} project */
export async function putProject(project) {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, 'readwrite');
  tx.objectStore(STORE_PROJECTS).put(project);
  await txDone(tx);
}

/** @param {string} id  @returns {Promise<ProjectRecord|null>} */
export async function getProject(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, 'readonly');
  const result = await reqDone(tx.objectStore(STORE_PROJECTS).get(id));
  await txDone(tx);
  return result ?? null;
}

/** @returns {Promise<ProjectRecord[]>} */
export async function listProjects() {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, 'readonly');
  const result = /** @type {ProjectRecord[]} */ (await reqDone(tx.objectStore(STORE_PROJECTS).getAll()));
  await txDone(tx);
  return result || [];
}

// ── Snapshots (version history) ─────────────────────────────────────────────

/**
 * @typedef {Object} SnapshotRecord
 * @property {string} id
 * @property {string} projectId
 * @property {number} timestamp
 * @property {string} label
 * @property {Object} state          - Document state at snapshot time
 */

/** @param {SnapshotRecord} snapshot */
export async function putSnapshot(snapshot) {
  const db = await openDB();
  const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
  tx.objectStore(STORE_SNAPSHOTS).put(snapshot);
  await txDone(tx);
}

/** @param {string} projectId  @returns {Promise<SnapshotRecord[]>} */
export async function listSnapshots(projectId) {
  const db = await openDB();
  const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
  const idx = tx.objectStore(STORE_SNAPSHOTS).index('byProject');
  const result = /** @type {SnapshotRecord[]} */ (await reqDone(idx.getAll(projectId)));
  await txDone(tx);
  // Ensure chronological (byProject index does not guarantee sort order on all engines)
  return (result || []).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Delete snapshots for a project older than the Nth most recent. Used
 * by History to prune to a max size.
 *
 * @param {string} projectId
 * @param {number} keepCount
 */
export async function pruneSnapshots(projectId, keepCount) {
  const existing = await listSnapshots(projectId);
  if (existing.length <= keepCount) return;
  const toDelete = existing.slice(0, existing.length - keepCount);
  const db = await openDB();
  const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
  const store = tx.objectStore(STORE_SNAPSHOTS);
  for (const row of toDelete) store.delete(row.id);
  await txDone(tx);
}

// ── Offline save queue ──────────────────────────────────────────────────────

/**
 * @typedef {Object} QueuedSave
 * @property {string} id             - Unique queue entry id
 * @property {number} enqueuedAt
 * @property {Object} payload        - Body to POST on reconnect
 */

/** @param {QueuedSave} entry */
export async function enqueueSave(entry) {
  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  tx.objectStore(STORE_QUEUE).put(entry);
  await txDone(tx);
}

/** Remove and return the current queue. @returns {Promise<QueuedSave[]>} */
export async function drainQueue() {
  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  const store = tx.objectStore(STORE_QUEUE);
  const all = /** @type {QueuedSave[]} */ (await reqDone(store.getAll()));
  store.clear();
  await txDone(tx);
  return all || [];
}

/** @returns {Promise<QueuedSave[]>} */
export async function peekQueue() {
  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readonly');
  const all = /** @type {QueuedSave[]} */ (await reqDone(tx.objectStore(STORE_QUEUE).getAll()));
  await txDone(tx);
  return all || [];
}

/** Test helper — wipes all v2 data. */
export async function __resetForTests() {
  const db = await openDB();
  const tx = db.transaction([STORE_PROJECTS, STORE_SNAPSHOTS, STORE_QUEUE], 'readwrite');
  tx.objectStore(STORE_PROJECTS).clear();
  tx.objectStore(STORE_SNAPSHOTS).clear();
  tx.objectStore(STORE_QUEUE).clear();
  await txDone(tx);
}
