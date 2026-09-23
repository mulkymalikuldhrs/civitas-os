// FLYBRAIN KERNEL — store.ts
// Zustand store: jembatan kernel ↔ React (satu sumber state UI).

"use client";

import { create } from "zustand";
import { clearSession, deriveKey, getSession, hashKey, setSession } from "./auth";
import { prt, runHeartbeat, llmChat, type OrganismTrace, type PrtVitals, type PrtFeedItem } from "./prt";
import { handleKorteks } from "./router";
import { ORGAN_IDS, type OrganContext, type OrganId } from "./organism/loops";
import { eventBus, type BiosferEvent } from "./organism/eventBus";
import { initialCreatures, type CreatureState, type CreatureStatus } from "./organism/creature";
import { initialWorld, isWorldState } from "./ecosystem/world";
import type { WorldState } from "./ecosystem/types";
import { roleOrgan } from "./organism/creatures";
import { rememberEpisode } from "./organism/organs/memory";
import { immune } from "./organism/organs/immune";
import type { ReflectReport } from "./organism/selfReflect";
import type { PulseApply } from "./organism/engine";
import type { QuantTickResult, QuantScore, QuantRisk, PortfolioAllocation, RiskGateState } from "./organism/quant";
import {
  addDecision,
  addLog,
  addMemory,
  exportVault,
  getIdentity,
  getSetting,
  importVault,
  listRecords,
  putIdentity,
  removeRecord,
  vaultStats,
  saveReceipt,
  setSetting,
  wipeVault,
} from "./vault";
import { demoReceipt } from "./payment";
import type { DecisionPayload, Envelope, GatewayLogPayload, KernelResponse, LogPayload, MemoryPayload, Receipt, Session, Tier, VaultStats } from "./types";

export type ViewKey = "civitas" | "kendali" | "otak" | "prt" | "vault" | "gerbang" | "dokumen" | "ruang" | "biosfer" | "planet" | "peradaban" | "minecraft";

export interface ChatMsg { role: "user" | "prt"; text: string; at: string; mode?: "llm" | "refleks" }

/** Titik riwayat denyut (bar sparkline di Ruang Kendali). */
export interface PulsePoint { at: string; organ: OrganId; ok: boolean; mode: "llm" | "refleks"; latencyMs: number }

/** Snapshot quant tick terakhir (v1.1) — hasil murni simulasi lokal. */
export interface QuantSnapshot {
  at: string;
  allocations: PortfolioAllocation[];
  gates: RiskGateState[];
  recommendations: string[];
  scores: Record<string, QuantScore>;
  risks: Record<string, QuantRisk>;
}

export const AUTONOMY_LEVELS: { level: number; code: string; name: string; desc: string }[] = [
  { level: 0, code: "L0", name: "Manual", desc: "UI saja — prt tidur." },
  { level: 1, code: "L1", name: "Refleks", desc: "Patroli aturan tetap; tidak menalar." },
  { level: 2, code: "L2", name: "Koordinasi", desc: "prt menalar via LLM saat ditanya (chat)." },
  { level: 3, code: "L3", name: "Loop Otonom", desc: "4 loop bisnis berjalan berkala dengan penalaran LLM." },
  { level: 4, code: "L4", name: "Organisme", desc: "L3 + aksi eksternal penuh (Fase berikut — scope-grant)." },
];

// Kursor round-robin organ (di luar state agar re-render tak menggeser giliran).
let organCursor = 0;

// v1.2 PLANET: debounce persist dunia ke settings vault lokal "organism.world"
// (pola persistCreatures — server tetap amnesia, posisi dunia hidup di klien).
let worldPersistTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleWorldPersist(world: WorldState): void {
  if (worldPersistTimer !== null) clearTimeout(worldPersistTimer);
  worldPersistTimer = setTimeout(() => {
    worldPersistTimer = null;
    void setSetting("organism.world", world);
  }, 1500);
}

// Guard modul (audit F-14): langganan eventBus/PRT hanya dipasang SEKALI meski
// init() dipanggil ulang (remount); init mengembalikan fungsi cleanup yang
// melepas langganan agar siklus mount→unmount→mount tidak dobel-subscribe.
let listenersBound = false;
let unbindListeners: (() => void) | null = null;

export interface FlybrainState {
  ready: boolean;
  view: ViewKey;
  session: Session | null;
  tier: Tier;
  tierUntil: string | null;
  stats: VaultStats | null;
  vitals: PrtVitals;
  prtFeed: PrtFeedItem[];
  prtBeat: number;
  ticker: string;
  chat: ChatMsg[];
  lastKernel: KernelResponse | null;
  receipts: Envelope<Receipt>[];
  memories: Envelope<MemoryPayload>[];
  logs: Envelope<LogPayload>[];
  decisions: Envelope<DecisionPayload>[];
  swActive: boolean;
  // --- v1.0 ORGANISME ---
  autonomyLevel: number; // 0..4 (default L3)
  organGrants: Record<OrganId, boolean>; // mandat per organ
  decisionStream: OrganismTrace[]; // jejak keputusan terbaru (maks 50)
  pulseLog: PulsePoint[]; // riwayat denyut untuk sparkline (maks 40)
  pending: boolean; // heartbeat sedang menalar
  lastPulseAt: string | null;
  // --- v1.1 BIOSFER ---
  creatures: CreatureState[]; // 6 creature (persist settings "organism.creatures")
  eventLog: BiosferEvent[]; // mirror bus kejadian (maks 200)
  reflectVerdict: ReflectReport | null; // hasil self-reflect terakhir
  lastQuant: QuantSnapshot | null; // snapshot quant terakhir (simulasi)
  biosferBusy: boolean; // denyut creature sedang jalan
  // --- v1.2 PLANET ---
  world: WorldState | null; // state dunia hidup (persist "organism.world")
  lastWorldTickAt: string | null; // denyut dunia terakhir
  // actions
  init: () => Promise<() => void>;
  setView: (v: ViewKey) => void;
  setAutonomyLevel: (level: number) => void;
  toggleOrgan: (organ: OrganId) => void;
  triggerHeartbeat: (organ?: OrganId) => Promise<void>;
  // v1.1 BIOSFER
  tickCreature: (creatureId?: string) => Promise<void>;
  applyDecision: (apply: PulseApply) => Promise<void>;
  setCreatureStatus: (creatureId: string, status: CreatureStatus) => Promise<void>;
  recordQuant: (tick: QuantTickResult) => void;
  setReflectVerdict: (r: ReflectReport) => void;
  // v1.2 PLANET
  recordWorldTick: (next: WorldState) => void;
  createIdentity: (username: string, password: string) => Promise<string>;
  logout: () => void;
  refresh: () => Promise<void>;
  addMemoryUI: (title: string, content: string, kind: MemoryPayload["kind"], tags: string[]) => Promise<void>;
  removeMemoryUI: (id: string) => Promise<void>;
  addLogUI: (message: string, level: "info" | "warn" | "alert") => Promise<void>;
  addDecisionUI: (context: string, choice: string, rationale: string) => Promise<void>;
  pasteReceipt: (raw: string) => Promise<{ ok: boolean; message: string }>;
  saveDemoReceipt: () => Promise<{ ok: boolean; message: string }>;
  verifyReceipts: () => Promise<{ ok: boolean; message: string }>;
  wipe: () => Promise<void>;
  doExport: () => Promise<void>;
  doImport: (file: File) => Promise<{ ok: boolean; message: string }>;
  runKernel: (method: string, path: string, body: string) => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  enableSW: () => Promise<boolean>;
}

export const useFlybrain = create<FlybrainState>((set, get) => ({
  ready: false,
  view: "civitas",
  session: null,
  tier: "FREE",
  tierUntil: null,
  stats: null,
  vitals: prt.vitals,
  prtFeed: [],
  prtBeat: 0,
  ticker: "SPESIMEN 001 — Drosophila melanogaster — sistem saraf digital berjalan tanpa server. Selamat datang di sarang.",
  chat: [],
  lastKernel: null,
  receipts: [],
  memories: [],
  logs: [],
  decisions: [],
  swActive: false,
  autonomyLevel: 3,
  organGrants: { guardian: true, merchant: true, envoy: true, scout: true },
  decisionStream: [],
  pulseLog: [],
  pending: false,
  lastPulseAt: null,
  creatures: [],
  eventLog: [],
  reflectVerdict: null,
  lastQuant: null,
  biosferBusy: false,
  world: null,
  lastWorldTickAt: null,

  init: async () => {
    try {
      const session = getSession();
      if (session) set({ session });
      const idEnv = await getIdentity();
      const idp = (idEnv?.payload ?? {}) as { tier?: Tier; tierUntil?: string | null };
      set({
        tier: idp.tier === "PRO" && idp.tierUntil && new Date(idp.tierUntil).getTime() > Date.now() ? "PRO" : "FREE",
        tierUntil: idp.tierUntil ?? null,
      });
      await get().refresh();
      // Muat mandat organisme yang disimpan lokal (settings store).
      const mandate = await getSetting<{ level?: number; grants?: Record<OrganId, boolean> }>("organism.mandate", {});
      set({
        autonomyLevel: typeof mandate.level === "number" ? Math.max(0, Math.min(4, Math.round(mandate.level))) : 3,
        organGrants: mandate.grants ?? { guardian: true, merchant: true, envoy: true, scout: true },
      });
      // v1.1 BIOSFER: muat creature dari settings lokal — atau lahirkan 6 creature awal.
      let biosferCreatures = await getSetting<CreatureState[] | null>("organism.creatures", null);
      if (!Array.isArray(biosferCreatures) || biosferCreatures.length === 0) {
        biosferCreatures = initialCreatures();
        await setSetting("organism.creatures", biosferCreatures);
        set({ creatures: biosferCreatures });
        for (const c of biosferCreatures) {
          eventBus.emit("spawn", `${c.name} (${c.species}) lahir di biosfer — energi ${c.energy}.`, { creatureId: c.id });
        }
      } else {
        // Validasi ulang terhadap katalog (creature baru di katalog ikut lahir).
        const base = initialCreatures();
        const merged = base.map((b) => {
          const found = biosferCreatures!.find((c) => c.id === b.id);
          return found ? { ...b, ...found, id: b.id, name: b.name, species: b.species, role: b.role } : b;
        });
        set({ creatures: merged });
        for (const c of merged) {
          if (!biosferCreatures!.some((old) => old.id === c.id)) {
            eventBus.emit("spawn", `${c.name} (${c.species}) lahir di biosfer.`, { creatureId: c.id });
          }
        }
      }
      // Mirror bus biosfer → eventLog UI (maks 200, konstitusi hukum 6).
      // Dipasang sekali saja (audit F-14) — guard flag modul mencegah dobel-subscribe.
      if (!listenersBound) {
        listenersBound = true;
        const offBus = eventBus.subscribe("*", (ev) => {
          useFlybrain.setState((s) => ({ eventLog: [ev, ...s.eventLog].slice(0, 200) }));
        });
        const offPrt = prt.on((s) => {
          set((st) => ({
            vitals: s.vitals,
            prtBeat: s.beat,
            prtFeed: [...s.feed, ...st.prtFeed].slice(0, 40),
            ticker: s.feed[0]?.note ?? st.ticker,
          }));
        });
        unbindListeners = () => {
          offBus();
          offPrt();
          listenersBound = false;
        };
      }
      // v1.2 PLANET: muat dunia dari settings lokal — atau lahirkan dunia baru.
      const savedWorld = await getSetting<unknown>("organism.world", null);
      if (isWorldState(savedWorld)) {
        set({ world: savedWorld, lastWorldTickAt: savedWorld.lastTickAt });
      } else {
        const fresh = initialWorld(0, Date.now());
        await setSetting("organism.world", fresh);
        set({ world: fresh, lastWorldTickAt: fresh.lastTickAt });
      }
      prt.start(6000);
      set({ ready: true });
      return unbindListeners ?? (() => {});
    } catch {
      set({ ready: true }); // tetap render; PRT akan melaporkan
      return unbindListeners ?? (() => {});
    }
  },

  setView: (v) => set({ view: v }),

  setAutonomyLevel: (level) => {
    const autonomyLevel = Math.max(0, Math.min(4, Math.round(level)));
    set({ autonomyLevel });
    void setSetting("organism.mandate", { level: autonomyLevel, grants: get().organGrants });
    void addLog({ channel: "organism", level: "info", message: `Mandat otonomi diubah ke L${autonomyLevel} oleh pemilik.` }, "ui");
  },

  toggleOrgan: (organ) => {
    const grants = { ...get().organGrants, [organ]: !get().organGrants[organ] };
    set({ organGrants: grants });
    void setSetting("organism.mandate", { level: get().autonomyLevel, grants });
    void addLog({ channel: "organism", level: "info", message: `Organ ${organ} ${grants[organ] ? "diberi" : "dicabut"} mandat oleh pemilik.` }, "ui");
  },

  triggerHeartbeat: async (organ) => {
    if (get().pending) return;
    const st = get();
    const organPilih: OrganId = organ ?? ORGAN_IDS[organCursor++ % ORGAN_IDS.length];
    // Kumpulkan konteks AGREGAT dari vault lokal (tanpa isi memori — konstitusi poin 2).
    const newestReceipt = st.receipts[0]?.payload;
    const receiptDaysLeft = newestReceipt
      ? Math.round((new Date(newestReceipt.issued_at).getTime() + newestReceipt.period_months * 30 * 86400000 - Date.now()) / 86400000)
      : null;
    const offers = st.decisions.filter(
      (d) => d.source === "prt" && (String((d.payload as DecisionPayload).choice ?? "").startsWith("OFFER") || (d.payload as { organ?: string }).organ === "merchant"),
    ).length;
    const lastUser = [...st.chat].reverse().find((m) => m.role === "user")?.text ?? null;
    const ctx: OrganContext = {
      username: st.session?.username,
      tier: st.tier,
      tierUntil: st.tierUntil,
      beat: prt.beat,
      vitals: prt.vitals,
      stats: st.stats ? { totalRecords: st.stats.totalRecords, totalBytes: st.stats.totalBytes, counts: st.stats.counts } : null,
      gatewayCalls: st.stats?.counts.gateway_log ?? 0,
      receipts: st.receipts.length,
      receiptDaysLeft,
      offers,
      lastMessage: lastUser,
      featureUsage: {
        memories: st.stats?.counts.memories ?? 0,
        decisions: st.stats?.counts.decisions ?? 0,
        prtEvents: st.stats?.counts.prt_events ?? 0,
        topView: st.view,
      },
      ts: new Date().toISOString(),
    };
    set({ pending: true });
    const run = await runHeartbeat(ctx, { organ: organPilih, autonomyLevel: st.autonomyLevel, grants: st.organGrants, tier: st.tier });
    const point: PulsePoint = { at: run.trace.at, organ: run.trace.organ, ok: !run.degraded, mode: run.trace.mode, latencyMs: run.trace.latencyMs };
    set((s) => ({
      pending: false,
      lastPulseAt: run.trace.at,
      decisionStream: [run.trace, ...s.decisionStream].slice(0, 50),
      pulseLog: [point, ...s.pulseLog].slice(0, 40),
    }));
    await get().refresh();
  },

  // ---------- v1.1 BIOSFER ----------

  tickCreature: async (creatureId) => {
    if (get().biosferBusy) return;
    const engine = await import("./organism/engine");
    await engine.pulseOnce("manual", creatureId);
  },

  applyDecision: async (apply) => {
    const at = new Date().toISOString();
    const creatures = get().creatures;
    const c = creatures.find((x) => x.id === apply.creatureId);
    if (!c) return;

    const energy = Math.max(0, Math.min(100, c.energy + apply.energyDelta));
    const wealth = Math.max(0, Math.round((c.wealth + apply.wealthDelta) * 100) / 100);
    const skills = apply.skillGain && !c.skills.includes(apply.skillGain) ? [...c.skills, apply.skillGain].slice(-12) : c.skills;
    const fails = apply.error ? c.fails + 1 : 0;
    const tidur = energy <= 0 && c.status !== "mati";
    const updated: CreatureState = {
      ...c,
      energy,
      wealth,
      skills,
      fails,
      pulseCount: c.pulseCount + 1,
      lastTrace: apply.phases.putuskan.slice(0, 300),
      lastAt: at,
      lastMode: apply.mode,
      status: tidur ? "tidur" : c.status,
    };
    const nextCreatures = creatures.map((x) => (x.id === c.id ? updated : x));

    const organ = roleOrgan(c.role);
    const trace: OrganismTrace = {
      id: `org_${Date.now().toString(36)}${Math.floor(Math.random() * 0xffff).toString(36)}`,
      at,
      organ,
      mode: apply.mode === "menalar" ? "llm" : "refleks",
      phases: apply.phases,
      action: apply.action,
      latencyMs: apply.latencyMs,
      model: apply.model,
      creatureId: c.id,
      creatureRole: c.role,
      pickReason: apply.pickReason,
      ...(apply.error ? { error: apply.error } : {}),
    };

    set((s) => ({
      creatures: nextCreatures,
      decisionStream: [trace, ...s.decisionStream].slice(0, 50),
      pulseLog: [
        { at, organ, ok: !apply.error, mode: trace.mode, latencyMs: apply.latencyMs },
        ...s.pulseLog,
      ].slice(0, 40),
    }));

    // Bus: aksi + ledger (transparansi radikal, hukum 5).
    eventBus.emit("act", `${c.name} bertindak: ${apply.action.type} — ${apply.action.executed}`, { creatureId: c.id, mode: apply.mode });
    eventBus.emit("ledger", `ledger [${c.name}]: ${apply.remember}`, { creatureId: c.id, mode: apply.mode });
    if (tidur) eventBus.emit("sleep", `${c.name} tidur — energi habis.`, { creatureId: c.id });
    if (apply.veto) eventBus.emit("reflect", `VETO konstitusi atas ${c.name}: ${apply.veto}`, { creatureId: c.id, mode: apply.mode });

    // INGAT: ledger keputusan LOKAL (server tetap amnesia). Kontrak koleksi "decisions"
    // = DecisionPayload {context, choice, rationale}; jejak penuh (OrganismTrace) hidup di
    // decisionStream — keputusan publish_offer dipetakan berawalan "OFFER" agar
    // penghitung merchant lama tetap berfungsi (audit F-02).
    try {
      await addDecision(
        {
          context: `${c.name} · ${organ} · ${apply.mode} · ${apply.model}`,
          choice:
            apply.action.type === "publish_offer"
              ? `OFFER ${apply.action.target ?? ""} — ${apply.phases.putuskan}`.trim()
              : `${apply.action.type}${apply.action.target ? ` → ${apply.action.target}` : ""}`,
          rationale: `${apply.phases.putuskan}${apply.remember && apply.remember !== "—" ? ` · ingat: ${apply.remember}` : ""}${apply.error ? ` · degradasi: ${apply.error}` : ""}`.slice(0, 600),
        },
        "prt",
      );
      await get().refresh();
    } catch {
      /* penyimpanan lokal tak tersedia — tetap tampil di stream */
    }
    // Episode berlabel untuk review memori (organs/memory).
    try {
      await rememberEpisode(c.id, `[${apply.error ? "FAILED" : "SUCCESS"}:${c.role}] ${apply.phases.putuskan}`.slice(0, 500), apply.error ? "warn" : "info");
    } catch {
      /* abaikan — ledger episode opsional */
    }
    await setSetting("organism.creatures", nextCreatures);
  },

  setCreatureStatus: async (creatureId, status) => {
    const c = get().creatures.find((x) => x.id === creatureId);
    if (!c || c.status === status) return;
    const updated: CreatureState =
      status === "aktif" ? { ...c, status, energy: Math.max(c.energy, 45), fails: 0 } : { ...c, status };
    set((s) => ({ creatures: s.creatures.map((x) => (x.id === creatureId ? updated : x)) }));
    if (status === "aktif") immune.reset(creatureId);
    await setSetting("organism.creatures", get().creatures);
    const pesan =
      status === "aktif"
        ? `${c.name} dibangunkan — energi disuntik ke ${updated.energy}.`
        : status === "tidur"
          ? `${c.name} tidur.`
          : `${c.name} dinyatakan mati oleh sistem imun (dapat dibangkitkan — data lokal tidak dihapus).`;
    eventBus.emit(status === "aktif" ? "wake" : status === "tidur" ? "sleep" : "death", pesan, { creatureId });
  },

  recordQuant: (tick) => {
    const snap: QuantSnapshot = {
      at: new Date().toISOString(),
      allocations: tick.allocations,
      gates: tick.gates,
      recommendations: tick.recommendations,
      scores: Object.fromEntries(tick.scores),
      risks: Object.fromEntries(tick.risks),
    };
    set({ lastQuant: snap });
  },

  setReflectVerdict: (r) => set({ reflectVerdict: r }),

  // ---------- v1.2 PLANET ----------

  recordWorldTick: (next) => {
    set({ world: next, lastWorldTickAt: next.lastTickAt });
    scheduleWorldPersist(next);
  },

  createIdentity: async (username, password) => {
    const key = await deriveKey(username, password);
    const keyHash = await hashKey(key);
    const session: Session = { username: username.trim(), key, keyHash, createdAt: new Date().toISOString() };
    setSession(session);
    await putIdentity({ username: session.username, keyHash, tier: get().tier, tierUntil: get().tierUntil, createdAt: new Date().toISOString() });
    await addLog({ channel: "identity", level: "info", message: `Identitas lokal dibuat untuk ${session.username}. Kunci diturunkan di perangkat.` }, "ui");
    await addLog({ channel: "prt", level: "info", message: "Sarang baru. Aku menjaga mulai sekarang." }, "prt");
    set({ session });
    await get().refresh();
    return key;
  },

  logout: () => {
    clearSession();
    set({ session: null });
  },

  refresh: async () => {
    const stats = await vaultStats();
    const receipts = await listRecords<Receipt>("receipts", { limit: 50 });
    const memories = await listRecords<MemoryPayload>("memories", { limit: 100 });
    const logs = await listRecords<LogPayload>("logs", { limit: 60 });
    const decisions = await listRecords<DecisionPayload>("decisions", { limit: 60 });
    set({ stats, receipts, memories, logs, decisions });
  },

  addMemoryUI: async (title, content, kind, tags) => {
    await addMemory({ title, content, kind }, "ui", tags.length ? tags : undefined);
    await get().refresh();
  },

  removeMemoryUI: async (id: string) => {
    await removeRecord("memories", id);
    await get().refresh();
  },

  addLogUI: async (message, level) => {
    await addLog({ channel: "ui", level, message }, "ui");
    await get().refresh();
  },

  addDecisionUI: async (context, choice, rationale) => {
    await addDecision({ context, choice, rationale }, "ui");
    await get().refresh();
  },

  pasteReceipt: async (raw) => {
    const session = get().session;
    if (!session) return { ok: false, message: "Buat identitas dulu — kwitansi terikat username." };
    const verdict = await (async () => {
      const r = await handleKorteks({ method: "POST", path: "/v1/payment/verify", body: { receipt: raw }, bearer: session.key, agent: "vault-ui" });
      return r;
    })();
    if (verdict.status !== 200) {
      const msg = (verdict.json as { error?: { message?: string } })?.error?.message ?? "Kwitansi ditolak.";
      return { ok: false, message: msg };
    }
    const jp = verdict.json as { tier?: Tier; until?: string };
    set({ tier: (jp.tier as Tier) ?? "PRO", tierUntil: jp.until ?? null });
    await get().refresh();
    return { ok: true, message: `Tier ${(jp.tier as Tier) ?? "PRO"} aktif sampai ${jp.until?.slice(0, 10) ?? "?"} — terkunci lokal.` };
  },

  saveDemoReceipt: async () => {
    const session = get().session;
    if (!session) return { ok: false, message: "Buat identitas dulu." };
    const rec = await demoReceipt(session.username);
    await saveReceipt(rec);
    await get().refresh();
    return { ok: true, message: `Kwitansi demo ${rec.receipt_id} disimpan ke vault kamu. Klik "Validasi kwitansi" untuk mengaktifkan tier.` };
  },

  verifyReceipts: async () => {
    const session = get().session;
    if (!session) return { ok: false, message: "Buat identitas dulu." };
    const rs = get().receipts;
    if (rs.length === 0) return { ok: false, message: "Belum ada kwitansi di vault." };
    const r = await handleKorteks({ method: "POST", path: "/v1/payment/verify", body: { receipt: rs[0].payload }, bearer: session.key, agent: "vault-ui" });
    if (r.status !== 200) {
      const msg = (r.json as { error?: { message?: string } })?.error?.message ?? "Ditolak.";
      return { ok: false, message: msg };
    }
    const jp = r.json as { tier?: Tier; until?: string };
    set({ tier: (jp.tier as Tier) ?? "PRO", tierUntil: jp.until ?? null });
    await get().refresh();
    return { ok: true, message: `Valid — tier ${(jp.tier as Tier) ?? "PRO"} sampai ${jp.until?.slice(0, 10) ?? "?"}.` };
  },

  wipe: async () => {
    prt.stop();
    await wipeVault();
    clearSession();
    set({ session: null, tier: "FREE", tierUntil: null, stats: null, receipts: [], memories: [], logs: [], decisions: [], prtFeed: [], chat: [] });
    set({ autonomyLevel: 3, organGrants: { guardian: true, merchant: true, envoy: true, scout: true }, decisionStream: [], pulseLog: [], lastPulseAt: null, pending: false });
    prt.vitals = { energy: 88, focus: 76, mood: 70 };
    // v1.1: biosfer ikut lahir kembali (state creature di-reset, data user tetap wipe penuh).
    const fresh = initialCreatures();
    void setSetting("organism.creatures", fresh);
    eventBus.clear();
    set({ creatures: fresh, eventLog: [], reflectVerdict: null, lastQuant: null, biosferBusy: false });
    // v1.2: dunia PLANET ikut lahir kembali (tetap nol-penyimpanan).
    const freshWorld = initialWorld(0, Date.now());
    void setSetting("organism.world", freshWorld);
    set({ world: freshWorld, lastWorldTickAt: freshWorld.lastTickAt });
    prt.start(6000);
  },

  doExport: async () => {
    const data = await exportVault();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flybrain-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  doImport: async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const { imported } = await importVault(data);
      await get().refresh();
      return { ok: true, message: `${imported} rekaman baru diimpor (duplikat dilewati).` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Impor gagal." };
    }
  },

  runKernel: async (method, path, body) => {
    const session = get().session;
    let parsed: unknown = undefined;
    if (body.trim()) {
      try {
        parsed = JSON.parse(body);
      } catch {
        set({ lastKernel: { status: 400, ok: false, ms: 0, json: { ok: false, error: { code: "BAD_JSON", message: "Body bukan JSON sah." } } } });
        return;
      }
    }
    const r = await handleKorteks({ method, path, body: parsed, bearer: session?.key ?? null, agent: "konsol-uji" });
    set({ lastKernel: r });
    await get().refresh();
  },

  sendChat: async (text) => {
    const at = new Date().toISOString();
    set((st) => ({ chat: [...st.chat, { role: "user", text, at }] }));
    const st = get();
    // L2+: prt menalar via LLM saat ditanya (10_AUTONOMY §1). Di bawah itu: refleks rule-based.
    const stats = st.stats;
    const ans =
      st.autonomyLevel >= 2
        ? await llmChat(text, {
            tier: st.tier,
            tierUntil: st.tierUntil,
            beat: prt.beat,
            vitals: prt.vitals,
            stats: stats ? { totalRecords: stats.totalRecords, totalBytes: stats.totalBytes, counts: stats.counts } : null,
          })
        : { reply: (await prt.chat(text)).reply, mode: "refleks" as const };
    set((s) => ({ chat: [...s.chat, { role: "prt", text: ans.reply, at: new Date().toISOString(), mode: ans.mode }] }));
  },

  enableSW: async () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.register("/sw-korteks.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      set({ swActive: Boolean(reg.active || navigator.serviceWorker.controller) });
      // Denyut 24/7 lapis SW (v1.2.2): daftarkan periodicsync bila platform
      // mendukung (Chrome + PWA terpasang) — gagal = fitur dilewati, bukan error.
      try {
        reg.active?.postMessage({ type: "korteks-register-sync" });
        if ("periodicSync" in reg) {
          const ps = (reg as ServiceWorkerRegistration & { periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void> } }).periodicSync;
          await ps?.register("korteks-denyut", { minInterval: 12 * 60 * 60 * 1000 }).catch(() => {});
        }
      } catch {
        /* periodicsync opsional — tidak pernah menggagalkan enableSW */
      }
      return true;
    } catch {
      return false;
    }
  },
}));
