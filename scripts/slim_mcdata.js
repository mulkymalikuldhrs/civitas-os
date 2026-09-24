#!/usr/bin/env node
// Regenerasi data.js minecraft-data: hanya versi pc tertentu (hemat memori build).
// Sumber: data.js.orig (backup asli). Idempoten.
const fs = require("fs");
const path = require("path");

const D = "/home/z/my-project/node_modules/minecraft-data/data.js";
const ORIG = D + ".orig";
const KEEP = ["1.21.1", "1.20.4"];

if (!fs.existsSync(ORIG)) {
  fs.copyFileSync(D, ORIG);
  console.log("backup dibuat: data.js.orig");
}

// bersihkan cache agar load .orig (bukan slim sebelumnya)
const orig = require(ORIG);
const pc = orig.pc || {};
let body = "";
for (const ver of KEEP) {
  if (!pc[ver]) { console.error("versi tidak ada di data asli:", ver); process.exit(1); }
  const props = [];
  const src = Object.getOwnPropertyNames(pc[ver]);
  for (const key of src) {
    const desc = Object.getOwnPropertyDescriptor(pc[ver], key);
    if (desc.get) {
      // getter: temukan jalur require asli dari toString getter
      const fn = String(desc.get);
      const m = fn.match(/require\("([^"]+)"\)/);
      if (!m) { console.error("getter tanpa require:", ver, key); process.exit(1); }
      props.push(`      get ${key} () { return require(${JSON.stringify(m[1])}) }`);
    } else if (key === "proto") {
      props.push(`      proto: __dirname + ${JSON.stringify(desc.value.slice(desc.value.indexOf("/minecraft-data")))}`);
    } else {
      props.push(`      ${key}: ${JSON.stringify(desc.value)}`);
    }
  }
  body += `    ${JSON.stringify(ver)}: {\n${props.join(",\n")}\n    },\n`;
}
const out = "//patched + slimmed by CIVITAS OS (hanya versi yang dipakai klien web)\nmodule.exports =\n{\n  'pc': {\n" + body + "  },\n}\n";
fs.writeFileSync(D, out);
// verifikasi
delete require.cache[require.resolve(D)];
const chk = require(D);
const ok = KEEP.every((v) => chk.pc[v] && typeof chk.pc[v].protocol === "object" && typeof chk.pc[v].blocks === "object");
console.log("versions:", Object.keys(chk.pc).join(","), "| 1.21.1 ok:", ok, "| size:", (fs.statSync(D).size / 1024).toFixed(0) + "KB");
