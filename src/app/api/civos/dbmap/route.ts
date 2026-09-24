// CIVITAS OS — dbmap/route.ts (v1.5 "CITADEL" — PETA DATABASE PENUH)
// GET /api/civos/dbmap?fresh=1
//   → peta lengkap Supabase (tabel, kolom, tipe, PK, jumlah baris) + bucket storage
//     + cermin kernel SQLite + info host & port. fresh=1 → lewati cache 60 dtk.

import { NextResponse, type NextRequest } from "next/server";
import { dbMap, dbMapFresh, hostInfo } from "@/lib/civos/dbmap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  try {
    const [map, host] = await Promise.all([fresh ? dbMapFresh() : dbMap(), hostInfo()]);
    return NextResponse.json({ ok: true, map, host });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "dbmap gagal" }, { status: 500 });
  }
}
