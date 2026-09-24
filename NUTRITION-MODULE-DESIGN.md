# Rancangan Modul Nutrisi — Atletik Pro Id (v2 — tanpa AI real-time)

> **Perubahan dari v1**: modul ini semula dirancang memanggil AI generatif
> real-time. Setelah dipertimbangkan (biaya per-panggilan yang harus
> dibebankan ke pelatih butuh sistem billing terpisah yang belum ada, dan
> mendesak menjelang 6 September), modul dipindah jadi **mesin deterministik**
> berbasis pedoman gizi olahraga baku — pola yang sama seperti
> `lib/periodization.js`/`lib/curves.js` yang sudah ada di aplikasi ini.
> AI generatif real-time didorong jadi opsi v3, terpisah, kalau suatu saat
> dibutuhkan.

---

## 1. Prinsip bahasa (tetap berlaku dari v1)

Pelatih & atlet **bukan ahli gizi**. Semua teks yang tampil ke mereka harus
bahasa sehari-hari + contoh makanan konkret (nasi campur, jukut, be siap,
dst — konteks Bali/Denpasar), bukan istilah teknis atau cuma angka
gram/kg. Angka teknis tetap dihitung di balik layar untuk akurasi, tapi
yang ditonjolkan ke pengguna adalah versi manusiawinya.

---

## 2. Field baru di profil atlet (input WAJIB saat atlet dibuat/diedit)

Ditambahkan ke `athlete.profile` (skema yang sudah ada di `db.json`),
diisi lewat `renderAthleteForm()` (Command Center) — sejajar dengan field
`usia`, `tinggi`, `berat` yang sudah ada:

```jsonc
{
  // ...field profile yang sudah ada (nama, kategori, event, usia, dst)...
  "alergiMakanan": "",       // teks bebas, wajib diisi (boleh "Tidak ada")
  "pantanganMakanan": ""     // teks bebas, wajib diisi — vegetarian saat hari
                              // raya, tidak makan daging tertentu, dll.
                              // (boleh "Tidak ada")
}
```

**Kenapa wajib diisi, bukan opsional**: supaya mesin nutrisi tidak pernah
menyarankan sesuatu yang berisiko tanpa sepengetahuan pelatih — field
kosong (belum diisi) berbeda dari field berisi "Tidak ada" (sudah dicek,
memang tidak ada pantangan).

Validasi di `routes/athletes.js` (fungsi create/update atlet): tolak
simpan kalau kedua field ini `undefined` (harus eksplisit string, boleh
kosong secara isi tapi field-nya harus ada) — pola validasi sama seperti
field wajib lain di file itu.

---

## 3. `lib/nutritionEngine.js` — fungsi murni, pola sama seperti `sprintEngine.js`

Input:
- `athlete.profile` (usia, jenisKelamin, berat, kategori, event, alergiMakanan, pantanganMakanan)
- Hasil `computePhase()` dari `lib/periodization.js`
- `CATEGORIES[kategori]` dari `lib/categories.js` (untuk tahu tipe dominan: sprint/power vs endurance)
- (Opsional, untuk penyesuaian halus) `computeACWR()` dari `lib/acwr.js` — beban tinggi minggu ini bisa menaikkan sedikit target karbohidrat/cairan hari itu

Output terstruktur (dipakai UI tanpa parsing teks bebas):

```jsonc
{
  "phase": "khusus", "phaseLabel": "Persiapan Khusus",
  "targets": {
    "kaloriKcalPerHari": 3200,       // dari kkal/kg BB × berat, disesuaikan fase
    "karbohidratGramPerHari": 476,    // g/kg BB × berat
    "proteinGramPerHari": 122,
    "lemakPersenKalori": 25,
    "airLiterPerHari": 3.6            // disesuaikan iklim panas Denpasar
  },
  "ringkasanSingkat": "Fokus karbo tinggi (nasi/ubi), air ekstra karena cuaca panas",
  "contohMenuHarian": [
    "Sarapan: nasi + telur + tempe + pisang",
    "Sebelum latihan: nasi jinggo porsi kecil / roti + pisang",
    "Setelah latihan (30 menit pertama): jukut + ayam + air kelapa",
    "Malam: nasi + ikan/ayam + sayur + buah"
  ],
  "peringatanKhusus": ["Perhatikan alergi: <isi dari profil>"],   // muncul HANYA kalau alergiMakanan/pantanganMakanan bukan "Tidak ada"
  "sumberPedoman": "Berbasis Buku Pintar Gizi Bagi Atlet, Kementerian Kesehatan RI (2021)."
}
```

**Dihitung ulang tiap dibuka** (bukan disimpan permanen) — sama seperti
program latihan. Tidak ada tombol "Generate", tidak ada biaya, tidak ada
ketergantungan API eksternal.

### ✅ Konstanta gizi (`lib/nutritionGuidelines.js`) — sumber resmi Kemenkes RI

**Update (setelah v2.1):** angka di file ini semula draf umum berbasis ACSM/IOC.
Sudah diganti dengan rujukan resmi **Buku Pintar Gizi Bagi Atlet, Kementerian
Kesehatan RI (2021)** — jauh lebih pas untuk konteks Indonesia, dan bisa
langsung disitasi di laporan PUM. Kategori `sprint_power`/`endurance` di
tabel karbohidrat kini eksplisit mengacu Tabel 1 buku ini (Power/Anaerobik
vs Endurance/Aerobik) — pembagian yang sudah dipakai di kode ternyata
sudah sejalan dengan klasifikasi resmi ini, tidak perlu diubah strukturnya.

Satu penyimpangan **sadar** dari buku Kemenkes: rekomendasi cairan presisi
(berbasis timbangan) dipertahankan di formula lama 1,25 L per kg BB hilang,
BUKAN 710 mL/kg seperti tertulis di buku — keputusan eksplisit dr. Adiartha
untuk tetap di sisi konservatif (lebih banyak cairan), bukan kelalaian
sinkronisasi.

Kerangka final (isi sudah diimplementasikan di `lib/nutritionGuidelines.js`,
direview dan disetujui):

```js
// lib/nutritionGuidelines.js — final, sumber Kemenkes RI (2021)
const KARBO_G_PER_KG_PER_HARI = {
  umum:     { sprint_power: 5, endurance: 6 },   // Persiapan Umum
  khusus:   { sprint_power: 6, endurance: 8 },   // Persiapan Khusus
  puncak:   { sprint_power: 6, endurance: 9 },   // Kompetisi/Puncak
  transisi: { sprint_power: 3, endurance: 4 },   // Transisi, volume minimal
};
const PROTEIN_G_PER_KG_PER_HARI = { sprint_power: 1.7, endurance: 1.5 };
const LEMAK_PERSEN_KALORI = 25;         // dalam rentang 20-35% Tabel 3 Kemenkes
const AIR_ML_PER_KG_BASE = 40;          // baseline harian (estimasi minimum)
const AIR_TAMBAHAN_ML_LATIHAN = 500;    // per hari latihan, iklim panas
// Cairan presisi (dengan timbangan, lib/hydrationCalc.js): 1.25 L per kg BB
// hilang — sengaja dipertahankan lebih tinggi dari 710 mL/kg versi Kemenkes.
```

`sprint_power` = kategori `sprint` & `lompat`; `endurance` = `menengah` &
`jauh` — pembagian ini kini eksplisit mengacu Tabel 1 Kemenkes
(Power/Anaerobik vs Endurance/Aerobik), bukan cuma konvensi internal.

---

## 4. `lib/nutritionMenuExamples.js` — contoh menu Bali/Indonesia (statis, dikurasi manual)

Bukan digenerate AI — daftar contoh menu per kebutuhan kalori/kondisi,
dikurasi manual (Bapak/tim bisa isi & perluas kapan saja, tanpa sentuh
kode lain). Draf awal perlu diisi contoh makanan yang representatif untuk
atlet remaja Denpasar — saya sarankan Bapak atau tim gizi PASI yang isi
list ini karena butuh pengetahuan lokal yang akurat (porsi realistis,
harga terjangkau untuk keluarga atlet, dll), bukan saya tebak.

---

## 5. Endpoint (semua GET, tidak ada aksi "generate")

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/api/athletes/:athleteId/nutrition` | Command Center — hitung & tampilkan target lengkap + contoh menu |

Perluasan endpoint yang **sudah ada** (bukan endpoint baru), field
`nutritionToday` (isi = `ringkasanSingkat` dari hasil hitung):

- `GET /api/athletes/portal-day` (Mode Lapangan/HQ)
- `GET /api/athlete/today` (Portal Atlet)

Tidak perlu status `active`/`superseded`, tidak perlu tabel `nutritionPlans`
di `db.json` — semua dihitung langsung dari profil + fase saat itu.

---

## 6. Validasi sebelum athlete-form bisa disimpan

Di `renderAthleteForm()` (`public/app.js`) dan endpoint create/update
atlet (`routes/athletes.js`): tambah 2 field wajib baru (`alergiMakanan`,
`pantanganMakanan`) ke form yang sudah ada — pola sama seperti field
wajib lain di form itu (validasi client-side + server-side).

---

## 7. Fase 2 (opsional, nanti — TIDAK untuk 6 September)

AI generatif real-time (variasi menu lebih personal, narasi lebih kaya)
bisa ditambahkan belakangan sebagai lapisan opsional di atas mesin
deterministik ini — bukan pengganti. Kalau nanti dikerjakan, perlu
rancangan billing/metering terpisah (di luar cakupan dokumen ini).

---

## 8. Yang masih perlu Bapak putuskan/isi (bukan keputusan teknis, tapi konten)

- ~~Isi angka final di `lib/nutritionGuidelines.js`~~ — **SELESAI**: sudah memakai Buku Pintar Gizi Bagi Atlet, Kementerian Kesehatan RI (2021), direview & disetujui dr. Adiartha.
- Isi daftar menu di `lib/nutritionMenuExamples.js` (perlu pengetahuan lokal, bukan tebakan saya).
- Teks placeholder untuk field `alergiMakanan`/`pantanganMakanan` di form (mis. contoh isian yang membantu pelatih paham harus diisi apa).

---

## 9. Penambahan v2.1 — hasil review rujukan internasional

### 9a. Protokol karbo-loading pra-kompetisi

Berlaku HANYA untuk nomor endurance yang durasi lombanya cukup panjang
(indikasi umum: >~75-90 menit kontinu — mis. 10.000m ke atas, atau
half/full marathon kalau ada di `lib/categories.js`; BUKAN untuk 800m/1500m
meski masuk grup `endurance` di tabel harian). Cek daftar `event` aktual di
`lib/categories.js` untuk menentukan batasnya secara pasti — jangan
diasumsikan dari nama grup `endurance` saja.

Aktif otomatis saat tanggal sekarang berada 24–48 jam sebelum
`periodization.compDate` DAN nomor atlet memenuhi syarat. Saat aktif:
target karbohidrat naik ke 10–12 g/kg/hari (menggantikan angka fase
harian biasa untuk window ini), dengan catatan singkat bahasa awam
(kurangi serat/lemak sementara, perbanyak nasi/kentang/roti).

Field tambahan di output `nutritionEngine`:
```jsonc
"karboLoading": {
  "aktif": true,
  "hariMenujuKompetisi": 2,
  "targetGramPerKgHariIni": 11,
  "catatan": "H-2 menuju kompetisi: perbanyak nasi/roti/kentang, kurangi dulu sayur berserat tinggi & gorengan."
}
// null kalau tidak berlaku
```

Karena ini **sensitif waktu**, tampilkan juga sebagai peringatan menonjol
di Mode Lapangan/Portal Atlet (`nutritionToday`), bukan cuma di tab
Nutrisi lengkap — supaya tidak terlewat.

### 9b. Rekomendasi cairan: dua opsi

- **Tanpa timbangan (minimum)** — formula flat yang sudah ada
  (`AIR_ML_PER_KG_BASE` + `AIR_TAMBAHAN_ML_LATIHAN`), **wajib dilabeli
  eksplisit "estimasi minimum"** di UI, bukan angka final.
- **Dengan timbangan (direkomendasikan)** — kalau pelatih mencatat berat
  badan atlet sebelum & sesudah sesi (field baru opsional di form
  monitoring log: `beratSebelumKg`, `beratSesudahKg`, opsional
  `cairanDiminumMlSaatSesi`), hitung kehilangan cairan aktual:
  `kehilanganL = (beratSebelum - beratSesudah) + (cairanDiminumMl / 1000)`,
  rekomendasi ganti = `kehilanganL × 1.25` liter dalam beberapa jam
  setelah sesi (rentang lazim 1.25–1.5×; pakai titik tengah).
  Field ini opsional — kalau tidak diisi, tampilkan saja versi minimum.

Field tambahan di output `nutritionEngine` (atau endpoint terpisah kalau
lebih pas dihitung per-sesi, bukan per-hari — putuskan saat implementasi):
```jsonc
"cairan": {
  "minimumLiter": 3.6,
  "presisiLiter": null,        // null kalau belum ada data timbangan sesi terakhir
  "presisiDariSesiTanggal": null
}
```
