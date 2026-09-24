// Panduan pelaksanaan sesi (pemanasan → inti → pendinginan) untuk atlet
// mandiri — mereka tidak punya pelatih di lapangan yang menerjemahkan
// "3 × 1000 m @ zona I" jadi langkah konkret. Fungsi murni: hanya membaca
// field sesi yang sudah dihasilkan mesin (sprintEngine, enduranceEngine,
// jumpEngine, genericTraining), tidak mengubah angka program.
const { fmtPace } = require('./endurance');

const WARMUP_BASE = ['Jogging ringan 8–10 menit', 'Drill dinamis: leg swing, A-skip, B-skip, high knees (2× 20 m)'];
const WARMUP_SPEED = [...WARMUP_BASE, '3 akselerasi bertahap 60–80 m (70% → 90%)'];
const COOLDOWN = ['Jogging/jalan santai 5–10 menit', 'Peregangan statis 5 menit (betis, hamstring, quadriceps, pinggul)'];

function restText(s) {
  if (s.restMin != null && s.restMax != null) return `istirahat ${s.restMin}–${s.restMax} menit antar repetisi`;
  if (s.restSec != null) return `istirahat ${s.restSec >= 60 ? `${Math.round(s.restSec / 60 * 10) / 10} menit` : `${s.restSec} detik`} (jog/jalan pelan)`;
  return null;
}

function mainSteps(s, strengthBank) {
  const steps = [];
  const rest = restText(s);

  // Persiapan umum & transisi (genericTraining)
  if (s.key === 'g1') {
    const main = Math.max(10, (s.durationMin || 30) - 10);
    steps.push(`Lari kontinu ${main} menit di pace "masih bisa ngobrol" (RPE ${s.targetRPE || 5})`);
    steps.push('Jaga napas teratur; kalau terengah, turunkan kecepatan');
    return steps;
  }
  if (s.key === 'g2') {
    const list = (strengthBank && strengthBank.length ? strengthBank : ['Squat', 'Lunges', 'Plank', 'Pogo jump']).slice(0, 4);
    steps.push(`Sirkuit 3 putaran: ${list.join(' · ')}`);
    steps.push('Tiap gerakan 40 detik kerja / 20 detik istirahat; istirahat 2 menit antar putaran');
    return steps;
  }
  if (s.key === 'g3') {
    steps.push('Mobilitas pinggul, pergelangan kaki, dan punggung atas 10 menit');
    steps.push('Pliometrik ringan: pogo jump 3× 15, skipping tinggi 3× 20 m, lompat dua kaki di tempat 3× 10');
    steps.push('Pendaratan lembut & senyap — kualitas lebih penting dari jumlah');
    return steps;
  }
  if (s.key === 't1') {
    steps.push(`Aktivitas bebas ${s.durationMin || 20} menit: bersepeda, renang, jalan cepat, atau main bola santai`);
    return steps;
  }

  // Lari menengah/jauh (enduranceEngine)
  if (s.zone) {
    if (s.mode === 'duration') {
      steps.push(`Lari ${s.durMin} menit di zona ${s.zoneLabel || s.zone}${s.paceLabel ? ` — pace ± ${s.paceLabel}` : ''}${s.estDistKm ? ` (≈ ${s.estDistKm} km)` : ''}`);
      if (s.name && /strides/i.test(s.name)) steps.push('Tutup dengan 4–6 strides 80 m (cepat & rileks), jalan kembali sebagai istirahat');
    } else if (s.mode === 'reps') {
      const pace = s.pace ? fmtPace(s.pace) : null;
      steps.push(`${s.reps} × ${s.repDist} m${s.repTimeLabel ? ` @ ${s.repTimeLabel} per repetisi` : ''}${pace ? ` (pace ± ${pace})` : ''}`);
      if (rest) steps.push(rest);
    }
    return steps;
  }

  // Lompat (jumpEngine)
  if (s.mode === 'approach') {
    steps.push(`${s.reps} × approach ${s.dist} m${s.timeLabel ? ` — target ${s.timeLabel}` : ''}`);
    if (rest) steps.push(rest);
    return steps;
  }
  if (s.mode === 'teknik') {
    steps.push(`${s.reps} lompatan teknik dengan approach pendek (4–6 langkah), fokus take-off`);
    steps.push('Rekam 2–3 lompatan dengan HP untuk dicek posisi badan');
    return steps;
  }
  if (s.mode === 'kekuatan') {
    const list = (strengthBank || []).slice(0, 3);
    steps.push(`${s.sets} set × ${s.repsPerSet} repetisi${list.length ? `: ${list.join(' · ')}` : ''}`);
    steps.push('Istirahat 2–3 menit antar set; hentikan bila teknik mulai rusak');
    return steps;
  }

  // Sprint (sprintEngine)
  if (s.reps != null && s.dist != null) {
    steps.push(`${s.reps} × ${s.dist} m${s.timeLabel ? ` — target ${s.timeLabel}` : ''}`);
    if (rest) steps.push(rest);
    steps.push('Kualitas penuh tiap repetisi; berhenti bila waktu melambat jauh dari target');
    return steps;
  }

  if (s.durationMin) steps.push(`Latihan utama ${s.durationMin} menit (RPE target ${s.targetRPE != null ? s.targetRPE : '—'})`);
  return steps;
}

/**
 * @param {object} s - satu sesi dari assembleProgram
 * @param {object} [ctx] - { phase, strengthBank }
 * @returns {{ warmup: string[], main: string[], cooldown: string[], tip: string|null }}
 */
function buildSessionGuide(s, ctx) {
  const c = ctx || {};
  const isSpeed = (s.reps != null && s.dist != null) || s.mode === 'approach' || s.zone === 'I' || s.zone === 'R';
  const isLight = s.key === 't1' || s.key === 'g3';
  return {
    warmup: isLight ? [WARMUP_BASE[0]] : (isSpeed ? WARMUP_SPEED : WARMUP_BASE),
    main: mainSteps(s, c.strengthBank),
    cooldown: COOLDOWN,
    tip: s.targetRPE != null
      ? `Target rasa berat (RPE) ${s.targetRPE}/10. Catat RPE & durasi setelah latihan supaya beban minggu depan bisa disesuaikan.`
      : null,
  };
}

module.exports = { buildSessionGuide };
