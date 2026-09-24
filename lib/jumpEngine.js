const { vMaxFromBest100 } = require('./benchmarks');
const { GPP_SESSIONS, TRANSITION_SESSION, GENERIC_STRENGTH_BANK } = require('./genericTraining');
const { buildTechniqueScores: buildScores } = require('./technique');

// Skema 3 sesi/minggu — approach run pakai kembali kalkulasi kecepatan
// maksimal dari modul Sprint (basis: kecepatan approach dari 100m, sama
// untuk Jauh & Tinggi). Diambil dari kode lama
// (sprint-coach-server/public/app.js:978-985) sebagai acuan struktur yang
// sudah divalidasi, target RPE ditambahkan baru.
const LOMPAT_SESSIONS = {
  s1: { key: 's1', label: 'Sesi I', name: 'Kecepatan Approach', day: 'Senin', goal: 'Kecepatan & konsistensi ritme lari ancang-ancang', intMin: 0.95, intMax: 1.0, distMin: 20, distMax: 30, restMin: 2, restMax: 3, volMin: 150, volMax: 240, targetRPE: 8 },
  s2: { key: 's2', label: 'Sesi II', name: 'Teknik Lompat', day: 'Rabu', goal: 'Otomatisasi teknik take-off & flight', repsMin: 8, repsMax: 14, targetRPE: 6 },
  s3: { key: 's3', label: 'Sesi III', name: 'Kekuatan & Pliometrik', day: 'Jumat', goal: 'Power eksplosif kaki & reaktivitas', setsMin: 3, setsMax: 5, repsPerSetMin: 5, repsPerSetMax: 8, targetRPE: 8 },
};

// Penekanan mesosiklus 4 minggu (khusus) — undulasi ISI, bukan hanya volume.
// week index = weeksIntoPhase % 4 (sama dengan kurva WEEK_PHASES).
const JUMP_WEEK_EMPHASIS = [
  {
    key: 'adaptasi',
    approachName: 'Approach — ritme & akurasi',
    approachGoal: 'Konsistensi langkah approach; intensitas submaksimal',
    techniqueName: 'Teknik Lompat — fokus utama',
    techniqueGoal: 'Otomatisasi take-off & flight (penekanan minggu adaptasi)',
    strengthName: 'Kekuatan umum penunjang',
    strengthGoal: 'Fondasi kekuatan; volume sedang',
    approachVolMul: 0.85, approachIntMul: 0.97, approachRpe: 7,
    techniqueRepMul: 1.15, techniqueRpe: 6,
    strengthVolMul: 0.9, strengthRpe: 7,
  },
  {
    key: 'progresif',
    approachName: 'Kecepatan Approach',
    approachGoal: 'Kecepatan & konsistensi ritme lari ancang-ancang',
    techniqueName: 'Teknik Lompat',
    techniqueGoal: 'Otomatisasi teknik take-off & flight',
    strengthName: 'Kekuatan & Pliometrik',
    strengthGoal: 'Power eksplosif kaki & reaktivitas',
    approachVolMul: 1.0, approachIntMul: 1.0, approachRpe: 8,
    techniqueRepMul: 1.0, techniqueRpe: 6,
    strengthVolMul: 1.0, strengthRpe: 8,
  },
  {
    key: 'puncak_mikro',
    approachName: 'Approach — quality speed',
    approachGoal: 'Approach mendekati kompetisi; kualitas tinggi, istirahat cukup',
    techniqueName: 'Teknik — race-specific',
    techniqueGoal: 'Integrasi approach + take-off seperti situasi lomba',
    strengthName: 'Pliometrik puncak (volume terkontrol)',
    strengthGoal: 'Power puncak; hindari fatigue residual',
    approachVolMul: 1.05, approachIntMul: 1.0, approachRpe: 9,
    techniqueRepMul: 0.9, techniqueRpe: 7,
    strengthVolMul: 1.1, strengthRpe: 8,
  },
  {
    key: 'unload',
    approachName: 'Approach ringan / ritme',
    approachGoal: 'Pertahankan feel approach; volume & intensitas turun',
    techniqueName: 'Teknik — maintenance',
    techniqueGoal: 'Kualitas gerak tanpa akumulasi lelah',
    strengthName: 'Kekuatan ringan / mobilisasi',
    strengthGoal: 'Unload: power maintenance, bukan hipertrofi',
    approachVolMul: 0.7, approachIntMul: 0.95, approachRpe: 6,
    techniqueRepMul: 0.75, techniqueRpe: 5,
    strengthVolMul: 0.65, strengthRpe: 6,
  },
];

function jumpEmphasisFor(weekPlan) {
  // Puncak/taper: pakai penekanan mendekati unload + quality
  if (weekPlan.curveSet === 'TAPER_WEEK_PHASES') {
    const f = weekPlan.factor || 0.5;
    if (f <= 0.4) return JUMP_WEEK_EMPHASIS[3];
    if (f <= 0.55) return { ...JUMP_WEEK_EMPHASIS[2], approachVolMul: 0.85, strengthVolMul: 0.8, approachRpe: 8 };
    return JUMP_WEEK_EMPHASIS[1];
  }
  // Khusus: ikuti label/week dari kurva jika ada, else factor
  const label = (weekPlan.label || '').toLowerCase();
  if (label.includes('unload')) return JUMP_WEEK_EMPHASIS[3];
  if (label.includes('puncak')) return JUMP_WEEK_EMPHASIS[2];
  if (label.includes('progres')) return JUMP_WEEK_EMPHASIS[1];
  if (label.includes('adaptasi')) return JUMP_WEEK_EMPHASIS[0];
  // fallback by factor
  const f = weekPlan.factor || 1;
  if (f <= 0.8) return JUMP_WEEK_EMPHASIS[3];
  if (f >= 1.05) return JUMP_WEEK_EMPHASIS[2];
  if (f >= 0.95) return JUMP_WEEK_EMPHASIS[1];
  return JUMP_WEEK_EMPHASIS[0];
}


// Checklist teknik & bank kekuatan dibedakan Jauh (power horizontal) vs
// Tinggi (power vertikal) sesuai dok. arsitektur bagian 4.4 — rancangan
// awal, belum ada di kode/dokumen lama.
const TECHNIQUE_CHECKLIST = {
  lompat_jauh: [
    'Konsistensi jumlah langkah approach tiap percobaan',
    'Posisi kaki tumpu saat take-off (tidak overstride)',
    'Sudut take-off & ekstensi pinggul-lutut-pergelangan kaki',
    'Teknik flight (hang/hitch-kick) & posisi mendarat',
  ],
  lompat_tinggi: [
    'Kurva approach (J-curve) & kemiringan badan ke dalam',
    'Posisi plant kaki tumpu & sudut take-off',
    'Rotasi punggung & posisi bahu melewati mistar',
    'Timing kick kaki ayun & clearance kaki terakhir',
  ],
};

const JUMP_STRENGTH_BANK = {
  khusus: {
    lompat_jauh: ['Broad jump / standing triple jump (power horizontal)', 'Sled push/pull (akselerasi approach)', 'Bounding horizontal', 'Box jump horizontal-ke-vertikal'],
    lompat_tinggi: ['Depth jump (reaktif vertikal)', 'Squat jump / hex bar jump', 'Single-leg vertical bound', 'Drill clearance mistar rendah'],
  },
  puncak: {
    lompat_jauh: ['Pliometrik horizontal ringan (maintenance)', 'Approach run rileks, fokus akurasi step', 'Hindari kerja kekuatan berat baru'],
    lompat_tinggi: ['Depth jump volume rendah (maintenance)', 'Drill take-off ringan', 'Hindari kerja kekuatan berat baru'],
  },
};

function strengthBankFor(phaseKey, event) {
  const bank = JUMP_STRENGTH_BANK[phaseKey] && JUMP_STRENGTH_BANK[phaseKey][event];
  return bank || JUMP_STRENGTH_BANK.khusus.lompat_jauh;
}

function mid(a, b) {
  return (a + b) / 2;
}

function fmtTime(sec) {
  return sec.toFixed(2) + ' dtk';
}

function buildTechniqueScores(event, rawScores) {
  return buildScores(TECHNIQUE_CHECKLIST[event] || [], rawScores);
}

/**
 * Bangun sesi konkret untuk minggu berjalan. Kontrak balikan sama dengan
 * lib/sprintEngine.js & lib/enduranceEngine.js.
 */
function generateWeekSessions({ event, best100m, weekPlan, personalizationMultiplier }) {
  const vmax = vMaxFromBest100(best100m);

  if (weekPlan.contentFocus === 'free') {
    return {
      contentFocus: 'free',
      sessions: [{ ...TRANSITION_SESSION, durationMin: Math.round(TRANSITION_SESSION.durationMin * weekPlan.factor) }],
      strengthBank: GENERIC_STRENGTH_BANK.transisi,
      techniqueChecklist: null,
    };
  }

  if (weekPlan.contentFocus === 'conditioning') {
    const sessions = GPP_SESSIONS.map((s) => ({
      ...s,
      durationMin: Math.round(s.durationMin * weekPlan.factor * personalizationMultiplier),
    }));
    return { contentFocus: 'conditioning', sessions, strengthBank: GENERIC_STRENGTH_BANK.umum, techniqueChecklist: null };
  }

  // contentFocus === 'specific'
  const phaseKey = weekPlan.curveSet === 'TAPER_WEEK_PHASES' ? 'puncak' : 'khusus';
  if (!vmax) {
    return {
      contentFocus: 'specific',
      sessions: [],
      strengthBank: strengthBankFor(phaseKey, event),
      techniqueChecklist: TECHNIQUE_CHECKLIST[event] || null,
      warning: 'Catatan waktu 100m belum ada — tidak bisa hitung kecepatan approach. Lengkapi tes untuk generate sesi.',
    };
  }

  const c = LOMPAT_SESSIONS;
  const intensityBoost = weekPlan.intensityBoost || 0;
  const mult = weekPlan.factor * personalizationMultiplier;
  const emp = jumpEmphasisFor(weekPlan);

  // Sesi I — Approach (undulasi volume, intensitas, nama, RPE)
  const baseVol1 = mid(c.s1.volMin, c.s1.volMax);
  const dist1 = mid(c.s1.distMin, c.s1.distMax);
  const targetVol1 = baseVol1 * mult * emp.approachVolMul;
  const reps1 = Math.max(2, Math.round(targetVol1 / dist1));
  const intMax1 = Math.min(1.0, (c.s1.intMax + intensityBoost) * emp.approachIntMul);
  const intMin1 = Math.min(intMax1, (c.s1.intMin + intensityBoost) * emp.approachIntMul);
  const tFast1 = dist1 / (vmax * intMax1);
  const tSlow1 = dist1 / (vmax * intMin1);
  const timeLabel1 = intMin1 === intMax1
    ? `${fmtTime(tFast1)} (${Math.round(intMax1 * 100)}%)`
    : `${fmtTime(tFast1)} – ${fmtTime(tSlow1)} (${Math.round(intMin1 * 100)}-${Math.round(intMax1 * 100)}%)`;
  const sess1 = {
    key: c.s1.key, label: c.s1.label, name: emp.approachName, day: c.s1.day, goal: emp.approachGoal,
    mode: 'approach', reps: reps1, dist: Math.round(dist1), restMin: c.s1.restMin, restMax: c.s1.restMax,
    volume: Math.round(reps1 * dist1), timeLabel: timeLabel1, targetRPE: emp.approachRpe,
    weekEmphasis: emp.key,
  };

  // Sesi II — Teknik
  const baseReps2 = mid(c.s2.repsMin, c.s2.repsMax);
  const reps2 = Math.max(4, Math.round(baseReps2 * mult * emp.techniqueRepMul));
  const sess2 = {
    key: c.s2.key, label: c.s2.label, name: emp.techniqueName, day: c.s2.day, goal: emp.techniqueGoal,
    mode: 'teknik', reps: reps2, targetRPE: emp.techniqueRpe, weekEmphasis: emp.key,
  };

  // Sesi III — Kekuatan / pliometrik
  const sets3 = Math.max(2, Math.round(mid(c.s3.setsMin, c.s3.setsMax) * mult * emp.strengthVolMul));
  const repsPerSet3 = Math.max(3, Math.round(mid(c.s3.repsPerSetMin, c.s3.repsPerSetMax) * Math.min(1.15, mult * emp.strengthVolMul)));
  const sess3 = {
    key: c.s3.key, label: c.s3.label, name: emp.strengthName, day: c.s3.day, goal: emp.strengthGoal,
    mode: 'kekuatan', sets: sets3, repsPerSet: repsPerSet3, targetRPE: emp.strengthRpe, weekEmphasis: emp.key,
  };

  return {
    contentFocus: 'specific',
    sessions: [sess1, sess2, sess3],
    strengthBank: strengthBankFor(phaseKey, event),
    techniqueChecklist: TECHNIQUE_CHECKLIST[event] || null,
    weekEmphasis: emp.key,
  };
}

module.exports = { generateWeekSessions, LOMPAT_SESSIONS, TECHNIQUE_CHECKLIST, buildTechniqueScores };
