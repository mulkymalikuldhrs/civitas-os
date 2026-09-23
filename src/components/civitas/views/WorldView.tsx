"use client";
// CIVITAS OS — WorldView: server Minecraft (lokal/online), bot, konsol, chat dunia live.

import { useEffect, useState } from "react";
import { MCBadge, MCButton, MCInput, MCLog, MCPanel, MCSectionTitle, MCSlot } from "../mcui";
import { useCiv, type ConsoleRec } from "../McShell";

export default function WorldView() {
  const { s, act, refresh } = useCiv();
  const [cmd, setCmd] = useState("");
  const mc = s?.mcStatus ?? {};
  const server = s?.mcServer ?? { host: "-", port: 0, version: "-", invite: "-" };
  const consoleRows = (s?.console ?? []) as ConsoleRec[];
  const worldChat = (s?.chat ?? []).filter((c) => c.channel === "WORLD");

  // saat target lokal, muat ulang status konsol tiap poll (state sudah berisi console)
  useEffect(() => { void refresh; }, [refresh]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MCPanel dark className="lg:col-span-2">
        <MCSectionTitle>SERVER MINECRAFT — BEDROCK</MCSectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MCSlot dark><p className="mc-font text-[8px] text-white/60">TARGET</p><p className="mc-body text-[15px]">{server.host}:{server.port}</p></MCSlot>
          <MCSlot dark><p className="mc-font text-[8px] text-white/60">VERSI</p><p className="mc-body text-[15px]">Bedrock {mc.version ?? server.version}</p></MCSlot>
          <MCSlot dark><p className="mc-font text-[8px] text-white/60">PEMAIN</p><p className="mc-body text-[15px]">{mc.players ?? 0} online</p></MCSlot>
          <MCSlot dark><p className="mc-font text-[8px] text-white/60">STATUS</p><p className="mc-body text-[15px]">{mc.online ? `ONLINE ${mc.latencyMs}ms` : "TIDUR/OFFLINE"}</p></MCSlot>
        </div>
        <div className="flex flex-wrap gap-2">
          <MCButton tone="gold" onClick={() => void act("ping_minecraft", {}, "memanggil dunia…")}>PING</MCButton>
          <MCButton tone="red" onClick={() => void act("mc_join", {}, "bot menyelam…")}>KIRIM BOT</MCButton>
          <MCButton tone="green" onClick={() => void act("mc_summon", { count: 8 }, "memanggil warga desa…")}>SUMMON VILLAGER</MCButton>
          <MCButton onClick={() => void act("village_retire_sim", {}, "warga sim mundur…")}>MUNDURKAN WARGA SIM</MCButton>
        </div>
        {mc.error ? <p className="mc-body mt-2 text-[13px] text-[color:var(--mc-gold)]">{mc.error}</p> : null}
        <p className="mc-body mt-2 text-[13px] text-white/60">
          Server lokal = PocketMine-MP + plugin CivitasBridge (unduh, start: <span className="text-[color:var(--mc-xp)]">scripts/pmmp_server.sh start</span>) · Server online = Aternos <span className="text-[color:var(--mc-xp)]">{server.invite}</span> (butuh pemilik menyalakan). Target & port diatur di tab KONFIG — bot, sensus, dan direktif jalan sama.
        </p>
      </MCPanel>

      <MCPanel>
        <MCSectionTitle>KONSOL SERVER LOKAL</MCSectionTitle>
        <div className="flex gap-2 mb-2">
          <MCInput value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="mis. civ census · list · time query" onKeyDown={(e) => { if (e.key === "Enter" && cmd.trim()) { void act("mc_console", { body: cmd.trim() }, "mengeksekusi…").then(() => setCmd("")); } }} />
          <MCButton disabled={!cmd.trim()} onClick={() => void act("mc_console", { body: cmd.trim() }, "mengeksekusi…").then(() => setCmd(""))}>KIRIM</MCButton>
        </div>
        <MCLog
          lines={consoleRows.map((c) => ({
            text: `$ ${c.command}\n${c.response}`,
            tone: c.ok ? "ok" : "err",
          }))}
          className="!max-h-64"
        />
      </MCPanel>

      <MCPanel className="lg:col-span-2">
        <MCSectionTitle>CHAT DUNIA (2 ARAH — RELAY BOT)</MCSectionTitle>
        <MCLog
          lines={worldChat.map((c) => ({
            text: `${c.from === "HUMAN" ? "🧑" : "🧑‍🌾"} ${c.senderName}${c.villagerCode ? ` (${c.villagerCode})` : ""}: ${c.body}`,
            tone: c.from === "CITIZEN" ? "ok" : "info",
          }))}
          className="!max-h-72"
        />
        <p className="mc-body mt-2 text-[13px] text-white/50">Saat pemain bermain in-game dan mengetik chat (sebut nama warga untuk mengajak bicara), bot membaca dan warga menjawab lewat otaknya — jawaban juga tercatat di sini.</p>
      </MCPanel>

      <MCPanel dark>
        <MCSectionTitle>ENTITAS DUNIA TERSINKRON</MCSectionTitle>
        <MCLog
          lines={(s?.entities ?? []).slice(0, 20).map((e) => ({
            text: `${e.mcType} ${e.mcName} → ${e.civType} ${e.civCode} [${e.status}]`,
            tone: e.status === "SYNCED" ? "ok" : "info",
          }))}
        />
      </MCPanel>
    </div>
  );
}
