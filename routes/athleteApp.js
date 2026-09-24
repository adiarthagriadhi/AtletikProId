const express = require('express');
const db = require('../db');
const { requireAthlete, requireActiveLink } = require('../middleware/athleteAuth');
const { assembleProgram } = require('../lib/programAssembler');
const { computeACWR } = require('../lib/acwr');
const { computeNutritionPlan } = require('../lib/nutritionEngine');
const { getOrCreateWeekPlan, summarizeForClient } = require('../lib/nutritionWeekPlan');
const { localDateKey } = require('../lib/dateUtil');

const router = express.Router();

function sessionKeyFor(athleteId, date, label) {
  const safe = String(label || 'main').replace(/\s+/g, '_').slice(0, 40);
  return `${athleteId}:${date}:${safe}`;
}

function summarizeSession(s) {
  if (!s) return null;
  return {
    label: s.label || null,
    name: s.name || 'Sesi',
    day: s.day || null,
    goal: s.goal || null,
    targetRPE: s.targetRPE != null ? s.targetRPE : null,
    durationMin: s.durationMin || s.durMin || null,
    volume: s.volume != null ? s.volume : null,
    mode: s.mode || null,
  };
}

/** GET /api/athlete/today */
router.get('/today', requireAthlete, requireActiveLink, (req, res) => {
  const data = req.dbData;
  const athlete = req.linkedAthlete;
  const link = req.athleteLink;
  const today = localDateKey(new Date());

  const prog = assembleProgram(athlete, data.tests, data.monitoringLogs, new Date());
  const sessions = (prog.sessions || prog.weekSessions || []).slice(0, 6).map(summarizeSession);

  // Prefer sessions that mention today if day field exists
  const todaySessions = sessions.filter((s) => s && s.day && String(s.day).toLowerCase().includes(
    ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'][new Date().getDay()]
  ));
  const list = (todaySessions.length ? todaySessions : sessions).filter(Boolean);

  const monToday = (data.monitoringLogs || []).filter(
    (m) => m.athleteId === athlete.id && m.date === today
  );
  const wellnessToday = (data.wellnessLogs || []).filter(
    (w) => w.athleteId === athlete.id && w.date === today
  );
  const preDone = wellnessToday.some((w) => w.type === 'pre_session' || w.type === 'daily');
  const postDone = monToday.length > 0;

  const injuries = (data.injuryReports || []).filter(
    (i) => i.athleteId === athlete.id && i.status !== 'resolved'
  );

  const nutritionPlan = computeNutritionPlan(athlete, data);

  res.json({
    date: today,
    athlete: {
      id: athlete.id,
      name: athlete.profile.nama,
      kategori: athlete.profile.kategori,
      event: athlete.profile.event,
    },
    programAccess: link.programAccess || 'reminding',
    phase: prog.phase || null,
    sessions: list,
    nutritionToday: nutritionPlan.available ? nutritionPlan.ringkasanSingkat : null,
    // Dipakai UI untuk highlight menonjol (§9a) — bukan disimpulkan dari
    // teks nutritionToday, supaya styling tidak bergantung pada string-sniffing.
    nutritionKarboLoadingAktif: !!(nutritionPlan.available && nutritionPlan.karboLoading),
    status: {
      preCheckin: preDone,
      postMonitoring: postDone,
      skip: false,
    },
    activeInjuries: injuries.map((i) => ({
      id: i.id,
      location: i.location,
      score: i.score,
      status: i.status,
    })),
  });
});

/** GET /api/athlete/nutrition — dihitung langsung dari profil + fase atlet ini
 * (baca saja), termasuk menu minggu berjalan (weekMenu) — sebelumnya endpoint
 * ini cuma mengembalikan target/ringkasan (computeNutritionPlan) tanpa menu
 * mingguan, jadi tab Nutrisi di aplikasi atlet tidak pernah menampilkan menu
 * yang sama seperti yang dilihat pelatih di Command Center (yang sudah
 * memakai getOrCreateWeekPlan/summarizeForClient — lihat routes/nutrition.js
 * baris serupa). Atlet hanya membaca; susun-ulang menu tetap wewenang
 * pelatih (POST .../nutrition/week/regenerate, hanya lewat Command Center). */
router.get('/nutrition', requireAthlete, requireActiveLink, (req, res) => {
  const athlete = req.linkedAthlete;
  const data = req.dbData;
  const base = computeNutritionPlan(athlete, data);
  try {
    const { plan } = getOrCreateWeekPlan(athlete, data, { today: localDateKey(new Date()) });
    res.json({ ...base, weekMenu: summarizeForClient(plan) });
  } catch (err) {
    console.error('athlete week menu error', err);
    res.json({ ...base, weekMenu: null });
  }
});

/** GET /api/athlete/program — reminding: 4 hari; full: pakai window query */
router.get('/program', requireAthlete, requireActiveLink, (req, res) => {
  const athlete = req.linkedAthlete;
  const link = req.athleteLink;
  const data = req.dbData;
  const prog = assembleProgram(athlete, data.tests, data.monitoringLogs, new Date());
  const access = link.programAccess || 'reminding';
  let sessions = (prog.sessions || prog.weekSessions || []).map(summarizeSession).filter(Boolean);
  if (access === 'reminding') {
    sessions = sessions.slice(0, 8);
  }
  res.json({
    programAccess: access,
    phase: prog.phase || null,
    weekPlan: prog.weekPlan || null,
    sessions,
    note: prog.note || null,
  });
});

/** POST /api/athlete/wellness — pre-session / daily */
router.post('/wellness', requireAthlete, requireActiveLink, (req, res) => {
  const body = req.body || {};
  const athlete = req.linkedAthlete;
  const data = req.dbData;
  const date = body.date ? String(body.date).slice(0, 10) : localDateKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Tanggal tidak valid' });
  }
  if (date > localDateKey(new Date())) {
    return res.status(400).json({ error: 'Tanggal tidak boleh di masa depan' });
  }
  const sleepQuality = Number(body.sleepQuality);
  if (!Number.isFinite(sleepQuality) || sleepQuality < 1 || sleepQuality > 5) {
    return res.status(400).json({ error: 'Kualitas tidur wajib 1–5' });
  }
  const readiness = Number(body.readiness);
  if (!Number.isFinite(readiness) || readiness < 1 || readiness > 10) {
    return res.status(400).json({ error: 'Readiness wajib 1–10' });
  }
  const hydration = body.hydration;
  if (hydration != null && !['poor', 'ok', 'good'].includes(hydration)) {
    return res.status(400).json({ error: 'Hidrasi: poor | ok | good' });
  }
  let painScore = body.painScore === '' || body.painScore == null ? null : Number(body.painScore);
  if (painScore != null && (!Number.isFinite(painScore) || painScore < 0 || painScore > 10)) {
    return res.status(400).json({ error: 'Skala nyeri 0–10' });
  }
  let note = body.note != null ? String(body.note).trim() : '';
  if (note.length > 200) note = note.slice(0, 200);

  const log = {
    id: db.nextId(data, 'wellnessLogs'),
    athleteId: athlete.id,
    coachId: athlete.coachId,
    date,
    type: body.type === 'daily' ? 'daily' : 'pre_session',
    sleepQuality,
    sleepHours: body.sleepHours != null && body.sleepHours !== '' ? Number(body.sleepHours) : null,
    readiness,
    ateBefore: body.ateBefore == null ? null : !!body.ateBefore,
    mealTiming: body.mealTiming || null,
    hydration: hydration || null,
    painLocation: body.painLocation ? String(body.painLocation).trim().slice(0, 60) : null,
    painScore,
    note: note || null,
    sessionKey: body.sessionKey || sessionKeyFor(athlete.id, date, 'main'),
    source: 'athlete',
    createdAt: new Date().toISOString(),
  };
  data.wellnessLogs = data.wellnessLogs || [];
  data.wellnessLogs.push(log);
  db.save(data);
  res.status(201).json(log);
});

/** POST /api/athlete/monitoring — masuk ke monitoringLogs, source athlete */
router.post('/monitoring', requireAthlete, requireActiveLink, (req, res) => {
  const body = req.body || {};
  const athlete = req.linkedAthlete;
  const data = req.dbData;
  const date = body.date ? String(body.date).slice(0, 10) : localDateKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Tanggal tidak valid' });
  }
  if (date > localDateKey(new Date())) {
    return res.status(400).json({ error: 'Tanggal sesi tidak boleh di masa depan' });
  }
  const rpe = Number(body.rpe);
  if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10) {
    return res.status(400).json({ error: 'RPE 0–10' });
  }
  const durationMin = Number(body.durationMin);
  if (!Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 600) {
    return res.status(400).json({ error: 'Durasi tidak valid' });
  }
  let note = body.note != null ? String(body.note).trim() : '';
  if (note.length > 200) note = note.slice(0, 200);
  const programMatch = ['yes', 'partial', 'no'].includes(body.programMatch) ? body.programMatch : null;
  let painScore = body.painScore === '' || body.painScore == null ? null : Number(body.painScore);
  if (painScore != null && (!Number.isFinite(painScore) || painScore < 0 || painScore > 10)) {
    return res.status(400).json({ error: 'Skala nyeri 0–10' });
  }
  const painLocation = body.painLocation ? String(body.painLocation).trim().slice(0, 60) : null;

  const log = {
    id: db.nextId(data, 'monitoringLogs'),
    athleteId: athlete.id,
    date,
    rpe,
    durationMin,
    note: note || null,
    source: 'athlete',
    sessionKey: body.sessionKey || sessionKeyFor(athlete.id, date, 'main'),
    programMatch,
    painScore,
    painLocation,
    createdAt: new Date().toISOString(),
  };
  data.monitoringLogs = data.monitoringLogs || [];
  data.monitoringLogs.push(log);
  db.save(data);
  const logs = data.monitoringLogs.filter((m) => m.athleteId === athlete.id);
  res.status(201).json({ log, acwr: computeACWR(logs) });
});

/** GET /api/athlete/progress */
router.get('/progress', requireAthlete, requireActiveLink, (req, res) => {
  const athlete = req.linkedAthlete;
  const data = req.dbData;
  const logs = (data.monitoringLogs || []).filter((m) => m.athleteId === athlete.id);
  const acwr = computeACWR(logs);
  const tests = (data.tests || [])
    .filter((t) => t.athleteId === athlete.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id)
    .slice(0, 5)
    .map((t) => ({ id: t.id, date: t.date, label: t.label || null }));

  const today = new Date(localDateKey(new Date()) + 'T00:00:00');
  let logsLast7 = 0;
  logs.forEach((m) => {
    const d = new Date(m.date + 'T00:00:00');
    const diff = (today - d) / 86400000;
    if (diff >= 0 && diff <= 6) logsLast7 += 1;
  });

  let badge = 'Belum eligible';
  if (acwr.eligible && acwr.acwr != null) {
    if (acwr.acwr < 0.8) badge = 'Undertraining';
    else if (acwr.acwr <= 1.3) badge = 'Aman';
    else if (acwr.acwr <= 1.5) badge = 'Waspada';
    else badge = 'Risiko tinggi';
  }

  res.json({
    tests,
    monitoringDays: acwr.daysOfHistory || 0,
    logsLast7,
    acwrBadge: badge,
    acwrEligible: !!acwr.eligible,
  });
});

/** Injury reports */
router.get('/injuries', requireAthlete, requireActiveLink, (req, res) => {
  const list = (req.dbData.injuryReports || []).filter(
    (i) => i.athleteId === req.linkedAthlete.id
  );
  res.json(list);
});

router.post('/injuries', requireAthlete, requireActiveLink, (req, res) => {
  const body = req.body || {};
  const location = String(body.location || '').trim();
  if (!location) return res.status(400).json({ error: 'Lokasi keluhan wajib' });
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > 10) {
    return res.status(400).json({ error: 'Skala 0–10' });
  }
  const data = req.dbData;
  const row = {
    id: db.nextId(data, 'injuryReports'),
    athleteId: req.linkedAthlete.id,
    location: location.slice(0, 80),
    side: body.side || null,
    score,
    status: 'active',
    onsetDate: body.onsetDate || localDateKey(new Date()),
    note: body.note ? String(body.note).trim().slice(0, 200) : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.injuryReports = data.injuryReports || [];
  data.injuryReports.push(row);
  db.save(data);
  res.status(201).json(row);
});

router.patch('/injuries/:id', requireAthlete, requireActiveLink, (req, res) => {
  const data = req.dbData;
  const row = (data.injuryReports || []).find(
    (i) => i.id === Number(req.params.id) && i.athleteId === req.linkedAthlete.id
  );
  if (!row) return res.status(404).json({ error: 'Tidak ditemukan' });
  if (req.body.score != null) {
    const score = Number(req.body.score);
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      return res.status(400).json({ error: 'Skala 0–10' });
    }
    row.score = score;
  }
  if (req.body.status && ['active', 'improving', 'resolved'].includes(req.body.status)) {
    row.status = req.body.status;
  }
  if (req.body.note != null) row.note = String(req.body.note).trim().slice(0, 200);
  row.updatedAt = new Date().toISOString();
  db.save(data);
  res.json(row);
});

module.exports = router;
