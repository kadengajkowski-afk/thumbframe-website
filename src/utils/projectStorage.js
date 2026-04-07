/**
 * projectStorage.js — Unified IndexedDB project storage
 *
 * Single source of truth for all project reads/writes.
 * Wraps the existing Dexie db (ThumbFrameDB) so no new DB is created.
 *
 * Blob rehydration: saveEngine strips base64 from layer.src and stores it
 * in the blobs table with a `dataRef` UUID. loadProject restores src from blobs.
 */

import db from '../db';

function generateId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD — restores full project including blob data
// ─────────────────────────────────────────────────────────────────────────────
export async function loadProject(projectId) {
  if (!projectId) return null;
  const record = await db.projects.get(String(projectId));
  if (!record) return null;

  const data = record.data || {};
  const layers = Array.isArray(data.layers) ? data.layers : [];

  // Rehydrate base64 blobs back into layer.src
  const rehydrated = await Promise.all(
    layers.map(async (layer) => {
      if (layer.dataRef && !layer.src) {
        const blob = await db.blobs.get(layer.dataRef).catch(() => null);
        if (blob?.data) return { ...layer, src: blob.data };
      }
      if (layer.maskDataRef && !layer.maskData) {
        const maskBlob = await db.blobs.get(layer.maskDataRef).catch(() => null);
        if (maskBlob?.data) return { ...layer, maskData: maskBlob.data };
      }
      return layer;
    })
  );

  return {
    ...record,
    data: { ...data, layers: rehydrated },
    // Flat aliases so Editor.js loadProject() can read directly
    layers: rehydrated,
    name: record.name || data.designName || 'Untitled',
    platform: data.platform || 'youtube',
    brightness: data.brightness ?? 100,
    contrast: data.contrast ?? 100,
    saturation: data.saturation ?? 100,
    hue: data.hue ?? 0,
    designName: record.name || data.designName || 'Untitled',
    projectId: record.id,
    updatedAt: record.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST — for Gallery grid, sorted newest-first
// ─────────────────────────────────────────────────────────────────────────────
export async function listProjects(userId = null) {
  const all = await db.projects.orderBy('updatedAt').reverse().toArray();
  if (!userId) return all;
  return all.filter(p => !p.userId || p.userId === userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteProject(projectId) {
  const id = String(projectId);
  await db.projects.delete(id);
  await db.blobs.where('projectId').equals(id).delete().catch(() => {});
  await db.snapshots.where('projectId').equals(id).delete().catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// DUPLICATE
// ─────────────────────────────────────────────────────────────────────────────
export async function duplicateProject(projectId) {
  const original = await loadProject(projectId);
  if (!original) return null;

  const newId = generateId();
  const now = Date.now();

  // Re-save layers — blobs need new IDs to avoid collision
  const { layers = [] } = original;
  const newLayers = [];
  const newBlobs = [];

  for (const layer of layers) {
    const newLayer = { ...layer };
    if (layer.src && typeof layer.src === 'string' && layer.src.startsWith('data:')) {
      const newBlobId = generateId();
      newBlobs.push({ id: newBlobId, projectId: newId, data: layer.src, updatedAt: now });
      newLayer.src = null;
      newLayer.dataRef = newBlobId;
    }
    newLayers.push(newLayer);
  }

  if (newBlobs.length > 0) await db.blobs.bulkPut(newBlobs);

  await db.projects.put({
    id: newId,
    updatedAt: now,
    name: (original.name || 'Untitled') + ' (Copy)',
    userId: original.userId || null,
    data: { ...original.data, layers: newLayers, designName: (original.name || 'Untitled') + ' (Copy)' },
  });

  return newId;
}

// ─────────────────────────────────────────────────────────────────────────────
// RENAME
// ─────────────────────────────────────────────────────────────────────────────
export async function renameProject(projectId, newName) {
  const id = String(projectId);
  const record = await db.projects.get(id);
  if (!record) return false;
  await db.projects.update(id, {
    name: newName,
    updatedAt: Date.now(),
    data: { ...(record.data || {}), designName: newName },
  });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE INFO
// ─────────────────────────────────────────────────────────────────────────────
export async function getStorageInfo() {
  const count = await db.projects.count();
  let estimate = null;
  if (navigator.storage?.estimate) {
    estimate = await navigator.storage.estimate();
  }
  return {
    projectCount: count,
    usedMB: estimate ? Math.round(estimate.usage / 1024 / 1024) : null,
    quotaMB: estimate ? Math.round(estimate.quota / 1024 / 1024) : null,
  };
}
