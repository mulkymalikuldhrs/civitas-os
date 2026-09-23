// FLYBRAIN KERNEL — idb.ts
// Wrapper IndexedDB berbasis Promise, nol dependensi (03_ARCHITECTURE.md §3).
// Semua koleksi memakai keyPath "id" sesuai amplop kanonik.

import type { CollectionName, Envelope } from "./types";

const DB_NAME = "flybrain-os";
const DB_VERSION = 1;

export const COLLECTIONS: CollectionName[] = [
  "identity",
  "memories",
  "logs",
  "decisions",
  "receipts",
  "gateway_log",
  "prt_events",
  "settings",
];

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIDB(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export function openDB(): Promise<IDBDatabase> {
  if (!hasIDB()) return Promise.reject(new Error("IndexedDB tidak tersedia di lingkungan ini."));
  if (dbPromise) return dbPromise;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of COLLECTIONS) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      // Jangan cache promise yang REJECTED (audit F-15): percobaan berikutnya
      // harus mencoba membuka ulang DB, bukan menerima rejection lama selamanya.
      if (dbPromise === p) dbPromise = null;
      reject(req.error ?? new Error("Gagal membuka IndexedDB."));
    };
  });
  dbPromise = p;
  return p;
}

function tx<T>(
  store: CollectionName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        let result!: T;
        const req = fn(t.objectStore(store));
        // Simpan hasil request di onsuccess, tapi resolve HANYA saat transaksi
        // benar-benar selesai (audit F-15) — abort belated (mis. kuota penuh)
        // tidak lagi menghilangkan tulisan setelah promise terlanjur resolve.
        req.onsuccess = () => {
          result = req.result;
        };
        req.onerror = () => reject(req.error ?? new Error("Operasi IndexedDB gagal."));
        t.oncomplete = () => resolve(result);
        t.onabort = () => reject(t.error ?? new Error("Transaksi IndexedDB dibatalkan."));
      }),
  );
}

export function getAll<P = Record<string, unknown>>(
  store: CollectionName,
): Promise<Envelope<P>[]> {
  return tx(store, "readonly", (s) => s.getAll() as IDBRequest<Envelope<P>[]>);
}

export function getRecord<P = Record<string, unknown>>(
  store: CollectionName,
  id: string,
): Promise<Envelope<P> | undefined> {
  return tx(store, "readonly", (s) => s.get(id) as IDBRequest<Envelope<P> | undefined>);
}

export function putRecord<P = Record<string, unknown>>(
  store: CollectionName,
  rec: Envelope<P>,
): Promise<IDBValidKey> {
  return tx(store, "readwrite", (s) => s.put(rec));
}

export function delRecord(store: CollectionName, id: string): Promise<undefined> {
  return tx(store, "readwrite", (s) => s.delete(id) as IDBRequest<undefined>);
}

export function clearStore(store: CollectionName): Promise<undefined> {
  return tx(store, "readwrite", (s) => s.clear() as IDBRequest<undefined>);
}

export function countStore(store: CollectionName): Promise<number> {
  return tx(store, "readonly", (s) => s.count());
}

/** Generator id kanonik: prefiks koleksi + waktu + acak (cukup unik per perangkat). */
export function makeId(prefix: string): string {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 0xffffff).toString(36).padStart(4, "0");
  return `${prefix}_${t}${r}`;
}
