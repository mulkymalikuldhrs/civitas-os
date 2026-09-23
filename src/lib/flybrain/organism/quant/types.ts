// =========================================================================
// Quant Types — FLYBRAIN BIOSFER v1.1
// Port dari upstream gitlab `src/quant/types.ts` (Autonomous-Organism v5.5.0).
// Pure TS — tanpa dependensi luar. Label jujur: SEMUA metrik di modul ini
// dihitung dari data SIMULASI LOKAL (random-walk), bukan pasar nyata.
// =========================================================================

/** Skor komposit 0–100 lintas lima dimensi quant. */
export interface QuantScore {
  overall: number; // 0–100 composite
  growth: number; // momentum pertumbuhan
  stability: number; // kestabilan (variance inverted)
  efficiency: number; // output per unit input
  resilience: number; // ketahanan terhadap guncangan (VaR inverse)
  potential: number; // potensi pertumbuhan masa depan
}

/** Profil risiko satu entitas / portofolio dari deret imbal hasil. */
export interface QuantRisk {
  var95: number; // Value at Risk (95%)
  var99: number; // Value at Risk (99%)
  sharpe: number; // imbal hasil rata risiko
  sortino: number; // rata risiko downside
  maxDrawdown: number; // drawdown historis maksimum
  correlation: number; // korelasi ke pasar/acuan
  volatility: number; // volatilitas (anualisasi implisit per periode)
}

/** Rekomendasi alokasi portofolio satu entitas. */
export interface PortfolioAllocation {
  entityId: string;
  name: string;
  weight: number; // 0.0 – 1.0
  expectedReturn: number;
  risk: number;
  sharpe: number;
}

/** Hasil kriteria Kelly untuk sizing posisi. */
export interface KellyResult {
  fraction: number; // 0.0 – 1.0 (fraksi modal)
  edge: number; // edge = p*avgWin - q*avgLoss
  odds: number; // net odds taruhan
  conservative: number; // half-kelly
  quarter: number; // quarter-kelly
}

/** Keadaan risk-gate / kill-switch (fail-closed). */
export interface RiskGateState {
  active: boolean; // TRUE = gate memblokir
  reason: string | null;
  triggeredAt: number | null;
  dailyLoss: number;
  weeklyLoss: number;
  dailyLimit: number;
  weeklyLimit: number;
  maxCorrelation: number;
  correlationExposure: number;
}

/** Konfigurasi engine quant. */
export interface QuantEngineConfig {
  enabled: boolean;
  tickInterval: number; // ms antar quant tick
  riskFreeRate: number; // mis. 0.05 = 5%
  maxPortfolioRisk: number; // 0.0 – 1.0
  dailyLossLimit: number;
  weeklyLossLimit: number;
  maxCorrelation: number;
  kellyFraction: "full" | "half" | "quarter";
}

/** Entitas pasar minimal yang dinilai engine (pengganti `Planet` upstream — tanpa hook React). */
export interface MarketEntity {
  id: string;
  name: string;
  /** Atribut derivasi ekonomi (sama dengan upstream): */
  population: number; // >= 0
  tech_level: number; // 0–100
  wealth: number; // >= 0 (simulasi)
  happiness: number; // 0–100
  /** Deret imbal hasil historis (desimal) untuk dekomposisi risiko; >= 2 titik. */
  history: number[];
}

/** Keluaran satu quant tick. */
export interface QuantTickResult {
  timestamp: number;
  scores: Map<string, QuantScore>;
  risks: Map<string, QuantRisk>;
  allocations: PortfolioAllocation[];
  gates: RiskGateState[];
  recommendations: string[];
}

/** Metrik ekonomi untuk scoring (dimension input `calculateScore`). */
export interface EconomicMetrics {
  gdp: number;
  gdpGrowth: number;
  inflation: number;
  unemployment: number;
  gini: number; // indeks ketimpangan
  productivity: number; // output per kapita
  tradeBalance: number;
  debtRatio: number; // debt / gdp
  reserves: number;
}
