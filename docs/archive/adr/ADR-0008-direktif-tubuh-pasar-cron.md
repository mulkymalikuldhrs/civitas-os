# ADR-0008 — Direktif Tubuh Warga, Pasar Desa, dan Cron Denyut 24/7

Status: DISETUJUI — terimplementasi & terverifikasi (2026-09-23, Task 12)
Konteks mandat pemilik: *"semua masyarakat dan agent nyata adalah villager dari Minecraft yang berubah menjadi seperti yang kita inginkan — instead of dumb villager we make it autonomously autonomous."*

## Keputusan

### 1. Direktif Tubuh (brain→body bridge)
Otak warga (LLM via Router, whitelist `VILLAGER_ACTIONS`) hanya **memutuskan**; kernel menerjemahkan keputusan menjadi **`CivVillagerDirective`** (MOVE | SPEAK | WORK_ANIM | LOOK) yang dieksekusi dunia lewat dua jalur:

- **Dunia ONLINE** → bot `CIVITAS-AGENT` mengambil batch QUEUED (`claimDirectivesForBot`, cap `DIRECTIVE_MAX_PER_JOIN`), lalu:
  - SPEAK → relay chat **berlabel** `[Nama | VIL-xxxx]` — jujur: suara relay bot, bukan suara vanilla;
  - MOVE → `command_request` `tp @e[type=villager,x=<cx>,y=<cy>,z=<cz>,r=3] <tx> <ty> <tz>` — **ber-anchor koordinat sensus** (tanpa perlu tagging/permission matching); output dunia (`command_output`) diparse defensif → APPLIED/FAILED + koordinat kernel diperbarui bila dunia mengonfirmasi;
  - WORK_ANIM/LOOK → APPLIED oleh bot tanpa command (AI vanilla tetap hidup **di bawah** kendali otonom — dumb AI bukan dihapus melainkan diarahkan).
- **Dunia OFFLINE** → jalur SIM "mimpi jaga" (`runSimDirectives`): koordinat bayangan digeser di kernel (batas `DIRECTIVE_MAX_DISTANCE`), ucapan dicatat — **berlabel jujur, tidak pernah mengaku EMBODIED** (REALITY WINS).

Mesin status: `QUEUED → DISPATCHED → APPLIED | FAILED | EXPIRED` — tanpa kebangkitan (INV-23). TTL `DIRECTIVE_TTL_MIN` (30 mnt) menjaga tubuh tak menerima perintah basi (INV-24). Semua nominal/panjang/jarak di luar LLM (policy): SPEAK_MAX_LEN, DIRECTIVE_MAX_DISTANCE, DIRECTIVE_QUEUE_CAP.

Alternatif yang DITOLAK: behavior pack + Script API beta (butuh experiments toggle + kapabilitas Aternos berubah-ubah; relay `tp`+chat cukup untuk kendali penuh dan tervalidasi oleh output dunia). Op permission untuk bot di server Aternos = prasyarat pemilik; penolakan perintah dicatat jujur FAILED.

### 2. Pasar Desa (internal market)
`CivMarketOffer` (seller COMPANY, item, unitPrice minor, qty) + matching **deterministik di kernel**: termurah dulu, FIFO untuk harga sama. Warga BUY kini lewat pasar (`buyFromMarket`) — nominal = harga×unit ditetapkan kernel (usulan LLM hanya referensi, di-clamp VILLAGER_MAX_TX/DAILY_SPEND/saldo). Perusahaan PRODUCE → auto-list (harga deterministik per code, cap MARKET_MAX_OFFERS_PER_ORG). Setiap perdagangan = TRADE_INTERNAL di ledger yang sama, meta `classification: INTERNAL — BUKAN revenue eksternal`. Konservasi stok `qtySold+qtyAvailable==qtyInitial` (INV-26), stok habis → CLOSED otomatis.

### 3. Cron Denyut 24/7
`GET/POST /api/civos/cron` = beacon denyut penuh (kernel STATEFUL sesuai ADR-0001 — berbeda dari biosfer FlyBrain yang stateless): seed → denyut institusi → denyut desa → mirror → bot → TTL direktif. Dipanggil Vercel Cron (`vercel.json` `*/5`; Hobby = degradasi harian — jujur didokumentasikan) atau pinger eksternal. Guard `CRON_SECRET` (Bearer) bila diset.

## Konsekuensi
- Tiga lapis kemandirian warga lengkap: **otak** (LLM Router), **dompet** (ledger pribadi, Slice 7), **tubuh** (direktif, Slice 8) — "autonomously autonomous" kini punya tangan fisik di dunia.
- Dunia tetap BUKAN sumber kebenaran: koordinat kernel hanya berubah oleh konfirmasi dunia (bot) atau dilabeli SIM.
- Bukti: invariant **46 PASS/0 FAIL** (INV-23..28 baru); probe pembelian pasar nyata (VIL-0007→COMP-001 @0,33 FLR, tx tercatat, stok 4→3); klaim bot `tp @e[type=villager,x=120,y=64,z=120,r=3] 110 64 105`; UI DESA (panel TUBUH + PASAR) & tab 10 (JEMBATAN OTAK→TUBUH) tervalidasi browser; build produksi hijau 12 route.
