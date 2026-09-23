# Changelog — CIVITAS OS

Semua perubahan penting proyek ini didokumentasikan di sini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/); versi mengikuti [SemVer](https://semver.org/lang/id/).

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
