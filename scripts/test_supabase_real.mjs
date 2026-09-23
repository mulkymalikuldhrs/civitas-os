// scripts/test_supabase_real.mjs — UJI KONEKSI SUPABASE NYATA (proyek milik user, dari repo upstream sendiri)
// Bukan penyimpanan FLYBRAIN (zero-storage tetap); ini uji jembatan upstream Autonomous-Organism.
import https from "node:https";

// KEAMANAN: kredensial TIDAK pernah di-hardcode — selalu dari environment variables
// (isi via .env lokal atau KONFIG UI). Repo publik harus bebas rahasia.
const URL_BASE = process.env.SUPABASE_URL || "";
const ANON = process.env.SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SUPABASE_SERVICE_KEY || "";

if (!URL_BASE || !ANON) {
  console.error("SUPABASE_URL dan SUPABASE_ANON_KEY wajib di-set di environment (tanpa hardcode — keamanan).");
  process.exit(1);
}

function get(path, key) {
  return new Promise((resolve) => {
    const req = https.request(`${URL_BASE}${path}`, { method: "GET", timeout: 15000, headers: { apikey: key, Authorization: `Bearer ${key}` } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, head: data.slice(0, 220) }));
    });
    req.on("error", (e) => resolve({ status: 0, head: "ERR: " + e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, head: "ERR: timeout" }); });
    req.end();
  });
}

const out = [];
const rec = (nama, r, catatan) => { out.push({ nama, status: r.status, catatan }); console.log(`${r.status === 200 ? "✓" : r.status === 401 || r.status === 403 ? "⚠" : "✗"} ${nama}: HTTP ${r.status} — ${catatan}`); };

console.log(`Target: ${URL_BASE}\n`);
const auth = await get("/auth/v1/health", ANON);
rec("Auth health (anon)", auth, auth.status === 200 ? "Auth service HIDUP" : "auth tidak merespons sehat");
const rest = await get("/rest/v1/", ANON);
rec("REST root (anon)", rest, rest.status === 200 ? "PostgREST HIDUP (OpenAPI terbuka)" : rest.head.slice(0, 80));
const tables = await get("/rest/v1/planets?select=*&limit=1", ANON);
rec("REST tabel `planets` (anon)", tables, tables.status === 200 ? "tabel upstream terbaca" : tables.status === 404 ? "tabel tidak ada/bernama lain" : "RLS/kunci — wajar untuk anon");
const tablesSvc = await get("/rest/v1/planets?select=*&limit=1", SERVICE);
rec("REST tabel `planets` (service key)", tablesSvc, tablesSvc.status === 200 ? "service key VALID dan tabel terbaca" : tablesSvc.status === 401 || tablesSvc.status === 403 ? "service key DITOLAK (mungkin sudah dirotasi — bagus)" : tablesSvc.head.slice(0, 80));

const gagal = out.filter((o) => o.status === 0).length;
console.log(`\nRingkasan: ${out.length} uji · hidup: ${out.filter((o) => o.status === 200).length} · ditolak/terproteksi: ${out.filter((o) => o.status === 401 || o.status === 403).length} · gagal jaringan: ${gagal}`);
console.log("Catatan jujur: uji ini HANYA konektivitas baca. FLYBRAIN OS tetap zero-storage — Supabase adalah adaptor upstream opsional, bukan penyimpanan platform.");
