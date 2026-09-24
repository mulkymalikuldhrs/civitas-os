"use client";
// CIVITAS OS — WorldView: server Minecraft (lokal/online), bot, konsol, chat dunia live.
// SLICE 11: registry MULTI-SERVER all-in-one (Bedrock + Java + remote) + SELF-LIFE
// (daemon, backup, sync, doctor) — semuanya aksi nyata lewat kernel.

import { useState } from "react";
import { MCBadge, MCButton, MCInput, MCLog, MCPanel, MCSectionTitle, MCSlot } from "../mcui";
import { useCiv, type ConsoleRec } from "../McShell";

interface ServerRec { id: string; label: string; edition: string; host: string; port: number; managed?: boolean; online?: boolean; latencyMs?: number | null; version?: string; players?: number; error?: string; note?: string }
interface SelfLifeRec { lastTick?: { at?: string; pulse?: { target?: string; summary?: string }; backup?: string; sync?: boolean }; lastBackup?: { file?: string; at?: string }; lastSync?: { at?: string; commit?: string }; backups?: number }
interface DoctorCheck { name: string; ok: boolean; detail: string }

export default function WorldView() {
  const { s, act } = useCiv();
  const [cmd, setCmd] = useState("");
  const [doctorRows, setDoctorRows] = useState<DoctorCheck[] | null>(null);
  const mc = s?.mcStatus ?? {};
  const server = s?.mcServer ?? { host: "-", port: 0, version: "-", invite: "-" };
  const consoleRows = (s?.console ?? []) as ConsoleRec[];
  const worldChat = (s?.chat ?? []).filter((c) => c.channel === "WORLD");
  const servers = ((s?.servers ?? []) as ServerRec[]);
  const life = (s?.selfLife ?? {}) as SelfLifeRec;

  const runDoctor = async () => {
    try {
      const res = await fetch("/api/civos/doctor", { cache: "no-store" });
      const j = (await res.json()) as { checks?: DoctorCheck[] };
      setDoctorRows(j.checks ?? []);
    } catch { setDoctorRows([{ name: "doctor", ok: false, detail: "kernel tidak terjangkau" }]); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MCPanel dark className="lg:col-span-2">
        <MCSectionTitle>REGISTRY SERVER — ALL-IN-ONE (BEDROCK + JAVA + REMOTE)</MCSectionTitle>
        <div className="grid gap-2 mb-3">
          {servers.length === 0 ? <p className="mc-body text-[13px] text-white/50">registry kosong — daemon akan mengisi default.</p> : null}
          {servers.map((sv) => (
            <div key={sv.id} className="flex flex-wrap items-center gap-2 border border-white/10 bg-black/30 px-3 py-2">
              <span className={`mc-font text-[9px] ${sv.online ? "text-[color:var(--mc-xp)]" : "text-white/40"}`}>{sv.online ? "●" : "○"} {sv.id.toUpperCase()}</span>
              <MCBadge tone={sv.edition === "BEDROCK" ? "green" : "gold"}>{sv.edition}</MCBadge>
              <span className="mc-body text-[13px] text-white/70">{sv.host}:{sv.port}</span>
              <span className="mc-body text-[12px] text-white/45">{sv.managed ? "managed" : "remote"} {sv.online ? `· ${sv.latencyMs}ms ${sv.version ?? ""}` : `· ${sv.error ?? "offline"}`}</span>
              {sv.managed ? (
                <span className="ml-auto flex gap-1">
                  <MCButton tone="green" onClick={() => void act("server_action", { key: sv.id, value: "start" }, `menyalakan ${sv.id}…`)}>START</MCButton>
                  <MCButton tone="red" onClick={() => void act("server_action", { key: sv.id, value: "stop" }, `mematikan ${sv.id}…`)}>STOP</MCButton>
                  <MCButton onClick={() => void act("server_action", { key: sv.id, value: "restart" }, `restart ${sv.id}…`)}>RESTART</MCButton>
                </span>
              ) : (
                <span className="ml-auto mc-font text-[8px] text-white/30">KELOLA DARI PANEL PENYEDIA</span>
              )}
            </div>
          ))}
        </div>
        <p className="mc-body text-[13px] text-white/50">Semua edisi dalam satu kernel: status = ping nyata; start/stop hanya untuk server lokal (skrip supervisor). Watchdog daemon menyalakan ulang server autoStart yang mati.</p>
      </MCPanel>

      <MCPanel>
        <MCSectionTitle>SELF-LIFE — DAEMON · BACKUP · SYNC</MCSectionTitle>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <MCSlot><p className="mc-font text-[8px] text-white/60">DENYUT TERAKHIR</p><p className="mc-body text-[12px]">{life.lastTick?.at ? new Date(life.lastTick.at).toLocaleTimeString() : "-"}</p></MCSlot>
          <MCSlot><p className="mc-font text-[8px] text-white/60">BACKUP</p><p className="mc-body text-[12px]">{life.lastBackup?.file ?? `${life.backups ?? 0} arsip`}</p></MCSlot>
          <MCSlot><p className="mc-font text-[8px] text-white/60">SYNC GIT</p><p className="mc-body text-[12px]">{life.lastSync?.at ? `${life.lastSync.commit ?? "ok"}` : "belum"}</p></MCSlot>
          <MCSlot><p className="mc-font text-[8px] text-white/60">PULSE</p><p className="mc-body text-[12px] truncate">{life.lastTick?.pulse?.target ?? "-"}</p></MCSlot>
        </div>
        <div className="flex flex-wrap gap-2">
          <MCButton tone="gold" onClick={() => void act("selflife_tick", {}, "detak kehidupan…")}>DETAK SEKARANG</MCButton>
          <MCButton tone="green" onClick={() => void act("backup_run", {}, "mengarsipkan dunia…")}>BACKUP</MCButton>
          <MCButton onClick={() => void act("git_sync", {}, "push ke 4 remote…")}>SYNC</MCButton>
          <MCButton tone="red" onClick={() => void runDoctor()}>DOCTOR</MCButton>
        </div>
        {doctorRows ? (
          <MCLog className="mt-2 !max-h-40" lines={doctorRows.map((c) => ({ text: `${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`, tone: c.ok ? "ok" : "err" }))} />
        ) : null}
        <p className="mc-body mt-2 text-[12px] text-white/40">CLI: <span className="text-[color:var(--mc-xp)]">civitas daemon start · civitas backup · civitas sync · civitas doctor</span></p>
      </MCPanel>

      <MCPanel dark className="lg:col-span-2">
        <MCSectionTitle>SERVER UTAMA — {String(server.host).toUpperCase()}</MCSectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MCSlot dark><p className="mc-font text-[8px] text-white/60">TARGET BOT</p><p className="mc-body text-[15px]">{server.host}:{server.port}</p></MCSlot>
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
          Server lokal = PocketMine-MP (Bedrock) + Paper (Java) · Server online = Aternos <span className="text-[color:var(--mc-xp)]">{server.invite}</span> (butuh pemilik menyalakan). Bot & sensus jalan di target KONFIG.
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
