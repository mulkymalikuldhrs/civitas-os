# ADR-0005 — Mirror Persadaban ke Supabase Dhaher Labs

Status: DITERIMA & TERVERIFIKASI LIVE | Tanggal: 2026-09-23

## Konteks
Mandat pemilik: "cek sampai db supabase beres juga — Supabase dhaher labs". Kernel SQLite otoritatif berisiko hilang bila sandbox di-reset; peradaban butuh jejak kedua lintas-mesin + basis untuk masa depan multi-user.

## Keputusan
- Supabase project `jcdjwprehfgtaswqletb` (organism autonomous dhaher-labs, ap-southeast-1, ACTIVE_HEALTHY) = **cermin**, bukan sumber kebenaran.
- Tabel publik `civ_mirror_events` (PK seq), `civ_mirror_txns` (PK tx_id), `civ_mirror_state`, `civ_sync_log` — dibuat via Management API SQL + `notify pgrst 'reload schema'`.
- Push idempoten ber-cursor (`civsync.lastSeq`) di tiap denyut + endpoint `POST /api/civos/sync`.
- Kredensial: service key server-only via env; tanpa grant anon (uji: anon → `[]`).

## Bukti (live)
- Management API SQL: PostgreSQL 17.6 (aarch64).
- Push pertama: `eventsPushed:136, txnsPushed:9`; sinkron lanjutan inkremental (cursor 136→171); `civ_sync_log` terbaca dua arah.

## Konsekuensi
- Reset sandbox tidak menghapus sejarah peradaban di awan.
- SQLite tetap otoritatif; Supabase tidak pernah menulis balik ke kernel.
