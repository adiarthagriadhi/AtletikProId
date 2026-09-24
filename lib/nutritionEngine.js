// Mesin nutrisi deterministik — fungsi murni, pola sama seperti
// lib/periodization.js / lib/curves.js: dihitung dari data yang sudah ada
// di sistem, dihitung ULANG setiap dibuka (tidak disimpan permanen), tanpa
// panggilan AI generatif. Lihat NUTRITION-MODULE-DESIGN.md v2 untuk rancangan.
const { computePhase } = require('./periodization');
const { CATEGORIES } = require('./categories');
const { computeACWR } = require('./acwr');
const { localDateKey } = require('./dateUtil');
const {
  KARBO_G_PER_KG_PER_HARI,
  PROTEIN_G_PER_KG_PER_HARI,
  LEMAK_PERSEN_KALORI,
  AIR_ML_PER_KG_BASE,
  AIR_TAMBAHAN_ML_LATIHAN,
  ACWR_TINGGI_THRESHOLD,
  KARBO_BOOST_GRAM_ACWR_TINGGI,
  AIR_BOOST_ML_ACWR_TINGGI,
  SUMBER_PEDOMAN,
  KARBO_LOADING_QUALIFYING_EVENTS,
  KARBO_LOADING_WINDOW_DAYS_MIN,
  KARBO_LOADING_WINDOW_DAYS_MAX,
  KARBO_LOADING_TARGET_G_PER_KG_MIN,
  KARBO_LOADING_TARGET_G_PER_KG_MAX,
} = require('./nutritionGuidelines');
const { MENU_HARIAN_DEFAULT } = require('./nutritionMenuExamples');
const { computePresisiCairan } = require('./hydrationCalc');
const { buildCitation } = require('./nutritionCitations');

const KARBO_KCAL_PER_GRAM = 4;
const PROTEIN_KCAL_PER_GRAM = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

// 'sprint_power' = sprint & lompat (ledakan/power), 'endurance' = menengah
// & jauh — mengikuti pembagian testProtocol yang sudah ada di categories.js.
function typeFor(kategori) {
  const catDef = CATEGORIES[kategori];
  const protocol = catDef ? catDef.testProtocol : 'sprint';
  return protocol === 'time_trial' ? 'endurance' : 'sprint_power';
}

function isFilled(text) {
  return typeof text === 'string' && text.trim().length > 0;
}

function isTidakAda(text) {
  return isFilled(text) && text.trim().toLowerCase() === 'tidak ada';
}

function buildRingkasan(targets, type, acwrTinggi, karboLoading) {
  // Sensitif waktu — kalau karbo-loading aktif, ini menggantikan ringkasan
  // biasa sepenuhnya (bukan ditambahkan) supaya jadi hal PERTAMA yang
  // terbaca di nutritionToday (Mode Lapangan/Portal Atlet), sesuai §9a.
  if (karboLoading) {
    return `KARBO-LOADING H-${karboLoading.hariMenujuKompetisi}: target ${karboLoading.targetGramPerKgHariIni}g/kg (${targets.karbohidratGramPerHari}g) — perbanyak nasi/roti/kentang`;
  }
  const karboWord = type === 'endurance' ? 'karbo cukup' : 'karbo tinggi';
  let s = `Fokus ${karboWord} (${targets.karbohidratGramPerHari}g), air ${targets.airLiterPerHari}L/hari`;
  if (acwrTinggi) s += ' — porsi ditambah, beban latihan tinggi';
  return s;
}

// Hari menuju kompetisi (bulat, anchor tengah hari) — "hari ini" WAJIB
// lewat localDateKey() (lib/dateUtil.js), bukan toISOString() mentah:
// toISOString() mengonversi ke UTC dan menggeser tanggal mundur satu hari
// di timezone UTC+X (WIB/WITA/WIT) setiap kali jam lokal lebih pagi dari
// offset-nya — persis bug class yang sudah pernah terjadi di lib/acwr.js &
// lib/calendarBuilder.js (lihat komentar di lib/dateUtil.js). Pola sama
// seperti daysToComp di athleteSummary() (routes/athletes.js).
function daysUntilCompetition(periodization) {
  if (!periodization || !periodization.compDate) return null;
  const today = new Date(localDateKey(new Date()) + 'T12:00:00');
  const comp = new Date(periodization.compDate + 'T12:00:00');
  if (isNaN(comp.getTime())) return null;
  return Math.round((comp - today) / DAY_MS);
}

// Protokol karbo-loading pra-kompetisi (§9a) — HANYA nomor endurance yang
// durasi lombanya cukup panjang (10000m/half_marathon/marathon), BUKAN
// semua nomor grup 'endurance' (800m/1500m sengaja dikecualikan). Aktif
// H-1/H-2 sebelum compDate. "24-48 jam" didekati dalam granularitas hari
// karena compDate tidak menyimpan jam start lomba — lihat komentar di
// lib/nutritionGuidelines.js.
function computeKarboLoading(athlete) {
  if (!KARBO_LOADING_QUALIFYING_EVENTS.includes(athlete.profile.event)) return null;
  const hariMenujuKompetisi = daysUntilCompetition(athlete.periodization);
  if (hariMenujuKompetisi == null) return null;
  if (hariMenujuKompetisi < KARBO_LOADING_WINDOW_DAYS_MIN || hariMenujuKompetisi > KARBO_LOADING_WINDOW_DAYS_MAX) return null;

  const targetGramPerKgHariIni = (KARBO_LOADING_TARGET_G_PER_KG_MIN + KARBO_LOADING_TARGET_G_PER_KG_MAX) / 2;
  return {
    aktif: true,
    hariMenujuKompetisi,
    targetGramPerKgHariIni,
    catatan: `H-${hariMenujuKompetisi} menuju kompetisi: perbanyak nasi/roti/kentang, kurangi dulu sayur berserat tinggi & gorengan.`,
  };
}

/**
 * @param {object} athlete - record atlet (profile, periodization)
 * @param {object} data - hasil db.load() (dipakai untuk monitoringLogs → ACWR)
 * @returns {object} { available: true, ...rencana } atau { available: false, reason }
 */
function computeNutritionPlan(athlete, data) {
  const berat = athlete.profile.berat;
  if (berat == null) {
    return { available: false, reason: 'Berat badan atlet belum diisi — lengkapi dulu di profil atlet.' };
  }

  const type = typeFor(athlete.profile.kategori);
  const phaseInfo = computePhase(athlete.periodization);
  const phaseKey = (phaseInfo.phase && KARBO_G_PER_KG_PER_HARI[phaseInfo.phase]) ? phaseInfo.phase : 'umum';

  const logs = ((data && data.monitoringLogs) || []).filter((m) => m.athleteId === athlete.id);
  const acwrResult = computeACWR(logs);
  const acwrTinggi = !!(acwrResult.eligible && acwrResult.acwr != null && acwrResult.acwr > ACWR_TINGGI_THRESHOLD);

  const karboLoading = computeKarboLoading(athlete);

  // Karbo-loading MENGGANTIKAN target karbo harian biasa (termasuk boost
  // ACWR-nya) untuk window H-1/H-2 — bukan ditambahkan di atas angka biasa
  // (lihat §9a). Target air TIDAK terpengaruh karbo-loading, tetap dihitung
  // & di-boost ACWR seperti biasa.
  let karbohidratGramPerHari;
  let karboBoostedByAcwr = false;
  if (karboLoading) {
    karbohidratGramPerHari = Math.round(karboLoading.targetGramPerKgHariIni * berat);
  } else {
    karbohidratGramPerHari = Math.round(KARBO_G_PER_KG_PER_HARI[phaseKey][type] * berat);
    if (acwrTinggi) {
      karbohidratGramPerHari += KARBO_BOOST_GRAM_ACWR_TINGGI;
      karboBoostedByAcwr = true;
    }
  }

  let airLiterPerHari = (AIR_ML_PER_KG_BASE * berat + AIR_TAMBAHAN_ML_LATIHAN) / 1000;

  const peringatanKhusus = [];
  if (acwrTinggi) {
    airLiterPerHari += AIR_BOOST_ML_ACWR_TINGGI / 1000;
    const apaYangDitambah = karboBoostedByAcwr ? 'karbo & air' : 'air';
    peringatanKhusus.push(
      `Beban latihan minggu ini tinggi (ACWR ${acwrResult.acwr.toFixed(2)}) — porsi ${apaYangDitambah} hari ini sedikit ditambah untuk bantu pemulihan.`
    );
  }
  airLiterPerHari = Math.round(airLiterPerHari * 10) / 10;

  const proteinGramPerHari = Math.round(PROTEIN_G_PER_KG_PER_HARI[type] * berat);
  const lemakPersenKalori = LEMAK_PERSEN_KALORI;

  // lemakPersenKalori adalah persen dari TOTAL kalori (bukan gram lepas),
  // jadi total diturunkan dari karbo+protein supaya ketiga makro & total
  // kalori tetap konsisten satu sama lain (bukan 4 angka lepas yang tidak
  // nyambung kalau coach menjumlahkannya sendiri):
  //   total = totalLemakKcal + karboKcal + proteinKcal
  //   totalLemakKcal = lemakPersenKalori% × total
  //   => total × (1 - lemakPersenKalori/100) = karboKcal + proteinKcal
  const karboKcal = karbohidratGramPerHari * KARBO_KCAL_PER_GRAM;
  const proteinKcal = proteinGramPerHari * PROTEIN_KCAL_PER_GRAM;
  const kaloriKcalPerHari = Math.round((karboKcal + proteinKcal) / (1 - lemakPersenKalori / 100));

  const alergi = athlete.profile.alergiMakanan;
  const pantangan = athlete.profile.pantanganMakanan;
  if (!isFilled(alergi) || !isFilled(pantangan)) {
    peringatanKhusus.push('Profil alergi/pantangan makanan atlet belum lengkap — lengkapi di halaman profil atlet untuk rekomendasi yang lebih aman.');
  } else {
    if (!isTidakAda(alergi)) peringatanKhusus.push(`Perhatikan alergi: ${alergi.trim()}`);
    if (!isTidakAda(pantangan)) peringatanKhusus.push(`Perhatikan pantangan: ${pantangan.trim()}`);
  }

  // Karbo-loading TIDAK digabung ke peringatanKhusus generik — field
  // `karboLoading` di bawah dipakai UI untuk callout terpisah & menonjol
  // sendiri (lihat renderNutritionTab di public/app.js), supaya tidak
  // tenggelam di antara peringatan lain (alergi/ACWR). ringkasanSingkat
  // juga sudah menggantikan info harian biasa saat aktif, yang dipakai
  // nutritionToday di Mode Lapangan/Portal Atlet — lihat §9a.

  const targets = { kaloriKcalPerHari, karbohidratGramPerHari, proteinGramPerHari, lemakPersenKalori, airLiterPerHari };

  // "Tanpa timbangan" = airLiterPerHari (angka yang sama dipakai di targets,
  // supaya tidak ada dua angka "minimum" yang berbeda beredar di UI) —
  // WAJIB dilabeli "estimasi minimum" di UI, bukan angka final (§9b).
  // "Dengan timbangan" opsional, dari log monitoring terakhir yang punya
  // data timbangan sesi; null kalau belum pernah dicatat.
  const { presisiLiter, presisiDariSesiTanggal } = computePresisiCairan(athlete, data);
  const cairan = { minimumLiter: airLiterPerHari, presisiLiter, presisiDariSesiTanggal };

  return {
    available: true,
    phase: phaseInfo.phase,
    phaseLabel: phaseInfo.label || 'Belum ditentukan',
    targets,
    ringkasanSingkat: buildRingkasan(targets, type, acwrTinggi, karboLoading),
    contohMenuHarian: MENU_HARIAN_DEFAULT,
    peringatanKhusus,
    sumberPedoman: SUMBER_PEDOMAN,
    karboLoading: karboLoading || null,
    cairan,
    citation: buildCitation(type, phaseKey),
  };
}

module.exports = { computeNutritionPlan };
