# 11_AUTONOMOUS_ORGANISM.md — Desain Reuni "BIOSFER" v1.1

Versi: 1.1 | Status: [T] desain terkunci 2026-09-21 | Konvensi: [T]=Terverifikasi, [D]=Desain, [H]=Hipotesis

## 0. Mandat Pemilik

"Ambil [4 repo Autonomous-Organism milik pemilik] dan gabungkan menjadi satu system.
Jadikan satu organisme benar-benar hidup; desain ulang dan gabungkan jadi satu.
Goal: design ulang keseluruhan dan jadikan Autonomous Organism sepenuhnya otonom
dengan semua creature otonom di dalamnya."

## 1. Sumber yang Direuni [T]

| Sumber | Lokasi klon | Apa yang ia bawa | Status |
|---|---|---|---|
| github `mulkymalikuldhrs/autonomous-organism` | `/upstream/gh-mulkymalikuldhrs` | **Anatomi dasar**: 6 organ JS murni — sense, memory, decision, immune, scheduler, factory + OrganismCore/OrganEngine UI; framing jujur "bounded evolution" | Jun 2026 |
| gitlab `mulkymalikuldhr/Autonomous-Organism` | `/upstream/gitlab-mulkymalikuldhr` | **Peradaban (ACOS)**: citizen/planet, ORCA orchestrator, Jeumpa brain (LLM), koloni agent (EventBus, CircuitBreaker, MetaCognition), quant engine (5 file pure-TS), self-reflect, konstitusi, shop/wallet | Jul 2026 **TERBARU** |
| codeberg (mirror) | `/upstream/codeberg-mulkymalikuldhr` | Identik 1:1 dengan gitlab (hash commit sama) — dianggap satu sumber | mirror |
| github `mulkymalikuldhaher/...` | — | TIDAK DAPAT DIAKSES (privat/typo) — dicatat jujur; kalau ada kode unik di sana, cangkok belakangan | ⚠️ akses |
| FLYBRAIN OS v0.2–v1.0 (repo ini) | `src/lib/flybrain/*` | **Tubuh platform**: kernel zero-storage (vault IndexedDB, auth FK1_, kwitansi, gerbang universal `/api/mcp`), prt + organ bisnis (guardian/merchant/envoy/scout), Ruang Kendali | sesi 1–3 |

## 2. Keputusan Desain Fundamental [D]

1. **Satu organisme, tiga warisan.** Nama produk: **AUTONOMOUS ORGANISM — BIOSFER**
   (lapisan platform tetap FLYBRAIN OS). Repo gh = anatomi (organ), repo gitlab =
   penduduk (creature + peradaban), FLYBRAIN = tubuh/metabolisme platform.
2. **Tanpa Supabase sebagai dependensi inti.** Repo gitlab bergantung keras pada
   Supabase (Postgres + 55 edge function). Desain baru memindahkan *state kehidupan*
   ke vault lokal user (IndexedDB, zero-storage) dan *otak* ke serverless stateless
   (`/api/organism/*`). Supabase/infra upstream = **adaptor opsional masa depan**
   (Fase 4), bukan prasyarat hidup.
3. **Creature = sel otonom.** Setiap creature punya: genom (spesies, peran, sifat),
   energi, kekayaan, keterampilan, memori pribadi, dan loop sarafnya sendiri
   SADAR→TAFSIR→PUTUSKAN→BERTINDAK→INGAT. Creature tidak menunggu perintah —
   scheduler membagi denyut (heartbeat) dan tiap creature menjalankan siklusnya.
4. **Evolusi terbatas yang jujur** (warisan framing repo gh): creature boleh menyetel
   parameter dirinya (energi target, frekuensi, strategi dalam action-space) — TIDAK
   menulis ulang kode fundamental. Bukan AGI, bukan kesadaran; **operational
   autonomy**. Klaim "uang riil" dari upstream TIDAK dibawa (belum terverifikasi).
5. **Konstitusi mengikat semua creature** (port dari CONSTITUTION.md + constitution.ts
   upstream, dipadatkan): nol-penyimpanan, privasi agregat, kejujuran finansial,
   non-destruktif, transparansi radikal, budget siklus, veto konstitusional pada
   setiap keputusan LLM.
6. **Server amnesia tetap total.** Semua API route stateless; klien mengirim sense-
   packet agregat; server tidak pernah menyimpan. Ledger kehidupan tertulis di
   perangkat pemilik.

## 3. Anatomi Menyatu (peta port sumber → target) [D]

| Modul target (`src/lib/flybrain/organism/`) | Port dari | Catatan adaptasi |
|---|---|---|
| `organs/sense.ts` | gh `sense/index.js` | filter+klasifikasi stimuli; input = event lokal, bukan Supabase |
| `organs/memory.ts` | gh `memory/index.js` + gitlab `ecosystem-memory.ts` | episodic/semantic/prosedural → IndexedDB vault |
| `organs/decision.ts` | gh `decision/index.js` + gitlab `jeumpa-brain.ts` | LLM serverless + policy + veto konstitusi |
| `organs/immune.ts` | gh `immune/index.js` + gitlab `CircuitBreaker.ts` + `self-heal` | breaker per creature, self-heal loop |
| `organs/scheduler.ts` | gh `scheduler/index.js` + gitlab `cron-scheduler.ts` | denyut klien (±45 dtk) + prioritas; produksi: edge cron |
| `organs/factory.ts` | gh `factory/index.js` + gitlab `SkillCrystallizer.ts` | membangun skill/tool kecil dalam batas aman |
| `creature.ts`, `creatures.ts` | gitlab `src/colony/core/*` (BaseAgent, EventBus) + peran civilization-work | model makhluk + 6 spesies awal |
| `quant/` (types, scoring, portfolio, risk-gate, quant-tick) | gitlab `src/quant/*` **port langsung** | pure-TS, hapus import luar |
| `selfReflect.ts` | gitlab `supabase/functions/self-reflect` | verdict ok/degraded/critical dari ledger lokal |
| `constitution.ts` | gitlab `_shared/constitution.ts` + CONSTITUTION.md | 7 hukum + fungsi veto |
| `eventBus.ts` | gitlab `EventBus.ts` | bus kejadian biosfer lokal |

### 3.1 Creature awal (6 spesies) [D]

| Creature | Spesies | Peran (warisan civilization-work) | Refleks offline | Otonomi LLM |
|---|---|---|---|---|
| **prt** | Lalat (guardian) | penjaga platform, organ bisnis 4 arah | patroli vital | heartbeat organ |
| **Tradio** | Trader | sinyal pasar (Polygon/AlphaVantage → di sini: quant engine lokal) | skoring simulasi random-walk via quant engine | keputusan posisi |
| **Scriba** | Writer | artikel/laporan ekosistem | laporan keadaan dari ledger | draft konten |
| **Lumen** | Researcher | indeks pengetahuan vault, temuan pola | indeksasi memori | asosiasi pola |
| **Cresca** | Farmer | panen peluang (airdrop/growth checklist) | checklist tick | prioritas peluang |
| **Fabro** | Builder | usulkan & rakit tool kecil (factory) | blueprint tool | keputusan build |

Energi: aksi produktif menambah kekayaan/energi (metabolisme); idle menguras perlahan;
energi 0 = tidur (dibangunkan prt/immune). Event kelahiran/tidur/mati dicatat di bus.

## 4. Layanan Otonom (bagaimana ia "hidup sendiri") [D]

1. **Denyut (client engine)**: AppShell memasang scheduler; tiap ±45 dtk pilih creature
   (prioritas: immune-incident > prt > round-robin peran) → jalankan loop. Tombol
   **PICU DENYUT** memicu instan (juga untuk verifikasi).
2. **Penalaran (server)**: creature yang diberi mandat + online → `POST /api/organism/
   heartbeat` (body diperluas: `creatureId`, `role`, `organ`) → keputusan JSON dengan
   veto konstitusi dieksekusi di klien.
3. **Refleks (offline fallback)**: tanpa jaringan/kuota → perilaku deterministik per
   peran (tabel §3.1), ditandai jujur "refleks" bukan "menalar".
4. **Self-reflect**: tiap N denyut, organ immune mengintrospeksi biosfer (staleness,
   error ledger, creature tidur) → verdict → remediasi nyata lokal (bangunkan,
   reset breaker, rapikan ledger).
5. **Gerbang universal tetap satu**: `/api/mcp` — tools diperluas: `creature.list`,
   `creature.dispatch` (stateless: klien membawa state, server mengembalikan keputusan).
6. **Produksi (Fase 4)**: edge cron menjalankan denyut saat konsol tertutup; hasil
   dipull saat kembali (server tetap tidak menyimpan).

## 5. Visualisasi Wajib (anti-slop) [D]

- **07 BIOSFER** (view baru): makhluk hidup sebagai entitas animasi (canvas/SVG, ikon
  spesies, energi/kekayaan), feed kejadian bus live, klik creature → inspektor (genom,
  jejak SADAR→INGAT terakhir, memori), panel quant mini (alokasi portofolio + status
  risk-gate), log kelahiran/tidur/mati.
- **06 RUANG KENDALI** (sudah ada): jejak keputusan, mandat, ledger, denyut, endpoint.
- Semua perubahan state creature terlihat; tidak ada aksi bayangan.

## 6. Kejujuran & Keamanan [T — temuan recon upstream]

1. ⚠️ **SECURITY**: 11 script Python di root repo gitlab/codeberg memuat **password
   Postgres Supabase plaintext** (hardcoded). Karena repo publik — **ROTASI
   KREDENSIAL SEGERA** oleh pemilik. Repo baru TIDAK menyalin secret apa pun.
2. RLS shop upstream terbuka untuk anon; klaim revenue on-chain belum punya rantai
   payout nyata; jumlah edge function berbeda antar dokumen — semua TIDAK dibawa;
   dicatat sebagai backlog audit upstream.
3. Bioskfer v1.1 = operational autonomy (L3 penuh klien, L4 parsial via gerbang);
   bukan AGI/kesadaran; evolusi terbatas dalam batas.
4. Repo `mulkymalikuldhaher/...` tidak dapat diakses — jika berisi versi lebih baru,
   cangkok mengikuti peta §3 tanpa mengubah arsitektur.

## 7. Acceptance v1.1 [D]

- [ ] 6 organ TS + eventBus + constitution lolos lint & dipakai loop creature
- [ ] quant engine terport & menilai portofolio simulasi Tradio
- [ ] Scheduler klien hidup; PICU DENYUT → keputusan LLM atau refleks berlabel jujur
- [ ] BIOSFER render 6 creature + inspektor + feed bus; mobile 390px aman
- [ ] `/api/mcp` tools baru `creature.list`/`creature.dispatch` jalan (curl)
- [ ] dev.log bersih; dokumen 00/08/09 + 11 konsisten
