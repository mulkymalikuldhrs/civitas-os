"use client";

// 01 OTAK — atlas connectome interaktif + statistik makro nyata + peta fungsi.

import { useState } from "react";
import { AtlasCanvas } from "../AtlasCanvas";
import { buildAtlas, MACRO_FACTS } from "@/lib/flybrain/connectome";
import type { Neuron } from "@/lib/flybrain/types";

export function OtakView() {
  const [sel, setSel] = useState<Neuron | null>(null);
  const atlas = buildAtlas();
  const region = sel ? atlas.regions.find((r) => r.key === sel.region) : null;

  return (
    <div className="px-4 sm:px-8 py-8">
      <header className="mb-6">
        <p className="catalog catalog-phos">01 — ATLAS CONNECTOME</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">Otak yang dihuni PRT</h1>
        <p className="text-sm text-[#7f9a89] mt-2 max-w-2xl leading-relaxed">
          {atlas.neurons.length} neuron virtual dalam {atlas.regions.length} region — deterministik, sama di semua
          perangkat. Klik neuron mana pun untuk membaca katalognya. Angka makro di panel kanan adalah
          angka nyata dari sumber primer, dengan atribusi.
        </p>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 specimen-frame scanlines relative">
          <AtlasCanvas height={470} selected={sel} onSelect={setSel} />
          <div className="absolute top-3 left-3 catalog">KANVAS SPESIMEN — klik = inspeksi</div>
        </div>

        <div className="space-y-4">
          {/* Detail neuron */}
          <div className="specimen-frame p-5">
            <div className="catalog catalog-phos">INSPEKSI NEURON</div>
            {sel && region ? (
              <div className="mt-3 space-y-2 text-sm">
                <div className="font-mono text-lg text-[#fbbf24]">{sel.catalog}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[#9db8a6]">
                  <span className="catalog !text-[9px]">REGION</span>
                  <span className="text-[#bfe8cc] text-right">{region.name}</span>
                  <span className="catalog !text-[9px]">DERAJAT</span>
                  <span className="text-[#bfe8cc] text-right font-mono">{sel.degree} edges</span>
                  <span className="catalog !text-[9px]">SINAPSIS VIRTUAL</span>
                  <span className="text-[#bfe8cc] text-right font-mono">{sel.synapses.toLocaleString("id-ID")}</span>
                  <span className="catalog !text-[9px]">PADANAN MODUL</span>
                  <span className="text-[#bfe8cc] text-right">{region.module}</span>
                </div>
                <p className="text-[11px] text-[#7f9a89] leading-relaxed pt-2 border-t border-[#13241a] mt-2">{region.role}</p>
              </div>
            ) : (
              <p className="text-xs text-[#7f9a89] mt-3 leading-relaxed">
                Belum ada neuron terpilih. Arahkan kursor untuk mengintip, klik untuk inspeksi penuh.
                Setiap neuron punya nomor katalog ala spesimen laboratorium.
              </p>
            )}
          </div>

          {/* Statistik makro nyata */}
          <div className="specimen-frame p-5">
            <div className="catalog catalog-phos">STATISTIK MAKRO — SUMBER NYATA [T]</div>
            <dl className="mt-3 space-y-3 text-xs">
              <div>
                <dt className="text-[#bfe8cc]">{MACRO_FACTS.female.label}</dt>
                <dd className="text-[#7f9a89] mt-0.5">
                  <span className="font-mono text-[#e6f2e9]">{MACRO_FACTS.female.neurons.toLocaleString("id-ID")}</span> neuron ·{" "}
                  <span className="font-mono text-[#e6f2e9]">{MACRO_FACTS.female.synapses}</span> sinapsis ·{" "}
                  {MACRO_FACTS.female.cellTypes} tipe sel · {MACRO_FACTS.female.source}
                </dd>
              </div>
              <div>
                <dt className="text-[#bfe8cc]">{MACRO_FACTS.male.label}</dt>
                <dd className="text-[#7f9a89] mt-0.5">
                  <span className="font-mono text-[#e6f2e9]">±166.000</span> neuron ·{" "}
                  <span className="font-mono text-[#e6f2e9]">{MACRO_FACTS.male.synapses}</span> sinapsis · {MACRO_FACTS.male.source}
                </dd>
              </div>
              <div>
                <dt className="text-[#bfe8cc]">{MACRO_FACTS.mcp.label}</dt>
                <dd className="text-[#7f9a89] mt-0.5">
                  {MACRO_FACTS.mcp.servers} server · {MACRO_FACTS.mcp.downloads} unduhan · {MACRO_FACTS.mcp.growth}
                </dd>
              </div>
            </dl>
            <p className="catalog mt-4 leading-relaxed !normal-case !tracking-normal !text-[9px]">
              Data connectome asli berlisensi CC BY-NC 4.0 — FLYBRAIN OS tidak mendistribusikan data mentah,
              hanya menampilkan statistik beratribusi dan memodelkan arsitekturnya.
            </p>
          </div>

          {/* Legenda region */}
          <div className="specimen-frame p-5">
            <div className="catalog catalog-phos">LEGENDA REGION</div>
            <ul className="mt-3 space-y-2 text-xs">
              {atlas.regions.map((r) => {
                const count = atlas.neurons.filter((n) => n.region === r.key).length;
                return (
                  <li key={r.key} className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: `hsl(${r.hue}, 75%, 60%)` }} aria-hidden />
                    <span className="text-[#bfe8cc] flex-1">{r.name}</span>
                    <span className="catalog !text-[9px]">{count} neuron</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
