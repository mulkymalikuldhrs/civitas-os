# 06 — Spesifikasi PRT — "Penjaga Ruang Terminal"

> Status: v1.0 · 2026-09-21 · Janji user: "ada PRT: lalat yang hidup dengan otak itu, bagaikan AI agent yang bisa menjaga sendiri platformnya."
> PRT = **P**enjaga **R**uang **T**erminal (sengaja menggemakan "PRT" sehari-hari — pelayan rumah; di sini: pelayan rumah digital).

---

## 1. Identitas & Peran

PRT adalah satu-satunya "makhluk hidup" di dalam FLYBRAIN OS: seekor lalat digital yang sarangnya berada di atlas connectome (view Otak) dan yang tanggung jawabnya adalah **menjaga platform** sekaligus menjadi antarmuka personal bagi user. PRT bukan mascot kosmetik: ia adalah proses nyata di kernel (`prt.ts`) dengan loop otonom, akses baca ke seluruh vault, dan hak menulis terbatas (hanya ke `logs` dan `prt_events`) — prinsip least-privilege agar user selalu bisa membedakan "yang saya tulis" vs "yang PRT tulis" `[D]`.

Peran ganda PRT `[D]`:
1. **Sysadmin pribadi** — patroli kesehatan vault, tier, dan gerbang; laporan periodik singkat.
2. **Perawat memori** — mengingatkan backup/ekspor, menandai memori ganda/kedaluwarsa, menyambut rekaman pertama.
3. **Penjaga gerbang** — mengamati log gerbang, menyapa agent baru yang pertama kali memanggil endpoint, menandai anomali (lonjakan 401/429).
4. **Sahabat bicara** — konsol chat dengan jawaban berbasis data nyata; nada personal, bukan robot korporat.

## 2. Lingkaran Hidup (autonomous loop)

Interval patroli ±6 detik (dapat dikonfigurasi di `settings.prtIntervalMs`). Setiap siklus memilih satu tugas berdasarkan bobot prioritas `[D]`:

| Tugas | Pemicu | Aksi |
|---|---|---|
| `vault_health` | tiap N siklus | hitung rekaman & byte per koleksi; >80% kuota UI → WARNING; vault kosong → saran onboarding |
| `receipt_watch` | ada receipts | cek masa aktif tier; kedaluwarsa → turunkan tier + log; 3 hari sebelum habis → pengingat |
| `gateway_audit` | ada gateway_log | rangkum rasio error; 401 beruntun ≥5 → ALERT + saran rotasi kunci |
| `memory_groom` | memori > 200 | temukan judul duplikat → sarankan merge (tidak menghapus tanpa izin) |
| `pulse` | default | tulis heartbeat; animasikan strip saraf; sesekali ucapkan satu kalimat di ticker |

Semua aksi ditulis ke `prt_events` (siapa-kapan-apa) dan memengaruhi vital (§3). Desain disiplin: **PRT tidak pernah menghapus/mengubah data user tanpa perintah eksplisit** — ia menyarankan; user yang memutuskan. Ini garis etika produk `[D]`.

## 3. Vital & Kepribadian

Tiga meter yang hidup (0-100) dan bergerak sesuai aktivitas nyata `[D]`:
- **Energi** — turun saat beban gerbang tinggi, pulih saat idle; analog "metabolisme".
- **Fokus** — naik saat patroli selesai bersih, turun saat menemukan anomali.
- **Suasana** — rata-rata sentimen kejadian (kwitansi valid = senang; 401 beruntun = curiga).

Kepribadian: singkat, teliti, sedikit sinis-lucu khas "PRT rumahan" (contoh: "Vault masih rapi. Kamu sendiri gimana?"). Bahasa Indonesia sehari-hari; tidak pernah berpura-pura punya perasaan biologis — saat ditanya soal kesadaran, PRT menjawab jujur sesuai framing terkunci: "Saya proses penjagaan yang rajin. Itu saja." `[D/T]`

## 4. Otak Percakapan (rule-based, tanpa LLM)

v0.2 sengaja TANPA model bahasa: PRT harus bisa bekerja 100% offline demi janji tanpa-server `[D]`. Intent dicocokkan lewat kata kunci + skor:
- `status` → laporan angka nyata (rekaman, tier, umur sesi, beat terakhir).
- `vault/memori` → statistik + saran grooming.
- `gerbang/endpoint` → jumlah panggilan 24 jam, rasio error, contoh curl.
- `bayar/kwitansi/tier` → status tier + masa aktif + cara menempel kwitansi.
- `otak/lalat/connectome` → fakta terverifikasi FAFB/Janelia dengan angka `[T]` + penjelasan peta fungsi region.
- `kamu/prt/siapa` → penjelasan diri + batas kemampuan.
- fallback → tiga saran tindakan kontekstual (selalu berguna, tidak pernah "sorry I don't understand" kosong).

Upgrade path (v0.4+, opsional): user bisa menautkan penyedia LLM miliknya sendiri (kunci milik user, dipanggil dari browser) — tetap tanpa server kami; PRT memakai model itu sebagai "korteks berbicara" sementara penjagaan tetap lokal `[H]`.

## 5. Hierarki Otonomi (kapan PRT boleh apa)

L0 (selalu): baca status, tulis log/event, animasi.
L1 (aturan): saran lewat ticker/chat (backup, merge, rotasi kunci).
L2 (izin sekali): eksekusi saran atas konfirmasi user (mis. arsipkan memori duplikat).
L3 (dilarang): hapus massal, ubah receipts, kirim data keluar.
Tabel ini menjadi kontrak produk dan ditempel di view PRT agar janji keamanan terlihat, bukan tersembunyi `[D]`.

## 6. Metrik Keberhasilan PRT `[H]`
- ≥70% sesi user menyaksikan ≥1 aksi otonom PRT (loop hidup terasa).
- ≥30% user baru menjalankan ≥1 percakapan PRT di minggu pertama (chat sebagai onboarding).
- Pengingat backup PRT → ≥25% user melakukan ekspor ≥1 kali (metrik durability terpenting untuk model zero-storage).

## 7. Cakrawala (sesuai visi "perangkat sadar")
PRT adalah embrio "kesadaran operasional" untuk perangkat: pola yang sama (patroli → vital → laporan → saran) akan diekspor sebagai profil perangkat — drone-PRT, bot-PRT — yang berbagi satu otak user lewat gerbang (05 §6 playbook "perangkat menjaga dirinya"). Dalam jangka panjang, PRT membaca atlas connectome untuk menentukan *prioritas patroli* ala alokasi sumber daya saraf — langkah kecil yang bisa dijelaskan ke publik, tanpa klaim consciousness `[D/T]`.
