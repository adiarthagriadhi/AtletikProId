// Menerjemahkan jawaban kuesioner atlet mandiri (selling page & form setup
// portal atlet) menjadi profil + periodisasi + tes awal yang dipahami mesin
// program yang sudah ada (programAssembler, nutritionEngine). Fungsi murni:
// tidak menyimpan apa pun — pemanggil yang memutuskan disimpan atau tidak.
const { CATEGORIES } = require('./categories');
const { parseClockToSec } = require('./endurance');
const { localDateKey } = require('./dateUtil');
const { validateProfile, validatePeriodization } = require('./athleteValidation');

const DAY_MS = 24 * 60 * 60 * 1000;
// Tanpa tanggal lomba → satu siklus progres 12 minggu dari hari ini.
const DEFAULT_CYCLE_WEEKS = 12;
const MAX_CYCLE_WEEKS = 52;
const MIN_SELF_AGE = 13;

const LEVELS = {
  pemula: { label: 'Pemula', pengalaman: 0 },
  rutin: { label: 'Rutin berlatih', pengalaman: 2 },
  kompetitif: { label: 'Kompetitif', pengalaman: 5 },
};

// Estimasi kasar bila atlet belum tahu catatan waktunya — hanya supaya mesin
// bisa menghitung level & pace awal. Ditandai "estimasi" di profil/tes
// sehingga UI bisa mengajak atlet menggantinya dengan tes sungguhan.
const EST_100M = {
  L: { pemula: 14.5, rutin: 13.2, kompetitif: 12.0 },
  P: { pemula: 17.0, rutin: 15.5, kompetitif: 13.8 },
};
const EST_5K_SEC = {
  L: { pemula: 32 * 60, rutin: 26 * 60, kompetitif: 21 * 60 },
  P: { pemula: 36 * 60, rutin: 30 * 60, kompetitif: 24 * 60 },
};
const TT_DISTANCES = [1600, 3000, 5000, 10000, 21097];

// Pilihan cepat alergi/pantangan (chip di UI). Teksnya sengaja memakai kata
// yang dikenali filterAllergies di lib/menuComposer.js.
const ALERGI_OPTIONS = ['Telur', 'Susu/laktosa', 'Kacang', 'Seafood/ikan', 'Gluten'];
const PANTANGAN_OPTIONS = ['Vegetarian', 'Tidak makan ayam', 'Tidak makan daging'];

function addDaysKey(key, n) {
  const d = new Date(key + 'T12:00:00');
  d.setTime(d.getTime() + n * DAY_MS);
  return localDateKey(d);
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function foodText(v) {
  if (Array.isArray(v)) {
    const clean = v.map((s) => String(s || '').trim()).filter(Boolean);
    return clean.length ? clean.join(', ') : '';
  }
  return String(v || '').trim();
}

/**
 * @param {object} answers - jawaban kuesioner
 * @param {object} [opts]
 * @param {Date} [opts.now]
 * @param {string} [opts.defaultName] - dipakai bila answers.nama kosong
 * @returns {{ profile, periodization, initialTest, meta, errors: string[] }}
 */
function buildSelfDraft(answers, opts) {
  const a = answers || {};
  const o = opts || {};
  const today = localDateKey(o.now || new Date());
  const errors = [];

  const level = LEVELS[a.level] ? a.level : null;
  if (!level) errors.push('Pilih level latihan Anda');
  const jk = a.jenisKelamin === 'P' ? 'P' : a.jenisKelamin === 'L' ? 'L' : null;
  const catDef = CATEGORIES[a.kategori] || null;

  // --- 100m (sprint & lompat butuh ini untuk level & target waktu) ---
  let best100m = numOrNull(a.best100m);
  let best100mEstimated = false;
  if (catDef && catDef.needsBest100m && best100m == null && level && jk) {
    best100m = EST_100M[jk][level];
    best100mEstimated = true;
  }
  // Input bukan angka → teruskan apa adanya supaya validateProfile yang menolak.
  if (Number.isNaN(best100m)) best100m = a.best100m;

  const alergi = foodText(a.alergiMakanan) || '';
  const pantangan = foodText(a.pantanganMakanan) || '';

  const { profile, errors: profileErrors } = validateProfile({
    nama: String(a.nama || '').trim() || o.defaultName || '',
    kategori: a.kategori,
    event: a.event,
    usia: a.usia,
    jenisKelamin: jk,
    tinggi: a.tinggi,
    berat: a.berat,
    pengalaman: level ? LEVELS[level].pengalaman : null,
    best100m,
    alergiMakanan: alergi,
    pantanganMakanan: pantangan,
  });
  errors.push(...profileErrors);
  if (Number.isFinite(profile.usia) && profile.usia < MIN_SELF_AGE) {
    errors.push(`Akun atlet mandiri untuk usia ${MIN_SELF_AGE} tahun ke atas — atlet lebih muda sebaiknya didampingi pelatih`);
  }
  if (profile.berat == null) errors.push('Berat badan wajib diisi (untuk menghitung nutrisi)');
  profile.level = level;
  profile.best100mEstimated = best100mEstimated;

  // --- Periodisasi ---
  let compDate;
  const targetMode = a.targetMode === 'lomba' ? 'lomba' : 'progres';
  if (targetMode === 'lomba') {
    compDate = String(a.compDate || '').slice(0, 10);
    const maxKey = addDaysKey(today, MAX_CYCLE_WEEKS * 7);
    const minKey = addDaysKey(today, 7);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(compDate)) errors.push('Tanggal lomba tidak valid');
    else if (compDate < minKey) errors.push('Tanggal lomba minimal 1 minggu dari hari ini');
    else if (compDate > maxKey) errors.push(`Tanggal lomba maksimal ${MAX_CYCLE_WEEKS} minggu dari hari ini`);
  } else {
    compDate = addDaysKey(today, DEFAULT_CYCLE_WEEKS * 7);
  }
  const { periodization, errors: periodErrors } = validatePeriodization({ startDate: today, compDate });
  errors.push(...periodErrors);

  // --- Tes awal (lari menengah/jauh butuh time trial untuk hitung pace) ---
  let initialTest = null;
  if (catDef && catDef.testProtocol === 'time_trial') {
    let ttDistance = numOrNull(a.ttDistance);
    let ttTimeSec = a.ttTime ? parseClockToSec(a.ttTime) : null;
    let estimated = false;
    if (ttDistance == null && !a.ttTime) {
      if (level && jk) {
        ttDistance = 5000;
        ttTimeSec = EST_5K_SEC[jk][level];
        estimated = true;
      }
    } else {
      if (!TT_DISTANCES.includes(ttDistance)) errors.push('Jarak catatan waktu tidak valid');
      if (ttTimeSec == null || ttTimeSec <= 0 || ttTimeSec > 36000) errors.push('Format catatan waktu tidak valid (mm:ss atau j:mm:ss)');
      // Pace lebih cepat dari ~2:20/km atau lebih lambat dari ~12 menit/km hampir pasti salah ketik.
      else if (ttDistance) {
        const secPerKm = ttTimeSec / (ttDistance / 1000);
        if (secPerKm < 140 || secPerKm > 720) errors.push('Catatan waktu tampak tidak wajar — cek lagi jarak & waktunya');
      }
    }
    if (ttDistance && ttTimeSec) {
      initialTest = {
        date: today,
        label: estimated ? 'Estimasi awal (kuesioner)' : 'Catatan waktu mandiri',
        ttDistance,
        ttTimeSec,
        source: 'self-report',
        estimated,
      };
    }
  }

  return {
    profile,
    periodization,
    initialTest,
    meta: {
      targetMode,
      levelLabel: level ? LEVELS[level].label : null,
      best100mEstimated,
      ttEstimated: !!(initialTest && initialTest.estimated),
    },
    errors: [...new Set(errors)],
  };
}

module.exports = {
  buildSelfDraft,
  LEVELS,
  ALERGI_OPTIONS,
  PANTANGAN_OPTIONS,
  TT_DISTANCES,
  DEFAULT_CYCLE_WEEKS,
  MIN_SELF_AGE,
};
