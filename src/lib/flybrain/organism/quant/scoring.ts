// =========================================================================
// Quant Scoring Engine — FLYBRAIN BIOSFER v1.1
// Port dari upstream gitlab `src/quant/scoring.ts`. Fungsi murni — tanpa efek
// samping, hanya Math stdlib. Satu-satunya perubahan: `economicMetricsFromPlanet`
// (bergantung tipe Planet dari hook React upstream) diganti `economicMetricsFromEntity`
// yang menerima MarketEntity lokal — derivasinya identik.
// =========================================================================

import type { EconomicMetrics, QuantScore, QuantRisk, KellyResult, MarketEntity } from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

const mean = (xs: number[]): number => {
  const n = xs.length;
  if (n === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += xs[i];
  return s / n;
};

const stddev = (xs: number[], avg: number): number => {
  const n = xs.length;
  if (n < 2) return 0;
  let sq = 0;
  for (let i = 0; i < n; i++) sq += (xs[i] - avg) ** 2;
  return Math.sqrt(sq / (n - 1));
};

const validateFinite = (v: number, label: string): void => {
  if (typeof v !== "number" || !isFinite(v))
    throw new Error(`Invalid ${label}: must be a finite number, got ${v}`);
};

// =========================================================================
// 1. calculateScore — komposit 0–100 lintas lima dimensi quant
// =========================================================================

/**
 * Bobot (quant-aware, jumlah 1.0 sehingga komposit tak pernah > 100):
 *   growth 0.30 · stability 0.25 · efficiency 0.20 · resilience 0.15 · potential 0.10
 */
export function calculateScore(metrics: EconomicMetrics): QuantScore {
  // ── Guard ────────────────────────────────────────────────────────────
  if (!metrics || typeof metrics !== "object")
    throw new Error("calculateScore: metrics must be a non-null object");

  validateFinite(metrics.gdp, "metrics.gdp");
  validateFinite(metrics.gdpGrowth, "metrics.gdpGrowth");
  validateFinite(metrics.inflation, "metrics.inflation");
  validateFinite(metrics.unemployment, "metrics.unemployment");
  validateFinite(metrics.gini, "metrics.gini");
  validateFinite(metrics.productivity, "metrics.productivity");
  validateFinite(metrics.tradeBalance, "metrics.tradeBalance");
  validateFinite(metrics.debtRatio, "metrics.debtRatio");
  validateFinite(metrics.reserves, "metrics.reserves");

  if (metrics.gdp < 0) throw new Error("calculateScore: gdp must be >= 0");
  if (metrics.gini < 0 || metrics.gini > 1)
    throw new Error("calculateScore: gini must be in [0, 1]");
  if (metrics.debtRatio < 0 || metrics.debtRatio > 10)
    throw new Error("calculateScore: debtRatio must be in [0, 10]");

  // ── Dimensi (masing-masing 0–100) ────────────────────────────────────

  // Growth: momentum dari laju pertumbuhan (desimal, 0.05 = 5%): 0% → 0, 10%+ → 100
  const growth = clamp(metrics.gdpGrowth * 1000, 0, 100);

  // Stability: inflasi < 2% → 100, > 20% → 0; pengangguran < 3% → 100, > 25% → 0
  const inflScore = clamp(100 - metrics.inflation * 500, 0, 100);
  const unempScore = clamp(100 - metrics.unemployment * 400, 0, 100);
  const stability = (inflScore + unempScore) / 2;

  // Efficiency: output per unit input, dinormalisasi ke skala gdp
  const effBase = metrics.gdp > 0 ? metrics.productivity / (metrics.gdp / 10000) : metrics.productivity;
  const efficiency = clamp(effBase * 5, 0, 100);

  // Resilience: debt rendah + reserve tinggi = tahan guncangan
  const debtScore = clamp(100 - metrics.debtRatio * 200, 0, 100);
  const reserveScore =
    metrics.reserves > 0 ? clamp(Math.log10(metrics.reserves + 1) * 10, 0, 100) : 0;
  const resilience = debtScore * 0.6 + reserveScore * 0.4;

  // Potential: opsi masa depan (neraca perdagangan + outlook pertumbuhan)
  const tradeToGdp = metrics.gdp > 0 ? metrics.tradeBalance / metrics.gdp : 0;
  const tradeScore = clamp(tradeToGdp * 500 + 50, 0, 100);
  const growthOutlook = clamp(metrics.gdpGrowth * 500 + 50, 0, 100);
  const potential = tradeScore * 0.4 + growthOutlook * 0.6;

  // ── Komposit (bobot jumlah 1.0 → [0, 100]) ───────────────────────────
  const overall = clamp(
    growth * 0.3 + stability * 0.25 + efficiency * 0.2 + resilience * 0.15 + potential * 0.1,
    0,
    100,
  );

  return {
    overall: Math.round(overall * 100) / 100,
    growth: Math.round(growth * 100) / 100,
    stability: Math.round(stability * 100) / 100,
    efficiency: Math.round(efficiency * 100) / 100,
    resilience: Math.round(resilience * 100) / 100,
    potential: Math.round(potential * 100) / 100,
  };
}

// =========================================================================
// 2. calculateRisk — dekomposisi risiko penuh dari deret imbal hasil
// =========================================================================

/**
 * VaR95, VaR99, Sharpe, Sortino, max drawdown, volatilitas, dan
 * autokorelasi lag-1 (proksi korelasi pasar). Semua historis — simulasi.
 */
export function calculateRisk(history: number[]): QuantRisk {
  // ── Guard ────────────────────────────────────────────────────────────
  if (!Array.isArray(history)) throw new Error("calculateRisk: history must be an array");
  if (history.length < 2)
    throw new Error(`calculateRisk: need at least 2 data points, got ${history.length}`);

  for (let i = 0; i < history.length; i++) {
    if (typeof history[i] !== "number" || !isFinite(history[i]))
      throw new Error(`calculateRisk: history[${i}] is not a finite number`);
  }

  const n = history.length;
  const sorted = [...history].sort((a, b) => a - b);

  // ── VaR (historical simulation) ─────────────────────────────────────
  const idx95 = Math.max(0, Math.floor(n * 0.05) - 1);
  const idx99 = Math.max(0, Math.floor(n * 0.01) - 1);
  const var95 = sorted[idx95];
  const var99 = sorted[idx99];

  // ── Momen ────────────────────────────────────────────────────────────
  const avgReturn = mean(history);
  const vol = stddev(history, avgReturn);

  // ── Sharpe (risk-free = 0 di level deret) ───────────────────────────
  const sharpe = vol > 0 ? avgReturn / vol : 0;

  // ── Sortino (deviasi downside saja) ─────────────────────────────────
  let downsideSq = 0;
  let downsideCount = 0;
  for (let i = 0; i < n; i++) {
    if (history[i] < 0) {
      downsideSq += history[i] ** 2;
      downsideCount++;
    }
  }
  const downsideDev = downsideCount > 0 ? Math.sqrt(downsideSq / downsideCount) : 0;
  const sortino = downsideDev > 0 ? avgReturn / downsideDev : sharpe;

  // ── Max drawdown (jalan maju, lacak puncak) ─────────────────────────
  let peak = history[0];
  let maxDd = 0;
  for (let i = 1; i < n; i++) {
    if (history[i] > peak) peak = history[i];
    const dd = (peak - history[i]) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  // ── Korelasi (autokorelasi lag-1 sebagai proksi pasar) ──────────────
  let correlation = 0;
  if (n >= 3) {
    const xArr: number[] = [];
    const yArr: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      xArr.push(history[i]);
      yArr.push(history[i + 1]);
    }
    const mx = mean(xArr);
    const my = mean(yArr);
    let num = 0;
    let dxSq = 0;
    let dySq = 0;
    for (let i = 0; i < n - 1; i++) {
      const dx = xArr[i] - mx;
      const dy = yArr[i] - my;
      num += dx * dy;
      dxSq += dx * dx;
      dySq += dy * dy;
    }
    const denom = Math.sqrt(dxSq * dySq);
    correlation = denom > 0 ? num / denom : 0;
  }

  return {
    var95: Math.round(var95 * 10000) / 10000,
    var99: Math.round(var99 * 10000) / 10000,
    sharpe: Math.round(sharpe * 10000) / 10000,
    sortino: Math.round(sortino * 10000) / 10000,
    maxDrawdown: Math.round(maxDd * 10000) / 10000,
    volatility: Math.round(vol * 10000) / 10000,
    correlation: Math.round(correlation * 10000) / 10000,
  };
}

// =========================================================================
// 3. kellyCriterion — sizing posisi optimal
// =========================================================================

/** Fraksi Kelly penuh, setengah, dan seperempat untuk taruhan biner. */
export function kellyCriterion(winProb: number, avgWin: number, avgLoss: number): KellyResult {
  // ── Guard ────────────────────────────────────────────────────────────
  if (typeof winProb !== "number" || !isFinite(winProb))
    throw new Error("kellyCriterion: winProb must be a finite number");
  if (typeof avgWin !== "number" || !isFinite(avgWin))
    throw new Error("kellyCriterion: avgWin must be a finite number");
  if (typeof avgLoss !== "number" || !isFinite(avgLoss))
    throw new Error("kellyCriterion: avgLoss must be a finite number");

  if (winProb < 0 || winProb > 1)
    throw new Error(`kellyCriterion: winProb must be in [0, 1], got ${winProb}`);
  if (avgWin <= 0) throw new Error(`kellyCriterion: avgWin must be > 0, got ${avgWin}`);
  if (avgLoss <= 0) throw new Error(`kellyCriterion: avgLoss must be > 0, got ${avgLoss}`);

  // ── Edge & odds ──────────────────────────────────────────────────────
  const loseProb = 1 - winProb;
  const edge = winProb * avgWin - loseProb * avgLoss;
  const odds = avgWin / avgLoss; // b = profit per unit risiko

  // f* = (p·b − q) / b; edge ≤ 0 → tidak bertaruh
  let fraction = 0;
  if (odds > 0 && avgWin > 0) {
    const pTimesB = winProb * odds;
    fraction = (pTimesB - loseProb) / odds;
  }
  if (!isFinite(fraction) || fraction < 0) fraction = 0;
  if (fraction > 1) fraction = 1;

  return {
    fraction: Math.round(fraction * 10000) / 10000,
    edge: Math.round(edge * 10000) / 10000,
    odds: Math.round(odds * 10000) / 10000,
    conservative: Math.round(fraction * 0.5 * 10000) / 10000,
    quarter: Math.round(fraction * 0.25 * 10000) / 10000,
  };
}

// =========================================================================
// 4. economicMetricsFromEntity — MarketEntity → EconomicMetrics
// =========================================================================

/**
 * Derivasi deterministik (tanpa seed acak) dari atribut entitas simulasi
 * menjadi dimensi ekonomi quant — pemetaan identik dengan
 * `economicMetricsFromPlanet` upstream.
 */
export function economicMetricsFromEntity(entity: MarketEntity): EconomicMetrics {
  if (!entity || typeof entity !== "object")
    throw new Error("economicMetricsFromEntity: entity must be a non-null object");

  const requiredFields: (keyof MarketEntity)[] = ["population", "tech_level", "wealth", "happiness"];
  for (const f of requiredFields) {
    const v = entity[f];
    if (typeof v !== "number" || !isFinite(v))
      throw new Error(`economicMetricsFromEntity: entity.${String(f)} must be a finite number, got ${v}`);
  }

  const { population, tech_level, wealth, happiness } = entity;

  if (population < 0) throw new Error("economicMetricsFromEntity: population must be >= 0");
  if (tech_level < 0 || tech_level > 100)
    throw new Error("economicMetricsFromEntity: tech_level must be in [0, 100]");
  if (wealth < 0) throw new Error("economicMetricsFromEntity: wealth must be >= 0");
  if (happiness < 0 || happiness > 100)
    throw new Error("economicMetricsFromEntity: happiness must be in [0, 100]");

  // ── Derivasi (skala sama dengan upstream) ───────────────────────────
  const gdp = Math.max(1, wealth * (1 + tech_level * 0.5));
  const gdpGrowth = clamp(0.02 + tech_level * 0.005, 0, 0.12);
  const inflation = clamp(0.05 - happiness * 0.0004, 0.005, 0.2);
  const unemployment = clamp(0.1 - happiness * 0.0008 - tech_level * 0.005, 0.01, 0.3);
  const gini = clamp(0.5 - happiness * 0.003, 0.2, 0.7);
  const productivity = population > 0 ? gdp / population : 0;
  const tradeBalance = (tech_level - 5) * population * 0.01;
  const debtRatio = clamp(0.3 + tech_level * 0.05 - happiness * 0.002, 0, 1);
  const reserves = Math.max(0, wealth * 0.1 + population * 0.001);

  return {
    gdp: Math.round(gdp * 100) / 100,
    gdpGrowth: Math.round(gdpGrowth * 10000) / 10000,
    inflation: Math.round(inflation * 10000) / 10000,
    unemployment: Math.round(unemployment * 10000) / 10000,
    gini: Math.round(gini * 10000) / 10000,
    productivity: Math.round(productivity * 100) / 100,
    tradeBalance: Math.round(tradeBalance * 100) / 100,
    debtRatio: Math.round(debtRatio * 10000) / 10000,
    reserves: Math.round(reserves * 100) / 100,
  };
}
