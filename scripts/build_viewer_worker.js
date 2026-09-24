#!/usr/bin/env node
// Rebuild worker.js prismarine-viewer dengan data slim + prune aset public/mc.
const fs = require("fs");
const path = require("path");
const webpack = require("webpack");

const PV = "/home/z/my-project/node_modules/prismarine-viewer";
const OUT = "/home/z/my-project/public/mc";

let cfgs = require(path.join(PV, "webpack.config.js"));
if (!Array.isArray(cfgs)) cfgs = [cfgs];
const workerCfg = cfgs.find((c) => JSON.stringify(c.entry).includes("worker"));
if (!workerCfg) { console.error("workerConfig tidak ditemukan"); process.exit(1); }

const slim = { ...workerCfg, context: PV, mode: "production", devtool: false, cache: false, optimization: { minimize: false }, performance: { hints: false } };

webpack(slim, (err, stats) => {
  if (err) { console.error("FATAL:", err.message); process.exit(1); }
  if (stats.hasErrors()) {
    const j = stats.toJson({ errors: true });
    for (const e of (j.errors || []).slice(0, 4)) console.error("ERR:", String(e.message || e).slice(0, 300));
    process.exit(1);
  }
  const w = path.join(PV, "public/worker.js");
  const size = fs.statSync(w).size;
  console.log("worker.js baru:", (size / 1e6).toFixed(1), "MB");
  fs.copyFileSync(w, path.join(OUT, "worker.js"));

  // ---- PRUNE aset per-versi (simpan 1.21.1 + 1.20.4) ----
  const KEEP_VERS = new Set(["1.21.1", "1.20.4"]);
  const keepTop = new Set(["index.html", "index.js", "worker.js", "config.json", "styles.css", "manifest.json", "invsprite.png", "mojangles.ttf", "favicon.png"]);
  let removed = 0, freed = 0;
  const rm = (p) => { const s = fs.statSync(p); freed += s.size; removed++; fs.rmSync(p, { recursive: true, force: true }); };

  for (const f of fs.readdirSync(OUT)) {
    const p = path.join(OUT, f);
    const st = fs.statSync(p);
    if (f === "textures") {
      for (const t of fs.readdirSync(p)) {
        const tp = path.join(p, t);
        const base = t.replace(/\.(png|json)$/, "");
        const isDir = fs.statSync(tp).isDirectory();
        if (!isDir && !KEEP_VERS.has(base)) rm(tp);
        else if (isDir && !KEEP_VERS.has(t)) rm(tp);
      }
      continue;
    }
    if (f === "blocksStates") {
      for (const b of fs.readdirSync(p)) {
        const base = b.replace(/\.json$/, "");
        if (!KEEP_VERS.has(base)) rm(path.join(p, b));
      }
      continue;
    }
    if (f === "extra-textures") continue; // panorama + background — dipakai layar judul
    if (!keepTop.has(f)) rm(p);
  }
  let total = 0;
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p); if (st.isDirectory()) walk(p); else total += st.size; } };
  walk(OUT);
  console.log(`prune: ${removed} item dibuang, hemat ${(freed / 1e6).toFixed(0)} MB | TOTAL public/mc: ${(total / 1e6).toFixed(1)} MB`);
});
