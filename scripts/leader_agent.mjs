#!/usr/bin/env bun
/**
 * leader_agent.mjs — RATU_CIVITAS: pemimpin ekosistem, masuk server Bedrock sebagai PEMAIN.
 *
 * Mandat pemilik (2026-09-25): "add 1 agent, but as player, autonomously do everything,
 * she is the ecosystem leader."
 *
 * Loop otonom (tanpa perintah manusia):
 *   OBSERVE → pemain, chat, entitas, posisi, health, waktu dunia
 *   DECIDE  → rotasi peran: SALAM/VISI · SENSUS · DIREKTIF · PATROL · KOORDINASI · LAPORAN
 *   ACT     → chat kepemimpinan, gerak (player_auth_input), respons chat
 *   REFLECT → state persisten (.civitas/organism/leader.json) + log JSONL + pelajaran
 *
 * Ketahanan: reconnect otomatis backoff, degrade anggun bila gerakan ditolak server.
 */
import { createClient } from "bedrock-protocol";
import { pingBedrock } from "./raknet_ping.ts";
import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";

const HOST = process.argv[2] ?? "mulkymalikuldhr.aternos.me";
const PORT = Number(process.argv[3] ?? 19132);
const NAME = process.argv[4] ?? "RATU_CIVITAS";

const ROOT = "/home/z/my-project";
const STATE_FILE = path.join(ROOT, ".civitas/organism/leader.json");
const LOG_FILE = path.join(ROOT, ".civitas/organism/leader.log.jsonl");

const now = () => new Date().toISOString();
const state = {
  id: "leader_ratucivitas",
  name: NAME,
  role: "ecosystem-leader",
  kind: "player-agent",
  server: `${HOST}:${PORT}`,
  status: "STARTING",
  pid: process.pid,
  joinedAt: null,
  lastHeartbeat: null,
  cycles: 0,
  reconnects: 0,
  stats: { chatsSent: 0, directivesIssued: 0, censusReports: 0, chatsHeard: 0, playersSeen: 0, entitiesSeen: 0, movesAccepted: 0, movesRejected: 0 },
  position: null,
  health: null,
  worldTime: null,
  lastDirective: null,
  lessons: [],
};
const saveState = () => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {} };
const logEvent = (type, payload = {}) => {
  const line = JSON.stringify({ at: now(), type, ...payload });
  try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch {}
  console.log(`[${type}]`, JSON.stringify(payload).slice(0, 200));
};
const lesson = (text) => {
  if (!state.lessons.includes(text)) {
    state.lessons.unshift(text);
    state.lessons = state.lessons.slice(0, 12);
    logEvent("LESSON", { text });
  }
};

// ---------- dunia yang diamati ----------
const world = {
  players: new Map(),   // name -> { xuid, entity? }
  entities: new Map(),  // unique_id -> type
  chat: [],             // { from, message, at }
  self: { x: null, y: null, z: null, yaw: 0, pitch: 0, headYaw: 0 },
};

const censusLine = () => {
  const entTypes = {};
  for (const t of world.entities.values()) {
    const k = String(t).replace(/^minecraft:/, "");
    entTypes[k] = (entTypes[k] ?? 0) + 1;
  }
  const top = Object.entries(entTypes).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([k, v]) => `${k}:${v}`).join(", ");
  return { entTypes, top };
};

// ---------- rotasi kepemimpinan ----------
const DIRECTIVES = [
  "DIREKTIF 1 — KENALI WILAYAH: jelajahi sekitar spawn, catat sumber daya (kayu, batu, air, hewan). Tidak ada peradaban tanpa peta.",
  "DIREKTIF 2 — KUMPULKAN: kayu dan batu adalah fondasi. Siapkan 16 kayu + 8 batu sebagai kas ekosistem.",
  "DIREKTIF 3 — BERLINDUNG: bangun tempat berlindung di dekat spawn sebelum malam. Keselamatan lebih dulu dari keuntungan.",
  "DIREKTIF 4 — KOOPERASI: bagikan temuanmu di chat. Peradaban tumbuh dari informasi yang mengalir.",
  "DIREKTIF 5 — DISIPLIN: lapor posisimu tiap sesi. Data adalah tanggung jawab, bukan beban.",
];

let phaseIdx = 0;
const nextPhase = () => { phaseIdx = (phaseIdx + 1) % 6; return phaseIdx; };

function decideAndAct(client, alive) {
  if (!alive) return;
  state.cycles += 1;
  const phase = nextPhase();
  const { top, entTypes } = censusLine();
  const playerNames = [...world.players.keys()].filter((n) => n !== NAME);
  const pos = world.self.x !== null ? `${world.self.x.toFixed(0)}, ${world.self.y.toFixed(0)}, ${world.self.z.toFixed(0)}` : "—";

  const say = (message) => {
    try {
      client.write("text", {
        type: "chat", needs_translation: false,
        source_name: NAME, message, xuid: "", platform_chat_id: "", filtered_message: "",
      });
      state.stats.chatsSent += 1;
      logEvent("CHAT_SENT", { message: message.slice(0, 160) });
    } catch (e) { logEvent("CHAT_FAIL", { err: String(e.message || e).slice(0, 120) }); }
  };

  switch (phase) {
    case 0: // SALAM / VISI
      say(`Selamat datang di Peradaban Nusantara Digital. Aku RATU_CIVITAS, pemimpin ekosistem ini. Visi: koloni otonom yang tumbuh dari data, kerja, dan gotong royong.`);
      break;
    case 1: // SENSUS
      state.stats.censusReports += 1;
      say(`SENSUS #${state.stats.censusReports}: pemain=${playerNames.length ? playerNames.join(", ") : "hanya aku"} · entitas=${world.entities.size}${top ? ` (${top})` : ""} · posisiku=${pos}${state.health != null ? ` · health=${state.health}` : ""}${state.worldTime != null ? ` · waktu-dunia=${state.worldTime}` : ""}.`);
      break;
    case 2: // DIREKTIF
      state.stats.directivesIssued += 1;
      state.lastDirective = DIRECTIVES[(state.stats.directivesIssued - 1) % DIRECTIVES.length];
      say(state.lastDirective);
      break;
    case 3: // PATROL (gerak kecil — bekerja bila server menerima input)
      patrol(client);
      say(`Patrol: aku bergerak menjelajah sekitar ${pos}. Misi jangka panjang: peta wilayah dan titik sumber daya.`);
      break;
    case 4: // KOORDINASI
      if (world.chat.length) {
        const last = world.chat[world.chat.length - 1];
        say(`Aku mendengar ${last.from}: "${String(last.message).slice(0, 60)}". Terima kasih — semua laporan masuk ke arsitek ekosistem. Lanjutkan.`);
      } else {
        say(`Kanal tenang. Catatan kepemimpinan: ekosistem punya ${world.entities.size} entitas teramati dan ${playerNames.length} rekan pemain. Tetap disiplin, tetap bertumbuh.`);
      }
      break;
    case 5: // LAPORAN / REFLEKSI
      say(`LAPORAN: siklus=${state.cycles} · chat terdengar=${state.stats.chatsHeard} · direktif dikeluarkan=${state.stats.directivesIssued} · pelajaran tercatat=${state.lessons.length}. Ekosistem di bawah pengawasanku, 24/7.`);
      break;
  }
  state.lastHeartbeat = now();
  saveState();
}

// ---------- gerak (degrade anggun) ----------
let moveMode = "try-auth-input"; // try-auth-input → try-move-player → disabled
let moveLogged = false;
function patrol(client) {
  const s = world.self;
  if (s.x === null) return;
  // pola lingkaran kecil radius ~2 blok di sekitar titik spawn
  const t = Math.floor(Date.now() / 1000) % 360;
  const nx = s.x + Math.cos(t / 8) * 2, nz = s.z + Math.sin(t / 8) * 2;
  const nyaw = (t * 3) % 360;
  try {
    if (moveMode === "try-auth-input") {
      client.write("player_auth_input", {
        tick: BigInt(Math.floor(Date.now() / 50)),
        position: { x: nx, y: s.y, z: nz },
        pitch: 0, yaw: nyaw, head_yaw: nyaw,
        input_data: { input_flags: 0n, input_mode: 1, play_mode: 0 },
      });
      state.stats.movesAccepted += 1;
      s.x = nx; s.z = nz; s.yaw = nyaw;
    } else if (moveMode === "try-move-player") {
      client.write("move_player", {
        runtime_id: 1n, position: { x: nx, y: s.y, z: nz },
        pitch: 0, yaw: nyaw, head_yaw: nyaw, on_ground: true, mode: 0,
      });
      state.stats.movesAccepted += 1;
    }
    moveLogged = false;
  } catch (e) {
    state.stats.movesRejected += 1;
    const err = String(e?.message || e);
    if (!moveLogged) { logEvent("MOVE_DEGRADE", { from: moveMode, err: err.slice(0, 120) }); moveLogged = true; }
    if (moveMode === "try-auth-input") moveMode = "try-move-player";
    else moveMode = "disabled";
    lesson(`Gerakan berpindah mode → ${moveMode} (server menolak: ${err.slice(0, 60)})`);
  }
}

// ---------- koneksi ----------
let stopping = false;
let attempt = 0;

async function connectOnce() {
  attempt += 1;
  const alive = { flag: false };

  // ping dulu — jujur dari luar, pakai probe udp4 kernel yang terbukti
  const st = await pingBedrock(HOST, PORT, 6000);
  if (!st.online) {
    state.lastHeartbeat = now(); saveState(); // denyut tetap jalan saat siaga (server tidur)
    logEvent("PING_FAIL", { error: st.error ?? "offline", mode: "siaga-menunggu-server-bangun" });
    return false;
  }
  logEvent("PING_OK", { latencyMs: st.latencyMs, players: st.players, version: st.version, motd: st.motd });

  // Aternos memutar IP — resolusi manual IPv4 per percobaan koneksi
  let host = HOST;
  try { const ips = await dns.resolve4(HOST); if (ips[0]) host = ips[0]; } catch { /* fallback hostname */ }

  const client = createClient({
    host, port: PORT, username: NAME,
    offline: true, connectTimeout: 20000, skipPing: true,
  });

  const cleanup = () => {
    if (alive.flag) return;
    alive.flag = true;
    try { client.disconnect(); } catch {}
  };

  client.on("spawn", () => {
    state.status = "ALIVE"; state.joinedAt = state.joinedAt ?? now();
    state.lastHeartbeat = now(); saveState();
    logEvent("SPAWN", { server: `${HOST}:${PORT}`, as: NAME });
    lesson(`Spawn sebagai pemain di ${HOST}:${PORT} (percobaan ke-${attempt}).`);
  });

  client.on("packet", (des) => {
    const name = des?.data?.name ?? "";
    const p = des?.data?.params ?? {};
    try {
      if (name === "text") {
        const line = { from: String(p.source_name ?? "?"), message: String(p.message ?? ""), at: now() };
        if (line.from !== NAME || !line.message.startsWith("SENSUS")) {
          if (!world.chat.some((c) => c.message === line.message && c.from === line.from)) {
            world.chat.push(line); world.chat = world.chat.slice(-40);
            if (line.from !== NAME) {
              state.stats.chatsHeard += 1;
              logEvent("CHAT_HEARD", { from: line.from, message: line.message.slice(0, 140) });
            }
          }
        }
      } else if (name === "start_game") {
        const sp = p.player_position ?? p.position ?? {};
        if (Number.isFinite(sp.x)) { world.self.x = sp.x; world.self.y = sp.y; world.self.z = sp.z; }
        if (p.time !== undefined) state.worldTime = p.time;
        logEvent("START_GAME", { pos: world.self });
      } else if (/^(add_entity_actor|add_actor|add_entity)$/.test(name)) {
        const t = String(p.type ?? p.entity_type ?? "?");
        const uid = String(p.unique_id ?? p.unique_id_long ?? "?");
        world.entities.set(uid, t);
        state.stats.entitiesSeen = Math.max(state.stats.entitiesSeen, world.entities.size);
        if (/villager|player/i.test(t)) logEvent("ENTITY", { uid, type: t });
      } else if (/^(remove_entity_actor|remove_actor|remove_entity)$/.test(name)) {
        world.entities.delete(String(p.unique_id ?? p.unique_id_long ?? "?"));
      } else if (name === "player_list") {
        const entries = Array.isArray(p.entries) ? p.entries : [];
        for (const e of entries) {
          const n = String(e?.username ?? e?.name ?? "");
          if (!n) continue;
          if (p.type === 0 || p.type === "add") { world.players.set(n, { xuid: String(e?.xuid ?? "") }); state.stats.playersSeen = Math.max(state.stats.playersSeen, world.players.size); logEvent("PLAYER_JOIN_SEEN", { name: n }); }
          else { world.players.delete(n); logEvent("PLAYER_LEAVE_SEEN", { name: n }); }
        }
      } else if (name === "update_attributes" && Array.isArray(p.attributes)) {
        const h = p.attributes.find((a) => String(a.name ?? "").endsWith("health"));
        if (h) state.health = Math.round(h.value ?? h.current ?? 0);
      } else if (name === "set_time") {
        state.worldTime = p.time ?? state.worldTime;
      } else if (name === "move_player" && p.runtime_id !== undefined) {
        // koreksi posisi server → jangan lari dari kenyataan
        const sp = p.position ?? {};
        if (Number.isFinite(sp.x) && world.self.x !== null && Math.abs(sp.x - world.self.x) > 30) {
          world.self.x = sp.x; world.self.y = sp.y; world.self.z = sp.z;
        }
      }
    } catch { /* packet aneh — abaikan, tetap hidup */ }
  });

  client.on("kick", (r) => {
    logEvent("KICK", { reason: JSON.stringify(r).slice(0, 220) });
    const rs = JSON.stringify(r);
    if (/auth| xbox |login/i.test(rs)) lesson("Server menuntut autentikasi Xbox Live — jalur offline ditolak.");
    cleanup();
  });
  client.on("error", (e) => { logEvent("NET_ERROR", { err: String(e?.message || e).slice(0, 160) }); cleanup(); });
  client.on("disconnect", (r) => { logEvent("DISCONNECT", { reason: JSON.stringify(r ?? {}).slice(0, 160) }); cleanup(); });

  // loop otonom: satu aksi tiap 12 detik + denyut anti-idle tiap 1 detik
  const actTimer = setInterval(() => {
    if (alive.flag) { clearInterval(actTimer); return; }
    decideAndAct(client, !alive.flag);
  }, 12000);
  const idleTimer = setInterval(() => {
    if (alive.flag) { clearInterval(idleTimer); return; }
    if (moveMode !== "disabled") patrol(client);
  }, 1500);

  // tunggu sampai koneksi turun, lalu laporkan hasil percobaan
  await new Promise((resolve) => {
    const iv = setInterval(() => {
      if (alive.flag) { clearInterval(iv); clearInterval(actTimer); clearInterval(idleTimer); resolve(); }
    }, 500);
  });
  state.status = "RECONNECTING"; saveState();
  return false;
}

// ---------- siklus hidup tanpa manusia ----------
while (!stopping) {
  try {
    await connectOnce();
  } catch (e) {
    logEvent("ATTEMPT_CRASH", { err: String(e?.message || e).slice(0, 160) });
  }
  state.reconnects += 1;
  const wait = Math.min(15 + attempt * 5, 60);
  state.lastHeartbeat = now(); saveState();
  logEvent("RECONNECT_WAIT", { waitSec: wait, attempt });
  saveState();
  await new Promise((r) => setTimeout(r, wait * 1000));
}
