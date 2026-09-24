const { paceSecPerKm, PACE_ZONES } = require('./endurance');
const { GPP_SESSIONS, TRANSITION_SESSION, GENERIC_STRENGTH_BANK } = require('./genericTraining');

// Skema sesi per kategori — beda konten, bukan cuma beda skala volume
// (lihat dok. arsitektur bagian 4.4: "Menengah vs Jauh beda volume dasar").
// Diambil dari kode lama (sprint-coach-server/public/app.js:955-964) sebagai
// acuan struktur yang sudah divalidasi, target RPE ditambahkan baru.
const MENENGAH_SESSIONS = [
  { key: 's1', label: 'Sesi I', name: 'Interval', day: 'Selasa', goal: 'VO2 maks & kecepatan ambang atas', zone: 'I', mode: 'reps', repDistMin: 300, repDistMax: 600, volMin: 2400, volMax: 3600, restSec: 90, targetRPE: 9 },
  { key: 's2', label: 'Sesi II', name: 'Tempo/Threshold', day: 'Kamis', goal: 'Daya tahan ambang laktat', zone: 'T', mode: 'duration', durMin: 15, durMax: 22, targetRPE: 7 },
  { key: 's3', label: 'Sesi III', name: 'Lari Panjang + Strides', day: 'Minggu', goal: 'Fondasi aerobik & ekonomi lari', zone: 'E', mode: 'duration', durMin: 40, durMax: 52, targetRPE: 5 },
];

const JAUH_SESSIONS = [
  { key: 's1', label: 'Sesi I', name: 'Threshold', day: 'Selasa', goal: 'Daya tahan ambang laktat', zone: 'T', mode: 'duration', durMin: 20, durMax: 32, targetRPE: 7 },
  { key: 's2', label: 'Sesi II', name: 'Interval', day: 'Kamis', goal: 'VO2 maks', zone: 'I', mode: 'reps', repDistMin: 800, repDistMax: 1200, volMin: 3000, volMax: 5000, restSec: 120, targetRPE: 9 },
  { key: 's3', label: 'Sesi III', name: 'Lari Panjang', day: 'Minggu', goal: 'Fondasi aerobik & daya tahan', zone: 'E', mode: 'duration', durMin: 70, durMax: 100, targetRPE: 5 },
];

const ENDURANCE_STRENGTH_BANK = {
  khusus: ['Hill sprints (bukit pendek, power aerobik)', 'Sirkuit kekuatan tungkai (single-leg squat, calf raise)', 'Core & stability lanjutan', 'Plyometric ringan untuk ekonomi lari'],
  puncak: ['Strides pendek pemeliharaan turnover', 'Kekuatan tungkai volume rendah (maintenance)', 'Hindari kerja kekuatan berat baru mendekati kompetisi'],
};
const STRENGTH_BANK = { ...GENERIC_STRENGTH_BANK, ...ENDURANCE_STRENGTH_BANK };

function mid(a, b) {
  return (a + b) / 2;
}

function fmtRepTime(sec) {
  return sec.toFixed(0) + ' dtk';
}

function sessionsFor(category) {
  return category === 'menengah' ? MENENGAH_SESSIONS : JAUH_SESSIONS;
}

/**
 * Boost volume khusus lari jauh (maraton/half) — cuma dipakai untuk sesi
 * berbasis durasi (lari panjang/tempo), bukan sesi interval berbasis
 * repetisi, mengikuti perilaku kode lama (sprint-coach-server/public/app.js:1056-1069).
 */
function marathonBoostFor(category, event) {
  if (category !== 'jauh') return 1.0;
  if (event === 'marathon') return 1.25;
  if (event === 'half_marathon') return 1.1;
  return 1.0;
}

/**
 * Bangun sesi konkret untuk minggu berjalan. Sama kontrak dengan
 * lib/sprintEngine.js generateWeekSessions supaya routes/program.js bisa
 * dispatch ke engine manapun secara seragam.
 */

// Undulasi penekanan menengah/jauh — 4 minggu khusus + taper.
// volMul / rpeShift diindeks per template [interval-ish, threshold-ish, long].
const ENDURANCE_WEEK_EMPHASIS = [
  {
    key: 'adaptasi',
    names: {
      menengah: ['Interval — fondasi VO2', 'Tempo ringan / continuous', 'Lari panjang + strides (fondasi)'],
      jauh: ['Threshold — adaptasi', 'Interval terkendali', 'Lari panjang (fondasi)'],
    },
    goals: {
      menengah: ['Bangun kapasitas VO2 tanpa overreaching', 'Kenalkan zona ambang', 'Volume aerobik nyaman + strides'],
      jauh: ['Bangun waktu di zona T', 'Interval moderat', 'Fondasi jarak jauh'],
    },
    volMul: [0.85, 0.9, 0.95],
    rpeShift: [-1, -1, 0],
  },
  {
    key: 'progresif',
    names: {
      menengah: ['Interval', 'Tempo/Threshold', 'Lari Panjang + Strides'],
      jauh: ['Threshold', 'Interval', 'Lari Panjang'],
    },
    goals: {
      menengah: ['VO2 maks & kecepatan ambang atas', 'Daya tahan ambang laktat', 'Fondasi aerobik & ekonomi lari'],
      jauh: ['Daya tahan ambang laktat', 'VO2 maks', 'Fondasi aerobik & daya tahan'],
    },
    volMul: [1, 1, 1],
    rpeShift: [0, 0, 0],
  },
  {
    key: 'puncak_mikro',
    names: {
      menengah: ['Interval — quality', 'Tempo/Threshold tajam', 'Lari panjang (volume terkontrol)'],
      jauh: ['Threshold quality', 'Interval VO2', 'Lari panjang puncak (terkontrol)'],
    },
    goals: {
      menengah: ['Kualitas tinggi, istirahat cukup', 'Dorong ambang', 'Jaga aerobik tanpa residual tinggi'],
      jauh: ['Waktu berkualitas di T', 'Stimulus VO2 utama minggu ini', 'Long run puncak mesosiklus'],
    },
    volMul: [1.1, 1.05, 0.95],
    rpeShift: [0, 1, 0],
  },
  {
    key: 'unload',
    names: {
      menengah: ['Interval ringan / strides', 'Tempo singkat', 'Lari panjang mudah'],
      jauh: ['Threshold singkat', 'Interval ringan', 'Lari panjang recovery'],
    },
    goals: {
      menengah: ['Pertahankan feel kecepatan', 'Maintenance ambang', 'Unload aerobik'],
      jauh: ['Maintenance T', 'Volume interval turun', 'Recovery long run'],
    },
    volMul: [0.7, 0.75, 0.8],
    rpeShift: [-1, -1, -1],
  },
];

function enduranceEmphasisFor(weekPlan) {
  if (weekPlan.curveSet === 'TAPER_WEEK_PHASES') {
    const f = weekPlan.factor || 0.5;
    if (f <= 0.4) return ENDURANCE_WEEK_EMPHASIS[3];
    if (f <= 0.55) {
      return {
        ...ENDURANCE_WEEK_EMPHASIS[2],
        volMul: [0.85, 0.8, 0.7],
        names: ENDURANCE_WEEK_EMPHASIS[2].names,
      };
    }
    return ENDURANCE_WEEK_EMPHASIS[1];
  }
  const label = (weekPlan.label || '').toLowerCase();
  if (label.includes('unload')) return ENDURANCE_WEEK_EMPHASIS[3];
  if (label.includes('puncak')) return ENDURANCE_WEEK_EMPHASIS[2];
  if (label.includes('progres')) return ENDURANCE_WEEK_EMPHASIS[1];
  if (label.includes('adaptasi')) return ENDURANCE_WEEK_EMPHASIS[0];
  const f = weekPlan.factor || 1;
  if (f <= 0.8) return ENDURANCE_WEEK_EMPHASIS[3];
  if (f >= 1.05) return ENDURANCE_WEEK_EMPHASIS[2];
  if (f >= 0.95) return ENDURANCE_WEEK_EMPHASIS[1];
  return ENDURANCE_WEEK_EMPHASIS[0];
}

function generateWeekSessions({ category, event, vdot, weekPlan, personalizationMultiplier }) {
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
  if (!vdot) {
    return {
      contentFocus: 'specific',
      sessions: [],
      strengthBank: weekPlan.curveSet === 'TAPER_WEEK_PHASES' ? STRENGTH_BANK.puncak : STRENGTH_BANK.khusus,
      techniqueChecklist: null,
      warning: 'Belum ada data time trial yang valid — tidak bisa hitung VDOT dan pace latihan. Lengkapi tes untuk generate sesi.',
    };
  }

  const templates = sessionsFor(category);
  const boost = marathonBoostFor(category, event);
  const emp = enduranceEmphasisFor(weekPlan);
  const catKey = category === 'jauh' ? 'jauh' : 'menengah';
  const nameList = (emp.names && emp.names[catKey]) || [];
  const goalList = (emp.goals && emp.goals[catKey]) || [];

  const sessions = templates.map((t, idx) => {
    const zoneInfo = PACE_ZONES.find((z) => z.key === t.zone);
    const pace = paceSecPerKm(vdot, zoneInfo.pct);
    const volMul = (emp.volMul && emp.volMul[idx] != null) ? emp.volMul[idx] : 1;
    const rpeShift = (emp.rpeShift && emp.rpeShift[idx] != null) ? emp.rpeShift[idx] : 0;
    const name = nameList[idx] || t.name;
    const goal = goalList[idx] || t.goal;
    const rpe = Math.max(3, Math.min(10, (t.targetRPE || 6) + rpeShift));

    if (t.mode === 'duration') {
      const baseDur = mid(t.durMin, t.durMax);
      // Long run (biasanya idx terakhir) tetap kena marathonBoost; interval duration juga
      const sessionBoost = t.zone === 'E' || t.zone === 'T' ? boost : 1.0;
      const durMin = Math.max(10, Math.round(baseDur * weekPlan.factor * personalizationMultiplier * sessionBoost * volMul));
      const estDistKm = pace ? (durMin * 60) / pace : null;
      return {
        key: t.key, label: t.label, name, day: t.day, goal,
        zone: t.zone, zoneLabel: zoneInfo.label, mode: 'duration',
        durMin, pace: pace, paceLabel: pace != null ? `${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, '0')}/km` : '—',
        estDistKm: estDistKm != null ? Math.round(estDistKm * 10) / 10 : null,
        targetRPE: rpe,
        weekEmphasis: emp.key,
      };
    }

    // mode === 'reps'
    const baseVol = mid(t.volMin, t.volMax);
    const repDist = mid(t.repDistMin, t.repDistMax);
    const targetVol = baseVol * weekPlan.factor * personalizationMultiplier * volMul;
    const reps = Math.max(2, Math.round(targetVol / repDist));
    const actualVol = reps * repDist;
    const repTimeSec = pace ? (repDist / 1000) * pace : null;
    return {
      key: t.key, label: t.label, name, day: t.day, goal,
      zone: t.zone, zoneLabel: zoneInfo.label, mode: 'reps',
      reps, repDist: Math.round(repDist), volume: Math.round(actualVol), restSec: t.restSec,
      pace: pace, repTimeLabel: repTimeSec != null ? fmtRepTime(repTimeSec) : '—',
      targetRPE: rpe,
      weekEmphasis: emp.key,
    };
  });

  return {
    contentFocus: 'specific',
    sessions,
    strengthBank: weekPlan.curveSet === 'TAPER_WEEK_PHASES' ? STRENGTH_BANK.puncak : STRENGTH_BANK.khusus,
    techniqueChecklist: null,
    weekEmphasis: emp.key,
  };
}

module.exports = { generateWeekSessions, MENENGAH_SESSIONS, JAUH_SESSIONS, STRENGTH_BANK, sessionsFor, marathonBoostFor };
