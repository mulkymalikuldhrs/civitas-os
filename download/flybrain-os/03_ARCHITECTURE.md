# 03 — Arsitektur Teknis — FLYBRAIN OS (Tanpa Server Backend)

> Status: v1.0 · 2026-09-21 · Prinsip induk: "berfungsi penuh bagaikan ada backend, tanpa server backend".
> Larangan terkunci: TANPA Python, TANPA Prisma, TANPA API route server, TANPA proses backend. `[D]`

---

## 1. Bentuk Akhir & Path Deployment

Aplikasi = **satu bundle statis** (Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn/ui) yang seluruh logikanya berjalan di browser. Karena tidak ada fungsi server, artefak build dapat dihosting di layanan statis mana pun (Cloudflare Pages, Netlify, GitHub Pages, S3) tanpa konfigurasi runtime `[D]`. Biaya infrastruktur = biaya CDN saja; tidak ada database yang kami kelola karena kami memang tidak menyimpan data user (konsekuensi langsung dari keputusan data-sovereignty, 04_DATA_SOVEREIGNTY.md).

Konsekuensi disiplin yang diterima:
- Tidak ada `app/api/*` (route handler) di kode — dihapus dari scaffold.
- Tidak ada klien database server; `z-ai-web-dev-sdk` tidak dipakai di produk (backend-only, dan produk kita tidak punya backend).
- Semua kemampuan "backend" diwujudkan oleh **FLYBRAIN KERNEL** (§3) + **Service Worker opsional** (§5).

## 2. Peta Fungsional: Otak Lalat ↔ Modul Platform

Model arsitektur sengaja memetakan modul platform ke region otak lalat yang nyata (nama region sesuai literatur FAFB `[T]`), sehingga narasi dan struktur kode saling mengunci `[D]`:

| Region otak lalat (nyata) | Fungsi biologis | Padanan modul platform |
|---|---|---|
| Lobus antena (input penciuman) | Menangkap sinyal dunia luar | **Gerbang** — semua request tool/agent/IoT masuk di sini |
| Kaliks lobus jamur (mushroom body calyx) | Asosiasi bau → memori | **Vault** — penyimpanan memori/log/keputusan + asosiasi tag |
| Kenyon sel & lobi jamur | Memori jangka panjang, pembelajaran | Koleksi `memories` + `decisions` |
| Kompleks pusat (central complex) | Navigasi, koordinasi, keputusan motorik | **PRT** — penjadwal patroli & keputusan operasional |
| Lobus optik | Penglihatan, pemrosesan visual | Lapisan visualisasi (kanvas neuron, atlas, meter) |
| Fibrillar body / ring | Integrasi status internal | Profil & tier (identitas, kwitansi, settings) |

Pemetaan ini bukan metafora kosong: pola desain kernel meniru prinsip yang ditemukan di connectome — input terkonsentrasi di satu gerbang, memori asosiatif terpisah dari memori episodik, dan satu unit koordinasi kecil yang menjaga sisa sistem `[D]`.

## 3. FLYBRAIN KERNEL (`src/lib/flybrain/*`, TypeScript murni)

Kernel adalah "jantung tanpa server" — modul-modul isomorphic (jalan di browser, dan nanti bisa dipasang di edge runtime jika suatu saat perlu):

```
src/lib/flybrain/
├── types.ts        // kontrak tipe seluruh sistem
├── idb.ts          // wrapper IndexedDB berbasis Promise (tanpa dependensi)
├── auth.ts         // derivasi kunci FK1_*, sesi localStorage, verifikasi bearer
├── vault.ts        // CRUD 4 koleksi + statistik + ekspor/impor JSON
├── payment.ts      // validasi kwitansi kanonik → penetapan tier lokal
├── router.ts       // router API virtual: handleKorteks(method, path, body, headers)
├── prt.ts          // agent otonom: loop patroli, vital, kepribadian, chat rule-based
├── connectome.ts   // model atlas: 7 region, generator neuron/edges deterministik (seeded)
└── store.ts        // zustand: state UI global + wiring kernel ↔ React
```

Keputusan kunci per modul:
- **idb.ts** — menulis wrapper sendiri (±80 baris) daripada menambah dependensi: nol dependensi = mudah diaudit + mendukung klaim "statis murni". Database: `flybrain-os`, object store sesuai koleksi.
- **auth.ts** — kunci = `FK1_` + hex(SHA-256(username + "|" + password)) menggunakan `crypto.subtle` `[D]`. Password tidak pernah disimpan; yang tersimpan hanya label username + hash kunci (untuk verifikasi cepat). Kunci yang sama menjadi bearer token gerbang — sesuai keinginan user: "API = gabungan username dan password user".
- **router.ts** — satu fungsi `handleKorteks()` menerima (method, path, body, headers) dan mengembalikan `{status, headers, json, ms}`. Ini memberi semantik HTTP penuh (401/400/404/429) tanpa jaringan. Konsol uji Gerbang memanggil fungsi ini langsung; Service Worker opsional (§5) memakai jalan yang sama sehingga perilaku konsisten.
- **prt.ts** — loop `setInterval` ±6 dtk dengan tugas patroli berbobot acak; setiap tugas menulis `prt_events` dan sesekali `logs`. Chat = klasifikasi intent berbasis kata kunci + templat + data hidup dari kernel (status, vault, gerbang, tier). Sadar konteks: identitas belum ada, vault kosong, kwitansi kedaluwarsa — semuanya memengaruhi dialog.
- **connectome.ts** — generator PRNG berseed (mulberry32) menghasilkan ±180 neuron & edges yang sama di semua perangkat (deterministik, dapat disitasi), mengelompok node ke 7 region di atas; statistik makro ditampilkan dari angka nyata FAFB/Janelia dengan atribusi `[T]`.

## 4. Aliran Data (contoh nyata)

**Tulis memori dari opencode via gerbang:**
1. User menempel konfigurasi (05_INTEGRATIONS.md) ke opencode/MCP client.
2. Tool memanggil endpoint `POST /v1/memory` dengan `Authorization: Bearer FK1_...`.
3. Di browser yang sama: SW mencegat fetch → meneruskan ke `handleKorteks()`; tanpa SW: MCP/SDK bridge memanggil `handleKorteks()` langsung.
4. Router memverifikasi bearer (auth.ts), menulis ke IndexedDB (vault.ts), memicu event yang membuat PRT bereaksi (log + vital).
5. Respons JSON `{ok:true, id, ts}` kembali seperti respons server sungguhan.

Titik penting: **tidak ada satu byte pun yang keluar dari perangkat** pada seluruh alur `[D]`.

## 5. Lapisan Endpoint Nyata (opsional, tetap tanpa server)

Dua jalur diwujudkan sekaligus:
- **SW-1 (browser yang sama):** `public/sw-korteks.js` — service worker yang mencegat `fetch('/api/korteks/*')`, meneruskan ke implementasi router mini di dalam SW (pembacaan langsung IndexedDB). Diaktifkan lewat toggle di view Gerbang; selalu bisa dimatikan. Ini memberi semantik `curl http://localhost/api/korteks/v1/memory` saat development `[D]`.
- **SW-2 (lintas-perangkat, roadmap v1.0):** kode Cloudflare Worker stateless ±150 baris (TypeScript) yang memasang `handleKorteks` di edge dengan data tetap di sisi klien (mode relay E2E terenkripsi; skema di 04_DATA_SOVEREIGNTY.md §7). Tidak dikirim di v0.2 karena butuh akun CDN; spesifikasi lengkap tersedia agar eksekusinya mekanis `[D]`.

## 6. Lapisan Presentasi (anti-slop)

- Satu route `/`; navigasi internal via state (syarat lingkungan pratinjau + kesederhanaan statis).
- Komponen: `AppShell` (nav samping katalog, ticker, footer menempel) + 6 view + kanvas (hero neuron, atlas, strip aktivitas PRT, aliran paket gerbang).
- Bahasa desain "laboratorium saraf malam": latar hampir hitam kehijauan, fosfor hijau + amber, garis katalog 1px, tekstur grid & scanline, label spesimen monospace ("SPESIMEN 001 — Drosophila melanogaster"), angka hidup di setiap panel. Semua komponen dasar dari shadcn/ui agar aksesibilitas & konsistensi terjaga, dengan kulit kustom via token CSS.
- Semua visual digambar dengan `<canvas>` 2D murni (tanpa pustaka graf berat) — bundel kecil, 60fps, dan penuh kendali estetika.

## 7. Kualitas, Uji, Operasi

- `bun run lint` sebagai gerbang statik; verifikasi perilaku lewat browser otomatis (golden path per view) sebelum rilis.
- Log pengembangan: `dev.log`. Tanpa proses latar lain; tanpa mini-service.
- Determinisme: atlas & statistik makro tidak bergantung waktu/acak non-seed, sehingga screenshot lintas perangkat konsisten `[D]`.

## 8. Keputusan Teknis Terbuka (disengaja)
- **Tidak** memakai CRDT/sinkronisasi multi-perangkat di v0.2 — portabilitas ditangani ekspor/impor JSON (sederhana, dapat diaudit); sinkronisasi file lokal masuk v0.3, sinkronisasi P2P/edge masuk v1.0 `[D]`.
- Tidak memakai WebCrypto untuk enkripsi at-rest di v0.2 (UI tetap menampilkan flag "at-rest: plaintext lokal"); kunci per koleksi masuk v0.3 bersama File System Access API — keputusan jujur agar tidak ada klaim keamanan palsu `[D]`.
