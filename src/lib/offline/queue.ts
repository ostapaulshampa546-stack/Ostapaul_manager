"use client";
/** File d'attente IndexedDB pour les opérations hors connexion (pointages). */
export type QueuedScan = { client_uuid: string; tenant_id: string; token: string; event: "in" | "out"; scanned_at: string };

const DB = "ostapaul-offline";
const STORE = "scans";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "client_uuid" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const enqueueScan = (s: QueuedScan) => tx("readwrite", (st) => st.put(s));
export const pendingScans = () => tx<QueuedScan[]>("readonly", (st) => st.getAll() as IDBRequest<QueuedScan[]>);
export const removeScan = (id: string) => tx("readwrite", (st) => st.delete(id));
