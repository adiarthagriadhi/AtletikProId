/**
 * Integrasi Midtrans Snap — paket Tahunan & Bulanan.
 *
 * Env:
 *   MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY
 *   MIDTRANS_IS_PRODUCTION=true|false
 *   LIFETIME_PRICE_IDR / ANNUAL_PRICE_IDR (default 299000) — paket tahunan
 *   MONTHLY_PRICE_IDR (default 49000)
 *   APP_PUBLIC_URL
 */

const https = require('https');
const crypto = require('crypto');

const PLANS = {
  annual: {
    id: 'annual',
    name: 'Paket Tahunan',
    itemName: 'Atletik Pro Id — Langganan 1 Tahun',
    defaultPrice: 299000,
    envKey: 'ANNUAL_PRICE_IDR',
    durationDays: 365,
  },
  monthly: {
    id: 'monthly',
    name: 'Langganan Bulanan',
    itemName: 'Atletik Pro Id — Langganan 30 Hari',
    defaultPrice: 49000,
    envKey: 'MONTHLY_PRICE_IDR',
    durationDays: 30,
  },
};

function normalizePlanId(planId) {
  if (planId === 'lifetime') return 'annual';
  return planId;
}

function isConfigured() {
  return !!(process.env.MIDTRANS_SERVER_KEY && process.env.MIDTRANS_CLIENT_KEY);
}

function isProduction() {
  return String(process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase() === 'true';
}

function getPlan(planId) {
  return PLANS[normalizePlanId(planId)] || null;
}

function getPriceIdr(planId) {
  const plan = getPlan(planId) || PLANS.annual;
  const keys = plan.id === 'annual'
    ? [process.env.ANNUAL_PRICE_IDR, process.env.LIFETIME_PRICE_IDR]
    : [process.env[plan.envKey]];
  for (const raw of keys) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1000) return Math.round(n);
  }
  return plan.defaultPrice;
}

/** @deprecated gunakan getPriceIdr('annual') */
function getPriceIdrLegacy() {
  return getPriceIdr('annual');
}

function getClientKey() {
  return process.env.MIDTRANS_CLIENT_KEY || '';
}

function listPlansPublic() {
  return Object.values(PLANS).map((p) => ({
    id: p.id,
    name: p.name,
    priceIdr: getPriceIdr(p.id),
    currency: 'IDR',
  }));
}

function snapHost() {
  return isProduction() ? 'app.midtrans.com' : 'app.sandbox.midtrans.com';
}

function apiHost() {
  return isProduction() ? 'api.midtrans.com' : 'api.sandbox.midtrans.com';
}

function authHeader() {
  const key = process.env.MIDTRANS_SERVER_KEY || '';
  return 'Basic ' + Buffer.from(key + ':').toString('base64');
}

function httpsJson({ method, hostname, path, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname,
        path,
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: authHeader(),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let data = null;
          try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = { raw }; }
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else {
            const err = new Error((data && (data.error_messages || data.status_message)) || `Midtrans HTTP ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.data = data;
            reject(err);
          }
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** order_id: ATPRO-{plan}-{userId}-{timestamp} */
function makeOrderId(userId, planId) {
  const p = planId === 'monthly' ? 'M' : 'A';
  return `ATPRO-${p}-${userId}-${Date.now()}`;
}

function parseOrderId(orderId) {
  // ATPRO-M-12-123456 atau ATPRO-L-12-123 atau legacy ATPRO-12-123
  let m = /^ATPRO-([MLA])-(\d+)-(\d+)$/.exec(String(orderId || ''));
  if (m) {
    return { planId: m[1] === 'M' ? 'monthly' : 'annual', userId: Number(m[2]) };
  }
  m = /^ATPRO-(\d+)-(\d+)$/.exec(String(orderId || ''));
  if (m) {
    return { planId: 'annual', userId: Number(m[1]) };
  }
  return { planId: null, userId: null };
}

async function createSnapToken({ orderId, amount, customer, planId }) {
  if (!isConfigured()) {
    const err = new Error('Pembayaran belum dikonfigurasi (MIDTRANS_SERVER_KEY / CLIENT_KEY).');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const plan = getPlan(planId) || PLANS.annual;
  const body = {
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    item_details: [
      {
        id: plan.id,
        price: amount,
        quantity: 1,
        name: plan.itemName,
      },
    ],
    customer_details: {
      first_name: (customer.name || 'Pelatih').slice(0, 50),
      email: customer.email || undefined,
    },
  };

  if (process.env.APP_PUBLIC_URL) {
    body.callbacks = {
      finish: `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/?bayar=selesai`,
    };
  }

  const data = await httpsJson({
    method: 'POST',
    hostname: snapHost(),
    path: '/snap/v1/transactions',
    body,
  });

  return {
    token: data.token,
    redirectUrl: data.redirect_url,
  };
}

function verifyNotificationSignature(notification) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  if (!serverKey) return false;
  const orderId = String(notification.order_id || '');
  const statusCode = String(notification.status_code || '');
  const grossAmount = String(notification.gross_amount || '');
  const expected = crypto
    .createHash('sha512')
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest('hex');
  return expected === String(notification.signature_key || '');
}

function isSuccessfulStatus(transactionStatus, fraudStatus) {
  if (transactionStatus === 'settlement') return true;
  if (transactionStatus === 'capture' && (fraudStatus === 'accept' || !fraudStatus)) return true;
  return false;
}

function isPendingStatus(transactionStatus) {
  return transactionStatus === 'pending' || transactionStatus === 'capture';
}

function isFailureStatus(transactionStatus) {
  return ['deny', 'cancel', 'expire', 'failure'].includes(transactionStatus);
}

async function fetchTransactionStatus(orderId) {
  return httpsJson({
    method: 'GET',
    hostname: apiHost(),
    path: `/v2/${encodeURIComponent(orderId)}/status`,
  });
}

module.exports = {
  PLANS,
  normalizePlanId,
  isConfigured,
  isProduction,
  getPlan,
  getPriceIdr,
  getPriceIdrLegacy,
  getClientKey,
  listPlansPublic,
  makeOrderId,
  parseOrderId,
  createSnapToken,
  verifyNotificationSignature,
  isSuccessfulStatus,
  isPendingStatus,
  isFailureStatus,
  fetchTransactionStatus,
};
