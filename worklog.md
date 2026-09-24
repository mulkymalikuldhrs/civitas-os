---
Task ID: 17-a..17-h
Agent: main (Super Z)
Task: Organisme otonom — mutation sandbox A/B, agent spawner nyata, wiring UI, imun enforced, LLM config UI, lapisan HERMES (capability graph, world state epistemic, 5 lapis evolusi, repo topology, env awareness), PRD.md + docs + push.

Work Log:
- Pulihkan workspace dari rollback (cf04ca3 → a803b6b) via `git fetch gh-mulkymalikuldhrs main && git reset --hard FETCH_HEAD` — protokol self-sync TERBUKTI lagi.
- Build Organism Runtime 16 modul baru (src/lib/civos/organism/): types, store, dna, memory, immune (7 limit enforced), envprobe, repos, worldmodel (RakNet UDP ping nyata), goals, decision, llm (free-first), capability (BUILD/DISCOVER/DELEGATE), mutation (git worktree A/B + benchmark + rollback), spawner (proses bun nyata + PID + heartbeat), loop (14 langkah + 8 aksi nyata), index.
- Scripts: organism_bench.ts (benchmark A/B), organism_child.ts (child organism nyata), organism_tick.ts (runner daemon), organism_selftest.ts (bukti end-to-end).
- API /api/civos/organism (GET + 12 POST action) + views/OrganismView.tsx (8 tab + form LLM) + wiring McShell tab 🧬 ORGANISME.
- Fix kritis: spawner menimpa DNA root → isolasi DNA anak; benchmark verdict kini menyertakan stderr; worldmodel env.cpu.load1; llm comparison; immune duplikat key; bench fs-based.
- DB hilang pasca-rollback → `prisma db push` rebuild; mineflayer reinstall.
- Daemon restart → denyut gabungan (selflife + organism) jalan; organism cycle 1-4+ via daemon.
- BUKTI SELFTEST: mutasi L1 ADOPTED (A=3.2ms vs B=1ms, worktree sandbox); child PID hidup 9+ siklus heartbeat; capability text.hash BUILD (tulis+eksekusi+verifikasi); tick REPAIR_INFRA probe nyata.
- Java server crash → root cause OutOfMemoryError: Metaspace (128m terlalu kecil utk Paper) → metaspace 256m + heap 512M → restart (bukti crash report dibaca, bukan disembunyikan).
- PRD.md dibuat (fusi Minecraft civilization + 38 poin organisme + HERMES); README v1.2 "ORGANISM" + section Organisme; CHANGELOG entry 1.2.0.

Stage Summary:
- Organism Runtime LENGKAP + bukti nyata; UI wiring penuh; imun 7 limit enforced; LLM config via UI (SECRET); PRD.md/README/CHANGELOG sinkron.
- Push TERBLOKIR: ~/.gitcreds dihapus rollback — butuh user paste ulang 4 token (gh-mulkymalikuldhrs, gh-mulkymalikuldhaher, dhaher-labs, gitlab).
- Commit lokal aman: organism runtime, fix, docs (2cb6377, b880ba2, + commits berikut).
- FINAL: Java server hidup (Done 18.8s @ metaspace 256m), CIVITAS_AGENT join nyata 3x, chat broadcast + list 1/10 players online terverifikasi di Paper log; organism cycle 11 via daemon, child lifecycle EXPIRED@cycle40 terbukti.
