#!/usr/bin/env node
// Bandingkan SHAPE kredensial kernel vs .gitcreds (tanpa membocorkan nilai).
const { PrismaClient } = require("/home/z/my-project/node_modules/@prisma/client");
const fs = require("fs");
const q = String.fromCharCode(34);

function cred(name) {
  const line = fs.readFileSync("/home/z/.gitcreds", "utf8").split("\n").find((l) => l.startsWith(name + "="));
  let v = line ? line.slice(name.length + 1).trim() : "";
  if (v.startsWith(q) && v.endsWith(q)) v = v.slice(1, -1);
  return v;
}
function shape(label, v) {
  if (!v) { console.log(label, "(kosong)"); return; }
  console.log(`${label}: len=${v.length} awal=${v.slice(0, 2)} akhir=${v.slice(-2)} jwt=${v.startsWith("ey")} kutip=${v.includes(q)}`);
}
async function main() {
  const db = new PrismaClient();
  const rows = await db.civKV.findMany({ where: { key: { startsWith: "config.supabase" } } });
  for (const r of rows) {
    const v = r.value;
    console.log(`${r.key}: len=${v.length} awal=${v.slice(0, 2)} jwt=${v.startsWith("ey")} kutip=${v.includes(q)}`);
  }
  await db.$disconnect();
  shape(".gitcreds SB_URL", cred("SB_URL"));
  shape(".gitcreds SB_SERVICE_KEY", cred("SB_SERVICE_KEY"));
}
main();
