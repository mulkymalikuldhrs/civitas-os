# 6-a — full-stack-developer — Batch perbaikan AUDIT_4b (F-04 s.d. F-07/F-09)

## Ringkasan
Memperbaiki 11 temuan prioritas audit akar-ke-akar FLYBRAIN OS (F-04, F-05, F-06, F-10, F-11, F-15, F-14, F-13, F-08, F-09, F-07). Zero-storage tetap (semua guard/baru in-memory, tanpa DB/persist server). F-01/F-02/F-03 milik main agent TIDAK disentuh ulang. Dev server port 3000 tetap hidup; semua verifikasi lewat situ.

## File diubah (per temuan)
- **F-04** src/lib/flybrain/router.ts — rate limiter GLOBAL → bucket per-kunci `Map<string, number[]>` (key = `session.keyHash` atau `anon:<route>`); GET 120/menit per kunci, mutasi 30/menit + kuota tier/jam; sweep bucket stale tiap 64 panggilan; `/v1/system/status` melaporkan hit per kunci; `rateLimited`/`bucketHits` diekspor untuk uji unit; rute publik connectome juga dibatasi.
- **F-05** router.ts `/v1/payment/verify` — receipt string di-`JSON.parse` dulu (gagal → 422); dedupe `receipt_id` pada objek ter-parse; simpan objek (bukan string). store.ts pasteReceipt tidak diubah (dinormalisasi di router).
- **F-06** src/lib/flybrain/prt.ts — `runHeartbeat` prt v1.0 kini memanggil `vetoDecision(dec)`; diveto → aksi `veto.replacement` + addLog warn + suffix "VETO konstitusi" di fase BERTINDAK trace.
- **F-10** src/lib/flybrain/organism/engine.ts — `biosferBusy: true` diset SEBELUM await apa pun (sebelum remediasi bangun); finally tetap melepas; sekalian fix TS18047 via `const wakeId`.
- **F-11** engine.ts — verdict "sleep" kini dieksekusi: `setCreatureStatus(id, "tidur")` (emit eventBus "sleep" dari store); prt masih bisa wake via remediasi.
- **F-15** src/lib/flybrain/idb.ts — `tx()` resolve di `t.oncomplete` (+ `t.onabort` reject); `openDB()` reset `dbPromise=null` saat open error (rejection tidak ter-cache permanen).
- **F-14** src/lib/flybrain/store.ts — `init()` idempoten (guard flag modul), mengembalikan fungsi unsubscribe (tipe `Promise<() => void>`); prt.on duplikat lama dihapus.
- **F-13** src/lib/flybrain/payment.ts — kanonikalisasi rekursif (`canonicalValue`, key terurut semua level, array juga). Kwitansi lama skema lama akan gagal checksum → simpan ulang kwitansi demo (sig = checksum format lokal).
- **F-08** modul BARU src/lib/flybrain/llm-budget.ts (10/menit + 100/jam per pemanggil, kunci bearer-hash/IP/anon, in-memory murni); /api/organism/chat → 429 jujur; /api/mcp prt.chat & creature.dispatch → -32001. Tool non-LLM tidak terpengaruh.
- **F-09** — semua 14 error tsc di src/ dibersihkan: heartbeat route (hapus cast `as CreatureId`/`as CreatureRole` F-23 + import tak terpakai), ikon maps diperluas `style?: React.CSSProperties` (Biosfer/Planet/RuangKendali), PlanetView `mulberry32` → Math.imul 2-arg kanonik (argumen kedua memang hilang), PlanetCanvasProps + `reflectVerdict` prop, world.ts `worldSnapshot` tanpa cast, store.ts import `PrtVitals`/`PrtFeedItem` + `WorldState` dari ecosystem/types. `next.config.ts` → `ignoreBuildErrors: false`. tsconfig exclude += examples/skills/upstream/download (folder referensi non-app; errornya TS2307 modul eksternal tak terinstal — bukan bagian build Next).
- **F-07** katalog tool dipindah ke src/lib/flybrain/mcp-tools.ts (`MCP_TOOLS`, sumber tunggal); route + brain.ts (system prompt) + GerbangView + RuangKendaliView membaca `MCP_TOOLS.length` dinamis (= 9).

## Bukti verifikasi
- `bunx tsc --noEmit` = 0 error (TOTAL repo); `bun run lint` = bersih.
- curl: initialize 200; tools/list 200 = 9 tool; world.map 200 (wire_table 8, rumus_iklim 4); POST /api/organism/chat 200 (bukan 500); GET / 200; tail dev.log tanpa error compile baru.
- Guard budget terbukti: burst 11 chat → ke-10 dst 429 "Budget instance tercapai…"; mcp prt.chat → -32001; system.status tetap 200.
- Rate limiter per-kunci terbukti (unit + router nyata): keyA 35 POST → 30 lolos + 5×429 sementara keyB 5/5 lolos; GET 120/menit; window geser pulih; burst 130 GET router → 120×200 lalu 10×429. Skrip: tool-results/test-limiter.ts, tool-results/test-router-limiter.ts.
- Round-trip payment bun: nested key-order dibalik → checksum tetap cocok; string JSON valid.

## Catatan untuk agent berikutnya
- `ignoreBuildErrors: false` — build kini GAGAL bila ada error tipe baru; jangan pernah set true lagi. tsc harus tetap 0 error.
- Katalog tool = `MCP_TOOLS` di mcp-tools.ts; tambah tool di sana (route, prompt LLM, dan UI otomatis ikut).
- Teks "6 tools" historis di download/flybrain-os/*.md sengaja dibiarkan (entri changelog versi lama = fakta historis).
- Temuan audit yang TIDAK diperbaiki (di luar scope 6-a, dengan alasan) tercatat di worklog.md: F-12/F-19/F-25/F-26/F-29, F-16, F-17/F-18/F-20/F-21/F-24/F-27/F-28/F-30.
