// Akun atlet mandiri (sport enthusiast tanpa pelatih).
//
// Atlet mandiri memakai struktur data yang SAMA dengan atlet binaan pelatih:
// satu baris `athletes` (coachId: null, ownerAthleteUserId) + satu
// `athleteLinks` aktif (selfCoached: true). Dengan begitu seluruh endpoint
// portal atlet yang sudah ada (/api/athlete/today, /program, /nutrition,
// /monitoring, dst.) langsung jalan tanpa cabang baru — yang berbeda hanya
// aturan akses paket (lib/athleteAccess.js) dan siapa yang boleh mengubah
// profil (atletnya sendiri, lewat endpoint di file ini).
const express = require('express');
const db = require('../db');
const { requireAthlete, getActiveLink } = require('../middleware/athleteAuth');
const { buildSelfDraft, TT_DISTANCES } = require('../lib/selfProfile');
const { parseClockToSec } = require('../lib/endurance');
const { validateProfile, validatePeriodization } = require('../lib/athleteValidation');
const { getAthleteAccess } = require('../lib/athleteAccess');
const { localDateKey } = require('../lib/dateUtil');

const router = express.Router();

function findSelfAthlete(data, athleteUserId) {
  const link = getActiveLink(data, athleteUserId);
  if (!link || !link.selfCoached) return { link, athlete: null };
  const athlete = data.athletes.find((a) => a.id === link.athleteId) || null;
  return { link, athlete };
}

function publicSelfProfile(athlete) {
  return {
    athleteId: athlete.id,
    profile: athlete.profile,
    periodization: athlete.periodization,
  };
}

// POST /api/athlete/self/setup — buat profil atlet mandiri dari jawaban kuesioner
router.post('/setup', requireAthlete, (req, res) => {
  const data = db.load();
  const user = (data.athleteUsers || []).find((u) => u.id === req.athleteUser.id);
  if (!user) return res.status(401).json({ error: 'Akun atlet tidak ditemukan' });

  if (getActiveLink(data, user.id)) {
    return res.status(409).json({ error: 'Akun ini sudah punya profil atlet aktif.' });
  }

  const draft = buildSelfDraft(req.body || {}, { defaultName: user.name });
  if (draft.errors.length) return res.status(400).json({ error: draft.errors.join('; ') });

  const now = new Date().toISOString();
  const athlete = {
    id: db.nextId(data, 'athletes'),
    coachId: null,
    ownerAthleteUserId: user.id,
    selfCoached: true,
    profile: draft.profile,
    periodization: draft.periodization,
    createdAt: now,
  };
  data.athletes.push(athlete);

  data.athleteLinks = data.athleteLinks || [];
  data.athleteLinks.push({
    id: db.nextId(data, 'athleteLinks'),
    athleteId: athlete.id,
    coachId: null,
    athleteUserId: user.id,
    status: 'active',
    programAccess: 'full',
    selfCoached: true,
    inviteCode: null,
    createdAt: now,
    acceptedAt: now,
  });

  if (draft.initialTest) {
    data.tests.push({
      id: db.nextId(data, 'tests'),
      athleteId: athlete.id,
      ...draft.initialTest,
      createdAt: now,
    });
  }

  user.accountType = 'self';
  // Trial Premium dimulai saat profil pertama dibuat (bukan saat daftar),
  // supaya hitungan hari baru jalan ketika program benar-benar bisa dipakai.
  if (!user.trialStartedAt) user.trialStartedAt = now;
  db.save(data);

  res.status(201).json({
    ...publicSelfProfile(athlete),
    access: getAthleteAccess(user),
  });
});

// GET /api/athlete/self/profile
router.get('/profile', requireAthlete, (req, res) => {
  const data = db.load();
  const { athlete } = findSelfAthlete(data, req.athleteUser.id);
  if (!athlete) return res.status(404).json({ error: 'Profil atlet mandiri belum dibuat' });
  const latestTest = (data.tests || [])
    .filter((t) => t.athleteId === athlete.id)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id)[0] || null;
  res.json({
    ...publicSelfProfile(athlete),
    latestTest: latestTest
      ? { date: latestTest.date, label: latestTest.label || null, ttDistance: latestTest.ttDistance || null, ttTimeSec: latestTest.ttTimeSec || null, estimated: !!latestTest.estimated }
      : null,
  });
});

// PUT /api/athlete/self/profile — atlet mandiri memperbarui profilnya sendiri
// (berat badan, tanggal lomba, alergi, dst.). Field yang tidak dikirim tetap.
router.put('/profile', requireAthlete, (req, res) => {
  const data = db.load();
  const { athlete } = findSelfAthlete(data, req.athleteUser.id);
  if (!athlete) return res.status(404).json({ error: 'Profil atlet mandiri belum dibuat' });

  const body = req.body || {};
  const merged = { ...athlete.profile };
  ['nama', 'kategori', 'event', 'usia', 'jenisKelamin', 'tinggi', 'berat', 'best100m', 'alergiMakanan', 'pantanganMakanan']
    .forEach((k) => { if (body[k] !== undefined) merged[k] = body[k]; });
  const { profile, errors: profileErrors } = validateProfile(merged);

  const period = {
    startDate: athlete.periodization.startDate,
    compDate: body.compDate !== undefined ? body.compDate : athlete.periodization.compDate,
  };
  // Tanggal lomba baru di masa lalu siklus lama → mulai siklus baru hari ini.
  if (body.compDate !== undefined && period.compDate <= period.startDate) {
    period.startDate = localDateKey(new Date());
  }
  const { periodization, errors: periodErrors } = validatePeriodization(period);
  const errors = [...profileErrors, ...periodErrors];

  // Catatan waktu baru (lari menengah/jauh) → jadi titik tes baru, bukan
  // menimpa yang lama, supaya riwayat progres tetap ada.
  let newTest = null;
  if (body.ttTime) {
    const ttDistance = Number(body.ttDistance);
    const ttTimeSec = parseClockToSec(body.ttTime);
    if (!TT_DISTANCES.includes(ttDistance)) errors.push('Jarak catatan waktu tidak valid');
    else if (!ttTimeSec || ttTimeSec <= 0 || ttTimeSec > 36000) errors.push('Format catatan waktu tidak valid (mm:ss atau j:mm:ss)');
    else newTest = { date: localDateKey(new Date()), label: 'Catatan waktu mandiri', ttDistance, ttTimeSec, source: 'self-report', estimated: false };
  }
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  if (newTest) {
    data.tests.push({ id: db.nextId(data, 'tests'), athleteId: athlete.id, ...newTest, createdAt: new Date().toISOString() });
  }

  const best100mChanged = body.best100m !== undefined && Number(body.best100m) !== Number(athlete.profile.best100m);
  athlete.profile = {
    ...profile,
    level: athlete.profile.level || null,
    best100mEstimated: best100mChanged ? false : !!athlete.profile.best100mEstimated,
  };
  athlete.periodization = periodization;
  athlete.updatedAt = new Date().toISOString();
  db.save(data);
  res.json(publicSelfProfile(athlete));
});

module.exports = router;
