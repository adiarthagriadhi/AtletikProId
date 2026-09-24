// Formula & tabel benchmark di file ini diambil dari implementasi lama
// (sprint-coach-server/public/app.js) sebagai acuan angka yang sudah
// divalidasi sebelumnya — bukan standar resmi PASI/World Athletics tunggal,
// melainkan interpolasi indikatif tim pengembang.

const RAST_DISTANCE_M = 35;

function calcRAST(bodyWeightKg, times) {
  const valid = (times || []).filter((t) => t && t > 0);
  if (valid.length < 6 || !bodyWeightKg) return null;
  const powers = times.map((t) => (bodyWeightKg * RAST_DISTANCE_M * RAST_DISTANCE_M) / (t * t * t));
  const peak = Math.max(...powers);
  const min = Math.min(...powers);
  const avg = powers.reduce((a, b) => a + b, 0) / powers.length;
  const totalTime = times.reduce((a, b) => a + b, 0);
  const fatigueIndex = (peak - min) / totalTime;
  return { powers, peak, min, avg, fatigueIndex, totalTime };
}

function calcHRR5(hrPeak, hr5) {
  if (hrPeak == null || hr5 == null) return null;
  return hrPeak - hr5;
}

function vMaxFromBest100(sec) {
  if (!sec || sec <= 0) return null;
  return 100 / sec;
}

// Tingkatan waktu 100m — pria
const BENCH_100M_L = [
  { label: 'Elite Dunia', max: 9.90 },
  { label: 'Elite Asia/SEA', max: 10.15 },
  { label: 'Nasional/Junior Elite', max: 10.60 },
  { label: 'Berkembang', max: 11.80 },
  { label: 'Pemula', max: Infinity },
];

// Tingkatan waktu 100m — wanita
const BENCH_100M_P = [
  { label: 'Elite Dunia', max: 10.90 },
  { label: 'Elite Asia/SEA', max: 11.50 },
  { label: 'Nasional/Junior Elite', max: 12.60 },
  { label: 'Berkembang', max: 13.80 },
  { label: 'Pemula', max: Infinity },
];

const REF_100M = {
  L: 'Acuan: rekor dunia 9,58 dtk (Usain Bolt, 2009) · emas SEA Games 2025 10,00 dtk (Puripol Boonson) · rekor nasional Indonesia 10,17 dtk (Suryo Agung Wibowo, 2009) · perak SEA Games 2025 10,25 dtk (Lalu M. Zohri).',
  P: 'Acuan: rekor dunia 10,49 dtk (Florence Griffith-Joyner, 1988) · emas SEA Games 2025 & rekor nasional Singapura 11,20–11,36 dtk (Shanti Pereira) · podium SEA Games 2025 11,54–11,58 dtk.',
};

const BENCH_RELPOWER = [
  { label: 'Elite', min: 17 },
  { label: 'Sangat Baik', min: 14 },
  { label: 'Baik', min: 11 },
  { label: 'Rata-rata', min: 8 },
  { label: 'Perlu Ditingkatkan', min: -Infinity },
];
const REF_RSA = 'Acuan umum atlet multi-sprint internasional (Draper & Whyte, 1997 / Topend Sports) — belum ada norma RAST resmi khusus sprinter Indonesia.';

const BENCH_FATIGUE = [
  { label: 'Sangat Baik', max: 8 },
  { label: 'Baik', max: 10 },
  { label: 'Rata-rata', max: 12 },
  { label: 'Perlu Ditingkatkan', max: Infinity },
];

function classifyByMax(value, table) {
  if (value == null || !Number.isFinite(value)) return null;
  for (let i = 0; i < table.length; i++) {
    if (value <= table[i].max) return { ...table[i], index: i };
  }
  return null;
}

function classifyByMin(value, table) {
  if (value == null || !Number.isFinite(value)) return null;
  for (let i = 0; i < table.length; i++) {
    if (value >= table[i].min) return { ...table[i], index: i };
  }
  return null;
}

module.exports = {
  calcRAST,
  calcHRR5,
  vMaxFromBest100,
  BENCH_100M_L,
  BENCH_100M_P,
  REF_100M,
  BENCH_RELPOWER,
  REF_RSA,
  BENCH_FATIGUE,
  classifyByMax,
  classifyByMin,
};
