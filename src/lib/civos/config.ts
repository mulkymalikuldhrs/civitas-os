// CIVITAS OS — config.ts (SLICE 10)
// Konfigurasi runtime yang bisa diubah lewat UI TANPA restart (mandat #6).
// Sumber: DB (CivKV prefix config.*) → fallback env → fallback default.
// Nilai bertipe SECRET dimasking saat dibaca dari API; hanya di-overwrite, tak pernah dikirim balik.

import { db } from "@/lib/db";
import { MC_SERVER_INFO } from "./types";

export const CONFIG_PREFIX = "config.";

export type ConfigKind = "STRING" | "NUMBER" | "BOOLEAN" | "SECRET";

export interface ConfigField {
  key: string;
  label: string;
  kind: ConfigKind;
  group: "minecraft" | "chat" | "llm" | "cloud" | "settlement" | "quant" | "bot";
  default?: string;
  env?: string;
  note?: string;
}

/** Registry field konfigurasi — deterministik, di luar LLM. */
export const CONFIG_FIELDS: ConfigField[] = [
  // MINECRAFT — server lokal & online (mandat #5: lokal maupun online)
  { key: "mc.host", label: "Host server Minecraft", kind: "STRING", group: "minecraft", default: "127.0.0.1", note: "Server lokal (PMMP) = 127.0.0.1; server online = mulkymalikuldhr.aternos.me" },
  { key: "mc.port", label: "Port RakNet", kind: "NUMBER", group: "minecraft", default: "19132" },
  { key: "mc.autoJoin", label: "Bot auto-join saat server online", kind: "BOOLEAN", group: "minecraft", default: "true" },
  { key: "mc.autoSummon", label: "Panggil villager desa otomatis (butuh plugin CivitasBridge)", kind: "BOOLEAN", group: "minecraft", default: "true" },
  { key: "mc.summonCount", label: "Jumlah villager disummon", kind: "NUMBER", group: "minecraft", default: "8" },
  { key: "mc.localConsolePath", label: "Path FIFO konsol server lokal", kind: "STRING", group: "minecraft", default: "/home/z/my-project/mc-server/pmmp/console.in", note: "Kosong = jalur konsol mati (server remote)" },
  { key: "mc.localLogPath", label: "Path log server lokal", kind: "STRING", group: "minecraft", default: "/home/z/my-project/mc-server/pmmp/server.log" },
  { key: "mc.remoteHost", label: "Host server online (Bedrock)", kind: "STRING", group: "minecraft", default: "mulkymalikuldhr.aternos.me", note: "dipakai registry server 'aternos'" },
  // SLICE 11 — SELF-LIFE (multi-server, backup, sync)
  { key: "backup.keep", label: "Retensi backup (arsip disimpan)", kind: "NUMBER", group: "settlement", default: "7" },
  { key: "backup.intervalHours", label: "Jadwal backup (jam)", kind: "NUMBER", group: "settlement", default: "6" },
  { key: "sync.intervalMinutes", label: "Jadwal self-sync git (menit)", kind: "NUMBER", group: "settlement", default: "30", note: "push ke 4 remote bila ada perubahan" },
  // CHAT — interaksi langsung dengan warga (mandat #1)
  { key: "chat.autoReply", label: "Warga membalas chat dunia otomatis", kind: "BOOLEAN", group: "chat", default: "true" },
  { key: "chat.relayToDashboard", label: "Chat dunia tercatat di dashboard", kind: "BOOLEAN", group: "chat", default: "true" },
  { key: "chat.maxLen", label: "Panjang maks pesan", kind: "NUMBER", group: "chat", default: "220" },
  // LLM — custom provider via UI (mandat organisme: base URL + API key + model)
  { key: "llm.model", label: "Model otak warga & institusi", kind: "STRING", group: "llm", default: "glm-4-plus", note: "glm-4-plus | glm-4-flash | reflex" },
  { key: "llm.baseUrl", label: "Base URL LLM (OpenAI-compatible)", kind: "STRING", group: "llm", default: "", note: "Kosong = mode HEURISTIC gratis (tanpa jaringan). Contoh: https://api.openai.com/v1 atau endpoint kompatibel lain" },
  { key: "llm.apiKey", label: "API key LLM", kind: "SECRET", group: "llm", note: "Tidak pernah tampil kembali; dikirim sebagai Bearer token" },
  { key: "llm.enabled", label: "Aktifkan LLM remote (bila baseUrl+key terisi)", kind: "BOOLEAN", group: "llm", default: "false", note: "Free-first: organisme hidup tanpa ini" },
  // CLOUD — Supabase mirror (mandat #9)
  { key: "supabase.url", label: "Supabase URL", kind: "SECRET", group: "cloud", env: "SUPABASE_URL", note: "https://<ref>.supabase.co" },
  { key: "supabase.serviceKey", label: "Supabase service key", kind: "SECRET", group: "cloud", env: "SUPABASE_SERVICE_KEY", note: "Tidak pernah tampil kembali; hanya overwrite" },
  // SETTLEMENT — rail pembayaran eksternal
  { key: "settlement.live", label: "Izinkan settlement LIVE (bukan sandbox)", kind: "BOOLEAN", group: "settlement", default: "false", note: "Butuh customer nyata; ubah hanya bila rail riil tersambung" },
  // QUANT — sumber harga pasar nyata (anti-simulasi, mandat #11)
  { key: "quant.priceUrl", label: "URL harga pasar nyata", kind: "STRING", group: "quant", default: "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", note: "API publik tanpa key; quant memutuskan pada harga NYATA" },
  // MCP — integrasi tool eksternal
  { key: "mcp.enabled", label: "Aktifkan tool MCP", kind: "BOOLEAN", group: "bot", default: "true" },
];

export interface ResolvedConfig {
  [key: string]: string | boolean | number;
}

function parseByKind(field: ConfigField, raw: string): string | boolean | number {
  if (field.kind === "BOOLEAN") return raw === "true" || raw === "1";
  if (field.kind === "NUMBER") return Number(raw) || 0;
  return raw;
}

/** Baca satu nilai ter-resolve (DB → env → default). Return string mentah untuk SECRET. */
export async function getConfigValue(key: string): Promise<string> {
  const field = CONFIG_FIELDS.find((f) => f.key === key);
  const row = await db.civKV.findUnique({ where: { key: CONFIG_PREFIX + key } });
  if (row) return row.value;
  if (field?.env && process.env[field.env]) return process.env[field.env] as string;
  return field?.default ?? "";
}

/** Semua nilai ter-resolve (untuk kernel — nilai utuh, HANYA server-side). */
export async function resolveConfig(): Promise<ResolvedConfig> {
  const out: ResolvedConfig = {};
  for (const f of CONFIG_FIELDS) {
    out[f.key] = parseByKind(f, await getConfigValue(f.key));
  }
  return out;
}

export interface ConfigView {
  fields: { key: string; label: string; kind: ConfigKind; group: string; note?: string; value: string | boolean | number; set: boolean; masked: boolean }[];
}

/** Tampilan config untuk UI: SECRET dimasking, status set/bawaan jujur. */
export async function configView(): Promise<ConfigView> {
  const fields: ConfigView["fields"] = [];
  for (const f of CONFIG_FIELDS) {
    const row = await db.civKV.findUnique({ where: { key: CONFIG_PREFIX + f.key } });
    const envVal = f.env ? process.env[f.env] : undefined;
  const fromEnv = !row && Boolean(envVal);
    const raw = row ? row.value : fromEnv ? (envVal as string) : (f.default ?? "");
    fields.push({
      key: f.key,
      label: f.label,
      kind: f.kind,
      group: f.group,
      note: f.note,
      value: f.kind === "SECRET" && raw ? "••••••••••••" : parseByKind(f, raw),
      set: Boolean(row) || fromEnv,
      masked: f.kind === "SECRET" && Boolean(raw),
    });
  }
  return { fields };
}

/** Tulis nilai (overwrite). Return error bila field tak dikenal. */
export async function setConfigValue(key: string, value: string): Promise<{ ok: boolean; error?: string }> {
  const field = CONFIG_FIELDS.find((f) => f.key === key);
  if (!field) return { ok: false, error: `field tidak dikenal: ${key}` };
  if (field.kind === "NUMBER" && !/^-?\d+$/.test(value)) return { ok: false, error: "harus angka bulat" };
  if (field.kind === "BOOLEAN" && !["true", "false"].includes(value)) return { ok: false, error: "harus true/false" };
  await db.civKV.upsert({
    where: { key: CONFIG_PREFIX + key },
    create: { key: CONFIG_PREFIX + key, value },
    update: { value },
  });
  return { ok: true };
}

/** Info server MC efektif (config > konst PRD). */
export async function mcTarget(): Promise<{ host: string; port: number; invite: string; version: string; edition: string }> {
  const host = (await getConfigValue("mc.host")) || "127.0.0.1";
  const port = Number((await getConfigValue("mc.port")) || "19132");
  const isRemote = host.includes("aternos.me");
  return {
    host,
    port,
    invite: isRemote ? MC_SERVER_INFO.invite : "-",
    version: isRemote ? MC_SERVER_INFO.version : "1.26.30",
    edition: "Bedrock",
  };
}
