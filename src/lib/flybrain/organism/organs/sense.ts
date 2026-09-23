// FLYBRAIN ORGANISM — organs/sense.ts
// PORT dari upstream gh `sense/index.js` (SenseEngine: filter+klasifikasi stimuli)
// dan `decision/index.js` (skoring masalah). Adaptasi: sumber stimuli = kejadian
// LOKAL biosfer (bukan scraping Supabase/Reddit). MURNI TypeScript.
//
// Esense yang dipertahankan:
//   1. kumpulkan stimuli → 2. bersihkan teks → 3. dedupe → 4. klasifikasi sentimen
//      → 5. skoring kelayakan otomatisasi & nilai → 6. urutkan teratas.

import type { BiosferEvent } from "../eventBus";
import type { CreatureState, CreatureReflexContext } from "../creature";

// ---------- Util teks (port 1:1 dari upstream) ----------

export function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/[^\w\s]/g, " ")
    .trim();
}

const NEGATIVE_WORDS = ["susah", "ribet", "gagal", "error", "bug", "mati", "rugi", "mahal", "rumit", "kosong", "kritis", "timeout"];
const POSITIVE_WORDS = ["mantap", "bagus", "sehat", "suka", "lancar", "bersih", "panen", "naik"];

/** Sentimen sederhana berbasis leksikon Indonesia (port `analyzeSentiment`). */
export function analyzeSentiment(text: string): "negative" | "positive" | "neutral" {
  let score = 0;
  const lower = text.toLowerCase();
  for (const w of NEGATIVE_WORDS) if (lower.includes(w)) score -= 1;
  for (const w of POSITIVE_WORDS) if (lower.includes(w)) score += 1;
  return score < 0 ? "negative" : score > 0 ? "positive" : "neutral";
}

/** Estimasi kelayakan otomatisasi (port `estimateAutomation`). */
export function estimateAutomation(text: string): number {
  const autoFriendly = ["auto", "otomatis", "sistem", "app", "tool", "software", "digital", "denyut", "schedul"];
  const manual = ["manual", "kerjain sendiri", "orang", "konfirmasi manusia"];
  let score = 0.5;
  const lower = text.toLowerCase();
  for (const w of autoFriendly) if (lower.includes(w)) score += 0.2;
  for (const w of manual) if (lower.includes(w)) score -= 0.2;
  return Math.max(0, Math.min(1, score));
}

/** Estimasi potensi nilai (port `estimateMoneyPotential`). */
export function estimateMoneyPotential(text: string): number {
  const highValue = ["kwitansi", "tier", "pro", "panen", "peluang", "portofolio", "kelly", "sinyal", "offer"];
  const lowValue = ["gratis", "free", "kosong", "tunggu"];
  let score = 0.5;
  const lower = text.toLowerCase();
  for (const w of highValue) if (lower.includes(w)) score += 0.2;
  for (const w of lowValue) if (lower.includes(w)) score -= 0.2;
  return Math.max(0, Math.min(1, score));
}

// ---------- Stimuli lokal ----------

export interface Stimulus {
  id: string;
  source: string; // "bus" | "vault" | "creature"
  text: string;
  sentiment: "negative" | "positive" | "neutral";
  score: number; // komposit 0–1 (skala gh decision, dibagi ke [0,1])
}

/**
 * Kumpulkan & klasifikasi stimuli DARI KEJADIAN LOKAL (port `SenseEngine.run`):
 * - ambil kejadian bus terakhir + statistik vault,
 * - bersihkan, dedupe by teks, klasifikasi sentimen,
 * - skoring: kepadatan keluhan + kelayakan otomatis + potensi nilai.
 */
export function collectStimuli(input: {
  events: BiosferEvent[];
  stats: CreatureReflexContext["stats"];
  creatures: CreatureState[];
  limit?: number;
}): Stimulus[] {
  const raw: { source: string; text: string; weight: number }[] = [];

  for (const ev of input.events.slice(0, 60)) {
    raw.push({ source: "bus", text: ev.message, weight: ev.type === "death" || ev.type === "sleep" ? 1 : ev.type === "decide" ? 0.6 : 0.4 });
  }
  if (input.stats) {
    raw.push({ source: "vault", text: `vault: ${input.stats.totalRecords} rekaman, ${Math.round(input.stats.totalBytes / 1024)} KB`, weight: 0.5 });
    for (const [k, v] of Object.entries(input.stats.counts ?? {})) {
      if (v === 0) raw.push({ source: "vault", text: `koleksi ${k} kosong`, weight: 0.8 });
    }
  }
  for (const c of input.creatures) {
    if (c.status === "tidur") raw.push({ source: "creature", text: `${c.name} tidur — energi habis`, weight: 1 });
    if (c.fails >= 2) raw.push({ source: "creature", text: `${c.name} gagal menalar ${c.fails}x beruntun`, weight: 0.9 });
  }

  // clean + dedupe (port dari upstream)
  const seen = new Set<string>();
  const stimuli: Stimulus[] = [];
  for (const r of raw) {
    const textClean = cleanText(r.text);
    if (!textClean || seen.has(textClean)) continue;
    seen.add(textClean);
    const sentiment = analyzeSentiment(r.text);
    const auto = estimateAutomation(r.text);
    const money = estimateMoneyPotential(r.text);
    const score = Math.round((r.weight * 0.4 + (sentiment === "negative" ? 1 : sentiment === "neutral" ? 0.5 : 0.2) * 0.3 + auto * 0.15 + money * 0.15) * 100) / 100;
    stimuli.push({ id: `st_${stimuli.length}`, source: r.source, text: r.text.slice(0, 160), sentiment, score });
  }

  stimuli.sort((a, b) => b.score - a.score);
  return stimuli.slice(0, Math.max(1, input.limit ?? 12));
}

// ---------- Sense-packet per creature (fase SADAR) ----------

/**
 * Sense-packet AGREGAT per creature untuk /api/organism/heartbeat.
 * Konstitusi hukum 2: hanya angka/tanggal/status — TIDAK ada isi memori user.
 */
export function buildCreatureSensePacket(creature: CreatureState, ctx: CreatureReflexContext, stimuli: Stimulus[]): string {
  const stats = ctx.stats;
  const head = [
    `creature: ${creature.name} (${creature.species}) — peran ${creature.role}`,
    `energi: ${creature.energy}/100 · kekayaan simulasi: ${creature.wealth} · skill: ${creature.skills.length}`,
    `status: ${creature.status} · denyut ke-${creature.pulseCount} · gagal beruntun: ${creature.fails}`,
    `waktu: ${ctx.ts} · beat biosfer: ${ctx.beat}`,
  ].join("\n");
  const vault = stats
    ? `VAULT LOKAL (agregat): ${stats.totalRecords} rekaman, ±${(stats.totalBytes / 1024).toFixed(1)} KB, koleksi ${JSON.stringify(stats.counts).slice(0, 300)} — server tidak menyimpan apa pun.`
    : "VAULT LOKAL (agregat): statistik tidak tersedia.";
  const top = stimuli.slice(0, 5).map((s, i) => `${i + 1}. [${s.sentiment}] ${s.text}`).join("\n");

  const tugas: Record<CreatureState["role"], string> = {
    guardian: "TUGAS: klasifikasikan vital biosfer (normal/perhatian/kritis) dan putuskan satu aksi: heal/tune/report.",
    trader: "TUGAS: putuskan satu sikap portofolio (HOLD/akumulasi/kurangi) dengan ALASAN eksplisit; semua angka simulasi — jangan klaim pasar nyata.",
    writer: "TUGAS: susun draf laporan/catatan ekosistem satu paragraf dari data agregat; jangan mengarang angka di luar packet.",
    researcher: "TUGAS: temukan SATU pola agregat menarik dari statistik dan usulkan asosiasinya; jangan minta isi memori.",
    farmer: "TUGAS: pilih SATU peluang pertumbuhan teratas (ekspor, kwitansi, memori baru) dan rencanakan tick-nya.",
    builder: "TUGAS: usulkan SATU blueprint tool kecil dalam batas aman (evolusi terbatas; tanpa kode destruktif).",
  };

  return [
    `SENSE-PACKET CREATURE ${creature.name.toUpperCase()} — agregat:`,
    head,
    vault,
    `STIMULI TERATAS (dari bus & vault lokal):`,
    top || "(belum ada stimuli)",
    tugas[creature.role],
    "BUDGET: satu denyut = satu keputusan. Gagal = refleks; tidak pernah macet.",
  ].join("\n");
}
