// ORGANISM · worldmodel.ts — WORLD MODEL = satu-satunya sumber kebenaran
// organisme (Minecraft hanyalah lapisan embodiment). Semua angka di sini
// berasal dari probe NYATA: os/df/ps (envprobe), PID check, RakNet UDP ping,
// health web app, filesystem. Unknown/assumption/unverified = first-class.

import fs from "node:fs";
import dgram from "node:dgram";
import path from "node:path";
import { detectDuplicateOrgans, scanRepoTopology } from "./repos";
import { CHILDREN_DIR, FILES, ORG_ROOT, readJson } from "./store";
import { lastLesson, memorySize } from "./memory";
import { probeEnv } from "./envprobe";
import type { Capability, ChildRecord, ImmuneLimits, MutationRecord, OrganismPermissions, WorldModel } from "./types";

const RAKNET_MAGIC = Buffer.from([0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe, 0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78]);

/** RakNet unicast ping nyata ke server Bedrock (bukan simulasi). */
export function raknetPing(host: string, port: number, timeoutMs = 1500): Promise<{ online: boolean; latencyMs: number; info?: string }> {
  return new Promise((resolve) => {
    const sock = dgram.createSocket("udp4");
    const t0 = Date.now();
    let done = false;
    const finish = (online: boolean, info?: string) => {
      if (done) return;
      done = true;
      try { sock.close(); } catch { /* sudah tertutup */ }
      resolve({ online, latencyMs: Date.now() - t0, info });
    };
    const ping = Buffer.concat([Buffer.from([0x01]), Buffer.from([0x12, 0x34, 0x56, 0x78]), RAKNET_MAGIC.subarray(4), Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])]);
    sock.on("message", (msg) => {
      if (msg.length > 0 && (msg[0] === 0x1c || msg[0] === 0x1f)) {
        finish(true, `pong ${msg.length}B`);
      }
    });
    sock.on("error", () => finish(false));
    sock.send(ping, port, host, (err) => { if (err) finish(false); });
    setTimeout(() => finish(false), timeoutMs);
  });
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function health(url: string, limits: ImmuneLimits): Promise<{ ok: boolean; ms: number; status: number }> {
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), Math.min(limits.networkTimeoutMs, 4000));
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    return { ok: res.ok, ms: Date.now() - t0, status: res.status };
  } catch {
    return { ok: false, ms: Date.now() - t0, status: 0 };
  }
}

export async function buildWorldModel(args: {
  dnaImmune: ImmuneLimits;
  perms: OrganismPermissions;
  mcHost: string;
  mcPort: number;
}): Promise<WorldModel> {
  const { dnaImmune, perms, mcHost, mcPort } = args;

  // ── probe nyata paralel ──
  const [env, mc, app] = await Promise.all([
    probeEnv(perms),
    raknetPing(mcHost, mcPort, 1800),
    health("http://127.0.0.1:3000/api/civos/state", dnaImmune),
  ]);

  let daemonAlive = false;
  try {
    const pid = Number(fs.readFileSync(path.join(process.cwd(), ".civitas-daemon.pid"), "utf8").trim());
    daemonAlive = pidAlive(pid);
  } catch { daemonAlive = false; }

  const fifoExists = (() => {
    try { return fs.existsSync("/home/z/my-project/mc-server/pmmp/console.in"); } catch { return false; }
  })();

  // ── children registry nyata ──
  const children = readJson<ChildRecord[]>(FILES.children, []);
  const agents = [
    { id: "CIVITAS-PRIME", kind: "root", alive: true, role: "governing-organism" },
    ...children.map((c) => ({ id: c.id, kind: c.kind, alive: c.status === "RUNNING" && pidAlive(c.pid), role: c.role })),
  ];

  // ── products dari topologi repositori nyata ──
  const topology = scanRepoTopology(process.cwd(), perms);
  const products = topology.roots.map((r) => ({
    name: r.name, path: r.path, owner: r.owner,
    subsystems: r.children.length,
  }));

  const duplicates = detectDuplicateOrgans(topology);
  const memN = memorySize();
  const mutations = readJson<MutationRecord[]>(FILES.mutations, []);
  const capabilities = readJson<Capability[]>(FILES.capabilities, []);

  // ── risks hidup (dari data nyata, bukan dekorasi) ──
  const risks: WorldModel["risks"] = [];
  if ((env.disk?.freeMb ?? Infinity) < 500) risks.push({ key: "disk_low", level: "HIGH", note: `sisa disk ${env.disk?.freeMb}MB` });
  else if ((env.disk?.freeMb ?? Infinity) < 2000) risks.push({ key: "disk_warn", level: "MEDIUM", note: `sisa disk ${env.disk?.freeMb}MB` });
  if (env.cpu.load1 > env.cpu.count) risks.push({ key: "cpu_saturated", level: "MEDIUM", note: `load1=${env.cpu.load1} > cores=${env.cpu.count}` });
  if (env.memory.freeMb < 400) risks.push({ key: "mem_pressure", level: "HIGH", note: `free mem ${env.memory.freeMb}MB` });
  if (!mc.online && mcHost.includes("aternos")) risks.push({ key: "remote_server_offline", level: "MEDIUM", note: "server online tidur/offline (Aternos idle)" });
  const deadKids = children.filter((c) => c.status === "RUNNING" && !pidAlive(c.pid));
  if (deadKids.length > 0) risks.push({ key: "dead_children", level: "MEDIUM", note: `${deadKids.length} child tercatat RUNNING tapi PID mati` });
  if (duplicates.length > 0) risks.push({ key: "duplicate_organs", level: "LOW", note: `nama modul mirip: ${duplicates.slice(0, 4).join(", ")}` });

  const known = [
    { key: "runtime", value: env.nodeRuntime, at: env.at, source: "envprobe" },
    { key: "cpu", value: `${env.cpu.count} core load1=${env.cpu.load1}`, at: env.at, source: "envprobe" },
    { key: "rss_mb", value: String(env.memory.rssMb), at: env.at, source: "process" },
    { key: "disk_free_mb", value: String(env.disk?.freeMb ?? "unknown"), at: env.at, source: "df" },
    { key: "web_app", value: app.ok ? `ok ${app.ms}ms` : `down (${app.status})`, at: env.at, source: "http" },
    { key: "daemon", value: daemonAlive ? "alive" : "not running", at: env.at, source: "pidfile" },
    { key: "java_console_fifo", value: fifoExists ? "present" : "absent", at: env.at, source: "fs" },
    { key: "mc_server_ping", value: mc.online ? `online ${mc.latencyMs}ms` : `no pong (${mc.latencyMs}ms)`, at: env.at, source: "raknet-udp" },
    { key: "memory_entries", value: String(memN), at: env.at, source: "memory" },
    { key: "capabilities", value: `${capabilities.filter((c) => c.status === "AVAILABLE").length}/${capabilities.length} available`, at: env.at, source: "registry" },
  ];

  const world: WorldModel = {
    at: new Date().toISOString(),
    resources: {
      cpuCount: env.cpu.count, load1: env.cpu.load1, load5: env.cpu.load5,
      rssMb: env.memory.rssMb, heapMb: env.memory.heapUsedMb,
      freememMb: env.memory.freeMb, totalmemMb: env.memory.totalMb,
      diskFreeMb: env.disk?.freeMb ?? -1, uptimeS: env.uptimeS,
    },
    infrastructure: {
      web_app: { health: app.ok ? 100 : 0, note: app.ok ? `${app.ms}ms` : `status ${app.status}` },
      daemon: { health: daemonAlive ? 100 : 0, note: daemonAlive ? "pid hidup" : "tidak berjalan" },
      java_console: { health: fifoExists ? 100 : 0, note: fifoExists ? "console.in siap" : "FIFO tidak ada" },
      mc_bedrock: { health: mc.online ? Math.max(20, 100 - mc.latencyMs / 20) : 0, note: mc.online ? `pong ${mc.latencyMs}ms` : "tidak merespons ping" },
    },
    agents,
    products,
    knowledge: { memoryEntries: memN, lastLesson: lastLesson() },
    risks,
    experiments: mutations.slice(-6).map((m) => ({ id: m.id, status: m.status, verdict: m.verdict })),
    economy: {
      cycleCostMs: Number(readJson<{ avgCycleMs?: number }>(path.join(ORG_ROOT, "economy.json"), {}).avgCycleMs ?? 0),
      actionsDone: readJson<{ actions?: number }>(path.join(ORG_ROOT, "economy.json"), {}).actions ?? 0,
      valueScore: readJson<{ valueScore?: number }>(path.join(ORG_ROOT, "economy.json"), {}).valueScore ?? 0,
    },
    epistemic: {
      known,
      unknown: [
        { key: "remote_server_quota", why: "kuota jam Aternos tidak terbaca dari luar", probe: "mc.raknet" },
        { key: "player_concurrency_peak", why: "butuh census jangka panjang yang belum dibangun", probe: "census.snapshot" },
        { key: "true_java_uptime_24h", why: "log Paper belum dianalisis rentang 24 jam penuh", probe: "java.logscan" },
      ],
      assumptions: [
        { key: "localhost_web_is_canary", note: "health 127.0.0.1 mewakili kesehatan app produksi", risky: true },
        { key: "fifo_write_reaches_console", note: "tulisan ke console.in sampai ke konsol Paper", risky: true },
      ],
      unverified: [
        { key: "economy_ledger_consistency", howToVerify: "rekonsiliasi balances vs transaksi" },
        { key: "backup_restore_works", howToVerify: "restore satu backup ke direktori uji" },
      ],
    },
  };
  return world;
}
