const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { assembleProgram } = require('../lib/programAssembler');
const { buildMonthCalendar } = require('../lib/calendarBuilder');
const { computeNextTest, injectTestSessionIfThisWeek, attachTestToCalendar } = require('../lib/testSchedule');
const { hydrateTest } = require('../lib/testValidation');
const { fullReportDocxBuffer } = require('../lib/wordExport');
const { applyOverridesToSessions } = require('../lib/sessionOverride');
const { computeACWR } = require('../lib/acwr');
const { computeNutritionPlan } = require('../lib/nutritionEngine');
const { getOrCreateWeekPlan, summarizeForClient } = require('../lib/nutritionWeekPlan');
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

function mondayWeekKey(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function overrideWeekKey(o) {
  if (o.weekKey) return String(o.weekKey).slice(0, 10);
  if (o.date) {
    try { return mondayWeekKey(new Date(String(o.date).slice(0, 10) + 'T12:00:00')); } catch (_) { return null; }
  }
  return null;
}


function addDaysKey(yyyyMmDd, days) {
  const d = new Date(String(yyyyMmDd).slice(0, 10) + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function mapExtraToSession(o, i) {
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  let dayLabel = o.date || null;
  if (o.date) {
    try {
      const d = new Date(String(o.date).slice(0, 10) + 'T12:00:00');
      dayLabel = `${dayNames[d.getDay()]} · ${String(o.date).slice(0, 10)}`;
    } catch (_) { /* keep */ }
  }
  return {
    key: o.sessionKey || `extra-${o.id}`,
    label: o.originalLabel || `Sesi tambahan ${o.extraNumber || i + 1}`,
    name: o.name,
    day: dayLabel,
    goal: o.goal,
    targetRPE: o.targetRPE,
    durationMin: o.durationMin,
    volume: o.volume,
    mode: 'extra',
    sessionIndex: null,
    source: 'extra',
    override: {
      id: o.id,
      libraryId: o.libraryId,
      manual: true,
      kind: 'extra',
      evaluation: o.evaluation || null,
      note: o.note || null,
    },
  };
}

function activeReplaceOverrides(data, athleteId, weekKey) {
  return (data.sessionOverrides || []).filter((o) => {
    if (o.athleteId !== athleteId) return false;
    if (o.status !== 'active') return false;
    if (o.kind === 'extra') return false;
    const ow = overrideWeekKey(o);
    // Tanpa weekKey/date → anggap minggu berjalan (override dari tab Program)
    return ow == null || ow === weekKey;
  });
}

// GET /api/athletes/:athleteId/program — dihitung ulang setiap kali dipanggil.
router.get('/:athleteId/program', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;

  const result = assembleProgram(athlete, data.tests, data.monitoringLogs, new Date());
  const wk = mondayWeekKey();
  const activeOv = activeReplaceOverrides(data, athlete.id, wk);
  result.sessions = applyOverridesToSessions(result.sessions || [], activeOv);
  result.nextTest = computeNextTest(athlete, data.tests || [], new Date());

  // Sesi tambahan (extra) minggu ini — tampil di tab Sesi Latihan
  const weekEndStr = addDaysKey(wk, 6); // Minggu (ISO date string, bebas timezone)
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const allExtrasAthlete = (data.sessionOverrides || []).filter((o) =>
    Number(o.athleteId) === Number(athlete.id)
    && o.status === 'active'
    && o.kind === 'extra'
  );
  const extras = allExtrasAthlete.filter((o) => {
    const dateKey = o.date ? String(o.date).slice(0, 10) : null;
    if (dateKey && dateKey >= wk && dateKey <= weekEndStr) return true;
    const ow = overrideWeekKey(o);
    return ow === wk;
  });
  extras.sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))
    || (Number(a.extraNumber) || 0) - (Number(b.extraNumber) || 0));
  const extraSessions = extras.map((o, i) => mapExtraToSession(o, i));
  result.sessions = (result.sessions || []).concat(extraSessions);
  result.sessions = injectTestSessionIfThisWeek(result.sessions, result.nextTest, wk, weekEndStr);

  result.sessionLibraryAvailable = true;
  result.weekKey = wk;
  result.weekEnd = weekEndStr;
  result.overridesApplied = activeOv.length;
  result.extrasApplied = extraSessions.length;
  result.extraSessions = extraSessions;
  // Diagnostik (aman untuk production): total extra aktif atlet, berapa yang masuk minggu ini
  result.extrasDebug = {
    totalActiveExtras: allExtrasAthlete.length,
    inThisWeek: extraSessions.length,
    weekRange: `${wk} … ${weekEndStr}`,
    dates: allExtrasAthlete.map((o) => o.date || null),
  };
  res.json(result);
});

// GET /api/athletes/:athleteId/calendar?year=YYYY&month=MM (bulan 1-12)
router.get('/:athleteId/calendar', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;

  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = Number(req.query.month) || now.getMonth() + 1;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Parameter year tidak valid' });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Parameter month tidak valid (1-12)' });
  }

  const result = buildMonthCalendar(athlete, data.tests, data.monitoringLogs, year, month, data.sessionOverrides || []);
  const nextTest = computeNextTest(athlete, data.tests || [], new Date());
  attachTestToCalendar(result, nextTest);
  res.json(result);
});

// GET /api/athletes/:athleteId/export/word — unduh "Laporan Lengkap" atlet
// sebagai dokumen Word: Program (termasuk sesi override aktif minggu ini) +
// riwayat tes LENGKAP + Monitoring/ACWR + Nutrisi (target + menu minggu
// berjalan) + Feed & riwayat cedera — satu dokumen rujukan periodik,
// gabungan semua modul yang sudah dicatat sistem untuk atlet ini (sebelumnya
// cuma berisi Program + 8 tes terakhir, lihat CHANGELOG-PATCH.md).
router.get('/:athleteId/export/word', requireAuth, async (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;

  const programData = assembleProgram(athlete, data.tests, data.monitoringLogs, new Date());
  const weekKey = mondayWeekKey();
  const activeOv = activeReplaceOverrides(data, athlete.id, weekKey);
  programData.sessions = applyOverridesToSessions(programData.sessions || [], activeOv);

  // Sesi tambahan (extra) minggu ini — dilampirkan di akhir daftar
  const extras = (data.sessionOverrides || []).filter(
    (o) => o.athleteId === athlete.id
      && o.status === 'active'
      && o.kind === 'extra'
      && o.weekKey === weekKey
  );
  extras.forEach((o, i) => {
    programData.sessions.push({
      label: o.originalLabel || `Sesi tambahan ${o.extraNumber || i + 1}`,
      name: o.name,
      day: o.date || null,
      goal: o.goal,
      targetRPE: o.targetRPE,
      durationMin: o.durationMin,
      volume: o.volume,
      override: { id: o.id, manual: true, kind: 'extra', note: o.note },
    });
  });

  const tests = data.tests
    .filter((t) => t.athleteId === athlete.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id)
    .map((t) => hydrateTest(t, athlete));

  // Monitoring & ACWR — sumber sama dengan tab Monitor (routes/monitoring.js)
  const monitoringLogs = data.monitoringLogs
    .filter((m) => m.athleteId === athlete.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
  const monitoring = { logs: monitoringLogs, acwr: computeACWR(monitoringLogs) };

  // Nutrisi — sumber sama dengan tab Nutrisi (routes/nutrition.js)
  const nutritionPlan = computeNutritionPlan(athlete, data);
  let weekMenu = null;
  try {
    const { plan } = getOrCreateWeekPlan(athlete, data, { today: localDateKey(new Date()) });
    weekMenu = summarizeForClient(plan);
  } catch (err) {
    console.error('export word: week menu error', err);
  }

  // Feed (input mandiri atlet) & riwayat cedera — sumber sama dengan tab
  // Feed (routes/athletes.js endpoint /:id/athlete-feed)
  const feedData = {
    wellness: (data.wellnessLogs || [])
      .filter((w) => w.athleteId === athlete.id)
      .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)),
    injuries: (data.injuryReports || [])
      .filter((i) => i.athleteId === athlete.id)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)),
  };

  try {
    const buffer = await fullReportDocxBuffer({ athlete, programData, tests, monitoring, nutritionPlan, weekMenu, feedData });
    const safeName = athlete.profile.nama.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_') || 'Atlet';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="Laporan_Lengkap_${safeName}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membuat dokumen Word' });
  }
});

module.exports = router;
