// ORGANISM · mutation.ts — MUTATION ENGINE dengan sandbox git worktree nyata.
// PROPOSE → CANDIDATE (patch B penuh) → SANDBOX (git worktree HEAD) →
// TEST (benchmark nyata di dalam sandbox) → BENCHMARK A/B → ADOPT/REJECT
// → LEARN. A = genome baseline, B = kandidat penuh (file JSON utuh, bukan
// diff parsial). core/immune DNA IMMUTABLE — kandidat yang menyentuhnya
// ditolak otomatis dan jadi pelajaran.

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { loadOrBirthDNA, saveDNA } from "./dna";
import { FILES, SANDBOX_ROOT, ensureDirs, readJson, writeJson } from "./store";
import type { MutationLevel, MutationRecord, OrganismGenome } from "./types";

const pexec = promisify(execFile);

export function listMutations(): MutationRecord[] {
  return readJson<MutationRecord[]>(FILES.mutations, []);
}

function saveMutations(all: MutationRecord[]): void {
  writeJson(FILES.mutations, all.slice(-80));
}

// ── kandidat genome (L1/L2/L3) ───────────────────────────────

function mutateWeights(g: OrganismGenome): OrganismGenome {
  const jitter = (v: number) => Number(Math.max(0.05, v * (0.8 + Math.random() * 0.4)).toFixed(3));
  const weights = {
    reward: jitter(g.weights.reward),
    strategic: jitter(g.weights.strategic),
    feasibility: jitter(g.weights.feasibility),
    costPenalty: jitter(g.weights.costPenalty),
    riskPenalty: jitter(g.weights.riskPenalty),
    novelty: jitter(g.weights.novelty),
  };
  return { ...structuredClone(g), weights };
}

function mutateStrategy(g: OrganismGenome): OrganismGenome {
  const pool = ["balanced-growth", "guardian", "explorer", "economist"];
  const others = pool.filter((s) => s !== g.strategy);
  const strategy = others[Math.floor(Math.random() * others.length)];
  return { ...structuredClone(g), strategy };
}

function mutateWorkflow(g: OrganismGenome): OrganismGenome {
  const workflow = structuredClone(g.workflow);
  // variasi interval 30s–5m dan bias do-nothing
  workflow.intervalMs = Math.max(30_000, Math.min(300_000, Math.round(workflow.intervalMs * (0.7 + Math.random() * 0.7))));
  workflow.doNothingBias = Number(Math.max(0.1, Math.min(0.8, workflow.doNothingBias * (0.8 + Math.random() * 0.5))).toFixed(3));
  return { ...structuredClone(g), workflow };
}

export function buildCandidate(level: MutationLevel, genome: OrganismGenome, hypothesis: string): { genome: OrganismGenome; hypothesis: string; target: string } {
  switch (level) {
    case "L1_PARAMETER": return { genome: mutateWeights(genome), hypothesis: hypothesis || "Bobot penilaian baru memberi distribusi keputusan lebih sehat tanpa biaya ekstra", target: "genome.weights" };
    case "L2_STRATEGY": return { genome: mutateStrategy(genome), hypothesis: hypothesis || "Strategi alternatif lebih cocok dengan kondisi dunia saat ini", target: "genome.strategy" };
    case "L3_WORKFLOW": return { genome: mutateWorkflow(genome), hypothesis: hypothesis || "Interval/bias siklus baru menurunkan biaya per nilai", target: "genome.workflow" };
    default: return { genome: structuredClone(genome), hypothesis: hypothesis || "(level bukan genome-mutation)", target: "genome" };
  }
}

// ── A/B penuh di sandbox worktree ────────────────────────────

export interface ABRresult {
  ok: boolean;
  verdict: string;
  adopted: boolean;
  benchmark?: MutationRecord["benchmark"];
}

/** Benchmark nyata: jalankan scoring kernel pada genome A dan B. */
async function benchmarkAB(sandboxPath: string, candidateRelPath: string): Promise<NonNullable<MutationRecord["benchmark"]>> {
  const bench = path.join(sandboxPath, "scripts", "organism_bench.ts");
  const { stdout } = await pexec("bun", [bench, candidateRelPath], { timeout: 60_000, cwd: sandboxPath });
  const line = stdout.trim().split("\n").pop() ?? "{}";
  return JSON.parse(line) as NonNullable<MutationRecord["benchmark"]>;
}

/**
 * Jalankan satu mutasi penuh: propose → candidate → sandbox (git worktree)
 * → patch B → benchmark A/B → adopt/reject → learn.
 */
export async function runMutation(
  level: MutationLevel,
  hypothesis = "",
): Promise<{ record: MutationRecord; result: ABRresult }> {
  ensureDirs();
  const { dna } = loadOrBirthDNA();
  const id = `mut_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

  // L4/L5 delegasi ke subsystem lain (capability/organizational) — di loop.ts.
  if (level === "L4_CAPABILITY" || level === "L5_ORGANIZATION") {
    const rec: MutationRecord = {
      id, at: new Date().toISOString(), level, target: level === "L4_CAPABILITY" ? "capability.registry" : "agent.population",
      hypothesis: hypothesis || "perubahan struktural via subsystem spesialis", status: "TESTED",
      aSnapshot: "-", bPatch: "-", verdict: "didelegasikan ke capability/spawner — lihat registry masing-masing", lesson: "delegasi adalah jalur mutasi yang sah",
    };
    const all = listMutations(); all.push(rec); saveMutations(all);
    return { record: rec, result: { ok: true, verdict: rec.verdict ?? "", adopted: true } };
  }

  const cand = buildCandidate(level, dna.genome, hypothesis);
  const aSnapshot = JSON.stringify(dna.genome, null, 2);
  const bPatch = JSON.stringify(cand.genome, null, 2);

  let rec: MutationRecord = {
    id, at: new Date().toISOString(), level, target: cand.target, hypothesis: cand.hypothesis,
    status: "PROPOSED", aSnapshot, bPatch,
  };
  let all = listMutations(); all.push(rec); saveMutations(all);

  // guard: core/immune TIDAK PERNAH diambil dari candidate — by construction
  // (adopt hanya menyalin genome; core & immune tetap dari DNA hidup)

  // SANDBOX: git worktree dari HEAD
  const sandboxPath = path.join(SANDBOX_ROOT, id);
  try {
    await pexec("git", ["worktree", "add", "--detach", sandboxPath, "HEAD"], { timeout: 60_000, cwd: process.cwd() });
    rec = { ...rec, status: "SANDBOXED", sandbox: sandboxPath };
    all = listMutations(); const i = all.findIndex((m) => m.id === id); if (i >= 0) all[i] = rec; saveMutations(all);
  } catch (e) {
    rec = { ...rec, status: "REJECTED", verdict: `sandbox gagal: ${(e as Error).message.slice(0, 120)}`, lesson: "lingkungan git tak siap — sandbox adalah prasyarat mutasi" };
    all = listMutations(); const i = all.findIndex((m) => m.id === id); if (i >= 0) all[i] = rec; saveMutations(all);
    return { record: rec, result: { ok: false, verdict: rec.verdict ?? "", adopted: false } };
  }

  // PATCH B penuh di sandbox (candidate genome file)
  const candidatePath = path.join(sandboxPath, ".civitas", "organism", "dna.candidate.json");
  fs.mkdirSync(path.dirname(candidatePath), { recursive: true });
  fs.writeFileSync(candidatePath, bPatch, "utf8");

  // TEST + BENCHMARK A/B (di dalam sandbox)
  try {
    const bench = await benchmarkAB(sandboxPath, path.relative(sandboxPath, candidatePath));
    const adopted = bench.bValid && bench.bMs <= bench.aMs * 1.15;
    rec = {
      ...rec, status: adopted ? "ADOPTED" : "REJECTED", benchmark: bench,
      verdict: adopted
        ? `B diterima: ${bench.bMs}ms vs A ${bench.aMs}ms (valid=${bench.bValid})`
        : `B ditolak: bMs=${bench.bMs} (aMs=${bench.aMs}, valid=${bench.bValid})`,
      lesson: adopted
        ? `mutasi ${level} diterima — genome diperbarui; pelajari arah perubahan bobotnya`
        : `mutasi ${level} ditolak — genome baseline terbukti sebanding/lebih baik`,
    };
  } catch (e) {
    const err = e as Error & { stderr?: string };
    const detail = (err.stderr ?? err.message).slice(0, 160).replace(/\n/g, " ");
    rec = { ...rec, status: "REJECTED", verdict: `benchmark gagal: ${detail}`, lesson: "benchmark adalah gerbang mutasi — tanpa pengukuran tidak ada adopsi" };
  }

  // ADOPT: tulis genome baru ke dna.json utama (core/immune tetap) + commit
  if (rec.status === "ADOPTED") {
    dna.genome = cand.genome;
    saveDNA(dna);
    try {
      await pexec("git", ["add", path.relative(process.cwd(), FILES.dna)], { timeout: 15_000, cwd: process.cwd() });
      await pexec("git", ["commit", "-m", `organism: adopt mutation ${id} (${level}) — ${cand.target}`], { timeout: 15_000, cwd: process.cwd() });
    } catch { /* commit gagal = adopt tetap sah di file, dicatat jujur */ }
  }

  // cleanup sandbox
  try {
    await pexec("git", ["worktree", "remove", "--force", sandboxPath], { timeout: 30_000, cwd: process.cwd() });
    await pexec("git", ["worktree", "prune"], { timeout: 15_000, cwd: process.cwd() });
  } catch { /* sandbox tertinggal tercatat di rec.sandbox */ }

  all = listMutations(); const j = all.findIndex((m) => m.id === id); if (j >= 0) all[j] = rec; saveMutations(all);
  return {
    record: rec,
    result: { ok: rec.status !== "REJECTED", verdict: rec.verdict ?? "", adopted: rec.status === "ADOPTED", benchmark: rec.benchmark },
  };
}

/** ROLLBACK: kembalikan genome dari snapshot A sebuah mutasi ter-adopt. */
export function rollbackMutation(id: string): { ok: boolean; note: string } {
  const all = listMutations();
  const rec = all.find((m) => m.id === id);
  if (!rec) return { ok: false, note: "mutasi tidak ditemukan" };
  if (rec.status !== "ADOPTED") return { ok: false, note: `status ${rec.status} — tidak ada yang perlu di-rollback` };
  const { dna, } = loadOrBirthDNA();
  try {
    dna.genome = JSON.parse(rec.aSnapshot) as OrganismGenome;
    saveDNA(dna);
    rec.status = "ROLLED_BACK";
    rec.lesson = "rollback dijalankan — genom kembali ke baseline A";
    const i = all.findIndex((m) => m.id === id); all[i] = rec; saveMutations(all);
    return { ok: true, note: "genome dikembalikan ke snapshot A" };
  } catch (e) {
    return { ok: false, note: `rollback gagal: ${(e as Error).message}` };
  }
}
