# CIVITAS OS — DOKUMEN MASTER (SATU-SATUNYA)

> Versi 1.2.1 "ORGANISM · REFERENSI & AUDIT" · 2026-09-25 · Developer: **Mulky Malikul Dhaher** <mulkymalikuldhr@mail.com>
> Dokumen ini MERGE semua dokumentasi proyek (PRD, arsitektur, kanonik, roadmap, ekonomi,
> keamanan, operasional, ADR, API, CLI, MCP, multi-server). Semua tautan historis diarsipkan
> di `docs/archive/` dan `docs/legacy/` — dokumen inilah satu-satunya sumber kebenaran.

---

## 1. VISI & DEFINISI

CIVITAS OS adalah **peradaban otonom yang menghuni dunia Minecraft nyata**: warganya adalah
villager Minecraft sungguhan yang diberi OTAK (LLM), DOMPET (ledger), TUBUH (direktif fisik),
dan GUILD (pekerjaan spesialis + tool calling). Kernel peradaban berjalan di luar game dan
adalah satu-satunya sumber kebenaran ekonomi/hukum; Minecraft adalah dunia perwujudan — bukan
database, bukan sumber kebenaran finansial.

Prinsip fondasi (10 hukum):
1. Minecraft = world layer, bukan DB.
2. Civilization Kernel = otoritatif (Prisma/SQLite + mirror Supabase).
3. Semua aksi lewat Control Plane (policy engine di luar LLM).
4. Semua panggilan LLM lewat Router (identity ≠ model).
5. Memori ter-scope + ACL.
6. Kredensial terisolasi, dapat dicabut, diaudit — TIDAK PERNAH masuk prompt/memori/log.
7. **Intelligence ≠ Authority** — LLM mengusulkan, kernel yang menegakkan.
8. Pemerintahan tiga lembaga (REGULATORY/TREASURY/EXECUTIVE + TAX) — bukan satu otak.
9. **REALITY WINS** — tidak ada klaim sukses tanpa bukti runtime.
10. **Nol simulasi tersamar** — hasil SIM diberi label jujur; uang nyata ≠ internal.

## 2. ARSITEKTUR (5 LAPIS)

```
┌───────────────────────────────────────────────────────────┐
│ L5  UI — McShell Minecraft-style 12 view + Dashboard      │  Next.js 16, poll 4 dtk
├───────────────────────────────────────────────────────────┤
│ L4  ENDPOINTS — API /api/civos/* + MCP stdio + CLI        │  JSON-RPC / REST
├───────────────────────────────────────────────────────────┤
│ L3  AGENT CONTROL PLANE                                   │
│     Identity · LLM Router · Memory · Credentials ·        │
│     Policy · Capability · Budget · Execution · Audit      │
├───────────────────────────────────────────────────────────┤
│ L2  CIVILIZATION KERNEL (otoritatif)                      │
│     Ledger double-entry · Event immutable · Company 13    │
│     state · Government · City · Village · Guild · Market  │
│     Prisma/SQLite + Supabase mirror + SELF-LIFE daemon    │
├───────────────────────────────────────────────────────────┤
│ L1  MINECRAFT WORLD (Bedrock PMMP + Java Purpur + remote) │
│     Bot CIVITAS_AGENT · Census · Directives · Chat 2-arah │
└───────────────────────────────────────────────────────────┘
```

Modul kernel (`src/lib/civos/`, 5.3k+ baris): accounts, chat, company, config, console,
directives, economy, events, expand, government, ledger, market, mcbot, mcp, memory,
minecraft, money, policy, router, runtime, seed, selflife, servers, settle, state,
supabase, tools, types, village, villagers.

## 3. STATUS KANONIK (RINGKASAN — REALITY WINS)

Status lengkap per subsistem dengan bukti: lihat `docs/archive/CANONICAL.md` (Slice 1–10).
Ringkasan per 2026-09-24 (SLICE 11):

| Subsistem | Status | Bukti |
|---|---|---|
| Kernel + ledger + event + policy + router | VERIFIED | invarian 62/0 (Slice 10) |
| Government / Company / City / Tax | VERIFIED LIVE | denyut LLM nyata; pajak otomatis |
| Mirror Supabase | VERIFIED (perlu kredensial via KONFIG) | 9-cek test suite |
| Bot Minecraft + census nyata | VERIFIED LIVE | join nyata; sensus 8 villager; 10 entitas SYNCED |
| Chat 2 arah (dashboard ⇄ dunia) | VERIFIED LIVE | warga menjawab via LLM |
| **Multi-server all-in-one (SLICE 11)** | VERIFIED LIVE | Bedrock PMMP online 4–11 ms; Java Purpur 1.21.1 online 4–5 ms; Aternos terping (tidur = jujur) |
| **Self backup (SLICE 11)** | VERIFIED LIVE | tar.gz + manifest sha256 + retensi 7 |
| **Self sync git → 4 remote (SLICE 11)** | VERIFIED LIVE | **4/4 sinkron** — GitHub ×3 + GitLab (SSH altssh:443, force push via API unprotect) |
| **Daemon self-life 24/7 (SLICE 11)** | VERIFIED LIVE | watchdog + denyut + backup/sync jadwal; log `backups/daemon.log` |
| **MCP stdio 13 tools (SLICE 11)** | VERIFIED | initialize/tools/list/tools/call; fallback bun tanpa web app |
| **CLI `civitas` (SLICE 11)** | VERIFIED | status/pulse/doctor/chat/server/backup/sync/config |
| External revenue RIIL | NOT_STARTED | butuh rail pembayaran pemilik (gerbang) |
| Kuant pada harga nyata | VERIFIED (Binance) | "Hari 5 (HARGA NYATA): 85449.99 · HOLD" |

## 4. EKONOMI (aturan tetap)

- Uang = **FLR** (florin), integer minor unit, 1 FLR = 100.
- Ledger double-entry; Σdebit = Σkredit setiap saat; event immutable.
- Ekonomi nyata: AI bekerja → artefak → penjualan → revenue EKSTERNAL (pelanggan nyata,
  pembayaran terverifikasi) → kas bangsa → pajak/pemeliharaan/reserve. Trading internal
  TIDAK PERNAH dihitung revenue eksternal (`externalRevenueReal = 0` sampai rail nyata).
- Perusahaan 13 lifecycle (PROPOSED→…→DISSOLVED) — gagal adalah state yang sah.
- Pasar desa: matching deterministik (bukan LLM), konservasi saldo tervalidasi invarian.
- Kuant: harga NYATA (config `quant.priceUrl`, default Binance BTCUSDT); sumber mati = PAUSED.

## 5. KEAMANAN (aturan tetap)

- Kredensial TIDAK PERNAH di-hardcode / masuk git / masuk prompt LLM.
  - Git tokens: `/home/z/.gitcreds` (chmod 600, DI LUAR repo) — dibaca daemon sync saja.
  - Supabase/LLM/API: via KONFIG UI (CivKV `config.*`, SECRET selalu dimask) atau env.
- SECRET config dimask saat dibaca; hanya bisa di-overwrite, tidak pernah tampil.
- Scan rahasia otomatis setiap `doctor` (pola sb_secret/github_pat/sk-…).
- Aksi admin tetap lewat policy engine; konsol server ter-audit penuh (CivConsoleLog).

## 6. MULTI-SERVER ALL-IN-ONE (SLICE 11)

Registry server di CivKV `servers.registry` — default:

| id | Edisi | Target | Managed | Sumber |
|---|---|---|---|---|
| `local-bedrock` | BEDROCK | 127.0.0.1:19132 | ya — `scripts/pmmp_server.sh` | PocketMine-MP + plugin CivitasBridge |
| `local-java` | JAVA | 127.0.0.1:25565 | ya — `scripts/java_server.sh` | Purpur/Paper/vanilla 1.21.1 (unduh otomatis, fallback 3 sumber: PaperMC → Purpur → Mojang) |
| `aternos` | BEDROCK | mulkymalikuldhr.aternos.me:19132 | tidak (remote) | panel Aternos; invite `add.aternos.org/mulkymalikuldhr` |

- Status = **ping NYATA**: Bedrock via RakNet UDP; Java via legacy TCP Server List Ping.
- start/stop/restart hanya untuk managed; remote jujur ditolak ("kelola dari panel penyedia").
- Watchdog daemon menghidupkan ulang server `autoStart` yang mati.
- Edisi lain (proxy/cluster) dapat ditambah via `upsertServer` / API servers.
- Verifikasi aksi: setelah start/stop, kernel PING ULANG — sukses klaim hanya bila dunia
  benar-benar merespons (bukan exit code).

## 7. SELF-LIFE (daemon · backup · sync)

- **Daemon**: `scripts/civitas_daemon.sh start|stop|status|restart|logs [n]`
  Loop 30 detik → `bun scripts/civitas_selflife_tick.ts` (TIDAK tergantung web app):
  1) watchdog server autoStart, 2) denyut peradaban (organ round-robin), 3) backup sesuai
  jadwal, 4) git sync sesuai jadwal. Log: `backups/daemon.log` (rotasi 2 MB).
- **Self backup**: `backupAll()` → `backups/civitas-YYYYMMDD-HHMMSS.tar.gz` berisi db +
  kedua world + .env; manifest JSON (sha256, size, targets); retensi default 7
  (config `backup.keep`); jadwal default tiap 6 jam (config `backup.intervalHours`).
- **Self sync**: `gitSync()` → add/commit bila ada perubahan → push ke 4 remote
  (mulkymalikuldhrs, mulkymalikuldhaher, dhaher-labs, gitlab) dengan token transient —
  URL token TIDAK disimpan; jadwal default 30 menit (config `sync.intervalMinutes`).
- **Doctor**: 9 cek (db, config, tiap server, backup, git-tree, git-creds, secret-scan,
  disk, LLM SDK) — via CLI/endpoint.
- Kredensial tidak persisten antar sesi sandbox — tempel ulang 4 token ke `/home/z/.gitcreds`
  atau jalankan push manual bila sync melaporkan token hilang (jujur dilaporkan).

## 8. ENDPOINTS API (semua teruji)

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/civos/state` | GET | state penuh peradaban (orgs, warga, ledger, event, servers, selfLife, config) |
| `/api/civos/action` | POST | gateway semua aksi (lihat daftar di bawah) |
| `/api/civos/heartbeat` | POST/GET | denyut otonom (cron edge) |
| `/api/civos/minecraft` | GET/POST | status dunia + ping nyata |
| `/api/civos/servers` | GET/POST | registry multi-server + aksi start/stop/restart/status |
| `/api/civos/backup` | GET/POST | daftar arsip / jalankan backup |
| `/api/civos/git` | GET/POST | status sync / push ke 4 remote |
| `/api/civos/selflife` | GET/POST | status kehidupan / detak sekarang |
| `/api/civos/doctor` | GET | laporan kesehatan 9 cek |
| `/api/civos/sync` | GET/POST | mirror Supabase (push/status awan) |
| `/api/civos/cron` | GET/POST | denyut 24/7 (edge cron) |
| `/api/civos/graph` | GET | file graph (219 file / 524 edges) |
| `/api/civos/docs` | GET | pustaka dokumen markdown |
| `/api/mcp` | POST | MCP HTTP JSON-RPC (toolforge gateway) |

Aksi `/api/civos/action`: tick, register_company, ping_minecraft, mc_join, settle_external,
create_city, create_quant_office, village_census, village_tick, village_retire_sim,
village_directive_run_sim, tool_run, market_list, declare_external_customer, chat_send,
config_put, config_get, config_test, mc_console, mcp_add, mcp_remove, mcp_call, mc_summon,
server_action, backup_run, git_sync, selflife_tick, reset (butuh confirm).

## 9. CLI — `civitas`

Install global opsional: `bun link` / `npm link` (bin `civitas` → `bin/civitas.mjs`).

```
civitas status                    ringkasan peradaban + semua server
civitas pulse [organ]             satu denyut otonom (LLM nyata)
civitas selflife                  detak kehidupan (watchdog+backup+sync)
civitas doctor                    9 cek kesehatan
civitas census                    sensus villager dunia nyata
civitas chat "pesan"              bicara dengan warga (LLM)
civitas server list               daftar server + status nyata
civitas server <id> start|stop|restart|status
civitas backup [list]             buat / daftar arsip
civitas sync                      commit + push 4 remote
civitas tool <nama> [json]        jalankan tool Toolforge
civitas config list|get k|set k v konfigurasi runtime (SECRET dimask)
civitas events [n]                event log immutable
civitas daemon start|stop|status|restart|logs [n]
civitas mcp                       serve MCP stdio (Claude Desktop dll)
```

Environment: `CIVITAS_URL` (default `http://127.0.0.1:3000`).

## 10. MCP — CIVITAS SEBAGAI SERVER MCP

Klien MCP (mis. Claude Desktop):

```json
{ "mcpServers": { "civitas": {
    "command": "node",
    "args": ["/home/z/my-project/scripts/civitas_mcp_stdio.mjs"] } } }
```

13 tools: `civitas_status`, `civitas_pulse`, `civitas_selflife`, `civitas_backup`,
`civitas_sync`, `civitas_doctor`, `civitas_server_list`, `civitas_server_action`,
`civitas_census`, `civitas_chat`, `civitas_tool_run`, `civitas_config_get`,
`civitas_config_set`.

Ketangguhan: HTTP ke kernel dulu (timeout 15 dtk); bila web app mati, alat inti
(status/pulse/selflife/backup/sync/doctor/server_list) otomatis fallback ke kernel
via `bun` subprocess — peradaban tetap bisa diaudit tanpa UI.

## 11. KONFIGURASI VIA UI (KONFIG tab)

16+ field: `mc.host`, `mc.port`, `mc.autoJoin`, `mc.autoSummon`, `mc.summonCount`,
`mc.localConsolePath`, `mc.localLogPath`, `mc.remoteHost`, `backup.keep`,
`backup.intervalHours`, `sync.intervalMinutes`, `chat.autoReply`, `chat.relayToDashboard`,
`chat.maxLen`, `llm.model`, `supabase.url`, `supabase.serviceKey` (SECRET),
`settlement.live`, `quant.priceUrl`, `mcp.enabled` — semua editable tanpa restart,
sumber: DB → env → default, SECRET dimask.

## 12. PENGUJIAN (jaring tes permanen)

- **Invarian kernel**: `bun scripts/civos_invariants.ts` — **63 PASS / 0 FAIL**
  (ekonomi, lifecycle, policy, direktif, pasar, guild, chat, config, MCP, server registry, backup, git-sync).
- **tsc**: `bunx tsc --noEmit` = 0 error; **lint**: `bun run lint` bersih;
  **build**: `bun run build` hijau.
- **Selftest organisme**: `bun scripts/organism_selftest.ts` — bukti eksekusi nyata
  end-to-end: mutasi A/B via git worktree (ADOPTED B=1ms vs A=4.3ms), child spawner
  (PID hidup + lifecycle jujur), capability BUILD (tulis+eksekusi+verifikasi), tick penuh.
- **Audit penuh**: [`AUDIT_v1.2.md`](AUDIT_v1.2.md) — 12 area diverifikasi, 0 mock nyata.
- **E2E dunia nyata**: start Bedrock+Java → ping → bot join → census → direktif → chat
  (bukti di worklog + log server).
- **Doctor**: 9 cek otomatis kapan pun.

## 13. PLAYBOOK OPERASIONAL

### Menjalankan semuanya dari nol (sandbox baru / server pemilik)

```bash
bun install && bun run db:generate && bun run db:push   # deps + schema
bun run dev                                             # web app :3000
node bin/civitas.mjs server local-bedrock start         # dunia Bedrock
node bin/civitas.mjs server local-java start            # dunia Java (unduh jar sekali)
node bin/civitas.mjs daemon start                       # self-life 24/7
node bin/civitas.mjs doctor                             # verifikasi 9 cek
```

### Bermain live bersama peradaban

1. **Lokal Bedrock**: tambah server `127.0.0.1:19132` di Minecraft Bedrock → masuk →
   chat di dunia menyebut nama warga → warga menjawab via bot (chat 2 arah).
2. **Lokal Java**: `127.0.0.1:25565` (online-mode=false untuk uji lokal).
3. **Aternos**: bangunkan dari panel pemilik → bot auto-join saat online →
   sensus CENSUS nyata mengikat villager asli desa.

### Backup & pulihkan

```bash
civitas backup                       # buat arsip + manifest sha256
civitas backup list                  # daftar arsip
# Pulihkan: ekstrak tar.gz ke root repo (db/custom.db, mc-server/*, .env)
```

### Recovery cepat

| Gejala | Tindakan |
|---|---|
| Server Bedrock mati sendiri | watchdog menghidupkan; manual: `civitas server local-bedrock start` |
| Web app 500 setelah edit schema | `bun run db:push && bun run db:generate`, restart dev |
| CSS tema tidak termuat | hapus `.next`, restart dev (cache Turbopack basi) |
| sync "token tidak ada" | isi `/home/z/.gitcreds` (4 token) atau push manual |
| Aternos tidur | normal (free tier); bangun dari panel; bot auto-join |

## 14. ROADMAP (status per Slice)

| Slice | Isi | Status |
|---|---|---|
| 1–5 | Kernel, ledger, government, company, kota, settlement+pajak | DONE VERIFIED |
| 6 | Rail settlement eksternal (sandbox; live terkunci policy) | DONE VERIFIED |
| 7 | Villager ascension (otak + dompet) | DONE VERIFIED |
| 8 | Tubuh warga (direktif) + pasar desa | DONE VERIFIED |
| 9 | Guild kerja + Toolforge (tool calling + internet nyata) | DONE VERIFIED |
| 10 | REALITY bridge (server lokal, bot nyata, chat 2 arah, config UI, MCP, kuant nyata) | DONE VERIFIED |
| 11 | **Self-life: multi-server all-in-one, backup, sync, daemon, MCP stdio, CLI, docs merge** | **DONE VERIFIED** |
| 11.5 | **v1.5 "CITADEL": peta DB Supabase penuh (145 tabel), hosting UI + URL/port, backup→cloud→restore 1-klik, Minecraft ASLI di browser (WS→TCP), nav 16 view** | **DONE VERIFIED** |
| 12 | Revenue eksternal riil (rail pembayaran pemilik) | NOT_STARTED — gerbang pemilik |
| 13 | Eksekusi fisik penuh dunia (build nyata luas) + Aternos uptime | ARMED — butuh OP/uptime |

## 15. ADR (Arsip keputusan — isi lengkap di `docs/archive/adr/`)

- **ADR-0001 Kernel otoritatif** — MC bukan DB; kernel satu-satunya sumber kebenaran.
- **ADR-0002 LLM Router reflex-first** — semua LLM lewat router; fallback deterministik.
- **ADR-0003 Crypto = desain saja** — token FLR internal; tidak ada on-chain sebelum rail nyata.
- **ADR-0004 Birokrasi deterministik** — keputusan struktural = aturan, bukan LLM.
- **ADR-0005 Mirror Supabase** — kernel tetap SQLite; Supabase hanya mirror/awan.
- **ADR-0006 Rail settlement** — sandbox boleh; LIVE butuh pelanggan+pembayaran nyata.
- **ADR-0007 Villager ascension** — warga = villager MC + otak LLM + dompet; identity terikat.
- **ADR-0008 Direktif tubuh + cron** — otak→tubuh via direktif; denyut 24/7 via cron/daemon.
- **ADR-0009 Guild & Toolforge** — 9 guild, charter tool per guild, audit penuh.
- **SLICE 11 (catatan arsitektur)** — multi-server registry + self-life daemon + MCP/CLI;
  db runtime & backup TIDAK masuk git publik; token git di luar repo.

## 16. SEJARAH SINGKAT (changelog penuh: `CHANGELOG.md`)

v0.1 kernel → v0.2 guild/toolforge → v1.0.0 "REALITY" (dunia nyata + chat 2 arah) →
**v1.1.0 "SELF-LIFE"** (multi-server Bedrock+Java+remote all-in-one; self backup; self sync
4 remote; daemon 24/7; MCP stdio 13 tools; CLI `civitas`; dokumen digabung satu; runtime db
dikeluarkan dari git publik) → **v1.2.0 "ORGANISM"** (General Autonomous Digital Organism
Runtime 16 modul; mutation sandbox git-worktree A/B; spawner proses nyata; imun 7 limit
enforced; capability graph; LLM free-first + custom provider via UI; tab 🧬 ORGANISME) →
**v1.2.1 "REFERENSI & AUDIT"** (docs/AUDIT_v1.2.md; README §Referensi & Sumber — 29 riset
+ 16 repo kandidat; push GitHub ×3 terverifikasi) → **v1.4.0 "SYNC & AUTONOMY"** (mirror
total 24 tabel ke Supabase; RATU_CIVITAS v2 memori+berpikir+evaluasi; self server; Vercel
link) → **v1.5.0 "CITADEL"** (peta DB Supabase 145 tabel realtime di UI; hosting server
dari UI dengan URL/port terpampang; backup otomatis → Supabase Storage → restore 1-klik
teruji end-to-end; **klien Minecraft asli di browser** via prismarine-web-client + jembatan
WS→TCP whitelist — bukti join `pviewer207` di log Paper; nav 16 view; invariants 66/0).

## 17. KREDIT & LISENSI

- Developer & pemilik: **Mulky Malikul Dhaher** — mulkymalikuldhr@mail.com
- Kernel, UI, bot, plugin CivitasBridge, daemon, MCP, CLI: dibangun penuh di sesi otonom
  Super Z dengan bukti runtime (worklog).
- Server online pemilik: Aternos `mulkymalikuldhr.aternos.me:19132` (Bedrock 1.26.51.1,
  invite `add.aternos.org/mulkymalikuldhr`).
- Dependensi utama: Next.js 16, Prisma, z-ai-web-dev-sdk, PocketMine-MP, Purpur, bedrock-protocol.
- Referensi sumber riset & pola: README **§Referensi & Sumber** + `research/RELEVANT_REPOS_16b.md`
  (mineflayer, bedrock-protocol, mindcraft, voyager, PIANO, letta, MCP SDK, mcp-handler,
  itzg, Crafty-4, MCSManager, pm2, rcon-client) — diadopsi sebagai pola desain, dengan
  atribusi; kode inti ditulis penuh di repo ini.
