"use client";

// AppShell — kerangka utama: nav katalog, ticker hidup, 9 view (00–08), footer menempel.

import { useEffect } from "react";
import { Activity, Blocks, Bug, Database, Dna, FileText, Globe2, Landmark, Network, Plug, Radar } from "lucide-react";
import { useFlybrain, type ViewKey } from "@/lib/flybrain/store";
import { useOrganismEngine } from "@/hooks/useOrganismEngine";
import { CivitasDashboard } from "@/components/civitas/Dashboard";
import { KendaliView } from "./views/KendaliView";
import { OtakView } from "./views/OtakView";
import { PrtView } from "./views/PrtView";
import { VaultView } from "./views/VaultView";
import { GerbangView } from "./views/GerbangView";
import { DokumenView } from "./views/DokumenView";
import { RuangKendaliView } from "./views/RuangKendaliView";
import { BiosferView } from "./views/BiosferView";
import { PlanetView } from "./views/PlanetView";
import { PeradabanView } from "./views/PeradabanView";
import { MinecraftView } from "./views/MinecraftView";

const NAV: { key: ViewKey; code: string; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { key: "civitas", code: "00", label: "CIVITAS", icon: Landmark, hint: "Command Center peradaban otonom" },
  { key: "kendali", code: "01", label: "Kendali", icon: Activity, hint: "Gambaran hidup platform" },
  { key: "otak", code: "02", label: "Otak", icon: Network, hint: "Atlas connectome interaktif" },
  { key: "prt", code: "03", label: "PRT", icon: Bug, hint: "Lalat penjaga platform" },
  { key: "vault", code: "04", label: "Vault", icon: Database, hint: "Data lokal Anda — 100% milik Anda" },
  { key: "gerbang", code: "05", label: "Gerbang", icon: Plug, hint: "Endpoint universal semua alat" },
  { key: "dokumen", code: "06", label: "Dokumen", icon: FileText, hint: "PRD, arsitektur, roadmap" },
  { key: "ruang", code: "07", label: "Ruang Kendali", icon: Radar, hint: "Mission Control organisme prt" },
  { key: "biosfer", code: "08", label: "BIOSFER", icon: Dna, hint: "Ekosistem 6 creature otonom" },
  { key: "planet", code: "09", label: "Planet", icon: Globe2, hint: "Peta dunia hidup: biome, iklim, 6 makhluk" },
  { key: "peradaban", code: "10", label: "Peradaban+", icon: Landmark, hint: "CIVITAS OS panel penuh: pemerintah, kota, perusahaan, desa" },
  { key: "minecraft", code: "11", label: "MINECRAFT", icon: Blocks, hint: "World layer: status server & pemetaan entitas" },
];

export function AppShell() {
  const view = useFlybrain((s) => s.view);
  const setView = useFlybrain((s) => s.setView);
  const init = useFlybrain((s) => s.init);
  const ready = useFlybrain((s) => s.ready);
  const ticker = useFlybrain((s) => s.ticker);
  const tier = useFlybrain((s) => s.tier);

  // Denyut otomatis BIOSFER ±45 dtk (1 creature per denyut — budget konstitusi).
  useOrganismEngine();

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="min-h-screen flex flex-col bg-background grid-dots">
      {/* Ticker atas */}
      <div className="border-b border-border bg-[#070d0a] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-1.5">
          <span className="catalog !text-[9px] shrink-0 text-[#fbbf24]">● LIVE</span>
          <div className="relative flex-1 overflow-hidden">
            <div className="ticker-track">
              <span className="catalog pr-16 !normal-case !tracking-normal !text-[10px]">{ticker} — CIVITAS OS v0.2 "GUILD & TOOLFORGE" + FLYBRAIN OS v1.2.2 — 12 view · 8 guild warga · tool calling internet nyata · 1 bangsa · 1 pemerintah · perusahaan otonom · kernel ledger · server {"mulkymalikuldhr.aternos.me:19132"} (Bedrock 1.26.51.1) · tier {tier}</span>
              <span className="catalog pr-16 !normal-case !tracking-normal !text-[10px]" aria-hidden>
                {ticker} — CIVITAS OS v0.2 "GUILD & TOOLFORGE" + FLYBRAIN OS v1.2.2 — 12 view · 8 guild warga · tool calling internet nyata · 1 bangsa · 1 pemerintah · perusahaan otonom · kernel ledger · server {"mulkymalikuldhr.aternos.me:19132"} (Bedrock 1.26.51.1) · tier {tier}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Nav samping (desktop) / atas (mobile) */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-[#070d0a]">
          <div className="px-4 pt-5 pb-4 border-b border-border">
            <div className="text-[11px] font-mono tracking-[0.3em] text-[#4ade80] glow-phos">CIVITAS OS</div>
            <div className="catalog mt-1">PERADABAN OTONOM DIGITAL</div>
          </div>
          <nav className="flex-1 py-2" aria-label="Navigasi utama">
            {NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                aria-current={view === n.key ? "page" : undefined}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors border-l-2 ${
                  view === n.key
                    ? "border-[#4ade80] bg-[#0d1a12] text-[#bfe8cc]"
                    : "border-transparent text-[#7f9a89] hover:bg-[#0b140f] hover:text-[#bfe8cc]"
                }`}
              >
                <n.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">
                  <span className="catalog block !text-[8px]">{n.code}</span>
                  {n.label}
                </span>
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-border">
            <div className="catalog leading-relaxed">
              SPESIMEN 001<br />
              Drosophila melanogaster<br />
              STATUS: {ready ? "SARAF AKTIF" : "MENYALA…"}
            </div>
          </div>
        </aside>

        {/* Nav mobile */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-[#070d0a]/95 backdrop-blur">
          <nav className="flex overflow-x-auto" aria-label="Navigasi utama mobile">
            {NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                aria-current={view === n.key ? "page" : undefined}
                className={`flex-1 min-w-[72px] flex flex-col items-center gap-1 py-2.5 text-[10px] ${
                  view === n.key ? "text-[#4ade80]" : "text-[#7f9a89]"
                }`}
              >
                <n.icon className="w-4 h-4" />
                {n.code}
              </button>
            ))}
          </nav>
        </div>

        {/* Konten */}
        <main className="flex-1 min-w-0 pb-16 md:pb-0">
          {view === "civitas" && <CivitasDashboard />}
          {view === "kendali" && <KendaliView />}
          {view === "otak" && <OtakView />}
          {view === "prt" && <PrtView />}
          {view === "vault" && <VaultView />}
          {view === "gerbang" && <GerbangView />}
          {view === "dokumen" && <DokumenView />}
          {view === "ruang" && <RuangKendaliView />}
          {view === "biosfer" && <BiosferView />}
          {view === "planet" && <PlanetView />}
          {view === "peradaban" && <PeradabanView />}
          {view === "minecraft" && <MinecraftView />}
        </main>
      </div>

      {/* Footer menempel */}
      <footer className="mt-auto border-t border-border bg-[#070d0a] px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
          <span className="catalog">CIVITAS OS v0.2 "GUILD & TOOLFORGE" + FLYBRAIN OS v1.2.2 — peradaban & organisme dalam satu tubuh · denyut 24/7 · ledger double-entry · revenue eksternal dinyatakan jujur</span>
          <span className="catalog">"Produk bukan alat yang dipakai — produk adalah organisme yang bekerja."</span>
        </div>
      </footer>
    </div>
  );
}
