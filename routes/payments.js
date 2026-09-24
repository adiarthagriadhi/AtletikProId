const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getAccessStatus, extendMonthlySubscription, extendAnnualSubscription } = require('../lib/access');
const payments = require('../lib/payments');
const { requireAthlete, getActiveLink } = require('../middleware/athleteAuth');
const { requireSameOrigin } = require('../middleware/sameOrigin');
const { getAthleteAccess, extendAthleteSubscription } = require('../lib/athleteAccess');

const router = express.Router();

router.get('/config', (req, res) => {
  res.json({
    configured: payments.isConfigured(),
    isProduction: payments.isProduction(),
    clientKey: payments.isConfigured() ? payments.getClientKey() : null,
    plans: payments.listPlansPublic(),
    priceIdr: payments.getPriceIdr('annual'),
    productName: 'Paket Tahunan',
    currency: 'IDR',
    athletePlans: payments.listAthletePlansPublic(),
  });
});

router.post('/create-snap', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(400).json({ error: 'Akun admin tidak perlu membeli paket.' });
    }

    const planId = payments.normalizePlanId(String((req.body && req.body.plan) || 'annual'));
    if (!payments.getPlan(planId)) {
      return res.status(400).json({ error: 'Paket tidak valid. Pilih "monthly" atau "annual".' });
    }

    if (!payments.isConfigured()) {
      return res.status(503).json({
        error: 'Pembayaran belum dikonfigurasi. Set MIDTRANS_SERVER_KEY & MIDTRANS_CLIENT_KEY.',
      });
    }

    const data = db.load();
    const user = data.users.find((u) => u.id === req.user.id);
    if (!user) return res.status(401).json({ error: 'Akun tidak ditemukan' });

    const amount = payments.getPriceIdr(planId);
    const orderId = payments.makeOrderId(user.id, planId);

    if (!data.payments) data.payments = [];
    const record = {
      id: db.nextId(data, 'payments'),
      orderId,
      userId: user.id,
      planId,
      amount,
      status: 'pending',
      transactionStatus: null,
      paymentType: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paidAt: null,
    };
    data.payments.push(record);
    db.save(data);

    const snap = await payments.createSnapToken({
      orderId,
      amount,
      planId,
      customer: { name: user.name, email: user.email },
    });

    res.json({
      orderId,
      planId,
      token: snap.token,
      redirectUrl: snap.redirectUrl,
      amount,
      clientKey: payments.getClientKey(),
      isProduction: payments.isProduction(),
    });
  } catch (err) {
    console.error('[payments/create-snap]', err.message || err);
    res.status(500).json({
      error: err.code === 'NOT_CONFIGURED'
        ? err.message
        : 'Gagal membuat sesi pembayaran. Coba lagi atau hubungi admin.',
    });
  }
});

router.get('/my-status', requireAuth, (req, res) => {
  const data = db.load();
  const list = (data.payments || [])
    .filter((p) => p.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const latest = list[0] || null;
  const user = data.users.find((u) => u.id === req.user.id);
  const athleteCount = data.athletes.filter((a) => a.coachId === req.user.id).length;
  res.json({
    latest,
    access: user ? getAccessStatus(user, athleteCount) : null,
    hasLifetimeAccess: false,
    subscriptionEndsAt: user ? user.subscriptionEndsAt || null : null,
  });
});

// POST /api/payments/athlete/create-snap — Premium untuk atlet mandiri
router.post('/athlete/create-snap', requireSameOrigin, requireAthlete, async (req, res) => {
  try {
    const planId = String((req.body && req.body.plan) || 'monthly');
    const plan = payments.getAthletePlan(planId);
    if (!plan) return res.status(400).json({ error: 'Paket tidak valid. Pilih "monthly" atau "annual".' });
    if (!payments.isConfigured()) {
      return res.status(503).json({ error: 'Pembayaran belum dikonfigurasi. Hubungi admin.' });
    }

    const data = db.load();
    const user = (data.athleteUsers || []).find((u) => u.id === req.athleteUser.id);
    if (!user) return res.status(401).json({ error: 'Akun atlet tidak ditemukan' });
    const link = getActiveLink(data, user.id);
    if (link && !link.selfCoached) {
      return res.status(400).json({ error: 'Akun Anda terhubung ke pelatih — akses program diatur oleh pelatih.' });
    }

    const amount = payments.getAthletePriceIdr(planId);
    const orderId = payments.makeAthleteOrderId(user.id, planId);
    if (!data.payments) data.payments = [];
    data.payments.push({
      id: db.nextId(data, 'payments'),
      orderId,
      accountType: 'athlete',
      userId: null,
      athleteUserId: user.id,
      planId,
      amount,
      status: 'pending',
      transactionStatus: null,
      paymentType: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paidAt: null,
    });
    db.save(data);

    const snap = await payments.createSnapToken({
      orderId,
      amount,
      planId,
      item: plan,
      finishPath: '/athlete',
      customer: { name: user.name, email: user.email },
    });
    res.json({
      orderId,
      planId,
      token: snap.token,
      redirectUrl: snap.redirectUrl,
      amount,
      clientKey: payments.getClientKey(),
      isProduction: payments.isProduction(),
    });
  } catch (err) {
    console.error('[payments/athlete/create-snap]', err.message || err);
    res.status(500).json({
      error: err.code === 'NOT_CONFIGURED' ? err.message : 'Gagal membuat sesi pembayaran. Coba lagi atau hubungi admin.',
    });
  }
});

// GET /api/payments/athlete/my-status — dipakai portal atlet setelah bayar
router.get('/athlete/my-status', requireAthlete, (req, res) => {
  const data = db.load();
  const user = (data.athleteUsers || []).find((u) => u.id === req.athleteUser.id);
  const latest = (data.payments || [])
    .filter((p) => p.accountType === 'athlete' && p.athleteUserId === req.athleteUser.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  res.json({ latest, access: getAthleteAccess(user) });
});

function handleAthleteNotification(data, record, parsed, notification) {
  const transactionStatus = String(notification.transaction_status || '');
  const fraudStatus = notification.fraud_status ? String(notification.fraud_status) : null;
  if (!record) {
    record = {
      id: db.nextId(data, 'payments'),
      orderId: String(notification.order_id || ''),
      accountType: 'athlete',
      userId: null,
      athleteUserId: parsed.athleteUserId,
      planId: parsed.planId,
      amount: Number(notification.gross_amount) || payments.getAthletePriceIdr(parsed.planId),
      status: 'pending',
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    data.payments.push(record);
  }
  const alreadyPaid = record.status === 'paid';
  record.transactionStatus = transactionStatus;
  record.paymentType = notification.payment_type || null;
  record.updatedAt = new Date().toISOString();
  if (notification.transaction_id) record.transactionId = notification.transaction_id;

  if (payments.isSuccessfulStatus(transactionStatus, fraudStatus)) {
    if (!alreadyPaid) {
      const paidAmount = Number(notification.gross_amount);
      const expected = payments.getAthletePriceIdr(record.planId);
      if (Number.isFinite(paidAmount) && paidAmount + 0.01 < expected) {
        console.warn('[payments/notification] amount mismatch (athlete)', record.orderId, paidAmount, expected);
        record.status = 'amount_mismatch';
      } else {
        record.status = 'paid';
        record.paidAt = new Date().toISOString();
        const user = (data.athleteUsers || []).find((u) => u.id === record.athleteUserId);
        const plan = payments.getAthletePlan(record.planId);
        if (user && plan) {
          extendAthleteSubscription(user, plan.id, plan.durationDays);
          console.log('[payments] Premium atlet ' + plan.id + ' → athleteUser ' + user.id + ' via ' + record.orderId);
        }
      }
    }
  } else if (payments.isFailureStatus(transactionStatus)) {
    if (!alreadyPaid) record.status = transactionStatus;
  } else if (payments.isPendingStatus(transactionStatus)) {
    if (!alreadyPaid) record.status = 'pending';
  }
}

function grantAccessFromPayment(user, planId) {
  user.hasLifetimeAccess = false;
  if (planId === 'monthly') {
    extendMonthlySubscription(user);
  } else {
    extendAnnualSubscription(user);
  }
}

router.post('/notification', async (req, res) => {
  try {
    const notification = req.body || {};
    if (!payments.verifyNotificationSignature(notification)) {
      console.warn('[payments/notification] signature invalid', notification.order_id);
      return res.status(403).json({ error: 'Invalid signature' });
    }

    const orderId = String(notification.order_id || '');
    const transactionStatus = String(notification.transaction_status || '');
    const fraudStatus = notification.fraud_status ? String(notification.fraud_status) : null;
    const paymentType = notification.payment_type || null;
    const parsed = payments.parseOrderId(orderId);

    const data = db.load();
    if (!data.payments) data.payments = [];
    let record = data.payments.find((p) => p.orderId === orderId);

    if ((record && record.accountType === 'athlete') || (!record && parsed.accountType === 'athlete')) {
      handleAthleteNotification(data, record, parsed, notification);
      db.save(data);
      return res.json({ ok: true });
    }

    let userId = record ? record.userId : parsed.userId;
    let planId = payments.normalizePlanId(record ? (record.planId || 'annual') : (parsed.planId || 'annual'));

    if (!record && userId) {
      record = {
        id: db.nextId(data, 'payments'),
        orderId,
        userId,
        planId,
        amount: Number(notification.gross_amount) || payments.getPriceIdr(planId),
        status: 'pending',
        transactionStatus: null,
        paymentType: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        paidAt: null,
      };
      data.payments.push(record);
    }

    if (!record) {
      console.warn('[payments/notification] order not found', orderId);
      return res.json({ ok: true, note: 'order not found' });
    }

    const alreadyPaid = record.status === 'paid';

    record.transactionStatus = transactionStatus;
    record.paymentType = paymentType;
    record.planId = planId;
    record.updatedAt = new Date().toISOString();
    if (notification.transaction_id) record.transactionId = notification.transaction_id;

    if (payments.isSuccessfulStatus(transactionStatus, fraudStatus)) {
      if (!alreadyPaid) {
        const paidAmount = Number(notification.gross_amount);
        const expected = payments.getPriceIdr(planId);
        if (Number.isFinite(paidAmount) && paidAmount + 0.01 < expected) {
          console.warn('[payments/notification] amount mismatch', orderId, paidAmount, expected);
          record.status = 'amount_mismatch';
          record.paidAt = null;
        } else {
          record.status = 'paid';
          record.paidAt = new Date().toISOString();
          const user = data.users.find((u) => u.id === record.userId);
          if (user) {
            grantAccessFromPayment(user, planId);
            console.log('[payments] Granted ' + planId + ' to user ' + user.id + ' via ' + orderId);
          }
        }
      }
    } else if (payments.isFailureStatus(transactionStatus)) {
      if (!alreadyPaid) record.status = transactionStatus;
    } else if (payments.isPendingStatus(transactionStatus)) {
      if (!alreadyPaid) record.status = 'pending';
    }

    db.save(data);
    res.json({ ok: true });
  } catch (err) {
    console.error('[payments/notification]', err);
    res.status(500).json({ error: 'Handler error' });
  }
});

module.exports = router;
