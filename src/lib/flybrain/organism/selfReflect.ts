// FLYBRAIN ORGANISM — selfReflect.ts
// PORT dari gitlab `supabase/functions/self-reflect/index.ts` (introspeksi &
// self-correction engine). Adaptasi zero-storage: sumber introspeksi = ledger &
// stream LOKAL (state klien), bukan tabel Supabase. Verdict: ok|degraded|critical
// + remediasi yang DIEKSEKUSI KLIEN (bangunkan creature, reset breaker, rapikan
// buffer bus). MURNI TypeScript — fungsi murni; eksekutor remediasi di engine.

import type { CreatureState } from "./creature";
import type { BiosferEvent } from "./eventBus";

export type ReflectVerdict = "ok" | "degraded" | "critical";

export interface Remediation {
  type: "wake" | "resetBreaker" | "prune" | "none";
  creatureId: string | null;
  note: string;
}

export interface ReflectReport {
  at: string;
  beat: number;
  verdict: ReflectVerdict;
  issues: string[];
  actions_taken: string[]; // remediasi yang disarankan dieksekusi (diisi engine)
  recommendations: string[];
  remediations: Remediation[];
}

export interface ReflectInput {
  beat: number;
  creatures: CreatureState[];
  decisionStream: { at: string; error?: string }[]; // jejak keputusan terbaru
  lastPulseAt: string | null;
  eventLog: BiosferEvent[];
  /** Usia denyut terakhir (ms) dianggap basi setelah batas ini. */
  stalenessMs?: number;
}

/**
 * INTROSPEKSI BIOSFER (port `runReflection`):
 *  1. staleness denyut (liveness gap) — port cek "last tick X menit lalu"
 *  2. jumlah error keputusan terkini — port cek errors di memories
 *  3. creature tidur/mati — port cek populasi
 * Verdict upstream dipertahankan: 0 masalah = ok; ≤2 = degraded; >2 = critical.
 * Fungsi MURNI — tidak melakukan apa pun, hanya merekomendasikan remediasi.
 */
export function selfReflect(input: ReflectInput): ReflectReport {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const remediations: Remediation[] = [];

  const stalenessMs = input.stalenessMs ?? 3 * 60_000;

  // 1. Liveness gap: denyut terakhir terlalu lama (port: "Last tick Xm old").
  if (!input.lastPulseAt) {
    issues.push("Belum ada denyut tercatat — biosfer mungkin terhenti");
    recommendations.push("Klik PICU DENYUT atau aktifkan mandat L3 agar denyut otomatis jalan");
    remediations.push({ type: "prune", creatureId: null, note: "rapikan buffer bus & mulai denyut" });
  } else {
    const ageMs = Date.now() - new Date(input.lastPulseAt).getTime();
    if (ageMs > stalenessMs) {
      issues.push(`Denyut terakhir ${(ageMs / 60000).toFixed(1)} menit lalu — celah liveness`);
      recommendations.push("Periksa apakah konsol ditutup / mandat diturunkan");
    }
  }

  // 2. Error keputusan terkini (port: "N recent errors logged").
  const recentErrors = input.decisionStream.filter((t) => typeof t.error === "string" && t.error).length;
  if (recentErrors > 0) {
    issues.push(`${recentErrors} keputusan terkini berlabel gagal/degradasi`);
    recommendations.push("Biarkan immune breaker menurunkan beban; remediasi reset bila pulih");
    for (const c of input.creatures.filter((c) => c.fails >= 2)) {
      remediations.push({ type: "resetBreaker", creatureId: c.id, note: `reset breaker ${c.name} setelah gagal ${c.fails}x` });
    }
  }

  // 3. Populasi: creature tidur/mati (port: "Low population").
  const sleeping = input.creatures.filter((c) => c.status === "tidur");
  const dead = input.creatures.filter((c) => c.status === "mati");
  if (sleeping.length > 0) {
    issues.push(`${sleeping.length} creature tidur (energi habis): ${sleeping.map((c) => c.name).join(", ")}`);
    for (const c of sleeping) remediations.push({ type: "wake", creatureId: c.id, note: `bangunkan ${c.name} (suntik energi +40)` });
  }
  if (dead.length > 0) {
    issues.push(`${dead.length} creature mati: ${dead.map((c) => c.name).join(", ")}`);
    recommendations.push("Pertimbangkan bangkitkan manual setelah sumber masalah diperiksa");
  }
  if (input.creatures.length > 0 && input.creatures.every((c) => c.status !== "aktif")) {
    issues.push("Populasi aktif kosong — biosfer nyaris berhenti");
    remediations.push({ type: "wake", creatureId: "prt", note: "bangunkan prt sebagai pemulihan terakhir" });
  }

  // 4. Buffer bus menumpuk (perawatan lokal — upstream tidak punya padanan persis).
  if (input.eventLog.length >= 190) {
    recommendations.push("Buffer bus hampir penuh — akan dipangkas otomatis");
    remediations.push({ type: "prune", creatureId: null, note: "pangkas riwayat bus ke 120 terbaru" });
  }

  // 5. Verdict (aturan upstream: 0 ok, ≤2 degraded, >2 critical).
  const verdict: ReflectVerdict = issues.length === 0 ? "ok" : issues.length <= 2 ? "degraded" : "critical";

  return {
    at: new Date().toISOString(),
    beat: input.beat,
    verdict,
    issues,
    actions_taken: [], // diisi engine saat remediasi benar-benar dieksekusi
    recommendations,
    remediations,
  };
}
