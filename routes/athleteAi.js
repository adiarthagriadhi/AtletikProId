// Coach AI di portal atlet mandiri: catatan harian + "Tanya Coach".
// Lihat lib/aiCoach.js untuk strategi hemat token & fallback tanpa AI.
const express = require('express');
const db = require('../db');
const { requireAthlete, requireActiveLink } = require('../middleware/athleteAuth');
const { assembleProgram } = require('../lib/programAssembler');
const { computeACWR } = require('../lib/acwr');
const { computeNutritionPlan } = require('../lib/nutritionEngine');
const { getAthleteAccess } = require('../lib/athleteAccess');
const { localDateKey } = require('../lib/dateUtil');
const ai = require('../lib/aiCoach');

const router = express.Router();
const DAY_NAMES = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const HISTORY_MAX = 10;

function askQuota(access) {
  const premium = Number(process.env.AI_ASK_PREMIUM_PER_DAY);
  const free = Number(process.env.AI_ASK_FREE_PER_DAY);
  return access && access.premium
    ? (Number.isFinite(premium) && premium >= 0 ? premium : 5)
    : (Number.isFinite(free) && free >= 0 ? free : 1);
}

function requireSelfCoached(req, res, next) {
  if (!req.athleteLink.selfCoached) {
    return res.status(403).json({ error: 'Coach AI tersedia untuk akun atlet mandiri. Atlet binaan mengikuti arahan pelatihnya.' });
  }
  req.fullAthleteUser = (req.dbData.athleteUsers || []).find((u) => u.id === req.athleteUser.id);
  req.selfAccess = getAthleteAccess(req.fullAthleteUser);
  next();
}

function acwrBadge(acwr) {
  if (!acwr.eligible || acwr.acwr == null) return null;
  if (acwr.acwr < 0.8) return 'Undertraining';
  if (acwr.acwr <= 1.3) return 'Aman';
  if (acwr.acwr <= 1.5) return 'Waspada';
  return 'Risiko tinggi';
}

// Ringkasan beberapa baris saja — inilah yang membuat tiap panggilan AI murah.
function buildContext(athlete, data, user, now = new Date()) {
  const today = localDateKey(now);
  const prog = assembleProgram(athlete, data.tests, data.monitoringLogs, now);
  const dayName = DAY_NAMES[now.getDay()];
  const todaySessions = (prog.sessions || []).filter((s) => s.day && String(s.day).toLowerCase().includes(dayName));
  const logs = (data.monitoringLogs || []).filter((m) => m.athleteId === athlete.id)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const wellness = (data.wellnessLogs || []).find((w) => w.athleteId === athlete.id && w.date === today);
  const injuries = (data.injuryReports || []).filter((i) => i.athleteId === athlete.id && i.status !== 'resolved');
  const nutrition = computeNutritionPlan(athlete, data);
  const p = athlete.profile;
  return {
    nama: String((user && user.name) || p.nama || '').split(' ')[0],
    nomor: ai.eventLabel(p.event),
    level: p.level || null,
    usia: p.usia,
    fase: prog.phase && prog.phase.label,
    sisa_minggu_ke_target: prog.phase && prog.phase.remainingWeeks != null ? Math.round(prog.phase.remainingWeeks) : null,
    fokus_minggu: prog.weekPlan && prog.weekPlan.label,
    sesi_hari_ini: todaySessions.map(ai.sessionLine).join(' | ') || null,
    sesi_minggu_ini: (prog.sessions || []).map((s) => `${s.day || '-'}: ${s.name}`).join('; ') || null,
    readiness_hari_ini: wellness ? `${wellness.readiness}/10, tidur ${wellness.sleepQuality}/5` : null,
    latihan_terakhir: logs[0] ? `${logs[0].date}, RPE ${logs[0].rpe}, ${logs[0].durationMin} mnt` : null,
    status_beban: acwrBadge(computeACWR(logs)),
    nyeri: injuries.length ? injuries.map((i) => `${i.location} ${i.score}/10`).join(', ') : null,
    nutrisi: nutrition.available ? nutrition.ringkasanSingkat : null,
    alergi_pantangan: [p.alergiMakanan, p.pantanganMakanan].filter((x) => x && x.toLowerCase() !== 'tidak ada').join(', ') || null,
  };
}

// GET /api/athlete/ai/daily — catatan pelatih hari ini (1 panggilan AI/atlet/hari)
router.get('/daily', requireAthlete, requireActiveLink, requireSelfCoached, async (req, res) => {
  const athlete = req.linkedAthlete;
  const today = localDateKey(new Date());
  const cached = athlete.aiDaily;
  if (cached && cached.date === today && (cached.source === 'ai' || !ai.aiEnabled())) {
    return res.json({ ...cached, cached: true });
  }
  const ctx = buildContext(athlete, req.dbData, req.fullAthleteUser);
  const note = await ai.dailyNote(ctx);

  // Muat ulang sebelum menulis — panggilan AI butuh beberapa detik, jangan
  // menimpa perubahan lain yang terjadi selama menunggu.
  const fresh = db.load();
  const target = fresh.athletes.find((a) => a.id === athlete.id);
  const entry = { date: today, text: note.text, source: note.source, generatedAt: new Date().toISOString() };
  if (target) {
    target.aiDaily = entry;
    db.save(fresh);
  }
  res.json({ ...entry, cached: false });
});

// GET /api/athlete/ai/ask — kuota & riwayat singkat
router.get('/ask', requireAthlete, requireActiveLink, requireSelfCoached, (req, res) => {
  const user = req.fullAthleteUser || {};
  const today = localDateKey(new Date());
  const used = user.aiUsage && user.aiUsage.date === today ? user.aiUsage.count : 0;
  const quota = askQuota(req.selfAccess);
  res.json({ quota, used, remaining: Math.max(0, quota - used), premium: !!req.selfAccess.premium, aiEnabled: ai.aiEnabled(), history: user.aiHistory || [] });
});

// POST /api/athlete/ai/ask — { question }
router.post('/ask', requireAthlete, requireActiveLink, requireSelfCoached, async (req, res) => {
  const question = String((req.body && req.body.question) || '').trim();
  if (question.length < 5) return res.status(400).json({ error: 'Tulis pertanyaan minimal 5 karakter' });
  if (question.length > 300) return res.status(400).json({ error: 'Pertanyaan maksimal 300 karakter' });

  const today = localDateKey(new Date());
  const user = req.fullAthleteUser;
  const used = user.aiUsage && user.aiUsage.date === today ? user.aiUsage.count : 0;
  const quota = askQuota(req.selfAccess);
  if (used >= quota) {
    return res.status(429).json({
      error: req.selfAccess.premium
        ? `Kuota Tanya Coach hari ini (${quota} pertanyaan) sudah habis. Coba lagi besok.`
        : `Paket gratis dapat ${quota} pertanyaan per hari. Upgrade ke Premium untuk bertanya lebih banyak.`,
      quota, used, premium: !!req.selfAccess.premium,
    });
  }

  const ctx = buildContext(req.linkedAthlete, req.dbData, user);
  const answer = await ai.answerQuestion(ctx, question);

  const fresh = db.load();
  const u = (fresh.athleteUsers || []).find((x) => x.id === user.id);
  let usedNow = used;
  if (u) {
    // Kuota hanya berkurang bila AI benar-benar menjawab.
    if (answer.source === 'ai') {
      usedNow = (u.aiUsage && u.aiUsage.date === today ? u.aiUsage.count : 0) + 1;
      u.aiUsage = { date: today, count: usedNow };
    }
    const entry = { q: question, a: answer.text, source: answer.source, at: new Date().toISOString() };
    u.aiHistory = [entry, ...(u.aiHistory || [])].slice(0, HISTORY_MAX);
    db.save(fresh);
  }
  res.json({ answer: answer.text, source: answer.source, quota, used: usedNow, remaining: Math.max(0, quota - usedNow) });
});

module.exports = router;
