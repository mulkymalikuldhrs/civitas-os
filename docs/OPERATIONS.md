# OPERATIONS — Panduan Operasional CIVITAS OS

Panduan harian: menyalakan dunia, bermain bersama warga, mengubah konfigurasi, dan memecahkan masalah.

## 1. Menjalankan aplikasi (dashboard + kernel)

```bash
bun install
bun run db:push          # sinkron schema Prisma ke SQLite
bun run dev              # dashboard di http://localhost:3000 (poll otonom 4 dtk)
```

Verifikasi kesehatan:
```bash
curl -s localhost:3000/api/civos/state | head -c 300
bun scripts/civos_invariants.ts    # invariant ledger/desa/guild (57 PASS)
```

## 2. Server Minecraft LOKAL (PocketMine-MP + CivitasBridge)

```bash
scripts/pmmp_server.sh start     # nyalakan (Bedrock, port 19132, xbox-auth off)
scripts/pmmp_server.sh status    # RUNNING / NOT_RUNNING
scripts/pmmp_server.sh cmd "civ census"        # daftar villager hidup
scripts/pmmp_server.sh cmd "civ summon 8"      # panggil 8 villager di spawn dunia
scripts/pmmp_server.sh cmd "civ setblock 256 70 256 stone_bricks"
scripts/pmmp_server.sh cmd "civ fill 250 70 250 253 70 253 oak_planks"
scripts/pmmp_server.sh stop      # matikan dengan rapi
```

- Plugin: `mc-server/pmmp/plugins/CivitasBridge.phar` (sumber `src/`, rebuild:
  `cd mc-server/pmmp && bin/bin/php7/bin/php -d phar.readonly=0 build_phar.php`).
- Konsol juga bisa dari UI: tab **DUNIA** → KONSOL SERVER LOKAL (teraudit di `CivConsoleLog`).
- File penting: `mc-server/pmmp/server.properties` (port, xbox-auth), `pnx.yml` tidak dipakai PMMP, log: `mc-server/pmmp/server.log`.

## 3. Server ONLINE (Aternos pemilik)

- Invite: **add.aternos.org/mulkymalikuldhr** · Address: **mulkymalikuldhr.aternos.me** · Port: **19132** · Software: **Bedrock** · Versi: **1.26.51.1**.
- Tab **KONFIG** → grup MINECRAFT → `mc.host` = `mulkymalikuldhr.aternos.me` → SIMPAN. Port tetap 19132.
- Nyalakan server dari akun Aternos (gratis tidur otomatis bila kosong). Begitu ping kernel ONLINE:
  bot auto-join → sensus CENSUS mengikat villager asli → direktif warga dieksekusi.
- Catatan jujur: kernel TIDAK bisa membangunkan Aternos dari luar (butuh sesi pemilik). Status "TIDUR" ditampilkan apa adanya.

## 4. Bot & sensus

- Tab **DUNIA** → `KIRIM BOT`: join manual. `mc.autoJoin=true` membuat bot masuk otomatis saat dunia ONLINE (dengan alasan: direktif antre / warga belum tersinkron / sesi pertama).
- Bot butuh OP untuk `tp` dan `/civ fill`: dari konsol `scripts/pmmp_server.sh cmd "op CIVITAS_AGENT"` (lokal sekali saja; Aternos: beri OP via panel pemilik).
- Sensus: entitas `minecraft:villager` yang terobservasi menjadi identitas CENSUS; warga SIMULASI mundur otomatis (`REALITY WINS`).

## 5. Chat dengan warga

- **Dari dashboard**: tab WARGA → pilih warga → tulis pesan → balasan dari otak LLM warga (kepribadian + ingatan); balasan juga diantrekan sebagai direktif SPEAK (diucapkan in-world saat bot online).
- **Dari dalam game**: ketik chat biasa; sebut nama warga ("Gilang, kabar tambang?") — bot membaca, warga menjawab di chat dunia, dan percakapan tercatat di dashboard (channel WORLD).
- Batas: 3 pesan masuk per sesi bot (budget percakapan), panjang pesan dipotong policy.

## 6. Konfigurasi via UI (tanpa restart)

Tab **KONFIG** — semua tersimpan di DB kernel, efektif segera; rahasia dimasking:

| Grup | Field utama |
|---|---|
| MINECRAFT | `mc.host`, `mc.port`, `mc.autoJoin`, `mc.autoSummon`, `mc.summonCount`, jalur FIFO konsol & log lokal |
| CHAT | `chat.autoReply`, `chat.relayToDashboard`, `chat.maxLen` |
| OTAK | `llm.model` (`glm-4-plus` / `glm-4-flash`) |
| SUPABASE | `supabase.url`, `supabase.serviceKey` (secret) + tombol **UJI SUPABASE** (tabel, kolom, roundtrip) |
| SETTLEMENT | `settlement.live` (jangan aktifkan tanpa rail riil) |
| KUANT | `quant.priceUrl` (default Binance publik `BTCUSDT`) |
| MCP | registry server (HTTP/STDIO) + tombol PROBE; dipanggil warga lewat `mcp_call` |

## 7. Pemecahan masalah

| Gejala | Sebab & langkah |
|---|---|
| "DUNIA TIDUR" padahal server jalan | Ping RakNet UDP ke port salah / firewall. Uji: `bun scripts/raknet_ping.ts 127.0.0.1 19132` |
| Bot ditendang "Invalid name" | Nama bot harus `[A-Za-z0-9_]` — sudah `CIVITAS_AGENT` |
| Bot ditendang "Packet processing error … TextPacket" | Skema chat: butuh `category:1` (sudah dipakai; terjadi bila versi server < 1.26.30) |
| `/civ` unknown command | Plugin phar tidak termuat: rebuild phar (lihat §2) lalu restart server |
| "Cannot find a safe spawn point" | Area koordinat belum ter-generate — summon tanpa koordinat (default spawn dunia) |
| Restart dev server setelah `db:push` | Matikan proses `next dev`, jalankan `.zscripts/dev.sh` / `bun run dev` lagi |
| CSS tema MC tidak muncul | Cache Turbopack basi: `rm -rf .next` lalu `bun run dev` |
| Supabase test ✗ konfigurasi | Isi `supabase.url` + `supabase.serviceKey` di tab KONFIG → UJI SUPABASE |

## 8. Kebersihan lingkungan

- `scripts/filegraph.mjs` — regenerasi indeks 198 file + graph (dipakai tab ARSITEK & `docs/FILE_INDEX.md`).
- Log dunia lokal: `mc-server/pmmp/server.log` (rotasi manual saat besar).
- Kernel reset penuh: aksi `reset` (butuh `confirm: "RESET-CIVOS"`) — menghapus semua tabel civ* termasuk chat/konsol/MCP.
