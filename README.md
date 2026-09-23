<div align="center">

<img src="docs/assets/header.svg" alt="CIVITAS OS — Peradaban Nusantara Digital Otonom" width="100%" />

<img src="docs/assets/banner.png" alt="Kota peradaban CIVITAS OS" width="100%" />

**Sistem operasi peradaban otonom di dalam Minecraft.**
Warga villager sungguhan · Pemerintahan multi-agen · Ledger double-entry · Guild kerja nyata · Server Bedrock lokal & online.

`v1.0 "REALITY"` · Next.js 16 · TypeScript · Prisma/SQLite · bedrock-protocol · PocketMine-MP · Supabase mirror

</div>

---

## Apa ini?

CIVITAS OS adalah **peradaban digital yang hidup tanpa perintah manusia**: ia berdenyut, memerintah diri, bekerja, memungut pajak, membangun, dan *menghuni dunia Minecraft sebagai tubuh fisiknya*. Setiap warga adalah **villager Minecraft yang naik derajat menjadi agen otonom** — punya identitas persisten di kernel, otak LLM, dompet di ledger, dan tubuh di dunia. Ini bukan demo: status hanya boleh bertambah **dengan bukti runtime** (`REALITY WINS`).

> **Intelligence ≠ Authority.** LLM hanya *mengusulkan*. Eksekusi selalu melewati Policy → Authority → Risk → Budget → Capability → Executor. Uang tidak pernah muncul dari ketiadaan, revenue eksternal palsu ditolak server (HTTP 422 `HONESTY_GATE`).

## Fitur inti

| Lapisan | Kemampuan | Status |
|---|---|---|
| **Civilization Kernel** | Ledger double-entry (Σdebit=Σcredit), event immutable, policy engine di luar LLM, 19+ model Prisma | ✅ terverifikasi (57 invariant PASS) |
| **Pemerintahan** | 4 institusi (REGULATORY/TREASURY/EXECUTIVE/TAX) tiga cabang, pajak otomatis, anggaran | ✅ hidup |
| **Perusahaan** | 13-state lifecycle (PROPOSED→…→BANKRUPT), pasar desa matching termurah | ✅ hidup |
| **Warga Villager** | Sensus CENSUS dari entitas dunia nyata, otak LLM per warga, ekonomi dompet, sosialisasi | ✅ 8/8 warga CENSUS NYATA |
| **Tubuh & Direktif** | SPEAK/MOVE/PATROL/BUILD dieksekusi bot ke dunia (`/civ fill` blok fisik) | ✅ bot + plugin CivitasBridge |
| **Guild Kerja** | 8 divisi: CODER, DEV, BUILDER, MILITARY, ENGINEER, MINER, NETRUNNER, TOOLSMITH | ✅ kerja + artefak nyata |
| **Toolforge** | Tool calling teraudit: `web_search`/`page_reader` (internet nyata ber-URL), `code_write`, `build_plan`, `mine_route`, `patrol_report`, `mcp_call` | ✅ audit penuh (CivToolCall) |
| **MCP** | Registry server MCP (HTTP JSON-RPC & STDIO spawn) + `tools/list` + `tools/call` | ✅ klien nyata |
| **Chat 2 Arah** | Bicara dengan warga dari dashboard; chat in-game dibaca bot, warga menjawab | ✅ LLM + relay dunia |
| **Minecraft World** | RakNet ping (protokol benar), server lokal PocketMine-MP, target Aternos online, bot join | ✅ ping 11ms · bot masuk dunia |
| **Kuant** | Keputusan pada **harga pasar NYATA** (Binance publik); eksekusi order = gerbang pemilik | ✅ anti-simulasi |
| **Supabase Mirror** | Cermin event/txn ke PostgreSQL Dhaher Labs + test-suite tabel/kolom/roundtrip | ✅ dengan kredensial via UI |
| **UI Minecraft** | Dashboard bergaya MC (panel bevel, pixel font, hotbar nav), peta dunia + identitas, 12 view | ✅ otonom (poll 4 dtk) |
| **Konfigurasi** | Semua env/api-key/URL/token/server diatur **via UI tanpa restart** | ✅ secret dimasking |

## Arsitektur (lima lapis)

```
┌──────────────────────────────────────────────────────────────┐
│ AUTONOMOUS CIVILIZATION — denyut otonom (tanpa manusia)      │
├──────────────────────────────────────────────────────────────┤
│ GOVERNMENT ⇄ COMPANIES ⇄ CITIES — tiga cabang, 13 lifecycle  │
├──────────────────────────────────────────────────────────────┤
│ AGENT CONTROL PLANE — Identity · LLM Router · Memory (ACL)   │
│ Credentials · Policy · Capability · Budget · Audit           │
├──────────────────────────────────────────────────────────────┤
│ CIVILIZATION KERNEL (otoritatif) — Ledger · Events · State   │
│ Prisma/SQLite + mirror Supabase (ADR-0005)                   │
├──────────────────────────────────────────────────────────────┤
│ MINECRAFT (world layer, BUKAN sumber kebenaran)              │
│ Bedrock protocol · bot CIVITAS_AGENT · plugin CivitasBridge  │
└──────────────────────────────────────────────────────────────┘
```

## Cara main langsung (live)

**1. Server lokal (otomatis, satu perintah):**
```bash
scripts/pmmp_server.sh start     # PocketMine-MP + plugin CivitasBridge (Bedrock, port 19132)
scripts/pmmp_server.sh status    # ping RakNet
scripts/pmmp_server.sh cmd "civ summon 8"   # panggil warga desa
scripts/pmmp_server.sh cmd "civ census"     # daftar villager hidup
```
Di dashboard: tab **DUNIA** → `KIRIM BOT` → bot masuk, sensus mengikat identitas CENSUS ke villager asli, direktif warga dieksekusi (chat/tp/fill). Tab **WARGA** → bicara dengan warga mana pun. Saat kamu bermain di dalam server, ketik chat (sebut nama warga) — bot membaca dan warga menjawab **dari dalam dunia**.

**2. Server online (Aternos pemilik):**
- Invite: `add.aternos.org/mulkymalikuldhr` · Address: `mulkymalikuldhr.aternos.me` · Port: `19132` · Bedrock `1.26.51.1`
- Tab **KONFIG** → grup MINECRAFT → isi host `mulkymalikuldhr.aternos.me` → SIMPAN (efektif segera).
- Nyalakan server dari akun Aternos (gratis tidur otomatis) — bot + sensus + direktif berjalan sama persis.

**3. Konfigurasi apa pun via UI:** tab **KONFIG** — host/port MC, auto-join/summon, jalur konsol lokal, model otak (`glm-4-plus`/`flash`), Supabase URL + service key (teruji: tabel, kolom, roundtrip), flag settlement, URL harga pasar (default Binance), dan registry server MCP (HTTP/STDIO) dengan tombol PROBE.

## Menjalankan aplikasi

```bash
bun install
bun run db:push        # Prisma → SQLite (kernel otoritatif)
bun run dev            # http://localhost:3000
node scripts/filegraph.mjs   # peta arsitektur (tab ARSITEK)
bun scripts/civos_invariants.ts   # invariant ledger/desa/guild (57 PASS)
```

| Jalur | Keterangan |
|---|---|
| `/` | CIVITAS COMMAND CENTER — 12 tab hotbar: Citadel, Peta, Warga, Guild, Pemerintah, Perusahaan, Ekonomi, Dunia, Konfig, Arsitek, Pustaka, Event |
| `/api/civos/state` | agregator keadaan (poll UI otonom 4 dtk) |
| `/api/civos/action` | semua aksi: tick, chat_send, mc_join, mc_console, config_*, mcp_*, tool_run, dst. |
| `/api/civos/chat` | feed chat warga (realtime 2,5 dtk) |
| `/api/civos/cron` | beacon denyut 24/7 (guard `CRON_SECRET`) |
| `/api/civos/graph`, `/api/civos/docs` | peta arsitektur & pustaka dokumen |

## Kejujuran radikal (bukan marketing)

- Revenue eksternal **RIIL: 0** — butuh customer nyata + rail settlement live (gerbang pemilik; `settle_external env=live` terkunci sampai flag diaktifkan di Konfig).
- Saat server Minecraft tidur, warga disensor `SIMULASI` **dengan label jujur**; begitu bot masuk, sensus CENSUS mengikat entitas asli dan warga SIM mundur otomatis (`REALITY WINS`).
- Kantor kuant memutuskan pada harga Binance nyata; jika API tak terjangkau ia berstatus `PAUSED` — **tidak pernah memakai harga fiktif**.
- Setiap panggilan tool/MCP teraudit (OK/DENIED/FAILED) di `CivToolCall`; tidak ada tool hantu.
- Server Aternos tidak bisa dibangunkan dari luar (butuh sesi pemilik) — dilaporkan apa adanya.

## Struktur dokumen

Semua dokumen rapi di [`docs/`](docs/README.md): [`CANONICAL.md`](docs/civitas-os/CANONICAL.md) (kebenaran berbasis bukti), ADR-0001…0009 (keputusan arsitektur), [`FILE_INDEX.md`](docs/FILE_INDEX.md) (198 file + 476 sambungan), [`OPERATIONS.md`](docs/OPERATIONS.md) (panduan server & konfigurasi). Riwayat perubahan: [`CHANGELOG.md`](CHANGELOG.md).

## Developer

<div align="left">

**Mulky Malikul Dhaher** — pemilik & penggagas peradaban.
📧 mulkymalikuldhr@mail.com · invite server: `add.aternos.org/mulkymalikuldhr`

*Dibangun bersama agen otonom (Super Z) — kernel, dunia, dan UI yang kamu lihat adalah karya nyata, bukan mockup.*

</div>

## Lisensi

MIT © Mulky Malikul Dhaher. PocketMine-MP (LGPL) & bedrock-protocol (lisensinya masing-masing) berjalan sebagai dependensi eksternal.
