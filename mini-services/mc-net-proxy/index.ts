// CIVITAS OS — mc-net-proxy (mini-service, port 3010)
// Jembatan WebSocket -> TCP sesuai protokol net-browserify:
//   POST /api/vm/net/connect  {host,port} -> {token, remote:{address,family,port}}
//   WS   /api/vm/net/socket?token=...     -> pipe dua arah ke server Minecraft
// Whitelist ketat: hanya target yang diizinkan config (default Java lokal 25565).
// Ini yang membuat klien Minecraft ASLI (prismarine-web-client) di browser
// tersambung ke server Paper sungguhan.

import * as net from "node:net";
import * as crypto from "node:crypto";

const PORT = Number(process.env.MC_NET_PROXY_PORT || 3010);
const ALLOW_TARGETS: Array<{ host: string; port: number }> = [
  { host: "127.0.0.1", port: 25565 },
  { host: "localhost", port: 25565 },
];

interface Tunnel { host: string; port: number; tcp: net.Socket | null; created: number }
const tunnels = new Map<string, Tunnel>();

function allowed(host: string, port: number): boolean {
  return ALLOW_TARGETS.some((t) => t.host === host && t.port === port);
}

function cleanup(maxAgeMs = 15 * 60_000): void {
  const now = Date.now();
  for (const [tok, t] of tunnels) {
    if (!t.tcp || t.tcp.destroyed) tunnels.delete(tok);
    else if (now - t.created > maxAgeMs) { try { t.tcp.destroy(); } catch { /* ok */ } tunnels.delete(tok); }
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req, srv) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");

    if (path === "/healthz" || path === "/" ) {
      return new Response(JSON.stringify({ ok: true, service: "mc-net-proxy", tunnels: tunnels.size, targets: ALLOW_TARGETS }), { headers: { "Content-Type": "application/json" } });
    }

    if (path === "/api/vm/net/connect" && req.method === "POST") {
      try { cleanup(); } catch { /* noop */ }
      let body: { host?: string; port?: number } = {};
      try { body = (await req.json()) as typeof body; } catch { /* net-browserify selalu kirim JSON */ }
      const host = String(body.host ?? "");
      const port = Number(body.port ?? 0);
      if (!allowed(host, port)) {
        return new Response(JSON.stringify({ error: { code: "EACCES", message: `target tidak diizinkan: ${host}:${port} (whitelist: ${ALLOW_TARGETS.map((t) => `${t.host}:${t.port}`).join(", ")})` } }), { status: 403, headers: { "Content-Type": "application/json" } });
      }
      if (tunnels.size >= 8) {
        return new Response(JSON.stringify({ error: { code: "EBUSY", message: "terlalu banyak koneksi (maks 8)" } }), { status: 429, headers: { "Content-Type": "application/json" } });
      }
      const token = crypto.randomBytes(32).toString("hex");
      tunnels.set(token, { host, port, tcp: null, created: Date.now() });
      console.log(`[connect] token=${token.slice(0, 12)}… target=${host}:${port}`);
      return new Response(JSON.stringify({ token, remote: { address: host, family: "IPv4", port } }), { headers: { "Content-Type": "application/json" } });
    }

    if (path === "/api/vm/net/socket") {
      const token = url.searchParams.get("token") ?? "";
      const t = tunnels.get(token);
      if (!t) return new Response("token tidak dikenal", { status: 404 });
      const ok = srv.upgrade(req, { data: { token } });
      if (!ok) return new Response("upgrade gagal", { status: 500 });
      return undefined as unknown as Response;
    }

    return new Response("not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      const token = (ws.data as { token: string }).token;
      const t = tunnels.get(token);
      if (!t) { ws.close(); return; }
      const tcp = net.createConnection({ host: t.host, port: t.port });
      t.tcp = tcp;
      tcp.on("data", (buf: Buffer) => {
        try { ws.send(new Uint8Array(buf)); } catch { try { tcp.destroy(); } catch { /* ok */ } }
      });
      tcp.on("close", () => { try { ws.close(); } catch { /* ok */ } tunnels.delete(token); });
      tcp.on("error", (e) => {
        console.log(`[tcp error] ${t.host}:${t.port} ${e.message.slice(0, 120)}`);
        try { ws.close(); } catch { /* ok */ }
      });
      console.log(`[socket open] token=${token.slice(0, 12)}… tcp=${t.host}:${t.port}`);
    },
    message(ws, data) {
      const token = (ws.data as { token: string }).token;
      const t = tunnels.get(token);
      if (!t?.tcp || t.tcp.destroyed) return;
      const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data as Uint8Array);
      try { t.tcp.write(buf); } catch { /* tcp error event handles */ }
    },
    close(ws) {
      const token = (ws.data as { token: string }).token;
      const t = tunnels.get(token);
      if (t?.tcp) { try { t.tcp.destroy(); } catch { /* ok */ } }
      tunnels.delete(token);
      console.log(`[socket close] token=${token.slice(0, 12)}…`);
    },
  },
});

console.log(`mc-net-proxy hidup di port ${server.port} — whitelist: ${ALLOW_TARGETS.map((t) => `${t.host}:${t.port}`).join(", ")}`);
