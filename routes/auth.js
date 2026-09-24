const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { issueToken, clearToken, requireAuth } = require('../middleware/auth');
const { loginRateLimit, registerRateLimit, adminSetupRateLimit, forgotPasswordRateLimit, resetPasswordRateLimit } = require('../middleware/rateLimit');
const { getAccessStatus } = require('../lib/access');
const { smtpConfigured, sendResetPasswordEmail } = require('../lib/mailer');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX_LENGTH = 100;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(user, data) {
  const athleteCount = data
    ? data.athletes.filter((a) => a.coachId === user.id).length
    : 0;
  const access = getAccessStatus(user, athleteCount);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    access,
  };
}

router.post('/register', registerRateLimit, (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanEmail = normalizeEmail(email);
  const cleanName = String(name || '').trim();

  if (!cleanName || cleanName.length < 2 || cleanName.length > NAME_MAX_LENGTH) {
    return res.status(400).json({ error: `Nama wajib diisi (2-${NAME_MAX_LENGTH} karakter)` });
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: 'Email tidak valid' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  }

  const data = db.load();
  if (data.users.some((u) => u.email === cleanEmail)) {
    return res.status(409).json({ error: 'Email sudah terdaftar' });
  }

  const user = {
    id: db.nextId(data, 'users'),
    name: cleanName,
    email: cleanEmail,
    passwordHash: bcrypt.hashSync(String(password), 10),
    role: 'coach',
    createdAt: new Date().toISOString(),
    trialStartedAt: new Date().toISOString(),
    hasLifetimeAccess: false,
  };
  data.users.push(user);
  db.save(data);

  issueToken(res, user);
  res.status(201).json(publicUser(user, data));
});

router.post('/login', loginRateLimit, (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = normalizeEmail(email);

  const data = db.load();
  const user = data.users.find((u) => u.email === cleanEmail);
  if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Email atau password salah' });
  }

  issueToken(res, user);
  res.json(publicUser(user, data));
});

router.post('/logout', (req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const data = db.load();
  const user = data.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(401).json({ error: 'Akun tidak ditemukan' });
  res.json(publicUser(user, data));
});

// Setup admin pertama kali — hanya jalan jika belum ada admin sama sekali,
// dan hanya jika ADMIN_SETUP_KEY diset di env & cocok dengan yang dikirim.
// Sekali admin dibuat, endpoint ini terkunci selamanya (siapapun request-nya).
router.post('/admin-setup', adminSetupRateLimit, (req, res) => {
  const setupKeyEnv = process.env.ADMIN_SETUP_KEY;
  if (!setupKeyEnv) {
    return res.status(403).json({ error: 'Setup admin tidak aktif' });
  }

  const data = db.load();
  if (data.users.some((u) => u.role === 'admin')) {
    return res.status(403).json({ error: 'Admin sudah pernah dibuat. Setup ini terkunci.' });
  }

  const { name, email, password, setupKey } = req.body || {};
  if (setupKey !== setupKeyEnv) {
    return res.status(403).json({ error: 'Kode setup salah' });
  }

  const cleanEmail = normalizeEmail(email);
  const cleanName = String(name || '').trim();
  if (!cleanName || cleanName.length < 2 || cleanName.length > NAME_MAX_LENGTH) {
    return res.status(400).json({ error: `Nama wajib diisi (2-${NAME_MAX_LENGTH} karakter)` });
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: 'Email tidak valid' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  }
  if (data.users.some((u) => u.email === cleanEmail)) {
    return res.status(409).json({ error: 'Email sudah terdaftar' });
  }

  const admin = {
    id: db.nextId(data, 'users'),
    name: cleanName,
    email: cleanEmail,
    passwordHash: bcrypt.hashSync(String(password), 10),
    role: 'admin',
    createdAt: new Date().toISOString(),
    trialStartedAt: null,
    hasLifetimeAccess: true,
  };
  data.users.push(admin);
  db.save(data);

  issueToken(res, admin);
  res.status(201).json({ id: admin.id, name: admin.name, email: admin.email, role: admin.role });
});

const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function publicAppBase(req) {
  if (process.env.APP_PUBLIC_URL) return process.env.APP_PUBLIC_URL.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return `${proto}://${host}`;
}

// POST /api/auth/forgot-password — minta reset (selalu respons generik jika email tak ada)
router.post('/forgot-password', forgotPasswordRateLimit, async (req, res) => {
  const cleanEmail = normalizeEmail((req.body || {}).email);
  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: 'Email tidak valid' });
  }

  const data = db.load();
  const user = data.users.find((u) => u.email === cleanEmail);

  // Selalu pesan sukses agar email tidak bisa di-enumerate secara kasar
  const generic = {
    ok: true,
    message: 'Jika email terdaftar, tautan reset password telah disiapkan. Berlaku 1 jam.',
  };

  if (!user) {
    return res.json(generic);
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.resetTokenHash = hashToken(rawToken);
  user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.save(data);

  const resetUrl = `${publicAppBase(req)}/?reset=${rawToken}`;

  let mailed = false;
  if (smtpConfigured()) {
    try {
      const result = await sendResetPasswordEmail({
        to: cleanEmail,
        resetUrl,
        name: user.name,
      });
      mailed = !!(result && result.sent);
      if (mailed) console.log('[forgot-password] email sent to', cleanEmail);
    } catch (err) {
      console.error('[forgot-password] SMTP gagal:', err && err.message ? err.message : err);
    }
  }

  // Kalau email terkirim, jangan tampilkan tautan di API.
  // Production tanpa SMTP: tautan hanya di log, kecuali HIDE_RESET_LINK=false.
  const hideFlag = String(process.env.HIDE_RESET_LINK || '').toLowerCase();
  const hideLink = mailed
    || hideFlag === 'true'
    || hideFlag === '1'
    || ((hideFlag !== 'false' && hideFlag !== '0') && process.env.NODE_ENV === 'production');
  if (hideLink) {
    if (!mailed) console.log('[forgot-password] reset url for', cleanEmail, resetUrl);
    return res.json(generic);
  }

  return res.json({
    ...generic,
    resetUrl,
    expiresInMinutes: 60,
    note: 'Salin tautan di bawah untuk mengatur password baru. Jangan bagikan ke orang lain.',
  });
});

// POST /api/auth/reset-password — set password baru dengan token
router.post('/reset-password', resetPasswordRateLimit, (req, res) => {
  const { token, password } = req.body || {};
  if (!token || String(token).length < 20) {
    return res.status(400).json({ error: 'Token reset tidak valid' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password baru minimal 8 karakter' });
  }

  const data = db.load();
  const tokenHash = hashToken(token);
  const user = data.users.find(
    (u) => u.resetTokenHash && u.resetTokenHash === tokenHash
  );
  if (!user) {
    return res.status(400).json({ error: 'Token reset tidak valid atau sudah dipakai' });
  }
  if (!user.resetTokenExpires || new Date(user.resetTokenExpires) < new Date()) {
    user.resetTokenHash = null;
    user.resetTokenExpires = null;
    db.save(data);
    return res.status(400).json({ error: 'Token reset sudah kedaluwarsa. Ajukan lupa password lagi.' });
  }

  user.passwordHash = bcrypt.hashSync(String(password), 10);
  user.resetTokenHash = null;
  user.resetTokenExpires = null;
  db.save(data);

  res.json({ ok: true, message: 'Password berhasil diubah. Silakan masuk dengan password baru.' });
});

module.exports = router;
