// CIVITAS OS — filegraph.mjs (SLICE 10)
// Indeks SEMUA file proyek (mandat #12): daftar + graph dependensi (import/resolved)
// -> docs/data/filegraph.json (untuk UI) + docs/FILE_INDEX.md (dokumen).
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, relative, dirname } from "path";

const ROOT = "/home/z/my-project";
const SCAN_DIRS = ["src", "scripts", "prisma", "docs", "mc-server/pmmp/plugins", "tests"];
const IGNORE = [/node_modules/, /\.next/, /tool-results/, /download\//, /upload\//, /skills\//, /upstream\//, /\.git/, /agent-ctx/];
const EXT = /\.(ts|tsx|js|mjs|php|prisma|md|json|yml|yaml|sh|css|properties)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    try {
      const st = statSync(p);
      if (st.isDirectory()) {
        if (IGNORE.some((r) => r.test(p))) continue;
        walk(p, out);
      } else if (EXT.test(name) && st.size < 400_000) {
        out.push({ path: relative(ROOT, p).replaceAll("\\", "/"), size: st.size });
      }
    } catch { /* unreadable */ }
  }
  return out;
}

const files = [];
for (const d of SCAN_DIRS) {
  const abs = join(ROOT, d);
  if (existsSync(abs)) walk(abs, files);
}
files.push({ path: "package.json", size: statSync(join(ROOT, "package.json")).size });
files.push({ path: "README.md", size: statSync(join(ROOT, "README.md")).size });

// Graph: resolve import '@/' & relative untuk TS/JS
const edges = [];
const nodes = files.map((f) => ({ id: f.path, size: f.size, group: groupOf(f.path), loc: 0 }));
const byPath = new Map(files.map((f) => [f.path, f]));

function groupOf(p) {
  if (p.startsWith("src/app/api/")) return "api";
  if (p.startsWith("src/app/")) return "app";
  if (p.startsWith("src/components/civitas/")) return "ui-civitas";
  if (p.startsWith("src/components/")) return "ui";
  if (p.startsWith("src/lib/civos/")) return "kernel";
  if (p.startsWith("src/lib/")) return "lib";
  if (p.startsWith("scripts/")) return "scripts";
  if (p.startsWith("docs/")) return "docs";
  if (p.startsWith("prisma/")) return "db";
  if (p.includes("mc-server/")) return "mc-server";
  return "misc";
}

for (const f of files) {
  if (!/\.(ts|tsx|mjs|js|php)$/.test(f.path)) continue;
  let src;
  try { src = readFileSync(join(ROOT, f.path), "utf8"); } catch { continue; }
  nodes.find((n) => n.id === f.path).loc = src.split("\n").length;
  if (f.path.endsWith(".php")) {
    for (const m of src.matchAll(/use (civitas\\bridge\\[A-Za-z]+)/g)) {
      const target = "mc-server/pmmp/plugins/CivitasBridge/src/civitas/bridge/" + m[1].split("\\")[2] + ".php";
      if (byPath.has(target) && target !== f.path) edges.push({ from: f.path, to: target, kind: "import" });
    }
    continue;
  }
  for (const m of src.matchAll(/(?:import|export)[^"';]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(["']([^"']+)["']\)/g)) {
    const spec = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (!spec) continue;
    let target = null;
    if (spec.startsWith("@/")) {
      target = "src" + spec.slice(1) + (/\.(ts|tsx|css)$/.test(spec) ? "" : ".ts");
    } else if (spec.startsWith("./") || spec.startsWith("../")) {
      const base = join(dirname(join(ROOT, f.path)), spec).replace(ROOT + "/", "");
      target = normalizeExt(base);
    }
    if (!target) continue;
    const resolved = resolvePath(target);
    if (resolved && resolved !== f.path) edges.push({ from: f.path, to: resolved, kind: "import" });
  }
}

function normalizeExt(base) {
  for (const e of ["", ".ts", ".tsx", "/index.ts", "/route.ts", ".mjs", ".js"]) {
    if (byPath.has(base + e)) return base + e;
  }
  return null;
}
function resolvePath(t) {
  if (byPath.has(t)) return t;
  const alt = normalizeExt(t.replace(/\.(ts|tsx)$/, ""));
  return alt ?? (byPath.has(t) ? t : null);
}

// Ringkasan wiring kernel
const kernelEdges = edges.filter((e) => e.from.includes("civos") && e.to.includes("civos"));
const json = { generatedAt: new Date().toISOString(), root: "civitas-os", counts: { files: files.length, edges: edges.length, kernelEdges: kernelEdges.length }, groups: {}, nodes, edges };
for (const n of nodes) json.groups[n.group] = (json.groups[n.group] ?? 0) + 1;
mkdirSync(join(ROOT, "docs/data"), { recursive: true });
writeFileSync(join(ROOT, "docs/data/filegraph.json"), JSON.stringify(json, null, 1));

// FILE_INDEX.md
const lines = [
  "# FILE INDEX — CIVITAS OS",
  "",
  `Dibuat otomatis oleh \`scripts/filegraph.mjs\` pada ${json.generatedAt}. **${files.length} file**, **${edges.length} sambungan**.`,
  "",
  "| Grup | Jumlah |", "|---|---|",
  ...Object.entries(json.groups).map(([g, c]) => `| ${g} | ${c} |`),
  "",
  "## Daftar file",
  "",
  "| File | Grup | LOC |", "|---|---|---|",
  ...nodes.sort((a, b) => a.id.localeCompare(b.id)).map((n) => `| ${n.id} | ${n.group} | ${n.loc} |`),
  "",
  "## Sambungan terpadat (module wiring)",
  "",
  "| Dari | Ke |", "|---|---|",
  ...edges.slice(0, 200).map((e) => `| ${e.from} | ${e.to} |`),
];
writeFileSync(join(ROOT, "docs/FILE_INDEX.md"), lines.join("\n"));
console.log(`filegraph: ${files.length} file, ${edges.length} edges -> docs/data/filegraph.json + docs/FILE_INDEX.md`);
