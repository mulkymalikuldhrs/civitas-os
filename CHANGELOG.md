# Changelog — CIVITAS OS

Semua perubahan penting proyek ini didokumentasikan di sini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/); versi mengikuti [SemVer](https://semver.org/lang/id/).

## [1.1.0] — 2026-09-24 · "SELF-LIFE"

Mandat pemilik: upgrade ekosistem — self server, self backup, self sync, self life,
dokumen digabung satu, MCP + CLI, endpoint + host + daemon, multi-server all-in-one
(Bedrock + Java + semua), testing Minecraft nyata, finalisasi + review.

### Ditambahkan — MULTI-SERVER ALL-IN-ONE
- `servers.ts`: registry server di kernel (CivKV `servers.registry`) — default 3 target:
  **local-bedrock** (PocketMine-MP, managed), **local-java** (Purpur/Paper/vanilla, managed),
  **aternos** (remote). Status = ping NYATA per edisi: Bedrock RakNet UDP, Java legacy TCP
  Server List Ping (0xFE/0xFF, format modern & lama).
- `scripts/java_server.sh`: supervisor Java — unduh otomatis dengan fallback 3 sumber
  (PaperMC → Purpur → Mojang vanilla; sandbox memblokir PaperMC, Purpur terbukti unduh
  53 MB), eula auto, FIFO konsol, RAM via `CIV_JAVA_RAM`.
- Aksi lifecycle `start|stop|restart|status` dgn VERIFIKASI PING pasca-aksi (sukses hanya
  bila dunia benar-benar merespons). Endpoint `/api/civos/servers` (GET/POST) + action
  `server_action`. UI: panel REGISTRY SERVER di tab DUNIA (start/stop/restart per server).
- **Bukti dunia nyata: Bedrock PMMP online 4–11 ms DAN Java Purpur 1.21.1 `Done (50.7s)`
  online 4–5 ms — hidup BERSAMAAN dalam satu kernel.**

### Ditambahkan — SELF-LIFE (daemon · backup · sync · doctor)
- `selflife.ts`: `backupAll()` (tar.gz dunia+db+config, manifest sha256, retensi 7,
  jadwal 6 jam), `gitSync()` (commit bila berubah + push 4 remote, token transient dari
  `/home/z/.gitcreds` di LUAR repo — tidak pernah masuk git/config), `doctor()` (9 cek:
  db, config, tiap server, backup, git-tree, git-creds, secret-scan, disk, LLM SDK),
  `selfLifeTick()` (watchdog server autoStart + denyut peradaban + backup/sync jadwal).
- `scripts/civitas_daemon.sh` + `scripts/civitas_selflife_tick.ts`: daemon 24/7 loop 30 dtk
  via bun — **hidup tanpa web app**; log `backups/daemon.log` dengan rotasi.
- Endpoint: `/api/civos/backup`, `/api/civos/git`, `/api/civos/selflife`, `/api/civos/doctor`.
- Config baru: `mc.remoteHost`, `backup.keep`, `backup.intervalHours`, `sync.intervalMinutes`.

### Ditambahkan — MCP SERVER + CLI
- `scripts/civitas_mcp_stdio.mjs`: CIVITAS sebagai **server MCP** (JSON-RPC 2.0 stdio) —
  **13 tools** (status/pulse/selflife/backup/sync/doctor/server_list/server_action/census/
  chat/tool_run/config_get/config_set); HTTP-first ke kernel (15 dtk), fallback `bun`
  subprocess ke kernel saat web app mati; pending-safe exit (bug satu-shot ditemukan & diperbaiki).
- `bin/civitas.mjs` — CLI `civitas`: 17 perintah (status, pulse, selflife, doctor, census,
  chat, server list/action, backup, sync, tool, config, events, daemon, mcp, version, help);
  `CIVITAS_URL` dapat diarahkan ke host lain.
- `package.json`: bin `civitas` + script `daemon`, `mcp`, `backup`, `sync`, `doctor`.
- chat_send kini menerima `villagerCode` opsional (auto-pilih warga aktif pertama).

### Diubah — DOKUMENTASI DIGABUNG SATU
- **`docs/CIVITAS_OS_MASTER.md`** = satu-satunya dokumen rawatan (17 bagian: visi,
  arsitektur, kanonik, ekonomi, keamanan, multi-server, self-life, endpoints, CLI, MCP,
  konfig, pengujian, playbook, roadmap, ADR, sejarah, kredit).
- Dokumen per-Slice lama (PRD/ARSITEKTUR/KANONIK/ROADMAP/EKONOMI/KEAMANAN/OPERATIONS +
  ADR-0001..0009) dipindah ke `docs/archive/` (arsip historis).
- README v1.1: fitur self-life/MCP/CLI/multi-server + panduan cepat + konfig Claude Desktop.

### Diperbaiki — KEAMANAN & HIGIENE
- Service key Supabase NYATA yang tertanam di `scripts/test_supabase_real.mjs` disanitasi
  jadi env-var (push publik 100% bebas rahasia — scan `doctor` permanen).
- `db/custom.db` (runtime state) & `backups/` dikeluarkan dari git — repo publik bukan
  tempat state hidup; backup dilakukan via self-backup ber-manifest.
- CLI/MCP: timeout pendek + fallback jujur (Caddy proxy menyebabkan hang saat app mati).

### Bukti verifikasi (runtime)
- MCP: initialize + tools/list (13) + tools/call backup/doctor/status — semua berbalas.
- CLI: status (3 server), pulse LLM nyata (KOTA-01 patroli; COMP-001 glm-4-plus),
  chat warga "Zahra" menjawab, backup list, doctor 9 cek.
- Bot: join dunia nyata, sensus 8 villager (1 baru), 10 entitas SYNCED.
- Sync: push 3 GitHub OK @7ceba9c (GitLab jaringan — diulang otomatis daemon).
- tsc 0 error; lint 0 error.

## [1.0.0] — 2026-09-23 · "REALITY"

Mandat 15 poin pemilik: realitas penuh, UI baru, konfigurasi via UI, docs rapi, interaksi langsung.

### Ditambahkan — REALITY LAYER
- **Server Minecraft lokal nyata**: PocketMine-MP 5.44.3 (Bedrock 1.26.30, protokol 1001) + supervisor `scripts/pmmp_server.sh` (FIFO konsol, anti prompt-spam, autostart bersih).
- **Plugin CivitasBridge 1.0.0** (PHP, `.phar`): `/civ summon|setblock|fill|census|spawninfo` — summon villager asli, pasang blok FISIK (`/civ fill`), audit konsol penuh.
- **Bug protokol RakNet ditemukan & diperbaiki**: format unconnected_ping yang benar `[id][time8][MAGIC16][guid8]` + parser pong `len@33` — ping kernel sebelumnya selalu salah baca (Aternos tampak "tidur" walau mungkin hidup).
- **Bot CIVITAS_AGENT v2**: join dunia nyata, sensus CENSUS mengikat 8/8 villager asli (warga SIM mundur otomatis), chat `category:1` sesuai skema 1.26.30, eksekusi direktif SPEAK/MOVE/PATROL/**BUILD fisik**, auto-summon desa kosong via konsol lokal.
- **Chat dunia 2 arah**: bot membaca chat pemain in-game → merutekan ke otak warga → warga menjawab dari dalam dunia.

### Ditambahkan — KERNEL SLICE 10
- `config.ts`: konfigurasi runtime via UI (DB → env → default), secret dimasking, efektif tanpa restart (host/port MC, auto-join/summon, model otak, Supabase, settlement, URL harga, MCP).
- `chat.ts`: otak percakapan warga (kepribadian + ingatan) + `CivChatMessage` (channel DASHBOARD/WORLD, relay direktif SPEAK).
- `console.ts`: jembatan konsol server lokal (FIFO + parse log, audit `CivConsoleLog`).
- `mcp.ts`: klien MCP nyata — transport HTTP JSON-RPC & STDIO spawn; `tools/list`, `tools/call`; registry `CivMcpServer`; tool `mcp_call` di Toolforge dengan charter (NETRUNNER/TOOLSMITH) + audit.
- **Anti-simulasi kuant**: harga dari API pasar nyata (Binance publik, dikonfigurasi); sumber mati → `PAUSED` jujur, harga fiktif dihapus total.
- **Supabase test-suite** (mandat #9): ping, auth, struktur 4 tabel + kolom, roundtrip tulis/baca/hapus — laporan per-cek jujur di UI (kredensial via Konfigurasi; env lama hilang antar sesi sandbox).
- API baru: `/api/civos/chat`, `/api/civos/graph`, `/api/civos/docs`; aksi baru: `chat_send`, `config_put`, `config_test`, `mc_console`, `mc_summon`, `mcp_add/remove/call`.

### Diubah — UI REWRITE (mandat #3)
- **CIVITAS COMMAND CENTER** bergaya Minecraft penuh: panel bevel, `Press Start 2P` + `VT323`, hotbar nav 12 slot, bar XP, ticker otonom, polling state 4 dtk.
- 12 view baru: Citadel, Peta (kanvas piksel + kartu identitas), Warga (chat langsung), Guild/Toolforge, Pemerintah, Perusahaan, Ekonomi, Dunia (server+bot+konsol+chat dunia), Konfig, Arsitek (graph interaktif), Pustaka (docs viewer), Event.
- Halaman depan kini milik peradaban; shell FlyBrain lama didekomisionasi dari rute (kode tetap arsip).

### Ditambahkan — DOKUMEN & META
- README baru: header SVG animasi (judul bergerak) + banner piksel hasil generate, panduan main live lokal/online, kredit developer.
- `CHANGELOG.md` ini; `docs/OPERATIONS.md`; indeks & peta arsitektur otomatis (`scripts/filegraph.mjs` → 198 file / 476 sambungan → tab ARSITEK + `docs/FILE_INDEX.md`).

### Diperbaiki
- `mcbot`: skema `command_request` 1.26.30 (`origin{type:"player",uuid,request_id,player_entity_id}`, `internal`, `version`) — perintah dunia tidak lagi gagal `SizeOf`.
- `state.mcServer` kini menampilkan target EFEKTIF (config), bukan konst PRD.
- Restart dev server + pembersihan cache Turbopack setelah push schema Prisma.

## [0.2.0] — 2026-09-23 · "GUILD & TOOLFORGE" (Slice 9)

### Ditambahkan
- GUILD KERJA 8 divisi (CODER/DEV/BUILDER/MILITARY/ENGINEER/MINER/NETRUNNER/TOOLSMITH) dengan charter tool deterministik di kernel.
- TOOLFORGE: `web_search`/`page_reader` internet NYATA (URL sumber terekam), `code_write`, `spec_write`, `build_plan`, `mine_route`, `patrol_report` — audit `CivToolCall` + artefak `CivArtifact`.
- Dashboard depan pertama (CIVITAS COMMAND CENTER v0) + kartu guild + Toolforge interaktif.
- ADR-0009; invarian 46 → 57 PASS.

## [0.1.x] — 2026-09-22/23 · KERNEL + WARGA (Slice 1–8)

### Ditambahkan
- Civilization Kernel: ledger double-entry, event immutable, policy engine, LLM Router (reflex-first), memori scoped ACL, seed idempoten.
- Pemerintahan 4 institusi; perusahaan 13-state; pajak otomatis; kota Bandar Langit.
- VILLAGER ASCENSION (Slice 7): sensus desa, denyut warga ber-LLM, dompet FLR.
- VILLAGER EMBODIMENT (Slice 8): direktif tubuh (mesin status tanpa kebangkitan), pasar desa (matching termurah), cron denyut 24/7.
- Mirror Supabase Dhaher Labs (ADR-0005) + rail settlement eksternal sandbox/live-lock (ADR-0006).
- Bot Minecraft armed (bedrock-protocol, runtime-only import — ADR arsip OOM Turbopack).
- ADR-0001…0008; invarian hingga 46 PASS.

## Kebenaran tersisa (jujur, berjalan)
- Revenue eksternal riil = 0 (butuh customer nyata; gerbang pemilik).
- Aternos tidur otomatis — kebangkitan hanya dari akun pemilik; semua jalur bot/sensus/direktif tetap ARMED.
- Kredensial Supabase antar sesi sandbox tidak persisten — diisi kembali via tab Konfigurasi (ujian 9 langkah tersedia).
