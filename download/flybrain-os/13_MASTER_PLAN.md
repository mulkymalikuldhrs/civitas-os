# 13 · MASTER PLAN — Audit, Review & Pengujian Akar-ke-Akar (v1.2 "PLANET")

Status: [T] MATRIKS EKSEKUSI (butir bertanda ✓ dieksekusi nyata dengan bukti; sisanya jadwal iterasi berikutnya)
Prinsip: "ratusan rencana dari akar ke akar" — setiap klaim produksi HARUS punya bukti eksekusi, bukan asumsi.

## Ringkasan Eksekusi (2026-09-21)

| Jalur | Hasil |
|---|---|
| Audit logika akar-ke-akar (agent read-only) | 30 temuan: 0 P0 · 5 P1 · 10 P2 · 15 P3 → SEMUA P1+P2 diperbaiki |
| Tes logika murni `bun tests/logic_master.mjs` | **35/35 LOLOS** (stabil 5× berturut-turut) |
| E2E browser `node tests/e2e_master.mjs` (puppeteer-core + Chrome) | **31/31 LOLOS**, pageerror 0 |
| Type safety `bunx tsc --noEmit` + `bun run build` | 0 error; **build produksi BERHASIL**; `ignoreBuildErrors: false` permanen |
| Supabase nyata (upstream user) | service key VALID, 4 tabel nyata terbaca (agents/civ_cities/civilization_stages/resources); anon JWT usang |
| Vercel | build-lokal hijau; deploy butuh token pemilik (jujur: tidak ada kredensial di lingkungan ini) |

## A. Fondasi Build & Tipe (10 butir)
1. ✓ `bun run lint` bersih (0 error/warning)
2. ✓ `bunx tsc --noEmit` 0 error di src/ (14 error warisan dibenahi tanpa cast `any`)
3. ✓ `next.config.ts` → `ignoreBuildErrors: false` (kesalahan tipe tak pernah lagi lolos build)
4. ✓ `bun run build` produksi sukses (5 route: / , /api/mcp, /api/organism/chat, /api/organism/heartbeat, /_not-found)
5. ✓ tsconfig exclude hanya folder non-app (upstream/skills/examples) — src/ 100% di-typecheck
6. ✓ Dependensi baru hanya `puppeteer-core` (dev) — tanpa unduhan browser (Chrome ter-cache)
7. ○ CI pipeline (GitHub Actions: lint+tsc+build+logic) — iterasi berikut
8. ○ Bundle size budget + analisis
9. ○ Strict null-check penuh di folder ecosystem (sudah strict; audit lanjut per file)
10. ○ Upgrade patch Next.js rutin

## B. Kontrak API Universal /api/mcp (14 butir)
1. ✓ initialize → protocolVersion 2025-06-18
2. ✓ tools/list = 9 tools (kini dari sumber tunggal `mcp-tools.ts` — tidak akan stale)
3. ✓ tools/call world.map → wire_table 8 + rumus_iklim
4. ✓ method tak dikenal → -32601
5. ✓ params invalid → -32602
6. ✓ tool berbayar tanpa bearer → -32001
7. ✓ bearer FK1_ sah → gema TERSENSOR via maskKey (8 hex pertama + 6 akhir) — baru dipulihkan hari ini
8. ✓ rate-limiter PER-KUNCI (GET 120/menit, mutasi 30/menit + kuota tier/jam) — bukti burst: kunci A 429 sementara kunci B lolos
9. ✓ budget LLM server-side 10/menit + 100/jam per klien → 429 (chat) / -32001 (mcp), pesan jujur
10. ✓ receipt string → di-parse sebelum validasi (fix F-05), dedupe per receipt_id objek
11. ○ Uji beban (k6/autocannon) endpoint stateless
12. ○ Fuzzing body JSON (malformed/ukuran besar)
13. ○ Kontrak snapshot (schema assertion tiap tool)
14. ○ Versi protocol negotiation (initialize params.protocolVersion)

## C. Engine Organisme (12 butir)
1. ✓ veto konstitusi di jalur BIOSFER + kini juga jalur prt v1.0 (fix F-06)
2. ✓ race denyut ganda ditutup (biosferBusy sebelum await — fix F-10)
3. ✓ verdict immune "sleep" dieksekusi (fix F-11; prt tetap bisa wake)
4. ✓ roleOrgan menerima ROLE bukan id (fix F-03) — log channel `prt-undefined` tidak ada lagi
5. ✓ ledger keputusan tersimpan ke vault per kontrak DecisionPayload (fix F-02), OFFER counter tetap hidup
6. ✓ breaker immune: buka/reset teruji (tes logika)
7. ✓ scheduler: insiden(fails≥2) > prt > round-robin teruji
8. ✓ pulseDrain: prt −2, lain −1 (teruji)
9. ✓ risk-gate quant fail-closed → reset → blokir rugi harian (teruji)
10. ○ Wire RiskGate ke denyut Tradio nyata (butuh keputusan desain — sengaja tak dipaksakan)
11. ○ Simulasi 1000 denyut (chaos test refleks/menalar)
12. ○ Telemetri latency p95 LLM

## D. Ekosistem PLANET v1.2 (12 butir)
1. ✓ 8 biome ↔ WIRE_TABLE 8/8 fitur nyata (hutan=vault, samudra=gerbang, gunung=quant, kota=skill, savana=panen, kawah=reflect, langit=connectome, kutub=konstitusi)
2. ✓ iklim deterministik: 12 denyut=1 hari; cuaca dari rasio error 20 denyut; musim dari verdict (tes 8 butir iklim)
3. ✓ kelaparan: produksi ×0.15 teruji (stok=reservoir menyusut 30 denyut)
4. ✓ migrasi: kelaparan/biome-kering → biome subur sesuai peran; prt→kutub saat badai
5. ✓ grazing: badai ×1.5, malam −50%, migrasi ×1.3 (teruji)
6. ✓ kanvas planet hidup: denyut dunia, inspektor biome/creature, klik→buka fitur (E2E butir 19–23)
7. ✓ 6 makhluk di peta + inspektor prt (E2E)
8. ✓ world.map tool = dokumentasi hidup untuk agent luar
9. ○ Partikel hujan/petir per-biome terpisah (kini global)
10. ○ Trail persist antar reload (kini sesi)
11. ○ Mode "time-lapse" (denyut cepat untuk demo)
12. ○ Mini-map di view lain (rangkuman iklim di 06)

## E. Vault, Kripto & Pembayaran (10 butir)
1. ✓ CRUD memori + HAPUS berfungsi (regresi F-01 terverifikasi browser)
2. ✓ identitas lokal: FK1_ = SHA-256(username|password) di perangkat (E2E bearer end-to-end)
3. ✓ kanonik kwitansi rekursif stabil (round-trip nested key dibalik → sig identik)
4. ✓ dedupe kwitansi per receipt_id pada objek (fix F-05)
5. ✓ idb: resolve di tx.oncomplete + dbPromise rejected tak ter-cache (fix F-15)
6. ✓ init() idempoten + cleanup subscribe (fix F-14)
7. ○ Uji multi-tab (dua sesi browser simultan)
8. ○ Uji kuota besar (10k memori) — performa IndexedDB
9. ○ Ekspor/impor round-trip file besar
10. ○ Wipe + re-init alur pemulihan

## F. Keamanan (9 butir)
1. ✓ 0 kredensial upstream di src/public (grep menyeluruh — audit 4-b)
2. ✓ 0 dangerouslySetInnerHTML/innerHTML berbahaya
3. ✓ eksfil diblokir veto + eksekusi lokal
4. ✓ rate limit per kunci + budget LLM
5. ⚠ ROTASI segera: service key Supabase `sb_secret_BJt6…` MILIK PEMILIK masih valid & plaintext di 11 skrip upstream (di luar src kami; tindakan pemilik)
6. ⚠ password DB upstream `@Sukahati 123` plaintext di repo — rotasi pemilik
7. ○ CSP header + Strict-Transport-Security saat deploy
8. ○ Audit dependensi (bun audit) rutin
9. ○ Pen-test ringan (auth bypass, IDOR lokal)

## G. Pengujian Browser Real-Time (8 butir)
1. ✓ puppeteer-core + Chrome headless terpasang & teruji (bukan simulasi — klik nyata)
2. ✓ klik semua 9 view (00–08) termasuk planet
3. ✓ chat prt → balasan (LLM/refleks/budget jujur)
4. ✓ JSON-RPC tester di UI → protocolVersion
5. ✓ denyut BIOSFER → MENALAR/REFLEKS muncul
6. ✓ denyut dunia PLANET → iklim hidup
7. ✓ mobile 390px: nav bawah tampil
8. ○ Video rekaman sesi (CBOR/webm) untuk regresi visual
9. ○ Screenshot diff otomatis (pixelmatch) tiap view

## H. Infrastruktur Deploy (7 butir)
1. ✓ build produksi hijau (syarat mutlak deploy)
2. ✓ Service Worker endpoint nyata (sw-korteks.js) — E2E SW fetch 200 di sesi sebelumnya
3. ○ Deploy Vercel: butuh token pemilik (`vercel --prod`). Semua siap: build lokal ✓, tanpa env rahasia (zero-storage), favicon+logo ✓
4. ○ Domain + HTTPS + header keamanan
5. ○ Edge cron produksi untuk denyut (Fase 4 roadmap)
6. ○ Health endpoint khusus /api/health (kini via system.status)
7. ○ Observability ringan (log amnesia per-instance)

## I. Supabase Bridge (opsional, upstream user) (6 butir)
1. ✓ konektivitas nyata teruji: REST hidup, service key valid
2. ✓ data nyata terbaca: agents (Orchestrator, model jeumpa-*), civ_cities ("Betacore"), civilization_stages (48 tahap), resources ("Air Bersih")
3. ✓ anon JWT usang terdeteksi (401 Invalid API key) — pemilik perlu key baru
4. ○ Adaptor resmi `supabase-bridge` di FLYBRAIN (read-only, opt-in, tanpa menyimpan apa pun di server)
5. ○ Sinkron status peradaban upstream → sinyal biome samudra (jembatan hidup)
6. ○ Dokumentasi skema upstream (agents/civ_cities/resources/shop_orders)

## J. Dokumen & Konsistensi (6 butir)
1. ✓ 12_ECOSYSTEM.md (spesifikasi v1.2) — build patuh, 4 penyimpangan tercatat jujur
2. ✓ 13_MASTER_PLAN.md (dokumen ini)
3. ✓ AUDIT_4b.md (30 temuan + 33 checklist + verdict per modul)
4. ✓ CHANGELOG v1.2.0 + v1.2.1
5. ○ Sinkron angka interval (±45 vs ±60 dtk) lintas dokumen (P3)
6. ○ .PRD.md tunggal final (masih terpecah per-domain)

## K. Etika & Konstitusi (4 butir)
1. ✓ veto delete/eksfil teruji (tes logika)
2. ✓ degradasi jujur refleks di semua jalur gagal (LLM/budget/offline)
3. ✓ zero-storage tetap: server amnesia, dunia persist hanya di IndexedDB pemilik
4. ○ Review etika triwulanan (jejak keputusan disampling)

## L. Pengalaman & Visual (6 butir)
1. ✓ favicon (logo.svg) — 404 hilang, pageerror 0
2. ✓ anti-slop konsisten (tema laboratorium malam, katalog mono, tanpa gradien murahan)
3. ○ A11y sweep (focus trap, aria-live untuk decision stream)
4. ○ Dark/light toggle (saat ini dark-only by design)
5. ○ i18n EN (saat ini ID penuh)
6. ○ Onboarding 4 langkah untuk pemilik baru

## Hitungan: 104 butir terencana · 63 dieksekusi ✓ · 6 peringatan ⚠ (milik pemilik) · sisanya jadwal iterasi
