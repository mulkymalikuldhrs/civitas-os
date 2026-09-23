// CIVITAS OS — router.ts
// LLM ROUTER (PRD §8–11): SEMUA panggilan LLM peradaban lewat sini.
// - Model = infrastruktur yang dapat diganti; identitas agen tidak pernah = model.
// - Klasifikasi tugas → pilih model dari registry → validasi JSON ketat → fallback REFLEX deterministik.
// - Metadata rute tersimpan (observability §10) — tanpa secret, tanpa prompt mentah penuh.

import ZAI from "z-ai-web-dev-sdk";
import type { CivDecision, RouteMeta, ActionType } from "./types";
import { ACTION_TYPES } from "./types";

// ---------- Model Registry (provider-agnostic by design) ----------

export interface ModelEntry {
  id: string;
  label: string;
  provider: "zai";
  tier: "fast" | "reasoning";
  strength: string[];
  estCostPer1k: number; // estimasi relatif (unit bebas, untuk metrik)
}

export const MODEL_REGISTRY: ModelEntry[] = [
  { id: "glm-4-flash", label: "GLM Flash", provider: "zai", tier: "fast", strength: ["klasifikasi", "produksi-ringan", "latensi-rendah"], estCostPer1k: 1 },
  { id: "glm-4-plus", label: "GLM Plus", provider: "zai", tier: "reasoning", strength: ["keputusan", "analisis", "perencanaan"], estCostPer1k: 5 },
];

export interface TaskSpec {
  type: string; // CYCLE|PRODUCTION|ANALYSIS|DECISION
  complexity: "low" | "medium" | "high";
  sensitivity: "public" | "internal" | "restricted";
  budgetTokens: number;
}

/** Klasifikasi + pemilihan model (aturan transparan, bisa diaudit). */
export function selectModel(spec: TaskSpec): { model: ModelEntry; reason: string } {
  const high =
    spec.type === "DECISION" ||
    spec.type === "ANALYSIS" ||
    spec.complexity === "high" ||
    spec.sensitivity === "restricted";
  const model = high ? MODEL_REGISTRY[1] : MODEL_REGISTRY[0];
  return {
    model,
    reason: high
      ? `tugas ${spec.type}/kompleksitas ${spec.complexity}/sensitivitas ${spec.sensitivity} → tier reasoning`
      : `tugas ${spec.type} sederhana → tier fast (hemat budget)`,
  };
}

// ---------- Eksekusi ----------

function stripFences(t: string): string {
  return t.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Parse CivDecision dari output model — ketat, gagal = null.
 *  allowActions: whitelist aksi pemanggil (institusi = ACTION_TYPES; villager = VILLAGER_ACTIONS).
 *  Whitelist institusi TIDAK berubah — aksi villager tak bisa dipakai organ, begitu pula sebaliknya. */
export function parseCivDecision(text: string | null | undefined, allowActions: readonly string[] = ACTION_TYPES): CivDecision | null {
  if (!text) return null;
  try {
    const raw = stripFences(text);
    const candidate = raw.startsWith("{") ? raw : (extractJsonObject(raw) ?? raw);
    const obj = JSON.parse(candidate) as Record<string, unknown>;
    const a = (obj.action ?? {}) as Record<string, unknown>;
    const type = typeof a.type === "string" ? (a.type as string) : "OBSERVE";
    if (!allowActions.includes(type)) return null;
    const aware = typeof obj.aware === "string" ? obj.aware : "";
    const decision = typeof obj.decision === "string" ? obj.decision : "";
    if (!decision) return null;
    return {
      aware,
      interpret: typeof obj.interpret === "string" ? obj.interpret : "",
      decision,
      action: {
        type: type as ActionType,
        target: typeof a.target === "string" ? a.target : "",
        payload: typeof a.payload === "string" ? a.payload : a.payload == null ? null : JSON.stringify(a.payload),
        reason: typeof a.reason === "string" ? a.reason : "",
      },
      remember: typeof obj.remember === "string" ? obj.remember : "",
    };
  } catch {
    return null;
  }
}

const TIMEOUT_MS = 26_000;

interface CompletionLike {
  choices?: { message?: { content?: string | null } }[];
  model?: string;
}

async function callModel(modelId: string | undefined, system: string, user: string, timeoutMs: number): Promise<CompletionLike> {
  const zai = await ZAI.create();
  return (await Promise.race([
    zai.chat.completions.create({
      ...(modelId ? { model: modelId } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      thinking: { type: "disabled" },
    }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("LLM timeout")), timeoutMs)),
  ])) as CompletionLike;
}

/** Chat bebas untuk otak warga (SLICE 10) — teks biasa, bukan JSON keputusan. */
export async function chatLLM(prompt: string): Promise<{ text: string; model: string; mode: "LLM" | "REFLEX"; latencyMs: number }> {
  const { model, reason } = selectModel({ type: "SOCIAL", complexity: "low", sensitivity: "internal", budgetTokens: 400 });
  void reason;
  const t0 = Date.now();
  try {
    const completion = await callModel(model.id, "Kamu warga desa Minecraft yang otonom. Jawaban Bahasa Indonesia santai, padat, jujur.", prompt, TIMEOUT_MS);
    const text = String(completion.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error("jawaban kosong");
    return { text: text.slice(0, 400), model: model.id, mode: "LLM", latencyMs: Date.now() - t0 };
  } catch {
    return { text: "(mengangguk pelan) Baik, kutanggapi.", model: "reflex", mode: "REFLEX", latencyMs: Date.now() - t0 };
  }
}

export interface DecideArgs {
  agentCode: string;
  agentRole: string;
  orgCode: string;
  orgKind: string;
  spec: TaskSpec;
  /** Konteks sense-packet AGREGAT (angka/status, bukan isi memori privat). */
  sense: Record<string, unknown>;
  /** Prompt kepribadian peran (genom agen). */
  genome: string;
  /** Fallback deterministik wajib — peradaban tidak boleh macet. */
  reflex: () => CivDecision;
  /** Whitelist aksi pemanggil (default: institusi). Villager mengirim VILLAGER_ACTIONS. */
  allowActions?: readonly string[];
}

/** Satu keputusan per panggilan. Gagal LLM → REFLEX berlabel. Tidak pernah melempar error. */
export async function decide(args: DecideArgs): Promise<{ decision: CivDecision; meta: RouteMeta; taskIdToken: number }> {
  const { model, reason } = selectModel(args.spec);
  const allow = args.allowActions ?? ACTION_TYPES;
  const t0 = Date.now();
  const system = `${args.genome}

FORMAT OUTPUT — WAJIB JSON KETAT, tanpa teks lain, tanpa markdown:
{"aware":"<amati dari sense-packet, 1 kalimat>","interpret":"<tafsiran + penyebab, 1-2 kalimat>","decision":"<keputusan ringkas>","action":{"type":"<satu dari: ${allow.join("|")}>","target":"<kode sasaran>","payload":"<detail atau null>","reason":"<alasan eksplisit>"},"remember":"<1 kalimat layak diingat>"}
Aksi di luar daftar akan DITOLAK policy. Intelijen Anda MENGUSULKAN; eksekusi ditentukan Policy+Authority+Risk+Budget. Semua teks Bahasa Indonesia, padat, tanpa hiperbola, jujur (label simulasi bila simulasi).`;

  try {
    let completion = await callModel(model.id, system, JSON.stringify(args.sense).slice(0, 6000), TIMEOUT_MS);
    let content = completion.choices?.[0]?.message?.content ?? null;
    let decision = parseCivDecision(content, allow);
    if (!decision && content) {
      // SATU percobaan penerjemahan ulang (bukan keputusan kedua — budget tetap 1)
      completion = await callModel(model.id, system, `${JSON.stringify(args.sense).slice(0, 6000)}\n\nINGAT: jawab HANYA SATU objek JSON sesuai skema.`, TIMEOUT_MS);
      content = completion.choices?.[0]?.message?.content ?? content;
      decision = parseCivDecision(content, allow);
    }
    if (!decision) throw new Error("output tidak lolos validasi skema");
    return {
      decision,
      taskIdToken: 0,
      meta: {
        provider: model.provider,
        model: completion.model ?? model.id,
        mode: "LLM",
        reason,
        latencyMs: Date.now() - t0,
        tokens: Math.ceil((JSON.stringify(args.sense).length + (content?.length ?? 0)) / 4),
      },
    };
  } catch (eLLM) {
    // FALLBACK REFLEX — deterministik, berlabel jujur
    let reflexModelNote = "";
    try {
      // Model fast dicoba sekali bila reasoning gagal mahal/timeout? Tidak: hemat budget, langsung reflex.
      reflexModelNote = eLLM instanceof Error ? eLLM.message.slice(0, 120) : "LLM gagal";
    } catch { /* noop */ }
    const reflex = args.reflex();
    return {
      decision: reflex,
      taskIdToken: 0,
      meta: {
        provider: "kernel",
        model: "reflex-v1",
        mode: "REFLEX",
        reason: `fallback deterministik: ${reflexModelNote || "policy hemat"}`,
        latencyMs: Date.now() - t0,
        tokens: 0,
        fallback: model.id,
      },
    };
  }
}
