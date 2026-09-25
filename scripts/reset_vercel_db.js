#!/usr/bin/env node
/** Bersihkan SEMUA entri DATABASE_URL di Vercel lalu tulis satu nilai bersih (aws-1 pooler). */
const fs = require("fs");

function cred(n) {
  const l = fs.readFileSync("/home/z/.gitcreds", "utf8").split("\n").find((x) => x.startsWith(n + "="));
  let v = l ? l.slice(n.length + 1).trim() : "";
  if (v.startsWith(String.fromCharCode(34)) && v.endsWith(String.fromCharCode(34))) v = v.slice(1, -1);
  return v;
}
const TOKEN = () => cred("VERCEL_TOKEN");
const PID = "prj_3oDtkLLoKY9wPAMfmhoZcerZVSUY";
const REF = "jcdjwprehfgtaswqletb";
const POOLER = "aws-1-ap-southeast-1.pooler.supabase.com";

const old = new URL(cred("SB_DB_URL"));
const dbUrl = `postgresql://postgres.${REF}:${encodeURIComponent(decodeURIComponent(old.password))}@${POOLER}:6543/postgres?pgbouncer=true&connection_limit=1&connect_timeout=20`;

async function main() {
  // 1) daftar entri
  const r1 = await fetch(`https://api.vercel.com/v9/projects/${PID}/env`, { headers: { Authorization: `Bearer ${TOKEN()}` } });
  const j1 = await r1.json();
  const entries = (j1.envs || []).filter((e) => /^DATABASE_URL$/.test(e.key) || e.key === "SB_DATABASE_URL");
  console.log("entri DATABASE_URL ditemukan:", entries.length);
  // 2) hapus semua
  for (const e of entries) {
    const rd = await fetch(`https://api.vercel.com/v9/projects/${PID}/env/${e.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${TOKEN()}` } });
    console.log("hapus", e.id.slice(0, 8), (e.target || []).join(","), "->", rd.status);
  }
  // 3) tulis satu entri bersih
  const r3 = await fetch(`https://api.vercel.com/v10/projects/${PID}/env?upsert=false`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key: "SB_DATABASE_URL", value: dbUrl, target: ["production", "preview", "development"], type: "encrypted" }),
  });
  const j3 = await r3.json().catch(() => ({}));
  console.log("tulis baru:", r3.status, j3.error ? j3.error.message : "OK");
}
main();
