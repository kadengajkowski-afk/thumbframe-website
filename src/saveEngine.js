/**
 * saveEngine.js — ThumbFrame Auto-Save Engine (Phase 1)
 *
 * Responsibilities:
 *  - Dirty flag tracking (projectMeta, layerProperties, layerContent, textContent, masks, history)
 *  - 3-second debounced save (triggered on any change)
 *  - 30-second periodic safety save
 *  - Immediate save API for significant actions (AI, image import, layer delete, export)
 *  - Save lock: never overlaps concurrent saves; queues one pending if busy
 *  - Local IndexedDB save via Dexie (split storage: JSON metadata vs binary blobs)
 *
 * Usage:
 *   const engine = createSaveEngine({ getSnapshot, onSaveStart, onSaveEnd, onDirty });
 *   engine.markDirty('layerProperties');
 *   engine.markDirty('layerContent', layerId);
 *   engine.saveImmediate();   // bypass debounce
 *   engine.destroy();         // on unmount
 */

import db from './db';

// ── UUID generator (no external dep needed) ───────────────────────────────────
function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Split storage: extract base64 blobs from layers ──────────────────────────
//
// Project JSON in IndexedDB must never embed raw base64 image data.
// Instead each image layer gets a stable `dataRef` UUID; the pixel data lives
// in the separate `blobs` table. This keeps project JSON small (<50 KB) while
// blobs can be megabytes.
//
async function splitLayersForStorage(projectId, layers) {
  const cleanLayers = [];
  const blobEntries = [];

  for (const layer of layers) {
    const cleanLayer = { ...layer };

    // Extract base64 src from image/background layers
    if (layer.src && typeof layer.src === 'string' && layer.src.startsWith('data:')) {
      const blobId = layer.dataRef || uuid();
      cleanLayer.src = null;          // remove from JSON
      cleanLayer.dataRef = blobId;    // reference to blobs table
      blobEntries.push({
        id: blobId,
        projectId,
        data: layer.src,
        updatedAt: Date.now(),
      });
    }

    // Also handle mask data
    if (cleanLayer.maskData && typeof cleanLayer.maskData === 'string'
        && cleanLayer.maskData.startsWith('data:')) {
      const maskBlobId = cleanLayer.maskDataRef || uuid();
      cleanLayer.maskData = null;
      cleanLayer.maskDataRef = maskBlobId;
      blobEntries.push({
        id: maskBlobId,
        projectId,
        data: layer.maskData,
        updatedAt: Date.now(),
      });
    }

    cleanLayers.push(cleanLayer);
  }

  return { cleanLayers, blobEntries };
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * @param {object} options
 * @param {() => object|null} options.getSnapshot  — returns current project state or null
 * @param {() => void}        options.onSaveStart  — called when a save begins
 * @param {({success, savedAt?, error?}) => void} options.onSaveEnd — called when save completes
 * @param {() => void}        options.onDirty      — called when any dirty flag is set
 */
export function createSaveEngine({ getSnapshot, onSaveStart, onSaveEnd, onDirty } = {}) {
  // ── Dirty flags ────────────────────────────────────────────────────────────
  const dirty = {
    projectMeta:     false,
    layerProperties: false,
    layerContent:    new Set(),   // Set of layer IDs with changed pixel data
    textContent:     new Set(),   // Set of layer IDs with changed text
    masks:           new Set(),   // Set of layer IDs with changed masks
    history:         false,
  };

  // ── Save lock ──────────────────────────────────────────────────────────────
  let saveInProgress = false;
  let savePending    = false;

  // ── Timers ─────────────────────────────────────────────────────────────────
  let debounceTimer  = null;
  let periodicTimer  = null;

  // ── Timestamps ─────────────────────────────────────────────────────────────
  let lastSavedAt = null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function isDirty() {
    return (
      dirty.projectMeta     ||
      dirty.layerProperties ||
      dirty.layerContent.size > 0 ||
      dirty.textContent.size  > 0 ||
      dirty.masks.size        > 0 ||
      dirty.history
    );
  }

  function clearDirty() {
    dirty.projectMeta     = false;
    dirty.layerProperties = false;
    dirty.layerContent.clear();
    dirty.textContent.clear();
    dirty.masks.clear();
    dirty.history         = false;
  }

  // ── Core save ──────────────────────────────────────────────────────────────

  async function saveNow() {
    if (saveInProgress) {
      savePending = true;
      return;
    }
    if (!isDirty()) return;

    saveInProgress = true;
    onSaveStart?.();

    try {
      const snapshot = getSnapshot?.();
      if (!snapshot) {
        console.warn('[SaveEngine] No snapshot — skipping save.');
        return;
      }

      const { layers = [], projectId, designName = 'Untitled', userId = null, ...meta } = snapshot;
      const id = String(projectId || 'local-draft');

      // Split binary blobs out of layers
      const { cleanLayers, blobEntries } = await splitLayersForStorage(id, layers);

      // Persist blobs
      if (blobEntries.length > 0) {
        await db.blobs.bulkPut(blobEntries);
      }

      const now = Date.now();

      // Persist project (metadata + clean layers, no base64)
      await db.projects.put({
        id,
        updatedAt: now,
        name: designName,
        userId,
        data: { ...meta, layers: cleanLayers, designName },
      });

      // Overwrite recovery slot (latest known good state)
      await db.recovery.put({
        id: 'current',
        projectId: id,
        timestamp: now,
        data: { ...meta, layers: cleanLayers, designName },
      });

      clearDirty();
      lastSavedAt = new Date();
      onSaveEnd?.({ success: true, savedAt: lastSavedAt });

    } catch (err) {
      console.error('[SaveEngine] IndexedDB save failed:', err);
      onSaveEnd?.({ success: false, error: err });
    } finally {
      saveInProgress = false;
      if (savePending) {
        savePending = false;
        // Run one follow-up save immediately to capture anything that arrived
        // while we were locked.
        saveNow();
      }
    }
  }

  // ── Scheduling ─────────────────────────────────────────────────────────────

  function scheduleSave(delayMs = 3000) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveNow, delayMs);
  }

  function startPeriodic() {
    if (periodicTimer) clearInterval(periodicTimer);
    periodicTimer = setInterval(() => {
      if (isDirty()) saveNow();
    }, 30_000);
  }

  function stopPeriodic() {
    if (periodicTimer) {
      clearInterval(periodicTimer);
      periodicTimer = null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Mark a specific kind of change as dirty and schedule a debounced save.
   *
   * @param {'projectMeta'|'layerProperties'|'layerContent'|'textContent'|'masks'|'history'} type
   * @param {string|null} layerId  — required for layerContent / textContent / masks
   */
  function markDirty(type, layerId = null) {
    switch (type) {
      case 'projectMeta':     dirty.projectMeta     = true; break;
      case 'layerProperties': dirty.layerProperties = true; break;
      case 'layerContent':    if (layerId) dirty.layerContent.add(layerId); else dirty.layerProperties = true; break;
      case 'textContent':     if (layerId) dirty.textContent.add(layerId);  else dirty.layerProperties = true; break;
      case 'masks':           if (layerId) dirty.masks.add(layerId);         else dirty.layerProperties = true; break;
      case 'history':         dirty.history         = true; break;
      default:                dirty.layerProperties = true; break;
    }
    onDirty?.();
    scheduleSave(3000);
  }

  /**
   * Bypass debounce — save right now.
   * Use for: AI completion, image import, layer delete, export.
   */
  function saveImmediate() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    // Mark everything dirty so the save isn't skipped
    dirty.projectMeta     = true;
    dirty.layerProperties = true;
    saveNow();
  }

  function getLastSavedAt() {
    return lastSavedAt;
  }

  function destroy() {
    if (debounceTimer) clearTimeout(debounceTimer);
    stopPeriodic();
  }

  return {
    markDirty,
    saveImmediate,
    saveNow,
    startPeriodic,
    stopPeriodic,
    destroy,
    isDirty,
    getLastSavedAt,
  };
}
