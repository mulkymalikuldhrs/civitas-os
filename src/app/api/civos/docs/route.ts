// CIVITAS OS — docs API: daftar dokumen + isi markdown untuk Pustaka (DOKUMEN di UI).
import { NextResponse, type NextRequest } from "next/server";
import { readdirSync, statSync, readFileSync } from "fs";
import { join, relative } from "path";

export const dynamic = "force-dynamic";

const DOC_ROOT = join(process.cwd(), "docs");

function listMarkdown(dir: string, out: { path: string; size: number }[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "data") continue; // data mesin, bukan dokumen
      listMarkdown(p, out);
    } else if (/\.md$/.test(name) || /^ADR-/.test(name)) {
      out.push({ path: relative(DOC_ROOT, p).replaceAll("\\", "/"), size: st.size });
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  try {
    if (file) {
      const safe = file.replaceAll("\\", "/").replace(/\.\./g, "");
      const content = readFileSync(join(DOC_ROOT, safe), "utf8");
      return NextResponse.json({ ok: true, file: safe, content: content.slice(0, 60_000) });
    }
    const files = listMarkdown(DOC_ROOT).sort((a, b) => a.path.localeCompare(b.path));
    return NextResponse.json({ ok: true, files });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "gagal" }, { status: 500 });
  }
}
