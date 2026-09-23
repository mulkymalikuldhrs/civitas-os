"use client";

// 05 DOKUMEN — ringkasan paket konsistensi langsung di dalam aplikasi.

import { BookOpen, ShieldCheck, Waypoints } from "lucide-react";
import { useState } from "react";

const DOCS: { code: string; title: string; icon: React.ComponentType<{ className?: string }>; summary: string; bullets: string[] }[] = [
  {
    code: "01",
    title: "Riset Pasar & Keputusan A/B/C",
    icon: Waypoints,
    summary:
      "Tiga gelombang bertemu: connectome viral (166K neuron, WIRED Sep 2026), MCP sebagai standar (>8 jt unduhan), dan local-first. Dari tiga opsi, Proyek A (platform terintegrasi) menang matriks berbobot 4,55 vs 2,95 vs 2,80 — B (gateway murni) dan C (vault murni) hidup sebagai modul di dalamnya.",
    bullets: [
      "Celah pasar: tak ada pemain yang gabungkan narasi connectome + memori universal + zero-storage + agent penghuni",
      "Kompetitor (mem0, memnode, glama, Anthropic) semua menyimpan data di server mereka",
      "Lisensi FlyWire CC BY-NC 4.0 → jual infrastruktur, bukan data",
    ],
  },
  {
    code: "02",
    title: "PRD — Kebutuhan Produk",
    icon: BookOpen,
    summary:
      "Enam view, tujuh grup kebutuhan fungsional (FR-1..FR-7) lengkap dengan acceptance criteria, empat persona, metrik 90 hari, dan risiko beserta mitigasinya. Definisi selesai v0.2: semua AC lolos + verifikasi browser.",
    bullets: [
      "FR-1 kunci FK1_ · FR-2 vault · FR-3 deteksi pembayaran lokal · FR-4 gerbang · FR-5 PRT · FR-6 otak · FR-7 non-fungsional (anti-slop adalah kebijakan)",
      "Non-goals terkunci: bukan consciousness, bukan cloud, bukan penjualan data",
      "Metrik: aktivasi ≥60%, kedalaman ≥8 memori, integrasi ≥25% user",
    ],
  },
  {
    code: "03",
    title: "Arsitektur Tanpa Server",
    icon: ShieldCheck,
    summary:
      "FLYBRAIN KERNEL (TypeScript murni): idb, auth, vault, payment, router virtual, PRT, connectome. Satu route, semua logika di browser, deploy ke hosting statis mana pun. Peta fungsi otak↔modul mengunci narasi dan struktur kode.",
    bullets: [
      "handleKorteks(method, path, body, bearer) = satu titik masuk semantik HTTP",
      "Service Worker opsional = endpoint nyata tanpa server; edge relay zero-knowledge masuk v1.0",
      "Tanpa Python, tanpa Prisma, tanpa API route — larangan terkunci dari owner",
    ],
  },
  {
    code: "04",
    title: "Data Sovereignty & Pembayaran",
    icon: BookOpen,
    summary:
      "Skema data kanonik (8 koleksi), kunci = turunan username+password, kwitansi JSON dengan checksum & masa aktif yang divalidasi lokal. Kejujuran kriptografis dinyatakan terbuka: v0.2 integritas format; penandatanganan mitra masuk v1.0.",
    bullets: [
      "Kami tidak bisa mengintip — tidak ada server penyimpanan yang ada",
      "Data tidak pernah terkunci: format ekspor terdokumentasi penuh",
      "Relay lintas-perangkat v1.0: blob terenkripsi di storage milik user sendiri",
    ],
  },
  {
    code: "05",
    title: "Gerbang Integrasi Universal",
    icon: Waypoints,
    summary:
      "11 endpoint /v1/*, tiga mode penjalanan (virtual, service worker, edge v1.0), resep koneksi untuk MCP client, Hermes, IoT/skrip, plus playbook pola integrasi (agent lupa→ingat, audit keputusan, perangkat menjaga dirinya).",
    bullets: [
      "Satu protokol JSON+HTTP untuk semua klien — wiring dilakukan sekali",
      "Kuota per tier: FREE 60/jam, PRO 3.600/jam — dibegok di kernel",
      "Audit semua panggilan tersimpan di gateway_log milik user",
    ],
  },
  {
    code: "06",
    title: "PRT — Spesifikasi Agent",
    icon: ShieldCheck,
    summary:
      "Lalat digital dengan loop patroli ±6 detik: vault_health, receipt_watch, gateway_audit, memory_groom, pulse. Tiga meter vital, kepribadian PRT rumahan, dan kontrak otonomi L0-L3: tak pernah menghapus data tanpa izin.",
    bullets: [
      "Chat rule-based tanpa LLM server — bekerja offline penuh",
      "Hak tulis hanya ke log/event (least privilege)",
      "Framing terkunci: kesadaran operasional, bukan biologis",
    ],
  },
];

export function DokumenView() {
  const [open, setOpen] = useState<string | null>("01");

  return (
    <div className="px-4 sm:px-8 py-8">
      <header className="mb-6">
        <p className="catalog catalog-phos">05 — PAKET KONSISTENSI</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">Dokumen yang mengikat proyek ini</h1>
        <p className="text-sm text-[#7f9a89] mt-2 max-w-2xl leading-relaxed">
          Ringkasan berjalan dari 9 dokumen lengkap di <span className="font-mono text-[#bfe8cc]">/download/flybrain-os/</span> —
          PRD, arsitektur, data sovereignty, integrasi, PRT, roadmap, konteks kanonik, dan changelog.
          Dokumen adalah sumber kebenaran; kode mengikuti dokumen.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {DOCS.map((d) => (
          <button
            key={d.code}
            onClick={() => setOpen(open === d.code ? null : d.code)}
            aria-expanded={open === d.code}
            className="specimen-frame p-5 text-left hover:border-[#274434] transition-colors"
          >
            <div className="flex items-center gap-3">
              <d.icon className="w-4 h-4 text-[#4ade80] shrink-0" />
              <span className="catalog !text-[9px]">DOK {d.code}</span>
              <span className="text-sm text-[#bfe8cc]">{d.title}</span>
            </div>
            <p className="text-xs text-[#9db8a6] mt-3 leading-relaxed">{d.summary}</p>
            {open === d.code && (
              <ul className="mt-3 space-y-1.5 border-t border-[#13241a] pt-3">
                {d.bullets.map((b) => (
                  <li key={b} className="text-[11px] text-[#7f9a89] flex gap-2">
                    <span className="text-[#4ade80]">▸</span>
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6 specimen-frame p-5">
        <div className="catalog catalog-phos">KONVENSI BUKTI SELURUH PAKET</div>
        <div className="mt-3 grid sm:grid-cols-3 gap-3 text-[11px]">
          <div className="border border-[#13241a] p-3"><span className="font-mono text-[#4ade80]">[T]</span><p className="text-[#9db8a6] mt-1">Terverifikasi — riset 16 kueri (2026-09-21) tersimpan di /research/*.json</p></div>
          <div className="border border-[#13241a] p-3"><span className="font-mono text-[#fbbf24]">[D]</span><p className="text-[#9db8a6] mt-1">Keputusan desain — sudah dikunci, tinggal dieksekusi</p></div>
          <div className="border border-[#13241a] p-3"><span className="font-mono text-[#7f9a89]">[H]</span><p className="text-[#9db8a6] mt-1">Hipotesis — harus divalidasi dengan pemakaian nyata</p></div>
        </div>
      </div>
    </div>
  );
}
