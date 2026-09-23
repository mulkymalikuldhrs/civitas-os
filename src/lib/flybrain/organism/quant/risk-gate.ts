// =========================================================================
// Risk Gate / Kill Switch — Fail-Closed Trade Safety
// FLYBRAIN BIOSFER v1.1 — port dari upstream gitlab `src/quant/risk-gate.ts`.
// SATU-SATUNYA perubahan: persistence `node:fs` DIHAPUS (zero-storage;
// konstitusi hukum 1). State hidup di memori proses klien; pemanggil yang
// mau persist menyimpan snapshot getState() ke vault lokalnya sendiri.
// Sifat fail-closed dipertahankan: gate LAHIR AKTIF (memblokir) sampai
// pemanggil secara eksplisit memanggil reset() — lawan arah upstream yang
// tanpa state-file langsung longgar. Lebih aman untuk uang (walau simulasi).
// =========================================================================

import type { RiskGateState } from "./types";

// ---------------------------------------------------------------------------
// Konstanta batas (diadaptasi ke skala simulasi lokal, bukan -$1M upstream)
// ---------------------------------------------------------------------------

const DEFAULT_DAILY_LIMIT = -500; // batas kerugian harian (unit simulasi)
const DEFAULT_WEEKLY_LIMIT = -1500; // batas kerugian mingguan
const DEFAULT_MAX_CORRELATION = 0.85; // korelasi agregat maksimum

// ---------------------------------------------------------------------------

export interface RiskGateOptions {
  dailyLimit?: number;
  weeklyLimit?: number;
  maxCorrelation?: number;
  /** true (default) = lahir fail-closed AKTIF; false = dipercaya longgar (uji lokal). */
  startClosed?: boolean;
}

/**
 * Risk gate / kill switch yang menegakkan:
 *  - batas kerugian harian & mingguan (drawdown P&L)
 *  - batas eksposur korelasi
 *  - fail-closed: gate aktif memblokir semua trade sampai di-reset.
 */
export class RiskGate {
  private active: boolean;
  private reason: string | null;
  private triggeredAt: number | null;
  private dailyLoss: number;
  private weeklyLoss: number;
  private dailyLimit: number;
  private weeklyLimit: number;
  private maxCorrelation: number;
  private correlationExposure: number;
  private lastDayRef: number;
  private lastWeekRef: number;

  constructor(options: RiskGateOptions = {}) {
    this.active = options.startClosed ?? true; // fail-closed default
    this.reason = this.active ? "Initialising — gate fail-closed" : null;
    this.triggeredAt = null;
    this.dailyLoss = 0;
    this.weeklyLoss = 0;
    this.dailyLimit = options.dailyLimit ?? DEFAULT_DAILY_LIMIT;
    this.weeklyLimit = options.weeklyLimit ?? DEFAULT_WEEKLY_LIMIT;
    this.maxCorrelation = options.maxCorrelation ?? DEFAULT_MAX_CORRELATION;
    this.correlationExposure = 0;
    this.lastDayRef = this.currentDayRef();
    this.lastWeekRef = this.currentWeekRef();
  }

  // ------------------------------------------------------------------
  // API publik
  // ------------------------------------------------------------------

  /** Nilai proposal trade terhadap semua batas aktif. */
  checkTrade(trade: {
    amount: number;
    side: "buy" | "sell";
    correlation: number;
  }): { approved: boolean; reason?: string } {
    // --- Fail-closed: gate aktif → blokir semua ---
    if (this.active) {
      return { approved: false, reason: this.reason ?? "Risk gate aktif (fail-closed)" };
    }

    // --- Batas kerugian harian ---
    if (this.dailyLoss <= this.dailyLimit) {
      return { approved: false, reason: `Batas rugi harian terlampaui: ${this.dailyLoss} ≤ ${this.dailyLimit}` };
    }

    // --- Batas kerugian mingguan ---
    if (this.weeklyLoss <= this.weeklyLimit) {
      return { approved: false, reason: `Batas rugi mingguan terlampaui: ${this.weeklyLoss} ≤ ${this.weeklyLimit}` };
    }

    // --- Eksposur korelasi ---
    const newCorrelationExposure =
      trade.side === "buy" ? Math.max(this.correlationExposure, trade.correlation) : this.correlationExposure;

    if (newCorrelationExposure > this.maxCorrelation) {
      return {
        approved: false,
        reason: `Eksposur korelasi ${newCorrelationExposure.toFixed(3)} melebihi maksimum ${this.maxCorrelation}`,
      };
    }

    return { approved: true };
  }

  /** Catat P&L terealisasi; rollover hari/minggu otomatis; auto-trigger bila tembus batas. */
  recordPnL(pnl: number): void {
    this.rolloverCounters();

    this.dailyLoss += pnl;
    this.weeklyLoss += pnl;

    if (this.dailyLoss <= this.dailyLimit) {
      this.trigger("Batas rugi harian tercapai");
    } else if (this.weeklyLoss <= this.weeklyLimit) {
      this.trigger("Batas rugi mingguan tercapai");
    }
  }

  /** Reset gate ke keadaan bersih (longgar). Semua counter dinolkan. */
  reset(): void {
    this.active = false;
    this.reason = null;
    this.triggeredAt = null;
    this.dailyLoss = 0;
    this.weeklyLoss = 0;
    this.correlationExposure = 0;
    this.lastDayRef = this.currentDayRef();
    this.lastWeekRef = this.currentWeekRef();
  }

  /** Snapshot keadaan gate saat ini. */
  getState(): RiskGateState {
    return {
      active: this.active,
      reason: this.reason,
      triggeredAt: this.triggeredAt,
      dailyLoss: this.dailyLoss,
      weeklyLoss: this.weeklyLoss,
      dailyLimit: this.dailyLimit,
      weeklyLimit: this.weeklyLimit,
      maxCorrelation: this.maxCorrelation,
      correlationExposure: this.correlationExposure,
    };
  }

  // ------------------------------------------------------------------
  // Helper internal
  // ------------------------------------------------------------------

  private currentDayRef(): number {
    return Math.floor(Date.now() / 86_400_000);
  }

  private currentWeekRef(): number {
    return Math.floor(Date.now() / 604_800_000);
  }

  private rolloverCounters(): void {
    const nowDay = this.currentDayRef();
    const nowWeek = this.currentWeekRef();

    if (nowDay !== this.lastDayRef) {
      this.dailyLoss = 0;
      this.lastDayRef = nowDay;
    }

    if (nowWeek !== this.lastWeekRef) {
      this.weeklyLoss = 0;
      this.lastWeekRef = nowWeek;
    }
  }

  private trigger(reason: string): void {
    this.active = true;
    this.reason = reason;
    this.triggeredAt = Date.now();
  }
}
