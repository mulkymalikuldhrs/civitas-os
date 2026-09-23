// CIVITAS OS — cron/route.ts
// SLICE 8: BEACON DENYUT 24/7 — dipanggil Vercel Cron (vercel.json) atau pinger
// eksternal (cron-job.org dll). Kernel BERSIFAT STATEFUL (ADR-0001 — berbeda dari
// biosfer FlyBrain yang stateless), jadi denyut penuh AMAN dijalankan di sini:
// seed → denyut institusi → denyut desa → mirror → bot → TTL direktif.
// Guard: bila CRON_SECRET diset, header Authorization: Bearer wajib cocok
// (Vercel Cron mengirim otomatis; pinger eksternal perlu menyetel header sama).

import { NextResponse, type NextRequest } from "next/server";
import { heartbeatTick } from "@/lib/civos/runtime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized — CRON_SECRET tidak cocok" }, { status: 401 });
    }
  }
  const t0 = Date.now();
  try {
    const summary = await heartbeatTick();
    return NextResponse.json({
      ok: true,
      sumber: "cron-beacon",
      tick: summary.tick,
      target: summary.target,
      ringkasan: summary.summary,
      desa: summary.village ?? null,
      durasiMs: Date.now() - t0,
      at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "denyut cron gagal" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req); // pinger eksternal kadang POST — jalur sama, guard sama
}
