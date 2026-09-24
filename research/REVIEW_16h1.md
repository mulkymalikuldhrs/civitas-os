# REVIEW 16-h1 — CIVITAS OS Root-to-Branch Honesty Audit (review-only)

Agent: review-agent · Date: 2026-09-24 · Scope: mock hunt + wiring + build health + runtime evidence.
Method: grep sweeps (Math.random, fake/mock/simulate/canned/dummy, TODO/FIXME/stub/placeholder, empty-catch, setTimeout-fake-work), full read of CLI/MCP/daemon/selflife/mcbot/console/servers/supabase, log forensics, tsc+lint runs. No files modified (except this report + worklog).

---

## 1. VERDICT TABLE

| # | Subsystem | Verdict | Evidence (file:line) |
|---|-----------|---------|----------------------|
| 1 | CLI `bin/civitas.mjs` | **REAL** | Every command is a real `fetch` to the HTTP kernel (`civitas.mjs:20-33`); unreachable kernel → honest error `kernel tidak terjangkau` (`:31,76`); `daemon` runs the real shell script via `execFileSync` (`:69`); `mcp` spawns the real stdio server (`:63`). No canned output anywhere. |
| 2 | MCP stdio `scripts/civitas_mcp_stdio.mjs` | **REAL** | 13 tools declared (`:16-30`); all 13 `callTool` cases hit real endpoints `/api/civos/{state,action,selflife,backup,git,doctor,servers}` (`:63-146`) with bun-subprocess fallback into REAL kernel fns (`economy.computeMetrics`, `runtime.heartbeatTick`, `selflife.backupAll/gitSync/doctor/listBackups`, `servers.listServerStatuses`) (`:69-111`). Failures returned as `isError` (`:185`), never faked. |
| 3 | MCP HTTP `src/app/api/mcp/route.ts` | **REAL but WRONG OWNER (docs mismatch)** | It is a genuine JSON-RPC 2.0 MCP server (9 tools, `dispatchTool` `:59-369`) — but it belongs to the FLYBRAIN project (`@/lib/flybrain/*` imports `:12-20`), not the CIVITAS kernel. CIVITAS's own MCP exposure is stdio-only; CIVITAS acts as MCP *client* via `src/lib/civos/mcp.ts` (registry `:20-42`, real HTTP/stdio JSON-RPC `:48-109`, probe `:112-120`, call `:123-125`). See F-02. |
| 4 | Daemon `scripts/civitas_daemon.sh` | **REAL (w/ health issue F-01)** | Real background loop every 30 s running `bun scripts/civitas_selflife_tick.ts` (`:20-30`), pidfile + log rotation (`:26-28`). Daemon confirmed RUNNING (pid 3277) and `backups/daemon.log` shows real tick JSON ("GOV: EXECUTIVE pengadaan…", "KOTA-02 patroli…"). BUT ~53% of ticks crash: 38/72 log lines show only `Bun v1.3.14 (Linux x64 baseline)` — a crash-footer — because `:22` keeps only `tail -1` (stderr swallowed). Manual tick run succeeds, so it is an intermittent/concurrency crash. |
| 5 | Self-life `selflife.ts` + tick runner | **REAL** | `backupAll`: real `tar -czf` + sha256 manifest + retention (`selflife.ts:63-101`); `gitSync`: real add/commit (retry 3× anti index.lock `:149-161`) + push 4 remotes with transient tokens from `/home/z/.gitcreds`, missing token reported honestly (`:164-172`); `doctor`: 9 real checks incl. `rg` secret-scan (`:214-215`); `selfLifeTick` chains watchdog+heartbeat+backup/sync schedule (`:241-280`). `scripts/civitas_selflife_tick.ts` just runs it and prints JSON (no fakery). |
| 6 | mcbot → Minecraft path | **REAL** | Two real paths: (a) bot: real `bedrock-protocol` client join (`mcbot.ts:84-92`), real chat packets (`:42-49`), real `command_request` (`:52-60`), directive claim→dispatch→confirm via `command_output` (`:174-241`); (b) console: `localConsoleCommand` writes to real FIFO `mc-server/pmmp/console.in` and reads answers from `server.log` (`console.ts:11-38`), every command audited to `CivConsoleLog`. Server log proof in §4. |
| 7 | Economy / ledger | **REAL** | `postTx` = 1 CivTxn + ≥2 entries + event inside atomic `db.$transaction` (`ledger.ts:71,98`); villager BUY enforces policy caps/saldo and posts real double-entry legs (`village.ts:170-208`); quant uses REAL Binance price fetch, PAUSES honestly when unreachable (`expand.ts:93-117`). |
| 8 | Supabase `supabase.ts` | **REAL, optional, graceful (1 wiring bug F-03)** | Real PostgREST `fetch` calls with 15 s timeout (`supabase.ts:19-37`); without creds returns honest `belum dikonfigurasi` (`:51,157-160`) — never fakes success. Bug: roundtrip "hapus" uses POST, not DELETE (`:191`), so that check can never pass (still reported honestly). |
| 9 | Docs claims vs code | **PARTIAL (2 nits)** | README.md:44 (13-tool stdio MCP) ✅ matches code; MASTER.md:149 calls `/api/mcp` "MCP HTTP JSON-RPC (toolforge gateway)" ❌ it is the FlyBrain 9-tool server (F-02). Java realm: doc/worklog honest that Java bot (mineflayer) doesn't exist; kernel path to Java console not wired (F-05). |

## 2. MOCK/FAKE HUNT RESULTS

Sweeps over `src/lib/civos/`, `bin/`, `scripts/civitas_*`, `src/app/api/`:
- `Math.random`: 3 hits, all REAL-OK (cosmetic/variety, money & directives unaffected):
  - `village.ts:188` — random company pick for villager shopping (tx itself is a real double-entry post).
  - `village.ts:213` — random socialize partner pick (real DB memory write follows).
  - `village.ts:282` — wander coordinate drift ±8 (drives a real MOVE directive).
- `TODO|FIXME|stub|placeholder|not implemented`: **0 hits**.
- Empty `catch {}` swallowing: **1 SUSPECT** — `village.ts:294` `catch { /* direktif tak boleh membunuh denyut */ }` silently drops directive-enqueue failures (no log/event). Others are benign (parse fallbacks, socket close): `console.ts:43,64` (returns honest empty/0), `mcp.ts:72` (env-JSON fallback), `mcbot.ts:47,135,166,249` (each has honest audit trails elsewhere).
- setTimeout-based fake work: **0 hits** — all `setTimeout`/sleep uses are real pacing (console log tailing `console.ts:27-34`, bot session windows `mcbot.ts:126-129,248-252`, retry backoff `selflife.ts:151,159`).
- Canned responses pretending to be real: **0 hits**. `execWander`/`execRest` (`village.ts:223-232`) are honest text-only actions, explicitly labeled "jujur"; SIM path (`directives.ts:113-119` "mimpi jaga") is labeled SIM by design, not passed off as real.
- console.log pretending to be actions: **0 hits**; CLI prints only real API/script results.
- Hardcoded fake data: **0 hits** in kernel; prices come from `config.quant.priceUrl` → Binance (`config.ts:50`, `expand.ts:107`).

## 3. WIRING TRACE (core chain)

```
CLI bin/civitas.mjs ──fetch──▶ /api/civos/* (14 route dirs: action backup chat cron docs doctor
                              git graph heartbeat minecraft selflife servers state sync)
MCP stdio (13 tools) ──HTTP──▶ same endpoints; ──bun fallback──▶ civos kernel fns directly
Daemon loop (30 s)  ──bun──▶ civitas_selflife_tick.ts ─▶ selfLifeTick()
                              ├▶ watchdogServers() → pingServer() real UDP/TCP ping + real scripts/pmmp_server.sh|java_server.sh start (verified by re-ping, servers.ts:243-257)
                              ├▶ heartbeatTick() → org/village pulses (real LLM via z-ai SDK, router.ts:133)
                              ├▶ backupAll() real tar/sha256 · gitSync() real git push ×4
mcbot attemptBotJoin ─bedrock-protocol─▶ PMMP (join/chat/command_request)  [log-proven §4]
directives/villagers ─▶ console.localConsoleCommand ─▶ FIFO mc-server/pmmp/console.in ─▶ CivitasBridge.php (/civ summon|fill|setblock|census|tp)
```
Every link above is backed by real code + runtime evidence; nothing dead in the Bedrock chain.

## 4. RUNTIME EVIDENCE (logs, live processes)

- **Paper/Purpur Java** `mc-server/java/logs/latest.log:44` + `server.log:48`: `Done (50.764s)!` — real boot. Currently NOT running. **Zero CIVITAS commands in Java logs** (no `say/summon/civ` hits) — Java = ping + lifecycle only; `mc-server/java/console.in` FIFO exists but kernel never targets it (see F-05).
- **PMMP Bedrock** currently RUNNING (pid 2727). `mc-server/pmmp/server.log`:
  - `:77` `CIVITAS_AGENT logged in … (world, 256, 77, 256)`; `:85` `CIVITAS_AGENT joined the game`
  - `:87` bot chat `CIVITAS OS hadir — peradaban Nusantara Digital online…`
  - `:89` `Command output | [CIVITAS] 8 villager dipanggil di 256/77/256` — real plugin-executed summon (CivitasBridge Main.php:65 implements it)
  - `:91` villager SPEAK relay `[Zahra Wijaya | VIL-0017] Halo, nama saya Zahra Wijaya…`
  - `players/civitas_agent.dat` exists — join persisted server-side.
- **Daemon** RUNNING (`.civitas-daemon.pid` 3277); `backups/daemon.log` tail shows real heartbeat summaries (COMP-002/COMP-004/KOTA-02/GOV) — but see F-01.

## 5. BUILD HEALTH (exact)

- `bunx tsc --noEmit` → **0 errors** (exit 0).
- `bun run lint` → **0 errors, 1 warning**: `src/app/layout.tsx:41 no-page-custom-font` (pre-existing).
- Live process check: PMMP running, daemon running, Java stopped (matches registry `autoStart:false`).

## 6. ORDERED FINDINGS

| ID | Sev | Finding | Fix (one line) |
|----|-----|---------|----------------|
| F-01 | **P1** | Daemon selflife tick crashes intermittently (~53%): 38/72 entries in `backups/daemon.log` end at `Bun v1.3.14 (Linux x64 baseline)` crash-footer; cause hidden because `scripts/civitas_daemon.sh:22` keeps `tail -1` only. Half of the "self-life" beats are dying silently. | Capture full stderr to log + wrap `selfLifeTick()` in try/catch printing JSON error in `civitas_selflife_tick.ts` + lockfile to serialize concurrent ticks. |
| F-02 | P2 | `docs/CIVITAS_OS_MASTER.md:149` describes `/api/mcp` as "MCP HTTP JSON-RPC (toolforge gateway)" but the route (`src/app/api/mcp/route.ts:12-20`) is the FlyBrain 9-tool stateless server (`system.status`, `prt.chat`, `connectome.query`, `receipt.verify`, `memory.*`, `creature.*`, `world.map`) — no CIVITAS tool exposed over HTTP. | Fix the doc line (or add a thin CIVITAS HTTP JSON-RPC route fronting `/api/civos/action`). |
| F-03 | P2 | `src/lib/civos/supabase.ts:191` "roundtrip: hapus" sends **POST** (rest() only supports GET/POST, `:19`), PostgREST needs DELETE → row is never deleted and the check always reports "baris uji masih ada" (honest failure, permanently red). | Add "DELETE" to rest() method union and call it in the hapus step. |
| F-04 | P2 | `src/lib/civos/village.ts:294` silent `catch {}` drops directive-enqueue failures with no log/event (only labeled comment). | Log to CivEvent TASK_FAILED or push a note before returning. |
| F-05 | P2 | Kernel has no path to Java console: `console.ts:12` reads single `mc.localConsolePath` (= pmmp FIFO), so `mc-server/java/console.in` is orphaned; Java logs contain zero CIVITAS commands (bot is Bedrock-only — worklog is honest about mineflayer being absent). | Either add per-server consolePath to the servers registry and route `mc_console` by server id, or state "Java = ping+lifecycle only" in MASTER.md. |
| F-06 | P2 | `bin/civitas.mjs` help claims/worklog says "17 perintah" but only 16 exist (help, version, status, pulse, selflife, doctor, census, chat, server, backup, sync, tool, config, events, daemon, mcp). | Align the count in docs/worklog or add the missing command. |

**P0 (fake claim / must-fix-before-finalize): none found.** The system's core claims survive an adversarial read; issues above are P1 wiring robustness and P2 honesty-polish.

## 7. tsc/lint exact results
- `bunx tsc --noEmit`: **0 errors**.
- `bun run lint`: **0 errors, 1 warning** (`@next/next/no-page-custom-font` at src/app/layout.tsx:41 — pre-existing).

## 8. Bottom line
CIVITAS OS passes the honesty audit at the architecture level: CLI, MCP-stdio, daemon, self-life, Bedrock bot/console chain, double-entry ledger, and Supabase mirroring are all wired to real mechanisms with honest failure reporting and live log/OS evidence (bot joined, 8 villagers summoned by plugin, daemon heartbeats). No mock/simulation/fake found. Fix F-01 (half the daemon beats crashing) before finalizing; F-02..F-06 are polish.
