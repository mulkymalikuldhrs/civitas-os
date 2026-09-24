#!/usr/bin/env bun
/**
 * leader_agent.mjs — SUPERVISOR RATU_CIVITAS (v2.1).
 * Loop abadi: ping RakNet → bila server hidup, jalankan joiner anak (leader_join.mjs,
 * SATU percobaan koneksi per proses) → catat hasil → tunggu → ulangi.
 * Crash keras di bedrock-protocol tidak mematikan supervisor — hanya anaknya.
 * Memori/state tetap file persisten (dipakai bersama anak): leader.json, leader.memory.json.
 */
import { pingBedrock } from "./raknet_ping.ts";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HOST = process.argv[2] ?? "mulkymalikuldhr.aternos.me";
const PORT = Number(process.argv[3] ?? 19132);
const NAME = process.argv[4] ?? "RATU_CIVITAS";

const ROOT = "/home/z/my-project";
const ORG = path.join(ROOT, ".civitas/organism");
const STATE_FILE = path.join(ORG, "leader.json");
const LOG_FILE = path.join(ORG, "leader.log.jsonl");

const now = () => new Date().toISOString();
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

const state = {
  id: "leader_ratucivitas", name: NAME, role: "ecosystem-leader", kind: "player-agent",
  brain: "v2.1-supervisor+joiner", server: `${HOST}:${PORT}`,
  status: "STARTING", pid: process.pid, joinedAt: null, lastHeartbeat: null,
  cycles: 0, reconnects: 0,
  stats: { chatsSent: 0, directivesIssued: 0, censusReports: 0, chatsHeard: 0, playersSeen: 0, entitiesSeen: 0, movesAccepted: 0, movesRejected: 0, thoughts: 0, improvements: 0 },
  position: null, health: null, worldTime: null, lastThought: null, lastDirective: null, lessons: [],
};
const saveState = () => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {} };
const logEvent = (type, payload = {}) => {
  const line = JSON.stringify({ at: now(), type, ...payload });
  try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch {}
  console.log(`[${type}]`, JSON.stringify(payload).slice(0, 180));
};

// gabungkan stats terbaru dari anak (anak menulis file miliknya sendiri antar siklus)
function mergeChildStats() {
  try {
    const child = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (child && child.stats && child.brain === "v2-memory-thought-improve") {
      for (const k of Object.keys(state.stats)) state.stats[k] = Math.max(state.stats[k] ?? 0, child.stats[k] ?? 0);
      state.cycles = Math.max(state.cycles, child.cycles ?? 0);
      state.joinedAt = state.joinedAt ?? child.joinedAt;
      state.health = child.health ?? state.health;
      state.position = child.position ?? state.position;
      state.lastThought = child.lastThought ?? state.lastThought;
      state.lastDirective = child.lastDirective ?? state.lastDirective;
      state.lessons = child.lessons ?? state.lessons;
    }
  } catch { /* file belum ada / format lama */ }
}

const attempt = { n: 0 };
let stopping = false;
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { stopping = true; process.exit(0); });

logEvent("SUPERVISOR_START", { server: `${HOST}:${PORT}`, pid: process.pid });

while (!stopping) {
  const st = await pingBedrock(HOST, PORT, 6000);
  if (!st.online) {
    state.status = "SIAGA"; state.lastHeartbeat = now(); saveState();
    logEvent("PING_FAIL", { error: st.error ?? "offline", mode: "siaga-menunggu-server-bangun" });
    await sleep(60);
    continue;
  }
  logEvent("PING_OK", { latencyMs: st.latencyMs, players: st.players, version: st.version });
  state.status = "JOINING"; state.lastHeartbeat = now(); saveState();

  attempt.n += 1;
  const child = spawn("bun", [path.join(ROOT, "scripts/leader_join.mjs"), HOST, String(PORT), NAME], {
    cwd: ROOT, stdio: ["ignore", "inherit", "inherit"],
  });
  const code = await new Promise((res) => child.on("exit", (c) => res(c)));
  mergeChildStats();
  state.reconnects += 1;
  state.lastHeartbeat = now(); saveState();
  logEvent("CHILD_EXIT", { attempt: attempt.n, code, note: code === 0 ? "disconnect normal" : "crash/terlempar — diulang" });
  await sleep(code === 0 ? 12 : 20);
}
logEvent("SUPERVISOR_STOP", {});
