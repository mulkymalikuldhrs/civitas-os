// CIVITAS OS — backup/route.ts (SLICE 11 — SELF BACKUP)
// GET  = daftar arsip backup (file, ukuran, sha256)
// POST = jalankan backup dunia+db+config sekarang (tar.gz + manifest + retensi)

import { NextResponse } from "next/server";
import { backupAll, listBackups } from "@/lib/civos/selflife";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, backups: listBackups() });
}

export async function POST() {
  const r = await backupAll();
  return NextResponse.json({ ...r }, { status: r.ok ? 200 : 500 });
}
