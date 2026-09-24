# CANONICAL.md — CIVITAS OS (Kebenaran Terverifikasi)

Aturan: REALITY WINS. Status hanya boleh dinaikkan DENGAN BUKTI.
Diperbarui: 2026-09-23 | Agent: Super Z | Task ID 14 | Slice 1–9 + **Slice 10 (REALITY BRIDGE: dunia nyata lokal, chat 2 arah, config via UI, MCP, anti-simulasi kuant)** VERIFIED.

## Status Subsistem (dengan bukti)

| Subsistem | Status | Bukti |
|---|---|---|
| Civilization Kernel (Prisma/SQLite, 14 model Civ*) | **VERIFIED** | `prisma/schema.prisma`; db push sukses; state 200 |
| Ledger double-entry + likuiditas | **VERIFIED** | INV-1 ΣDEBIT=ΣCREDIT=100.060.000; INV-3 konservasi |
| Event bus immutable | **VERIFIED** | 171+ event; INV-2b |
| Policy engine (di luar LLM) | **VERIFIED** | INV-6/9; live-lock settlement 422 |
| LLM Router (zai glm-4-plus + REFLEX) | **VERIFIED LIVE** | CivTask.route LLM nyata di semua denyut company |
| Government 4 institusi | **VERIFIED LIVE** | REGULATORY registrasi; TREASURY alokasi+anggaran; EXECUTIVE pengadaan; **TAX otomatis 25,00 FLR dari settlement 250,00** |
| Company engine 13 lifecycle | **VERIFIED LIVE** | COMP-001 PROPOSED→ACTIVE; INV-7 |
| **Slice 6 — Rail settlement eksternal** | **VERIFIED** | sandbox 250,00 FLR `[SANDBOX-TEST]` tercatat; live terkunci (422 ADR-0006); metrik terpisah real=0/sandbox=250 |
| **Pajak otomatis** | **VERIFIED LIVE** | "TAX: pajak otomatis: 1 settlement → 25,00 FLR masuk kas pajak"; taxCollected=2500 minor |
| **Kota kedua Bandar Langit** | **VERIFIED** | KOTA-02 ACTIVE + 2.000,00 FLR anggaran pendirian + 3 entitas dunia baru (total 10) |
| **Kantor Kuant (paper-trading SIMULASI)** | **VERIFIED LIVE** | COMP-QUAN; denyut kuant: "Hari 1 (SIMULASI): harga 104.49 · posisi 0 · aksi HOLD"; FLR tak tersentuh |
| **Mirror Supabase Dhaher Labs** | **VERIFIED LIVE** | PostgreSQL 17.6; tabel `civ_mirror_*` + `civ_sync_log`; push 136 event/9 txn; inkremental cursor→171; anon=`[]` |
| Minecraft world layer (RakNet ping) | **VERIFIED — SERVER TIDUR** | ping nyata timeout (Aternos tidur); 10 entitas; **bot armed** (auto-join saat online; runtime-only import — fix OOM Turbopack) |
| API 5 endpoint | **VERIFIED** | state/heartbeat/action/minecraft/**sync** semua hidup |
| Dashboard 09+10 | **VERIFIED (browser)** | 8 screenshot + chip revenue split + tombol KIRIM BOT; 0 error konsol |
| External revenue riil | NOT_STARTED | REAL=0 jujur; alert "Rail eksternal teruji via SANDBOX" |
| Bot build nyata (place block) | NOT_STARTED | butuh sesi join hidup bersama pemilik |
| **Slice 7 — Sensus villager SIMULASI (berlabel jujur)** | **VERIFIED LIVE** | 8 warga VIL-0001..0008; auto-seed saat denyut desa pertama; event VILLAGER_ASCENDED |
| **Slice 7 — Denyut warga otonom (LLM)** | **VERIFIED LIVE** | WORK dibayar (Aji 2×0,60, Lestari 0,60 FLR); upah tertunda jujur saat kas org=0; SOCIALIZE (sosial 50→56); WANDER "mimpi jaga"; REFLEX fallback deterministik |
| **Slice 7 — Ekonomi dompet warga** | **VERIFIED** | WAGE/TRADE_INTERNAL di ledger sama; INV-17 konservasi 180=180−0; INV-20 limit VILLAGER_MAX_TX; INV-21 upah==WAGE_PER_WORK |
| **Slice 7 — Sensus NYATA dari dunia (packet)** | **ARMED** | parser AddEntityActor teruji (INV-22 a-c); bot auto-join saat server online → observeVillagers → CENSUS menggantikan SIM; server Aternos masih tidur (jujur) |
| **Slice 7 — UI tab DESA + panel 10** | **VERIFIED (browser)** | banner kejujuran, 8 kartu warga, DENYUT WARGA/SENSUS/MUNDURKAN SIM; 0 error konsol |
| **Slice 8 — Direktif tubuh (otak→tubuh)** | **VERIFIED LIVE (SIM) + ARMED (dunia)** | 4 direktif applied berlabel SIM (WORK_ANIM/SPEAK); klaim bot `tp @e[type=villager,x=120,y=64,z=120,r=3] 110 64 105` siap dunia; mesin status tanpa kebangkitan (INV-23a-d); TTL (INV-24); SIM tak mengangkat embodiment (INV-25); server tidur → eksekusi dunia menunggu bot online (jujur) |
| **Slice 8 — Pasar desa** | **VERIFIED LIVE** | PRODUCE COMP-001 → auto-list @0,33 FLR ×4; **pembelian nyata** VIL-0007 → COMP-001 1 unit @0,33 FLR (tx cmudc2cs6…, stok 4→3, saldo 0,58→0,25); matching termurah deterministik; stok habis→CLOSED (INV-26a-g) |
| **Slice 8 — Cron denyut 24/7** | **VERIFIED** | /api/civos/cron (GET/POST, guard CRON_SECRET) + vercel.json */5; build produksi 12 route termasuk cron; Hobby Vercel = degradasi harian (jujur didokumentasikan) |
| **Slice 8 — UI tubuh + pasar** | **VERIFIED (browser)** | panel TUBUH WARGA (stat 5 status + feed + JALANKAN SIM TUBUH) + PASAR DESA (listing+stat) di tab DESA; JEMBATAN OTAK→TUBUH di tab 10; screenshot civ-11/12 |
| **Slice 9 — GUILD KERJA (8 divisi spesialis)** | **VERIFIED LIVE** | CivVillager.division; sensus guild 8 warga (CODER/DEV/BUILDER/MILITARY/ENGINEER/MINER/NETRUNNER/TOOLSMITH); charter DIVISION_META kernel; badge guild di UI; guildStats agregat (INV-34a) |
| **Slice 9 — TOOLFORGE (tool calling teraudit)** | **VERIFIED LIVE** | invokeTool satu gerbang: 7 tool terdaftar; audit CivToolCall + event TOOL_INVOKED (INV-30a); ghost tool & cross-charter → DENIED tercatat (INV-29a/b); limit di luar LLM (INV-31/32) |
| **Slice 9 — INTERNET NYATA (web_search/page_reader)** | **VERIFIED LIVE (nyata)** | z-ai web_search → artefak RESEARCH ber-URL nyata (harga gandum — tradingeconomics.com; strategi ekonomi desa — 5 sumber; INV-31b); timeout/gagal jaringan → FAILED/TIMEOUT jujur (INV-30b) |
| **Slice 9 — WORK division-aware (upah + artefak)** | **VERIFIED LIVE** | 7 denyut warga guild → WAGE 0,60 FLR + artefak per divisi (CODE/SPEC/BLUEPRINT/PATROL/MINE_YIELD/RESEARCH); NETRUNNER memakai kueri dari payload LLM; 13→17 artefak, 22 tool calls teraudit |
| **Slice 9 — Direktif guild (BUILD/PATROL/MINE)** | **VERIFIED LIVE (SIM) + ARMED (dunia)** | tool guild mengantre direktif ber-site; SIM mimpi jaga applied berlabel; bot mengumumkan BUILD/MINE via chat + PATROL tp ber-anchor saat dunia hidup; penempatan blok fisik jujur menunggu OP (INV-33) |
| **Slice 9 — Dashboard depan baru (CIVITAS COMMAND CENTER)** | **VERIFIED (browser)** | ViewKey civitas default nav 00; KPI kas 992.346,50 FLR + revenue jujur 0; 8 kartu guild; TOOLFORGE jalankan tool dari UI → "riset internet nyata — 5 sumber tercatat"; PANEL KEJUJURAN; screenshot civ-13..17; 0 error aplikasi |


| **Slice 10 — Server Minecraft LOKAL nyata (PMMP + CivitasBridge)** | **VERIFIED LIVE** | PocketMine-MP 5.44.3 (Bedrock 1.26.30/protocol 1001) di 127.0.0.1:19132; RakNet ping 11–12ms; plugin `/civ summon|setblock|fill|census` jalan (3+8 villager asli); FIFO konsol + audit CivConsoleLog |
| **Slice 10 — Bug RakNet ping diperbaiki** | **VERIFIED** | format benar `[id][time8][MAGIC16][guid8]` + pong `len@33` — ping kernel lama korup (offset 9 menimpa magic); kini Online 11ms & protocol 1001 terbaca |
| **Slice 10 — Bot join + sensus CENSUS 8/8** | **VERIFIED LIVE** | server log: "CIVITAS_AGENT joined", "<CIVITAS_AGENT> Direktif warga: 2 dieksekusi"; event VILLAGE_CENSUS sumber=CENSUS terobservasi=8 identitasBaru=8; warga aktif kini Counter({'CENSUS': 8}) |
| **Slice 10 — Chat 2 arah** | **VERIFIED LIVE** | dashboard→warga: Ningsih (VIL-0009) menjawab via glm-4-flash; dunia→dashboard: worldChatInbound mencatat channel WORLD (INV-39); balasan diantrekan SPEAK + di-relay bot |
| **Slice 10 — Konfigurasi via UI** | **VERIFIED LIVE** | 16 field runtime (config.* di DB, env fallback, secret dimask INV-37); tombol UJI SUPABASE menampilkan laporan per-cek jujur (kredensial belum diisi pasca-reset sandbox — jujur dilaporkan) |
| **Slice 10 — MCP nyata (JSON-RPC)** | **VERIFIED** | klien HTTP + STDIO; registry CRUD; ghost server ditolak, probe gagal-jujur (INV-38); tool `mcp_call` bercharter NETRUNNER/TOOLSMITH teraudit |
| **Slice 10 — Kuant HARGA NYATA (anti-simulasi)** | **VERIFIED LIVE** | "Hari 5 (HARGA NYATA): 85449.99 · aksi HOLD" — BTCUSDT dari Binance publik via config; sumber mati → PAUSED jujur; gelombang harga fiktif DIHAPUS |
| **Slice 10 — UI Minecraft penuh (12 view)** | **VERIFIED (browser)** | header pixel Press Start 2P + hotbar nav; Citadel/Peta/Warga/Guild/Pemerintah/Perusahaan/Ekonomi/Dunia/Konfig/Arsitek/Pustaka/Event; peta kanvas + kartu identitas NYATA/EMBODIED; graph 219 file/524 sambungan |
| **Slice 10 — README/CHANGELOG/docs rapi** | **VERIFIED** | README baru (header SVG animasi + banner + kredit Mulky Malikul Dhaher), CHANGELOG 1.0.0, docs/OPERATIONS.md, docs diindeks ulang, upstream-map → legacy/ |

## Bukti Eksekusi (2026-09-23, Task 13 — SLICE 9 GUILD & TOOLFORGE + Dashboard Baru)

- `bunx tsc --noEmit`: 0 error · `bun run lint`: 0 error · `bun scripts/civos_invariants.ts`: **62 PASS / 0 FAIL** (5 uji baru INV-35..39: chat 2 kaki, config put/get+ghost, secret masking, MCP ghost/CRUD/probe, chat dunia).
- Probe runtime guild (scripts/guild_probe.ts): 8 denyut warga guild → upah WAGE + artefak per divisi; web_search internet NYATA (2 riset, URL sumber nyata); charter DENIED 3x (cross-divisi + ghost `hack_bank`); 6 direktif BUILD/PATROL/MINE applied SIM; listing tambang masuk pasar desa.
- E2E browser dashboard baru: render penuh (KPI kas 992.346,50 FLR, 8 kartu guild, 12+ baris audit tool, PANEL KEJUJURAN); tombol DENYUT → tick sukses; tombol JALANKAN TOOL → flash "riset internet nyata \"strategi ekonomi desa\" — 5 sumber tercatat"; tab 11 MINECRAFT menampilkan Bedrock 1.26.51.1 + invite add.aternos.org/mulkymalikuldhr; tab 10 DESA badge guild; mobile 390px OK; screenshot civ-13..civ-17; 0 error aplikasi.
- Ping RakNet server pemilik: masih TIDUR (timeout) — dilaporkan jujur; bot + sensus CENSUS tetap ARMED.

## Bukti Eksekusi (2026-09-23, Task 12)
- `bunx tsc --noEmit`: 0 error · `bun run lint`: bersih · `bun scripts/civos_invariants.ts`: **46 PASS / 0 FAIL** (18 uji baru INV-23..28).
- Probe runtime: 3 denyut institusi + denyut desa → direktif tubuh applied (SIM); PRODUCE → listing pasar otomatis; probe pembelian pasar nyata (slice8_probe.ts); klaim bot MOVE menghasilkan perintah tp ber-anchor.
- E2E browser: tab DESA panel TUBUH+PASAR tampil; tab 10 JEMBATAN OTAK→TUBUH tampil (BRIDGE_TAMPIL); screenshot civ-11-desa-slice8.png + civ-12-minecraft-slice8.png; 0 error aplikasi (2 `Failed to fetch` = artefak restart dev server antar-panggilan sandbox, bukan bug).
- Build produksi `bun run build`: hijau, 12 route (termasuk /api/civos/cron).
- Insiden sebelumnya (Task 10): chunk `bedrock-protocol` OOM-crash Turbopack → runtime-only import (ADR arsip teknis di ARCHITECTURE.md §5).

## ADR

- ADR-0001 kernel SQLite · ADR-0002 router reflex-first · ADR-0003 crypto DESIGNED · ADR-0004 birokrasi deterministik · **ADR-0005 mirror Supabase** · **ADR-0006 rail settlement** · **ADR-0007 villager ascension** · **ADR-0008 direktif tubuh + pasar desa + cron 24/7** · **ADR-0009 guild kerja + toolforge (tool calling + internet nyata) + dashboard depan**.

## Kebenaran Tersisa (jujur)

- Dunia LOKAL kini jalur live utama (PMMP berjalan); server Aternos tetap tersedia via Konfig (host → mulkymalikuldhr.aternos.me) — kebangkitan hanya dari akun pemilik.
- Revenue eksternal RIIL: 0 (butuh customer nyata + EXTERNAL_SETTLEMENT_LIVE — gerbang pemilik).
- Bot build nyata (place block): butuh sesi join hidup bersama pemilik.
- Deploy Vercel + push git remote: butuh token/akses pemilik.
