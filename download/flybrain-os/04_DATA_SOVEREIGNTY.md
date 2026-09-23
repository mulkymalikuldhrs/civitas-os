# 04 — Data Sovereignty & Protokol Pembayaran Nol-Penyimpanan

> Status: v1.0 · 2026-09-21 · Janji induk user: "kita tidak menyimpan data apa pun walaupun berbayar; user yang menyimpan datanya sendiri; sistem mendeteksi pembayaran dari data lokal user."
> Konvensi: `[T]` terverifikasi · `[D]` desain · `[H]` hipotesis/risiko.

---

## 1. Model Kepemilikan Data

Semua data user hidup di **penyimpanan lokal browser user** (IndexedDB database `flybrain-os`) dan salinan yang mereka ekspor sendiri. Kami tidak memiliki, tidak melihat, dan tidak bisa memulihkan data itu — bukan karena kebijakan, tetapi karena arsitektur: tidak ada server penyimpanan yang ada `[D]`. Ini melampaui klaim "enkripsi end-to-end" vendor lain: tidak ada ujung server sama sekali untuk diintip, dibocorkan, disita, atau dijual `[D]`. Ketika berbayar sekalipun, yang dibayar user adalah **akses infrastruktur** (login & gerbang), bukan penyimpanan.

Implikasi praktis yang diambil alih sebagai tanggung jawab produk (bukan disembunyikan):
- Durability → tanggung jawab user; produk merespons dengan ekspor 1-klik, pengingat PRT untuk backup rutin, dan (v0.3) sinkronisasi ke folder lokal user via File System Access API `[D]`.
- Portabilitas → format ekspor JSON kanonik terdokumentasi penuh di dokumen ini, sehingga data user tidak pernah terkunci (jika FLYBRAIN OS hilang, datanya tetap terbaca) `[D]`.
- Audit → setiap rekaman punya `source` (ui/gateway/prt) dan `ts`, sehingga user bisa merekonstruksi siapa menulis apa `[D]`.

## 2. Skema Data Kanonik (v1)

Semua rekaman memakai amplop yang sama `[D]`:

```json
{
  "id": "mem_01J9...",        // prefiks per koleksi + ULID-like
  "ts": "2026-09-21T07:15:00.000Z",
  "source": "ui | gateway | prt",
  "payload": { },              // bebas, disarankan <= 8 KB
  "tags": ["ops", "drone"],
  "version": 1
}
```

Koleksi & payload baku:
- `identity` — `{ username, keyHash, tier, tierUntil, createdAt }` (password TIDAK pernah ada di mana pun; `keyHash` = hash kunci untuk verifikasi cepat) `[D]`.
- `memories` — `{ title, content, kind: episodic|semantic|working }` — terinspirasi taksonomi memori yang dipakai sesi sebelumnya (episodik/semantik/kerja) `[D]`.
- `logs` — `{ channel, level, message }` — log operasional dari UI/gerbang/PRT.
- `decisions` — `{ context, choice, rationale }` — jejak keputusan agent/perangkat.
- `receipts` — kwitansi pembayaran (bagian §4).
- `gateway_log` — `{ method, path, status, ms, agent }` — audit panggilan gerbang.
- `prt_events` & `settings` — aktivitas PRT dan preferensi UI.

## 3. Identitas & Kunci: "API = username + password"

Persis sesuai permintaan user, kredensial gerbang diturunkan dari identitas user sendiri `[D]`:

```
kunci = "FK1_" + hex( SHA-256( username + "|" + password ) )   // WebCrypto, di perangkat
```

- Kunci dipakai sebagai `Authorization: Bearer <kunci>` pada semua endpoint gerbang.
- Password tidak disimpan; `keyHash` (hash dari kunci) disimpan lokal hanya untuk verifikasi sesi cepat.
- Konsekuensi disiplin: siapa pun yang tahu username+password user punya akses penuh ke vault perangkat itu — sama seperti model "file + password"; dokumen ini menyatakan itu terbuka, bukan menyembunyikannya `[D]`.
- Rotasi = ganti password (identitas baru menghasilkan kunci baru; rekaman lama tetap karena terikat perangkat, bukan per kunci) `[D]`.

## 4. Protokol Pembayaran Nol-Penyimpanan ("detect pembayaran dari data lokal user")

Prinsip: **bukti pembayaran adalah berkas milik user**, bukan status di server kami. Alur `[D]`:

1. User membayar lewat kanal mitra (v0: manual — transfer/QRIS/Paddle/Stripe payment link sesuai fase). Mitra menerbitkan kwitansi.
2. User menempel kwitansi ke view Vault → disimpan di koleksi `receipts` (data user, di perangkat user).
3. Kernel memvalidasi kwitansi **lokal** dan menetapkan tier di `identity.tier` — tanpa jaringan, tanpa server.

**Format kwitansi kanonik v0 (demo + integrasi manual):**

```json
{
  "schema": "flybrain.receipt/v1",
  "receipt_id": "RC-2026-000123",
  "issued_at": "2026-09-21T00:00:00Z",
  "period_months": 1,
  "tier": "PRO",
  "payer": "<username>",
  "amount": { "currency": "USD", "value": 19 },
  "channel": "demo|manual|stripe|xendit",
  "sig": "<checksum kanonik — lihat §5>"
}
```

Aturan validasi kernel `[D]`: `schema` cocok; `issued_at + period_months` belum lewat; `payer` = username aktif; checksum `sig` cocok dengan perhitungan kanonik (§5); tier naik ke nilai `tier` hingga masa aktif habis. Kwitansi kedaluwarsa: tier turun ke FREE secara otomatis saat patroli PRT — tidak ada "penagihan" karena tidak ada server `[D]`.

## 5. Kejujuran Kriptografis (anti-klaim palsu)

Di v0.2, `sig` = checksum SHA-256 kanonik terhadap string field terurut — ini **integritas format**, bukan bukti pembayaran tak terpalsukan `[D]`. Klaim yang benar: "sistem mendeteksi kwitansi yang tersimpan di data lokal user". Klaim yang BELUM benar: "kwitansi tak bisa dipalsukan". Jalur naik tingkat (terjadwal, bukan dijanjikan diam-diam):
- v0.2 (sekarang): demo receipt resmi tersedia di aplikasi untuk mencoba alur; kwitansi manual diterima.
- v1.0: mitra pembayaran menandatangani kwitansi (HMAC/pubkey); kernel memverifikasi tanda tangan terhadap kunci publik yang disertakan di build — tetap tanpa server `[D]`.
- v1.0+: "canary" publik read-only (CDN statis) untuk daftar `receipt_id` yang dicabut — sekali lagi file statis, bukan backend `[D]`.

Risiko kebocoran pendapatan pada masa transisi dinyatakan terbuka dan diterima sebagai biaya strategi go-to-market yang konsisten dengan janji privasi `[D]`.

## 6. Tier & Batas (indikatif) `[D]`

| | FREE | PRO (±USD 19/bln) |
|---|---|---|
| Vault lokal | Tak terbatas di perangkat | Tak terbatas di perangkat |
| Gerbang (browser ini) | 60 req/jam | 3.600 req/jam |
| Gerbang (lintas-perangkat via edge opsional v1.0) | — | termasuk |
| Ekspor/impor | Selalu gratis | Selalu gratis |
| Dukungan | Komunitas | Prioritas |

Prinsip: fitur yang melibatkan **data user** tidak pernah digembok; yang digembok hanya **infrastruktur tambahan** kami `[D]`.

## 7. Cakrawala: Relay Lintas-Perangkat Tanpa Menyimpan (v1.0)

Agar vault bisa diakses dari perangkat kedua tanpa kami menyimpan apa pun, v1.0 merancang relay edge stateless: perangkat A mengenkripsi salinan vault dengan kunci turunan user (AES-GCM, kunci = HKDF dari kunci FK1), mengunggah blob terenkripsi ke penyimpanan blob **milik user sendiri** (opsi: repositori privat GitHub / WebDAV / drive pribadi); perangkat B menarik dan membuka dengan kunci yang sama. Relay kami hanya perantara byte — **zero-knowledge secara konstruksi**, tidak bisa membuka isi `[D]`. Jika user tidak punya storage pribadi, mode lanjutan: blob terenkripsi boleh transit di KV edge kami dengan TTL ≤ 10 menit (perantara, bukan penyimpanan) — keputusan final mengikuti audit hukum `[H]`.

## 8. Kepatuhan & Etika
- Data connectome: kami hanya menampilkan statistik makro dengan atribusi (FlyWire/Janelia) dan tidak mendistribusikan data mentah — selaras CC BY-NC 4.0 `[T]`; konfirmasi tertulis pemilik data tetap prasyarat monetisasi penuh `[T]`.
- UU PDP Indonesia & GDPR: karena kami tidak mengumpulkan data pribadi apa pun (tidak ada server, tidak ada telemetri), permukaan kepatuhan kami minimal dan jujur — klaim ini akan direviu ulang setiap kali komponen publik ditambah `[D]`.
- Framing publik: "kesadaran operasional", bukan "kesadaran" biologis; UI memuat disclaimer di view PRT `[T: keputusan sesi sebelumnya]`.
