// Uji unit rate limiter PER-KUNCI (audit F-04) — dijalankan via: bun run tool-results/test-limiter.ts
// Menguji fungsi asli dari src/lib/flybrain/router.ts (import langsung).

import { rateLimited } from "../src/lib/flybrain/router";

let failed = 0;
const assert = (cond: boolean, label: string) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${label}`);
  if (!cond) failed += 1;
};

const MIN = 60_000;

// --- 1. Bucket MUTATE per-kunci: cap 30/menit ---
let a429 = 0;
for (let i = 0; i < 35; i++) {
  if (rateLimited("uji-keyA:mutate", 30, MIN)) a429 += 1;
}
assert(a429 === 5, `keyA mutate: 35 panggilan cepat → 30 lolos, ${a429} kena 429 (harus 5)`);

// --- 2. Kunci LAIN tetap bisa saat keyA sudah diblok ---
let b429 = 0;
for (let i = 0; i < 5; i++) {
  if (rateLimited("uji-keyB:mutate", 30, MIN)) b429 += 1;
}
assert(b429 === 0, `keyB mutate: ${5 - b429}/5 lolos saat keyA diblok (rate limit per-kunci, bukan global)`);

// --- 3. Bucket GET per-kunci: cap longgar 120/menit (polling UI aman) ---
let g429 = 0;
for (let i = 0; i < 125; i++) {
  if (rateLimited("uji-keyA:get", 120, MIN)) g429 += 1;
}
assert(g429 === 5, `keyA get: 125 panggilan cepat → 120 lolos, ${g429} kena 429 (harus 5)`);

// --- 4. GET dan MUTATE tidak saling mengunci (bucket terpisah) ---
assert(!rateLimited("uji-keyC:get", 120, MIN), "keyC get tetap lolos meski bucket mutate-nya (dibuang) terpisah");

// --- 5. Jendela geser: entry lama (>windowMs) kedaluwarsa dan kuota pulih (cap 1) ---
await new Promise((r) => setTimeout(r, 1100));
assert(!rateLimited("uji-keyE:mutate", 1, 1000), "keyE: 1 panggilan dalam window 1000ms → lolos");
assert(rateLimited("uji-keyE:mutate", 1, 1000), "keyE: panggilan ke-2 dalam window → 429");
await new Promise((r) => setTimeout(r, 1100));
assert(!rateLimited("uji-keyE:mutate", 1, 1000), "keyE: setelah window lewat, kuota pulih (bucket stale dibersihkan)");

console.log(failed === 0 ? "SEMUA TES LIMITER LULUS" : `${failed} TES GAGAL`);
process.exit(failed === 0 ? 0 : 1);
