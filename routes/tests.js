const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { LIKERT_SCALE } = require('../lib/technique');
const { CATEGORIES } = require('../lib/categories');
const { TECHNIQUE_ENGINE_BY_PROTOCOL, validateTest, hydrateTest } = require('../lib/testValidation');

const router = express.Router();

function canAccess(user, athlete) {
  return user.role === 'admin' || athlete.coachId === user.id;
}

function findAthleteOr403(req, res, data) {
  const athlete = data.athletes.find((a) => a.id === Number(req.params.athleteId));
  if (!athlete) {
    res.status(404).json({ error: 'Atlet tidak ditemukan' });
    return null;
  }
  if (!canAccess(req.user, athlete)) {
    res.status(403).json({ error: 'Tidak punya akses ke atlet ini' });
    return null;
  }
  return athlete;
}

function findTestOr404(req, res, data, athlete) {
  const test = data.tests.find((t) => t.id === Number(req.params.testId) && t.athleteId === athlete.id);
  if (!test) {
    res.status(404).json({ error: 'Tes tidak ditemukan' });
    return null;
  }
  return test;
}

// GET /api/athletes/:athleteId/tests/technique-checklist — butir checklist
// teknik & skala Likert untuk nomor atlet ini, dipakai render form input.
// Kategori tanpa checklist teknik (mis. Menengah/Jauh) dapat items: [].
router.get('/:athleteId/tests/technique-checklist', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;

  const catDef = CATEGORIES[athlete.profile.kategori];
  const engine = catDef ? TECHNIQUE_ENGINE_BY_PROTOCOL[catDef.testProtocol] : null;
  const items = (engine && engine.TECHNIQUE_CHECKLIST[athlete.profile.event]) || [];

  res.json({
    event: athlete.profile.event,
    items,
    likertScale: LIKERT_SCALE,
  });
});

// GET /api/athletes/:athleteId/tests — riwayat lengkap, urut terbaru dulu
router.get('/:athleteId/tests', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;

  const list = data.tests
    .filter((t) => t.athleteId === athlete.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id)
    .map((t) => hydrateTest(t, athlete));
  res.json(list);
});

// POST /api/athletes/:athleteId/tests — setiap submit jadi titik data baru
router.post('/:athleteId/tests', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;

  const { test, errors } = validateTest(req.body || {}, athlete);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const record = {
    id: db.nextId(data, 'tests'),
    athleteId: athlete.id,
    ...test,
    createdAt: new Date().toISOString(),
  };
  data.tests.push(record);
  db.save(data);
  res.status(201).json(hydrateTest(record, athlete));
});

// PUT /api/athletes/:athleteId/tests/:testId — ubah satu entri tes
router.put('/:athleteId/tests/:testId', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;
  const existing = findTestOr404(req, res, data, athlete);
  if (!existing) return;

  const { test, errors } = validateTest(req.body || {}, athlete);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  Object.assign(existing, test);
  db.save(data);
  res.json(hydrateTest(existing, athlete));
});

// DELETE /api/athletes/:athleteId/tests/:testId
router.delete('/:athleteId/tests/:testId', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;
  const existing = findTestOr404(req, res, data, athlete);
  if (!existing) return;

  data.tests = data.tests.filter((t) => t.id !== existing.id);
  db.save(data);
  res.json({ ok: true });
});

module.exports = router;
