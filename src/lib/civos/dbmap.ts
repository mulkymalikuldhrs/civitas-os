// CIVITAS OS — dbmap.ts (v1.5 "CITADEL" — PETA DATABASE PENUH)
// Mandat pemilik: "map semua db yang ada di supabase (semua table, db, column, semuanya)".
// Sumber data NYATA:
//   1. PostgREST OpenAPI spec (GET /rest/v1/)  -> semua tabel + kolom + tipe + PK
//   2. Prefer: count=exact per tabel           -> jumlah baris persis (Content-Range)
//   3. Storage API (GET /storage/v1/bucket)    -> bucket backup
//   4. Kernel SQLite (Prisma count)            -> perbandingan lokal vs awan
// Cache KV 60 dtk agar UI realtime tetap cepat; kegagalan dilaporkan jujur per tabel.

import { db } from "@/lib/db";
import { supabaseCreds } from "./supabase";
import { getConfigValue } from "./config";

const KV_CACHE = "civsync.dbmapCache";
const CACHE_TTL_MS = 60_000;

export interface DbMapColumn { name: string; type: string; required: boolean; pk: boolean }
export interface DbMapTable { name: string; columns: DbMapColumn[]; rows: number | null; error?: string }
export interface DbBucket { name: string; public: boolean; error?: string }
export interface KernelTable { model: string; table: string; rows: number }
export interface DbMapResult {
  at: string;
  ok: boolean;
  cloud: { url: string; tables: DbMapTable[]; buckets: DbBucket[]; error?: string };
  kernel: { tables: KernelTable[]; totalRows: number; error?: string };
  cached: boolean;
}

const KERNEL_MODELS: Array<{ model: string; table: string }> = [
  { model: "civOrg", table: "CivOrg" },
  { model: "civVillager", table: "CivVillager" },
  { model: "civVillagerDirective", table: "CivVillagerDirective" },
  { model: "civMarketOffer", table: "CivMarketOffer" },
  { model: "civAgent", table: "CivAgent" },
  { model: "civAccount", table: "CivAccount" },
  { model: "civTxn", table: "CivTxn" },
  { model: "civEntry", table: "CivEntry" },
  { model: "civEvent", table: "CivEvent" },
  { model: "civTask", table: "CivTask" },
  { model: "civMemory", table: "CivMemory" },
  { model: "civPolicy", table: "CivPolicy" },
  { model: "civCapability", table: "CivCapability" },
  { model: "civGrant", table: "CivGrant" },
  { model: "civProposal", table: "CivProposal" },
  { model: "civWorldEntity", table: "CivWorldEntity" },
  { model: "civKV", table: "CivKV" },
  { model: "civArtifact", table: "CivArtifact" },
  { model: "civToolCall", table: "CivToolCall" },
  { model: "civChatMessage", table: "CivChatMessage" },
  { model: "civMcpServer", table: "CivMcpServer" },
  { model: "civConsoleLog", table: "CivConsoleLog" },
];

async function cloudHeaders(key: string): Promise<Record<string, string>> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** Ambil definisi tabel+kolom dari OpenAPI spec PostgREST. */
export async function fetchSchema(creds: { url: string; key: string }): Promise<{ tables: DbMapTable[]; error?: string }> {
  try {
    const res = await fetch(`${creds.url}/rest/v1/`, { headers: await cloudHeaders(creds.key), signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { tables: [], error: `OpenAPI HTTP ${res.status}` };
    const spec = (await res.json()) as {
      definitions?: Record<string, { properties?: Record<string, { type?: string; format?: string; description?: string }>; required?: string[] }>;
    };
    const defs = spec.definitions ?? {};
    const tables: DbMapTable[] = Object.entries(defs).map(([name, def]) => {
      const cols: DbMapColumn[] = Object.entries(def.properties ?? {}).map(([col, meta]) => ({
        name: col,
        type: [meta.type, meta.format].filter(Boolean).join("·") || "unknown",
        required: (def.required ?? []).includes(col),
        pk: Boolean(meta.description && meta.description.includes("<pk/>")),
      }));
      return { name, columns: cols, rows: null };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return { tables };
  } catch (e) {
    return { tables: [], error: e instanceof Error ? e.message.slice(0, 160) : "gagal ambil skema" };
  }
}

/** Jumlah baris persis per tabel via Content-Range (Prefer: count=exact). */
async function countRows(creds: { url: string; key: string }, table: string): Promise<{ rows: number | null; error?: string }> {
  try {
    const res = await fetch(`${creds.url}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`, {
      headers: { ...(await cloudHeaders(creds.key)), Prefer: "count=exact", Range: "0-0" },
      signal: AbortSignal.timeout(10_000),
    });
    const range = res.headers.get("content-range");
    if (range) {
      const total = range.split("/")[1];
      if (total && total !== "*") return { rows: Number(total) || 0 };
    }
    if (res.status === 404) return { rows: null, error: "tabel tidak ada" };
    if (res.status === 401 || res.status === 403) return { rows: null, error: `akses ditolak (HTTP ${res.status})` };
    return { rows: null, error: `HTTP ${res.status} tanpa content-range` };
  } catch (e) {
    return { rows: null, error: e instanceof Error ? e.message.slice(0, 120) : "count gagal" };
  }
}

/** Daftar bucket storage. */
export async function fetchBuckets(creds: { url: string; key: string }): Promise<{ buckets: DbBucket[]; error?: string }> {
  try {
    const res = await fetch(`${creds.url}/storage/v1/bucket`, { headers: await cloudHeaders(creds.key), signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return { buckets: [], error: `Storage HTTP ${res.status}` };
    const data = (await res.json()) as Array<{ name?: string; id?: string; public?: boolean }>;
    return { buckets: (Array.isArray(data) ? data : []).map((b) => ({ name: b.name ?? b.id ?? "?", public: Boolean(b.public) })) };
  } catch (e) {
    return { buckets: [], error: e instanceof Error ? e.message.slice(0, 120) : "storage gagal" };
  }
}

/** Hitung baris kernel SQLite (Prisma). */
export async function kernelCounts(): Promise<{ tables: KernelTable[]; totalRows: number; error?: string }> {
  const delegates = db as unknown as Record<string, { count: (a?: unknown) => Promise<number> }>;
  const tables: KernelTable[] = [];
  let total = 0;
  let err: string | undefined;
  await Promise.all(KERNEL_MODELS.map(async (m) => {
    try {
      const n = await delegates[m.model].count();
      tables.push({ model: m.model, table: m.table, rows: n });
      total += n;
    } catch (e) {
      tables.push({ model: m.model, table: m.table, rows: -1 });
      err = e instanceof Error ? e.message.slice(0, 120) : "count kernel gagal";
    }
  }));
  tables.sort((a, b) => a.table.localeCompare(b.table));
  return { tables, totalRows: total, error: err };
}

/** Peta lengkap dengan cache 60 dtk. */
export async function dbMap(): Promise<DbMapResult> {
  const cachedRow = await db.civKV.findUnique({ where: { key: KV_CACHE } });
  if (cachedRow) {
    try {
      const c = JSON.parse(cachedRow.value) as DbMapResult;
      if (c?.at && Date.now() - new Date(c.at).getTime() < CACHE_TTL_MS) return { ...c, cached: true };
    } catch { /* cache rusak — ambil baru */ }
  }
  const result = await dbMapFresh();
  await db.civKV.upsert({
    where: { key: KV_CACHE },
    create: { key: KV_CACHE, value: JSON.stringify(result) },
    update: { value: JSON.stringify(result) },
  }).catch(() => undefined);
  return { ...result, cached: false };
}

/** Peta segar (tanpa cache) — dipakai dbMap dan pemaksaan refresh. */
export async function dbMapFresh(): Promise<DbMapResult> {
  const creds = await supabaseCreds();
  const kernel = await kernelCounts();
  if (!creds.enabled) {
    return { at: new Date().toISOString(), ok: false, cloud: { url: "", tables: [], buckets: [], error: "kredensial supabase belum diisi (config supabase.url/serviceKey)" }, kernel, cached: false };
  }
  const { url, key } = creds;
  const schema = await fetchSchema({ url, key });
  const buckets = await fetchBuckets({ url, key });
  // hitung baris per tabel (chunk 8 paralel agar tidak menabrak limit edge)
  const tables: DbMapTable[] = [];
  for (let i = 0; i < schema.tables.length; i += 8) {
    const chunk = schema.tables.slice(i, i + 8);
    await Promise.all(chunk.map(async (t) => {
      const c = await countRows({ url, key }, t.name);
      tables.push({ ...t, rows: c.rows, error: c.error });
    }));
  }
  tables.sort((a, b) => a.name.localeCompare(b.name));
  return {
    at: new Date().toISOString(),
    ok: !schema.error,
    cloud: { url, tables, buckets: buckets.buckets, error: schema.error ?? buckets.error },
    kernel,
    cached: false,
  };
}

/** Konfigurasi URL+port server untuk UI (P3: url server terpampang). */
export async function hostInfo(): Promise<{ hostnames: string[]; java: string; bedrock: string; aternos: string; platform: string; uptimeSec: number; nodeVersion: string }> {
  const os = await import("node:os");
  const nets = os.networkInterfaces();
  const hostnames: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] ?? []) {
      if (ni.family === "IPv4" && !ni.internal) hostnames.push(ni.address);
    }
  }
  const aternos = (await getConfigValue("mc.remoteHost")) || "mulkymalikuldhr.aternos.me";
  return {
    hostnames: hostnames.length ? hostnames : ["127.0.0.1"],
    java: "25565 (edisi Java/PC)",
    bedrock: "19132 (edisi Bedrock/Mobile/Console)",
    aternos: `${aternos}:19132 (Bedrock, awan — tidur otomatis)`,
    platform: `${os.type()} ${os.arch()} · ${os.cpus().length} vCPU · ${Math.round(os.totalmem() / 1e9)} GB`,
    uptimeSec: Math.round(os.uptime()),
    nodeVersion: process.version,
  };
}
