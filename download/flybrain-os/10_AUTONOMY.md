# 10_AUTONOMY.md — Spesifikasi Otonomi L4 "ORGANISME"

Versi: 1.0 | Status: [T] Terkunci | Konvensi: [T]=Terverifikasi, [D]=Desain, [H]=Hipotesis

## 0. Preface — Mengapa v0.2 Bukan SaaS Otonom

Kritik pemilik (2026-09-21): *"itu bahkan bukan saas yang autonomous"*. Kritik diterima penuh.
Diagnosis jujur terhadap v0.2:

| Dimensi | v0.2 (kenyataan) | Kekurangan |
|---|---|---|
| prt | Patroli rule-based 5 tugas | Bukan otonomi — hanya skrip refleks (L1) |
| Bisnis | Tidak ada | Tidak ada loop penjualan/support/ops/produk |
| Layanan | Aplikasi lokal tab tunggal | Bukan *service* — tidak ada yang berjalan saat user tidak membuka |
| Endpoint | Router virtual di dalam tab | Agent luar tidak bisa konek sungguhan |

Kesimpulan: v0.2 = **alat lokal (L1 Refleks)**. Target v1.0 = **SaaS otonom (L3 penuh, menuju L4)**.

## 1. Definisi: Tangga Otonomi FLYBRAIN

- **L0 Manual** — UI saja; prt tidur. (v0.1)
- **L1 Refleks** — prt patroli aturan tetap; tidak menalar. (v0.2 ← posisi sekarang [T])
- **L2 Koordinasi** — prt menalar via LLM saat ditanya (chat). (v0.2 chat = primitif)
- **L3 Loop Otonom** — prt menjalankan 4 loop bisnis berkala dengan penalaran LLM,
  tanpa perintah manusia; semua keputusan berjejak penuh. (v1.0 target [D])
- **L4 Organisme** — L3 + aksi eksternal otonom (menawarkan layanan ke agent lain lewat
  endpoint publik, menerbitkan kwitansi bertanda tangan, mengusulkan roadmap dan
  merevisinya sendiri dari telemetri). (v1.x, scope-grant per fitur [D])

Prinsip tunggal: **produk bukan alat yang dipakai — produk adalah organisme yang bekerja.**
Manusia = pemilik data + pemberi mandat. prt = operator yang menjalankan bisnis.

## 2. Empat Organ Bisnis (Loop Otonom)

Setiap loop = siklus saraf: **SADAR → TAFSIR → PUTUSKAN → BERTINDAK → INGAT**.

### 2.1 GUARDIAN (Ops)
- SADAR: paket vital dari kernel lokal (kesehatan vault, audit gerbang, error rate, usia kwitansi).
- TAFSIR: klasifikasi (normal / perhatian / kritis) + penyebab.
- PUTUSKAN: menyembuhkan (heal), menyetel (tune), atau melaporkan (report).
- BERTINDAK: perintah aksi dieksekusi KLIEN (prt tidak pernah menyentuh data; klien yang memegang data).
- INGAT: insiden + resolusi ditulis ke ledger lokal user.

### 2.2 MERCHANT (Penjualan)
- SADAR: tier, sisa masa aktif, fitur yang dicoba, intensitas pakai.
- PUTUSKAN: tawar (offer) / tahan (hold) / diam — dengan alasan eksplisit.
- BERTINDAK: menerbitkan **proposal personal** + kwitansi demo `flybrain.receipt/v1`.
- INGAT: penawaran tercatat; v1.x kwitansi bertanda tangan mitra (prasyarat monetisasi nyata).

### 2.3 ENVOY (Support & Relasi)
- SADAR: pertanyaan user, chat masuk, permintaan lewat endpoint.
- PUTUSKAN: jawab langsung / butuh konteks tambahan / eskalasi ke manusia.
- BERTINDAK: jawaban LLM berkonteks kernel (vault stats, status sistem, fakta produk).
- INGAT: ringkasan kebutuhan user → ledger lokal.

### 2.4 SCOUT (Produk)
- SADAR: statistik pemakaian fitur lokal (view paling dibuka, endpoint tersibuk).
- PUTUSKAN: proposal roadmap teratas — 1 per siklus, dengan argumen data.
- BERTINDAK: proposal ditulis ke ledger user (tidak pernah dikirim ke server).
- INGAT: arah iterasi berikutnya ditimbang dari proposal lama yang masih tersimpan.

## 3. Anatomi Saraf → Peta Sistem

| Organ lalat | Sistem v1.0 | Implementasi |
|---|---|---|
| Antena + lobus optik | SADAR | Sense-packet ringkas dikirim KLIEN per heartbeat |
| Lobus antenal | TAFSIR | Penalaran LLM (z-ai sdk, serverless stateless) |
| Kompleks sentral | PUTUSKAN | Pilih aksi dari action-space + kebijakan mandat |
| Neuron motorik (VNC) | BERTINDAK | Perintah dieksekusi klien (server tak berdaya atas data) |
| Badan jamur (Kenyon) | INGAT | Jejak ditulis ke vault LOKAL user; server amnesia total |

## 4. Konstitusi prt (Batas Otonomi — Tidak Dapat Dilanggar)

1. **Sumpah nol-penyimpanan**: prt/edge TIDAK PERNAH menyimpan data user. Konteks per
   heartbeat bersifat ephemeral; respons = keputusan; server amnesia total. [T — arsitektur]
2. **Privasi**: prt tidak mengirim data user keluar infrastruktur; konteks LLM = ringkasan
   agregat (angka, tier, tanggal) — bukan isi memori user.
3. **Kejujuran finansial**: tier hanya berubah dari kwitansi yang lolos validasi; prt
   tidak dapat "menghadiahkan" PRO.
4. **Non-destruktif**: penghapusan data selalu butuh konfirmasi manusia.
5. **Transparansi radikal**: setiap keputusan punya jejak penuh (SADAR→INGAT) yang terlihat
   di Ruang Kendali. Tidak ada aksi bayangan.
6. **Budget**: tiap heartbeat maksimal 1 keputusan per organ; gagal = degradasi ke mode
   refleks (offline), tidak pernah macet.

## 5. Layanan Berjalan Sendiri (Mekanisme)

- **Saat konsol terbuka** [D]: klien memicu heartbeat tiap ±45 dtk; prt memilih organ
  (round-robin + prioritas insiden); hasil = keputusan LLM, ditampilkan live.
- **Saat konsol tertutup** [D — produksi]: edge cron (serverless scheduled function) menjalankan
  heartbeat tanpa user; hasil dikirim saat user kembali (dipull lewat endpoint, bukan disimpan).
- **Degradasi jujur**: offline/tak ada kuota LLM → mode refleks L1 berjalan, ditandai jelas
  di UI ("prt bermata tertutup"), tidak pernah pura-pura cerdas.

## 6. Endpoint Universal = Lapisan "SaaS"

- `POST /api/mcp` — JSON-RPC 2.0 **stateless**: `initialize`, `tools/list`, `tools/call`.
- Tools: `system.status`, `memory.write`, `memory.recall`, `prt.chat`, `receipt.verify`,
  `connectome.query`.
- Auth: `Authorization: Bearer FK1_…` (kunci = SHA-256(username|password) [T]).
- Server tidak menyimpan apa pun → SaaS tanpa gudang data: **kami menjual kesadaran
  berjalan, bukan penyimpanan**.
- Semua agent (Hermes, opencode, curl, IoT) konek **sekali** ke satu URL ini.

## 7. Ruang Kendali (Mission Control) — Visualisasi Wajib (anti-slop)

Satu view baru "06 Ruang Kendali" menampilkan organisme hidup:
1. **Aliran keputusan** live: kartu per keputusan (organ, SADAR→INGAT, latensi, alasan).
2. **Mandat**: switch level L0–L4 + scope grant per organ (on/off).
3. **Ledger bisnis**: pendapatan terdeteksi dari kwitansi lokal, usia lisensi, penawaran aktif.
4. **Denyut organisme**: ritme heartbeat, riwayat organ yang bertugas.
5. **Panel endpoint**: URL universal + tester JSON-RPC + sampel curl Hermes/opencode.

## 8. Kejujuran Batas v1.0

- L3 penuh saat konsol terbuka [D]; cron-edge otonom 24/7 = Fase deploy (L3 produksi).
- L4 = aksi eksternal (merchant menerbitkan kwitansi tanda tangan asli; envoy melayani
  agent luar lewat /api/mcp — yang ini SUDAH aktif di v1.0 [D]).
- Semua klaim otonomi diberi label [D]/[H] sampai diverifikasi browser.
