// Validasi profil & periodisasi atlet — dipakai bersama oleh pelatih
// (routes/athletes.js) dan atlet mandiri (routes/athleteSelf.js), supaya
// aturan field (kategori/nomor, alergi wajib, dst.) cuma ada di satu tempat.
const { CATEGORIES } = require('./categories');

const NAME_MAX_LENGTH = 100;
const FOOD_NOTE_MAX_LENGTH = 200;

function validateProfile(body) {
  const errors = [];
  const kategori = CATEGORIES[body.kategori] ? body.kategori : null;
  const catDef = kategori ? CATEGORIES[kategori] : null;

  const profile = {
    nama: String(body.nama || '').trim(),
    kategori,
    event: String(body.event || '').trim(),
    usia: Number(body.usia),
    jenisKelamin: body.jenisKelamin === 'P' ? 'P' : body.jenisKelamin === 'L' ? 'L' : null,
    tinggi: body.tinggi === '' || body.tinggi == null ? null : Number(body.tinggi),
    berat: body.berat === '' || body.berat == null ? null : Number(body.berat),
    pengalaman: body.pengalaman === '' || body.pengalaman == null ? null : Number(body.pengalaman),
    best100m: body.best100m === '' || body.best100m == null ? null : Number(body.best100m),
    alergiMakanan: body.alergiMakanan != null ? String(body.alergiMakanan).trim().slice(0, FOOD_NOTE_MAX_LENGTH) : '',
    pantanganMakanan: body.pantanganMakanan != null ? String(body.pantanganMakanan).trim().slice(0, FOOD_NOTE_MAX_LENGTH) : '',
  };

  if (!profile.nama || profile.nama.length < 2 || profile.nama.length > NAME_MAX_LENGTH) {
    errors.push(`Nama atlet wajib diisi (2-${NAME_MAX_LENGTH} karakter)`);
  }
  if (!catDef) {
    errors.push('Kategori wajib salah satu dari: ' + Object.keys(CATEGORIES).join(', '));
  } else if (!catDef.events.includes(profile.event)) {
    errors.push(`Nomor wajib salah satu dari: ${catDef.events.join(', ')}`);
  }
  if (!Number.isFinite(profile.usia) || profile.usia < 5 || profile.usia > 100) errors.push('Usia tidak valid');
  if (!profile.jenisKelamin) errors.push('Jenis kelamin wajib diisi (L/P)');
  if (profile.tinggi != null && (!Number.isFinite(profile.tinggi) || profile.tinggi < 50 || profile.tinggi > 250)) {
    errors.push('Tinggi badan tidak valid');
  }
  if (profile.berat != null && (!Number.isFinite(profile.berat) || profile.berat < 20 || profile.berat > 200)) {
    errors.push('Berat badan tidak valid');
  }
  if (profile.pengalaman != null && (!Number.isFinite(profile.pengalaman) || profile.pengalaman < 0 || profile.pengalaman > 80)) {
    errors.push('Lama pengalaman tidak valid');
  }
  if (catDef && catDef.needsBest100m && profile.best100m == null) {
    errors.push('Catatan waktu 100m wajib diisi untuk kategori ini');
  }
  if (profile.best100m != null && (!Number.isFinite(profile.best100m) || profile.best100m <= 0 || profile.best100m > 60)) {
    errors.push('Catatan waktu 100m tidak valid');
  }
  // Wajib diisi eksplisit (boleh isi "Tidak ada") — supaya mesin nutrisi
  // tidak pernah menyarankan sesuatu tanpa pelatih memeriksa dulu. Field
  // kosong ≠ "sudah dicek, memang tidak ada", jadi tetap ditolak di sini.
  if (!profile.alergiMakanan) {
    errors.push('Alergi makanan wajib diisi (isi "Tidak ada" jika memang tidak ada)');
  }
  if (!profile.pantanganMakanan) {
    errors.push('Pantangan makanan wajib diisi (isi "Tidak ada" jika memang tidak ada)');
  }

  return { profile, errors };
}

function validatePeriodization(body) {
  const errors = [];
  const startDate = String(body.startDate || '').trim();
  const compDate = String(body.compDate || '').trim();
  const manualPhase = ['umum', 'khusus', 'puncak', 'transisi', ''].includes(body.manualPhase)
    ? body.manualPhase || null
    : null;

  const startD = new Date(startDate + 'T00:00:00');
  const compD = new Date(compDate + 'T00:00:00');
  if (!startDate || isNaN(startD.getTime())) errors.push('Tanggal mulai program tidak valid');
  if (!compDate || isNaN(compD.getTime())) errors.push('Tanggal kompetisi target tidak valid');
  if (!errors.length && compD <= startD) errors.push('Tanggal kompetisi harus setelah tanggal mulai');

  return { periodization: { startDate, compDate, manualPhase }, errors };
}

module.exports = { validateProfile, validatePeriodization, NAME_MAX_LENGTH, FOOD_NOTE_MAX_LENGTH };
