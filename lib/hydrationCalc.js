// Rekomendasi cairan presisi berbasis timbangan sesi (§9b) — dipisah dari
// lib/nutritionEngine.js karena beroperasi pada monitoringLogs per-sesi
// (bukan profil/fase harian atlet). Pola sama seperti lib/acwr.js dipisah
// dari lib/periodization.js: konsen data yang berbeda meski dipakai
// bersama oleh nutritionEngine.js.
//
// Faktor pengganda: dokumen rancangan menyebut rentang lazim 1.25-1.5x
// penggantian cairan, tapi angka yang dipakai di sini persis 1.25x sesuai
// arahan eksplisit saat implementasi — lihat NUTRITION-MODULE-DESIGN.md §9b.
const FLUID_REPLACEMENT_MULTIPLIER = 1.25;

// Log monitoring TERAKHIR milik atlet ini yang mengisi beratSebelumKg DAN
// beratSesudahKg (urut tanggal terbaru dulu) — log tanpa timbangan lengkap
// dilewati, bukan dianggap "tidak ada data" secara keseluruhan.
function findLatestWeighedLog(athleteId, monitoringLogs) {
  const logs = (monitoringLogs || [])
    .filter((m) => m.athleteId === athleteId && m.beratSebelumKg != null && m.beratSesudahKg != null)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || (b.id - a.id));
  return logs[0] || null;
}

/**
 * @param {object} athlete
 * @param {object} data - hasil db.load()
 * @returns {{ presisiLiter: number|null, presisiDariSesiTanggal: string|null }}
 */
function computePresisiCairan(athlete, data) {
  const log = findLatestWeighedLog(athlete.id, (data && data.monitoringLogs) || []);
  if (!log) return { presisiLiter: null, presisiDariSesiTanggal: null };

  const cairanDiminumL = (log.cairanDiminumMlSaatSesi || 0) / 1000;
  const kehilanganL = (log.beratSebelumKg - log.beratSesudahKg) + cairanDiminumL;
  // Floor di 0 — kehilanganL bisa negatif/kecil kalau atlet minum lebih
  // banyak dari yang hilang lewat keringat; rekomendasi "minum X liter
  // negatif" tidak masuk akal berapa pun rumusnya.
  const presisiLiter = Math.max(0, Math.round(kehilanganL * FLUID_REPLACEMENT_MULTIPLIER * 10) / 10);

  return { presisiLiter, presisiDariSesiTanggal: log.date };
}

module.exports = { computePresisiCairan, FLUID_REPLACEMENT_MULTIPLIER };
