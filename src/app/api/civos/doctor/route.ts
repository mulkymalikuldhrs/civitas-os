// CIVITAS OS — doctor/route.ts (SLICE 11 — PEMERIKSAAN KESEHATAN)
// GET = laporan menyeluruh: db, config, semua server, backup, git, disk, scan rahasia, LLM key

import { NextResponse } from "next/server";
import { doctor } from "@/lib/civos/selflife";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await doctor();
    return NextResponse.json({ ok: true, healthy: r.healthy, checks: r.checks, at: r.at });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "doctor gagal" }, { status: 500 });
  }
}
