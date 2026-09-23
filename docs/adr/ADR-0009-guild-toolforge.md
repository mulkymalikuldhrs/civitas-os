# ADR-0009 — GUILD KERJA & TOOLFORGE (villager spesialis + tool calling + internet nyata)

Status: DISETUJUI & LIVE (bukti runtime 2026-09-23)
Konteks: mandat pemilik — "tambah villager/ai agent yang tugas untuk coding, dev, pembangunan, military, engineer, miner, sambungan ke dunia internet nyata dan tool calling" + "redesign dan rebuild ui dashboard depan".

## Keputusan

1. **Guild (divisi) sebagai lapisan kerja warga.** `CivVillager.division` ∈ {GENERAL, CODER, DEV, BUILDER, MILITARY, ENGINEER, MINER, NETRUNNER, TOOLSMITH}. Sensus SIMULASI merotasi 8 guild spesialis (8 warga pertama menjamin satu per guild); sensus CENSUS memetakan profesi dunia nyata → guild (librarian→CODER, mason→BUILDER, armorer/weaponsmith→MILITARY, toolsmith→ENGINEER, fisherman→NETRUNNER, dst.; sisanya GENERAL).
2. **Toolforge: satu gerbang tool calling.** Semua invokasi lewat `invokeTool()` → otorisasi → eksekusi → audit (`CivToolCall` + event `TOOL_INVOKED`) → artefak (`CivArtifact` + event `ARTIFACT_CREATED`). Registry: `web_search`, `page_reader` (internet NYATA via z-ai-web-dev-sdk), `code_write`, `spec_write`, `build_plan`, `mine_route`, `patrol_report`.
3. **Charter divisi = otorisasi warga.** Warga tidak memakai grant table (itu untuk agen institusi); tool yang boleh dipanggil ditentukan `DIVISION_META[div].tools` — deterministik, auditable, tak bisa diubah LLM. GENERAL = tanpa tool. TOOLSMITH = semua tool (orkestrator). Tool tak terdaftar ("ghost") → DENIED tercatat.
4. **WORK menjadi division-aware.** Upah tetap dari kas operasional (tidak berubah); setelah upah, kernel menjalankan SATU tool divisi (TOOL_MAX_PER_PULSE=1). Payload LLM boleh menjadi input tool (mis. kueri riset) — otorisasi tetap kernel. Kegagalan tool tidak membatalkan upah.
5. **Direktif tubuh baru: BUILD / PATROL / MINE.** Tool guild mengantre direktif dengan `site` ber-anchor koordinat tubuh/sensus; SIM "mimpi jaga" merehearsal-nya berlabel jujur; bot mengumumkan rencana via chat dunia (berlabel) + PATROL menggerakkan tubuh vanilla via tp. Penempatan blok fisik TIDAK diklaim (butuh OP) — jujur sampai fasa berikutnya.
6. **Internet nyata dilabeli sumber.** `web_search`/`page_reader` menghasilkan artefak RESEARCH berisi URL nyata; kegagalan jaringan/timeout → FAILED/TIMEOUT jujur, tanpa artefak karangan (INV-30b/31b).
7. **Dashboard depan baru.** `src/components/civitas/Dashboard.tsx` = halaman depan default (ViewKey `civitas`, nav 00): KPI kas/revenue jujur/guild/artefak, GUILD KERJA (8 kartu), TOOLFORGE (registry + audit + jalankan tool dari UI), PETA, EVENT immutable, PANEL KEJUJURAN, PUSTAKA ARTEFAK, PASAR DESA, WARGA, KEBIJAKAN. Panel lama (Peradaban+/MINECRAFT) tetap ada sebagai kontrol penuh (nav 10/11).

## Konsekuensi

- Kebijakan baru di luar LLM: TOOL_MAX_PER_PULSE, WEB_SEARCH_MAX_RESULTS, TOOL_TIMEOUT_MS, ARTIFACT_MAX_CHARS, MINE_YIELD_MAX_UNITS, BUILD_MAX_FOOTPRINT, PATROL_RADIUS_MAX.
- Capability `tool.*` masuk registry untuk agen institusi; warga memakai charter.
- Mining menghasilkan listing pasar desa (konservasi stok di-cap) — ekonomi warga menguat tanpa menciptakan uang baru.
- Audit penuh: tidak ada tool hantu; DENIED pun tercatat (INV-29a/b).
- Bukti runtime: 8/8 guild menghasilkan artefak; web_search 5 URL nyata (tradingeconomics dkk.); charter DENIED 3x; 57 PASS / 0 FAIL invarian (INV-29..34 baru); E2E UI jalankan tool → flash "riset internet nyata — 5 sumber tercatat".
