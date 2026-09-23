# 05 — Spesifikasi Gerbang Integrasi Universal (Endpoint + MCP)

> Status: v1.0 · 2026-09-21 · Janji user: "integrasi endpoint ke semua tool/AI agent/IoT — cukup sambungkan endpoint kita, semuanya jadi dipermudah."
> Prinsip: satu protokol, tiga mode penjalanan (in-browser, service-worker, edge v1.0). `[D]`

---

## 1. Filosofi

Gerbang adalah **satu-satunya titik sambung** antara dunia luar (tool, agent, perangkat) dan otak user. Semua klien berbicara protokol yang sama — HTTP-semantik + JSON — sehingga menambahkan Hermes, opencode, Claude, drone, atau skrip berarti mengubah konfigurasi, bukan menulis kode. Ini jawaban langsung atas keluhan "mapping/wiring berulang": wiring dilakukan sekali di sini `[D]`. Protokol sengaja kompatibel-campuran dengan MCP (Model Context Protocol) karena ekosistem alat agent sudah berkumpul di sana (>5.800 server `[T]`), tetapi tidak bergantung padanya — perangkat IoT dengan HTTP paling polos tetap bisa ikut.

## 2. Kontrak Umum

- Base (mode SW di browser yang sama): `/api/korteks` · Mode konsol/virtual: panggilan langsung `handleKorteks()` (latensi ±0-3 ms).
- Auth: `Authorization: Bearer FK1_...` (kunci = turunan username+password, lihat 04 §3).
- Semua respons: JSON `{ ok: boolean, ... }`; kesalahan: `{ ok:false, error: { code, message } }` dengan kode `UNAUTHORIZED | BAD_REQUEST | NOT_FOUND | RATE_LIMITED`.
- Rate limit dihormati kernel sesuai tier (FREE 60/jam, PRO 3.600/jam) `[D]`.

## 3. Daftar Endpoint (v1)

| Method | Path | Fungsi | Auth |
|---|---|---|---|
| POST | `/v1/identity/verify` | Verifikasi kunci; balik `{ tier, username }` | Bearer |
| GET | `/v1/memory?q=&kind=&limit=` | Cari/daftar memori (skor relevansi sederhana: judul+isi+tag) | Bearer |
| POST | `/v1/memory` | Tulis memori `{ title, content, kind?, tags? }` | Bearer |
| DELETE | `/v1/memory?id=` | Hapus memori spesifik | Bearer |
| GET/POST | `/v1/logs` | Baca (limit)/tulis log operasional | Bearer |
| GET/POST | `/v1/decisions` | Baca/tulis jejak keputusan agent | Bearer |
| GET | `/v1/vault/export` | Ekspor seluruh vault (JSON kanonik) | Bearer |
| POST | `/v1/payment/verify` | Validasi kwitansi tertempel → status tier | Bearer |
| GET | `/v1/system/status` | Metrik hidup: jumlah rekaman, ukuran, tier, umur sesi, beat PRT | Bearer |
| POST | `/v1/prt/chat` | Bicara dengan PRT `{ message }` → jawaban + mood | Bearer |
| GET | `/v1/connectome/summary` | Statistik atlas (region, neuron, edges) — untuk demo/IoT | Publik |

Contoh permintaan (nyata, jalankan di konsol Gerbang):

```bash
# tulis memori
curl -X POST /api/korteks/v1/memory \
  -H "Authorization: Bearer FK1_..." \
  -H "Content-Type: application/json" \
  -d '{"title":"Posisi drone pagi","content":"Home point: -6.2,106.8","kind":"episodic","tags":["drone"]}'
```

## 4. Resep Koneksi per Klien

### 4.1 MCP client (Claude Desktop / opencode / Hermes-mcp) `[D]`
```json
{
  "mcpServers": {
    "flybrain": {
      "type": "http",
      "url": "http://localhost:3000/api/korteks/mcp",
      "headers": { "Authorization": "Bearer FK1_<kunci-anda>" }
    }
  }
}
```
Mapping tool MCP → endpoint gerbang: `memory_write → POST /v1/memory`; `memory_search → GET /v1/memory?q=`; `memory_delete → DELETE /v1/memory`; `system_status → GET /v1/system/status`; `prt_chat → POST /v1/prt/chat`. (Sesi sebelumnya membuktikan pola ini di server Python; v0.2 membawa pola yang sama ke kernel tanpa-server `[T].`)

### 4.2 Hermes (HTTP bridge)
Jika Hermes mendukung custom tool HTTP: daftarkan tool dengan URL `/api/korteks/v1/*` + header bearer di atas. Jika Hermes hanya bicara MCP: pakai 4.1. (Status dukungan MCP di Hermes = asumsi terbuka dari sesi sebelumnya `[T].`)

### 4.3 Perangkat IoT / drone / mikrokontroler
Karena protokolnya HTTP + JSON polos, perangkat kecil cukup `POST /v1/memory` untuk menyimpan pengamatan dan `GET /v1/system/status` untuk membaca kondisi otak. Contoh tugas nyata: drone menyimpan keputusan penerbangan (`/v1/decisions`) tiap waypoint; dashboard membaca balik untuk post-mortem `[H: demo berikutnya]`.

### 4.4 Skrip apa pun (bun/node/python*/bash)
Endpoint tetap sama; *catatan: larangan Python hanya untuk KODE PRODUK KAMI — skrip sisi user bebas memakai bahasa apa pun.

## 5. Mode Penjalanan (kapan yang mana)
1. **Virtual (default):** UI memanggil `handleKorteks()` langsung — tanpa jaringan, latensi mikro; dipakai konsol uji & seluruh view.
2. **Service Worker (toggle di Gerbang):** SW mencegat `fetch('/api/korteks/*')` di browser yang sama → klien eksternal di mesin yang sama (script lokal, MCP stdio-bridge) bisa memakai URL nyata `[D]`.
3. **Edge (v1.0):** Cloudflare Worker stateless memasang handler yang sama di URL publik; data tetap milik user (relay zero-knowledge, 04 §7) `[D]`.

## 6. Pola Integrasi yang Disarankan (playbook)
- **Agent lupa → ingat:** awal sesi agent: `GET /v1/memory?q=<topik>`; akhir sesi: `POST /v1/memory` ringkasan. Dua panggilan, memori permanen lintas alat.
- **Audit keputusan:** setiap keputusan penting → `POST /v1/decisions` dengan `rationale`; insiden → `POST /v1/logs level=warn`.
- **Perangkat menjaga dirinya:** IoT loop: baca `system/status` → jika PRT menandai anomali, perangkat menurunkan frekuensi lapor (etika hemat energi) `[H]`.
- **QnA dengan memori:** sebelum menjawab, tarik 5 memori teratas per topik — kualitas jawaban naik tanpa menyentuh model `[H]`.

## 7. Evolusi Protokol
v0.2: endpoint di atas (stabil, kontrak dokumen ini). v0.3: tambah `/v1/sync` (chunk ekspor/impor + merge by id). v1.0: `/mcp` resmi (SSE), schema registry untuk tipe memori kustom, webhook-lokal (event → URL milik user). Setiap perubahan kontrak wajib lewat CHANGELOG + penomoran versi di path `[D]`.
