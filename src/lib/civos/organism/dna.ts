// ORGANISM · dna.ts — Identity DNA.
// core = immutable (lifecycle hanya melalui lahir/pause/kill), genome/immune
// = file hidup. Lahir sekali; kalau file dna.json hilang, lahir ulang dengan
// id baru (jujur — bukan "lanjutan palsu").

import crypto from "node:crypto";
import fs from "node:fs";
import { FILES, KILL_SWITCH, ensureDirs, readJson, writeJson } from "./store";
import type { ImmuneLimits, OrganismDNA, OrganismGenome } from "./types";

export const DEFAULT_GENOME: OrganismGenome = {
  weights: { reward: 1.0, strategic: 0.8, feasibility: 0.6, costPenalty: 0.5, riskPenalty: 0.9, novelty: 0.2 },
  strategy: "balanced-growth",
  workflow: {
    intervalMs: 60_000,
    maxGoalsPerCycle: 5,
    doNothingBias: 0.35,
    steps: ["observe", "decide", "act", "evaluate", "reflect"],
  },
  tools: ["envprobe", "reposcan", "mutation", "spawner", "capability", "llm"],
  agentComposition: [{ role: "observer", count: 1 }],
};

export const DEFAULT_IMMUNE: ImmuneLimits = {
  timeoutMs: 30_000,
  maxRecursion: 3,
  maxRetries: 2,
  maxMemoryMb: 1024,
  maxMemoryEntries: 500,
  networkAllowlist: ["127.0.0.1", "localhost", "mulkymalikuldhr.aternos.me", "api.binance.com"],
  networkTimeoutMs: 8_000,
  toolPermissions: {
    envprobe: true, reposcan: true, mutation: true, spawner: true,
    capability: true, llm: true, server_action: false, git_push: false,
  },
};

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}

/** Lahirkan DNA root (atau anak dengan parent+kind). */
export function birthDNA(opts: { name: string; purpose: string; kind?: OrganismDNA["core"]["kind"]; parent?: string }): OrganismDNA {
  const kind = opts.kind ?? "root";
  return {
    core: {
      id: newId(kind === "root" ? "org" : "cell"),
      name: opts.name,
      kind,
      bornAt: new Date().toISOString(),
      parent: opts.parent,
      purpose: opts.purpose,
      hardConstraints: [
        "Tidak pernah mengaku DONE tanpa bukti eksekusi nyata.",
        "Semua aksi melewati limit imun deklaratif — tanpa pengecualian.",
        "Kegagalan adalah data: catat hypothesis/result/reason/cost/lesson.",
        "Free-first: jangan pakai resource berbayar bila ada jalur gratis.",
        "Ketidaktahuan adalah state first-class — jangan sembunyikan.",
      ],
      killSwitchPath: KILL_SWITCH,
    },
    genome: structuredClone(DEFAULT_GENOME),
    immune: structuredClone(DEFAULT_IMMUNE),
    permissions: { fsRead: true, fsWrite: true, exec: true, network: true, spawn: true },
  };
}

export function loadOrBirthDNA(): { dna: OrganismDNA; newborn: boolean } {
  ensureDirs();
  const existing = readJson<OrganismDNA | null>(FILES.dna, null);
  if (existing && existing.core?.id && existing.genome && existing.immune) {
    return { dna: existing, newborn: false };
  }
  const dna = birthDNA({
    name: "CIVITAS-PRIME",
    purpose: "Menjaga peradaban Minecraft hidup: amati dunia, rawat infrastruktur, kawal ekonomi, berevolusi lewat bukti.",
    kind: "root",
  });
  writeJson(FILES.dna, dna);
  return { dna, newborn: true };
}

export function saveDNA(dna: OrganismDNA): void {
  writeJson(FILES.dna, dna);
}

/** Genome hash — deteksi apakah genome berubah di luar mutation engine. */
export function genomeHash(dna: OrganismDNA): string {
  return crypto.createHash("sha256").update(JSON.stringify(dna.genome)).digest("hex").slice(0, 12);
}

/** Kill switch dibaca nyata dari disk setiap siklus. */
export function killSwitchActive(): string | null {
  try {
    const raw = fs.readFileSync(KILL_SWITCH, "utf8").trim().toUpperCase();
    if (raw.includes("KILL")) return raw;
    return null;
  } catch {
    return null;
  }
}
