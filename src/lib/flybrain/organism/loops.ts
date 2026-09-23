// FLYBRAIN ORGANISM — loops.ts
// Empat organ bisnis prt (10_AUTONOMY.md §2) + pembangun sense-packet AGREGAT.
// File ini MURNI TypeScript (dipakai klien & server) — TIDAK ada import browser/server.

export type OrganId = "guardian" | "merchant" | "envoy" | "scout";

export interface OrganMeta {
  id: OrganId;
  code: string;
  name: string; // nama Indonesia
  organ: string; // padanan anatomi lalat
  description: string;
  color: string; // warna aksen tema laboratorium
  icon: string; // nama ikon lucide (tanpa komponen — file ini murni data)
}

/** Metadata 4 organ — sumber kebenaran untuk UI dan kontrak heartbeat. */
export const ORGANS: OrganMeta[] = [
  {
    id: "guardian",
    code: "OPS",
    name: "Guardian",
    organ: "Saraf pusat — kekebalan sistem",
    description: "Menjaga vital: kesehatan vault, audit gerbang, usia kwitansi. Menyembuhkan, menyetel, atau melaporkan.",
    color: "#4ade80",
    icon: "ShieldHalf",
  },
  {
    id: "merchant",
    code: "SALES",
    name: "Merchant",
    organ: "Lobus optik — penglihatan nilai",
    description: "Membaca tier, sisa masa aktif, intensitas pakai. Menawar dengan alasan eksplisit — atau diam.",
    color: "#fbbf24",
    icon: "Coins",
  },
  {
    id: "envoy",
    code: "SUPPORT",
    name: "Envoy",
    organ: "Lobus antena — sinyal masuk",
    description: "Menjawab pertanyaan pemilik dan agent luar dengan konteks kernel — tanpa membongkar isi memori.",
    color: "#38bdf8",
    icon: "Radio",
  },
  {
    id: "scout",
    code: "PRODUCT",
    name: "Scout",
    organ: "Badan jamur — asosiasi pola",
    description: "Membaca statistik pemakaian fitur lokal, mengusulkan satu proposal roadmap per siklus — berbasis data.",
    color: "#a78bfa",
    icon: "Telescope",
  },
];

export const ORGAN_IDS: OrganId[] = ORGANS.map((o) => o.id);

export function isOrganId(x: unknown): x is OrganId {
  return typeof x === "string" && (ORGAN_IDS as string[]).includes(x);
}

export function organMeta(id: string): OrganMeta {
  return ORGANS.find((o) => o.id === id) ?? ORGANS[0];
}

// ---------- Konteks agregat (dibangun KLIEN dari vault lokal) ----------

export interface OrganContext {
  username?: string;
  tier?: string;
  tierUntil?: string | null;
  beat?: number;
  vitals?: { energy: number; focus: number; mood: number };
  stats?: {
    totalRecords: number;
    totalBytes: number;
    counts?: Record<string, number>;
  } | null;
  gatewayCalls?: number;
  receipts?: number;
  receiptDaysLeft?: number | null; // sisa hari kwitansi termuda
  offers?: number; // jumlah proposal prt di ledger
  lastMessage?: string | null; // pesan user terakhir (envoy; diinisiasi user)
  featureUsage?: {
    memories?: number;
    decisions?: number;
    prtEvents?: number;
    topView?: string | null;
  };
  ts?: string;
}

const num = (n: unknown, fb = 0): number => (typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fb);
const line = (label: string, value: string | number | null | undefined): string =>
  value === null || value === undefined || value === "" ? "" : `${label}: ${value}`;

/**
 * Rangkum context jadi sense-packet TEBUS per organ (fase SADAR).
 * Privasi (konstitusi poin 2): hanya angka/tier/tanggal — TIDAK ADA isi memori user.
 */
export function buildSensePacket(organ: OrganId, ctx: OrganContext): string {
  const head = [
    line("pemilik", ctx.username ?? "(tanpa identitas)"),
    line("tier", ctx.tier ?? "FREE"),
    line("masa aktif tier", ctx.tierUntil ? `s.d. ${ctx.tierUntil.slice(0, 10)}` : null),
    line("waktu", ctx.ts ?? new Date().toISOString()),
    line("beat prt", num(ctx.beat)),
    ctx.vitals
      ? line("vital prt", `energi ${ctx.vitals.energy}/fokus ${ctx.vitals.focus}/suasana ${ctx.vitals.mood}`)
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const stats = ctx.stats;
  const kb = stats ? (stats.totalBytes / 1024).toFixed(1) : "0";
  const footer = `VAULT LOKAL (agregat): ${num(stats?.totalRecords)} rekaman, ±${kb} KB — semua di perangkat pemilik; server tidak menyimpan apa pun.`;

  if (organ === "guardian") {
    return [
      "SENSE-PACKET GUARDIAN (ops) — agregat:",
      head,
      line("koleksi vault", stats?.counts ? JSON.stringify(stats.counts) : null),
      line("panggilan gerbang tercatat", num(ctx.gatewayCalls)),
      line("kwitansi tersimpan", num(ctx.receipts)),
      line("sisa hari kwitansi", ctx.receiptDaysLeft ?? "tidak ada kwitansi"),
      footer,
      "TUGAS: klasifikasikan vital (normal/perhatian/kritis), lalu putuskan satu aksi: heal/tune/report.",
    ].filter(Boolean).join("\n");
  }

  if (organ === "merchant") {
    return [
      "SENSE-PACKET MERCHANT (penjualan) — agregat:",
      head,
      line("kwitansi tersimpan", num(ctx.receipts)),
      line("sisa hari kwitansi", ctx.receiptDaysLeft ?? "tidak ada kwitansi"),
      line("proposal prt sebelumnya di ledger", num(ctx.offers)),
      line("memori aktif", ctx.featureUsage?.memories ?? null),
      footer,
      "TUGAS: putuskan offer/hold/diam dengan ALASAN eksplisit. Tawar hanya bila ada sinyal nilai nyata; kwitansi tetap keputusan manusia.",
    ].filter(Boolean).join("\n");
  }

  if (organ === "envoy") {
    return [
      "SENSE-PACKET ENVOY (support & relasi) — agregat:",
      head,
      line("pesan terakhir pemilik (diinisiasi pemilik)", ctx.lastMessage ? `"${String(ctx.lastMessage).slice(0, 240)}"` : "belum ada pesan"),
      line("total panggilan gerbang", num(ctx.gatewayCalls)),
      footer,
      "TUGAS: jawab/eskalasi satu kebutuhan pemilik atau agent luar; jika tak ada pertanyaan, laporkan kesiapan melayani.",
    ].filter(Boolean).join("\n");
  }

  // scout
  return [
    "SENSE-PACKET SCOUT (produk) — agregat:",
    head,
    line("pemakaian fitur (agregat)", ctx.featureUsage
      ? `memori ${num(ctx.featureUsage.memories)} · keputusan ${num(ctx.featureUsage.decisions)} · event prt ${num(ctx.featureUsage.prtEvents)} · view terakhir ${ctx.featureUsage.topView ?? "—"}`
      : null),
    line("proposal roadmap di ledger", num(ctx.offers)),
    footer,
    "TUGAS: usulkan SATU proposal roadmap teratas dengan argumen data; satu proposal per siklus.",
  ].filter(Boolean).join("\n");
}
