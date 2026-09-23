# 07 — Roadmap & Rencana Eksekusi

> Status: v1.0 · 2026-09-21 · Prinsip eksekusi: kernel dulu → visualisasi → tanpa server penyimpanan selama mungkin.

---

## Fase 0 — Selesai (sesi sebelumnya, 2026-09-21 pagi) `[T]`
- Riset 16 JSON terverifikasi (connectome, calyx/VFB, CAVEclient, kompetitor, pasar).
- Blueprint DOCX 16 halaman + MVP MCP Python (flybrain-mcp, 12 tools, smoke test lolos) — **status kini: deprecated untuk produk; diarsipkan sebagai referensi pola tool** karena arah baru = tanpa-Python, tanpa-server.

## Fase 1 — v0.2 "Otak Hidup" — SELESAI `[T]`
Tujuan: bukti produk lengkap yang bisa diklik, bukan slide.
- Dokumen konsistensi + kernel tanpa-server penuh + 6 view + Service Worker + konsol uji.
- Verifikasi browser golden-path + lint: LOLOS.
**Definisi selesai:** semua AC di 02_PRD.md §4 lolos; tanpa error di dev.log; demo kwitansi bekerja. — TERCAPAI.

## Fase 1.5 — v1.0 "ORGANISME" — TERCAPAI (sesi 3, 2026-09-21) `[T]`
Tangga otonomi L1 → **L3 penuh** (spesifikasi: 10_AUTONOMY.md).
- prt = operator otonom ber-LLM: genom + konstitusi 6 poin; 4 organ bisnis (guardian/merchant/envoy/scout) berdenyut via heartbeat LLM; degradasi jujur ke refleks.
- Serverless stateless compute: /api/organism/heartbeat, /api/organism/chat, /api/mcp (JSON-RPC 2.0, 6 tools) — 100% amnesia.
- View 06 Ruang Kendali (Mission Control): aliran keputusan 5 fase, mandat L0–L4 + scope-grant, ledger bisnis, denyut organisme, panel endpoint + tester JSON-RPC.
- Sisa dari spesifikasi ini yang JADI FASE BERIKUT: L4 eksternal penuh, cron-edge produksi, kwitansi bertanda tangan (lihat Fase 2/3 di bawah).

## Fase 2 — v1.1 "Tahan Banting + Cron-Edge" (1-2 minggu pasca-v1.0) `[D]`
- Cron-edge produksi (serverless scheduled function): heartbeat 24/7 saat konsol tertutup, hasil di-pull saat user kembali (10_AUTONOMY.md §5) — tetap tanpa persist.
- Sinkronisasi folder lokal (File System Access API) + autosave ekspor terjadwal.
- Enkripsi at-rest opsional per koleksi (AES-GCM via WebCrypto, kunci dari FK1).
- Packer "profil perangkat" pertama: template konfigurasi IoT (espressif/http-client).

## Fase 3 — v1.x "Gerbang Publik + Kwitansi Bertanda Tangan" (4-6 minggu) `[D]`
- Cloudflare Worker stateless (relay zero-knowledge, 04 §7) → akses lintas-perangkat.
- Kwitansi bertanda tangan mitra pembayaran + canary pencabutan (CDN statis) — prasyarat monetisasi nyata; prasyarat aksi eksternal L4 merchant.
- L4 eksternal penuh (scope-grant per fitur): merchant menerbitkan proposal→kwitansi nyata; prt mengusulkan & merevisi roadmap dari telemetri (10_AUTONOMY.md §8).
- Konfirmasi tertulis lisensi FlyWire (prasyarat monetisasi) `[T]`.
- Monetisasi aktif: Pro USD 19/bln; halaman harga; jalur manual → otomatis bertahap.

## Fase 4 — Cakrawala `[H]`
- Profil perangkat (drone-PRT, robot-PRT) berbagi satu otak via gerbang.
- PRT memakai prioritas ala connectome untuk penjadwalan tugas.
- Pasar template "otak siap-pakai" (peneliti, trader, gamifikasi kebiasaan) — pembuka ekonomi sekunder di atas data milik user sendiri.
- Evaluasi spin-off B (Gateway B2B) jika permintaan enterprise muncul — ekstraksi modul, bukan penulisan ulang.

## Prioritas Berkala (tidak boleh dilupakan)
1. Jangan pernah menambah penyimpanan server sebelum fitur benar-benar menuntutnya — API route tetap harus 100% amnesia.
2. Setiap fitur baru wajib punya visualisasi (anti-slop adalah kebijakan, bukan selera).
3. Setiap klaim keamanan baru wajib naik tingkat bersama protokolnya (04 §5).
4. Dokumen = sumber kebenaran; kode mengikuti dokumen; perubahan lewat CHANGELOG.
