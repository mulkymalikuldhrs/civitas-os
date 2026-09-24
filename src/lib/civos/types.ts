// CIVITAS OS — types.ts
// Konstanta & tipe bersama Civilization Kernel. Uang = integer minor unit FLR.

export const CURRENCY = "FLR"; // florin — mata uang internal peradaban
export const MINOR = 100; // 1 FLR = 100 minor unit

/** 13 state lifecycle perusahaan (PRD §28). Failure = state valid. */
export const COMPANY_LIFECYCLE = [
  "PROPOSED",
  "REGISTERED",
  "CAPITALIZED",
  "ACTIVE",
  "GROWING",
  "PROFITABLE",
  "UNPROFITABLE",
  "CAPITAL_CONSTRAINED",
  "DORMANT",
  "RESTRUCTURING",
  "LIQUIDATING",
  "BANKRUPT",
  "DISSOLVED",
] as const;
export type CompanyLifecycle = (typeof COMPANY_LIFECYCLE)[number];

/** Tepi transisi lifecycle yang sah (tidak boleh melompat). */
export const LIFECYCLE_EDGES: Record<string, string[]> = {
  PROPOSED: ["REGISTERED"],
  REGISTERED: ["CAPITALIZED", "DORMANT"],
  CAPITALIZED: ["ACTIVE"],
  ACTIVE: ["GROWING", "UNPROFITABLE"],
  GROWING: ["PROFITABLE", "UNPROFITABLE"],
  PROFITABLE: ["GROWING", "UNPROFITABLE"],
  UNPROFITABLE: ["CAPITAL_CONSTRAINED", "RESTRUCTURING", "GROWING"],
  CAPITAL_CONSTRAINED: ["DORMANT", "LIQUIDATING", "RESTRUCTURING"],
  DORMANT: ["RESTRUCTURING", "LIQUIDATING", "ACTIVE"],
  RESTRUCTURING: ["ACTIVE", "LIQUIDATING"],
  LIQUIDATING: ["BANKRUPT"],
  BANKRUPT: ["DISSOLVED"],
  DISSOLVED: [],
};

export const TX_TYPES = [
  "MINT",
  "ALLOCATION",
  "TAX",
  "TRADE_INTERNAL",
  "REVENUE_EXTERNAL",
  "EXPENSE",
  "TRANSFER",
  "DIVIDEND",
  "BURN",
  "WAGE",
] as const;
export type TxType = (typeof TX_TYPES)[number];

/** Tipe event kanonik (immutable log). */
export const EVENT_TYPES = {
  NATION_FOUNDED: "NATION_FOUNDED",
  GOVERNMENT_FORMED: "GOVERNMENT_FORMED",
  CITY_FOUNDED: "CITY_FOUNDED",
  COMPANY_PROPOSED: "COMPANY_PROPOSED",
  COMPANY_REGISTERED: "COMPANY_REGISTERED",
  COMPANY_STATE: "COMPANY_STATE",
  AGENT_CREATED: "AGENT_CREATED",
  CAPITAL_ALLOCATED: "CAPITAL_ALLOCATED",
  MINT: "MINT",
  BURN: "BURN",
  TRADE_INTERNAL: "TRADE_INTERNAL",
  REVENUE_EXTERNAL: "REVENUE_EXTERNAL",
  TAX_ASSESSED: "TAX_ASSESSED",
  TAX_PAID: "TAX_PAID",
  EXPENSE: "EXPENSE",
  PROPOSAL_SUBMITTED: "PROPOSAL_SUBMITTED",
  PROPOSAL_ANALYZED: "PROPOSAL_ANALYZED",
  PROPOSAL_APPROVED: "PROPOSAL_APPROVED",
  PROPOSAL_REJECTED: "PROPOSAL_REJECTED",
  PROPOSAL_EXECUTED: "PROPOSAL_EXECUTED",
  GOVERNMENT_DECISION: "GOVERNMENT_DECISION",
  TASK_COMPLETED: "TASK_COMPLETED",
  TASK_FAILED: "TASK_FAILED",
  POLICY_VIOLATION: "POLICY_VIOLATION",
  MEMORY_WRITTEN: "MEMORY_WRITTEN",
  MC_STATUS: "MC_STATUS",
  HEARTBEAT: "HEARTBEAT",
  SUSTAINABILITY_ALERT: "SUSTAINABILITY_ALERT",
  // SLICE 7 — VILLAGER ASCENSION
  VILLAGER_ASCENDED: "VILLAGER_ASCENDED",
  VILLAGER_ACT: "VILLAGER_ACT",
  VILLAGER_RETIRED: "VILLAGER_RETIRED",
  WAGE_PAID: "WAGE_PAID",
  VILLAGE_CENSUS: "VILLAGE_CENSUS",
  // SLICE 8 — VILLAGER EMBODIMENT (tubuh) + PASAR DESA
  VILLAGER_DIRECTIVE: "VILLAGER_DIRECTIVE",
  MARKET_LISTED: "MARKET_LISTED",
  MARKET_TRADED: "MARKET_TRADED",
  // SLICE 9 — GUILD KERJA & TOOLFORGE (tool calling + internet nyata)
  TOOL_INVOKED: "TOOL_INVOKED",
  ARTIFACT_CREATED: "ARTIFACT_CREATED",
  // SLICE 11 — SELF-LIFE (self backup · self sync · multi-server)
  BACKUP_CREATED: "BACKUP_CREATED",
  SYNC_PUSHED: "SYNC_PUSHED",
} as const;

/** Jenis direktif tubuh — jembatan keputusan → aksi fisik villager.
 *  SLICE 9: BUILD (pembangunan), PATROL (militer), MINE (penambangan). */
export const DIRECTIVE_KINDS = ["MOVE", "SPEAK", "WORK_ANIM", "LOOK", "BUILD", "PATROL", "MINE"] as const;
export type DirectiveKind = (typeof DIRECTIVE_KINDS)[number];

/** Mesin status direktif: tidak ada kebangkitan dari APPLIED/FAILED/EXPIRED. */
export const DIRECTIVE_EDGES: Record<string, string[]> = {
  QUEUED: ["DISPATCHED", "APPLIED", "FAILED", "EXPIRED"], // APPLIED/FAILED juga dari jalur SIM langsung
  DISPATCHED: ["APPLIED", "FAILED", "EXPIRED"],
  APPLIED: [],
  FAILED: [],
  EXPIRED: [],
};

/** Whitelist aksi VILLAGER — terpisah dari institusi (ALLOWED_ACTIONS policy). */
export const VILLAGER_ACTIONS = [
  "WORK", // bekerja di perusahaan → upah dari kas operasional + ARTEFAK kerja guild (SLICE 9)
  "BUY", // konsumsi dari perusahaan (TRADE_INTERNAL, BUKAN revenue eksternal)
  "SOCIALIZE", // menjalin hubungan + menyebarkan cerita (memori antar warga)
  "WANDER", // menjelajah dunia / berimajinasi (saat server tidur)
  "REST", // memulihkan tenaga
  "SAVE", // menabung (tidak membeli)
  "PROPOSE_TO_GOV", // usulan warga ke pemerintah (memori publik + event)
] as const;
export type VillagerAction = (typeof VILLAGER_ACTIONS)[number];

// ---------- SLICE 9 — GUILD KERJA (divisi spesialis warga) ----------

/** Divisi/guild warga: pekerjaan spesialis nyata dengan tool charter.
 *  GENERAL = warga umum (tanpa tool spesialis). */
export const DIVISIONS = [
  "GENERAL",
  "CODER", // pemrogram — menulis kode nyata (artefak CODE)
  "DEV", // pengembang — spesifikasi & rencana produk (artefak SPEC)
  "BUILDER", // pembangun — blueprint konstruksi + direktif BUILD
  "MILITARY", // garda — laporan patroli + direktif PATROL
  "ENGINEER", // insinyur — infrastruktur (blueprint) + direktif BUILD
  "MINER", // penambang — rute tambang + hasil tambang ke pasar (artefak MINE_YIELD)
  "NETRUNNER", // penyambung internet — web_search/page_reader NYATA (artefak RESEARCH)
  "TOOLSMITH", // pengrajin alat — orkestrator tool calling (semua tool, berlabel)
] as const;
export type Division = (typeof DIVISIONS)[number];

export interface DivisionMeta {
  label: string;
  desc: string;
  tools: string[]; // charter: tool yang boleh dipanggil tanpa grant tambahan
  artifactKind: string;
  icon: string; // nama ikon lucide untuk UI
}

/** Charter divisi: siapa boleh memanggil tool apa (kernel, BUKAN keputusan LLM).
 *  Ini pengganti grant per-agen untuk warga — deterministik & auditable. */
export const DIVISION_META: Record<string, DivisionMeta> = {
  GENERAL: { label: "Warga Umum", desc: "pekerjaan desa sehari-hari", tools: [], artifactKind: "REPORT", icon: "Users" },
  CODER: { label: "Pemrogram", desc: "menulis & merawat kode peradaban", tools: ["code_write"], artifactKind: "CODE", icon: "Code2" },
  DEV: { label: "Pengembang", desc: "merancang produk & spesifikasi", tools: ["spec_write"], artifactKind: "SPEC", icon: "GitBranch" },
  BUILDER: { label: "Pembangun", desc: "membangun struktur dunia", tools: ["build_plan"], artifactKind: "BLUEPRINT", icon: "Hammer" },
  MILITARY: { label: "Garda", desc: "pertahanan & patroli desa", tools: ["patrol_report"], artifactKind: "PATROL", icon: "Shield" },
  ENGINEER: { label: "Insinyur", desc: "infrastruktur & utilitas desa", tools: ["build_plan"], artifactKind: "BLUEPRINT", icon: "Wrench" },
  MINER: { label: "Penambang", desc: "menambang sumber daya ke pasar", tools: ["mine_route"], artifactKind: "MINE_YIELD", icon: "Pickaxe" },
  NETRUNNER: { label: "Penyambung Internet", desc: "riset dunia nyata via internet", tools: ["web_search", "page_reader", "mcp_call"], artifactKind: "RESEARCH", icon: "Globe" },
  TOOLSMITH: { label: "Pengrajin Alat", desc: "menguji & mengorkestrasi semua tool", tools: ["web_search", "page_reader", "code_write", "spec_write", "build_plan", "mine_route", "patrol_report", "mcp_call"], artifactKind: "REPORT", icon: "Cog" },
};

export function divisionMeta(key: string): DivisionMeta {
  return DIVISION_META[key] ?? DIVISION_META.GENERAL;
}

export interface RouteMeta {
  provider: string;
  model: string;
  mode: "LLM" | "REFLEX";
  reason: string;
  latencyMs: number;
  tokens: number;
  fallback?: string;
}

/** Aksi yang BOLEH diusulkan LLM/reflex — di luar daftar = ditolak policy (REASON ≠ AUTHORITY). */
export const ACTION_TYPES = [
  "PRODUCE",
  "INVOICE_INTERNAL",
  "PROPOSE_ALLOCATION",
  "PROPOSE_REGISTRATION",
  "REQUEST_TAX_REVIEW",
  "OBSERVE",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface AgentAction {
  /** Whitelist ditegakkan parseCivDecision (per-pemanggil: institusi vs villager) + eksekusi kernel.
   *  Tipe dilebarkan ke string agar dua domain aksi tetap terpisah tanpa tumpang tindih union. */
  type: string;
  target: string; // kode org/agens sasaran
  payload: string | null;
  reason: string;
}

export interface CivDecision {
  aware: string;
  interpret: string;
  decision: string;
  action: AgentAction;
  remember: string;
}

export const KV_CURSOR = "heartbeat.cursor";
export const KV_LAST_TICK = "heartbeat.lastTick";
export const KV_MC_CACHE = "minecraft.cache";
export const KV_VILLAGE_CURSOR = "village.cursor";
export const KV_VILLAGE_SEQ = "village.seq";
export const KV_VILLAGE_SEEDFLAG = "village.simCensusSeeded";
export const KV_MARKET_SEQ = "market.seq";
export const KV_TOOL_SEQ = "toolforge.seq";
export const KV_SELF_LIFE = "selflife.lastTick";

/** SLICE 11 — edisi server yang dikenali kernel (all-in-one: Bedrock + Java + registry). */
export const SERVER_EDITIONS = ["BEDROCK", "JAVA"] as const;

/** Info server Minecraft pemilik (mandat 2026-09): Bedrock 1.26.51.1. */
export const MC_SERVER_INFO = {
  host: "mulkymalikuldhr.aternos.me",
  port: 19132,
  edition: "Bedrock",
  version: "1.26.51.1",
  invite: "add.aternos.org/mulkymalikuldhr",
} as const;
