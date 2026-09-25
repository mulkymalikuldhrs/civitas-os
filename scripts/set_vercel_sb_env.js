#!/usr/bin/env node
/** Set env SB_URL + SB_SERVICE_KEY di Vercel (produksi/preview/dev) — untuk fallback kredensial. */
const fs = require("fs");

function cred(n) {
  const l = fs.readFileSync("/home/z/.gitcreds", "utf8").split("\n").find((x) => x.startsWith(n + "="));
  let v = l ? l.slice(n.length + 1).trim() : "";
  if (v.startsWith(String.fromCharCode(34)) && v.endsWith(String.fromCharCode(34))) v = v.slice(1, -1);
  return v;
}
const TOKEN = cred("VERCEL_TOKEN");
const PID = "prj_3oDtkLLoKY9wPAMfmhoZcerZVSUY";

async function setEnv(key, value) {
  // hapus lama dulu
  const r1 = await fetch(`https://api.vercel.com/v9/projects/${PID}/env`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const j1 = await r1.json();
  for (const e of (j1.envs || []).filter((x) => x.key === key)) {
    await fetch(`https://api.vercel.com/v9/projects/${PID}/env/${e.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${TOKEN}` } });
  }
  const r = await fetch(`https://api.vercel.com/v10/projects/${PID}/env`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, target: ["production", "preview", "development"], type: "encrypted" }),
  });
  const j = await r.json().catch(() => ({}));
  console.log(key, "->", r.status, j.error ? j.error.message : "OK");
}

(async () => {
  await setEnv("SB_URL", cred("SB_URL"));
  await setEnv("SB_SERVICE_KEY", cred("SB_SERVICE_KEY"));
})();
