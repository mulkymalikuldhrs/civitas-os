# ADR-0004 — Birokrasi Pemerintah Deterministik; LLM di Perusahaan

Status: DITERIMA | Tanggal: 2026-09-23

## Konteks
PRD §21–22: pemerintah = institusi multi-agen dengan separation of duties. Eksperimen denyut menunjukkan LLM per institusi memperlambat pipeline dan berisiko inkonsisten prosedural.

## Keputusan
- **Government = prosedur deterministik** (REGULATORY/TREASURY/EXECUTIVE/TAX) — keputusan berdasar aturan objektif: kelengkapan profil, skor alokasi transparan, lantai kas, headroom. Semua keputusan menghasilkan event GOVERNMENT_DECISION.
- **Company = LLM adaptif** (glm-4-plus via router) dengan pelindung kelaparan (kas-nol → wajib PROPOSE_ALLOCATION).
- Mekanisme anggaran: kas pemerintah < GOV_BUDGET_FLOOR (1.000 FLR) → TREASURY mencairkan GOV_BUDGET_GRANT (5.000 FLR) dari kas bangsa — verified live.
- Anti dobel-alokasi: proposal usang (kas ≥ 50% ask) ditolak otomatis.

## Konsekuensi
- Birokrasi dapat diaudit garis-demi-garis (deterministik), keputusan bisnis tetap hidup (LLM).
- Budget denyut terjaga: 1 institusi per denyut pemerintah.
