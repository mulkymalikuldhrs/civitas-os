// CIVITAS OS — api/civos/mcp/route.ts (REVIEW 16-h1 → F-02 FIX)
// MCP SERVER CIVITAS di atas HTTP (JSON-RPC 2.0): initialize / tools/list /
// tools/call / ping. Dulu satu-satunya /api/mcp milik FLYBRAIN (9 tools) — kini
// peradaban punya endpoint MCP-nya sendiri, eksekusi langsung ke kernel (in-process,
// tanpa self-fetch). 14 tool nyata, tanpa mock.
//
// Pemakaian: POST JSON-RPC ke /api/civos/mcp
//   {"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
//   {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
//   {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"civitas_status","arguments":{}}}

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ---------- tool registry (identik dengan stdio — sumber kebenaran ganda disengaja: stdio tetap hidup saat app mati) ----------

const TOOLS = [
  { name: "civitas_status", description: "Ringkasan peradaban: KPI, kas, warga, server Minecraft, status dunia.", inputSchema: { type: "object", properties: {} } },
  { name: "civitas_pulse", description: "Jalankan SATU denyut otonom (organ round-robin + desa).", inputSchema: { type: "object", properties: { target: { type: "string", description: "kode organ opsional, mis. COMP-001" } } } },
  { name: "civitas_selflife", description: "Detak kehidupan: watchdog server + denyut + backup/sync sesuai jadwal.", inputSchema: { type: "object", properties: {} } },
  { name: "civitas_backup", description: "Buat backup dunia+db+config (tar.gz ber-manifest) atau daftar arsip (list=true).", inputSchema: { type: "object", properties: { list: { type: "boolean" } } } },
  { name: "civitas_sync", description: "Self-sync: commit + push ke 4 remote git (GitHub x3 + GitLab).", inputSchema: { type: "object", properties: {} } },
  { name: "civitas_doctor", description: "Pemeriksaan kesehatan menyeluruh (db, server, backup, git, disk, rahasia).", inputSchema: { type: "object", properties: {} } },
  { name: "civitas_server_list", description: "Daftar semua server Minecraft (Bedrock/Java/remote) + status nyata.", inputSchema: { type: "object", properties: {} } },
  { name: "civitas_server_action", description: "Aksi server managed: start|stop|restart|status untuk id server.", inputSchema: { type: "object", properties: { id: { type: "string" }, action: { type: "string", enum: ["start", "stop", "restart", "status"] } }, required: ["id", "action"] } },
  { name: "civitas_javabot", description: "Bot Java (mineflayer): status | connect | chat | command (konsol Paper via FIFO) | disconnect.", inputSchema: { type: "object", properties: { action: { type: "string", enum: ["status", "connect", "chat", "command", "disconnect"] }, message: { type: "string" }, command: { type: "string" } } } },
  { name: "civitas_census", description: "Sensus desa: ikat entitas villager nyata di dunia ke warga kernel.", inputSchema: { type: "object", properties: { count: { type: "number" } } } },
  { name: "civitas_chat", description: "Bicara dengan warga (LLM) — persona + memori; balasan jujur dari otak warga.", inputSchema: { type: "object", properties: { body: { type: "string" }, senderName: { type: "string" } }, required: ["body"] } },
  { name: "civitas_tool_run", description: "Jalankan tool Toolforge (web_search/page_reader/code_write/build_plan/mine_route/patrol_report).", inputSchema: { type: "object", properties: { tool: { type: "string" }, params: { type: "object" } }, required: ["tool"] } },
  { name: "civitas_config_get", description: "Baca satu field konfigurasi (SECRET dimask).", inputSchema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] } },
  { name: "civitas_config_set", description: "Tulis field konfigurasi (env/api/base-url/token/MCP — semua via sini).", inputSchema: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] } },
] as const;

// ---------- eksekusi in-process (kernel langsung) ----------

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const a = args ?? {};
  switch (name) {
    case "civitas_status": {
      const { computeMetrics } = await import("@/lib/civos/economy");
      const { cachedServerStatuses } = await import("@/lib/civos/servers");
      const { javaBotStatus } = await import("@/lib/civos/javabot");
      const [metrics, villagers, servers] = await Promise.all([
        computeMetrics(),
        db.civVillager.count({ where: { status: "ACTIVE" } }),
        cachedServerStatuses(),
      ]);
      return { ok: true, metrics, villagers, servers, javabot: javaBotStatus().connected ? "CONNECTED" : "OFF" };
    }
    case "civitas_pulse": {
      const { heartbeatTick } = await import("@/lib/civos/runtime");
      return { ok: true, summary: await heartbeatTick(typeof a.target === "string" && a.target ? a.target : undefined) };
    }
    case "civitas_selflife": {
      const { selfLifeTick } = await import("@/lib/civos/selflife");
      return { ok: true, ...(await selfLifeTick()) };
    }
    case "civitas_backup": {
      const { backupAll, listBackups } = await import("@/lib/civos/selflife");
      if (a.list === true) return { ok: true, backups: listBackups() };
      const r = await backupAll();
      return { ...r, ok: r.ok };
    }
    case "civitas_sync": {
      const { gitSync } = await import("@/lib/civos/selflife");
      const r = await gitSync();
      return { ...r, ok: r.ok };
    }
    case "civitas_doctor": {
      const { doctor } = await import("@/lib/civos/selflife");
      const r = await doctor();
      return { ok: r.healthy, ...r };
    }
    case "civitas_server_list": {
      const { listServerStatuses } = await import("@/lib/civos/servers");
      return { ok: true, servers: await listServerStatuses() };
    }
    case "civitas_server_action": {
      const { serverAction } = await import("@/lib/civos/servers");
      const id = String(a.id ?? "").trim();
      const action = String(a.action ?? "status");
      if (!id) throw new Error("arguments.id wajib");
      if (!["start", "stop", "restart", "status"].includes(action)) throw new Error("action = start|stop|restart|status");
      return serverAction(id, action as "start" | "stop" | "restart" | "status");
    }
    case "civitas_javabot": {
      const jb = await import("@/lib/civos/javabot");
      const action = String(a.action ?? "status");
      if (action === "connect") return { ...(await jb.javaBotConnect()), bot: jb.javaBotStatus() };
      if (action === "chat") return { ...(await jb.javaBotChat(String(a.message ?? ""))), bot: jb.javaBotStatus() };
      if (action === "command") return jb.javaBotCommand(String(a.command ?? ""));
      if (action === "disconnect") return { ...(await jb.javaBotDisconnect()), bot: jb.javaBotStatus() };
      return { ok: true, bot: jb.javaBotStatus() };
    }
    case "civitas_census": {
      const { createCensus } = await import("@/lib/civos/villagers");
      const count = Math.max(1, Math.min(12, Math.trunc(Number(a.count ?? 8))));
      const r = await createCensus(count, "SIMULASI");
      return { ...r, ok: r.created.length > 0 || r.retired > 0 };
    }
    case "civitas_chat": {
      const body = String(a.body ?? "").trim();
      if (!body) throw new Error("arguments.body wajib");
      const { askCitizen } = await import("@/lib/civos/chat");
      const v = await db.civVillager.findFirst({ where: { status: "ACTIVE" }, orderBy: { code: "asc" }, select: { code: true } });
      if (!v) throw new Error("belum ada warga aktif — jalankan sensus dulu");
      const r = await askCitizen({ villagerCode: v.code, body, channel: "DASHBOARD", senderName: String(a.senderName ?? "Klien MCP") });
      return { ...r, ok: r.ok };
    }
    case "civitas_tool_run": {
      const tool = String(a.tool ?? "").trim();
      if (!tool) throw new Error("arguments.tool wajib");
      const { invokeTool } = await import("@/lib/civos/tools");
      const { DIVISIONS, divisionMeta } = await import("@/lib/civos/types");
      const eligible = DIVISIONS.filter((d) => divisionMeta(d).tools.includes(tool));
      const villager = await db.civVillager.findFirst({
        where: { status: "ACTIVE", division: { in: eligible } },
        orderBy: { updatedAt: "asc" },
        select: { id: true, code: true, name: true, division: true, mcCoords: true, workOrgId: true },
      });
      if (!villager) throw new Error(`tidak ada warga aktif dengan charter ${tool} — jalankan sensus dulu`);
      const input = (a.params ?? {}) as Record<string, unknown>;
      if (tool === "mine_route" && !input.sellerOrgId) input.sellerOrgId = villager.workOrgId;
      const r = await invokeTool({ type: "VILLAGER", id: villager.id, code: villager.code, name: villager.name, division: villager.division, mcCoords: villager.mcCoords }, tool, input);
      return { ...r, ok: r.ok, oleh: `${villager.name} (${villager.code})` };
    }
    case "civitas_config_get": {
      const key = String(a.key ?? "").trim();
      if (!key) throw new Error("arguments.key wajib");
      const { configView } = await import("@/lib/civos/config");
      const cfg = await configView();
      const f = cfg.fields.find((x) => x.key === key);
      if (!f) throw new Error(`field tidak dikenal: ${key}`);
      return { ok: true, key: f.key, value: f.value, masked: f.masked, set: f.set };
    }
    case "civitas_config_set": {
      const key = String(a.key ?? "").trim();
      if (!key) throw new Error("arguments.key wajib");
      const { setConfigValue } = await import("@/lib/civos/config");
      return setConfigValue(key, String(a.value ?? ""));
    }
    default:
      throw new Error(`tool tidak dikenal: ${name}`);
  }
}

// ---------- JSON-RPC 2.0 ----------

export async function POST(req: NextRequest) {
  let msg: { id?: number | string | null; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
  try {
    msg = (await req.json()) as typeof msg;
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error — body bukan JSON" } }, { status: 400 });
  }
  const id = msg.id ?? null;
  const reply = (result: unknown) => NextResponse.json({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });

  try {
    switch (msg.method) {
      case "initialize":
        return reply({
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "civitas-os", version: "1.2.0", title: "CIVITAS OS — Autonomous Minecraft Civilization" },
        });
      case "notifications/initialized":
        return new Response(null, { status: 202 });
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: TOOLS });
      case "tools/call": {
        const toolName = String(msg.params?.name ?? "");
        if (!TOOLS.some((t) => t.name === toolName)) return fail(-32602, `tool tidak dikenal: ${toolName || "-"}`);
        try {
          const result = await callTool(toolName, msg.params?.arguments ?? {});
          return reply({ content: [{ type: "json", json: result }], structuredContent: result, isError: false });
        } catch (e) {
          const detail = e instanceof Error ? e.message.slice(0, 200) : "tool gagal";
          return reply({ content: [{ type: "text", text: `GAGAL: ${detail}` }], isError: true, error: detail });
        }
      }
      default:
        return fail(-32601, `method tidak dikenal: ${msg.method ?? "-"}`);
    }
  } catch (e) {
    return fail(-32603, e instanceof Error ? e.message.slice(0, 200) : "internal error");
  }
}

export async function GET() {
  // Penjelajah ramah: daftar tool tanpa klien MCP.
  return NextResponse.json({ server: "civitas-os", version: "1.2.0", protocol: "JSON-RPC 2.0 (POST)", tools: TOOLS.map((t) => t.name), note: "POST initialize/tools/list/tools/call — MCP CIVITAS nyata, tanpa mock." });
}
