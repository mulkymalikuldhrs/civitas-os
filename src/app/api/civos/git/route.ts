// CIVITAS OS — git/route.ts (SLICE 11 — SELF SYNC)
// GET  = status sinkron terakhir (KV selflife.lastSync)
// POST = add/commit/push ke 4 remote (token transient dari /home/z/.gitcreds)

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gitSync } from "@/lib/civos/selflife";

export const dynamic = "force-dynamic";

export async function GET() {
  const row = await db.civKV.findUnique({ where: { key: "selflife.lastSync" } });
  return NextResponse.json({ ok: true, lastSync: row ? JSON.parse(row.value) : null });
}

export async function POST() {
  const r = await gitSync();
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
