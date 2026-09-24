#!/usr/bin/env node
// Perbaiki config.supabase.serviceKey di kernel (nilai lama placeholder 21 karakter)
// dengan kredensial pemilik dari .gitcreds. Sekali jalan, idempoten.
const { PrismaClient } = require("/home/z/my-project/node_modules/@prisma/client");
const fs = require("fs");
const q = String.fromCharCode(34);

function cred(name) {
  const line = fs.readFileSync("/home/z/.gitcreds", "utf8").split("\n").find((l) => l.startsWith(name + "="));
  let v = line ? line.slice(name.length + 1).trim() : "";
  if (v.startsWith(q) && v.endsWith(q)) v = v.slice(1, -1);
  return v;
}

async function main() {
  const db = new PrismaClient();
  const key = cred("SB_SERVICE_KEY");
  if (key.length < 50) { console.error("SB_SERVICE_KEY tidak sah"); process.exit(1); }
  await db.civKV.upsert({
    where: { key: "config.supabase.serviceKey" },
    create: { key: "config.supabase.serviceKey", value: key },
    update: { value: key },
  });
  const row = await db.civKV.findUnique({ where: { key: "config.supabase.serviceKey" } });
  console.log("serviceKey kernel diperbarui: len =", row ? row.value.length : -1, "jwt =", row ? row.value.startsWith("ey") : false);
  await db.$disconnect();
}
main();
