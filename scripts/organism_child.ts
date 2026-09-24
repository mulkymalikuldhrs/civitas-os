// organism_child.ts — ENTRY POINT organisme anak (eksekusi nyata).
// Dipanggil spawner.ts: bun scripts/organism_child.ts <childDir>
// Anak hidup dari DNA-nya sendiri (di <dir>/dna.json), punya siklus mikro:
// observe (os nyata) → decide (mikro) → act (tulis state/journal) → stop rules.
// Stop rules nyata: file <dir>/STOP, kill switch global, maxCycles (temporary),
// atau operator membunuh PID-nya. Anak TIDAK boleh spawn anak (recursion guard).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, "dna.json"))) {
  process.stderr.write("child: dir dna.json tidak ditemukan\n");
  process.exit(2);
}

const dna = JSON.parse(fs.readFileSync(path.join(dir, "dna.json"), "utf8"));
const options = JSON.parse(fs.readFileSync(path.join(dir, "options.json"), "utf8")) as { intervalMs: number; maxCycles: number };
const globalKill = path.join(process.cwd(), ".civitas", "organism", "KILL_SWITCH");
const localStop = path.join(dir, "STOP");
const stateFile = path.join(dir, "state.json");
const journal = path.join(dir, "journal.jsonl");

function alive(): boolean {
  if (fs.existsSync(localStop)) return false;
  try { if (fs.readFileSync(globalKill, "utf8").toUpperCase().includes("KILL")) return false; } catch { /* tidak ada */ }
  return true;
}

function jline(entry: Record<string, unknown>): void {
  try { fs.appendFileSync(journal, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", "utf8"); } catch { /* noop */ }
}

let cycle = 0;
jline({ kind: "BORN", pid: process.pid, name: dna.core.name, purpose: dna.core.purpose });

const timer = setInterval(() => {
  cycle += 1;
  const rssMb = Math.round(process.memoryUsage().rss / 1048576);
  const load1 = Number(os.loadavg()[0].toFixed(2));

  // keputusan mikro: report tiap 3 siklus, sisanya observe ringan
  if (cycle % 3 === 0) {
    jline({ kind: "REPORT", cycle, rssMb, load1, note: `${dna.core.name} hidup: siklus ${cycle}, RSS ${rssMb}MB` });
  }

  fs.writeFileSync(stateFile, JSON.stringify({
    at: new Date().toISOString(), pid: process.pid, cycle, rssMb, load1,
    name: dna.core.name, phase: "RUNNING",
  }, null, 2), "utf8");

  // stop rules
  if (!alive()) {
    jline({ kind: "STOPPED", cycle, reason: fs.existsSync(localStop) ? "STOP file" : "kill switch global" });
    fs.writeFileSync(stateFile, JSON.stringify({ at: new Date().toISOString(), pid: process.pid, cycle, phase: "STOPPED", reason: "stop-file/kill-switch" }, null, 2), "utf8");
    clearInterval(timer);
    process.exit(0);
  }
  if (dna.core.kind === "temporary" && cycle >= options.maxCycles) {
    jline({ kind: "EXPIRED", cycle, reason: `maxCycles=${options.maxCycles} (temporary lifecycle)` });
    fs.writeFileSync(stateFile, JSON.stringify({ at: new Date().toISOString(), pid: process.pid, cycle, phase: "EXPIRED" }, null, 2), "utf8");
    clearInterval(timer);
    process.exit(0);
  }
}, Math.max(2000, options.intervalMs));

// immune limit anak: RSS sendiri (limit #4 enforced juga di level proses anak)
setInterval(() => {
  const rssMb = process.memoryUsage().rss / 1048576;
  if (rssMb > dna.immune.maxMemoryMb) {
    jline({ kind: "IMMUNE", signal: "RESOURCE", detail: `child RSS ${rssMb.toFixed(0)}MB > ${dna.immune.maxMemoryMb}MB → self-kill` });
    process.exit(9);
  }
}, 10_000).unref();

process.on("SIGTERM", () => {
  jline({ kind: "SIGTERM", cycle });
  clearInterval(timer);
  process.exit(0);
});
