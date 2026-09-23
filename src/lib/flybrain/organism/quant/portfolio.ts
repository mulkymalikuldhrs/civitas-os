// =========================================================================
// Portfolio Optimizer — Markowitz Mean-Variance with Risk Budget
// FLYBRAIN BIOSFER v1.1 — port dari upstream gitlab `src/quant/portfolio.ts`
// (identik; tidak ada dependensi luar sejak awal).
// =========================================================================

import type { PortfolioAllocation } from "./types";

/** Deskriptor aset untuk optimizer portofolio. */
export interface OptimizerAsset {
  id: string;
  name?: string;
  expectedReturn: number;
  risk: number; // standar deviasi / volatilitas (0–1)
  correlation?: number; // korelasi ke acuan portofolio/pasar
}

/**
 * Estimasi kovarian internal dua aset; tanpa korelasi → 0 (independen).
 */
function estimateCorrelation(a: OptimizerAsset, b: OptimizerAsset): number {
  if (a.correlation !== undefined && b.correlation !== undefined) {
    return Math.max(-1, Math.min(1, a.correlation * b.correlation));
  }
  return 0;
}

/**
 * Optimizer mean-variance Markowitz dengan batas anggaran risiko.
 * Mencari portofolio tangency (Sharpe maksimum) dengan kendala:
 *   - sum(weights) = 1.0 (terinvestasi penuh)
 *   - long-only
 *   - risiko portofolio ≤ maxRisk
 * Tidak konvergen / input degenerate → fallback equal-weight.
 */
export function optimizePortfolio(
  assets: OptimizerAsset[],
  maxRisk: number,
  riskFreeRate: number,
): PortfolioAllocation[] {
  // ------------------------------------------------------------------
  // Guard: input degenerate → equal-weight fallback
  // ------------------------------------------------------------------
  if (!assets || assets.length === 0) {
    return [];
  }
  if (assets.length === 1) {
    const a = assets[0];
    return [
      {
        entityId: a.id,
        name: a.name ?? a.id,
        weight: 1.0,
        expectedReturn: a.expectedReturn,
        risk: a.risk,
        sharpe: a.risk > 0 ? (a.expectedReturn - riskFreeRate) / a.risk : 0,
      },
    ];
  }

  // ------------------------------------------------------------------
  // 1. Sharpe per aset (negatif di-clamp 0 untuk long-only)
  // ------------------------------------------------------------------
  type Scored = OptimizerAsset & { score: number };
  const scored: Scored[] = assets.map((a) => ({
    ...a,
    score:
      a.risk > 0
        ? Math.max(0, (a.expectedReturn - riskFreeRate) / a.risk)
        : a.expectedReturn > riskFreeRate
          ? 1e6 // aset nyaris tanpa risiko dengan excess return positif
          : 0,
  }));

  scored.sort((a, b) => b.score - a.score);

  // ------------------------------------------------------------------
  // 2. Alokasi sadar-anggaran-risiko: proporsional (excessReturn / risk²)
  // ------------------------------------------------------------------
  const n = scored.length;
  const excessReturns = scored.map((a) => a.expectedReturn - riskFreeRate);

  let rawWeights: number[];
  const totalExcessRisk = scored.reduce(
    (sum, a) => sum + (a.risk > 0 ? excessReturns[scored.indexOf(a)] / (a.risk * a.risk) : 0),
    0,
  );

  if (totalExcessRisk > 0) {
    rawWeights = scored.map((a) =>
      a.risk > 0
        ? Math.max(0, excessReturns[scored.indexOf(a)] / (a.risk * a.risk) / totalExcessRisk)
        : 0,
    );
  } else {
    rawWeights = new Array(n).fill(1 / n);
  }

  // ------------------------------------------------------------------
  // 3. Kendala anggaran risiko via penskalaan iteratif (32 iterasi maks)
  // ------------------------------------------------------------------
  let weights = rawWeights.slice();

  for (let iter = 0; iter < 32; iter++) {
    let portVar = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const corr = i === j ? 1 : estimateCorrelation(scored[i], scored[j]);
        portVar += weights[i] * weights[j] * scored[i].risk * scored[j].risk * corr;
      }
    }
    const portRisk = Math.sqrt(portVar);

    if (portRisk <= maxRisk || portRisk < 1e-10) {
      break; // dalam anggaran atau degenerate
    }

    const scale = maxRisk / portRisk;
    weights = weights.map((w) => w * scale);

    const sumW = weights.reduce((a, b) => a + b, 0);
    if (sumW > 0) {
      weights = weights.map((w) => w / sumW);
    }
  }

  // ------------------------------------------------------------------
  // 4. Sanity: bobot positif berjumlah ±1.0
  // ------------------------------------------------------------------
  const finalSum = weights.reduce((a, b) => a + b, 0);
  const hasInvalid = weights.some((w) => !isFinite(w) || w < 0);

  if (hasInvalid || Math.abs(finalSum - 1.0) > 0.001) {
    weights = new Array(n).fill(1 / n);
  }

  // ------------------------------------------------------------------
  // 5. Hasil
  // ------------------------------------------------------------------
  return scored.map((a, i) => ({
    entityId: a.id,
    name: a.name ?? a.id,
    weight: Math.round(weights[i] * 1e6) / 1e6,
    expectedReturn: a.expectedReturn,
    risk: a.risk,
    sharpe: a.score,
  }));
}
