// CIVITAS OS — graph API: peta file & wiring (hasil scripts/filegraph.mjs).
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const raw = readFileSync(join(process.cwd(), "docs", "data", "filegraph.json"), "utf8");
    return NextResponse.json({ ok: true, graph: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ ok: false, error: "graph belum dibuat — jalankan node scripts/filegraph.mjs" }, { status: 404 });
  }
}
