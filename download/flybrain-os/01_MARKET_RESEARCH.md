# 01 — Riset Pasar & Keputusan Proyek (A / B / C)

> Dokumen keputusan. Tujuan: menjawab "proyek apa yang SEHARUSNYA kita kerjakan, bagaimana, dan mengapa" — serta masalah klien mana yang terselesaikan oleh setiap opsi.
> Status: v1.0 · 2026-09-21 · Bahasa: Indonesia
> Konvensi bukti: `[T]` = TERVERIFIKASI (sumber primer/riset 2026-09-21, lihat /research/*.json) · `[D]` = DESAIN (keputusan produk) · `[H]` = HIPOTESIS (perlu validasi)

---

## 1. Konteks: Gelombang Pasar yang Sedang Berjalan

Tiga gelombang bertemu pada titik yang sama di 2026, dan proyek kita berada tepat di perpotongannya.

1. **Connectome lalat jadi ikon budaya AI.** Konektom CNS lalat jantan lengkap (Janelia + Google, rilis 3 Sep 2026) memuat >166.000 neuron dan ±125 juta sinapsis `[T]`. WIRED (16 Sep 2026) mempublikasikan eksperimen "vibe-coding" memakai peta otak lalat untuk membuat situs PitchFly `[T]`, dan MindStudio (14 Sep 2026) mendokumentasikan gelombang hobiis yang melatih dataset otak lalat untuk tugas-tugas sehari-hari `[T]`. FlyWire FAFB (betina, Nature 2024) tetap dataset rujukan: 139.255 neuron, >50 juta sinapsis, ±8.400 tipe sel `[T]`. Artinya: **narasi "otak lalat" sudah punya perhatian publik** — kita tidak perlu membeli kesadaran pasar dari nol.
2. **MCP menjadi standar de-facto lapisan alat agent.** Unduhan MCP server tumbuh dari ±100.000 (Nov 2024) menjadi >8 juta (Apr 2025), ekosistem >5.800 server `[T]`, pertumbuhan 8.000% dalam 5 bulan `[T]`. Spesifikasi MCP 2026-07-28 mengarahkan infrastruktur agent ke arah stateless, routable, "seperti web" `[T]` — persis arah desain gerbang kita.
3. **Local-first & data sovereignty naik kelas dari ideologi ke kebutuhan.** Prinsip Ink & Switch (2019) kini mainstream di diskusi engineering `[T]`; tren self-hosted vault "security teams taking the keys back" muncul Jul 2026 `[T]`; riset kebijakan (New America, Nov 2025) menyoroti risiko privasi memori agent terpusat `[T]`.

Ukuran pasar pendukung: pasar AI agent $10,9 miliar (2026) → proyeksi $182,9 miliar (2033), CAGR ±49,6% (Grand View Research) `[T]`; AI infrastruktur $75,4 miliar (2026) `[T]`.

**Kesimpulan konteks:** pasarnya bukan "apakah" tetapi "siapa yang merakit dulu" tiga gelombang ini menjadi produk yang bisa dipakai orang biasa.

## 2. Benchmark & Celah Kompetitor

| Pemain | Yang dilakukan | Yang TIDAK dilakukan (celah kita) |
|---|---|---|
| mem0 (MCP memory) `[T]` | Memori agent via MCP URL, hosted | Data tetap di server mereka; tidak ada narasi connectome; tidak ada agent penjaga |
| memnode `[T]` | Persistent memory hosted/local | Tidak ada visualisasi; tidak ada model data-sovereignty ekstrem (user simpan sendiri) |
| Anthropic Persistent Memory (Claude Managed Agents) `[T]` | Memori bawaan ekosistem Claude | Terkunci di ekosistem vendor; tidak universal lintas tool |
| Glama knowledge/memory MCP `[T]` | Knowledge base self-hosted, 18 tools | Tanpa identitas "otak", tanpa agent penghuni, tanpa gerbang IoT |
| Calyx / VFB MCP (ditemukan user) `[T]` | Anatomi & ontologi otak lalat (VFB) | BUKAN memori, BUKAN konektivitas operasional — validasi kebutuhan user "kita butuh lebih" tepat |

**Posisi kosong di peta pasar:** tidak ada satu pun pemain yang menggabungkan (a) narasi connectome otak lalat, (b) memori agent lintas-alat via endpoint tunggal, (c) data-sovereignty ekstrem (user menyimpan sendiri 100%), (d) agent penghuni yang menjaga platform. Kombinasi inilah Proyek A.

## 3. Tiga Opsi Proyek (A / B / C)

### Proyek A — FLYBRAIN OS: Platform Otak Terintegrasi (REKOMENDASI)
**Bentuk:** aplikasi web statis (tanpa backend) berisi empat modul — (1) Otak: atlas connectome hidup sebagai "pusat saraf" platform; (2) PRT: lalat-agent penghuni yang menjaga platform otonom; (3) Vault: gudang data lokal user (memori, log, keputusan, kwitansi) via IndexedDB; (4) Gerbang: satu endpoint universal untuk semua tool/agent/IoT, kunci API = turunan username+password user.
**Masalah klien yang terselesaikan:**
- *Agent lupa & terfragmentasi* → memori tunggal yang bisa dibaca semua tool (Hermes, opencode, Claude, QnA bot) lewat satu endpoint `[D]`.
- *Ketakutan privasi* → kami secara teknis TIDAK BISA membaca data user (tidak ada server yang menyimpan) `[D]`.
- *Biaya & ribet integrasi* → sambung endpoint sekali, semua alat dapat "otak" `[D]`.
- *Kebutuhan kepercayaan/narasi* → otak lalat viral sebagai model arsitektur yang nyata (lobus antena, kaliks lobus jamur, lobus optik) `[T]`.
**Risiko utama:** lingkup terbesar dari tiga opsi `[H]` → mitigasi: arsitektur modular (B dan C adalah subset).

### Proyek B — FlyBrain Gateway: Infra MCP/Endpoint murni (headless)
**Bentuk:** hanya Gerbang + protokol; dijual ke developer/enterprise.
**Masalah klien:** integrasi lintas-alat tanpa UI.
**Kenapa bukan pilihan utama:** persaingan paling sengit (mem0, memnode, glama sudah di sana) `[T]`; tanpa narasi visual, diferensiasi lemah; tanpa Vault, klaim privasi tidak beda dari kompetitor; harga jual infra murni tertekan `[H]`.

### Proyek C — FlyBrain Vault: Memory-as-Local-File (data-only)
**Bentuk:** hanya lapisan Vault + kriptografi + ekspor/impor.
**Masalah klien:** kepemilikan data murni.
**Kenapa bukan pilihan utama:** sulit monetisasi (kalau datanya milik user dan offline, apa yang mereka bayar?) `[H]`; tanpa gerbang, tidak menyelesaikan masalah integrasi; tanpa PRT/otak, tidak punya cerita yang bisa diceritakan — kekuatan utama kita justru narasi.

### Matriks keputusan (skala 1-5) `[D]`
| Kriteria (bobot) | A | B | C |
|---|---|---|---|
| Diferensiasi vs kompetitor (25%) | 5 | 2 | 3 |
| Kecepatan monetisasi (20%) | 4 | 4 | 2 |
| Kesesuaian visi user (25%) | 5 | 3 | 3 |
| Risiko teknis terbalik — mudah dikerjakan (15%) | 3 | 5 | 4 |
| Potensi viral/narasi (15%) | 5 | 1 | 2 |
| **Skor tertimbang** | **4,55** | **2,95** | **2,80** |

**Keputusan: kerjakan Proyek A.** B dan C tetap hidup sebagai modul dalam A — jika suatu saat perlu spin-off B2B atau open-source library, tinggal diekstraksi tanpa menulis ulang `[D]`.

## 4. Why & How (ringkas)
- **Why:** tiga gelombang (connectome-viral, MCP-standar, local-first) belum dirakit jadi satu produk oleh siapa pun; ceritanya kuat ("memberi otak lalat kepada semua agent Anda, tanpa mencuri data Anda"), teknologinya bisa dilakukan dengan web statis, dan biaya infrastruktur awal mendekati nol karena kami tidak menyimpan data.
- **How:** lihat 02_PRD.md (produk), 03_ARCHITECTURE.md (teknis), 07_ROADMAP.md (eksekusi). Prinsip eksekusi: (1) bangun kernel dulu, (2) visualisasi semua fitur (anti-slop), (3) jangan pernah menambah server sampai user minta fitur yang butuh server.

## 5. Segmen awal & hipotesis monetisasi
- Segmen 1: *AI power user / builder* (pakai Hermes, opencode, Claude) — butuh memori universal; bayar untuk akses gerbang `[H]`.
- Segmen 2: *hobiis robotik/IoT* — butuh "otak" murah untuk perangkat `[T: gelombang MindStudio]`.
- Segmen 3: *tim kecil privasi-sadar* — butuh memori agent yang patut diaudit `[H]`.
- Monetisasi: hanya akses infrastruktur (login & gerbang), data 100% milik user. Detail protokol "bayar-tanpa-menyimpan-data": 04_DATA_SOVEREIGNTY.md. Harga indikatif: Pro USD 19/bln; laporan sesi sebelumnya (Pro 19-29, Team 99) tetap jadi acuan `[D]`.

## 6. Sumber
- research/10_male_connectome.json, research/06_viral_recent.json, research/01_flywire_connectome.json, research/09_vfb_calyx.json, research/02_calyx_mcp.json, research/08_memory_saas.json, research/13_mcp_ecosystem.json, research/14_local_first.json, research/15_agent_market.json, research/16_data_vault.json `[T]`
- Catatan lisensi: data FlyWire CC BY-NC 4.0 → kami tidak menjual-ulang data; kami menjual infrastruktur & alat `[T]`. Konfirmasi tertulis pemilik data tetap wajib sebelum monetisasi skala penuh.
