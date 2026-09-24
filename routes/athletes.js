const express = require('express');
const db = require('../db');
const { assembleProgram } = require('../lib/programAssembler');
const { requireAuth } = require('../middleware/auth');
const { CATEGORIES } = require('../lib/categories');
const { computeACWR } = require('../lib/acwr');
const { computeNutritionPlan } = require('../lib/nutritionEngine');
const { hydrateTest } = require('../lib/testValidation');
const { ACWR_RISK_THRESHOLD } = require('../lib/personalization');
const { BENCH_RELPOWER, classifyByMin } = require('../lib/benchmarks');
const endurance = require('../lib/endurance');
const jump = require('../lib/jump');
const { assertCanAddAthlete } = require('../lib/access');

const router = express.Router();

const NAME_MAX_LENGTH = 100;
const FOOD_NOTE_MAX_LENGTH = 200;

function canAccess(user, athlete) {
  return user.role === 'admin' || athlete.coachId === user.id;
}

// Rata-rata metrik utama dari SELURUH riwayat tes atlet — beda kategori,
// beda metrik & satuan (tidak bisa disatukan jadi satu angka universal):
// Sprint -> RAST Power (W/kg), Menengah/Jauh -> VDOT, Lompat -> Prestasi
// Lomba (m). null kalau belum ada tes dengan metrik itu terisi sama sekali.
function avgTestResult(athlete, tests) {
  const catDef = CATEGORIES[athlete.profile.kategori];
  const protocol = catDef ? catDef.testProtocol : 'sprint';
  const athleteTests = tests.filter((t) => t.athleteId === athlete.id);

  let label, unit, values, tier;
  if (protocol === 'time_trial') {
    label = 'VDOT'; unit = '';
    values = athleteTests.map((t) => hydrateTest(t, athlete).vdot).filter((v) => v != null);
  } else if (protocol === 'jump') {
    label = 'Prestasi Lomba'; unit = 'm';
    values = athleteTests.map((t) => t.compMark).filter((v) => v != null);
  } else {
    label = 'RAST Power'; unit = 'W/kg';
    values = athleteTests
      .map((t) => hydrateTest(t, athlete).rast)
      .filter((r) => r != null)
      .map((r) => r.relPower);
  }

  if (!values.length) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  // Klasifikasi rata-rata terhadap benchmark yang sama dipakai di tempat
  // lain (RAST Power di Riwayat Tes, Prestasi Lomba/VDOT di Level Prestasi)
  // — satu sumber tabel, cuma dipakaikan ke angka rata-rata di sini.
  if (protocol === 'time_trial') {
    const eventMeters = endurance.EVENT_METERS[athlete.profile.event];
    const predictedSec = endurance.predictTimeForDistance(avg, eventMeters);
    tier = endurance.classifyEnduranceTier(athlete.profile.event, athlete.profile.jenisKelamin, predictedSec);
  } else if (protocol === 'jump') {
    tier = jump.classifyCompMark(athlete.profile.event, athlete.profile.jenisKelamin, avg);
  } else {
    tier = classifyByMin(avg, BENCH_RELPOWER);
  }

  return {
    label, unit, value: avg, count: values.length,
    tierIndex: tier ? tier.index : null,
    tierLabel: tier ? tier.label : null,
  };
}

// Ringkasan ringan per atlet untuk daftar atlet — status ACWR terkini +
// rata-rata hasil tes utama.
function athleteSummary(athlete, data) {
  const logs = data.monitoringLogs.filter((m) => m.athleteId === athlete.id);
  const acwr = computeACWR(logs);
  const tests = (data.tests || []).filter((t) => t.athleteId === athlete.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  let daysToComp = null;
  if (athlete.periodization && athlete.periodization.compDate) {
    const c = new Date(athlete.periodization.compDate + 'T12:00:00');
    daysToComp = Math.round((c - today) / 86400000);
  }
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  let logsLast7 = 0;
  logs.forEach((m) => {
    const d = new Date(m.date + 'T12:00:00');
    if (d >= weekAgo && d <= today) logsLast7 += 1;
  });
  const highPain = logs.some((m) => {
    const d = new Date(m.date + 'T12:00:00');
    const days = (today - d) / 86400000;
    return days >= 0 && days <= 7 && ((m.shoulderPain != null && m.shoulderPain >= 5) || (m.painScore != null && m.painScore >= 5));
  });

  return {
    acwr: {
      eligible: acwr.eligible,
      value: acwr.acwr,
      atRisk: acwr.eligible && acwr.acwr != null && acwr.acwr > ACWR_RISK_THRESHOLD,
      daysOfHistory: acwr.daysOfHistory != null ? acwr.daysOfHistory : (acwr.days || 0),
    },
    testSummary: avgTestResult(athlete, data.tests),
    lastTestDate: tests[0] ? tests[0].date : null,
    logsLast7,
    highPain,
    daysToComp,
    needsAttention: !!(
      (acwr.eligible && acwr.acwr != null && acwr.acwr > ACWR_RISK_THRESHOLD)
      || highPain
      || !tests.length
      || (daysToComp != null && daysToComp >= 0 && daysToComp <= 14)
    ),
  };
}

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

// GET /api/athletes/categories — daftar kategori & nomor yang didukung,
// dipakai frontend untuk mengisi dropdown kategori/nomor secara dinamis.
// Didaftarkan sebelum "/:id" supaya tidak tertangkap sebagai id atlet.
router.get('/categories', requireAuth, (req, res) => {
  res.json(CATEGORIES);
});

// GET /api/athletes — daftar atlet milik coach (atau semua jika admin, filter ?coachId=)
router.get('/', requireAuth, (req, res) => {
  const data = db.load();
  let list;
  if (req.user.role === 'admin') {
    list = req.query.coachId
      ? data.athletes.filter((a) => a.coachId === Number(req.query.coachId))
      : data.athletes;
  } else {
    list = data.athletes.filter((a) => a.coachId === req.user.id);
  }
  res.json(list.map((a) => ({ ...a, summary: athleteSummary(a, data) })));
});

// POST /api/athletes — buat atlet baru milik coach yang login
router.post('/', requireAuth, (req, res) => {
  const { profile, errors: profileErrors } = validateProfile(req.body || {});
  const { periodization, errors: periodErrors } = validatePeriodization(req.body || {});
  const errors = [...profileErrors, ...periodErrors];
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const data = db.load();
  // Batas trial / expired — admin & lifetime tidak dibatasi
  if (req.user.role !== 'admin') {
    const count = data.athletes.filter((a) => a.coachId === req.user.id).length;
    const check = assertCanAddAthlete(req.user, count);
    if (!check.ok) {
      return res.status(403).json({ error: check.error, access: check.status });
    }
  }

  const athlete = {
    id: db.nextId(data, 'athletes'),
    coachId: req.user.id,
    profile,
    periodization,
    createdAt: new Date().toISOString(),
  };
  data.athletes.push(athlete);
  db.save(data);
  res.status(201).json(athlete);
});

// GET /api/athletes/:id

// GET /api/athletes/portal-day — sesi "hari ini" ringkas untuk meja kerja
router.get('/portal-day', requireAuth, (req, res) => {
  const data = db.load();
  let list;
  if (req.user.role === 'admin') {
    list = req.query.coachId
      ? data.athletes.filter((a) => a.coachId === Number(req.query.coachId))
      : data.athletes;
  } else {
    list = data.athletes.filter((a) => a.coachId === req.user.id);
  }

  const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayKey = `${y}-${m}-${dd}`;

  const items = [];
  for (const athlete of list) {
    let sessions = [];
    try {
      const prog = assembleProgram(athlete, data.tests || [], data.monitoringLogs || [], now);
      sessions = (prog.sessions || []).filter((s) => {
        if (!s.day) return false;
        const d = String(s.day);
        return d === dayName || d.startsWith(dayName) || d.includes(dayName);
      }).map((s) => ({
        label: s.label,
        name: s.name,
        targetRPE: s.targetRPE,
        manual: !!(s.override && s.override.manual),
      }));
    } catch (e) {
      // skip athlete if assemble fails
    }
    const extras = (data.sessionOverrides || []).filter((o) =>
      o.athleteId === athlete.id && o.status === 'active' && o.kind === 'extra' && o.date === todayKey
    ).map((o) => ({
      label: o.originalLabel || 'Sesi tambahan',
      name: o.name,
      targetRPE: o.targetRPE,
      manual: true,
      extra: true,
    }));
    const all = sessions.concat(extras);
    if (all.length) {
      const nutritionPlan = computeNutritionPlan(athlete, data);
      items.push({
        athleteId: athlete.id,
        nama: athlete.profile.nama,
        kategori: athlete.profile.kategori,
        sessions: all,
        nutritionToday: nutritionPlan.available ? nutritionPlan.ringkasanSingkat : null,
        // Dipakai UI untuk highlight menonjol (§9a) — bukan disimpulkan dari
        // teks nutritionToday, supaya styling tidak bergantung pada string-sniffing.
        nutritionKarboLoadingAktif: !!(nutritionPlan.available && nutritionPlan.karboLoading),
      });
    }
  }

  res.json({ date: todayKey, dayName, items });
});

router.get('/:id', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = data.athletes.find((a) => a.id === Number(req.params.id));
  if (!athlete) return res.status(404).json({ error: 'Atlet tidak ditemukan' });
  if (!canAccess(req.user, athlete)) return res.status(403).json({ error: 'Tidak punya akses ke atlet ini' });
  res.json(athlete);
});

// PUT /api/athletes/:id — ubah profil & periodisasi
router.put('/:id', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = data.athletes.find((a) => a.id === Number(req.params.id));
  if (!athlete) return res.status(404).json({ error: 'Atlet tidak ditemukan' });
  if (!canAccess(req.user, athlete)) return res.status(403).json({ error: 'Tidak punya akses ke atlet ini' });

  const { profile, errors: profileErrors } = validateProfile(req.body || {});
  const { periodization, errors: periodErrors } = validatePeriodization(req.body || {});
  const errors = [...profileErrors, ...periodErrors];
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  athlete.profile = profile;
  athlete.periodization = periodization;
  db.save(data);
  res.json(athlete);
});

// DELETE /api/athletes/:id
router.delete('/:id', requireAuth, (req, res) => {
  const data = db.load();
  const idx = data.athletes.findIndex((a) => a.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Atlet tidak ditemukan' });
  if (!canAccess(req.user, data.athletes[idx])) return res.status(403).json({ error: 'Tidak punya akses ke atlet ini' });

  const aid = Number(req.params.id);
  data.athletes.splice(idx, 1);
  data.tests = (data.tests || []).filter((t) => t.athleteId !== aid);
  data.monitoringLogs = (data.monitoringLogs || []).filter((m) => m.athleteId !== aid);
  data.wellnessLogs = (data.wellnessLogs || []).filter((w) => w.athleteId !== aid);
  data.injuryReports = (data.injuryReports || []).filter((i) => i.athleteId !== aid);
  data.sessionOverrides = (data.sessionOverrides || []).filter((o) => o.athleteId !== aid);
  data.nutritionWeekPlans = (data.nutritionWeekPlans || []).filter((p) => p.athleteId !== aid);
  data.athleteLinks = (data.athleteLinks || []).filter((l) => l.athleteId !== aid);
  db.save(data);
  res.json({ ok: true });
});



// --- Athlete UI: undangan & feed input atlet ---
const crypto = require('crypto');

function makeInviteCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

router.post('/:id/invite', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = data.athletes.find((a) => a.id === Number(req.params.id));
  if (!athlete) return res.status(404).json({ error: 'Atlet tidak ditemukan' });
  if (req.user.role !== 'admin' && athlete.coachId !== req.user.id) {
    return res.status(403).json({ error: 'Tidak punya akses' });
  }
  data.athleteLinks = data.athleteLinks || [];
  data.athleteLinks.forEach((l) => {
    if (l.athleteId === athlete.id && l.status === 'pending') l.status = 'revoked';
  });
  const code = makeInviteCode();
  const link = {
    id: db.nextId(data, 'athleteLinks'),
    athleteUserId: null,
    athleteId: athlete.id,
    coachId: athlete.coachId,
    status: 'pending',
    inviteCode: code,
    programAccess: (req.body && req.body.programAccess === 'full') ? 'full' : 'reminding',
    createdAt: new Date().toISOString(),
    acceptedAt: null,
  };
  data.athleteLinks.push(link);
  db.save(data);
  res.status(201).json({
    inviteCode: code,
    programAccess: link.programAccess,
    message: 'Bagikan kode ini ke atlet. One-time use.',
    athleteUrl: '/athlete.html',
  });
});

router.patch('/:id/athlete-access', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = data.athletes.find((a) => a.id === Number(req.params.id));
  if (!athlete) return res.status(404).json({ error: 'Atlet tidak ditemukan' });
  if (req.user.role !== 'admin' && athlete.coachId !== req.user.id) {
    return res.status(403).json({ error: 'Tidak punya akses' });
  }
  const mode = req.body && req.body.programAccess;
  if (!['reminding', 'full'].includes(mode)) {
    return res.status(400).json({ error: 'programAccess: reminding | full' });
  }
  data.athleteLinks = data.athleteLinks || [];
  let updated = 0;
  data.athleteLinks.forEach((l) => {
    if (l.athleteId === athlete.id && l.status === 'active') {
      l.programAccess = mode;
      updated += 1;
    }
  });
  db.save(data);
  res.json({ ok: true, updated, programAccess: mode });
});

router.get('/:id/athlete-feed', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = data.athletes.find((a) => a.id === Number(req.params.id));
  if (!athlete) return res.status(404).json({ error: 'Atlet tidak ditemukan' });
  if (req.user.role !== 'admin' && athlete.coachId !== req.user.id) {
    return res.status(403).json({ error: 'Tidak punya akses' });
  }

  const wellness = (data.wellnessLogs || [])
    .filter((w) => w.athleteId === athlete.id)
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  const athleteLogs = (data.monitoringLogs || [])
    .filter((m) => m.athleteId === athlete.id && m.source === 'athlete')
    .sort((a, b) => new Date(b.date) - new Date(a.date) || (b.id - a.id));

  const injuries = (data.injuryReports || [])
    .filter((i) => i.athleteId === athlete.id)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  const links = (data.athleteLinks || []).filter((l) => l.athleteId === athlete.id && l.status === 'active');
  const latestWellness = wellness[0] || null;
  const latestAthleteMon = athleteLogs[0] || null;
  const activeInjuries = injuries.filter((i) => i.status !== 'resolved');

  const flags = [];
  if (latestWellness) {
    if (latestWellness.sleepQuality != null && latestWellness.sleepQuality <= 2) {
      flags.push({ level: 'warn', text: `Tidur rendah (${latestWellness.sleepQuality}/5) pada ${latestWellness.date}` });
    }
    if (latestWellness.readiness != null && latestWellness.readiness <= 4) {
      flags.push({ level: 'warn', text: `Readiness rendah (${latestWellness.readiness}/10) pada ${latestWellness.date}` });
    }
    if (latestWellness.painScore != null && latestWellness.painScore >= 5) {
      flags.push({
        level: 'risk',
        text: `Nyeri pra-sesi ${latestWellness.painScore}/10${latestWellness.painLocation ? ' · ' + latestWellness.painLocation : ''} (${latestWellness.date})`,
      });
    }
    if (latestWellness.hydration === 'poor') {
      flags.push({ level: 'warn', text: `Hidrasi buruk dilaporkan (${latestWellness.date})` });
    }
  }
  if (latestAthleteMon) {
    if (latestAthleteMon.painScore != null && latestAthleteMon.painScore >= 5) {
      flags.push({ level: 'risk', text: `Nyeri post ${latestAthleteMon.painScore}/10 (${latestAthleteMon.date})` });
    }
    if (latestAthleteMon.programMatch === 'no') {
      flags.push({ level: 'warn', text: `Sesi tidak sesuai program (${latestAthleteMon.date})` });
    } else if (latestAthleteMon.programMatch === 'partial') {
      flags.push({ level: 'warn', text: `Sesi hanya sebagian sesuai program (${latestAthleteMon.date})` });
    }
    if (latestAthleteMon.rpe != null && latestAthleteMon.rpe >= 9) {
      flags.push({ level: 'warn', text: `RPE sangat tinggi (${latestAthleteMon.rpe}) pada ${latestAthleteMon.date}` });
    }
  }
  activeInjuries.forEach((i) => {
    flags.push({
      level: i.score >= 5 ? 'risk' : 'warn',
      text: `Keluhan aktif: ${i.location} ${i.score}/10`,
    });
  });

  let overall = 'ok';
  if (flags.some((f) => f.level === 'risk')) overall = 'risk';
  else if (flags.length) overall = 'warn';

  const summary = {
    overall,
    linked: links.length > 0,
    activeLinkCount: links.length,
    lastWellnessDate: latestWellness ? latestWellness.date : null,
    lastAthleteMonitoringDate: latestAthleteMon ? latestAthleteMon.date : null,
    lastSleep: latestWellness ? latestWellness.sleepQuality : null,
    lastReadiness: latestWellness ? latestWellness.readiness : null,
    lastRpe: latestAthleteMon ? latestAthleteMon.rpe : null,
    lastLoad: latestAthleteMon ? latestAthleteMon.rpe * latestAthleteMon.durationMin : null,
    activeInjuryCount: activeInjuries.length,
    flags,
    headline:
      overall === 'risk'
        ? 'Perlu perhatian — ada sinyal risiko dari input atlet'
        : overall === 'warn'
          ? 'Ada catatan yang perlu dipantau'
          : links.length
            ? 'Input atlet dalam kondisi stabil'
            : 'Belum terhubung ke aplikasi atlet',
  };

  res.json({
    summary,
    wellness: wellness.slice(0, 20),
    athleteMonitoring: athleteLogs.slice(0, 20),
    injuries,
    activeLinks: links.length,
  });
});

module.exports = router;

