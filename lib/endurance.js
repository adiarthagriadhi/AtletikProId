// Formula & tabel benchmark di file ini diambil dari implementasi lama
// (sprint-coach-server/public/app.js:876-1105) sebagai acuan angka yang
// sudah divalidasi sebelumnya — bukan reproduksi tabel pace resmi dari buku
// Daniels, melainkan implementasi kami yang mendekati kerangka %VDOT yang
// dipublikasikan (Daniels-Gilbert, Oxygen Power 1979 / Daniels' Running
// Formula). Batas tier benchmark adalah interpolasi indikatif tim
// pengembang, bukan standar resmi World Athletics/PASI.
const { classifyByMax } = require('./benchmarks');

function vo2FromVelocity(v) {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

function pctMaxFromTime(tMin) {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
}

// VDOT dari hasil time trial (jarak dalam meter, waktu dalam detik).
function calcVDOT(distanceM, timeSec) {
  if (!distanceM || !timeSec) return null;
  const tMin = timeSec / 60;
  const v = distanceM / tMin; // m/menit
  const vo2 = vo2FromVelocity(v);
  const pct = pctMaxFromTime(tMin);
  if (pct <= 0) return null;
  return vo2 / pct;
}

// Kebalikan vo2FromVelocity (solusi kuadrat) — dipakai turunkan pace dari VDOT.
function velocityForVO2(vo2target) {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2target;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  return (-b + Math.sqrt(disc)) / (2 * a);
}

// 5 zona pace Jack Daniels, sebagai persentase kecepatan pada VDOT tsb.
const PACE_ZONES = [
  { key: 'E', label: 'Easy', desc: 'Fondasi aerobik & pemulihan', pct: 0.7 },
  { key: 'M', label: 'Marathon', desc: 'Pace lomba maraton', pct: 0.82 },
  { key: 'T', label: 'Threshold', desc: 'Ambang laktat / tempo', pct: 0.88 },
  { key: 'I', label: 'Interval', desc: 'VO2 maks', pct: 0.98 },
  { key: 'R', label: 'Repetition', desc: 'Kecepatan & ekonomi lari', pct: 1.08 },
];

// Pace latihan (detik/km) untuk satu zona, dari VDOT.
function paceSecPerKm(vdot, pct) {
  if (!vdot) return null;
  const v = velocityForVO2(vdot * pct);
  if (!v || v <= 0) return null;
  return 1000 / (v / 60);
}

function fmtPace(secPerKm) {
  if (secPerKm == null || !isFinite(secPerKm)) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

// Parse "mm:ss" atau "h:mm:ss" jadi total detik. Dipakai untuk input waktu
// time trial.
function parseClockToSec(str) {
  if (!str) return null;
  const parts = String(str).trim().split(':').map((s) => parseFloat(s));
  if (parts.some((v) => isNaN(v))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

// Prediksi waktu untuk jarak lain dari VDOT tsb (binary search terhadap
// calcVDOT) — dipakai supaya klasifikasi level prestasi dibandingkan
// terhadap NOMOR TARGET atlet, bukan jarak time trial mentah (yang sering
// berbeda dari nomor target, mis. time trial 3000m untuk atlet 1500m).
//
// Batas pencarian dalam detik/meter (bukan dikali distanceM secara naif —
// itu salah untuk jarak pendek/pace cepat, lihat catatan di bawah): 0,08
// dtk/m (=45 km/jam, jauh lebih cepat dari kecepatan lari manusia manapun,
// batas bawah aman) sampai 20 dtk/m (jalan sangat lambat, batas atas aman).
function predictTimeForDistance(vdot, distanceM) {
  if (!vdot || !distanceM) return null;
  let lo = distanceM * 0.08;
  let hi = distanceM * 20;
  for (let i = 0; i < 50; i++) {
    const t = (lo + hi) / 2;
    const v = calcVDOT(distanceM, t);
    if (v == null) { hi = t; continue; }
    if (v > vdot) lo = t; else hi = t;
  }
  return (lo + hi) / 2;
}

const EVENT_METERS = {
  '800m': 800,
  '1500m': 1500,
  '5000m': 5000,
  '10000m': 10000,
  half_marathon: 21097,
  marathon: 42195,
};

// Tingkatan waktu — 800m berbagi skala dengan 1500m, 10.000m/half berbagi
// skala dengan 5000m/maraton (belum ada penyesuaian batas khusus per nomor
// tsb, sama seperti kode lama). Waktu dalam detik.
const BENCH_1500_L = [{ label: 'Elite Dunia', max: 220 }, { label: 'Elite Asia/Nasional', max: 240 }, { label: 'Kompetitif', max: 270 }, { label: 'Berkembang', max: 330 }, { label: 'Pemula', max: Infinity }];
const BENCH_1500_P = [{ label: 'Elite Dunia', max: 250 }, { label: 'Elite Asia/Nasional', max: 270 }, { label: 'Kompetitif', max: 310 }, { label: 'Berkembang', max: 380 }, { label: 'Pemula', max: Infinity }];
const BENCH_5000_L = [{ label: 'Elite Dunia', max: 800 }, { label: 'Elite Asia/Nasional', max: 900 }, { label: 'Kompetitif', max: 1080 }, { label: 'Berkembang', max: 1500 }, { label: 'Pemula', max: Infinity }];
const BENCH_5000_P = [{ label: 'Elite Dunia', max: 900 }, { label: 'Elite Asia/Nasional', max: 1020 }, { label: 'Kompetitif', max: 1200 }, { label: 'Berkembang', max: 1680 }, { label: 'Pemula', max: Infinity }];
const BENCH_MARATHON_L = [{ label: 'Elite Dunia', max: 8100 }, { label: 'Elite Asia/Nasional', max: 9000 }, { label: 'Kompetitif', max: 10800 }, { label: 'Berkembang', max: 14400 }, { label: 'Pemula', max: Infinity }];
const BENCH_MARATHON_P = [{ label: 'Elite Dunia', max: 8700 }, { label: 'Elite Asia/Nasional', max: 9900 }, { label: 'Kompetitif', max: 12600 }, { label: 'Berkembang', max: 16200 }, { label: 'Pemula', max: Infinity }];

const REF_ENDURANCE = {
  '800m': 'Acuan skala 1500m (World Athletics) — belum ada penyesuaian batas khusus 800m.',
  '1500m': 'Acuan: rekor dunia putra 3:26.00 (El Guerrouj, 1998); putri 3:48.68 (Kipyegon, 2025).',
  '5000m': 'Acuan: rekor dunia putra 12:35.36 (Cheptegei, 2020); putri 13:58.06 (Chebet, 2025).',
  '10000m': 'Acuan skala 5000m — belum ada penyesuaian batas khusus 10.000m.',
  half_marathon: 'Acuan skala maraton — belum ada penyesuaian batas khusus half marathon.',
  marathon: 'Acuan: rekor dunia putra 1:59:30 (Sawe, 2026); putri 2:15:41 (Assefa, 2026).',
};

function benchTiersFor(event, jenisKelamin) {
  const L = jenisKelamin !== 'P';
  if (event === '800m' || event === '1500m') return L ? BENCH_1500_L : BENCH_1500_P;
  if (event === '5000m' || event === '10000m') return L ? BENCH_5000_L : BENCH_5000_P;
  return L ? BENCH_MARATHON_L : BENCH_MARATHON_P; // half_marathon, marathon
}

function classifyEnduranceTier(event, jenisKelamin, timeSec) {
  if (timeSec == null) return null;
  return classifyByMax(timeSec, benchTiersFor(event, jenisKelamin));
}

module.exports = {
  calcVDOT,
  velocityForVO2,
  paceSecPerKm,
  predictTimeForDistance,
  fmtPace,
  parseClockToSec,
  PACE_ZONES,
  EVENT_METERS,
  REF_ENDURANCE,
  benchTiersFor,
  classifyEnduranceTier,
};
