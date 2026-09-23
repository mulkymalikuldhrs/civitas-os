"use client";

// 07 BIOSFER — ekosistem 6 creature otonom (11_AUTONOMOUS_ORGANISM.md §5).
// Kanvas ekosistem hidup + inspektor creature + feed bus kejadian + panel quant mini.
// Gaya: laboratorium saraf malam (konsisten RuangKendaliView). Semua angka
// kehidupan creature = state lokal pemilik; angka portofolio = SIMULASI LOKAL.

import { useMemo, useState } from "react";
import {
  Activity,
  Bug,
  Coins,
  Crosshair,
  Dna,
  Hammer,
  HeartPulse,
  Microscope,
  Moon,
  PenLine,
  Radio,
  ShieldHalf,
  Sprout,
  Telescope,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useFlybrain } from "@/lib/flybrain/store";
import { CREATURES } from "@/lib/flybrain/organism/creatures";
import { EVENT_COLORS, type BiosferEventType } from "@/lib/flybrain/organism/eventBus";
import { organMeta, type OrganId } from "@/lib/flybrain/organism/loops";
import type { CreatureState } from "@/lib/flybrain/organism/creature";
import type { OrganismTrace } from "@/lib/flybrain/prt";

const CREATURE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Bug,
  TrendingUp,
  PenLine,
  Microscope,
  Sprout,
  Hammer,
};

const ORGAN_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  ShieldHalf,
  Coins,
  Radio,
  Telescope,
};

/** Posisi ekosistem (persen) — sebaran menyerupai lobus otak. */
const POSITIONS: Record<string, { left: string; top: string }> = {
  prt: { left: "20%", top: "30%" },
  tradio: { left: "74%", top: "24%" },
  scriba: { left: "48%", top: "54%" },
  lumen: { left: "16%", top: "74%" },
  cresca: { left: "80%", top: "68%" },
  fabro: { left: "54%", top: "84%" },
};

const PHASES: { key: keyof OrganismTrace["phases"]; label: string }[] = [
  { key: "sadar", label: "SADAR" },
  { key: "tafsir", label: "TAFSIR" },
  { key: "putuskan", label: "PUTUSKAN" },
  { key: "bertindak", label: "BERTINDAK" },
  { key: "ingat", label: "INGAT" },
];

const STATUS_LABEL: Record<CreatureState["status"], string> = {
  aktif: "AKTIF",
  tidur: "TIDUR",
  mati: "MATI",
};

function EnergyRing({ energy, color, dim }: { energy: number; color: string; dim: boolean }) {
  const r = 26;
  const C = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, energy)) / 100) * C;
  return (
    <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90 shrink-0" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#13241a" strokeWidth="4" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={`${filled} ${C}`}
        strokeLinecap="round"
        opacity={dim ? 0.3 : 0.95}
      />
    </svg>
  );
}

function StatusBadge({ status }: { status: CreatureState["status"] }) {
  const style =
    status === "aktif"
      ? { borderColor: "#274434", color: "#4ade80" }
      : status === "tidur"
        ? { borderColor: "#334155", color: "#94a3b8" }
        : { borderColor: "#7f1d1d", color: "#f87171" };
  return (
    <span className="catalog !text-[8px] border px-1.5 py-0.5" style={style}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="catalog !text-[9px]">{label}</span>
        <span className="font-mono text-[10px] text-[#bfe8cc]">{value.toLocaleString("id-ID")}</span>
      </div>
      <div className="mt-1 h-1.5 bg-[#0d1712] border border-[#13241a]">
        <div className="h-full" style={{ width: `${pct}%`, background: color, opacity: 0.85 }} />
      </div>
    </div>
  );
}

// ---------- Kanvas ekosistem ----------

function EcosystemCanvas({
  creatures,
  selectedId,
  onSelect,
}: {
  creatures: CreatureState[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="relative border border-[#13241a] bg-[#070d0a] grid-dots overflow-hidden"
      style={{ height: "clamp(340px, 52vw, 440px)" }}
      role="group"
      aria-label="Kanvas ekosistem BIOSFER"
    >
      {/* garis sinaps dekoratif antar lobus */}
      <svg className="absolute inset-0 w-full h-full opacity-30" aria-hidden>
        <line x1="20%" y1="30%" x2="48%" y2="54%" stroke="#1b2f24" strokeWidth="1" strokeDasharray="3 6" />
        <line x1="48%" y1="54%" x2="74%" y2="24%" stroke="#1b2f24" strokeWidth="1" strokeDasharray="3 6" />
        <line x1="48%" y1="54%" x2="80%" y2="68%" stroke="#1b2f24" strokeWidth="1" strokeDasharray="3 6" />
        <line x1="16%" y1="74%" x2="48%" y2="54%" stroke="#1b2f24" strokeWidth="1" strokeDasharray="3 6" />
      </svg>

      <span className="absolute top-2 left-3 catalog !text-[9px] text-[#4ade80]">KANVAS EKOSISTEM — 6 LOBUS</span>

      {creatures.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="catalog breathe">MENETASKAN CREATURE…</span>
        </div>
      )}

      {creatures.map((c, i) => {
        const meta = CREATURES.find((m) => m.id === c.id) ?? CREATURES[0];
        const Icon = CREATURE_ICONS[meta.icon] ?? Activity;
        const pos = POSITIONS[c.id] ?? { left: "50%", top: "50%" };
        const selected = selectedId === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            aria-pressed={selected}
            aria-label={`${c.name} — ${c.species} — status ${STATUS_LABEL[c.status]} — energi ${c.energy}`}
            className={`biosfer-float absolute flex flex-col items-center gap-1.5 px-2 py-1.5 rounded-sm transition-transform hover:scale-105 ${
              c.status === "tidur" || c.status === "mati" ? "opacity-70" : ""
            }`}
            style={{
              left: pos.left,
              top: pos.top,
              animationDelay: `${(i % 6) * 0.7}s`,
              animationDuration: `${5 + (i % 3)}s`,
            }}
          >
            <span className="relative inline-flex items-center justify-center">
              <EnergyRing energy={c.energy} color={meta.color} dim={c.status !== "aktif"} />
              <Icon
                className="w-6 h-6 absolute"
                style={{ color: meta.color, filter: selected ? `drop-shadow(0 0 8px ${meta.color})` : undefined }}
              />
              {c.status === "tidur" && <Moon className="w-3.5 h-3.5 absolute -right-1 -top-1 text-[#94a3b8]" />}
              {c.status === "mati" && <Crosshair className="w-3.5 h-3.5 absolute -right-1 -top-1 text-[#f87171]" />}
            </span>
            <span
              className={`catalog !text-[9px] px-1.5 py-0.5 border ${selected ? "glow-phos" : ""}`}
              style={{ color: meta.color, borderColor: selected ? meta.color : "#1b2f24", background: "rgba(7,13,10,0.8)" }}
            >
              {c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Inspektor creature ----------

function Inspector({ creature }: { creature: CreatureState | null }) {
  const decisionStream = useFlybrain((s) => s.decisionStream);
  const logs = useFlybrain((s) => s.logs);
  const setCreatureStatus = useFlybrain((s) => s.setCreatureStatus);

  if (!creature) {
    return (
      <div className="border border-dashed border-[#1b2f24] p-4 text-xs text-[#7f9a89] leading-relaxed" role="note">
        <p className="text-[#bfe8cc] mb-1.5">Inspektor kosong — pilih creature di kanvas.</p>
        Klik salah satu dari 6 creature untuk melihat genom, energi, kekayaan, jejak
        SADAR→TAFSIR→PUTUSKAN→BERTINDAK→INGAT, dan catatan ledger lokalnya.
      </div>
    );
  }

  const meta = CREATURES.find((m) => m.id === creature.id) ?? CREATURES[0];
  const OrganIcon = ORGAN_ICONS[organMeta(meta.organ).icon] ?? Activity;
  const trace = decisionStream.find((t) => t.creatureId === creature.id) ?? null;
  const episodes = logs.filter((l) => l.payload.channel === `biosfer.${creature.id}`).slice(0, 3);

  return (
    <div className="space-y-3" aria-label={`Inspektor ${creature.name}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="catalog !text-[9px] border px-2 py-0.5" style={{ borderColor: meta.color, color: meta.color }}>
          <Dna className="w-3 h-3 inline mr-1 -mt-0.5" />
          {creature.name} · {creature.species}
        </span>
        <StatusBadge status={creature.status} />
        <span className="catalog !text-[8px] border border-[#1b2f24] text-[#9db8a6] px-1.5 py-0.5 inline-flex items-center gap-1">
          <OrganIcon className="w-3 h-3" /> organ {organMeta(meta.organ).name}
        </span>
        {creature.lastMode && (
          <span
            className="catalog !text-[8px] border px-1.5 py-0.5"
            style={{ borderColor: creature.lastMode === "menalar" ? "#274434" : "#7a6a1e", color: creature.lastMode === "menalar" ? "#4ade80" : "#fbbf24" }}
          >
            {creature.lastMode === "menalar" ? "MENALAR" : "REFLEKS"}
          </span>
        )}
      </div>

      <p className="text-[11px] text-[#9db8a6] leading-relaxed">{meta.description}</p>

      <div>
        <div className="catalog !text-[9px] mb-1">GENOM / SIFAT</div>
        <div className="flex flex-wrap gap-1.5">
          {creature.genome.map((g) => (
            <span key={g} className="catalog !text-[8px] border border-[#274434] text-[#4ade80] px-1.5 py-0.5">
              {g}
            </span>
          ))}
          {creature.skills.map((s) => (
            <span key={s} className="catalog !text-[8px] border border-[#7a6a1e] text-[#fbbf24] px-1.5 py-0.5">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Bar label={`ENERGI (${creature.energy}/100)`} value={creature.energy} max={100} color={meta.color} />
        <Bar label="KEKAYAAN (SIMULASI LOKAL — BUKAN UANG RIIL)" value={creature.wealth} max={Math.max(50, creature.wealth)} color="#fbbf24" />
      </div>

      <div>
        <div className="catalog !text-[9px] mb-1.5">JEJAK TERAKHIR {trace ? "" : "(BELUM BERDENYUT)"}</div>
        {trace ? (
          <div className="space-y-1.5 border border-[#13241a] bg-[#0a130e] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
              <span className="font-mono" style={{ color: trace.mode === "llm" ? "#4ade80" : "#fbbf24" }}>
                {trace.mode === "llm" ? "LLM (menalar)" : "REFLEKS"}
              </span>
              <span className="font-mono text-[#7f9a89]">
                {trace.at.slice(11, 19)} · {trace.latencyMs} ms · {trace.model}
              </span>
            </div>
            {PHASES.map((p, i) => (
              <div key={p.key} className="flex gap-2 text-xs">
                <span
                  className="catalog !text-[8px] shrink-0 w-16 pt-0.5 text-right border-r-2 pr-2"
                  style={{ borderColor: i === 4 ? "#7a6a1e" : meta.color, color: "#9db8a6" }}
                >
                  {p.label}
                </span>
                <span className="text-[#bfe8cc] leading-snug min-w-0 break-words">{trace.phases[p.key]}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-[#13241a] flex flex-wrap gap-2 items-center text-[10px]">
              <span className="font-mono border border-[#1b2f24] text-[#4ade80] px-1.5 py-0.5">{trace.action.type}</span>
              {trace.action.target && <span className="font-mono text-[#9db8a6]">→ {trace.action.target}</span>}
              <span className="text-[#7f9a89]">{trace.action.reason}</span>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-[#1b2f24] p-3 text-[11px] text-[#7f9a89]" role="note">
            {creature.name} belum menjalani denyut di sesi ini. Klik PICU DENYUT — denyut berikutnya
            bisa jatuh ke creature ini (prioritas: insiden &gt; prt &gt; giliran).
          </div>
        )}
      </div>

      <div>
        <div className="catalog !text-[9px] mb-1.5">MEMORI / LEDGER LOKAL TERAKHIR</div>
        {episodes.length > 0 ? (
          <ul className="space-y-1">
            {episodes.map((l) => (
              <li key={l.id} className="text-[11px] text-[#bfe8cc] border-l-2 border-[#1b2f24] pl-2 break-words">
                <span className="font-mono text-[9px] text-[#7f9a89]">{l.ts.slice(11, 19)}</span> · {l.payload.message}
              </li>
            ))}
          </ul>
        ) : (
          <div className="border border-dashed border-[#1b2f24] p-3 text-[11px] text-[#7f9a89]" role="note">
            Belum ada episode {creature.name} di ledger lokal — denyut akan menuliskannya (maks di vault Anda,
            bukan server).
          </div>
        )}
      </div>

      {creature.status !== "aktif" && (
        <button
          onClick={() => void setCreatureStatus(creature.id, "aktif")}
          className="w-full border border-[#7a6a1e] text-[#fbbf24] px-3 py-2 text-xs hover:bg-[#0d1a12] transition-colors inline-flex items-center justify-center gap-2"
        >
          <HeartPulse className="w-4 h-4" /> BANGKITKAN {creature.name.toUpperCase()} (REMEDIASI MANUAL)
        </button>
      )}
    </div>
  );
}

// ---------- Feed bus + log kehidupan ----------

function EventFeed({ types, empty }: { types?: BiosferEventType[]; empty: string }) {
  const eventLog = useFlybrain((s) => s.eventLog);
  const filtered = useMemo(
    () => (types ? eventLog.filter((e) => types.includes(e.type)) : eventLog).slice(0, types ? 10 : 30),
    [eventLog, types],
  );

  if (filtered.length === 0) {
    return (
      <div className="border border-dashed border-[#1b2f24] p-3 text-[11px] text-[#7f9a89]" role="note">
        {empty}
      </div>
    );
  }

  return (
    <ul className="space-y-1 max-h-72 overflow-y-auto pr-1" aria-live="polite">
      {filtered.map((e) => (
        <li key={e.id} className="flex gap-2 items-start text-[11px] leading-snug">
          <span className="font-mono text-[9px] text-[#7f9a89] pt-0.5 shrink-0">{e.at.slice(11, 19)}</span>
          <span
            className="catalog !text-[8px] shrink-0 border px-1 py-0.5"
            style={{ color: EVENT_COLORS[e.type], borderColor: EVENT_COLORS[e.type] }}
          >
            {e.type}
          </span>
          <span className="text-[#bfe8cc] min-w-0 break-words">{e.message}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Panel quant mini ----------

function QuantPanel() {
  const lastQuant = useFlybrain((s) => s.lastQuant);
  if (!lastQuant || lastQuant.allocations.length === 0) {
    return (
      <div className="border border-dashed border-[#1b2f24] p-3 text-[11px] text-[#7f9a89] leading-relaxed" role="status">
        <p className="text-[#bfe8cc] mb-1.5">Panel quant masih kosong — biosfer belum berdenyut.</p>
        Setiap denyut menjalankan quant tick lokal (alokasi Markowitz + Kelly + risk-gate) atas state 6 creature.
        Klik <span className="font-mono text-[#4ade80]">PICU DENYUT</span> untuk mengisinya.
      </div>
    );
  }
  const gate = lastQuant.gates[0];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="catalog !text-[9px] border border-[#7a6a1e] text-[#fbbf24] px-1.5 py-0.5">SIMULASI LOKAL</span>
        <span className="font-mono text-[9px] text-[#7f9a89]">tick {lastQuant.at.slice(11, 19)}</span>
        {gate && (
          <span
            className="catalog !text-[9px] border px-1.5 py-0.5"
            style={gate.active ? { borderColor: "#7f1d1d", color: "#f87171" } : { borderColor: "#274434", color: "#4ade80" }}
          >
            RISK-GATE {gate.active ? "AKTIF (BLOKIR)" : "LOLOS"}
          </span>
        )}
      </div>
      {gate?.active && gate.reason && <p className="text-[10px] text-[#f87171] break-words">{gate.reason}</p>}
      <div className="space-y-2">
        {lastQuant.allocations.slice(0, 6).map((a) => (
          <div key={a.entityId}>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#bfe8cc]">{a.name}</span>
              <span className="font-mono text-[#9db8a6]">{(a.weight * 100).toFixed(1)}% · sharpe {a.sharpe.toFixed(2)}</span>
            </div>
            <div className="mt-0.5 h-1.5 bg-[#0d1712] border border-[#13241a]">
              <div
                className="h-full"
                style={{ width: `${Math.max(2, a.weight * 100)}%`, background: "#f472b6", opacity: 0.8 }}
              />
            </div>
          </div>
        ))}
      </div>
      {lastQuant.recommendations.length > 0 && (
        <ul className="space-y-1">
          {lastQuant.recommendations.slice(0, 3).map((r) => (
            <li key={r} className="text-[10px] text-[#fbbf24] leading-snug">⚠ {r}</li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-[#7f9a89] leading-relaxed">
        Semua angka dihitung dari random-walk &amp; state creature LOKAL — bukan data pasar nyata
        (kejujuran finansial, konstitusi hukum 3).
      </p>
    </div>
  );
}

// ---------- View utama ----------

export function BiosferView() {
  const creatures = useFlybrain((s) => s.creatures);
  const reflectVerdict = useFlybrain((s) => s.reflectVerdict);
  const autonomyLevel = useFlybrain((s) => s.autonomyLevel);
  const biosferBusy = useFlybrain((s) => s.biosferBusy);
  const tickCreature = useFlybrain((s) => s.tickCreature);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = creatures.find((c) => c.id === selectedId) ?? null;
  const aktif = creatures.filter((c) => c.status === "aktif").length;
  const tidur = creatures.filter((c) => c.status === "tidur").length;
  const verdictColor =
    reflectVerdict?.verdict === "ok"
      ? "#4ade80"
      : reflectVerdict?.verdict === "degraded"
        ? "#fbbf24"
        : reflectVerdict?.verdict === "critical"
          ? "#f87171"
          : "#7f9a89";

  return (
    <div className="px-4 sm:px-8 py-8">
      {/* A. HEADER */}
      <header className="mb-6">
        <p className="catalog catalog-phos">07 — BIOSFER · EKOSISTEM CREATURE OTONOM</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">
          Enam makhluk, satu tubuh — metabolisme hidup tanpa server
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#9db8a6]">
          <span>
            POPULASI: <span className="font-mono text-[#4ade80]">{aktif} aktif</span> ·{" "}
            <span className="font-mono text-[#94a3b8]">{tidur} tidur</span> · {creatures.length} total
          </span>
          <span className="inline-flex items-center gap-1.5">
            DENYUT OTOMATIS:{" "}
            {autonomyLevel >= 3 ? (
              <span className="font-mono text-[#4ade80] inline-flex items-center gap-1.5">
                ±45 dtk <span className="w-2 h-2 rounded-full bg-[#4ade80] breathe inline-block" aria-hidden />
              </span>
            ) : (
              <span className="font-mono text-[#94a3b8]">MATI (mandat L{autonomyLevel} &lt; L3)</span>
            )}
          </span>
          {reflectVerdict && (
            <span>
              SELF-REFLECT:{" "}
              <span className="font-mono uppercase" style={{ color: verdictColor }}>
                {reflectVerdict.verdict}
              </span>{" "}
              ({reflectVerdict.issues.length} isu · {reflectVerdict.actions_taken.length} remediasi)
            </span>
          )}
        </div>
      </header>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Kolom kiri: kanvas + denyut + log kehidupan */}
        <div className="lg:col-span-3 space-y-4">
          <section className="specimen-frame p-4 sm:p-5" aria-label="Kanvas BIOSFER">
            <EcosystemCanvas creatures={creatures} selectedId={selectedId} onSelect={setSelectedId} />

            <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-3 items-center">
              <button
                onClick={() => void tickCreature()}
                disabled={biosferBusy}
                className="w-full bg-[#4ade80] text-[#04130a] px-4 py-2.5 text-sm font-medium hover:bg-[#6ee7a0] transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                {biosferBusy ? "BIOSFER SEDANG BERDENYUT…" : "PICU DENYUT"}
              </button>
              <p className="text-[10px] text-[#7f9a89] leading-relaxed sm:max-w-[240px]">
                Satu denyut = SATU creature (prioritas: insiden &gt; prt &gt; giliran) — budget
                konstitusi hukum 6. Denyut otomatis ±45 dtk saat mandat L3+.
              </p>
            </div>
          </section>

          <section className="specimen-frame p-4 sm:p-5" aria-label="Feed kejadian bus">
            <div className="flex items-center justify-between">
              <div className="catalog catalog-phos">FEED BUS BIOSFER — KEJADIAN HIDUP</div>
              <span className="catalog !text-[9px]">spawn · decide · act · ledger · quant · reflect</span>
            </div>
            <div className="mt-3">
              <EventFeed empty="Bus masih sunyi — biosfer belum mengalami apa pun. Klik PICU DENYUT untuk menghidupkannya." />
            </div>
          </section>

          <section className="specimen-frame p-4 sm:p-5" aria-label="Log kelahiran, tidur, mati">
            <div className="flex items-center justify-between">
              <div className="catalog catalog-phos">LOG KEHIDUPAN — KELAHIRAN · TIDUR · MATI</div>
              <span className="catalog !text-[9px]">dibangunkan prt/immune/reflect</span>
            </div>
            <div className="mt-3">
              <EventFeed types={["spawn", "sleep", "wake", "death"]} empty="Belum ada peristiwa kehidupan — semua creature aktif sejak lahir." />
            </div>
          </section>
        </div>

        {/* Kolom kanan: inspektor + quant */}
        <div className="lg:col-span-2 space-y-4">
          <section className="specimen-frame p-4 sm:p-5" aria-label="Inspektor creature">
            <div className="catalog catalog-phos mb-3">INSPEKTOR CREATURE</div>
            <Inspector creature={selected} />
          </section>

          <section className="specimen-frame p-4 sm:p-5" aria-label="Panel quant mini">
            <div className="flex items-center justify-between mb-3">
              <div className="catalog catalog-phos">QUANT MINI — ALOKASI &amp; RISK-GATE</div>
              <Coins className="w-3.5 h-3.5 text-[#fbbf24]" />
            </div>
            <QuantPanel />
          </section>

          <section className="specimen-frame p-4 sm:p-5" aria-label="Catatan konstitusi">
            <div className="catalog catalog-phos mb-2">KONSTITUSI BIOSFER</div>
            <p className="text-[11px] text-[#9db8a6] leading-relaxed">
              7 hukum mengikat semua creature (lihat{" "}
              <span className="font-mono text-[#4ade80]">organism/constitution.ts</span>): nol-penyimpanan,
              privasi agregat, kejujuran finansial, non-destruktif, transparansi radikal, budget siklus,
              veto konstitusional. Keputusan LLM diperiksa veto di klien sebelum dieksekusi.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
