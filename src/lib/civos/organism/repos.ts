// ORGANISM · repos.ts — REPOSITORY TOPOLOGY (HERMES).
// Repository bukan "proyek yang diedit" — ia organ: Repository → Project →
// Subsystem → Capability → Owner. Dipindai NYATA dari filesystem supaya
// organisme tidak membangun data-engine kedua hanya karena tak tahu yang
// pertama sudah ada.

import fs from "node:fs";
import path from "node:path";
import type { OrganismPermissions } from "./types";

export interface RepoNode {
  name: string;
  path: string;
  kind: "repo" | "subsystem" | "module";
  owner: string; // agent role yang merawat (diambil dari komentar header bila ada)
  loc: number; // lines of code — ukuran organ
  mtime: string;
  children: RepoNode[];
}

const OWNER_HINTS: [RegExp, string][] = [
  [/government|government\.ts/i, "villager-government"],
  [/economy|money|ledger|market|settle|accounts/i, "villager-economy"],
  [/village|villagers|census|chat/i, "villager-social"],
  [/minecraft|mcbot|javabot|servers/i, "villager-builder"],
  [/organism|selflife|daemon|mcp|memory/i, "villager-admin"],
  [/ui|page|dashboard|component/i, "villager-content"],
];

function guessOwner(file: string, head: string): string {
  for (const [re, owner] of OWNER_HINTS) {
    if (re.test(file) || re.test(head)) return owner;
  }
  return "unassigned";
}

function scanDir(dir: string, rel: string, perms: OrganismPermissions, depth: number, maxDepth: number): RepoNode[] {
  if (!perms.fsRead || depth > maxDepth) return [];
  const out: RepoNode[] = [];
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === ".next") continue;
    const abs = path.join(dir, e.name);
    const relPath = path.join(rel, e.name);
    if (e.isDirectory()) {
      const kids = scanDir(abs, relPath, perms, depth + 1, maxDepth);
      const loc = kids.reduce((s, k) => s + k.loc, 0);
      const newest = kids.reduce((m, k) => (k.mtime > m ? k.mtime : m), new Date(0).toISOString());
      out.push({
        name: e.name, path: relPath, kind: depth === 0 ? "repo" : "subsystem",
        owner: kids[0]?.owner ?? "unassigned", loc, mtime: newest, children: kids.slice(0, 24),
      });
    } else if (/\.(ts|tsx|mjs|sh|md|prisma)$/.test(e.name)) {
      let loc = 0; let head = "";
      try {
        const raw = fs.readFileSync(abs, "utf8");
        loc = raw.split("\n").length;
        head = raw.slice(0, 400);
      } catch { loc = 0; }
      let mtime = "";
      try { mtime = fs.statSync(abs).mtime.toISOString(); } catch { mtime = new Date(0).toISOString(); }
      out.push({ name: e.name, path: relPath, kind: "module", owner: guessOwner(e.name, head), loc, mtime, children: [] });
    }
  }
  return out;
}

/** Pindai topologi repositori nyata (src + scripts, kedalaman terbatas). */
export function scanRepoTopology(root: string, perms: OrganismPermissions): {
  scannedAt: string; roots: RepoNode[]; summary: { modules: number; loc: number; unowned: number };
} {
  const roots = scanDir(root, ".", perms, 0, 3).filter((n) =>
    ["src", "scripts", "bin", "prisma"].includes(n.name),
  );
  let modules = 0, loc = 0, unowned = 0;
  const walk = (nodes: RepoNode[]): void => {
    for (const n of nodes) {
      if (n.kind === "module") { modules += 1; loc += n.loc; if (n.owner === "unassigned") unowned += 1; }
      walk(n.children);
    }
  };
  walk(roots);
  return { scannedAt: new Date().toISOString(), roots, summary: { modules, loc, unowned } };
}

/** Deteksi organ ganda: nama modul mirip → risiko dibangun dua kali. */
export function detectDuplicateOrgans(topology: { roots: RepoNode[] }): string[] {
  const names = new Map<string, number>();
  const walk = (nodes: RepoNode[]): void => {
    for (const n of nodes) {
      if (n.kind === "module") {
        const base = n.name.replace(/\.(ts|tsx|mjs|sh)$/, "").toLowerCase().replace(/[^a-z]/g, "");
        names.set(base, (names.get(base) ?? 0) + 1);
      }
      walk(n.children);
    }
  };
  walk(topology.roots);
  return [...names.entries()].filter(([, c]) => c > 1).map(([n, c]) => `${n} ×${c}`);
}
