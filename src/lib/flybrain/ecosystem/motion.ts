// FLYBRAIN ECOSYSTEM — motion.ts (v1.2 "PLANET", 12_ECOSYSTEM.md §2–§3)
// Tubuh creature DI DUNIA: rumah per peran, migrasi ke biome subur, mood,
// dan target gerak. worldTick mengerjakan POSISI TARGET (x,y ternormalisasi);
// UI (PlanetView) yang lerp-kan per frame — tidak ada teleport.
//
// Label jujur (12_ECOSYSTEM §7): wire table = [T]; mekanisme iklim = [D];
// migrasi/perilaku gerak = [H] (hipotesis perilaku yang divisualisasikan).
// MURNI TypeScript, deterministik (hash, bukan Math.random) — testable.

import type { CreatureId } from "../organism/creatures";
import type { BiomeId, ClimateState, CreatureWorldState, WorldSignals } from "./types";
import { BIOME_IDS } from "./types";
import { cuacaDrainFactor, faseDrainFactor } from "./climate";

// ---------------------------------------------------------------------------
// Rumah per peran (12_ECOSYSTEM §3) — [D]
// ---------------------------------------------------------------------------

export const HOME_BIOME: Record<CreatureId, BiomeId> = {
  prt: "hutan", // patroli sarang → Hutan Memori
  tradio: "gunung", // Pembaca sinyal → Pegunungan Kuant
  scriba: "kota", // Jurulis → Kota Alat
  lumen: "kawah", // Peneliti → Kawah Riset
  cresca: "savana", // Petani → Savana Tumbuh
  fabro: "kota", // Builder → Kota Alat
};

/** Biome yang sesuai peran untuk migrasi (kandidat pertama = paling cocok). */
export const SUITABLE_BIOME: Record<CreatureId, BiomeId[]> = {
  prt: ["hutan", "kutub"],
  tradio: ["gunung"],
  scriba: ["kota"],
  lumen: ["kawah"],
  cresca: ["savana"],
  fabro: ["kota"],
};

/** Biome yang didatangi saat bekerja sesuai peran (patroli/kunjungan kerja) [H]. */
export const VISIT_BIOME: Record<CreatureId, BiomeId[]> = {
  prt: ["samudra", "kutub", "hutan", "kota"], // patroli gerbang, konstitusi, sarang
  tradio: ["gunung", "kota", "savana"], // baca pasar, koordinasi, peluang
  scriba: ["kota", "hutan", "kawah"], // wawancara memori & riset untuk laporan
  lumen: ["kawah", "hutan", "langit"], // indeks memori, tatap atlas
  cresca: ["savana", "hutan", "samudra"], // tanam, panen, cek gerbang
  fabro: ["kota", "kawah", "gunung"], // rakit tool, cari pola & sinyal
};

/** Ambang stok energi biome → creature menganggap biome kelaparan. */
export const BIOME_HUNGER_THRESHOLD = 25;

/** Energi creature < 30 → mood "lapar" (12_ECOSYSTEM §3). */
export const CREATURE_HUNGER_THRESHOLD = 30;

// ---------------------------------------------------------------------------
// Determinisme: hash FNV-1a → 0..1 (pengganti Math.random untuk logika)
// ---------------------------------------------------------------------------

export function hash01(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// ---------------------------------------------------------------------------
// Pusat biome (ternormalisasi 0..1 pada peta) — sumber kebenaran posisi.
// Dipakai motion (target) dan PlanetView (gambar blob). Langit = band atas.
// ---------------------------------------------------------------------------

export const BIOME_CENTERS: Record<BiomeId, { x: number; y: number; r: number }> = {
  langit: { x: 0.5, y: 0.105, r: 0.24 },
  kutub: { x: 0.13, y: 0.285, r: 0.115 },
  hutan: { x: 0.265, y: 0.52, r: 0.14 },
  kawah: { x: 0.215, y: 0.795, r: 0.115 },
  gunung: { x: 0.575, y: 0.315, r: 0.135 },
  savana: { x: 0.475, y: 0.585, r: 0.13 },
  kota: { x: 0.755, y: 0.56, r: 0.14 },
  samudra: { x: 0.775, y: 0.845, r: 0.15 },
};

/** Biome daratan (creature tidak bisa tinggal di langit). */
export const LAND_BIOMES: BiomeId[] = BIOME_IDS.filter((b) => b !== "langit");

/** Pos awal creature: rumahnya, dengan sebaran deterministik di dalam biome. */
export function spawnPosition(id: CreatureId, biome: BiomeId): { x: number; y: number } {
  const c = BIOME_CENTERS[biome];
  const a = hash01(`${id}:spawn:a`) * Math.PI * 2;
  const r = hash01(`${id}:spawn:r`) * 0.45;
  return { x: clamp01(c.x + Math.cos(a) * c.r * r), y: clamp01(c.y + Math.sin(a) * c.r * r * 0.72) };
}

// ---------------------------------------------------------------------------
// Mood & target gerak
// ---------------------------------------------------------------------------

export function moodOf(
  creature: { id: CreatureId; energy: number; status: string },
  climate: ClimateState,
  movedBiome: boolean,
): CreatureWorldState["mood"] {
  if (movedBiome) return "migrasi";
  if (creature.status === "tidur" || creature.status === "mati") return "tidur";
  // Malam: semua tidur kecuali prt patroli (12_ECOSYSTEM §2).
  if (climate.fase === "malam" && creature.id !== "prt") return "tidur";
  if (creature.energy < CREATURE_HUNGER_THRESHOLD) return "lapar";
  return "bekerja";
}

/**
 * Target biome denyut ini untuk satu creature — [H] perilaku:
 *  1. LAPAR WILAYAH: stok biome < ambang, atau musim kelaparan → migrasi ke
 *     biome paling subur yang sesuai perannya (12_ECOSYSTEM §2).
 *  2. Badai: prt memindahkan jaga ke Kutub Konstitusi (§3).
 *  3. Kunjungan kerja role-based (deterministik dari beat).
 *  4. Default: wander di dalam biome sendiri (dunia tak pernah beku).
 */
export function targetBiomeOf(
  id: CreatureId,
  current: BiomeId,
  climate: ClimateState,
  biomeEnergi: Record<BiomeId, number>,
  biomeFertility: Record<BiomeId, number>,
): { biome: BiomeId; reason: string } {
  const energyCurrent = biomeEnergi[current] ?? 0;

  // 1) Kelaparan wilayah / musim kelaparan → migrasi ke biome subur sesuai peran.
  const kelaparanMusim = climate.musim === "kelaparan";
  if (energyCurrent < BIOME_HUNGER_THRESHOLD || kelaparanMusim) {
    const kandidat = SUITABLE_BIOME[id];
    const best = [...kandidat]
      .sort(
        (a, b) =>
          biomeFertility[b] + biomeEnergi[b] - (biomeFertility[a] + biomeEnergi[a]),
      )[0];
    if (best && best !== current && (biomeFertility[best] > biomeFertility[current] || kelaparanMusim)) {
      return {
        biome: best,
        reason: kelaparanMusim ? "musim kelaparan — migrasi ke biome subur sesuai peran" : "biome kampung kehabisan energi — migrasi",
      };
    }
    // Kandidat peran ikut kering → cari biome daratan paling subur mana pun.
    const anyBest = LAND_BIOMES.slice().sort((a, b) => biomeFertility[b] - biomeFertility[a])[0];
    if (anyBest && anyBest !== current && biomeFertility[anyBest] > biomeFertility[current]) {
      return { biome: anyBest, reason: "seluruh biome peran kering — migrasi ke biome paling subur" };
    }
  }

  // 2) Badai → prt jaga ke kutub (12_ECOSYSTEM §3).
  if (climate.cuaca === "badai" && id === "prt") {
    return { biome: "kutub", reason: "badai — prt memindahkan patroli ke Kutub Konstitusi" };
  }

  // 3) Kunjungan kerja role-based, deterministik per denyut (hash, bukan random).
  const visits = VISIT_BIOME[id];
  const roll = hash01(`${id}:${climate.beat}:visit`);
  if (roll < 0.55) {
    const idx = Math.floor(hash01(`${id}:${climate.beat}:v`) * visits.length) % visits.length;
    const target = visits[idx] ?? current;
    return { biome: target, reason: "kunjungan kerja sesuai peran" };
  }

  return { biome: current, reason: "wander di dalam biome sendiri" };
}

/** Titik target di dalam biome (deterministik per creature+beat) → 0..1. */
export function pointInBiome(id: CreatureId, beat: number, biome: BiomeId): { x: number; y: number } {
  const c = BIOME_CENTERS[biome];
  const a = hash01(`${id}:${beat}:a`) * Math.PI * 2;
  const r = 0.2 + hash01(`${id}:${beat}:r`) * 0.55;
  return {
    x: clamp01(c.x + Math.cos(a) * c.r * r),
    y: clamp01(c.y + Math.sin(a) * c.r * r * 0.72),
  };
}

function clamp01(n: number): number {
  return Math.max(0.02, Math.min(0.98, n));
}

/**
 * Update tubuh dunia SATU creature: target posisi, biome, mood, trail (≤24).
 * Murni — menerima state lama + iklim + kondisi biome, mengembalikan state baru.
 */
export function stepCreatureWorld(
  prev: CreatureWorldState,
  creature: { id: CreatureId; energy: number; status: string },
  climate: ClimateState,
  biomeEnergi: Record<BiomeId, number>,
  biomeFertility: Record<BiomeId, number>,
  nowMs: number,
  trailMax: number,
): CreatureWorldState {
  const { biome: targetBiome, reason } = targetBiomeOf(prev.id, prev.biome, climate, biomeEnergi, biomeFertility);
  const movedBiome = targetBiome !== prev.biome;
  const p = pointInBiome(prev.id, climate.beat, targetBiome);
  const moved = Math.hypot(p.x - prev.x, p.y - prev.y) > 0.004;
  const mood = moodOf(creature, climate, movedBiome);

  // ANGIN = trail lebih panjang (spesifikasi §2); normal 12, angin 24.
  const cap = climate.angin ? trailMax : Math.min(12, trailMax);
  const trail = moved ? [...prev.trail, { x: prev.x, y: prev.y }].slice(-cap) : prev.trail;

  return {
    ...prev,
    x: p.x,
    y: p.y,
    biome: targetBiome,
    trail,
    mood,
    lastMoveAt: moved ? new Date(nowMs).toISOString() : prev.lastMoveAt,
    lastReason: reason,
  };
}

/** Kecepatan konsumsi grazing satu creature per denyut (dari stok biome). */
export function grazingDrain(climate: ClimateState, mood: CreatureWorldState["mood"]): number {
  let drain = 0.55; // metabolisme dasar dari stok biome (bukan angin kosong)
  drain *= faseDrainFactor(climate.fase);
  drain *= cuacaDrainFactor(climate.cuaca);
  if (mood === "migrasi") drain *= 1.3;
  if (mood === "bekerja") drain *= 1.15;
  return drain;
}

/** Ringkasan alasan (untuk inspektor creature). */
export function alasanTarget(reason: string): string {
  return reason;
}
