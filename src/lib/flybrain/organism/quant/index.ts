// =========================================================================
// Quant Module — Barrel Exports
// FLYBRAIN BIOSFER v1.1 — port dari upstream gitlab `src/quant/index.ts`.
// Seluruh modul PURE TS: bisa dipanggil tanpa browser API (server & klien).
// Label jujur: semua angka di sini berasal dari data SIMULASI LOKAL.
// =========================================================================

// Scoring engine
export * from "./scoring";

// Portfolio optimizer
export { optimizePortfolio } from "./portfolio";
export type { OptimizerAsset } from "./portfolio";

// Risk gate / kill switch
export { RiskGate } from "./risk-gate";
export type { RiskGateOptions } from "./risk-gate";

// Tick engine (murni — tanpa store)
export { runQuantTick, randomWalkReturns, priceSeriesFromReturns, DEFAULT_QUANT_CONFIG } from "./quant-tick";
export type { QuantTickInput } from "./quant-tick";

// Core types
export type {
  QuantScore,
  QuantRisk,
  PortfolioAllocation,
  KellyResult,
  RiskGateState,
  QuantEngineConfig,
  QuantTickResult,
  EconomicMetrics,
  MarketEntity,
} from "./types";
