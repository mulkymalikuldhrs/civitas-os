# ADR-0002 — LLM Router Reflex-First; Identitas ≠ Model

Status: DITERIMA | Tanggal: 2026-09-23

## Konteks
PRD §8–11: semua panggilan LLM lewat router; identitas agen persisten melintasi pergantian model; sistem tidak boleh macet bila LLM gagal.

## Keputusan
- `src/lib/civos/router.ts`: registry model (glm-4-flash fast / glm-4-plus reasoning), pemilihan berdasarkan tugas/kompleksitas/sensitivitas, metadata rute tersimpan di CivTask.route (observability, tanpa secret).
- Kontrak keputusan JSON ketat (aksi dari ALLOWED_ACTIONS saja) → parse gagal = SATU penerjemahan ulang → tetap gagal = **REFLEX deterministik** berlabel jujur.
- Eksekusi TIDAK PERNAH oleh LLM: keputusan → policy (limit) → authority (grant) → risk/budget → executor.

## Konsekuensi
- CEO-001 tetap CEO-001 walau model berganti (identitas di CivAgent).
- Peradaban hidup walau LLM mati (mode REFLEX tercatat di ticker/tugas).
