// Konten latihan generik yang tidak spesifik per kategori nomor — dipakai
// bersama oleh semua mesin kategori (Sprint, Menengah/Jauh, dst.) untuk fase
// Persiapan Umum (conditioning, belum spesifik nomor) dan Transisi.

const GPP_SESSIONS = [
  { key: 'g1', label: 'Sesi I', name: 'Tempo Run Aerobik', day: 'Senin', goal: 'Basis aerobik & daya tahan umum', durationMin: 30, targetRPE: 5 },
  { key: 'g2', label: 'Sesi II', name: 'Sirkuit Kekuatan Umum', day: 'Rabu', goal: 'Kekuatan umum & stabilitas core', durationMin: 40, targetRPE: 6 },
  { key: 'g3', label: 'Sesi III', name: 'Mobilitas & Pengenalan Pliometrik', day: 'Jumat', goal: 'Mobilitas sendi & pengenalan power', durationMin: 30, targetRPE: 5 },
];

const TRANSITION_SESSION = {
  key: 't1',
  label: 'Aktivitas Bebas',
  name: 'Cross-training / Aktivitas Non-spesifik',
  goal: 'Pemulihan aktif, jaga kebugaran umum tanpa beban latihan spesifik',
  durationMin: 20,
  targetRPE: 3,
};

const GENERIC_STRENGTH_BANK = {
  umum: ['Squat/goblet squat', 'Lunges', 'Core stability (plank, dead bug)', 'Pengenalan pliometrik ringan (pogo jump)'],
  transisi: ['Cross-training umum', 'Mobilitas & pencegahan cedera'],
};

module.exports = { GPP_SESSIONS, TRANSITION_SESSION, GENERIC_STRENGTH_BANK };
