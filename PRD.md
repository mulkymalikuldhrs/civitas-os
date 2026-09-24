<div align="center">

# CIVITAS OS — PRD (Product Requirements Document)

**Peradaban Minecraft Otonom yang dijiwai Organisme Digital Otonom Umum**

v1.2 "ORGANISM" · Pemilik: **Mulky Malikul Dhaher** · mulkymalikuldhr@mail.com

Server: `mulkymalikuldhr.aternos.me:19132` (Bedrock 1.26.51.1, online) + lokal all-in-one (Bedrock PMMP + Java Purpur)

</div>

---

## 1. Ringkasan Mandat

CIVITAS OS bukan "aplikasi" dan bukan "kumpulan bot". Ia adalah **organisme digital otonom yang hidup di dalam (dan di sekitar) dunia Minecraft**: berdenyut sendiri, mengamati dunianya, menetapkan tujuannya sendiri, mengeksekusi, mengukur, mengingat, bermutasi, dan berevolusi — dengan manusia hanya memegang lima kontrol: **PAUSE · KILL AGENT · KILL PRODUCT · KILL ORGANISM · LOCK**. Tidak ada workflow approval. Tidak ada task list permanen.

Mandat pembeda dari PRD generasi sebelumnya: seluruh sistem kini dibangun di atas **General Autonomous Digital Organism Runtime** — fondasi hidup yang akan dipakai *semua role di masa depan*. Role apa pun (villager, government, company, content, admin, quant, dsb.) lahir sebagai organisme: punya DNA, world model, loop otonom, capability graph, sistem imun, dan jalur evolusi yang sama.

> **Prinsip konstitusi:** *"Jangan hardcode kecerdasan organisme. Hardcode hanya fondasi agar ia bisa hidup."*

## 2. Yang Di-hardcode (dan TIDAK)

| Di-hardcode (fondasi) | Dibiarkan hidup (organisme yang memutuskan) |
|---|---|
| Runtime & lifecycle (RUNNING/PAUSED/KILLED/LOCKED) | Bobot penilaian tujuan (`genome.weights`) |
| Sandbox mutasi (git worktree + benchmark) | Strategi aktif (`balanced-growth/guardian/explorer/economist`) |
| Protokol tool (tool registry + permission check) | Interval & bias siklus (`genome.workflow`) |
| Interface memori (ring buffer + cap) | Komposisi populasi agent (`agentComposition`) |
| Sistem imun (7 limit deklaratif → enforced) | Pilihan "do nothing" vs bertindak |
| Kill switch (file KILL_SWITCH dibaca tiap siklus) | Capability yang dibangun/discovered/delegated |
| Resource boundary (RSS, memori, network, timeout) | Arah evolusi (mutasi L1–L5) |

## 3. Arsitektur Lima Lapis + Runtime Organisme

```
┌─────────────────────────────────────────────────────────────┐
│  L5 · MINECRAFT (embodiment)  Bedrock + Java all-in-one      │
├─────────────────────────────────────────────────────────────┤
│  L4 · CIVILIZATION KERNEL   ledger·event·policy·config       │
├─────────────────────────────────────────────────────────────┤
│  L3 · ORGANISM RUNTIME  ★BARU★  DNA·loop·goals·mutation·imun │
├─────────────────────────────────────────────────────────────┤
│  L2 · AGENT CONTROL PLANE  villager·gov·company·dashboard    │
├─────────────────────────────────────────────────────────────┤
│  L1 · AUTONOMOUS CIVILIZATION  ekonomi·pemerintahan·sosial   │
└─────────────────────────────────────────────────────────────┘
```

L3 baru (`src/lib/civos/organism/`) adalah jantung mandat ini. Ia mengamati L1–L5 lewat probe nyata dan bertindak atasnya lewat aksi nyata.

## 4. General Autonomous Digital Organism — 38 Poin → Implementasi

Setiap poin dipetakan ke modul nyata + bukti eksekusi. **Tanpa mock: sel yang diberi ✅ memiliki bukti runtime (selftest `scripts/organism_selftest.ts`).**

| # | Poin Blueprint | Modul | Status |
|---|---|---|---|
| 1 | Identity/DNA immutable core + mutable genome | `organism/dna.ts` | ✅ lahir `CIVITAS-PRIME` |
| 2 | World Model (resources/agents/infra/knowledge/risks/…) | `organism/worldmodel.ts` | ✅ probe nyata (os, df, ps, RakNet UDP, HTTP health) |
| 3 | Autonomous Core: Observe→Interpret→Decide→Act→Evaluate→Evolve | `organism/loop.ts` | ✅ cycle berjalan via daemon |
| 4 | Dynamic Goal Engine (reward+strategic+feasibility−cost−risk) | `organism/goals.ts` | ✅ goal lahir dari delta world model |
| 5 | Decision Engine — "do nothing" sah | `organism/decision.ts` | ✅ skor do-nothing dari bias genome |
| 6 | True Autonomous Loop (14 langkah) | `organism/loop.ts` | ✅ observe→…→rebalance→continue |
| 7 | Agent Spawner (temporary→specialized→archive/kill) | `organism/spawner.ts` + `scripts/organism_child.ts` | ✅ proses `bun` sungguhan, PID hidup, heartbeat |
| 8 | Mutation Engine (propose→candidate→sandbox→test→benchmark→adopt/reject+learn) | `organism/mutation.ts` | ✅ **ADOPTED**: A=3.2ms vs B=1ms di worktree |
| 9 | Immune System (7 limit + Pause→Rollback→Record→Kill/repair) | `organism/immune.ts` | ✅ enforced: timeout, recursion, retry, RSS, memori, network allowlist, tool-permission |
| 10 | Scheduler/Jantung — schedule adalah trigger, bukan penjara | `scripts/civitas_daemon.sh` + `scripts/organism_tick.ts` | ✅ denyut 30s |
| 11 | Child organisms (memori/tools/goal sendiri) | `organism_child.ts` + `children/<id>/` | ✅ journal + state per anak |
| 12 | Economic Organism (revenue/cost/ROI → scale/maintain/pivot/kill) | `economy.json` + `bumpEconomy` | ✅ biaya siklus & nilai aksi tercatat |
| 13 | Self-preservation (dep fail → alternatif → migrasi → lanjut) | fallback heuristic LLM + probe ulang | ✅ |
| 14 | Zero-cost Free-first (LOCAL→OPEN→FREE→PAID) | `organism/llm.ts` | ✅ HEURISTIC default; REMOTE hanya bila user isi config |
| 15 | Kontrol manusia minimal (PAUSE/KILL/LOCK) | `loop.ts` + API + UI | ✅ tanpa approval |
| 16 | Evolution Model (Variation→Experiment→Measurement→Selection→Adoption→Memory) | mutation.ts + memory.ts | ✅ lesson tersimpan |
| 17 | Failure is Data (hypothesis/result/reason/cost/lesson) | `memory.rememberFailure` | ✅ |
| 18 | Self-Diagnosis | risks hidup + REPAIR_INFRA nyata | ✅ mkfifo, daemon start, gc, cleanup disk |
| 19 | Self-Architecture (hapus/gabung/sederhanakan) | `reapDead` + merge role | ✅ |
| 20 | Goal tanpa task list permanen | generateGoals per siklus | ✅ |
| 21 | Memory ring + cap dari DNA | `memory.ts` | ✅ limit #5 |
| 22 | World state file (world.json) | `store.ts` | ✅ |
| 23 | Kill switch fisik (file) | `KILL_SWITCH` | ✅ dibaca tiap tick + child |
| 24 | Anti-recursion (tick tak tumpuk) | `ticking` guard + guardRecursion | ✅ |
| 25 | Retry terukur | `runGuarded` | ✅ |
| 26 | Network allowlist + timeout | `safeFetch` | ✅ |
| 27 | Tool permission dari DNA | `assertToolAllowed` | ✅ `git_push=false` |
| 28 | Genom hash (deteksi perubahan luar) | `genomeHash` | ✅ |
| 29 | Rollback mutasi | `rollbackMutation` | ✅ snapshot A disimpan |
| 30 | Benchmark sebagai gerbang adopsi | `organism_bench.ts` | ✅ dijalankan di worktree |
| 31 | Sandbox = git worktree HEAD | `mutation.ts` | ✅ |
| 32 | Commit adopt jejak audit | `git commit` otomatis | ✅ |
| 33 | LLM provider konfigurabel (baseUrl+key+model via UI) | `llm.ts` + `ConfigView` + `OrganismView` | ✅ |
| 34 | Capabilities built-in terverifikasi berkala | `capability.ts` | ✅ verify tiap 5 siklus |
| 35 | Unknown resolution (unknown → verified) | `resolved-unknowns.json` | ✅ |
| 36 | Genome tidak bisa menyentuh core/immune | guard by-construction | ✅ |
| 37 | Event log append-only (jsonl) | `events.jsonl` | ✅ |
| 38 | Semua role future = organisme | blueprint `birthDNA(kind, parent)` | ✅ siap pakai |

## 5. Lapisan HERMES (integrasi mandat Quant)

Mandat pemilik menambahkan pola **HERMES — Autonomous Quant Organization** sebagai rujukan filosofi. Enam konsep intinya kini jadi bagian runtime (generik, bukan khusus quant):

### 5.1 Capability Graph
`GOAL → REQUIRED CAPABILITIES → AVAILABLE → CAPABILITY GAP → ACQUIRE/BUILD/DELEGATE → TEST → REGISTER`

- Registry nyata: `.civitas/organism/capabilities.json`.
- **BUILD**: modul ditulis ke disk (`capabilities/<id>.mjs`), dieksekusi, output diverifikasi, baru AVAILABLE (bukti: `text.hash`).
- **DISCOVER**: pemindaian repo menemukan organ yang sudah ada — mencegah "data engine kedua".
- **DELEGATE**: registrasi terhadap tool/MCP yang sudah hidup.
- Gap dihitung per goal (`gaps.json`) dan tampil di UI.

### 5.2 WORLD_STATE Epistemic — ketidaktahuan first-class
World model memuat empat bucket jujur:
- `known` — fakta dari probe nyata (10+ entri).
- `unknown` — yang tidak diketahui *beserta alasannya*; goal `VERIFY_UNKNOWN` mengejarnya lewat probe.
- `assumptions` — asumsi yang dijalankan (ditandai `risky` bila berbahaya).
- `unverified` — yang bisa diverifikasi beserta cara memverifikasinya.

Organisme berkata "objective tidak dapat divalidasi karena capability X belum ada" — bukan "saya tidak punya tugas".

### 5.3 Lima Lapis Evolusi
| Level | Objek | Jalur |
|---|---|---|
| L1 Parameter | `genome.weights` | mutasi A/B benchmark |
| L2 Strategy | `genome.strategy` (4 strategi registry) | mutasi A/B |
| L3 Workflow | interval/bias/steps siklus | mutasi A/B + adaptasi reflektif (timeout berulang → interval naik) |
| L4 Capability | registry capability | build/discover/delegate + test |
| L5 Organization | populasi agent | spawn/reap/merge/archive (`reconcileComposition`) |

### 5.4 Repository Topology
`organism/repos.ts` memindai repo nyata: Repository → Project → Subsystem → Capability → Owner (ditebak dari header komentar + pola nama), menghitung LOC per organ, dan **mendeteksi organ duplikat** sebelum organisme membangun yang sudah ada.

### 5.5 Environment Awareness (permission-aware)
`organism/envprobe.ts`: CPU, memori, disk (`df`), proses (`ps`), interface jaringan, uptime — dengan laporan **`denied[]`** yang jujur ketika permission DNA menolak probe. Autonomy ≠ kekuasaan tanpa batas.

### 5.6 Hard Constraints + Objectives, bukan micro-management
DNA hanya menetapkan konstitusi (5 hard constraint) + limits + permissions. *HOW* diputuskan organisme: goal engine, decision engine, dan mutation engine adalah mekanismenya — bukan daftar perintah.

## 6. Komponen Peradaban (L1/L2/L5) — tetap berlaku

- **Civilization Kernel**: ledger double-entry (Σdebit=Σkredit), event immutable, policy engine di luar LLM, 19+ model Prisma, Supabase mirror.
- **Pemerintahan**: 4 institusi, tiga cabang, pajak & anggaran otomatis.
- **Perusahaan**: lifecycle 13 state (PROPOSED→…→DISSOLVED); kegagalan adalah state yang sah.
- **Warga Villager**: sensus CENSUS dari entitas dunia nyata, otak LLM per warga, dompet ledger, sosialisasi, chat dunia real-time.
- **Tubuh**: bot Bedrock (bedrock-protocol) + bot Java (mineflayer, `CIVITAS_AGENT`), direktif SPEAK/MOVE/PATROL/BUILD, plugin CivitasBridge.
- **Self-Life**: watchdog multi-server (autoStart), backup terjadwal + retensi, self-sync git berkala (menyelamatkan seluruh kerja saat rollback sandbox — terbukti).
- **MCP**: JSON-RPC 2.0 ganda — HTTP (`/api/civos/mcp`, 14 tool) + stdio (`scripts/civitas_mcp_stdio.mjs`); CLI `bin/civitas.mjs` 17 perintah.
- **Java console path**: FIFO `console.in` → `javabot.ts` join/chat/list dengan auto-reconnect (bukti join nyata di log Paper).

## 7. API & UI

| Endpoint | Fungsi |
|---|---|
| `GET /api/civos/organism` | State penuh organisme (DNA, world, goals, decision, caps, gaps, mutasi, anak, imun, LLM) |
| `POST /api/civos/organism` | `tick·pause·resume·kill·unkill·lock·unlock·mutate·rollback·acquire·child·llm_config` |
| `GET/POST /api/civos/javabot` | Status & kontrol bot Java (connect/chat/command/disconnect) |
| `GET /api/civos/state` | Denyut peradaban (polling UI 4s) |
| `/api/civos/mcp` | MCP HTTP 14 tool |
| `/api/civos/*` (config, backup, sync, selflife, doctor, git, servers, chat, docs) | Self-life surface |

Dashboard `McShell` kini memiliki tab **🧬 ORGANISME**: 8 panel (HIDUP, WORLD MODEL, TUJUAN, CAPABILITY, MUTASI A/B, POPULASI, IMUN, OTAK LLM) + konsol aksi; semua tombol memanggil API nyata — termasuk **form custom base URL + API key + model** yang tersimpan sebagai SECRET (tak pernah dikirim balik ke browser).

## 8. Kejujuran & Anti-Mock (REALITY WINS)

1. Status hanya bertambah dengan bukti runtime; tanpa bukti → PARTIAL/UNKNOWN, dinyatakan jujur.
2. Kegagalan dicatat (memory `FAILURE` + event jsonl), tidak pernah dihaluskan.
3. Aksi yang tidak mampu dilakukan dinyatakan "butuh jalur yang belum ada" — bukan diarang-arang.
4. `unknown` tidak pernah disembunyikan; asumsi berisiko ditandai.
5. Revenue eksternal tanpa rail nyata ditolak server (`HONESTY_GATE`).

## 9. Operasional

- **Daemon** (`scripts/civitas_daemon.sh`): denyut 30 detik = selflife tick (watchdog server, pulse, backup/sync jadwal) + organism tick (hormati fase).
- **Selftest** (`bun scripts/organism_selftest.ts`): bukti eksekusi end-to-end (DNA, mutasi A/B, spawn, capability build, tick penuh, state).
- **Kill switch**: tulis `KILL` ke `.civitas/organism/KILL_SWITCH` (atau tombol KILL di UI) → root + semua child berhenti.
- **Sandbox**: `.civitas-sandbox/<mut_id>` (git worktree) — dibuat & dibersihkan otomatis.

## 10. Roadmap Evolusi

1. **Spawn role peradaban sebagai organisme** — villager/gov/company lahir via `birthDNA(parent=CIVITAS-PRIME)`; populasi diawasi L5.
2. **Capability marketplace antar organisme** — child mendaftar capability; parent men-delegate.
3. **Economic feedback penuh** — ROI per siklus memutus scale/maintain/pivot/kill (12 → ekonomi memandu genome).
4. **HERMES-quant sebagai organ spesialis** — modul `flybrain/organism/quant/*` diadopsi menjadi child organism dengan DNA quant (risk-gate, portfolio, scoring sudah ada di repo).
5. **Federasi organisme lintas mesin** — world model + memory tersinkron via Supabase; kill switch terdistribusi.

## 11. Definisi Selesai (Definition of Done)

Fitur dinyatakan DONE hanya jika: (a) kode lolos `tsc --noEmit` 0 error; (b) ada bukti eksekusi nyata (log/selftest/curl); (c) tidak ada mock/simulation pada jalur utama; (d) kegagalan punya jalur pelaporan; (e) dokumentasi *.md sinkron. Prinsip ini berlaku untuk seluruh 38 poin di atas dan seluruh role organisme yang akan lahir.
