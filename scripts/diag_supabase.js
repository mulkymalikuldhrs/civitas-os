#!/usr/bin/env node
// Diagnostik Supabase: OpenAPI root vs tabel konkret vs Management API (tanpa bocor nilai).
const fs = require("fs");

function cred(name) {
  const line = fs.readFileSync("/home/z/.gitcreds", "utf8").split("\n").find((l) => l.startsWith(name + "="));
  const q = String.fromCharCode(34);
  let v = line ? line.slice(name.length + 1).trim() : "";
  if (v.startsWith(q) && v.endsWith(q)) { v = v.slice(1, -1); }
  return v;
}

async function main() {
  const url = cred("SB_URL");
  const sk = cred("SB_SERVICE_KEY");
  const pat = cred("SB_PAT");
  const ref = url.replace(/^https:\/\//, "").split(".")[0];
  console.log("ref:", ref, "| sk type:", sk.startsWith("sb_secret_") ? "sb_secret" : "jwt", "| pat type:", pat.startsWith("sbp_") ? "sbp" : "?");

  const t1 = await fetch(`${url}/rest/v1/`, { headers: { apikey: sk, Authorization: `Bearer ${sk}` }, signal: AbortSignal.timeout(15000) });
  console.log("openapi_root:", t1.status);

  const t2 = await fetch(`${url}/rest/v1/CivOrg?select=*&limit=1`, { headers: { apikey: sk, Authorization: `Bearer ${sk}`, Prefer: "count=exact" }, signal: AbortSignal.timeout(15000) });
  console.log("table CivOrg:", t2.status, "| content-range:", t2.headers.get("content-range"));

  const t3 = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "select table_name from information_schema.tables where table_schema='public' order by table_name limit 5" }),
    signal: AbortSignal.timeout(20000),
  });
  const j3 = await t3.json().catch(() => null);
  console.log("mgmt query:", t3.status, JSON.stringify(j3).slice(0, 220));
}
main();
