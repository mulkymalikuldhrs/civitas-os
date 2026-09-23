"use client";

// ============================================================================
// CIVITAS COMMAND CENTER — DASHBOARD DEPAN (redesign total, mandat pemilik).
// Halaman depan peradaban: denyut hidup, GUILD KERJA (8 divisi spesialis),
// TOOLFORGE (tool calling + internet NYATA), peta dunia, pasar desa, panel
// kejujuran. Data dari /api/civos/state; aksi via /api/civos/action (policy
// tetap berlaku — UI bukan pintu belakang).
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import {
  Activity, Blocks, BrainCircuit, Cog, Code2, GitBranch,
  Globe, Hammer, Landmark, Pickaxe, RefreshCw, ScrollText, Shield, Store, Users, Wrench,
} from "lucide-react";
import { CivMapCanvas, type MapEntity } from "../flybrain/CivMapCanvas";
import { fmt } from "@/lib/civos/money";

// ---------- Tipe payload (subset civState) ----------

interface Acct { id: string; kind: string; name: string; balance: number }
interface Org { id: string; code: string; kind: string; name: string; lifecycle: string; accounts: Acct[] }
interface EventRow { seq: number; type: string; subjectType: string; subjectId: string; payload: Record<string, unknown>; createdAt: string }
interface TickRow { tick: number; target: string; kind?: string; summary: string; mode?: string; at: string }
interface VillagerRow {
  code: string; name: string; profession: string; division: string; source: string; embodiment: string;
  mood: string; xp: number; wallet: number; workOrg: string | null; lastAction: string | null; lastActionAt: string | null;
}
interface OfferRow { id: string; item: string; unitPrice: number; qtyAvailable: number }
interface ArtifactRow { id: string; kind: string; title: string; authorName: string; authorCode: string; division: string; tool: string | null; createdAt: string; contentPreview: string }
interface ToolCallRow { id: string; tool: string; callerName: string; callerCode: string; status: string; latencyMs: number; createdAt: string }
interface GuildStats { byDivision: Record<string, number>; latest: Record<string, { title: string; at: string; kind: string }> }
interface ToolStats { total: number; byTool: Record<string, number>; byStatus: Record<string, number> }
interface McServerInfo { host: string; port: number; edition: string; version: string; invite: string }

interface CivStatePayload {
  orgs: Org[];
  events: EventRow[];
  ledger: Record<string, unknown>[];
  ticks: TickRow[];
  metrics: Record<string, unknown>;
  policies: { key: string; value: unknown; category: string; note: string }[];
  grants: { agentCode: string; capability: string }[];
  village: {
    population: number; byDivision: Record<string, number>;
    bySource: { SIMULASI: number; CENSUS: number };
    byEmbodiment: { EMBODIED: number; DREAMING: number; MISSING: number };
    retired: number; villagers: VillagerRow[]; wagesPaid: number;
    directives: { queued: number; dispatched: number; applied: number; failed: number; expired: number };
    market: { open: number; closed: number; totalUnitsSold: number; offers: OfferRow[] };
  };
  guild: GuildStats;
  tools: { stats: ToolStats; calls: ToolCallRow[]; artifacts: ArtifactRow[] };
  mcStatus: { online: boolean; latencyMs?: number | null; version?: string; players?: number; error?: string; checkedAt?: string | null; note?: string };
  mcServer: McServerInfo;
  lastTick: TickRow | null;
  counts: { orgs: number; agents: number; events: number; txns: number; memories: number; tasks: number; artifacts: number; toolCalls: number };
  serverTime: string;
}

// ---------- Identitas guild ----------

const GUILD_META: { key: string; label: string; desc: string; icon: typeof Users; accent: string }[] = [
  { key: "CODER", label: "Pemrogram", desc: "kode nyata peradaban", icon: Code2, accent: "text-emerald-300 border-emerald-500/40" },
  { key: "DEV", label: "Pengembang", desc: "spesifikasi & produk", icon: GitBranch, accent: "text-teal-300 border-teal-500/40" },
  { key: "BUILDER", label: "Pembangun", desc: "konstruksi dunia", icon: Hammer, accent: "text-amber-300 border-amber-500/40" },
  { key: "MILITARY", label: "Garda", desc: "patroli & pertahanan", icon: Shield, accent: "text-red-300 border-red-500/40" },
  { key: "ENGINEER", label: "Insinyur", desc: "infrastruktur desa", icon: Wrench, accent: "text-orange-300 border-orange-500/40" },
  { key: "MINER", label: "Penambang", desc: "sumber daya ke pasar", icon: Pickaxe, accent: "text-yellow-300 border-yellow-500/40" },
  { key: "NETRUNNER", label: "Penyambung Internet", desc: "riset internet NYATA", icon: Globe, accent: "text-cyan-300 border-cyan-500/40" },
  { key: "TOOLSMITH", label: "Pengrajin Alat", desc: "orkestrasi semua tool", icon: Cog, accent: "text-lime-300 border-lime-500/40" },
];

const TOOL_META: Record<string, { label: string; external: boolean }> = {
  web_search: { label: "Pencari Internet", external: true },
  page_reader: { label: "Pembaca Halaman", external: true },
  code_write: { label: "Penulis Kode", external: false },
  spec_write: { label: "Penulis Spesifikasi", external: false },
  build_plan: { label: "Perancang Bangunan", external: false },
  mine_route: { label: "Perancang Tambang", external: false },
  patrol_report: { label: "Laporan Patroli", external: false },
};

const ARTIFACT_COLOR: Record<string, string> = {
  CODE: "bg-emerald-500/15 text-emerald-300",
  SPEC: "bg-teal-500/15 text-teal-300",
  BLUEPRINT: "bg-amber-500/15 text-amber-300",
  PATROL: "bg-red-500/15 text-red-300",
  MINE_YIELD: "bg-yellow-500/15 text-yellow-300",
  RESEARCH: "bg-cyan-500/15 text-cyan-300",
  REPORT: "bg-lime-500/15 text-lime-300",
};

// ---------- Util kecil ----------

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "-";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}j`;
  return `${Math.floor(s / 86400)}h`;
}

function evText(e: EventRow): string {
  const p = e.payload ?? {};
  const a = typeof p.aksi === "string" ? p.aksi : null;
  const r = typeof p.ringkasan === "string" ? p.ringkasan : typeof p.catatan === "string" ? p.catatan : null;
  const nama = typeof p.nama === "string" ? `${p.nama} · ` : "";
  return `${nama}${a ?? e.type}${r ? ` — ${r}` : ""}`;
}

function evColor(type: string): string {
  if (type === "TOOL_INVOKED") return "text-cyan-300";
  if (type === "ARTIFACT_CREATED") return "text-emerald-300";
  if (type === "WAGE_PAID" || type === "TRADE_INTERNAL") return "text-amber-300";
  if (type === "VILLAGER_DIRECTIVE") return "text-lime-300";
  if (type === "POLICY_VIOLATION" || type === "TASK_FAILED") return "text-red-300";
  if (type === "MC_STATUS") return "text-violet-300";
  return "text-[#7f9a89]";
}

function accountBalanceOf(st: CivStatePayload, accountId: string): number {
  for (const o of st.orgs) {
    const a = o.accounts.find((x) => x.id === accountId);
    if (a) return a.balance;
  }
  return 0;
}

// ---------- Komponen utama ----------

export function CivitasDashboard() {
  const [st, setSt] = useState<CivStatePayload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [toolSel, setToolSel] = useState<string>("web_search");
  const [toolQuery, setToolQuery] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/civos/state", { cache: "no-store" });
      if (res.ok) {
        const j = (await res.json()) as { ok?: boolean; state?: CivStatePayload };
        if (j.state) setSt(j.state); // route membungkus payload dalam {ok, state}
      }
    } catch { /* jaringan — coba lagi denyut berikutnya */ }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  const act = useCallback(async (action: string, params?: Record<string, unknown>, label = action) => {
    setBusy(action);
    setFlash(null);
    try {
      const res = await fetch("/api/civos/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, params: params ?? {} }),
      });
      const j = (await res.json()) as Record<string, unknown>;
      const note = typeof j.note === "string" ? j.note : typeof j.summary === "string" ? j.summary : typeof j.error === "string" ? j.error : JSON.stringify(j).slice(0, 160);
      setFlash({ ok: res.ok && j.ok !== false, text: `${label}: ${note}` });
      await load();
      return j;
    } catch (e) {
      setFlash({ ok: false, text: `${label} gagal: ${e instanceof Error ? e.message.slice(0, 120) : "tak diketahui"}` });
      return null;
    } finally {
      setBusy(null);
    }
  }, [load]);

  const runTool = useCallback(async () => {
    const params: Record<string, unknown> = { tool: toolSel };
    const q = toolQuery.trim();
    if (q) {
      if (toolSel === "web_search") params.query = q;
      else if (toolSel === "page_reader") params.url = q;
      else if (toolSel === "build_plan") params.structure = q;
      else if (toolSel === "spec_write") params.product = q;
      else if (toolSel === "code_write") params.unit = q;
    }
    await act("tool_run", params, `TOOL ${toolSel}`);
  }, [act, toolSel, toolQuery]);

  if (!st) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-[#7f9a89]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#4ade80]" />
        <p className="catalog !text-[10px] tracking-[0.3em]">MENYAMBUNG KE CIVILIZATION KERNEL…</p>
      </div>
    );
  }

  const nation = st.orgs.find((o) => o.kind === "NATION");
  const gov = st.orgs.find((o) => o.kind === "GOVERNMENT");
  const taxAcc = gov?.accounts.find((a) => a.kind === "TAX");
  const aliveCompanies = st.orgs.filter((o) => o.kind === "COMPANY" && !["BANKRUPT", "DISSOLVED"].includes(o.lifecycle));
  const guildMembers = GUILD_META.map((g) => ({ ...g, members: st.guild.byDivision[g.key] ?? 0, latest: st.guild.latest[g.key] }));
  const guildActive = guildMembers.filter((g) => g.members > 0).length;
  const metricsMap = (st.metrics ?? {}) as unknown as Record<string, unknown>;
  const treasuryBalance = Number(metricsMap.treasury ?? 0); // kas bangsa dari EconomyMetrics (ledger otoritatif)
  const extReal = Number(metricsMap.externalRevenueReal ?? 0);
  const extSandbox = Number(metricsMap.externalRevenueSandbox ?? 0);
  const mapEntities: MapEntity[] = st.orgs
    .filter((o) => ["GOVERNMENT", "COMPANY", "CITY", "NATION"].includes(o.kind))
    .slice(0, 8)
    .map((o, i) => ({
      mcType: o.kind === "CITY" ? "DISTRICT" : "BUILDING",
      mcName: o.name,
      civCode: o.code,
      coords: { x: (i - 3) * 16, z: i % 2 === 0 ? 10 : -10 },
    }));

  const taxRate = Number(st.policies.find((p) => p.key === "TAX_RATE_EXTERNAL")?.value ?? 0.1);

  return (
    <div className="min-h-screen bg-[#050b08] text-[#c9e5d4]">
      {/* ===== HEADER ===== */}
      <header className="border-b border-[#1a2e22] bg-[#070d0a]">
        <div className="px-4 sm:px-6 pt-5 pb-4 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <Landmark className="w-6 h-6 text-[#4ade80]" aria-hidden />
              <h1 className="text-lg sm:text-xl font-mono tracking-[0.18em] text-[#e8fff2]">
                CIVITAS <span className="text-[#4ade80]">COMMAND CENTER</span>
              </h1>
              <span className="catalog !text-[9px] border border-[#4ade80]/40 text-[#4ade80] px-2 py-0.5">SLICE 1–9 LIVE</span>
            </div>
            <p className="catalog mt-1.5 !text-[10px] text-[#7f9a89]">
              {nation?.name ?? "Nusantara Digital"} · denyut otonom 24/7 · ledger double-entry · warga = villager Minecraft yang naik derajat
            </p>
            <p className="catalog mt-1 !text-[10px] text-[#7f9a89]" data-testid="mc-server-line">
              <Blocks className="inline w-3 h-3 mr-1 -mt-0.5" aria-hidden />
              SERVER: <span className="text-[#bfe8cc]">{st.mcServer.host}:{st.mcServer.port}</span>
              {" · "}{st.mcServer.edition} <span className="text-[#bfe8cc]">{st.mcStatus.version ?? st.mcServer.version}</span>
              {" · "}<span className="text-[#4ade80]">{st.mcServer.invite}</span>
            </p>
          </div>
          <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`catalog !text-[9px] px-2 py-1 border ${st.mcStatus.online ? "border-emerald-400/50 text-emerald-300" : "border-amber-500/40 text-amber-300"}`} data-testid="mc-chip">
                {st.mcStatus.online ? `● DUNIA ONLINE${st.mcStatus.latencyMs != null ? ` ${st.mcStatus.latencyMs}ms` : ""}` : "○ DUNIA TIDUR"}
              </span>
              <span className="catalog !text-[9px] px-2 py-1 border border-[#2a4433] text-[#7f9a89]">{st.serverTime.slice(11, 19)} UTC</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => void act("tick", {}, "DENYUT")}
                disabled={busy !== null}
                className="min-h-[44px] px-4 border border-[#4ade80]/60 bg-[#0d1a12] hover:bg-[#12241a] text-[#4ade80] font-mono text-xs tracking-wider transition-colors disabled:opacity-50"
                data-testid="btn-tick"
              >
                <Activity className="inline w-4 h-4 mr-1.5 -mt-0.5" aria-hidden />
                {busy === "tick" ? "MENDENYUT…" : "DENYUT SEKARANG"}
              </button>
              <button
                onClick={() => void act("ping_minecraft", {}, "PING MC")}
                disabled={busy !== null}
                className="min-h-[44px] px-4 border border-[#2a4433] hover:bg-[#0b140f] text-[#bfe8cc] font-mono text-xs tracking-wider transition-colors disabled:opacity-50"
              >
                PING DUNIA
              </button>
              <button
                onClick={() => void act("village_census", { count: 8 }, "SENSUS GUILD")}
                disabled={busy !== null}
                className="min-h-[44px] px-4 border border-[#2a4433] hover:bg-[#0b140f] text-[#bfe8cc] font-mono text-xs tracking-wider transition-colors disabled:opacity-50"
              >
                SENSUS GUILD
              </button>
            </div>
          </div>
        </div>
        {flash && (
          <div className={`px-4 sm:px-6 py-2 text-xs font-mono border-t ${flash.ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-amber-500/30 bg-amber-500/5 text-amber-300"}`} data-testid="flash" role="status">
            {flash.ok ? "✓ " : "! "}{flash.text}
          </div>
        )}
      </header>

      {/* ===== KPI STRIP ===== */}
      <section className="px-4 sm:px-6 py-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" aria-label="Indikator utama">
        <Kpi label="KAS BANGSA" value={fmt(treasuryBalance)} hint="FLR minor unit — ledger otoritatif" accent="text-amber-300" testid="kpi-kas" />
        <Kpi label="REVENUE EKSTERNAL RIIL" value={fmt(extReal)} hint={extSandbox > 0 ? `+${fmt(extSandbox)} sandbox` : "jujur: belum ada pelanggan nyata"} accent={extReal > 0 ? "text-emerald-300" : "text-amber-300"} testid="kpi-revenue" />
        <Kpi label="KAS PAJAK" value={taxAcc ? fmt(accountBalanceOf(st, taxAcc.id)) : "-"} hint={`tarif ${taxRate * 100}% revenue eksternal`} accent="text-lime-300" testid="kpi-pajak" />
        <Kpi label="POPULASI & GUILD" value={`${st.village.population} · ${guildActive}/8`} hint={`${st.village.bySource.CENSUS} census · ${st.village.bySource.SIMULASI} sim · ${aliveCompanies.length} perusahaan hidup`} accent="text-[#4ade80]" testid="kpi-populasi" />
        <Kpi label="ARTEFAK KERJA" value={String(st.counts.artifacts)} hint={`${st.counts.toolCalls} panggilan tool teraudit`} accent="text-cyan-300" testid="kpi-artefak" />
        <Kpi label="EVENT IMMUTABLE" value={String(st.counts.events)} hint={`${st.counts.txns} tx · ${st.counts.memories} memori · ${st.counts.agents} agen`} accent="text-[#bfe8cc]" testid="kpi-event" />
      </section>

      {/* ===== GRID UTAMA ===== */}
      <main className="px-4 sm:px-6 pb-10 grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ---- Kolom kiri (2/3) ---- */}
        <div className="xl:col-span-2 space-y-5 min-w-0">
          <Panel title="GUILD KERJA" icon={Users} sub="8 divisi spesialis — pekerjaan nyata, bukan klaim" testid="panel-guild">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {guildMembers.map((g) => (
                <div key={g.key} className={`border bg-[#081209] p-3 flex flex-col gap-1.5 ${g.members > 0 ? g.accent : "border-[#1a2e22] text-[#4a5f53]"}`} data-testid={`guild-${g.key}`}>
                  <div className="flex items-center justify-between">
                    <g.icon className="w-4 h-4" aria-hidden />
                    <span className="font-mono text-sm">{g.members} org</span>
                  </div>
                  <div className="font-mono text-[11px] tracking-wide uppercase">{g.label}</div>
                  <div className="text-[10px] leading-snug opacity-80">{g.desc}</div>
                  <div className="mt-auto pt-1 text-[9px] font-mono truncate opacity-70" title={g.latest?.title}>
                    {g.latest ? `terakhir: ${g.latest.title}` : "belum ada artefak"}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="catalog !text-[9px] text-[#7f9a89]">warga:</span>
              {st.village.villagers.slice(0, 12).map((v) => (
                <span key={v.code} className="catalog !text-[9px] border border-[#1a2e22] px-1.5 py-0.5" title={`${v.code} · ${v.profession} · guild ${v.division} · ${fmt(v.wallet)} FLR`}>
                  {v.name.split(" ")[0]}<span className="text-[#4ade80]">·{v.division === "GENERAL" ? "wrg" : v.division.slice(0, 4).toLowerCase()}</span>
                </span>
              ))}
              {st.village.population > 12 && <span className="catalog !text-[9px] text-[#7f9a89]">+{st.village.population - 12} lagi</span>}
            </div>
          </Panel>

          <Panel title="TOOLFORGE" icon={Cog} sub="tool calling teraudit — internet nyata berlabel sumber" testid="panel-toolforge">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <select
                    value={toolSel}
                    onChange={(e) => setToolSel(e.target.value)}
                    aria-label="Pilih tool"
                    className="min-h-[44px] bg-[#081209] border border-[#2a4433] px-3 font-mono text-xs text-[#bfe8cc] focus:outline-none focus:border-[#4ade80]"
                  >
                    {Object.entries(TOOL_META).map(([k, m]) => (
                      <option key={k} value={k}>{m.label}{m.external ? " ⛭ internet" : ""}</option>
                    ))}
                  </select>
                  <input
                    value={toolQuery}
                    onChange={(e) => setToolQuery(e.target.value)}
                    placeholder={toolSel === "web_search" ? "kueri riset (mis. harga gandum dunia)" : toolSel === "page_reader" ? "https://…" : "opsional — detail untuk tool"}
                    aria-label="Parameter tool"
                    className="min-h-[44px] flex-1 bg-[#081209] border border-[#2a4433] px-3 font-mono text-xs text-[#bfe8cc] placeholder:text-[#4a5f53] focus:outline-none focus:border-[#4ade80]"
                  />
                  <button
                    onClick={() => void runTool()}
                    disabled={busy !== null}
                    className="min-h-[44px] px-4 border border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 font-mono text-xs tracking-wider disabled:opacity-50"
                    data-testid="btn-tool-run"
                  >
                    {busy === "tool_run" ? "MENJALANKAN…" : "JALANKAN TOOL"}
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {Object.entries(TOOL_META).map(([k, m]) => (
                    <li key={k} className="flex items-center gap-2 text-[10px] font-mono">
                      <span className={m.external ? "text-cyan-300" : "text-emerald-300"}>{m.external ? "⚑" : "▪"}</span>
                      <span className="text-[#bfe8cc] w-36 shrink-0">{m.label}</span>
                      <span className="text-[#7f9a89] flex-1 truncate">{k}</span>
                      <span className="text-[#4ade80]">{st.tools.stats.byTool[k] ?? 0}×</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="max-h-64 overflow-y-auto pr-1" data-testid="tool-calls">
                <p className="catalog !text-[9px] text-[#7f9a89] mb-2">PANGGILAN TERAKHIR (audit immutable)</p>
                {st.tools.calls.length === 0 && <p className="text-[10px] text-[#4a5f53] font-mono">belum ada panggilan — jalankan tool pertama</p>}
                {st.tools.calls.map((c) => (
                  <div key={c.id} className="border border-[#13221a] bg-[#081209] px-2.5 py-1.5 mb-1.5 flex items-center gap-2">
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 shrink-0 ${c.status === "OK" ? "bg-emerald-500/15 text-emerald-300" : c.status === "DENIED" ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"}`}>{c.status}</span>
                    <span className="font-mono text-[10px] text-cyan-300 w-20 shrink-0 truncate">{TOOL_META[c.tool]?.label ?? c.tool}</span>
                    <span className="text-[10px] text-[#7f9a89] flex-1 truncate">{c.callerName} ({c.callerCode})</span>
                    <span className="text-[9px] font-mono text-[#4a5f53] shrink-0">{c.latencyMs}ms · {timeAgo(c.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="PETA PERADABAN" icon={Landmark} sub="world layer — bangunan mengikuti keadaan organisasi" testid="panel-peta">
            <div className="h-[260px]">
              <CivMapCanvas entities={mapEntities} orgs={st.orgs.map((o) => ({ code: o.code, lifecycle: o.lifecycle }))} pulseAt={st.lastTick ? new Date(st.lastTick.at).getTime() : 0} agentCount={st.counts.agents + st.village.population} />
            </div>
          </Panel>

          <Panel title="DENYUT & EVENT IMMUTABLE" icon={ScrollText} sub={`${st.counts.events} event tercatat — tak pernah diubah`} testid="panel-event">
            <div className="max-h-72 overflow-y-auto pr-1 space-y-1">
              {st.ticks.slice(0, 5).map((t, i) => (
                <div key={`tick-${i}`} className="flex items-start gap-2 text-[10px] font-mono border-l-2 border-[#4ade80]/50 pl-2 py-0.5" data-testid="tick-row">
                  <span className="text-[#4ade80] shrink-0">T{t.tick}</span>
                  <span className="text-[#bfe8cc] flex-1">{t.target}: {t.summary}</span>
                  <span className="text-[#4a5f53] shrink-0">{timeAgo(t.at)}</span>
                </div>
              ))}
              {st.events.slice(0, 40).map((e) => (
                <div key={e.seq} className="flex items-start gap-2 text-[10px] font-mono border-l-2 border-[#13221a] pl-2 py-0.5">
                  <span className={`${evColor(e.type)} shrink-0 w-28 truncate`} title={e.type}>{e.type}</span>
                  <span className="text-[#7f9a89] flex-1">{evText(e)}</span>
                  <span className="text-[#4a5f53] shrink-0">{timeAgo(e.createdAt)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* ---- Kolom kanan (1/3) ---- */}
        <div className="space-y-5 min-w-0">
          <Panel title="PANEL KEJUJURAN" icon={Activity} sub="radical honesty — status apa adanya" testid="panel-kejujuran">
            <ul className="space-y-2 text-[11px] font-mono">
              <TruthRow ok={extReal > 0} label="Revenue eksternal riil" value={extReal > 0 ? fmt(extReal) : "0 — PRE_REVENUE (jujur)"} />
              <TruthRow ok label="Pajak revenue eksternal" value={`${Math.round(taxRate * 100)}% — otomatis di denyut TAX`} />
              <TruthRow ok label="Sensus warga" value={st.village.bySource.CENSUS > 0 ? `${st.village.bySource.CENSUS} CENSUS nyata` : "SIMULASI berlabel — menunggu dunia hidup"} />
              <TruthRow ok={st.mcStatus.online} label="Dunia Minecraft" value={st.mcStatus.online ? "ONLINE — bot auto-join" : `TIDUR — ${st.mcStatus.error?.slice(0, 60) ?? "Aternos free tidur otomatis"}`} />
              <TruthRow ok label="Tubuh warga (direktif)" value={`${st.village.directives.applied} applied · ${st.village.directives.queued} antre · ${st.village.directives.failed} gagal jujur`} />
              <TruthRow ok={extReal > 0} label="Rail settlement" value={extSandbox > 0 ? "teruji SANDBOX; live terkunci EXTERNAL_SETTLEMENT_LIVE" : "menunggu pelanggan nyata"} />
            </ul>
          </Panel>

          <Panel title="PUSTAKA ARTEFAK" icon={BrainCircuit} sub="bukti kerja guild — kode, blueprint, riset" testid="panel-artefak">
            <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
              {st.tools.artifacts.length === 0 && <p className="text-[10px] text-[#4a5f53] font-mono">belum ada artefak — jalankan WORK warga atau TOOL</p>}
              {st.tools.artifacts.map((a) => (
                <div key={a.id} className="border border-[#13221a] bg-[#081209] p-2.5" data-testid="artifact-row">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 shrink-0 ${ARTIFACT_COLOR[a.kind] ?? "bg-[#13221a] text-[#7f9a89]"}`}>{a.kind}</span>
                    <span className="text-[11px] font-mono text-[#bfe8cc] flex-1 truncate" title={a.title}>{a.title}</span>
                    <span className="text-[9px] font-mono text-[#4a5f53] shrink-0">{timeAgo(a.createdAt)}</span>
                  </div>
                  <p className="text-[10px] text-[#7f9a89] leading-snug">{a.contentPreview.slice(0, 160)}{a.contentPreview.length > 160 ? "…" : ""}</p>
                  <p className="text-[9px] font-mono text-[#4a5f53] mt-1">{a.authorName} ({a.authorCode}) · guild {a.division}{a.tool ? ` · via ${a.tool}` : ""}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="PASAR DESA" icon={Store} sub={`${st.village.market.open} listing open · ${st.village.market.totalUnitsSold} unit terjual`} testid="panel-pasar">
            <div className="max-h-56 overflow-y-auto pr-1 space-y-1.5">
              {st.village.market.offers.length === 0 && <p className="text-[10px] text-[#4a5f53] font-mono">pasar kosong — PRODUCE perusahaan otomatis melist barang</p>}
              {st.village.market.offers.map((o) => (
                <div key={o.id} className="flex items-center gap-2 border border-[#13221a] bg-[#081209] px-2.5 py-1.5 text-[10px] font-mono">
                  <span className="text-amber-300">{fmt(o.unitPrice)}</span>
                  <span className="text-[#bfe8cc] flex-1 truncate">{o.item}</span>
                  <span className="text-[#7f9a89]">stok {o.qtyAvailable}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="WARGA BERDENYUT" icon={Users} sub="identitas ≠ tubuh — dompet di ledger yang sama" testid="panel-warga">
            <div className="max-h-72 overflow-y-auto pr-1 space-y-1.5">
              {st.village.villagers.map((v) => (
                <div key={v.code} className="border border-[#13221a] bg-[#081209] px-2.5 py-1.5">
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-[#4ade80]">{v.name}</span>
                    <span className="text-[#7f9a89]">{v.code}</span>
                    <span className={`ml-auto px-1.5 py-0.5 text-[9px] shrink-0 ${v.division === "GENERAL" ? "bg-[#13221a] text-[#7f9a89]" : "bg-[#4ade80]/10 text-[#4ade80]"}`}>{v.division}</span>
                  </div>
                  <p className="text-[9px] font-mono text-[#7f9a89] mt-0.5 truncate" title={v.lastAction ?? ""}>
                    {v.lastAction ?? "belum bertindak"} · dompet {fmt(v.wallet)} · {timeAgo(v.lastActionAt)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="KEBIJAKAN (DI LUAR LLM)" icon={Shield} sub={`${st.policies.length} aturan — LLM tak bisa mengubah`} testid="panel-policy">
            <div className="max-h-52 overflow-y-auto pr-1 space-y-1">
              {st.policies.slice(0, 24).map((p) => (
                <div key={p.key} className="flex items-baseline gap-2 text-[9px] font-mono">
                  <span className="text-[#bfe8cc] w-44 shrink-0 truncate" title={p.key}>{p.key}</span>
                  <span className="text-[#4ade80]">{typeof p.value === "object" ? JSON.stringify(p.value).slice(0, 40) : String(p.value)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </main>

      {/* ===== FOOTER HONESTY ===== */}
      <footer className="mt-auto border-t border-[#1a2e22] bg-[#070d0a] px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
          <span className="catalog">CIVITAS OS — peradaban berdenyut tanpa perintah manusia · intelligence ≠ authority · failure = state valid · reality wins</span>
          <span className="catalog !text-[9px] text-[#4a5f53]">denyut terakhir: {st.lastTick ? `T${st.lastTick.tick} ${timeAgo(st.lastTick.at)} lalu` : "belum ada"}</span>
        </div>
      </footer>
    </div>
  );
}

// ---------- Sub-komponen ----------

function Kpi({ label, value, hint, accent, testid }: { label: string; value: string; hint: string; accent: string; testid?: string }) {
  return (
    <div className="border border-[#1a2e22] bg-[#081209] p-3 min-h-[86px] flex flex-col" data-testid={testid}>
      <span className="catalog !text-[8px] text-[#7f9a89] tracking-[0.2em]">{label}</span>
      <span className={`font-mono text-lg sm:text-xl mt-1 ${accent}`}>{value}</span>
      <span className="text-[9px] font-mono text-[#4a5f53] mt-auto leading-tight">{hint}</span>
    </div>
  );
}

function TruthRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <li className="flex items-start gap-2" data-testid={ok ? "truth-ok" : "truth-warn"}>
      <span className={ok ? "text-emerald-400" : "text-amber-400"} aria-hidden>{ok ? "●" : "▲"}</span>
      <span className="text-[#7f9a89] w-40 shrink-0">{label}</span>
      <span className={`flex-1 ${ok ? "text-[#bfe8cc]" : "text-amber-300"}`}>{value}</span>
    </li>
  );
}

function Panel({ title, icon: Icon, sub, children, testid }: { title: string; icon: typeof Users; sub?: string; children: React.ReactNode; testid?: string }) {
  return (
    <section className="border border-[#1a2e22] bg-[#060c08]" data-testid={testid}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1a2e22]">
        <Icon className="w-4 h-4 text-[#4ade80]" aria-hidden />
        <h2 className="font-mono text-xs tracking-[0.2em] text-[#e8fff2]">{title}</h2>
        {sub && <span className="catalog !text-[9px] text-[#7f9a89] ml-auto hidden sm:block">{sub}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
