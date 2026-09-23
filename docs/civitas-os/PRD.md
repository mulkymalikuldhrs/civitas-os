# CIVITAS OS — PRD (Kanonik)

Status: **KANONIK — HIPOTESIS AWAL** | Sumber: sesi perencanaan pemilik (ChatGPT, 2026-09) + mandat "turn it to real thing" | Konvensi bukti: [T]=Terverifikasi, [D]=Desain, [H]=Hipotesis

## 0. Inti Visi

> Minecraft bukan sekadar game/server, tetapi dunia fisik/visual dari sebuah **autonomous civilization operating system**. State sebenarnya berada di backend **Civilization Kernel**. Sistem harus tetap berjalan meskipun manusia offline.

CIVITAS OS dibangun di atas warisan FLYBRAIN OS (organisme prt/BIOSFER yang sudah hidup di route `/`) sebagai **lapisan peradaban skala makro**: pemerintah, kota, perusahaan, agen, ekonomi riil, dan representasi dunia Minecraft.

## 1. Prinsip Ekonomi (Non-Negotiable)

- Aktivitas internal ≠ pendapatan eksternal. `Company A → Company B` BUKAN revenue.
- Revenue eksternal butuh counterparty eksternal nyata. Belum ada → status jujur `PRE_REVENUE`.
- Uang tidak bisa muncul tanpa event `MINT`; tidak bisa hilang tanpa event burn/settlement.
- Ledger double-entry harus seimbang; financial state direkonstruksi dari event.
- Failure adalah state valid: perusahaan boleh BANKRUPT; sistem tidak memalsukan sukses.

## 2. Arsitektur Besar

```
CIVILIZATION (Nation: NUSANTARA DIGITAL)
   ├── GOVERNMENT (institusi multi-agen, bukan satu super-LLM)
   │     Executive · Treasury · Regulatory
   ├── CITIES (Kota Nusantara — infrastruktur, spesialisasi)
   └── COMPANIES (lifecycle 13 state, capital allocation)
            │
      AGENT CONTROL PLANE
      Identity · Runtime · LLM Router · Memory (scoped)
      Credentials · Policy · Capability · Budget · Audit
            │
      CIVILIZATION KERNEL  ← authoritative state (SQLite/Prisma)
      Ledger double-entry · Event immutable · Governance · World State
            │
      MINECRAFT (world layer — mulkymalikuldhr.aternos.me:19132, Bedrock)
      Representasi visual, BUKAN sumber kebenaran finansial.
```

## 3. 10 Aturan Kanonik (dari sesi pemilik, diratifikasi)

1. Minecraft adalah world layer, bukan database peradaban.
2. Civilization Kernel adalah authoritative state.
3. Semua agen melewati Agent Control Plane.
4. Semua LLM call melewati LLM Router.
5. Identitas agen ≠ model LLM (CEO-001 tetap CEO-001 ganti model apa pun).
6. Memory scoped + permissioned (Company A tidak bisa baca Company B).
7. Credentials isolated, scoped, revocable, auditable (metadata + capability, bukan secret di prompt).
8. Intelligence ≠ Authority: LLM boleh usulkan, eksekusi lewat Policy → Authority → Risk → Budget → Capability → Executor.
9. Government = institusi multi-agen dengan separation of duties.
10. PRD adalah hipotesis yang berevolusi lewat bukti (ADR).

## 4. MVP (Target, bukan alasan membangun sekaligus)

1 Nation · 1 Government (3 institusi, 4+ agen) · 1 City · 3 Companies · 10–50 Agents · 1 Internal Currency (FLR florin) · 1 Treasury · 1 Double-entry Ledger · 1 Event Bus · 1 Minecraft Server mapping · 1 Agent Runtime · 1 MCP-style gateway · 1 Dashboard · **denyut otonom** (heartbeat) yang terus berjalan tanpa manusia.

## 5. Vertical Slice (metode §30)

Slice 1 (WAJIB dulu): Agent → Company → Task → Revenue → Treasury → Ledger.
Slice 2: Government → Tax → Budget → Company registration.
Slice 3: City → Infrastructure.
Slice 4: Minecraft entity ↔ civilization entity sync.
Slice 5: Capability/MCP gateway.
Slice 6+: Crypto settlement, native token, quant — **DESIGNED, bukan LIVE** (ADR-0003).

## 6. Batas Kejujuran (§35 NO FAKE COMPLETION)

- Tidak ada customer eksternal nyata → external_revenue = 0, dilaporkan apa adanya.
- Server Aternos tidur (free tier) → status Minecraft dilaporkan dari ping UDP nyata, tidak dipalsukan.
- LLM = z-ai-web-dev-sdk (server-side); bila gagal/tidak tersedia → mode REFLEX deterministik, dilabeli.
- Setiap klaim status di CANONICAL.md wajib punya bukti (file, endpoint, output perintah).

## 7. Server Minecraft Pemilik

- Host: `mulkymalikuldhr.aternos.me` · Port: `19132` (Bedrock/RakNet UDP) [T dari pemilik]
- Ping RakNet `unconnected_ping` diimplementasi native (tanpa dependensi berat); hasil → cache KV 15 dtk.
- Server Aternos tidur otomatis; sistem melaporkan OFFLINE jujur + instruksi bangunkan via panel pemilik.

## 8. SLICE 7 — VILLAGER ASCENSION (mandat pemilik 2026-09-23)

Mandat: *"semua masyarakat dan agent nyata adalah villager dari Minecraft yang berubah
menjadi seperti yang kita inginkan — instead of dumb villager we make it autonomously
autonomous."* Setiap villager dunia adalah warga peradaban, bukan dekorasi.

### 8.1 Aturan desa
1. **identity ≠ embodiment** — identitas warga (`CivVillager`) hidup di kernel;
   tubuh dunia (`mcEntityUid`) hanyalah perwujudan. Warga tetap hidup saat dunia
   tidur (`DREAMING`) atau tubuh tak terlihat (`MISSING`).
2. **Dua pintu sensus, berlabel jujur** — `SIMULASI` (populasi uji saat dunia tidur,
   auto-seed pada denyut desa pertama) dan `CENSUS` (sensus nyata dari packet
   AddEntityActor via bot). Sensus nyata mengundurkan warga SIMULASI (RETIRED,
   sejarah tetap auditable). REALITY WINS.
3. **Otonomi berlapis** — warga memutuskan via LLM Router dengan whitelist
   `VILLAGER_ACTIONS` (WORK · BUY · SOCIALIZE · WANDER · REST · SAVE ·
   PROPOSE_TO_GOV) yang TERPISAH dari whitelist institusi; eksekusi selalu kernel
   (nominal, limit, likuiditas di luar jangkauan LLM). REFLEX deterministik menjaga
   denyut saat LLM gagal.
4. **Ekonomi warga nyata** — upah = `WAGE` dari kas operasional perusahaan; konsumsi
   = `TRADE_INTERNAL` meta `villagerBuyer` (TIDAK PERNAH revenue eksternal); dompet =
   akun `WALLET` pribadi di ledger yang sama dengan bangsa.
5. **Kebijakan desa di luar LLM** — `WAGE_PER_WORK` (60 minor = 0,60 FLR),
   `VILLAGER_MAX_TX` (250 minor), `VILLAGER_DAILY_SPEND` (1.000 minor/hari),
   `VILLAGE_POPULATION_CAP` (24), `VILLAGE_PULSE_EVERY` (2 denyut institusi).
6. **Profesi → peran ekonomi** — 14 profesi Bedrock (VILLAGER_DATA key 17) dipetakan
   deterministik: Petani/Nelayan/Gembala (PRODUCER), Pustakawan/Kartografer
   (SCHOLAR), Klerik (SPIRIT), 5 penempa/kulit/batu (CRAFT), Jagalan (TRADE),
   nitwit → **Filosof** (PHILOSOPHER), unemployed → Calon Pekerja (SEEKER).

### 8.2 Bukti Slice 7 (2026-09-23)
- Sensus SIM 8 warga (VIL-0001..0008) + denyut LLM nyata (glm-4-plus): upah dibayar
  (Aji 2×, Lestari 1× @0,60 FLR), upah tertunda jujur saat kas perusahaan 0,
  SOCIALIZE mengangkat skor sosial, WANDER berlabel "mimpi jaga".
- Invarian **28 PASS / 0 FAIL** (INV-17..22 tambahan desa); tsc 0; lint bersih;
  build produksi hijau; E2E browser tab DESA 0 error konsol.
- Sensus NYATA armed: auto-join saat server online → parser entitas → CENSUS.

## 9. SLICE 8 — VILLAGER EMBODIMENT + PASAR DESA + CRON 24/7 (mandat 2026-09-23, Task 12)

### 9.1 Desain
- **Direktif tubuh** (`CivVillagerDirective`: MOVE|SPEAK|WORK_ANIM|LOOK) — jembatan
  "otak→tubuh": LLM memutuskan, kernel menerjemahkan, dunia mengeksekusi.
  ONLINE → bot mengklaim batch (cap 16/join): SPEAK relay chat berlabel
  `[Nama | VIL-xxxx]`, MOVE `tp` ber-anchor koordinat sensus (r=3), output dunia
  diparse → APPLIED/FAILED + koordinat kernel sinkron. OFFLINE → SIM "mimpi jaga"
  berlabel jujur (koordinat bayangan, tak pernah mengaku EMBODIED).
  Mesin status QUEUED→DISPATCHED→APPLIED|FAILED|EXPIRED tanpa kebangkitan;
  TTL 30 menit; semua limit di luar LLM (DIRECTIVE_*/SPEAK_MAX_LEN).
- **Pasar desa** (`CivMarketOffer`): perusahaan PRODUCE → auto-list (harga
  deterministik, cap 6 OPEN/org); warga BUY → matching TERMURAH deterministik
  (FIFO); nominal = harga×unit ditetapkan kernel (usulan LLM hanya referensi);
  TRADE_INTERNAL di ledger yang sama, klasifikasi INTERNAL; stok habis → CLOSED.
- **Cron 24/7**: `/api/civos/cron` (GET/POST, guard CRON_SECRET) — denyut penuh
  (kernel stateful, ADR-0001); vercel.json */5 (Hobby=degradasi harian, jujur).

### 9.2 Bukti Slice 8 (2026-09-23)
- Invarian **46 PASS / 0 FAIL** (INV-23..28: mesin status, TTL, SIM-reality,
  klaim bot berlabel, SPEAK cap, konservasi pasar + alur beli nyata).
- Probe runtime: direktif applied berlabel SIM (WORK_ANIM/SPEAK); klaim bot
  `tp @e[type=villager,x=120,y=64,z=120,r=3] 110 64 105`; pembelian pasar nyata
  VIL-0007→COMP-001 @0,33 FLR (stok 4→3, tx tercatat).
- UI: panel TUBUH WARGA + PASAR DESA (tab DESA), JEMBATAN OTAK→TUBUH (tab 10);
  screenshot civ-11/12; tsc 0; lint bersih; build produksi hijau (12 route).
- Tersisa jujur: eksekusi fisik di dunia menunggu server Aternos online + OP bot.

## 10. SLICE 9 — GUILD KERJA & TOOLFORGE + DASHBOARD DEPAN (mandat 2026-09-23, Task 13)

Mandat pemilik: (1) lanjutkan hingga final; (2) redesign & rebuild UI dashboard
depan; (3) server Minecraft `mulkymalikuldhr.aternos.me:19132` Bedrock
1.26.51.1 (invite `add.aternos.org/mulkymalikuldhr`); (4) tambah villager/AI
agent dengan tugas coding, dev, pembangunan, military, engineer, miner,
sambungan internet nyata, dan tool calling.

### 10.1 Guild (divisi kerja warga)

`CivVillager.division` — 8 guild spesialis + GENERAL. Sensus SIMULASI merotasi
semua guild (8 warga pertama = satu per guild); sensus CENSUS (dunia nyata)
memetakan profesi vanilla → guild (librarian→CODER, mason→BUILDER,
armorer/weaponsmith→MILITARY, toolsmith→ENGINEER, fisherman→NETRUNNER, dst.).

| Guild | Kerja nyata | Tool (charter) | Artefak |
|---|---|---|---|
| CODER | kode util peradaban | code_write | CODE |
| DEV | spesifikasi produk | spec_write | SPEC |
| BUILDER | konstruksi dunia | build_plan | BLUEPRINT (+direktif BUILD) |
| MILITARY | patroli & pertahanan | patrol_report | PATROL (+direktif PATROL) |
| ENGINEER | infrastruktur | build_plan | BLUEPRINT (+direktif BUILD) |
| MINER | sumber daya | mine_route | MINE_YIELD (+listing pasar) |
| NETRUNNER | sambungan internet nyata | web_search, page_reader | RESEARCH (ber-URL) |
| TOOLSMITH | orkestrasi tool | semua tool | REPORT/SPEC/... |

### 10.2 Toolforge — tool calling teraudit

Satu gerbang `invokeTool()`: otorisasi (charter divisi untuk warga; grant
capability untuk agen) → eksekusi → audit `CivToolCall` + event `TOOL_INVOKED`
→ artefak `CivArtifact` + event `ARTIFACT_CREATED`. Ghost tool & pelanggaran
charter → DENIED **tercatat** (tidak ada tool hantu). Internet nyata via
z-ai-web-dev-sdk `web_search`/`page_reader` — artefak RESEARCH membawa URL
sumber; gagal jaringan → FAILED/TIMEOUT jujur tanpa artefak karangan.

Kebijakan baru di luar LLM: TOOL_MAX_PER_PULSE=1, WEB_SEARCH_MAX_RESULTS=5,
TOOL_TIMEOUT_MS=20s, ARTIFACT_MAX_CHARS=4000, MINE_YIELD_MAX_UNITS=8,
BUILD_MAX_FOOTPRINT=81, PATROL_RADIUS_MAX=64.

WORK warga kini division-aware: upah tetap dari kas operasional, lalu kernel
menjalankan SATU tool guild (payload LLM boleh menjadi input, mis. kueri
riset — otorisasi tetap kernel). Hasil tambang otomatis dilist ke pasar desa
(konservasi stok). Direktif tubuh baru BUILD/PATROL/MINE ber-anchor koordinat:
SIM "mimpi jaga" merehearsal berlabel; bot mengumumkan rencana via chat dunia
+ PATROL menggerakkan tubuh via tp; penempatan blok fisik jujur menunggu OP.

### 10.3 Dashboard depan — CIVITAS COMMAND CENTER

Halaman depan default (nav 00 CIVITAS): header identitas + status dunia + server
info (Bedrock 1.26.51.1 + invite); KPI (Kas Bangsa, Revenue Eksternal RIIL jujur,
Kas Pajak, Populasi & Guild, Artefak, Event); GUILD KERJA 8 kartu; TOOLFORGE
(registry + audit + **jalankan tool dari UI**); PETA; EVENT immutable; PANEL
KEJUJURAN; PUSTAKA ARTEFAK; PASAR DESA; WARGA BERDENYUT; KEBIJAKAN. Panel lama
tetap tersedia: nav 10 Peradaban+ (kontrol penuh 7 sub-tab) dan nav 11 MINECRAFT.

### 10.4 Bukti Slice 9 (2026-09-23)

- Invarian **57 PASS / 0 FAIL** (INV-29a/b charter & ghost DENIED tercatat;
  INV-30 audit konsisten; INV-31 artefak ≤ cap + URL nyata; INV-32 cap tambang;
  INV-33 direktif guild valid; INV-34 agregat & registry↔charter).
- Probe guild: 8 denyut → upah + artefak 8 guild; web_search nyata 2× (URL
  tradingeconomics dkk.); DENIED 3×; 6 direktif guild applied (SIM); listing
  tambang di pasar.
- E2E UI: render dashboard, DENYUT sukses, JALANKAN TOOL → "riset internet
  nyata \"strategi ekonomi desa\" — 5 sumber tercatat", tab MINECRAFT menampilkan
  Bedrock 1.26.51.1 + invite; mobile 390px; 0 error aplikasi; screenshot civ-13..17.
- Server Aternos masih tidur (jujur); sensus CENSUS + eksekusi dunia tetap ARMED.
