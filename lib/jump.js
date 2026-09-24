// Tabel benchmark di file ini diambil dari implementasi lama
// (sprint-coach-server/public/app.js:1018-1039) sebagai acuan angka yang
// sudah divalidasi sebelumnya. SLJ & Vertical Jump memakai referensi umum
// atlet terlatih (bukan tabel norma resmi tunggal); prestasi kompetisi
// dianchor ke rekor dunia terverifikasi (Powell 8,95m 1991 / Chistyakova
// 7,52m 1988 / Sotomayor 2,45m 1993 / Mahuchikh 2,10m 2024). Batas tier
// adalah interpolasi indikatif tim pengembang, bukan standar resmi tunggal.
const { classifyByMin } = require('./benchmarks');

// Standing Long Jump (cm)
const BENCH_SLJ_L = [{ label: 'Sangat Baik', min: 250 }, { label: 'Baik', min: 226 }, { label: 'Rata-rata', min: 196 }, { label: 'Perlu Ditingkatkan', min: -Infinity }];
const BENCH_SLJ_P = [{ label: 'Sangat Baik', min: 200 }, { label: 'Baik', min: 176 }, { label: 'Rata-rata', min: 146 }, { label: 'Perlu Ditingkatkan', min: -Infinity }];

// Vertical Jump reach (cm)
const BENCH_VJ_L = [{ label: 'Sangat Baik', min: 65 }, { label: 'Baik', min: 51 }, { label: 'Rata-rata', min: 41 }, { label: 'Perlu Ditingkatkan', min: -Infinity }];
const BENCH_VJ_P = [{ label: 'Sangat Baik', min: 58 }, { label: 'Baik', min: 46 }, { label: 'Rata-rata', min: 36 }, { label: 'Perlu Ditingkatkan', min: -Infinity }];

// Prestasi kompetisi (cm) — Lompat Jauh
const BENCH_LOMPAT_JAUH_L = [{ label: 'Elite Dunia', min: 800 }, { label: 'Elite Asia/Nasional', min: 720 }, { label: 'Kompetitif', min: 620 }, { label: 'Berkembang', min: 500 }, { label: 'Pemula', min: -Infinity }];
const BENCH_LOMPAT_JAUH_P = [{ label: 'Elite Dunia', min: 680 }, { label: 'Elite Asia/Nasional', min: 600 }, { label: 'Kompetitif', min: 500 }, { label: 'Berkembang', min: 400 }, { label: 'Pemula', min: -Infinity }];

// Prestasi kompetisi (cm) — Lompat Tinggi
const BENCH_LOMPAT_TINGGI_L = [{ label: 'Elite Dunia', min: 225 }, { label: 'Elite Asia/Nasional', min: 205 }, { label: 'Kompetitif', min: 180 }, { label: 'Berkembang', min: 150 }, { label: 'Pemula', min: -Infinity }];
const BENCH_LOMPAT_TINGGI_P = [{ label: 'Elite Dunia', min: 190 }, { label: 'Elite Asia/Nasional', min: 172 }, { label: 'Kompetitif', min: 150 }, { label: 'Berkembang', min: 125 }, { label: 'Pemula', min: -Infinity }];

const REF_LOMPAT_MARK = {
  lompat_jauh: 'Acuan: rekor dunia putra 8,95m (Mike Powell, 1991); putri 7,52m (Galina Chistyakova, 1988).',
  lompat_tinggi: 'Acuan: rekor dunia putra 2,45m (Javier Sotomayor, 1993); putri 2,10m (Yaroslava Mahuchikh, 2024).',
};
const REF_JUMP_TEST = 'Acuan umum atlet terlatih (rentang lazim dikutip literatur kondisi fisik atletik) — bukan tabel norma resmi tunggal.';

function sljTiers(jenisKelamin) {
  return jenisKelamin === 'P' ? BENCH_SLJ_P : BENCH_SLJ_L;
}

function vjTiers(jenisKelamin) {
  return jenisKelamin === 'P' ? BENCH_VJ_P : BENCH_VJ_L;
}

// `event` = 'lompat_jauh' | 'lompat_tinggi'
function lompatMarkTiers(event, jenisKelamin) {
  const L = jenisKelamin !== 'P';
  if (event === 'lompat_tinggi') return L ? BENCH_LOMPAT_TINGGI_L : BENCH_LOMPAT_TINGGI_P;
  return L ? BENCH_LOMPAT_JAUH_L : BENCH_LOMPAT_JAUH_P;
}

// `markM` = prestasi kompetisi dalam meter (dikonversi ke cm untuk dibandingkan
// dengan tabel, konsisten dengan kode lama: markNum * 100).
function classifyCompMark(event, jenisKelamin, markM) {
  if (markM == null) return null;
  return classifyByMin(markM * 100, lompatMarkTiers(event, jenisKelamin));
}

module.exports = {
  BENCH_SLJ_L,
  BENCH_SLJ_P,
  BENCH_VJ_L,
  BENCH_VJ_P,
  REF_LOMPAT_MARK,
  REF_JUMP_TEST,
  sljTiers,
  vjTiers,
  lompatMarkTiers,
  classifyCompMark,
};
