// CIVITAS OS — ORGANISM RUNTIME · types.ts
// General Autonomous Digital Organism (mandat 38-poin + lapisan HERMES).
// Prinsip inti: "Jangan hardcode kecerdasan organismenya. Hardcode hanya fondasi."
// Yang di-hardcode HANYA: runtime, sandbox, tool protocol, memory interface,
// lifecycle, security boundary, kill switch, resource boundary. Selebihnya
// (bobot penilaian, strategi, workflow, komposisi agent) hidup di GENOME yang
// bisa dimutasi oleh Mutation Engine — bukan konstanta kode.

// ───────────────────────────── DNA ─────────────────────────────

/** Inti identitas — IMMUTABLE setelah lahir (kecuali kill/archive). */
export interface DnaCore {
  id: string;
  name: string;
  kind: "root" | "specialized" | "temporary";
  bornAt: string;
  parent?: string;
  purpose: string;
  /** Konstitusi singkat — hard constraint, bukan instruksi "how". */
  hardConstraints: string[];
  /** File yang jika ada isinya "KILL" => organisme berhenti total. */
  killSwitchPath: string;
}

/** Genom — MUTABLE oleh Mutation Engine (evolusi L1-L3). */
export interface OrganismGenome {
  /** Bobot skor goal: reward + strategic + feasibility − cost − risk (± novelty). */
  weights: {
    reward: number;
    strategic: number;
    feasibility: number;
    costPenalty: number;
    riskPenalty: number;
    novelty: number;
  };
  /** Strategi aktif — dipilih dari registry strategi (evolusi L2). */
  strategy: string;
  /** Workflow — pola siklus (evolusi L3). */
  workflow: {
    intervalMs: number;
    maxGoalsPerCycle: number;
    /** Bias "do nothing" (0-1): makin tinggi, makin hemat energi. */
    doNothingBias: number;
    /** Langkah siklus diaktifkan (urutan boleh dimutasi). */
    steps: string[];
  };
  /** Tool yang genome izinkan dipakai (layer di atas permission imun). */
  tools: string[];
  /** Komposisi populasi agent organik (evolusi L5 via spawner). */
  agentComposition: { role: string; count: number }[];
}

/** 7 limit imun — DEKLARATIF di DNA, DI-ENFORCE di kode immune.ts. */
export interface ImmuneLimits {
  /** 1. timeout: setiap eksekusi dibungkus batas waktu nyata. */
  timeoutMs: number;
  /** 2. recursion: kedalaman siklus/guard bersarang maksimum. */
  maxRecursion: number;
  /** 3. retry: percobaan ulang maksimum per aksi. */
  maxRetries: number;
  /** 4. resource: RSS proses maksimum (MB) — dilanggar → repair→kill. */
  maxMemoryMb: number;
  /** 5. memory: jumlah entri memori maksimum (ring buffer dipangkas). */
  maxMemoryEntries: number;
  /** 6. network: hostname yang boleh diakses + timeout fetch. */
  networkAllowlist: string[];
  networkTimeoutMs: number;
  /** 7. tool-permission: tool apa yang boleh dipanggil organisme. */
  toolPermissions: Record<string, boolean>;
}

export interface OrganismPermissions {
  fsRead: boolean;
  fsWrite: boolean;
  exec: boolean;
  network: boolean;
  spawn: boolean;
}

export interface OrganismDNA {
  core: DnaCore;
  genome: OrganismGenome;
  immune: ImmuneLimits;
  permissions: OrganismPermissions;
}

// ─────────────────────── WORLD MODEL ───────────────────────

export interface WorldFact {
  key: string;
  value: string;
  at: string;
  source: string;
}

/** KETIDAKTAHUAN adalah state first-class (HERMES): disembunyikan = dosa. */
export interface EpistemicState {
  known: WorldFact[];
  unknown: { key: string; why: string; probe?: string }[];
  assumptions: { key: string; note: string; risky?: boolean }[];
  unverified: { key: string; howToVerify: string }[];
}

export interface WorldArea {
  health: number; // 0-100
  note: string;
}

export interface WorldModel {
  at: string;
  /** resources: CPU/RAM/disk/load — nyata dari envprobe. */
  resources: {
    cpuCount: number; load1: number; load5: number;
    rssMb: number; heapMb: number; freememMb: number; totalmemMb: number;
    diskFreeMb: number; uptimeS: number;
  };
  /** infrastructure: server MC, daemon, web app — nyata dari probe. */
  infrastructure: Record<string, WorldArea>;
  /** agents: populasi organisme (root + children) — nyata dari registry+PID. */
  agents: { id: string; kind: string; alive: boolean; role: string }[];
  /** products: artefak yang dirawat organisme (repo/subsystem). */
  products: { name: string; path: string; owner: string; subsystems: number }[];
  /** knowledge: jumlah entri memori + lesson terakhir. */
  knowledge: { memoryEntries: number; lastLesson?: string };
  /** risks: risiko hidup yang dikenali dunia. */
  risks: { key: string; level: "LOW" | "MEDIUM" | "HIGH"; note: string }[];
  /** experiments: mutasi yang pernah diuji (A/B). */
  experiments: { id: string; status: string; verdict?: string }[];
  /** economy: biaya operasi organisme (waktu CPU) vs nilai aksi. */
  economy: { cycleCostMs: number; actionsDone: number; valueScore: number };
  epistemic: EpistemicState;
}

// ─────────────────────── GOALS & DECISION ───────────────────────

export interface Goal {
  id: string;
  area: string;
  title: string;
  /** Action protocol yang diketahui loop (bukan logika ad-hoc). */
  action: string;
  params: Record<string, string | number | boolean>;
  /** Estimasi organisme sendiri — bobot dari genome, bukan hardcode. */
  reward: number;
  strategic: number;
  feasibility: number;
  cost: number;
  risk: number;
  novelty: number;
  score?: number;
  requiredCapabilities?: string[];
}

export interface Decision {
  at: string;
  cycle: number;
  chosen: Goal | null; // null = "DO NOTHING" — keputusan sah
  reasoning: string;
  doNothingScore: number;
}

// ─────────────────────── IMMUNE EVENTS ───────────────────────

export type ImmuneSignal =
  | "TIMEOUT" | "RECURSION" | "RETRY_EXHAUSTED" | "RESOURCE"
  | "MEMORY_LIMIT" | "NETWORK_BLOCKED" | "TOOL_DENIED" | "KILL_SWITCH";

export interface ImmuneEvent {
  at: string;
  signal: ImmuneSignal;
  detail: string;
  /** Respons imun yang benar-benar dijalankan. */
  response: "PAUSE" | "ROLLBACK" | "RECORD" | "REPAIR" | "KILL" | "IGNORED";
}

// ─────────────────────── MUTATION (A/B) ───────────────────────

export type MutationLevel = "L1_PARAMETER" | "L2_STRATEGY" | "L3_WORKFLOW" | "L4_CAPABILITY" | "L5_ORGANIZATION";

export interface MutationRecord {
  id: string;
  at: string;
  level: MutationLevel;
  target: string;
  hypothesis: string;
  status: "PROPOSED" | "SANDBOXED" | "TESTED" | "ADOPTED" | "REJECTED" | "ROLLED_BACK";
  /** A = baseline (file/nilai lama), B = kandidat (patch penuh). */
  aSnapshot: string;
  bPatch: string;
  sandbox?: string;
  benchmark?: {
    aMs: number; bMs: number; aValid: boolean; bValid: boolean;
    aOutputHash: string; bOutputHash: string; equivalent: boolean;
  };
  verdict?: string;
  lesson?: string;
}

// ─────────────────────── CAPABILITY GRAPH ───────────────────────

export type CapabilityKind = "probe" | "tool" | "module" | "data" | "service";

export interface Capability {
  id: string;
  kind: CapabilityKind;
  status: "AVAILABLE" | "MISSING" | "DEGRADED";
  /** Path modul / perintah verifikasi. */
  impl?: string;
  verifiedAt?: string;
  verifyNote?: string;
  owner?: string;
}

export interface CapabilityGap {
  goalId: string;
  required: string[];
  available: string[];
  missing: string[];
  plan?: { capabilityId: string; how: "BUILD" | "DELEGATE" | "DISCOVER" }[];
}

// ─────────────────────── CHILDREN (SPAWNER) ───────────────────────

export interface ChildRecord {
  id: string;
  name: string;
  role: string;
  kind: "temporary" | "specialized";
  purpose: string;
  pid: number;
  dir: string;
  spawnedAt: string;
  status: "RUNNING" | "DEAD" | "ARCHIVED" | "KILLED";
  lastHeartbeat?: string;
  cycles?: number;
  exitCode?: number | null;
}

// ─────────────────────── LOOP STATE ───────────────────────

export type OrganismPhase = "RUNNING" | "PAUSED" | "KILLED" | "LOCKED";

export interface LoopState {
  phase: OrganismPhase;
  cycle: number;
  lastTickAt?: string;
  lastPhaseChange?: { at: string; from: string; to: string; reason: string };
  stats: { actions: number; failures: number; mutations: number; spawns: number; lessons: number };
}

export interface MemoryEntry {
  at: string;
  kind: "OBSERVATION" | "LESSON" | "DECISION" | "FAILURE" | "EVALUATION" | "REFLECTION";
  text: string;
  /** Failure is Data: konteks & pelajaran wajib untuk FAILURE. */
  hypothesis?: string;
  result?: string;
  reason?: string;
  costMs?: number;
}

export interface OrganismState {
  dna: OrganismDNA;
  loop: LoopState;
  world: WorldModel;
  goals: Goal[];
  decision: Decision | null;
  memory: MemoryEntry[];
  capabilities: Capability[];
  gaps: CapabilityGap[];
  mutations: MutationRecord[];
  children: ChildRecord[];
  immuneEvents: ImmuneEvent[];
  llm: { mode: "HEURISTIC" | "REMOTE"; baseUrl?: string; model?: string; keySet: boolean };
}
