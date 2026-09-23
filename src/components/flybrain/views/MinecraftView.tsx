"use client";

// 10 MINECRAFT — world layer CIVITAS OS (PRD §16/§24).
// Status server dari ping RakNet UDP NYATA ke mulkymalikuldhr.aternos.me:19132.
// Peta entitas Minecraft ↔ peradaban. Minecraft BUKAN sumber kebenaran finansial.

import { useCallback, useEffect, useState } from "react";
import { Boxes, Home, Radio, RefreshCw, ServerCog } from "lucide-react";

interface McStatus {
  online: boolean;
  latencyMs: number | null;
  edition?: string;
  motd?: string;
  protocol?: number;
  version?: string;
  players?: number;
  maxPlayers?: number;
  gamemode?: string;
  checkedAt: string;
  error?: string;
}

interface Entity {
  id: string;
  mcType: string;
  mcName: string;
  mcCoords: Record<string, unknown>;
  civType: string;
  civCode: string;
  status: string;
  orgName: string | null;
}

interface VillageMini {
  population: number;
  bySource: { SIMULASI: number; CENSUS: number };
  byEmbodiment: { EMBODIED: number; DREAMING: number; MISSING: number };
  retired: number;
  wagesPaid: number;
  directives?: { queued: number; dispatched: number; applied: number; failed: number; expired: number };
}

export function MinecraftView() {
  const [status, setStatus] = useState<McStatus | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [village, setVillage] = useState<VillageMini | null>(null);
  const [busy, setBusy] = useState(false);
  const [botMsg, setBotMsg] = useState<string | null>(null);

  const ping = useCallback(async (force: boolean) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/civos/minecraft${force ? "?force=1" : ""}`, { cache: "no-store" });
      const j = (await res.json()) as { ok: boolean; status?: McStatus; entities?: Entity[] };
      if (j.ok && j.status) setStatus(j.status);
      if (j.ok && j.entities) setEntities(j.entities);
      // SLICE 7: populasi desa (warga = villager yang naik derajat)
      try {
        const s = await fetch("/api/civos/state", { cache: "no-store" });
        const sj = (await s.json()) as { ok: boolean; state?: { village?: VillageMini } };
        if (sj.ok && sj.state?.village) setVillage(sj.state.village);
      } catch { /* polling berikutnya */ }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void ping(false); }, [ping]);
  useEffect(() => {
    const t = setInterval(() => { void ping(false); }, 30_000);
    return () => clearInterval(t);
  }, [ping]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header>
        <div className="catalog !text-[9px] text-[#fbbf24]">WORLD LAYER — PERWUJUDAN FISIK PERADABAN</div>
        <h1 className="text-xl md:text-2xl font-mono text-[#bfe8cc] mt-1 glow-phos">Minecraft · mulkymalikuldhr.aternos.me:19132</h1>
        <p className="catalog mt-1 !text-[10px] text-[#7f9a89]" data-testid="mc-server-meta">
          Bedrock <span className="text-[#4ade80]">1.26.51.1</span> · invite: <span className="text-[#4ade80]">add.aternos.org/mulkymalikuldhr</span> · bot CIVITAS-AGENT auto-join saat dunia ONLINE
        </p>
        <p className="catalog mt-1 max-w-3xl leading-relaxed">
          Status di bawah adalah hasil ping UDP RakNet nyata (unconnected_ping), bukan angka rekaan. Server Aternos gratis tidur otomatis —
          bila OFFLINE, bangunkan dari panel Aternos pemilik, lalu klik PING ULANG. Minecraft = lapisan dunia; kebenaran finansial tetap di Civilization Kernel.
        </p>
      </header>

      <section className="grid md:grid-cols-3 gap-3">
        <div className={`md:col-span-2 rounded border p-4 ${status?.online ? "border-[#4ade80]/60 bg-[#0a170f]" : "border-border bg-[#070d0a]"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ServerCog className={`w-5 h-5 ${status?.online ? "text-[#4ade80]" : "text-[#7f9a89]"}`} />
              <span className="font-mono text-sm text-[#bfe8cc]">{status?.online ? "SERVER ONLINE" : "SERVER OFFLINE / TIDUR"}</span>
            </div>
            <button
              onClick={() => void ping(true)}
              disabled={busy}
              className="h-10 px-3 rounded border border-[#4ade80]/60 bg-[#0d1a12] text-[#4ade80] font-mono text-xs hover:bg-[#12281b] disabled:opacity-40 inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> PING ULANG
            </button>
            <button
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await fetch("/api/civos/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mc_join" }) });
                  const j = (await res.json()) as { detail?: string; joined?: boolean };
                  setBotMsg(`${j.joined ? "✓" : "✗"} ${j.detail ?? ""}`);
                } finally { setBusy(false); }
              }}
              disabled={busy}
              className="h-10 px-3 rounded border border-[#fbbf24]/60 bg-[#171207] text-[#fbbf24] font-mono text-xs hover:bg-[#241a08] disabled:opacity-40"
            >
              KIRIM BOT
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            {[
              { l: "LATENSI", v: status?.online ? `${status.latencyMs} ms` : "-" },
              { l: "EDISI", v: status?.edition ?? "-" },
              { l: "VERSI", v: status?.version ?? "-" },
              { l: "PROTOKOL", v: status?.protocol !== undefined ? String(status.protocol) : "-" },
              { l: "PEMAIN", v: status?.online ? `${status.players ?? 0}/${status.maxPlayers ?? "?"}` : "-" },
              { l: "MODE", v: status?.gamemode ?? "-" },
            ].map((k) => (
              <div key={k.l} className="rounded border border-border p-2">
                <div className="catalog !text-[8px]">{k.l}</div>
                <div className="font-mono text-xs text-[#bfe8cc] mt-0.5 truncate">{k.v}</div>
              </div>
            ))}
          </div>
          {status?.motd && <p className="catalog mt-2">MOTD: {status.motd}</p>}
          {botMsg && <p className="catalog mt-2 text-[#fbbf24]">Bot: {botMsg}</p>}
          {status?.error && <p className="catalog mt-2 text-[#fbbf24]">Catatan ping: {status.error}</p>}
          {status?.checkedAt && <p className="catalog !text-[9px] mt-2">dicek {new Date(status.checkedAt).toLocaleTimeString("id-ID")} · cache 15 dtk · auto-refresh 30 dtk</p>}
        </div>

        <div className="rounded border border-border bg-[#070d0a] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-4 h-4 text-[#fbbf24]" />
            <h2 className="font-mono text-sm text-[#fbbf24]">ATURAN WORLD LAYER</h2>
          </div>
          <ul className="space-y-2 catalog leading-relaxed">
            <li>1. Setiap entitas Minecraft wajib punya identitas peradaban (mapping di bawah).</li>
            <li>2. Minecraft TIDAK menyimpan uang/kepemilikan — kernel SQLite yang otoritatif.</li>
            <li>3. Bot agen masuk dunia hanya lewat capability berizin + audit event (Slice 5+).</li>
            <li>4. Saat manusia logout, peradaban tetap berdenyut: pemerintah & perusahaan bekerja di kernel.</li>
            <li>5. SENSUS: bot mengobservasi villager nyata (AddEntityActor) → identitas CENSUS lahir, populasi SIMULASI mundur.</li>
            <li>6. DIREKTIF TUBUH (Slice 8): otak warga memutuskan → bot mengeksekusi (tp ber-anchor koordinat sensus + relay chat berlabel); butuh OP untuk bot di server. Tanpa dunia, tubuh dijalankan mimpi jaga SIM berlabel jujur.</li>
          </ul>
          {village?.directives && (
            <div className="mt-3 rounded border border-[#38bdf8]/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Radio className="w-4 h-4 text-[#38bdf8]" />
                <span className="font-mono text-xs text-[#38bdf8]">JEMBATAN OTAK → TUBUH (DIREKTIF)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="catalog">antre <span className="text-[#fbbf24]">{village.directives.queued}</span></div>
                <div className="catalog">dijalankan <span className="text-[#4ade80]">{village.directives.applied}</span></div>
                <div className="catalog">dikirim <span className="text-[#38bdf8]">{village.directives.dispatched}</span></div>
                <div className="catalog">gagal/expired <span className="text-[#f87171]">{village.directives.failed}/{village.directives.expired}</span></div>
              </div>
              <p className="catalog !text-[9px] mt-2">Saat server ONLINE, bot CIVITAS-AGENT mengeksekusi direktif (SPEAK relay + MOVE tp). Beri OP kepada bot di panel Aternos agar command tp diizinkan — penolakan dicatat jujur sebagai FAILED.</p>
            </div>
          )}
          {village && (
            <div className="mt-3 rounded border border-[#4ade80]/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-[#4ade80]" />
                <span className="font-mono text-xs text-[#4ade80]">DESA — VILLAGER OTONOM</span>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="catalog">populasi <span className="text-[#bfe8cc]">{village.population}</span></div>
                <div className="catalog">census/sim <span className="text-[#4ade80]">{village.bySource.CENSUS}</span>/<span className="text-[#fbbf24]">{village.bySource.SIMULASI}</span></div>
                <div className="catalog">embodied <span className="text-[#38bdf8]">{village.byEmbodiment.EMBODIED}</span></div>
                <div className="catalog">upah dibayar <span className="text-[#4ade80]">{village.wagesPaid}×</span></div>
              </div>
              <p className="catalog !text-[9px] mt-2">Setiap villager = agen otonom: identitas, dompet FLR, memori, profesi → peran ekonomi. Buka 09 PERADABAN ▸ tab DESA untuk kartu warga.</p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded border border-border bg-[#070d0a] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Boxes className="w-4 h-4 text-[#4ade80]" />
          <h2 className="font-mono text-sm text-[#4ade80]">PEMETAAN ENTITAS DUNIA ↔ PERADABAN ({entities.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="catalog !text-[9px] text-[#7f9a89]">
              <tr><th className="py-1 pr-3">TIPE MC</th><th className="py-1 pr-3">NAMA DI DUNIA</th><th className="py-1 pr-3">KOORDINAT RENCANA</th><th className="py-1 pr-3">IDENTITAS PERADABAN</th><th className="py-1">SINKRON</th></tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id} className="border-t border-border/60">
                  <td className="py-1.5 pr-3 text-[#bfe8cc]">{e.mcType}</td>
                  <td className="py-1.5 pr-3 text-[#bfe8cc]">{e.mcName}</td>
                  <td className="py-1.5 pr-3 text-[#7f9a89]">x{String(e.mcCoords.x ?? 0)} z{String(e.mcCoords.z ?? 0)}</td>
                  <td className="py-1.5 pr-3"><span className="text-[#4ade80]">{e.civCode}</span> <span className="text-[#7f9a89]">{e.orgName ?? ""}</span></td>
                  <td className="py-1.5"><span className="catalog border border-[#fbbf24]/50 text-[#fbbf24] px-1 rounded">{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="catalog !text-[9px] mt-3">Status PLANNED = rencana tata kota di kanvas PETA; berubah SYNCED saat bot/agent benar-benar menempatkan struktur di server (butuh server online + capability minecraft.build).</p>
      </section>
    </div>
  );
}
