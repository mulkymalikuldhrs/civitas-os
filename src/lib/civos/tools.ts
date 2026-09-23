// CIVITAS OS — tools.ts
// SLICE 9: TOOLFORGE — tool calling NYATA untuk warga guild + agen institusi.
//
// Prinsip (Intelligence ≠ Authority, berlaku juga untuk tool):
//  • SEMUA panggilan tool lewat invokeTool() — tidak ada jalur lain.
//  • Otorisasi = CHARTER DIVISI (warga) atau GRANT capability (agen) — kernel,
//    bukan keputusan LLM. Warga umum (GENERAL) tidak punya tool apa pun.
//  • SEMUA panggilan tercatat di CivToolCall (+ event TOOL_INVOKED): OK, DENIED,
//    FAILED, TIMEOUT — tidak ada tool hantu. Kegagalan internet dilaporkan jujur.
//  • Hasil kerja menjadi CivArtifact (bukti kerja nyata) + event ARTIFACT_CREATED.
//  • web_search / page_reader memakai z-ai-web-dev-sdk → INTERNET NYATA, hasil
//    dilabeli sumber URL. Bila jaringan mati → FAILED dengan alasan, bukan karangan.
//
// Limit di luar LLM: TOOL_MAX_PER_PULSE, WEB_SEARCH_MAX_RESULTS, TOOL_TIMEOUT_MS,
// ARTIFACT_MAX_CHARS, MINE_YIELD_MAX_UNITS, BUILD_MAX_FOOTPRINT, PATROL_RADIUS_MAX.

import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { emit } from "./events";
import { getPolicy } from "./policy";
import { divisionMeta, DIVISIONS } from "./types";
import { enqueueDirective, type DirectivePayload } from "./directives";
import { listOffer } from "./market";
import { EVENT_TYPES, KV_TOOL_SEQ } from "./types";

// ---------- Registry ----------

export interface ToolSpec {
  key: string;
  label: string;
  desc: string;
  capability: string; // key capability (grant agen) — warga memakai charter divisi
  external: boolean; // true = menyentuh internet nyata
}

export const TOOL_REGISTRY: ToolSpec[] = [
  { key: "web_search", label: "Pencari Internet", desc: "Pencarian web NYATA — hasil ber-URL sumber", capability: "tool.web_search", external: true },
  { key: "page_reader", label: "Pembaca Halaman", desc: "Baca satu halaman web nyata jadi riset", capability: "tool.page_reader", external: true },
  { key: "code_write", label: "Penulis Kode", desc: "Artefak kode TypeScript nyata untuk peradaban", capability: "tool.code_write", external: false },
  { key: "spec_write", label: "Penulis Spesifikasi", desc: "Spesifikasi produk / rencana pengembangan", capability: "tool.spec_write", external: false },
  { key: "build_plan", label: "Perancang Bangunan", desc: "Blueprint konstruksi + direktif BUILD ke tubuh", capability: "tool.build_plan", external: false },
  { key: "mine_route", label: "Perancang Tambang", desc: "Rute tambang + hasil tambang dilist ke pasar desa", capability: "tool.mine_route", external: false },
  { key: "patrol_report", label: "Laporan Patroli", desc: "Patroli garda + direktif PATROL ke tubuh", capability: "tool.patrol_report", external: false },
  { key: "mcp_call", label: "Jembatan MCP", desc: "Panggil tool server MCP terdaftar (integrasi eksternal nyata)", capability: "tool.mcp_call", external: false },
];

export function toolSpec(key: string): ToolSpec | null {
  return TOOL_REGISTRY.find((t) => t.key === key) ?? null;
}

// ---------- Pemanggil ----------

export interface ToolCaller {
  type: "VILLAGER" | "AGENT" | "KERNEL";
  id?: string | null;
  code: string;
  name: string;
  /** warga: divisi menentukan charter; agen: grant table; kernel: kebal. */
  division?: string;
  /** koordinat tubuh warga (untuk site BUILD/PATROL/MINE). */
  mcCoords?: string;
}

export interface ToolResult {
  ok: boolean;
  status: "OK" | "DENIED" | "FAILED" | "TIMEOUT";
  note: string;
  artifactId?: string;
  artifactTitle?: string;
  latencyMs: number;
  callId?: string;
}

/** Hasil eksekusi internal tool (sebelum audit ditulis). */
interface ToolExec {
  status: "OK" | "FAILED" | "TIMEOUT";
  note: string;
  artifactId?: string;
  artifactTitle?: string;
  output?: Record<string, unknown>;
  error?: string;
}

// ---------- Util ----------

function clampStr(s: unknown, max: number): string {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

async function nextToolSeq(): Promise<number> {
  const row = await db.civKV.findUnique({ where: { key: KV_TOOL_SEQ } });
  const n = (row ? Number(row.value) || 0 : 0) + 1;
  await db.civKV.upsert({ where: { key: KV_TOOL_SEQ }, create: { key: KV_TOOL_SEQ, value: String(n) }, update: { value: String(n) } });
  return n;
}

function parseCoords(mcCoords: string | undefined): { x: number; y: number; z: number } | null {
  if (!mcCoords) return null;
  try {
    const v = JSON.parse(mcCoords) as { x?: unknown; y?: unknown; z?: unknown };
    if (typeof v.x === "number" && typeof v.y === "number" && typeof v.z === "number") return { x: v.x, y: v.y, z: v.z };
  } catch { /* koordinat rusak → null (jujur) */ }
  return null;
}

async function saveArtifact(a: {
  kind: string; title: string; content: string; caller: ToolCaller; tool: string; orgId?: string | null; meta?: Record<string, unknown>;
}): Promise<{ id: string; title: string }> {
  const maxChars = (await getPolicy<number>("ARTIFACT_MAX_CHARS")) ?? 4_000;
  const row = await db.civArtifact.create({
    data: {
      kind: a.kind,
      title: a.title.slice(0, 160),
      content: a.content.slice(0, maxChars),
      authorType: a.caller.type,
      authorId: a.caller.id ?? null,
      authorCode: a.caller.code,
      authorName: a.caller.name,
      division: a.caller.division ?? "GENERAL",
      orgId: a.orgId ?? null,
      tool: a.tool,
      meta: JSON.stringify(a.meta ?? {}),
    },
  });
  await emit({
    type: EVENT_TYPES.ARTIFACT_CREATED,
    subjectType: "ARTIFACT",
    subjectId: row.id,
    payload: { jenis: a.kind, judul: row.title, oleh: `${a.caller.name} (${a.caller.code})`, divisi: a.caller.division ?? "GENERAL", tool: a.tool },
  });
  return { id: row.id, title: row.title };
}

/** Otorisasi tool: charter divisi (warga) / grant (agen) / kebal (kernel). */
async function authorize(caller: ToolCaller, spec: ToolSpec): Promise<{ ok: boolean; reason: string }> {
  if (caller.type === "KERNEL") return { ok: true, reason: "kernel" };
  if (caller.type === "VILLAGER") {
    const charter = divisionMeta(caller.division ?? "GENERAL").tools;
    if (charter.includes(spec.key)) return { ok: true, reason: `charter divisi ${caller.division}` };
    return { ok: false, reason: `divisi ${caller.division ?? "GENERAL"} tidak punya charter ${spec.key} (kernel, bukan LLM)` };
  }
  // AGENT — grant table (capability short-lived, revocable)
  if (!caller.id) return { ok: false, reason: "agen tanpa id — grant tak mungkin" };
  const grant = await db.civGrant.findUnique({ where: { agentId_capabilityKey: { agentId: caller.id, capabilityKey: spec.capability } } });
  if (!grant) return { ok: false, reason: `agen ${caller.code} tanpa grant ${spec.capability}` };
  if (grant.expiresAt && grant.expiresAt.getTime() < Date.now()) return { ok: false, reason: `grant ${spec.capability} kedaluwarsa` };
  return { ok: true, reason: `grant ${spec.capability}` };
}

async function recordCall(c: {
  caller: ToolCaller; spec: ToolSpec; input: Record<string, unknown>; status: ToolResult["status"];
  note: string; latencyMs: number; artifactId?: string; error?: string; output?: Record<string, unknown>;
}): Promise<string> {
  const seq = await nextToolSeq();
  const row = await db.civToolCall.create({
    data: {
      tool: c.spec.key,
      callerType: c.caller.type,
      callerId: c.caller.id ?? null,
      callerCode: c.caller.code,
      callerName: c.caller.name,
      input: JSON.stringify(c.input).slice(0, 600),
      output: c.output ? JSON.stringify(c.output).slice(0, 1200) : null,
      status: c.status,
      error: c.error?.slice(0, 240) ?? null,
      latencyMs: c.latencyMs,
      artifactId: c.artifactId ?? null,
      seq,
    },
  });
  await emit({
    type: EVENT_TYPES.TOOL_INVOKED,
    subjectType: "TOOL",
    subjectId: c.spec.key,
    payload: {
      seq, oleh: `${c.caller.name} (${c.caller.code})`, pemanggil: c.caller.type, status: c.status,
      ringkasan: c.note.slice(0, 160), latensi: c.latencyMs, eksternal: c.spec.external,
    },
  });
  return row.id;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${label} melebihi ${ms} ms (timeout — jujur)`)), ms)),
  ]);
}

// ---------- Implementasi tool (murni: eksekusi + artefak, TANPA audit) ----------

const DEFAULT_QUERIES = [
  "harga gandum dunia terkini",
  "berita kecerdasan buatan terbaru",
  "cuaca jakarta hari ini",
  "harga besi baja komoditas hari ini",
  "pembaruan minecraft bedrock terbaru",
  "teknik pertanian modern",
  "strategi ekonomi desa",
  "keamanan siber dasar",
];

async function toolWebSearch(input: Record<string, unknown>, caller: ToolCaller, seq: number): Promise<ToolExec> {
  const maxResults = (await getPolicy<number>("WEB_SEARCH_MAX_RESULTS")) ?? 5;
  const timeout = (await getPolicy<number>("TOOL_TIMEOUT_MS")) ?? 20_000;
  const query = clampStr(input.query, 200) || DEFAULT_QUERIES[seq % DEFAULT_QUERIES.length];
  try {
    const zai = await ZAI.create();
    const results = (await withTimeout(
      zai.functions.invoke("web_search", { query, num: Math.max(1, Math.min(maxResults, 8)) }),
      timeout,
      "web_search",
    )) as { url?: string; name?: string; snippet?: string; host_name?: string }[];
    if (!Array.isArray(results) || results.length === 0) {
      return { status: "FAILED", note: `internet menjawab tanpa hasil untuk "${query}"`, error: "hasil kosong" };
    }
    const lines = results.map((r, i) => `${i + 1}. ${r.name ?? "(tanpa judul)"}\n   sumber: ${r.host_name ?? "?"} — ${r.url ?? "?"}\n   ${String(r.snippet ?? "").replace(/\s+/g, " ").slice(0, 220)}`);
    const urls = results.map((r) => r.url ?? "").filter(Boolean).slice(0, 8);
    const art = await saveArtifact({
      kind: "RESEARCH",
      title: `Riset internet: "${query}"`,
      content: `Kueri internet NYATA: "${query}"\nDilakukan oleh ${caller.name} (${caller.code}) via tool web_search.\n\n${lines.join("\n\n")}\n\n[BUKTI: ${urls.length} URL sumber nyata — internet menyaksikan riset ini]`,
      caller, tool: "web_search",
      meta: { kueri: query, sumber: urls, catatan: "internet nyata via z-ai web_search" },
    });
    return { status: "OK", note: `riset internet nyata "${query}" — ${results.length} sumber tercatat`, artifactId: art.id, artifactTitle: art.title, output: { kueri: query, jumlahSumber: results.length } };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "internet tak terjangkau";
    return { status: /melebihi .* ms/.test(msg) ? "TIMEOUT" : "FAILED", note: `web_search gagal (jujur): ${msg}`, error: msg };
  }
}

async function toolPageReader(input: Record<string, unknown>, caller: ToolCaller): Promise<ToolExec> {
  const timeout = (await getPolicy<number>("TOOL_TIMEOUT_MS")) ?? 20_000;
  const url = clampStr(input.url, 300);
  if (!/^https?:\/\//i.test(url)) {
    return { status: "FAILED", note: "url tidak valid — page_reader butuh http(s):// eksplisit", error: "url tak valid" };
  }
  try {
    const zai = await ZAI.create();
    const page = (await withTimeout(zai.functions.invoke("page_reader", { url }), timeout, "page_reader")) as {
      code?: number; data?: { html?: string; title?: string; url?: string };
    };
    const title = String(page?.data?.title ?? "(tanpa judul)").slice(0, 140);
    const html = String(page?.data?.html ?? "");
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return { status: "FAILED", note: `halaman ${url} tak terbaca isinya (jujur)`, error: "konten kosong" };
    const art = await saveArtifact({
      kind: "RESEARCH",
      title: `Bacaan internet: ${title}`,
      content: `URL NYATA: ${url}\nDibaca oleh ${caller.name} (${caller.code}) via tool page_reader.\nJudul: ${title}\n\n${text.slice(0, 2000)}\n\n[BUKTI: halaman diambil dari internet pada panggilan ini]`,
      caller, tool: "page_reader",
      meta: { url, judul: title, catatan: "internet nyata via z-ai page_reader" },
    });
    return { status: "OK", note: `halaman internet nyata terbaca: "${title}" (${text.length} karakter)`, artifactId: art.id, artifactTitle: art.title, output: { url, judul: title } };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "halaman tak terjangkau";
    return { status: /melebihi .* ms/.test(msg) ? "TIMEOUT" : "FAILED", note: `page_reader gagal (jujur): ${msg}`, error: msg };
  }
}

/** Template kode deterministik (kernel) — jujur: bukan keluaran LLM. Berguna nyata
 *  untuk util peradaban: fungsi murni kecil yang dipakai ulang. */
const CODE_UNITS = [
  { name: "clampInt", sig: "export function clampInt(n: number, lo: number, hi: number): number", body: "  if (!Number.isFinite(n)) return lo;\n  return Math.max(lo, Math.min(hi, Math.trunc(n)));" },
  { name: "sumMinor", sig: "export function sumMinor(amounts: number[]): number", body: "  return amounts.reduce((s, a) => s + (Number.isInteger(a) ? a : 0), 0);" },
  { name: "fmtCoord", sig: "export function fmtCoord(c: { x: number; y: number; z: number } | null): string", body: "  return c ? `${c.x},${c.y},${c.z}` : \"tanpa koordinat\";" },
  { name: "pickRot", sig: "export function pickRot<T>(arr: readonly T[], seq: number): T", body: "  if (arr.length === 0) throw new Error(\"array kosong\");\n  return arr[((seq % arr.length) + arr.length) % arr.length];" },
  { name: "isSafeName", sig: "export function isSafeName(s: string): boolean", body: "  return /^[\\p{L}][\\p{L}0-9 _-]{0,31}$/u.test(s);" },
  { name: "pct", sig: "export function pct(part: number, total: number): number", body: "  if (total <= 0) return 0;\n  return Math.round((part / total) * 1000) / 10;" },
];

async function toolCodeWrite(input: Record<string, unknown>, caller: ToolCaller, seq: number): Promise<ToolExec> {
  const requested = clampStr(input.unit, 40);
  const chosen = CODE_UNITS.find((u) => u.name === requested) ?? CODE_UNITS[seq % CODE_UNITS.length];
  const content = `// ${chosen.name}.ts — artefak guild CODER\n// Penulis: ${caller.name} (${caller.code})\n// Util murni untuk kernel peradaban — deterministik, tanpa efek samping.\n\n${chosen.sig} {\n${chosen.body}\n}\n\n// [CATATAN JUJUR] Kode ini dihasilkan template deterministik kernel (bukan LLM),\n// disimpan sebagai bukti kerja guild CODER dan bisa direview manusia.`;
  const art = await saveArtifact({
    kind: "CODE", title: `Modul ${chosen.name}.ts`, content, caller, tool: "code_write",
    meta: { unit: chosen.name, bahasa: "typescript", catatan: "template kernel deterministik" },
  });
  return { status: "OK", note: `kode ${chosen.name}.ts ditulis (${content.length} karakter) — bukti kerja guild CODER`, artifactId: art.id, artifactTitle: art.title, output: { unit: chosen.name } };
}

async function toolSpecWrite(input: Record<string, unknown>, caller: ToolCaller, seq: number): Promise<ToolExec> {
  const products = ["Terjemahan Kilat", "Pasar Desa Digital", "Jembatan Data", "Gudang Artefak", "Kios Kopi Kode"];
  const product = clampStr(input.product, 60) || products[seq % products.length];
  const content = `# Spesifikasi: ${product}\nPenulis: ${caller.name} (${caller.code}) — guild ${caller.division ?? "-"}\n\n## Masalah\nPeradaban butuh ${product.toLowerCase()} agar pekerjaan warga menghasilkan nilai yang bisa dijual ke pelanggan NYATA (revenue eksternal, bukan TRADE_INTERNAL).\n\n## Lingkup v1\n1. Satu layanan inti, satu harga satuan FLR, satu kanal penjualan.\n2. Bukti pengiriman kerja disimpan sebagai artefak (audit penuh).\n3. Pajak 10% atas revenue eksternal otomatis (sudah ada di kernel).\n\n## Kriteria terima\n- [ ] Pesanan masuk tercatat di ledger (REVENUE_EXTERNAL hanya bila pembayaran nyata).\n- [ ] Warga terlibat mendapat upah WAGE dari kas operasional.\n- [ ] Kegagalan pengiriman dilaporkan jujur (failure = state valid).\n\n## Batas\n- Tanpa klaim revenue sebelum rail pembayaran riil aktif (HONESTY_GATE).\n- Budget LLM per denyut tetap 1 keputusan (TICK_DECISION_BUDGET).`;
  const art = await saveArtifact({
    kind: "SPEC", title: `Spec ${product} v1`, content, caller, tool: "spec_write",
    meta: { produk: product, catatan: "spesifikasi kerja guild DEV" },
  });
  return { status: "OK", note: `spesifikasi "${product}" ditulis — rencana pengembangan siap direview pemerintah`, artifactId: art.id, artifactTitle: art.title, output: { produk: product } };
}

async function toolBuildPlan(input: Record<string, unknown>, caller: ToolCaller, seq: number): Promise<ToolExec> {
  const maxFoot = (await getPolicy<number>("BUILD_MAX_FOOTPRINT")) ?? 81;
  const structures = [
    { name: "Menara Jaga", size: 5, h: 6, pal: ["cobblestone", "oak_log", "torch"] },
    { name: "Gudang Desa", size: 7, h: 4, pal: ["oak_planks", "chest", "oak_log"] },
    { name: "Jembatan Batu", size: 3, h: 2, pal: ["stone_bricks", "oak_fence"] },
    { name: "Sumur Sentral", size: 3, h: 3, pal: ["cobblestone", "oak_slab"] },
    { name: "Pagar Ladang", size: 9, h: 1, pal: ["oak_fence", "farmland", "wheat"] },
  ];
  const pick = clampStr(input.structure, 40);
  const found = structures.find((s) => s.name.toLowerCase() === pick.toLowerCase());
  const raw = found ?? structures[seq % structures.length];
  const size = raw.size * raw.size <= maxFoot ? raw.size : Math.floor(Math.sqrt(maxFoot));
  const site = parseCoords(caller.mcCoords) ?? { x: 100, y: 64, z: 100 };
  const plan: DirectivePayload = { site, plan: `${raw.name} ${size}x${size} h=${raw.h}`, footprint: size * size, blocks: raw.pal };
  const dir = caller.id
    ? await enqueueDirective({ id: caller.id, code: caller.code, name: caller.name, mcCoords: caller.mcCoords ?? "{}" }, "BUILD", plan)
    : { ok: false, note: "kernel tanpa tubuh — blueprint saja" };
  const content = `# Blueprint: ${raw.name}\nPerancang: ${caller.name} (${caller.code}) — guild ${caller.division ?? "-"}\nSite: ${site.x}, ${site.y}, ${site.z} (dari koordinat tubuh/sensus — dilabeli anchor)\nLantai: ${size}x${size} = ${size * size} blok (cap BUILD_MAX_FOOTPRINT ${maxFoot})\nTinggi: ${raw.h} lapis\nPalet: ${raw.pal.join(", ")}\nLangkah: 1) ratakan lantai 2) kerangka ${raw.h} lapis 3) detail + pencahayaan\n\n[STATUS] Direktif BUILD ${dir.ok ? "masuk antrean tubuh" : "TIDAK antre"} — ${dir.note}. Penempatan blok FISIK menunggu sesi bot ber-OP di dunia; kernel tidak pernah mengaku selesai sebelum dunia mengonfirmasi.`;
  const art = await saveArtifact({
    kind: "BLUEPRINT", title: `Blueprint ${raw.name} @${site.x},${site.z}`, content, caller, tool: "build_plan",
    meta: { site, size: size * size, tinggi: raw.h, palet: raw.pal, direktif: dir.note },
  });
  return { status: "OK", note: `blueprint ${raw.name} (${size}x${size}) dirancang + direktif BUILD ${dir.ok ? "antre" : "tidak antre"}`, artifactId: art.id, artifactTitle: art.title, output: { struktur: raw.name, site } };
}

async function toolMineRoute(input: Record<string, unknown>, caller: ToolCaller, seq: number): Promise<ToolExec> {
  const maxUnits = (await getPolicy<number>("MINE_YIELD_MAX_UNITS")) ?? 8;
  const depths = [
    { label: "lapis batu bara (y=52)", ore: "coal", unit: 4, price: 20 },
    { label: "lapis besi (y=40)", ore: "raw_iron", unit: 3, price: 45 },
    { label: "lapis emas (y=28)", ore: "raw_gold", unit: 2, price: 90 },
    { label: "lapis intan (y=12)", ore: "diamond", unit: 1, price: 200 },
  ];
  const d = depths[seq % depths.length];
  const units = Math.min(d.unit, maxUnits);
  const site = parseCoords(caller.mcCoords) ?? { x: 100, y: 64, z: 100 };
  const dir = caller.id
    ? await enqueueDirective({ id: caller.id, code: caller.code, name: caller.name, mcCoords: caller.mcCoords ?? "{}" }, "MINE", { site: { x: site.x, y: Math.max(5, site.y - 16), z: site.z }, plan: `tambang ${d.label}`, radius: 12 })
    : { ok: false, note: "kernel tanpa tubuh — rute saja" };
  // Hasil tambang dilist ke pasar desa (konservasi stok — cap MINE_YIELD_MAX_UNITS).
  let listNote = "hasil disimpan tanpa listing (tidak ada perusahaan penampung)";
  if (typeof input.sellerOrgId === "string" && input.sellerOrgId) {
    const priceCap = (await getPolicy<number>("MARKET_UNIT_PRICE_CAP")) ?? 250;
    const r = await listOffer(input.sellerOrgId, `Hasil tambang ${d.ore}`, Math.min(d.price, priceCap), units);
    listNote = r.ok ? `hasil dilist ke pasar desa (${units} × ${d.ore})` : `listing pasar ditolak: ${r.note}`;
  }
  const content = `# Rute Tambang: ${d.label}\nPenambang: ${caller.name} (${caller.code})\nTitik masuk: ${site.x}, ${site.y}, ${site.z} → turun tangga 16 blok, cabang grid 2x6, tulang punggung kembali.\nTarget: ${d.ore}\nEstimasi hasil: ${units} unit (cap ${maxUnits} — konservasi)\n\n[EKONOMI] ${listNote}\n[DIREKTIF TUBUH] MINE ${dir.ok ? "antre" : "tidak antre"} — ${dir.note}. Ekspedisi fisik menunggu dunia; angka hasil adalah RENCANA, bukan klaim panen.`;
  const art = await saveArtifact({
    kind: "MINE_YIELD", title: `Rute tambang ${d.ore} (${units}u)`, content, caller, tool: "mine_route",
    orgId: typeof input.sellerOrgId === "string" ? input.sellerOrgId : null,
    meta: { ore: d.ore, unit: units, site, listing: listNote },
  });
  return { status: "OK", note: `rute tambang ${d.label} dirancang — ${listNote}`, artifactId: art.id, artifactTitle: art.title, output: { ore: d.ore, unit: units } };
}

async function toolPatrolReport(caller: ToolCaller, seq: number): Promise<ToolExec> {
  const radiusMax = (await getPolicy<number>("PATROL_RADIUS_MAX")) ?? 64;
  const radius = Math.min(48 + (seq % 3) * 8, radiusMax);
  const center = parseCoords(caller.mcCoords) ?? { x: 0, y: 64, z: 0 };
  const threat = seq % 4 === 0 ? "SEDANG (gerak mencurigakan di tepi radius)" : "RENDAH (desa tenang)";
  const dir = caller.id
    ? await enqueueDirective({ id: caller.id, code: caller.code, name: caller.name, mcCoords: caller.mcCoords ?? "{}" }, "PATROL", { site: center, radius, plan: "patroli lingkar 8 waypoint" })
    : { ok: false, note: "kernel tanpa tubuh — laporan saja" };
  const content = `# Laporan Patroli #${seq}\nGarda: ${caller.name} (${caller.code})\nPusat: ${center.x}, ${center.y}, ${center.z} — radius ${radius} blok (cap ${radiusMax})\nWaypoint: 8 titik lingkar arah jarum jam\nTingkat ancaman: ${threat}\nKesiapan: 1 garda berjaga; protokol mundur ke menara bila ancaman > 2\n\n[DIREKTIF TUBUH] PATROL ${dir.ok ? "antre" : "tidak antre"} — ${dir.note}. Patroli fisik menunggu dunia hidup; di mimpi jaga rute tetap direhearsal (jujur).`;
  const art = await saveArtifact({
    kind: "PATROL", title: `Patroli r${radius} — ancaman ${threat.split(" ")[0]}`, content, caller, tool: "patrol_report",
    meta: { radius, ancaman: threat, pusat: center },
  });
  return { status: "OK", note: `patroli radius ${radius} selesai — ${threat}`, artifactId: art.id, artifactTitle: art.title, output: { radius, ancaman: threat } };
}

// ---------- Gerbang tunggal ----------

/** SATU gerbang tool calling: otorisasi → eksekusi → audit → taut artefak. Tak pernah melempar. */
async function toolMcpCall(input: Record<string, unknown>, caller: ToolCaller): Promise<ToolExec> {
  const { mcpCall, mcpProbe, listMcpServers } = await import("./mcp");
  const { getConfigValue } = await import("./config");
  if ((await getConfigValue("mcp.enabled")) === "false") return { status: "FAILED", note: "MCP dimatikan di konfigurasi", error: "mcp disabled" };
  const servers = await listMcpServers();
  const enabled = servers.filter((s) => s.enabled);
  if (enabled.length === 0) return { status: "FAILED", note: "tidak ada server MCP terdaftar/aktif — daftarkan di tab Konfigurasi", error: "no mcp server" };
  const name = String(input.server ?? enabled[0].name);
  const mcpTool = String(input.mcpTool ?? "");
  if (!mcpTool) {
    // tanpa mcpTool: probe tools/list (katalog kesehatan)
    const probe = await mcpProbe(name);
    if (!probe.ok) return { status: "FAILED", note: `MCP ${name} tidak merespons: ${probe.error}`, error: probe.error };
    return { status: "OK", note: `MCP ${name}: ${probe.tools?.length ?? 0} tool tersedia (${probe.tools?.map((t) => t.name).slice(0, 6).join(", ")})`, output: { server: name, tools: probe.tools } };
  }
  const args = (input.args && typeof input.args === "object" ? input.args : {}) as Record<string, unknown>;
  const r = await mcpCall(name, mcpTool, args);
  if (!r.ok) return { status: "FAILED", note: `mcp_call ${name}/${mcpTool} gagal: ${r.error}`, error: r.error };
  return { status: "OK", note: `mcp_call ${name}/${mcpTool} berhasil (hasil JSON-RPC tercatat)`, output: { server: name, tool: mcpTool, result: typeof r.result === "object" ? JSON.stringify(r.result).slice(0, 400) : String(r.result ?? "").slice(0, 400) } };
}

export async function invokeTool(caller: ToolCaller, toolKey: string, input: Record<string, unknown> = {}): Promise<ToolResult> {
  const t0 = Date.now();
  const spec = toolSpec(toolKey);
  if (!spec) {
    const ghost: ToolSpec = { key: toolKey, label: toolKey, desc: "?", capability: "?", external: false };
    const callId = await recordCall({ caller, spec: ghost, input, status: "DENIED", note: `tool tak dikenal: ${toolKey}`, latencyMs: Date.now() - t0, error: "tool tak terdaftar" });
    return { ok: false, status: "DENIED", note: `tool "${toolKey}" tidak terdaftar di Toolforge — ditolak & tercatat`, latencyMs: Date.now() - t0, callId };
  }
  const auth = await authorize(caller, spec);
  if (!auth.ok) {
    const callId = await recordCall({ caller, spec, input, status: "DENIED", note: auth.reason, latencyMs: Date.now() - t0, error: auth.reason });
    return { ok: false, status: "DENIED", note: `DITOLAK: ${auth.reason}`, latencyMs: Date.now() - t0, callId };
  }
  const seq = await nextToolSeq();
  try {
    let exec: ToolExec;
    switch (spec.key) {
      case "web_search": exec = await toolWebSearch(input, caller, seq); break;
      case "page_reader": exec = await toolPageReader(input, caller); break;
      case "code_write": exec = await toolCodeWrite(input, caller, seq); break;
      case "spec_write": exec = await toolSpecWrite(input, caller, seq); break;
      case "build_plan": exec = await toolBuildPlan(input, caller, seq); break;
      case "mine_route": exec = await toolMineRoute(input, caller, seq); break;
      case "patrol_report": exec = await toolPatrolReport(caller, seq); break;
      case "mcp_call": exec = await toolMcpCall(input, caller); break;
      default: exec = { status: "FAILED", note: "implementasi belum ada", error: "unimplemented" };
    }
    const callId = await recordCall({
      caller, spec, input, status: exec.status, note: exec.note, latencyMs: Date.now() - t0,
      artifactId: exec.artifactId, error: exec.error, output: exec.output,
    });
    if (exec.artifactId) {
      await db.civArtifact.update({ where: { id: exec.artifactId }, data: { toolCallId: callId } }).catch(() => { /* audit tetap jalan */ });
    }
    return { ok: exec.status === "OK", status: exec.status, note: exec.note, artifactId: exec.artifactId, artifactTitle: exec.artifactTitle, latencyMs: Date.now() - t0, callId };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "kesalahan tak diketahui";
    const callId = await recordCall({ caller, spec, input, status: "FAILED", note: msg, latencyMs: Date.now() - t0, error: msg });
    return { ok: false, status: "FAILED", note: `tool gagal (jujur): ${msg}`, latencyMs: Date.now() - t0, callId };
  }
}

// ---------- Kerja divisi (dipanggil execWork saat warga WORK) ----------

export interface DivisionWorkOut { note: string; artifactTitle?: string; tool?: string; status?: string }

/** Kerja NYATA sesuai divisi: SATU tool per denyut (TOOL_MAX_PER_PULSE di luar LLM).
 *  Payload LLM (jika ada) dipakai sebagai input tool — tapi otorisasi tetap kernel. */
export async function runDivisionWork(
  v: { id: string; code: string; name: string; division: string; mcCoords: string; workOrgId?: string | null },
  llmPayload: string | null,
): Promise<DivisionWorkOut> {
  const maxPerPulse = (await getPolicy<number>("TOOL_MAX_PER_PULSE")) ?? 1;
  if (maxPerPulse < 1) return { note: "tool dinonaktifkan policy (TOOL_MAX_PER_PULSE=0)" };
  const meta = divisionMeta(v.division);
  if (meta.tools.length === 0) return { note: "warga umum bekerja tanpa tool spesialis (kerja fisik desa)" };

  // Pilih tool: TOOLSMITH merotasi seluruh registry; divisi lain memakai tool utamanya.
  const seq = await nextToolSeq();
  const toolKey = v.division === "TOOLSMITH" ? meta.tools[seq % meta.tools.length] : meta.tools[0];

  // Input dari payload LLM (dibatasi, otorisasi tetap kernel):
  const input: Record<string, unknown> = {};
  const p = (llmPayload ?? "").trim();
  if (p) {
    if (toolKey === "web_search") input.query = p.slice(0, 200);
    else if (toolKey === "page_reader") input.url = /^https?:\/\//.test(p) ? p.slice(0, 300) : "";
    else if (toolKey === "code_write") input.unit = p.slice(0, 40);
    else if (toolKey === "spec_write") input.product = p.slice(0, 60);
    else if (toolKey === "build_plan") input.structure = p.slice(0, 40);
  }
  if (toolKey === "mine_route" && v.workOrgId) input.sellerOrgId = v.workOrgId;

  const r = await invokeTool({ type: "VILLAGER", id: v.id, code: v.code, name: v.name, division: v.division, mcCoords: v.mcCoords }, toolKey, input);
  return { note: `${toolKey} → ${r.note}`, artifactTitle: r.artifactTitle, tool: toolKey, status: r.status };
}

// ---------- Statistik untuk state/UI ----------

export async function toolStats() {
  const [byTool, byStatus, total] = await Promise.all([
    db.civToolCall.groupBy({ by: ["tool"], _count: { _all: true } }),
    db.civToolCall.groupBy({ by: ["status"], _count: { _all: true } }),
    db.civToolCall.count(),
  ]);
  return {
    total,
    byTool: Object.fromEntries(byTool.map((r) => [r.tool, r._count._all])),
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
  };
}

export async function recentToolCalls(take = 10) {
  const rows = await db.civToolCall.findMany({ orderBy: { seq: "desc" }, take: Math.min(take, 24) });
  return rows.map((r) => ({
    id: r.id, tool: r.tool, callerType: r.callerType, callerCode: r.callerCode, callerName: r.callerName,
    status: r.status, error: r.error, latencyMs: r.latencyMs, seq: r.seq, createdAt: r.createdAt.toISOString(),
  }));
}

export async function recentArtifacts(take = 10) {
  const rows = await db.civArtifact.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(take, 24) });
  return rows.map((r) => ({
    id: r.id, kind: r.kind, title: r.title, authorName: r.authorName, authorCode: r.authorCode,
    division: r.division, tool: r.tool, createdAt: r.createdAt.toISOString(),
    contentPreview: r.content.slice(0, 240),
  }));
}

export async function artifactCount(): Promise<number> {
  return db.civArtifact.count();
}

/** Statistik guild: jumlah warga per divisi + artefak terakhir per divisi. */
export async function guildStats() {
  const actives = await db.civVillager.findMany({ where: { status: "ACTIVE" }, select: { division: true } });
  const byDivision: Record<string, number> = {};
  for (const d of DIVISIONS) byDivision[d] = 0;
  for (const a of actives) byDivision[a.division] = (byDivision[a.division] ?? 0) + 1;
  const latest: Record<string, { title: string; at: string; kind: string }> = {};
  for (const d of DIVISIONS) {
    const art = await db.civArtifact.findFirst({ where: { division: d }, orderBy: { createdAt: "desc" }, select: { title: true, createdAt: true, kind: true } });
    if (art) latest[d] = { title: art.title, at: art.createdAt.toISOString(), kind: art.kind };
  }
  return { byDivision, latest };
}
