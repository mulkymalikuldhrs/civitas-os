// FLYBRAIN KERNEL — types.ts
// Kontrak tipe seluruh sistem FLYBRAIN OS (tanpa server).

export type Tier = "FREE" | "PRO";

export type CollectionName =
  | "identity"
  | "memories"
  | "logs"
  | "decisions"
  | "receipts"
  | "gateway_log"
  | "prt_events"
  | "settings";

export type SourceKind = "ui" | "gateway" | "prt";

/** Amplop data kanonik untuk semua rekaman (04_DATA_SOVEREIGNTY.md §2). */
export interface Envelope<P = Record<string, unknown>> {
  id: string;
  ts: string;
  source: SourceKind;
  version: number;
  tags?: string[];
  payload: P;
}

export interface IdentityPayload {
  username: string;
  keyHash: string; // hash dari kunci FK1_ (password tidak pernah disimpan)
  tier: Tier;
  tierUntil: string | null; // ISO
  createdAt: string;
}

export interface MemoryPayload {
  title: string;
  content: string;
  kind: "episodic" | "semantic" | "working";
}

export interface LogPayload {
  channel: string;
  level: "info" | "warn" | "alert";
  message: string;
}

export interface DecisionPayload {
  context: string;
  choice: string;
  rationale: string;
}

/** Kwitansi kanonik v0 (04_DATA_SOVEREIGNTY.md §4). */
export interface Receipt {
  schema: "flybrain.receipt/v1";
  receipt_id: string;
  issued_at: string;
  period_months: number;
  tier: Tier;
  payer: string;
  amount: { currency: string; value: number };
  channel: "demo" | "manual" | "stripe" | "xendit";
  sig: string;
}

export interface GatewayLogPayload {
  method: string;
  path: string;
  status: number;
  ms: number;
  agent: string;
}

export interface PrtEventPayload {
  task: string;
  note: string;
  severity: "info" | "ok" | "warn" | "alert";
}

export interface Session {
  username: string;
  key: string; // FK1_...
  keyHash: string;
  createdAt: string;
}

/** Respons router virtual (semantik HTTP tanpa jaringan). */
export interface KernelResponse {
  status: number;
  ok: boolean;
  ms: number;
  json: Record<string, unknown>;
}

export interface VaultStats {
  counts: Record<CollectionName, number>;
  bytes: Record<CollectionName, number>;
  totalBytes: number;
  totalRecords: number;
}

// ---------- Connectome ----------

export interface RegionDef {
  key: string;
  name: string; // nama region nyata
  module: string; // padanan modul platform
  role: string;
  share: number; // proporsi neuron
  hue: number; // warna dasar
}

export interface Neuron {
  id: number;
  catalog: string;
  region: string;
  x: number;
  y: number;
  degree: number;
  synapses: number;
}

export interface Edge {
  a: number;
  b: number;
  w: number;
}

export interface Atlas {
  neurons: Neuron[];
  edges: Edge[];
  regions: RegionDef[];
}
