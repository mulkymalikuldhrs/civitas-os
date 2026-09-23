# ARSITEKTUR — CIVITAS OS (Civilization OS + Agent Control Plane)

Status: KANONIK | ADR terkait: 0001, 0002, 0004, 0005, 0006

## 1. Tiga Hukum Struktural

1. **Civilization Kernel adalah satu-satunya kebenaran** (`db/custom.db`, Prisma, 14 model `Civ*`). Minecraft = dunia; memori LLM = konteks; Supabase = cermin.
2. **Semua agen lewat Control Plane**: identitas (CivAgent, lebih tua dari model mana pun), runtime denyut, router, memori ber-ACL, policy, capability grant, audit event.
3. **Intelligence ≠ Authority**: output LLM hanyalah `CivDecision` (aksi dari allowlist); eksekusi melewati `checkTxLimit` → `assertCapability` → likuiditas → executor.

## 2. Modul (`src/lib/civos/`)

| Modul | Tanggung jawab | Bukti hidup |
|---|---|---|
| `types.ts` | FLR minor-int, 13 lifecycle + tepi sah, allowlist aksi | — |
| `money.ts` | format id-ID | UI |
| `events.ts` | event immutable (seq autoincrement, tulis-sekali) | 171+ event |
| `ledger.ts` | double-entry N-leg, idempotency, likuiditas+RESERVE_MIN | INV-1..4 |
| `policy.ts` | limit di luar LLM, grant capability, registry | INV-6/9 |
| `router.ts` | registry model, klasifikasi, parse ketat, REFLEX fallback | CivTask.route LLM glm-4-plus |
| `memory.ts` | scope WORKING..INSTITUTIONAL, visibility PRIVATE/ORG/PUBLIC, ACL | UI Control Plane |
| `company.ts` | lifecycle engine, skor alokasi transparan, pelindung kelaparan | COMP-001 → ACTIVE |
| `government.ts` | 4 institusi deterministik + anggaran + pajak otomatis | pengadaan/pajak live |
| `economy.ts` | metrik, runway, konsentrasi, split revenue real/sandbox, alert per jam | UI EKONOMI |
| `settle.ts` | rail settlement eksternal (sandbox berlabel / live tergerbang) | 422 live-lock |
| `expand.ts` | kota baru, kantor kuant (paper-trading SIMULASI) | KOTA-02, COMP-QUAN |
| `minecraft.ts` | RakNet UDP ping native + cache + event perubahan status | ping nyata |
| `mcbot.ts` | bot join (bedrock-protocol runtime-only), chat hadir, SYNCED | armed, menunggu dunia |
| `supabase.ts` | mirror idempoten ber-cursor ke Supabase Dhaher Labs | 136 event/9 txn pushed |
| `runtime.ts` | denyut round-robin (1 organ/denyut), gagal-aman | 30+ denyut |
| `seed.ts`/`state.ts` | bootstrap idempoten + agregat UI | auto-seed |

## 3. Alur Denyut (siklus hidup satu tick)

```
KV cursor → pilih organ (GOV | COMPANY | CITY | COMP-QUAN)
 → organ bekerja (prosedur institusi ATAU LLM+reflex)
 → aksi → Policy → Authority → Risk/Likuiditas → Executor
 → CivTxn + CivEntry + CivEvent (+ CivTask + CivMemory)
 → sustainability check + MC status + mirror Supabase + (server online? bot join)
 → HEARTBEAT event + KV lastTick
```

## 4. Mesin Uang (semua teruji)

- `MINT` (satu-satunya kelahiran uang) → `ALLOCATION` (skor transparan; anti-dobel via proposal-usang) → `TRADE_INTERNAL` (4 leg; BUKAN revenue) / `REVENUE_EXTERNAL` (counterparty + rail) → `TAX` otomatis 10% → `TRANSFER` (anggaran pemerintah/kota) → `EXPENSE` (infra LLM ke kas bangsa).
- Invariant: ΣDEBIT=ΣCREDIT; Σakun-non-EKUITAS = MINT−BURN+EXT; replay kunci = duplikat ditolak.

## 5. Dunia Minecraft

- Ping RakNet `unconnected_ping` native (dgram) — parse `unconnected_pong` (motd/protokol/pemain).
- Bot `CIVITAS-AGENT` join via bedrock-protocol **runtime-only import** (chunk disembunyikan dari Turbopack — chunk penuh terbukti OOM-crash kompilasi dev). Presence → chat hadir → `CivWorldEntity.status=SYNCED`.
- Auto-join dari heartbeat saat transisi ke ONLINE; cooldown 5 menit; kick/timeout dilaporkan jujur.

## 6. Mirror Supabase Dhaher Labs

- Tabel `public.civ_mirror_events / civ_mirror_txns / civ_mirror_state / civ_sync_log` (dibuat via Management API SQL; `notify pgrst 'reload schema'`).
- Push idempoten ber-cursor `civsync.lastSeq` tiap denyut + endpoint manual. Service key server-only; anon = kosong (tanpa grant).
