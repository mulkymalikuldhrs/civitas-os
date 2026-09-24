// ORGANISM · envprobe.ts — Environment awareness (HERMES).
// Organisme tahu perangkat tempatnya hidup: CPU/RAM/disk/network/proses.
// Permission-aware: baca flag DNA.permissions — autonomy ≠ kekuasaan tanpa batas.

import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import type { OrganismPermissions } from "./types";

const pexec = promisify(execFile);

export interface EnvReport {
  at: string;
  cpu: { count: number; model: string; load1: number; load5: number; load15: number };
  memory: { totalMb: number; freeMb: number; rssMb: number; heapUsedMb: number };
  disk: { path: string; freeMb: number; totalMb: number } | null;
  uptimeS: number;
  platform: string;
  nodeRuntime: string;
  processes: { pid: number; cmd: string }[];
  networkIfaces: { name: string; address: string }[];
  denied: string[]; // probe yang ditolak permission — jujur dilaporkan
}

export async function probeEnv(perms: OrganismPermissions): Promise<EnvReport> {
  const denied: string[] = [];
  const mu = process.memoryUsage();

  let disk: EnvReport["disk"] = null;
  if (perms.fsRead) {
    try {
      const { stdout } = await pexec("df", ["-k", "-P", process.cwd()], { timeout: 4_000 });
      const line = stdout.trim().split("\n").pop() ?? "";
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        disk = {
          path: parts[5] ?? process.cwd(),
          freeMb: Math.round(Number(parts[3]) / 1024),
          totalMb: Math.round(Number(parts[1]) / 1024),
        };
      }
    } catch { denied.push("disk.df"); }
  } else denied.push("disk.df(no-fsRead)");

  let processes: { pid: number; cmd: string }[] = [];
  if (perms.exec) {
    try {
      const { stdout } = await pexec("bash", ["-c", "ps -eo pid=,comm= | head -12"], { timeout: 4_000 });
      processes = stdout.trim().split("\n").slice(0, 12).map((l) => {
        const m = l.trim().match(/^(\d+)\s+(.+)$/);
        return { pid: Number(m?.[1] ?? 0), cmd: m?.[2] ?? "?" };
      });
    } catch { denied.push("proc.ps"); }
  } else denied.push("proc.ps(no-exec)");

  const ifaces: { name: string; address: string }[] = [];
  try {
    const nets = os.networkInterfaces();
    for (const [name, addrs] of Object.entries(nets)) {
      for (const a of addrs ?? []) if (a.family === "IPv4") ifaces.push({ name, address: a.address });
    }
  } catch { denied.push("net.ifaces"); }

  return {
    at: new Date().toISOString(),
    cpu: {
      count: os.cpus().length,
      model: os.cpus()[0]?.model ?? "unknown",
      load1: Number(os.loadavg()[0].toFixed(2)),
      load5: Number(os.loadavg()[1].toFixed(2)),
      load15: Number(os.loadavg()[2].toFixed(2)),
    },
    memory: {
      totalMb: Math.round(os.totalmem() / 1048576),
      freeMb: Math.round(os.freemem() / 1048576),
      rssMb: Math.round(mu.rss / 1048576),
      heapUsedMb: Math.round(mu.heapUsed / 1048576),
    },
    disk,
    uptimeS: Math.round(os.uptime()),
    platform: `${os.platform()} ${os.arch()}`,
    nodeRuntime: `runtime ${process.version} (${(globalThis as { Bun?: { version?: string } }).Bun?.version ?? "node"})`,
    processes,
    networkIfaces: ifaces.slice(0, 6),
    denied,
  };
}
