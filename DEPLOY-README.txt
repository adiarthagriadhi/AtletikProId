Atletik Pro Id — paket deploy (final)
=======================================

Isi paket ini kode aplikasi lengkap (tanpa node_modules/.git) PLUS
data/db.json — data produksi Anda saat ini (akun & atlet yang sudah ada),
supaya begitu di-deploy, server baru langsung punya data yang sama dengan
yang Anda pakai sekarang. .env asli TIDAK disertakan (berisi secret) —
pakai .env.example sebagai gantinya.

Termasuk seluruh perbaikan sesi ini: grafik VDOT/RAST/dll. yang kepotong
di Mode Lapangan, scroll Log/Tes/Nutrisi yang macet di HP asli, tab
Nutrisi (3 kartu terpisah + kutipan Kemenkes RI), navigasi tanggal Jadwal,
scroll roster atlet di Markas, dan jarak antar-kartu yang diperlebar untuk
kemudahan swipe di HP.

Langkah deploy
---------------
1. Upload/extract seluruh isi folder ini ke server.
2. npm install
3. cp .env.example .env
   lalu WAJIB isi JWT_SECRET dengan string acak yang baru & rahasia
   (jangan pakai isi contoh di file). Isi variabel lain sesuai kebutuhan
   (lihat komentar di .env.example — PORT biasanya sudah ditentukan
   platform hosting, MIDTRANS_* opsional kalau fitur pembayaran belum
   dipakai).
4. npm start
   (atau lewat process manager platform Anda, mis. pm2/systemd/panel
   Node.js Hostinger — perintah start-nya "node server.js")

Sudah diverifikasi sebelum dikirim: paket ini di-boot langsung dari hasil
extract (bukan dari folder kerja) dan merespons HTTP 200 tanpa error.

Catatan penting soal data/db.json
-----------------------------------
File ini adalah "database" aplikasi — server membaca & menulis
langsung ke file JSON ini, tidak ada database eksternal. Beberapa hal
yang perlu diperhatikan saat deploy:

- Pastikan folder data/ bisa DITULIS oleh proses Node (permission).
- Kalau platform hosting Anda punya filesystem EPHEMERAL (mis. container
  yang di-reset tiap deploy/restart — umum di beberapa PaaS gratis),
  data/db.json akan HILANG setiap restart. Untuk Hostinger VPS/hosting
  Node biasa, filesystem-nya persisten, jadi ini aman — tapi kalau Anda
  pindah ke platform lain nanti, cek dulu apakah storage-nya persisten.
- BACKUP data/db.json secara berkala (cukup salin file-nya) — tidak ada
  mekanisme backup otomatis bawaan aplikasi.
- Kalau server sekarang (lama) masih jalan dan menerima input dari
  pengguna SETELAH zip ini dibuat, data/db.json di paket ini akan basi.
  Idealnya: matikan/jangan pakai server lama begitu server baru live,
  atau ambil db.json terbaru sesaat sebelum switch-over kalau ada jeda.

Verifikasi checklist singkat setelah live
-------------------------------------------
- Buka domain Anda → halaman login harus muncul (bukan error 500 —
  kalau error 500 saat start, cek log: biasanya JWT_SECRET belum diisi).
- Login pakai akun coach/admin yang sudah ada → data atlet harus tampil
  seperti biasa.
- Coba satu aksi tulis (mis. tambah log monitoring) → refresh → pastikan
  tersimpan (membuktikan folder data/ writable).
- Buka Mode Lapangan & Portal Atlet di HP asli → cek scroll di halaman
  Log/Tes/Nutrisi dan tab Nutrisi berjalan lancar (perbaikan sesi ini).

Catatan repo
-------------
Perubahan kode di paket ini BELUM di-commit ke git di working directory
sumbernya saat paket ini dibuat (kalau Anda perlu histori commit yang
rapi, minta itu secara terpisah).
