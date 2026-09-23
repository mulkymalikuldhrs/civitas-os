"use client";

// 09 PERADABAN — CIVITAS OS dashboard (docs/civitas-os/PRD.md).
// Sub-tab: PETA · PEMERINTAH · PERUSAHAAN · EKONOMI · CONTROL PLANE · DESA · EVENT.
// Kejujuran: revenue eksternal = 0 ditampilkan apa adanya (PRE_REVENUE); mode LLM vs REFLEX dilabeli;
// warga desa berlabel SIMULASI vs CENSUS (sensus nyata dari dunia Minecraft).

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Building2, Coins, Home, Landmark, ScrollText, ShieldCheck, Skull, TreePine, Users } from "lucide-react";
import { CivMapCanvas, type MapEntity } from "../CivMapCanvas";
import { fmt } from "@/lib/civos/money";

// ---------- Tipe payload API (minimal, client-side) ----------

interface Acct { id: string; kind: string; name: string; balance: number }
interface Org { id: string; code: string; kind: string; name: string; lifecycle: string; specialization: string | null; accounts: Acct[] }
interface Agent { id: string; code: string; name: string; role: string; orgCode: string; orgKind: string; status: string; reputation: number; grants: number }
interface Proposal { id: string; kind: string; orgCode: string | null; institution: string; status: string; payload: Record<string, unknown>; policyCheck: Record<string, unknown>; reason: string; decidedBy: string | null; createdAt: string }
interface Task { id: string; agentCode: string; orgCode: string; type: string; status: string; route: Record<string, unknown>; result: Record<string, unknown>; createdAt: string }
interface EventRow { seq: number; type: string; subjectType: string; subjectId: string; payload: Record<string, unknown>; createdAt: string }
interface LedgerRow { id: string; txType: string; purpose: string; isExternal: boolean; counterparty: string | null; amount: number; legs: { side: string; amount: number; account: string; kind: string }[]; createdAt: string }
interface Metrics {
  moneySupply: number; treasury: number; reserveMin: number; govCash: number; taxCollected: number;
  internalTradeVolume: number; externalRevenue: number; externalRevenueReal: number; externalRevenueSandbox: number; expenses: number;
  companies: { code: string; name: string; lifecycle: string; operating: number; income: number; expense: number }[];
  runwayDays: number | null; concentrationTop: number; alerts: string[];
}
interface StatePayload {
  orgs: Org[]; agents: Agent[]; proposals: Proposal[]; tasks: Task[]; events: EventRow[]; ledger: LedgerRow[];
  policies: { key: string; category: string; value: unknown; note: string }[];
  metrics: Metrics;
  ticks: { tick: number; target: string; summary: string; mode: string; model?: string; at: string }[];
  entities: { mcType: string; mcName: string; civCode: string; mcCoords: Record<string, unknown> }[];
  grants: { agentCode: string; capability: string; budgetCap: number }[];
  memories: { id: string; ownerType: string; scope: string; visibility: string; content: string; createdAt: string }[];
  village: Village;
  lastTick: Record<string, unknown> | null;
  counts: { orgs: number; agents: number; events: number; txns: number; memories: number; tasks: number };
  serverTime: string;
}

interface VillagerRow {
  code: string; name: string; profession: string; profKey: string; role: string; division?: string;
  source: string; embodiment: string; village: string; mood: string;
  xp: number; socialScore: number; wallet: number; workOrg: string | null;
  lastAction: string | null; lastActionAt: string | null; coords: string | null;
}
interface Village {
  population: number;
  byProfession: Record<string, number>;
  bySource: { SIMULASI: number; CENSUS: number };
  byEmbodiment: { EMBODIED: number; DREAMING: number; MISSING: number };
  retired: number;
  villagers: VillagerRow[];
  wagesPaid: number;
  directives?: DirectiveBlock;
  market?: MarketBlock;
}

// SLICE 8 — tubuh warga (direktif) + pasar desa
interface DirectiveRow { id: string; villagerCode: string; villagerName: string; kind: string; status: string; origin: string; payload: { to?: { x: number; y: number; z: number }; message?: string; orgCode?: string }; result: string | null; createdAt: string }
interface DirectiveBlock { queued: number; dispatched: number; applied: number; failed: number; expired: number; recent: DirectiveRow[] }
interface MarketOffer { id: string; seller: string; item: string; unitPrice: number; unitPriceLabel: string; qtyAvailable: number; qtySold: number; status: string; createdAt: string }
interface MarketBlock { open: number; closed: number; totalUnitsSold: number; offers: MarketOffer[] }

const SUBTABS = [
  { key: "peta", label: "PETA", icon: TreePine },
  { key: "desa", label: "DESA", icon: Home },
  { key: "pemerintah", label: "PEMERINTAH", icon: Landmark },
  { key: "perusahaan", label: "PERUSAHAAN", icon: Building2 },
  { key: "ekonomi", label: "EKONOMI", icon: Coins },
  { key: "control", label: "CONTROL PLANE", icon: ShieldCheck },
  { key: "event", label: "EVENT", icon: ScrollText },
] as const;

const LC_STYLE: Record<string, string> = {
  PROPOSED: "border-[#6b7f74] text-[#93a89c]",
  REGISTERED: "border-[#7fda9a] text-[#7fda9a]",
  CAPITALIZED: "border-[#4ade80] text-[#4ade80]",
  ACTIVE: "border-[#4ade80] text-[#4ade80]",
  GROWING: "border-[#34d399] text-[#34d399]",
  PROFITABLE: "border-[#fbbf24] text-[#fbbf24]",
  UNPROFITABLE: "border-[#fb923c] text-[#fb923c]",
  CAPITAL_CONSTRAINED: "border-[#f87171] text-[#f87171]",
  DORMANT: "border-[#94a3b8] text-[#94a3b8]",
  RESTRUCTURING: "border-[#fbbf24] text-[#fbbf24]",
  LIQUIDATING: "border-[#f87171] text-[#f87171]",
  BANKRUPT: "border-[#ef4444] text-[#ef4444]",
  DISSOLVED: "border-[#64748b] text-[#64748b]",
};

export function PeradabanView() {
  const [state, setState] = useState<StatePayload | null>(null);
  const [tab, setTab] = useState<(typeof SUBTABS)[number]["key"]>("peta");
  const [busy, setBusy] = useState<string | null>(null);
  const [pulseAt, setPulseAt] = useState(0);
  const [newName, setNewName] = useState("");
  const [newSpec, setNewSpec] = useState("");
  const pulseRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/civos/state", { cache: "no-store" });
      const j = (await res.json()) as { ok: boolean; state?: StatePayload };
      if (j.ok && j.state) setState(j.state);
    } catch { /* biarkan polling berikutnya */ }
  }, []);

  const beat = useCallback(async (target?: string) => {
    setBusy("denyut");
    try {
      const res = await fetch("/api/civos/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target ? { target } : {}),
      });
      const j = (await res.json()) as { ok: boolean; summary?: { at: string } };
      if (j.ok) {
        pulseRef.current = Date.now();
        setPulseAt(pulseRef.current);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }, [load]);

  const action = useCallback(async (act: string, params?: Record<string, unknown>) => {
    setBusy(act);
    try {
      await fetch("/api/civos/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act, params }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }, [load]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { void load(); }, 12_000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => { void beat(); }, 50_000);
    return () => clearInterval(t);
  }, [beat]);

  if (!state) {
    return (
      <div className="p-6 space-y-3">
        <div className="catalog !text-[10px] text-[#fbbf24]">MENGHIDUPKAN PERADABAN…</div>
        <div className="h-40 rounded-md border border-border bg-[#070d0a] animate-pulse" />
      </div>
    );
  }

  const m = state.metrics;
  const nation = state.orgs.find((o) => o.kind === "NATION");
  const gov = state.orgs.find((o) => o.kind === "GOVERNMENT");
  const companies = state.orgs.filter((o) => o.kind === "COMPANY");
  const city = state.orgs.find((o) => o.kind === "CITY");
  const mode = String(state.lastTick?.mode ?? "INSTITUSI");
  const model = String(state.lastTick?.model ?? "prosedur");

  const mapEntities: MapEntity[] = state.entities.map((e) => ({
    mcType: e.mcType,
    mcName: e.mcName,
    civCode: e.civCode,
    coords: { x: Number(e.mcCoords.x ?? 0), z: Number(e.mcCoords.z ?? 0) },
  }));

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Kepala peradaban */}
      <header className="rounded-md border border-border bg-[#070d0a] p-4">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="catalog !text-[9px] text-[#fbbf24]">CIVITAS OS — AUTONOMOUS CIVILIZATION OPERATING SYSTEM</div>
            <h1 className="text-xl md:text-2xl font-mono text-[#bfe8cc] mt-1 glow-phos">{nation?.name ?? "Nusantara Digital"}</h1>
            <p className="catalog mt-1 leading-relaxed">
              1 bangsa · 1 pemerintah (4 institusi) · 1 kota · {companies.length} perusahaan · {state.village.population} warga desa (villager otonom) · {state.counts.agents} agen institusi · kernel SQLite otoritatif · dunia Minecraft: mulkymalikuldhr.aternos.me:19132
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="catalog border border-[#4ade80]/40 px-2 py-0.5 rounded">UANG BEREDAR {fmt(m.moneySupply)}</span>
              <span className="catalog border border-[#4ade80]/40 px-2 py-0.5 rounded">KAS BANGSA {fmt(m.treasury)}</span>
              <span className="catalog border border-[#fbbf24]/40 px-2 py-0.5 rounded">PAJAK {fmt(m.taxCollected)}</span>
              <span className={`catalog border px-2 py-0.5 rounded ${m.externalRevenueReal === 0 ? "border-[#f87171]/50 text-[#f87171]" : "border-[#4ade80]/50 text-[#4ade80]"}`}>
                REVENUE EKSTERNAL RIIL {fmt(m.externalRevenueReal)} — {m.externalRevenueReal === 0 ? "PRE_REVENUE (JUJUR)" : "AKTIF"}
              </span>
              {m.externalRevenueSandbox > 0 && (
                <span className="catalog border border-[#fbbf24]/40 text-[#fbbf24] px-2 py-0.5 rounded">RAIL SANDBOX TERUJI {fmt(m.externalRevenueSandbox)}</span>
              )}
            </div>
          </div>
          <div className="shrink-0 lg:w-72 space-y-2">
            <div className="rounded border border-border p-3">
              <div className="catalog !text-[9px] text-[#7f9a89]">DENYUT TERAKHIR</div>
              <div className="font-mono text-sm text-[#bfe8cc] mt-1">
                {String(state.lastTick?.target ?? "-")} <span className={`catalog ${mode === "LLM" ? "text-[#4ade80]" : mode === "REFLEX" ? "text-[#fbbf24]" : "text-[#38bdf8]"}`}>[{mode}{mode !== "INSTITUSI" ? `·${model}` : ""}]</span>
              </div>
              <p className="catalog mt-1 leading-snug">{String(state.lastTick?.summary ?? "belum ada")}</p>
              {state.lastTick?.village ? (
                <p className="catalog mt-1 leading-snug text-[#7fdabf]">DESA ▸ {String(state.lastTick.village)}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void beat()}
                disabled={busy !== null}
                className="flex-1 h-11 rounded border border-[#4ade80]/60 bg-[#0d1a12] text-[#4ade80] font-mono text-xs hover:bg-[#12281b] disabled:opacity-40"
              >
                {busy === "denyut" ? "MENDENYUT…" : "♥ DENYUT SEKARANG"}
              </button>
              <button
                onClick={() => void action("ping_minecraft")}
                disabled={busy !== null}
                className="h-11 px-3 rounded border border-border text-[#7f9a89] font-mono text-xs hover:text-[#bfe8cc] disabled:opacity-40"
              >
                PING MC
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sub-tab nav */}
      <nav className="flex overflow-x-auto gap-1 border-b border-border" aria-label="Sub-tab peradaban">
        {SUBTABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            aria-current={tab === s.key ? "page" : undefined}
            className={`flex items-center gap-2 px-3 py-2 font-mono text-[11px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === s.key ? "border-[#4ade80] text-[#4ade80]" : "border-transparent text-[#7f9a89] hover:text-[#bfe8cc]"
            }`}
          >
            <s.icon className="w-3.5 h-3.5" /> {s.label}
          </button>
        ))}
      </nav>

      {/* PETA */}
      {tab === "peta" && (
        <section className="space-y-3">
          <CivMapCanvas entities={mapEntities} orgs={state.orgs.map((o) => ({ code: o.code, lifecycle: o.lifecycle }))} pulseAt={pulseAt} agentCount={state.counts.agents} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {state.orgs.map((o) => (
              <div key={o.id} className="rounded border border-border bg-[#070d0a] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="catalog !text-[9px]">{o.code}</span>
                  <span className={`catalog border px-1.5 rounded ${LC_STYLE[o.lifecycle] ?? ""}`}>{o.lifecycle}</span>
                </div>
                <div className="font-mono text-xs text-[#bfe8cc] mt-1 truncate">{o.name}</div>
                <div className="catalog mt-1">{o.specialization ?? o.kind}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* DESA — VILLAGER ASCENSION (Slice 7) */}
      {tab === "desa" && (
        <section className="space-y-3">
          {/* Banner kejujuran sumber populasi */}
          <div className={`rounded border p-3 ${state.village.bySource.CENSUS > 0 ? "border-[#4ade80]/50 text-[#4ade80]" : "border-[#fbbf24]/50 text-[#fbbf24]"}`}>
            <div className="catalog leading-relaxed">
              {state.village.bySource.CENSUS > 0
                ? `SENSUS NYATA AKTIF — ${state.village.bySource.CENSUS} warga terikat entitas dunia Minecraft. Warga SIMULASI tersisa: ${state.village.bySource.SIMULASI}.`
                : "POPULASI SIMULASI (JUJUR) — server Minecraft sedang tidur, jadi populasi uji berlabel SIMULASI menghidupkan pipeline desa. Begitu bot masuk dunia & mengobservasi villager nyata, sensus CENSUS otomatis menggantikan populasi simulasi (warga SIM mundur, sejarah tetap auditable)."}
            </div>
          </div>

          {/* Statistik desa + aksi */}
          <div className="rounded border border-border bg-[#070d0a] p-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2">
              <div><div className="catalog !text-[9px]">POPULASI</div><div className="font-mono text-sm text-[#bfe8cc]">{state.village.population}</div></div>
              <div><div className="catalog !text-[9px]">UPAH DIBAYAR</div><div className="font-mono text-sm text-[#4ade80]">{state.village.wagesPaid}×</div></div>
              <div><div className="catalog !text-[9px]">EMBODIED / MIMPI</div><div className="font-mono text-sm text-[#38bdf8]">{state.village.byEmbodiment.EMBODIED} / {state.village.byEmbodiment.DREAMING + state.village.byEmbodiment.MISSING}</div></div>
              <div><div className="catalog !text-[9px]">DOMPET WARGA</div><div className="font-mono text-sm text-[#4ade80]">{fmt(state.village.villagers.reduce((s, v) => s + v.wallet, 0))}</div></div>
              <div><div className="catalog !text-[9px]">MUNDUR (SIM)</div><div className="font-mono text-sm text-[#7f9a89]">{state.village.retired}</div></div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => void action("village_tick")} disabled={busy !== null} className="h-10 px-3 rounded border border-[#4ade80]/60 bg-[#0d1a12] text-[#4ade80] font-mono text-xs hover:bg-[#12281b] disabled:opacity-40">
                {busy === "village_tick" ? "…" : "DENYUT WARGA"}
              </button>
              <button onClick={() => void action("village_census", { count: 8 })} disabled={busy !== null} className="h-10 px-3 rounded border border-border text-[#7f9a89] font-mono text-xs hover:text-[#bfe8cc] disabled:opacity-40" title="Tambah 8 warga SIMULASI berlabel">
                {busy === "village_census" ? "…" : "SENSUS SIM +8"}
              </button>
              <button onClick={() => void action("village_retire_sim")} disabled={busy !== null} className="h-10 px-3 rounded border border-border text-[#7f9a89] font-mono text-xs hover:text-[#bfe8cc] disabled:opacity-40" title="Warga SIMULASI mundur — menunggu sensus nyata">
                {busy === "village_retire_sim" ? "…" : "MUNDURKAN SIM"}
              </button>
            </div>
          </div>

          {/* Kartu warga */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {state.village.villagers.length === 0 && (
              <p className="catalog">Desa kosong. Denyut berikutnya akan menjalankan sensus SIMULASI berlabel — atau hidupkan server Minecraft untuk sensus nyata.</p>
            )}
            {state.village.villagers.map((v) => (
              <div key={v.code} className="rounded border border-border bg-[#070d0a] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="catalog !text-[9px]">{v.code} · <Users className="inline w-3 h-3 -mt-0.5" /> {v.xp}xp</span>
                  <div className="flex gap-1">
                    <span className={`catalog !text-[9px] border px-1.5 rounded ${v.source === "CENSUS" ? "border-[#4ade80]/60 text-[#4ade80]" : "border-[#fbbf24]/60 text-[#fbbf24]"}`}>{v.source}</span>
                    <span className={`catalog !text-[9px] border px-1.5 rounded ${v.embodiment === "EMBODIED" ? "border-[#38bdf8]/60 text-[#38bdf8]" : v.embodiment === "MISSING" ? "border-[#f87171]/50 text-[#f87171]" : "border-[#6b7f74] text-[#93a89c]"}`}>{v.embodiment}</span>
                  </div>
                </div>
                <div className="font-mono text-sm text-[#bfe8cc] mt-1">{v.name} <span className="text-[#7f9a89]">· {v.profession}</span></div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="catalog !text-[9px]">peran {v.role} · mood {v.mood} · sosial {v.socialScore} · kerja {v.workOrg ?? "—"}</span>
                  {v.division && v.division !== "GENERAL" && <span className="catalog !text-[9px] border border-[#4ade80]/40 text-[#4ade80] px-1.5 rounded" data-testid="guild-badge">guild {v.division}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span className="font-mono text-[11px] text-[#4ade80]">{fmt(v.wallet)}</span>
                  <span className="catalog !text-[9px]">{v.lastActionAt ? new Date(v.lastActionAt).toLocaleTimeString("id-ID") : "belum bertindak"}</span>
                </div>
                {v.lastAction && <p className="catalog mt-1 leading-snug !text-[9px] text-[#93a89c]">{v.lastAction}</p>}
                {v.coords && <div className="catalog !text-[9px] mt-0.5 text-[#6b7f74]">pos {v.coords}</div>}
              </div>
            ))}
          </div>

          {/* SLICE 8 — TUBUH WARGA: antrean direktif (otak → tubuh) */}
          <div className="rounded border border-border bg-[#070d0a] p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="font-mono text-sm text-[#38bdf8]">TUBUH WARGA — ANTREAN DIREKTIF (SLICE 8)</h2>
              <button onClick={() => void action("village_directive_run_sim")} disabled={busy !== null} className="h-8 px-3 rounded border border-[#38bdf8]/60 bg-[#0a1218] text-[#38bdf8] font-mono text-xs hover:bg-[#0e1c26] disabled:opacity-40" title="Jalankan antrean di kernel saat dunia tidur (mimpi jaga, berlabel SIM)">
                {busy === "village_directive_run_sim" ? "…" : "JALANKAN SIM TUBUH"}
              </button>
            </div>
            <p className="catalog mb-2 leading-snug">Otak warga (LLM) memutuskan; tubuh dieksekusi dunia: saat server ONLINE bot mengirim tp/relay-chat; saat OFFLINE kernel menjalankan mimpi jaga berlabel SIM. Tak pernah mengaku EMBODIED tanpa dunia nyata.</p>
            <div className="grid grid-cols-5 gap-2 mb-3">
              <div><div className="catalog !text-[9px]">ANTRE</div><div className="font-mono text-sm text-[#fbbf24]">{state.village.directives?.queued ?? 0}</div></div>
              <div><div className="catalog !text-[9px]">DIKIRIM</div><div className="font-mono text-sm text-[#38bdf8]">{state.village.directives?.dispatched ?? 0}</div></div>
              <div><div className="catalog !text-[9px]">DIJALANKAN</div><div className="font-mono text-sm text-[#4ade80]">{state.village.directives?.applied ?? 0}</div></div>
              <div><div className="catalog !text-[9px]">GAGAL</div><div className="font-mono text-sm text-[#f87171]">{state.village.directives?.failed ?? 0}</div></div>
              <div><div className="catalog !text-[9px]">KEDALUWARSA</div><div className="font-mono text-sm text-[#7f9a89]">{state.village.directives?.expired ?? 0}</div></div>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {(state.village.directives?.recent ?? []).length === 0 && <p className="catalog">Belum ada direktif — jalankan DENYUT WARGA untuk melihat otak → tubuh.</p>}
              {(state.village.directives?.recent ?? []).map((d) => (
                <div key={d.id} className="rounded border border-border p-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="catalog !text-[9px]">{d.villagerCode} · {d.kind} · {d.origin}</div>
                    <div className="font-mono text-[11px] text-[#bfe8cc] truncate">{d.payload?.message ?? (d.payload?.to ? `→ ${d.payload.to.x},${d.payload.to.y},${d.payload.to.z}` : (d.payload?.orgCode ?? ""))}</div>
                    {d.result && <div className="catalog !text-[9px] text-[#93a89c] mt-0.5">{d.result}</div>}
                  </div>
                  <span className={`catalog !text-[9px] border px-1.5 rounded shrink-0 ${d.status === "APPLIED" ? "border-[#4ade80]/60 text-[#4ade80]" : d.status === "FAILED" ? "border-[#f87171]/60 text-[#f87171]" : d.status === "EXPIRED" ? "border-[#6b7f74] text-[#93a89c]" : "border-[#fbbf24]/60 text-[#fbbf24]"}`}>{d.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SLICE 8 — PASAR DESA: listing × warga, matching deterministik */}
          <div className="rounded border border-border bg-[#070d0a] p-4">
            <h2 className="font-mono text-sm text-[#fbbf24] mb-2">PASAR DESA (SLICE 8) — LISTING × WARGA, MATCHING TERMURAH DETERMINISTIK</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div><div className="catalog !text-[9px]">LISTING OPEN</div><div className="font-mono text-sm text-[#4ade80]">{state.village.market?.open ?? 0}</div></div>
              <div><div className="catalog !text-[9px]">LISTING SELESAI</div><div className="font-mono text-sm text-[#7f9a89]">{state.village.market?.closed ?? 0}</div></div>
              <div><div className="catalog !text-[9px]">UNIT TERJUAL</div><div className="font-mono text-sm text-[#4ade80]">{state.village.market?.totalUnitsSold ?? 0}</div></div>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {(state.village.market?.offers ?? []).length === 0 && <p className="catalog">Pasar kosong — perusahaan akan listing otomatis saat aksi PRODUCE, atau tambah manual via API market_list.</p>}
              {(state.village.market?.offers ?? []).map((o) => (
                <div key={o.id} className="rounded border border-border p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-[#bfe8cc] truncate">{o.item}</div>
                    <div className="catalog !text-[9px]">{o.seller} · sisa {o.qtyAvailable} · terjual {o.qtySold}</div>
                  </div>
                  <span className="font-mono text-[11px] text-[#4ade80] shrink-0">{o.unitPriceLabel}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PEMERINTAH */}
      {tab === "pemerintah" && (
        <section className="grid md:grid-cols-2 gap-3">
          <div className="rounded border border-border bg-[#070d0a] p-4">
            <h2 className="font-mono text-sm text-[#fbbf24] mb-2">PIPELINE PROPOSAL INSTITUSIONAL</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {state.proposals.length === 0 && <p className="catalog">Belum ada proposal. Perusahaan akan mengajukan saat kasnya nol.</p>}
              {state.proposals.map((p) => (
                <div key={p.id} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="catalog !text-[9px]">{p.kind} · {p.institution}</span>
                    <span className={`catalog !text-[9px] ${p.status === "APPROVED" || p.status === "EXECUTED" ? "text-[#4ade80]" : p.status === "REJECTED" ? "text-[#f87171]" : "text-[#fbbf24]"}`}>{p.status}</span>
                  </div>
                  <div className="font-mono text-[11px] text-[#bfe8cc] mt-1">{p.orgCode ?? "-"} · ask {fmt(Number((p.payload.capitalAsk as number) ?? 0))}</div>
                  {p.policyCheck.skor !== undefined && (
                    <div className="catalog mt-1">skor {String(p.policyCheck.skor)} · headroom {fmt(Number(p.policyCheck.headroom ?? 0))}</div>
                  )}
                  {p.reason && <div className="catalog mt-1 text-[#93a89c]">{p.reason}</div>}
                  <div className="catalog !text-[9px] mt-1">{p.decidedBy ? `diputuskan ${p.decidedBy}` : "menunggu institusi"} · {new Date(p.createdAt).toLocaleTimeString("id-ID")}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded border border-border bg-[#070d0a] p-4">
              <h2 className="font-mono text-sm text-[#fbbf24] mb-2">KEBIJAKAN (DI LUAR JANGKAUAN LLM)</h2>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {state.policies.map((pol) => (
                  <div key={pol.key} className="flex items-start justify-between gap-2">
                    <span className="catalog">{pol.key}</span>
                    <span className="font-mono text-[11px] text-[#bfe8cc]">{JSON.stringify(pol.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded border border-border bg-[#070d0a] p-4">
              <h2 className="font-mono text-sm text-[#fbbf24] mb-2">KAS INSTITUSI</h2>
              <div className="grid grid-cols-2 gap-2">
                {gov?.accounts.map((a) => (
                  <div key={a.id} className="rounded border border-border p-2">
                    <div className="catalog !text-[9px]">{a.name}</div>
                    <div className="font-mono text-sm text-[#4ade80]">{fmt(a.balance)}</div>
                  </div>
                ))}
                {city?.accounts.map((a) => (
                  <div key={a.id} className="rounded border border-border p-2">
                    <div className="catalog !text-[9px]">{a.name}</div>
                    <div className="font-mono text-sm text-[#38bdf8]">{fmt(a.balance)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* PERUSAHAAN */}
      {tab === "perusahaan" && (
        <section className="space-y-3">
          <div className="rounded border border-border bg-[#070d0a] p-4">
            <h2 className="font-mono text-sm text-[#4ade80] mb-2">DAFTAR PERUSAHAAN BARU (memerintah mencipta, REGULATORY meregistrasi)</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama perusahaan" className="h-11 flex-1 rounded border border-border bg-[#050b08] px-3 font-mono text-xs text-[#bfe8cc] placeholder:text-[#4a5f54]" />
              <input value={newSpec} onChange={(e) => setNewSpec(e.target.value)} placeholder="Spesialisasi" className="h-11 flex-1 rounded border border-border bg-[#050b08] px-3 font-mono text-xs text-[#bfe8cc] placeholder:text-[#4a5f54]" />
              <button
                onClick={() => { void action("register_company", { name: newName, specialization: newSpec }); setNewName(""); setNewSpec(""); }}
                disabled={busy !== null || !newName.trim()}
                className="h-11 px-4 rounded border border-[#4ade80]/60 bg-[#0d1a12] text-[#4ade80] font-mono text-xs hover:bg-[#12281b] disabled:opacity-40"
              >
                USULKAN
              </button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {companies.map((c) => {
              const met = m.companies.find((x) => x.code === c.code);
              return (
                <div key={c.id} className="rounded border border-border bg-[#070d0a] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="catalog !text-[9px]">{c.code}</span>
                    <span className={`catalog border px-1.5 rounded ${LC_STYLE[c.lifecycle] ?? ""}`}>{c.lifecycle}</span>
                  </div>
                  <h3 className="font-mono text-sm text-[#bfe8cc]">{c.name}</h3>
                  <p className="catalog">{c.specialization}</p>
                  <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
                    <div className="rounded border border-border p-1.5"><div className="catalog !text-[8px]">KAS</div><span className="text-[#4ade80]">{fmt(met?.operating ?? 0, false)}</span></div>
                    <div className="rounded border border-border p-1.5"><div className="catalog !text-[8px]">PENDAPATAN</div><span className="text-[#fbbf24]">{fmt(met?.income ?? 0, false)}</span></div>
                    <div className="rounded border border-border p-1.5"><div className="catalog !text-[8px]">BEBAN</div><span className="text-[#f87171]">{fmt(met?.expense ?? 0, false)}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <span className="catalog !text-[9px] text-[#7f9a89]">AGEN:</span>
                    {state.agents.filter((a) => a.orgCode === c.code).map((a) => (
                      <span key={a.id} className="catalog !text-[9px] border border-border rounded px-1">{a.code}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* EKONOMI */}
      {tab === "ekonomi" && (
        <section className="space-y-3">
          <div className="rounded border border-[#f87171]/40 bg-[#170d0d] p-3 flex items-start gap-2">
            <Skull className="w-4 h-4 text-[#f87171] shrink-0 mt-0.5" />
            <p className="catalog text-[#f8c9c9] leading-relaxed">
              KEBENARAN EKONOMI: seluruh angka di sini adalah peradaban internal. Perdagangan antar organ <b>bukan</b> revenue eksternal. Revenue eksternal membutuhkan customer nyata di luar sistem — belum ada, maka angkanya NOL. Klik aksi &quot;declare_external_customer&quot; di API akan DITOLAK oleh honesty gate.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {[
              { l: "UANG BEREDAR", v: fmt(m.moneySupply, false) },
              { l: "KAS BANGSA", v: fmt(m.treasury, false) },
              { l: "KAS PEMERINTAH", v: fmt(m.govCash, false) },
              { l: "PERDAGANGAN INTERNAL", v: fmt(m.internalTradeVolume, false) },
              { l: "BEBAN TOTAL", v: fmt(m.expenses, false) },
              { l: "RUNWAY (HR)", v: m.runwayDays === null ? "-" : String(m.runwayDays) },
            ].map((k) => (
              <div key={k.l} className="rounded border border-border bg-[#070d0a] p-3">
                <div className="catalog !text-[8px]">{k.l}</div>
                <div className="font-mono text-sm text-[#4ade80] mt-1">{k.v}</div>
              </div>
            ))}
          </div>
          {m.alerts.length > 0 && (
            <div className="rounded border border-[#fbbf24]/40 bg-[#171207] p-3">
              <div className="catalog !text-[9px] text-[#fbbf24] mb-1">SUSTAINABILITY MONITOR</div>
              {m.alerts.map((a, i) => <p key={i} className="catalog text-[#fde9b0]">{a}</p>)}
            </div>
          )}
          <div className="rounded border border-border bg-[#070d0a] p-4">
            <h2 className="font-mono text-sm text-[#fbbf24] mb-2">LEDGER DOUBLE-ENTRY (30 TERAKHIR)</h2>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="catalog !text-[9px] text-[#7f9a89]">
                  <tr><th className="py-1 pr-3">WAKTU</th><th className="py-1 pr-3">TIPE</th><th className="py-1 pr-3">NILAI</th><th className="py-1 pr-3">TUJUAN</th><th className="py-1">LEG</th></tr>
                </thead>
                <tbody>
                  {state.ledger.map((r) => (
                    <tr key={r.id} className="border-t border-border/60 align-top">
                      <td className="py-1.5 pr-3 text-[#7f9a89] whitespace-nowrap">{new Date(r.createdAt).toLocaleTimeString("id-ID")}</td>
                      <td className="py-1.5 pr-3"><span className={r.isExternal ? "text-[#4ade80]" : "text-[#bfe8cc]"}>{r.txType}</span></td>
                      <td className="py-1.5 pr-3 text-[#4ade80] whitespace-nowrap">{fmt(r.amount, false)}</td>
                      <td className="py-1.5 pr-3 text-[#93a89c] max-w-[220px]">{r.purpose}</td>
                      <td className="py-1.5 text-[10px] text-[#7f9a89]">{r.legs.map((l) => `${l.side[0]}:${l.account}(${(l.amount / 100).toFixed(2)})`).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* CONTROL PLANE */}
      {tab === "control" && (
        <section className="grid md:grid-cols-2 gap-3">
          <div className="rounded border border-border bg-[#070d0a] p-4">
            <h2 className="font-mono text-sm text-[#4ade80] mb-2">AGEN REGISTRY ({state.agents.length})</h2>
            <div className="max-h-80 overflow-y-auto pr-1 space-y-1.5">
              {state.agents.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-[#bfe8cc]">{a.code} <span className="text-[#7f9a89]">· {a.role}</span></div>
                    <div className="catalog !text-[9px]">{a.orgCode} · rep {a.reputation} · {a.grants} grant</div>
                  </div>
                  <span className={`catalog !text-[9px] ${a.status === "ACTIVE" ? "text-[#4ade80]" : "text-[#fbbf24]"}`}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded border border-border bg-[#070d0a] p-4">
              <h2 className="font-mono text-sm text-[#4ade80] mb-2">LLM ROUTER — TUGAS TERAKHIR</h2>
              <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5">
                {state.tasks.map((t) => {
                  const route = t.route as { mode?: string; model?: string; reason?: string; latencyMs?: number };
                  return (
                    <div key={t.id} className="rounded border border-border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-[#bfe8cc]">{t.agentCode} @ {t.orgCode}</span>
                        <span className={`catalog !text-[9px] ${route.mode === "LLM" ? "text-[#4ade80]" : route.mode === "REFLEX" ? "text-[#fbbf24]" : "text-[#7f9a89]"}`}>[{route.mode ?? "-"}{route.model ? `·${route.model}` : ""}]</span>
                      </div>
                      {route.reason && <div className="catalog !text-[9px] mt-0.5">{route.reason} · {route.latencyMs ?? 0}ms</div>}
                      <div className={`catalog !text-[9px] mt-0.5 ${t.status === "DONE" ? "text-[#4ade80]" : t.status === "REJECTED" ? "text-[#f87171]" : "text-[#fbbf24]"}`}>{t.status}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded border border-border bg-[#070d0a] p-4">
              <h2 className="font-mono text-sm text-[#4ade80] mb-2">GRANT CAPABILITY (SHORT-LIVED, SCOPED)</h2>
              <div className="max-h-40 overflow-y-auto pr-1 space-y-1">
                {state.grants.map((g, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="catalog">{g.agentCode}</span>
                    <span className="font-mono text-[11px] text-[#bfe8cc]">{g.capability}{g.budgetCap > 0 ? ` ≤${fmt(g.budgetCap, false)}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded border border-border bg-[#070d0a] p-4">
              <h2 className="font-mono text-sm text-[#4ade80] mb-2">MEMORI TERBARU (SCOPED + ACL)</h2>
              <div className="max-h-40 overflow-y-auto pr-1 space-y-1">
                {state.memories.slice(0, 8).map((mem) => (
                  <div key={mem.id} className="rounded border border-border/60 p-2">
                    <div className="catalog !text-[9px]">{mem.ownerType}·{mem.scope}·{mem.visibility}</div>
                    <p className="catalog mt-0.5">{mem.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* EVENT */}
      {tab === "event" && (
        <section className="rounded border border-border bg-[#070d0a] p-4">
          <h2 className="font-mono text-sm text-[#fbbf24] mb-2">EVENT BUS IMMUTABLE ({state.counts.events} TOTAL — TULIS SEKALI, TAK PERNAH DIUBAH)</h2>
          <div className="max-h-[460px] overflow-y-auto pr-1 space-y-1">
            {state.events.map((e) => (
              <div key={e.seq} className="flex items-start gap-3 border-b border-border/40 pb-1">
                <span className="catalog !text-[9px] text-[#4a5f54] shrink-0 w-14">{String(e.seq).padStart(5, "0")}</span>
                <span className="catalog !text-[9px] text-[#4ade80] shrink-0 w-40 truncate">{e.type}</span>
                <span className="catalog !text-[9px] flex-1">{e.subjectType}:{e.subjectId.slice(0, 14)} {JSON.stringify(e.payload).slice(0, 110)}</span>
                <span className="catalog !text-[9px] text-[#4a5f54] shrink-0">{new Date(e.createdAt).toLocaleTimeString("id-ID")}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Activity className="w-3.5 h-3.5 text-[#4ade80]" />
        <span className="catalog !text-[9px]">denyut otomatis tiap ±50 dtk · state refresh 12 dtk · denyut BIOSFER prt tetap jalan terpisah</span>
      </div>
    </div>
  );
}
