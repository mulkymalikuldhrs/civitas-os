/**
 * sb_mount.ts — pasang kredensial Supabase ke config kernel + jalankan MIRROR TOTAL.
 * Kredensial dibaca dari /home/z/.gitcreds (di luar repo, chmod 600) — tak pernah di-commit.
 */
import { readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { setConfigValue } from "@/lib/civos/config";
import { pushFullMirror } from "@/lib/civos/supabase";

function cred(key: string): string {
  const line = readFileSync("/home/z/.gitcreds", "utf8")
    .split("\n")
    .find((l) => l.startsWith(key + "="));
  if (!line) throw new Error(`${key} tidak ada di ~/.gitcreds`);
  return line.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
}

async function main() {
  const url = cred("SB_URL");
  const serviceKey = cred("SB_SERVICE_KEY");
  await setConfigValue("supabase.url", url);
  await setConfigValue("supabase.serviceKey", serviceKey);
  console.log("[mount] kredensial supabase tersimpan di config kernel (secret, tidak dikirim ke klien)");

  const r = await pushFullMirror();
  console.log(`[mirror] ok=${r.ok} tables=${r.tables} rows=${r.rowsPushed}`);
  for (const t of r.perTable) console.log(`  ${t.ok ? "OK " : "FAIL"} ${t.table.padEnd(22)} rows=${t.rows}${t.err ? " — " + t.err : ""}`);
  if (!r.ok) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error("[mount] gagal:", e instanceof Error ? e.message : e); process.exit(1); });
