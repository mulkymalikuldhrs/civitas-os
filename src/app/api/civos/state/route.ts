// CIVITAS OS — state/route.ts (v1.5 "CITADEL")
// Sajikan state peradaban. Serverless (Vercel): cache CivKV "state.cache" yang ditulis
// daemon tiap detak → instan; bila cache kosong → hitung lalu simpan. Sandbox: hitung
// langsung (SQLite lokal, cepat) dan tulis cache untuk jendela awan.

import { NextResponse } from "next/server";
import { civState, readStateCache, writeStateCache } from "@/lib/civos/state";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    // 1) coba cache dulu (instan — realtime via penulisan daemon tiap 30 dtk)
    const cached = await readStateCache();
    if (cached && Object.keys(cached).length > 10) {
      return NextResponse.json({ ok: true, state: cached, cached: true });
    }
    // 2) cache belum ada → hitung + simpan
    const state = await civState();
    await writeStateCache().catch(() => undefined);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "gagal agregasi" }, { status: 500 });
  }
}
