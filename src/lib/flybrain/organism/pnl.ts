// FLYBRAIN ORGANISM — pnl.ts
// P&L agregat biosfer + RISK-GATE hidup (audit F-12: dari logika mati → tersambung).
//
// Sebelumnya: `runQuantTick` selalu menerima dailyLoss/weeklyLoss = 0 dan kelas
// RiskGate tidak pernah diinstansiasi → gate UI "RISK-GATE AKTIF (BLOKIR)" tak
// terjangkau. Kini: P&L diukur dari delta kekayaan agregat NYATA antar denyut
// (simulasi lokal), dicatat ke SATU instance RiskGate fail-closed, dan:
//   1. dailyLoss/weeklyLoss disuntikkan ke runQuantTick (gates[0] hidup),
//   2. aksi publish_offer dicek ke gate (fail-closed saat pecah batas),
//   3. self-reflect verdict "ok" memulihkan gate (pemulihan otonom, [D]).
//
// Batas disesuaikan SKALA EKONOMI BIOSFER (kekayaan awal ±135 agregat;
// upkeep metabolisme ±0,13–0,38/denyut) — BUKAN skala -$1M upstream.
// Memori proses klien SAJA (zero-storage, konstitusi hukum 1) — reload = P&L baru,
// setara breaker immune. Semua angka SIMULASI LOKAL, bukan uang riil.

import { RiskGate } from "./quant/risk-gate";

const DAILY_LIMIT = -12; // batas rugi harian (unit simulasi)
const WEEKLY_LIMIT = -40; // batas rugi mingguan

const gate = new RiskGate({
  dailyLimit: DAILY_LIMIT,
  weeklyLimit: WEEKLY_LIMIT,
  startClosed: false, // lahir longgar; memecah batas → aktif memblokir sendiri
});

let lastTotal: number | null = null;

/** Kekayaan agregat semua creature (dibulatkan 2 desimal). */
export function totalWealthOf(creatures: { wealth: number }[]): number {
  return Math.round(creatures.reduce((s, c) => s + (c.wealth ?? 0), 0) * 100) / 100;
}

/**
 * Catat kekayaan agregat terbaru → P&L terealisasi diukur dari delta NYATA.
 * Panggilan pertama hanya menanam baseline (delta pertama tidak dihukum).
 * Rollover harian/mingguan + auto-trigger fail-closed ditangani RiskGate.
 */
export function recordTotalWealth(totalWealth: number): void {
  if (!Number.isFinite(totalWealth)) return;
  if (lastTotal === null) {
    lastTotal = totalWealth;
    return;
  }
  const delta = Math.round((totalWealth - lastTotal) * 100) / 100;
  lastTotal = totalWealth;
  if (delta !== 0) gate.recordPnL(delta);
}

/** Izin aksi "trading" (publish_offer) — fail-closed saat gate pecah batas. */
export function tradeAllowed(): { approved: boolean; reason?: string } {
  return gate.checkTrade({ amount: 1, side: "sell", correlation: 0 });
}

/** Snapshot gate (dailyLoss/weeklyLoss/active/reason) — disuntikkan ke quant tick. */
export function pnlSnapshot() {
  return gate.getState();
}

/** Pulihkan gate setelah self-reflect memutuskan organisme sehat (verdict ok). */
export function resetGate(): void {
  gate.reset();
}
