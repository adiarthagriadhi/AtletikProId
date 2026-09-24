/**
 * Generator data simulasi (demo) untuk Atletik Pro Id.
 *
 * Membuat set data SINTETIS (bukan salinan data produksi) yang mencakup
 * keempat kategori atlet (Sprint/Menengah/Jauh/Lompat), riwayat tes sesuai
 * protokol masing-masing kategori, log monitoring cukup panjang untuk
 * ACWR (butuh >=14 hari riwayat), akun Portal Atlet yang sudah ter-link,
 * wellness log, laporan cedera, override sesi, dan riwayat pembayaran —
 * supaya SEMUA fitur bisa langsung dicoba tanpa perlu input manual dulu.
 *
 * Pakai lib/sprintEngine & lib/jumpEngine langsung untuk skor checklist
 * teknik, supaya teks butir checklist selalu sinkron dengan kode saat ini
 * (bukan disalin manual, yang gampang basi kalau checklist berubah).
 *
 * Usage: node scripts/generate-demo-db.js [path-output]
 *        (default: data/db.json di root proyek)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const sprintEngine = require('../lib/sprintEngine');
const jumpEngine = require('../lib/jumpEngine');

const OUT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'data', 'db.json');

const DEMO_PASSWORD = 'Demo1234!';
const PASSWORD_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);
const NOW = new Date();

const seq = {};
function nextId(name) {
  seq[name] = (seq[name] || 0) + 1;
  return seq[name];
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}
function daysFromNow(offsetDays) {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}
function isoAt(offsetDays, hour = 8) {
  const d = daysFromNow(offsetDays);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

const users = [];
const athletes = [];
const tests = [];
const monitoringLogs = [];
const payments = [];
const athleteUsers = [];
const athleteLinks = [];
const wellnessLogs = [];
const injuryReports = [];
const sessionOverrides = [];

// ---------- Pengguna: admin + 2 pelatih ----------

const admin = {
  id: nextId('users'),
  name: 'Admin Demo',
  email: 'admin@demo.local',
  passwordHash: PASSWORD_HASH,
  role: 'admin',
  createdAt: isoAt(-120),
  trialStartedAt: null,
  hasLifetimeAccess: true,
  subscriptionEndsAt: null,
};
users.push(admin);

// Pelatih utama — akses lifetime, pemilik sebagian besar data demo.
const coachDewi = {
  id: nextId('users'),
  name: 'Pelatih Dewi',
  email: 'pelatih.dewi@demo.local',
  passwordHash: PASSWORD_HASH,
  role: 'coach',
  createdAt: isoAt(-100),
  trialStartedAt: isoAt(-100),
  hasLifetimeAccess: true,
  subscriptionEndsAt: null,
};
users.push(coachDewi);

// Pelatih kedua — masih trial, supaya banner/limit masa trial di UI juga
// bisa dicoba (bukan cuma akun lifetime).
const coachRian = {
  id: nextId('users'),
  name: 'Pelatih Rian',
  email: 'pelatih.rian@demo.local',
  passwordHash: PASSWORD_HASH,
  role: 'coach',
  createdAt: isoAt(-12),
  trialStartedAt: isoAt(-12),
  hasLifetimeAccess: false,
  subscriptionEndsAt: null,
};
users.push(coachRian);

payments.push({
  id: nextId('payments'),
  orderId: 'DEMO-ORDER-0001',
  userId: coachDewi.id,
  planId: 'lifetime',
  amount: 299000,
  status: 'settlement',
  transactionStatus: 'settlement',
  paymentType: 'qris',
  createdAt: isoAt(-99),
  updatedAt: isoAt(-99),
  paidAt: isoAt(-99),
});

// ---------- Definisi atlet ----------
// compInDays = jarak ke tanggal kompetisi target (bisa dipakai memicu
// badge "kompetisi <=14 hari lagi" untuk salah satu atlet).

const ATHLETE_DEFS = [
  { key: 'a1', coach: coachDewi, kategori: 'sprint', event: '100m', nama: 'Fajar Ramadhan', jk: 'L', usia: 17, tinggi: 172, berat: 64, pengalaman: 3, best100m: 11.4, compInDays: 45, alergi: 'Tidak ada', pantangan: 'Tidak ada' },
  { key: 'a2', coach: coachDewi, kategori: 'sprint', event: '200m', nama: 'Sari Kusuma', jk: 'P', usia: 19, tinggi: 165, berat: 56, pengalaman: 5, best100m: 12.6, compInDays: 60, alergi: 'Tidak ada', pantangan: 'Tidak ada' },
  { key: 'a3', coach: coachDewi, kategori: 'sprint', event: '400m', nama: 'Bimo Prasetyo', jk: 'L', usia: 21, tinggi: 178, berat: 70, pengalaman: 6, best100m: 11.9, compInDays: 30, alergi: 'Tidak ada', pantangan: 'Tidak ada', manualPhase: 'khusus', loadProfile: 'spike' },
  { key: 'a4', coach: coachDewi, kategori: 'menengah', event: '800m', nama: 'Eka Wulandari', jk: 'P', usia: 18, tinggi: 160, berat: 50, pengalaman: 4, best100m: null, compInDays: 20, alergi: 'Kacang tanah', pantangan: 'Tidak ada', portal: { access: 'full' } },
  { key: 'a5', coach: coachDewi, kategori: 'menengah', event: '1500m', nama: 'Galih Nugroho', jk: 'L', usia: 22, tinggi: 174, berat: 60, pengalaman: 7, best100m: null, compInDays: 50, alergi: 'Tidak ada', pantangan: 'Tidak ada', loadProfile: 'deload' },
  { key: 'a6', coach: coachDewi, kategori: 'jauh', event: '5000m', nama: 'Hendra Saputra', jk: 'L', usia: 24, tinggi: 170, berat: 58, pengalaman: 8, best100m: null, compInDays: 70, alergi: 'Tidak ada', pantangan: 'Tidak ada' },
  { key: 'a7', coach: coachDewi, kategori: 'jauh', event: '10000m', nama: 'Nadia Permatasari', jk: 'P', usia: 23, tinggi: 162, berat: 52, pengalaman: 6, best100m: null, compInDays: 8, alergi: 'Tidak ada', pantangan: 'Tidak ada', portal: { access: 'full' }, loadProfile: 'spike', injury: { location: 'Betis kanan', side: 'kanan', score: 6, status: 'active', onsetDaysAgo: 5, note: 'Nyeri muncul setelah interval tempo, masih bisa lari ringan.' } },
  { key: 'a8', coach: coachDewi, kategori: 'jauh', event: 'marathon', nama: 'Yusuf Alamsyah', jk: 'L', usia: 29, tinggi: 175, berat: 63, pengalaman: 10, best100m: null, compInDays: 90, alergi: 'Tidak ada', pantangan: 'Tidak ada' },
  { key: 'a9', coach: coachDewi, kategori: 'lompat', event: 'lompat_jauh', nama: 'Putri Anggraini', jk: 'P', usia: 20, tinggi: 168, berat: 55, pengalaman: 5, best100m: 13.1, compInDays: 40, alergi: 'Tidak ada', pantangan: 'Daging merah (vegetarian)', injury: { location: 'Lutut kiri', side: 'kiri', score: 3, status: 'improving', onsetDaysAgo: 20, note: 'Membaik, sudah lompat penuh tanpa rasa sakit.' } },
  { key: 'a10', coach: coachDewi, kategori: 'lompat', event: 'lompat_tinggi', nama: 'Rizky Firmansyah', jk: 'L', usia: 18, tinggi: 183, berat: 68, pengalaman: 4, best100m: 12.8, compInDays: 55, alergi: 'Tidak ada', pantangan: 'Tidak ada' },
  { key: 'a11', coach: coachRian, kategori: 'sprint', event: '100m', nama: 'Salsabila Putri', jk: 'P', usia: 16, tinggi: 158, berat: 48, pengalaman: 2, best100m: 13.4, compInDays: 35, alergi: 'Tidak ada', pantangan: 'Tidak ada', portal: { access: 'reminding' } },
  { key: 'a12', coach: coachRian, kategori: 'menengah', event: '800m', nama: 'Teguh Wibowo', jk: 'L', usia: 17, tinggi: 169, berat: 57, pengalaman: 2, best100m: null, compInDays: 25, alergi: 'Tidak ada', pantangan: 'Tidak ada' },
];

const TT_DISTANCE = { '800m': 800, '1500m': 1500, '5000m': 5000, '10000m': 10000, marathon: 42195 };
// Waktu awal (detik) & perbaikan per tes (detik) — kira-kira level "terlatih daerah".
const TT_BASE_SEC = { '800m': 138, '1500m': 288, '5000m': 1085, '10000m': 2290, marathon: 13600 };
const TT_IMPROVE_SEC = { '800m': 4, '1500m': 8, '5000m': 22, '10000m': 45, marathon: 180 };

const byKey = {};

for (const def of ATHLETE_DEFS) {
  const athlete = {
    id: nextId('athletes'),
    coachId: def.coach.id,
    profile: {
      nama: def.nama,
      kategori: def.kategori,
      event: def.event,
      usia: def.usia,
      jenisKelamin: def.jk,
      tinggi: def.tinggi,
      berat: def.berat,
      pengalaman: def.pengalaman,
      best100m: def.best100m,
      alergiMakanan: def.alergi,
      pantanganMakanan: def.pantangan,
    },
    periodization: {
      startDate: dateKey(daysFromNow(-70)),
      compDate: dateKey(daysFromNow(def.compInDays)),
      manualPhase: def.manualPhase || null,
    },
    createdAt: isoAt(-70),
    updatedAt: isoAt(-1),
  };
  athletes.push(athlete);
  byKey[def.key] = athlete;

  // ---------- Tes sesuai protokol kategori ----------
  const testDates = [-49, -28, -7]; // ~3 minggu antar-tes, tes terakhir seminggu lalu
  if (def.kategori === 'sprint') {
    const checklist = sprintEngine.buildTechniqueScores || null;
    testDates.forEach((offset, i) => {
      const label = i === 0 ? 'Baseline RAST' : `Evaluasi ${i}`;
      const vo2max = round1(44 + i * 1.6);
      const rastBase = [4.95, 5.12, 5.3, 5.48, 5.66, 5.84].map((t) => round1(t - i * 0.06));
      const { techniqueScores } = sprintEngine.buildTechniqueScores(
        def.event,
        Array(4).fill(0).map((_, idx) => Math.min(5, 3 + i + (idx % 2)))
      );
      tests.push({
        id: nextId('tests'),
        athleteId: athlete.id,
        date: dateKey(daysFromNow(offset)),
        label,
        vo2max,
        rastTimes: rastBase,
        hrPeak: 188 - i,
        hr5: 144 - i * 2,
        techniqueScores,
        createdAt: isoAt(offset),
      });
    });
  } else if (def.kategori === 'menengah' || def.kategori === 'jauh') {
    const dist = TT_DISTANCE[def.event];
    const base = TT_BASE_SEC[def.event];
    const improve = TT_IMPROVE_SEC[def.event];
    testDates.forEach((offset, i) => {
      tests.push({
        id: nextId('tests'),
        athleteId: athlete.id,
        date: dateKey(daysFromNow(offset)),
        label: `TT ${def.event} #${i + 1}`,
        ttDistance: dist,
        ttTimeSec: Math.round(base - i * improve),
        createdAt: isoAt(offset),
      });
    });
  } else if (def.kategori === 'lompat') {
    testDates.forEach((offset, i) => {
      const { techniqueScores } = jumpEngine.buildTechniqueScores(
        def.event,
        Array(4).fill(0).map((_, idx) => Math.min(5, 3 + i + (idx % 2)))
      );
      const isHighJump = def.event === 'lompat_tinggi';
      tests.push({
        id: nextId('tests'),
        athleteId: athlete.id,
        date: dateKey(daysFromNow(offset)),
        label: `Tes lompat #${i + 1}`,
        sljDistance: Math.round(215 + i * 7 + (isHighJump ? -10 : 0)),
        vjHeight: Math.round(42 + i * 3 + (isHighJump ? 6 : 0)),
        compMark: isHighJump ? round1(1.62 + i * 0.05) : round1(5.15 + i * 0.14),
        techniqueScores,
        createdAt: isoAt(offset),
      });
    });
  }

  // ---------- Log monitoring: 6 minggu terakhir, ~4x/minggu ----------
  // Cukup >=14 hari riwayat supaya ACWR "eligible" dan trennya terlihat
  // di grafik (lib/acwr.js pakai window 42 hari). loadProfile dibedakan per
  // atlet supaya badge ACWR di UI (Aman/Waspada/Risiko tinggi/Undertraining)
  // punya contoh nyata masing-masing, bukan seragam satu keadaan saja.
  const profile = def.loadProfile || 'steady';
  for (let d = -41; d <= 0; d++) {
    const dow = daysFromNow(d).getUTCDay();
    const isTrainingDay = [1, 3, 5, 6].includes(dow); // Senin/Rabu/Jumat/Sabtu
    if (!isTrainingDay) continue;
    const jitter = (d * 3 + athlete.id) % 3; // 0-2, variasi kecil tanpa RNG eksternal
    let rpe;
    let durationMin;
    if (profile === 'spike' && d >= -10) {
      // 10 hari terakhir dibebani berat -> acute >> chronic (ACWR tinggi).
      rpe = 8 + (jitter % 2);
      durationMin = 75 + jitter * 6;
    } else if (profile === 'deload' && d >= -9) {
      // Minggu terakhir sengaja dikurangi drastis -> acute << chronic
      // (ACWR rendah, badge "Undertraining").
      rpe = 3 + (jitter % 2);
      durationMin = 25 + jitter * 4;
    } else {
      rpe = 6 + jitter;
      durationMin = 55 + jitter * 8;
    }
    monitoringLogs.push({
      id: nextId('monitoringLogs'),
      athleteId: athlete.id,
      date: dateKey(daysFromNow(d)),
      rpe,
      durationMin,
      note: '',
      source: 'coach',
      sessionKey: null,
      programMatch: null,
      painScore: null,
      painLocation: null,
      createdAt: isoAt(d),
    });
  }
}

// Satu log dengan nyeri, dikaitkan dengan cedera aktif Nadia (a7) —
// supaya badge "perlu perhatian" di dashboard pelatih ada contohnya.
monitoringLogs.push({
  id: nextId('monitoringLogs'),
  athleteId: byKey.a7.id,
  date: dateKey(daysFromNow(-2)),
  rpe: 7,
  durationMin: 55,
  note: 'Nyeri betis kanan muncul di akhir sesi tempo.',
  source: 'coach',
  sessionKey: null,
  programMatch: 'partial',
  painScore: 6,
  painLocation: 'Betis kanan',
  createdAt: isoAt(-2),
});

// ---------- Override sesi manual (coach) ----------

sessionOverrides.push({
  id: nextId('sessionOverrides'),
  athleteId: byKey.a1.id,
  date: dateKey(daysFromNow(1)),
  kind: 'replace',
  name: 'Taper ringan (override)',
  goal: 'Penyesuaian manual pelatih',
  targetRPE: 5,
  durationMin: 35,
  volume: null,
  libraryId: null,
  createdAt: isoAt(0),
  active: true,
});
sessionOverrides.push({
  id: nextId('sessionOverrides'),
  athleteId: byKey.a6.id,
  date: dateKey(daysFromNow(2)),
  kind: 'extra',
  name: 'Recovery run 30 menit (override)',
  goal: 'Penyesuaian manual pelatih',
  targetRPE: 3,
  durationMin: 30,
  volume: null,
  libraryId: null,
  createdAt: isoAt(0),
  active: true,
});
sessionOverrides.push({
  id: nextId('sessionOverrides'),
  athleteId: byKey.a9.id,
  date: dateKey(daysFromNow(3)),
  kind: 'replace',
  name: 'Drill teknik approach (override)',
  goal: 'Penyesuaian manual pelatih',
  targetRPE: 6,
  durationMin: 50,
  volume: null,
  libraryId: null,
  createdAt: isoAt(0),
  active: true,
});

// ---------- Laporan cedera (dari definisi atlet) ----------

for (const def of ATHLETE_DEFS) {
  if (!def.injury) continue;
  const athlete = byKey[def.key];
  injuryReports.push({
    id: nextId('injuryReports'),
    athleteId: athlete.id,
    location: def.injury.location,
    side: def.injury.side || null,
    score: def.injury.score,
    status: def.injury.status,
    onsetDate: dateKey(daysFromNow(-def.injury.onsetDaysAgo)),
    note: def.injury.note || null,
    createdAt: isoAt(-def.injury.onsetDaysAgo),
    updatedAt: isoAt(-1),
  });
}

// ---------- Portal Atlet: akun + link aktif + wellness log ----------

const HYDRATION = ['ok', 'good', 'poor'];

for (const def of ATHLETE_DEFS) {
  if (!def.portal) continue;
  const athlete = byKey[def.key];
  const emailLocal = def.nama.toLowerCase().split(' ').slice(0, 2).join('.');

  const athleteUser = {
    id: nextId('athleteUsers'),
    name: def.nama,
    email: `${emailLocal}@demo.local`,
    passwordHash: PASSWORD_HASH,
    createdAt: isoAt(-30),
  };
  athleteUsers.push(athleteUser);

  athleteLinks.push({
    id: nextId('athleteLinks'),
    athleteUserId: athleteUser.id,
    athleteId: athlete.id,
    coachId: athlete.coachId,
    status: 'active',
    inviteCode: null,
    programAccess: def.portal.access,
    createdAt: isoAt(-31),
    acceptedAt: isoAt(-30),
  });

  // 14 hari wellness log terakhir, RPE ekspektasi + kualitas tidur bervariasi.
  for (let d = -13; d <= 0; d++) {
    const isHighPainDay = def.injury && d === -2;
    wellnessLogs.push({
      id: nextId('wellnessLogs'),
      athleteId: athlete.id,
      coachId: athlete.coachId,
      date: dateKey(daysFromNow(d)),
      type: 'pre_session',
      sleepQuality: 3 + ((d + athlete.id) % 3),
      sleepHours: round1(6.5 + ((d + athlete.id) % 3) * 0.5),
      readiness: 6 + ((d + athlete.id) % 4),
      ateBefore: (d + athlete.id) % 2 === 0,
      mealTiming: (d + athlete.id) % 2 === 0 ? '2-3 jam sebelum' : '1 jam sebelum',
      hydration: HYDRATION[(d + athlete.id) % HYDRATION.length],
      painLocation: isHighPainDay ? (def.injury.location) : null,
      painScore: isHighPainDay ? def.injury.score : null,
      note: null,
      sessionKey: null,
      source: 'athlete',
      createdAt: isoAt(d),
    });
  }
}

// ---------- Susun & tulis db.json ----------

const db = {
  users,
  athletes,
  tests,
  monitoringLogs,
  payments,
  athleteUsers,
  athleteLinks,
  wellnessLogs,
  injuryReports,
  sessionOverrides,
  seq,
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(db, null, 2) + '\n', 'utf8');

console.log(`Data simulasi ditulis ke: ${OUT_PATH}`);
console.log(`  users=${users.length} athletes=${athletes.length} tests=${tests.length} monitoringLogs=${monitoringLogs.length}`);
console.log(`  athleteUsers=${athleteUsers.length} athleteLinks=${athleteLinks.length} wellnessLogs=${wellnessLogs.length}`);
console.log(`  injuryReports=${injuryReports.length} sessionOverrides=${sessionOverrides.length} payments=${payments.length}`);
console.log('');
console.log('Login demo (password sama untuk semua akun di bawah):', DEMO_PASSWORD);
console.log('  Admin        :', admin.email);
console.log('  Pelatih (lifetime):', coachDewi.email);
console.log('  Pelatih (trial)   :', coachRian.email);
for (const au of athleteUsers) console.log('  Portal Atlet :', au.email);
