// CIVITAS OS — chat API: riwayat percakapan warga (poll realtime 2 dtk dari UI).
import { NextResponse, type NextRequest } from "next/server";
import { recentChat } from "@/lib/civos/chat";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get("since") ?? undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 40);
  try {
    const rows = await recentChat(Math.min(Math.max(limit, 1), 100), since || undefined);
    return NextResponse.json({ ok: true, messages: rows });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "gagal" }, { status: 500 });
  }
}
