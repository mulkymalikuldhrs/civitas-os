// FLYBRAIN KERNEL — router.ts
// Router API virtual: semantik HTTP penuh tanpa jaringan (03 §3, 05 §2-3).
// Semua klien (UI, konsol uji, Service Worker) melewati satu fungsi ini.

import { verifyBearer } from "./auth";
import { buildAtlas, MACRO_FACTS } from "./connectome";
import { validateReceipt } from "./payment";
import { prt } from "./prt";
import {
  addDecision,
  addLog,
  addMemory,
  addRecord,
  exportVault,
  getIdentity,
  listRecords,
  putIdentity,
  removeRecord,
  vaultStats,
} from "./vault";
import type { DecisionPayload, GatewayLogPayload, KernelResponse, LogPayload, MemoryPayload, Receipt } from "./types";

// ---- Rate limiter PER-KUNCI (audit F-04) ----
// Dulu: satu array global untuk SEMUA pemanggil — burst satu kunci mengunci
// seluruh gerbang (429) dan GET lolos total. Kini: bucket per kunci (hash
// bearer, atau "anon"+route bila tanpa kunci), dipisah GET (longgar agar
// polling UI normal tidak kena 429) dan mutasi (ketat) + kuota tier per jam
// untuk non-GET. Murni in-memory — stateless tetap terjaga.
const RATE_GET_PER_MIN = 120;   // cap GET per menit per kunci (polling UI aman)
const RATE_MUTATE_PER_MIN = 30; // cap non-GET per menit per kunci
const RATE_MINUTE_MS = 60_000;
const RATE_HOUR_MS = 3_600_000;
const FREE_PER_HOUR = 60;
const PRO_PER_HOUR = 3600;

const buckets = new Map<string, number[]>();
let limiterCalls = 0;

function sweepBuckets(now: number): void {
  // Bersihkan bucket stale agar Map tidak tumbuh tanpa batas.
  for (const [k, hits] of buckets) {
    const last = hits[hits.length - 1];
    if (hits.length === 0 || last === undefined || now - last > RATE_HOUR_MS) buckets.delete(k);
  }
}

function rateLimited(key: string, cap: number, windowMs: number): boolean {
  const now = Date.now();
  limiterCalls += 1;
  if (limiterCalls % 64 === 0) sweepBuckets(now);
  const hits = buckets.get(key) ?? [];
  while (hits.length && now - hits[0] > windowMs) hits.shift();
  if (hits.length >= cap) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  return false;
}

function bucketHits(key: string): number {
  const now = Date.now();
  const hits = buckets.get(key) ?? [];
  while (hits.length && now - hits[0] > RATE_HOUR_MS) hits.shift();
  return hits.length;
}

// Diekspos untuk uji unit limiter (bun -e import langsung) — perilaku identik
// dengan yang dipakai handleKorteks; state tetap modul-level in-memory.
export { rateLimited, bucketHits };

function res(status: number, json: Record<string, unknown>, t0: number): KernelResponse {
  return { status, ok: status < 400, ms: Math.max(0, Math.round(performance.now() - t0)), json };
}

function err(status: number, code: string, message: string, t0: number): KernelResponse {
  return res(status, { ok: false, error: { code, message } }, t0);
}

interface RouterArgs {
  method: string;
  path: string;
  body?: unknown;
  bearer?: string | null;
  agent?: string;
}

/** Titik masuk tunggal seluruh gerbang. */
export async function handleKorteks(args: RouterArgs): Promise<KernelResponse> {
  const t0 = performance.now();
  const method = args.method.toUpperCase();
  const path = args.path.replace(/\/+$/, "") || "/";
  const session = verifyBearer(args.bearer ?? null);
  const t = performance.now();

  const logIt = async (status: number) => {
    try {
      await addRecord<GatewayLogPayload>(
        "gateway_log",
        { method, path, status, ms: Math.max(0, Math.round(performance.now() - t0)), agent: args.agent ?? "kernel-client" },
        "gateway",
      );
    } catch {
      /* penyimpanan tak tersedia — respons tetap dikirim */
    }
  };

  // Publik: ringkasan connectome (untuk demo/IoT tanpa kunci) — tetap dibatasi
  // per-route anon (tanpa kunci tidak punya hash bearer untuk dikunci).
  if (method === "GET" && path === "/v1/connectome/summary") {
    if (rateLimited(`anon:${path}`, RATE_GET_PER_MIN, RATE_MINUTE_MS)) {
      const out = err(429, "RATE_LIMITED", "Terlalu banyak panggilan publik ke rute ini — coba lagi sebentar.", t0);
      void logIt(429);
      return out;
    }
    const atlas = buildAtlas();
    const out = res(200, {
      ok: true,
      virtual: { neurons: atlas.neurons.length, edges: atlas.edges.length, regions: atlas.regions.length },
      real: { female_fafb: MACRO_FACTS.female, male_cns: MACRO_FACTS.male, attribution: "FlyWire / Janelia — CC BY-NC 4.0" },
    }, t0);
    void logIt(200);
    return out;
  }

  if (!session) {
    const out = err(401, "UNAUTHORIZED", "Bearer kunci FK1_ tidak sah atau identitas belum dibuat di perangkat ini.", t0);
    void logIt(401);
    return out;
  }

  const identityEnv = await getIdentity();
  const idp = (identityEnv?.payload ?? {}) as { username?: string; tier?: string; tierUntil?: string | null };
  const tier = idp.tier === "PRO" && idp.tierUntil && new Date(idp.tierUntil).getTime() > Date.now() ? "PRO" : "FREE";

  // Rate limit PER-KUNCI (audit F-04): kunci = hash bearer (atau anon+route).
  // GET dibatasi longgar per menit; mutasi juga tunduk pada kuota tier per jam.
  const limiterKey = session.keyHash || `anon:${path.split("?")[0]}`;
  const isGet = method === "GET";
  const minuteKey = `${limiterKey}:${isGet ? "get" : "mutate"}`;
  const minuteCap = isGet ? RATE_GET_PER_MIN : RATE_MUTATE_PER_MIN;
  const overMinute = rateLimited(minuteKey, minuteCap, RATE_MINUTE_MS);
  const overHour = !isGet && rateLimited(`${limiterKey}:hour`, tier === "PRO" ? PRO_PER_HOUR : FREE_PER_HOUR, RATE_HOUR_MS);
  if (overMinute || overHour) {
    const out = err(
      429,
      "RATE_LIMITED",
      `Kuota gerbang kunci ini terlampaui (${isGet ? `${RATE_GET_PER_MIN}/menit` : `${RATE_MUTATE_PER_MIN}/menit + ${tier === "PRO" ? PRO_PER_HOUR : FREE_PER_HOUR}/jam`}). Coba lagi nanti.`,
      t0,
    );
    void logIt(429);
    return out;
  }

  // ---- identity ----
  if (path === "/v1/identity/verify" && method === "POST") {
    const out = res(200, { ok: true, username: idp.username ?? session.username, tier, tierUntil: idp.tierUntil ?? null }, t0);
    void logIt(200);
    return out;
  }

  // ---- memory ----
  if (path === "/v1/memory" && method === "GET") {
    const qs = new URLSearchParams(args.path.split("?")[1] ?? "");
    const q = qs.get("q") ?? undefined;
    const kind = qs.get("kind") ?? undefined;
    const limit = Math.min(200, Number(qs.get("limit") ?? 50) || 50);
    let items = await listRecords<MemoryPayload>("memories", { q, limit: 400 });
    if (kind) items = items.filter((r) => r.payload.kind === kind);
    const scored = items
      .map((r) => {
        const hay = `${r.payload.title} ${r.payload.content} ${(r.tags ?? []).join(" ")}`.toLowerCase();
        const kw = (q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
        const score = kw.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
        return { r, score };
      })
      .sort((a, b) => b.score - a.score || (a.r.ts < b.r.ts ? 1 : -1))
      .slice(0, limit)
      .map(({ r, score }) => ({ id: r.id, ts: r.ts, source: r.source, tags: r.tags ?? [], score, ...r.payload }));
    const out = res(200, { ok: true, count: scored.length, items: scored }, t0);
    void logIt(200);
    return out;
  }

  if (path === "/v1/memory" && method === "POST") {
    const b = (args.body ?? {}) as Partial<MemoryPayload> & { tags?: string[] };
    if (!b.title || !b.content) {
      const out = err(400, "BAD_REQUEST", "Field 'title' dan 'content' wajib.", t0);
      void logIt(400);
      return out;
    }
    const rec = await addMemory(
      { title: String(b.title).slice(0, 160), content: String(b.content).slice(0, 8000), kind: b.kind ?? "episodic" },
      "gateway",
      Array.isArray(b.tags) ? b.tags.map(String).slice(0, 8) : undefined,
    );
    const out = res(201, { ok: true, id: rec.id, ts: rec.ts }, t0);
    void logIt(201);
    return out;
  }

  if (path === "/v1/memory" && method === "DELETE") {
    const qs = new URLSearchParams(args.path.split("?")[1] ?? "");
    const id = qs.get("id");
    if (!id) {
      const out = err(400, "BAD_REQUEST", "Parameter 'id' wajib.", t0);
      void logIt(400);
      return out;
    }
    await removeRecord("memories", id);
    const out = res(200, { ok: true, deleted: id }, t0);
    void logIt(200);
    return out;
  }

  // ---- logs ----
  if (path === "/v1/logs" && method === "GET") {
    const limit = 100;
    const items = await listRecords<LogPayload>("logs", { limit });
    const out = res(200, { ok: true, count: items.length, items: items.map((r) => ({ id: r.id, ts: r.ts, source: r.source, ...r.payload })) }, t0);
    void logIt(200);
    return out;
  }
  if (path === "/v1/logs" && method === "POST") {
    const b = (args.body ?? {}) as Partial<LogPayload>;
    if (!b.message) {
      const out = err(400, "BAD_REQUEST", "Field 'message' wajib.", t0);
      void logIt(400);
      return out;
    }
    const rec = await addLog(
      { channel: b.channel ?? "external", level: b.level ?? "info", message: String(b.message).slice(0, 2000) },
      "gateway",
    );
    const out = res(201, { ok: true, id: rec.id }, t0);
    void logIt(201);
    return out;
  }

  // ---- decisions ----
  if (path === "/v1/decisions" && method === "GET") {
    const items = await listRecords<DecisionPayload>("decisions", { limit: 100 });
    const out = res(200, { ok: true, count: items.length, items: items.map((r) => ({ id: r.id, ts: r.ts, source: r.source, ...r.payload })) }, t0);
    void logIt(200);
    return out;
  }
  if (path === "/v1/decisions" && method === "POST") {
    const b = (args.body ?? {}) as Partial<DecisionPayload>;
    if (!b.choice) {
      const out = err(400, "BAD_REQUEST", "Field 'choice' wajib.", t0);
      void logIt(400);
      return out;
    }
    const rec = await addDecision(
      { context: String(b.context ?? "").slice(0, 800), choice: String(b.choice).slice(0, 400), rationale: String(b.rationale ?? "").slice(0, 2000) },
      "gateway",
    );
    const out = res(201, { ok: true, id: rec.id }, t0);
    void logIt(201);
    return out;
  }

  // ---- vault export ----
  if (path === "/v1/vault/export" && method === "GET") {
    const data = await exportVault();
    const out = res(200, { ok: true, vault: data }, t0);
    void logIt(200);
    return out;
  }

  // ---- payment ----
  if (path === "/v1/payment/verify" && method === "POST") {
    const b = (args.body ?? {}) as { receipt?: unknown };
    if (!identityEnv) {
      const out = err(400, "BAD_REQUEST", "Identitas lokal belum ada.", t0);
      void logIt(400);
      return out;
    }
    // Normalisasi kwitansi (audit F-05): boleh dikirim sebagai STRING JSON
    // (paste di UI) — parse SEKALI di sini agar validasi, dedupe, dan
    // penyimpanan semuanya memakai OBJEK (receipt_id tidak pernah undefined).
    let receiptObj: unknown = b.receipt;
    if (typeof receiptObj === "string") {
      try {
        receiptObj = JSON.parse(receiptObj);
      } catch {
        const out = res(422, { ok: false, error: { code: "RECEIPT_REJECTED", message: "Kwitansi bukan JSON yang sah." } }, t0);
        void logIt(422);
        return out;
      }
    }
    const verdict = await validateReceipt(receiptObj, idp.username ?? session.username);
    if (!verdict.valid || !verdict.tier) {
      const out = res(422, { ok: false, error: { code: "RECEIPT_REJECTED", message: verdict.reason } }, t0);
      void logIt(422);
      return out;
    }
    await putIdentity({
      username: idp.username ?? session.username,
      keyHash: session.keyHash,
      tier: verdict.tier,
      tierUntil: verdict.until,
      createdAt: (identityEnv.ts as string) ?? new Date().toISOString(),
    });
    // simpan kwitansi ke vault user (dedupe by receipt_id pada OBJEK ter-parse —
    // data user, di perangkat user; payload tersimpan sebagai objek, bukan string)
    const incoming = receiptObj as Receipt;
    const existing = await listRecords<Receipt>("receipts", { limit: 200 });
    if (!existing.some((r) => r.payload.receipt_id === incoming?.receipt_id)) {
      await addRecord<Receipt>("receipts", incoming, "gateway");
    }
    const out = res(200, { ok: true, tier: verdict.tier, until: verdict.until, note: "Terkunci lokal. Kami tidak menyimpan apa pun." }, t0);
    void logIt(200);
    return out;
  }

  // ---- system status ----
  if (path === "/v1/system/status" && method === "GET") {
    const stats = await vaultStats();
    const atlas = buildAtlas();
    const out = res(200, {
      ok: true,
      tier,
      username: idp.username ?? session.username,
      vault: { totalRecords: stats.totalRecords, totalBytes: stats.totalBytes, counts: stats.counts },
      gateway: {
        windowHits: bucketHits(`${limiterKey}:mutate`),
        minuteHits: bucketHits(minuteKey),
        quotaPerHour: tier === "PRO" ? PRO_PER_HOUR : FREE_PER_HOUR,
        limiter: "per-kunci (hash bearer) — GET 120/menit, mutasi 30/menit + kuota tier/jam",
      },
      prt: { beat: prt.beat, vitals: prt.vitals, running: prt.running },
      connectome: { virtualNeurons: atlas.neurons.length, virtualEdges: atlas.edges.length },
      sessionAgeMs: Date.now() - new Date(session.createdAt).getTime(),
    }, t0);
    void logIt(200);
    return out;
  }

  // ---- prt chat ----
  if (path === "/v1/prt/chat" && method === "POST") {
    const b = (args.body ?? {}) as { message?: string };
    if (!b.message) {
      const out = err(400, "BAD_REQUEST", "Field 'message' wajib.", t0);
      void logIt(400);
      return out;
    }
    const ans = await prt.chat(String(b.message).slice(0, 1000));
    const out = res(200, { ok: true, reply: ans.reply, mood: ans.mood }, t0);
    void logIt(200);
    return out;
  }

  const out = err(404, "NOT_FOUND", `Rute ${method} ${path.split("?")[0]} tidak dikenal gerbang.`, t0);
  void logIt(404);
  return out;
}
