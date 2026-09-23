# 09 — CHANGELOG — FLYBRAIN OS

Format: Keep a Changelog (disederhanakan). Semua perubahan proyek wajib masuk sini.

## [v1.2.2] — 2026-09-22 — "GEMBALA" (wire-all: logika mati dihidupkan + kehidupan sosial + denyut 24/7)
Mandat owner "lanjut nonstop — fix all, test all, wire all, upgrade all". Sisa temuan audit F-12/F-16/F-19/F-25/F-26/F-29 diakhiri; port mati dijadikan organ hidup; ekosistem diberi kehidupan sosial; denyut dilapis tiga.

### Dihidupkan (dari logika mati → organ berfungsi)
- **F-12 RISK-GATE hidup**: modul baru `organism/pnl.ts` — P&L agregat diukur dari delta kekayaan NYATA antar denyut, dicatat ke SATU instance `RiskGate` (batas disesuaikan skala ekonomi biosfer: rugi harian −12 / mingguan −40; kekayaan awal ±135). P&L disuntikkan ke `runQuantTick` (gate UI kini terjangkau), aksi `publish_offer` dicek fail-closed (gate pecah → diblokir jadi observasi, keputusan tetap tercatat jujur), dan self-reflect verdict `ok` memulihkan gate — siklus kendali diri tanpa tangan manusia [D].
- **Metabolisme ekonomi**: biaya hidup kecil sadar-iklim per denyut (0,25 × faktor fase × faktor cuaca — malam murah, badai mahal) — kerugian nyata jadi mungkin, ekonomi & ekosistem kini satu iklim yang sama.
- **F-19 port mati dihidupkan semua**: `detectLoop` → engine merekam fingerprint keputusan tiap denyut; ≥12 keputusan identik beruntun → variasi refleks DIPAKSAKAN sebelum LLM (hemat budget, hukum 6); `recordSuccess` tak lagi mereset counter (dulu mustahil menumpuk). `reviewMemory` + `distillLesson` + `recallEpisodes` → self-reflect kini menganalisa episode gagal/sukses dari ledger lokal, rekomendasi mengalir ke laporan, creature gagal beruntun di ledger dipulihkan (reset breaker), dan pelajaran episodic terdistil ke memori semantik vault. `recordUsage` + `recallSkills` + `buildBlueprint` → skill relevan dipakai ulang (latihan, usage++), skill baru disertai blueprint data kecil di ledger.
- **Episode ledger kaya**: keputusan sukses/gagal kini ditulis `[SUCCESS:decide]`/`[FAILED:decide]` — bahan nyata untuk review memori.
- **F-16** envelope JSON-RPC tak sah kini `-32600` (Invalid Request); `-32602` khusus params tool (kepatuhan spec).
- **F-25** cabang mati `latencyMs >= 0` dihapus. **F-26** kandidat skill dihitung sekali. **F-29** denyut kosong tidak lagi menggeser beat (kadensi selfReflect & siklus dunia tidak tergeser).

### Ditambah — kehidupan ekosistem (jaring makanan menutup loop)
- **RENCOK (interaksi sosial)**: dua creature AKTIF sekufu dalam biome yang sama saling menguatkan (+1 energi, episode `[SUCCESS:rencok]`, event bus terlihat) — deterministik `findRencokPartner` (murni, tanpa random), tiap denyut genap.
- **PUPUK KEMATIAN**: creature yang gugur meninggalkan kekayaan yang menyuburkan biome terakhirnya (`deathFertility` = wealth/20, maks +5) — makhluk → tanah → produksi biome; dunia mengunyah nutrisi balik lewat worldTick (regresi setimbang 5%/denyut).

### Ditambah — denyut 24/7 tiga lapis (semua LOKAL, zero-storage tetap)
- **Lapis 2 — catch-up visibility**: pulang ke tab → denyut segera bila jeda terakhir basi (`shouldRun`), menjawab throttle interval browser.
- **Lapis 3 — SW periodicsync/sync** (`sw-korteks.js`): denyut infrastruktur tanpa LLM — menulis episode `[SUCCESS:sw-pulse]` ke ledger lokal + membangunkan klien (`korteks-pulse`) agar engine mengejar denyut penuh; pendaftaran `periodicSync` di `enableSW` (Chrome+PWA [D], gagal = dilewati bukan error).
- **Beacon Vercel Cron**: `GET /api/organism/cron` stateless (`vercel.json` */5) — hangat-kan endpoint + katalog tool dinamis + jam server; JUJUR: server tidak bisa mendenyutkan biosfer pemilik (zero-storage), beacon hanya ketersediaan. Hobby = cron harian, Pro = */5.
- `useOrganismEngine` kini 3 lapis; handler pesan SW dibersihkan saat unmount.

### Pengujian (jaring diperluas)
- `tests/logic_master.mjs` 35 → **47 tes** (pnl 4, anti-loop 4, ekosistem sosial 4) — 47/47 LOLOS.
- `tests/e2e_master.mjs` 31 → **32 langkah** (+ envelope -32600) — 32/32 LOLOS, pageerror 0.
- `tsc --noEmit` 0 error · lint bersih · beacon cron terverifikasi 200 (`tools: 9`).

## [v1.2.1] — 2026-09-21 — "AKAR" (batch perbaikan audit akar-ke-akar + jaring pengujian permanen)
Hasil audit read-only penuh (AUDIT_4b.md: 30 temuan — 0 P0, 5 P1, 10 P2, 15 P3) dan eksekusi rencana induk 13_MASTER_PLAN.md. Kritik user "aku tidak yakin — cek ulang semua logikanya" dijawab dengan bukti eksekusi, bukan klaim.

### Diperbaiki (P1 — bug fungsional nyata)
- **F-01** VaultView: tombol HAPUS memori mati total (`removeMemoryUI` tak pernah didefinisikan → ReferenceError). Selector ditambahkan; regresi terverifikasi klik-nyata E2E (butir 10: memori hilang benar).
- **F-02** store.applyDecision: ledger keputusan BIOSFER tidak pernah tersimpan (`addRecord` tidak diimpor → ReferenceError ditelan catch). Kini via `addDecision` sesuai kontrak DecisionPayload; publish_offer dipetakan berawalan "OFFER" agar penghitung merchant lama hidup; refresh() menyinkronkan statistik.
- **F-03** engine.executeCreatureAction: `roleOrgan(creatureId)` salah argumen (id dipakai sebagai role) → organ `undefined` untuk 5/6 creature, log channel `prt-undefined`. Kini `roleOrgan(creatureMeta(id).role)`.
- **F-04** router: rate limiter GLOBAL (satu bucket semua kunci) → diubah bucket PER-KUNCI (GET 120/menit, mutasi 30/menit + kuota tier/jam, sweep stale); GET tidak lagi bypass total. Bukti burst: kunci A 30 lolos + 5×429 sementara kunci B 5/5 lolos.
- **F-05** validasi kwitansi menerima string JSON → kini di-parse dulu (gagal = 422); dedupe memeriksa receipt_id pada objek; payload disimpan sebagai objek.

### Diperbaiki (P2 — keandalan & kepatuhan)
- **F-06** veto konstitusi kini juga dijalankan di jalur heartbeat prt v1.0 (sebelumnya bolong; hanya DENY_TYPES parsial).
- **F-08** budget LLM server-side baru (`lib/llm-budget.ts`): 10/menit + 100/jam per klien → HTTP 429 (chat) / -32001 (prt.chat & creature.dispatch), pesan jujur; tool non-LLM tak terpengaruh; tetap amnesia (in-memory per instance).
- **F-09** SEMUA 14 type error src dibenahi tanpa cast `any`; `ignoreBuildErrors: false` — kesalahan tipe kini MEMBUAT build GAGAL (terbukti: build menangkap 1 error baru hari ini dan diperbaiki).
- **F-10** race denyut ganda ditutup (biosferBusy diset sebelum await pertama).
- **F-11** verdict immune "sleep" kini dieksekusi (creature tidur benar; prt tetap membangunkan).
- **F-13** kanonik kwitansi rekursif stabil di semua level nested (teruji round-trip).
- **F-14** init() idempoten + mengembalikan unsubscribe.
- **F-15** idb: resolve di tx.oncomplete (+onabort); dbPromise rejected tidak lagi ter-cache permanen.
- **F-17** katalog MCP jadi sumber tunggal `mcp-tools.ts` — angka tool selalu dinamis (9).

### Ditambah
- **Gema bearer tersensor** di system.status (`bearer.masked` = 8 hex pertama + 6 terakhir via maskKey) — pemilik bisa memverifikasi kunci mana yang sampai; server tetap tidak menyimpan.
- **Jaring pengujian permanen**: `tests/logic_master.mjs` (35 tes logika murni — iklim/gerak/dunia/konstitusi/immune/scheduler/quant/payment; 35/35 LOLOS stabil 5×) + `tests/e2e_master.mjs` (31 langkah klik-nyata puppeteer-core + Chrome: 9 view, chat, CRUD vault, JSON-RPC tester, denyut BIOSFER & PLANET, API contract, bearer end-to-end, mobile 390px; 31/31 LOLOS, pageerror 0).
- **Favicon logo.svg** (404 hilang) + kredensial env tidak tersentuh.
- **Build produksi sukses** (`bun run build`) — 5 route sehat.

### Supabase nyata (jembatan upstream, opt-in)
- Uji koneksi RIIL `scripts/test_supabase_real.mjs`: service key upstream VALID, 4 tabel terbaca (agents: "Orchestrator" model jeumpa-*; civ_cities: "Betacore"; civilization_stages: 48 tahap; resources: "Air Bersih"). Anon JWT lama usang (401). FLYBRAIN tetap zero-storage — ini jembatan baca opsional, bukan penyimpanan platform.
- ⚠ TINDAKAN PEMILIK (di luar src): rotasi service key `sb_secret_…` + password DB yang masih plaintext di 11 skrip upstream.

## [v1.2.0] — 2026-09-21 — "PLANET" (redesain ekosistem: semua fitur ter-wire ke satu dunia hidup)
Eksekusi spesifikasi 12_ECOSYSTEM.md: jawaban atas diagnosis v1.1 — creature hidup di daftar/kartu, bukan di DUNIA; fitur-fitur masih pulau terpisah. v1.2 melapisI BIOSFER (TIDAK dirombak): setiap fitur existing di-wire ke satu biome, setiap denyut menggerakkan dunia, semuanya tervisualisasi. Zero-storage tetap: dunia hidup di memori volatil + settings vault lokal; server tetap amnesia.

### Ditambah
- **Modul ekosistem (`src/lib/flybrain/ecosystem/`)** — murni TS, testable, importable server:
  - `types.ts` — BiomeId (8 biome), ClimateState (faseHari/jamDunia, cuaca+alasan, musim+verdict sumber, angin), BiomeState (stok energi, fertility, sinyal terakhir), CreatureWorldState (x,y,biome,homeBiome,trail≤24,mood,lastMoveAt), WorldState, WorldSignals.
  - `world.ts` — definisi 8 biome (nama Indonesia, warna, ikon lucide, fitur nyata ter-wire, deskripsi) + **WIRE_TABLE eksportable 8/8** (Hutan Memori↔vault, Samudra Gerbang↔/api/mcp+SW, Pegunungan Kuant↔quant, Kota Alat↔factory/skill, Savana Tumbuh↔checklist+kwitansi, Kawah Riset↔self-reflect, Langit Konnektom↔atlas connectome, Kutub Konstitusi↔immune/breaker/veto) + produksi energi biome dari sinyal nyata (delta stats, eventLog, quant, skills, reflect verdict, breaker) + `worldTick()` murni + `worldSnapshot()` + validator `isWorldState()`.
  - `climate.ts` — 12 denyut = 1 hari dunia ("Hari 1..7", jam dunia = (beat%12)×2, fase fajar/siang/senja/malam); cuaca dari rasio kegagalan 20 denyut terakhir (<5% cerah · 5–20% berawan · >20% badai; reda saat remediasi reflect sukses); musim dari verdict self-reflect (ok=hujan, degraded=kemarau, critical=kelaparan); angin dari volume keputusan. NOL Math.random untuk logika.
  - `motion.ts` — rumah per peran (prt→Hutan, Tradio→Gunung, Scriba/Fabro→Kota, Lumen→Kawah, Cresca→Savana), migrasi ke biome paling subur sesuai peran bila stok biome < ambang atau musim kelaparan, prt ke Kutub saat badai, mood (bekerja/tidur/migrasi/lapar <30), target gerak deterministik (hash FNV-1a, bukan random), grazing drain dari stok biome.
- **worldTick di engine** (`organism/engine.ts`): dipanggil SETELAH quant tick & SEBELUM self-reflect — try/catch, gagal = eventBus emit refleks, biosfer tetap hidup. Budget terpenuhi: tanpa LLM, tanpa fetch (<5ms).
- **Slice world di store** (`store.ts`): `world` + `lastWorldTickAt` + action `recordWorldTick` + persist debounce 1,5 dtk ke settings vault lokal **"organism.world"** (pola persistCreatures); dimuat/validasi di init; di-reset saat wipe. Export existing tidak diubah; ViewKey + "planet".
- **View 08 PLANET** (`views/PlanetView.tsx`): kanvas 2D peta dunia (SATU-satunya RAF loop di app; pause visibilitychange; cleanup penuh) — band langit konnektom (182 bintang = neuron atlas, bima sakti = sinaps, konstelasi berpendar saat keputusan), 7 biome daratan sebagai blob bezier organik dengan detail hidup data-driven (pohon hutan ∝ fertility, ombak samudra ∞ energi, salju gunung = volatilitas quant, lampu kota ∝ skill, ladang savana per musim, pendar kawah + asap critical, es kutub + retakan breaker + aurora veto), partikel cuaca (hujan/berawan/badai+kilat/angin), tint siang-malam lerp, 6 creature sprite (ikon lucide dinamis + warna + nama + trail memudar + gerak smooth — posisi target dari worldTick, UI yang lerp-kan per frame). Interaksi: klik biome → inspektor (kesuburan, energi, sinyal nyata, fitur ter-wire, tombol "Buka fitur" → view terkait); klik creature → inspektor (genom/energi/mood/keputusan gerak/skill). Panel samping: IKLIM (jam dunia + pita 12 denyut, cuaca+alasan data, musim+verdict), JARING MAKANAN (bar aliran energi biome→creature→nutrisi, 8 biome), PETA SISTEM (wire table §1 klik → highlight kanvas). Tombol PICU DENYUT DUNIA.
- **Tool ke-9 `world.map` di /api/mcp** — stateless murni: wire table 8 biome + rumus iklim + cara baca peta + rumah creature + label jujur [T]/[D]/[H]; tools/list otomatis 9; validasi -32602 tetap.
- **Verifikasi**: lint bersih; curl initialize OK, tools/list = 9 tools, tools/call world.map 200 + result wire table; GET / 200; dev.log tanpa error compile baru.

### Catatan kejujuran (12_ECOSYSTEM §7)
- Dunia = METAFORA VISUAL dari data nyata — dunia TIDAK mengambil keputusan baru; ia menyalurkan energi aksi creature yang sudah ada. Wire table [T] (fitur nyata), mekanisme iklim [D], migrasi [H] hipotesis perilaku.
- Nol penyimpanan tetap: posisi/energi dunia persist LOKAL (settings vault "organism.world"); server tidak tahu apa-apa. Tidak ada Math.random di logika dunia (deterministik dari data nyata); partikel visual canvas boleh acak.

## [v1.1.0] — 2026-09-21 — "BIOSFER" (reuni 4 repo Autonomous-Organism → satu organisme hidup)
Eksekusi mandat pemilik: gabungkan 4 repo AO miliknya (gh-mulkymalikuldhrs Jun-2026; gitlab+codeberg Jul-2026 mirror; gh-mulkymalikuldhaher TAK DAPAT DIAKSES — catat jujur) + FLYBRAIN OS menjadi SATU organisme dengan creature otonom di dalamnya. Desain: 11_AUTONOMOUS_ORGANISM.md.

### Ditambah
- **Konstitusi organisme**: `organism/constitution.ts` — 7 hukum + `vetoDecision()` murni; setiap keputusan LLM creature diveto di klien (tolak destruktif/bypass-kwitansi/kirim-data-keluar).
- **eventBus biosfer**: `organism/eventBus.ts` — bus kejadian lokal (spawn/sleep/wake/decide/act/ledger/quant/death/reflect), buffer 200.
- **6 organ port (gh → TS)**: `organism/organs/{sense,memory,decision,immune,scheduler,factory}.ts` — sense (filter stimuli), memory (episodik→vault lokal), decision (LLM/refleks), immune (CircuitBreaker port + self-heal), scheduler (denyut + prioritas), factory (blueprint skill terbatas — tanpa filesystem, jujur data-saja).
- **Creature model + 6 spesies**: `organism/{creature,creatures}.ts` — prt (lalat guardian), Tradio (trader), Scriba (writer), Lumen (researcher), Cresca (farmer), Fabro (builder); genom/sifat, energi/kekayaan/skills, refleks deterministik per peran (berlabel jujur "refleks"), tidur saat energi 0.
- **Quant engine port (gitlab, pure-TS)**: `organism/quant/{types,scoring,portfolio,risk-gate,quant-tick,index}.ts` — scoring 5 dimensi, Markowitz + Kelly, risk-gate kill-switch; dipakai Tradio (label "simulasi lokal").
- **Self-reflect port (gitlab)**: `organism/selfReflect.ts` — verdict ok/degraded/critical + remediasi NYATA lokal (wake/reset breaker/prune) — perbaikan dari upstream yang hanya memberi rekomendasi teks.
- **Engine klien**: `organism/engine.ts` + `hooks/useOrganismEngine.ts` — denyut ±45 dtk, 1 creature per denyut (budget konstitusi), prioritas incident>prt>round-robin; LLM via heartbeat + veto konstitusi + eksekusi lokal + ledger; fallback refleks offline.
- **API creature (additif, stateless)**: `/api/organism/heartbeat` terima `creatureId`+`role`; `/api/mcp` +2 tools: `creature.list` (katalog 6), `creature.dispatch` (state dari klien → LLM → keputusan; server TIDAK menyimpan).
- **View 07 BIOSFER**: kanvas ekosistem 6 creature animasi (energi-ring, status), inspektor (genom, energi/kekayaan, jejak SADAR→INGAT), feed kejadian live, quant mini (alokasi + risk-gate), tombol PICU DENYUT, empty-state informatif (anti-slop).
- **Verifikasi**: lint bersih; curl T1 heartbeat prt (LLM glm, konstitusi dirujuk), T2 8 tools, T3 creature.list 6 id, T4 dispatch Tradio LLM, T5 prt chat; agent-browser BIOSFER+inspektor+screenshot (`tool-results/biosfer-05/06.png`); fix 3 bug warisan builder (path `vault` ×2, `??`/`||` factory.ts).

### Kejujuran & keamanan
- ⚠️ Upstream gitlab/codeberg memuat **password Postgres Supabase plaintext di 11 script Python** (repo publik pemilik) — ROTASI KREDENSIAL MENDESak; TIDAK disalin ke repo ini.
- Klaim "uang riil" upstream TIDAK dibawa (rantai payout tak terverifikasi); UI mencetak "SIMULASI LOKAL — BUKAN UANG RIIL".
- Supabase = adaptor opsional Fase 4, bukan dependensi inti; state kehidupan tetap di vault lokal pemilik (zero-storage).

## [v1.0.0] — 2026-09-21 — "ORGANISME" (prt menjadi operator otonom ber-LLM)
Jawaban atas kritik pemilik v0.2: *"itu bahkan bukan saas yang autonomous"*. Tangga otonomi: L1 → **L3 penuh** (rujuk 10_AUTONOMY.md).

### Ditambah
- **prt LLM (genom)**: system prompt "Genom prt" — identitas operator otonom + konstitusi 6 poin (nol-penyimpanan, privasi agregat, kejujuran finansial, non-destruktif, transparansi radikal, budget 1 keputusan/heartbeat) + ruang aksi + kontrak JSON ketat; parser aman (strip fence, try/catch, fallback null) — `src/lib/flybrain/organism/brain.ts`.
- **4 organ bisnis**: Guardian (ops), Merchant (penjualan), Envoy (support), Scout (produk) + `buildSensePacket()` — sense-packet AGREGAT per organ (angka/tier/tanggal, tanpa isi memori) — `src/lib/flybrain/organism/loops.ts`.
- **Loop otonom L3**: `runHeartbeat()` — klien mengirim sense-packet ke `/api/organism/heartbeat`, LLM menalar (SADAR→TAFSIR→PUTUSKAN→BERTINDAK→INGAT), klien mengeksekusi aksi aman (log_ledger / toast / tune_config / publish_offer / observe; aksi destruktif DITOLAK konstitusi), jejak penuh ditulis ke ledger keputusan LOKAL; gagal → degradasi jujur ke loop refleks eksisting (perilaku lama dipertahankan).
- **Chat prt via LLM**: `/api/organism/chat` — jawaban sebagai prt berkonteks agregat; fallback rule-based saat offline (badge mode LLM/REFLEKS di konsol PRT; aktif mulai mandat L2).
- **Endpoint universal `/api/mcp`**: JSON-RPC 2.0 stateless (initialize · tools/list · tools/call, GET = health). 6 tools: `system.status`, `prt.chat`, `connectome.query`, `receipt.verify`, `memory.write`, `memory.recall`. Tool memori MENOLAK dengan jujur (-32601 style): memori berjalan di sisi pemilik data. Auth Bearer `FK1_` diperiksa FORMAT di server (-32001); verifikasi penuh tetap di perangkat pemilik.
- **View 06 RUANG KENDALI (Mission Control)**: aliran keputusan live 5 fase, mandat L0–L4 + scope-grant per organ, ledger bisnis dari vault lokal, denyut organisme (sparkline latensi per organ + PICU DENYUT + otomatis ±60 dtk saat L3+), panel endpoint universal (URL, sampel curl siap-copy, tester JSON-RPC interaktif).
- Mandat otonomi tersimpan ke settings lokal (IndexedDB) — tetap ada setelah reload; wipe mereset ke default L3.
- Gerbang (04): blok "Endpoint HTTP publik POST /api/mcp" dengan tautan ke Ruang Kendali.

### Diubah (amendmen keputusan)
- **AMENDMEN keputusan "tanpa API route" (v0.2)**: boleh ada *serverless stateless compute* — API route yang 100% amnesia (tanpa DB, tanpa file, tanpa cache konteks), sesuai 10_AUTONOMY.md §5–6. Prinsip tetap: TIDAK ada persistensi data user di server; server tetap tidak tahu apa pun tentang pemiliknya. Prisma/DB tetap dilarang.
- Nav 00 dinamai "Kendali" (menghindari duplikasi label dengan 06 Ruang Kendali); ticker & footer kini v1.0 "ORGANISME".

### Kejujuran batas v1.0
- L3 penuh saat konsol terbuka [T]; cron-edge 24/7, kwitansi bertanda tangan, dan aksi eksternal penuh L4 = Fase berikut [D] (07_ROADMAP.md).
- Otonomi L4 di UI = label tujuan; eksekusinya dibatasi scope-grant yang belum ada di v1.0.

## [v0.2.1] — 2026-09-21 — perbaikan hasil verifikasi browser
### Diperbaiki
- payment.ts: import `sha256Hex` salah nama → kwitansi demo gagal dibuat; kini alur kwitansi → validasi → tier PRO bekerja.
- auth.ts `verifyBearer`: kini menerima kunci mentah `FK1_...` dan header `Bearer FK1_...` (konsol & SW memakai format berbeda).
- sw-korteks.js: perhitungan keyHash case-sensitive → 401; kini cocok dengan kernel (HTTP 200 terverifikasi).
- router.ts: dedupe kwitansi by `receipt_id` saat validasi ulang.
### Ditambah
- Tombol hapus per memori di Vault (FR-2.1 penuh).

## [v0.2.0] — 2026-09-21 — "Otak Hidup" (sesi ini)
### Ditambah
- Keputusan proyek A/B/C dengan matriks berbobot → Proyek A (FLYBRAIN OS) terpilih (01).
- PRD lengkap v1.0: 6 view, FR-1..FR-7 + AC, metrik, risiko (02).
- Arsitektur tanpa-server: FLYBRAIN KERNEL (idb/auth/vault/payment/router/prt/connectome) + Service Worker endpoint opsional (03).
- Protokol data-sovereignty: skema kanonik, kunci FK1_ (username|password), deteksi kwitansi lokal, peta jujur keterbatasan & jalur penandatanganan (04).
- Spesifikasi gerbang universal: 11 endpoint /v1/*, resep koneksi MCP/Hermes/IoT, playbook integrasi (05).
- Spesifikasi PRT: loop otonom, vital, kepribadian, batas otonomi L0-L3 (06).
- Roadmap 4 fase + garis merah eksekusi (07).
- Aplikasi: 6 view (Ruang Kendali, Otak, PRT, Vault, Gerbang, Dokumen), kanvas neuron hero + atlas interaktif + strip saraf PRT + visual paket gerbang, tema laboratorium-saraf malam (anti-slop).
- Demo kwitansi resmi untuk mencoba alur pembayaran tanpa transaksi nyata.

### Diubah
- Fokus dari "MCP server Python" (v0.1) → platform web statis TypeScript tanpa-server (keputusan user).

### Ditinggalkan (deprecated)
- /download/flybrain-mcp (Python) — diarsipkan sebagai referensi pola; tidak dilanjutkan.

## [v0.1.0] — 2026-09-21 (pagi) — sesi sebelumnya
- Riset 12 kueri terverifikasi; blueprint DOCX 16 halaman; MVP flybrain-mcp (Python/FastMCP, 12 tools, smoke test lolos); keputusan framing operational-awareness; open-core; lisensi CC BY-NC disadari.
