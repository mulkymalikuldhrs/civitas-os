// FLYBRAIN ORGANISM — organs/immune.ts
// PORT ganda: gh `immune/index.js` (anti-gila: max iterasi, error beruntun,
// deteksi loop, kill/reset, healthCheck) + gitlab `CircuitBreaker.ts`
// (closed → open → half-open). Adaptasi: breaker per creature, state di memori
// proses klien; remediasi permanen ditulis ke state creature oleh engine.
// MURNI TypeScript.

import { eventBus } from "../eventBus";

// ---------- CircuitBreaker (port gitlab, dipadatkan) ----------

export type BreakerState = "closed" | "open" | "half_open";

interface Circuit {
  state: BreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
}

interface BreakerConfig {
  failureThreshold: number; // default 3 (upstream 5 — biosfer lebih cepat curiga)
  successThreshold: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: BreakerConfig = { failureThreshold: 3, successThreshold: 2, timeoutMs: 90_000 };

export class CircuitBreaker {
  private circuits = new Map<string, Circuit>();
  private configs = new Map<string, BreakerConfig>();

  register(name: string, config?: Partial<BreakerConfig>): void {
    this.configs.set(name, { ...DEFAULT_CONFIG, ...config });
    if (!this.circuits.has(name)) {
      this.circuits.set(name, { state: "closed", failureCount: 0, successCount: 0, lastFailureTime: null });
    }
  }

  private ensure(name: string): { circuit: Circuit; config: BreakerConfig } {
    this.register(name);
    return { circuit: this.circuits.get(name)!, config: this.configs.get(name)! };
  }

  onSuccess(name: string): void {
    const { circuit, config } = this.ensure(name);
    circuit.successCount += 1;
    circuit.failureCount = 0;
    if (circuit.state === "half_open" && circuit.successCount >= config.successThreshold) {
      circuit.state = "closed";
      circuit.successCount = 0;
    }
  }

  onFailure(name: string): void {
    const { circuit, config } = this.ensure(name);
    circuit.lastFailureTime = Date.now();
    circuit.failureCount += 1;
    circuit.successCount = 0;
    if (circuit.failureCount >= config.failureThreshold && circuit.state !== "open") {
      circuit.state = "open";
      eventBus.emit("reflect", `breaker ${name} OPEN — ${circuit.failureCount} kegagalan beruntun (immune).`, { creatureId: name });
    }
  }

  /** true = boleh mencoba LLM (bila half-open setelah timeout). */
  isAvailable(name: string): boolean {
    const { circuit, config } = this.ensure(name);
    if (circuit.state === "closed") return true;
    if (circuit.state === "open" && circuit.lastFailureTime && Date.now() - circuit.lastFailureTime >= config.timeoutMs) {
      circuit.state = "half_open";
      return true;
    }
    return circuit.state === "half_open";
  }

  isOpen(name: string): boolean {
    return this.ensure(name).circuit.state === "open";
  }

  getState(name: string): BreakerState {
    return this.ensure(name).circuit.state;
  }

  getStatus(name: string): { state: BreakerState; failureCount: number } {
    const c = this.ensure(name).circuit;
    return { state: c.state, failureCount: c.failureCount };
  }

  reset(name: string): void {
    const { circuit } = this.ensure(name);
    circuit.state = "closed";
    circuit.failureCount = 0;
    circuit.successCount = 0;
    circuit.lastFailureTime = null;
  }
}

// ---------- ImmuneSystem (port gh, dipadatkan ke kontrak biosfer) ----------

const CONFIG = {
  max_errors_consecutive: 5, // upstream: 5 — di atas ini creature "mati" sementara
  max_same_decision_repeat: 12, // deteksi loop: keputusan identik beruntun
};

class ImmuneSystem {
  readonly breaker = new CircuitBreaker();
  /** Ambang loop keputusan identik (diekspos agar engine bisa pre-check, audit F-19). */
  readonly MAX_LOOP_REPEAT = CONFIG.max_same_decision_repeat;
  private sameDecision = new Map<string, string>();
  private sameDecisionCount = new Map<string, number>();

  constructor() {
    // Breaker didaftarkan saat engine memuat creature (registerCreature).
  }

  registerCreature(id: string): void {
    this.breaker.register(id);
  }

  /** Catat sukses denyut: breaker success. Loop counter TIDAK direset di sini
   * (dulu reset tiap sukses → detectLoop mustahil menumpuk, audit F-12/F-19).
   * Reset loop hanya lewat resetLoop()/reset() yang disengaja. */
  recordSuccess(id: string): void {
    this.breaker.onSuccess(id);
  }

  /** Catat kegagalan denyut (LLM/network). */
  recordFailure(id: string): void {
    this.breaker.onFailure(id);
  }

  /** Deteksi loop: keputusan identik terus-menerus (port `detectLoop`).
   * Dipanggil engine SETIAP keputusan (menalar/refleks) untuk merekam fingerprint. */
  detectLoop(id: string, decisionFingerprint: string): boolean {
    if (this.sameDecision.get(id) === decisionFingerprint) {
      const n = (this.sameDecisionCount.get(id) ?? 0) + 1;
      this.sameDecisionCount.set(id, n);
      return n >= CONFIG.max_same_decision_repeat;
    }
    this.sameDecision.set(id, decisionFingerprint);
    this.sameDecisionCount.set(id, 1);
    return false;
  }

  /** Jumlah keputusan identik beruntun terakhir (pre-check engine sebelum LLM). */
  loopCount(id: string): number {
    return this.sameDecisionCount.get(id) ?? 0;
  }

  /** Fingerprint keputusan terakhir creature (untuk pre-check anti-loop). */
  lastFingerprint(id: string): string | null {
    return this.sameDecision.get(id) ?? null;
  }

  /** Reset HANYA counter loop (breaker tak disentuh) — dipakai setelah variasi dipaksakan. */
  resetLoop(id: string): void {
    this.sameDecisionCount.set(id, 0);
  }

  /**
   * Putuskan nasib creature setelah denyut: aktif/tidur/mati (port `kill`).
   * "Mati" = creature berhenti dipilih scheduler sampai dibangunkan prt/reflect —
   * data lokal creature TIDAK dihapus (konstitusi hukum 4).
   */
  verdict(id: string, fails: number): "ok" | "sleep" | "dead" {
    if (fails >= CONFIG.max_errors_consecutive) return "dead";
    if (fails >= 2) return "sleep";
    return "ok";
  }

  /** Reset counters (port `reset`) — dipakai remediasi self-reflect. */
  reset(id: string): void {
    this.breaker.reset(id);
    this.sameDecisionCount.set(id, 0);
  }

  /** HealthCheck (port `healthCheck`). */
  healthCheck(creatureIds: string[]): { healthy: boolean; warning: string[]; totalErrors: number } {
    const warning: string[] = [];
    let totalErrors = 0;
    for (const id of creatureIds) {
      const st = this.breaker.getStatus(id);
      totalErrors += st.failureCount;
      if (st.failureCount >= 2 || st.state !== "closed") warning.push(id);
    }
    return { healthy: warning.length === 0, warning, totalErrors };
  }
}

/** Sistem imun tunggal biosfer. */
export const immune = new ImmuneSystem();
