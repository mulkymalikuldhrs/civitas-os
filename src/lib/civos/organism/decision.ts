// ORGANISM · decision.ts — Decision Engine.
// "DO NOTHING" adalah keputusan sah (mandat #9). Organisme membandingkan
// skor goal terbaik dengan skor do-nothing (dari bias genome + energi
// tersisa) — reasoning selalu jujur dan bisa diaudit.

import type { Decision, Goal, OrganismGenome, WorldModel } from "./types";

export function decide(cycle: number, goals: Goal[], genome: OrganismGenome, world: WorldModel): Decision {
  const top = goals[0] ?? null;
  // do-nothing bernilai tinggi saat: bias tinggi, dunia sehat, energi rendah
  const healthyAreas = Object.values(world.infrastructure).filter((a) => a.health >= 80).length;
  const totalAreas = Math.max(1, Object.keys(world.infrastructure).length);
  const wellness = healthyAreas / totalAreas; // 0..1
  const energy = Math.min(1, world.resources.freememMb / Math.max(1, world.resources.totalmemMb));
  const doNothingScore = genome.workflow.doNothingBias * 8 + wellness * 3 + energy * 2;

  const topScore = top ? (top.score ?? score(top, genome)) : -Infinity;
  if (!top || topScore <= doNothingScore) {
    return {
      at: new Date().toISOString(), cycle, chosen: null,
      reasoning: `DO NOTHING: skor goal terbaik ${topScore.toFixed(2)} ≤ doNothing ${doNothingScore.toFixed(2)} (bias=${genome.workflow.doNothingBias}, wellness=${wellness.toFixed(2)}, energy=${energy.toFixed(2)})`,
      doNothingScore: Number(doNothingScore.toFixed(2)),
    };
  }
  const riskNote = top.risk >= 3 ? " (risiko tinggi — imun siaga)" : "";
  return {
    at: new Date().toISOString(), cycle, chosen: top,
    reasoning: `PILIH '${top.title}' skor ${topScore.toFixed(2)} > doNothing ${doNothingScore.toFixed(2)}${riskNote}`,
    doNothingScore: Number(doNothingScore.toFixed(2)),
  };
}

function score(g: Goal, genome: OrganismGenome): number {
  // fallback bila belum dinilai generateGoals
  const w = genome.weights;
  return g.reward * w.reward + g.strategic * w.strategic + g.feasibility * w.feasibility - g.cost * w.costPenalty - g.risk * w.riskPenalty;
}
