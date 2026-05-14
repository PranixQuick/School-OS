// lib/offline-queue.ts
// Batch 3B — Offline-first attendance queue using IndexedDB.
// When offline: saves records locally.
// On reconnect: syncs to server automatically.
// Two record types supported:
//   - teacher (staff marking): { staff_id, date, status, check_in_time }
//   - student (class attendance): { class_id, date, records[] }

const DB_NAME = 'school-os-offline';
const DB_VERSION = 1;
const STORE = 'attendance_queue';

interface QueuedRecord {
  id: string;
  type: 'teacher' | 'student';
  endpoint: string;
  payload: Record<string, unknown>;
  queued_at: string;
  synced: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueue(type: QueuedRecord['type'], endpoint: string, payload: Record<string, unknown>): Promise<string> {
  const db = await openDB();
  const entry: QueuedRecord = {
    id: crypto.randomUUID(), type, endpoint, payload,
    queued_at: new Date().toISOString(), synced: false,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(entry);
    tx.oncomplete = () => resolve(entry.id);
    tx.onerror = () => reject(tx.error);
  });
}

// Queue a teacher/staff attendance mark (used by teacher-attendance page)
export async function queueTeacherAttendance(payload: {
  staff_id: string; date: string; status: string;
  check_in_time?: string; marked_via?: string;
}): Promise<string> {
  return enqueue('teacher', '/api/teacher-attendance', {
    ...payload, marked_via: payload.marked_via ?? 'portal_offline',
  });
}

// Queue student class attendance (for future student attendance page)
export async function queueStudentAttendance(payload: {
  class_id: string; date: string;
  records: { student_id: string; status: string }[];
}): Promise<string> {
  return enqueue('student', '/api/teacher/attendance', payload);
}

export async function getPendingQueue(): Promise<QueuedRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve((req.result as QueuedRecord[]).filter((r) => !r.synced));
    req.onerror = () => reject(req.error);
  });
}

async function markSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result as QueuedRecord | undefined;
      if (item) { item.synced = true; store.put(item); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingQueue();
  let synced = 0; let failed = 0;
  for (const item of pending) {
    try {
      const res = await fetch(item.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) { await markSynced(item.id); synced++; }
      else failed++;
    } catch { failed++; }
  }
  return { synced, failed };
}
