# ADR-0007 — Identitas Villager: Dari NPC Bodoh Menjadi Agen Otonom (Villager Ascension)

**Status:** DITERIMA (DIIMPLEMENTASIKAN — Slice 7)
**Tanggal:** 2026-09-23
**Mandat pemilik:** "semua masyarakat dan agent nyata adalah villager dari Minecraft yang berubah menjadi seperti yang kita inginkan — instead of dumb villager we make it autonomously autonomous."

## Konteks

Sebelum Slice 7, populasi peradaban ada di dua dunia yang tidak bertemu:
agen kernel (13 seeded, institusi) dan villager Minecraft (entitas dunia
tanpa identitas apa pun — NPC murni yang berkeliaran tanpa kehendak).
Mandat pemilik menyatukan keduanya: **villager di dunia adalah warga
peradaban**, bukan dekorasi.

## Keputusan

### D1 — identity ≠ embodiment (turunan langsung aturan §5 PRD)
Identitas warga hidup di kernel (`CivVillager`): kode, nama, profesi,
peran ekonomi, dompet, memori, XP, skor sosial. Tubuhnya hanyalah entitas
dunia (`mcEntityUid`). Satu warga bisa `DREAMING` (dunia tidur) atau
`MISSING` (tubuh hilang dari pandangan sensus) tanpa kehilangan
identitas, dompet, atau sejarah.

### D2 — Dua pintu sensus, dua-duanya berlabel jujur
- `createCensus(n, "SIMULASI")` — populasi uji berlabel, dibuat otomatis
  saat desa kosong & dunia tidur (denyut desa pertama), atau manual via
  API/UI. Tujuan: pipeline desa terbukti end-to-end tanpa menunggu server.
- Sensus NYATA via bot (`observeVillagers`): setiap packet
  `AddEntityActor` bertipe `minecraft:villager(_v2)?` diparse
  (profesi dari metadata VILLAGER_DATA, key 17) → identitas `CENSUS`
  lahir terikat `entityUid`. **Sensus nyata mengundurkan warga SIMULASI**
  (`RETIRED`, bukan dihapus — sejarah auditable). REALITY WINS.

### D3 — Otonomi berlapis (Intelligence ≠ Authority, turunan §8)
Warga memutuskan lewat LLM Router (whitelist `VILLAGER_ACTIONS`:
WORK/BUY/SOCIALIZE/WANDER/REST/SAVE/PROPOSE_TO_GOV — whitelist terpisah
dari institusi), tetapi **eksekusi selalu kernel**: nominal upah
(`WAGE_PER_WORK`), batas belanja (`VILLAGER_MAX_TX`,
`VILLAGER_DAILY_SPEND`), ketersediaan kas perusahaan — semuanya di luar
jangkauan LLM. LLM tidak bisa mengarang nominal, tak bisa membeli
melebihi dompet, tak bisa menciptakan revenue eksternal.

### D4 — Ekonomi warga nyata di ledger yang sama
Upah = `WAGE` (kas operasional perusahaan → dompet warga). Konsumsi =
`TRADE_INTERNAL` dengan meta `villagerBuyer` — **klasifikasi internal,
tidak pernah revenue eksternal** (invarian INV-19). Dompet warga =
`CivAccount` kind `WALLET` (orgId null — milik pribadi, bukan kas org).

### D5 — Denyut desa terikat denyut institusi
`VILLAGE_PULSE_EVERY` (default 2): setiap N denyut institusi, satu warga
bertindak (round-robin). Desa dan institusi berbagi satu mata uang dan
satu ledger — upah warga bergantung kas perusahaan yang dialokasikan
pemerintah; kemiskinan perusahaan menghasilkan upah tertunda yang
dilaporkan jujur, bukan dana fiktif.

## Konsekuensi

- Populasi desa selalu berlabel sumbernya (SIMULASI/CENSUS) di UI + event.
- Kematian/kebangkrutan perusahaan berdampak nyata ke warga (upah
  tertunda) — realisme ekonomi menuntut pemerintah bekerja.
- Binding tubuh (`entityUid`) bisa berubah antar-restart server; policy
  re-bind: sensus berikutnya menandai `MISSING` dan tubuh baru → identitas
  baru (no silent takeover). Kenaikan derajat via name-tag/posisi bisa
  ditambah di Slice lanjutan bila dibutuhkan.
- Profesi dipetakan deterministik (14 profesi Bedrock → label & peran
  ekonomi Nusantara; `nitwit` → Filosof/PHILOSOPHER — bahkan si
  "bodoh" pun naik derajat).

## Bukti (2026-09-23)

- Sensus SIM: 8 warga (VIL-0001..0008) + event `VILLAGER_ASCENDED`.
- Denyut warga LLM nyata (glm-4-plus): WORK dibayar (Aji 0,60 FLR ×2,
  Lestari 0,60 FLR), WORK ditunda jujur (kas COMP-002/003/004/QUAN = 0),
  SOCIALIZE (Jaka↔Lestari, sosial 50→56), WANDER berlabel "mimpi jaga".
- Invarian: **28 PASS / 0 FAIL** (INV-17 konservasi dompet 180=180−0,
  INV-18 keunikan identitas, INV-19 internal≠eksternal, INV-20 limit
  belanja, INV-21 upah==WAGE_PER_WORK, INV-22 parser packet).
- tsc 0 error · lint bersih · build produksi hijau · E2E browser tab DESA
  8 kartu warga + 0 error konsol.
