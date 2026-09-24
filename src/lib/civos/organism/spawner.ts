// ORGANISM · spawner.ts — Agent Spawner dengan EKSEKUSI NYATA.
// Spawn = proses `bun scripts/organism_child.ts <dir>` sungguhan (PID nyata,
// log nyata, heartbeat nyata). Lifecycle: temporary → specialized →
// archive/kill. Population management (L5): reap mati, merge sejenis.

import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { birthDNA } from "./dna";
import { CHILDREN_DIR, FILES, ensureDirs, readJson, writeJson } from "./store";
import type { ChildRecord, OrganismGenome } from "./types";

const pexec = promisify(execFile);

export function listChildren(): ChildRecord[] {
  return readJson<ChildRecord[]>(FILES.children, []);
}

function saveChildren(all: ChildRecord[]): void {
  writeJson(FILES.children, all.slice(-40));
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function readChildState(id: string): { heartbeat?: string; cycles?: number } {
  const dir = path.join(CHILDREN_DIR, id);
  const st = readJson<{ at?: string; cycle?: number }>(path.join(dir, "state.json"), {});
  return { heartbeat: st.at, cycles: st.cycle };
}

/** Sinkronkan registry dengan kenyataan PID + heartbeat. */
export function refreshChildren(): ChildRecord[] {
  const all = listChildren();
  for (const c of all) {
    if (c.status === "RUNNING") {
      if (!pidAlive(c.pid)) {
        c.status = "DEAD";
        c.exitCode = null;
      } else {
        const st = readChildState(c.id);
        c.lastHeartbeat = st.heartbeat;
        c.cycles = st.cycles;
      }
    }
  }
  saveChildren(all);
  return all;
}

export async function spawnChild(args: {
  role: string;
  kind?: "temporary" | "specialized";
  purpose: string;
  intervalMs?: number;
  maxCycles?: number;
}): Promise<{ ok: boolean; child?: ChildRecord; note: string }> {
  ensureDirs();
  const id = `cell_${Date.now().toString(36)}${Math.floor(Math.random() * 1e3).toString(36)}`;
  const dir = path.join(CHILDREN_DIR, id);
  fs.mkdirSync(dir, { recursive: true });

  const dna = birthDNA({
    name: `${args.role}-${id.slice(5)}`,
    purpose: args.purpose,
    kind: args.kind ?? "temporary",
    parent: "CIVITAS-PRIME",
  });
  const childGenome: OrganismGenome = {
    ...structuredClone(dna.genome),
    workflow: { ...dna.genome.workflow, intervalMs: args.intervalMs ?? 8_000 },
  };
  const childDna = { ...dna, genome: childGenome };
  // PENTING: DNA anak HANYA ditulis ke dir anak — DNA root tidak boleh tersentuh
  fs.writeFileSync(path.join(dir, "dna.json"), JSON.stringify(childDna, null, 2), "utf8");
  fs.writeFileSync(path.join(dir, "options.json"), JSON.stringify({ intervalMs: args.intervalMs ?? 8_000, maxCycles: args.maxCycles ?? 40 }, null, 2), "utf8");

  // EKSEKUSI NYATA (child menulis journal/state sendiri — lihat organism_child.ts)
  let pid: number;
  try {
    const proc = spawn("bun", ["scripts/organism_child.ts", dir], {
      cwd: process.cwd(),
      stdio: "ignore",
      detached: false,
    });
    proc.unref();
    if (proc.pid === undefined) throw new Error("PID tidak tersedia dari proses spawn");
    pid = proc.pid;
  } catch (e) {
    return { ok: false, note: `spawn gagal: ${(e as Error).message.slice(0, 120)}` };
  }

  const child: ChildRecord = {
    id, name: dna.core.name, role: args.role, kind: args.kind ?? "temporary",
    purpose: args.purpose, pid, dir,
    spawnedAt: new Date().toISOString(), status: "RUNNING",
  };
  const all = listChildren(); all.push(child); saveChildren(all);
  return { ok: true, child, note: `PID ${pid} hidup — child organism berjalan` };
}

/** KILL / ARCHIVE nyata: SIGTERM → tunggu → SIGKILL. */
export async function killChild(id: string, mode: "KILL" | "ARCHIVE"): Promise<{ ok: boolean; note: string }> {
  const all = listChildren();
  const c = all.find((x) => x.id === id);
  if (!c) return { ok: false, note: "child tidak ditemukan" };
  if (pidAlive(c.pid)) {
    try { process.kill(c.pid, "SIGTERM"); } catch { /* sudah mati */ }
    await new Promise((r) => setTimeout(r, 600));
    if (pidAlive(c.pid)) {
      try { process.kill(c.pid, "SIGKILL"); } catch { /* sudah mati */ }
    }
  }
  c.status = mode === "KILL" ? "KILLED" : "ARCHIVED";
  c.exitCode = null;
  const i = all.findIndex((x) => x.id === id); all[i] = c; saveChildren(all);
  return { ok: true, note: `child ${id} → ${c.status}` };
}

/** REAP: child tercatat RUNNING tapi PID mati → status jujur DEAD + pelajaran. */
export async function reapDead(): Promise<{ reaped: string[]; merged: string[] }> {
  const all = refreshChildren();
  const reaped: string[] = [];
  const merged: string[] = [];
  for (const c of all.filter((x) => x.status === "DEAD")) {
    reaped.push(c.id);
  }
  // MERGE (L5): dua child role sama & sama-sama hidup → arsipkan yang cycle-nya lebih sedikit
  const byRole = new Map<string, ChildRecord[]>();
  for (const c of all.filter((x) => x.status === "RUNNING" && pidAlive(x.pid))) {
    const arr = byRole.get(c.role) ?? [];
    arr.push(c);
    byRole.set(c.role, arr);
  }
  for (const [, arr] of byRole) {
    if (arr.length > 1) {
      const sorted = arr.sort((a, b) => (a.cycles ?? 0) - (b.cycles ?? 0));
      for (const victim of sorted.slice(0, sorted.length - 1)) {
        const res = await killChild(victim.id, "ARCHIVE");
        if (res.ok) merged.push(victim.id);
      }
    }
  }
  saveChildren(all);
  return { reaped, merged };
}

/** Recompose populasi sesuai genome.agentComposition (L5). */
export async function reconcileComposition(
  composition: { role: string; count: number }[],
  purposeFor: (role: string) => string,
): Promise<{ spawned: string[]; removed: string[] }> {
  const all = refreshChildren();
  const aliveByRole = new Map<string, number>();
  for (const c of all.filter((x) => x.status === "RUNNING" && pidAlive(x.pid))) {
    aliveByRole.set(c.role, (aliveByRole.get(c.role) ?? 0) + 1);
  }
  const spawned: string[] = [];
  const removed: string[] = [];
  for (const comp of composition) {
    const have = aliveByRole.get(comp.role) ?? 0;
    for (let i = have; i < comp.count; i++) {
      const res = await spawnChild({ role: comp.role, kind: "specialized", purpose: purposeFor(comp.role) });
      if (res.ok && res.child) spawned.push(res.child.id);
    }
    const surplus = all.filter((x) => x.role === comp.role && x.status === "RUNNING" && pidAlive(x.pid)).slice(comp.count);
    for (const extra of surplus) {
      const res = await killChild(extra.id, "ARCHIVE");
      if (res.ok) removed.push(extra.id);
    }
  }
  return { spawned, removed };
}
