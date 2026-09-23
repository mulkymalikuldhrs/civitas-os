// FLYBRAIN ECOSYSTEM — world.ts (v1.2 "PLANET", 12_ECOSYSTEM.md §1, §2, §4)
// Definisi 8 biome + WIRE TABLE (fitur nyata ter-wire) + produksi energi biome
// dari SINYAL NYATA (stats delta, eventLog, quant, skills, verdict reflect,
// breaker) + worldTick MURNI & testable.
//
// Aturan mutlak:
//  • NOL Math.random di logika (deterministik dari data nyata; partikel visual
//    acak diperbolehkan hanya di canvas).
//  • worldTick TIDAK fetch, TIDAK LLM — <5ms, aman tiap denyut (konstitusi 6).
//  • Nol penyimpanan: state dunia persist HANYA ke settings vault lokal user.
//  • Dunia = METAFORA VISUAL dari data nyata (12_ECOSYSTEM §7) — dunia tidak
//    mengambil keputusan baru; ia menyalurkan energi aksi creature yang ada.
//
// MURNI TypeScript — dipakai klien (engine/view) dan server (tool MCP world.map).

import { CREATURES, type CreatureId } from "../organism/creatures";
import type { BiosferEvent } from "../organism/eventBus";
import { climateOf, seasonProductionFactor, jamDunia, hariDunia } from "./climate";
import {
  BIOME_CENTERS,
  HOME_BIOME,
  grazingDrain,
  spawnPosition,
  stepCreatureWorld,
} from "./motion";
import type { BiomeId, BiomeState, ClimateState, CreatureWorldState, WorldSignals, WorldState } from "./types";
import { BIOME_IDS, isBiomeId } from "./types";

// ---------------------------------------------------------------------------
// View tujuan per biome (untuk tombol "Buka fitur" — sama dengan ViewKey store)
// ---------------------------------------------------------------------------

export type BiomeView = "kendali" | "otak" | "prt" | "vault" | "gerbang" | "dokumen" | "ruang" | "biosfer";

// ---------------------------------------------------------------------------
// Definisi 8 biome (12_ECOSYSTEM §1) — [T] wire table fitur nyata
// ---------------------------------------------------------------------------

export interface BiomeMeta {
  id: BiomeId;
  nama: string;
  icon: string; // nama ikon lucide (file murni data — tanpa komponen)
  color: string;
  fitur: string; // fitur nyata yang di-wire
  sinyal: string; // sinyal input dari store
  output: string; // output hidup di kanvas
  deskripsi: string;
  view: BiomeView; // view tujuan tombol "Buka fitur"
}

export const BIOMES: BiomeMeta[] = [
  {
    id: "hutan",
    nama: "Hutan Memori",
    icon: "TreePine",
    color: "#4ade80",
    fitur: "Vault/memori user (00 Otak, 03 Vault)",
    sinyal: "stats.totalRecords, totalBytes, perubahan antar denyut",
    output: "Pohon tumbuh/menipis; kesuburan naik tiap record baru; kanopi ∝ bytes",
    deskripsi: "Kanopi kenangan — setiap memori yang tertanam di vault pemilik menumbuhkan satu pohon. Rimba ini adalah karbon ekosistem.",
    view: "vault",
  },
  {
    id: "samudra",
    nama: "Samudra Gerbang",
    icon: "Waves",
    color: "#38bdf8",
    fitur: "Endpoint universal /api/mcp + Service Worker (04 Gerbang)",
    sinyal: "panggilan gerbang tercatat (stats.counts.gateway_log), traffic tools/call",
    output: "Ombak = traffic; arus menyala saat tools/call; pasang-surut ∝ frekuensi akses",
    deskripsi: "Perairan luas tempat semua alat luar melayar masuk. Setiap tools/call adalah gelombang yang menyala di arusnya.",
    view: "gerbang",
  },
  {
    id: "gunung",
    nama: "Pegunungan Kuant",
    icon: "Mountain",
    color: "#cbd5e1",
    fitur: "Quant engine (portofolio simulasi Tradio)",
    sinyal: "quant tick (alokasi/rekomendasi), volatilitas portofolio",
    output: "Puncak-lembah bergeser tiap tick; salju = volatilitas tinggi",
    deskripsi: "Rantai pegunungan yang bergeser setiap quant tick. Salju di puncaknya adalah volatilitas — murni simulasi lokal, bukan pasar nyata.",
    view: "biosfer",
  },
  {
    id: "kota",
    nama: "Kota Alat",
    icon: "Building2",
    color: "#fbbf24",
    fitur: "Organ factory + kristalisasi skill (Scriba & Fabro)",
    sinyal: "creature.skills entries (jumlah & delta)",
    output: "Gedung baru menyala tiap skill baru; lampu kota ∞ jumlah skill",
    deskripsi: "Metropolis workshop — setiap skill yang dikristalisasi factory menyalakan gedung baru di cakrawalanya.",
    view: "biosfer",
  },
  {
    id: "savana",
    nama: "Savana Tumbuh",
    icon: "Wheat",
    color: "#a3e635",
    fitur: "Checklist panen peluang (Cresca) + kwitansi/pembayaran",
    sinyal: "kwitansi tersimpan (stats.counts.receipts), keputusan ledger",
    output: "Ladang berganti hijau-kuning per musim; panen = partikel emas",
    deskripsi: "Padang pertumbuhan — ladang peluang Cresca dan lumbung kwitansi pemilik. Musim menentukan warna panennya.",
    view: "kendali",
  },
  {
    id: "kawah",
    nama: "Kawah Riset",
    icon: "FlaskConical",
    color: "#a78bfa",
    fitur: "Self-reflect + indeksasi Lumen + temuan pola",
    sinyal: "reflect verdict, kejadian refleks di bus",
    output: "Kawah berpendar saat reflect jalan; asap hitam saat verdict critical",
    deskripsi: "Kaldera introspeksi — di sini biosfer mengaduh dirinya sendiri. Pendar ungunya adalah verdict yang sedang dicerna.",
    view: "ruang",
  },
  {
    id: "langit",
    nama: "Langit Konnektom",
    icon: "Sparkles",
    color: "#c084fc",
    fitur: "Atlas connectome (182 neuron virtual + fakta makro nyata)",
    sinyal: "keputusan yang melintasi gerbang, inspeksi atlas (01 Otak)",
    output: "Bintang = neuron; konstelasi berkedip saat atlas diinspeksi; bima sakti = sinaps",
    deskripsi: "Kubah langit peta otak — 182 bintang adalah neuron atlas; bima saktinya adalah sinaps. Setiap keputusan membuat langit berkelip.",
    view: "otak",
  },
  {
    id: "kutub",
    nama: "Kutub Konstitusi",
    icon: "Snowflake",
    color: "#e2e8f0",
    fitur: "Immune + konstitusi + breaker + veto",
    sinyal: "breaker state, kejadian veto",
    output: "Es tebal saat semua breaker sehat; retakan merah saat breaker terbuka; aurora saat veto menolak aksi",
    deskripsi: "Padang es di tiang dunia — konstitusi terukir di bekunya. Retakan merah berarti breaker immune terbuka; aurora berarti veto baru saja menolak aksi.",
    view: "ruang",
  },
];

export const BIOME_META: Record<BiomeId, BiomeMeta> = Object.fromEntries(
  BIOMES.map((b) => [b.id, b]),
) as Record<BiomeId, BiomeMeta>;

// ---------------------------------------------------------------------------
// WIRE TABLE — eksportable, dipakai UI PETA SISTEM & tool MCP world.map
// 12_ECOSYSTEM §1: "TIDAK BOLEH ADA FITUR YANG TAK TERWIRE"
// ---------------------------------------------------------------------------

export interface WireRow {
  no: number;
  biome: BiomeId;
  nama: string;
  fitur: string;
  sinyal: string;
  output: string;
  view: BiomeView;
}

export const WIRE_TABLE: WireRow[] = BIOMES.map((b, i) => ({
  no: i + 1,
  biome: b.id,
  nama: b.nama,
  fitur: b.fitur,
  sinyal: b.sinyal,
  output: b.output,
  view: b.view,
}));

// ---------------------------------------------------------------------------
// State awal & validasi (untuk muat dari settings vault lokal)
// ---------------------------------------------------------------------------

export function initialWorld(beat = 0, now = Date.now()): WorldState {
  const biomes = {} as Record<BiomeId, BiomeState>;
  for (const id of BIOME_IDS) {
    biomes[id] = {
      id,
      energi: 50,
      fertility: 55,
      sinyalTerakhir: "dunia baru lahir — menunggu denyut pertama",
      produksiTerakhir: 0,
      konsumsiTerakhir: 0,
    };
  }
  const creatures = {} as Record<CreatureId, CreatureWorldState>;
  for (const meta of CREATURES) {
    const home = HOME_BIOME[meta.id];
    const p = spawnPosition(meta.id, home);
    creatures[meta.id] = {
      id: meta.id,
      x: p.x,
      y: p.y,
      biome: home,
      homeBiome: home,
      trail: [],
      mood: "bekerja",
      lastMoveAt: new Date(now).toISOString(),
      lastReason: "lahir di rumah perannya",
    };
  }
  const climate: ClimateState = climateOf({
    beat,
    stats: null,
    eventLog: [],
    decisions: [],
    creatures: [],
    reflectVerdict: null,
    breakerOpen: 0,
    quantActive: false,
    quantVolatility: 0,
    quantAllocations: 0,
    now,
  });
  return {
    biomes,
    creatures,
    climate,
    tickCount: 0,
    lastTickAt: new Date(now).toISOString(),
    lastSeen: { records: 0, bytes: 0, gateway: 0, receipts: 0, skills: 0, decisions: 0 },
  };
}

/** Validasi longgar state dunia yang dimuat dari settings lokal. */
export function isWorldState(x: unknown): x is WorldState {
  if (typeof x !== "object" || x === null) return false;
  const w = x as Partial<WorldState>;
  if (!w.biomes || !w.creatures || !w.climate || typeof w.tickCount !== "number") return false;
  for (const id of BIOME_IDS) {
    const b = w.biomes[id];
    if (!b || typeof b.energi !== "number" || typeof b.fertility !== "number" || !isBiomeId(b.id)) return false;
  }
  for (const meta of CREATURES) {
    const c = w.creatures[meta.id];
    if (!c || !isBiomeId(c.biome) || !isBiomeId(c.homeBiome) || typeof c.x !== "number" || typeof c.y !== "number") return false;
    if (!Array.isArray(c.trail)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Produksi energi biome dari sinyal nyata (12_ECOSYSTEM §2 "jaring makanan")
// ---------------------------------------------------------------------------

interface Deltas {
  records: number;
  gateway: number;
  receipts: number;
  skills: number;
  bytes: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const kbOf = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

function reflectCount(events: BiosferEvent[]): number {
  return events.filter((e) => e.type === "reflect").length;
}

/** Produksi energi + teks sinyal nyata untuk SATU biome — fungsi murni. */
export function produceFor(
  biome: BiomeId,
  s: WorldSignals,
  d: Deltas,
): { prod: number; sinyal: string } {
  const records = s.stats?.totalRecords ?? 0;
  const bytes = s.stats?.totalBytes ?? 0;
  const gateway = s.stats?.counts?.gateway_log ?? 0;
  const receipts = s.stats?.counts?.receipts ?? 0;
  const skills = s.creatures.reduce((a, c) => a + c.skills.length, 0);
  const decisions = s.decisions.length;
  const reflects = reflectCount(s.eventLog);

  switch (biome) {
    case "hutan": {
      const prod = 0.6 + Math.min(2.5, d.records * 0.4) + Math.min(1.2, records * 0.02);
      return {
        prod,
        sinyal: d.records > 0
          ? `+${d.records} rekaman baru · ${records} total · ±${kbOf(bytes)} vault`
          : `${records} rekaman · ±${kbOf(bytes)} vault (tanpa pertumbuhan denyut ini)`,
      };
    }
    case "samudra": {
      const prod = 0.5 + Math.min(3, d.gateway * 0.5) + (gateway > 0 ? 0.8 : 0);
      return {
        prod,
        sinyal: d.gateway > 0
          ? `${d.gateway} panggilan gerbang baru · total ${gateway}`
          : `arus tenang · total ${gateway} panggilan gerbang tercatat`,
      };
    }
    case "gunung": {
      const prod = 0.4 + (s.quantActive ? 1.6 : 0) + s.quantVolatility * 1.4;
      return {
        prod,
        sinyal: s.quantActive
          ? `quant tick: ${s.quantAllocations} alokasi · volatilitas ${(s.quantVolatility * 100).toFixed(0)}%`
          : "quant belum berdenyut — pegunungan diam",
      };
    }
    case "kota": {
      const prod = 0.5 + Math.min(2.4, skills * 0.5) + Math.max(0, d.skills) * 0.8;
      return {
        prod,
        sinyal: `${skills} skill terkristalisasi (${d.skills > 0 ? `+${d.skills} baru` : d.skills < 0 ? `${d.skills}` : "tanpa skill baru"})`,
      };
    }
    case "savana": {
      const prod = 0.5 + Math.min(3, d.receipts * 0.6) + Math.min(1.2, decisions * 0.02) + (receipts > 0 ? 0.6 : 0);
      return {
        prod,
        sinyal: d.receipts > 0
          ? `+${d.receipts} kwitansi baru · ${receipts} tersimpan · ${decisions} keputusan ledger`
          : `${receipts} kwitansi tersimpan · ${decisions} keputusan ledger`,
      };
    }
    case "kawah": {
      const prod = 0.4 + (s.reflectVerdict === "critical" ? 0.1 : s.reflectVerdict ? 1.4 : 0.2) + Math.min(1, reflects * 0.1);
      return {
        prod,
        sinyal: `verdict reflect: ${s.reflectVerdict ?? "belum ada"} · ${reflects} kejadian refleks di bus`,
      };
    }
    case "langit": {
      const prod = 0.4 + Math.min(2, decisions * 0.03) + (d.gateway > 0 ? 0.6 : 0);
      return { prod, sinyal: `${decisions} keputusan menyalur bintang atlas · 182 neuron` };
    }
    case "kutub": {
      const prod = 0.4 + (s.breakerOpen === 0 ? 1.2 : 0.1);
      return {
        prod,
        sinyal: `${s.breakerOpen} breaker immune terbuka · konstitusi ${s.breakerOpen > 0 ? "tertekan" : "kokoh"}`,
      };
    }
  }
}

/** Faktor kesuburan dari nutrisi creature (aksi nyata → deposit balik). */
function nutrientDeposit(biome: BiomeId, s: WorldSignals, d: Deltas): number {
  // Nutrisi dari aksi creature yang baru saja tercatat di bus (maks +6).
  const recent = s.eventLog.slice(0, 20);
  let deposit = 0;
  const aksiTerbaru = new Set(recent.filter((e) => e.type === "act" || e.type === "ledger").map((e) => e.creatureId));
  for (const meta of CREATURES) {
    if (aksiTerbaru.has(meta.id)) deposit += 1.5;
  }
  deposit = Math.min(deposit, 6);

  // Nutrisi spesifik biome (12_ECOSYSTEM §1 output kolom).
  if (biome === "hutan") deposit += Math.min(10, Math.max(0, d.records) * 1.5);
  if (biome === "savana") deposit += Math.min(10, Math.max(0, d.receipts) * 2);
  if (biome === "kota") deposit += Math.min(10, Math.max(0, d.skills) * 3);
  return deposit;
}

// ---------------------------------------------------------------------------
// worldTick — satu denyut dunia (murni, testable, <5ms, tanpa LLM/fetch)
// ---------------------------------------------------------------------------

export function worldTick(prev: WorldState | null, s: WorldSignals): WorldState {
  const base = prev && isWorldState(prev) ? prev : initialWorld(s.beat, s.now);
  const climate = climateOf(s);
  const seasonFactor = seasonProductionFactor(climate.musim);
  const weatherProdFactor = climate.cuaca === "badai" ? 0.85 : 1;

  // 1) Delta penghitung antar denyut (sumber produksi & nutrisi).
  const records = s.stats?.totalRecords ?? base.lastSeen.records;
  const bytes = s.stats?.totalBytes ?? base.lastSeen.bytes;
  const gateway = s.stats?.counts?.gateway_log ?? base.lastSeen.gateway;
  const receipts = s.stats?.counts?.receipts ?? base.lastSeen.receipts;
  const skills = s.creatures.reduce((a, c) => a + c.skills.length, 0);
  const d: Deltas = {
    records: Math.max(0, records - base.lastSeen.records),
    gateway: Math.max(0, gateway - base.lastSeen.gateway),
    receipts: Math.max(0, receipts - base.lastSeen.receipts),
    skills: skills - base.lastSeen.skills,
    bytes: Math.max(0, bytes - base.lastSeen.bytes),
  };

  // 2) Produksi energi per biome (∝ aktivitas nyata × musim × cuaca).
  const biomes = {} as Record<BiomeId, BiomeState>;
  const energiMap = {} as Record<BiomeId, number>;
  for (const id of BIOME_IDS) {
    const { prod, sinyal } = produceFor(id, s, d);
    const prevB = base.biomes[id];
    const nextEnergi = clamp(prevB.energi * 0.93 + prod * seasonFactor * weatherProdFactor, 0, 100);
    energiMap[id] = nextEnergi;
    biomes[id] = { ...prevB, produksiTerakhir: Math.round(prod * seasonFactor * weatherProdFactor * 100) / 100, sinyalTerakhir: sinyal };
  }

  // 3) Gerak & mood creature (target posisi; UI yang lerp-kan).
  const creatures = {} as Record<CreatureId, CreatureWorldState>;
  const konsumsi = {} as Record<BiomeId, number>;
  for (const id of BIOME_IDS) konsumsi[id] = 0;
  for (const meta of CREATURES) {
    const prevC = base.creatures[meta.id];
    const live = s.creatures.find((c) => c.id === meta.id);
    const body = live ?? { id: meta.id, energy: 70, status: "aktif" as const };
    const nextC = stepCreatureWorld(prevC, body, climate, energiMap, energiMap, s.now, 24);
    creatures[meta.id] = nextC;
    konsumsi[nextC.biome] += grazingDrain(climate, nextC.mood);
  }

  // 4) Konsumsi (grazing) mengambil dari STOK biome — bukan dari angin kosong.
  const kelaparanDrain = climate.musim === "kelaparan" ? 0.4 : 1;
  for (const id of BIOME_IDS) {
    biomes[id] = {
      ...biomes[id],
      energi: clamp(energiMap[id] - konsumsi[id] * kelaparanDrain, 0, 100),
      konsumsiTerakhir: Math.round(konsumsi[id] * kelaparanDrain * 100) / 100,
    };
  }

  // 5) Kesuburan: nutrisi masuk, penalti musim/cuaca/biome-kosong, regresi pelan.
  const fertilityMap = {} as Record<BiomeId, number>;
  for (const id of BIOME_IDS) {
    const prevB = base.biomes[id];
    const nowB = biomes[id];
    let delta = 0;
    delta += nutrientDeposit(id, s, d);
    if (climate.musim === "hujan") delta += 0.8;
    if (climate.musim === "kemarau") delta -= 0.8;
    if (climate.musim === "kelaparan") delta -= 2.5;
    if (climate.cuaca === "badai") delta -= 1;
    if (nowB.energi < 15) delta -= 1.5; // biome kosong → kesuburan turun
    // Langit tidak digrazing creature — kesuburannya = kepadatan konstelasi.
    if (id === "langit") delta += clamp(s.decisions.length * 0.02, 0, 1.5);
    // Regresi pelan ke titik setimbang 55 (ekologi pulih sendiri).
    delta += (55 - prevB.fertility) * 0.05;
    fertilityMap[id] = clamp(prevB.fertility + delta, 0, 100);
    biomes[id] = { ...biomes[id], fertility: Math.round(fertilityMap[id] * 10) / 10 };
  }

  return {
    biomes,
    creatures,
    climate,
    tickCount: base.tickCount + 1,
    lastTickAt: new Date(s.now).toISOString(),
    lastSeen: { records, bytes, gateway, receipts, skills, decisions: s.decisions.length },
  };
}

// ---------------------------------------------------------------------------
// Snapshot ringkas — serialisasi untuk UI & inspektur (12_ECOSYSTEM §4)
// ---------------------------------------------------------------------------

export interface WorldSnapshot {
  tick: number;
  lastTickAt: string;
  climate: {
    hari: number;
    jam: number;
    fase: ClimateState["fase"];
    cuaca: ClimateState["cuaca"];
    musim: ClimateState["musim"];
    angin: boolean;
    errorRatio: number;
  };
  biomes: {
    id: BiomeId;
    nama: string;
    energi: number;
    fertility: number;
    produksi: number;
    konsumsi: number;
    penghuni: CreatureId[];
  }[];
  creatures: { id: CreatureId; biome: BiomeId; mood: string; x: number; y: number }[];
}

export function worldSnapshot(world: WorldState): WorldSnapshot {
  // Isi semua kunci biome eksplisit — tanpa cast (perbaikan TS2352/TS2740).
  const penghuni: Record<BiomeId, CreatureId[]> = {} as Record<BiomeId, CreatureId[]>;
  for (const id of BIOME_IDS) penghuni[id] = [];
  for (const c of Object.values(world.creatures)) penghuni[c.biome].push(c.id);
  return {
    tick: world.tickCount,
    lastTickAt: world.lastTickAt,
    climate: {
      hari: hariDunia(world.climate.beat),
      jam: jamDunia(world.climate.beat),
      fase: world.climate.fase,
      cuaca: world.climate.cuaca,
      musim: world.climate.musim,
      angin: world.climate.angin,
      errorRatio: world.climate.errorRatio,
    },
    biomes: BIOMES.map((b) => {
      const st = world.biomes[b.id];
      return {
        id: b.id,
        nama: b.nama,
        energi: Math.round(st.energi * 10) / 10,
        fertility: Math.round(st.fertility * 10) / 10,
        produksi: st.produksiTerakhir,
        konsumsi: st.konsumsiTerakhir,
        penghuni: penghuni[b.id],
      };
    }),
    creatures: Object.values(world.creatures).map((c) => ({
      id: c.id,
      biome: c.biome,
      mood: c.mood,
      x: Math.round(c.x * 1000) / 1000,
      y: Math.round(c.y * 1000) / 1000,
    })),
  };
}

/** Pusat biome ternormalisasi (dipakai PlanetView untuk blob & hit-test). */
export const BIOME_CENTER = BIOME_CENTERS;

// ---------------------------------------------------------------------------
// Kehidupan sosial & jaring makanan (v1.2.2) — fungsi MURNI, testable
// ---------------------------------------------------------------------------

/**
 * RENCOK — cari pasangan interaksi sosial: creature AKTIF lain yang saat ini
 * berada di biome yang sama dengan pelaku. Deterministik (urutan entry dunia);
 * tanpa Math.random. Null = tidak ada sekufu — sendiri di alam liar itu sah.
 */
export function findRencokPartner(
  world: WorldState,
  actorId: CreatureId,
  aktif: Set<CreatureId>,
): CreatureId | null {
  const me = world.creatures[actorId];
  if (!me || !isBiomeId(me.biome)) return null;
  for (const [id, w] of Object.entries(world.creatures)) {
    if (id === actorId) continue;
    if (w.biome !== me.biome) continue;
    if (!aktif.has(id as CreatureId)) continue;
    return id as CreatureId;
  }
  return null;
}

/**
 * PUPUK KEMATIAN — kekayaan yang ditinggalkan menyuburkan biome terakhir
 * (jaring makanan menutup loop: makhluk → tanah → produksi biome).
 * Impuls kecil & berbatas (maks +5) agar ekonomi dunia stabil.
 */
export function deathFertility(wealth: number): number {
  const w = Number.isFinite(wealth) && wealth > 0 ? wealth : 0;
  return Math.min(5, Math.round((w / 20) * 10) / 10);
}
