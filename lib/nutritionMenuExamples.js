// Contoh menu harian — statis, dikurasi manual (BUKAN digenerate AI).
//
// ISI SEMENTARA: draf awal dari NUTRITION-MODULE-DESIGN.md §4, representatif
// konteks Bali/Denpasar tapi BELUM ditinjau tim gizi. Tim gizi PASI
// disarankan mengisi & memperluas daftar ini sesuai pengetahuan lokal
// (porsi realistis, harga terjangkau untuk keluarga atlet) — lihat §4/§8
// dokumen rancangan. Menambah/mengubah isi array ini TIDAK perlu menyentuh
// lib/nutritionEngine.js atau kode lain.
const MENU_HARIAN_DEFAULT = [
  'Sarapan: nasi + telur + tempe + pisang',
  'Sebelum latihan: nasi jinggo porsi kecil atau roti + pisang',
  'Setelah latihan (30 menit pertama): jukut + ayam + air kelapa',
  'Malam: nasi + ikan/ayam + sayur + buah',
];

module.exports = { MENU_HARIAN_DEFAULT };
