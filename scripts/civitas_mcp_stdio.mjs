#!/usr/bin/env node
// CIVITAS OS — civitas_mcp_stdio.mjs (SLICE 11: CIVITAS sebagai MCP SERVER)
// Protokol MCP (JSON-RPC 2.0) di atas stdio — siap dipakai Claude Desktop / klien MCP lain:
//   { "mcpServers": { "civitas": { "command": "node", "args": ["scripts/civitas_mcp_stdio.mjs"] } } }
// Strategi eksekusi dua lapis (REALITY WINS):
//   1) HTTP ke kernel Next.js (cepat, fitur penuh);
//   2) fallback `bun` subprocess ke modul kernel (state/doctor/backup/sync) bila app mati —
//      alat tetap hidup meski UI tumbang; kegagalan dilaporkan jujur per-alat.
import { spawn } from "node:child_process";

const BASE = process.env.CIVITAS_URL || "http://127.0.0.1:3000";
const ROOT = "/home/z/my-project";

// ---------- tool registry ----------

const TOOLS = [
  { name: "civitas_status", description: "Ringkasan peradaban: KPI, kas, warga, server Minecraft, status dunia.", inputSchema: { type: "object", properties: {} } },
  { name: "civitas_pulse", description: "Jalankan SATU denyut otonom (organ round-robin + desa).", inputSchema: { type: "object", properties: { target: { type: "string", description: "kode organ opsional, mis. COMP-001" } } } },
  { name: "civitas_selflife", description: "Detak kehidupan: watchdog server + denyut + backup/sync sesuai jadwal.", inputSchema: { type: "object", properties: {} } },
  { name: "civitas_backup", description: "Buat backup dunia+db+config (tar.gz ber-manifest) atau daftar arsip (list=true).", inputSchema: { type: "object", properties: { list: { type: "boolean" } } } },
  { name: "civitas_sync", description: "Self-sync: commit + push ke 4 remote git (GitHub x3 + GitLab).", inputSchema: { type: "object", properties: {} } },
  { name: "civitas_doctor", description: "Pemeriksaan kesehatan menyeluruh (db, server, backup, git, disk, rahasia).", inputSchema: { type: "object", properties: {} } },
  { name: "civitas_server_list", description: "Daftar semua server Minecraft (Bedrock/Java/remote) + status nyata.", inputSchema: { type: "object", properties: {} } },
  { name: "civitas_server_action", description: "Aksi server managed: start|stop|restart|status untuk id server.", inputSchema: { type: "object", properties: { id: { type: "string" }, action: { type: "string", enum: ["start", "stop", "restart", "status"] } }, required: ["id", "action"] } },
  { name: "civitas_census", description: "Sensus desa: ikat entitas villager nyata di dunia ke warga kernel.", inputSchema: { type: "object", properties: {} } },
  { name: "civitas_chat", description: "Bicara dengan warga (LLM) — persona + memori; balasan jujur dari otak warga.", inputSchema: { type: "object", properties: { body: { type: "string" }, senderName: { type: "string" } }, required: ["body"] } },
  { name: "civitas_tool_run", description: "Jalankan tool Toolforge (web_search/page_reader/code_write/build_plan/mine_route/patrol_report).", inputSchema: { type: "object", properties: { tool: { type: "string" }, params: { type: "object" } }, required: ["tool"] } },
  { name: "civitas_config_get", description: "Baca satu field konfigurasi (SECRET dimask).", inputSchema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] } },
  { name: "civitas_config_set", description: "Tulis field konfigurasi (env/api/base-url/token/MCP — semua via sini).", inputSchema: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] } },
];

// ---------- eksekusi ----------

async function httpApi(pathname, body) {
  try {
    const res = await fetch(BASE + pathname, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000), // pendek — kernel mati/proxy hang → fallback bun
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { status: 0, data: { error: "kernel tidak terjangkau" } }; // pemicu fallback
  }
}

function bunKernel(scriptBody, timeoutMs = 120_000) {
  // fallback: jalankan ekspresi TS kernel via bun (app mati pun alat tetap hidup)
  return new Promise((resolve) => {
    const p = spawn("bun", ["-e", scriptBody], { cwd: ROOT, timeout: timeoutMs });
    let out = "", err = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (err += c));
    p.on("error", (e) => resolve({ ok: false, error: "bun gagal: " + e.message }));
    p.on("close", (code) => {
      try { resolve({ ok: code === 0, data: JSON.parse(out.trim().split("\n").pop() || "null"), err: err.slice(-300) }); }
      catch { resolve({ ok: false, error: `bun exit ${code}: ${(err || out).slice(-200)}` }); }
    });
  });
}

async function callTool(name, args) {
  const a = args ?? {};
  switch (name) {
    case "civitas_status": {
      const r = await httpApi("/api/civos/state");
      if (r.status === 200 && r.data?.ok !== false) return r.data;
      const b = await bunKernel(`import {computeMetrics} from "./src/lib/civos/economy"; import {db} from "./src/lib/db"; const m=await computeMetrics(); const v=await db.civVillager.count(); console.log(JSON.stringify({fallback:"bun", metrics:m, villagers:v}))`);
      return b.ok ? b.data : { error: b.error ?? "kernel tidak terjangkau" };
    }
    case "civitas_pulse": {
      const r = await httpApi("/api/civos/action", { action: "tick", params: { orgCode: a.target } });
      if (r.status === 200) return r.data;
      const b = await bunKernel(`import {heartbeatTick} from "./src/lib/civos/runtime"; console.log(JSON.stringify(await heartbeatTick(${a.target ? JSON.stringify(a.target) : ""} || undefined)))`);
      return b.ok ? b.data : { error: b.error ?? "pulse gagal" };
    }
    case "civitas_selflife": {
      const r = await httpApi("/api/civos/selflife", {});
      if (r.status === 200) return r.data;
      const b = await bunKernel(`import {selfLifeTick} from "./src/lib/civos/selflife"; console.log(JSON.stringify(await selfLifeTick()))`);
      return b.ok ? b.data : { error: b.error ?? "selflife gagal" };
    }
    case "civitas_backup": {
      if (a.list) {
        const r = await httpApi("/api/civos/backup");
        if (r.status === 200) return r.data;
        const b = await bunKernel(`import {listBackups} from "./src/lib/civos/selflife"; console.log(JSON.stringify({backups: listBackups()}))`);
        return b.ok ? b.data : { error: b.error };
      }
      const r = await httpApi("/api/civos/backup", {});
      if (r.status === 200) return r.data;
      const b = await bunKernel(`import {backupAll} from "./src/lib/civos/selflife"; console.log(JSON.stringify(await backupAll()))`);
      return b.ok ? b.data : { error: b.error ?? "backup gagal" };
    }
    case "civitas_sync": {
      const r = await httpApi("/api/civos/git", {});
      if (r.status === 200) return r.data;
      const b = await bunKernel(`import {gitSync} from "./src/lib/civos/selflife"; console.log(JSON.stringify(await gitSync()))`);
      return b.ok ? b.data : { error: b.error ?? "sync gagal" };
    }
    case "civitas_doctor": {
      const r = await httpApi("/api/civos/doctor");
      if (r.status === 200) return r.data;
      const b = await bunKernel(`import {doctor} from "./src/lib/civos/selflife"; console.log(JSON.stringify(await doctor()))`);
      return b.ok ? b.data : { error: b.error ?? "doctor gagal" };
    }
    case "civitas_server_list": {
      const r = await httpApi("/api/civos/servers");
      if (r.status === 200) return r.data;
      const b = await bunKernel(`import {listServerStatuses} from "./src/lib/civos/servers"; console.log(JSON.stringify({servers: await listServerStatuses()}))`);
      return b.ok ? b.data : { error: b.error ?? "server list gagal" };
    }
    case "civitas_server_action": {
      const r = await httpApi("/api/civos/servers", { id: a.id, action: a.action });
      if (r.status === 200 || r.status === 400) return { status: r.status, result: r.data };
      return { status: 0, result: { error: "kernel tidak terjangkau — aksi server butuh web app (atau jalankan scripts/civitas_daemon.sh)" } };
    }
    case "civitas_census": {
      const r = await httpApi("/api/civos/action", { action: "village_census", params: {} });
      if (r.status === 200) return { status: r.status, result: r.data };
      return { status: 0, result: { error: "kernel tidak terjangkau — census butuh web app/bot" } };
    }
    case "civitas_chat": {
      const r = await httpApi("/api/civos/action", { action: "chat_send", params: { body: a.body, senderName: a.senderName ?? "MCP" } });
      if (r.status === 200 || r.status === 422) return { status: r.status, result: r.data };
      return { status: 0, result: { error: "kernel tidak terjangkau — chat butuh web app" } };
    }
    case "civitas_tool_run": {
      const r = await httpApi("/api/civos/action", { action: "tool_run", params: { tool: a.tool, ...(a.params ?? {}) } });
      if (r.status === 200 || r.status === 422) return { status: r.status, result: r.data };
      return { status: 0, result: { error: "kernel tidak terjangkau — tool butuh web app" } };
    }
    case "civitas_config_get": {
      const r = await httpApi("/api/civos/action", { action: "config_get", params: { key: a.key } });
      if (r.status === 200 || r.status === 404) return { status: r.status, result: r.data };
      return { status: 0, result: { error: "kernel tidak terjangkau — config butuh web app" } };
    }
    case "civitas_config_set": {
      const r = await httpApi("/api/civos/action", { action: "config_put", params: { key: a.key, value: String(a.value ?? "") } });
      if (r.status === 200 || r.status === 422) return { status: r.status, result: r.data };
      return { status: 0, result: { error: "kernel tidak terjangkau — config butuh web app" } };
    }
    default:
      return { error: `tool tidak dikenal: ${name}` };
  }
}

// ---------- JSON-RPC stdio loop ----------

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

let buffer = "";
let pending = 0;
let stdinEnded = false;
function maybeExit() { if (stdinEnded && pending === 0) process.exit(0); }
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line) { pending += 1; handle(line).catch((e) => send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error: " + e.message } })).finally(() => { pending -= 1; maybeExit(); }); }
  }
});
process.stdin.on("end", () => { stdinEnded = true; maybeExit(); });

async function handle(line) {
  let msg;
  try { msg = JSON.parse(line); } catch { return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON tidak valid" } }); }
  const { id, method, params } = msg;
  if (method === "initialize") {
    return send({ jsonrpc: "2.0", id, result: { protocolVersion: params?.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "civitas-os", version: "1.1.0" } } });
  }
  if (method === "notifications/initialized" || (method ?? "").startsWith("notifications/")) return; // notification: tanpa balasan
  if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} });
  if (method === "tools/list") return send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  if (method === "tools/call") {
    const name = params?.name;
    try {
      const r = await callTool(name, params?.arguments);
      return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(r, null, 1).slice(0, 60_000) }], isError: Boolean(r?.error) } });
    } catch (e) {
      return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "TOOL ERROR: " + (e instanceof Error ? e.message : "?") }], isError: true } });
    }
  }
  return send({ jsonrpc: "2.0", id, error: { code: -32601, message: `method tidak dikenal: ${method}` } });
}

process.stderr.write(`civitas-os MCP stdio ready — ${TOOLS.length} tools (kernel: ${BASE})\n`);
