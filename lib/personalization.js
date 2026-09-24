const { BENCH_100M_L, BENCH_100M_P, classifyByMax } = require('./benchmarks');

// Level prestasi (3 tingkat) memakai klasifikasi benchmark 5-tingkat yang
// sama dengan kartu "Interpretasi & Potensi Atlet" — berlaku untuk SEMUA
// kategori (Sprint, Menengah/Jauh, dst.) karena setiap tabel benchmark
// kategori memakai bentuk 5-tingkat yang sama (Elite Dunia/Elite Asia-SEA/
// Kompetitif-Nasional/Berkembang/Pemula), dipetakan turun ke pengali yang
// sama: index 0-2 -> Elite/Kompetitif ×1,0 · index 3 -> Berkembang ×0,92 ·
// index 4 -> Pemula ×0,80. Pengklasifikasian tabel mana yang dipakai
// (tergantung kategori/nomor/gender) dilakukan oleh caller (routes/program.js),
// bukan di sini — modul ini cuma memetakan index tingkat -> pengali.
const LEVEL_TIERS = [
  { label: 'Elite/Kompetitif', multiplier: 1.0, benchIndexes: [0, 1, 2] },
  { label: 'Berkembang', multiplier: 0.92, benchIndexes: [3] },
  { label: 'Pemula', multiplier: 0.8, benchIndexes: [4] },
];

const ACWR_RISK_THRESHOLD = 1.5;
const ACWR_RISK_MULTIPLIER = 0.75;
const ACWR_MIN_HISTORY_DAYS = 14;

/**
 * Petakan index tier benchmark (0-4, dari classifyByMax/classifyByMin tabel
 * manapun) ke pengali level prestasi. `benchLabel` (opsional) = label tier
 * asli dari tabel sumber, dibawa apa adanya untuk ditampilkan ke pelatih.
 */
function multiplierForTierIndex(tierIndex, benchLabel, missingDataNote, refNote) {
  if (tierIndex == null) {
    return { label: null, multiplier: 1.0, benchTier: null, note: missingDataNote || null, refNote: refNote || null };
  }
  const level = LEVEL_TIERS.find((l) => l.benchIndexes.includes(tierIndex));
  if (!level) return { label: null, multiplier: 1.0, benchTier: benchLabel || null, note: null, refNote: refNote || null };
  return { label: level.label, multiplier: level.multiplier, benchTier: benchLabel || null, note: null, refNote: refNote || null };
}

// Wrapper khusus Sprint (dipetakan dari catatan waktu 100m) — dipertahankan
// sebagai kenyamanan karena masih dipakai di beberapa tempat/tes lama.
function getLevelMultiplier(best100m, jenisKelamin) {
  if (best100m == null) {
    return { label: null, multiplier: 1.0, note: 'Belum ada catatan waktu 100m — pakai formula standar (×1,0).' };
  }
  const table = jenisKelamin === 'P' ? BENCH_100M_P : BENCH_100M_L;
  const tier = classifyByMax(best100m, table);
  if (!tier) return { label: null, multiplier: 1.0, note: null };
  return multiplierForTierIndex(tier.index, tier.label, null);
}

function getAcwrRiskMultiplier(acwrResult) {
  if (!acwrResult || !acwrResult.eligible) {
    return {
      atRisk: false,
      multiplier: 1.0,
      note: `Butuh minimal ${ACWR_MIN_HISTORY_DAYS} hari riwayat monitoring sebelum status risiko ACWR bisa dihitung.`,
    };
  }
  const atRisk = acwrResult.acwr != null && acwrResult.acwr > ACWR_RISK_THRESHOLD;
  return {
    atRisk,
    multiplier: atRisk ? ACWR_RISK_MULTIPLIER : 1.0,
    note: atRisk
      ? `Risiko cedera tinggi terdeteksi (ACWR ${acwrResult.acwr.toFixed(2)} > ${ACWR_RISK_THRESHOLD}) — volume minggu ini dikurangi 25%.`
      : null,
  };
}

/**
 * Dua faktor pengali berlapis (dikalikan), ditampilkan transparan.
 * `levelTierIndex`/`levelBenchLabel` sudah diklasifikasi oleh caller dari
 * tabel benchmark yang sesuai kategori/nomor/gender atlet.
 */
function combinePersonalization({ levelTierIndex, levelBenchLabel, levelMissingDataNote, levelRefNote, acwrResult }) {
  const level = multiplierForTierIndex(levelTierIndex, levelBenchLabel, levelMissingDataNote, levelRefNote);
  const risk = getAcwrRiskMultiplier(acwrResult);
  return {
    multiplier: level.multiplier * risk.multiplier,
    level,
    risk,
  };
}

module.exports = {
  LEVEL_TIERS,
  ACWR_RISK_THRESHOLD,
  ACWR_RISK_MULTIPLIER,
  ACWR_MIN_HISTORY_DAYS,
  multiplierForTierIndex,
  getLevelMultiplier,
  getAcwrRiskMultiplier,
  combinePersonalization,
};
