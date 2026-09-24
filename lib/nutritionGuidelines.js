// Konstanta gizi olahraga.
//
// Sumber: Buku Pintar Gizi Bagi Atlet, Kementerian Kesehatan RI (2021).
// Kategori sprint_power/endurance mengikuti Tabel 1 buku ini (Power/Anaerobik
// vs Endurance/Aerobik). Karbo-loading mengacu Tabel 3 buku ini. Rekomendasi
// cairan presisi sengaja dipertahankan lebih konservatif (1.25 L/kg)
// dibanding angka Kemenkes (710 mL/kg) — keputusan dr. Adiartha.
//
// Mengubah angka di file ini TIDAK perlu menyentuh lib/nutritionEngine.js.

// Gram karbohidrat per kg berat badan per hari, per fase periodisasi ×
// tipe kategori ('sprint_power' = sprint & lompat, 'endurance' = menengah
// & jauh — lihat CATEGORIES di lib/categories.js).
const KARBO_G_PER_KG_PER_HARI = {
  umum: { sprint_power: 5, endurance: 6 }, // Persiapan Umum
  khusus: { sprint_power: 6, endurance: 8 }, // Persiapan Khusus
  puncak: { sprint_power: 6, endurance: 9 }, // Kompetisi/Puncak
  transisi: { sprint_power: 3, endurance: 4 }, // Transisi, volume minimal
};

// Gram protein per kg berat badan per hari.
const PROTEIN_G_PER_KG_PER_HARI = { sprint_power: 1.7, endurance: 1.5 };

const LEMAK_PERSEN_KALORI = 25;

const AIR_ML_PER_KG_BASE = 40; // baseline harian
const AIR_TAMBAHAN_ML_LATIHAN = 500; // per hari latihan, iklim panas (mis. Denpasar)

// Penyesuaian halus opsional saat beban latihan (ACWR) sedang tinggi —
// angka kecil & konservatif, gampang disetel tim gizi. Ambang sama dengan
// zona "Waspada" yang sudah dipakai di UI ACWR (lihat acwrStatusInfo di app.js).
const ACWR_TINGGI_THRESHOLD = 1.3;
const KARBO_BOOST_GRAM_ACWR_TINGGI = 30;
const AIR_BOOST_ML_ACWR_TINGGI = 300;

const SUMBER_PEDOMAN = 'Berbasis Buku Pintar Gizi Bagi Atlet, Kementerian Kesehatan RI (2021).';

// --- v2.1: protokol karbo-loading pra-kompetisi (§9a) ---
// Hanya nomor endurance yang durasi lombanya cukup panjang (indikasi umum
// >~75-90 menit kontinu) — BUKAN semua nomor grup 'endurance' di tabel
// harian di atas (800m/1500m sengaja TIDAK masuk). Dikonfirmasi manual dari
// daftar CATEGORIES.jauh.events di lib/categories.js, bukan diasumsikan
// dari nama grup. 5000m dikecualikan (umumnya selesai jauh di bawah
// ambang durasi ini bahkan di level junior/rekreasional).
const KARBO_LOADING_QUALIFYING_EVENTS = ['10000m', 'half_marathon', 'marathon'];

// Jendela aktif: H-1 s/d H-2 sebelum compDate. Sistem ini hanya menyimpan
// compDate sebagai tanggal (tanpa jam start lomba), jadi "24-48 jam
// sebelum" didekati dalam granularitas hari (sama seperti perhitungan
// fase di lib/periodization.js) — H-1 ≈ 24 jam, H-2 ≈ 48 jam dari tengah
// hari ke tengah hari.
const KARBO_LOADING_WINDOW_DAYS_MIN = 1;
const KARBO_LOADING_WINDOW_DAYS_MAX = 2;

// Target 10-12 g/kg/hari — sesuai Kemenkes "8-12 g/kg untuk persiapan
// pertandingan daya tahan" (Buku Pintar Gizi Bagi Atlet, Tabel 3). Dipakai
// titik tengah rentang 10-12 (bukan ditaper per hari, karena dokumen
// rancangan tidak menentukan kurva taper terpisah untuk H-1 vs H-2).
const KARBO_LOADING_TARGET_G_PER_KG_MIN = 10;
const KARBO_LOADING_TARGET_G_PER_KG_MAX = 12;

module.exports = {
  KARBO_G_PER_KG_PER_HARI,
  PROTEIN_G_PER_KG_PER_HARI,
  LEMAK_PERSEN_KALORI,
  AIR_ML_PER_KG_BASE,
  AIR_TAMBAHAN_ML_LATIHAN,
  ACWR_TINGGI_THRESHOLD,
  KARBO_BOOST_GRAM_ACWR_TINGGI,
  AIR_BOOST_ML_ACWR_TINGGI,
  SUMBER_PEDOMAN,
  KARBO_LOADING_QUALIFYING_EVENTS,
  KARBO_LOADING_WINDOW_DAYS_MIN,
  KARBO_LOADING_WINDOW_DAYS_MAX,
  KARBO_LOADING_TARGET_G_PER_KG_MIN,
  KARBO_LOADING_TARGET_G_PER_KG_MAX,
};
