# INDEKS DOKUMEN — CIVITAS OS

**Peradaban Nusantara Digital Otonom** — kernel otoritatif, warga villager Minecraft ber-LLM, pemerintahan multi-agen, dunia Bedrock nyata.

## Dokumen aktif (kanonik)

| Dokumen | Isi |
|---|---|
| [`/README.md`](../README.md) | Pintu masuk: header animasi, banner, fitur, cara main live, konfigurasi, kredit developer |
| [`/CHANGELOG.md`](../CHANGELOG.md) | Riwayat versi (Keep a Changelog): 0.1 → 0.2 → **1.0 "REALITY"** |
| [`civitas-os/PRD.md`](civitas-os/PRD.md) | PRD kanonik: 10 aturan, MVP, vertical slice, batas kejujuran, §8–10 villager |
| [`civitas-os/CANONICAL.md`](civitas-os/CANONICAL.md) | **Kebenaran terverifikasi** — status subsistem + bukti runtime per Task |
| [`civitas-os/ARCHITECTURE.md`](civitas-os/ARCHITECTURE.md) | Modul kernel, alur denyut, mesin uang, dunia, mirror |
| [`civitas-os/ECONOMICS.md`](civitas-os/ECONOMICS.md) | FLR, sirkulasi, alokasi modal, rail settlement, pajak otomatis, kuant harga nyata |
| [`civitas-os/SECURITY.md`](civitas-os/SECURITY.md) | Kredensial, intelligence≠authority, isolasi, audit tool/MCP, kill switch |
| [`civitas-os/ROADMAP.md`](civitas-os/ROADMAP.md) | Slice 1–10 selesai + arah berikutnya + anti-target |
| [`OPERATIONS.md`](OPERATIONS.md) | **Panduan operasional**: server lokal (PMMP), server online (Aternos), konsol, chat, konfigurasi via UI, pemecahan masalah |
| [`FILE_INDEX.md`](FILE_INDEX.md) | Indeks 198 file + 476 sambungan (hasil `scripts/filegraph.mjs`, tampil juga di tab ARSITEK) |
| [`adr/ADR-0001…0009`](adr/) | Keputusan arsitektur (kernel otoritatif, reflex-first, rail, villager, direktif, guild, dll.) |
| [`assets/header.svg`](assets/header.svg) · [`assets/banner.png`](assets/banner.png) | Aset README (SVG animasi judul + banner piksel) |
| [`data/filegraph.json`](data/filegraph.json) | Data mesin untuk graph arsitektur |

## Arsip (warisan, tidak lagi dirawat)

- `legacy/upstream-map.md` — peta 4 repo upstream pemilik (Jeumpa/Autonomous-Organism) sebagai konteks sejarah.
- `../download/flybrain-os/00–13` — dokumen FlyBrain OS (riset, PRD v1, autonomy L0–L4, master plan).
- `../download/flybrain-mcp/` — prototipe Python MCP (deprecated; digantikan kernel TS).
- `../upstream/*` — kloningan repo upstream (rujukan; tidak dibangun lagi).

## Konvensi

- Label kebenaran: **VERIFIED** (ada bukti runtime) · **ARMED** (siap, menunggu kondisi dunia) · **DESIGNED** (rancangan, belum jalan) · **NOT_STARTED**. REALITY WINS — dokumentasi menyesuaikan kenyataan.
- Setiap Task ID ditutup dengan entri di `worklog.md` (log multi-agen bersama).
- ADR baru ditulis setiap keputusan berdampak arsitektur; nomor berurutan.
