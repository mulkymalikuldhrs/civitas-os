# EKONOMI — CIVITAS OS

Status: KANONIK (semua klaim punya bukti di CANONICAL.md)

## 1. Kebenaran Dasar

- **FLR florin**, integer minor unit (1 FLR = 100). Tanpa float di pembukuan.
- Uang lahir HANYA via event `MINT` (modal awal 1.000.000,00 FLR) dan mati hanya via `BURN`.
- **Internal ≠ Eksternal**: `Company→Company` dan `Government→Company` (pengadaan) adalah peredaran internal. Revenue eksternal menuntut counterparty di luar peradaban.
- **Failure = state valid**: 13 lifecycle; BANKRUPT/DISSOLVED boleh; sistem tidak memalsukan sukses.

## 2. Sirkulasi Terukur (live)

| Alur | Nilai terverifikasi |
|---|---|
| MINT awal | 1.000.000,00 FLR |
| Alokasi modal COMP-001 | 300,00 FLR (skor 60; ask ≤ 25% headroom) |
| Anggaran pemerintah | 5.000,00 FLR (kas < lantai 1.000) |
| Pendirian KOTA-02 | 2.000,00 FLR |
| Pengadaan internal pertama | 100,00 FLR (EXECUTIVE dari COMP-001) |
| Biaya infra LLM | 0,25 FLR per siklus ber-LLM → kas bangsa |
| Settlement sandbox | 250,00 FLR `[SANDBOX-TEST]` — bukan uang riil |
| **Pajak otomatis** | **25,00 FLR (10%)** masuk Kas Pajak, otomatis oleh TAX step |

## 3. Capital Allocation (tanpa optimism AI)

Skor transparan: reputasi×0.3 + bonus lifecycle + headroom-kas (ask ≤25% headroom = +25; ≤50% = +10; di atasnya skor rendah). Semua catatan skor + catatan tersimpan di proposal (`policyCheck`). Anti-dobel: proposal usang (kas ≥ 50% ask) ditolak otomatis.

## 4. Rail Revenue Eksternal (ADR-0006)

- `POST /api/civos/action {action:"settle_external", env:"sandbox"|"live"}`.
- **sandbox**: fixture uji pipeline, selalu berlabel `[SANDBOX-TEST]`, metrik dipisah (`externalRevenueSandbox`).
- **live**: terkunci sampai `EXTERNAL_SETTLEMENT_LIVE=true` + referensi penyedia pembayaran nyata. `declare_external_customer` tanpa bukti → **HTTP 422 HONESTY_GATE**.
- Pajak otomatis TAX step atas semua settlement `taxed:false` — idempoten (`tax-<txId>`).

## 5. Keberlanjutan (Sustainability Engine)

Dihitung tiap denyut: money supply, kas bangsa vs RESERVE_MIN, runway, konsentrasi income teratas, split revenue real/sandbox. Alert sekali per jenis per jam → event `SUSTAINABILITY_ALERT`. Contoh alert hidup: *"Rail eksternal teruji via SANDBOX (250.00); revenue eksternal RIIL masih 0 — jujur"*.

## 6. Kuant (SIMULASI mutlak)

COMP-QUAN paper-trading: harga = gelombang deterministik; strategi EMA + take-profit 2% + stop-loss 3%; risk gate di luar LLM. PnL = **poin simulasi** (KV `quant.state`); FLR tidak tersentuh; setiap langkah berlabel SIMULASI.
