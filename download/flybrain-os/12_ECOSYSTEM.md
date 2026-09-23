# 12 · ECOSYSTEM — v1.2 "PLANET" (Redesain Fundamental: Satu Dunia Hidup)

Status: [T] terkunci (spesifikasi ini adalah sumber kebenaran build v1.2)
Prasyarat: v1.1 "BIOSFER" (6 creature otonom, engine denyut, konstitusi, quant, immune, self-reflect) — TIDAK dirombak, DILAPISI.

## 0. Diagnosis — kenapa perlu v1.2

v1.1 sudah hidup (creature menalar LLM + refleks jujur), TAPI:
1. Creature abstrak — hidup di daftar/kartu, bukan di sebuah DUNIA. Tidak ada alam, tidak ada tempat.
2. Fitur-fitur masih pulau terpisah: vault, gerbang, connectome, quant, ledger, skill, reflect, immune, kwitansi — semuanya berjalan tapi TIDAK terhubung dalam satu rantai ekologi yang terlihat.
3. Tidak ada peta (map): user tidak bisa MELIHAT organisme hidupnya bergerak, makan, bekerja, tidur.
4. Tidak ada iklim/alam: tidak ada siang-malam, cuaca, musim, aliran energi — padahal semua datanya SUDAH ADA (eventLog, stats, decisionStream, reflect verdict, quant tick).

Prinsip v1.2: **SEMUA fitur = bagian alam yang sama.** Setiap fitur existing di-wire ke satu biome; setiap denyut menggerakkan dunia; semuanya tervisualisasi. Nol penyimpanan tetap (dunia hidup di IndexedDB + memori volatil klien; server tetap amnesia).

## 1. DUNIA: Peta Planet (wire table lengkap — TIDAK BOLEH ADA FITUR YANG TAK TERWIRE)

Planet = kanvas 2D top-down (peta datar bergaya "peta survei malam"), 8 biome, tiap biome = node ekologi yang DIGERAKKAN DATA NYATA:

| # | Biome (Alam) | Fitur nyata yang di-wire | Sinyal input (dari store) | Output hidup |
|---|--------------|--------------------------|---------------------------|--------------|
| 1 | 🌲 Hutan Memori (Hutan Kenangan) | Vault/memori user (00 Otak, 04 Vault) | `stats.totalRecords`, `totalBytes`, perubahan antar denyut | Pohon tumbuh/menipis; kesuburan (fertility) naik tiap record baru; canopy density ∝ bytes |
| 2 | 🌊 Samudra Gerbang | Endpoint universal /api/mcp + Service Worker (06) | eventLog tipe gateway/mcp; bearer echo | Ombak = traffic; arus menyala saat tools/call; pasang-surut ∝ frekuensi akses |
| 3 | ⛰️ Pegunungan Kuant | Quant engine (portofolio simulasi Tradio) | `quantHistory` (alokasi/rekomendasi) | Puncak-lembah bergeser tiap tick; salju = volatilitas tinggi; chart garis hidup di sisi gunung |
| 4 | 🏙️ Kota Alat | Organ factory + kristalisasi skill (Fabro) | creature.skills entries | Gedung baru menyala tiap skill baru; lampu kota ∝ jumlah skill terkristalisasi |
| 5 | 🌾 Savana Tumbuh | Checklist panen peluang (Cresca) + kwitansi/pembayaran | ledger publish/harvest, receipt verify | Ladang bergantian hijau-kuning per musim; panen = partikel emas |
| 6 | 🕳️ Kawah Riset | Self-reflect + indeksasi Lumen + pola | reflect verdict, temuan pola | Kawah berpendar saat reflect jalan; asap hitam saat verdict critical |
| 7 | 🌌 Langit Konnektom | Atlas connectome (182 neuron + fakta makro) | query connectome/atlas klik | Bintang = neuron; konstelasi berkedip saat atlas diinspeksi; bima sakti = sinaps |
| 8 | 🧊 Kutub Konstitusi | Immune + konstitusi + breaker + veto | breaker state, veto events | Es tebal saat semua breaker sehat; retakan merah saat breaker terbuka; aurora saat veto menolak aksi |

Wire ini Wajib ditampilkan sebagai tabel interaktif "PETA SISTEM" di panel samping: klik biome → highlight fitur nyatanya + datanya. Inilah jawaban "keseluruhan fitur yang masih belum di wire ke satu ekosistem".

## 2. IKLIM (Alam) — semua turunan data nyata, nol random kosong

- **Siang-Malam**: 12 denyut = 1 hari dunia. `cycleOfBeat` sudah ada → hari = floor(beat/12) % 7 (nama hari dunia: Senin-Sun.data? gunakan nama netral "Hari 1..7"). Malam: tint gelap kebiruan, creature tidur (kecuali prt patroli), drain energi −50%. Siang: aktivitas penuh. Transisi smooth (lerp warna langit).
- **Cuaca**: dari eventLog nyata — rasio error/kegagalan 20 denyut terakhir: <5% = CERAH, 5–20% = BERAWAN, >20% = BADAI (petir di biome terdampak, drain energi ×1.5, immune breaker lebih rapuh). Volume decisionStream tinggi = ANGIN (trail creature lebih panjang). Badai otomatis reda saat reflect remediasi sukses.
- **Musim**: dari verdict self-reflect terakhir — healthy = MUSIM HUJAN (kesuburan +25%/panen), warn = MUSIM KEMARAU (kesuburan −25%), critical = KELAPARAN (biome produksi energi nyaris berhenti; creature migrasi ke biome subur). 
- **Aliran energi (jaring makanan)**: biome menghasilkan energi per denyut ∝ aktivitas nyatanya (vault naik → hutan berfotosintesis; tools/call → samudra bergelombang; quant tick → gunung). Creature yang berada di biome menggembalakan (graze) energi itu (metabolism drain sudah ada — kini drain-nya mengambil dari STOK biome, bukan dari angin kosong). Aksi creature menyetor nutrisi balik ke biome (ledger/episode/skill → fertility +). Biome kosong energinya → kesuburan turun → creature MIGRASI (movement) ke biome paling subur sesuai perannya. Inilah rantai makanan yang TERLIHAT.

## 3. MAKHLUK HIDUP — creature kini PUNYA TUBUH DI DUNIA

- Tiap creature: `{ x, y, biome: BiomeId, homeBiome, trail: {x,y}[≤24], mood: "bekerja"|"tidur"|"migrasi"|"lapar", lastMoveAt }` — hidup di store slice `world` (persist via settings vault, debounce).
- **Rumah per peran**: prt→Hutan Memori (patroli), Tradio→Pegunungan Kuant, Scriba→Kota Alat, Lumen→Kawah Riset, Cresca→Savana Tumbuh, Fabro→Kota Alat. Kutub = wilayah prt saat badai.
- **Gerak**: tiap denyut creature terpilih bergerak menuju biome target (role-based + hunger-based), interpolasi smooth di canvas (bukan teleport). Denyut creature LAIN tetap menggerakkan idle motion kecil (breathing offset) supaya dunia tak pernah beku.
- **Mood & tubuh**: energi <30 = "lapar" (ikon berkedip), tidur saat malam (Zzz), migrasi = bergerak antar biome. Sprite = ikon lucide + warna aksen + nama, trail memudar.

## 4. ENGINE — worldTick (murni klien, murah, tanpa LLM)

File baru `src/lib/flybrain/ecosystem/{world,climate,motion}.ts` + `types.ts`:
- `worldTick()` dipanggil engine.ts SETELAH applyDecision (dan setelah quant tick): update stok energi biome (produksi ∝ sinyal §2), konsumsi creature, fertility, cuaca (dari eventLog), fase hari, musim (dari reflect verdict), posisi/mood creature. Semua fungsi murni + testable; state via `useFlybrain.setState`.
- Budget: worldTick TIDAK memanggil LLM, TIDAK fetch — <5ms, aman tiap denyut.
- `worldSnapshot()` → serialisasi ringkas untuk UI & inspektur (nol penyimpanan tetap: hanya settings vault lokal).

## 5. UI — View baru "08 · PLANET" (PlanetView) + integrasi

- Nav AppShell: `{ key: "planet", code: "08", label: "Planet", icon: Globe2, hint: "Peta dunia hidup: biome, iklim, 6 makhluk" }`.
- **Kanvas planet** (~60% lebar): peta 8 biome (region organik berbatas halus, bukan kotak), creature bergerak real-time, partikel cuaca (hujan/petir/angin), siklus siang-malam (lerp), langit konnektom di band atas kanvas. requestAnimationFrame; pause bila tab hidden (visibilitychange).
- **Interaksi**: klik biome → panel inspektur biome (kesuburan, stok energi, sinyal nyata yang menyalakannya, fitur nyata ter-wire, tombol "Buka fitur" → pindah ke view terkait). Klik creature → inspektur creature (genom, energi, mood, trail, keputusan terakhir, skill). Hover → tooltip nama.
- **Panel samping**: (a) IKLIM (hari/jam dunia, cuaca + alasan data, musim + verdict); (b) JARING MAKANAN (aliran energi biome→creature→nutrisi, bar kecil); (c) PETA SISTEM (wire table §1, klik → highlight di kanvas). 
- **Ticker & versi**: AppShell → v1.2 "PLANET"; footer juga.
- Kanvas SATU saja yang punya RAF loop — komponen lain reaktif zustand biasa.

## 6. Endpoint universal — tool baru (stateless, amnesia tetap)

Tambah tool ke-9 `world.map` di /api/mcp: TANPA state, mengembalikan wire table §1 + rumus iklim + cara membaca peta (dokumentasi hidup untuk Hermes/opencode/agent luar). Validasi error -32602 tetap. tools/list otomatis 9.

## 7. Batas jujur (konstitusi transparansi)

- Dunia adalah METAFORA VISUAL dari data nyata — tidak ada keputusan baru yang diambil dunia; dunia HANYA menampilkan & mengalirkan energi dari aksi creature yang sudah ada. Label [D] untuk mekanisme iklim (desain baru), [T] untuk wire table (fitur nyata), [H] untuk migrasi (hipotesis perilaku).
- Nol penyimpanan: posisi/energi biome persist lokal (settings vault user), server tetap tidak tahu apa-apa.

## 8. Acceptance criteria v1.2

1. `bun run lint` bersih; app render tanpa error (dev.log bersih).
2. PlanetView terlihat di nav 08; kanvas hidup (creature bergerak ≥1 biome dalam 6 denyut manual); klik biome & creature berfungsi.
3. Wire table lengkap: 8/8 biome terhubung fitur nyata; tidak ada fitur tanpa biome.
4. `curl /api/mcp tools/list` = 9 tools; `tools/call world.map` 200.
5. E2E puppeteer (tests/e2e_master.mjs) lolos klik semua view 00–08 + fitur utama + API.
6. Dokumen: CHANGELOG v1.2.0, README, PROJECT_CONTEXT diperbarui.
