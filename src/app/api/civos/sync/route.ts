// CIVITAS OS — sync/route.ts
// Mirror persadaban → Supabase Dhaher Labs. POST = dorong; GET = status awan.

import { NextResponse } from "next/server";
import { pushMirror, cloudStatus, supabaseCreds } from "@/lib/civos/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const cloud = await cloudStatus();
  const creds = await supabaseCreds();
  return NextResponse.json({ ok: true, enabled: creds.enabled, cloud });
}

export async function POST() {
  const r = await pushMirror();
  return NextResponse.json({ ok: r.ok, r }, { status: r.ok ? 200 : 502 });
}
