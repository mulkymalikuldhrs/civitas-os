#!/usr/bin/env node
// Build bundle prismarine-web-client -> public/mc (CIVITAS OS v1.5)
// Konfigurasi hemat memori: tanpa minify, tanpa cache, single-thread.
const path = require("path");
const fs = require("fs");

const PWC = "/home/z/my-project/node_modules/prismarine-web-client";
const OUT = "/home/z/my-project/public/mc";

const webpack = require("webpack");
const base = require(path.join(PWC, "webpack.common.js"));

const config = {
  ...base,
  context: PWC,
  mode: "production",
  devtool: false,
  cache: false,
  optimization: { minimize: false, splitChunks: false, runtimeChunk: false },
  performance: { hints: false },
  resolve: {
    ...base.resolve,
    fallback: { ...(base.resolve && base.resolve.fallback), canvas: false, fs: false, child_process: false },
  },
  plugins: (base.plugins || []).filter(Boolean),
};

webpack(config, (err, stats) => {
  if (err) {
    console.error("FATAL:", err.message);
    process.exit(1);
  }
  if (stats.hasErrors()) {
    const j = stats.toJson({ errors: true });
    for (const e of (j.errors || []).slice(0, 5)) {
      console.error("BUILD ERROR:", String(e.message || e).slice(0, 500));
    }
    process.exit(1);
  }
  const o = stats.toJson({ assets: true });
  for (const a of (o.assets || []).slice(0, 40)) console.log("asset:", a.name, (a.size / 1e6).toFixed(2) + "MB");
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.cpSync(path.join(PWC, "public"), OUT, { recursive: true });
  // sisipkan audio guard (headless tanpa codec: decodeAudioData gagal -> jangan crash)
  const guard = fs.readFileSync("/home/z/my-project/scripts/mc_audio_guard.js", "utf8");
  const bundlePath = path.join(OUT, "index.js");
  fs.writeFileSync(bundlePath, guard + fs.readFileSync(bundlePath, "utf8"));
  let total = 0;
  const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p); else total += st.size;
    }
  };
  walk(OUT);
  console.log("COPIED -> public/mc | total", (total / 1e6).toFixed(1), "MB");
});
