# ROADMAP — CIVITAS OS (jalan menuju peradaban penuh)

Status: hidup — diperbarui tiap Task ID. Slice selesai = VERIFIED di CANONICAL.md.

## Selesai (VERIFIED)

- [x] Slice 1 — Agent → Company → Task → Revenue → Treasury → Ledger (COMP-001 ACTIVE, pengadaan pertama)
- [x] Slice 2 — Government 4 institusi + registrasi + alokasi + anggaran + pajak otomatis
- [x] Slice 3 — Kota: KOTA-01 + KOTA-02 Bandar Langit (anggaran pendirian, entitas dunia)
- [x] Slice 4 — Pemetaan entitas Minecraft ↔ peradaban (10 entitas; PLANNED→SYNCED saat bot hadir)
- [x] Slice 5 — Bot Minecraft armed (join+chat+SYNCED otomatis saat dunia online; cooldown)
- [x] Slice 6 — Rail settlement eksternal (sandbox berlabel teruji + pajak otomatis 10%; live tergerbang)
- [x] Mirror Supabase Dhaher Labs (events/txns/state/log, inkremental)
- [x] Kuant paper-trading SIMULASI (COMP-QUAN)

## Berikutnya (urut prioritas)

1. **Bot build nyata** — saat server online: place marker/billboard CIVITAS di spawn (butuh sesi join hidup → uji interaktif bersama pemilik).
2. **Revenue eksternal riil** — aktifkan `EXTERNAL_SETTLEMENT_LIVE` dengan provider nyata (Stripe/Xendit/kripto settlement rail); customer pertama = target loop penuh PRD §11.
3. **Cron denyut 24/7** — edge scheduler agar peradaban berdenyut tanpa browser terbuka.
4. **Multi-repo push** — dorong konsolidasi ke remote GitHub/GitLab/Codeberg pemilik (butuh akses git).
5. **Pasar internal** — harga dinamis antar perusahaan (warisan market-engine upstream, dipetakan di docs/upstream-map.md).
6. **Kota 3+ & spesialisasi adaptif** — kotapraja otonom menilai sendiri infrastruktur (proposal INFRASTRUCTURE).
7. **Kepatuhan & identitas** — perluasan reputasi, kontrak (`CONTRACT_SIGNED`), sengketa institusi kecil.


## Slice 10 — REALITY BRIDGE (SELESAI, 2026-09-23 · v1.0 "REALITY")

- ✅ Server Minecraft lokal nyata (PocketMine-MP + plugin CivitasBridge: summon/setblock/fill/census) — dunia live tanpa menunggu Aternos.
- ✅ Bug protokol RakNet ping diperbaiki (format + parser pong) — ping jujur & benar ke semua target.
- ✅ Bot v2: sensus CENSUS 8/8 villager asli; direktif fisik (BUILD fill, PATROL/MOVE tp, SPEAK relay); auto-summon.
- ✅ Chat 2 arah (dashboard ⇄ warga ⇄ dunia) dengan otak LLM per-warga.
- ✅ Konfigurasi runtime via UI (16 field, secret dimask, uji koneksi nyata Supabase/Minecraft).
- ✅ Klien MCP nyata (HTTP/STDIO, tools/list+call) + tool `mcp_call` bercharter teraudit.
- ✅ Kuant memutuskan pada harga pasar NYATA (Binance); PAUSED jujur bila sumber mati.
- ✅ UI Minecraft penuh 12 view + peta dunia + kartu identitas; filegraph 219 file; README/CHANGELOG/OPERATIONS rapi.
- Arah berikutnya (butuh gerbang pemilik): rail pembayaran eksternal riil (revenue #1), bot penempatan blok multi-player bersama pemilik, registry MCP produksi, deploy Vercel/push remote.

## Anti-Target (sengaja tidak dibangun)

- Native token spekulatif, trading uang riil tanpa rail, revenue palsu, bot tanpa audit — lihat ADR-0003/0006 & SECURITY.md.
