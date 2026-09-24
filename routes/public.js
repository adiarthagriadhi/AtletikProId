// Endpoint publik (tanpa login) untuk landing / selling page.
const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { CATEGORIES } = require('../lib/categories');
const { LEVELS, ALERGI_OPTIONS, PANTANGAN_OPTIONS, TT_DISTANCES, MIN_SELF_AGE } = require('../lib/selfProfile');
const { buildTrialPreview } = require('../lib/trialPlan');
const { trialDays } = require('../lib/athleteAccess');
const payments = require('../lib/payments');
const ai = require('../lib/aiCoach');
const { smtpConfigured, sendTrialPlanEmail } = require('../lib/mailer');
const { createRateLimit } = require('../middleware/rateLimit');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EVENT_LABELS = {
  '100m': '100 m', '200m': '200 m', '400m': '400 m',
  '800m': '800 m', '1500m': '1500 m',
  '5000m': '5K', '10000m': '10K', half_marathon: 'Half marathon', marathon: 'Marathon',
  lompat_jauh: 'Lompat jauh', lompat_tinggi: 'Lompat tinggi',
};

const trialLimit = createRateLimit({ keyOf: (req) => req.ip, message: 'Terlalu banyak percobaan.', maxAttempts: 40 });
const insightLimit = createRateLimit({ keyOf: (req) => req.ip, message: 'Terlalu banyak permintaan analisis.', maxAttempts: 8 });
const emailLimit = createRateLimit({ keyOf: (req) => req.ip, message: 'Terlalu banyak permintaan email.', maxAttempts: 4 });

function publicBase(req) {
  if (process.env.APP_PUBLIC_URL) return process.env.APP_PUBLIC_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return `${proto}://${host}`;
}

// Hanya simpan field kuesioner yang dikenal (bukan objek bebas dari klien).
function cleanAnswers(a) {
  const src = a || {};
  const keys = ['kategori', 'event', 'level', 'targetMode', 'compDate', 'best100m', 'ttDistance', 'ttTime',
    'jenisKelamin', 'usia', 'tinggi', 'berat', 'alergiMakanan', 'pantanganMakanan'];
  const out = {};
  keys.forEach((k) => {
    if (src[k] === undefined || src[k] === null) return;
    out[k] = Array.isArray(src[k]) ? src[k].map((x) => String(x).slice(0, 60)).slice(0, 10) : String(src[k]).slice(0, 200);
  });
  return out;
}

// Statistik publik untuk landing page (hanya jumlah, tanpa data pribadi)
router.get('/stats', (req, res) => {
  try {
    const data = db.load();
    const coachCount = (data.users || []).filter((u) => u.role === 'coach').length;
    const athleteCount = (data.athletes || []).length;
    res.json({ coachCount, athleteCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat statistik' });
  }
});

// GET /api/public/quiz-options — pilihan untuk kuesioner & kartu harga
router.get('/quiz-options', (req, res) => {
  res.json({
    categories: Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, {
      label: c.label,
      events: c.events.map((e) => ({ id: e, label: EVENT_LABELS[e] || e })),
      needsBest100m: !!c.needsBest100m,
      needsTimeTrial: c.testProtocol === 'time_trial',
    }])),
    levels: Object.entries(LEVELS).map(([id, l]) => ({ id, label: l.label })),
    alergiOptions: ALERGI_OPTIONS,
    pantanganOptions: PANTANGAN_OPTIONS,
    ttDistances: TT_DISTANCES,
    minAge: MIN_SELF_AGE,
    trialDays: trialDays(),
    plans: payments.listAthletePlansPublic(),
    aiEnabled: ai.aiEnabled(),
    emailEnabled: smtpConfigured(),
  });
});

// POST /api/public/trial-plan — pratinjau program & nutrisi dari jawaban kuesioner
router.post('/trial-plan', trialLimit, (req, res) => {
  const result = buildTrialPreview(cleanAnswers(req.body && req.body.answers));
  if (!result.ok) return res.status(400).json({ error: result.errors.join('; ') });
  res.json(result.preview);
});

// POST /api/public/trial-insight — analisis singkat Coach AI untuk hasil kuesioner
router.post('/trial-insight', insightLimit, async (req, res) => {
  const answers = cleanAnswers(req.body && req.body.answers);
  const result = buildTrialPreview(answers);
  if (!result.ok) return res.status(400).json({ error: result.errors.join('; ') });
  const insight = await ai.quizInsight(result.preview, answers);
  res.json(insight);
});

// POST /api/public/trial-email — kirim hasil program ke email + simpan sebagai lead
router.post('/trial-email', emailLimit, async (req, res) => {
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim().slice(0, 100);
  if (!EMAIL_RE.test(email) || email.length > 200) return res.status(400).json({ error: 'Email tidak valid' });
  if (!smtpConfigured()) return res.status(503).json({ error: 'Pengiriman email belum aktif. Silakan buat akun gratis untuk menyimpan program.' });

  const answers = cleanAnswers(body.answers);
  const result = buildTrialPreview(answers);
  if (!result.ok) return res.status(400).json({ error: result.errors.join('; ') });

  const data = db.load();
  data.leads = data.leads || [];
  let lead = data.leads.find((l) => l.email === email);
  const now = new Date();
  if (lead && lead.lastSentAt && now - new Date(lead.lastSentAt) < 2 * 60 * 1000) {
    return res.status(429).json({ error: 'Email baru saja dikirim. Cek kotak masuk (atau folder spam) Anda.' });
  }
  if (!lead) {
    lead = { id: db.nextId(data, 'leads'), email, createdAt: now.toISOString(), sendCount: 0 };
    data.leads.push(lead);
  }
  lead.name = name || lead.name || null;
  lead.answers = answers;
  lead.event = result.preview.event;
  lead.token = crypto.randomBytes(18).toString('hex');
  lead.consentMarketing = body.consentMarketing === true;
  lead.lastSentAt = now.toISOString();
  lead.sendCount = (lead.sendCount || 0) + 1;
  lead.source = 'selling-page';

  const planUrl = `${publicBase(req)}/?program=${lead.token}`;
  try {
    await sendTrialPlanEmail({
      to: email,
      name: lead.name,
      preview: result.preview,
      planUrl,
      eventLabel: EVENT_LABELS[result.preview.event] || result.preview.event,
    });
  } catch (err) {
    console.error('[trial-email] SMTP gagal:', err && err.message ? err.message : err);
    return res.status(502).json({ error: 'Email gagal dikirim. Coba lagi beberapa saat lagi.' });
  }
  db.save(data);
  res.json({ ok: true, message: `Program terkirim ke ${email}. Cek kotak masuk atau folder spam.` });
});

// GET /api/public/trial-lead/:token — buka lagi hasil dari tautan di email
router.get('/trial-lead/:token', (req, res) => {
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{36}$/.test(token)) return res.status(404).json({ error: 'Tautan tidak valid' });
  const data = db.load();
  const lead = (data.leads || []).find((l) => l.token === token);
  if (!lead) return res.status(404).json({ error: 'Tautan tidak ditemukan atau sudah diganti' });
  res.json({ answers: lead.answers || {}, name: lead.name || null, email: lead.email });
});

module.exports = router;
