# ADR-0001 — Civilization Kernel Otoritatif di Server (Prisma/SQLite)

Status: DITERIMA | Tanggal: 2026-09-23

## Konteks
PRD peradaban menuntut: "Civilization Kernel adalah authoritative state", ledger yang bisa merekonstruksi keadaan, event immutable. Warisan FLYBRAIN OS bersumpah zero-storage (data user di IndexedDB, server amnesia).

## Keputusan
Dua domain, dua aturan:
1. **FLYBRAIN OS (produk)** — tetap zero-storage mutlak. Tidak berubah.
2. **CIVITAS OS (kernel peradaban)** — state otoritatif server-side: Prisma + SQLite (`db/custom.db`), 14 model Civ*. Tidak menyimpan PII user; yang tersimpan adalah entitas peradaban (org, agen, akun, ledger, event).

## Konsekuensi
- Ledger double-entry bisa diverifikasi (invariant tests), event immutable sesungguhnya, peradaban berdenyut tanpa browser terbuka.
- Risiko lock SQLite saat dua penulis (dev server + skrip uji) — diterima untuk skala MVP; migrasi Postgres saat dibutuhkan.
