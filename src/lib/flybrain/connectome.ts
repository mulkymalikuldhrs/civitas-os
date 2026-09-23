// FLYBRAIN KERNEL — connectome.ts
// Atlas deterministik (seeded): 7 region nyata FAFB, ±180 neuron virtual.
// Statistik makro yang DITAMPILKAN di UI adalah angka nyata dengan atribusi.

import type { Atlas, Edge, Neuron, RegionDef } from "./types";

export const REGIONS: RegionDef[] = [
  { key: "antennal", name: "Lobus Antena", module: "GERBANG — input universal", role: "Menangkap sinyal dari dunia luar (tool, agent, perangkat).", share: 0.16, hue: 150 },
  { key: "calyx", name: "Kaliks Lobus Jamur", module: "VAULT — memori asosiatif", role: "Mengikat masukan menjadi memori bermakna.", share: 0.18, hue: 95 },
  { key: "kenyon", name: "Sel Kenyon & Lobus Jamur", module: "VAULT — memori jangka panjang", role: "Penyimpanan memori episodik & semantik.", share: 0.2, hue: 130 },
  { key: "central", name: "Kompleks Pusat", module: "PRT — koordinasi & keputusan", role: "Navigasi, penjadwalan patroli, keputusan motorik.", share: 0.12, hue: 40 },
  { key: "optic", name: "Lobus Optik", module: "VISUAL — lapisan pemantauan", role: "Memproses apa yang terlihat: metrik, meter, grafik.", share: 0.2, hue: 170 },
  { key: "lateral", name: "Projeksi Lateral Horn", module: "ROUTER — pemetaan endpoint", role: "Menyalurkan sinyal ke jalur yang tepat.", share: 0.08, hue: 105 },
  { key: "fibrillar", name: "Fibrillar Body & Ring", module: "IDENTITAS — status internal", role: "Integrasi kondisi diri: tier, sesi, vital.", share: 0.06, hue: 65 },
];

/** Angka makro NYATA untuk UI (terverifikasi, riset 2026-09-21). */
export const MACRO_FACTS = {
  female: { label: "FAFB — FlyWire (betina, Nature 2024)", neurons: 139_255, synapses: "50 juta+", cellTypes: "±8.400", source: "codex.flywire.ai" },
  male: { label: "CNS lalat jantan — Janelia + Google (3 Sep 2026)", neurons: 166_000, synapses: "±125 juta", cellTypes: "—", source: "Janelia Research Campus / WIRED" },
  mcp: { label: "Ekosistem MCP (Apr 2025)", servers: "5.800+", downloads: "8 juta+", growth: "+8.000% (5 bulan)", source: "digitalapplied / guptadeepak" },
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOTAL_VIRTUAL = 182;
const PREFIX: Record<string, string> = {
  antennal: "AL",
  calyx: "CA",
  kenyon: "KC",
  central: "CX",
  optic: "OL",
  lateral: "LH",
  fibrillar: "FB",
};

/** Pusat & jarak cluster region dalam bidang 1000x620 (bentuk otak kasar). */
const CENTERS: Record<string, { x: number; y: number; r: number }> = {
  antennal: { x: 250, y: 330, r: 110 },
  calyx: { x: 430, y: 220, r: 130 },
  kenyon: { x: 560, y: 300, r: 150 },
  central: { x: 520, y: 420, r: 95 },
  optic: { x: 770, y: 300, r: 165 },
  lateral: { x: 350, y: 430, r: 85 },
  fibrillar: { x: 640, y: 480, r: 60 },
};

let cache: Atlas | null = null;

export function buildAtlas(): Atlas {
  if (cache) return cache;
  const rnd = mulberry32(20260921);
  const neurons: Neuron[] = [];
  let id = 0;
  for (const region of REGIONS) {
    const n = Math.max(6, Math.round(TOTAL_VIRTUAL * region.share));
    const c = CENTERS[region.key];
    for (let i = 0; i < n; i++) {
      const ang = rnd() * Math.PI * 2;
      const rad = Math.sqrt(rnd()) * c.r;
      const deg = 2 + Math.floor(rnd() * 9);
      neurons.push({
        id,
        catalog: `${PREFIX[region.key]}_${String(id).padStart(4, "0")}`,
        region: region.key,
        x: c.x + Math.cos(ang) * rad,
        y: c.y + Math.sin(ang) * rad * 0.82,
        degree: deg,
        synapses: deg * (40 + Math.floor(rnd() * 260)),
      });
      id += 1;
    }
  }

  const edges: Edge[] = [];
  const byRegion: Record<string, number[]> = {};
  for (const n of neurons) (byRegion[n.region] ??= []).push(n.id);

  // intra-region: tiap neuron terhubung ke 2-3 tetangga terdekat acak
  for (const n of neurons) {
    const pool = byRegion[n.region].filter((x) => x !== n.id);
    const k = Math.min(pool.length, 2 + Math.floor(rnd() * 2));
    for (let i = 0; i < k; i++) {
      const b = pool[Math.floor(rnd() * pool.length)];
      if (b === n.id) continue;
      if (!edges.some((e) => (e.a === n.id && e.b === b) || (e.a === b && e.b === n.id))) {
        edges.push({ a: n.id, b, w: 0.4 + rnd() * 0.6 });
      }
    }
  }
  // antar-region: jalur utama sesuai aliran data platform
  const highways: [string, string][] = [
    ["antennal", "lateral"],
    ["lateral", "calyx"],
    ["calyx", "kenyon"],
    ["kenyon", "central"],
    ["antennal", "optic"],
    ["optic", "central"],
    ["central", "fibrillar"],
    ["calyx", "fibrillar"],
  ];
  for (const [ra, rb] of highways) {
    const A = byRegion[ra];
    const B = byRegion[rb];
    const k = 4;
    for (let i = 0; i < k; i++) {
      edges.push({
        a: A[Math.floor(rnd() * A.length)],
        b: B[Math.floor(rnd() * B.length)],
        w: 0.9,
      });
    }
  }

  cache = { neurons, edges, regions: REGIONS };
  return cache;
}

export function regionByKey(key: string): RegionDef | undefined {
  return REGIONS.find((r) => r.key === key);
}
