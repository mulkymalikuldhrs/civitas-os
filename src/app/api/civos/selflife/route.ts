// CIVITAS OS — selflife/route.ts (SLICE 11 — SELF LIFE)
// GET  = status kehidupan (detak terakhir, backup terakhir, sync terakhir)
// POST = satu detak sekarang: watchdog server + denyut + backup/sync sesuai jadwal

import { NextResponse } from "next/server";
import { selfLifeTick, selfLifeStatus } from "@/lib/civos/selflife";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await selfLifeStatus()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "status gagal" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const r = await selfLifeTick();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "detak kehidupan gagal" }, { status: 500 });
  }
}
