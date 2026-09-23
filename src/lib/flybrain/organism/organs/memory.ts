// FLYBRAIN ORGANISM — organs/memory.ts
// PORT dari upstream gh `memory/index.js` (MemoryEngine: log → analisa gagal/sukses
// → review) + warisan ecosystem-memory gitlab. Adaptasi: penyimpanan = vault LOKAL
// (IndexedDB via kernel vault.ts) — episodic di koleksi logs, lesson semantic di
// koleksi memories. Server TIDAK PERNAH memanggil modul ini (hanya klien).
//
// Esense yang dipertahankan: log(type,name,result,reason) · analyzeFailures() ·
// analyzeSuccess() · weeklyReview() → rekomendasi.

import { addLog, addMemory, listRecords } from "../../vault";
import type { Envelope, LogPayload } from "../../types";
import type { CreatureId } from "../creatures";

const channelFor = (id: CreatureId): string => `biosfer.${id}`;

/** EPISODIC — catat episode kehidupan creature ke ledger lokal. */
export async function rememberEpisode(
  id: CreatureId,
  note: string,
  level: LogPayload["level"] = "info",
): Promise<void> {
  await addLog({ channel: channelFor(id), level, message: note.slice(0, 500) }, "prt");
}

/** Semua episode creature (terbaru dulu). */
export async function recallEpisodes(id: CreatureId, limit = 20): Promise<Envelope<LogPayload>[]> {
  const logs = await listRecords<LogPayload>("logs", { limit: 400 });
  const mine = logs.filter((l) => l.payload.channel === channelFor(id));
  return mine.slice(0, limit);
}

/** Episode SEMUA creature (terbaru dulu) — untuk inspektor & reflect. */
export async function recallBiosferEpisodes(limit = 40): Promise<Envelope<LogPayload>[]> {
  const logs = await listRecords<LogPayload>("logs", { limit: 600 });
  return logs.filter((l) => l.payload.channel.startsWith("biosfer.")).slice(0, limit);
}

export interface MemoryReview {
  total: number;
  failures: { reason: string; count: number }[];
  successes: { type: string; count: number }[];
  rekomendasi: string[];
}

/** Analisa pola gagal (port `analyzeFailures`). */
function analyzeFailures(entries: { result: string; reason: string; type: string }[]): { reason: string; count: number }[] {
  const reasons: Record<string, number> = {};
  for (const f of entries.filter((e) => e.result === "FAILED")) {
    const key = f.reason.slice(0, 80) || "(tanpa alasan)";
    reasons[key] = (reasons[key] ?? 0) + 1;
  }
  return Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, count]) => ({ reason, count }));
}

/** Analisa pola sukses (port `analyzeSuccess`). */
function analyzeSuccess(entries: { result: string; reason: string; type: string }[]): { type: string; count: number }[] {
  const types: Record<string, number> = {};
  for (const s of entries.filter((e) => e.result === "SUCCESS")) {
    types[s.type] = (types[s.type] ?? 0) + 1;
  }
  return Object.entries(types).map(([type, count]) => ({ type, count }));
}

/**
 * Weekly review (port `weeklyReview`): baca episode SEMUA creature dari ledger
 * lokal, kelompokkan gagal/sukses, keluarkan rekomendasi.
 * Format episode: `[<result>:<type>] <pesan>` — ditulis oleh engine lewat
 * rememberEpisode dengan awalan hasil.
 */
export async function reviewMemory(): Promise<MemoryReview> {
  const logs = await recallBiosferEpisodes(300);
  const entries: { result: string; reason: string; type: string }[] = [];
  for (const l of logs) {
    const m = /^\[(SUCCESS|FAILED|PIVOT):([a-z_-]+)\]/i.exec(l.payload.message ?? "");
    if (!m) continue;
    entries.push({ result: m[1].toUpperCase(), type: m[2].toLowerCase(), reason: l.payload.message.slice(m[0].length).trim() });
  }
  const failures = analyzeFailures(entries);
  const successes = analyzeSuccess(entries);
  const rekomendasi: string[] = [];
  if (failures.length > 0) rekomendasi.push(`Hindari: ${failures[0].reason}`);
  if (successes.length > 0) rekomendasi.push(`Fokuskan: ${successes[0].type}`);
  if (entries.length === 0) rekomendasi.push("Belum cukup episode berlabel untuk dianalisa — denyut dulu.");
  return { total: entries.length, failures, successes, rekomendasi };
}

/**
 * SEMANTIC — distilasi lesson dari review menjadi SATU memori semantic di vault
 * (hanya bila ada bahan). Warisan "episodic → semantic" upstream.
 */
export async function distillLesson(id: CreatureId, review: MemoryReview): Promise<boolean> {
  if (review.total < 3) return false;
  const lines: string[] = [];
  if (review.failures.length) lines.push(`pola gagal teratas: ${review.failures[0].reason} (${review.failures[0].count}x)`);
  if (review.successes.length) lines.push(`pola sukses teratas: ${review.successes[0].type} (${review.successes[0].count}x)`);
  if (lines.length === 0) return false;
  await addMemory(
    {
      title: `[${id}] pelajaran biosfer`,
      content: lines.join(" — "),
      kind: "semantic",
    },
    "prt",
    ["biosfer", `creature:${id}`],
  );
  return true;
}

/** PROSEDURAL — daftar skill creature (dipakai factory; disimpan di state creature). */
export function skillsOf(creature: { skills: string[] }): string[] {
  return [...creature.skills];
}
