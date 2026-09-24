// ORGANISM · goals.ts — Dynamic Goal Engine.
// TIDAK ADA daftar tugas permanen. Goal lahir dari DELTA world model
// (health turun, unknown terverifikasi-able, populasi tidak seimbang,
// stagnasi mutasi...). Semua estimasi memakai bobot dari GENOME — jadi
// mengubah genome mengubah cara organisme menilai dunia (bukan hardcode).

import crypto from "node:crypto";
import type { Goal, OrganismGenome, WorldModel } from "./types";

export function scoreGoal(g: Goal, genome: OrganismGenome): number {
  const w = genome.weights;
  return (
    g.reward * w.reward +
    g.strategic * w.strategic +
    g.feasibility * w.feasibility +
    g.novelty * w.novelty -
    g.cost * w.costPenalty -
    g.risk * w.riskPenalty
  );
}

/** Strategi registry — pilihan cara menilai dunia (evolusi L2 bisa ganti ini). */
export const STRATEGIES: Record<string, { note: string; tilt: (g: Goal) => void }> = {
  "balanced-growth": { note: "seimbang: jaga infra + evolusi", tilt: () => {} },
  "guardian": { note: "prioritas kesehatan infrastruktur & imun", tilt: (g) => { if (g.area === "infrastructure") g.strategic += 2; } },
  "explorer": { note: "prioritas capability baru & eksperimen", tilt: (g) => { if (g.area === "capability" || g.area === "evolution") g.novelty += 2; } },
  "economist": { note: "prioritas biaya rendah & nilai tinggi", tilt: (g) => { g.cost = Math.max(0, g.cost - 1); } },
};

export function generateGoals(world: WorldModel, genome: OrganismGenome): Goal[] {
  const goals: Goal[] = [];
  const push = (g: Omit<Goal, "id">): void => {
    goals.push({ id: `goal_${crypto.randomBytes(3).toString("hex")}`, ...g });
  };

  // 1. Infrastruktur sakit → perbaiki (nyata: aksi diarahkan ke area bermasalah)
  for (const [name, area] of Object.entries(world.infrastructure)) {
    if (area.health < 50) {
      push({
        area: "infrastructure", title: `Periksa & pulihkan ${name} (health=${Math.round(area.health)})`,
        action: "REPAIR_INFRA", params: { target: name },
        reward: 6, strategic: 6, feasibility: name === "mc_bedrock" ? 3 : 6, cost: 3, risk: 2, novelty: 0,
        requiredCapabilities: ["probe.env"],
      });
    }
  }

  // 2. Risiko HIGH → mitigasi
  for (const r of world.risks.filter((r) => r.level === "HIGH")) {
    push({
      area: "risk", title: `Mitigasi risiko ${r.key}: ${r.note}`,
      action: "MITIGATE_RISK", params: { risk: r.key },
      reward: 5, strategic: 6, feasibility: 5, cost: 2, risk: 1, novelty: 0,
      requiredCapabilities: ["probe.env"],
    });
  }

  // 3. Unknown yang punya probe → verifikasi (ketidaktahuan menyusut)
  for (const u of world.epistemic.unknown.filter((u) => u.probe)) {
    push({
      area: "knowledge", title: `Verifikasi unknown: ${u.key}`,
      action: "VERIFY_UNKNOWN", params: { key: u.key, probe: u.probe as string },
      reward: 4, strategic: 5, feasibility: 6, cost: 2, risk: 1, novelty: 2,
      requiredCapabilities: [u.probe as string],
    });
  }

  // 4. Populasi agent tidak sesuai genome → rebalance (L5)
  const desired = genome.agentComposition.reduce((s, a) => s + a.count, 0);
  const alive = world.agents.filter((a) => a.alive && a.kind !== "root").length;
  if (alive < desired) {
    push({
      area: "organization", title: `Spawn agent (${alive}/${desired} hidup, komposisi genome: ${genome.agentComposition.map((a) => `${a.role}×${a.count}`).join(",")})`,
      action: "SPAWN_AGENT", params: { role: genome.agentComposition[0]?.role ?? "observer" },
      reward: 4, strategic: 5, feasibility: 7, cost: 3, risk: 2, novelty: 2,
      requiredCapabilities: ["spawn.child"],
    });
  } else if (alive > desired) {
    push({
      area: "organization", title: `Populasi kelebihan (${alive} > ${desired}) — arsip/merge organ`,
      action: "REAP_AGENTS", params: {},
      reward: 3, strategic: 4, feasibility: 7, cost: 2, risk: 2, novelty: 1,
      requiredCapabilities: ["spawn.child"],
    });
  }

  // 5. Stagnasi eksperimen → mutasi diri (L1-L3)
  const recent = world.experiments.length;
  const pending = world.experiments.filter((e) => e.status === "PROPOSED" || e.status === "SANDBOXED").length;
  if (recent === 0) {
    push({
      area: "evolution", title: "Evolusi stagnan — usulkan mutasi A/B genome",
      action: "MUTATE", params: {},
      reward: 5, strategic: 6, feasibility: 6, cost: 4, risk: 2, novelty: 4,
      requiredCapabilities: ["mutation.sandbox"],
    });
  } else if (pending > 0) {
    push({
      area: "evolution", title: `Selesaikan ${pending} eksperimen menggantung (sandbox/benchmark)`,
      action: "MUTATE", params: {},
      reward: 4, strategic: 5, feasibility: 7, cost: 3, risk: 2, novelty: 3,
      requiredCapabilities: ["mutation.sandbox"],
    });
  }

  // 6. Knowledge tumbuh → laporkan (heuristic LLM, gratis)
  push({
    area: "report", title: "Tulis laporan keadaan diri (self-report)",
    action: "SELF_REPORT", params: {},
    reward: 2, strategic: 3, feasibility: 8, cost: 1, risk: 0, novelty: 0,
    requiredCapabilities: ["llm.brain"],
  });

  // 7. Unknown tanpa probe → bangun capability (L4)
  const caps = new Set<string>();
  // capability registry dibaca lewat parameter? — sederhana: dari world.experiments tidak cukup;
  // goal ACQUIRE_CAPABILITY digenerate di loop yang punya akses registry. Di sini:
  for (const u of world.epistemic.unknown.filter((u) => !u.probe).slice(0, 1)) {
    push({
      area: "capability", title: `Rencanakan capability untuk menguji ${u.key}`,
      action: "ACQUIRE_CAPABILITY", params: { key: u.key },
      reward: 4, strategic: 6, feasibility: 4, cost: 5, risk: 3, novelty: 4,
    });
  }

  // strategi aktif boleh menilai ulang (L2) lalu skor akhir pakai genome
  const strategy = STRATEGIES[genome.strategy] ?? STRATEGIES["balanced-growth"];
  for (const g of goals) {
    strategy.tilt(g);
    g.score = scoreGoal(g, genome);
  }
  return goals.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
