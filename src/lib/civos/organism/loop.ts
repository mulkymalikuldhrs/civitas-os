// ORGANISM · loop.ts — TRUE AUTONOMOUS LOOP + Runtime singleton.
// observe_world → update_world_model → generate_possible_goals → prioritize
// → decide → execute → evaluate → update_memory → reflect →
// detect_capability_gap → spawn capability → propose/test/adopt mutations →
// rebalance → continue.
// Semua eksekusi melewati imun; semua kegagalan jadi data; DO NOTHING sah.

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getConfigValue } from "../config";
import { ensureBuiltins, computeGap, acquireCapability, verifyCapability, listCapabilities } from "./capability";
import { decide } from "./decision";
import { checkKillSwitch, runGuarded, setPhaseChanger } from "./immune";
import { killSwitchActive, loadOrBirthDNA, saveDNA } from "./dna";
import { think } from "./llm";
import { remember, rememberFailure, recall } from "./memory";
import { listMutations, runMutation, rollbackMutation } from "./mutation";
import { killChild, reapDead, refreshChildren, spawnChild } from "./spawner";
import { FILES, ORG_ROOT, appendJsonl, readJson, writeJson } from "./store";
import { buildWorldModel } from "./worldmodel";
import { generateGoals } from "./goals";
import type { Goal, LoopState, OrganismState, OrganismPhase, WorldModel } from "./types";

const pexec = promisify(execFile);

// ── helper state kecil ──

function readLoop(): LoopState {
  return readJson<LoopState>(FILES.loop, {
    phase: "RUNNING", cycle: 0,
    stats: { actions: 0, failures: 0, mutations: 0, spawns: 0, lessons: 0 },
  });
}
function writeLoop(l: LoopState): void { writeJson(FILES.loop, l); }

function setPhase(to: OrganismPhase, reason: string): void {
  const loop = readLoop();
  const from = loop.phase;
  loop.phase = to;
  loop.lastPhaseChange = { at: new Date().toISOString(), from, to, reason };
  writeLoop(loop);
  appendJsonl(FILES.eventsLog, { at: new Date().toISOString(), kind: "PHASE", from, to, reason });
}

function bumpEconomy(cycleMs: number, actionScore: number): void {
  const ecoPath = path.join(ORG_ROOT, "economy.json");
  const eco = readJson<{ avgCycleMs?: number; actions?: number; valueScore?: number }>(ecoPath, {});
  const prevMs = eco.avgCycleMs ?? cycleMs;
  const n = (eco.actions ?? 0) + 1;
  eco.avgCycleMs = Math.round(prevMs * 0.7 + cycleMs * 0.3);
  eco.actions = n;
  eco.valueScore = (eco.valueScore ?? 0) + actionScore;
  writeJson(ecoPath, eco);
}

/** Unknown yang sudah terverifikasi — dipindah keluar dari epistemic.unknown. */
function resolveUnknown(key: string, result: string): void {
  const file = path.join(ORG_ROOT, "resolved-unknowns.json");
  const all = readJson<Record<string, { at: string; result: string }>>(file, {});
  all[key] = { at: new Date().toISOString(), result };
  writeJson(file, all);
}

// ── actions: eksekusi nyata per action protocol ──

async function actRepairInfra(g: Goal): Promise<string> {
  const target = String(g.params.target ?? "");
  if (target === "daemon") {
    try {
      await pexec("bash", ["scripts/civitas_daemon.sh", "start"], { timeout: 10_000, cwd: process.cwd() });
      return "daemon start dijalankan (bash nyata)";
    } catch (e) { return `daemon start gagal: ${(e as Error).message.slice(0, 80)}`; }
  }
  if (target === "java_console") {
    const fifo = "/home/z/my-project/mc-server/pmmp/console.in";
    if (!fs.existsSync(fifo)) {
      try {
        fs.mkdirSync(path.dirname(fifo), { recursive: true });
        await pexec("mkfifo", [fifo], { timeout: 5_000 });
        return `FIFO ${fifo} dibuat ulang (mkfifo nyata)`;
      } catch (e) { return `mkfifo gagal: ${(e as Error).message.slice(0, 80)}`; }
    }
    return "FIFO ada — health sebelumnya palsu-alarm, re-probe siklus berikut";
  }
  if (target === "web_app") {
    try {
      const res = await fetch("http://127.0.0.1:3000/api/civos/state", { signal: AbortSignal.timeout(4000) });
      return `web app merespons ${res.status} (probe ulang nyata)`;
    } catch (e) { return `web app tetap tak terjangkau: ${(e as Error).message.slice(0, 60)} — butuh runtime host` ; }
  }
  if (target === "mc_bedrock") {
    return "server Bedrock remote tidak bisa dinyalakan dari dalam organisme — keterbatasan diakui (Aternos butuh manusia/panel)";
  }
  return `target ${target} tak dikenal — dicatat, bukan diarang-arang`;
}

async function actMitigateRisk(g: Goal): Promise<string> {
  const risk = String(g.params.risk ?? "");
  if (risk === "disk_low" || risk === "disk_warn") {
    // real cleanup: hapus backup tertua bila > konfigurasi, rotasi log besar
    const bkDir = path.join(process.cwd(), "backups");
    let freed = 0;
    try {
      const entries = fs.readdirSync(bkDir).filter((f) => f.endsWith(".tar.gz")).sort();
      while (entries.length > 3) {
        const victim = entries.shift();
        if (!victim) break;
        const p = path.join(bkDir, victim);
        freed += fs.statSync(p).size;
        fs.rmSync(p, { force: true });
      }
    } catch { /* dir tak ada */ }
    return `cleanup nyata: ${freed} byte dibebaskan dari backups/`;
  }
  if (risk === "mem_pressure") {
    const before = process.memoryUsage().rss;
    try { (globalThis as { Bun?: { gc?: (f: boolean) => void } }).Bun?.gc?.(true); } catch { /* noop */ }
    const after = process.memoryUsage().rss;
    return `gc dipaksa: RSS ${(before / 1048576).toFixed(0)}MB → ${(after / 1048576).toFixed(0)}MB`;
  }
  if (risk === "cpu_saturated") {
    // adaptasi L3 nyata: menurunkan laju siklus sendiri
    const { dna } = loadOrBirthDNA();
    dna.genome.workflow.intervalMs = Math.min(300_000, Math.round(dna.genome.workflow.intervalMs * 1.5));
    saveDNA(dna);
    return `interval siklus dinaikkan menjadi ${Math.round(dna.genome.workflow.intervalMs / 1000)}s (adaptasi mandiri)`;
  }
  return `risiko ${risk} dicatat — mitigasi nyata butuh jalur yang belum ada (jujur)`;
}

async function actVerifyUnknown(g: Goal): Promise<string> {
  const key = String(g.params.key ?? "");
  const probe = String(g.params.probe ?? "");
  if (key === "player_concurrency_peak" && probe === "census.snapshot") {
    const acquired = await acquireCapability("census.snapshot");
    if (acquired.ok) { resolveUnknown(key, acquired.note); return `unknown '${key}' terverifikasi via ${acquired.how}: ${acquired.note}`; }
    return `probe census belum siap: ${acquired.note}`;
  }
  if (key === "true_java_uptime_24h" && probe === "java.logscan") {
    const acquired = await acquireCapability("java.logscan");
    if (acquired.ok) { resolveUnknown(key, acquired.note); return `unknown '${key}' terverifikasi via ${acquired.how}: ${acquired.note}`; }
    return `probe logscan belum siap: ${acquired.note}`;
  }
  if (key === "remote_server_quota" && probe === "mc.raknet") {
    const w = await buildWorldModel({ dnaImmune: (loadOrBirthDNA()).dna.immune, perms: (loadOrBirthDNA()).dna.permissions, mcHost: await getConfigValue("mc.host"), mcPort: Number(await getConfigValue("mc.port") || 19132) });
    const pong = w.infrastructure.mc_bedrock;
    resolveUnknown(key, `ping ${pong.note} — kuota jam tetap tak terbaca dari luar (keterbatasan panel)`);
    return `probe raknet jalan: ${pong.note}; kuota tetap unknown (jujur)`;
  }
  return `unknown '${key}' belum punya jalur verifikasi — tetap unknown`;
}

async function actSelfReport(g: Goal, world: WorldModel): Promise<string> {
  const { mode, text } = await think("Laporkan keadaan diri sekarang.", world, (loadOrBirthDNA()).dna.immune);
  remember({ kind: "OBSERVATION", text: `self-report (${mode}): ${text.slice(0, 220)}` }, (loadOrBirthDNA()).dna.immune.maxMemoryEntries);
  writeJson(path.join(ORG_ROOT, "last-report.json"), { at: new Date().toISOString(), mode, text });
  return `self-report ditulis (mode ${mode})`;
}

async function actAcquireCapability(g: Goal): Promise<string> {
  const key = String(g.params.key ?? "");
  const res = await acquireCapability(key.replace(/^plan:/, ""));
  return `acquire '${key}': ${res.how} — ${res.note}`;
}

// ── runtime ──

export class OrganismRuntime {
  private ticking = false;

  constructor() {
    setPhaseChanger(setPhase);
  }

  /** Satu siklus penuh. force=true menembus PAUSED (untuk operator via UI). */
  async tick(force = false): Promise<{ ran: boolean; note: string; cycle: number }> {
    const t0 = Date.now();
    let loop = readLoop();
    if (this.ticking) return { ran: false, note: "tick sebelumnya masih berjalan — anti-recurssion guard", cycle: loop.cycle };
    if (loop.phase === "KILLED") return { ran: false, note: "organisme KILLED — kill switch permanen", cycle: loop.cycle };
    if (loop.phase === "LOCKED") return { ran: false, note: "organisme LOCKED oleh operator", cycle: loop.cycle };
    if (loop.phase === "PAUSED" && !force) return { ran: false, note: "PAUSED — tick dilewati", cycle: loop.cycle };

    this.ticking = true;
    try {
      checkKillSwitch(killSwitchActive());
      const { dna, newborn } = loadOrBirthDNA();
      if (newborn) remember({ kind: "OBSERVATION", text: "DNA baru dilahirkan (dna.json kosong sebelumnya)" }, dna.immune.maxMemoryEntries);

      // 1-2. OBSERVE + UPDATE WORLD MODEL (nyata)
      const mcHost = (await getConfigValue("mc.host")) || "127.0.0.1";
      const mcPort = Number((await getConfigValue("mc.port")) || "19132");
      const world = await runGuarded(
        () => buildWorldModel({ dnaImmune: dna.immune, perms: dna.permissions, mcHost, mcPort }),
        { label: "observe_world", limits: dna.immune },
      );

      // 3. CAPABILITIES: pastikan builtin terdaftar + verify berkala
      await ensureBuiltins();
      loop = readLoop();
      if (loop.cycle % 5 === 0) {
        for (const c of listCapabilities()) await verifyCapability(c.id);
      }

      // 4. GOALS + GAP
      const goals = generateGoals(world, dna.genome).slice(0, dna.genome.workflow.maxGoalsPerCycle);
      const gaps = goals.filter((g) => g.requiredCapabilities?.length).map((g) => computeGap(g.id, g.requiredCapabilities ?? []));

      // 5. DECIDE (do-nothing sah)
      const decision = decide(loop.cycle, goals, dna.genome, world);

      // 6. ACT
      let actionNote = "DO NOTHING — energi dihemat, dunia sehat";
      if (decision.chosen) {
        const g = decision.chosen;
        try {
          actionNote = await runGuarded(() => this.execute(g, world), { label: `act:${g.action}`, limits: dna.immune });
          loop.stats.actions += 1;
          bumpEconomy(Date.now() - t0, g.score ?? 0);
        } catch (e) {
          loop.stats.failures += 1;
          const err = e as Error;
          rememberFailure({
            hypothesis: g.title, result: err.message.slice(0, 140),
            reason: err.name === "ImmuneViolation" ? "dihentikan sistem imun" : "eksekusi gagal",
            costMs: Date.now() - t0, maxEntries: dna.immune.maxMemoryEntries,
          });
          actionNote = `AKSI GAGAL (dicatat sebagai data): ${err.message.slice(0, 120)}`;
        }
      }

      // 7-8. EVALUATE + MEMORY
      loop = readLoop();
      loop.cycle += 1;
      loop.lastTickAt = new Date().toISOString();
      remember({ kind: "DECISION", text: `c#${loop.cycle} ${decision.reasoning} | hasil: ${actionNote.slice(0, 120)}` }, dna.immune.maxMemoryEntries);

      // 9. REFLECT (tiap 3 siklus) — lesson dari failure berulang
      if (loop.cycle % 3 === 0) {
        const fails = recall(12).filter((m) => m.kind === "FAILURE");
        const timeouts = fails.filter((f) => f.text.includes("TIMEOUT")).length;
        if (timeouts >= 2) {
          dna.genome.workflow.intervalMs = Math.min(300_000, dna.genome.workflow.intervalMs + 10_000);
          saveDNA(dna);
          remember({ kind: "LESSON", text: `timeout berulang ${timeouts}x → interval siklus dinaikkan ke ${Math.round(dna.genome.workflow.intervalMs / 1000)}s (adaptasi L3)` }, dna.immune.maxMemoryEntries);
          loop.stats.lessons += 1;
        } else {
          remember({ kind: "REFLECTION", text: `c#${loop.cycle}: aksi=${loop.stats.actions} gagal=${loop.stats.failures} mutasi=${loop.stats.mutations} — dunia: ${world.risks.length} risiko aktif` }, dna.immune.maxMemoryEntries);
        }
      }

      // 10. MUTATION PIPELINE: stagnan → mutasi otomatis L1/L2/L3 bergiliran
      const muts = listMutations();
      const pending = muts.filter((m) => m.status === "PROPOSED" || m.status === "SANDBOXED").length;
      if (muts.length === 0 || pending > 0) {
        const levels = ["L1_PARAMETER", "L2_STRATEGY", "L3_WORKFLOW"] as const;
        const lvl = levels[loop.cycle % levels.length];
        try {
          const { record, result } = await runGuarded(() => runMutation(lvl), { label: "mutation_ab", limits: dna.immune });
          loop.stats.mutations += 1;
          remember({ kind: "EVALUATION", text: `mutasi ${record.id} (${lvl}) → ${result.verdict}` }, dna.immune.maxMemoryEntries);
        } catch (e) {
          rememberFailure({ hypothesis: `mutasi otomatis ${lvl}`, result: (e as Error).message.slice(0, 100), reason: "sandbox/benchmark gagal", maxEntries: dna.immune.maxMemoryEntries });
        }
      }

      // 11. REBALANCE populasi (L5)
      const dead = refreshChildren().filter((c) => c.status === "DEAD");
      if (dead.length > 0) {
        const { reaped } = await reapDead();
        if (reaped.length) remember({ kind: "OBSERVATION", text: `reap ${reaped.length} child mati: ${reaped.join(",")}` }, dna.immune.maxMemoryEntries);
      }

      writeJson(FILES.world, world);
      writeJson(FILES.goals, goals);
      writeJson(FILES.decision, decision);
      writeJson(FILES.gaps, gaps);
      writeLoop(loop);
      appendJsonl(FILES.eventsLog, { at: new Date().toISOString(), kind: "CYCLE", cycle: loop.cycle, decision: decision.reasoning.slice(0, 160), action: actionNote.slice(0, 160), ms: Date.now() - t0 });

      return { ran: true, note: `${decision.chosen ? decision.chosen.action : "DO_NOTHING"} → ${actionNote}`, cycle: loop.cycle };
    } finally {
      this.ticking = false;
    }
  }

  private async execute(g: Goal, world: WorldModel): Promise<string> {
    switch (g.action) {
      case "REPAIR_INFRA": return actRepairInfra(g);
      case "MITIGATE_RISK": return actMitigateRisk(g);
      case "VERIFY_UNKNOWN": return actVerifyUnknown(g);
      case "SPAWN_AGENT": {
        const res = await spawnChild({
          role: String(g.params.role ?? "observer"),
          kind: "temporary",
          purpose: "observasi berkala atas permintaan goal engine",
          intervalMs: 8_000,
          maxCycles: 40,
        });
        const loop = readLoop(); if (res.ok) loop.stats.spawns += 1; writeLoop(loop);
        return res.note;
      }
      case "REAP_AGENTS": {
        const { reaped, merged } = await reapDead();
        return `reap=${reaped.length} merge=${merged.length}`;
      }
      case "MUTATE": {
        const levels = ["L1_PARAMETER", "L2_STRATEGY", "L3_WORKFLOW"] as const;
        const { record, result } = await runMutation(levels[Math.floor(Math.random() * levels.length)]);
        const loop = readLoop(); loop.stats.mutations += 1; writeLoop(loop);
        return `mutasi ${record.id} ${record.level} → ${result.verdict}`;
      }
      case "SELF_REPORT": return actSelfReport(g, world);
      case "ACQUIRE_CAPABILITY": return actAcquireCapability(g);
      default: return `action '${g.action}' tidak dikenal protocol — ditolak jujur`;
    }
  }

  // ── kontrol operator (PAUSE/KILL/LOCK — tanpa workflow approval) ──

  pause(reason = "operator"): string { setPhase("PAUSED", reason); return "PAUSED"; }
  resume(reason = "operator"): string { setPhase("RUNNING", reason); return "RUNNING"; }
  lock(reason = "operator"): string { setPhase("LOCKED", reason); return "LOCKED"; }
  unlock(): string { setPhase("PAUSED", "unlock → PAUSED (operator yang resume)"); return "PAUSED"; }
  kill(): string {
    try { fs.writeFileSync(path.join(ORG_ROOT, "KILL_SWITCH"), "KILL\n", "utf8"); } catch { /* noop */ }
    setPhase("KILLED", "operator kill — kill switch ditulis");
    return "KILLED";
  }
  unkill(): string {
    try { fs.rmSync(path.join(ORG_ROOT, "KILL_SWITCH"), { force: true }); } catch { /* noop */ }
    setPhase("PAUSED", "kill switch dihapus → PAUSED");
    return "KILL_SWITCH_CLEARED";
  }

  async childrenOps(action: string, id?: string): Promise<string> {
    if (action === "spawn") {
      const res = await spawnChild({ role: id ?? "observer", kind: "temporary", purpose: "spawn manual via operator", maxCycles: 40 });
      return res.note;
    }
    if (!id) return "butuh id child";
    if (action === "kill") return (await killChild(id, "KILL")).note;
    if (action === "archive") return (await killChild(id, "ARCHIVE")).note;
    if (action === "reap") { const r = await reapDead(); return `reaped=${r.reaped.length} merged=${r.merged.length}`; }
    return `action child '${action}' tak dikenal`;
  }

  async mutate(level: "L1_PARAMETER" | "L2_STRATEGY" | "L3_WORKFLOW" | "L4_CAPABILITY" | "L5_ORGANIZATION", hypothesis: string): Promise<string> {
    const { record, result } = await runMutation(level, hypothesis);
    if (result.adopted && level === "L5_ORGANIZATION") {
      const loop = readLoop(); loop.stats.spawns += 1; writeLoop(loop);
    }
    const loop = readLoop(); loop.stats.mutations += 1; writeLoop(loop);
    return `${record.id} ${level} → ${result.verdict}${result.benchmark ? ` (A=${result.benchmark.aMs}ms B=${result.benchmark.bMs}ms)` : ""}`;
  }

  rollback(id: string): string {
    const r = rollbackMutation(id);
    return `${id} → ${r.note}`;
  }

  async acquire(capabilityId: string): Promise<string> {
    const r = await acquireCapability(capabilityId);
    return `${capabilityId} [${r.how}] ${r.note}`;
  }

  getState(): OrganismState {
    const { dna } = loadOrBirthDNA();
    const children = refreshChildren();
    return {
      dna,
      loop: readLoop(),
      world: readJson<WorldModel | null>(FILES.world, null as unknown as WorldModel) ?? ({} as WorldModel),
      goals: readJson(FILES.goals, [] as Goal[]),
      decision: readJson(FILES.decision, null as unknown as OrganismState["decision"]),
      memory: recall(30),
      capabilities: readJson(FILES.capabilities, []),
      gaps: readJson(FILES.gaps, []),
      mutations: listMutations().slice(-12).reverse(),
      children,
      immuneEvents: readJson(FILES.immuneEvents, []),
      llm: { mode: "HEURISTIC", baseUrl: "", model: "heuristic-v1", keySet: false }, // diisi ulang oleh route (async)
    };
  }
}
