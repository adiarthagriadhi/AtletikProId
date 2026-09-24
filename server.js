require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET wajib diset di .env sebelum server dijalankan.');
  process.exit(1);
}

const store = require('./db');

const authRoutes = require('./routes/auth');
const athletesRoutes = require('./routes/athletes');
const testsRoutes = require('./routes/tests');
const programRoutes = require('./routes/program');
const monitoringRoutes = require('./routes/monitoring');
const nutritionRoutes = require('./routes/nutrition');
const adminRoutes = require('./routes/admin');
const paymentsRoutes = require('./routes/payments');
const athleteAuthRoutes = require('./routes/athleteAuth');
const athleteAppRoutes = require('./routes/athleteApp');
const sessionOverridesRoutes = require('./routes/sessionOverrides');

const app = express();

// Di balik Nginx/Hostinger, req.ip harus ambil dari X-Forwarded-For
// supaya rate limit tidak mengunci seluruh pengunjung di IP proxy.
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CSP: izinkan Snap.js Midtrans (sandbox + production) agar popup bayar bisa jalan.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": [
        "'self'",
        "https://app.sandbox.midtrans.com",
        "https://app.midtrans.com",
      ],
      "frame-src": [
        "'self'",
        "https://app.sandbox.midtrans.com",
        "https://app.midtrans.com",
      ],
      "connect-src": [
        "'self'",
        "https://app.sandbox.midtrans.com",
        "https://app.midtrans.com",
        "https://api.sandbox.midtrans.com",
        "https://api.midtrans.com",
      ],
      "img-src": ["'self'", "data:", "https:"],
    },
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const { requireSameOrigin } = require('./middleware/sameOrigin');
app.use('/api/auth', requireSameOrigin);
app.use('/api/athletes', requireSameOrigin);
app.use('/api/admin', requireSameOrigin);
app.use('/api/athlete', requireSameOrigin);

app.use('/api/auth', authRoutes);
app.use('/api/athletes', athletesRoutes);
app.use('/api/athletes', testsRoutes);
app.use('/api/athletes', programRoutes);
app.use('/api/athletes', monitoringRoutes);
app.use('/api/athletes', nutritionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/athlete/auth', athleteAuthRoutes);
app.use('/api/athlete', athleteAppRoutes);
app.use('/api/athletes/:athleteId', sessionOverridesRoutes);
// Alias param :id (beberapa proxy/router Hostinger lebih stabil dengan pola ini)
app.use('/api/athletes/:id', sessionOverridesRoutes);

const { load: loadDb } = require('./db');

// Statistik publik untuk landing page (hanya jumlah, tanpa data pribadi)
app.get('/api/public/stats', (req, res) => {
  try {
    const data = loadDb();
    const coachCount = (data.users || []).filter((u) => u.role === 'coach').length;
    const athleteCount = (data.athletes || []).length;
    res.json({ coachCount, athleteCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat statistik' });
  }
});

app.get(['/athlete', '/athlete.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'athlete.html'));
});

app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

const PORT = process.env.PORT || 3000;
store.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Atletik Pro Id berjalan di port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[db] gagal start:', err);
    process.exit(1);
  });
