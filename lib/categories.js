// Registri kategori nomor atletik yang didukung. Menambah kategori baru
// (mis. Lompat) berarti menambah satu entri di sini plus mesin programnya
// (lib/xxxEngine.js) dan cabang validasi/dispatch di routes/tests.js &
// routes/program.js — bukan mengubah struktur route yang sudah ada.
// Event Lompat sengaja diberi awalan "lompat_" (bukan cuma "jauh"/"tinggi")
// supaya tidak ambigu dengan kategori lari Jauh ('jauh') di atas.
const CATEGORIES = {
  sprint: { label: 'Sprint', events: ['100m', '200m', '400m'], needsBest100m: true, testProtocol: 'sprint' },
  menengah: { label: 'Menengah', events: ['800m', '1500m'], needsBest100m: false, testProtocol: 'time_trial' },
  jauh: { label: 'Jauh', events: ['5000m', '10000m', 'half_marathon', 'marathon'], needsBest100m: false, testProtocol: 'time_trial' },
  lompat: { label: 'Lompat', events: ['lompat_jauh', 'lompat_tinggi'], needsBest100m: true, testProtocol: 'jump' },
};

module.exports = { CATEGORIES };
