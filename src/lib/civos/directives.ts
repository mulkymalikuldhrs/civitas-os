// CIVITAS OS — directives.ts
// SLICE 8: VILLAGER EMBODIMENT — jembatan "otak → tubuh" warga.
// Otak (LLM via Router) hanya MEMUTUSKAN; kernel menerjemahkan keputusan menjadi
// DIREKTIF tubuh yang dieksekusi dunia:
//   • Dunia ONLINE  → bot (mcbot) mengambil direktif QUEUED dan mengeksekusinya
//     via command dunia (tp pada villager dekat koordinat sensus) + relay chat berlabel.
//   • Dunia OFFLINE → jalur SIM "mimpi jaga" berlabel jujur: koordinat digeser di
//     kernel, ucapan dicatat — TIDAK PERNAH mengaku EMBODIED (REALITY WINS).
//
// Semua limit di luar LLM: DIRECTIVE_QUEUE_CAP, DIRECTIVE_TTL_MIN,
// DIRECTIVE_MAX_PER_JOIN, SPEAK_MAX_LEN, DIRECTIVE_MAX_DISTANCE.
// Mesin status: QUEUED → DISPATCHED → APPLIED | FAILED | EXPIRED (tanpa kebangkitan).

import { db } from "@/lib/db";
import { emit } from "./events";
import { getPolicy } from "./policy";
import { cachedStatus } from "./minecraft";
import { DIRECTIVE_EDGES, EVENT_TYPES, DIRECTIVE_KINDS, type DirectiveKind } from "./types";

export interface DirectivePayload {
  to?: { x: number; y: number; z: number }; // MOVE/LOOK
  message?: string; // SPEAK
  orgCode?: string; // WORK_ANIM
  // SLICE 9 — direktif guild
  site?: { x: number; y: number; z: number }; // BUILD/PATROL/MINE (anchor kerja)
  plan?: string; // deskripsi rencana kerja
  footprint?: number; // BUILD: luas lantai (blok²)
  blocks?: string[]; // BUILD: palet blok
  radius?: number; // PATROL/MINE: radius kerja
}

export interface DirectiveRow {
  id: string;
  villagerCode: string;
  villagerName: string;
  kind: string;
  status: string;
  origin: string;
  payload: DirectivePayload;
  mcCommand: string | null;
  result: string | null;
  createdAt: string;
  appliedAt: string | null;
}

// ---------- Util ----------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function parseCoords(mcCoords: string): { x: number; y: number; z: number } | null {
  try {
    const v = JSON.parse(mcCoords) as { x?: number; y?: number; z?: number };
    if (typeof v.x === "number" && typeof v.y === "number" && typeof v.z === "number") {
      return { x: v.x, y: v.y, z: v.z };
    }
  } catch { /* koordinat rusak → null (jujur) */ }
  return null;
}

function legalTransition(from: string, to: string): boolean {
  return (DIRECTIVE_EDGES[from] ?? []).includes(to);
}

// ---------- Antrean ----------

/** Enqueue satu direktif tubuh. Dipanggil kernel setelah denyut warga — bukan LLM. */
export async function enqueueDirective(
  villager: { id: string; code: string; name: string; mcCoords: string },
  kind: DirectiveKind,
  payload: DirectivePayload,
): Promise<{ ok: boolean; id?: string; note: string }> {
  if (!DIRECTIVE_KINDS.includes(kind)) return { ok: false, note: `jenis direktif tak dikenal: ${kind}` };

  const cap = (await getPolicy<number>("DIRECTIVE_QUEUE_CAP")) ?? 64;
  const queued = await db.civVillagerDirective.count({ where: { status: "QUEUED" } });
  if (queued >= cap) return { ok: false, note: `antrean penuh (${queued}/${cap}) — direktif ditolak policy` };

  // SPEAK dipotong di kernel (SPEAK_MAX_LEN) — LLM tak bisa memaksa pesan panjang.
  if (kind === "SPEAK" && payload.message) {
    const maxLen = (await getPolicy<number>("SPEAK_MAX_LEN")) ?? 120;
    payload.message = payload.message.slice(0, maxLen);
  }

  const d = await db.civVillagerDirective.create({
    data: { villagerId: villager.id, kind, payload: JSON.stringify(payload), status: "QUEUED", origin: "KERNEL" },
  });
  await emit({
    type: EVENT_TYPES.VILLAGER_DIRECTIVE,
    subjectType: "VILLAGER",
    subjectId: villager.code,
    payload: { id: d.id, jenis: kind, status: "QUEUED", nama: villager.name },
  });
  return { ok: true, id: d.id, note: `${kind} masuk antrean` };
}

/** Kedaluwarsakan direktif QUEUED yang basi (TTL). Deterministik, dipanggil denyut/bot. */
export async function expireStaleDirectives(): Promise<number> {
  const ttlMin = (await getPolicy<number>("DIRECTIVE_TTL_MIN")) ?? 30;
  const cutoff = new Date(Date.now() - ttlMin * 60 * 1000);
  const stale = await db.civVillagerDirective.findMany({
    where: { status: { in: ["QUEUED", "DISPATCHED"] }, createdAt: { lt: cutoff } },
    select: { id: true, status: true },
  });
  for (const s of stale) {
    if (!legalTransition(s.status, "EXPIRED")) continue; // pengaman mesin status
    await db.civVillagerDirective.update({ where: { id: s.id }, data: { status: "EXPIRED", result: `TTL ${ttlMin} menit terlampaui` } });
  }
  return stale.length;
}

// ---------- Jalur SIM (mimpi jaga — berlabel jujur) ----------

export interface SimRunResult { applied: number; failed: number; expired: number; note: string }

/** Jalankan langsung seluruh antrean di mode SIM (dunia OFFLINE). Koordinat digeser di
 *  kernel dengan jarak terbatas; embodiment TETAP — tak pernah mengaku EMBODIED. */
export async function runSimDirectives(force = false): Promise<SimRunResult> {
  const st = await cachedStatus(false);
  if (st.online && !force) {
    return { applied: 0, failed: 0, expired: 0, note: "dunia ONLINE — direktif menunggu bot dunia, bukan SIM (jujur)" };
  }
  const expired = await expireStaleDirectives();
  const maxDist = (await getPolicy<number>("DIRECTIVE_MAX_DISTANCE")) ?? 32;
  const queue = await db.civVillagerDirective.findMany({
    where: { status: "QUEUED" },
    include: { villager: true },
    orderBy: { createdAt: "asc" },
    take: 32,
  });

  let applied = 0;
  let failed = 0;
  for (const d of queue) {
    const payload = safeDirectivePayload(d.payload);
    const v = d.villager;
    let result = "";
    let coords: { x: number; y: number; z: number } | null = null;

    if (d.kind === "MOVE") {
      const from = parseCoords(v.mcCoords);
      if (!payload.to) { result = "tanpa tujuan"; }
      else {
        const to = clampMove(from, payload.to, maxDist);
        coords = to;
        result = `mimpi jaga: langkah kernel ${fmtCoord(from)} → ${fmtCoord(to)} (SIM, bukan dunia fisik)`;
      }
    } else if (d.kind === "SPEAK") {
      result = `ucapan tercatat di kernel: "${(payload.message ?? "").slice(0, 80)}" — dunia tidak mendengar (jujur)`;
    } else if (d.kind === "WORK_ANIM") {
      result = `gestur kerja diimajinasikan di ${payload.orgCode ?? "-"} (SIM)`;
    } else if (d.kind === "BUILD") {
      result = `blueprint "${payload.plan ?? "?"}" direhearsal di site ${fmtCoord(payload.site)} — penempatan blok FISIK menunggu dunia hidup (SIM, jujur)`;
    } else if (d.kind === "PATROL") {
      result = `rute patroli r=${payload.radius ?? "?"} diimajinasikan dari ${fmtCoord(payload.site)} (SIM)`;
    } else if (d.kind === "MINE") {
      result = `rute tambang "${payload.plan ?? "?"}" direhearsal dari ${fmtCoord(payload.site)} — panen nyata menunggu dunia (SIM)`;
    } else if (d.kind === "LOOK") {
      result = "arah pandang diimajinasikan (SIM)";
    } else {
      result = "jenis tak dikenal";
    }

    const ok = !["tanpa tujuan", "jenis tak dikenal"].includes(result);
    await db.civVillagerDirective.update({
      where: { id: d.id },
      data: { status: ok ? "APPLIED" : "FAILED", origin: "SIM", result, appliedAt: ok ? new Date() : null },
    });
    if (ok) {
      applied += 1;
      if (coords) {
        // SIM hanya menggerakkan koordinat bayangan kernel — embodiment TIDAK dinaikkan.
        await db.civVillager.update({ where: { id: v.id }, data: { mcCoords: JSON.stringify(coords) } });
      }
    } else {
      failed += 1;
    }
  }
  const note = `SIM tubuh: ${applied} dijalankan, ${failed} gagal, ${expired} kedaluwarsa (dunia tidur — berlabel jujur)`;
  return { applied, failed, expired, note };
}

/** Batasi langkah: maks DIRECTIVE_MAX_DISTANCE blok dari posisi asal (deterministik). */
function clampMove(from: { x: number; y: number; z: number } | null, to: { x: number; y: number; z: number }, maxDist: number): { x: number; y: number; z: number } {
  const base = from ?? to;
  const dx = clamp(to.x - base.x, -maxDist, maxDist);
  const dz = clamp(to.z - base.z, -maxDist, maxDist);
  return { x: Math.round(base.x + dx), y: Math.round(to.y), z: Math.round(base.z + dz) };
}

function fmtCoord(c: { x: number; y: number; z: number } | null | undefined): string {
  return c ? `${c.x},${c.y},${c.z}` : "tanpa koordinat";
}

export function safeDirectivePayload(s: string): DirectivePayload {
  try {
    const v = JSON.parse(s) as DirectivePayload;
    return typeof v === "object" && v !== null ? v : {};
  } catch {
    return {};
  }
}

// ---------- Jalur DUNIA (bot mengambil direktif saat ONLINE) ----------

export interface BotDirective {
  id: string;
  villagerId: string;
  villagerCode: string;
  villagerName: string;
  kind: DirectiveKind;
  /** SPEAK/BUILD/MINE → relay chat berlabel (kernel menyiapkan teks, bot mengirim). */
  chatMessage?: string;
  /** MOVE/PATROL → command_request (tp ber-anchor). */
  command?: string;
  targetCoords?: { x: number; y: number; z: number };
  /** SLICE 10 — payload asli (BUILD/MINE: site+blocks untuk eksekusi blok fisik). */
  payload?: DirectivePayload;
}

/** Bot mengambil batch direktif QUEUED (FIFO, cap DIRECTIVE_MAX_PER_JOIN). */
export async function claimDirectivesForBot(limit = 16): Promise<BotDirective[]> {
  const capped = Math.min(Math.max(1, Math.trunc(limit)), (await getPolicy<number>("DIRECTIVE_MAX_PER_JOIN")) ?? 16);
  const maxDist = (await getPolicy<number>("DIRECTIVE_MAX_DISTANCE")) ?? 32;
  const queue = await db.civVillagerDirective.findMany({
    where: { status: "QUEUED" },
    include: { villager: true },
    orderBy: { createdAt: "asc" },
    take: capped,
  });
  const out: BotDirective[] = [];
  for (const d of queue) {
    const payload = safeDirectivePayload(d.payload);
    if (d.kind === "SPEAK") {
      out.push({ id: d.id, villagerId: d.villager.id, villagerCode: d.villager.code, villagerName: d.villager.name, kind: "SPEAK", chatMessage: `[${d.villager.name} | ${d.villager.code}] ${payload.message ?? ""}`.slice(0, 256) });
    } else if (d.kind === "MOVE") {
      const from = parseCoords(d.villager.mcCoords);
      if (!payload.to || !from) {
        await db.civVillagerDirective.update({ where: { id: d.id }, data: { status: "FAILED", result: "tanpa koordinat sensus — tp ber-anchor tidak mungkin (jujur)" } });
        continue;
      }
      const to = clampMove(from, payload.to, maxDist);
      // Selector posisi: ambil villager dalam radius 3 blok dari koordinat sensus terakhir.
      const command = `tp @e[type=villager,x=${from.x},y=${from.y},z=${from.z},r=3] ${to.x} ${to.y} ${to.z}`;
      out.push({ id: d.id, villagerId: d.villager.id, villagerCode: d.villager.code, villagerName: d.villager.name, kind: "MOVE", command, targetCoords: to });
    } else if (d.kind === "WORK_ANIM" || d.kind === "LOOK") {
      // WORK_ANIM/LOOK di dunia: cukup catat sebagai APPLIED oleh bot (tanpa command — animasi vanilla tetap hidup).
      await db.civVillagerDirective.update({ where: { id: d.id }, data: { status: "APPLIED", origin: "BOT", result: `tubuh terlihat beraktivitas di ${payload.orgCode ?? "desa"} — AI vanilla tetap hidup di bawah kendali otonom`, appliedAt: new Date() } });
      await emit({ type: EVENT_TYPES.VILLAGER_DIRECTIVE, subjectType: "VILLAGER", subjectId: d.villager.code, payload: { id: d.id, jenis: d.kind, status: "APPLIED", oleh: "BOT" } });
    } else if (d.kind === "BUILD" || d.kind === "MINE") {
      // SLICE 9 — rencana guild diumumkan bot ke dunia (chat berlabel); APPLIED ditandai
      // mcbot SETELAH chat terkirim. Penempatan blok fisik TIDAK diklaim (butuh OP — jujur).
      const announce = `[${d.villager.name} | ${d.villager.code}] ${d.kind}: ${payload.plan ?? "rencana kerja guild"}${payload.site ? ` @${payload.site.x},${payload.site.z}` : ""}`.slice(0, 220);
      out.push({ id: d.id, villagerId: d.villager.id, villagerCode: d.villager.code, villagerName: d.villager.name, kind: d.kind, chatMessage: announce, payload });
    } else if (d.kind === "PATROL") {
      // PATROL: gerakkan tubuh vanilla ke titik lingkar pertama (anchor + radius offset).
      const s = payload.site;
      if (!s) {
        await db.civVillagerDirective.update({ where: { id: d.id }, data: { status: "FAILED", result: "patroli tanpa site — tak ada anchor" } });
        continue;
      }
      const r = Math.min(Math.max(4, payload.radius ?? 24), 48);
      const from = parseCoords(d.villager.mcCoords);
      const command = `tp @e[type=villager,x=${s.x},y=${s.y},z=${s.z},r=4] ${s.x + r} ${s.y} ${s.z}`;
      out.push({ id: d.id, villagerId: d.villager.id, villagerCode: d.villager.code, villagerName: d.villager.name, kind: "PATROL", command, targetCoords: from ? { x: s.x + r, y: s.y, z: s.z } : undefined });
    }
  }
  return out;
}

/** Tandai DISPATCHED (perintah dikirim). */
export async function markDispatched(id: string): Promise<void> {
  const d = await db.civVillagerDirective.findUnique({ where: { id } });
  if (!d || !legalTransition(d.status, "DISPATCHED")) return;
  await db.civVillagerDirective.update({ where: { id }, data: { status: "DISPATCHED", dispatchedAt: new Date() } });
}

/** Tandai APPLIED oleh bot + tulis koordinat baru bila dunia mengonfirmasi. */
export async function markApplied(id: string, result: string, villagerId?: string, newCoords?: { x: number; y: number; z: number }): Promise<void> {
  const d = await db.civVillagerDirective.findUnique({ where: { id } });
  if (!d) return;
  const status = legalTransition(d.status, "APPLIED") ? "APPLIED" : d.status;
  await db.civVillagerDirective.update({
    where: { id },
    data: { status, result: result.slice(0, 240), origin: "BOT", appliedAt: status === "APPLIED" ? new Date() : d.appliedAt },
  });
  if (status === "APPLIED" && newCoords && villagerId) {
    await db.civVillager.update({ where: { id: villagerId }, data: { mcCoords: JSON.stringify(newCoords) } });
  }
  if (status === "APPLIED") {
    await emit({ type: EVENT_TYPES.VILLAGER_DIRECTIVE, subjectType: "VILLAGER", subjectId: d.villagerId, payload: { id, jenis: d.kind, status: "APPLIED", oleh: "BOT" } });
  }
}

/** Tandai FAILED oleh bot (dunia menolak/izin kurang). */
export async function markFailed(id: string, reason: string): Promise<void> {
  const d = await db.civVillagerDirective.findUnique({ where: { id } });
  if (!d || !legalTransition(d.status, "FAILED")) return;
  await db.civVillagerDirective.update({ where: { id }, data: { status: "FAILED", result: reason.slice(0, 240) } });
  await emit({ type: EVENT_TYPES.VILLAGER_DIRECTIVE, subjectType: "VILLAGER", subjectId: d.villagerId, payload: { id, jenis: d.kind, status: "FAILED", alasan: reason.slice(0, 80) } });
}

// ---------- Statistik untuk state/UI ----------

export async function directiveStats() {
  const [queued, dispatched, applied, failed, expired] = await Promise.all([
    db.civVillagerDirective.count({ where: { status: "QUEUED" } }),
    db.civVillagerDirective.count({ where: { status: "DISPATCHED" } }),
    db.civVillagerDirective.count({ where: { status: "APPLIED" } }),
    db.civVillagerDirective.count({ where: { status: "FAILED" } }),
    db.civVillagerDirective.count({ where: { status: "EXPIRED" } }),
  ]);
  const recent = await db.civVillagerDirective.findMany({
    include: { villager: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const rows: DirectiveRow[] = recent.map((d) => ({
    id: d.id,
    villagerCode: d.villager.code,
    villagerName: d.villager.name,
    kind: d.kind,
    status: d.status,
    origin: d.origin,
    payload: safeDirectivePayload(d.payload),
    mcCommand: d.mcCommand,
    result: d.result,
    createdAt: d.createdAt.toISOString(),
    appliedAt: d.appliedAt?.toISOString() ?? null,
  }));
  return { queued, dispatched, applied, failed, expired, recent: rows };
}
