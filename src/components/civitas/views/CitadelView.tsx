"use client";
// CIVITAS OS — CitadelView: pusat kendali peradaban (KPI + aksi + guild + kejujuran).

import { fmtFlr, MCBadge, MCBar, MCButton, MCLog, MCPanel, MCSectionTitle, MCSlot } from "../mcui";
import { useCiv, type VillagerRec } from "../McShell";
import { DIVISION_META } from "../divmeta";

export default function CitadelView() {
  const { s, act, loading } = useCiv();
  const m = (s?.metrics ?? {}) as Record<string, unknown>;
  const villagers = (s?.village?.villagers ?? []) as VillagerRec[];
  const cash = Number(m.treasury ?? 0);
  const extReal = Number(m.externalRevenueReal ?? 0);
  const extSandbox = Number(m.externalRevenueSandbox ?? 0);
  const census = villagers.filter((v) => v.source === "CENSUS").length;

  const guildCounts: Record<string, number> = {};
  for (const v of villagers) guildCounts[v.division] = (guildCounts[v.division] ?? 0) + 1;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* KPI */}
      <MCPanel dark className="lg:col-span-3">
        <MCSectionTitle>KEADAAN PERADABAN</MCSectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: "KAS BANGSA", value: `${fmtFlr(cash)} FLR` },
            { label: "WARGA", value: `${villagers.length} (${census} nyata)` },
            { label: "PERUSAHAAN", value: `${(s?.orgs ?? []).filter((o) => o.kind === "COMPANY").length}` },
            { label: "EVENT IMMUTABLE", value: String(s?.counts.events ?? 0) },
            { label: "REVENUE RIIL", value: fmtFlr(extReal) },
            { label: "SETTLED SANDBOX", value: fmtFlr(extSandbox) },
          ].map((k) => (
            <MCSlot key={k.label} dark>
              <p className="mc-font text-[8px] text-white/60 mb-1">{k.label}</p>
              <p className="mc-font text-[12px]">{k.value}</p>
              <MCBar value={k.label === "KAS BANGSA" ? Math.min(cash / 100, 100) : k.label === "WARGA" ? Math.min(villagers.length * 10, 100) : 55} className="mt-2" />
            </MCSlot>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <MCButton tone="gold" disabled={loading} onClick={() => void act("tick", {}, "menyuruh organ bekerja…")}>DENYUT SEKARANG</MCButton>
          <MCButton disabled={loading} onClick={() => void act("ping_minecraft", {}, "memanggil dunia…")}>PING DUNIA</MCButton>
          <MCButton tone="green" disabled={loading} onClick={() => void act("village_tick", {}, "warga berpikir…")}>DENYUT WARGA</MCButton>
          <MCButton disabled={loading} onClick={() => void act("village_directive_run_sim", {}, "mimpi jaga…")}>MIMPI JAGA (TUBUH)</MCButton>
          <MCButton tone="red" disabled={loading} onClick={() => void act("mc_join", {}, "bot menyelam ke dunia…")}>KIRIM BOT KE DUNIA</MCButton>
        </div>
        {s?.lastTick ? (
          <p className="mc-body mt-3 text-[15px] text-white/80">
            Tick terakhir <MCBadge tone="xp">{String(s.lastTick.kind)}</MCBadge> {s.lastTick.target}: {s.lastTick.summary}
            {s.lastTick.village ? <> · <span className="text-[color:var(--mc-emerald)]">DESA: {s.lastTick.village}</span></> : null}
          </p>
        ) : null}
      </MCPanel>

      {/* GUILD */}
      <MCPanel className="lg:col-span-2">
        <MCSectionTitle>GUILD KERJA — 8 DIVISI SPESIALIS</MCSectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(DIVISION_META).filter(([k]) => k !== "GENERAL").map(([key, meta]) => (
            <MCSlot key={key}>
              <p className="mc-font text-[9px] mb-1">{meta.label.toUpperCase()}</p>
              <p className="mc-body text-[14px] leading-tight text-black/80">{meta.desc}</p>
              <div className="mt-2 flex items-center justify-between">
                <MCBadge tone={guildCounts[key] ? "green" : "stone"}>{guildCounts[key] ?? 0} warga</MCBadge>
                <span aria-hidden>{meta.icon}</span>
              </div>
            </MCSlot>
          ))}
        </div>
      </MCPanel>

      {/* KEJUJURAN */}
      <MCPanel dark>
        <MCSectionTitle>PANEL KEJUJURAN RADIKAL</MCSectionTitle>
        <MCLog
          lines={[
            { text: `• Revenue eksternal RIIL: ${fmtFlr(extReal)} FLR — gerbang pemilik (customer nyata).`, tone: "warn" },
            { text: `• Rail settlement teruji via SANDBOX: ${fmtFlr(extSandbox)} FLR [SANDBOX-TEST].`, tone: "info" },
            { text: s?.mcStatus?.online ? "• Dunia hidup: bot + sensus CENSUS aktif; identitas menempel entitas nyata." : "• Dunia tidur: warga SIMULASI berlabel jujur, sensus nyata ARMED.", tone: s?.mcStatus?.online ? "ok" : "warn" },
            { text: "• Kekayaan dibuat dari MINT/kerja tercatat — tidak ada angka yang muncul dari ketiadaan.", tone: "info" },
            { text: "• LLM hanya mengusulkan; eksekusi = Policy → Authority → Risk → Budget.", tone: "info" },
          ]}
        />
        <p className="mc-body mt-3 text-[14px] text-white/60">Uang internal = FLR (integer minor). Kantor kuant memutuskan pada HARGA PASAR NYATA — eksekusi order tetap gerbang pemilik.</p>
      </MCPanel>
    </div>
  );
}
