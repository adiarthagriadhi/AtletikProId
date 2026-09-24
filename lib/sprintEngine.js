const { vMaxFromBest100 } = require('./benchmarks');
const { GPP_SESSIONS, TRANSITION_SESSION, GENERIC_STRENGTH_BANK } = require('./genericTraining');
const { LIKERT_SCALE, buildTechniqueScores: buildScores } = require('./technique');

// Skema sesi spesifik nomor — dipakai HANYA saat kurva berkonten "specific"
// (fase Persiapan Khusus & Kompetisi/Puncak). Rancangan awal, belum ada di
// kode/dokumen lama — 100m/200m/400m sengaja dibedakan skema & rentang
// intensitasnya sesuai kebutuhan (lihat dok. arsitektur bagian 4.4).
const EVENT_SESSIONS = {
  '100m': [
    { key: 's1', label: 'Sesi I', name: 'Akselerasi & Start', day: 'Senin', goal: 'Power akselerasi & teknik start', intMin: 0.95, intMax: 1.00, distMin: 20, distMax: 40, restMin: 3, restMax: 5, volMin: 240, volMax: 320, targetRPE: 8 },
    { key: 's2', label: 'Sesi II', name: 'Max Velocity (Flying Sprint)', day: 'Rabu', goal: 'Kecepatan maksimal', intMin: 0.97, intMax: 1.00, distMin: 30, distMax: 60, restMin: 4, restMax: 6, volMin: 240, volMax: 360, targetRPE: 9 },
    { key: 's3', label: 'Sesi III', name: 'Speed Endurance Ringan', day: 'Jumat', goal: 'Menjaga kecepatan di fase akhir lomba', intMin: 0.90, intMax: 0.95, distMin: 60, distMax: 80, restMin: 3, restMax: 5, volMin: 320, volMax: 480, targetRPE: 7 },
  ],
  '200m': [
    { key: 's1', label: 'Sesi I', name: 'Akselerasi & Transisi', day: 'Senin', goal: 'Transisi akselerasi ke kecepatan maksimal', intMin: 0.95, intMax: 1.00, distMin: 30, distMax: 60, restMin: 3, restMax: 5, volMin: 300, volMax: 420, targetRPE: 8 },
    { key: 's2', label: 'Sesi II', name: 'Speed Endurance', day: 'Rabu', goal: 'Daya tahan kecepatan', intMin: 0.90, intMax: 0.95, distMin: 80, distMax: 150, restMin: 3, restMax: 5, volMin: 480, volMax: 750, targetRPE: 8 },
    { key: 's3', label: 'Sesi III', name: 'Simulasi Race Pace', day: 'Jumat', goal: 'Simulasi tempo lomba', intMin: 0.92, intMax: 0.97, distMin: 150, distMax: 220, restMin: 5, restMax: 8, volMin: 450, volMax: 660, targetRPE: 8 },
  ],
  '400m': [
    { key: 's1', label: 'Sesi I', name: 'Speed Endurance Pendek', day: 'Senin', goal: 'Daya tahan kecepatan jarak pendek', intMin: 0.88, intMax: 0.93, distMin: 150, distMax: 250, restMin: 3, restMax: 4, volMin: 600, volMax: 900, targetRPE: 8 },
    { key: 's2', label: 'Sesi II', name: 'Toleransi Laktat', day: 'Rabu', goal: 'Toleransi laktat', intMin: 0.85, intMax: 0.90, distMin: 250, distMax: 350, restMin: 4, restMax: 6, volMin: 700, volMax: 1050, targetRPE: 9 },
    { key: 's3', label: 'Sesi III', name: 'Race Pace Long Rep', day: 'Jumat', goal: 'Simulasi tempo lomba jarak jauh', intMin: 0.90, intMax: 0.95, distMin: 300, distMax: 400, restMin: 6, restMax: 10, volMin: 600, volMax: 900, targetRPE: 8 },
  ],
};

// Bank kekuatan spesifik Sprint untuk fase Khusus/Puncak — entri umum/transisi
// dipakai bersama dari lib/genericTraining.js (lihat STRENGTH_BANK di bawah).
const SPRINT_STRENGTH_BANK = {
  khusus: ['Power clean / hex bar deadlift', 'Resisted sprint (sled push/pull)', 'Bounding', 'Single-leg box jump'],
  puncak: ['Pliometrik ringan (maintenance)', 'Resisted sprint volume rendah', 'Power maintenance beban rendah — hindari kerja berat baru'],
};
const STRENGTH_BANK = { ...GENERIC_STRENGTH_BANK, ...SPRINT_STRENGTH_BANK };

const TECHNIQUE_CHECKLIST = {
  '100m': ['Postur & sudut dorong start blok', 'Sudut drive fase 3 langkah pertama', 'Simetri ayunan lengan', 'Transisi ke posisi tegak (langkah ke-20 hingga 25)'],
  '200m': ['Teknik lari tikungan & posisi lane', 'Transisi drive ke kecepatan maksimal', 'Relaksasi top-end ("float") di lintasan lurus'],
  '400m': ['Disiplin pacing (split relatif rata)', 'Relaksasi saat kelelahan di 100m terakhir', 'Menjaga ayunan lengan saat kelelahan'],
};

// Skor checklist teknik Sprint — wrapper tipis di atas lib/technique.js yang
// otomatis pakai daftar butir kanonis nomor tsb (100m/200m/400m).
function buildTechniqueScores(event, rawScores) {
  return buildScores(TECHNIQUE_CHECKLIST[event] || [], rawScores);
}

function fmtTime(sec) {
  return sec.toFixed(2) + ' dtk';
}

function mid(a, b) {
  return (a + b) / 2;
}

/**
 * Bangun sesi konkret untuk minggu berjalan, sesuai konten kurva (specific /
 * conditioning / free). `personalizationMultiplier` sudah gabungan level
 * prestasi × risiko ACWR (lib/personalization.js).
 */

// Undulasi penekanan sprint dalam mesosiklus 4 minggu (khusus / taper).
const SPRINT_WEEK_EMPHASIS = [
  { key: 'adaptasi', labelSuffix: '— fondasi', volMul: [0.9, 0.85, 0.8], rpeShift: [-1, -1, -1], intMul: 0.98 },
  { key: 'progresif', labelSuffix: '', volMul: [1, 1, 1], rpeShift: [0, 0, 0], intMul: 1 },
  { key: 'puncak_mikro', labelSuffix: '— quality', volMul: [1.05, 1.1, 0.95], rpeShift: [0, 1, 0], intMul: 1 },
  { key: 'unload', labelSuffix: '— unload', volMul: [0.75, 0.7, 0.6], rpeShift: [-1, -1, -2], intMul: 0.97 },
];

function sprintEmphasisFor(weekPlan) {
  if (weekPlan.curveSet === 'TAPER_WEEK_PHASES') {
    const f = weekPlan.factor || 0.5;
    if (f <= 0.4) return SPRINT_WEEK_EMPHASIS[3];
    if (f <= 0.55) return { ...SPRINT_WEEK_EMPHASIS[2], volMul: [0.85, 0.9, 0.7] };
    return SPRINT_WEEK_EMPHASIS[1];
  }
  const label = (weekPlan.label || '').toLowerCase();
  if (label.includes('unload')) return SPRINT_WEEK_EMPHASIS[3];
  if (label.includes('puncak')) return SPRINT_WEEK_EMPHASIS[2];
  if (label.includes('progres')) return SPRINT_WEEK_EMPHASIS[1];
  if (label.includes('adaptasi')) return SPRINT_WEEK_EMPHASIS[0];
  const f = weekPlan.factor || 1;
  if (f <= 0.8) return SPRINT_WEEK_EMPHASIS[3];
  if (f >= 1.05) return SPRINT_WEEK_EMPHASIS[2];
  if (f >= 0.95) return SPRINT_WEEK_EMPHASIS[1];
  return SPRINT_WEEK_EMPHASIS[0];
}

function generateWeekSessions({ event, best100m, weekPlan, personalizationMultiplier }) {
  const vmax = vMaxFromBest100(best100m);

  if (weekPlan.contentFocus === 'free') {
    return {
      contentFocus: 'free',
      sessions: [{ ...TRANSITION_SESSION, durationMin: Math.round(TRANSITION_SESSION.durationMin * weekPlan.factor) }],
      strengthBank: STRENGTH_BANK.transisi,
      techniqueChecklist: null,
    };
  }

  if (weekPlan.contentFocus === 'conditioning') {
    const sessions = GPP_SESSIONS.map((s) => ({
      ...s,
      durationMin: Math.round(s.durationMin * weekPlan.factor * personalizationMultiplier),
    }));
    return { contentFocus: 'conditioning', sessions, strengthBank: STRENGTH_BANK.umum, techniqueChecklist: null };
  }

  // contentFocus === 'specific'
  if (!vmax) {
    return {
      contentFocus: 'specific',
      sessions: [],
      strengthBank: weekPlan.curveSet === 'TAPER_WEEK_PHASES' ? STRENGTH_BANK.puncak : STRENGTH_BANK.khusus,
      techniqueChecklist: TECHNIQUE_CHECKLIST[event] || null,
      warning: 'Catatan waktu 100m belum ada — tidak bisa hitung target pace. Lengkapi tes untuk generate sesi.',
    };
  }

  const templates = EVENT_SESSIONS[event] || EVENT_SESSIONS['100m'];
  const intensityBoost = weekPlan.intensityBoost || 0;
  const emp = sprintEmphasisFor(weekPlan);

  const sessions = templates.map((t, idx) => {
    const volMul = (emp.volMul && emp.volMul[idx] != null) ? emp.volMul[idx] : 1;
    const rpeShift = (emp.rpeShift && emp.rpeShift[idx] != null) ? emp.rpeShift[idx] : 0;
    const baseVol = mid(t.volMin, t.volMax);
    const dist = mid(t.distMin, t.distMax);
    const targetVol = baseVol * weekPlan.factor * personalizationMultiplier * volMul;
    const reps = Math.max(2, Math.round(targetVol / dist));
    const actualVol = reps * dist;

    const intMax = Math.min(1.0, (t.intMax + intensityBoost) * emp.intMul);
    const intMin = Math.min(intMax, (t.intMin + intensityBoost) * emp.intMul);
    let timeLabel, tFast, tSlow;
    if (intMin === intMax) {
      tFast = tSlow = dist / (vmax * intMax);
      timeLabel = `${fmtTime(tFast)} (${Math.round(intMax * 100)}%)`;
    } else {
      tFast = dist / (vmax * intMax);
      tSlow = dist / (vmax * intMin);
      timeLabel = `${fmtTime(tFast)} – ${fmtTime(tSlow)} (${Math.round(intMin * 100)}-${Math.round(intMax * 100)}%)`;
    }

    const name = emp.labelSuffix ? `${t.name} ${emp.labelSuffix}` : t.name;
    const rpe = Math.max(3, Math.min(10, (t.targetRPE || 7) + rpeShift));

    return {
      key: t.key,
      label: t.label,
      name,
      day: t.day,
      goal: t.goal,
      reps,
      dist: Math.round(dist),
      restMin: t.restMin,
      restMax: t.restMax,
      volume: Math.round(actualVol),
      timeLabel,
      targetRPE: rpe,
      weekEmphasis: emp.key,
    };
  });

  return {
    contentFocus: 'specific',
    sessions,
    strengthBank: weekPlan.curveSet === 'TAPER_WEEK_PHASES' ? STRENGTH_BANK.puncak : STRENGTH_BANK.khusus,
    techniqueChecklist: TECHNIQUE_CHECKLIST[event] || null,
    weekEmphasis: emp.key,
  };
}

module.exports = {
  generateWeekSessions,
  EVENT_SESSIONS,
  GPP_SESSIONS,
  STRENGTH_BANK,
  TECHNIQUE_CHECKLIST,
  LIKERT_SCALE,
  buildTechniqueScores,
};
