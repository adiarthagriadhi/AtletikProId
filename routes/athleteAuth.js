const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const {
  issueAthleteToken,
  clearAthleteToken,
  requireAthlete,
  getActiveLink,
} = require('../middleware/athleteAuth');
const { loginRateLimit, registerRateLimit, inviteRateLimit } = require('../middleware/rateLimit');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

router.post('/register', registerRateLimit, (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanEmail = normalizeEmail(email);
  const cleanName = String(name || '').trim();
  if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
    return res.status(400).json({ error: 'Nama wajib diisi (2-100 karakter)' });
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: 'Email tidak valid' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  }
  const data = db.load();
  if ((data.athleteUsers || []).some((u) => u.email === cleanEmail)) {
    return res.status(409).json({ error: 'Email sudah terdaftar sebagai atlet' });
  }
  const user = {
    id: db.nextId(data, 'athleteUsers'),
    name: cleanName,
    email: cleanEmail,
    passwordHash: bcrypt.hashSync(String(password), 10),
    createdAt: new Date().toISOString(),
  };
  data.athleteUsers = data.athleteUsers || [];
  data.athleteUsers.push(user);
  db.save(data);
  issueAthleteToken(res, user);
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: 'athlete' });
});

router.post('/login', loginRateLimit, (req, res) => {
  const cleanEmail = normalizeEmail((req.body || {}).email);
  const password = String((req.body || {}).password || '');
  const data = db.load();
  const user = (data.athleteUsers || []).find((u) => u.email === cleanEmail);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Email atau password salah' });
  }
  issueAthleteToken(res, user);
  res.json({ id: user.id, name: user.name, email: user.email, role: 'athlete' });
});

router.post('/logout', (req, res) => {
  clearAthleteToken(res);
  res.json({ ok: true });
});

router.get('/me', requireAthlete, (req, res) => {
  const data = db.load();
  const link = getActiveLink(data, req.athleteUser.id);
  let athleteSummary = null;
  if (link) {
    const a = data.athletes.find((x) => x.id === link.athleteId);
    if (a) {
      athleteSummary = {
        id: a.id,
        name: a.profile && a.profile.nama,
        kategori: a.profile && a.profile.kategori,
        event: a.profile && a.profile.event,
        programAccess: link.programAccess || 'reminding',
      };
    }
  }
  res.json({
    ...req.athleteUser,
    link: link
      ? {
          id: link.id,
          athleteId: link.athleteId,
          coachId: link.coachId,
          programAccess: link.programAccess || 'reminding',
          status: link.status,
        }
      : null,
    athlete: athleteSummary,
  });
});

/** Terima kode undangan pelatih */
router.post('/accept-invite', requireAthlete, inviteRateLimit, (req, res) => {
  const code = String((req.body || {}).code || '').trim().toUpperCase();
  if (!code || code.length < 4) {
    return res.status(400).json({ error: 'Kode undangan tidak valid' });
  }
  const data = db.load();
  const link = (data.athleteLinks || []).find(
    (l) => l.inviteCode === code && l.status === 'pending'
  );
  if (!link) {
    return res.status(404).json({ error: 'Kode undangan tidak ditemukan atau sudah dipakai' });
  }
  // Satu akun atlet = satu profil; satu profil = satu tautan aktif.
  (data.athleteLinks || []).forEach((l) => {
    if (l.id === link.id) return;
    if (l.athleteUserId === req.athleteUser.id && l.status === 'active') {
      l.status = 'revoked';
    }
    if (l.athleteId === link.athleteId && (l.status === 'active' || l.status === 'pending')) {
      l.status = 'revoked';
    }
  });
  link.status = 'active';
  link.athleteUserId = req.athleteUser.id;
  link.acceptedAt = new Date().toISOString();
  link.inviteCode = null; // one-time
  db.save(data);
  const athlete = data.athletes.find((a) => a.id === link.athleteId);
  res.json({
    ok: true,
    athleteId: link.athleteId,
    athleteName: athlete && athlete.profile ? athlete.profile.nama : null,
    programAccess: link.programAccess || 'reminding',
  });
});

module.exports = router;
