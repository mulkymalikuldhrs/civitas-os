import { NextResponse, type NextRequest } from "next/server";
import { heartbeatTick, recentTicks } from "@/lib/civos/runtime";
import { db } from "@/lib/db";
import { KV_LAST_TICK } from "@/lib/civos/types";
import { safeParse } from "@/lib/civos/events";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const last = await db.civKV.findUnique({ where: { key: KV_LAST_TICK } });
    const ticks = await recentTicks(14);
    return NextResponse.json({ ok: true, lastTick: last ? safeParse(last.value) : null, ticks });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "gagal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { target?: string };
    const summary = await heartbeatTick(body.target);
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "denyut gagal" }, { status: 500 });
  }
}
