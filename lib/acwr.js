const { localDateKey: dateKey } = require('./dateUtil');

const DAY_MS = 24 * 60 * 60 * 1000;

function trainingLoad(rpe, durationMin) {
  return rpe * durationMin;
}

/**
 * Deret ACWR harian — satu fungsi dipakai baik untuk snapshot "hari ini"
 * (computeACWR, di bawah) maupun grafik tren (dipanggil langsung dari
 * routes/monitoring.js). `days` = berapa hari terakhir dihitung mundur dari
 * `endDate`; hari sebelum riwayat tercatat paling awal dilewati (bukan diisi
 * 0 palsu — supaya tidak menyiratkan "training load nol" padahal memang
 * belum ada datanya sama sekali).
 *
 * `logs` = daftar { date: 'YYYY-MM-DD', rpe, durationMin } milik satu atlet.
 */
function computeACWRSeries(logs, endDate = new Date(), days = 42) {
  if (!logs || logs.length === 0) return [];

  const loadByDate = new Map();
  let earliest = null;
  for (const log of logs) {
    const load = trainingLoad(Number(log.rpe), Number(log.durationMin));
    loadByDate.set(log.date, (loadByDate.get(log.date) || 0) + load);
    const d = new Date(log.date + 'T00:00:00');
    if (!earliest || d < earliest) earliest = d;
  }

  function windowAvg(day, windowDays) {
    let sum = 0;
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(day.getTime() - i * DAY_MS);
      sum += loadByDate.get(dateKey(d)) || 0;
    }
    return sum / windowDays;
  }

  const endDay = new Date(dateKey(endDate) + 'T00:00:00');
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(endDay.getTime() - i * DAY_MS);
    if (day < earliest) continue;
    const daysOfHistory = Math.max(1, Math.floor((day - earliest) / DAY_MS) + 1);
    const acuteWindow = Math.min(7, daysOfHistory);
    const chronicWindow = Math.min(28, daysOfHistory);
    const acuteAvg = windowAvg(day, acuteWindow);
    const chronicAvg = windowAvg(day, chronicWindow);
    const acwr = chronicAvg > 0 ? acuteAvg / chronicAvg : null;
    series.push({
      date: dateKey(day),
      trainingLoad: loadByDate.get(dateKey(day)) || 0,
      daysOfHistory,
      acuteWindow,
      chronicWindow,
      acuteAvg,
      chronicAvg,
      acwr,
      eligible: daysOfHistory >= 14,
    });
  }
  return series;
}

/**
 * ACWR = beban akut (rata-rata harian, jendela terkini) / beban kronik
 * (rata-rata harian, jendela lebih panjang), dengan pembagi dinamis mengikuti
 * panjang riwayat sungguhan (bukan selalu dibagi tetap 7/28) supaya hari-hari
 * yang belum ada datanya tidak mengencerkan rata-rata secara artifisial.
 * Cukup mengambil titik terakhir dari computeACWRSeries — satu sumber
 * kebenaran untuk snapshot maupun tren, tidak ada logika yang diduplikasi.
 */
function computeACWR(logs, today = new Date()) {
  const series = computeACWRSeries(logs, today, 1);
  if (!series.length) {
    return { eligible: false, acwr: null, daysOfHistory: 0, acuteAvg: null, chronicAvg: null };
  }
  const { date, trainingLoad: _tl, ...snapshot } = series[0];
  return snapshot;
}

module.exports = { trainingLoad, computeACWR, computeACWRSeries };
