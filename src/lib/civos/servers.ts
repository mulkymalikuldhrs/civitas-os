// CIVITAS OS — servers.ts (SLICE 11 — MULTI-SERVER ALL-IN-ONE)
// Registry server Minecraft: Bedrock (PMMP lokal / Aternos remote) + Java (Paper lokal)
// + edisi lain yang terdaftar. Status NYATA per server:
//   Bedrock → ping RakNet UDP (pingBedrock, minecraft.ts);
//   Java    → ping legacy TCP 0xFE (Server List Ping lawas, didukung vanilla/Paper).
// Lifecycle (start/stop/restart) HANYA untuk server managed (skrip lokal). Server remote
// dikelola dari panel penyedianya — kernel jujur menolak aksi yang tidak bisa ia lakukan.
// REALITY WINS: kegagalan start/ping dicatat sebagai event, tidak ada status palsu.

import { execFile, spawn } from "node:child_process";
import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import { db } from "@/lib/db";
import { emit } from "./events";
import { EVENT_TYPES } from "./types";
import { pingBedrock, type McStatus } from "./minecraft";
import { getConfigValue } from "./config";

const KV_SERVERS = "servers.registry";

export type ServerEdition = "BEDROCK" | "JAVA";

export interface CivServer {
  id: string;
  label: string;
  edition: ServerEdition;
  host: string;
  port: number;
  /** true = kernel boleh start/stop (server lokal dengan skrip); false = remote. */
  managed: boolean;
  /** skrip shell start/stop/status untuk server managed. */
  script?: string;
  autoStart?: boolean;
  note?: string;
}

export interface CivServerStatus extends CivServer {
  online: boolean;
  latencyMs: number | null;
  version?: string;
  players?: number;
  maxPlayers?: number;
  motd?: string;
  protocol?: number;
  error?: string;
  checkedAt: string;
}

const ROOT = "/home/z/my-project";

export async function defaultServers(): Promise<CivServer[]> {
  const consolePath = (await getConfigValue("mc.localConsolePath")) || `${ROOT}/mc-server/pmmp/console.in`;
  const logPath = (await getConfigValue("mc.localLogPath")) || `${ROOT}/mc-server/pmmp/server.log`;
  const aternosHost = (await getConfigValue("mc.remoteHost")) || "mulkymalikuldhr.aternos.me";
  return [
    {
      id: "local-bedrock",
      label: "Bedrock Lokal (PocketMine-MP)",
      edition: "BEDROCK",
      host: "127.0.0.1",
      port: 19132,
      managed: true,
      script: `${ROOT}/scripts/pmmp_server.sh`,
      autoStart: true,
      note: `konsol FIFO: ${consolePath} · log: ${logPath}`,
    },
    {
      id: "local-java",
      label: "Java Lokal (Paper)",
      edition: "JAVA",
      host: "127.0.0.1",
      port: 25565,
      managed: true,
      script: `${ROOT}/scripts/java_server.sh`,
      // 2026-09-24: autoStart AKTIF (mandat all-in-one Bedrock+Java) — heap 384M
      // + metaspace cap agar OOM killer tidak memangsa server lagi.
      autoStart: true,
      note: "edisi Java — dunia terpisah; bot CIVITAS_AGENT (mineflayer) join ke sini",
    },
    {
      id: "aternos",
      label: "Aternos Online (Bedrock)",
      edition: "BEDROCK",
      host: aternosHost,
      port: 19132,
      managed: false,
      autoStart: false,
      note: "server pemilik di awan — tidur otomatis; bangunkan dari panel Aternos",
    },
  ];
}

export async function loadServers(): Promise<CivServer[]> {
  const row = await db.civKV.findUnique({ where: { key: KV_SERVERS } });
  if (!row) return defaultServers();
  try {
    const parsed = JSON.parse(row.value) as CivServer[];
    return Array.isArray(parsed) && parsed.length ? parsed : defaultServers();
  } catch {
    return defaultServers();
  }
}

export async function saveServers(servers: CivServer[]): Promise<void> {
  await db.civKV.upsert({
    where: { key: KV_SERVERS },
    create: { key: KV_SERVERS, value: JSON.stringify(servers) },
    update: { value: JSON.stringify(servers) },
  });
}

export async function ensureServerSeed(): Promise<CivServer[]> {
  const row = await db.civKV.findUnique({ where: { key: KV_SERVERS } });
  if (row) {
    try {
      const parsed = JSON.parse(row.value) as CivServer[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch { /* reseed di bawah */ }
  }
  const defs = await defaultServers();
  await saveServers(defs);
  return defs;
}

// ---------- PING JAVA (legacy Server List Ping, TCP) ----------

/** Ping legacy 0xFE 0x01 — vanilla/Paper membalas 0xFF; format modern (\x00) maupun lama (§) diparse. */
export function pingJava(host: string, port: number, timeoutMs = 4000): Promise<McStatus> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const done = (st: McStatus) => {
      try { sock.destroy(); } catch { /* sudah */ }
      resolve(st);
    };
    const sock = net.createConnection({ host, port }, () => {
      sock.write(Buffer.from([0xfe, 0x01, 0xfa]));
    });
    sock.setTimeout(timeoutMs);
    sock.on("timeout", () => done({ online: false, latencyMs: null, checkedAt: new Date().toISOString(), error: "timeout — server Java tidak menjawab" }));
    sock.on("error", (e) => done({ online: false, latencyMs: null, checkedAt: new Date().toISOString(), error: e.message.slice(0, 160) }));
    sock.on("data", (buf) => {
      try {
        if (buf[0] !== 0xff) return done({ online: false, latencyMs: null, checkedAt: new Date().toISOString(), error: `balasan tak dikenal 0x${buf[0]?.toString(16)}` });
        const text = buf.slice(9).toString("utf16le").replace(/^\ufeff/, "");
        const parts = text.split("\u0000");
        const sec = text.split("§");
        const st: McStatus = { online: true, latencyMs: Date.now() - t0, checkedAt: new Date().toISOString() };
        if (parts.length >= 6) {
          // format modern-legacy: \x00·protocol·version·motd·online·max
          st.version = parts[2]; st.motd = parts[3];
          st.players = Number(parts[4]) || 0; st.maxPlayers = Number(parts[5]) || 0;
          st.protocol = Number(parts[1]) || undefined;
        } else if (sec.length >= 3) {
          // format lama: §motd§online§max
          st.motd = sec[0]; st.players = Number(sec[1]) || 0; st.maxPlayers = Number(sec[2]) || 0;
        } else {
          st.motd = text.slice(0, 60);
        }
        done(st);
      } catch (e) {
        done({ online: false, latencyMs: null, checkedAt: new Date().toISOString(), error: e instanceof Error ? e.message : "parse gagal" });
      }
    });
  });
}

export async function pingServer(s: CivServer): Promise<CivServerStatus> {
  const st = s.edition === "JAVA" ? await pingJava(s.host, s.port) : await pingBedrock(s.host, s.port);
  return { ...s, online: st.online, latencyMs: st.latencyMs, version: st.version, players: st.players, maxPlayers: st.maxPlayers, motd: st.motd, protocol: st.protocol, error: st.error, checkedAt: st.checkedAt };
}

export async function listServerStatuses(): Promise<CivServerStatus[]> {
  const servers = await ensureServerSeed();
  return Promise.all(servers.map(pingServer));
}

const KV_SERVER_STATUS = "servers.statusCache";

/** Status dari cache daemon (KV servers.statusCache) — state UI tetap cepat.
 *  Cache >90 dtk → refresh live dengan timeout pendek (jujur: tetap hasil ukur). */
export async function cachedServerStatuses(): Promise<CivServerStatus[]> {
  const row = await db.civKV.findUnique({ where: { key: KV_SERVER_STATUS } });
  if (row) {
    try {
      const cached = JSON.parse(row.value) as { at: number; servers: CivServerStatus[] };
      if (cached.at && Date.now() - cached.at < 90_000 && Array.isArray(cached.servers)) return cached.servers;
    } catch { /* refresh di bawah */ }
  }
  const live = await Promise.all((await ensureServerSeed()).map((s) => pingServer(s)));
  await db.civKV.upsert({
    where: { key: KV_SERVER_STATUS },
    create: { key: KV_SERVER_STATUS, value: JSON.stringify({ at: Date.now(), servers: live }) },
    update: { key: KV_SERVER_STATUS, value: JSON.stringify({ at: Date.now(), servers: live }) },
  }).catch(() => undefined);
  return live;
}

/** Tulis cache status (dipanggil daemon/selflife tiap detak). */
export async function writeServerStatusCache(): Promise<CivServerStatus[]> {
  const live = await Promise.all((await ensureServerSeed()).map((s) => pingServer(s)));
  await db.civKV.upsert({
    where: { key: KV_SERVER_STATUS },
    create: { key: KV_SERVER_STATUS, value: JSON.stringify({ at: Date.now(), servers: live }) },
    update: { key: KV_SERVER_STATUS, value: JSON.stringify({ at: Date.now(), servers: live }) },
  });
  return live;
}

// ---------- LIFECYCLE (managed saja) ----------

function runScript(script: string, args: string[], timeoutMs = 30_000): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve) => {
    execFile("bash", [script, ...args], { timeout: timeoutMs, cwd: path.dirname(script), env: { ...process.env } }, (err, stdout, stderr) => {
      resolve({ code: err && typeof (err as { code?: number }).code === "number" ? (err as { code?: number }).code as number : err ? 1 : 0, out: String(stdout).slice(-2000), err: String(stderr).slice(-2000) });
    });
  });
}

export type ServerAction = "start" | "stop" | "restart" | "status";

export interface ServerActionResult {
  ok: boolean;
  id: string;
  action: ServerAction;
  detail: string;
  online?: boolean;
  latencyMs?: number | null;
}

export async function serverAction(id: string, action: ServerAction): Promise<ServerActionResult> {
  const servers = await ensureServerSeed();
  const s = servers.find((x) => x.id === id);
  if (!s) return { ok: false, id, action, detail: `server tidak dikenal: ${id}` };
  if (!s.managed || !s.script) {
    return { ok: false, id, action, detail: `server remote/tidak managed — kelola dari panel penyedianya (${s.host}:${s.port})` };
  }
  if (!fs.existsSync(s.script)) return { ok: false, id, action, detail: `skrip tidak ada: ${s.script}` };

  if (action === "status") {
    const st = await pingServer(s);
    return { ok: true, id, action, detail: st.online ? `online ${st.latencyMs}ms` : `offline — ${st.error ?? "tidak merespons"}`, online: st.online, latencyMs: st.latencyMs };
  }

  const r = await runScript(s.script, [action], action === "start" ? 90_000 : 45_000);
  // verifikasi NYATA pasca-aksi (bukan asumsi sukses dari exit code)
  await new Promise((res) => setTimeout(res, action === "start" ? 4000 : 1200));
  const st = await pingServer(s);
  const ok = action === "stop" ? !st.online : st.online;
  const detail = ok
    ? `${action} OK — ${st.online ? `online ${st.latencyMs}ms${st.version ? " · " + st.version : ""}` : "offline (konfirmasi)"}`
    : `${action} TIDAK terkonfirmasi — skrip: code=${r.code} ${r.err || r.out}`.slice(0, 300);
  await emit({
    type: EVENT_TYPES.MC_STATUS,
    subjectType: "SERVER",
    subjectId: id,
    payload: { action, ok, detail, online: st.online },
  });
  return { ok, id, action, detail, online: st.online, latencyMs: st.latencyMs };
}

/** Watchdog: server managed yang autoStart tapi offline → dicoba hidupkan. Dipakai daemon + selflife. */
export async function watchdogServers(): Promise<Array<{ id: string; revived: boolean; detail: string }>> {
  const out: Array<{ id: string; revived: boolean; detail: string }> = [];
  const servers = await ensureServerSeed();
  for (const s of servers) {
    if (!s.managed || !s.autoStart) continue;
    const st = await pingServer(s);
    if (st.online) continue;
    const r = await serverAction(s.id, "start");
    out.push({ id: s.id, revived: r.ok, detail: r.detail });
  }
  return out;
}

/** Tambah / update server di registry (mis. edisi lain, node cluster, proxy). */
export async function upsertServer(s: CivServer): Promise<{ ok: boolean; error?: string }> {
  if (!s.id || !/^[a-z0-9-]{2,40}$/.test(s.id)) return { ok: false, error: "id wajib [a-z0-9-] 2..40" };
  if (!["BEDROCK", "JAVA"].includes(s.edition)) return { ok: false, error: "edition harus BEDROCK|JAVA (edisi lain via id custom + note)" };
  if (!s.host || !Number.isInteger(s.port) || s.port < 1 || s.port > 65535) return { ok: false, error: "host/port tidak valid" };
  const servers = await loadServers();
  const i = servers.findIndex((x) => x.id === s.id);
  if (i >= 0) servers[i] = { ...servers[i], ...s };
  else servers.push(s);
  await saveServers(servers);
  return { ok: true };
}

export async function removeServer(id: string): Promise<{ ok: boolean; error?: string }> {
  const servers = await loadServers();
  const next = servers.filter((x) => x.id !== id);
  if (next.length === servers.length) return { ok: false, error: `tidak ada server id ${id}` };
  await saveServers(next);
  return { ok: true };
}

// Registry dibaca via loadServers/ensureServerSeed (DB CivKV "servers.registry").
export { KV_SERVERS, ROOT as SERVERS_ROOT };
