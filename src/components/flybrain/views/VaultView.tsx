"use client";

// 03 VAULT — identitas lokal, kwitansi/pembayaran, 4 koleksi, ekspor/impor, hancurkan.

import { useRef, useState } from "react";
import { Download, KeyRound, Upload } from "lucide-react";
import { useFlybrain } from "@/lib/flybrain/store";
import { maskKey } from "@/lib/flybrain/auth";

type Tab = "memories" | "logs" | "decisions" | "receipts";

const TABS: { key: Tab; label: string; desc: string }[] = [
  { key: "memories", label: "MEMORI", desc: "Memori episodik / semantik / kerja" },
  { key: "logs", label: "LOG", desc: "Jejak operasional semua sumber" },
  { key: "decisions", label: "KEPUTUSAN", desc: "Konteks → pilihan → alasan" },
  { key: "receipts", label: "KWITANSI", desc: "Bukti pembayaran milik Anda" },
];

export function VaultView() {
  const session = useFlybrain((s) => s.session);
  const createIdentity = useFlybrain((s) => s.createIdentity);
  const logout = useFlybrain((s) => s.logout);
  const tier = useFlybrain((s) => s.tier);
  const tierUntil = useFlybrain((s) => s.tierUntil);
  const stats = useFlybrain((s) => s.stats);
  const memories = useFlybrain((s) => s.memories);
  const receipts = useFlybrain((s) => s.receipts);
  const addMemoryUI = useFlybrain((s) => s.addMemoryUI);
  const addLogUI = useFlybrain((s) => s.addLogUI);
  const removeMemoryUI = useFlybrain((s) => s.removeMemoryUI);
  const addDecisionUI = useFlybrain((s) => s.addDecisionUI);
  const pasteReceipt = useFlybrain((s) => s.pasteReceipt);
  const saveDemoReceipt = useFlybrain((s) => s.saveDemoReceipt);
  const verifyReceipts = useFlybrain((s) => s.verifyReceipts);
  const doExport = useFlybrain((s) => s.doExport);
  const doImport = useFlybrain((s) => s.doImport);
  const wipe = useFlybrain((s) => s.wipe);

  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("memories");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // form tambah
  const [mTitle, setMTitle] = useState("");
  const [mContent, setMContent] = useState("");
  const [mKind, setMKind] = useState<"episodic" | "semantic" | "working">("episodic");
  const [lMsg, setLMsg] = useState("");
  const [lLevel, setLLevel] = useState<"info" | "warn" | "alert">("info");
  const [dCtx, setDCtx] = useState("");
  const [dChoice, setDChoice] = useState("");
  const [dWhy, setDWhy] = useState("");
  const [rcptRaw, setRcptRaw] = useState("");

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 6000);
  };

  const guard = async (fn: () => Promise<string>) => {
    setPending(true);
    try {
      const text = await fn();
      flash(true, text);
    } catch (e) {
      flash(false, e instanceof Error ? e.message : "Gagal.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="px-4 sm:px-8 py-8">
      <header className="mb-6">
        <p className="catalog catalog-phos">03 — VAULT · DATA LOKAL ANDA</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">Yang tersimpan di sini, hanya ada di sini</h1>
        <p className="text-sm text-[#7f9a89] mt-2 max-w-2xl leading-relaxed">
          IndexedDB di browser ini. Kami tidak bisa membacanya, tidak bisa memulihkannya, tidak bisa
          menjualnya — karena secara teknis tidak ada server yang menyimpannya. Ekspor rutin = asuransi Anda.
        </p>
      </header>

      {msg && (
        <div className={`mb-4 border px-4 py-2.5 text-xs ${msg.ok ? "border-[#274434] bg-[#0a1f12] text-[#bfe8cc]" : "border-[#7a2e2e] bg-[#1f0a0a] text-[#f1b6b6]"}`} role="status">
          {msg.text}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* IDENTITAS */}
        <div className="specimen-frame p-5">
          <div className="catalog catalog-phos flex items-center gap-2"><KeyRound className="w-3.5 h-3.5" /> IDENTITAS & KUNCI</div>
          {session ? (
            <div className="mt-3 space-y-2 text-xs">
              <div className="text-[#bfe8cc]">username: <span className="font-mono">{session.username}</span></div>
              <div className="text-[#bfe8cc]">kunci: <span className="font-mono text-[#4ade80]">{maskKey(session.key)}</span></div>
              <p className="text-[11px] text-[#7f9a89] leading-relaxed">
                Kunci = FK1_ + SHA-256(username|password), dihitung di perangkat. Password tidak pernah
                disimpan di mana pun. Kunci ini juga bearer token Gerbang.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(session.key);
                    flash(true, "Kunci disalin ke clipboard.");
                  }}
                  className="border border-[#1b2f24] px-3 py-1.5 text-[11px] hover:bg-[#0d1a12]"
                >
                  Salin kunci
                </button>
                <button onClick={logout} className="border border-[#1b2f24] px-3 py-1.5 text-[11px] hover:bg-[#0d1a12]">
                  Keluar (data tetap)
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <input value={u} onChange={(e) => setU(e.target.value)} placeholder="username" aria-label="Username"
                className="w-full bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-sm focus:outline-none focus:border-[#4ade80]" />
              <input value={p} type="password" onChange={(e) => setP(e.target.value)} placeholder="password" aria-label="Password"
                className="w-full bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-sm focus:outline-none focus:border-[#4ade80]" />
              <button
                disabled={!u.trim() || p.length < 4 || pending}
                onClick={() => void guard(async () => {
                  const k = await createIdentity(u, p);
                  setKey(k);
                  return "Identitas lokal dibuat. Kunci Anda siap dipakai di Gerbang.";
                })}
                className="w-full bg-[#4ade80] text-[#04130a] px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-[#6ee7a0] transition-colors"
              >
                Buat identitas lokal
              </button>
              <p className="text-[11px] text-[#7f9a89]">Tidak ada pendaftaran ke server — identitas lahir dan tinggal di perangkat ini.</p>
            </div>
          )}
          {key && (
            <div className="mt-3 border border-[#274434] bg-[#0a1f12] p-3">
              <div className="catalog !text-[9px]">KUNCI ANDA (SALIN & SIMPAN)</div>
              <code className="block mt-1 text-[10px] break-all text-[#4ade80] font-mono">{key}</code>
            </div>
          )}
        </div>

        {/* TIER & KWITANSI */}
        <div className="specimen-frame p-5">
          <div className="catalog catalog-phos">TIER & PEMBAYARAN NOL-PENYIMPANAN</div>
          <div className="mt-3 flex items-center gap-3">
            <span className={`font-mono text-2xl ${tier === "PRO" ? "text-[#fbbf24]" : "text-[#9db8a6]"}`}>{tier}</span>
            {tierUntil && <span className="catalog">s.d. {tierUntil.slice(0, 10)}</span>}
          </div>
          <p className="text-[11px] text-[#7f9a89] mt-2 leading-relaxed">
            Kami tidak menyimpan status pembayaran — sistem mendeteksi kwitansi dari data lokal Anda,
            memvalidasi checksum & masa aktif, lalu mengunci tier secara lokal. Kedaluwarsa? Tier turun
            sendiri saat patroli PRT. Tanpa penagihan, tanpa server.
          </p>
          <textarea
            value={rcptRaw}
            onChange={(e) => setRcptRaw(e.target.value)}
            placeholder='Tempel kwitansi JSON {"schema":"flybrain.receipt/v1", ...}'
            aria-label="Kwitansi JSON"
            rows={3}
            className="mt-3 w-full bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-[#4ade80]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button disabled={!session || pending} onClick={() => void guard(() => pasteReceipt(rcptRaw).then((r) => { if (!r.ok) throw new Error(r.message); return r.message; }))}
              className="border border-[#1b2f24] px-3 py-1.5 text-[11px] hover:bg-[#0d1a12] disabled:opacity-40">Validasi & aktifkan</button>
            <button disabled={!session || pending} onClick={() => void guard(async () => (await saveDemoReceipt()).message)}
              className="border border-[#1b2f24] px-3 py-1.5 text-[11px] hover:bg-[#0d1a12] disabled:opacity-40">Isi kwitansi demo</button>
            <button disabled={!session || pending} onClick={() => void guard(async () => (await verifyReceipts()).message)}
              className="border border-[#1b2f24] px-3 py-1.5 text-[11px] hover:bg-[#0d1a12] disabled:opacity-40">Validasi kwitansi tersimpan</button>
          </div>
        </div>

        {/* STORAGE */}
        <div className="specimen-frame p-5">
          <div className="catalog catalog-phos">PEMAKAIAN PENYIMPANAN</div>
          <div className="mt-3 font-mono text-2xl text-[#e6f2e9]">{((stats?.totalBytes ?? 0) / 1024).toFixed(1)} <span className="text-sm text-[#7f9a89]">KB</span></div>
          <div className="mt-2 h-2 bg-[#0d1712] border border-[#1b2f24]">
            <div className="h-full bg-[#4ade80]" style={{ width: `${Math.min(100, ((stats?.totalBytes ?? 0) / 5_000_000) * 100)}%` }} />
          </div>
          <ul className="mt-3 space-y-1 text-[11px] text-[#7f9a89] font-mono">
            {TABS.map((t) => (
              <li key={t.key} className="flex justify-between">
                <span>{t.label.toLowerCase()}</span>
                <span className="text-[#9db8a6]">{stats?.counts[t.key] ?? 0} rek · {((stats?.bytes[t.key] ?? 0) / 1024).toFixed(1)} KB</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => void doExport()} className="inline-flex items-center gap-1.5 bg-[#4ade80] text-[#04130a] px-3 py-1.5 text-[11px] font-medium hover:bg-[#6ee7a0]">
              <Download className="w-3.5 h-3.5" /> Ekspor JSON
            </button>
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 border border-[#1b2f24] px-3 py-1.5 text-[11px] hover:bg-[#0d1a12]">
              <Upload className="w-3.5 h-3.5" /> Impor
            </button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void guard(() => doImport(f).then((r) => { if (!r.ok) throw new Error(r.message); return r.message; }));
                e.target.value = "";
              }} />
            <button
              onClick={() => {
                if (window.confirm("HANCURKAN VAULT? Seluruh data lokal dihapus permanen dari browser ini. Tidak bisa dibatalkan.")) {
                  void guard(async () => { await wipe(); return "Vault dihancurkan. Sarang kosong — PRT menunggu data pertama."; });
                }
              }}
              className="ml-auto border border-[#7a2e2e] text-[#f1b6b6] px-3 py-1.5 text-[11px] hover:bg-[#1f0a0a]"
            >
              Hancurkan vault
            </button>
          </div>
        </div>
      </div>

      {/* KOLEKSI */}
      <div className="mt-6 specimen-frame">
        <div className="flex flex-wrap border-b border-[#13241a]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-[11px] font-mono tracking-widest border-b-2 transition-colors ${
                tab === t.key ? "border-[#4ade80] text-[#bfe8cc] bg-[#0d1a12]" : "border-transparent text-[#7f9a89] hover:text-[#bfe8cc]"
              }`}
            >
              {t.label} · {t.key === "memories" ? (stats?.counts.memories ?? 0) : t.key === "receipts" ? (stats?.counts.receipts ?? 0) : t.key === "logs" ? (stats?.counts.logs ?? 0) : (stats?.counts.decisions ?? 0)}
            </button>
          ))}
          {tab !== "receipts" && (
            <div className="ml-auto p-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="cari…" aria-label="Cari rekaman"
                className="bg-[#0d1712] border border-[#1b2f24] px-3 py-1.5 text-xs w-44 focus:outline-none focus:border-[#4ade80]" />
            </div>
          )}
        </div>

        <div className="p-5">
          {tab === "memories" && (
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="catalog !text-[9px]">TAMBAH MEMORI</div>
                <input value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="judul" aria-label="Judul memori"
                  className="w-full bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-sm focus:outline-none focus:border-[#4ade80]" />
                <textarea value={mContent} onChange={(e) => setMContent(e.target.value)} placeholder="isi memori…" rows={3} aria-label="Isi memori"
                  className="w-full bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-sm focus:outline-none focus:border-[#4ade80]" />
                <div className="flex gap-2">
                  <select value={mKind} onChange={(e) => setMKind(e.target.value as "episodic" | "semantic" | "working")} aria-label="Jenis memori"
                    className="bg-[#0d1712] border border-[#1b2f24] px-2 py-2 text-xs flex-1">
                    <option value="episodic">episodic</option>
                    <option value="semantic">semantic</option>
                    <option value="working">working</option>
                  </select>
                  <button disabled={!mTitle.trim() || !mContent.trim() || pending}
                    onClick={() => void guard(async () => { await addMemoryUI(mTitle, mContent, mKind, []); setMTitle(""); setMContent(""); return "Memori tersimpan lokal."; })}
                    className="bg-[#4ade80] text-[#04130a] px-4 text-xs font-medium disabled:opacity-40">Simpan</button>
                </div>
              </div>
              <MemList items={memories} q={q} onDelete={(id) => void guard(async () => { await removeMemoryUI(id); return `Memori ${id.slice(0, 12)}… dihapus.`; })} />
            </div>
          )}

          {tab === "logs" && (
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="catalog !text-[9px]">TAMBAH LOG</div>
                <input value={lMsg} onChange={(e) => setLMsg(e.target.value)} placeholder="pesan log…" aria-label="Pesan log"
                  className="w-full bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-sm focus:outline-none focus:border-[#4ade80]" />
                <div className="flex gap-2">
                  <select value={lLevel} onChange={(e) => setLLevel(e.target.value as "info" | "warn" | "alert")} aria-label="Level log"
                    className="bg-[#0d1712] border border-[#1b2f24] px-2 py-2 text-xs flex-1">
                    <option value="info">info</option><option value="warn">warn</option><option value="alert">alert</option>
                  </select>
                  <button disabled={!lMsg.trim() || pending}
                    onClick={() => void guard(async () => { await addLogUI(lMsg, lLevel); setLMsg(""); return "Log tersimpan."; })}
                    className="bg-[#4ade80] text-[#04130a] px-4 text-xs font-medium disabled:opacity-40">Simpan</button>
                </div>
              </div>
              <LogList q={q} />
            </div>
          )}

          {tab === "decisions" && (
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="catalog !text-[9px]">TAMBAH KEPUTUSAN</div>
                <input value={dCtx} onChange={(e) => setDCtx(e.target.value)} placeholder="konteks…" aria-label="Konteks keputusan"
                  className="w-full bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-sm focus:outline-none focus:border-[#4ade80]" />
                <input value={dChoice} onChange={(e) => setDChoice(e.target.value)} placeholder="pilihan…" aria-label="Pilihan keputusan"
                  className="w-full bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-sm focus:outline-none focus:border-[#4ade80]" />
                <textarea value={dWhy} onChange={(e) => setDWhy(e.target.value)} placeholder="alasan…" rows={2} aria-label="Alasan keputusan"
                  className="w-full bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-sm focus:outline-none focus:border-[#4ade80]" />
                <button disabled={!dChoice.trim() || pending}
                  onClick={() => void guard(async () => { await addDecisionUI(dCtx, dChoice, dWhy); setDCtx(""); setDChoice(""); setDWhy(""); return "Keputusan tercatat."; })}
                  className="bg-[#4ade80] text-[#04130a] px-4 py-2 text-xs font-medium disabled:opacity-40">Simpan</button>
              </div>
              <DecisionList q={q} />
            </div>
          )}

          {tab === "receipts" && (
            <ul className="space-y-2 text-xs">
              {receipts.length === 0 && <li className="text-[#7f9a89]">Belum ada kwitansi. Tombol &quot;Isi kwitansi demo&quot; di panel Tier membuat contoh sah untuk mencoba alur.</li>}
              {receipts.map((r) => (
                <li key={r.id} className="border border-[#13241a] p-3 font-mono text-[11px] text-[#9db8a6]">
                  <span className="text-[#fbbf24]">{r.payload.receipt_id}</span> · {r.payload.tier} · {r.payload.period_months} bln · {r.payload.channel} · {r.payload.amount.currency} {r.payload.amount.value} · {r.ts.slice(0, 10)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function MemList({ items, q, onDelete }: { items: { id: string; ts: string; source: string; tags?: string[]; payload: { title: string; content: string; kind: string } }[]; q: string; onDelete: (id: string) => void }) {
  const filtered = q ? items.filter((m) => `${m.payload.title} ${m.payload.content}`.toLowerCase().includes(q.toLowerCase())) : items;
  return (
    <div className="lg:col-span-2 max-h-96 overflow-y-auto space-y-2 pr-1">
      {filtered.length === 0 && <p className="text-xs text-[#7f9a89]">Belum ada memori yang cocok.</p>}
      {filtered.map((m) => (
        <div key={m.id} className="border border-[#13241a] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-[#bfe8cc]">{m.payload.title}</span>
            <span className="catalog !text-[8px]">{m.source} · {m.ts.slice(11, 19)}</span>
          </div>
          <p className="text-xs text-[#7f9a89] mt-1 leading-relaxed">{m.payload.content}</p>
          <div className="mt-1.5 flex gap-2 items-center">
            <span className="catalog !text-[8px] text-[#fbbf24]">{m.payload.kind}</span>
            <span className="catalog !text-[8px]">{m.id}</span>
            <button onClick={() => onDelete(m.id)} aria-label={`Hapus memori ${m.payload.title}`} className="ml-auto catalog !text-[8px] text-[#f1b6b6] hover:text-[#f87171]">HAPUS</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function LogList({ q }: { q: string }) {
  const logs = useFlybrain((s) => s.logs);
  const filtered = q ? logs.filter((l) => JSON.stringify(l).toLowerCase().includes(q.toLowerCase())) : logs;
  return (
    <div className="lg:col-span-2 max-h-96 overflow-y-auto space-y-2 pr-1 text-xs">
      {filtered.length === 0 && <p className="text-[#7f9a89]">Belum ada log yang cocok.</p>}
      {filtered.map((l) => (
        <div key={l.id} className="border-l-2 pl-3 py-1" style={{ borderColor: l.payload.level === "alert" ? "#f87171" : l.payload.level === "warn" ? "#fbbf24" : "#274434" }}>
          <span className="catalog !text-[8px]">{l.ts.slice(11, 19)} · {l.payload.channel} · {l.payload.level} · {l.source}</span>
          <p className="text-[#bfe8cc] leading-snug">{l.payload.message}</p>
        </div>
      ))}
    </div>
  );
}

function DecisionList({ q }: { q: string }) {
  const decisions = useFlybrain((s) => s.decisions);
  const filtered = q ? decisions.filter((d) => JSON.stringify(d).toLowerCase().includes(q.toLowerCase())) : decisions;
  return (
    <div className="lg:col-span-2 max-h-96 overflow-y-auto space-y-2 pr-1 text-xs">
      {filtered.length === 0 && <p className="text-[#7f9a89]">Belum ada keputusan tercatat.</p>}
      {filtered.map((d) => (
        <div key={d.id} className="border border-[#13241a] p-3">
          <div className="text-[#bfe8cc]">{d.payload.choice}</div>
          <div className="text-[11px] text-[#7f9a89] mt-1">konteks: {d.payload.context || "—"}</div>
          <div className="text-[11px] text-[#7f9a89]">alasan: {d.payload.rationale || "—"}</div>
          <span className="catalog !text-[8px]">{d.ts.slice(0, 19).replace("T", " ")} · {d.source}</span>
        </div>
      ))}
    </div>
  );
}
