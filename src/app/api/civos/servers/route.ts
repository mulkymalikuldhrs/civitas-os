// CIVITAS OS — servers/route.ts (SLICE 11 → v1.5 "CITADEL")
// GET  = daftar server + status ping NYATA (Bedrock RakNet / Java legacy ping)
//        + info host: alamat IP, port, URL koneksi (mandat: url server terpampang di UI)
// POST = aksi lifecycle managed server (start|stop|restart|status)

import { NextResponse, type NextRequest } from "next/server";
import { listServerStatuses, serverAction, type ServerAction } from "@/lib/civos/servers";
import { hostInfo } from "@/lib/civos/dbmap";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [servers, host] = await Promise.all([listServerStatuses(), hostInfo()]);
    return NextResponse.json({ ok: true, servers, host });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "server list gagal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { id?: string; action?: string };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ ok: false, error: "body JSON tidak valid" }, { status: 400 }); }
  if (!body.id || !body.action) return NextResponse.json({ ok: false, error: "wajib: id, action" }, { status: 400 });
  if (!["start", "stop", "restart", "status"].includes(body.action)) return NextResponse.json({ ok: false, error: "action harus start|stop|restart|status" }, { status: 400 });
  try {
    const r = await serverAction(body.id, body.action as ServerAction);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "aksi server gagal" }, { status: 500 });
  }
}
