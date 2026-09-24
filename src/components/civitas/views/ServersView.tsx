"use client";
// CIVITAS OS — ServersView (v1.5 "CITADEL")
// Hosting server Minecraft dari UI: status nyata semua server, URL & port terpampang,
// start/stop/restart server managed, backup otomatis + restore + sinkron ke awan.

import { useCallback, useEffect, useState } from "react";
import { MCBadge, MCButton, MCPanel, MCSectionTitle } from "../mcui";
import { useCiv } from "../McShell";

interface ServerRow {
  id: string;
  label: string;
  edition: string;
  host: string;
  port: number;
  managed: boolean;
  online: boolean;
  latencyMs: number | null;
  version?: string;
  players?: number;
  maxPlayers?: number;
  motd?: string;
  error?: string;
  note?: string;
}
interface HostInfo {
  hostnames: string[];
  java: string;
  bedrock: string;
  aternos: string;
  platform: string;
  uptimeSec: number;
  nodeVersion: string;
}
interface BackupRow { file: string; bytes: number; sha256?: string; at: string }
interface CloudRow { name: string; size: number; at: string }

function fmtBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} KB`;
  return `${n} B`;
}

export default function ServersView() {
  const { act } = useCiv();
  const [rows, setRows] = useState<ServerRow[]>([]);
  const [host, setHost] = useState<HostInfo | null>(null);
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [cloud, setCloud] = useState<CloudRow[]>([]);
  const [cloudNote, setCloudNote] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
  const [reload, setReload] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/civos/servers", { cache: "no-store" });
      const j = (await res.json()) as { servers?: ServerRow[]; host?: HostInfo };
      setRows(j.servers ?? []);
      setHost(j.host ?? null);
    } catch { /* poll berikutnya */ }
    try {
      const res = await fetch("/api/civos/backup", { cache: "no-store" });
      const j = (await res.json()) as { backups?: BackupRow[]; cloud?: { ok: boolean; items?: CloudRow[]; detail?: string } };
      setBackups(j.backups ?? []);
      setCloud(j.cloud?.items ?? []);
      setCloudNote(j.cloud?.detail ?? "");
    } catch { /* poll berikutnya */ }
  }, []);

  useEffect(() => {
    const t0 = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 6000);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, [load, reload]);

  const doAction = async (id: string, action: string) => {
    setBusy(`${id}:${action}`);
    await act("server_action", { serverId: id, action }, `${action} ${id}…`);
    await load();
    setBusy("");
  };

  const doBackup = async () => {
    setBusy("backup");
    await act("backup_run", {}, "membuat arsip backup…");
    await load();
    setBusy("");
  };

  const doUpload = async () => {
    setBusy("upload");
    await act("backup_cloud_upload", {}, "mengunggah backup ke awan…");
    await load();
    setBusy("");
  };

  const doRestore = async (file: string, scope: "worlds" | "full", fromCloud = false) => {
    const what = scope === "full" ? "DUNIA + DATABASE" : "DUNIA saja";
    if (!window.confirm(`RESTORE akan MENGGANTI ${what} dengan isi arsip ${file}.\nLanjutkan?`)) return;
    setBusy(`restore:${file}`);
    await act(fromCloud ? "backup_cloud_restore" : "backup_restore", { file, scope }, `memulihkan dari ${file}…`);
    await load();
    setBusy("");
  };

  return (
    <div className="grid gap-4">
      {/* URL & PORT — mandat #3: terpampang */}
      <MCPanel dark>
        <MCSectionTitle>ALAMAT SERVER — BAGIKAN KE PEMAIN</MCSectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          <MCSlotLike label="EDISI JAVA (PC)" value={host ? `${host.hostnames[0] ?? "127.0.0.1"}:25565` : "…"} note={`juga: 127.0.0.1:25565 (lokal) · ${host?.java ?? ""}`} tone="gold" />
          <MCSlotLike label="EDISI BEDROCK (MOBILE/CONSOLE)" value={host ? `${host.hostnames[0] ?? "127.0.0.1"}:19132` : "…"} note={`juga: 127.0.0.1:19132 (lokal) · ${host?.bedrock ?? ""}`} tone="xp" />
          <MCSlotLike label="ATERNOS AWAN (BEDROCK)" value={host?.aternos ?? "…"} note="bangunkan dari panel aternos.com — RATU menjaga kehadiran" tone="diamond" />
        </div>
        <p className="mc-body text-[13px] text-white/70 mt-3">
          {host ? (
            <>
              Host: <b>{host.hostnames.join(", ")}</b> · {host.platform} · aktif {Math.floor(host.uptimeSec / 3600)} jam · runtime {host.nodeVersion}
            </>
          ) : "memuat info host…"}
        </p>
      </MCPanel>

      {/* STATUS SERVER */}
      <MCPanel>
        <MCSectionTitle>SERVER MINECRAFT — STATUS NYATA &amp; KENDALI</MCSectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {rows.map((sv) => (
            <div key={sv.id} className="border-2 border-black/40 bg-[#3a3a3f] p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="mc-font text-[10px]">{sv.label}</span>
                <MCBadge tone={sv.online ? "green" : "red"}>{sv.online ? `ONLINE ${sv.latencyMs ?? "?"}ms` : "OFFLINE"}</MCBadge>
              </div>
              <p className="mc-font text-[8px] text-white/60">{sv.edition} · {sv.host}:{sv.port} {sv.managed ? "· MANAGED" : "· REMOTE"}</p>
              {sv.version ? <p className="mc-font text-[8px] text-[color:var(--mc-xp)]">{sv.version} · {sv.players ?? 0}/{sv.maxPlayers ?? "?"} pemain</p> : null}
              {sv.motd ? <p className="mc-body text-[11px] text-white/70 truncate">{sv.motd}</p> : null}
              {sv.error ? <p className="mc-body text-[11px] text-red-300 truncate">{sv.error}</p> : null}
              <div className="mt-auto flex flex-wrap gap-1 pt-1">
                {sv.managed ? (
                  <>
                    <MCButton tone="green" disabled={busy !== ""} onClick={() => void doAction(sv.id, "start")}>START</MCButton>
                    <MCButton tone="red" disabled={busy !== ""} onClick={() => void doAction(sv.id, "stop")}>STOP</MCButton>
                    <MCButton disabled={busy !== ""} onClick={() => void doAction(sv.id, "restart")}>RESTART</MCButton>
                  </>
                ) : (
                  <span className="mc-font text-[7px] text-white/50">dikelola dari panel penyedia (remote)</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mc-body text-[12px] text-white/60 mt-3">
          Watchdog daemon menghidupkan ulang server managed yang offline (autoStart) — hosting berjalan di mesin ini langsung dari UI.
        </p>
      </MCPanel>

      {/* BACKUP & RESTORE */}
      <MCPanel>
        <MCSectionTitle>BACKUP OTOMATIS · RESTORE 1-KLIK · SINKRON AWAN</MCSectionTitle>
        <div className="flex flex-wrap gap-2 mb-3">
          <MCButton tone="gold" disabled={busy !== ""} onClick={() => void doBackup()}>BACKUP SEKARANG</MCButton>
          <MCButton tone="green" disabled={busy !== ""} onClick={() => void doUpload()}>UNGGAH KE AWAN</MCButton>
          <MCBadge tone="stone">jadwal otomatis tiap 6 jam + unggah cloud</MCBadge>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mc-font text-[9px] text-white/70 mb-2">ARSIP LOKAL ({backups.length})</p>
            <div className="max-h-72 overflow-y-auto mc-scroll flex flex-col gap-2">
              {backups.length === 0 ? <p className="mc-body text-[12px] text-white/50">belum ada arsip — tekan BACKUP SEKARANG</p> : null}
              {backups.map((b) => (
                <div key={b.file} className="border-2 border-black/40 bg-[#3a3a3f] p-2">
                  <p className="mc-font text-[8px]">{b.file} · {fmtBytes(b.bytes)}</p>
                  <p className="mc-font text-[7px] text-white/50">{new Date(b.at).toLocaleString()}{b.sha256 ? ` · sha ${b.sha256.slice(0, 10)}…` : ""}</p>
                  <div className="flex gap-1 mt-1">
                    <MCButton tone="red" disabled={busy !== ""} onClick={() => void doRestore(b.file, "full")}>RESTORE PENUH</MCButton>
                    <MCButton disabled={busy !== ""} onClick={() => void doRestore(b.file, "worlds")}>DUNIA SAJA</MCButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mc-font text-[9px] text-white/70 mb-2">ARSIP DI AWAN ({cloud.length}) {cloudNote ? `· ${cloudNote}` : ""}</p>
            <div className="max-h-72 overflow-y-auto mc-scroll flex flex-col gap-2">
              {cloud.length === 0 ? <p className="mc-body text-[12px] text-white/50">belum ada arsip di awan — unggah dulu</p> : null}
              {cloud.map((c) => (
                <div key={c.name} className="border-2 border-black/40 bg-[#3a3a3f] p-2">
                  <p className="mc-font text-[8px]">{c.name} · {fmtBytes(c.size)}</p>
                  <p className="mc-font text-[7px] text-white/50">{c.at ? new Date(c.at).toLocaleString() : ""}</p>
                  <div className="flex gap-1 mt-1">
                    <MCButton tone="red" disabled={busy !== ""} onClick={() => void doRestore(c.name, "full", true)}>RESTORE DARI AWAN</MCButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MCPanel>
    </div>
  );
}

function MCSlotLike({ label, value, note, tone }: { label: string; value: string; note: string; tone: "gold" | "xp" | "diamond" }) {
  return (
    <div className="border-4 border-black/50 bg-[#4a4a4f] p-3">
      <p className="mc-font text-[8px] text-white/60 mb-1">{label}</p>
      <p className={`mc-font text-[13px] ${tone === "gold" ? "text-[color:var(--mc-gold)]" : tone === "xp" ? "text-[color:var(--mc-xp)]" : "text-[color:var(--mc-diamond)]"}`}>{value}</p>
      <p className="mc-body text-[11px] text-white/60 mt-1">{note}</p>
    </div>
  );
}
