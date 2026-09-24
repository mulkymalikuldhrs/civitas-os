// CIVITAS OS — backup/route.ts (SLICE 11 → v1.5 "CITADEL")
// GET  = daftar arsip backup lokal + awan (Supabase Storage)
// POST = aksi: backup | restore | cloud_upload | cloud_restore
//        body JSON: { action, file?, scope? ("worlds"|"full", default full) }

import { NextResponse, type NextRequest } from "next/server";
import { backupAll, listBackups, restoreBackup, restoreFromCloud, backupToCloud, cloudBackupList, type RestoreScope } from "@/lib/civos/selflife";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  try {
    const local = listBackups();
    const cloud = await cloudBackupList().catch((e) => ({ ok: false, items: [], detail: String(e).slice(0, 120) }));
    return NextResponse.json({ ok: true, backups: local, cloud: { ok: cloud.ok, items: cloud.items, detail: cloud.detail } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "list backup gagal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { action?: string; file?: string; scope?: string } = {};
  try { body = (await req.json()) as typeof body; } catch { /* default action */ }
  const action = body.action ?? "backup";
  const scope: RestoreScope = body.scope === "worlds" ? "worlds" : "full";
  try {
    switch (action) {
      case "backup": {
        const r = await backupAll();
        return NextResponse.json(r, { status: r.ok ? 200 : 500 });
      }
      case "cloud_upload": {
        const r = await backupToCloud(body.file);
        return NextResponse.json(r, { status: r.ok ? 200 : 500 });
      }
      case "restore": {
        if (!body.file) return NextResponse.json({ ok: false, error: "wajib: file" }, { status: 400 });
        const r = await restoreBackup(body.file, scope);
        return NextResponse.json(r, { status: r.ok ? 200 : 500 });
      }
      case "cloud_restore": {
        if (!body.file) return NextResponse.json({ ok: false, error: "wajib: file" }, { status: 400 });
        const r = await restoreFromCloud(body.file, scope);
        return NextResponse.json(r, { status: r.ok ? 200 : 500 });
      }
      default:
        return NextResponse.json({ ok: false, error: "action harus backup|cloud_upload|restore|cloud_restore" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "aksi backup gagal" }, { status: 500 });
  }
}
