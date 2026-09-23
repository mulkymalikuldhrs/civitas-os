# 08 — PROJECT_CONTEXT (Konteks Kanonik Proyek)

> Berkas hidup. Setiap agent wajib membaca ini sebelum bekerja. Perbarui setiap kali keputusan besar lahir.
> Terakhir: 2026-09-21 · oleh full-stack-developer (sesi 4 — v1.2 "PLANET")

---

## Identitas
- **Nama produk:** FLYBRAIN OS (platform) · FlyBrain MCP (nama lapisan protokol; warisan v0.1)
- **Tagline:** "Satu sambungan untuk semua alat. Data tetap milikmu."
- **Keputusan proyek:** Proyek A — platform terintegrasi (lihat 01 §3; skor 4,55 vs 2,95 / 2,80).
- **Status fase:** v1.2.2 "GEMBALA" — BERJALAN [T]: v1.2 PLANET dilapisi wire-all (mandat "fix all, test all, wire all, upgrade all"): seluruh port mati audit F-12/F-19 dihidupkan (RISK-GATE dari P&L nyata, detectLoop, reviewMemory/distillLesson/recallEpisodes, recallSkills/recordUsage/buildBlueprint), kehidupan sosial ekosistem (rencok + pupuk kematian), denyut 24/7 tiga lapis (interval · visibility catch-up · SW periodicsync + beacon Vercel Cron stateless). Server tetap amnesia; dunia persist lokal (settings vault "organism.world").

## Masalah inti yang diselesaikan
1. Memori agent terpecah & mapping diulang → satu vault + satu endpoint universal.
2. Ketidakpercayaan pada cloud → tanpa server; data 100% di perangkat user (IndexedDB + ekspor).
3. Platform tanpa penjaga → PRT, agent otonom penghuni otak.
4. Narasi & kepercayaan → otak lalat (connectome viral) sebagai model arsitektur nyata.

## Keputusan Terkunci (jangan dibuka lagi)
- TANPA Python di produk; TANPA backend server; TANPA Prisma/DB. (user, 2026-09-21)
- **AMENDMEN (v1.0, sesi 3):** "tanpa API route" diperlongir menjadi **"boleh API route sepanjang 100% stateless/amnesia"** — serverless stateless compute (10_AUTONOMY.md §5–6): tidak ada DB/file/cache konteks, tidak pernah menyimpan data user. Prinsip zero-storage TIDAK berubah; server tetap tidak tahu apa pun tentang pemiliknya.
- Kunci API = `FK1_` + SHA-256(username|password). (user + desain 04 §3)
- Kami tidak menyimpan apa pun; pembayaran dideteksi dari kwitansi di data lokal user. (user + 04 §4-5)
- Framing: operational awareness, BUKAN consciousness. (sesi 1)
- Lisensi: tidak menjual data connectome (CC BY-NC 4.0); monetisasi = infrastruktur. (sesi 1)
- UI & dokumen: bahasa Indonesia; semua fitur harus tervisualisasi (anti-slop). (user, 2026-09-21)
- Konstitusi prt 6 poin (10_AUTONOMY.md §4) = batas otonomi yang tidak dapat dilanggar oleh kode maupun LLM.
- **PLANET (v1.2):** dunia = METAFORA VISUAL dari data nyata — tidak ada keputusan baru dari dunia; wire table 8/8 biome↔fitur nyata [T]; mekanisme iklim [D]; migrasi [H]. NOL Math.random di logika dunia (deterministik); partikel visual canvas boleh acak. Nol penyimpanan tetap: state dunia persist HANYA ke settings vault lokal (12_ECOSYSTEM.md §7).

## Fakta Kunci Terverifikasi `[T]` (riset /research/*.json)
- Konektom CNS lalat jantan (Janelia+Google, 3 Sep 2026): >166.000 neuron, ±125 juta sinapsis; WIRED 16 Sep 2026 vibe-coding; MindStudio 14 Sep 2026 hobiis.
- FlyWire FAFB (Nature 2024): 139.255 neuron, >50 jt sinapsis, ±8.400 tipe sel; CAVEclient = API resmi; codex.flywire.ai = UI.
- "Calyx MCP" (temuan user) = VFB MCP — anatomi/ontologi; BUKAN memori → celah yang kita isi.
- MCP ekosistem: >8 jt unduhan (Apr 2025), >5.800 server, +8.000% (Nov 2024→Apr 2025); spec 2026-07-28 stateless.
- Pasar AI agent: $10,9 M 2026 → $182,9 M 2033 (CAGR 49,6%); AI infra $75,4 M 2026.
- Kompetitor: mem0, memnode, glama, Anthropic persistent memory — tak satu pun zero-storage + agent penghuni.

## Peta Berkas
- /download/flybrain-os/00_README.md … 12_ECOSYSTEM.md — dokumen konsistensi (sumber kebenaran).
- /src/lib/flybrain/* — kernel (types, idb, auth, vault, payment, router, prt, connectome, store).
- /src/lib/flybrain/organism/* — lapisan organisme (brain.ts = penalaran LLM server-side; loops.ts = 4 organ + sense-packet; engine.ts = denyut + worldTick).
- /src/lib/flybrain/ecosystem/* — lapisan dunia v1.2 (types, world = 8 biome + wire table + worldTick, climate, motion).
- /src/app/api/organism/*, /src/app/api/mcp/* — serverless stateless compute (amnesia; /api/mcp = 9 tools).
- /src/components/flybrain/* — AppShell + 9 view (00–08) + kanvas.
- /public/sw-korteks.js — endpoint nyata opsional (service worker).
- /research/*.json — bukti mentah 16 kueri.
- /download/flybrain-mcp/, /download/FlyBrain_MCP_Riset_dan_Blueprint.docx — arsip v0.1 (deprecated).

## Arsitektur (lapisan, v1.0)
1. **Klien = pemegang data**: kernel TS + IndexedDB + Service Worker opsional; klien yang mengeksekusi aksi prt.
2. **Serverless stateless compute** [BARU v1.0]: `/api/organism/heartbeat`, `/api/organism/chat`, `/api/mcp` — murni fungsi: input → hitung (LLM/kernel) → output → lupa. Tanpa persistensi apa pun.
3. **Endpoint universal**: POST /api/mcp (JSON-RPC 2.0: initialize/tools/list/tools/call) — pintu tunggal Hermes/opencode/curl/IoT.
4. **prt = operator otonom L3**: 4 organ (guardian/merchant/envoy/scout) berjalan via heartbeat LLM; degradasi jujur ke refleks L1.

## Terbuka (butuh user / waktu)
- Token FlyWire pribadi (identitas neuron 720575940622872870) — opsional, tidak menghalangi produk.
- Status MCP di Hermes — pakai jalur HTTP bridge jika tak didukung.
- Mitra pembayaran penandatangan kwitansi (Fase 3).
- Konfirmasi tertulis lisensi FlyWire sebelum monetisasi penuh.

## Etika Garis Merah
- Tidak mengklaim kesadaran biologis. Tidak menjual data user (teknis: mustahil). Tidak menyembunyikan keterbatasan kwitansi v0.2. PRT tak boleh hapus data tanpa izin.
- v1.0 tambahan: setiap keputusan prt wajib berjejak penuh di Ruang Kendali (transparansi radikal); LLM tidak pernah menerima isi memori user, hanya agregat.
