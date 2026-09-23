"use client";

// 04 GERBANG — kunci API, endpoint /v1/*, konsol uji nyata, konfigurasi siap-tempel.

import { useState } from "react";
import { Globe2, Play, Terminal } from "lucide-react";
import { useFlybrain } from "@/lib/flybrain/store";
import { maskKey } from "@/lib/flybrain/auth";
import { MCP_TOOLS } from "@/lib/flybrain/mcp-tools";

const ENDPOINTS: { m: string; p: string; d: string; body?: string }[] = [
  { m: "POST", p: "/v1/identity/verify", d: "Verifikasi kunci → tier & username" },
  { m: "GET", p: "/v1/memory?q=drone&limit=5", d: "Cari memori (skor relevansi)" },
  { m: "POST", p: "/v1/memory", d: "Tulis memori baru", body: '{\n  "title": "Posisi home drone",\n  "content": "Home point: -6.2, 106.8 — aman untuk RTH",\n  "kind": "episodic",\n  "tags": ["drone"]\n}' },
  { m: "GET", p: "/v1/logs", d: "Baca log operasional" },
  { m: "POST", p: "/v1/logs", d: "Tulis log", body: '{\n  "channel": "drone-01",\n  "level": "warn",\n  "message": "Baterai 22% — kembali ke home point"\n}' },
  { m: "GET", p: "/v1/decisions", d: "Baca jejak keputusan" },
  { m: "POST", p: "/v1/decisions", d: "Catat keputusan agent", body: '{\n  "context": "Angin lintas 20 km/jam",\n  "choice": "Tunda penerbangan",\n  "rationale": "Batas aman gimbal terlampaui"\n}' },
  { m: "GET", p: "/v1/vault/export", d: "Ekspor vault penuh (JSON kanonik)" },
  { m: "GET", p: "/v1/system/status", d: "Metrik hidup: vault, gerbang, PRT" },
  { m: "POST", p: "/v1/prt/chat", d: "Bicara dengan PRT", body: '{\n  "message": "status"\n}' },
  { m: "GET", p: "/v1/connectome/summary", d: "Statistik atlas (publik, tanpa kunci)" },
];

export function GerbangView() {
  const session = useFlybrain((s) => s.session);
  const tier = useFlybrain((s) => s.tier);
  const runKernel = useFlybrain((s) => s.runKernel);
  const last = useFlybrain((s) => s.lastKernel);
  const swActive = useFlybrain((s) => s.swActive);
  const enableSW = useFlybrain((s) => s.enableSW);
  const stats = useFlybrain((s) => s.stats);
  const setView = useFlybrain((s) => s.setView);

  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/v1/system/status");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [swMsg, setSwMsg] = useState<string | null>(null);


  const run = async (m: string, p: string, b: string) => {
    setBusy(true);
    setMethod(m);
    setPath(p);
    setBody(b);
    await runKernel(m, p, b);
    setBusy(false);
  };

  return (
    <div className="px-4 sm:px-8 py-8">
      <header className="mb-6">
        <p className="catalog catalog-phos">04 — GERBANG · ENDPOINT UNIVERSAL</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">Sambungkan sekali. Semua alat dapat otak.</h1>
        <p className="text-sm text-[#7f9a89] mt-2 max-w-2xl leading-relaxed">
          Gerbang melayani semantik HTTP penuh tanpa server: konsol di bawah menjalankan request nyata ke
          kernel di browser ini. Untuk alat di mesin yang sama, aktifkan mode Service Worker. Kuota:{" "}
          {tier === "PRO" ? "3.600" : "60"} req/jam (tier {tier}).
        </p>
      </header>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Kiri: endpoint list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="specimen-frame p-5">
            <div className="catalog catalog-phos">KUNCI BEARER</div>
            <code className="block mt-2 text-[11px] font-mono text-[#4ade80] break-all">
              Authorization: Bearer {session ? maskKey(session.key) : "FK1_<buat-identitas-di-Vault>"}
            </code>
            {!session && (
              <p className="text-[11px] text-[#fbbf24] mt-2">
                Identitas belum dibuat — request tetap bisa dicoba, tapi akan dijawab 401. Itu memang semantik yang benar.
              </p>
            )}
          </div>

          <div className="specimen-frame p-5">
            <div className="catalog catalog-phos mb-3">DAFTAR ENDPOINT — KLIK UNTUK MENGISI KONSOL</div>
            <ul className="divide-y divide-[#13241a] max-h-80 overflow-y-auto">
              {ENDPOINTS.map((e) => (
                <li key={e.m + e.p}>
                  <button onClick={() => void run(e.m, e.p, e.body ?? "")} className="w-full text-left py-2 px-1 hover:bg-[#0d1a12] group">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 border ${e.m === "GET" ? "border-[#274434] text-[#4ade80]" : e.m === "POST" ? "border-[#7a6a1e] text-[#fbbf24]" : "border-[#7a2e2e] text-[#f1b6b6]"}`}>{e.m}</span>
                      <span className="font-mono text-xs text-[#bfe8cc]">{e.p.split("?")[0]}</span>
                    </div>
                    <span className="text-[11px] text-[#7f9a89] group-hover:text-[#9db8a6]">{e.d}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="specimen-frame p-5">
            <div className="catalog catalog-phos">ENDPOINT HTTP PUBLIK (SERVERLESS STATELESS)</div>
            <p className="text-[11px] text-[#7f9a89] mt-2 leading-relaxed">
              v1.0: <code className="font-mono text-[#4ade80]">POST /api/mcp</code> — JSON-RPC 2.0 nyata di server, amnesia
              total ({MCP_TOOLS.length} tools: system.status, prt.chat, connectome.query, receipt.verify, creature.*, world.map, memory.*). Hermes / opencode / curl
              konek sekali ke URL ini — tanpa kunci, tanpa kuota, tanpa gudang data.
            </p>
            <button
              onClick={() => setView("ruang")}
              className="mt-3 inline-flex items-center gap-2 border border-[#274434] text-[#4ade80] px-3 py-1.5 text-[11px] hover:bg-[#0d1a12]"
            >
              <Globe2 className="w-3.5 h-3.5" /> Buka panel endpoint di 06 Ruang Kendali
            </button>
          </div>

          <div className="specimen-frame p-5">
            <div className="catalog catalog-phos">MODE ENDPOINT NYATA (SERVICE WORKER)</div>
            <p className="text-[11px] text-[#7f9a89] mt-2 leading-relaxed">
              SW mencegat <code className="font-mono">fetch(&quot;/api/korteks/*&quot;)</code> di browser ini dan menjawab
              langsung dari IndexedDB — alat lokal (skrip, MCP bridge) bisa memakai URL nyata tanpa server apa pun.
            </p>
            <button
              onClick={async () => {
                const ok = await enableSW();
                setSwMsg(ok ? "SW aktif — coba: curl -X POST localhost:3000/api/korteks/v1/memory -H 'Authorization: Bearer <kunci>' -d '{...}'" : "SW gagal terdaftar di lingkungan ini (mungkin bukan HTTPS/localhost). Mode virtual tetap berfungsi penuh.");
              }}
              className="mt-3 border border-[#1b2f24] px-3 py-1.5 text-[11px] hover:bg-[#0d1a12]"
            >
              {swActive ? "SW aktif — daftar ulang" : "Aktifkan SW"}
            </button>
            {swMsg && <p className="text-[11px] text-[#9db8a6] mt-2 font-mono break-all">{swMsg}</p>}
          </div>
        </div>

        {/* Kanan: konsol + konfigurasi */}
        <div className="lg:col-span-3 space-y-4">
          <div className="specimen-frame">
            <div className="px-5 py-3 border-b border-[#13241a] flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#4ade80]" />
              <span className="catalog catalog-phos">KONSOL UJI — REQUEST NYATA KE KERNEL</span>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex gap-2">
                <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method"
                  className="bg-[#0d1712] border border-[#1b2f24] px-2 py-2 text-xs font-mono">
                  {["GET", "POST", "DELETE"].map((m) => <option key={m}>{m}</option>)}
                </select>
                <input value={path} onChange={(e) => setPath(e.target.value)} aria-label="Path"
                  className="flex-1 bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#4ade80]" />
                <button
                  disabled={busy}
                  onClick={() => void run(method, path, body)}
                  className="bg-[#4ade80] text-[#04130a] px-4 text-xs font-medium disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Kirim
                </button>
              </div>
              {method !== "GET" && (
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} aria-label="Body JSON"
                  placeholder='{"title": "...", "content": "..."}'
                  className="w-full bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-[#4ade80]" />
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <div className="catalog !text-[9px] mb-1">REQUEST</div>
                  <pre className="text-[10px] font-mono text-[#9db8a6] bg-[#0d1712] border border-[#1b2f24] p-3 overflow-x-auto whitespace-pre-wrap">
{`${method} ${path}
Authorization: Bearer ${session ? maskKey(session.key) : "…"}
${body ? `\n${body}` : ""}`}
                  </pre>
                </div>
                <div>
                  <div className="catalog !text-[9px] mb-1">
                    RESPONSE {last && <span className={last.ok ? "text-[#4ade80]" : "text-[#f87171]"}>— HTTP {last.status} · {last.ms} ms</span>}
                  </div>
                  <pre className="text-[10px] font-mono text-[#bfe8cc] bg-[#0d1712] border border-[#1b2f24] p-3 overflow-auto max-h-64 whitespace-pre-wrap">
{last ? JSON.stringify(last.json, null, 2) : "// belum ada request — klik endpoint di kiri"}
                  </pre>
                </div>
              </div>
              <p className="text-[11px] text-[#7f9a89]">
                Panggilan gerbang tercatat: {stats?.counts.gateway_log ?? 0} — setiap request masuk audit vault Anda (koleksi <span className="font-mono">gateway_log</span>).
              </p>
            </div>
          </div>

          <div className="specimen-frame p-5">
            <div className="catalog catalog-phos mb-3">KONFIGURASI SIAP-TEMPEL</div>
            <div className="space-y-3 text-[11px]">
              <div>
                <div className="catalog !text-[9px]">A. CURL / SKRIP APA PUN</div>
                <pre className="mt-1 text-[10px] font-mono text-[#9db8a6] bg-[#0d1712] border border-[#1b2f24] p-3 overflow-x-auto">{`curl -X POST localhost:3000/api/korteks/v1/memory \\
  -H "Authorization: Bearer ${session ? session.key : "FK1_..."}" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Catatan","content":"Halo otak"}'  # butuh SW aktif`}</pre>
              </div>
              <div>
                <div className="catalog !text-[9px]">B. MCP CLIENT (v0.2 — HTTP TOOLS MAPPING / v1.0 — /mcp RESMI)</div>
                <pre className="mt-1 text-[10px] font-mono text-[#9db8a6] bg-[#0d1712] border border-[#1b2f24] p-3 overflow-x-auto">{`// mapping tool MCP → gerbang (lihat 05_INTEGRATIONS.md §4.1):
// memory_write  → POST /v1/memory
// memory_search → GET  /v1/memory?q=
// system_status → GET  /v1/system/status
// prt_chat      → POST /v1/prt/chat
{ "flybrain": { "baseUrl": "/api/korteks", "auth": "Bearer ${session ? maskKey(session.key) : "FK1_..."}" } }`}</pre>
              </div>
              <div>
                <div className="catalog !text-[9px]">C. HERMES / AGENT HTTP</div>
                <pre className="mt-1 text-[10px] font-mono text-[#9db8a6] bg-[#0d1712] border border-[#1b2f24] p-3 overflow-x-auto">{`base_url: /api/korteks   # atau handleKorteks() via SDK in-process
headers: { Authorization: "Bearer ${session ? maskKey(session.key) : "FK1_..."}" }
tools: [memory_write, memory_search, logs_write, decisions_write, system_status, prt_chat]`}</pre>
              </div>
            </div>
            <p className="text-[10px] text-[#7f9a89] mt-3 leading-relaxed">
              Catatan jujur: mode SW melayani browser yang sama. Akses lintas perangkat & /mcp SSE resmi masuk v1.0
              (relay stateless zero-knowledge — lihat 04_DATA_SOVEREIGNTY.md §7).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
