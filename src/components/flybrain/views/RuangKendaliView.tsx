"use client";

// 06 RUANG KENDALI — Mission Control Organisme (10_AUTONOMY.md §7).
// Jantung visualisasi v1.0: aliran keputusan prt, mandat L0-L4, ledger bisnis,
// denyut organisme, dan panel endpoint universal /api/mcp (tester JSON-RPC).

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Coins,
  Copy,
  Globe2,
  Play,
  Radio,
  ShieldHalf,
  Telescope,
  Zap,
} from "lucide-react";
import { useFlybrain, AUTONOMY_LEVELS } from "@/lib/flybrain/store";
import { ORGANS, organMeta, type OrganId } from "@/lib/flybrain/organism/loops";
import type { OrganismTrace } from "@/lib/flybrain/prt";
import { MCP_TOOLS } from "@/lib/flybrain/mcp-tools";
import { Switch } from "@/components/ui/switch";

const ORGAN_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  ShieldHalf,
  Coins,
  Radio,
  Telescope,
};

function OrganChip({ organ, className = "" }: { organ: OrganId; className?: string }) {
  const meta = organMeta(organ);
  const Icon = ORGAN_ICONS[meta.icon] ?? Activity;
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 catalog !text-[9px] ${className}`}
      style={{ borderColor: meta.color, color: meta.color }}
    >
      <Icon className="w-3 h-3" />
      {meta.name} · {meta.code}
    </span>
  );
}

const PHASES: { key: keyof OrganismTrace["phases"]; label: string }[] = [
  { key: "sadar", label: "SADAR" },
  { key: "tafsir", label: "TAFSIR" },
  { key: "putuskan", label: "PUTUSKAN" },
  { key: "bertindak", label: "BERTINDAK" },
  { key: "ingat", label: "INGAT" },
];

function DecisionCard({ trace }: { trace: OrganismTrace }) {
  const meta = organMeta(trace.organ);
  return (
    <article className="specimen-frame p-4" aria-label={`Keputusan ${trace.organ}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <OrganChip organ={trace.organ} />
          <span
            className="catalog !text-[9px] border px-1.5 py-0.5"
            style={{
              borderColor: trace.mode === "llm" ? "#274434" : "#7a6a1e",
              color: trace.mode === "llm" ? "#4ade80" : "#fbbf24",
            }}
          >
            {trace.mode === "llm" ? "LLM" : "REFLEKS"}
          </span>
        </div>
        <span className="font-mono text-[10px] text-[#7f9a89]">
          {trace.at.slice(11, 19)} · {trace.latencyMs} ms · {trace.model}
        </span>
      </header>

      <div className="mt-3 space-y-1.5">
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
      </div>

      <footer className="mt-3 pt-2 border-t border-[#13241a] flex flex-wrap gap-2 items-center text-[10px]">
        <span className="font-mono border border-[#1b2f24] text-[#4ade80] px-1.5 py-0.5">{trace.action.type}</span>
        {trace.action.target && <span className="font-mono text-[#9db8a6]">→ {trace.action.target}</span>}
        <span className="text-[#7f9a89]">{trace.action.reason}</span>
      </footer>
    </article>
  );
}

const DEFAULT_PARAMS: Record<string, string> = {
  initialize: JSON.stringify({ protocolVersion: "2025-06-18", clientInfo: { name: "konsol-flybrain", version: "1.0.0" } }, null, 2),
  "tools/list": "{}",
  "tools/call": JSON.stringify({ name: "prt.chat", arguments: { message: "status kamu?" } }, null, 2),
};

function EndpointPanel() {
  const session = useFlybrain((s) => s.session);
  const [origin, setOrigin] = useState("");
  const [method, setMethod] = useState("initialize");
  const [params, setParams] = useState(DEFAULT_PARAMS["initialize"]);
  const [withBearer, setWithBearer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<{ status: number; ms: number; body: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const bearerLabel = session ? session.key : "FK1_<kunci-64-hex-anda>";

  const samples = useMemo(
    () => [
      {
        id: "curl-init",
        label: "A. CURL — INITIALIZE (Hermes / opencode / apa pun)",
        text: `curl -X POST ${origin || "<origin>"}/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'`,
      },
      {
        id: "curl-chat",
        label: "B. CURL — TOOLS/CALL prt.chat",
        text: `curl -X POST ${origin || "<origin>"}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${bearerLabel}" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"prt.chat","arguments":{"message":"status kamu?"}}}'`,
      },
    ],
    [origin, bearerLabel],
  );

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  const send = async () => {
    setBusy(true);
    setResp(null);
    const t0 = Date.now();
    try {
      let parsed: unknown = {};
      if (params.trim()) {
        try {
          parsed = JSON.parse(params);
        } catch {
          setResp({ status: 0, ms: Date.now() - t0, body: "// params bukan JSON sah — perbaiki sebelum kirim." });
          setBusy(false);
          return;
        }
      }
      const body = { jsonrpc: "2.0", id: 1, method, params: parsed };
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (withBearer && session) headers.Authorization = `Bearer ${session.key}`;
      const res = await fetch("/api/mcp", { method: "POST", headers, body: JSON.stringify(body) });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* biarkan apa adanya */
      }
      setResp({ status: res.status, ms: Date.now() - t0, body: pretty.slice(0, 12000) });
    } catch (e) {
      setResp({ status: 0, ms: Date.now() - t0, body: `// request gagal: ${e instanceof Error ? e.message : "tak diketahui"}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="specimen-frame">
      <div className="px-5 py-3 border-b border-[#13241a] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe2 className="w-3.5 h-3.5 text-[#4ade80]" />
          <span className="catalog catalog-phos">PANEL ENDPOINT UNIVERSAL — /API/MCP</span>
        </div>
        <span className="catalog !text-[9px] border border-[#274434] text-[#4ade80] px-1.5 py-0.5">STATELESS · ZERO-STORAGE</span>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <div className="catalog !text-[9px] mb-1">URL UNIVERSAL (KONEK SEKALI UNTUK SEMUA AGENT)</div>
          <code className="block text-[11px] font-mono text-[#4ade80] bg-[#0d1712] border border-[#1b2f24] p-2.5 break-all">
            POST {origin ? `${origin}/api/mcp` : "/api/mcp (URL ini)"}
          </code>
          <p className="text-[11px] text-[#7f9a89] mt-1.5 leading-relaxed">
            JSON-RPC 2.0: <span className="font-mono">initialize · tools/list · tools/call</span> — {MCP_TOOLS.length} tools. Bearer{" "}
            <span className="font-mono">FK1_…</span> diperiksa FORMAT-nya di server; verifikasi penuh tetap di perangkat pemilik
            (server amnesia, tidak menyimpan apa pun).
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {samples.map((s) => (
            <div key={s.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="catalog !text-[9px]">{s.label}</span>
                <button onClick={() => void copy(s.id, s.text)} className="catalog !text-[9px] hover:text-[#6ee7a0] inline-flex items-center gap-1">
                  <Copy className="w-3 h-3" /> {copied === s.id ? "TERSALIN" : "COPY"}
                </button>
              </div>
              <pre className="mt-1 text-[10px] font-mono text-[#9db8a6] bg-[#0d1712] border border-[#1b2f24] p-3 overflow-x-auto whitespace-pre-wrap">{s.text}</pre>
            </div>
          ))}
        </div>

        {/* Tester JSON-RPC interaktif */}
        <div className="border border-[#13241a] bg-[#070d0a] p-4">
          <div className="catalog catalog-phos mb-3">TESTER JSON-RPC INTERAKTIF — REQUEST NYATA</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setParams(DEFAULT_PARAMS[e.target.value] ?? "{}");
              }}
              aria-label="Method JSON-RPC"
              className="bg-[#0d1712] border border-[#1b2f24] px-2 py-2 text-xs font-mono focus:outline-none focus:border-[#4ade80]"
            >
              {["initialize", "tools/list", "tools/call"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[11px] text-[#9db8a6] cursor-pointer">
              <Switch checked={withBearer} onCheckedChange={setWithBearer} aria-label="Lampirkan bearer identitas lokal" />
              lampirkan bearer {session ? "(identitas lokal aktif)" : "(identitas belum dibuat)"}
            </label>
            <button
              onClick={() => void send()}
              disabled={busy}
              className="ml-auto bg-[#4ade80] text-[#04130a] px-4 py-2 text-xs font-medium hover:bg-[#6ee7a0] transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> KIRIM
            </button>
          </div>
          <textarea
            value={params}
            onChange={(e) => setParams(e.target.value)}
            rows={5}
            aria-label="Params JSON-RPC"
            className="mt-3 w-full bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-[11px] font-mono text-[#d9e6dd] focus:outline-none focus:border-[#4ade80]"
          />
          <div className="mt-3">
            <div className="catalog !text-[9px] mb-1">
              RESPONSE {resp && <span className={resp.status === 200 ? "text-[#4ade80]" : "text-[#f87171]"}>— HTTP {resp.status} · {resp.ms} ms</span>}
            </div>
            <pre className="text-[10px] font-mono text-[#bfe8cc] bg-[#0d1712] border border-[#1b2f24] p-3 overflow-auto max-h-72 whitespace-pre-wrap">
{resp?.body ?? "// belum ada respons — pilih method, isi params, klik KIRIM"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RuangKendaliView() {
  const autonomyLevel = useFlybrain((s) => s.autonomyLevel);
  const organGrants = useFlybrain((s) => s.organGrants);
  const decisionStream = useFlybrain((s) => s.decisionStream);
  const pulseLog = useFlybrain((s) => s.pulseLog);
  const pending = useFlybrain((s) => s.pending);
  const lastPulseAt = useFlybrain((s) => s.lastPulseAt);
  const setAutonomyLevel = useFlybrain((s) => s.setAutonomyLevel);
  const toggleOrgan = useFlybrain((s) => s.toggleOrgan);
  const triggerHeartbeat = useFlybrain((s) => s.triggerHeartbeat);
  const tier = useFlybrain((s) => s.tier);
  const tierUntil = useFlybrain((s) => s.tierUntil);
  const receipts = useFlybrain((s) => s.receipts);
  const decisions = useFlybrain((s) => s.decisions);

  // Denyut otomatis ±60 dtk saat mandat >= L3 — interval dibersihkan saat unmount.
  useEffect(() => {
    if (autonomyLevel < 3) return;
    const t = setInterval(() => void triggerHeartbeat(), 60_000);
    return () => clearInterval(t);
  }, [autonomyLevel, triggerHeartbeat]);

  const levelMeta = AUTONOMY_LEVELS.find((l) => l.level === autonomyLevel) ?? AUTONOMY_LEVELS[3];
  const lastTrace = decisionStream[0];
  const activeMode = pending ? "menalar" : lastTrace ? (lastTrace.mode === "llm" ? "LLM online" : "refleks (degradasi)") : "belum berdenyut";

  const offers = decisions.filter((d) => d.source === "prt" && String((d.payload as { choice?: string }).choice ?? "").startsWith("OFFER")).length;
  const newestReceipt = receipts[0]?.payload;
  const daysLeft = newestReceipt
    ? Math.max(0, Math.round((new Date(newestReceipt.issued_at).getTime() + newestReceipt.period_months * 30 * 86400000 - Date.now()) / 86400000))
    : null;
  const valueDetected = receipts.reduce((n, r) => n + (typeof r.payload.amount?.value === "number" ? r.payload.amount.value : 0), 0);
  const currency = newestReceipt?.amount?.currency ?? "USD";

  // Sparkline denyut: normalisasi latensi → tinggi bar (6..44 px), warna per organ.
  const bars = [...pulseLog].reverse();
  const height = (p: { latencyMs: number }) => Math.max(6, Math.min(44, 6 + p.latencyMs / 500));

  return (
    <div className="px-4 sm:px-8 py-8">
      {/* A. HEADER — status organisme */}
      <header className="mb-6">
        <p className="catalog catalog-phos">06 — RUANG KENDALI · MISSION CONTROL ORGANISME</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">
          prt bukan alat yang dipakai — prt adalah operator yang bekerja
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#9db8a6]">
          <span>
            MANDAT: <span className="font-mono text-[#4ade80]">{levelMeta.code} {levelMeta.name}</span>
          </span>
          <span>
            MODE: <span className="font-mono text-[#fbbf24]">{activeMode}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            DENYUT TERAKHIR:{" "}
            <span className="font-mono text-[#bfe8cc]">{lastPulseAt ? `${lastPulseAt.slice(11, 19)} UTC` : "—"}</span>
            <span className="w-2 h-2 rounded-full bg-[#4ade80] breathe inline-block" aria-hidden />
          </span>
        </div>
      </header>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Kolom kiri: aliran keputusan (b) + mandat (c) */}
        <div className="lg:col-span-3 space-y-4">
          {/* b. ALIRAN KEPUTUSAN */}
          <section className="specimen-frame p-5" aria-label="Aliran keputusan prt">
            <div className="flex items-center justify-between">
              <div className="catalog catalog-phos">ALIRAN KEPUTUSAN — 5 FASE PER SIKLUS</div>
              <span className="catalog !text-[9px]">SADAR → TAFSIR → PUTUSKAN → BERTINDAK → INGAT</span>
            </div>

            {pending && (
              <div className="mt-3 border border-[#274434] bg-[#0a130e] p-3 flex items-center gap-3" role="status" aria-live="polite">
                <span className="w-2 h-2 rounded-full bg-[#4ade80] breathe shrink-0" aria-hidden />
                <span className="text-xs text-[#bfe8cc]">prt sedang menalar… lobus antena menerima sense-packet, kompleks sentral memilih aksi.</span>
              </div>
            )}

            <div className="mt-3 space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {decisionStream.length === 0 && !pending && (
                <div className="border border-dashed border-[#1b2f24] p-4 text-xs text-[#7f9a89] leading-relaxed" role="note">
                  <p className="text-[#bfe8cc] mb-1.5">Saraf kosong — organisme belum mengambil keputusan apa pun di sesi ini.</p>
                  Cara memicu denyut: (1) klik tombol <span className="font-mono text-[#4ade80]">PICU DENYUT</span> di panel
                  &quot;Denyut Organisme&quot; di kanan; atau (2) biarkan mandat L3+ aktif — denyut otomatis berjalan tiap ±60
                  detik selama view ini terbuka. Setiap keputusan ditampilkan utuh: 5 fase, latensi, model, dan alasan
                  (transparansi radikal, konstitusi poin 5).
                </div>
              )}
              {decisionStream.map((t) => (
                <DecisionCard key={t.id} trace={t} />
              ))}
            </div>
          </section>

          {/* c. MANDAT */}
          <section className="specimen-frame p-5" aria-label="Mandat otonomi">
            <div className="catalog catalog-phos">MANDAT PEMILIK — TANGGA OTONOMI L0–L4</div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
              {AUTONOMY_LEVELS.map((l) => {
                const active = l.level === autonomyLevel;
                return (
                  <button
                    key={l.code}
                    onClick={() => setAutonomyLevel(l.level)}
                    aria-pressed={active}
                    className={`border px-2 py-2 text-left transition-colors ${
                      active ? "border-[#4ade80] bg-[#0d1a12]" : "border-[#1b2f24] hover:bg-[#0d1a12]"
                    }`}
                  >
                    <span className={`font-mono text-sm block ${active ? "text-[#4ade80] glow-phos" : "text-[#bfe8cc]"}`}>{l.code}</span>
                    <span className="catalog !text-[8px]">{l.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2.5 text-[11px] text-[#9db8a6] leading-relaxed">
              <span className="font-mono text-[#4ade80]">{levelMeta.code}</span> — {levelMeta.desc}
              {autonomyLevel === 4 && " Catatan jujur: aksi eksternal penuh (kwitansi bertanda tangan, cron-edge 24/7) masih Fase berikut — lihat 07_ROADMAP.md."}
            </p>

            <div className="mt-4 pt-3 border-t border-[#13241a]">
              <div className="catalog !text-[9px] mb-2">SCOPE-GRANT PER ORGAN</div>
              <ul className="grid sm:grid-cols-2 gap-2">
                {ORGANS.map((o) => {
                  const Icon = ORGAN_ICONS[o.icon] ?? Activity;
                  return (
                    <li key={o.id} className="flex items-start gap-3 border border-[#13241a] bg-[#0a130e] px-3 py-2.5">
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: o.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-[#bfe8cc]">
                          {o.name} <span className="catalog !text-[8px]">{o.code}</span>
                        </div>
                        <p className="text-[10px] text-[#7f9a89] leading-snug mt-0.5">{o.description}</p>
                      </div>
                      <Switch
                        checked={organGrants[o.id]}
                        onCheckedChange={() => toggleOrgan(o.id)}
                        aria-label={`Mandat organ ${o.name}`}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>

        {/* Kolom kanan: ledger (d) + denyut (e) + endpoint (f) */}
        <div className="lg:col-span-2 space-y-4">
          {/* d. LEDGER BISNIS */}
          <section className="specimen-frame p-5" aria-label="Ledger bisnis">
            <div className="catalog catalog-phos">LEDGER BISNIS — DARI VAULT LOKAL (BUKAN SERVER)</div>
            <dl className="mt-3 divide-y divide-[#13241a] text-xs">
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-[#7f9a89]">Tier aktif</dt>
                <dd className="font-mono text-[#4ade80]">
                  {tier}
                  {tierUntil ? ` · s.d. ${tierUntil.slice(0, 10)}` : ""}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-[#7f9a89]">Sisa masa kwitansi termuda</dt>
                <dd className="font-mono text-[#bfe8cc]">{daysLeft === null ? "tanpa kwitansi" : `${daysLeft} hari`}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-[#7f9a89]">Penawaran prt di ledger</dt>
                <dd className="font-mono text-[#fbbf24]">{offers} proposal</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-[#7f9a89]">Nilai kwitansi terdeteksi</dt>
                <dd className="font-mono text-[#bfe8cc]">
                  {valueDetected.toLocaleString("id-ID")} {currency}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-[#7f9a89]">Kwitansi tersimpan</dt>
                <dd className="font-mono text-[#bfe8cc]">{receipts.length}</dd>
              </div>
            </dl>
            <p className="text-[10px] text-[#7f9a89] mt-2 leading-relaxed">
              Kejujuran finansial (konstitusi poin 3): angka di atas dibaca dari kwitansi kanonik di IndexedDB Anda —
              prt tidak bisa &quot;menghadiahkan&quot; tier; kwitansi tetap keputusan manusia.
            </p>
          </section>

          {/* e. DENYUT ORGANISME */}
          <section className="specimen-frame p-5" aria-label="Denyut organisme">
            <div className="flex items-center justify-between">
              <div className="catalog catalog-phos">DENYUT ORGANISME — RIWAYAT HEARTBEAT</div>
              <span className="catalog !text-[9px]">bar = latensi · warna = organ</span>
            </div>
            <div className="mt-3 h-14 flex items-end gap-1 border-b border-[#13241a] pb-0" role="img" aria-label="Grafik riwayat latensi heartbeat">
              {bars.length === 0 && <span className="text-[10px] text-[#7f9a89] pb-2">Belum ada denyut — PICU DENYUT di bawah.</span>}
              {bars.map((p, i) => (
                <span
                  key={`${p.at}-${i}`}
                  title={`${organMeta(p.organ).name} · ${p.mode} · ${p.latencyMs} ms · ${p.at.slice(11, 19)}`}
                  className="flex-1 max-w-[10px] min-w-[3px]"
                  style={{
                    height: `${p.ok ? height(p) : 6}px`,
                    background: p.ok ? organMeta(p.organ).color : "#f87171",
                    opacity: p.ok ? 0.9 : 0.6,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {ORGANS.map((o) => (
                <span key={o.id} className="inline-flex items-center gap-1 catalog !text-[8px]" style={{ color: o.color }}>
                  <span className="w-2 h-2 inline-block" style={{ background: o.color }} /> {o.name}
                </span>
              ))}
            </div>
            <button
              onClick={() => void triggerHeartbeat()}
              disabled={pending}
              className="mt-4 w-full bg-[#4ade80] text-[#04130a] px-4 py-2.5 text-sm font-medium hover:bg-[#6ee7a0] transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {pending ? "PRT SEDANG MENALAR…" : "PICU DENYUT"}
            </button>
            <p className="text-[10px] text-[#7f9a89] mt-2 leading-relaxed">
              Otomatis ±60 detik saat mandat ≥ L3 (interval dimatikan saat view ditutup). Gagal LLM → degradasi jujur ke
              refleks (bar merah), tidak pernah macet (konstitusi poin 6).
            </p>
          </section>

          {/* f. PANEL ENDPOINT UNIVERSAL */}
          <EndpointPanel />
        </div>
      </div>
    </div>
  );
}
