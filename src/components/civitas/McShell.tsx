"use client";
// CIVITAS OS — McShell.tsx: shell aplikasi bergaya Minecraft + denyut otonom.
// UI OTONOM (mandat #3): state peradaban di-poll tiap 4 dtk; aksi tetap manual.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MCBadge, MCButton } from "./mcui";

/* ---------- Konteks state ---------- */

export interface CivStateRec {
  metrics: Record<string, unknown>;
  counts: Record<string, number>;
  village: Record<string, unknown> & { villagers?: VillagerRec[] };
  guild: Record<string, unknown>;
  tools: { stats?: unknown; calls?: ToolCallRec[]; artifacts?: ArtifactRec[] };
  events: EventRec[];
  ledger: LedgerRec[];
  policies: PolicyRec[];
  ticks: TickRec[];
  entities: EntityRec[];
  orgs: OrgRec[];
  agents: AgentRec[];
  proposals: ProposalRec[];
  grants: { agentCode: string; capability: string; budgetCap: number }[];
  memories: MemoryRec[];
  mcStatus: { online?: boolean; latencyMs?: number | null; version?: string; players?: number; motd?: string; error?: string; checkedAt?: string };
  mcServer: { host: string; port: number; version: string; invite: string };
  chat: ChatRec[];
  mcp: McpRec[];
  console: ConsoleRec[];
  lastTick: TickRec | null;
  serverTime: string;
  [k: string]: unknown;
}
export interface VillagerRec { code: string; name: string; profession: string; profKey: string; role: string; division: string; source: string; embodiment: string; village: string; mood: string; xp: number; socialScore: number; wallet: number; workOrg: string | null; lastAction: string | null; lastActionAt: string | null; coords: string | null }
export interface EventRec { seq: number; type: string; subject: string; payload: Record<string, unknown>; at: string }
export interface LedgerRec { id: string; txType: string; purpose: string; isExternal: boolean; debit: string | null; credit: string | null; amount: number; account: string; at: string }
export interface PolicyRec { key: string; value: string; note: string }
export interface TickRec { tick: number; target: string; kind: string; summary: string; mode?: string; durationMs?: number; at: string; village?: string }
export interface EntityRec { id: string; mcType: string; mcName: string; mcCoords: unknown; civType: string; civCode: string; status: string; orgName: string | null }
export interface OrgRec { id: string; code: string; kind: string; name: string; lifecycle: string; specialization: string | null; createdAt: string; accounts: { id: string; kind: string; name: string; balance: number }[] }
export interface AgentRec { code: string; name: string; role: string; orgCode: string; orgKind: string; status: string; reputation: number }
export interface ProposalRec { id: string; kind: string; orgCode: string | null; institution: string; status: string; reason: string; decidedBy: string | null; createdAt: string }
export interface MemoryRec { id: string; ownerType: string; ownerId: string; scope: string; visibility: string; content: string; createdAt: string }
export interface ToolCallRec { id: string; tool: string; callerCode: string; callerName: string; status: string; note?: string; error?: string; latencyMs: number; at: string }
export interface ArtifactRec { id: string; kind: string; title: string; authorName: string; division: string; at: string }
export interface ChatRec { id: string; channel: string; from: string; villagerCode: string | null; senderName: string; body: string; route: string | null; directiveId: string | null; at: string }
export interface McpRec { id: string; name: string; transport: string; endpoint: string; enabled: boolean; lastStatus: string; lastError: string | null; toolCount: number }
export interface ConsoleRec { id: string; command: string; response: string; ok: boolean; source: string; at: string }

interface Ctx {
  s: CivStateRec | null;
  loading: boolean;
  flash: string | null;
  refresh: () => Promise<void>;
  act: (action: string, params?: Record<string, unknown>, label?: string) => Promise<Record<string, unknown>>;
}
const CivCtx = createContext<Ctx>({ s: null, loading: false, flash: null, refresh: async () => {}, act: async () => ({}) });
export const useCiv = () => useContext(CivCtx);

/* ---------- Navigasi hotbar ---------- */

const NAV: { key: string; label: string; icon: string }[] = [
  { key: "citadel", label: "CITADEL", icon: "🏛" },
  { key: "play", label: "MAIN MC", icon: "🎮" },
  { key: "server", label: "SERVER", icon: "🖥" },
  { key: "cloud", label: "CLOUD DB", icon: "☁" },
  { key: "organism", label: "ORGANISME", icon: "🧬" },
  { key: "map", label: "PETA", icon: "🗺" },
  { key: "citizens", label: "WARGA", icon: "🧑‍🌾" },
  { key: "guild", label: "GUILD", icon: "⚒" },
  { key: "gov", label: "PEMERINTAH", icon: "⚖" },
  { key: "companies", label: "PERUSAHAAN", icon: "🏭" },
  { key: "economy", label: "EKONOMI", icon: "💰" },
  { key: "world", label: "DUNIA", icon: "🌍" },
  { key: "config", label: "KONFIG", icon: "⚙" },
  { key: "graph", label: "ARSITEK", icon: "🕸" },
  { key: "docs", label: "PUSTAKA", icon: "📜" },
  { key: "events", label: "EVENT", icon: "🕰" },
];

export function McShell() {
  const [s, setS] = useState<CivStateRec | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [view, setView] = useState("citadel");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/civos/state", { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; state?: CivStateRec } | CivStateRec;
      const st = (j as { state?: CivStateRec }).state ?? (j as CivStateRec);
      if (st && typeof st === "object") setS(st);
    } catch { /* jaringan — poll berikutnya */ } finally {
      setLoading(false);
    }
  }, []);

  const act = useCallback(async (action: string, params?: Record<string, unknown>, label?: string) => {
    setFlash(label ?? "memproses…");
    try {
      const res = await fetch("/api/civos/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, params: params ?? {} }),
      });
      const j = (await res.json()) as Record<string, unknown>;
      const note = (j.note ?? j.detail ?? j.response ?? (j.ok ? "berhasil" : (j.error as string) ?? "selesai")) as string;
      setFlash(String(note).slice(0, 120));
      await refresh();
      return j;
    } catch (e) {
      setFlash(e instanceof Error ? e.message.slice(0, 100) : "gagal");
      return { ok: false };
    } finally {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 4200);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000); // denyut UI otonom
    return () => clearInterval(t);
  }, [refresh]);

  const View = useMemo(() => VIEWS[view] ?? VIEWS.citadel, [view]);

  const online = s?.mcStatus?.online === true;
  const villageCount = Array.isArray(s?.village?.villagers) ? (s!.village.villagers as VillagerRec[]).length : 0;

  return (
    <CivCtx.Provider value={{ s, loading, flash, refresh, act }}>
      <div className="mc-bg min-h-screen flex flex-col text-white">
        {/* HEADER */}
        <header className="border-b-4 border-[color:var(--mc-panel-dark)] bg-[#232327]/90 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="mc-font mc-title-anim text-[13px] sm:text-base text-[color:var(--mc-grass)]">CIVITAS OS</span>
            <span className="hidden sm:inline mc-font text-[9px] text-white/60">PERADABAN NUSANTARA DIGITAL</span>
            <span className="flex-1" />
            <MCBadge tone={online ? "green" : "red"}>{online ? `DUNIA ONLINE ${s?.mcStatus?.latencyMs ?? "?"}ms` : "DUNIA TIDUR"}</MCBadge>
            <MCBadge tone="diamond">{villageCount} WARGA</MCBadge>
            <MCBadge tone="gold">v1.5</MCBadge>
          </div>
          {/* HOTBAR NAV */}
          <nav className="max-w-7xl mx-auto px-4 pb-3">
            <div className="flex gap-1 overflow-x-auto mc-scroll pb-1">
              {NAV.map((n) => (
                <button
                  key={n.key}
                  onClick={() => setView(n.key)}
                  data-active={view === n.key}
                  className="mc-hotbar-slot shrink-0"
                  aria-label={n.label}
                >
                  <span className="text-lg leading-none" aria-hidden>{n.icon}</span>
                  <span className="mc-font text-[6px] mt-1">{n.label}</span>
                </button>
              ))}
            </div>
          </nav>
          {flash ? (
            <div className="bg-[color:var(--mc-gold)] text-black mc-font text-[9px] px-4 py-2">{flash}</div>
          ) : null}
        </header>

        {/* KONTEN */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          <View />
        </main>

        {/* FOOTER kejujuran + ticker */}
        <footer className="border-t-4 border-[color:var(--mc-panel-dark)] bg-[#232327] mt-auto">
          <div className="mc-ticker border-b border-black/40 py-1.5 mc-font text-[8px] text-[color:var(--mc-xp)]">
            <span>
              {s?.lastTick ? `TICK TERAKHIR: [${s.lastTick.kind}] ${s.lastTick.target} — ${s.lastTick.summary}` : "KONSOL DINGIN — PICU DENYUT"} ·{" "}
              {online ? `SERVER ${s?.mcServer?.host}:${s?.mcServer?.port} MERESPONS` : "SERVER MINECRAFT TIDUR — BOT + SENSUS ARMED"} ·{" "}
              REVENUE EKSTERNAL RIIL: {String((s?.metrics as Record<string, unknown>)?.externalRevenueRealLabel ?? "0")} ·{" "}
              {"REALITY WINS: STATUS HANYA BERTAMBAH DENGAN BUKTI"} ·{" "}
            </span>
          </div>
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap gap-2 items-center justify-between">
            <p className="mc-font text-[8px] text-white/50">CIVITAS OS v1.5 &quot;CITADEL&quot; — dibangun untuk Mulky Malikul Dhaher · mulkymalikuldhr@mail.com</p>
            <p className="mc-font text-[8px] text-white/50">Intelligence ≠ Authority · Ledger double-entry · Event immutable</p>
          </div>
        </footer>
      </div>
    </CivCtx.Provider>
  );
}

/* ---------- Registry view (lazy import statis sederhana) ---------- */

import CitadelView from "./views/CitadelView";
import OrganismView from "./views/OrganismView";
import MapView from "./views/MapView";
import CitizensView from "./views/CitizensView";
import GuildView from "./views/GuildView";
import GovView from "./views/GovView";
import CompaniesView from "./views/CompaniesView";
import EconomyView from "./views/EconomyView";
import WorldView from "./views/WorldView";
import ConfigView from "./views/ConfigView";
import GraphView from "./views/GraphView";
import DocsView from "./views/DocsView";
import EventsView from "./views/EventsView";
import ServersView from "./views/ServersView";
import CloudDbView from "./views/CloudDbView";
import PlayView from "./views/PlayView";

const VIEWS: Record<string, () => React.JSX.Element> = {
  citadel: CitadelView,
  play: PlayView,
  server: ServersView,
  cloud: CloudDbView,
  organism: OrganismView,
  map: MapView,
  citizens: CitizensView,
  guild: GuildView,
  gov: GovView,
  companies: CompaniesView,
  economy: EconomyView,
  world: WorldView,
  config: ConfigView,
  graph: GraphView,
  docs: DocsView,
  events: EventsView,
};
