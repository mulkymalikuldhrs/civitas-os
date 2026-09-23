// Uji denyut router NYATA (handleKorteks) — bucket per-kunci anon+route (audit F-04).
// Jalankan: bun run tool-results/test-router-limiter.ts

import { handleKorteks, rateLimited } from "../src/lib/flybrain/router";

let failed = 0;
const assert = (cond: boolean, label: string) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${label}`);
  if (!cond) failed += 1;
};

// Burst 130 GET ke rute publik /v1/connectome/summary (key = anon:/v1/connectome/summary, cap 120/menit)
let ok200 = 0;
let limited429 = 0;
for (let i = 0; i < 130; i++) {
  const r = await handleKorteks({ method: "GET", path: "/v1/connectome/summary", bearer: null, agent: "uji-limiter" });
  if (r.status === 200) ok200 += 1;
  if (r.status === 429) limited429 += 1;
}
assert(ok200 === 120, `130 panggilan cepat ke /v1/connectome/summary → ${ok200}× 200 (harus 120, cap GET/menit)`);
assert(limited429 === 10, `→ ${limited429}× 429 pada akhirnya (harus 10)`);

// Kunci LAIN (bucket sendiri) masih bisa — diverifikasi langsung pada limiter yang sama:
// rute publik hanya satu, jadi bukti kunci-lain pada level router memakai fungsi
// rateLimited yang persis dipakai handleKorteks (lihat juga test-limiter.ts #2).
const other = rateLimited("anon:/v1/rute-lain", 120, 60_000);
assert(!other, `Kunci LAIN (anon:/v1/rute-lain) tetap lolos saat kunci pertama diblok → limited=${other}`);

console.log(failed === 0 ? "SEMUA TES ROUTER-LIMITER LULUS" : `${failed} TES GAGAL`);
process.exit(failed === 0 ? 0 : 1);
