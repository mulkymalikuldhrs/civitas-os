// FLYBRAIN ECOSYSTEM — climate.ts (v1.2 "PLANET", 12_ECOSYSTEM.md §2)
// Iklim dunia dari data nyata — NOL Math.random untuk logika (deterministik):
//   • Siang-malam : 12 denyut = 1 hari dunia; jam dunia = (beat % 12) × 2.
//   • Cuaca       : rasio kegagalan 20 denyut terakhir (decisionStream.error)
//                   <5% CERAH · 5–20% BERAWAN · >20% BADAI
//                   (badai reda otomatis saat remediasi self-reflect sukses).
//   • Musim       : verdict self-reflect — ok=HUJAN · degraded=KEMARAU ·
//                   critical=KELAPARAN.
//   • Angin       : volume keputusan tinggi (buffer stream mendekati penuh).
// MURNI TypeScript — fungsi murni, testable, importable dari server.

import type { ClimateState, Cuaca, FaseHari, Musim, WorldSignals } from "./types";
import type { ReflectVerdict } from "../organism/selfReflect";

/** 12 denyut = 1 hari dunia (spesifikasi §2). */
export const DAY_BEATS = 12;

/** Hari dunia netral 1..7 (bukan nama hari bumi — 12_ECOSYSTEM §2). */
export function hariDunia(beat: number): number {
  return (Math.floor(Math.max(0, beat) / DAY_BEATS) % 7) + 1;
}

/** Jam dunia 0..22 (tiap denyut = 2 jam dunia). */
export function jamDunia(beat: number): number {
  return (Math.max(0, beat) % DAY_BEATS) * 2;
}

/** Fase hari dari jam dunia: fajar 5–7 · siang 7–17 · senja 17–19 · malam sisanya. */
export function faseOfJam(jam: number): FaseHari {
  if (jam >= 5 && jam < 7) return "fajar";
  if (jam >= 7 && jam < 17) return "siang";
  if (jam >= 17 && jam < 19) return "senja";
  return "malam";
}

/**
 * Rasio kegagalan 20 denyut terakhir dari decisionStream (field `error`).
 * Deterministik: 0 gagal → 0 (cerah); 1–4/20 → berawan; >4/20 → badai.
 */
export function errorRatioFromDecisions(decisions: { error?: string }[]): number {
  const last = decisions.slice(0, 20);
  if (last.length === 0) return 0;
  const gagal = last.filter((d) => typeof d.error === "string" && d.error.length > 0).length;
  return gagal / last.length;
}

export function cuacaOfRatio(ratio: number): Cuaca {
  if (ratio > 0.2) return "badai";
  if (ratio >= 0.05) return "berawan";
  return "cerah";
}

export function musimOfVerdict(verdict: ReflectVerdict | null): Musim {
  if (verdict === "ok") return "hujan";
  if (verdict === "critical") return "kelaparan";
  return "kemarau"; // degraded — atau belum ada reflect (netral-kering)
}

/** Faktor produksi energi biome per musim (12_ECOSYSTEM §2). */
export function seasonProductionFactor(musim: Musim): number {
  if (musim === "hujan") return 1.25; // kesuburan +25%
  if (musim === "kemarau") return 0.75; // kesuburan −25%
  return 0.15; // kelaparan: produksi nyaris berhenti
}

/** Faktor konsumsi (drain) per fase hari: malam −50% (creature tidur). */
export function faseDrainFactor(fase: FaseHari): number {
  return fase === "malam" ? 0.5 : 1;
}

/** Faktor konsumsi per cuaca: badai ×1.5 (spesifikasi §2). */
export function cuacaDrainFactor(cuaca: Cuaca): number {
  return cuaca === "badai" ? 1.5 : 1;
}

/**
 * Iklim lengkap satu denyut — SEMUA dari sinyal nyata, tanpa random.
 * Badai otomatis reda (→ cerah) saat remediasi self-reflect terakhir sukses.
 */
export function climateOf(s: WorldSignals): ClimateState {
  const beat = Math.max(0, Math.round(s.beat));
  const jam = jamDunia(beat);
  const fase = faseOfJam(jam);
  const ratio = errorRatioFromDecisions(s.decisions);
  let cuaca = cuacaOfRatio(ratio);
  let alasanCuaca =
    cuaca === "cerah"
      ? `${Math.round(ratio * 100)}% kegagalan pada 20 denyut terakhir — di bawah ambang 5%.`
      : cuaca === "berawan"
        ? `${Math.round(ratio * 100)}% kegagalan pada 20 denyut terakhir — ambang 5–20%.`
        : `${Math.round(ratio * 100)}% kegagalan pada 20 denyut terakhir — di atas ambang 20%; drain energi ×1,5 dan breaker lebih rapuh.`;

  // Badai reda saat reflect remediasi sukses (12_ECOSYSTEM §2, baris 5).
  const remediasiSukses = Boolean(
    s.reflectVerdict && s.reflectVerdict !== "critical" && s.eventLog.some((e) => e.type === "reflect" && /remediasi/i.test(e.message)),
  );
  if (cuaca === "badai" && remediasiSukses) {
    cuaca = "cerah";
    alasanCuaca = "badai reda — remediasi self-reflect terakhir sukses (ambang kegagalan ditembus sebelumnya).";
  }

  const musim = musimOfVerdict(s.reflectVerdict);
  const alasanMusim =
    s.reflectVerdict === null
      ? "belum ada self-reflect — musim dianggap kemarau netral hingga introspeksi pertama."
      : musim === "hujan"
        ? `verdict self-reflect "ok" — kesuburan biome +25%.`
        : musim === "kemarau"
          ? `verdict self-reflect "degraded" — kesuburan biome −25%.`
          : `verdict self-reflect "critical" — produksi energi nyaris berhenti; creature diminta migrasi.`;

  // ANGIN: buffer keputusan terpakai lebat (≥30 dari maks 50) = volume tinggi.
  const angin = s.decisions.length >= 30;

  return {
    beat,
    hari: hariDunia(beat),
    jamDunia: jam,
    fase,
    cuaca,
    alasanCuaca,
    errorRatio: ratio,
    musim,
    verdictSumber: s.reflectVerdict,
    alasanMusim,
    angin,
  };
}

/** Label jam dunia "HH:00" untuk UI. */
export function jamLabel(jam: number): string {
  return `${String(jam).padStart(2, "0")}:00`;
}
