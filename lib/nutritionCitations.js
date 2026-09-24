// Kutipan/parafrase dari Buku Pintar Gizi Bagi Atlet, Kementerian Kesehatan
// RI (2021) — digabung berdasarkan tipe kategori (sprint_power/endurance)
// DAN fase periodisasi atlet yang sedang dibuka, ditampilkan sebagai
// referensi di bagian bawah tab Nutrisi. Teks di sini murni untuk
// atribusi/konteks (angka yang benar-benar dipakai perhitungan tetap di
// lib/nutritionGuidelines.js — mengubah kutipan di sini TIDAK mengubah
// hasil hitungan apa pun).

const KATEGORI_TEXT = {
  sprint_power: 'Cabang power/anaerobik (sprint, lompat, dan sejenisnya) tergolong sistem metabolisme anaerobik berkategori "sangat berat" meski durasi latihannya singkat (Tabel 1, Buku Pintar Gizi Bagi Atlet).',
  endurance: 'Cabang endurance (lari jarak menengah, jarak jauh, maraton) tergolong sistem metabolisme aerobik berkategori "berat", membutuhkan asupan karbohidrat lebih tinggi untuk mendukung volume latihan berkelanjutan (Tabel 1, Buku Pintar Gizi Bagi Atlet).',
};

// umum & khusus (sama-sama fase persiapan) sengaja memetakan ke teks yang
// sama — buku sumber tidak membedakan anjuran persiapan umum vs khusus.
const FASE_PERSIAPAN_TEXT = 'Pada fase persiapan, buku ini menganjurkan karbohidrat 4-7 g/kg BB, protein 1,2-2,0 g/kg BB, dan lemak 0,9-1,3 g/kg BB per hari, meningkat bertahap mendekati kompetisi.';
const FASE_PUNCAK_TEXT = 'Menjelang dan saat pertandingan, asupan dianjurkan naik ke karbohidrat 5-12 g/kg BB, protein 1,4-2 g/kg BB, dan lemak 1,0-1,5 g/kg BB per hari, disesuaikan intensitas & durasi kompetisi.';
const FASE_TRANSISI_TEXT = 'Setelah pertandingan, kebutuhan menurun mengikuti volume latihan yang berkurang: karbohidrat 3-4 g/kg BB, protein 1,5-2,3 g/kg BB, lemak 1-1,2 g/kg BB per hari.';

const FASE_TEXT = {
  umum: FASE_PERSIAPAN_TEXT,
  khusus: FASE_PERSIAPAN_TEXT,
  puncak: FASE_PUNCAK_TEXT,
  transisi: FASE_TRANSISI_TEXT,
};

const ATRIBUSI = 'Buku Pintar Gizi Bagi Atlet, Kementerian Kesehatan RI (2021)';

/**
 * @param {'sprint_power'|'endurance'} type
 * @param {'umum'|'khusus'|'puncak'|'transisi'} fase
 * @returns {{ text: string, atribusi: string }|null} null kalau type tidak dikenali
 */
function buildCitation(type, fase) {
  const kategoriText = KATEGORI_TEXT[type];
  if (!kategoriText) return null;
  const faseText = FASE_TEXT[fase] || FASE_PERSIAPAN_TEXT;
  return {
    text: `${kategoriText} ${faseText}`,
    atribusi: ATRIBUSI,
  };
}

module.exports = { buildCitation, ATRIBUSI };
