# ADR-0003 — Crypto / Token / Quant: DESIGNED, Bukan LIVE

Status: DITERIMA | Tanggal: 2026-09-23

## Konteks
PRD §12–15/§33: crypto hanya settlement rail; native token hanya setelah ekonomi riil; trading subsystem terisolasi dengan risk limit di luar LLM.

## Keputusan
Tidak ada implementasi crypto/token/trading pada fase ini. Yang ada:
- Honesty gate pada /api/civos/action: `declare_external_customer` selalu ditolak (HTTP 422) sampai ada rail pembayaran riil.
- Pajak direncanakan HANYA atas transaksi `isExternal=true` (TAX_RATE_EXTERNAL); saat ini pajak = 0 secara jujur.

## Konsekuensi
- Tidak ada private key dalam sistem, tidak ada token spekulatif, tidak ada trading.
- Slice 6+ (rail pembayaran) baru dibuka setelah ada customer nyata; ADR baru akan ditulis saat itu.
