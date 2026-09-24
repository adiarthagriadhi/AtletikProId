const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ATHLETE_SECRET = process.env.JWT_ATHLETE_SECRET || (JWT_SECRET ? JWT_SECRET + ':athlete' : JWT_SECRET);
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function issueAthleteToken(res, athleteUser) {
  const payload = { id: athleteUser.id, email: athleteUser.email, role: 'athlete', aud: 'athlete' };
  const token = jwt.sign(payload, JWT_ATHLETE_SECRET, { expiresIn: '30d' });
  res.cookie('athlete_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TOKEN_MAX_AGE_MS,
  });
}

function clearAthleteToken(res) {
  res.clearCookie('athlete_token', { path: '/' });
}

function requireAthlete(req, res, next) {
  const token = req.cookies && req.cookies.athlete_token;
  if (!token) return res.status(401).json({ error: 'Belum login (atlet)' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_ATHLETE_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Sesi atlet tidak valid atau kedaluwarsa' });
  }
  if (payload.role !== 'athlete' || (payload.aud && payload.aud !== 'athlete')) {
    return res.status(403).json({ error: 'Khusus akun atlet' });
  }
  const data = db.load();
  const user = (data.athleteUsers || []).find((u) => u.id === payload.id);
  if (!user) {
    clearAthleteToken(res);
    return res.status(401).json({ error: 'Akun atlet tidak ditemukan' });
  }
  req.athleteUser = { id: user.id, name: user.name, email: user.email, role: 'athlete' };
  next();
}

/** Ambil link aktif pertama (v1: satu profil aktif). */
function getActiveLink(data, athleteUserId) {
  return (data.athleteLinks || []).find(
    (l) => l.athleteUserId === athleteUserId && l.status === 'active'
  ) || null;
}

function requireActiveLink(req, res, next) {
  const data = db.load();
  const link = getActiveLink(data, req.athleteUser.id);
  if (!link) {
    return res.status(403).json({ error: 'Belum terhubung ke profil atlet. Masukkan kode undangan pelatih.' });
  }
  const athlete = data.athletes.find((a) => a.id === link.athleteId);
  if (!athlete) {
    return res.status(404).json({ error: 'Profil atlet tidak ditemukan' });
  }
  req.athleteLink = link;
  req.linkedAthlete = athlete;
  req.dbData = data;
  next();
}

module.exports = {
  issueAthleteToken,
  clearAthleteToken,
  requireAthlete,
  getActiveLink,
  requireActiveLink,
};
