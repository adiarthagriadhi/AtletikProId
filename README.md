# Atletik Pro Id

Platform manajemen program latihan atletik multi-pelatih (coach-only).
Mencakup autentikasi, isolasi data per pelatih, manajemen atlet, pencatatan
tes, monitoring pasca-latihan, dan mesin penyusunan program otomatis untuk
empat kategori: **Sprint, Menengah, Jauh, dan Lompat**. Juga tersedia
kalender visual per bulan, ekspor program ke Word, edit/hapus entri
tes/monitoring, dan mode gelap. Integrasi pembayaran Midtrans **belum** ada
— lihat bagian "Yang belum ada" di bawah.

## 1. Arsitektur

- **Backend:** Node.js + Express, tanpa dependensi native/compiled.
- **Database:** file JSON tunggal (`data/db.json`), atomic write.
- **Autentikasi:** JWT di cookie `httpOnly`, password di-hash dengan bcrypt.
- **Frontend:** HTML/CSS/JS polos di `public/`, tanpa framework/build step.
- **Logika domain** (fase periodisasi, kurva mingguan, personalisasi, ACWR,
  generate sesi Sprint) dipisah ke `lib/` sebagai fungsi murni — mudah diuji
  dan mudah diperluas ke kategori lain nanti.

Program latihan **dihitung ulang setiap kali dibuka** (bukan tabel statis):
fase periodisasi otomatis mengikuti sisa waktu ke kompetisi, dan volume
disesuaikan otomatis lewat dua faktor pengali (level prestasi & risiko ACWR)
yang ditampilkan transparan ke pelatih.

## 2. Instalasi & menjalankan (lokal atau server)

Butuh **Node.js versi 16 ke atas**. Cek dengan `node -v`.

```bash
cd mix-interval-coach
npm install
cp .env.example .env
```

Edit `.env`:
- **`JWT_SECRET`** — wajib diisi string acak panjang, mis. hasil dari
  `openssl rand -hex 32`. Jangan pakai contoh bawaan.
- `NODE_ENV=production` — set ini kalau situs sudah diakses lewat HTTPS
  publik (cookie login jadi hanya dikirim lewat koneksi aman).
- `ADMIN_SETUP_KEY` — kode rahasia bebas untuk membuat akun admin pertama
  lewat halaman web (lihat bagian 3).

Jalankan:

```bash
npm start
```

Server berjalan di `PORT` dari `.env` (default 3000).

**Untuk produksi**, jalankan lewat process manager (PM2) supaya otomatis
restart saat crash/reboot:

```bash
npm install -g pm2
pm2 start server.js --name mix-interval-coach
pm2 save
pm2 startup
```

## 3. Membuat akun admin pertama

**Cara A — lewat halaman web** (praktis untuk shared hosting tanpa SSH):
set `ADMIN_SETUP_KEY` di environment variable, redeploy, lalu buka tautan
"Setup Admin Pertama Kali" di halaman masuk. Endpoint ini **terkunci
otomatis selamanya** setelah admin pertama berhasil dibuat.

**Cara B — lewat terminal/SSH:**

```bash
npm run create-admin
```

## 4. Deploy ke Hostinger

Aplikasi ini adalah server Node.js/Express standar. Di hosting Hostinger
yang mendukung Node.js (paket Business/Cloud dengan hPanel):

1. Unggah folder `mix-interval-coach/` (lewat File Manager, FTP, atau Git)
   ke server.
2. Di hPanel → **Setup Node.js App**, arahkan *Application Startup File*
   ke `server.js`, dan set *Application Root* ke folder ini.
3. Isi environment variable lewat panel hPanel (jangan unggah file `.env`
   langsung): `JWT_SECRET`, `NODE_ENV=production`, `ADMIN_SETUP_KEY`.
4. Jalankan `npm install` lewat terminal hPanel (atau tombol "Run NPM
   Install" bila tersedia), lalu **Restart** aplikasi.
5. Buka domain Anda — halaman masuk Atletik Pro Id akan muncul.
6. Ikuti bagian 3 di atas untuk membuat admin pertama.

⚠️ **Backup**: seluruh data (akun, atlet, tes, monitoring) ada di satu file
`data/db.json`. Cadangkan file ini secara berkala (mis. lewat cron job
hPanel yang menyalinnya ke lokasi lain) — ini satu-satunya sumber data
aplikasi.

## 5. Struktur folder

```
server.js               entry point Express, mount semua route
db.js                   penyimpanan JSON (data/db.json), atomic write
middleware/
  auth.js                 JWT httpOnly cookie, requireAuth/requireAdmin
  rateLimit.js             pembatas percobaan login (anti brute-force)
routes/
  auth.js                  registrasi (selalu jadi coach), login, logout,
                            setup admin pertama kali (sekali pakai)
  athletes.js               CRUD atlet, isolasi per coachId di server
  tests.js                  riwayat tes Sprint (VO2, RAST 6x, HR), append-only
  program.js                 GET program latihan, dihitung ulang tiap panggil
  monitoring.js              log RPE+durasi pasca-latihan, status ACWR
  admin.js                   daftar pelatih (khusus admin)
lib/                     logika domain murni, tanpa I/O
  periodization.js          hitung fase dari sisa waktu ke kompetisi
  curves.js                  4 set kurva mingguan (GPP/SPP/Taper/Transisi)
  personalization.js         pengali level prestasi x risiko ACWR
  acwr.js                     training load & ACWR (pembagi dinamis)
  benchmarks.js               formula RAST, tabel benchmark 100m
  sprintEngine.js              generate sesi konkret per nomor (100/200/400m)
scripts/
  create-admin.js            skrip CLI membuat akun admin
public/
  index.html, style.css, app.js   frontend (tanpa build step)
data/
  db.json                    dibuat otomatis saat server pertama dijalankan
```

## 6. Isolasi akses

Setiap endpoint atlet/tes/monitoring mengecek ulang di server:
`coachId` atlet harus sama dengan pelatih yang login, atau pelatih tersebut
admin. Ini ditegakkan di setiap request, bukan cuma disembunyikan di
tampilan — percobaan akses atlet pelatih lain lewat API selalu ditolak
dengan status `403`, terlepas dari apa yang dikirim dari klien.

## 7. Logika program (ringkas)

1. **Fase periodisasi** — dari sisa waktu ke kompetisi: `>9 minggu` =
   Persiapan Umum, `3–9 minggu` = Persiapan Khusus, `≤3 minggu` =
   Kompetisi/Puncak. Fase yang tidak sempat terjadi (siklus pendek)
   dilewati sepenuhnya, bukan dipaksakan proporsional.
2. **Kurva mingguan** — beda fase, beda konten: Persiapan Umum pakai sesi
   conditioning umum (belum spesifik nomor), Persiapan Khusus & Puncak
   pakai sesi spesifik nomor (Puncak = volume menurun monoton, intensitas
   naik), Transisi = aktivitas bebas volume minimal.
3. **Personalisasi** — dua pengali berlapis: level prestasi (dari benchmark
   waktu 100m: Elite/Kompetitif ×1,0, Berkembang ×0,92, Pemula ×0,80) ×
   risiko ACWR (ACWR >1,5 dari riwayat monitoring 14+ hari → ×0,75).
   Ditampilkan transparan di kartu Program, tidak diam-diam mengubah angka.
4. **Generate sesi** — 3 sesi/minggu per nomor (100m/200m/400m), beda skema
   & rentang intensitas, dengan target RPE (Borg CR10), bank gerakan
   kekuatan sesuai fase, dan checklist teknik kualitatif (khusus fase
   Persiapan Khusus & Puncak).

Nilai-nilai kurva & skema sesi adalah **rancangan awal** (belum divalidasi
di dunia nyata) — tim pengembang/pelatih disarankan meninjau & menyetel
ulang angkanya (`lib/curves.js`, `lib/sprintEngine.js`) seiring pemakaian.

## 8. Akses trial & lifetime (sudah aktif)

- **Trial 30 hari** sejak `trialStartedAt` (diisi otomatis saat daftar).
- Selama trial: hampir tanpa batas (soft cap 20 atlet).
- Setelah trial habis tanpa lifetime: maksimal **2 atlet**; data lama tetap bisa dipakai.
- Admin bisa **Grant / Cabut Lifetime** dari Panel Admin.
- Banner status trial/expired muncul di dashboard pelatih.
- **Pembayaran Midtrans Snap** untuk Lifetime (lihat bagian 9).

## 9. Integrasi Midtrans Snap

1. Daftar di Midtrans, buat merchant Sandbox dulu.
2. Isi di `.env`:
   - `MIDTRANS_SERVER_KEY=SB-Mid-server-...`
   - `MIDTRANS_CLIENT_KEY=SB-Mid-client-...`
   - `MIDTRANS_IS_PRODUCTION=false`
   - `LIFETIME_PRICE_IDR=299000`
   - `APP_PUBLIC_URL=https://domain-anda.id`
3. Dashboard Midtrans → Settings → Configuration:
   - **Payment Notification URL**: `https://domain-anda.id/api/payments/notification`
4. Restart server. Tombol **Upgrade Lifetime** muncul di banner trial/expired.
5. Production: ganti key production, set `MIDTRANS_IS_PRODUCTION=true`.

Alur: create-snap → popup Snap → webhook notification (signature verified) → `hasLifetimeAccess=true`.

Tanpa key Midtrans, tombol bayar menampilkan error konfigurasi; admin tetap bisa grant manual.

## 10. Modul Nutrisi

Rencana nutrisi harian per atlet — **mesin deterministik** berbasis pedoman
gizi olahraga baku (bukan AI generatif; lihat `NUTRITION-MODULE-DESIGN.md`
untuk kenapa & rancangan lengkap), pola sama seperti `lib/periodization.js`.
Dihitung ULANG setiap tab dibuka dari data yang sudah ada di sistem (profil
atlet, fase periodisasi, ACWR) — tidak ada tombol "Generate", tidak ada
biaya/API eksternal, tidak ada yang disimpan permanen.

1. **Field profil baru (wajib diisi)**: `alergiMakanan`, `pantanganMakanan`
   — ditambahkan ke form Tambah/Ubah Atlet. Atlet lama perlu diedit sekali
   untuk melengkapi field ini sebelum rencana nutrisinya bebas dari
   peringatan "profil belum lengkap".
2. Endpoint (`routes/nutrition.js`, butuh login pelatih/admin):
   - `GET /api/athletes/:athleteId/nutrition` — hitung & kembalikan rencana lengkap.
   - `GET /api/athlete/nutrition` — versi Portal Atlet (baca saja, punya atlet yang login).
3. `GET /api/athletes/portal-day` dan `GET /api/athlete/today` sudah menyertakan
   `nutritionToday` (ringkasan satu baris, `null` kalau berat badan atlet belum diisi).
4. UI: tab **Nutrisi** ada di Command Center (sidebar modul atlet), Mode Lapangan
   (menu atlet → Nutrisi), dan Portal Atlet (bottom nav + ringkasan di layar "Hari ini")
   — semuanya read-only, tidak ada aksi generate/simpan.

### ⚠️ Draf, wajib direview sebelum dipakai peserta sungguhan

- `lib/nutritionGuidelines.js` — konstanta gizi (gram karbo/protein per kg
  BB, dst) berbasis pedoman umum ACSM/IOC sebagai kerangka awal, **belum
  divalidasi klinis**. Isi angka final perlu ditinjau fisiolog olahraga.
- `lib/nutritionMenuExamples.js` — daftar contoh menu Bali/Denpasar, draf
  awal yang perlu diperluas dengan pengetahuan lokal (porsi realistis,
  harga terjangkau). Mengubah isi kedua file ini tidak perlu menyentuh
  kode lain (`lib/nutritionEngine.js`).

## 11. Yang belum ada

- **Ekspor ke Excel** (ekspor ke Word sudah ada).
- **HTTPS** tidak disediakan aplikasi ini sendiri — aktifkan lewat panel Hostinger.
- **Reset password lewat email** belum ada.
- **Langganan berulang (bulanan)** — saat ini hanya Lifetime one-time.

## 12. Akun Atlet Mandiri, Selling Page & Coach AI

### Atlet mandiri (sport enthusiast tanpa pelatih)
- Portal atlet (`/athlete`) kini punya dua jalur: **berlatih mandiri** atau
  **kode undangan pelatih** (jalur lama, tidak berubah).
- Atlet mandiri memakai struktur data yang sama: satu baris `athletes`
  (`coachId: null`, `selfCoached: true`, `ownerAthleteUserId`) + satu
  `athleteLinks` aktif (`selfCoached: true`). Semua endpoint portal atlet
  lama langsung berlaku. Pelatih tidak melihat atlet mandiri; admin melihatnya
  berlabel "Atlet mandiri".
- Profil dibuat dari kuesioner (`lib/selfProfile.js`): kategori/nomor, level,
  tanggal lomba (atau siklus 12 minggu), catatan waktu (lari menengah/jauh) atau
  waktu 100 m (sprint/lompat). Bila atlet belum tahu, dipakai estimasi dari
  level dan ditandai `estimated`.
- Paket (`lib/athleteAccess.js`): coba Premium `ATHLETE_TRIAL_DAYS` hari →
  **Gratis** (ringkasan sesi, target nutrisi, catat latihan, 1 tanya Coach/hari)
  atau **Premium** bulanan/tahunan via Midtrans (detail sesi + panduan
  pemanasan–inti–pendinginan, menu mingguan, 5 tanya Coach/hari). Detail
  berbayar dipotong di server, bukan hanya disembunyikan di tampilan.
- Endpoint: `POST /api/athlete/self/setup`, `GET|PUT /api/athlete/self/profile`,
  `POST /api/payments/athlete/create-snap`, `GET /api/payments/athlete/my-status`.
  Webhook Midtrans yang sama (`/api/payments/notification`) mengenali order
  atlet dari prefix `ATPRO-AM-` / `ATPRO-AA-`.

### Selling page (halaman depan)
- Pengunjung pertama melihat funnel kuesioner (`public/funnel.js`): hero →
  7 pertanyaan → animasi "menyusun program" → hasil. Hasil memuat sesi pertama
  lengkap + contoh sarapan (gratis), sisanya terkunci, analisis Coach AI,
  form daftar (langsung membuat akun + profil), kirim ke email, dan harga.
- Landing lama khusus pelatih tetap ada: menu **Untuk Pelatih** atau `/?pelatih=1`.
  `/?masuk=1` / `/?daftar=1` tetap membuka form pelatih.
- Endpoint publik: `GET /api/public/quiz-options`, `POST /api/public/trial-plan`
  (atlet virtual di memori — tidak menyimpan apa pun), `POST /api/public/trial-insight`,
  `POST /api/public/trial-email`, `GET /api/public/trial-lead/:token`.
- **Kirim ke email** memakai SMTP yang sudah ada. Email pengunjung disimpan di
  koleksi baru `leads` (tabel `c_leads`, dibuat otomatis) beserta jawaban,
  persetujuan marketing (`consentMarketing`), dan penanda bila kemudian
  mendaftar (`convertedAthleteUserId`). Tautan di email (`/?program=TOKEN`)
  membuka kembali hasilnya.

### Coach AI (hemat token)
- `lib/aiCoach.js` memanggil Claude lewat `@anthropic-ai/sdk`:
  1. **Catatan harian** di beranda portal — maks. 1 panggilan per atlet per hari
     (disimpan di `athletes[].aiDaily`).
  2. **Tanya Coach** — kuota harian per paket (`AI_ASK_*_PER_DAY`), tanpa riwayat
     percakapan (tiap pertanyaan berdiri sendiri).
  3. **Analisis hasil kuesioner** di selling page — di-cache per profil jawaban.
- Hemat token: konteks dikirim sebagai ringkasan beberapa baris, jawaban 2–4
  kalimat, `effort: low`, cache hasil, plus batas total `AI_DAILY_LIMIT`.
- Tanpa `ANTHROPIC_API_KEY`, semua kartu tetap tampil memakai teks berbasis aturan.
- Khusus atlet mandiri; atlet binaan pelatih tidak mendapat Coach AI.

### Setelah deploy
1. Backup database MySQL dulu (phpMyAdmin).
2. Upload kode, `npm install` (paket baru: `@anthropic-ai/sdk`), restart.
3. Tambahkan env baru sesuai `.env.example` (semuanya opsional).
4. Midtrans: tidak perlu URL notifikasi baru.
