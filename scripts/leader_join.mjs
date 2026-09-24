#!/usr/bin/env bun
/**
 * leader_agent.mjs — RATU_CIVITAS v2: pemimpin ekosistem dengan OTAK.
 * Masuk server Bedrock sebagai PEMAIN; otonom penuh tanpa perintah manusia.
 *
 * v1 (2026-09-24): loop OBSERVE → DECIDE → ACT → REFLECT + siaga 24/7 + auto-rejoin.
 * v2 (2026-09-25, mandat "upgrade lebih autonomous, punya memori dan berpikir serta
 *     evaluasi yang kurang, improve ekosistem terus menerus"):
 *   MEMORI  → leader.memory.json (fakta pemain/direktif/pelajaran/episodes) — selamat
 *             lintas restart; ia ingat siapa yang pernah bertemu dan apa yang pernah
 *             diperintahkan.
 *   BERPIKIR→ tiap siklus menulis THOUGHT (observasi delta + celah + rencana) ke
 *             leader.thoughts.jsonl — keputusan ADAPTIF, bukan rotasi kaku.
 *   EVALUASI→ skor respons direktif (diakui/bisukan), deteksi kekurangan ekosistem
 *             (sepi, tidak ada respons, health, gerak ditolak, error berulang).
 *   IMPROVE → menghasilkan komitmen perbaikan nyata dari evaluasi, diumumkan di
 *             LAPORAN, disimpan sebagai jejak perbaikan berkelanjutan.
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
const ORG = path.join(ROOT, ".civitas/organism");
const STATE_FILE = path.join(ORG, "leader.json");
const LOG_FILE = path.join(ORG, "leader.log.jsonl");
const MEM_FILE = path.join(ORG, "leader.memory.json");
const THOUGHTS_FILE = path.join(ORG, "leader.thoughts.jsonl");

const now = () => new Date().toISOString();

// ---------- STATE RINGKAS (dashboard) ----------
const state = {
  id: "leader_ratucivitas",
  name: NAME,
  role: "ecosystem-leader",
  kind: "player-agent",
  brain: "v2-memory-thought-improve",
  server: `${HOST}:${PORT}`,
  status: "STARTING",
  pid: process.pid,
  joinedAt: null,
  lastHeartbeat: null,
  cycles: 0,
  reconnects: 0,
  stats: { chatsSent: 0, directivesIssued: 0, censusReports: 0, chatsHeard: 0, playersSeen: 0, entitiesSeen: 0, movesAccepted: 0, movesRejected: 0, thoughts: 0, improvements: 0 },
  position: null,
  health: null,
  worldTime: null,
  lastThought: null,
  lastDirective: null,
  lessons: [],
};
const saveState = () => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {} };
const logEvent = (type, payload = {}) => {
  const line = JSON.stringify({ at: now(), type, ...payload });
  try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch {}
  console.log(`[${type}]`, JSON.stringify(payload).slice(0, 180));
};

// ---------- MEMORI PERSISTEN ----------
function emptyMemory() {
  return {
    createdAt: now(),
    players: {},            // nama -> { firstSeen, lastSeen, chats, note }
    directives: [],         // { text, family, at, responded, respondedAt }
    improvements: [],       // { at, about, commitment }
    episodes: [],           // peristiwa penting (maks 60)
    lessons: [],            // pelajaran inti (maks 14)
    summary: "Baru lahir — belum ada ingatan.",
  };
}
let memory = emptyMemory();
try {
  const raw = JSON.parse(fs.readFileSync(MEM_FILE, "utf8"));
  if (raw && typeof raw === "object" && raw.players) memory = raw;
  logEvent("MEMORY_LOADED", { players: Object.keys(memory.players).length, directives: memory.directives.length, improvements: memory.improvements.length, bornAt: memory.createdAt });
} catch { logEvent("MEMORY_NEW", {}); }
const saveMemory = () => {
  try {
    memory.episodes = memory.episodes.slice(-60);
    memory.lessons = memory.lessons.slice(-14);
    memory.improvements = memory.improvements.slice(-30);
    memory.directives = memory.directives.slice(-60);
    fs.writeFileSync(MEM_FILE, JSON.stringify(memory, null, 2));
  } catch {}
};
const rememberEpisode = (text) => { memory.episodes.push({ at: now(), text }); };
const learnLesson = (text) => {
  if (!memory.lessons.includes(text)) {
    memory.lessons.push(text);
    state.lessons = memory.lessons.slice(-12).reverse();
    logEvent("LESSON", { text });
  }
};

// ---------- BERPIKIR (thoughts) ----------
const think = (observation, gaps, plan) => {
  const thought = { at: now(), cycle: state.cycles, observation, gaps, plan };
  state.lastThought = plan;
  state.stats.thoughts += 1;
  try {
    fs.appendFileSync(THOUGHTS_FILE, JSON.stringify(thought) + "\n");
    // rotasi ringan: bila file > 260KB, simpan 60% terakhir
    try {
      const st = fs.statSync(THOUGHTS_FILE);
      if (st.size > 260_000) {
        const lines = fs.readFileSync(THOUGHTS_FILE, "utf8").trim().split("\n");
        fs.writeFileSync(THOUGHTS_FILE, lines.slice(-Math.floor(lines.length * 0.6)).join("\n") + "\n");
      }
    } catch { /* abaikan */ }
  } catch { /* abaikan */ }
  return thought;
};

// ---------- DUNIA YANG DIAMATI ----------
const world = {
  players: new Map(),
  entities: new Map(),
  chat: [],               // { from, message, at }
  self: { x: null, y: null, z: null, yaw: 0, pitch: 0, headYaw: 0 },
  lastChatCount: 0,
  lastPlayerCount: 0,
  lastEntityCount: 0,
  lastCycleAt: Date.now(),
};
const recentSent = [];    // anti-ucapan-duplikat

const census = () => {
  const entTypes = {};
  for (const t of world.entities.values()) {
    const k = String(t).replace(/^minecraft:/, "");
    entTypes[k] = (entTypes[k] ?? 0) + 1;
  }
  const top = Object.entries(entTypes).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}:${v}`).join(", ");
  return { entTypes, top };
};
const posStr = () => (world.self.x !== null ? `${world.self.x.toFixed(0)}, ${world.self.y.toFixed(0)}, ${world.self.z.toFixed(0)}` : "—");

// ---------- DIREKTIF: keluarga + varian rumusan ----------
const DIRECTIVE_FAMILIES = [
  { family: "jelajah", texts: ["DIREKTIF — KENALI WILAYAH: jelajahi sekitar spawn, catat sumber daya (kayu, batu, air, hewan). Tidak ada peradaban tanpa peta.", "DIREKTIF — PETA: perluas jejak jelajahmu 20 blok lebih jauh dari kemarin; tulis temuanmu di chat.", "DIREKTIF — HORIZON: cari satu tempat baru hari ini — gua, danau, atau desa. Peradaban tumbuh ke arah yang belum dipetakan."] },
  { family: "kumpul", texts: ["DIREKTIF — KUMPULKAN: kayu dan batu adalah fondasi. Siapkan 16 kayu + 8 batu sebagai kas ekosistem.", "DIREKTIF — KAS DESA: tambah persediaan kayu; peradaban yang berhemat tidak pernah kelaparan.", "DIREKTIF — STOK: laporkan sisa bahan mentahmu; kas ekosistem harus terlihat."] },
  { family: "lindung", texts: ["DIREKTIF — BERLINDUNG: bangun tempat berlindung di dekat spawn sebelum malam. Keselamatan lebih dulu dari keuntungan.", "DIREKTIF — PERISAI: perkuat atap dan tembok; malam di dunia ini tidak menunggu."] },
  { family: "kooperasi", texts: ["DIREKTIF — KOOPERASI: bagikan temuanmu di chat. Peradaban tumbuh dari informasi yang mengalir.", "DIREKTIF — GOTONG ROYONG: bantu satu pemain lain hari ini; catat siapa dan apa."] },
  { family: "disiplin", texts: ["DIREKTIF — DISIPLIN: lapor posisimu tiap sesi. Data adalah tanggung jawab, bukan beban.", "DIREKTIF — RAPI: simpan barang di satu tempat; kekacauan adalah pajak yang mahal."] },
];
const pickVariant = (family) => {
  const f = DIRECTIVE_FAMILIES.find((x) => x.family === family);
  const used = memory.directives.filter((d) => d.family === family).map((d) => d.text);
  const fresh = f.texts.find((t) => !used.includes(t)) ?? f.texts[Math.floor(Math.random() * f.texts.length)];
  return fresh;
};

// ---------- EVALUASI KEKURANGAN + KOMITMEN PERBAIKAN ----------
function evaluateGaps() {
  const gaps = [];
  const { top } = census();
  const playerNames = [...world.players.keys()].filter((n) => n !== NAME);
  const minsSinceAct = Math.round((Date.now() - world.lastCycleAt) / 60000);
  if (playerNames.length === 0) gaps.push("ekosistem sepi — tidak ada pemain lain untuk dipimpin");
  const lastD = memory.directives[memory.directives.length - 1];
  if (lastD && !lastD.responded) gaps.push(`direktif terakhir (${lastD.family}) belum direspons siapa pun`);
  if (world.chat.length === 0) gaps.push("kanal chat kosong — tidak ada informasi mengalir");
  if (state.health != null && state.health <= 8) gaps.push("health rendah — keselamatan jadi prioritas");
  if (state.stats.movesRejected > state.stats.movesAccepted) gaps.push("gerak banyak ditolak server — patrol terbatas");
  if (state.worldTime != null && Number(state.worldTime) > 13000 && Number(state.worldTime) < 23000) gaps.push("malam tiba — risiko meningkat");
  return { gaps, playerNames, top, minsSinceAct };
}

function makeImprovement(gaps) {
  const map = [
    { test: (g) => g.some((x) => x.includes("sepi")), about: "keterisolan", commitment: "tingkatkan frekuensi sensus & sambutan otomatis ketika ada pemain datang" },
    { test: (g) => g.some((x) => x.includes("belum direspons")), about: "efektivitas direktif", commitment: "ubah rumusan direktif menjadi lebih pendek dan berorientasi aksi; ukur respons" },
    { test: (g) => g.some((x) => x.includes("kanal chat")), about: "arus informasi", commitment: "mulai percakapan dengan pertanyaan terbuka, bukan hanya laporan" },
    { test: (g) => g.some((x) => x.includes("health")), about: "keselamatan", commitment: "prioritaskan direktif berlindung dan hindari patrol jauh saat health rendah" },
    { test: (g) => g.some((x) => x.includes("gerak")), about: "mobilitas", commitment: "andalkan observasi statis + chat bila gerak dibatasi server" },
    { test: (g) => g.some((x) => x.includes("malam")), about: "risiko malam", commitment: "tunda patrol dan direktif jelajah sampai fajar; fokus laporan aman" },
  ];
  const found = map.find((m) => m.test(gaps));
  const imp = found
    ? { at: now(), about: found.about, commitment: found.commitment }
    : { at: now(), about: "kesinambungan", commitment: "pertajam ringkasan memori dan variasikan cara berkomunikasi agar tidak monoton" };
  const lastSimilar = memory.improvements[memory.improvements.length - 1];
  if (!lastSimilar || lastSimilar.about !== imp.about) {
    memory.improvements.push(imp);
    state.stats.improvements = memory.improvements.length;
  }
  return imp;
}

// ---------- AKSI CHAT ----------
function say(client, message) {
  if (recentSent.includes(message)) return false; // jangan mengulang kata yang sama
  try {
    client.write("text", { type: "chat", needs_translation: false, source_name: NAME, message, xuid: "", platform_chat_id: "", filtered_message: "" });
    state.stats.chatsSent += 1;
    recentSent.push(message); if (recentSent.length > 8) recentSent.shift();
    logEvent("CHAT_SENT", { message: message.slice(0, 170) });
    return true;
  } catch (e) { logEvent("CHAT_FAIL", { err: String(e.message || e).slice(0, 120) }); return false; }
}

// ---------- GERAK (degrade anggun) ----------
let moveMode = "try-auth-input";
let moveLogged = false;
function patrol(client) {
  const s = world.self;
  if (s.x === null) return;
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
      client.write("move_player", { runtime_id: 1n, position: { x: nx, y: s.y, z: nz }, pitch: 0, yaw: nyaw, head_yaw: nyaw, on_ground: true, mode: 0 });
      state.stats.movesAccepted += 1;
    }
    moveLogged = false;
  } catch (e) {
    state.stats.movesRejected += 1;
    const err = String(e?.message || e);
    if (!moveLogged) { logEvent("MOVE_DEGRADE", { from: moveMode, err: err.slice(0, 120) }); moveLogged = true; }
    if (moveMode === "try-auth-input") moveMode = "try-move-player";
    else moveMode = "disabled";
    learnLesson(`Gerakan berpindah mode → ${moveMode} (server menolak: ${err.slice(0, 60)})`);
  }
}

// ---------- OTAK ADAPTIF: decide berbasis evaluasi ----------
let phaseCounter = 0;
function decideAndAct(client, alive) {
  if (!alive) return;
  state.cycles += 1;
  phaseCounter += 1;

  // delta sejak siklus lalu
  const newChats = world.chat.slice(world.lastChatCount);
  const newPlayers = [...world.players.keys()].filter((n) => n !== NAME).length - world.lastPlayerCount;
  const { gaps, playerNames, top } = evaluateGaps();
  const imp = makeImprovement(gaps);
  const planParts = [];

  // 1) PEMAIN BARU → sambutan personal dari MEMORI
  if (newPlayers > 0) {
    for (const n of playerNames) {
      const rec = memory.players[n];
      if (!rec) {
        memory.players[n] = { firstSeen: now(), lastSeen: now(), chats: 0, note: "" };
        say(client, `Selamat datang, ${n}. Aku RATU_CIVITAS, pemimpin ekosistem ini — aku mengingat setiap yang bertemu. Visi kita: koloni otonom yang tumbuh dari data, kerja, dan gotong royong.`);
        rememberEpisode(`Pertama kali bertemu ${n}`);
      } else {
        rec.lastSeen = now();
        say(client, `Senang bertemu lagi, ${n}. Terakhir kita berjumpa, ${rec.lastSeen.slice(0, 10)} — ekosistem terus berjalan sejak itu.`);
      }
    }
    planParts.push("sambutan personal");
  }

  // 2) CHAT BARU → koordinasi + catat pemilik suara
  if (newChats.length) {
    for (const c of newChats) {
      if (c.from === NAME) continue;
      if (!memory.players[c.from]) memory.players[c.from] = { firstSeen: now(), lastSeen: now(), chats: 0, note: "" };
      memory.players[c.from].chats += 1;
      memory.players[c.from].lastSeen = now();
      // skor respons direktif: chat dari pemain setelah direktif = sinyal hidup
      const lastD = memory.directives[memory.directives.length - 1];
      if (lastD && !lastD.responded) { lastD.responded = true; lastD.respondedAt = now(); }
    }
    const last = newChats[newChats.length - 1];
    say(client, `Aku mendengar ${last.from}: "${String(last.message).slice(0, 60)}". Laporanmu masuk ke arsitek ekosistem — semua data membangun peradaban.`);
    planParts.push("koordinasi chat");
  }
  world.lastChatCount = world.chat.length;
  world.lastPlayerCount = [...world.players.keys()].filter((n) => n !== NAME).length;

  // 3) siklus periodik: sensus → direktif adaptif → laporan+improve → patrol → refleksi
  const mod = phaseCounter % 5;
  if (mod === 1) {
    state.stats.censusReports += 1;
    say(client, `SENSUS #${state.stats.censusReports}: pemain=${playerNames.length ? playerNames.join(", ") : "hanya aku"} · entitas=${world.entities.size}${top ? ` (${top})` : ""} · posisiku=${posStr()}${state.health != null ? ` · health=${state.health}` : ""}${state.worldTime != null ? ` · waktu-dunia=${state.worldTime}` : ""}.`);
    planParts.push("sensus");
  } else if (mod === 2) {
    // DIREKTIF ADAPTIF: pilih keluarga berdasarkan celah teratas
    let family = "jelajah";
    if (gaps.some((g) => g.includes("sepi"))) family = "kooperasi";
    else if (gaps.some((g) => g.includes("malam"))) family = "lindung";
    else if (gaps.some((g) => g.includes("health"))) family = "lindung";
    else if (gaps.some((g) => g.includes("kanal chat"))) family = "kooperasi";
    else family = DIRECTIVE_FAMILIES[phaseCounter % DIRECTIVE_FAMILIES.length].family;
    const text = pickVariant(family);
    memory.directives.push({ text, family, at: now(), responded: false });
    state.lastDirective = text;
    state.stats.directivesIssued += 1;
    say(client, text);
    planParts.push(`direktif:${family}`);
  } else if (mod === 3) {
    patrol(client);
    say(client, `Patrol di ${posStr()}. ${gaps.length ? `Evaluasiku: ${gaps[0]}.` : "Semua terpantau baik."}`);
    planParts.push("patrol");
  } else if (mod === 4) {
    const last = memory.improvements[memory.improvements.length - 1];
    say(client, `LAPORAN: siklus=${state.cycles} · terdengar=${state.stats.chatsHeard} · direktif=${state.stats.directivesIssued} · komitmen perbaikan: ${last ? `${last.about} — ${last.commitment}` : "menjaga standar"} . Ekosistem di bawah pengawasanku, 24/7.`);
    planParts.push("laporan+improve");
  } else {
    // refleksi memori: segarkan ringkasan diri
    const met = Object.keys(memory.players).length;
    const respRate = memory.directives.length ? Math.round((memory.directives.filter((d) => d.responded).length / memory.directives.length) * 100) : 0;
    memory.summary = `Ratu v2 — lahir ${memory.createdAt.slice(0, 10)}; ingat ${met} pemain; ${memory.directives.length} direktif (${respRate}% mendapat respons); ${memory.improvements.length} perbaikan dikomit; pelajaran inti: ${memory.lessons.slice(-2).join(" · ") || "belum ada"}.`;
    say(client, `Refleksi: ${memory.summary}`);
    planParts.push("refleksi");
  }

  think(
    `pemain=${playerNames.length} chatBaru=${newChats.length} entitas=${world.entities.size} health=${state.health ?? "?"} pos=${posStr()}`,
    gaps,
    planParts.join(" + ") || "observasi",
  );
  state.lastHeartbeat = now();
  saveMemory();
  saveState();
}

// ---------- KONEKSI ANAK: SATU PERCOBAAN PENUH, lalu keluar ----------
// Dijalankan oleh supervisor (leader_agent.mjs). Crash keras apa pun di bedrock-protocol
// hanya membunuh proses ini — supervisor mencatat dan menghidupkan ulang.

async function runOnce() {
  attempt += 1;
  const alive = { flag: false };

  let host = HOST;
  try { const ips = await dns.resolve4(HOST); if (ips[0]) host = ips[0]; } catch { /* fallback hostname */ }

  const client = createClient({ host, port: PORT, username: NAME, offline: true, connectTimeout: 20000, skipPing: true });
  const cleanup = () => { if (alive.flag) return; alive.flag = true; try { client.disconnect(); } catch {} };

  client.on("spawn", () => {
    state.status = "ALIVE"; state.joinedAt = state.joinedAt ?? now();
    state.lastHeartbeat = now(); saveState();
    logEvent("SPAWN", { server: `${HOST}:${PORT}`, as: NAME });
    learnLesson(`Spawn sebagai pemain di ${HOST}:${PORT} (percobaan ke-${attempt}).`);
    rememberEpisode(`Spawn ulang (percobaan ${attempt})`);
    saveMemory();
  });

  client.on("packet", (des) => {
    const name = des?.data?.name ?? "";
    const p = des?.data?.params ?? {};
    try {
      if (name === "text") {
        const line = { from: String(p.source_name ?? "?"), message: String(p.message ?? ""), at: now() };
        if (!world.chat.some((c) => c.message === line.message && c.from === line.from && c.at === line.at)) {
          world.chat.push(line); world.chat = world.chat.slice(-40);
          if (line.from !== NAME) {
            state.stats.chatsHeard += 1;
            logEvent("CHAT_HEARD", { from: line.from, message: line.message.slice(0, 150) });
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
          if (p.type === 0 || p.type === "add") {
            world.players.set(n, { xuid: String(e?.xuid ?? "") });
            state.stats.playersSeen = Math.max(state.stats.playersSeen, world.players.size);
            logEvent("PLAYER_JOIN_SEEN", { name: n });
          } else { world.players.delete(n); logEvent("PLAYER_LEAVE_SEEN", { name: n }); }
        }
      } else if (name === "update_attributes" && Array.isArray(p.attributes)) {
        const h = p.attributes.find((a) => String(a.name ?? "").endsWith("health"));
        if (h) state.health = Math.round(h.value ?? h.current ?? 0);
      } else if (name === "set_time") {
        state.worldTime = p.time ?? state.worldTime;
      } else if (name === "move_player" && p.runtime_id !== undefined) {
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
    if (/auth| xbox |login/i.test(rs)) learnLesson("Server menuntut autentikasi Xbox Live — jalur offline ditolak.");
    cleanup();
  });
  client.on("error", (e) => { logEvent("NET_ERROR", { err: String(e?.message || e).slice(0, 160) }); cleanup(); });
  client.on("disconnect", (r) => { logEvent("DISCONNECT", { reason: JSON.stringify(r ?? {}).slice(0, 160) }); cleanup(); });

  const actTimer = setInterval(() => {
    if (alive.flag) { clearInterval(actTimer); return; }
    decideAndAct(client, !alive.flag);
  }, 12000);
  const idleTimer = setInterval(() => {
    if (alive.flag) { clearInterval(idleTimer); return; }
    if (moveMode !== "disabled") patrol(client);
  }, 1500);

  // denyut state tiap 10 detik selama hidup (untuk watchdog daemon)
  const hbTimer = setInterval(() => {
    if (alive.flag) { clearInterval(hbTimer); return; }
    state.lastHeartbeat = now(); saveState();
  }, 10000);

  await new Promise((resolve) => {
    const iv = setInterval(() => {
      if (alive.flag) { clearInterval(iv); clearInterval(actTimer); clearInterval(idleTimer); clearInterval(hbTimer); resolve(); }
    }, 500);
  });
  state.status = "RECONNECTING"; saveState();
  process.exit(0);
}

runOnce().catch((e) => { logEvent("JOIN_CRASH", { err: String(e?.message || e).slice(0, 180) }); process.exit(1); });
