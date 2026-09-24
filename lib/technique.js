// Skala Likert & builder skor checklist teknik — dipakai bersama oleh semua
// kategori yang punya checklist teknik kualitatif (Sprint, Lompat). Tidak
// spesifik satu kategori, jadi diekstrak dari lib/sprintEngine.js supaya
// lib/jumpEngine.js bisa pakai mekanisme yang sama tanpa duplikasi.

const LIKERT_SCALE = [
  { value: 1, label: 'Sangat Kurang' },
  { value: 2, label: 'Kurang' },
  { value: 3, label: 'Cukup' },
  { value: 4, label: 'Baik' },
  { value: 5, label: 'Sangat Baik' },
];

/**
 * Bangun daftar { item, score } dari daftar butir checklist KANONIS yang
 * dioper caller (bukan dari klien) supaya konsisten walau daftar butir
 * berubah di rilis mendatang. `rawScores` = array angka (atau string/null)
 * urut sesuai `checklist`.
 */
function buildTechniqueScores(checklist, rawScores) {
  const errors = [];
  if (rawScores == null) {
    return { techniqueScores: checklist.map((item) => ({ item, score: null })), errors };
  }
  if (!Array.isArray(rawScores)) {
    return { techniqueScores: null, errors: ['Format skor checklist teknik tidak valid'] };
  }

  const techniqueScores = checklist.map((item, i) => {
    const raw = rawScores[i];
    if (raw === '' || raw == null) return { item, score: null };
    const score = Number(raw);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      errors.push(`Skor checklist teknik "${item}" harus bilangan 1-5`);
      return { item, score: null };
    }
    return { item, score };
  });

  return { techniqueScores, errors };
}

module.exports = { LIKERT_SCALE, buildTechniqueScores };
