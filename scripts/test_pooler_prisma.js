// Tes Prisma → Supabase pooler dari sandbox (URL sama dengan yang dipasang di Vercel).
const fs = require("fs");

function cred(n) {
  const l = fs.readFileSync("/home/z/.gitcreds", "utf8").split("\n").find((x) => x.startsWith(n + "="));
  let v = l ? l.slice(n.length + 1).trim() : "";
  if (v.startsWith(String.fromCharCode(34)) && v.endsWith(String.fromCharCode(34))) v = v.slice(1, -1);
  return v;
}

const old = new URL(cred("SB_DB_URL"));
const pw = decodeURIComponent(old.password);
const url = "postgresql://postgres.jcdjwprehfgtaswqletb:" + encodeURIComponent(pw) + "@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&connect_timeout=20";

const mod = require("/home/z/my-project/node_modules/@prisma/client");
const P = mod.PrismaClient;
const p = new P({ datasources: { db: { url } } });
p.$queryRaw`SELECT 1 as t`
  .then((r) => { console.log("QUERY OK:", JSON.stringify(r)); process.exit(0); })
  .catch((e) => { console.log("QUERY ERR:", e.message.slice(0, 220)); process.exit(1); });
