import Dexie from 'dexie';

const db = new Dexie('ThumbFrameDB');

db.version(1).stores({
  projects: 'id, updatedAt, name',
  blobs: 'id, projectId, updatedAt',
  snapshots: '++id, projectId, createdAt',
  recovery: 'id, projectId, timestamp',
  settings: 'key',
});

db.version(2).stores({
  // Added userId index so Gallery can filter per-user
  projects: 'id, updatedAt, name, userId',
});

export default db;
