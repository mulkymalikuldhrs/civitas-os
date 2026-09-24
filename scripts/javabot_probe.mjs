#!/usr/bin/env node
// CIVITAS OS — probe nyata javabot (Task 16-d). BUKAN simulasi — semua langkah menyentuh
// server Paper 127.0.0.1:25565 yang benar-benar berjalan.
// Jalankan:  timeout 90 node scripts/javabot_probe.mjs
// Langkah:   status → connect (spawn nyata) → chat → perintah konsol via FIFO → amati event → disconnect.
// Bukti silang: mc-server/java/logs/latest.log harus memuat baris join + chat bot.

const jb = await import("../src/lib/civos/javabot.ts");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (n, t) => console.log(`\n=== [${n}] ${t} ===`);
const show = (label, v) => console.log(`${label}: ${JSON.stringify(v, null, 2)}`);

step(1, "javaBotStatus() SEBELUM connect");
const s0 = jb.javaBotStatus();
show("status", { configured: s0.configured, connected: s0.connected, username: s0.username, server: s0.server, fifo: s0.fifo, reconnect: s0.reconnect });

step(2, "javaBotConnect() — masuk dunia Paper 127.0.0.1:25565 (offline mode)");
const conn = await jb.javaBotConnect({ timeoutMs: 45_000 });
show("connect", conn);
if (!conn.ok) {
  show("lastEvents", jb.javaBotStatus().lastEvents);
  console.error("\nPROBE GAGAL pada tahap connect — jujur, tanpa sukses palsu.");
  process.exit(1);
}

step(3, "menunggu 3 dtk — chunk & event awal mengalir");
await sleep(3000);

step(4, "javaBotChat('CIVITAS_AGENT hadir di Java realm')");
const chat = await jb.javaBotChat("CIVITAS_AGENT hadir di Java realm");
show("chat", chat);

step(5, "javaBotCommand('list') — perintah konsol nyata via FIFO stdin Paper");
const cmd = await jb.javaBotCommand("list");
show("command", cmd);

step(6, "menunggu 6 dtk — mengamati event dunia (ring buffer)");
await sleep(6000);

step(7, "javaBotStatus() SESUDAH aksi — event nyata yang teramati");
const s1 = jb.javaBotStatus();
show("status", { connected: s1.connected, since: s1.since, reconnect: s1.reconnect });
show("lastEvents", s1.lastEvents);

step(8, "javaBotDisconnect() — quit bersih");
const disc = await jb.javaBotDisconnect();
show("disconnect", disc);

// Tunggu event "end" maksimal 5 dtk supaya proses benar-benar menutup soket.
let s2 = jb.javaBotStatus();
for (let i = 0; i < 10 && s2.connected; i++) {
  await sleep(500);
  s2 = jb.javaBotStatus();
}
show("status akhir", { connected: s2.connected, lastEvents: s2.lastEvents.slice(-3) });
console.log("\nPROBE SELESAI — verifikasi silang: grep -E 'CIVITAS_AGENT|hadir|joined|There are' mc-server/java/logs/latest.log | tail");
process.exit(s2.connected ? 2 : 0);
