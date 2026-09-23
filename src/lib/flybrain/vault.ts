// FLYBRAIN KERNEL — vault.ts
// Gudang data lokal user: CRUD 4 koleksi + statistik + ekspor/impor (04 §1-2).

import { clearStore, delRecord, getAll, getRecord, makeId, putRecord } from "./idb";
import type {
  CollectionName,
  DecisionPayload,
  Envelope,
  LogPayload,
  MemoryPayload,
  Receipt,
  SourceKind,
  VaultStats,
} from "./types";

export const DATA_COLLECTIONS: CollectionName[] = ["memories", "logs", "decisions", "receipts"];
const ALL_STORES: CollectionName[] = [
  ...DATA_COLLECTIONS,
  "identity",
  "gateway_log",
  "prt_events",
  "settings",
];

export async function addRecord<P = Record<string, unknown>>(
  store: CollectionName,
  payload: P,
  source: SourceKind,
  tags?: string[],
): Promise<Envelope<P>> {
  const prefix =
    store === "memories"
      ? "mem"
      : store === "logs"
        ? "log"
        : store === "decisions"
          ? "dec"
          : store === "receipts"
            ? "rcp"
            : store === "gateway_log"
              ? "gw"
              : store === "prt_events"
                ? "prt"
                : "rec";
  const rec: Envelope<P> = {
    id: makeId(prefix),
    ts: new Date().toISOString(),
    source,
    version: 1,
    ...(tags && tags.length ? { tags } : {}),
    payload,
  };
  await putRecord(store, rec as unknown as Envelope);
  return rec;
}

export async function listRecords<P = Record<string, unknown>>(
  store: CollectionName,
  opts?: { q?: string; limit?: number },
): Promise<Envelope<P>[]> {
  const all = await getAll<P>(store);
  let out = all;
  if (opts?.q) {
    const q = opts.q.toLowerCase();
    out = all.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }
  out = out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return opts?.limit ? out.slice(0, opts.limit) : out;
}

export async function removeRecord(store: CollectionName, id: string): Promise<void> {
  await delRecord(store, id);
}

export async function addMemory(
  payload: MemoryPayload,
  source: SourceKind = "ui",
  tags?: string[],
): Promise<Envelope<MemoryPayload>> {
  return addRecord<MemoryPayload>("memories", payload, source, tags);
}

export async function addLog(
  payload: LogPayload,
  source: SourceKind = "ui",
): Promise<Envelope<LogPayload>> {
  return addRecord<LogPayload>("logs", payload, source);
}

export async function addDecision(
  payload: DecisionPayload,
  source: SourceKind = "ui",
): Promise<Envelope<DecisionPayload>> {
  return addRecord<DecisionPayload>("decisions", payload, source);
}

export async function saveReceipt(rec: Receipt): Promise<Envelope<Receipt>> {
  return addRecord<Receipt>("receipts", rec, "ui");
}

export async function getIdentity(): Promise<Envelope | undefined> {
  const all = await getAll("identity");
  return all[0];
}

export async function putIdentity(payload: {
  username: string;
  keyHash: string;
  tier: string;
  tierUntil: string | null;
  createdAt: string;
}): Promise<void> {
  const existing = await getIdentity();
  const rec: Envelope = existing ?? {
    id: "identity_main",
    ts: new Date().toISOString(),
    source: "ui",
    version: 1,
    payload: {},
  };
  rec.payload = payload;
  await putRecord("identity", rec);
}

export async function getSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const rec = await getRecord("settings", key);
  return (rec?.payload as { value?: T })?.value ?? fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const rec: Envelope = {
    id: key,
    ts: new Date().toISOString(),
    source: "ui",
    version: 1,
    payload: { value },
  };
  await putRecord("settings", rec);
}

/** Perkiraan byte per koleksi (JSON.stringify, akurat cukup untuk meter UI). */
export async function vaultStats(): Promise<VaultStats> {
  const stores: CollectionName[] = [...ALL_STORES];
  const counts = {} as Record<CollectionName, number>;
  const bytes = {} as Record<CollectionName, number>;
  let totalBytes = 0;
  let totalRecords = 0;
  for (const s of stores) {
    const all = await getAll(s);
    counts[s] = all.length;
    bytes[s] = all.reduce((n, r) => n + JSON.stringify(r).length, 0);
    totalBytes += bytes[s];
    totalRecords += counts[s];
  }
  return { counts, bytes, totalBytes, totalRecords };
}

/** Ekspor kanonik — format terdokumentasi, tidak terkunci pada aplikasi ini. */
export async function exportVault(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    schema: "flybrain.vault/v1",
    exportedAt: new Date().toISOString(),
  };
  for (const s of ALL_STORES) {
    out[s] = await getAll(s);
  }
  return out;
}

/** Impor dengan merge by id (duplikat tidak tercipta). */
export async function importVault(data: unknown): Promise<{ imported: number }> {
  if (!data || typeof data !== "object") throw new Error("Berkas impor bukan objek JSON.");
  let imported = 0;
  for (const s of ALL_STORES) {
    const arr = (data as Record<string, unknown>)[s];
    if (!Array.isArray(arr)) continue;
    for (const rec of arr as Envelope[]) {
      if (!rec || typeof rec.id !== "string") continue;
      const existing = await getRecord(s, rec.id);
      if (!existing) {
        await putRecord(s, rec);
        imported += 1;
      }
    }
  }
  return { imported };
}

/** Hancurkan vault: hapus seluruh object store. Nyata dan tidak bisa dibatalkan. */
export async function wipeVault(): Promise<void> {
  for (const s of ALL_STORES) await clearStore(s);
}
