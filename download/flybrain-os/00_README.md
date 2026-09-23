# FLYBRAIN OS — Paket Dokumen Konsistensi v1.2.2 "GEMBALA"

> "Produk bukan alat yang dipakai — produk adalah organisme yang bekerja."
> Platform otak untuk semua tool/AI agent/IoT — tanpa server penyimpanan, data 100% milik user, dijalankan prt (operator otonom ber-LLM, lalat digital penghuni) di dalam SATU dunia hidup: PLANET.

## Fitur v1.2.2 "GEMBALA" [T — lihat 09_CHANGELOG.md]
- **Logika mati dihidupkan semua**: RISK-GATE hidup dari P&L kekayaan nyata (fail-closed, pulih otonom lewat self-reflect); detectLoop anti-stagnasi (keputusan identik ≥12 → variasi dipaksakan); reviewMemory/distillLesson/recallEpisodes menganalisa & menyembuhkan lewat ledger; skill dipakai-ulang (recallSkills+recordUsage) dan skill baru bersama blueprint (buildBlueprint).
- **Kehidupan sosial & jaring makanan menutup loop**: RENCOK — sekufu satu biome saling menguatkan (+1 energi); PUPUK KEMATIAN — creature gugur menyuburkan biome terakhirnya (wealth/20, maks +5).
- **Denyut 24/7 tiga lapis (semua lokal)**: interval halaman ±45 dtk · catch-up visibilitychange · SW periodicsync/sync (episode sw-pulse + bangunkan klien) + beacon Vercel Cron stateless (`/api/organism/cron`, vercel.json */5).
- **Metabolisme ekonomi sadar-iklim**: biaya hidup per denyut (0,25 × fase × cuaca) — kerugian nyata mungkin, ekonomi & ekosistem satu iklim.

## Fitur v1.2 "PLANET" [T — lihat 09_CHANGELOG.md + 12_ECOSYSTEM.md]
- **Satu dunia hidup untuk SEMUA fitur**: 8 biome di peta planet (08) yang masing-masing ter-wire ke fitur nyata — Hutan Memori↔vault, Samudra Gerbang↔/api/mcp+SW, Pegunungan Kuant↔quant engine, Kota Alat↔factory/skill, Savana Tumbuh↔checklist panen+kwitansi, Kawah Riset↔self-reflect, Langit Konnektom↔atlas connectome (182 neuron), Kutub Konstitusi↔immune/breaker/veto. Wire table 8/8 — tidak ada fitur tanpa biome.
- **Iklim dari data nyata (nol random kosong)**: 12 denyut = 1 hari dunia (siang-malam, drain −50% saat malam); cuaca dari rasio kegagalan 20 denyut terakhir (cerah/berawan/badai); musim dari verdict self-reflect (hujan/kemarau/kelaparan); angin dari volume keputusan.
- **Jaring makanan terlihat**: biome memproduksi energi dari aktivitas nyata (vault, gerbang, quant, skill, kwitansi, reflect, breaker); creature menggembalakan stok biome; aksinya menyetor nutrisi balik; biome kosong → creature MIGRASI ke biome paling subur sesuai peran.
- **PLANET (08)** — kanvas peta dunia: langit konnektom (bintang = neuron), 8 biome organik hidup, partikel cuaca, siklus siang-malam, 6 creature sebagai sprite bergerak (trail memudar), inspektor biome/creature + tombol buka fitur, panel IKLIM + JARING MAKANAN + PETA SISTEM (wire table interaktif).
- **9 tools di /api/mcp** — 8 tools v1.1 + `world.map` (peta dunia: wire table + rumus iklim + cara baca, stateless murni).

## Fitur v1.1 "BIOSFER" [T — lihat 09_CHANGELOG.md + 11_AUTONOMOUS_ORGANISM.md]
- **Reuni 4 repo Autonomous-Organism pemilik**: anatomi organ (gh) + peradaban/creature (gitlab/codeberg) + tubuh platform FLYBRAIN = SATU organisme. Supabase upstream tidak dibawa sebagai dependensi inti (adaptor opsional Fase 4); secret upstream TIDAK disalin.
- **6 creature otonom** (prt guardian + Tradio/Scriba/Lumen/Cresca/Fabro) dengan loop saraf sendiri, energi/metabolisme, refleks offline berlabel jujur, dan konstitusi 7 hukum + veto di klien.
- **BIOSFER (07)** — ekosistem hidup: kanvas 6 creature, inspektor genom/jejak, feed kejadian, quant mini (port pure-TS dari upstream, label "simulasi lokal"), PICU DENYUT.
- **8 tools di /api/mcp** — 6 tools v1.0 + `creature.list` + `creature.dispatch` (stateless: state dibawa klien).

## Fitur v1.0 "ORGANISME" [T — lihat 09_CHANGELOG.md]
- **prt = operator otonom L3**: 4 organ bisnis (Guardian/ops, Merchant/penjualan, Envoy/support, Scout/produk) menjalankan loop SADAR→TAFSIR→PUTUSKAN→BERTINDAK→INGAT dengan penalaran LLM — sense-packet agregat keluar, keputusan kembali, server amnesia. Konstitusi 6 poin mengikat (10_AUTONOMY.md §4).
- **Ruang Kendali (06)** — Mission Control: aliran keputusan live, mandat L0–L4 + scope-grant per organ, ledger bisnis dari vault lokal, denyut organisme (sparkline + PICU DENYUT + otomatis ±60 dtk), panel endpoint universal.
- **Endpoint universal `/api/mcp`** — JSON-RPC 2.0 stateless (initialize · tools/list · tools/call), 6 tools: `system.status`, `prt.chat`, `connectome.query`, `receipt.verify`, `memory.write`, `memory.recall`. Tool memori jujur menolak: memori berjalan di perangkat pemilik. Zero-storage: server tidak menyimpan apa pun.
- **Zero-storage tetap kunci**: API route v1.0 = *serverless stateless compute* (amnesia), BUKAN backend penyimpanan (amendmen dijelaskan di 08_PROJECT_CONTEXT.md).

## Quickstart — konek Hermes / opencode / curl ke /api/mcp
```bash
# 1) handshake (echo protokol + kapabilitas)
curl -X POST <ORIGIN>/api/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# 2) daftar 9 tools (v1.2: + world.map — peta dunia PLANET)
curl -X POST <ORIGIN>/api/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3) bicara dengan prt
curl -X POST <ORIGIN>/api/mcp -H "Content-Type: application/json" \
  -H "Authorization: Bearer FK1_<64-hex>" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"prt.chat","arguments":{"message":"status kamu?"}}}'
```
`<ORIGIN>` = URL deployment (untuk uji lokal: `http://localhost:3000`). Bearer diperiksa FORMAT-nya di server; verifikasi penuh tetap di perangkat pemilik — server amnesia.

## Baca sesuai urutan kebutuhan

| # | Dokumen | Untuk apa | Kapan dibaca |
|---|---|---|---|
| 01 | MARKET_RESEARCH.md | Keputusan Proyek A/B/C, pasar, kompetitor, why & how | Saat bertanya "kenapa proyek ini" |
| 02 | PRD.md | Kebutuhan produk, fitur + acceptance criteria, metrik, risiko | Sebelum menulis/mengubah fitur |
| 03 | ARCHITECTURE.md | Arsitektur tanpa-server, kernel, peta otak↔modul | Sebelum menyentuh kode |
| 04 | DATA_SOVEREIGNTY.md | Skema data, kunci API, protokol pembayaran nol-penyimpanan | Saat menyentuh data/pembayaran |
| 05 | INTEGRATIONS.md | Endpoint /v1/*, koneksi MCP/Hermes/IoT, playbook | Saat menghubungkan alat |
| 06 | PRT_AGENT.md | Perilaku PRT, batas otonomi, kepribadian | Saat menyentuh PRT |
| 07 | ROADMAP.md | Fase, definisi selesai, prioritas | Saat merencanakan |
| 08 | PROJECT_CONTEXT.md | Konteks kanonik + keputusan terkunci | SELALU, sebelum kerja apa pun |
| 09 | CHANGELOG.md | Riwayat perubahan | Setelah setiap perubahan |
| 10 | AUTONOMY.md | Spesifikasi otonomi L4 "ORGANISME": organ, konstitusi, mekanisme | Sebelum menyentuh prt/organisme |
| 11 | AUTONOMOUS_ORGANISM.md | Desain reuni BIOSFER v1.1: anatomi + penduduk + tubuh | Sebelum menyentuh creature/biosfer |
| 12 | ECOSYSTEM.md | Spesifikasi PLANET v1.2: wire table 8 biome, iklim, dunia | Sebelum menyentuh ekosistem/dunia |

## Konvensi bukti (seluruh paket)
`[T]` terverifikasi (riset /research/*.json, 2026-09-21) · `[D]` keputusan desain · `[H]` hipotesis yang harus divalidasi.

## Aplikasi
Kode platform berada di root proyek (`src/`): kernel di `src/lib/flybrain/`, lapisan organisme di `src/lib/flybrain/organism/`, lapisan ekosistem/dunia di `src/lib/flybrain/ecosystem/` (v1.2 PLANET: world, climate, motion, types), serverless stateless compute di `src/app/api/` (heartbeat, chat, mcp), antarmuka di `src/components/flybrain/` (9 view 00–08 + kanvas), endpoint-nyata-opsional di `public/sw-korteks.js`. Ringkasan dokumen juga bisa dibaca langsung di dalam aplikasi (view 05 DOKUMEN).
