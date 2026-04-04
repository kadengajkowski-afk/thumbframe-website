import Dexie from 'dexie';

const db = new Dexie('ThumbFrameDB');

db.version(1).stores({
  // Project metadata + layer properties/text/effects/positions (NO base64 pixel data)
  projects: 'id, updatedAt, name',

  // Binary pixel data (base64 or Blob) referenced by dataRef ID
  blobs: 'id, projectId, updatedAt',

  // Point-in-time project snapshots for undo/redo history
  snapshots: '++id, projectId, createdAt',

  // Emergency recovery state — overwritten on each save cycle
  recovery: 'id, projectId, timestamp',

  // Key-value app settings (lastOpenedProject, etc.)
  settings: 'key',
});

export default db;
