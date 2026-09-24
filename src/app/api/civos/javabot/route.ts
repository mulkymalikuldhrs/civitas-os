// CIVITAS OS — javabot/route.ts (REVIEW 16-h1 → F-05 FIX)
// Jalur kernel → konsol Java (Paper) yang selama ini ORPHAN: bot mineflayer
// CIVITAS_AGENT join dunia Java sungguhan + perintah konsol via FIFO console.in.
// Semua hasil jujur: sukses/gagal dari event bot nyata & exit FIFO.

import { NextResponse, type NextRequest } from "next/server";
import {
  javaBotStatus,
  javaBotConnect,
  javaBotChat,
  javaBotCommand,
  javaBotDisconnect,
} from "@/lib/civos/javabot";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, bot: javaBotStatus() });
}

interface Body {
  action?: string;
  message?: string;
  command?: string;
  username?: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "body JSON tidak valid" }, { status: 400 });
  }
  try {
    switch (body.action) {
      case "connect": {
        const r = await javaBotConnect({ username: body.username });
        return NextResponse.json({ ...r, bot: javaBotStatus() }, { status: r.ok ? 200 : 502 });
      }
      case "chat": {
        const msg = (body.message ?? "").trim();
        if (!msg) return NextResponse.json({ ok: false, error: "message wajib" }, { status: 400 });
        const r = await javaBotChat(msg);
        return NextResponse.json({ ...r, bot: javaBotStatus() }, { status: r.ok ? 200 : 502 });
      }
      case "command": {
        const cmd = (body.command ?? "").trim();
        if (!cmd) return NextResponse.json({ ok: false, error: "command wajib" }, { status: 400 });
        const r = await javaBotCommand(cmd);
        return NextResponse.json(r, { status: r.ok ? 200 : 502 });
      }
      case "disconnect": {
        const r = await javaBotDisconnect();
        return NextResponse.json({ ...r, bot: javaBotStatus() });
      }
      default:
        return NextResponse.json({ ok: false, error: `aksi tidak dikenal: ${body.action ?? "-"} (pilihan: connect|chat|command|disconnect)` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "javabot gagal" }, { status: 500 });
  }
}
