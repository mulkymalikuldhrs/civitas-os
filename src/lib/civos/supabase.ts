// CIVITAS OS — supabase.ts (SLICE 10 update)
// MIRROR PERSADABAN ke Supabase Dhaher Labs (ADR-0005) + TEST SUITE PENUH (mandat #9).
// Kernel SQLite tetap otoritatif; Supabase = cermin awan.
// Kredensial dari KONFIGURASI (UI) → fallback env. Tidak pernah dikirim ke klien.

import { db } from "@/lib/db";
import { getConfigValue } from "./config";

const KV_LAST_SEQ = "civsync.lastSeq";

export interface SupabaseCreds { url: string; key: string; enabled: boolean }

export async function supabaseCreds(): Promise<SupabaseCreds> {
  const url = (await getConfigValue("supabase.url")).replace(/\/+$/, "");
  const key = await getConfigValue("supabase.serviceKey");
  return { url, key, enabled: Boolean(url && key) };
}

async function rest(creds: SupabaseCreds, path: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown, prefer = "resolution=merge-duplicates,return=minimal"): Promise<{ ok: boolean; status: number; data: unknown }> {
  if (!creds.enabled) return { ok: false, status: 0, data: "supabase.url / supabase.serviceKey belum dikonfigurasi (isi di tab Konfigurasi)" };
  try {
    const res = await fetch(`${creds.url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: creds.key,
        Authorization: `Bearer ${creds.key}`,
        "Content-Type": "application/json",
        Prefer: prefer,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    return { ok: res.ok, status: res.status, data: res.ok ? null : await res.text() };
  } catch (e) {
    return { ok: false, status: 0, data: e instanceof Error ? e.message : "fetch gagal" };
  }
}

export interface SyncResult {
  ok: boolean;
  enabled: boolean;
  eventsPushed: number;
  txnsPushed: number;
  lastSeq: number;
  error?: string;
}

/** Cerinkan event+txn baru ke Supabase (idempoten, cursor KV). */
export async function pushMirror(): Promise<SyncResult> {
  const creds = await supabaseCreds();
  if (!creds.enabled) return { ok: false, enabled: false, eventsPushed: 0, txnsPushed: 0, lastSeq: 0, error: "kredensial supabase belum diisi (tab Konfigurasi)" };

  const kv = await db.civKV.findUnique({ where: { key: KV_LAST_SEQ } });
  const lastSeq = kv ? Number(kv.value) || 0 : 0;

  const events = await db.civEvent.findMany({ where: { seq: { gt: lastSeq } }, orderBy: { seq: "asc" }, take: 200 });
  const sinceTx = await db.civTxn.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { entries: { where: { side: "DEBIT" }, select: { amount: true } } },
  });

  let eventsPushed = 0;
  let txnsPushed = 0;
  let error: string | undefined;

  if (events.length > 0) {
    const rows = events.map((e) => ({
      seq: e.seq,
      type: e.type,
      subject_type: e.subjectType,
      subject_id: e.subjectId,
      payload: JSON.parse(e.payload || "{}"),
      created_at: e.createdAt.toISOString(),
    }));
    const r = await rest(creds, "civ_mirror_events", "POST", rows);
    if (!r.ok) error = `events: ${String(r.data).slice(0, 140)}`;
    else eventsPushed = rows.length;
  }

  if (!error && sinceTx.length > 0) {
    const rows = sinceTx.map((t) => ({
      tx_id: t.id,
      tx_type: t.txType,
      amount: t.entries.reduce((s, e) => s + e.amount, 0),
      is_external: t.isExternal,
      purpose: t.purpose,
      created_at: t.createdAt.toISOString(),
    }));
    const r = await rest(creds, "civ_mirror_txns", "POST", rows);
    if (!r.ok) error = `txns: ${String(r.data).slice(0, 140)}`;
    else txnsPushed = rows.length;
  }

  if (!error) {
    const counts = {
      orgs: await db.civOrg.count(),
      agents: await db.civAgent.count(),
      events: await db.civEvent.count(),
      txns: await db.civTxn.count(),
    };
    await rest(creds, "civ_mirror_state", "POST", [
      { key: "kernel", value: { counts, mirroredAt: new Date().toISOString(), source: "civitas-os-sqlite" } },
    ]);
    const maxSeq = events.length > 0 ? events[events.length - 1].seq : lastSeq;
    await db.civKV.upsert({ where: { key: KV_LAST_SEQ }, create: { key: KV_LAST_SEQ, value: String(maxSeq) }, update: { value: String(maxSeq) } });
    await rest(creds, "civ_sync_log", "POST", [{ events_pushed: eventsPushed, txns_pushed: txnsPushed, note: `cursor=${maxSeq}` }]);
    return { ok: true, enabled: true, eventsPushed, txnsPushed, lastSeq: maxSeq };
  }

  return { ok: false, enabled: true, eventsPushed, txnsPushed, lastSeq, error };
}

/** Baca log sinkron dari awan (bukti dua arah). */
export async function cloudStatus(): Promise<{ enabled: boolean; rows: { at: string; events_pushed: number; txns_pushed: number; note: string }[]; error?: string }> {
  const creds = await supabaseCreds();
  if (!creds.enabled) return { enabled: false, rows: [], error: "kredensial belum diisi" };
  try {
    const res = await fetch(`${creds.url}/rest/v1/civ_sync_log?select=at,events_pushed,txns_pushed,note&order=at.desc&limit=5`, {
      headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` },
      signal: AbortSignal.timeout(12_000),
    });
    const data = (await res.json()) as { at: string; events_pushed: number; txns_pushed: number; note: string }[];
    return { enabled: true, rows: Array.isArray(data) ? data : [] };
  } catch (e) {
    return { enabled: true, rows: [], error: e instanceof Error ? e.message : "gagal" };
  }
}

// ---------------------------------------------------------------------------
// SLICE 10 — TEST SUITE SUPABASE (mandat #9): ping, auth, tabel, kolom,
// roundtrip insert/read/delete. Hasil jujur per cek — tanpa mock.
// ---------------------------------------------------------------------------

export interface SupabaseTestResult {
  enabled: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
  passed: number;
  failed: number;
  at: string;
}

const EXPECTED_TABLES: Record<string, string[]> = {
  civ_mirror_events: ["seq", "type", "subject_type", "subject_id", "payload", "created_at"],
  civ_mirror_txns: ["tx_id", "tx_type", "amount", "is_external", "purpose", "created_at"],
  civ_mirror_state: ["key", "value", "updated_at"],
  civ_sync_log: ["at", "events_pushed", "txns_pushed", "note"],
};

export async function supabaseTest(): Promise<SupabaseTestResult> {
  const creds = await supabaseCreds();
  const checks: SupabaseTestResult["checks"] = [];
  const push = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  if (!creds.enabled) {
    push("konfigurasi", false, "supabase.url / supabase.serviceKey belum diisi (tab Konfigurasi)");
    const failed = checks.filter((c) => !c.ok).length;
    return { enabled: false, checks, passed: checks.length - failed, failed, at: new Date().toISOString() };
  }

  // 1. Ping REST root
  try {
    const res = await fetch(`${creds.url}/rest/v1/`, { headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` }, signal: AbortSignal.timeout(10_000) });
    push("REST terjangkau", res.status < 500, `HTTP ${res.status}`);
  } catch (e) {
    push("REST terjangkau", false, e instanceof Error ? e.message.slice(0, 120) : "gagal");
    const failed = checks.filter((c) => !c.ok).length;
    return { enabled: true, checks, passed: checks.length - failed, failed, at: new Date().toISOString() };
  }

  // 2. Auth service key (OpenAPI root butuh key valid)
  {
    const r = await rest(creds, "civ_sync_log?select=at&limit=1", "GET");
    push("service key valid", r.ok || r.status !== 401, r.ok ? "query OK" : `HTTP ${r.status} ${String(r.data).slice(0, 80)}`);
  }

  // 3. Struktur tabel + kolom
  for (const [table, cols] of Object.entries(EXPECTED_TABLES)) {
    const r = await rest(creds, `${table}?select=${cols.join(",")}&limit=1`, "GET");
    push(`tabel ${table}`, r.ok, r.ok ? `kolom ${cols.length}/${cols.length} ada` : `HTTP ${r.status} ${String(r.data).slice(0, 90)}`);
  }

  // 4. Roundtrip tulis/baca/hapus ke civ_sync_log
  {
    const marker = `test-${Date.now()}`;
    const ins = await rest(creds, "civ_sync_log", "POST", [{ events_pushed: 0, txns_pushed: 0, note: marker }]);
    push("roundtrip: tulis", ins.ok, ins.ok ? `note=${marker}` : `HTTP ${ins.status} ${String(ins.data).slice(0, 90)}`);
    const sel = await rest(creds, `civ_sync_log?select=id,note&note=eq.${marker}&limit=1`, "GET");
    push("roundtrip: baca", sel.ok, sel.ok ? "baris uji terbaca" : `HTTP ${sel.status}`);
    // F-03 FIX (review 16-h1): hapus memakai metode DELETE sungguhan (dulu POST —
    // cek ini tidak pernah bisa lolos karena PostgREST mengembalikan 405).
    const del = await rest(creds, `civ_sync_log?note=eq.${marker}`, "DELETE", undefined, "return=representation");
    const delOk = await rest(creds, `civ_sync_log?note=eq.${marker}&events_pushed=eq.0&txns_pushed=eq.0`, "GET");
    const gone = delOk.ok ? ((await (async () => { try { const res = await fetch(`${creds.url}/rest/v1/civ_sync_log?select=id&note=eq.${marker}`, { headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` }, signal: AbortSignal.timeout(8_000) }); const j = (await res.json()) as unknown[]; return j.length === 0; } catch { return false; } })())) : false;
    push("roundtrip: hapus", gone, gone ? "baris uji dibersihkan" : "baris uji masih ada (cek manual)");
  }

  const failed = checks.filter((c) => !c.ok).length;
  return { enabled: true, checks, passed: checks.length - failed, failed, at: new Date().toISOString() };
}

// ---------- MIRROR TOTAL (v1.4 "SYNC") ----------
// Mandat pemilik: "mount semua db di supabase" — SELURUH 24 tabel kernel dicerminkan
// ke Postgres Supabase (upsert idempoten by PK). Kernel SQLite tetap otoritatif;
// Supabase kini cermin LENGKAP, dipakai juga sebagai sumber data window publik (Vercel).

const FULL_MIRROR_TABLES: Array<{ model: string; table: string }> = [
  { model: "user", table: "User" },
  { model: "post", table: "Post" },
  { model: "civOrg", table: "CivOrg" },
  { model: "civVillager", table: "CivVillager" },
  { model: "civVillagerDirective", table: "CivVillagerDirective" },
  { model: "civMarketOffer", table: "CivMarketOffer" },
  { model: "civAgent", table: "CivAgent" },
  { model: "civAccount", table: "CivAccount" },
  { model: "civTxn", table: "CivTxn" }, // induk ledger dulu — CivEntry punya FK txId
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

export interface FullMirrorResult {
  ok: boolean;
  enabled: boolean;
  tables: number;
  rowsPushed: number;
  perTable: Array<{ table: string; rows: number; ok: boolean; err?: string }>;
  error?: string;
}

/** Cerminan penuh seluruh tabel kernel → Supabase (idempoten, batch 200 baris). */
export async function pushFullMirror(): Promise<FullMirrorResult> {
  const creds = await supabaseCreds();
  if (!creds.enabled) return { ok: false, enabled: false, tables: 0, rowsPushed: 0, perTable: [], error: "kredensial supabase belum diisi (config supabase.url / supabase.serviceKey)" };
  const delegates = db as unknown as Record<string, { findMany?: (a?: unknown) => Promise<Record<string, unknown>[]> } | undefined>;
  const perTable: FullMirrorResult["perTable"] = [];
  let rowsPushed = 0;
  let allOk = true;
  for (const t of FULL_MIRROR_TABLES) {
    const del = delegates[t.model];
    if (!del?.findMany) {
      perTable.push({ table: t.table, rows: 0, ok: false, err: "model tidak ditemukan" });
      allOk = false;
      continue;
    }
    try {
      const rows = await del.findMany({ take: 5000 });
      if (rows.length === 0) {
        perTable.push({ table: t.table, rows: 0, ok: true });
        continue;
      }
      let ok = true;
      let err: string | undefined;
      for (let i = 0; i < rows.length && ok; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const r = await rest(creds, t.table, "POST", chunk);
        if (!r.ok) { ok = false; err = String(r.data).slice(0, 140); }
      }
      if (ok) rowsPushed += rows.length; else allOk = false;
      perTable.push({ table: t.table, rows: ok ? rows.length : 0, ok, err });
    } catch (e) {
      perTable.push({ table: t.table, rows: 0, ok: false, err: e instanceof Error ? e.message.slice(0, 140) : "?" });
      allOk = false;
    }
  }
  // catat status mirror penuh (tabel status lama tetap dipakai — sudah ada sejak SLICE 10)
  await rest(creds, "civ_mirror_state", "POST", [{
    key: "full_mirror",
    value: { at: new Date().toISOString(), tables: FULL_MIRROR_TABLES.length, rowsPushed, ok: allOk, per: perTable.filter((p) => !p.ok).slice(0, 6) },
  }]).catch(() => undefined);
  return { ok: allOk, enabled: true, tables: FULL_MIRROR_TABLES.length, rowsPushed, perTable, error: allOk ? undefined : "sebagian tabel gagal — lihat perTable" };
}
