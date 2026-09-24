"use client";
// CIVITAS OS — OrganismView: kontrol organisme otonom dari UI.
// World model · goals · keputusan · capability graph · mutasi A/B · populasi
// anak · imun · DNA/genome · kontrol PAUSE/KILL/LOCK · LLM custom provider.
// Semua tombol memanggil API nyata — tidak ada tombol hias.

import { useCallback, useEffect, useState } from "react";
import { MCBadge, MCButton, MCInput, MCLog, MCPanel, MCSectionTitle, MCSelect, MCTabs } from "../mcui";

// ── tipe ringan (mirror API) ──
interface GoalRec { id: string; area: string; title: string; action: string; score?: number; risk?: number }
interface DecisionRec { at: string; reasoning: string; chosen: GoalRec | null }
interface WorldRec {
  at?: string;
  resources?: { cpuCount: number; load1: number; rssMb: number; freememMb: number; totalmemMb: number; diskFreeMb: number };
  infrastructure?: Record<string, { health: number; note: string }>;
  risks?: { key: string; level: string; note: string }[];
  agents?: { id: string; kind: string; alive: boolean; role: string }[];
  economy?: { cycleCostMs: number; actionsDone: number; valueScore: number };
  epistemic?: {
    known: { key: string; value: string }[];
    unknown: { key: string; why: string }[];
    assumptions: { key: string; note: string; risky?: boolean }[];
    unverified: { key: string; howToVerify: string }[];
  };
}
interface MutationRec { id: string; level: string; status: string; target: string; hypothesis: string; verdict?: string; lesson?: string; benchmark?: { aMs: number; bMs: number; aValid: boolean; bValid: boolean } }
interface CapRec { id: string; kind: string; status: string; impl?: string; verifyNote?: string }
interface GapRec { goalId: string; required: string[]; available: string[]; missing: string[]; plan?: { capabilityId: string; how: string }[] }
interface ChildRec { id: string; name: string; role: string; kind: string; pid: number; status: string; lastHeartbeat?: string; cycles?: number; purpose: string }
interface ImmuneRec { at: string; signal: string; detail: string; response: string }
interface GenomeRec { weights: Record<string, number>; strategy: string; workflow: { intervalMs: number; doNothingBias: number; steps: string[] } }
interface StateRec {
  ok: boolean; error?: string;
  loop?: { phase: string; cycle: number; lastTickAt?: string; stats: { actions: number; failures: number; mutations: number; spawns: number; lessons: number } };
  dna?: { core: { id: string; name: string; kind: string; purpose: string; bornAt: string; hardConstraints: string[] }; genome: GenomeRec };
  world?: WorldRec; goals?: GoalRec[]; decision?: DecisionRec;
  capabilities?: CapRec[]; gaps?: GapRec[]; mutations?: MutationRec[];
  children?: ChildRec[]; immuneEvents?: ImmuneRec[];
  memory?: { at: string; kind: string; text: string }[];
  llm?: { mode: string; baseUrl?: string; model?: string; keySet: boolean };
}

const TABS = [
  { key: "live", label: "HIDUP" },
  { key: "world", label: "WORLD MODEL" },
  { key: "goals", label: "TUJUAN" },
  { key: "capability", label: "CAPABILITY" },
  { key: "mutation", label: "MUTASI A/B" },
  { key: "population", label: "POPULASI" },
  { key: "immune", label: "IMUN" },
  { key: "brain", label: "OTAK LLM" },
];

const PHASE_TONE: Record<string, "green" | "gold" | "red" | "stone" | "diamond"> = {
  RUNNING: "green", PAUSED: "gold", KILLED: "red", LOCKED: "diamond",
};

export default function OrganismView() {
  const [st, setSt] = useState<StateRec | null>(null);
  const [tab, setTab] = useState("live");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // form LLM
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [llmEnabled, setLlmEnabled] = useState("false");
  // mutasi manual
  const [mutLevel, setMutLevel] = useState("L1_PARAMETER");
  const [mutHypo, setMutHypo] = useState("");
  // capability acquire
  const [capId, setCapId] = useState("");

  const post = useCallback(async (body: Record<string, unknown>): Promise<string> => {
    setBusy(true);
    try {
      const res = await fetch("/api/civos/organism", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as Record<string, unknown>;
      const note = String(j.note ?? j.phase ?? (j.ok ? "ok" : j.error ?? "selesai"));
      setLog((l) => [`[${new Date().toLocaleTimeString()}] ${body.action}: ${note.slice(0, 160)}`, ...l].slice(0, 12));
      return note;
    } catch (e) {
      const note = e instanceof Error ? e.message : "gagal";
      setLog((l) => [`[${new Date().toLocaleTimeString()}] ERROR: ${note}`, ...l].slice(0, 12));
      return note;
    } finally { setBusy(false); }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/civos/organism", { cache: "no-store" });
      const j = (await res.json()) as StateRec;
      setSt(j);
      if (j.llm) {
        setBaseUrl((b) => b || j.llm?.baseUrl || "");
        setModel((m) => m || j.llm?.model || "");
        setLlmEnabled(j.llm.mode === "REMOTE" ? "true" : "false");
      }
    } catch { /* poll berikutnya */ }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const loop = st?.loop; const dna = st?.dna; const world = st?.world;
  const phase = loop?.phase ?? "RUNNING";

  const L = ({ children: c }: { children: React.ReactNode }) => (
    <p className="mc-body text-[12px] text-white/70 leading-relaxed">{c}</p>
  );

  return (
    <div className="grid gap-4">
      {/* HEADER ORGANISME */}
      <MCPanel dark>
        <div className="flex flex-wrap items-center gap-2">
          <MCSectionTitle>ORGANISME — {dna?.core.name ?? "…"}</MCSectionTitle>
          <MCBadge tone={PHASE_TONE[phase] ?? "stone"}>{phase}</MCBadge>
          <MCBadge tone="stone">c#{loop?.cycle ?? 0}</MCBadge>
          <MCBadge tone="diamond">{dna?.core.kind ?? "?"}</MCBadge>
          <span className="flex-1" />
          <MCButton tone="green" disabled={busy} onClick={() => void post({ action: "tick", force: true })}>▶ TICK SEKARANG</MCButton>
          {phase === "PAUSED" ? (
            <MCButton tone="gold" disabled={busy} onClick={() => void post({ action: "resume" })}>RESUME</MCButton>
          ) : (
            <MCButton tone="gold" disabled={busy} onClick={() => void post({ action: "pause" })}>PAUSE</MCButton>
          )}
          <MCButton tone="red" disabled={busy} onClick={() => void post({ action: "kill" })}>KILL</MCButton>
          <MCButton tone="stone" disabled={busy} onClick={() => void post({ action: "unkill" })}>HAPUS KILL-SWITCH</MCButton>
          <MCButton tone="stone" disabled={busy} onClick={() => void post({ action: "lock" })}>LOCK</MCButton>
          <MCButton tone="stone" disabled={busy} onClick={() => void post({ action: "unlock" })}>UNLOCK</MCButton>
        </div>
        <p className="mc-body text-[12px] text-white/60 mt-2">{dna?.core.purpose ?? ""}</p>
        <p className="mc-body text-[11px] text-white/40 mt-1">
          lahir {dna?.core.bornAt ? new Date(dna.core.bornAt).toLocaleString() : "-"} · aksi {loop?.stats.actions ?? 0} · gagal {loop?.stats.failures ?? 0} · mutasi {loop?.stats.mutations ?? 0} · spawn {loop?.stats.spawns ?? 0} · pelajaran {loop?.stats.lessons ?? 0}
        </p>
      </MCPanel>

      <MCTabs tabs={TABS} active={tab} onSelect={setTab} />

      {/* HIDUP */}
      {tab === "live" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <MCPanel dark>
            <MCSectionTitle>KEPUTUSAN TERAKHIR</MCSectionTitle>
            <L>{st?.decision?.reasoning ?? "belum ada siklus — tekan TICK SEKARANG"}</L>
            {st?.decision?.chosen ? (
              <p className="mc-body text-[11px] text-[color:var(--mc-xp)] mt-2">→ aksi {st.decision.chosen.action} · skor {st.decision.chosen.score?.toFixed(2)}</p>
            ) : null}
            <MCSectionTitle>MEMORI TERAKHIR</MCSectionTitle>
            <MCLog lines={(st?.memory ?? []).slice(-8).reverse().map((m) => ({ text: `[${m.kind}] ${m.text}` }))} />
          </MCPanel>
          <MCPanel dark>
            <MCSectionTitle>GENOME (bisa dimutasi — bukan hardcode)</MCSectionTitle>
            <L>strategi: <b className="text-white">{dna?.genome.strategy ?? "-"}</b></L>
            <L>interval siklus: {Math.round((dna?.genome.workflow.intervalMs ?? 0) / 1000)}s · bias do-nothing: {dna?.genome.workflow.doNothingBias ?? "-"}</L>
            <L>bobot: {Object.entries(dna?.genome.weights ?? {}).map(([k, v]) => `${k}=${v}`).join(" · ")}</L>
            <MCSectionTitle>KONSTITUSI (IMMUTABLE)</MCSectionTitle>
            {(dna?.core.hardConstraints ?? []).map((h, i) => (
              <p key={i} className="mc-body text-[11px] text-white/50">▪ {h}</p>
            ))}
          </MCPanel>
        </div>
      ) : null}

      {/* WORLD MODEL */}
      {tab === "world" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <MCPanel dark>
            <MCSectionTitle>SUMBER DAYA (probe nyata)</MCSectionTitle>
            <L>CPU {world?.resources?.cpuCount ?? "?"} core · load1 {world?.resources?.load1 ?? "-"} · RSS {world?.resources?.rssMb ?? "-"}MB</L>
            <L>RAM bebas {world?.resources?.freememMb ?? "-"}/{world?.resources?.totalmemMb ?? "-"}MB · disk {world?.resources?.diskFreeMb ?? "-"}MB</L>
            <MCSectionTitle>INFRASTRUKTUR</MCSectionTitle>
            {Object.entries(world?.infrastructure ?? {}).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 mb-1">
                <MCBadge tone={v.health >= 80 ? "green" : v.health > 0 ? "gold" : "red"}>{Math.round(v.health)}</MCBadge>
                <span className="mc-body text-[12px] text-white/70">{k} — {v.note}</span>
              </div>
            ))}
            <MCSectionTitle>RISIKO</MCSectionTitle>
            {(world?.risks ?? []).length === 0 ? <L>tidak ada risiko aktif</L> : null}
            {(world?.risks ?? []).map((r) => (
              <p key={r.key} className="mc-body text-[12px] text-white/70">▪ <MCBadge tone={r.level === "HIGH" ? "red" : r.level === "MEDIUM" ? "gold" : "stone"}>{r.level}</MCBadge> {r.key}: {r.note}</p>
            ))}
          </MCPanel>
          <MCPanel dark>
            <MCSectionTitle>EPISTEMIC — KETIDAKTAHUAN FIRST-CLASS</MCSectionTitle>
            <p className="mc-body text-[11px] text-[color:var(--mc-xp)]">KNOWN ({world?.epistemic?.known.length ?? 0})</p>
            {(world?.epistemic?.known ?? []).slice(0, 6).map((k) => (
              <p key={k.key} className="mc-body text-[11px] text-white/60">✓ {k.key} = {k.value}</p>
            ))}
            <p className="mc-body text-[11px] text-[color:var(--mc-red,#f87171)] mt-2">UNKNOWN ({world?.epistemic?.unknown.length ?? 0})</p>
            {(world?.epistemic?.unknown ?? []).map((u) => (
              <p key={u.key} className="mc-body text-[11px] text-white/60">? {u.key} — {u.why}</p>
            ))}
            <p className="mc-body text-[11px] text-[color:var(--mc-gold)] mt-2">ASSUMPTIONS ({world?.epistemic?.assumptions.length ?? 0})</p>
            {(world?.epistemic?.assumptions ?? []).map((a) => (
              <p key={a.key} className="mc-body text-[11px] text-white/60">{a.risky ? "⚠" : "·"} {a.key} — {a.note}</p>
            ))}
            <p className="mc-body text-[11px] text-[color:var(--mc-gold)] mt-2">UNVERIFIED ({world?.epistemic?.unverified.length ?? 0})</p>
            {(world?.epistemic?.unverified ?? []).map((u) => (
              <p key={u.key} className="mc-body text-[11px] text-white/60">◌ {u.key} — {u.howToVerify}</p>
            ))}
          </MCPanel>
        </div>
      ) : null}

      {/* TUJUAN */}
      {tab === "goals" ? (
        <MCPanel dark>
          <MCSectionTitle>GOAL ENGINE — tanpa task list permanen</MCSectionTitle>
          {(st?.goals ?? []).map((g) => (
            <div key={g.id} className="mb-2 flex flex-wrap items-center gap-2">
              <MCBadge tone="stone">{g.area}</MCBadge>
              <span className="mc-body text-[12px] text-white/70">{g.title}</span>
              <MCBadge tone={g.action === "MUTATE" ? "diamond" : "gold"}>{g.action}</MCBadge>
              <MCBadge tone="stone">skor {g.score?.toFixed(2) ?? "-"}</MCBadge>
            </div>
          ))}
          {(st?.goals ?? []).length === 0 ? <L>belum ada goal — dunia mungkin sehat (do nothing sah)</L> : null}
        </MCPanel>
      ) : null}

      {/* CAPABILITY GRAPH */}
      {tab === "capability" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <MCPanel dark>
            <MCSectionTitle>REGISTRY</MCSectionTitle>
            {(st?.capabilities ?? []).map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 mb-1">
                <MCBadge tone={c.status === "AVAILABLE" ? "green" : c.status === "DEGRADED" ? "gold" : "red"}>{c.status}</MCBadge>
                <span className="mc-body text-[12px] text-white/70">{c.id}</span>
                <span className="mc-body text-[10px] text-white/40">{c.kind} · {c.verifyNote ?? c.impl ?? ""}</span>
              </div>
            ))}
            <div className="flex gap-2 mt-3">
              <MCInput value={capId} onChange={(e) => setCapId(e.target.value)} placeholder="capability id (mis. text.hash)" />
              <MCButton tone="gold" disabled={busy || !capId} onClick={() => void post({ action: "acquire", capabilityId: capId }).then(() => { setCapId(""); void refresh(); })}>ACQUIRE</MCButton>
            </div>
          </MCPanel>
          <MCPanel dark>
            <MCSectionTitle>CAPABILITY GAP (goal → required → missing)</MCSectionTitle>
            {(st?.gaps ?? []).length === 0 ? <L>tidak ada gap aktif</L> : null}
            {(st?.gaps ?? []).map((g) => (
              <p key={g.goalId} className="mc-body text-[11px] text-white/60">▪ missing: {g.missing.join(", ") || "-"} · plan: {g.plan?.map((p) => `${p.capabilityId}(${p.how})`).join(", ") ?? "-"}</p>
            ))}
          </MCPanel>
        </div>
      ) : null}

      {/* MUTASI A/B */}
      {tab === "mutation" ? (
        <MCPanel dark>
          <MCSectionTitle>MUTATION ENGINE — sandbox worktree + benchmark A/B</MCSectionTitle>
          <div className="flex flex-wrap gap-2 mb-3">
            <MCSelect value={mutLevel} onChange={(e) => setMutLevel(e.target.value)}>
              <option value="L1_PARAMETER">L1_PARAMETER</option>
              <option value="L2_STRATEGY">L2_STRATEGY</option>
              <option value="L3_WORKFLOW">L3_WORKFLOW</option>
              <option value="L4_CAPABILITY">L4_CAPABILITY</option>
              <option value="L5_ORGANIZATION">L5_ORGANIZATION</option>
            </MCSelect>
            <MCInput value={mutHypo} onChange={(e) => setMutHypo(e.target.value)} placeholder="hipotesis (opsional)" className="flex-1" />
            <MCButton tone="gold" disabled={busy} onClick={() => void post({ action: "mutate", level: mutLevel, hypothesis: mutHypo }).then(() => { setMutHypo(""); void refresh(); })}>UJI A/B</MCButton>
          </div>
          {(st?.mutations ?? []).map((m) => (
            <div key={m.id} className="mb-3 border border-white/10 rounded p-2">
              <div className="flex flex-wrap items-center gap-2">
                <MCBadge tone={m.status === "ADOPTED" ? "green" : m.status === "REJECTED" ? "red" : "gold"}>{m.status}</MCBadge>
                <span className="mc-body text-[11px] text-white/50">{m.id} · {m.level} · {m.target}</span>
                {m.status === "ADOPTED" ? (
                  <MCButton tone="red" disabled={busy} onClick={() => void post({ action: "rollback", id: m.id }).then(() => void refresh())}>ROLLBACK</MCButton>
                ) : null}
              </div>
              <p className="mc-body text-[11px] text-white/60 mt-1">{m.hypothesis}</p>
              {m.verdict ? <p className="mc-body text-[11px] text-[color:var(--mc-xp)]">→ {m.verdict}</p> : null}
              {m.benchmark ? <p className="mc-body text-[10px] text-white/40">benchmark: A={m.benchmark.aMs}ms valid={String(m.benchmark.aValid)} · B={m.benchmark.bMs}ms valid={String(m.benchmark.bValid)}</p> : null}
            </div>
          ))}
          {(st?.mutations ?? []).length === 0 ? <L>belum ada mutasi</L> : null}
        </MCPanel>
      ) : null}

      {/* POPULASI */}
      {tab === "population" ? (
        <MCPanel dark>
          <MCSectionTitle>AGENT ECOLOGY — spawn/merge/archive/kill nyata</MCSectionTitle>
          <div className="flex flex-wrap gap-2 mb-3">
            <MCButton tone="green" disabled={busy} onClick={() => void post({ action: "child", op: "spawn", role: "observer" }).then(() => void refresh())}>SPAWN OBSERVER</MCButton>
            <MCButton tone="gold" disabled={busy} onClick={() => void post({ action: "child", op: "reap" }).then(() => void refresh())}>REAP + MERGE</MCButton>
          </div>
          {(st?.children ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 mb-1">
              <MCBadge tone={c.status === "RUNNING" ? "green" : c.status === "ARCHIVED" ? "stone" : "red"}>{c.status}</MCBadge>
              <span className="mc-body text-[12px] text-white/70">{c.name}</span>
              <span className="mc-body text-[10px] text-white/40">pid {c.pid} · {c.kind} · cycle {c.cycles ?? "-"} · {c.lastHeartbeat ? new Date(c.lastHeartbeat).toLocaleTimeString() : "belum"}</span>
              <span className="flex-1" />
              <MCButton tone="stone" disabled={busy} onClick={() => void post({ action: "child", op: "archive", id: c.id }).then(() => void refresh())}>ARCHIVE</MCButton>
              <MCButton tone="red" disabled={busy} onClick={() => void post({ action: "child", op: "kill", id: c.id }).then(() => void refresh())}>KILL</MCButton>
            </div>
          ))}
          {(st?.children ?? []).length === 0 ? <L>populasi kosong</L> : null}
        </MCPanel>
      ) : null}

      {/* IMUN */}
      {tab === "immune" ? (
        <MCPanel dark>
          <MCSectionTitle>SISTEM IMUN — 7 limit enforced</MCSectionTitle>
          <L>timeout 30s · recursion ≤3 · retry ≤2 · RSS ≤1024MB · memori ≤500 entri · network allowlist 4 host · tool-permission 8 tool</L>
          <MCSectionTitle>EVENT TERAKHIR</MCSectionTitle>
          {(st?.immuneEvents ?? []).length === 0 ? <L>belum ada pelanggaran — imun siaga</L> : null}
          {(st?.immuneEvents ?? []).slice(-10).reverse().map((e, i) => (
            <p key={i} className="mc-body text-[11px] text-white/60">[{new Date(e.at).toLocaleTimeString()}] <MCBadge tone="gold">{e.signal}</MCBadge> {e.detail} → <b>{e.response}</b></p>
          ))}
        </MCPanel>
      ) : null}

      {/* OTAK LLM */}
      {tab === "brain" ? (
        <MCPanel dark>
          <MCSectionTitle>OTAK LLM — custom base URL + API key via UI (free-first)</MCSectionTitle>
          <p className="mc-body text-[12px] text-white/60 mb-3">
            Mode sekarang: <MCBadge tone={st?.llm?.mode === "REMOTE" ? "green" : "stone"}>{st?.llm?.mode ?? "HEURISTIC"}</MCBadge>{" "}
            {st?.llm?.mode === "REMOTE" ? `→ ${st.llm.baseUrl} (${st.llm.model})` : "→ organisme hidup penuh TANPA LLM berbayar; isi form untuk memakai endpoint OpenAI-compatible sendiri."}
          </p>
          <div className="grid gap-2 max-w-xl">
            <MCInput value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL (mis. https://api.openai.com/v1)" />
            <MCInput value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={st?.llm?.keySet ? "API key tersimpan (isi untuk ganti)" : "API key"} type="password" />
            <MCInput value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model (mis. glm-4-plus / gpt-4o-mini)" />
            <MCSelect value={llmEnabled} onChange={(e) => setLlmEnabled(e.target.value)}>
              <option value="false">HEURISTIC (gratis, tanpa jaringan)</option>
              <option value="true">REMOTE (pakai baseUrl + key)</option>
            </MCSelect>
            <MCButton
              tone="gold" disabled={busy}
              onClick={() => void post({ action: "llm_config", baseUrl, apiKey, model, enabled: llmEnabled === "true" }).then(() => void refresh())}
            >SIMPAN KONFIGURASI OTAK</MCButton>
          </div>
          <p className="mc-body text-[10px] text-white/40 mt-2">API key disimpan sebagai SECRET (tak pernah dikirim balik ke browser). Remote tetap diawasi imun: timeout network 8s + fallback heuristic otomatis.</p>
        </MCPanel>
      ) : null}

      {/* KONSOL AKSI */}
      <MCPanel dark>
        <MCSectionTitle>KONSOL</MCSectionTitle>
        <MCLog lines={log.length ? log.map((t) => ({ text: t })) : [{ text: "— siap — tekan TICK SEKARANG untuk satu siklus otonom penuh —" }]} />
      </MCPanel>
    </div>
  );
}
