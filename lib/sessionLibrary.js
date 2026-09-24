/**
 * Katalog standar sesi atletik untuk override manual pelatih.
 */
const SESSION_LIBRARY = [
  {
    id: 'recovery_easy',
    group: 'Recovery',
    label: 'Recovery / Easy',
    summary: 'Lari/jalan sangat ringan atau istirahat aktif. Mengurangi residual fatigue tanpa stres besar.',
    purpose: 'Pemulihan & jaga ritme tanpa menambah beban akut signifikan.',
    intensityNote: 'RPE 3–5 · volume rendah',
    defaultTargetRPE: 4,
    defaultDurationMin: 30,
    defaultVolumeM: null,
    intensityClass: 'easy',
    idealPerWeek: { min: 0, max: 3 },
    phaseHint: 'Tepat saat ACWR tinggi atau keluhan nyeri.',
  },
  {
    id: 'aerobic_base',
    group: 'Aerobik',
    label: 'Aerobik dasar / easy continuous',
    summary: 'Volume kontinyu di zona nyaman (conversation pace).',
    purpose: 'Fondasi daya tahan & efisiensi.',
    intensityNote: 'RPE 5–6',
    defaultTargetRPE: 5,
    defaultDurationMin: 45,
    defaultVolumeM: null,
    intensityClass: 'moderate',
    idealPerWeek: { min: 1, max: 4 },
    phaseHint: 'Utama di persiapan umum.',
  },
  {
    id: 'tempo_threshold',
    group: 'Threshold',
    label: 'Tempo / threshold',
    summary: 'Kerja di sekitar ambang — tidak nyaman tapi terkendali.',
    purpose: 'Geser ambang laktat / pace kompetitif lebih lama.',
    intensityNote: 'RPE 6–7',
    defaultTargetRPE: 7,
    defaultDurationMin: 40,
    defaultVolumeM: null,
    intensityClass: 'hard',
    idealPerWeek: { min: 1, max: 2 },
    phaseHint: 'Ideal 1–2×/minggu; hindari back-to-back tanpa easy.',
  },
  {
    id: 'intervals_vo2',
    group: 'Speed',
    label: 'Interval VO2 / quality',
    summary: 'Repetisi intensitas tinggi dengan istirahat cukup.',
    purpose: 'Daya aerobik maksimal & kecepatan.',
    intensityNote: 'RPE 8–9',
    defaultTargetRPE: 9,
    defaultDurationMin: 50,
    defaultVolumeM: null,
    intensityClass: 'hard',
    idealPerWeek: { min: 0, max: 2 },
    phaseHint: 'Maks 1–2×/minggu; hati-hati jika ACWR waspada.',
  },
  {
    id: 'sprint_speed',
    group: 'Speed',
    label: 'Sprint / acceleration',
    summary: 'Sprint pendek, akselerasi, atau speed development dengan recovery penuh.',
    purpose: 'Kecepatan maksimal & power.',
    intensityNote: 'RPE 8–10 · volume rendah',
    defaultTargetRPE: 9,
    defaultDurationMin: 45,
    defaultVolumeM: null,
    intensityClass: 'hard',
    idealPerWeek: { min: 0, max: 2 },
    phaseHint: 'Utama sprint/lompat; jarang di volume-endurance murni.',
  },
  {
    id: 'technique',
    group: 'Teknik',
    label: 'Teknik / drill',
    summary: 'Drill teknik nomor (sprint mechanics, approach, landing, dll.).',
    purpose: 'Kualitas gerak sebelum menambah beban intensitas.',
    intensityNote: 'RPE 5–6 · kualitas > kuantitas',
    defaultTargetRPE: 5,
    defaultDurationMin: 40,
    defaultVolumeM: null,
    intensityClass: 'easy',
    idealPerWeek: { min: 1, max: 3 },
    phaseHint: 'Aman hampir semua fase.',
  },
  {
    id: 'strength_plyo',
    group: 'Kekuatan',
    label: 'Kekuatan / pliometrik',
    summary: 'Gym atau lapangan: strength, power, plyometric sesuai nomor.',
    purpose: 'Kekuatan & power penunjang performa.',
    intensityNote: 'RPE 6–8',
    defaultTargetRPE: 7,
    defaultDurationMin: 45,
    defaultVolumeM: null,
    intensityClass: 'moderate',
    idealPerWeek: { min: 1, max: 3 },
    phaseHint: 'Turunkan volume mendekati kompetisi.',
  },
  {
    id: 'long_run',
    group: 'Aerobik',
    label: 'Long run / volume jauh',
    summary: 'Sesi volume lebih panjang untuk daya tahan (menengah/jauh).',
    purpose: 'Kapasitas aerobik & ketahanan mental.',
    intensityNote: 'RPE 5–6 · durasi panjang',
    defaultTargetRPE: 5,
    defaultDurationMin: 70,
    defaultVolumeM: null,
    intensityClass: 'moderate',
    idealPerWeek: { min: 0, max: 1 },
    phaseHint: 'Lebih relevan menengah/jauh; hati-hati lonjakan durasi.',
  },
  {
    id: 'custom',
    group: 'Lainnya',
    label: 'Custom (isi manual)',
    summary: 'Sesi bebas ditentukan pelatih. Tetap isi RPE & durasi agar ACWR akurat.',
    purpose: 'Fleksibilitas konteks lapangan.',
    intensityNote: 'Tentukan sendiri',
    defaultTargetRPE: 6,
    defaultDurationMin: 45,
    defaultVolumeM: null,
    intensityClass: 'moderate',
    idealPerWeek: { min: 0, max: 7 },
    phaseHint: 'Jika tidak ada item katalog yang cocok.',
  },
];

function getLibraryItem(id) {
  return SESSION_LIBRARY.find((x) => x.id === id) || null;
}

function listLibraryGrouped() {
  const groups = [];
  const map = new Map();
  SESSION_LIBRARY.forEach((item) => {
    if (!map.has(item.group)) {
      map.set(item.group, []);
      groups.push({ group: item.group, items: map.get(item.group) });
    }
    map.get(item.group).push({
      id: item.id,
      label: item.label,
      summary: item.summary,
      intensityNote: item.intensityNote,
    });
  });
  return groups;
}

module.exports = { SESSION_LIBRARY, getLibraryItem, listLibraryGrouped };
