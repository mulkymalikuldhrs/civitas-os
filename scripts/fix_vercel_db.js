#!/usr/bin/env node
/** Set DATABASE_URL produksi Vercel = Supabase pooler (IPv4, pgbouncer).
 *  Sumber kredensial: SB_DB_URL (db.direct:5432) -> dipetakan ke pooler:6543. */
const fs = require("fs");

function cred(name) {
  const line = fs.readFileSync("/home/z/.gitcreds", "utf8").split("\n").find((l) => l.startsWith(name + "="));
  let v = line ? line.slice(name.length + 1).trim() : "";
  if (v.startsWith(String.fromCharCode(34)) && v.endsWith(String.fromCharCode(34))) v = v.slice(1, -1);
  return v;
}

function token() {
  return cred("VERCEL_TOKEN");
}

const REF = "jcdjwprehfgtaswqletb";
const POOLER_HOST = `aws-1-ap-southeast-1.pooler.supabase.com`;
const old = new URL(cred("SB_DB_URL"));
const password = decodeURIComponent(old.password);

if (!password) { console.error("password kosong — hentikan"); process.exit(1); }

const dbUrl = `postgresql://postgres.${REF}:${encodeURIComponent(password)}@${POOLER_HOST}:6543/postgres?pgbouncer=true&connection_limit=1&connect_timeout=20`;

async function setEnv(key, value, target) {
  const res = await fetch(`https://api.vercel.com/v10/projects/prj_3oDtkLLoKY9wPAMfmhoZcerZVSUY/env?upsert=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, target, type: "encrypted" }),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, err: j.error ? j.error.message : undefined };
}

(async () => {
  const r = await setEnv("DATABASE_URL", dbUrl, ["production", "preview", "development"]);
  console.log("set DATABASE_URL:", r.status, r.ok ? "OK (pooler:6543, pgbouncer)" : `GAGAL ${r.err}`);
})();
