# ADR-0006 — Rail Settlement Eksternal: Sandbox Berlabel, Live Tergerbang

Status: DITERIMA & TERVERIFIKASI | Tanggal: 2026-09-23

## Konteks
Slice 6 menuntut revenue eksternal + pajak otomatis. Hukum kejujuran (PRD §6/§35) melarang mencatat simulasi sebagai revenue riil — tetapi pipeline harus teruji penuh.

## Keputusan
- `settleExternal({env})`:
  - **sandbox** — fixture uji berlabel `[SANDBOX-TEST]`, meta `sandbox:true`; metrik dipisah (`externalRevenueSandbox`); tetap memicu pajak otomatis (demonstrasi pipeline).
  - **live** — butuh `EXTERNAL_SETTLEMENT_LIVE=true` + `reference` penyedia pembayaran nyata; tanpa itu HTTP 422.
- Pajak otomatis: TAX step memungut `TAX_RATE_EXTERNAL` (10%) atas settlement `taxed:false`, idempoten via kunci `tax-<txId>`.

## Bukti (live)
- Sandbox 250,00 FLR dari "PT Maju Jaya [SANDBOX-TEST]" → TAX step denyut berikutnya: "pajak otomatis: 1 settlement → 25,00 FLR masuk kas pajak".
- Live tanpa gate → ditolak: "settlement LIVE terkunci" (HTTP 422).
- Alert jujur: "Rail eksternal teruji via SANDBOX; revenue eksternal RIIL masih 0".

## Konsekuensi
- Pipeline revenue+pajak teruji 100% tanpa satu pun uang palsu masuk sebagai riil.
- Aktivasi ekonomi riil = konfigurasi + provider, bukan perombakan kode.
