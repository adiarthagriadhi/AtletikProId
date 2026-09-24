const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

function issueToken(res, user) {
  const role = user.role === 'admin' ? 'admin' : 'coach';
  const payload = { id: user.id, name: user.name, email: user.email, role, aud: 'coach' };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TOKEN_MAX_AGE_MS,
  });
}

function clearToken(res) {
  res.clearCookie('token', { path: '/' });
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Belum login' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Sesi tidak valid atau kedaluwarsa, silakan login kembali' });
  }

  // Token portal atlet tidak boleh dipakai sebagai sesi pelatih
  // (JWT_SECRET dulu dipakai bersama; id numerik users vs athleteUsers bisa tabrakan).
  if (payload.aud === 'athlete' || payload.role === 'athlete') {
    clearToken(res);
    return res.status(401).json({ error: 'Sesi tidak valid atau kedaluwarsa, silakan login kembali' });
  }
  if (payload.role && payload.role !== 'coach' && payload.role !== 'admin') {
    clearToken(res);
    return res.status(403).json({ error: 'Jenis akun tidak diizinkan' });
  }

  // Verifikasi ulang akun masih ada di database — bukan cuma percaya isi JWT.
  // Kalau akun sudah dihapus (mis. oleh admin) setelah token diterbitkan,
  // sesi lama tidak boleh tetap bisa dipakai sampai tokennya kedaluwarsa sendiri.
  const data = db.load();
  const user = data.users.find((u) => u.id === payload.id);
  if (!user) {
    clearToken(res);
    return res.status(401).json({ error: 'Akun tidak ditemukan, silakan login kembali' });
  }

  // Sertakan field akses agar route bisa cek trial/lifetime tanpa load ulang
  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    trialStartedAt: user.trialStartedAt || null,
    hasLifetimeAccess: !!user.hasLifetimeAccess,
    subscriptionEndsAt: user.subscriptionEndsAt || null,
    createdAt: user.createdAt || null,
  };
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Khusus admin' });
  }
  next();
}

module.exports = { issueToken, clearToken, requireAuth, requireAdmin };
