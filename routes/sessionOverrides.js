const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { assembleProgram } = require('../lib/programAssembler');
const { computeACWR } = require('../lib/acwr');
const { listLibraryGrouped, getLibraryItem } = require('../lib/sessionLibrary');
const { evaluateOverride } = require('../lib/sessionOverride');
const { localDateKey } = require('../lib/dateUtil');
const { isOngoingInjuryStatus } = require('../lib/injuryStatus');

const router = express.Router({ mergeParams: true });

function canAccess(user, athlete) {
  return user.role === 'admin' || athlete.coachId === user.id;
}

function findAthlete(req, res, data) {
  const id = Number(req.params.athleteId || req.params.id);
  const athlete = (data.athletes || []).find((a) => a.id === id);
  if (!athlete) {
    res.status(404).json({ error: 'Atlet tidak ditemukan' });
    return null;
  }
  if (!canAccess(req.user, athlete)) {
    res.status(403).json({ error: 'Tidak punya akses' });
    return null;
  }
  return athlete;
}

function mondayWeekKey(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return localDateKey(x);
}

function hasActiveHighPain(data, athleteId) {
  try {
    const injuries = (data.injuryReports || []).filter(
      (i) => i.athleteId === athleteId && isOngoingInjuryStatus(i.status) && Number(i.score) >= 5
    );
    if (injuries.length) return true;
    const logs = (data.monitoringLogs || [])
      .filter((m) => m.athleteId === athleteId && (m.painScore != null || m.shoulderPain != null))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    if (logs[0]) {
      const score = logs[0].painScore != null ? logs[0].painScore : logs[0].shoulderPain;
      if (Number(score) >= 5) return true;
    }
    const wel = (data.wellnessLogs || [])
      .filter((w) => w.athleteId === athleteId && w.painScore != null)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    if (wel[0] && Number(wel[0].painScore) >= 5) return true;
  } catch (_) { /* ignore */ }
  return false;
}

function numOr(val, fallback) {
  if (val === '' || val === undefined || val === null) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function ensureCollections(data) {
  data.sessionOverrides = data.sessionOverrides || [];
  data.monitoringLogs = data.monitoringLogs || [];
  data.tests = data.tests || [];
  data.injuryReports = data.injuryReports || [];
  data.wellnessLogs = data.wellnessLogs || [];
  data.seq = data.seq || {};
  if (data.seq.sessionOverrides == null) data.seq.sessionOverrides = 0;
}

// GET katalog
router.get('/session-library', requireAuth, (req, res) => {
  try {
    res.json({ groups: listLibraryGrouped() });
  } catch (err) {
    console.error('session-library', err);
    res.status(500).json({ error: err.message || 'Gagal memuat katalog' });
  }
});

// POST evaluate
router.post('/session-overrides/evaluate', requireAuth, (req, res) => {
  try {
    const data = db.load();
    ensureCollections(data);
    const athlete = findAthlete(req, res, data);
    if (!athlete) return;
    const body = req.body || {};
    const libraryId = body.libraryId || 'custom';
    if (!getLibraryItem(libraryId)) {
      return res.status(400).json({ error: 'libraryId tidak valid' });
    }
    const logs = (data.monitoringLogs || []).filter((m) => m.athleteId === athlete.id);
    const acwr = computeACWR(logs);
    const prog = assembleProgram(athlete, data.tests || [], data.monitoringLogs || [], new Date());
    const weekKey = mondayWeekKey();
    const weekOverrides = (data.sessionOverrides || []).filter(
      (o) => o.athleteId === athlete.id && o.weekKey === weekKey && o.status === 'active'
    );
    const evaluation = evaluateOverride({
      libraryId,
      acwr,
      phase: prog.phase && prog.phase.phase,
      weekOverrides,
      excludeOverrideId: body.excludeOverrideId || null,
      targetRPE: body.targetRPE,
      hasActiveShoulderPain: hasActiveHighPain(data, athlete.id),
    });
    const item = getLibraryItem(libraryId);
    res.json({
      evaluation,
      defaults: {
        name: item.label,
        goal: item.summary,
        targetRPE: item.defaultTargetRPE,
        durationMin: item.defaultDurationMin,
        volume: item.defaultVolumeM,
        intensityNote: item.intensityNote,
        purpose: item.purpose,
        phaseHint: item.phaseHint,
      },
    });
  } catch (err) {
    console.error('session-overrides evaluate', err);
    res.status(500).json({ error: err.message || 'Gagal evaluasi override' });
  }
});

// POST save
router.post('/session-overrides', requireAuth, (req, res) => {
  try {
    const data = db.load();
    ensureCollections(data);
    const athlete = findAthlete(req, res, data);
    if (!athlete) return;
    const body = req.body || {};
    const kind = body.kind === 'extra' ? 'extra' : 'replace';
    const libraryId = body.libraryId || 'custom';
    if (!getLibraryItem(libraryId)) {
      return res.status(400).json({ error: 'libraryId tidak valid: ' + libraryId });
    }

    const logs = (data.monitoringLogs || []).filter((m) => m.athleteId === athlete.id);
    const acwr = computeACWR(logs);

    let weekKey;
    if (body.weekKey && /^\d{4}-\d{2}-\d{2}$/.test(String(body.weekKey))) {
      weekKey = String(body.weekKey).slice(0, 10);
    } else if (body.date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) {
      weekKey = mondayWeekKey(new Date(String(body.date).slice(0, 10) + 'T12:00:00'));
    } else {
      weekKey = mondayWeekKey();
    }

    const refDate = body.date
      ? new Date(String(body.date).slice(0, 10) + 'T12:00:00')
      : (body.weekKey ? new Date(String(body.weekKey).slice(0, 10) + 'T12:00:00') : new Date());

    const prog = assembleProgram(athlete, data.tests || [], data.monitoringLogs || [], refDate);
    const weekOverrides = (data.sessionOverrides || []).filter(
      (o) => o.athleteId === athlete.id && o.weekKey === weekKey && o.status === 'active'
    );

    const evaluation = evaluateOverride({
      libraryId,
      acwr,
      phase: prog.phase && prog.phase.phase,
      weekOverrides,
      excludeOverrideId: null,
      targetRPE: body.targetRPE,
      hasActiveShoulderPain: hasActiveHighPain(data, athlete.id),
    });

    const item = getLibraryItem(libraryId);

    if (kind === 'extra') {
      const date = body.date ? String(body.date).slice(0, 10) : null;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Tanggal sesi tambahan wajib (YYYY-MM-DD)' });
      }
      const existingExtras = data.sessionOverrides.filter(
        (o) => o.athleteId === athlete.id && o.kind === 'extra' && o.status === 'active'
      );
      const extraNumber = existingExtras.length + 1;
      const row = {
        id: db.nextId(data, 'sessionOverrides'),
        athleteId: athlete.id,
        coachId: athlete.coachId,
        kind: 'extra',
        weekKey: mondayWeekKey(new Date(date + 'T12:00:00')),
        date,
        sessionIndex: null,
        extraNumber,
        sessionKey: `extra-${date}-${extraNumber}`,
        libraryId,
        name: body.name != null && String(body.name).trim() ? String(body.name).trim().slice(0, 120) : (item.label + ' (tambahan)'),
        goal: body.goal != null ? String(body.goal).trim().slice(0, 300) : (item.purpose || item.summary),
        targetRPE: numOr(body.targetRPE, item.defaultTargetRPE),
        durationMin: numOr(body.durationMin, item.defaultDurationMin),
        volume: body.volume === '' || body.volume == null ? item.defaultVolumeM : numOr(body.volume, item.defaultVolumeM),
        note: body.note ? String(body.note).trim().slice(0, 200) : null,
        originalName: null,
        originalLabel: `Sesi tambahan ${extraNumber}`,
        evaluation,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      data.sessionOverrides.push(row);
      db.save(data);
      return res.status(201).json(row);
    }

    const sessionIndex = Number(body.sessionIndex);
    if (!Number.isInteger(sessionIndex) || sessionIndex < 0) {
      return res.status(400).json({ error: 'sessionIndex wajib (0-based) untuk override ganti sesi' });
    }

    data.sessionOverrides.forEach((o) => {
      if (
        o.athleteId === athlete.id
        && o.kind !== 'extra'
        && o.weekKey === weekKey
        && o.sessionIndex === sessionIndex
        && o.status === 'active'
      ) {
        o.status = 'cleared';
      }
    });

    const original = (prog.sessions || [])[sessionIndex] || {};
    const row = {
      id: db.nextId(data, 'sessionOverrides'),
      athleteId: athlete.id,
      coachId: athlete.coachId,
      kind: 'replace',
      weekKey,
      date: body.date ? String(body.date).slice(0, 10) : null,
      sessionIndex,
      sessionKey: original.key || body.sessionKey || null,
      libraryId,
      name: body.name != null && String(body.name).trim() ? String(body.name).trim().slice(0, 120) : item.label,
      goal: body.goal != null ? String(body.goal).trim().slice(0, 300) : (item.purpose || item.summary),
      targetRPE: numOr(body.targetRPE, item.defaultTargetRPE),
      durationMin: numOr(body.durationMin, item.defaultDurationMin),
      volume: body.volume === '' || body.volume == null ? item.defaultVolumeM : numOr(body.volume, item.defaultVolumeM),
      note: body.note ? String(body.note).trim().slice(0, 200) : null,
      originalName: original.name || null,
      originalLabel: original.label || null,
      evaluation,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.sessionOverrides.push(row);
    db.save(data);
    res.status(201).json(row);
  } catch (err) {
    console.error('session-overrides POST', err);
    res.status(500).json({ error: err.message || 'Terjadi kesalahan pada server' });
  }
});

// DELETE
router.delete('/session-overrides/:id', requireAuth, (req, res) => {
  try {
    const data = db.load();
    ensureCollections(data);
    const athlete = findAthlete(req, res, data);
    if (!athlete) return;
    const row = data.sessionOverrides.find(
      (o) => o.id === Number(req.params.id) && o.athleteId === athlete.id
    );
    if (!row) return res.status(404).json({ error: 'Override tidak ditemukan' });
    row.status = 'cleared';
    row.updatedAt = new Date().toISOString();
    db.save(data);
    res.json({ ok: true });
  } catch (err) {
    console.error('session-overrides DELETE', err);
    res.status(500).json({ error: err.message || 'Gagal menghapus override' });
  }
});

module.exports = router;
