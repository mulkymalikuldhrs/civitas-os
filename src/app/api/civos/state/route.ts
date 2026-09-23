import { NextResponse } from "next/server";
import { civState } from "@/lib/civos/state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await civState();
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "gagal agregasi" }, { status: 500 });
  }
}
