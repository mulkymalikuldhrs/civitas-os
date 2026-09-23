// FLYBRAIN ECOSYSTEM — types.ts (v1.2 "PLANET", 12_ECOSYSTEM.md §1–§3)
// Tipe dunia hidup: 8 biome, iklim, state biome, tubuh creature di dunia.
// MURNI TypeScript — tanpa import browser/server; dipakai klien (engine, view)
// dan server (tool MCP world.map) tanpa efek samping.

import type { CreatureId } from "../organism/creatures";
import type { CreatureState } from "../organism/creature";
import type { ReflectVerdict } from "../organism/selfReflect";
import type { BiosferEvent } from "../organism/eventBus";

// ---------------------------------------------------------------------------
// Biome — 8 alam yang menampung SEMUA fitur nyata (wire table 12_ECOSYSTEM §1)
// ---------------------------------------------------------------------------

export type BiomeId =
  | "hutan" // 1 🌲 Hutan Memori — vault/memori user
  | "samudra" // 2 🌊 Samudra Gerbang — endpoint universal /api/mcp + SW
  | "gunung" // 3 ⛰️ Pegunungan Kuant — quant engine (simulasi Tradio)
  | "kota" // 4 🏙️ Kota Alat — organ factory + kristalisasi skill
  | "savana" // 5 🌾 Savana Tumbuh — checklist panen + kwitansi/pembayaran
  | "kawah" // 6 🕳️ Kawah Riset — self-reflect + indeksasi Lumen
  | "langit" // 7 🌌 Langit Konnektom — atlas connectome 182 neuron
  | "kutub"; // 8 🧊 Kutub Konstitusi — immune + konstitusi + breaker + veto

export const BIOME_IDS: BiomeId[] = [
  "hutan",
  "samudra",
  "gunung",
  "kota",
  "savana",
  "kawah",
  "langit",
  "kutub",
];

export function isBiomeId(x: unknown): x is BiomeId {
  return typeof x === "string" && (BIOME_IDS as string[]).includes(x);
}

// ---------------------------------------------------------------------------
// Iklim — semua turunan data nyata, nol random kosong (12_ECOSYSTEM §2)
// ---------------------------------------------------------------------------

export type FaseHari = "siang" | "malam" | "senja" | "fajar";
export type Cuaca = "cerah" | "berawan" | "badai";
export type Musim = "hujan" | "kemarau" | "kelaparan";

export interface ClimateState {
  beat: number; // denyut biosfer saat iklim ini dihitung
  hari: number; // 1..7 — floor(beat/12) % 7 + 1 (12 denyut = 1 hari dunia)
  jamDunia: number; // 0..22 — (beat % 12) * 2 jam per denyut
  fase: FaseHari;
  cuaca: Cuaca;
  /** Alasan data (bukan kosmetik): sumber angka yang menyalakan cuaca. */
  alasanCuaca: string;
  /** Rasio kegagalan 20 denyut terakhir (0..1) — basis cuaca. */
  errorRatio: number;
  musim: Musim;
  /** Verdict self-reflect yang menyalakan musim (null = belum ada reflect). */
  verdictSumber: ReflectVerdict | null;
  alasanMusim: string;
  /** Volume keputusan tinggi = ANGIN (trail lebih panjang, partikel angin). */
  angin: boolean;
}

// ---------------------------------------------------------------------------
// State dunia
// ---------------------------------------------------------------------------

/** State satu biome: stok energi, kesuburan, dan sinyal nyata terakhir. */
export interface BiomeState {
  id: BiomeId;
  /** Stok energi 0..100 — diproduksi dari aktivitas nyata, digrazing creature. */
  energi: number;
  /** Kesuburan 0..100 — naik oleh nutrisi (record/kwitansi/skill/episode). */
  fertility: number;
  /** Teks sinyal nyata terakhir yang menyalakan biome ini (transparansi radikal). */
  sinyalTerakhir: string;
  /** Produksi energi denyut terakhir (untuk jaring makanan UI). */
  produksiTerakhir: number;
  /** Konsumsi creature denyut terakhir (grazing). */
  konsumsiTerakhir: number;
}

export type Mood = "bekerja" | "tidur" | "migrasi" | "lapar";

/** Tubuh creature DI DUNIA — posisi target (UI yang lerp-kan per frame). */
export interface CreatureWorldState {
  id: CreatureId;
  /** Posisi target ternormalisasi 0..1 (peta). */
  x: number;
  y: number;
  biome: BiomeId;
  homeBiome: BiomeId;
  /** Jejak posisi lama (maks 24, terlama pertama) — digambar memudar. */
  trail: { x: number; y: number }[];
  mood: Mood;
  lastMoveAt: string;
  /** Alasan keputusan gerak terakhir (transparansi radikal, [H] perilaku). */
  lastReason?: string;
}

/** Penghitung terakhir untuk DELTA antar denyut (sinyal produksi biome). */
export interface WorldCounters {
  records: number;
  bytes: number;
  gateway: number;
  receipts: number;
  skills: number;
  decisions: number;
}

/** State dunia penuh — persist LOKAL ke settings vault "organism.world". */
export interface WorldState {
  biomes: Record<BiomeId, BiomeState>;
  creatures: Record<CreatureId, CreatureWorldState>;
  climate: ClimateState;
  tickCount: number;
  lastTickAt: string;
  lastSeen: WorldCounters;
}

// ---------------------------------------------------------------------------
// Sinyal masuk worldTick — SEMUA dari data nyata store (12_ECOSYSTEM §4)
// ---------------------------------------------------------------------------

/** Sinyal agregat yang dikumpulkan engine dari store klien (tanpa isi memori). */
export interface WorldSignals {
  beat: number;
  /** Statistik vault agregat (null = vault belum terbaca). */
  stats: { totalRecords: number; totalBytes: number; counts: Record<string, number> } | null;
  /** Mirror bus biosfer (maks 200) — sumber kejadian reflect/act/ledger. */
  eventLog: BiosferEvent[];
  /** Stream keputusan (maks 50) — sumber rasio kegagalan cuaca. */
  decisions: { error?: string }[];
  /** State creature (energi/status/skills) — tubuh & nafsu makannya. */
  creatures: CreatureState[];
  /** Verdict self-reflect terakhir (null = biosfer belum introspeksi). */
  reflectVerdict: ReflectVerdict | null;
  /** Jumlah breaker immune yang terbuka (kutub: retakan merah). */
  breakerOpen: number;
  /** Apakah quant tick terakhir tersedia (gunung hidup). */
  quantActive: boolean;
  /** Volatilitas portofolio simulasi 0..1 (gunung: salju). */
  quantVolatility: number;
  /** Jumlah alokasi quant terakhir (sinyal gunung). */
  quantAllocations: number;
  /** Epoch ms saat tick — untuk lastMoveAt (dari luar agar murni/testable). */
  now: number;
}
