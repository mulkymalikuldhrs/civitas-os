import { NextResponse, type NextRequest } from "next/server";
import { cachedStatus, worldEntities } from "@/lib/civos/minecraft";
import { mcTarget } from "@/lib/civos/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const force = req.nextUrl.searchParams.get("force") === "1";
    const target = await mcTarget();
    const status = await cachedStatus(force);
    const entities = await worldEntities();
    return NextResponse.json({
      ok: true,
      server: { host: target.host, port: target.port, version: target.version, invite: target.invite },
      status,
      entities,
      note: "Minecraft = world layer; sumber kebenaran finansial tetap Civilization Kernel.",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "ping gagal" }, { status: 500 });
  }
}
