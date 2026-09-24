const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { computeACWR, computeACWRSeries } = require('../lib/acwr');
const { localDateKey } = require('../lib/dateUtil');

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

function findLogOr404(req, res, data, athlete) {
  const log = data.monitoringLogs.find((m) => m.id === Number(req.params.logId) && m.athleteId === athlete.id);
  if (!log) {
    res.status(404).json({ error: 'Log monitoring tidak ditemukan' });
    return null;
  }
  return log;
}

function validateLog(body) {
  const errors = [];
  const date = String(body.date || '').trim();
  const dateD = new Date(date + 'T00:00:00');
  if (!date || isNaN(dateD.getTime())) {
    errors.push('Tanggal sesi tidak valid');
  } else if (date > localDateKey(new Date())) {
    // Log monitoring mencatat sesi yang SUDAH terjadi — tanggal masa depan
    // tidak masuk akal secara fisik, dan diam-diam hilang dari grafik tren
    // ACWR (yang dihitung mundur dari hari ini), jadi ditolak di sini
    // supaya jelas ke pelatih, bukan gagal senyap di grafik.
    errors.push('Tanggal sesi tidak boleh di masa depan');
  }

  const rpe = Number(body.rpe);
  if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10) errors.push('RPE aktual harus di antara 0-10');

  const durationMin = Number(body.durationMin);
  if (!Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 600) errors.push('Durasi sesi tidak valid');

  // Catatan opsional (maks 200 karakter)
  let note = body.note != null ? String(body.note).trim() : '';
  if (note.length > 200) {
    errors.push('Catatan maksimal 200 karakter');
    note = note.slice(0, 200);
  }

  // Timbangan sebelum/sesudah sesi — opsional, dipakai lib/hydrationCalc.js
  // untuk rekomendasi cairan presisi (NUTRITION-MODULE-DESIGN.md §9b).
  // Boleh kosong; kalau diisi harus angka wajar.
  const beratSebelumKg = body.beratSebelumKg === '' || body.beratSebelumKg == null ? null : Number(body.beratSebelumKg);
  const beratSesudahKg = body.beratSesudahKg === '' || body.beratSesudahKg == null ? null : Number(body.beratSesudahKg);
  const cairanDiminumMlSaatSesi = body.cairanDiminumMlSaatSesi === '' || body.cairanDiminumMlSaatSesi == null ? null : Number(body.cairanDiminumMlSaatSesi);
  if (beratSebelumKg != null && (!Number.isFinite(beratSebelumKg) || beratSebelumKg < 20 || beratSebelumKg > 200)) {
    errors.push('Berat sebelum sesi tidak valid');
  }
  if (beratSesudahKg != null && (!Number.isFinite(beratSesudahKg) || beratSesudahKg < 20 || beratSesudahKg > 200)) {
    errors.push('Berat sesudah sesi tidak valid');
  }
  if (cairanDiminumMlSaatSesi != null && (!Number.isFinite(cairanDiminumMlSaatSesi) || cairanDiminumMlSaatSesi < 0 || cairanDiminumMlSaatSesi > 10000)) {
    errors.push('Cairan diminum saat sesi tidak valid');
  }

  return { log: { date, rpe, durationMin, note: note || null, beratSebelumKg, beratSesudahKg, cairanDiminumMlSaatSesi }, errors };
}

// GET /api/athletes/:athleteId/monitoring
router.get('/:athleteId/monitoring', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;

  const list = data.monitoringLogs
    .filter((m) => m.athleteId === athlete.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
  res.json(list);
});

// POST /api/athletes/:athleteId/monitoring
router.post('/:athleteId/monitoring', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;

  const { log, errors } = validateLog(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const record = {
    id: db.nextId(data, 'monitoringLogs'),
    athleteId: athlete.id,
    ...log,
    createdAt: new Date().toISOString(),
  };
  data.monitoringLogs.push(record);
  db.save(data);
  res.status(201).json(record);
});

// PUT /api/athletes/:athleteId/monitoring/:logId — ubah satu log monitoring
router.put('/:athleteId/monitoring/:logId', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;
  const existing = findLogOr404(req, res, data, athlete);
  if (!existing) return;

  const { log, errors } = validateLog(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  Object.assign(existing, log);
  db.save(data);
  res.json(existing);
});

// DELETE /api/athletes/:athleteId/monitoring/:logId
router.delete('/:athleteId/monitoring/:logId', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;
  const existing = findLogOr404(req, res, data, athlete);
  if (!existing) return;

  data.monitoringLogs = data.monitoringLogs.filter((m) => m.id !== existing.id);
  db.save(data);
  res.json({ ok: true });
});

// GET /api/athletes/:athleteId/monitoring/acwr
router.get('/:athleteId/monitoring/acwr', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;

  const logs = data.monitoringLogs.filter((m) => m.athleteId === athlete.id);
  res.json(computeACWR(logs));
});

// GET /api/athletes/:athleteId/monitoring/acwr-series?days=42 — deret harian
// untuk grafik tren (ACWR + beban latihan), dipakai tab Monitoring.
router.get('/:athleteId/monitoring/acwr-series', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;

  let days = Number(req.query.days) || 42;
  days = Math.min(180, Math.max(7, days));

  const logs = data.monitoringLogs.filter((m) => m.athleteId === athlete.id);
  res.json(computeACWRSeries(logs, new Date(), days));
});

module.exports = router;
