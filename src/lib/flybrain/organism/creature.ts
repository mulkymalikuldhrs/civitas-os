// FLYBRAIN ORGANISM — creature.ts
// Model makhluk BIOSFER + REFLEKS deterministik per peran (11_AUTONOMOUS_ORGANISM.md §3.1).
// MURNI TypeScript (boleh import quant engine yang juga murni). TANPA import
// browser/server — dipakai klien (engine), server (validasi katalog via creatures.ts),
// dan view.
//
// Metabolisme energi (desain §3.1): aksi produktif menambah energi/kekayaan;
// denyut menguras kecil; energi 0 = tidur; dibangunkan prt/immune/reflect.
// Kekayaan creature = SIMULASI LOKAL (konstitusi hukum 3: bukan uang riil).

import type { CreatureId, CreatureMeta, CreatureRole } from "./creatures";
import { CREATURES } from "./creatures";
import { calculateRisk, kellyCriterion, optimizePortfolio, priceSeriesFromReturns, randomWalkReturns } from "./quant";

export type { CreatureId, CreatureMeta, CreatureRole };

export type CreatureStatus = "aktif" | "tidur" | "mati";

/** State hidup satu creature (tersimpan di settings lokal "organism.creatures"). */
export interface CreatureState {
  id: CreatureId;
  name: string;
  species: string;
  role: CreatureRole;
  genome: string[]; // sifat (traits) — boleh bertambah lewat skill
  energy: number; // 0–100
  wealth: number; // SIMULASI LOKAL — bukan uang riil
  skills: string[]; // skill terkristalisasi (factory)
  status: CreatureStatus;
  lastTrace: string | null; // ringkasan jejak terakhir
  lastAt: string | null;
  lastMode: "menalar" | "refleks" | null; // label jujur
  fails: number; // kegagalan LLM beruntun (untuk immune)
  pulseCount: number; // berapa denyut yang dia jalani
  bornAt: string;
}

/** Konteks refleks — semua angka AGREGAT dari klien (konstitusi hukum 2). */
export interface CreatureReflexContext {
  ts: string;
  beat: number;
  stats: { totalRecords: number; totalBytes: number; counts: Record<string, number> } | null;
  eventCount: number; // kejadian bus sejak buka
}

/** Keputusan refleks deterministik — SELALU berlabel mode "refleks". */
export interface CreatureReflexDecision {
  mode: "refleks";
  creatureId: CreatureId;
  phases: { sadar: string; tafsir: string; putuskan: string; bertindak: string; ingat: string };
  action: { type: string; target: string; payload: string | null; reason: string };
  energyDelta: number; // aksi produktif + ; denyut menguras -
  wealthDelta: number; // simulasi
  skillGain: string | null;
  remember: string;
}

const clampEnergy = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));
const num = (n: unknown, fb = 0): number => (typeof n === "number" && Number.isFinite(n) ? n : fb);
const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;

/** Id acuan 6 creature dalam urutan katalog (round-robin scheduler). */
export const REFLEX_ORDER: CreatureId[] = CREATURES.map((c) => c.id);

// ---------------------------------------------------------------------------
// Refleks per peran — fungsi MURNI: (creature, contextLocal) → keputusan refleks
// ---------------------------------------------------------------------------

/** prt — patroli vital (warisan loop PRT v0.2, dipadatkan jadi refleks murni). */
function reflexPrt(c: CreatureState, ctx: CreatureReflexContext): CreatureReflexDecision {
  const stats = ctx.stats;
  const mem = num(stats?.counts?.memories);
  const total = num(stats?.totalRecords);
  let tafsir = "vital normal";
  let payload: string;
  if (!stats) {
    tafsir = "kritis — statistik vault tidak terbaca";
    payload = "Vault tidak terbaca. Pemilik perlu membuka view Vault untuk memeriksa IndexedDB.";
  } else if (total <= 1) {
    tafsir = "perhatian — sarang masih kosong";
    payload = "Vault nyaris kosong. Sarang menunggu memori pertama pemilik.";
  } else if (stats.totalBytes > 4_500_000) {
    tafsir = "perhatian — vault mendekati kuota UI";
    payload = `Vault ${kb(stats.totalBytes)} — sarankan ekspor JSON rutin (durabilitas = tanggung jawab bersama).`;
  } else {
    payload = `Patroli bersih: ${mem} memori, ${total} rekaman, ±${kb(stats.totalBytes)}. ${ctx.eventCount} kejadian biosfer tercatat.`;
  }
  return {
    mode: "refleks",
    creatureId: c.id,
    phases: {
      sadar: `beat ${ctx.beat}: statistik agregat vault ${stats ? "terbaca" : "tidak terbaca"}.`,
      tafsir,
      putuskan: "laporkan vital ke ledger — tidak ada aksi berisiko.",
      bertindak: "laporan vital ditulis ke ledger lokal.",
      ingat: "patroli refleks tercatat; denyut berikutnya melanjutkan.",
    },
    action: {
      type: "report",
      target: "vital-biosfer",
      payload,
      reason: "refleks guardian: patroli vital tanpa penalar (konstitusi hukum 6).",
    },
    energyDelta: stats && total > 1 ? +3 : +1,
    wealthDelta: 0,
    skillGain: null,
    remember: "vital biosfer dipatroli (refleks).",
  };
}

/**
 * Tradio — skoring SIMULASI random-walk via quant engine (port perilaku
 * trader upstream; sumber data diganti pasar simulasi lokal — diakui jujur).
 */
function reflexTradio(c: CreatureState, ctx: CreatureReflexContext): CreatureReflexDecision {
  // Seed deterministik per denyut: variasi antar tick, reprodusibel per tick.
  const seed = (c.id.charCodeAt(0) * 7919 + c.pulseCount * 104729 + ctx.beat * 1299709) % 2 ** 31;
  const returns = randomWalkReturns(60, seed);
  const prices = priceSeriesFromReturns(returns);
  const risk = calculateRisk(returns);

  // Estimasi parameter bet biner dari deret simulasi:
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r <= 0);
  const winProb = wins.length / returns.length;
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0.0001;
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0.0001;
  const kelly = kellyCriterion(winProb, Math.max(avgWin, 1e-6), Math.max(avgLoss, 1e-6));

  const last = prices[prices.length - 1];
  const first = prices[0];
  const drift = ((last - first) / first) * 100;

  const posisi = kelly.edge > 0 && kelly.fraction > 0.08
    ? `akumulasi posisi ${(kelly.conservative * 100).toFixed(1)}% modal simulasi (half-Kelly)`
    : "HOLD — edge tidak cukup, uang simulasi ditidurkan";

  const wealthDelta = Math.round(kelly.edge * 100 * kelly.conservative * 100) / 100;

  return {
    mode: "refleks",
    creatureId: c.id,
    phases: {
      sadar: `deret harga simulasi 60 titik: ${first} → ${last} (drift ${drift.toFixed(2)}%).`,
      tafsir: `VaR95 ${(risk.var95 * 100).toFixed(2)}% · vol ${(risk.volatility * 100).toFixed(2)}% · winProb ${(winProb * 100).toFixed(0)}% → edge ${kelly.edge.toFixed(4)}.`,
      putuskan: posisi,
      bertindak: `quant tick dijalankan lokal; P&L simulasi ${wealthDelta >= 0 ? "+" : ""}${wealthDelta}.`,
      ingat: "semua angka = simulasi random-walk lokal, BUKAN pasar nyata (konstitusi hukum 3).",
    },
    action: {
      type: "quant_tick",
      target: "portofolio-simulasi",
      payload: JSON.stringify({ kelly: kelly.conservative, edge: kelly.edge, var95: risk.var95, driftPct: Math.round(drift * 100) / 100 }),
      reason: "refleks trader: keputusan dari quant engine murni tanpa penalar (konstitusi hukum 6).",
    },
    energyDelta: +4,
    wealthDelta,
    skillGain: null,
    remember: `signal simulasi ${drift >= 0 ? "naik" : "turun"} ${(Math.abs(drift)).toFixed(1)}% (refleks).`,
  };
}

/** Scriba — laporan keadaan dari ledger lokal. */
function reflexScriba(c: CreatureState, ctx: CreatureReflexContext): CreatureReflexDecision {
  const stats = ctx.stats;
  const decisions = num(stats?.counts?.decisions);
  const logs = num(stats?.counts?.logs);
  const memories = num(stats?.counts?.memories);
  const judul = `Laporan ${ctx.ts.slice(0, 16)} — ${memories} memori, ${decisions} keputusan, ${logs} log; biosfer mencatat ${ctx.eventCount} kejadian sesi ini.`;
  return {
    mode: "refleks",
    creatureId: c.id,
    phases: {
      sadar: "ledger lokal terbuka; angka agregat terkumpul.",
      tafsir: decisions > 0 ? "biosfer aktif mengambil keputusan." : "biosfer belum banyak memutuskan — catatan masih sepi.",
      putuskan: "susun draf laporan keadaan satu paragraf.",
      bertindak: "draf laporan ditulis ke ledger.",
      ingat: "laporan refleks tercatat — bahan draf lebih panjang nanti.",
    },
    action: {
      type: "log_ledger",
      target: "laporan-keadaan",
      payload: judul,
      reason: "refleks writer: laporan hanya dari data yang benar-benar terbaca (konstitusi hukum 5).",
    },
    energyDelta: +3,
    wealthDelta: 0,
    skillGain: null,
    remember: "laporan keadaan ditulis (refleks).",
  };
}

/** Lumen — indeks statistik vault + temuan pola agregat. */
function reflexLumen(c: CreatureState, ctx: CreatureReflexContext): CreatureReflexDecision {
  const stats = ctx.stats;
  const counts = stats?.counts ?? {};
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  const temuan = top
    ? `Koleksi terbesar: "${top[0]}" (${top[1]} rekaman). Distribusi: ${entries.slice(0, 4).map(([k, v]) => `${k}=${v}`).join(", ")}.`
    : "Vault kosong — belum ada pola yang bisa diindeks.";
  return {
    mode: "refleks",
    creatureId: c.id,
    phases: {
      sadar: `mengindeks ${num(stats?.totalRecords)} rekaman agregat.`,
      tafsir: top && top[1] > 0 ? "pola dominan teridentifikasi dari statistik." : "belum ada pola — vault menunggu data.",
      putuskan: "catat temuan pola ke ledger (agregat saja, tanpa isi memori).",
      bertindak: "indeks ditulis; privasi terjaga (hukum 2).",
      ingat: "indeks agregat tercatat untuk asosiasi berikutnya.",
    },
    action: {
      type: "report",
      target: "indeks-vault",
      payload: temuan,
      reason: "refleks researcher: hanya statistik agregat — isi memori tidak pernah dibuka.",
    },
    energyDelta: +3,
    wealthDelta: 0,
    skillGain: null,
    remember: "indeks vault diperbarui (refleks).",
  };
}

/** Cresca — checklist panen peluang deterministik. */
function reflexCresca(c: CreatureState, ctx: CreatureReflexContext): CreatureReflexDecision {
  const stats = ctx.stats;
  const memories = num(stats?.counts?.memories);
  const receipts = num(stats?.counts?.receipts);
  const totalBytes = num(stats?.totalBytes);
  const checklist: string[] = [
    `${memories >= 3 ? "[x]" : "[ ]"} tanam minimal 3 memori (ada ${memories})`,
    `${receipts > 0 ? "[x]" : "[ ]"} kwitansi tersimpan & siap divalidasi (${receipts})`,
    `${totalBytes > 4_000_000 ? "[x]" : "[ ]"} ekspor JSON rutin (vault ±${kb(totalBytes)})`,
  ];
  const done = checklist.filter((i) => i.startsWith("[x]")).length;
  return {
    mode: "refleks",
    creatureId: c.id,
    phases: {
      sadar: "musim panen diperiksa: 3 lahan peluang.",
      tafsir: `${done}/3 lahan sudah panen — fokus ke lahan yang belum.`,
      putuskan: "tick checklist panen; satu panen per denyut (budget).",
      bertindak: "checklist ditulis ke ledger.",
      ingat: "panen refleks tercatat; musim berikutnya mengejar sisanya.",
    },
    action: {
      type: "log_ledger",
      target: "checklist-panen",
      payload: checklist.join(" · "),
      reason: "refleks farmer: panen peluang lokal, bukan klaim uang riil (hukum 3).",
    },
    energyDelta: +4,
    wealthDelta: +1,
    skillGain: null,
    remember: "checklist panen di-tick (refleks).",
  };
}

/** Fabro — blueprint tool kecil dari kebutuhan vault (factory dalam batas). */
function reflexFabro(c: CreatureState, ctx: CreatureReflexContext): CreatureReflexDecision {
  const stats = ctx.stats;
  const memories = num(stats?.counts?.memories);
  const decisions = num(stats?.counts?.decisions);
  let blueprint: { nama: string; isi: string[] };
  if (memories < 3) {
    blueprint = {
      nama: "template-memori-cepat",
      isi: ["input judul 1 baris", "input isi 3 baris", "tombol simpan → vault lokal"],
    };
  } else if (decisions < 3) {
    blueprint = {
      nama: "pemicu-denyut-pintar",
      isi: ["tombol denyut di setiap view", "pilih creature prioritas", "tampilkan hasil 5 fase"],
    };
  } else {
    blueprint = {
      nama: "ringkasan-vault-mingguan",
      isi: ["baca statistik agregat", "susun 5 butir ringkasan", "simpan sebagai memori semantic"],
    };
  }
  const skill = `blueprint:${blueprint.nama}`;
  const baru = !c.skills.includes(skill);
  return {
    mode: "refleks",
    creatureId: c.id,
    phases: {
      sadar: `kebutuhan vault dipindai: ${memories} memori, ${decisions} keputusan.`,
      tafsir: memories < 3 ? "memori langka — prioritas onboarding." : decisions < 3 ? "keputusan sepi — denyut perlu lebih dekat ke pemilik." : "vault sehat — otomatiskan ringkasan.",
      putuskan: `rakit blueprint "${blueprint.nama}" (data, bukan kode — dalam batas evolusi terbatas).`,
      bertindak: baru ? `skill ${skill} dikristalisasi ke genom.` : `skill ${skill} sudah ada — diasah ulang.`,
      ingat: "blueprint tersimpan sebagai skill lokal creature.",
    },
    action: {
      type: "skill_record",
      target: blueprint.nama,
      payload: JSON.stringify(blueprint),
      reason: "refleks builder: menyetel parameter diri, TIDAK menulis ulang kode fundamental (evolusi terbatas).",
    },
    energyDelta: +4,
    wealthDelta: +1,
    skillGain: baru ? skill : null,
    remember: `blueprint ${blueprint.nama} dirakit (refleks).`,
  };
}

/** Refleks deterministik per peran — pintu tunggal. */
export function creatureReflex(creature: CreatureState, ctx: CreatureReflexContext): CreatureReflexDecision {
  switch (creature.role) {
    case "guardian":
      return reflexPrt(creature, ctx);
    case "trader":
      return reflexTradio(creature, ctx);
    case "writer":
      return reflexScriba(creature, ctx);
    case "researcher":
      return reflexLumen(creature, ctx);
    case "farmer":
      return reflexCresca(creature, ctx);
    case "builder":
      return reflexFabro(creature, ctx);
  }
}

// ---------------------------------------------------------------------------
// Portofolio simulasi gabungan (dipakai refleks Tradio & panel quant UI)
// ---------------------------------------------------------------------------

/** Enam entitas pasar simulasi dari state creature (untuk runQuantTick). */
export function marketEntitiesFromCreatures(creatures: CreatureState[]): {
  id: string;
  name: string;
  population: number;
  tech_level: number;
  wealth: number;
  happiness: number;
  history: number[];
}[] {
  return creatures.map((c, i) => {
    const seed = (c.id.charCodeAt(0) * 104729 + Math.round(c.wealth) * 7919 + i * 31) % 2 ** 31;
    return {
      id: c.id,
      name: c.name,
      population: 10 + c.skills.length * 5,
      tech_level: Math.round(c.energy / 2),
      wealth: Math.max(1, c.wealth),
      happiness: Math.round(c.energy),
      history: randomWalkReturns(30, seed),
    };
  });
}

// ---------------------------------------------------------------------------
// Factory state awal
// ---------------------------------------------------------------------------

/** 6 creature awal dari katalog (dipanggil sekali per perangkat, lalu persist). */
export function initialCreatures(): CreatureState[] {
  const now = new Date().toISOString();
  return CREATURES.map((m, i) => ({
    id: m.id,
    name: m.name,
    species: m.species,
    role: m.role,
    genome: [...m.traits],
    energy: 72 + ((i * 5) % 20), // variasi awal 72–91
    wealth: 10 + i * 5,
    skills: [],
    status: "aktif" as CreatureStatus,
    lastTrace: null,
    lastAt: null,
    lastMode: null,
    fails: 0,
    pulseCount: 0,
    bornAt: now,
  }));
}
