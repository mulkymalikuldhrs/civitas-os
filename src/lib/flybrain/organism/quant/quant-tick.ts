// =========================================================================
// Quant Tick Engine — evaluasi quant periodik atas state biosfer
// FLYBRAIN BIOSFER v1.1 — port dari upstream gitlab `src/quant/quant-tick.ts`.
// PERUBAHAN PORT: import zustand store upstream (civilizationStore/marketStore/
// quantStore) DIGANTI parameter eksplisit — engine ini fungsi MURNI, pemanggil
// (engine klien / refleks Tradio) yang menyediakan data & menyimpan hasil.
// Semua angka = SIMULASI LOKAL (bukan data pasar nyata).
// =========================================================================

import { calculateScore, calculateRisk, economicMetricsFromEntity } from "./scoring";
import { optimizePortfolio } from "./portfolio";
import type {
  MarketEntity,
  QuantEngineConfig,
  QuantTickResult,
  QuantScore,
  QuantRisk,
  PortfolioAllocation,
  EconomicMetrics,
} from "./types";

/** Konfigurasi default (diadaptasi dari default store quant upstream). */
export const DEFAULT_QUANT_CONFIG: QuantEngineConfig = {
  enabled: true,
  tickInterval: 45_000,
  riskFreeRate: 0.05,
  maxPortfolioRisk: 0.25,
  dailyLossLimit: -500,
  weeklyLossLimit: -1500,
  maxCorrelation: 0.85,
  kellyFraction: "half",
};

/** Input eksplisit satu quant tick (pengganti 3 store upstream). */
export interface QuantTickInput {
  entities: MarketEntity[];
  config?: Partial<QuantEngineConfig>;
  /** P&L harian/mingguan berjalan dari caller (mis. snapshot gate sebelumnya). */
  dailyLoss?: number;
  weeklyLoss?: number;
}

/**
 * Jalankan SATU quant tick atas state biosfer yang diberikan.
 * Skor per entitas + skor tingkat-organisme + alokasi portofolio + gate + rekomendasi.
 */
export function runQuantTick(input: QuantTickInput): QuantTickResult {
  const cfg: QuantEngineConfig = { ...DEFAULT_QUANT_CONFIG, ...(input.config ?? {}) };
  const entities = input.entities ?? [];

  const scores = new Map<string, QuantScore>();
  const risks = new Map<string, QuantRisk>();
  const gates: QuantTickResult["gates"] = [];
  const recommendations: string[] = [];

  // ── Skor per entitas ────────────────────────────────────────────────
  for (const p of entities) {
    try {
      const metrics = economicMetricsFromEntity(p);
      scores.set(p.id, calculateScore(metrics));
      if (Array.isArray(p.history) && p.history.length >= 2) {
        risks.set(p.id, calculateRisk(p.history));
      } else {
        risks.set(p.id, { var95: 0.05, var99: 0.1, sharpe: 0, sortino: 0, maxDrawdown: 0, correlation: 0, volatility: 0 });
      }
    } catch {
      // Data entitas tidak lengkap → netral (perilaku upstream dipertahankan)
      scores.set(p.id, { overall: 50, growth: 50, stability: 50, efficiency: 50, resilience: 50, potential: 50 });
      risks.set(p.id, { var95: 0.05, var99: 0.1, sharpe: 0, sortino: 0, maxDrawdown: 0, correlation: 0, volatility: 0 });
    }
  }

  // ── Skor tingkat-organisme ──────────────────────────────────────────
  const totalWealth = entities.reduce((s, p) => s + (p.wealth ?? 0), 0);
  const totalPopulation = entities.reduce((s, p) => s + (p.population ?? 0), 0);
  const avgHappiness = entities.length ? entities.reduce((s, p) => s + (p.happiness ?? 50), 0) / entities.length : 50;

  const organismMetrics: EconomicMetrics = {
    gdp: totalWealth * 10 + totalPopulation * 5,
    gdpGrowth: 0.02 + Math.random() * 0.03, // tick-to-tick (upstream: Math.random)
    inflation: 2.0 + Math.random() * 3.0,
    unemployment: Math.max(0, 100 - avgHappiness),
    gini: 0.3 + Math.random() * 0.1,
    productivity: totalWealth / Math.max(totalPopulation, 1),
    tradeBalance: totalWealth * 0.05,
    debtRatio: totalWealth > 0 ? (totalWealth * 0.4) / totalWealth : 0.5,
    reserves: totalWealth * 0.2,
  };

  try {
    scores.set("organisme", calculateScore(organismMetrics));
  } catch {
    scores.set("organisme", { overall: 50, growth: 50, stability: 50, efficiency: 50, resilience: 50, potential: 50 });
  }

  const orgHistory = entities.map((p) => p.wealth ?? 0);
  try {
    if (orgHistory.length >= 2) risks.set("organisme", calculateRisk(orgHistory));
    else risks.set("organisme", { var95: 0, var99: 0, sharpe: 0, sortino: 0, maxDrawdown: 0, correlation: 0, volatility: 0 });
  } catch {
    risks.set("organisme", { var95: 0, var99: 0, sharpe: 0, sortino: 0, maxDrawdown: 0, correlation: 0, volatility: 0 });
  }

  // ── Alokasi portofolio ──────────────────────────────────────────────
  const assets = entities.map((p) => {
    const risk = risks.get(p.id);
    const score = scores.get(p.id)!;
    return {
      id: p.id,
      name: p.name,
      expectedReturn: score.growth / 100,
      risk: risk?.var95 ?? 0.1,
      sharpe: risk?.sharpe ?? 0,
    };
  });

  const allocations: PortfolioAllocation[] = optimizePortfolio(assets, cfg.maxPortfolioRisk, cfg.riskFreeRate);

  // ── Risk gate (agregat, fail-closed pada pelanggaran) ───────────────
  const dailyLoss = input.dailyLoss ?? 0;
  const weeklyLoss = input.weeklyLoss ?? 0;

  gates.push({
    active: dailyLoss <= cfg.dailyLossLimit || weeklyLoss <= cfg.weeklyLossLimit,
    reason:
      dailyLoss <= cfg.dailyLossLimit
        ? `Rugi harian ${dailyLoss.toFixed(1)} menembus batas ${cfg.dailyLossLimit}`
        : weeklyLoss <= cfg.weeklyLossLimit
          ? `Rugi mingguan ${weeklyLoss.toFixed(1)} menembus batas ${cfg.weeklyLossLimit}`
          : null,
    triggeredAt: dailyLoss <= cfg.dailyLossLimit || weeklyLoss <= cfg.weeklyLossLimit ? Date.now() : null,
    dailyLoss,
    weeklyLoss,
    dailyLimit: cfg.dailyLossLimit,
    weeklyLimit: cfg.weeklyLossLimit,
    maxCorrelation: cfg.maxCorrelation,
    correlationExposure: 0,
  });

  // ── Rekomendasi (dialihbahasakan; dipicu kondisi eksplisit) ─────────
  const orgScore = scores.get("organisme");
  if (orgScore && orgScore.overall < 40) recommendations.push("Kesehatan organisme kritis — pertimbangkan stimulus ekonomi simulasi");
  if (organismMetrics.unemployment > 20) recommendations.push("Pengangguran tinggi — dorong penciptaan 'pekerjaan' creature");
  if (organismMetrics.gini > 0.5) recommendations.push("Ketimpangan tinggi — seimbangkan alokasi antar entitas");
  if (allocations.some((a) => a.risk > 0.3)) recommendations.push("Alokasi berisiko tinggi — kurangi eksposur");
  if (organismMetrics.inflation > 8) recommendations.push("Inflasi tinggi — ketatkan kebijakan moneter simulasi");
  if (organismMetrics.debtRatio > 0.8) recommendations.push("Rasio utang tinggi — kurangi leverage");

  return {
    timestamp: Date.now(),
    scores,
    risks,
    allocations,
    gates,
    recommendations,
  };
}

/**
 * Deret imbal hasil random-walk untuk SIMULASI pasar lokal (dipakai refleks
 * Tradio). Murni fungsi; deterministic bila seed diberikan (LCG sederhana).
 */
export function randomWalkReturns(length: number, seed?: number): number[] {
  const n = Math.max(2, Math.min(400, Math.round(length)));
  let s = typeof seed === "number" && isFinite(seed) ? Math.floor(seed) : Math.floor(Math.random() * 2 ** 31);
  const next = () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31; // [0,1)
  };
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = next() - 0.5;
    const shock = next() > 0.97 ? (next() - 0.5) * 0.12 : 0; // sesekali guncangan
    out.push(Math.round((u * 0.04 + shock) * 10000) / 10000);
  }
  return out;
}

/** Simulasi deret harga dari deret imbal hasil (mulai 100). */
export function priceSeriesFromReturns(returns: number[], start = 100): number[] {
  const out: number[] = [start];
  for (let i = 0; i < returns.length; i++) {
    out.push(Math.max(1, out[i] * (1 + returns[i])));
  }
  return out.map((p) => Math.round(p * 100) / 100);
}
