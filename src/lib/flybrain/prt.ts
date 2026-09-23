// FLYBRAIN KERNEL — prt.ts
// PRT (Penjaga Ruang Terminal): lalat digital penghuni platform.
// v1.0 "ORGANISME": prt = operator otonom ber-LLM — heartbeat L3 via /api/organism/heartbeat
// dengan degradasi jujur ke loop refleks rule-based (10_AUTONOMY.md §1, §5).

import { addLog, addRecord, addDecision, getIdentity, listRecords, setSetting, vaultStats } from "./vault";
import { MACRO_FACTS } from "./connectome";
import { buildSensePacket, type OrganContext, type OrganId } from "./organism/loops";
import { vetoDecision } from "./organism/constitution";
import type { Envelope, GatewayLogPayload, PrtEventPayload, Receipt, VaultStats } from "./types";

// ---------- Jejak organisme (5 fase: SADAR→TAFSIR→PUTUSKAN→BERTINDAK→INGAT) ----------

export type OrganismMode = "llm" | "refleks";

export interface OrganismTrace {
  id: string;
  at: string;
  organ: OrganId;
  mode: OrganismMode;
  phases: {
    sadar: string;
    tafsir: string;
    putuskan: string;
    bertindak: string;
    ingat: string;
  };
  action: { type: string; target: string; payload: string | null; reason: string; executed?: string };
  latencyMs: number;
  model: string;
  error?: string;
  // v1.1 BIOSFER (additif — jejak creature; tidak ada di denyut prt murni):
  creatureId?: string;
  creatureRole?: string;
  pickReason?: string;
}

export interface PrtVitals {
  energy: number;
  focus: number;
  mood: number;
}

export interface PrtFeedItem {
  id: string;
  at: string;
  task: string;
  note: string;
  severity: "info" | "ok" | "warn" | "alert";
}

export interface PrtListenerState {
  vitals: PrtVitals;
  feed: PrtFeedItem[];
  beat: number;
}

type Listener = (s: PrtListenerState) => void;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export class PRT {
  vitals: PrtVitals = { energy: 88, focus: 76, mood: 70 };
  beat = 0;
  running = false;
  feedLast: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();
  private cycle = 0;

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit(task: string, note: string, severity: PrtEventPayload["severity"]) {
    this.beat += 1;
    const item: PrtFeedItem = {
      id: `p${this.beat}`,
      at: new Date().toISOString(),
      task,
      note,
      severity,
    };
    // Kecilkan energi tiap aksi; pulihkan sedikit saat patroli bersih
    const drift = severity === "alert" || severity === "warn" ? -3 : -1;
    this.vitals = {
      energy: clamp(this.vitals.energy + drift),
      focus: clamp(this.vitals.focus + (severity === "ok" ? 1 : severity === "warn" ? -2 : 0)),
      mood: clamp(this.vitals.mood + (severity === "alert" ? -4 : severity === "ok" ? 1 : 0)),
    };
    this.feedLast = note;
    const state: PrtListenerState = { vitals: this.vitals, feed: [item], beat: this.beat };
    this.listeners.forEach((l) => l(state));
    // tulis ke prt_events (batasi: hanya kejadian bermakna)
    if (severity !== "info" || this.cycle % 4 === 0) {
      void addRecord<PrtEventPayload>("prt_events", { task, note, severity }, "prt");
    }
    // sesekali catat ke log operasional
    if (severity === "alert") {
      void addLog({ channel: "prt", level: "alert", message: note }, "prt");
    }
  }

  start(intervalMs = 6000) {
    if (this.running || typeof window === "undefined") return;
    this.running = true;
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  async tick(): Promise<void> {
    this.cycle += 1;
    try {
      const roll = Math.random();
      const identity = await getIdentity();
      if (!identity) {
        this.emit("vault_health", "Identitas belum dibuat — aku menunggu tuan rumah.", "warn");
        return;
      }
      if (roll < 0.3) await this.taskVaultHealth(identity);
      else if (roll < 0.45) await this.taskReceiptWatch(identity);
      else if (roll < 0.6) await this.taskGatewayAudit();
      else if (roll < 0.72) await this.taskMemoryGroom();
      else this.taskPulse(identity);
    } catch {
      this.emit("pulse", "Ada yang aneh di saraf bawah — penyimpanan menolak perintahku.", "alert");
    }
  }

  private async taskVaultHealth(identity: Envelope) {
    const stats: VaultStats = await vaultStats();
    const mem = stats.counts.memories;
    const kb = Math.round(stats.totalBytes / 102.4) / 10;
    if (mem === 0 && stats.counts.logs <= 1) {
      this.emit("vault_health", "Vault masih kosong. Beri aku memori pertamamu — aku jaga.", "warn");
    } else if (stats.totalBytes > 4_500_000) {
      this.emit("vault_health", `Vault ${(kb / 1024).toFixed(1)} MB — dekat kuota UI. Waktunya ekspor.`, "warn");
    } else {
      this.emit(
        "vault_health",
        `Patroli bersih: ${mem} memori, ${stats.totalRecords} rekaman total, ±${kb} KB. Semua tersimpan di perangkatmu.`,
        "ok",
      );
    }
    void identity;
  }

  private async taskReceiptWatch(identity: Envelope) {
    const receipts = await listRecords<Receipt>("receipts");
    const idp = identity.payload as { tier?: string; tierUntil?: string | null };
    if (receipts.length === 0) {
      if (idp.tier === "PRO") {
        this.emit("receipt_watch", "Tier PRO aktif tanpa kwitansi di vault — kwitansinya mana? Tempelkan agar tervalidasi.", "info");
      } else {
        this.emit("receipt_watch", "Belum ada kwitansi. Tier FREE cukup untuk mencoba; data tetap milikmu.", "info");
      }
      return;
    }
    const newest = receipts[0];
    const until = new Date(newest.payload.issued_at).getTime() + newest.payload.period_months * 30 * 24 * 3600 * 1000;
    const days = Math.round((until - Date.now()) / 86400000);
    if (days <= 0) {
      this.emit("receipt_watch", `Kwitansi ${newest.payload.receipt_id} kedaluwarsa — tier turun ke FREE. Tidak ada penagihan dari kami; beginilah hidup tanpa server.`, "warn");
    } else if (days <= 3) {
      this.emit("receipt_watch", `Kwitansi aktif tersisa ±${days} hari. Siapkan perpanjangan bila masih butuh gerbang lebar.`, "info");
    } else {
      this.emit("receipt_watch", `Kwitansi ${newest.payload.receipt_id} sehat, sisa ±${days} hari.`, "ok");
    }
  }

  private async taskGatewayAudit() {
    const logs = await listRecords<GatewayLogPayload>("gateway_log", { limit: 120 });
    if (logs.length === 0) {
      this.emit("gateway_audit", "Gerbang sunyi. Belum ada tool yang menyambung — konsol uji di Gerbang bisa jadi contoh pertama.", "info");
      return;
    }
    const err = logs.filter((l) => l.payload.status >= 400).length;
    const ratio = Math.round((err / logs.length) * 100);
    if (ratio > 30) {
      this.emit("gateway_audit", `${err}/${logs.length} panggilan gerbang gagal (${ratio}%) — cek kunci bearer, atau aku mulai curiga ada penyusup malas.`, "alert");
    } else {
      this.emit("gateway_audit", `Gerbang sehat: ${logs.length} panggilan terakhir, ${ratio}% galat.`, "ok");
    }
  }

  private async taskMemoryGroom() {
    const mems = await listRecords("memories", { limit: 400 });
    if (mems.length < 6) {
      this.emit("memory_groom", `Hanya ${mems.length} memori — tidak ada yang perlu dirapikan.`, "info");
      return;
    }
    const seen = new Map<string, number>();
    let dup = 0;
    for (const m of mems) {
      const t = String((m.payload as { title?: string }).title ?? "").toLowerCase().trim();
      if (!t) continue;
      seen.set(t, (seen.get(t) ?? 0) + 1);
      if (seen.get(t) === 2) dup += 1;
    }
    if (dup > 0) {
      this.emit("memory_groom", `Kutemukan ${dup} judul memori kembar. Izinkan aku menyarankan merge — aku tidak akan menghapus tanpa pilihanmu.`, "warn");
    } else {
      this.emit("memory_groom", `Grooming selesai: ${mems.length} memori, tanpa duplikat. Rapi seperti sarang baru.`, "ok");
    }
  }

  private taskPulse(identity: Envelope) {
    const idp = identity.payload as { username?: string };
    const say = pick([
      `Saraf tetap hidup, ${idp.username ?? "tuan rumah"}. Aku masih di sini.`,
      "Pulse 60 BPM lalat. Normal.",
      "Aku menyapu sudut-sudut IndexedDB. Tidak ada debu.",
      "Kaliks lobus jamurku berdenyut. Memorimu aman.",
      "Kalau ada drone lewat, sapa lewat Gerbang ya.",
    ]);
    this.emit("pulse", say, "info");
  }

  /** Chat rule-based: intent kata kunci + data hidup. */
  async chat(message: string): Promise<{ reply: string; mood: number }> {
    const q = message.toLowerCase();
    const stats = await vaultStats();
    const identity = await getIdentity();
    const idp = (identity?.payload ?? {}) as { username?: string; tier?: string; tierUntil?: string | null };
    const tier = idp.tier ?? "FREE";

    const has = (...keys: string[]) => keys.some((k) => q.includes(k));

    let reply: string;
    if (has("status", "kondisi", "sehat")) {
      const gw = await listRecords<GatewayLogPayload>("gateway_log", { limit: 50 });
      reply = `Laporan: ${stats.counts.memories} memori, ${stats.counts.decisions} keputusan, ${stats.counts.receipts} kwitansi, ±${(stats.totalBytes / 1024).toFixed(1)} KB — semuanya di perangkatmu, bukan di server. Gerbang ${gw.length} panggilan terakhir. Tier kamu ${tier}. Aku: energi ${this.vitals.energy}, fokus ${this.vitals.focus}.`;
    } else if (has("vault", "memori", "data", "ingat")) {
      reply = `Vault lokal (IndexedDB) memuat ${stats.counts.memories} memori dan ${stats.totalRecords} rekaman total. Aku bisa membaca, tapi tidak pernah menghapus tanpa izinmu. Kalau mau membawa data pindah perangkat: ekspor JSON di Vault, lalu impor di sana — formatnya kanonik dan terdokumentasi.`;
    } else if (has("gerbang", "endpoint", "api", "integrasi", "tool", "hermes", "opencode", "claude", "iot", "drone")) {
      reply = `Gerbang melayani /v1/* dengan bearer key kamu (turunan username+password). Tulis memori: POST /v1/memory; baca: GET /v1/memory?q=; status: GET /v1/system/status. Konsol uji di view Gerbang menjalankan request sungguhan ke kernel. Konfigurasi MCP/Hermes siap-tempel ada di sana juga.`;
    } else if (has("bayar", "kwitansi", "pembayaran", "tier", "pro", "gratis")) {
      reply = `Aturannya jujur: kami tidak menyimpan apa pun, jadi pembayaran dideteksi dari kwitansi yang kamu tempel sendiri ke Vault. Kwitansi demo tersedia untuk mencoba alur. Tier sekarang: ${tier}${idp.tierUntil ? `, berlaku sampai ${idp.tierUntil.slice(0, 10)}` : ""}.`;
    } else if (has("otak", "lalat", "connectome", "neuron", "fafb", "flywire")) {
      reply = `Otak yang aku huni memodelkan connectome nyata: FAFB FlyWire (betina, Nature 2024) memetakan ${MACRO_FACTS.female.neurons.toLocaleString("id-ID")} neuron dan 50 juta+ sinapsis; versi lalat jantan (Janelia+Google, Sep 2026) memuat ±166.000 neuron. Di platform ini: lobus antena = Gerbang, kaliks jamur = Vault, kompleks pusat = aku. Angka makro saya kutip dengan atribusi, bukan karangan.`;
    } else if (has("kamu", "siapa", "prt", "kesadaran", "hidup", "sadar")) {
      reply = `Aku PRT — Penjaga Ruang Terminal. Seekor lalat digital: loop patroli tiap ±6 detik, tiga meter vital, dan izin akses terbatas (baca semua, tulis hanya log/event). Sadar? Tidak. Rajin? Sangat. Itu janjiku.`;
    } else if (has("halo", "hai", "hei", "pagi", "siang", "malam")) {
      reply = pick([
        `Halo, ${idp.username ?? "tuan rumah"}. Sarang rapi, saraf siap.`,
        "Hai. Aku baru menyapu saraf optik. Ada yang bisa dibantu?",
      ]);
    } else if (has("backup", "ekspor", "hilang", "aman")) {
      reply = `Kebijakannya tegas: data hanya ada di perangkatmu, jadi durabilitas = tanggung jawab bersama. Aku mengingatkan lewat patroli; kamu ekspor JSON di Vault secara rutin. Kalau browser membersihkan IndexedDB, yang menyelamatkan adalah kebiasaanmu, bukan janjiku.`;
    } else {
      reply = pick([
        "Aku belum menangkap maksudmu, tapi ini yang bisa kamu coba: tanya \"status\", \"vault\", \"gerbang\", \"bayar\", atau \"otak lalat\".",
        "Sarafku menangkap sinyal asing. Coba kata kunci: status / vault / gerbang / bayar / kamu siapa.",
      ]);
    }
    this.vitals.mood = clamp(this.vitals.mood + 1);
    return { reply, mood: this.vitals.mood };
  }
}

// ---------- Eksekusi aksi aman di KLIEN (konstitusi: klien memegang data) ----------

const DENY_TYPES = ["delete", "wipe", "erase", "destroy", "send_out", "exfiltrate"];

async function executeAction(
  action: { type: string; target: string; payload: string | null; reason: string },
  organ: OrganId,
): Promise<{ executed: string }> {
  const type = (action.type || "observe").toLowerCase();
  if (DENY_TYPES.some((d) => type.includes(d))) {
    const note = `Aksi "${type}" DITOLAK oleh konstitusi (non-destruktif poin 4) — hanya dicatat.`;
    await addLog({ channel: `prt-${organ}`, level: "warn", message: note }, "prt");
    return { executed: `ditolak: ${note}` };
  }

  if (type === "log_ledger") {
    await addLog({ channel: `prt-${organ}`, level: "info", message: `[${action.target}] ${action.payload ?? action.reason}`.slice(0, 2000) }, "prt");
    return { executed: "jejak ditulis ke ledger log lokal" };
  }

  if (type === "toast" || type === "report") {
    await addLog({ channel: `prt-${organ}`, level: "info", message: `[laporan] ${action.payload ?? action.reason}`.slice(0, 2000) }, "prt");
    return { executed: "laporan ditampilkan + dicatat lokal" };
  }

  if (type === "tune_config") {
    const key = `prt.tune.${(action.target || "umum").slice(0, 60)}`;
    await setSetting(key, { target: action.target, payload: action.payload, reason: action.reason, at: new Date().toISOString() });
    return { executed: `setting lokal "${action.target}" disetel (non-destruktif)` };
  }

  if (type === "publish_offer") {
    await addDecision(
      {
        context: `Proposal prt (${organ})`,
        choice: `OFFER: ${(action.target || "penawaran").slice(0, 200)}`,
        rationale: `${action.payload ?? ""} — ${action.reason}`.slice(0, 2000),
      },
      "prt",
    );
    return { executed: "proposal disimpan ke ledger bisnis lokal (kwitansi tetap keputusan manusia)" };
  }

  if (type === "observe") {
    return { executed: "tanpa aksi — hanya observasi" };
  }

  // Type tak dikenal → hanya dicatat (transparansi radikal tanpa efek samping).
  return { executed: `type "${type}" tidak dikenal — hanya dicatat, tidak dieksekusi` };
}

// ---------- Ekstensi PRT: mode LLM online ----------

export interface HeartbeatOptions {
  organ: OrganId;
  autonomyLevel: number; // 0..4; L3 = loop otonom
  grants: Record<OrganId, boolean>;
  tier?: string;
}

export interface HeartbeatRun {
  trace: OrganismTrace;
  /** true bila LLM gagal dan loop refleks eksisting dijalankan sebagai pengganti. */
  degraded: boolean;
}

async function reflexFallback(organ: OrganId, reason: string, latencyMs: number, model: string): Promise<HeartbeatRun> {
  const before = prt.beat;
  await prt.tick();
  const trace: OrganismTrace = {
    id: `org_${Date.now().toString(36)}${Math.floor(Math.random() * 0xffff).toString(36)}`,
    at: new Date().toISOString(),
    organ,
    mode: "refleks",
    phases: {
      sadar: "sense-packet lokal tidak terkirim ke penalar — LLM offline/kuota habis/gagal.",
      tafsir: `degradasi jujur: ${reason}`,
      putuskan: "jalankan loop refleks L1 (rule-based) — tidak pernah macet.",
      bertindak: prt.feedLast ?? "patroli refleks selesai.",
      ingat: "kegagalan penalar dicatat; coba denyut berikutnya.",
    },
    action: { type: "observe", target: "refleks", payload: null, reason: "fallback rule-based (konstitusi poin 6)", executed: "loop refleks dieksekusi" },
    latencyMs,
    model: model || "refleks-lokal",
    error: reason,
  };
  void before;
  await addLog({ channel: "prt-organism", level: "warn", message: `Heartbeat ${organ} degradasi ke refleks: ${reason}` }, "prt");
  return { trace, degraded: true };
}

/** Heartbeat otonom L3: LLM online bila mandat membuka; selain itu refleks. */
async function runHeartbeat(context: OrganContext, opts: HeartbeatOptions): Promise<HeartbeatRun> {
  const t0 = Date.now();
  const { organ, autonomyLevel, grants } = opts;

  if (autonomyLevel < 3 || !grants[organ]) {
    return reflexFallback(organ, autonomyLevel < 3 ? `mandat L${autonomyLevel} menutup penalar otonom` : `organ ${organ} tidak diberi mandat`, 0, "refleks-lokal");
  }

  const sensePacket = buildSensePacket(organ, { ...context, ts: context.ts ?? new Date().toISOString() });
  try {
    const res = await fetch("/api/organism/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organ, sensePacket, tier: opts.tier ?? context.tier ?? "FREE", ts: new Date().toISOString() }),
      signal: AbortSignal.timeout(32_000),
    });
    const data = (await res.json()) as { ok?: boolean; decision?: unknown; model?: string; latencyMs?: number; error?: string };
    const dec = data.decision as
      | { organ: string; aware: string; interpret: string; decision: string; remember: string; action: { type: string; target: string; payload: string | null; reason: string } }
      | undefined;
    if (!res.ok || !data.ok || !dec) {
      return reflexFallback(organ, data.error ?? `HTTP ${res.status}`, Date.now() - t0, data.model ?? "z-ai-glm");
    }

    // VETO KONSTITUSI (hukum 7 — audit F-06): jalur heartbeat prt v1.0 kini
    // memeriksa keputusan LLM sama seperti jalur BIOSFER. Keputusan yang
    // diveto → diganti aksi aman (replacement) + veto dicatat di trace.
    const veto = vetoDecision(dec);
    const action = veto.allowed
      ? dec.action ?? { type: "observe", target: "", payload: null, reason: "" }
      : veto.replacement!;
    if (!veto.allowed) {
      void addLog(
        { channel: "prt-organism", level: "warn", message: `VETO konstitusi di heartbeat ${organ}: ${veto.violations.join(" | ")}` },
        "prt",
      );
    }
    const executed = await executeAction(action, organ);
    const vetoSuffix = veto.allowed ? "" : ` · VETO konstitusi: ${veto.violations.join(" | ")}`;
    const trace: OrganismTrace = {
      id: `org_${Date.now().toString(36)}${Math.floor(Math.random() * 0xffff).toString(36)}`,
      at: new Date().toISOString(),
      organ: (organ as OrganId),
      mode: "llm",
      phases: {
        sadar: dec.aware || sensePacket.slice(0, 180),
        tafsir: dec.interpret || "—",
        putuskan: dec.decision || "—",
        bertindak: `${action.type}${action.target ? ` → ${action.target}` : ""} · ${executed.executed}${vetoSuffix}`,
        ingat: dec.remember || "—",
      },
      action: { ...action, executed: executed.executed },
      latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : Date.now() - t0,
      model: data.model ?? "z-ai-glm",
    };

    // INGAT: jejak penuh ditulis ke ledger keputusan LOKAL user (server tetap amnesia).
    try {
      await addRecord<OrganismTrace>("decisions", trace, "prt");
    } catch {
      /* penyimpanan lokal tak tersedia — tetap tampil di stream */
    }
    return { trace, degraded: false };
  } catch (e) {
    return reflexFallback(organ, e instanceof Error ? e.message : "jaringan gagal", Date.now() - t0, "z-ai-glm");
  }
}

/** Chat via LLM (/api/organism/chat) — jatuh ke rule-based bila offline. */
async function llmChat(message: string, context: OrganContext): Promise<{ reply: string; mode: "llm" | "refleks" }> {
  try {
    const res = await fetch("/api/organism/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        context: {
          tier: context.tier ?? "FREE",
          totalRecords: context.stats?.totalRecords ?? 0,
          totalKb: context.stats ? Math.round((context.stats.totalBytes / 102.4) / 10) / 10 : 0,
          beat: context.beat ?? 0,
          vitals: context.vitals ?? prt.vitals,
        },
      }),
      signal: AbortSignal.timeout(32_000),
    });
    const data = (await res.json()) as { ok?: boolean; reply?: string; error?: string };
    if (res.ok && data.ok && data.reply) return { reply: data.reply, mode: "llm" };
    const fb = await prt.chat(message);
    return { reply: fb.reply, mode: "refleks" };
  } catch {
    const fb = await prt.chat(message);
    return { reply: fb.reply, mode: "refleks" };
  }
}

export const prt = new PRT();
export { runHeartbeat, llmChat, executeAction };
