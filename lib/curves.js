// Empat set kurva mingguan — beda fase, beda KONTEN sesi, bukan cuma beda skala volume.
// Catatan: nilai-nilai ini rancangan awal (belum ada di kode/dokumen lama) —
// mekanismenya (fase -> kurva -> faktor volume) yang mengikat, angkanya bisa
// disetel ulang oleh pelatih/tim pengembang seiring pemakaian nyata.

// Persiapan Umum — conditioning aerobik + kekuatan umum, belum spesifik nomor.
// Siklus 4 minggu berulang selama fase ini berjalan.
const GPP_WEEK_PHASES = [
  { week: 1, label: 'Adaptasi Aerobik', factor: 0.85, unload: false, contentFocus: 'conditioning' },
  { week: 2, label: 'Bangun Kapasitas', factor: 0.95, unload: false, contentFocus: 'conditioning' },
  { week: 3, label: 'Kekuatan Umum', factor: 1.05, unload: false, contentFocus: 'conditioning' },
  { week: 4, label: 'Unloading', factor: 0.70, unload: true, contentFocus: 'conditioning' },
];

// Persiapan Khusus — sesi spesifik nomor, volume naik-turun mengikuti mesosiklus baku.
const WEEK_PHASES = [
  { week: 1, label: 'Adaptasi', factor: 0.90, unload: false, contentFocus: 'specific' },
  { week: 2, label: 'Progresif', factor: 1.00, unload: false, contentFocus: 'specific' },
  { week: 3, label: 'Puncak Beban Mikro', factor: 1.10, unload: false, contentFocus: 'specific' },
  { week: 4, label: 'Unloading', factor: 0.75, unload: true, contentFocus: 'specific' },
];

// Kompetisi/Puncak (taper) — sesi spesifik SAMA seperti Khusus, volume menurun
// monoton mengikuti hitung mundur ke kompetisi, intensitas dipertajam.
// Diindeks dari SISA minggu ke kompetisi (bukan dari lama fase berjalan).
const TAPER_WEEK_PHASES = {
  3: { label: 'Taper Awal', factor: 0.65, unload: false, contentFocus: 'specific', intensityBoost: 0.02 },
  2: { label: 'Taper Lanjutan', factor: 0.55, unload: false, contentFocus: 'specific', intensityBoost: 0.04 },
  1: { label: 'Taper Akhir', factor: 0.45, unload: false, contentFocus: 'specific', intensityBoost: 0.05 },
  0: { label: 'Minggu Kompetisi', factor: 0.35, unload: false, contentFocus: 'specific', intensityBoost: 0.05 },
};

// Transisi — aktivitas bebas/non-spesifik, volume minimal, konstan.
const TRANSITION_WEEK_PHASES = {
  label: 'Transisi',
  factor: 0.30,
  unload: false,
  contentFocus: 'free',
};

function clampTaperBucket(remainingWeeks) {
  const bucket = Math.max(0, Math.min(3, Math.ceil(remainingWeeks)));
  return bucket;
}

/**
 * Pilih titik kurva mingguan yang berlaku sekarang, sesuai fase.
 * - umum/khusus: diindeks dari weeksIntoPhase, mod panjang siklus (4 minggu).
 * - puncak: diindeks dari sisa minggu ke kompetisi (hitung mundur monoton).
 * - transisi: konstan.
 */
function getWeekPlan(phaseKey, { weeksIntoPhase = 0, remainingWeeks = 0 } = {}) {
  if (phaseKey === 'umum') {
    const cycle = GPP_WEEK_PHASES;
    return { curveSet: 'GPP_WEEK_PHASES', ...cycle[weeksIntoPhase % cycle.length] };
  }
  if (phaseKey === 'khusus') {
    const cycle = WEEK_PHASES;
    return { curveSet: 'WEEK_PHASES', ...cycle[weeksIntoPhase % cycle.length] };
  }
  if (phaseKey === 'puncak') {
    const bucket = clampTaperBucket(remainingWeeks);
    return { curveSet: 'TAPER_WEEK_PHASES', ...TAPER_WEEK_PHASES[bucket] };
  }
  if (phaseKey === 'transisi') {
    return { curveSet: 'TRANSITION_WEEK_PHASES', ...TRANSITION_WEEK_PHASES };
  }
  return null;
}

module.exports = {
  GPP_WEEK_PHASES,
  WEEK_PHASES,
  TAPER_WEEK_PHASES,
  TRANSITION_WEEK_PHASES,
  getWeekPlan,
};
