// CIVITAS OS — mcp.ts (SLICE 10)
// INTEGRASI MCP NYATA (Model Context Protocol): registry server di DB, klien
// JSON-RPC 2.0 (transport HTTP POST & STDIO spawn). Panggilan warga lewat tool
// `mcp_call` di Toolforge — selalu teraudit di CivToolCall. Tanpa mock.

import { spawn } from "node:child_process";
import { db } from "@/lib/db";

export interface McpRow {
  id: string;
  name: string;
  transport: string;
  endpoint: string;
  enabled: boolean;
  lastStatus: string;
  lastError: string | null;
  toolCount: number;
}

export async function listMcpServers(): Promise<McpRow[]> {
  const rows = await db.civMcpServer.findMany({ orderBy: { name: "asc" } });
  return rows.map((r) => ({ id: r.id, name: r.name, transport: r.transport, endpoint: r.endpoint, enabled: r.enabled, lastStatus: r.lastStatus, lastError: r.lastError, toolCount: r.toolCount }));
}

export async function addMcpServer(input: { name: string; transport: string; endpoint: string; envJson?: string }): Promise<{ ok: boolean; error?: string; id?: string }> {
  const name = input.name.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  if (!name) return { ok: false, error: "nama tidak valid (alfanumerik/-/_)" };
  const transport = input.transport === "STDIO" ? "STDIO" : "HTTP";
  const endpoint = input.endpoint.trim();
  if (!endpoint) return { ok: false, error: "endpoint wajib (URL atau command)" };
  const exists = await db.civMcpServer.findUnique({ where: { name } });
  if (exists) return { ok: false, error: `server "${name}" sudah terdaftar` };
  const row = await db.civMcpServer.create({ data: { name, transport, endpoint, envJson: input.envJson?.trim() || "{}" } });
  return { ok: true, id: row.id };
}

export async function removeMcpServer(name: string): Promise<{ ok: boolean; error?: string }> {
  const exists = await db.civMcpServer.findUnique({ where: { name } });
  if (!exists) return { ok: false, error: `server "${name}" tidak ditemukan` };
  await db.civMcpServer.delete({ where: { name } });
  return { ok: true };
}

// ---------- JSON-RPC 2.0 ----------

interface JsonRpcResp { jsonrpc?: string; result?: unknown; error?: { code: number; message: string } | null; id?: number }

async function httpRpc(creds: { endpoint: string }, method: string, params: unknown): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    const res = await fetch(creds.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now() % 1_000_000, method, params: params ?? {} }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    // Beberapa server MCP HTTP membalas SSE ("data: {...}") — parse defensif.
    const line = text.split("\n").reverse().find((l) => l.startsWith("data:")) ?? text;
    const json = JSON.parse(line.replace(/^data:\s?/, "")) as JsonRpcResp;
    if (json.error) return { ok: false, error: json.error.message };
    return { ok: true, result: json.result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 140) : "http gagal" };
  }
}

function stdioRpc(endpoint: string, envJson: string, method: string, params: unknown): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  return new Promise((resolve) => {
    let bin = "sh", args = ["-c", endpoint];
    if (!endpoint.includes(" ")) { bin = endpoint; args = []; } // endpoint = executable tunggal
    const env = { ...process.env } as NodeJS.ProcessEnv;
    try { Object.assign(env, JSON.parse(envJson || "{}") as Record<string, string>); } catch { /* env JSON rusak → pakai env proses */ }
    const child = spawn(bin, args, { env, stdio: ["pipe", "pipe", "pipe"] as const });
    let out = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolve({ ok: false, error: "stdio timeout 12s" }); }, 12_000);
    child.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    child.stderr.on("data", () => { /* stderr dibiarkan — tak boleh membunuh sesi */ });
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, error: `spawn gagal: ${e.message.slice(0, 120)}` }); });
    child.on("exit", () => {
      clearTimeout(timer);
      try {
        const lines = out.split("\n").filter((l) => l.trim().startsWith("{"));
        const json = JSON.parse(lines[lines.length - 1] ?? out) as JsonRpcResp;
        if (json.error) resolve({ ok: false, error: json.error.message });
        else resolve({ ok: true, result: json.result });
      } catch {
        resolve({ ok: false, error: `output bukan JSON-RPC: ${out.slice(0, 90)}` });
      }
    });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? {} }) + "\n");
    setTimeout(() => { child.stdin.end(); }, 2000);
  });
}

export async function mcpRpc(name: string, method: string, params: unknown): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const row = await db.civMcpServer.findUnique({ where: { name } });
  if (!row) return { ok: false, error: `server MCP "${name}" tidak terdaftar` };
  if (!row.enabled) return { ok: false, error: `server MCP "${name}" dinonaktifkan` };
  const r = row.transport === "STDIO"
    ? await stdioRpc(row.endpoint, row.envJson, method, params)
    : await httpRpc({ endpoint: row.endpoint }, method, params);
  await db.civMcpServer.update({
    where: { name },
    data: r.ok
      ? { lastStatus: "OK", lastError: null }
      : { lastStatus: "FAILED", lastError: (r.error ?? "?").slice(0, 200) },
  });
  return r;
}

/** tools/list — sekaligus menyimpan jumlah tool (status kesehatan). */
export async function mcpProbe(name: string): Promise<{ ok: boolean; tools?: { name: string; desc?: string }[]; error?: string }> {
  const r = await mcpRpc(name, "tools/list", {});
  if (!r.ok) return { ok: false, error: r.error };
  const result = (r.result ?? {}) as { tools?: { name?: string; description?: string }[] };
  const tools = (result.tools ?? []).map((t) => ({ name: String(t.name ?? "?"), desc: String(t.description ?? "").slice(0, 80) }));
  const row = await db.civMcpServer.findUnique({ where: { name } });
  if (row) await db.civMcpServer.update({ where: { name }, data: { toolCount: tools.length } });
  return { ok: true, tools };
}

/** tools/call — dipanggil Toolforge atas nama warga (audit di CivToolCall). */
export async function mcpCall(name: string, tool: string, args: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  return mcpRpc(name, "tools/call", { name: tool, arguments: args });
}
