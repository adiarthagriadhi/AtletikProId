const sprintEngine = require('./sprintEngine');
const jumpEngine = require('./jumpEngine');
const { CATEGORIES } = require('./categories');
const { calcVDOT, parseClockToSec } = require('./endurance');
const { calcRAST, calcHRR5, BENCH_RELPOWER, BENCH_FATIGUE, classifyByMin, classifyByMax } = require('./benchmarks');
const { localDateKey } = require('./dateUtil');
const jump = require('./jump');

const LABEL_MAX_LENGTH = 150;

// Kategori mana yang punya checklist teknik (Likert) & modul mana yang jadi
// sumber kanonis butir checklistnya untuk nomor tsb.
const TECHNIQUE_ENGINE_BY_PROTOCOL = {
  sprint: sprintEngine,
  jump: jumpEngine,
};

function validateCommon(body) {
  const errors = [];
  const label = String(body.label || '').trim();
  const date = String(body.date || '').trim();
  const dateD = new Date(date + 'T00:00:00');
  if (!date || isNaN(dateD.getTime())) {
    errors.push('Tanggal tes tidak valid');
  } else if (date > localDateKey(new Date())) {
    // Sama seperti log monitoring — tes mencatat hasil yang SUDAH dijalani,
    // tanggal masa depan tidak masuk akal dan bisa membingungkan urutan
    // kronologis di grafik progres (tab Catat Hasil Tes).
    errors.push('Tanggal tes tidak boleh di masa depan');
  }
  if (label.length > LABEL_MAX_LENGTH) errors.push(`Label maksimal ${LABEL_MAX_LENGTH} karakter`);
  return { common: { label, date }, errors };
}

function validateSprintTest(body, event) {
  const errors = [];
  const vo2max = body.vo2max === '' || body.vo2max == null ? null : Number(body.vo2max);
  if (vo2max != null && (!Number.isFinite(vo2max) || vo2max <= 0 || vo2max > 100)) {
    errors.push('VO2 Maks tidak valid');
  }

  let rastTimes = Array.isArray(body.rastTimes) ? body.rastTimes.map((t) => (t === '' || t == null ? null : Number(t))) : [];
  rastTimes = rastTimes.slice(0, 6);
  while (rastTimes.length < 6) rastTimes.push(null);
  for (const t of rastTimes) {
    if (t != null && (!Number.isFinite(t) || t <= 0 || t > 30)) {
      errors.push('Waktu RAST tidak valid (harus di antara 0-30 detik)');
      break;
    }
  }

  const hrPeak = body.hrPeak === '' || body.hrPeak == null ? null : Number(body.hrPeak);
  const hr5 = body.hr5 === '' || body.hr5 == null ? null : Number(body.hr5);
  if (hrPeak != null && (!Number.isFinite(hrPeak) || hrPeak < 40 || hrPeak > 250)) errors.push('Denyut jantung puncak tidak valid');
  if (hr5 != null && (!Number.isFinite(hr5) || hr5 < 40 || hr5 > 250)) errors.push('Denyut jantung menit ke-5 tidak valid');

  const { techniqueScores, errors: techniqueErrors } = sprintEngine.buildTechniqueScores(event, body.techniqueScores);
  errors.push(...techniqueErrors);

  return { fields: { vo2max, rastTimes, hrPeak, hr5, techniqueScores }, errors };
}

// Menengah/Jauh: jarak & waktu time trial disimpan mentah (bukan VDOT-nya) —
// VDOT dihitung ulang setiap dibaca (lib/endurance.calcVDOT), konsisten
// dengan prinsip "dihitung ulang setiap dibuka", bukan disimpan sebagai
// angka turunan yang bisa basi kalau formulanya disetel ulang nanti.
function validateTimeTrialTest(body) {
  const errors = [];
  const ttDistance = body.ttDistance === '' || body.ttDistance == null ? null : Number(body.ttDistance);
  const ttTimeSec = parseClockToSec(body.ttTime);

  if (ttDistance == null && body.ttTime) errors.push('Jarak time trial wajib diisi jika waktu diisi');
  if (ttDistance != null && (!Number.isFinite(ttDistance) || ttDistance < 400 || ttDistance > 50000)) {
    errors.push('Jarak time trial tidak valid (400m - 50.000m)');
  }
  if (body.ttTime && ttTimeSec == null) errors.push('Format waktu time trial tidak valid (pakai mm:ss atau h:mm:ss)');
  if (ttTimeSec != null && (ttTimeSec <= 0 || ttTimeSec > 36000)) errors.push('Waktu time trial tidak valid');
  if (ttDistance != null && ttTimeSec == null && body.ttTime === '') errors.push('Waktu time trial wajib diisi jika jarak diisi');

  return { fields: { ttDistance, ttTimeSec }, errors };
}

// Lompat: SLJ, Vertical Jump, prestasi lomba — boleh sebagian (minimal satu
// diisi), sesuai dok. arsitektur bagian 3.4.
function validateJumpTest(body, event) {
  const errors = [];
  const sljDistance = body.sljDistance === '' || body.sljDistance == null ? null : Number(body.sljDistance);
  const vjHeight = body.vjHeight === '' || body.vjHeight == null ? null : Number(body.vjHeight);
  const compMark = body.compMark === '' || body.compMark == null ? null : Number(body.compMark);

  if (sljDistance == null && vjHeight == null && compMark == null) {
    errors.push('Isi minimal salah satu hasil tes (SLJ, Vertical Jump, atau prestasi lomba)');
  }
  if (sljDistance != null && (!Number.isFinite(sljDistance) || sljDistance < 50 || sljDistance > 400)) {
    errors.push('Hasil Standing Long Jump tidak valid (50-400 cm)');
  }
  if (vjHeight != null && (!Number.isFinite(vjHeight) || vjHeight < 5 || vjHeight > 120)) {
    errors.push('Hasil Vertical Jump tidak valid (5-120 cm)');
  }
  if (compMark != null && (!Number.isFinite(compMark) || compMark < 0.5 || compMark > 10)) {
    errors.push('Prestasi lomba tidak valid (0,5-10 meter)');
  }

  const { techniqueScores, errors: techniqueErrors } = jumpEngine.buildTechniqueScores(event, body.techniqueScores);
  errors.push(...techniqueErrors);

  return { fields: { sljDistance, vjHeight, compMark, techniqueScores }, errors };
}

function validateTest(body, athlete) {
  const { common, errors: commonErrors } = validateCommon(body);
  const catDef = CATEGORIES[athlete.profile.kategori];
  const protocol = catDef ? catDef.testProtocol : 'sprint';

  if (protocol === 'time_trial') {
    const { fields, errors } = validateTimeTrialTest(body);
    return { test: { ...common, ...fields }, errors: [...commonErrors, ...errors] };
  }
  if (protocol === 'jump') {
    const { fields, errors } = validateJumpTest(body, athlete.profile.event);
    return { test: { ...common, ...fields }, errors: [...commonErrors, ...errors] };
  }

  const { fields, errors } = validateSprintTest(body, athlete.profile.event);
  return { test: { ...common, ...fields }, errors: [...commonErrors, ...errors] };
}

// Tempelkan nilai turunan (VDOT, RAST power/fatigue, HRR5) saat dibaca —
// dihitung ulang tiap kali, tidak disimpan sebagai angka turunan.
function hydrateTest(test, athlete) {
  const catDef = CATEGORIES[athlete.profile.kategori];
  const protocol = catDef ? catDef.testProtocol : 'sprint';

  if (protocol === 'time_trial') {
    const vdot = test.ttDistance && test.ttTimeSec ? calcVDOT(test.ttDistance, test.ttTimeSec) : null;
    return { ...test, vdot };
  }

  if (protocol === 'sprint') {
    const rast = calcRAST(athlete.profile.berat, test.rastTimes);
    let rastResult = null;
    if (rast) {
      const relPower = rast.peak / athlete.profile.berat;
      const relPowerTier = classifyByMin(relPower, BENCH_RELPOWER);
      const fatigueTier = classifyByMax(rast.fatigueIndex, BENCH_FATIGUE);
      rastResult = {
        peak: rast.peak,
        fatigueIndex: rast.fatigueIndex,
        relPower,
        relPowerTier: relPowerTier ? relPowerTier.label : null,
        fatigueTier: fatigueTier ? fatigueTier.label : null,
      };
    }
    const hrr5 = calcHRR5(test.hrPeak, test.hr5);
    return { ...test, rast: rastResult, hrr5 };
  }

  if (protocol === 'jump') {
    // Klasifikasi tiap metrik terhadap tabel benchmarknya sendiri — SLJ/VJ
    // pakai tabel kondisi fisik umum, prestasi lomba pakai tabel per nomor
    // (lompat jauh/tinggi) yang juga jadi dasar Level Prestasi di tab Program.
    const jk = athlete.profile.jenisKelamin;
    const sljTier = test.sljDistance != null ? classifyByMin(test.sljDistance, jump.sljTiers(jk)) : null;
    const vjTier = test.vjHeight != null ? classifyByMin(test.vjHeight, jump.vjTiers(jk)) : null;
    const compMarkTier = test.compMark != null ? jump.classifyCompMark(athlete.profile.event, jk, test.compMark) : null;
    return {
      ...test,
      sljTier: sljTier ? sljTier.label : null,
      vjTier: vjTier ? vjTier.label : null,
      compMarkTier: compMarkTier ? compMarkTier.label : null,
    };
  }

  return test;
}

module.exports = {
  LABEL_MAX_LENGTH,
  TECHNIQUE_ENGINE_BY_PROTOCOL,
  validateTest,
  hydrateTest,
};
