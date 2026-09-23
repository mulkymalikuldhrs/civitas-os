# 02 — Product Requirements Document (PRD) — FLYBRAIN OS

> Status: v1.0 · 2026-09-21 · Owner: Super Z (atas nama user)
> Rujukan keputusan: 01_MARKET_RESEARCH.md (Proyek A terpilih).
> Konvensi: `[T]` terverifikasi · `[D]` desain/keputusan · `[H]` hipotesis.

---

## 1. Ringkasan Produk

**FLYBRAIN OS** adalah platform web yang memberi "otak" — memori jangka panjang, kesadaran operasional, dan gerbang integrasi — kepada semua alat digital user (AI agent, coding agent seperti opencode/Claude, sistem QnA, Hermes, perangkat IoT, drone, robotik), dengan **otak lalat buah (Drosophila) sebagai model arsitektur** dan **tanpa server backend**: seluruh sistem berjalan penuh di browser user, data tersimpan 100% di perangkat user sendiri.

Empat proposisi inti `[D]`:
1. **Satu sambungan untuk semua** — user menyambungkan endpoint kami sekali; semua tool/agent/perangkat langsung punya memori bersama. Tidak ada pemetaan ulang berulang.
2. **Kami tidak bisa mengintip** — tidak ada backend yang menyimpan data; bahkan saat berbayar, kami tidak menyimpan apa pun. Pembayaran terdeteksi dari kwitansi yang disimpan user sendiri.
3. **PRT, lalat yang tinggal di dalam** — agent otonom penghuni platform: menjaga kesehatan vault, memantau aktivitas gerbang, dan bisa diajak bicara. Ia adalah "wajah" otak tersebut.
4. **Semua fitur tervisualisasi (anti-slop)** — tidak ada fitur yang hanya berupa teks; setiap subsistem punya representasi visual hidup (jaringan neuron, strip aktivitas, meter, konsol).

**Non-goals (terkunci):** bukan consciousness biologis — framing kita *operational awareness* (kesadaran operasional), konsisten dengan keputusan sesi sebelumnya `[T]`; bukan cloud storage; bukan jualan data connectome (lisensi FlyWire CC BY-NC 4.0 melarang `[T]`).

## 2. Persona & Masalah

| Persona | Konteks | Masalah yang diselesaikan |
|---|---|---|
| **Raka, builder agent** | Pakai Hermes + opencode + chatbot QnA | Setiap alat punya memori sendiri, konten terpecah, mapping diulang terus → satu vault + satu endpoint `[D]` |
| **Sari, privasi-sadar** | Ingin manfaat AI tanpa data diserahkan ke cloud | Tidak percaya vendor → data tak pernah keluar perangkat; bisa audit sendiri (ekspor JSON) `[H]` |
| **Bimo, hobiis robotik/IoT** | Main drone/mikrokontroler, terinspirasi viral otak lalat `[T]` | Perangkatnya "bodoh & lupa" → endpoint beri memori + status ke perangkat murah `[H]` |
| **Tim kecil (3-10 org)** | Butuh memori bersama yang patut diaudit | Tidak mau data insiden/log di server pihak ketiga → vault lokal + ekspor terstruktur `[H]` |

## 3. Arsitektur Produk (modul)

Produk = satu aplikasi statis dengan 6 view (navigasi internal, bukan multi-route):

1. **00 RUANG KENDALI** (dashboard) — gambaran hidup: kanvas neuron hero, KPI platform (status PRT, jumlah rekaman vault, panggilan gerbang, tier lisensi), ticker aktivitas, navigasi cepat.
2. **01 OTAK** (atlas connectome) — peta jaringan neuron interaktif (kanvas), statistik connectome nyata FAFB/Janelia sebagai pengantar `[T]`, detail neuron per klik (region, jumlah sinapsis, tetangga), dan "peta fungsi" yang menjelaskan padanan modul platform ↔ region otak (lobus antena = input gerbang, kaliks lobus jamur = penyimpanan memori asosiatif, kompleks pusat = penjadwal PRT).
3. **02 PRT** (agent penjaga) — konsol percakapan + log aktivitas otonom + vital PRT (energi, fokus, suasana) + kebijakan patroli. PRT punya akses read ke vault & log gerbang sehingga jawabannya kontekstual.
4. **03 VAULT** (data lokal user) — koleksi: `memories`, `logs`, `decisions`, `receipts`. CRUD + cari + tag, ekspor/impor JSON penuh, meter pemakaian storage, kartu kwitansi pembayaran (tempel JSON kwitansi → validasi → tier terkunci lokal), tombol "hancurkan vault" (nyata: hapus IndexedDB).
5. **04 GERBANG** (endpoint universal) — pembuatan kunci (username+password → kunci API), daftar endpoint `/v1/*` dengan spesifikasi, konsol uji coba (kirim request nyata ke kernel virtual, lihat JSON respons), contoh konfigurasi MCP/Hermes/opencode/curl, dan mode "endpoint nyata" opsional via Service Worker.
6. **05 DOKUMEN** — ringkasan dokumen konsistensi (PRD, arsitektur, sovereignty, integrasi, PRT, roadmap) langsung di dalam aplikasi + daftar berkas lengkap.

## 4. Kebutuhan Fungsional (dengan acceptance criteria)

### FR-1 Identitas & Kunci (auth tanpa akun terpusat)
- FR-1.1 User membuat identitas lokal: username + password → kunci API `FK1_<64 hex>` = SHA-256(username+"|"+password) via WebCrypto `[D]`.
- FR-1.2 Kunci dipakai sebagai (a) kredensial gerbang `Authorization: Bearer <kunci>`, (b) dasar label identitas tanpa menyimpan password `[D]`.
- FR-1.3 Sesi tersimpan di localStorage; logout menghapus sesi, TIDAK menghapus data.
- AC: membuat identitas baru → kunci tampil; reload → sesi bertahan; logout → sesi hilang, vault utuh.

### FR-2 Vault Lokal
- FR-2.1 Tambah/lihat/cari/hapus rekaman pada 4 koleksi dengan skema tetap (04_DATA_SOVEREIGNTY.md).
- FR-2.2 Penyimpanan IndexedDB (per browser). Semua operasi tanpa jaringan.
- FR-2.3 Ekspor JSON lengkap + impor (merge by id) — portabilitas antar perangkat = cara user "membawa" datanya `[D]`.
- FR-2.4 Meter storage (perkiraan byte per koleksi) + jumlah rekaman.
- AC: tambah memori → muncul di daftar & hitungan; ekspor → file JSON terunduh; impor file sama → duplikat tidak tercipta; hapus semua → IndexedDB benar-benar kosong.

### FR-3 Deteksi Pembayaran Lokal ("bayar akses, data tetap milikmu")
- FR-3.1 User menempel kwitansi JSON (format kanonik, bagian 5 di 04_DATA_SOVEREIGNTY.md) ke koleksi `receipts`.
- FR-3.2 Kernel memvalidasi struktur + checksum + masa aktif → menetapkan tier (FREE/PRO) yang disimpan lokal di profil user `[D]`.
- FR-3.3 Tier membuka: gerbang multi-perangkat & kuota endpoint naik; fitur dasar selalu gratis `[D]`.
- AC: kwitansi demo valid → badge PRO aktif + PRT mengumumkannya; kwitansi rusak → ditolak dengan alasan spesifik; hapus kwitansi → tier kembali FREE.

### FR-4 Gerbang Universal (API virtual tanpa server)
- FR-4.1 Kernel menyediakan router virtual: `handleKorteks(method, path, body, headers) → {status, json}` dengan semantik HTTP `[D]`.
- FR-4.2 Endpoint: `POST /v1/identity/verify`, `GET/POST/DELETE /v1/memory`, `GET/POST /v1/logs`, `GET/POST /v1/decisions`, `GET /v1/vault/export`, `POST /v1/payment/verify`, `GET /v1/system/status`, `POST /v1/prt/chat`, `GET /v1/connectome/summary` (detail: 05_INTEGRATIONS.md).
- FR-4.3 Konsol uji: pilih method+path, isi body, jalankan → tampilkan request & respons JSON nyata (diukur latensi).
- FR-4.4 Konfigurasi siap-tempel: MCP JSON (claude/opencode), Hermes HTTP bridge, curl.
- FR-4.5 Opsional (toggle): Service Worker `sw-korteks.js` mencegat `fetch('/api/korteks/...')` di browser yang sama → semantik endpoint nyata tanpa server `[D]`.
- AC: verify tanpa kunci → 401; tulis memori via gerbang → muncul di Vault; PRT chat via gerbang → jawaban kontekstual; status → JSON metrik hidup.

### FR-5 PRT — Agent Penjaga
- FR-5.1 Loop otonom (interval ±6 detik): patroli integritas vault, audit gerbang, perawatan statistik, deteksi anomali (lonjakan aktivitas), dengan jeda acak agar terasa hidup.
- FR-5.2 Setiap aksi masuk log aktivitas + memengaruhi vital (energi/fokus/suasana) + kadang menyapa di ticker.
- FR-5.3 Chat rule-based (tanpa LLM server): kenali pertanyaan tentang status, vault, gerbang, pembayaran, dirinya, dan otak lalat; jawaban memakai data nyata dari kernel.
- FR-5.4 PRT menjaga: menandai vault >80% kapasitas, kwitansi kedaluwarsa, identitas belum dibuat, dan mencatat "keputusan operasional" ke koleksi `logs` `[D]`.
- AC: diamkan 15 detik → minimal 1 log otonom baru; tanya "status?" → angka nyata; tanpa identitas → PRT menyarankan membuatnya.

### FR-6 Otak (visualisasi connectome)
- FR-6.1 Kanvas jaringan: ±160-200 neuron virtual dalam 7 region (mengikuti nama region FAFB nyata `[T]`), edges asosiasi, pulsa sinyal animatif.
- FR-6.2 Klik neuron → panel detail (nama katalog, region, derajat, sinapsis virtual); statistik makro ditampilkan sebagai angka nyata FAFB/Janelia dengan kredit sumber `[T]`.
- FR-6.3 "Peta fungsi" region ↔ modul platform (lihat 03_ARCHITECTURE.md §2) — visual edukatif yang membingkai platform.
- AC: graf dirender < 1 dtk; klik neuron → detail terisi; angka makro cocok dengan sumber `[T]`.

### FR-7 Non-fungsional
- NFR-1 Tanpa server: build statis, deployable ke hosting statis mana pun `[D]`. Tidak ada Python, tidak ada Prisma/API route di produk.
- NFR-2 Anti-slop: tema laboratorium-saraf malam yang khas (bukan gradien ungu generik), tipografi monospace katalog, tekstur grid/scanline, label spesimen; setiap panel punya data hidup, bukan lorem ipsum.
- NFR-3 Responsif mobile → desktop; footer menempel bawah; aksesibilitas dasar (label, kontras, fokus keyboard).
- NFR-4 Seluruh UI & dokumen berbahasa Indonesia (istilah teknis boleh Inggris).
- NFR-5 Privasi: nol request jaringan keluar (kecuali font/aset lokal); tidak ada telemetri `[D]`.

## 5. Skema Data & Kontrak (ringkas — detail di 04)
- Koleksi: `identity`, `memories`, `logs`, `decisions`, `receipts`, `gateway_log`, `prt_events`, `settings`.
- Setiap rekaman: `id`, `ts`, `type`, `payload`, `tags?`, `source` (ui|gateway|prt).
- Kunci API: `FK1_` + hex(sha256(username|password)) `[D]`.

## 6. Metrik Keberhasilan (v1 → 90 hari) `[H]`
- Aktivasi: ≥60% pengunjung baru membuat identitas lokal dalam sesi pertama.
- Kedalaman: median ≥8 rekaman vault per user aktif minggu-1.
- Integrasi: ≥25% user aktif menjalankan ≥1 request gerbang non-demo; ≥10% menempel konfigurasi MCP ke alat nyata.
- Retensi: ≥30% user kembali minggu-4 (didorong PRT + memori yang makin berguna).
- Narasi: dampak organik (share/screenshot atlas + PRT) — proxy: kunjungan berulang tanpa kampanye.

## 7. Rilis
- **v0.2 (ini):** keenam view lengkap, kernel penuh (vault, gerbang, PRT, deteksi pembayaran, atlas), dokumen konsistensi. Kriteria done: AC FR-1..FR-6 lolos + verifikasi browser.
- **v0.3:** sinkronisasi file (folder lokal via File System Access API), kriptografi at-rest opsional per koleksi.
- **v1.0:** endpoint edge nyata (Cloudflare Worker stateless) untuk akses lintas-perangkat opsional; MCP resmi di registry; monetisasi aktif setelah konfirmasi lisensi `[T]`.

## 8. Risiko & Mitigasi
| Risiko | Dampak | Mitigasi |
|---|---|---|
| Verifikasi kwitansi bisa dipalsukan di v0.2 (validasi lokal) | Kehilangan pendapatan `[H]` | Dokumen jujur; v1.0 pakai kwitansi bertanda tangan mitra + canary publik; demo memakai kwitansi demo resmi |
| IndexedDB terhapus browser | Kehilangan data user | Edukasi ekspor rutin + PRT mengingatkan; v0.3 sinkronisasi file lokal |
| Ekspektasi "kesadaran" berlebih | Reputasi | Framing terkunci: operational awareness `[T]`; disclaimers di UI & dokumen |
| Lisensi data connectome | Hukum | Tidak menjual data; hanya statistik makro beratribusi; konfirmasi tertulis sebelum monetisasi `[T]` |
