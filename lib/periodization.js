const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const PHASE_LABELS = {
  umum: 'Persiapan Umum',
  khusus: 'Persiapan Khusus',
  puncak: 'Kompetisi/Puncak',
  transisi: 'Transisi',
};

function parseDate(str) {
  const d = new Date(String(str) + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Fase ditentukan dari SISA WAKTU KE KOMPETISI (bekerja mundur dari tanggal
 * kompetisi), bukan dari waktu yang sudah berlalu sejak mulai.
 *
 * - referenceDate = max(today, startDate) — kalau program belum dimulai,
 *   pakai startDate sebagai acuan supaya fase yang dihitung adalah fase yang
 *   SUNGGUH akan berlaku di hari pertama, bukan asal default.
 * - referenceDate > compDate  -> Transisi (siklus sudah lewat kompetisi)
 * - sisa > 9 minggu           -> Persiapan Umum
 * - sisa 3–9 minggu           -> Persiapan Khusus
 * - sisa <= 3 minggu          -> Kompetisi/Puncak (taper)
 *
 * Fase pendek dilewati sepenuhnya secara alami oleh perbandingan ini —
 * tidak ada logika proporsional/paksa yang memaksakan semua fase muncul.
 */
function computePhase(periodization, today = new Date()) {
  const startDate = parseDate(periodization && periodization.startDate);
  const compDate = parseDate(periodization && periodization.compDate);
  const manualPhase = periodization && periodization.manualPhase;

  if (manualPhase && PHASE_LABELS[manualPhase]) {
    return {
      phase: manualPhase,
      label: PHASE_LABELS[manualPhase],
      manual: true,
      note: 'Fase diatur manual oleh pelatih (override).',
    };
  }

  if (!startDate || !compDate || compDate <= startDate) {
    return { phase: null, label: null, manual: false, note: 'Tanggal periodisasi belum lengkap/valid.' };
  }

  const referenceDate = today < startDate ? startDate : today;
  const notStarted = today < startDate;

  if (referenceDate > compDate) {
    const weeksSinceComp = Math.floor((referenceDate - compDate) / WEEK_MS);
    return {
      phase: 'transisi',
      label: PHASE_LABELS.transisi,
      manual: false,
      remainingWeeks: -weeksSinceComp,
      note:
        weeksSinceComp > 0
          ? 'Siklus periodisasi ini sudah lewat tanggal kompetisi. Perbarui tanggal untuk memulai siklus berikutnya.'
          : null,
    };
  }

  const remainingWeeks = (compDate - referenceDate) / WEEK_MS;
  let phase;
  if (remainingWeeks > 9) phase = 'umum';
  else if (remainingWeeks > 3) phase = 'khusus';
  else phase = 'puncak';

  return {
    phase,
    label: PHASE_LABELS[phase],
    manual: false,
    remainingWeeks: Math.round(remainingWeeks * 10) / 10,
    note: notStarted
      ? 'Program belum dimulai — fase dihitung dari tanggal mulai yang akan berlaku di hari pertama.'
      : null,
  };
}

/**
 * Berapa minggu sudah berjalan sejak fase saat ini dimulai — dipakai untuk
 * mengindeks kurva mingguan berulang (GPP/SPP). Untuk Puncak/Transisi tidak
 * dipakai karena kurvanya diindeks dari sisa minggu ke kompetisi, bukan dari
 * lama fase berjalan.
 */
function weeksElapsedInPhase(periodization, phaseResult, today = new Date()) {
  if (!phaseResult || phaseResult.manual || !phaseResult.phase) return 0;
  const startDate = parseDate(periodization && periodization.startDate);
  const compDate = parseDate(periodization && periodization.compDate);
  if (!startDate || !compDate) return 0;
  const referenceDate = today < startDate ? startDate : today;

  if (phaseResult.phase === 'umum') {
    return Math.max(0, Math.floor((referenceDate - startDate) / WEEK_MS));
  }
  if (phaseResult.phase === 'khusus') {
    const phaseStart = new Date(compDate.getTime() - 9 * WEEK_MS);
    return Math.max(0, Math.floor((referenceDate - Math.max(phaseStart, startDate)) / WEEK_MS));
  }
  return 0;
}

module.exports = { computePhase, weeksElapsedInPhase, PHASE_LABELS };
