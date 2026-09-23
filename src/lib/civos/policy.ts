// CIVITAS OS — policy.ts
// Kebijakan & limit hidup DI LUAR LLM (PRD §30): LLM tidak pernah bisa mendefinisikan ulang.
// REASON ≠ AUTHORITY: intelijen boleh mengusulkan, policy + authority + risk + budget yang memutuskan.

import { db } from "@/lib/db";
import { emit, safeParse } from "./events";
import { EVENT_TYPES } from "./types";

export class PolicyViolation extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Kebijakan dasar peradaban (minor unit FLR). */
export const BASE_POLICIES: { key: string; value: unknown; category: string; note: string }[] = [
  { key: "MAX_TRANSACTION", value: 500_000, category: "LIMIT", note: "Batas per transaksi (500,00 FLR) — di luar jangkauan LLM" },
  { key: "MAX_DAILY_SPEND", value: 2_000_000, category: "LIMIT", note: "Batas belanja per org per hari (20.000,00 FLR)" },
  { key: "TAX_RATE_EXTERNAL", value: 0.10, category: "RULE", note: "Pajak revenue eksternal 10% — hanya atas isExternal" },
  { key: "RESERVE_MIN", value: 50_000, category: "LIMIT", note: "Cadangan kas bangsa minimum (500,00 FLR)" },
  { key: "GOV_BUDGET_FLOOR", value: 100_000, category: "RULE", note: "Kas pemerintah minimum — di bawah ini TREASURY mencairkan anggaran (1.000,00 FLR)" },
  { key: "GOV_BUDGET_GRANT", value: 500_000, category: "LIMIT", note: "Besaran pencairan anggaran pemerintah per kali (5.000,00 FLR)" },
  { key: "TICK_DECISION_BUDGET", value: 1, category: "RATE", note: "Maks keputusan LLM per denyut per organ" },
  { key: "MAX_AGENT_BUDGET", value: 100_000, category: "LIMIT", note: "Budget maks per agen per denyut (1.000,00 FLR)" },
  { key: "ALLOWED_ACTIONS", value: ["PRODUCE", "INVOICE_INTERNAL", "PROPOSE_ALLOCATION", "PROPOSE_REGISTRATION", "REQUEST_TAX_REVIEW", "OBSERVE"], category: "ALLOWLIST", note: "Aksi yang boleh dieksekusi runtime" },
  // SLICE 7 — VILLAGER ASCENSION (semua di luar jangkauan LLM)
  { key: "VILLAGER_MAX_TX", value: 250, category: "LIMIT", note: "Batas belanja per transaksi warga (2,50 FLR) — dompet pribadi kecil" },
  { key: "VILLAGER_DAILY_SPEND", value: 1_000, category: "LIMIT", note: "Batas belanja warga per hari (10,00 FLR)" },
  { key: "WAGE_PER_WORK", value: 60, category: "RULE", note: "Upah per denyut kerja warga (0,60 FLR) — ditetapkan pemerintah" },
  { key: "VILLAGE_POPULATION_CAP", value: 24, category: "LIMIT", note: "Populasi desa maksimum (sensus)" },
  { key: "VILLAGE_PULSE_EVERY", value: 2, category: "RATE", note: "Denyut desa setiap N denyut institusi" },
  // SLICE 8 — VILLAGER EMBODIMENT (tubuh warga) + PASAR DESA — semuanya di luar LLM
  { key: "DIRECTIVE_QUEUE_CAP", value: 64, category: "LIMIT", note: "Antrean direktif tubuh maksimum" },
  { key: "DIRECTIVE_TTL_MIN", value: 30, category: "RULE", note: "Direktif QUEUED kedaluwarsa setelah N menit (tubuh tidak menerima perintah basi)" },
  { key: "DIRECTIVE_MAX_PER_JOIN", value: 16, category: "RATE", note: "Maks direktif dieksekusi bot per sesi join dunia" },
  { key: "SPEAK_MAX_LEN", value: 120, category: "LIMIT", note: "Panjang maks ucapan warga (relay chat berlabel)" },
  { key: "DIRECTIVE_MAX_DISTANCE", value: 32, category: "LIMIT", note: "Jarak maks teleport tubuh warga per direktif MOVE (blok)" },
  { key: "MARKET_MAX_OFFERS_PER_ORG", value: 6, category: "LIMIT", note: "Maks listing OPEN per perusahaan di pasar desa" },
  { key: "MARKET_UNIT_PRICE_CAP", value: 250, category: "LIMIT", note: "Harga satuan maks listing pasar desa (2,50 FLR)" },
  // SLICE 9 — GUILD & TOOLFORGE (semua di luar LLM)
  { key: "TOOL_MAX_PER_PULSE", value: 1, category: "RATE", note: "Maks panggilan tool per denyut warga (jaga budget & latensi)" },
  { key: "WEB_SEARCH_MAX_RESULTS", value: 5, category: "LIMIT", note: "Maks hasil web_search per panggilan (internet nyata)" },
  { key: "TOOL_TIMEOUT_MS", value: 20_000, category: "LIMIT", note: "Timeout tool eksternal (ms) — internet nyata bisa mati, dilaporkan jujur" },
  { key: "ARTIFACT_MAX_CHARS", value: 4_000, category: "LIMIT", note: "Panjang maks isi artefak (karakter)" },
  { key: "MINE_YIELD_MAX_UNITS", value: 8, category: "LIMIT", note: "Maks unit hasil tambang per ekspedisi (konservasi stok)" },
  { key: "BUILD_MAX_FOOTPRINT", value: 81, category: "LIMIT", note: "Maks luas lantai blueprint (blok²) — konstruksi tetap wajar" },
  { key: "PATROL_RADIUS_MAX", value: 64, category: "LIMIT", note: "Radius maks patroli garda dari pusat desa (blok)" },
];

export async function seedPolicies(): Promise<void> {
  for (const p of BASE_POLICIES) {
    await db.civPolicy.upsert({
      where: { key: p.key },
      create: { key: p.key, value: JSON.stringify(p.value), category: p.category, note: p.note },
      update: {}, // kebijakan eksisting TIDAK ditimpa — hanya seed awal
    });
  }
}

export async function getPolicy<T = unknown>(key: string): Promise<T | null> {
  const row = await db.civPolicy.findUnique({ where: { key } });
  return row ? (safeParse(row.value).value as T ?? (JSON.parse(row.value) as T)) : null;
}

export async function listPolicies() {
  const rows = await db.civPolicy.findMany({ orderBy: { key: "asc" } });
  return rows.map((r) => ({ key: r.key, category: r.category, note: r.note, value: safeParse(r.value).value ?? JSON.parse(r.value) }));
}

/** Belanja org hari ini (ALLOCATION/EXPENSE/TAX + sisi debit TRADE_INTERNAL). */
export async function dailySpendByOrg(orgId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const accounts = await db.civAccount.findMany({ where: { orgId }, select: { id: true } });
  if (accounts.length === 0) return 0;
  const entries = await db.civEntry.findMany({
    where: {
      accountId: { in: accounts.map((a) => a.id) },
      side: "DEBIT",
      createdAt: { gte: start },
      tx: { txType: { in: ["ALLOCATION", "EXPENSE", "TAX", "TRADE_INTERNAL"] } },
    },
    select: { amount: true },
  });
  return entries.reduce((s, e) => s + e.amount, 0);
}

export interface LimitCheck {
  ok: boolean;
  reason: string;
}

/** Cek limit transaksi baru (panggil SEBELUM posting). */
export async function checkTxLimit(orgId: string | null, amount: number): Promise<LimitCheck> {
  const max = (await getPolicy<number>("MAX_TRANSACTION")) ?? 500_000;
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: "Amount harus integer minor unit positif" };
  if (amount > max) return { ok: false, reason: `MAX_TRANSACTION terlampaui (${amount} > ${max}) — limit di luar LLM` };
  if (orgId) {
    const cap = (await getPolicy<number>("MAX_DAILY_SPEND")) ?? 2_000_000;
    const spent = await dailySpendByOrg(orgId);
    if (spent + amount > cap) return { ok: false, reason: `MAX_DAILY_SPEND terlampaui (${spent}+${amount} > ${cap})` };
  }
  return { ok: true, reason: "lolos" };
}

/** Authority: agen wajib punya grant capability aktif (short-lived, revocable). */
export async function assertCapability(agentId: string | null | undefined, capabilityKey: string): Promise<void> {
  if (!agentId) throw new PolicyViolation("NO_AGENT", `Capability ${capabilityKey} butuh agen pelaku`);
  const grant = await db.civGrant.findUnique({
    where: { agentId_capabilityKey: { agentId, capabilityKey } },
  });
  if (!grant) {
    await emit({ type: EVENT_TYPES.POLICY_VIOLATION, subjectType: "AGENT", subjectId: agentId, payload: { capability: capabilityKey, code: "NO_GRANT" } });
    throw new PolicyViolation("NO_GRANT", `Agen ${agentId} tidak punya grant ${capabilityKey}`);
  }
  if (grant.expiresAt && grant.expiresAt.getTime() < Date.now()) {
    await emit({ type: EVENT_TYPES.POLICY_VIOLATION, subjectType: "AGENT", subjectId: agentId, payload: { capability: capabilityKey, code: "GRANT_EXPIRED" } });
    throw new PolicyViolation("GRANT_EXPIRED", `Grant ${capabilityKey} agen ${agentId} sudah kedaluwarsa`);
  }
  if (grant.budgetCap > 0) {
    const maxAgent = (await getPolicy<number>("MAX_AGENT_BUDGET")) ?? 100_000;
    if (grant.budgetCap > maxAgent) {
      throw new PolicyViolation("GRANT_OVER_BUDGET", `Grant ${grant.budgetCap} melebihi MAX_AGENT_BUDGET ${maxAgent}`);
    }
  }
}

/** Registry capability dasar. */
export const BASE_CAPABILITIES = [
  { key: "ledger.post", risk: "MEDIUM", requiresApproval: false, note: "Posting mutasi pembukuan (teredu via policy limit)" },
  { key: "company.register", risk: "HIGH", requiresApproval: true, note: "Registrasi perusahaan — lewat institusi REGULATORY" },
  { key: "treasury.allocate", risk: "CRITICAL", requiresApproval: true, note: "Alokasi modal dari kas bangsa — lewat TREASURY" },
  { key: "memory.write", risk: "LOW", requiresApproval: false, note: "Tulis memori scoped milik sendiri" },
  { key: "minecraft.read", risk: "LOW", requiresApproval: false, note: "Baca status dunia Minecraft (ping)" },
  { key: "tax.assess", risk: "HIGH", requiresApproval: true, note: "Pungut pajak — hanya REGULATORY/TAX atas revenue eksternal" },
  // SLICE 9 — TOOLFORGE (warga memakai charter divisi; grant ini untuk AGEN institusi)
  { key: "tool.web_search", risk: "MEDIUM", requiresApproval: false, note: "Pencarian internet NYATA (z-ai web_search) — hasil dilabeli sumber" },
  { key: "tool.page_reader", risk: "MEDIUM", requiresApproval: false, note: "Baca halaman internet nyata (z-ai page_reader)" },
  { key: "tool.code_write", risk: "LOW", requiresApproval: false, note: "Tulis artefak kode (kerja guild CODER)" },
  { key: "tool.spec_write", risk: "LOW", requiresApproval: false, note: "Tulis spesifikasi produk (kerja guild DEV)" },
  { key: "tool.build_plan", risk: "LOW", requiresApproval: false, note: "Rancang blueprint konstruksi + direktif BUILD" },
  { key: "tool.mine_route", risk: "LOW", requiresApproval: false, note: "Rute tambang + hasil ke pasar desa (konservasi stok)" },
  { key: "tool.patrol_report", risk: "LOW", requiresApproval: false, note: "Laporan patroli garda + direktif PATROL" },
  { key: "tool.mcp_call", risk: "MEDIUM", requiresApproval: false, note: "Panggil tool server MCP terdaftar (JSON-RPC nyata, teraudit)" },
];

export async function seedCapabilities(): Promise<void> {
  for (const c of BASE_CAPABILITIES) {
    await db.civCapability.upsert({ where: { key: c.key }, create: c, update: {} });
  }
}

/** Grant capability ke agen (idempoten). */
export async function grant(agentId: string, capabilityKey: string, budgetCap = 0, expiresAt?: Date): Promise<void> {
  await db.civGrant.upsert({
    where: { agentId_capabilityKey: { agentId, capabilityKey } },
    create: { agentId, capabilityKey, budgetCap, expiresAt },
    update: { budgetCap, expiresAt },
  });
}
