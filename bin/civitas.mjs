#!/usr/bin/env node
// CIVITAS OS — CLI (SLICE 11 + REVIEW 16-h1)
//   civitas status | pulse | selflife | doctor | census | chat "<pesan>"
//   civitas server list | server <id> <start|stop|restart|status>
//   civitas backup [list] | sync | tool <nama> '<json>' | config [get|set] | events [n]
//   civitas javabot <status|connect|chat "pesan"|command "cmd"|disconnect>
//   civitas daemon <start|stop|restart|status|logs> | mcp | version
// Kernel: HTTP API (CIVITAS_URL, default http://127.0.0.1:3000) — REALITY WINS,
// error jaringan dilaporkan jujur, tanpa jawaban palsu.
import { spawn, execFileSync } from "node:child_process";

const BASE = process.env.CIVITAS_URL || "http://127.0.0.1:3000";
const ROOT = "/home/z/my-project";
const [, , cmd, ...rest] = process.argv;

const C = { dim: "\x1b[2m", g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", b: "\x1b[36m", x: "\x1b[0m", bold: "\x1b[1m" };
function ok(s) { console.log(`${C.g}✓${C.x} ${s}`); }
function bad(s) { console.log(`${C.r}✗${C.x} ${s}`); }
function info(s) { console.log(`${C.b}·${C.x} ${s}`); }

async function api(pathname, body) {
  try {
    const res = await fetch(BASE + pathname, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(120_000),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch {
    return { status: 0, data: { error: `kernel tidak terjangkau di ${BASE} (jalankan: bun run dev)` } };
  }
}

function out(v) { console.log(typeof v === "string" ? v : JSON.stringify(v, null, 1)); }

/** @typedef {{ id: string; edition: string; host: string; port: number; online?: boolean; latencyMs?: number | null }} ServerStatusCli */

function help() {
  console.log(`CIVITAS OS CLI — peradaban Minecraft otonom di genggaman
  ${C.bold}status${C.x}                       ringkasan peradaban + server
  ${C.bold}pulse${C.x} [organ]              satu denyut otonom
  ${C.bold}selflife${C.x}                   detak kehidupan (watchdog+backup+sync jadwal)
  ${C.bold}doctor${C.x}                     pemeriksaan kesehatan menyeluruh
  ${C.bold}census${C.x}                     sensus villager dunia nyata
  ${C.bold}chat${C.x} "<pesan>"             bicara dengan warga
  ${C.bold}server${C.x} list                daftar server + status nyata
  ${C.bold}server${C.x} <id> <aksi>         start|stop|restart|status
  ${C.bold}backup${C.x} [list]              buat / daftar arsip backup
  ${C.bold}sync${C.x}                       push ke 4 remote git
  ${C.bold}tool${C.x} <nama> [json]         jalankan tool Toolforge
  ${C.bold}config${C.x} [get k|set k v]     konfigurasi runtime
  ${C.bold}events${C.x} [n]                 event log immutable
  ${C.bold}javabot${C.x} <aksi>             status|connect|chat|command|disconnect (bot Java Paper)
  ${C.bold}daemon${C.x} start|stop|status|logs|restart
  ${C.bold}mcp${C.x}                        serve MCP stdio (untuk Claude Desktop dll)`);
}

async function main() {
  switch (cmd ?? "help") {
    case "help": case "--help": case "-h": return help();
    case "version": return out("CIVITAS OS v1.1.0 SELF-LIFE");
    case "mcp": {
      const p = spawn("node", [`${ROOT}/scripts/civitas_mcp_stdio.mjs`], { stdio: "inherit" });
      return new Promise((res) => p.on("close", res));
    }
    case "daemon": {
      const sub = rest[0] ?? "status";
      try {
        const o = execFileSync("bash", [`${ROOT}/scripts/civitas_daemon.sh`, sub, ...rest.slice(1)], { cwd: ROOT, encoding: "utf8", timeout: 20_000 });
        process.stdout.write(o);
      } catch (e) { bad(String(e.message).slice(0, 200)); process.exitCode = 1; }
      return;
    }
    case "status": {
      const { status, data } = await api("/api/civos/state").catch((e) => ({ status: 0, data: { error: e.message } }));
      if (status !== 200) return bad(`kernel tidak terjangkau di ${BASE} — ${data.error ?? status}`);
      const st = data.state ?? data;
      const m = st.metrics ?? {};
      const counts = st.counts ?? {};
      const village = st.village ?? {};
      const servers = st.servers ?? [];
      ok(`peradaban: kas ${((m.treasury ?? 0) / 100).toLocaleString("id-ID")} FLR · ${counts.orgs ?? "?"} organ · ${village.population ?? "?"} warga · ${counts.events ?? "?"} event`);
      for (const s of servers) console.log(`  ${s.online ? C.g + "●" : C.r + "○"}${C.x} ${s.id} (${s.edition}) ${s.host}:${s.port} — ${s.online ? `online ${s.latencyMs}ms` : "offline"}`);
      const lt = st.lastTick;
      info(`denyut terakhir: ${lt?.at ?? "-"} — ${lt?.summary ?? "-"}`);
      return;
    }
    case "pulse": {
      const { status, data } = await api("/api/civos/action", { action: "tick", params: { orgCode: rest[0] } });
      if (status !== 200 || !data.ok) return bad(`pulse gagal: ${JSON.stringify(data).slice(0, 200)}`);
      const t = data.summary ?? data.tick ?? data;
      return ok(`denyut #${t.tick} → ${t.target} — ${t.summary}${t.model ? ` (${t.model})` : ""}`);
    }
    case "selflife": {
      const { status, data } = await api("/api/civos/selflife", {});
      if (status !== 200) return bad(`selflife gagal: ${JSON.stringify(data).slice(0, 200)}`);
      if (data.revived?.length) for (const r of data.revived) console.log(`  ${r.revived ? C.g + "↻" : C.y + "↻"}${C.x} ${r.id}: ${r.detail}`);
      if (data.pulse) ok(`denyut: ${data.pulse.target} — ${data.pulse.summary}`);
      if (data.backupRan) { if (data.backup?.ok) ok(`backup: ${data.backup.file} (${data.backup.bytes}B)`); else bad(`backup gagal: ${data.backup?.detail}`); }
      if (data.syncRan) ok(`sync: ${data.sync?.remotes?.map((r) => `${r.name}=${r.pushed ? "ok" : "gagal"}`).join(" ") ?? "-"}`);
      if (!data.notes?.length) info("tanpa catatan — semuanya sesuai jadwal");
      else for (const n of data.notes) info(n);
      return;
    }
    case "doctor": {
      const { status, data } = await api("/api/civos/doctor").catch((e) => ({ status: 0, data: { error: e.message } }));
      if (status !== 200) return bad(`doctor gagal: ${data.error ?? status}`);
      for (const c of data.checks ?? []) console.log(`  ${c.ok ? C.g + "✓" : C.r + "✗"}${C.x} ${c.name}: ${c.detail}`);
      console.log(data.ok ? `${C.g}SEHAT${C.x}` : `${C.y}ADA MASALAH${C.x}`);
      return;
    }
    case "census": {
      const { status, data } = await api("/api/civos/action", { action: "village_census", params: {} });
      if (status !== 200 || !data.ok) return bad(`census gagal: ${JSON.stringify(data).slice(0, 200)}`);
      return out(data);
    }
    case "chat": {
      const body = rest.join(" ");
      if (!body) return bad('pakai: civitas chat "<pesan>"');
      const { status, data } = await api("/api/civos/action", { action: "chat_send", params: { body, senderName: "CLI" } });
      if (status !== 200 || !data.ok) return bad(`chat gagal: ${JSON.stringify(data).slice(0, 200)}`);
      return ok(data.reply ? `warga: "${data.reply}"` : JSON.stringify(data).slice(0, 200));
    }
    case "server": {
      if (rest[0] === "list" || !rest.length) {
        const { status, data } = await api("/api/civos/servers").catch((e) => ({ status: 0, data: { error: e.message } }));
        if (status !== 200) return bad(`server list gagal: ${data.error ?? status}`);
        for (const s of data.servers ?? []) console.log(`  ${s.online ? C.g + "●" : C.r + "○"}${C.x} ${s.id.padEnd(14)} ${s.edition.padEnd(8)} ${s.host}:${s.port} ${s.managed ? "managed" : "remote"} — ${s.online ? `${s.latencyMs}ms ${s.version ?? ""}` : s.error ?? "offline"}`);
        return;
      }
      const [id, action] = rest;
      if (!id || !action) return bad("pakai: civitas server <id> <start|stop|restart|status>");
      const { status, data } = await api("/api/civos/servers", { id, action });
      if (status !== 200) return bad(JSON.stringify(data).slice(0, 200));
      return data.ok ? ok(`${id} ${action}: ${data.detail}`) : bad(`${id} ${action}: ${data.detail}`);
    }
    case "backup": {
      if (rest[0] === "list") {
        const { data } = await api("/api/civos/backup");
        for (const b of data.backups ?? []) console.log(`  ${b.file} ${(b.bytes / 1048576).toFixed(1)}MB sha=${(b.sha256 ?? "-").slice(0, 12)}`);
        return;
      }
      const { data } = await api("/api/civos/backup", {});
      return data.ok ? ok(`backup: ${data.file} (${data.bytes}B, retensi ${data.kept}) sha=${(data.sha256 ?? "").slice(0, 12)}`) : bad(`backup gagal: ${data.detail}`);
    }
    case "sync": {
      const { data } = await api("/api/civos/git", {});
      if (data.committed) info(`commit: ${data.commit}`);
      for (const r of data.remotes ?? []) console.log(`  ${r.pushed ? C.g + "✓" : C.r + "✗"}${C.x} ${r.name}: ${r.detail}`);
      console.log(data.ok ? `${C.g}SYNC OK${C.x}` : `${C.y}SEBAGIAN/GAGAL${C.x}`);
      return;
    }
    case "tool": {
      const name = rest[0];
      if (!name) return bad("pakai: civitas tool <nama> [json-params]");
      let params = {};
      try { params = rest[1] ? JSON.parse(rest[1]) : {}; } catch { return bad("params bukan JSON valid"); }
      const { status, data } = await api("/api/civos/action", { action: "tool_run", params: { tool: name, ...params } });
      if (status !== 200 || !data.ok) return bad(`tool gagal: ${JSON.stringify(data).slice(0, 250)}`);
      return ok(JSON.stringify(data.result ?? data).slice(0, 400));
    }
    case "config": {
      const sub = rest[0] ?? "list";
      if (sub === "list") {
        const { data } = await api("/api/civos/state");
        for (const f of data.config?.fields ?? []) console.log(`  ${f.set ? C.g + "●" : C.dim + "○"}${C.x} ${f.key} = ${f.masked ? "••••••••" : f.value}`);
        return;
      }
      if (sub === "get") {
        const { data } = await api("/api/civos/action", { action: "config_get", params: { key: rest[1] } });
        return out(data.value ?? JSON.stringify(data).slice(0, 150));
      }
      if (sub === "set") {
        const { data } = await api("/api/civos/action", { action: "config_put", params: { key: rest[1], value: rest.slice(2).join(" ") } });
        return data.ok ? ok(`${rest[1]} tersimpan`) : bad(data.error ?? "gagal");
      }
      return bad("pakai: civitas config [list|get <k>|set <k> <v>]");
    }
    case "events": {
      const { data } = await api(`/api/civos/state`);
      const evs = data.events ?? [];
      for (const e of evs.slice(0, Number(rest[0] ?? 15))) console.log(`  ${C.dim}${e.seq}${C.x} ${e.type.padEnd(22)} ${e.subjectId ?? ""} — ${e.summary ?? ""}`);
      return;
    }
    // REVIEW 16-h1 → F-05/F-06 FIX: jalur kernel → dunia Java, perintah ke-17.
    case "javabot": {
      const sub = rest[0] ?? "status";
      if (sub === "status") {
        const { data } = await api("/api/civos/javabot");
        const b = data.bot ?? {};
        console.log(`  connected : ${b.connected ? C.g + "YA" + C.x : C.r + "TIDAK" + C.x}`);
        console.log(`  username  : ${b.username ?? "-"}`);
        console.log(`  server    : ${b.server ?? "-"}`);
        console.log(`  reconnect : ${JSON.stringify(b.reconnect ?? {})}`);
        for (const e of (b.lastEvents ?? []).slice(-5)) console.log(`  ${C.dim}${e.at}${C.x} ${e.type}: ${String(e.detail ?? "").slice(0, 90)}`);
        return;
      }
      const body =
        sub === "connect" ? { action: "connect" } :
        sub === "chat" ? { action: "chat", message: rest.slice(1).join(" ") } :
        sub === "command" ? { action: "command", command: rest.slice(1).join(" ") } :
        sub === "disconnect" ? { action: "disconnect" } : null;
      if (!body) return bad("pakai: civitas javabot <status|connect|chat <pesan>|command <perintah>|disconnect>");
      if ((sub === "chat" || sub === "command") && !body.message && !body.command) return bad(`isi pesan/perintah: civitas javabot ${sub} <isi>`);
      const { status, data } = await api("/api/civos/javabot", body);
      return status === 200 ? ok(data.detail ?? JSON.stringify(data).slice(0, 200)) : bad(data.error ?? data.detail ?? `HTTP ${status}`);
    }
    default:
      bad(`perintah tidak dikenal: ${cmd}`);
      help();
      process.exitCode = 1;
  }
}

main().catch((e) => { bad(e instanceof Error ? e.message : String(e)); process.exit(1); });
