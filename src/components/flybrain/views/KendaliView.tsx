"use client";

// 00 RUANG KENDALI — gambaran hidup: kanvas neuron hero, KPI, peta fungsi.

import { useEffect, useState } from "react";
import { ArrowRight, Bug, Database, Plug, ShieldCheck } from "lucide-react";
import { useFlybrain } from "@/lib/flybrain/store";
import { MACRO_FACTS } from "@/lib/flybrain/connectome";
import { BrainCanvas } from "../BrainCanvas";

export function KendaliView() {
  const setView = useFlybrain((s) => s.setView);
  const stats = useFlybrain((s) => s.stats);
  const tier = useFlybrain((s) => s.tier);
  const vitals = useFlybrain((s) => s.vitals);
  const prtBeat = useFlybrain((s) => s.prtBeat);
  const session = useFlybrain((s) => s.session);
  const feed = useFlybrain((s) => s.prtFeed);
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const kpis = [
    { label: "PRT — beat terakhir", value: String(prtBeat), sub: `energi ${vitals.energy} · fokus ${vitals.focus} · mood ${vitals.mood}`, icon: Bug },
    { label: "Vault lokal", value: String(stats?.totalRecords ?? 0), sub: `±${((stats?.totalBytes ?? 0) / 1024).toFixed(1)} KB di perangkat Anda`, icon: Database },
    { label: "Gerbang", value: String(stats?.counts.gateway_log ?? 0), sub: "panggilan /v1/* tercatat", icon: Plug },
    { label: "Tier", value: tier, sub: tier === "PRO" ? "terkunci lokal via kwitansi" : "upgrade via kwitansi lokal", icon: ShieldCheck },
  ];

  return (
    <div>
      {/* HERO */}
      <section className="relative border-b border-border scanlines vignette overflow-hidden">
        <div className="absolute inset-0 opacity-80">
          <BrainCanvas height={420} intensity={0.7} />
        </div>
        <div className="relative px-4 sm:px-8 pt-14 pb-10 max-w-3xl">
          <p className="catalog !text-[#fbbf24]">PROYEK A — PLATFORM OTAK TERINTEGRASI</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Satu sambungan untuk semua alat.
            <br />
            <span className="text-[#4ade80] glow-phos">Data tetap milikmu.</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[#9db8a6] leading-relaxed max-w-xl">
            FLYBRAIN OS memberi memori, kesadaran operasional, dan gerbang integrasi kepada semua
            tool, agent, dan perangkat Anda — memakai otak lalat sebagai model arsitektur.
            Tanpa server backend: seluruh sistem hidup di browser Anda.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setView("gerbang")}
              className="inline-flex items-center gap-2 bg-[#4ade80] text-[#04130a] px-5 py-2.5 text-sm font-medium hover:bg-[#6ee7a0] transition-colors"
            >
              Sambungkan alat pertama <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("prt")}
              className="inline-flex items-center gap-2 border border-[#1b2f24] px-5 py-2.5 text-sm text-[#bfe8cc] hover:bg-[#0d1a12] transition-colors"
            >
              Kenali PRT
            </button>
          </div>
          {!session && (
            <p className="mt-4 catalog !text-[#fbbf24]">◆ IDENTITAS LOKAL BELUM DIBUAT — buka VAULT untuk mulai</p>
          )}
        </div>
      </section>

      {/* KPI */}
      <section className="px-4 sm:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="specimen-frame p-4">
              <k.icon className="w-4 h-4 text-[#4ade80]" />
              <div className="catalog mt-3">{k.label}</div>
              <div className="text-2xl font-mono font-semibold mt-1 text-[#e6f2e9]">{k.value}</div>
              <div className="text-[11px] text-[#7f9a89] mt-1 leading-snug">{k.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Peta fungsi + feed */}
      <section className="px-4 sm:px-8 pb-12 grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 specimen-frame p-5">
          <div className="catalog catalog-phos">PETA FUNGSI — OTAK LALAT ↔ MODUL PLATFORM</div>
          <p className="text-xs text-[#7f9a89] mt-2 leading-relaxed">
            Arsitektur platform meniru aliran sinyal otak lalat nyata (FAFB, Nature 2024). Setiap
            region di atlas punya padanan modul — inilah kenapa platform ini &quot;otak&quot;, bukan sekadar database.
          </p>
          <ul className="mt-4 divide-y divide-[#13241a] text-sm">
            {[
              ["Lobus Antena", "GERBANG — input universal"],
              ["Kaliks Lobus Jamur", "VAULT — memori asosiatif"],
              ["Sel Kenyon & Lobus Jamur", "VAULT — memori jangka panjang"],
              ["Kompleks Pusat", "PRT — koordinasi & keputusan"],
              ["Lobus Optik", "VISUAL — lapisan pemantauan"],
              ["Fibrillar Body & Ring", "IDENTITAS — status internal"],
            ].map(([a, b]) => (
              <li key={a} className="flex items-center justify-between gap-3 py-2">
                <span className="text-[#bfe8cc]">{a}</span>
                <span className="catalog text-right">{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t border-[#13241a] text-[11px] text-[#7f9a89] leading-relaxed">
            Fakta makro rujukan: {MACRO_FACTS.female.label} — {MACRO_FACTS.female.neurons.toLocaleString("id-ID")} neuron, {MACRO_FACTS.female.synapses} sinapsis.
          </div>
        </div>

        <div className="lg:col-span-2 specimen-frame p-5 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="catalog catalog-phos">FEED PRT — AKTIVITAS TERKINI</div>
            <span className="w-2 h-2 rounded-full bg-[#4ade80] breathe" aria-hidden />
          </div>
          <ul className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1 text-xs">
            {feed.length === 0 && (
              <li className="text-[#7f9a89]">PRT sedang menata sarang… patroli pertama dalam hitungan detik.</li>
            )}
            {feed.slice(0, 12).map((f) => (
              <li key={f.id + f.at} className="border-l-2 pl-3 py-1" style={{ borderColor: f.severity === "alert" ? "#f87171" : f.severity === "warn" ? "#fbbf24" : "#4ade80" }}>
                <span className="catalog !text-[8px]">{f.task}</span>
                <p className="text-[#bfe8cc] mt-0.5 leading-snug">{f.note}</p>
              </li>
            ))}
          </ul>
          <button onClick={() => setView("prt")} className="mt-auto pt-4 text-left catalog catalog-phos hover:text-[#6ee7a0]">
            → Buka konsol PRT
          </button>
        </div>
      </section>
    </div>
  );
}
