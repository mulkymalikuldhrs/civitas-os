# PETA WARISAN 4 REPO UPSTREAM — Autonomous Organism

Lokasi kloning lokal: `/upstream/{codeberg,gitlab}-mulkymalikuldhr` (+ turunannya). Status: **rujukan arsip** — esensi mesinnya sudah dicangkok ke organisme tunggal ini; secret upstream TIDAK disalin (plus: kredensial plaintext di skrip Python upstream = wajib dirotasi pemilik).

## Peta pewarisan

| Mesin upstream | Asal | Nasib di organisme ini |
|---|---|---|
| `civilization-tick`, `civilization-work`, `round-robin` | supabase functions (codeberg/gitlab) | Ditingkatkan → denyut kernel `runtime.ts` (1 organ/denyut, gagal-aman, bukti event) |
| `constitution.ts` (7 hukum + veto klien) | upstream | Warisan FlyBrain BIOSFER — tetap aktif untuk creature; peradaban memakai policy engine kernel |
| `market-engine` | `_shared/` | Dipetakan → Roadmap #5 (pasar internal; belum dicangkok) |
| `quant/` (scoring, portfolio, risk-gate, quant-tick) | codeberg `src/quant` | Pelopor COMP-QUAN: versi baru deterministik + risk gate di luar LLM (`expand.ts`) |
| `wallet-revenue`, `revenue-monitor` | migrations/functions | Digantikan ledger double-entry + rail settlement (ADR-0006) — jauh lebih kuat |
| `agent-identity`, `memory-stream`, `ecosystem-memory` | `_shared/` | Digantikan CivAgent persisten + CivMemory ber-ACL |
| `khalifah`, `orchestrator`, `colony-orchestrate` | functions | Digantikan rotasi institusi pemerintah (ADR-0004) |
| R3F universe (galaxy/planet) | codeberg `src/lib/universe` | Tetap di PlanetView warisan FlyBrain (v1.2) |
| Supabase schema lama (`living_civilization`, dll.) | migrations | TIDAK dibawa; peradaban kini kernel SQLite + mirror `civ_*` |

## Prinsip cangkok

1. Konsep diambil, implementasi ditulis ulang di atas kernel otoritatif (bukan copy tempel Supabase-function).
2. Semua yang diwariskan wajib lulus invariant + bisa diaudit event.
3. Upstream tetap utuh di `/upstream` sebagai arsip rujukan.
