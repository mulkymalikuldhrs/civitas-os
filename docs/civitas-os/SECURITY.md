# KEAMANAN — CIVITAS OS + FLYBRAIN OS

Status: KANONIK

## 1. Kredensial

- Semua secret (Supabase URL/service key/access token) **hanya di `.env`** server. `.env` tidak pernah masuk dokumen/repo/publikasi; `.env.example` hanya berisi nama kunci + placeholder.
- Tidak ada secret di: prompt LLM, memori agen, konteks sense-packet, log event, kode klien.
- Kunci API FlyBrain (user) = `FK1_`+SHA-256 di perangkat user — tidak berubah.
- ⚠️ **Rotasi dianjurkan**: kredensial Supabase pernah lewat jalur chat; setelah repo stabil, rotasi service/access key dari dashboard Dhaher Labs.

## 2. Intelligence ≠ Authority (lapisan paksa)

1. Allowlist aksi (`ALLOWED_ACTIONS`) — aksi asing ditolak parser.
2. `checkTxLimit`: MAX_TRANSACTION (500 FLR) + MAX_DAILY_SPEND per org (20.000 FLR) — pelanggaran = event `POLICY_VIOLATION`.
3. `assertCapability`: grant short-lived per agen per capability; expired/over-budget ditolak.
4. `assertLiquidity`: pengeluar wajib punya kas ≥ nilai + buffer; RESERVE_MIN mengikat alokasi bangsa.
5. Settlement live terkunci ganda (env flag + referensi provider).

## 3. Isolasi

- Memori: scope + visibility; lintas-organisasi dilarang keras (Company A ✗ Company B; pemerintah ✗ memori privat perusahaan).
- Ledger: idempotency key unik — replay transaksi mustahil menciptakan uang.
- Supabase: tabel mirror tanpa grant untuk anon (hasil uji: anon membaca `[]`); service key hanya di server.
- Minecraft: bot bounded (timeout 45 dtk, cooldown 5 menit, auto-disconnect); kick/kegagalan = event jujur.

## 4. Auditability

- Setiap mutasi = `CivTxn` + ≥2 `CivEntry` + `CivEvent` (+ optional `CivTask`).
- Event immutable — tidak ada update/delete di jalur event.
- Mirror Supabase memberi jejak kedua di luar mesin utama (forensik lintas-mesin).

## 5. Kill Switch

- `POST /api/civos/action {action:"reset", params:{confirm:"RESET-CIVOS"}}` — penghapusan kernel (butuh konfirmasi eksplisit dua tahap).
- Override manusia: semua aksi `register_company`/`settle_external`/`create_city` dipicu manusia tetap melewati policy engine yang sama — tidak ada pintu belakang.
