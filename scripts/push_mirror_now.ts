// Dorong mirror penuh kernel → Supabase sekarang (termasuk state.cache untuk Vercel).
import { pushFullMirror } from "@/lib/civos/supabase";

const r = await pushFullMirror();
console.log(`mirror: ok=${r.ok} tables=${r.tables} rows=${r.rowsPushed}`);
if (r.perTable.filter((p) => !p.ok).length) {
  console.log("gagal:", JSON.stringify(r.perTable.filter((p) => !p.ok).slice(0, 4)));
}
process.exit(r.ok ? 0 : 1);
