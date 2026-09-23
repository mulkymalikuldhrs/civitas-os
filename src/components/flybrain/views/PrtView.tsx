"use client";

// 02 PRT — konsol percakapan, vital hidup, feed otonom, kontrak otonomi L0-L3.

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useFlybrain } from "@/lib/flybrain/store";

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="catalog">{label}</span>
        <span className="font-mono text-xs text-[#e6f2e9]">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 bg-[#0d1712] border border-[#1b2f24]">
        <div className="h-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export function PrtView() {
  const vitals = useFlybrain((s) => s.vitals);
  const feed = useFlybrain((s) => s.prtFeed);
  const beat = useFlybrain((s) => s.prtBeat);
  const chat = useFlybrain((s) => s.chat);
  const sendChat = useFlybrain((s) => s.sendChat);
  const tier = useFlybrain((s) => s.tier);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat.length]);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await sendChat(t);
  };

  return (
    <div className="px-4 sm:px-8 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="catalog catalog-phos">02 — PRT · PENJAGA RUANG TERMINAL</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">
            Lalat yang hidup dengan otak ini
          </h1>
          <p className="text-sm text-[#7f9a89] mt-2 max-w-2xl leading-relaxed">
            PRT adalah proses nyata di kernel: patroli tiap ±6 detik, akses baca ke vault, hak tulis
            hanya ke log. Ia tidak akan pernah menghapus data Anda tanpa perintah — kontraknya tertulis di bawah.
          </p>
        </div>
        <div className="catalog text-right">
          BEAT <span className="text-[#fbbf24] font-mono">{beat}</span>
          <br />
          TIER {tier}
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Chat */}
        <div className="lg:col-span-2 specimen-frame flex flex-col min-h-[480px]">
          <div className="px-5 py-3 border-b border-[#13241a] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4ade80] breathe" aria-hidden />
            <span className="catalog catalog-phos">KONSOL PERCAKAPAN — LLM ONLINE (FALLBACK REFLEKS)</span>
          </div>
          <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-[420px]">
            {chat.length === 0 && (
              <div className="text-xs text-[#7f9a89] leading-relaxed">
                <p className="text-[#bfe8cc]">PRT:</p>
                Sarang siap. Coba tanya: &quot;status&quot;, &quot;isi vault apa saja?&quot;, &quot;bagaimana caranya gerbang dipakai drone?&quot;,
                &quot;bagaimana cara bayar?&quot;, atau &quot;kamu sadar tidak?&quot;
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} className={`text-xs leading-relaxed ${m.role === "user" ? "text-right" : ""}`}>
                <span className="catalog !text-[8px]">{m.role === "user" ? "ANDA" : "PRT"}{m.role === "prt" && m.mode && ` · ${m.mode === "llm" ? "LLM" : "REFLEKS"}`}</span>
                <div
                  className={`mt-1 inline-block max-w-[85%] px-3 py-2 border ${
                    m.role === "user"
                      ? "border-[#1b2f24] bg-[#0d1712] text-[#bfe8cc]"
                      : "border-[#274434] bg-[#0a130e] text-[#d9e6dd]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-[#13241a] flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder="Tulis pesan untuk PRT…"
              aria-label="Pesan untuk PRT"
              className="flex-1 bg-[#0d1712] border border-[#1b2f24] px-3 py-2 text-sm text-[#d9e6dd] placeholder:text-[#4f6759] focus:outline-none focus:border-[#4ade80]"
            />
            <button
              onClick={() => void submit()}
              className="bg-[#4ade80] text-[#04130a] px-4 hover:bg-[#6ee7a0] transition-colors"
              aria-label="Kirim pesan"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Vital + feed + kontrak */}
        <div className="space-y-4">
          <div className="specimen-frame p-5 space-y-4">
            <div className="catalog catalog-phos">VITAL — BERGERAK SESUAI AKTIVITAS NYATA</div>
            <Meter label="ENERGI" value={vitals.energy} color="#4ade80" />
            <Meter label="FOKUS" value={vitals.focus} color="#fbbf24" />
            <Meter label="SUASANA" value={vitals.mood} color="#38bdf8" />
            <p className="text-[11px] text-[#7f9a89] leading-relaxed">
              Energi turun saat patroli, pulih saat idle. Fokus turun saat anomali ditemukan.
              Suasana membaca sentimen kejadian — kwitansi valid membuatnya cerah.
            </p>
          </div>

          <div className="specimen-frame p-5">
            <div className="catalog catalog-phos">LOG OTONOM</div>
            <ul className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1 text-xs">
              {feed.length === 0 && <li className="text-[#7f9a89]">Menunggu patroli pertama…</li>}
              {feed.map((f) => (
                <li key={f.id + f.at} className="border-l-2 pl-3 py-0.5" style={{ borderColor: f.severity === "alert" ? "#f87171" : f.severity === "warn" ? "#fbbf24" : "#4ade80" }}>
                  <span className="catalog !text-[8px]">{f.at.slice(11, 19)} · {f.task}</span>
                  <p className="text-[#bfe8cc] leading-snug mt-0.5">{f.note}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="specimen-frame p-5">
            <div className="catalog catalog-phos">KONTRAK OTONOMI</div>
            <ul className="mt-3 space-y-1.5 text-xs text-[#9db8a6]">
              <li><span className="text-[#4ade80] font-mono">L0</span> — baca status, tulis log/event: selalu</li>
              <li><span className="text-[#4ade80] font-mono">L1</span> — saran via chat/ticker: otomatis</li>
              <li><span className="text-[#fbbf24] font-mono">L2</span> — eksekusi saran: butuh izin Anda</li>
              <li><span className="text-[#f87171] font-mono">L3</span> — hapus massal / kirim data keluar: dilarang</li>
            </ul>
            <p className="text-[11px] text-[#7f9a89] mt-3 leading-relaxed border-t border-[#13241a] pt-3">
              Framing yang kami jaga: PRT adalah <span className="text-[#bfe8cc]">kesadaran operasional</span>, bukan
              kesadaran biologis. Ia rajin — bukan &quot;hidup&quot; dalam arti filosofis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
