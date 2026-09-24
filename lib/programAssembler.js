const periodization = require('./periodization');
const curves = require('./curves');
const { computeACWR } = require('./acwr');
const { combinePersonalization } = require('./personalization');
const sprintEngine = require('./sprintEngine');
const enduranceEngine = require('./enduranceEngine');
const jumpEngine = require('./jumpEngine');
const { BENCH_100M_L, BENCH_100M_P, REF_100M, classifyByMax } = require('./benchmarks');
const endurance = require('./endurance');
const jump = require('./jump');
const { CATEGORIES } = require('./categories');

// Level prestasi Sprint: dari catatan waktu 100m di profil atlet.
function classifySprintLevel(athlete) {
  const best100m = athlete.profile.best100m;
  if (best100m == null) {
    return { tierIndex: null, benchLabel: null, missingDataNote: 'Belum ada catatan waktu 100m — pakai formula standar (×1,0).', refNote: null };
  }
  const jk = athlete.profile.jenisKelamin === 'P' ? 'P' : 'L';
  const table = jk === 'P' ? BENCH_100M_P : BENCH_100M_L;
  const tier = classifyByMax(best100m, table);
  return { tierIndex: tier ? tier.index : null, benchLabel: tier ? tier.label : null, missingDataNote: null, refNote: REF_100M[jk] };
}

// Level prestasi Menengah/Jauh: dari waktu yang DIPREDIKSI untuk nomor
// target atlet (bukan jarak time trial mentah, yang sering berbeda dari
// nomor target), diturunkan dari VDOT tes time trial terakhir yang valid.
function findLatestVdot(tests, athleteId) {
  const valid = tests
    .filter((t) => t.athleteId === athleteId && t.ttDistance && t.ttTimeSec)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
  if (!valid.length) return null;
  return endurance.calcVDOT(valid[0].ttDistance, valid[0].ttTimeSec);
}

function classifyEnduranceLevel(athlete, vdot) {
  if (vdot == null) {
    return { tierIndex: null, benchLabel: null, missingDataNote: 'Belum ada data time trial yang valid — pakai formula standar (×1,0).', predictedSec: null, refNote: null };
  }
  const eventMeters = endurance.EVENT_METERS[athlete.profile.event];
  const predictedSec = endurance.predictTimeForDistance(vdot, eventMeters);
  const tier = endurance.classifyEnduranceTier(athlete.profile.event, athlete.profile.jenisKelamin, predictedSec);
  return {
    tierIndex: tier ? tier.index : null,
    benchLabel: tier ? tier.label : null,
    missingDataNote: null,
    predictedSec,
    refNote: endurance.REF_ENDURANCE[athlete.profile.event] || null,
  };
}

// Level prestasi Lompat: dari prestasi lomba (compMark) tes terakhir yang
// valid — berbeda dari kecepatan approach (dari 100m) yang jadi basis
// generate sesi, karena keduanya mengukur hal berbeda (fisik vs hasil aktual).
function classifyJumpLevel(athlete, tests) {
  const valid = tests
    .filter((t) => t.athleteId === athlete.id && t.compMark != null)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
  if (!valid.length) {
    return { tierIndex: null, benchLabel: null, missingDataNote: 'Belum ada catatan prestasi lomba — pakai formula standar (×1,0).', refNote: null };
  }
  const tier = jump.classifyCompMark(athlete.profile.event, athlete.profile.jenisKelamin, valid[0].compMark);
  return {
    tierIndex: tier ? tier.index : null,
    benchLabel: tier ? tier.label : null,
    missingDataNote: null,
    refNote: jump.REF_LOMPAT_MARK[athlete.profile.event] || null,
  };
}

/**
 * Langkah 1-4 dari dok. arsitektur: fase -> kurva mingguan -> personalisasi
 * -> sesi. Dipakai baik oleh endpoint /program (referenceDate = hari ini,
 * personalisasi penuh) maupun /calendar (referenceDate = tiap minggu yang
 * ditampilkan, personalisasi dilewati karena ACWR/level cuma bermakna
 * "per hari ini", bukan untuk minggu lampau/masa depan).
 */
function assembleProgram(athlete, tests, monitoringLogs, referenceDate = new Date(), { includePersonalization = true } = {}) {
  // Langkah 1 — hitung fase periodisasi
  const phaseResult = periodization.computePhase(athlete.periodization, referenceDate);
  if (!phaseResult.phase) {
    return {
      phase: phaseResult,
      weekPlan: null,
      personalization: null,
      acwr: null,
      racePrediction: null,
      sessions: [],
      strengthBank: [],
      techniqueChecklist: null,
      note: 'Lengkapi tanggal mulai program & tanggal kompetisi target di data periodisasi atlet untuk melihat program.',
    };
  }

  // Langkah 2 — pilih kurva mingguan
  const weeksIntoPhase = periodization.weeksElapsedInPhase(athlete.periodization, phaseResult, referenceDate);
  const weekPlan = curves.getWeekPlan(phaseResult.phase, {
    weeksIntoPhase,
    remainingWeeks: phaseResult.remainingWeeks || 0,
  });

  const catDef = CATEGORIES[athlete.profile.kategori];
  const protocol = catDef ? catDef.testProtocol : 'sprint';
  const vdot = protocol === 'time_trial' ? findLatestVdot(tests, athlete.id) : null;

  let levelInfo;
  if (protocol === 'time_trial') levelInfo = classifyEnduranceLevel(athlete, vdot);
  else if (protocol === 'jump') levelInfo = classifyJumpLevel(athlete, tests);
  else levelInfo = classifySprintLevel(athlete);

  // Langkah 3 — terapkan personalisasi (level prestasi x risiko ACWR)
  let acwrResult = null;
  let personalizationResult;
  if (includePersonalization) {
    const monitoringForAthlete = monitoringLogs.filter((m) => m.athleteId === athlete.id);
    acwrResult = computeACWR(monitoringForAthlete, referenceDate);
    personalizationResult = combinePersonalization({
      levelTierIndex: levelInfo.tierIndex,
      levelBenchLabel: levelInfo.benchLabel,
      levelMissingDataNote: levelInfo.missingDataNote,
      levelRefNote: levelInfo.refNote,
      acwrResult,
    });
  } else {
    personalizationResult = {
      multiplier: 1.0,
      level: { label: null, multiplier: 1.0, benchTier: null, note: 'Pratinjau kalender — personalisasi tidak diterapkan.' },
      risk: { atRisk: false, multiplier: 1.0, note: null },
    };
  }

  // Langkah 4 — generate sesi latihan
  let generated;
  if (protocol === 'time_trial') {
    generated = enduranceEngine.generateWeekSessions({
      category: athlete.profile.kategori,
      event: athlete.profile.event,
      vdot,
      weekPlan,
      personalizationMultiplier: personalizationResult.multiplier,
    });
  } else if (protocol === 'jump') {
    generated = jumpEngine.generateWeekSessions({
      event: athlete.profile.event,
      best100m: athlete.profile.best100m,
      weekPlan,
      personalizationMultiplier: personalizationResult.multiplier,
    });
  } else {
    generated = sprintEngine.generateWeekSessions({
      event: athlete.profile.event,
      best100m: athlete.profile.best100m,
      weekPlan,
      personalizationMultiplier: personalizationResult.multiplier,
    });
  }

  // Prediksi waktu lomba (race predictor) — hanya berlaku untuk Menengah/
  // Jauh, dari VDOT tes time trial terakhir yang valid.
  const racePrediction = protocol === 'time_trial' && vdot != null
    ? { vdot, event: athlete.profile.event, predictedSec: levelInfo.predictedSec }
    : null;

  return {
    phase: phaseResult,
    weekPlan,
    personalization: personalizationResult,
    acwr: acwrResult,
    racePrediction,
    sessions: generated.sessions,
    strengthBank: generated.strengthBank,
    techniqueChecklist: generated.techniqueChecklist,
    warning: generated.warning || null,
  };
}

module.exports = { assembleProgram };
