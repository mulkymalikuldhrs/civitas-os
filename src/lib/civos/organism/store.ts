// ORGANISM · store.ts — persistence file-based di .civitas/organism/
// Memory interface fondasi (di-hardcode sesuai konstitusi) — organisme
// membaca/menulis state dunianya di sini. Persisten, tanpa mock.

import fs from "node:fs";
import path from "node:path";

export const ORG_ROOT = path.join(process.cwd(), ".civitas", "organism");
export const SANDBOX_ROOT = path.join(process.cwd(), ".civitas-sandbox");
export const CHILDREN_DIR = path.join(ORG_ROOT, "children");
export const KILL_SWITCH = path.join(ORG_ROOT, "KILL_SWITCH");
export const CAPABILITIES_DIR = path.join(ORG_ROOT, "capabilities");

export function ensureDirs(): void {
  for (const d of [ORG_ROOT, SANDBOX_ROOT, CHILDREN_DIR, CAPABILITIES_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(file: string, data: unknown): void {
  ensureDirs();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

/** Append-only event log (jsonl) dengan cap ukuran — jejak audit jujur. */
export function appendJsonl(file: string, entry: unknown, capLines = 4000): void {
  ensureDirs();
  fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    const lines = raw ? raw.split("\n") : [];
    if (lines.length > capLines) {
      fs.writeFileSync(file, lines.slice(-Math.floor(capLines / 2)).join("\n") + "\n", "utf8");
    }
  } catch {
    /* cap gagal = tidak fatal */
  }
}

export const FILES = {
  dna: path.join(ORG_ROOT, "dna.json"),
  loop: path.join(ORG_ROOT, "loop.json"),
  world: path.join(ORG_ROOT, "world.json"),
  goals: path.join(ORG_ROOT, "goals.json"),
  decision: path.join(ORG_ROOT, "decision.json"),
  memory: path.join(ORG_ROOT, "memory.json"),
  capabilities: path.join(ORG_ROOT, "capabilities.json"),
  gaps: path.join(ORG_ROOT, "gaps.json"),
  mutations: path.join(ORG_ROOT, "mutations.json"),
  children: path.join(ORG_ROOT, "children.json"),
  immuneEvents: path.join(ORG_ROOT, "immune.json"),
  eventsLog: path.join(ORG_ROOT, "events.jsonl"),
};
