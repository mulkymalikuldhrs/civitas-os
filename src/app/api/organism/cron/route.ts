// GET /api/organism/cron — BEACON denyut serverless (v1.2.2).
// Dipanggil Vercel Cron (vercel.json) — lihat batas plan di bawah.
//
// KEBENARAN (konstitusi hukum 1 & 5): server TIDAK BISA mendenyutkan biosfer
// pemilik — creature hidup di browser + IndexedDB masing-masing pemilik
// (zero-storage). Yang beacon ini lakukan, jujur dan terbatas:
//   1. Bukti ketersediaan: endpoint tetap hangat (mengurangi cold-start
//      panggilan /api/mcp & /api/organism/* berikutnya).
//   2. Katalog dinamis: jumlah tool MCP saat ini (sumber tunggal mcp-tools.ts).
//   3. Waktu server — klien yang bangun (SW periodicsync / buka tab) bisa
//      memakainya untuk kalibrasi jam dunia bila jam lokal dicurigai.
// TANPA autentikasi sensitif, TANPA log per user, TANPA state apa pun.
// Batas plan Vercel: Hobby = cron harian saja; */5 butuh Pro. [D]

import { NextResponse } from "next/server";
import { MCP_TOOLS } from "@/lib/flybrain/mcp-tools";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      kind: "flybrain.beacon/v1",
      at: new Date().toISOString(),
      note: "Beacon stateless — server tidak menyimpan apa pun dan tidak mendenyutkan biosfer pemilik (zero-storage). Denyut penuh tetap hidup di perangkat: interval halaman, visibility catch-up, dan SW periodicsync.",
      tools: MCP_TOOLS.length,
      toolNames: MCP_TOOLS.map((t) => t.name),
      limits: { hobbyPlan: "cron 1x/hari", proPlan: "cron */5 didukung" },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
