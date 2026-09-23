// FLYBRAIN ORGANISM — organs/scheduler.ts
// PORT dari upstream gh `scheduler/index.js` (jantung: siklus hourly/daily/weekly/
// monthly) + gitlab cron-scheduler. Adaptasi: denyut klien ±45 dtk; penjadwalan
// siklus panjang (hourly/daily/…) hanya MENGHITUNG fase — aksi tetap satu denyut
// satu creature (konstitusi hukum 6). Produksi 24/7 = edge cron (Fase 4, jujur).
// MURNI TypeScript.

import type { CreatureState } from "../creature";

/** Interval denyut default (ms) — spesifikasi §4. */
export const PULSE_INTERVAL_MS = 45_000;

/** Fase siklus panjang ala upstream — denyut ke-N milik siklus mana. */
export type CycleKey = "denyut" | "hourly" | "daily" | "weekly" | "monthly";

export function cycleOfBeat(beat: number): CycleKey {
  if (beat > 0 && beat % 3200 === 0) return "monthly";
  if (beat > 0 && beat % 800 === 0) return "weekly";
  if (beat > 0 && beat % 80 === 0) return "daily";
  if (beat > 0 && beat % 6 === 0) return "hourly";
  return "denyut";
}

export interface SchedulePick {
  creature: CreatureState | null;
  /** Mengapa creature ini dipilih — ditulis ke jejak (transparansi radikal). */
  reason: "incident" | "prt" | "round-robin" | "tidur-total" | "mandat-kosong";
}

/**
 * Pilih creature untuk denyut berikutnya.
 * Prioritas (spesifikasi §4): insiden immune > prt > round-robin.
 * Murni fungsi — menghormati status creature; mandat (grants) sudah difilter
 * oleh pemanggil (engine) sebelum masuk sini.
 */
export function chooseCreature(
  creatures: CreatureState[],
  opts: { beat: number; cursor: number },
): SchedulePick {
  const alive = creatures.filter((c) => c.status === "aktif");
  if (alive.length === 0) {
    return { creature: null, reason: "tidur-total" };
  }

  // 1) INSIDEN: creature gagal menalar beruntun (≥2) perlu perhatian duluan.
  const incident = alive.find((c) => c.fails >= 2);
  if (incident) return { creature: incident, reason: "incident" };

  // 2) PRT: penjaga jaga denyut bila dia paling "lapar" (paling sedikit denyut)
  const prt = alive.find((c) => c.id === "prt");
  const minPulse = Math.min(...alive.map((c) => c.pulseCount));
  if (prt && prt.pulseCount <= minPulse) return { creature: prt, reason: "prt" };

  // 3) ROUND-ROBIN: giliran merata di antara creature aktif non-prt.
  const pool = alive.filter((c) => c.id !== "prt");
  if (pool.length === 0) return { creature: prt ?? alive[0], reason: "prt" };
  const picked = pool[Math.abs(opts.cursor) % pool.length];
  return { creature: picked ?? pool[0], reason: "round-robin" };
}

/** Apakah denyut otomatis boleh jalan sekarang (jarak minimum antar denyut). */
export function shouldRun(lastPulseAt: string | null, minGapMs = PULSE_INTERVAL_MS): boolean {
  if (!lastPulseAt) return true;
  return Date.now() - new Date(lastPulseAt).getTime() >= minGapMs;
}

/** Metabolisme energi denyut: menguras kecil (spesifikasi §3.1). */
export function pulseDrain(creature: CreatureState): number {
  // Denyut dasar menguras; creature yang menunggu lama menguras lebih sedikit
  // (dianggap "hemat energi" saat menunggu giliran).
  return -(1 + (creature.id === "prt" ? 1 : 0));
}
