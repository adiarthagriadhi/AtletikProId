const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getAccessStatus, extendMonthlySubscription, extendAnnualSubscription, revokePaidMembership } = require('../lib/access');

const router = express.Router();

// GET /api/admin/coaches — daftar semua pelatih (khusus admin)
router.get('/coaches', requireAuth, requireAdmin, (req, res) => {
  const data = db.load();
  const coaches = data.users
    .filter((u) => u.role === 'coach')
    .map((u) => {
      const athleteCount = data.athletes.filter((a) => a.coachId === u.id).length;
      const access = getAccessStatus(u, athleteCount);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        trialStartedAt: u.trialStartedAt,
        hasLifetimeAccess: false,
        billingPlan: u.billingPlan || (u.access && u.access.plan) || null,
        subscriptionEndsAt: u.subscriptionEndsAt || null,
        athleteCount,
        access,
      };
    });
  res.json(coaches);
});

// POST /api/admin/coaches/:id/membership — grant monthly | annual | none
router.post('/coaches/:id/membership', requireAuth, requireAdmin, (req, res) => {
  const data = db.load();
  const user = data.users.find((u) => u.id === Number(req.params.id) && u.role === 'coach');
  if (!user) return res.status(404).json({ error: 'Pelatih tidak ditemukan' });

  let plan = String((req.body && req.body.plan) || '').toLowerCase();
  if (plan === 'lifetime') plan = 'annual';
  if (!['monthly', 'annual', 'none', 'revoke'].includes(plan)) {
    return res.status(400).json({ error: 'Paket tidak valid. Pilih monthly, annual, atau none.' });
  }

  user.hasLifetimeAccess = false;
  if (!user.trialStartedAt) {
    user.trialStartedAt = user.createdAt || new Date().toISOString();
  }

  if (plan === 'monthly') {
    extendMonthlySubscription(user);
  } else if (plan === 'annual') {
    extendAnnualSubscription(user);
  } else {
    revokePaidMembership(user);
  }
  db.save(data);

  const athleteCount = data.athletes.filter((a) => a.coachId === user.id).length;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    billingPlan: user.billingPlan || null,
    subscriptionEndsAt: user.subscriptionEndsAt || null,
    access: getAccessStatus(user, athleteCount),
  });
});

// Alias lama: grant lifetime = grant annual
router.post('/coaches/:id/lifetime', requireAuth, requireAdmin, (req, res) => {
  const data = db.load();
  const user = data.users.find((u) => u.id === Number(req.params.id) && u.role === 'coach');
  if (!user) return res.status(404).json({ error: 'Pelatih tidak ditemukan' });
  const grant = !(req.body && req.body.grant === false);
  user.hasLifetimeAccess = false;
  if (grant) extendAnnualSubscription(user);
  else revokePaidMembership(user);
  db.save(data);
  const athleteCount = data.athletes.filter((a) => a.coachId === user.id).length;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    billingPlan: user.billingPlan || null,
    subscriptionEndsAt: user.subscriptionEndsAt || null,
    access: getAccessStatus(user, athleteCount),
  });
});


// POST /api/admin/coaches/:id/reset-password — admin set password sementara
router.post('/coaches/:id/reset-password', requireAuth, requireAdmin, (req, res) => {
  const data = db.load();
  const user = data.users.find((u) => u.id === Number(req.params.id) && u.role === 'coach');
  if (!user) return res.status(404).json({ error: 'Pelatih tidak ditemukan' });
  let password = (req.body && req.body.password) ? String(req.body.password) : '';
  if (!password) {
    const crypto = require('crypto');
    password = crypto.randomBytes(4).toString('hex') + 'A1';
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  }
  const bcrypt = require('bcryptjs');
  user.passwordHash = bcrypt.hashSync(password, 10);
  user.resetTokenHash = null;
  user.resetTokenExpires = null;
  db.save(data);
  res.json({ ok: true, temporaryPassword: password, email: user.email, message: 'Password sementara dibuat. Berikan ke pelatih dan minta segera diganti.' });
});

module.exports = router;

