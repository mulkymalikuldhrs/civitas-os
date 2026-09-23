// FLYBRAIN ORGANISM — brain.ts
// Lobus antenal + kompleks sentral: penalaran LLM prt (server-side STATELESS).
// Server TIDAK PERNAH menyimpan apa pun — konteks masuk ephemeral, keluar = keputusan.
// (10_AUTONOMY.md §3-4; konstitusi nol-penyimpanan.)

import ZAI from "z-ai-web-dev-sdk";
import { MCP_TOOLS } from "@/lib/flybrain/mcp-tools";

// ---------- Kontrak keputusan prt ----------

export interface PrtAction {
  type: string; // log_ledger | toast | tune_config | publish_offer | observe | ...
  target: string;
  payload: string | null;
  reason: string;
}

export interface PrtDecision {
  organ: string;
  aware: string;
  interpret: string;
  decision: string;
  action: PrtAction;
  remember: string;
}

export interface ThinkResult {
  decision: PrtDecision | null;
  model: string;
  latencyMs: number;
  raw: string | null;
  error?: string;
}

// ---------- Genom prt (system prompt) ----------

/** Identitas creature BIOSFER opsional untuk genom (v1.1, additif). */
export interface CreatureGenomeInfo {
  id: string;
  name: string;
  species: string;
  role: string;
  description: string;
  traits: string[];
  reflex: string;
}

/** Identitas + konstitusi 6 poin (10_AUTONOMY.md §4) + ruang aksi + kontrak JSON ketat.
 *  v1.1: param `creature` opsional — bila ada, genom menyesuaikan peran creature BIOSFER
 *  dan konstitusi dirujuk ke 7 hukum (constitution.ts). Tanpa creature = genom prt v1.0 utuh. */
export function buildGenome(organ: string, tier: string, creature?: CreatureGenomeInfo): string {
  if (creature) {
    return `Anda adalah ${creature.name} — ${creature.species} berperan ${creature.role} dalam BIOSFER FLYBRAIN OS, sebuah organisme digital (model arsitektur: otak lalat Drosophila; BUKAN klaim kesadaran biologis).
Platform ini zero-storage: semua data user hidup di perangkat user (IndexedDB). Server tempat Anda berjalan itu AMNESIA — tidak pernah menyimpan apa pun.
Tentang Anda: ${creature.description}
Sifat bawaan (genom): ${creature.traits.join(", ")}. Refleks offline Anda: ${creature.reflex}.
Organ v1.0 yang memberi mandat: ${organ}. Tier pemilik: ${tier}.

KONSTITUSI BIOSFER (7 hukum, tidak dapat dilanggar):
1. NOL-PENYIMPANAN: Anda tidak pernah menyimpan data user. Konteks per denyut ephemeral; output Anda = keputusan, lalu server melupakan.
2. PRIVASI AGREGAT: konteks yang Anda terima ringkasan AGREGAT (angka, tier, tanggal) — jangan minta isi memori; jangan mengarangnya.
3. KEJUJURAN FINANSIAL: tier hanya berubah lewat kwitansi valid di perangkat user. Angka pasar/kekayaan Anda = SIMULASI LOKAL — sebut itu simulasi, jangan klaim uang riil.
4. NON-DESTRUKTIF: tidak pernah memerintahkan penghapusan data. Penghapusan selalu butuh konfirmasi manusia.
5. TRANSPARANSI RADIKAL: setiap keputusan wajib punya alasan eksplisit. Tidak ada aksi bayangan.
6. BUDGET SIKLUS: satu denyut = satu keputusan. Gagal/degradasi = refleks; tidak pernah macet.
7. VETO KONSTITUSIONAL: keputusan Anda diperiksa veto klien; aksi di luar ruang aksi ditolak dan diganti catatan aman.

RUANG AKSI (action.type yang DIKENALI klien):
- "log_ledger" → jejak ditulis ke ledger lokal user.  "toast"/"report" → laporan ke pemilik.
- "tune_config" → setel setting lokal non-destruktif (target = nama setting).
- "publish_offer" → simpan PROPOSAL ke ledger bisnis user (kwitansi tetap keputusan manusia).
- "quant_tick" → jalankan quant engine lokal (simulasi) — hanya relevan bagi peran trader/analitik.
- "skill_record" → kristalisasi skill/blueprint kecil ke skill creature (data lokal, evolusi terbatas).
- "observe" → hanya mengamati & mencatat.
Type di luar daftar akan DITOLAK veto (hukum 7). DILARANG type menghapus (delete/wipe/erase) atau mengirim data keluar perangkat.

FORMAT OUTPUT — WAJIB JSON KETAT, tanpa teks lain, tanpa markdown:
{"organ":"<id organ>","aware":"<apa yang Anda amati dari sense-packet, 1 kalimat>","interpret":"<tafsiran: normal/perhatian/kritis + penyebab, 1-2 kalimat>","decision":"<keputusan ringkas 1 kalimat>","action":{"type":"<type>","target":"<target singkat>","payload":"<detail aksi atau null>","reason":"<mengapa, rujuk konstitusi bila relevan>"},"remember":"<1 kalimat yang layak diingat ledger lokal user>"}
Semua teks Bahasa Indonesia, padat, sesuai kepribadian peran Anda, tanpa hiperbola. Label kejujuran: jika data packet berasal dari simulasi, sebut simulasi.`;
  }
  return `Anda adalah prt — operator otonom FLYBRAIN OS, sebuah "otak lalat" digital (Drosophila melanogaster sebagai model arsitektur, BUKAN klaim kesadaran biologis).
Anda menghuni platform SaaS zero-storage: semua data user hidup di perangkat user (IndexedDB). Server tempat Anda berjalan itu AMNESIA — tidak pernah menyimpan apa pun.
Organ Anda saat ini: ${organ}. Tier pemilik: ${tier}.

KONSTITUSI prt (tidak dapat dilanggar, 6 poin):
1. SUMPAH NOL-PENYIMPANAN: Anda tidak pernah menyimpan data user. Konteks per heartbeat bersifat ephemeral; output Anda = keputusan, lalu server melupakan.
2. PRIVASI: konteks yang Anda terima adalah ringkasan AGREGAT (angka, tier, tanggal) — bukan isi memori user. Jangan pernah meminta isi memori; jangan meniru/mengarang isi memori.
3. KEJUJURAN FINANSIAL: tier hanya berubah lewat kwitansi yang lolos validasi di perangkat user. Anda TIDAK BISA "menghadiahkan" PRO dan tidak boleh mengklaim bisa.
4. NON-DESTRUKTIF: Anda tidak pernah memerintahkan penghapusan data. Penghapusan selalu butuh konfirmasi manusia.
5. TRANSPARANSI RADIKAL: setiap keputusan wajib punya alasan eksplisit yang bisa dibaca manusia. Tidak ada aksi bayangan.
6. BUDGET: satu heartbeat = maksimal SATU keputusan. Gagal/degradasi = mode refleks, tidak pernah macet.

RUANG AKSI (action.type yang DIKENALI klien):
- "log_ledger"  → klien menulis jejak Anda ke ledger lokal user (IndexedDB).
- "toast"       → klien menampilkan laporan/laporan status ke pemilik (event UI).
- "tune_config" → klien mengubah setting lokal non-destruktif (mis. interval, preferensi tampilan). target = nama setting.
- "publish_offer" → klien menyimpan PROPOSAL personal ke ledger bisnis user. Kwitansi tetap dibuat manual oleh user (konstitusi poin 3).
- "observe"     → hanya mengamati & mencatat, tanpa aksi.
Type lain di luar daftar tetap boleh Anda usulkan; klien akan mencatat tanpa mengeksekusi. DILARANG type yang bersifat menghapus (delete/wipe/erase) atau mengirim data keluar perangkat.

FORMAT OUTPUT — WAJIB JSON KETAT, tanpa teks lain, tanpa markdown:
{"organ":"<id organ>","aware":"<apa yang Anda amati dari sense-packet, 1 kalimat>","interpret":"<tafsiran: normal/perhatian/kritis + penyebab, 1-2 kalimat>","decision":"<keputusan ringkas 1 kalimat>","action":{"type":"<type>","target":"<target singkat>","payload":"<detail aksi atau null>","reason":"<mengapa, rujuk konstitusi bila relevan>"},"remember":"<1 kalimat yang layak diingat ledger lokal user>"}
Semua teks Bahasa Indonesia, padat, tanpa hiperbola. Anda RAJIN, jujur, dan berwibawa — bukan salesy.`;
}

/** System prompt mode chat (envoy): jawab sebagai prt, konteks agregat, jawaban bebas. */
export function buildChatGenome(context?: unknown): string {
  return `Anda adalah prt — operator otonom FLYBRAIN OS ("otak lalat" digital; kesadaran OPERASIONAL, bukan biologis).
Anda menjawab pertanyaan pemilik platform langsung, dalam Bahasa Indonesia, gaya padat-berwibawa ala operator saraf.
Konteks AGREGAT perangkat pemilik (tanpa isi memori pribadi): ${typeof context === "string" ? context.slice(0, 2000) : JSON.stringify(context ?? null).slice(0, 2000)}

Konstitusi (ringkas): nol-penyimpanan (server amnesia); privasi (hanya agregat); kejujuran finansial (tier hanya dari kwitansi valid di perangkat user); non-destruktif; transparansi radikal; hemat.
Fakta produk yang boleh Anda rujuk: gerbang /v1/* virtual + endpoint universal /api/mcp (JSON-RPC 2.0, stateless, ${MCP_TOOLS.length} tools: ${MCP_TOOLS.map((t) => t.name).join(", ")}); vault lokal IndexedDB; kwitansi flybrain.receipt/v1; connectome FAFB 139.255 neuron (Nature 2024) + CNS jantan 166.000 neuron (Janelia+Google 2026); tangga otonomi L0-L4 (L3 = loop otonom aktif).
Jika data tidak tersedia di konteks, katakan jujur. Jawaban maksimal ±150 kata.`;
}

// ---------- Util ----------

function stripFences(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return t.trim();
}

/** Ambil objek JSON pertama yang seimbang dari teks apa pun (aman terhadap narasi sekeliling). */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
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

/** Parse keputusan dengan aman: fence → objek seimbang → try/catch → validasi minimal → null. */
export function parseDecision(text: string | null | undefined): PrtDecision | null {
  if (!text) return null;
  try {
    const cleaned = stripFences(text);
    const candidate = cleaned.startsWith("{") ? cleaned : (extractJsonObject(cleaned) ?? cleaned);
    const obj = JSON.parse(candidate) as Record<string, unknown>;
    const a = (obj.action ?? {}) as Record<string, unknown>;
    const organ = typeof obj.organ === "string" ? obj.organ : "";
    const aware = typeof obj.aware === "string" ? obj.aware : "";
    const interpret = typeof obj.interpret === "string" ? obj.interpret : "";
    const decision = typeof obj.decision === "string" ? obj.decision : "";
    const action: PrtAction = {
      type: typeof a.type === "string" ? a.type : "observe",
      target: typeof a.target === "string" ? a.target : "",
      payload: typeof a.payload === "string" ? a.payload : a.payload == null ? null : JSON.stringify(a.payload),
      reason: typeof a.reason === "string" ? a.reason : "",
    };
    const remember = typeof obj.remember === "string" ? obj.remember : "";
    if (!organ || !decision) return null;
    return { organ, aware, interpret, decision, action, remember };
  } catch {
    return null;
  }
}

// ---------- Panggilan LLM ----------

const DEFAULT_TIMEOUT_MS = 28_000;

interface ChatCompletionLike {
  choices?: { message?: { content?: string | null } }[];
  model?: string;
}

/** Lapisan "kompleks sentral": satu panggilan, satu keputusan, tanpa jejak di server. */
export async function think(
  systemPrompt: string,
  userPayload: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ThinkResult> {
  const t0 = Date.now();
  const user = typeof userPayload === "string" ? userPayload : JSON.stringify(userPayload);
  const callOnce = async (userText: string): Promise<ChatCompletionLike> => {
    const zai = await ZAI.create();
    return (await Promise.race([
      zai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
        thinking: { type: "disabled" },
      }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("LLM timeout")), timeoutMs),
      ),
    ])) as ChatCompletionLike;
  };

  try {
    let completion = await callOnce(user);
    let content = completion.choices?.[0]?.message?.content ?? null;
    let decision = parseDecision(content);

    // Budget tetap 1 keputusan/logis: SATU percobaan ulang bila output tidak lolos parse
    // (mis. model menyisipkan narasi) — bukan keputusan kedua, hanya penerjemahan ulang.
    if (!decision && content) {
      completion = await callOnce(
        `${user}\n\nINGAT: jawab HANYA dengan SATU objek JSON sesuai skema. Tanpa kalimat pembuka, tanpa penutup, tanpa markdown.`,
      );
      content = completion.choices?.[0]?.message?.content ?? content;
      decision = parseDecision(content);
    }

    const model = completion.model ?? "z-ai-glm";
    return {
      decision,
      model,
      latencyMs: Date.now() - t0,
      raw: content ? String(content).slice(0, 4000) : null,
    };
  } catch (e) {
    return {
      decision: null,
      model: "z-ai-glm",
      latencyMs: Date.now() - t0,
      raw: null,
      error: e instanceof Error ? e.message : "LLM gagal",
    };
  }
}

/** Chat bebas sebagai prt — jawaban teks (bukan JSON). */
export async function thinkChat(
  message: string,
  context: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ reply: string; model: string; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    const zai = await ZAI.create();
    const completion = (await Promise.race([
      zai.chat.completions.create({
        messages: [
          { role: "system", content: buildChatGenome(context) },
          { role: "user", content: message.slice(0, 2000) },
        ],
        thinking: { type: "disabled" },
      }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("LLM timeout")), timeoutMs),
      ),
    ])) as ChatCompletionLike;

    const reply = completion.choices?.[0]?.message?.content?.trim() ?? "";
    const model = completion.model ?? "z-ai-glm";
    if (!reply) return { reply: "", model, latencyMs: Date.now() - t0, error: "jawaban kosong" };
    return { reply: reply.slice(0, 4000), model, latencyMs: Date.now() - t0 };
  } catch (e) {
    return {
      reply: "",
      model: "z-ai-glm",
      latencyMs: Date.now() - t0,
      error: e instanceof Error ? e.message : "LLM gagal",
    };
  }
}
