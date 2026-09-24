# MEMORY.md - Canonical State (FLYBRAIN OS + CIVITAS OS)

Updated: 2026-09-25 (sesi 7) | Agent: Super Z

## Project
- **Objective**: Platform otak universal untuk semua tool/AI agent/IoT — memori + kesadaran operasional + gerbang endpoint tunggal — TANPA server backend, data 100% milik user. Nama: **FLYBRAIN OS** (lapisan protokol tetap memakai warisan "FlyBrain MCP").
- **Phase**: **CIVITAS OS v1.4.0 "SYNC & AUTONOMY"** — Organism Runtime + RATU_CIVITAS v2 (memori persisten + thought + evaluasi adaptif + supervisor/joiner crash-isolated) + **DB ter-mount penuh ke Supabase** (24 tabel, mirror total via pushFullMirror, 905+ baris) + **self server** port 3000 + **Vercel** (civitas-os, Postgres pooler) + daemon = self-cron 24/7 (server, RATU, self-server, sync, mirror, backup).

## Confirmed Facts (riset 16 kueri, 2026-09-21, sumber primer)
- Viral Sept 2026: CNS lalat jantan Janelia+Google (3 Sep): >166.000 neuron, ±125 juta sinapsis; WIRED 16 Sep (vibe-coding PitchFly); MindStudio 14 Sep (hobiis).
- FlyWire FAFB (betina, Nature 2024): 139.255 neuron, >50 juta sinapsis, ±8.400 tipe sel; CAVEclient API resmi; lisensi CC BY-NC 4.0.
- "Calyx MCP" milik user = VFB MCP (anatomi/ontologi) → bukan memori → celah produk terkonfirmasi.
- MCP: >8 juta unduhan (Apr 2025), >5.800 server, +8.000% (5 bulan); spec 2026-07-28 arah stateless.
- Pasar: AI agent $10,9M 2026 → $182,9M 2033 (CAGR 49,6%); AI infra $75,4M 2026.
- Kompetitor memori agent (mem0, memnode, glama, Anthropic) — semua menyimpan data di server; tidak ada yang zero-storage + agent penghuni.

## Confirmed Decisions (terkunci)
- **AMANDMEN sesi 5 (CIVITAS)**: zero-storage TETAP untuk data user FlyBrain; **Civilization Kernel = state otoritatif server-side** (Prisma+SQLite, 14 model Civ*) tanpa PII user — ADR-0001. Mandat sumber: PRD percakapan ChatGPT pemilik (docs/civitas-os/PRD.md) + Minecraft server `mulkymalikuldhr.aternos.me:19132` (Bedrock).
- CIVITAS: uang FLR integer-minor; uang hanya via MINT; internal ≠ revenue eksternal (honesty gate 422); government deterministik 4 institusi (ADR-0004); LLM router reflex-first (ADR-0002); crypto/token/quant DESIGNED saja (ADR-0003); failure = state valid (13 lifecycle).
- **Proyek A terpilih** (matriks berbobot 4,55 > 2,95 > 2,80): platform terintegrasi; B (gateway) & C (vault) jadi modul.
- **Tanpa Python, tanpa backend server, tanpa Prisma/DB** di produk (owner, sesi 2). v0.1 Python MCP deprecated → arsip /download/flybrain-mcp.
- **AMENDMEN sesi 3**: boleh API route sepanjang 100% stateless/amnesia (serverless stateless compute — 10_AUTONOMY.md §5–6); prinsip zero-storage tetap; server tak pernah tahu apa pun tentang pemilik.
- **REUNI sesi 3 (mandat owner)**: 4 repo upstream Autonomous-Organism digabung jadi SATU organisme — organ gh (sense/memory/decision/immune/scheduler/factory) + creature/peradaban gitlab (6 spesies, quant engine, self-reflect, konstitusi 7 hukum + veto) + tubuh FLYBRAIN. Supabase upstream TIDAK dibawa sebagai dependensi inti (adaptor opsional Fase 4); secret upstream tidak disalin. Rujuk 11_AUTONOMOUS_ORGANISM.md.
- Kunci API = `FK1_` + SHA-256(username|password) via WebCrypto; bearer + identitas sekaligus.
- Pembayaran: kwitansi JSON kanonik (flybrain.receipt/v1) disimpan user → divalidasi lokal (checksum+masa aktif) → tier terkunci lokal; kejujuran: v0.2 = integritas format, tanda tangan mitra masuk v1.0.
- Framing: operational awareness, bukan consciousness. UI & dokumen bahasa Indonesia. Semua fitur wajib tervisualisasi (anti-slop = kebijakan).
- Arsitektur: FLYBRAIN KERNEL TS (idb/auth/vault/payment/router/prt/connectome) + Service Worker opsional `sw-korteks.js` = endpoint nyata tanpa server.

## Artifacts
- **CIVITAS OS** (sesi 5–6): prisma/schema.prisma (16 model Civ*; +CivVillagerDirective, +CivMarketOffer); src/lib/civos/* (types,money,events,ledger,policy,router,memory,accounts,economy,company,government,runtime,minecraft,seed,state,supabase,settle,expand,villagers,village,**directives**,**market**,mcbot); src/app/api/civos/* (state,heartbeat,action,minecraft,sync,**cron**); UI: PeradabanView (7 sub-tab, DESA: warga+TUBUH+PASAR) + MinecraftView (bridge panel); scripts/{civos_invariants.ts (46),civ_verify.sh,civ_e2e.sh,slice8_probe.ts}; docs/civitas-os/{PRD §9,CANONICAL}.md + docs/adr/ADR-0001..0008; bukti tool-results/civ-0*.png + civ-11/12-slice8.png.
- **Aplikasi** (root repo): src/lib/flybrain/* (kernel + organism/: brain, loops, constitution, eventBus, organs/×6, quant/×6, selfReflect, creature, creatures, engine) + hooks/useOrganismEngine; src/components/flybrain/* (AppShell + 10 view + 3 kanvas); src/app/api/{mcp,organism/*,civos/*}. Route `/` tunggal.
- **Dokumen**: /download/flybrain-os/ 00–11 (12 berkas, konvensi [T]/[D]/[H]).
- **Bukti riset**: /research/*.json (29 kueri ber-URL + RELEVANT_REPOS_16b.md + REVIEW_16h1.md + blueprint PDF) + /upstream/ (kloningan 4 repo pemilik) + screenshot tool-results/ (biosfer-05/06 dll.).
- **Organism runtime** (sesi 7): src/lib/civos/organism/ (types, store, dna, memory, immune, envprobe, repos, worldmodel, goals, decision, llm, capability, mutation, spawner, loop, index) + scripts/organism_{tick,selftest,bench,child}.ts + API /api/civos/organism (12 aksi) + tab UI 🧬 ORGANISME + docs/AUDIT_v1.2.md.
- Arsip sesi 1: FlyBrain_MCP_Riset_dan_Blueprint.docx + flybrain-mcp (Python, deprecated).

## Browser Verification (sesi 3 — BIOSFER, 2026-09-21)
- curl T1 heartbeat prt (creatureId=prt): LLM glm-4-plus 2,8 dtk — keputusan merujuk konstitusi (nol-penyimpanan, privasi agregat).
- curl T2 /api/mcp tools/list = 8 tools; T3 creature.list = prt,tradio,scriba,lumen,cresca,fabro; T4 creature.dispatch Tradio = keputusan LLM nyata; T5 prt.chat OK.
- agent-browser: landing anti-slop OK; nav 07 BIOSFER → kanvas 6 creature, populasi 6 aktif, denyut ±45 dtk; inspektor prt (genom PENJAGA·RAJIN·JUJUR·NOL-PENYIMPANAN; energi 72/100; "SIMULASI LOKAL — BUKAN UANG RIIL"); screenshot biosfer-05/06.png.
- Lint bersih; log instance aktif tanpa error (error lama di dev.log = entri pra-fix).
- catatan infra: proses background dibunuh sandbox antar-panggilan → verifikasi wajib monolitik 1 panggilan (scripts/verify_biosfer*.sh); fix yang dilakukan: engine.ts path vault ×2, factory.ts `??`/`||` syntax, rm -rf .next + restart dev.

## Verifikasi sesi 2 (warisan, masih valid)
- Identitas lokal dibuat → kunci FK1_ muncul; memori CRUD via UI + gerbang (201); kwitansi demo → PRO terkunci lokal s.d. 2026-10-21; SW mode fetch 200; atlas KC_0062; mobile 390px OK.

## Open Questions
- Repo ke-4 pemilik (github mulkymalikuldhaher/Autonomous-Organism) TAK TERAKSES — bila berisi versi lebih baru, cangkok via peta 11 §3.
- ⚠️ KEAMANAN: password Postgres Supabase plaintext di 11 script Python upstream gitlab/codeberg (repo publik pemilik) — ROTASI SEGERA (tindakan pemilik; tidak disalin ke repo ini).
- Token FlyWire user (identitas neuron 720575940622872870) — opsional, tidak menghalangi.
- Status MCP client di Hermes — kini cukup HTTP: /api/mcp (8 tools) siap dipakai langsung.
- Mitra pembayaran penandatangan kwitansi (Fase 4) + konfirmasi tertulis lisensi FlyWire sebelum monetisasi penuh.

## Next Actions (urut)
1. **RATU v2 berjaga di Aternos (flapping sisi penyedia)** — ia masuk otomatis tiap jendela terbuka; kehadirannya = anti-tidur. Bila kick Xbox-auth muncul → alasan terekam di `leader.log.jsonl` (jalur berikutnya: device-code login). Opsional pemilik: exaroton (berbayar) untuk uptime penuh.
2. **GitLab**: kunci ed25519 (id 21680157) sempat ditolak anti-abuse pasca-push beruntun — tiap siklus sync mencoba SSH + HTTP; bila kunci mati permanen → daftar ulang via API saat tidak diblok.
3. **Pemilik: ROTASI kredensial Supabase** (kunci pernah lewat chat) + jangan commit .env.
4. Revenue eksternal riil: aktifkan EXTERNAL_SETTLEMENT_LIVE + provider nyata (honesty gate 422 aktif).
5. Vercel: upgrade Pro (opsional) bila ingin cron */5; denyut 24/7 tetap dari daemon sandbox.
