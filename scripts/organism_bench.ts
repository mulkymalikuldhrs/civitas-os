// organism_bench.ts — BENCHMARK A/B untuk Mutation Engine.
// Dijalankan OLEH mutation.ts DI DALAM git worktree sandbox:
//   bun scripts/organism_bench.ts .civitas/organism/dna.candidate.json
// A = genome default bawaan, B = kandidat dari file patch penuh.
// Output: SATU baris JSON (baris terakhir) → diparse mutation.ts.
// Kegagalan apapun = keluar dengan error di stderr (mutation.ts menangkap).

import { DEFAULT_GENOME } from "../src/lib/civos/organism/dna";
import { scoreGoal } from "../src/lib/civos/organism/goals";
import type { Goal, OrganismGenome } from "../src/lib/civos/organism/types";
import crypto from "node:crypto";
import fs from "node:fs";

function syntheticGoals(n: number): Goal[] {
  // dataset sintetis deterministik — pengukuran adil A vs B
  const goals: Goal[] = [];
  for (let i = 0; i < n; i++) {
    const r = mulberry(i * 2654435761);
    goals.push({
      id: `syn_${i}`,
      area: ["infrastructure", "knowledge", "organization", "evolution", "risk", "report"][Math.floor(r() * 6)],
      title: `synthetic goal ${i}`,
      action: "NOOP_BENCH",
      params: {},
      reward: r() * 10, strategic: r() * 10, feasibility: r() * 10,
      cost: r() * 8, risk: r() * 8, novelty: r() * 10,
    });
  }
  return goals;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isValidScores(goals: Goal[], genome: OrganismGenome): { ok: boolean; hash: string; ms: number } {
  const t0 = performance.now();
  let ok = true;
  const scores: number[] = [];
  // iterasi berulang agar perbedaan kecil terukur (kernel scoring murni)
  for (let rep = 0; rep < 400; rep++) {
    for (const g of goals) {
      const s = scoreGoal(g, genome);
      if (!Number.isFinite(s)) ok = false;
      scores.push(s);
    }
  }
  const ms = performance.now() - t0;
  const hash = crypto.createHash("sha256").update(scores.slice(0, 5000).map((v) => v.toFixed(3)).join(",")).digest("hex").slice(0, 16);
  return { ok, hash, ms: Number(ms.toFixed(1)) };
}

async function main(): Promise<void> {
  const candidateRel = process.argv[2];
  const goals = syntheticGoals(120);
  const a = isValidScores(goals, DEFAULT_GENOME);

  let bGenome: OrganismGenome = DEFAULT_GENOME;
  if (candidateRel) {
    bGenome = JSON.parse(fs.readFileSync(candidateRel, "utf8")) as OrganismGenome;
    // guard: candidate harus punya semua field weights
    if (!bGenome?.weights || !bGenome?.workflow) throw new Error("candidate genome tidak lengkap");
  }
  const b = isValidScores(goals, bGenome);

  process.stdout.write(JSON.stringify({
    aMs: a.ms, bMs: b.ms, aValid: a.ok, bValid: b.ok,
    aOutputHash: a.hash, bOutputHash: b.hash,
    equivalent: a.hash === b.hash,
    goals: goals.length, reps: 400,
  }) + "\n");
}

main().catch((e) => { console.error("bench error:", e); process.exit(1); });
