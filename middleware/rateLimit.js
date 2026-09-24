const WINDOW_MS = 10 * 60 * 1000; // 10 menit
const MAX_ATTEMPTS = 10;

/**
 * Factory pembatas percobaan generik — tiap pemanggilan dapat Map sendiri
 * supaya limiter satu endpoint (mis. login) tidak ikut memakai jatah
 * limiter endpoint lain (mis. register).
 *
 * `keyOf(req)` menentukan identitas yang dibatasi. Untuk login dipakai
 * IP+email (supaya brute-force satu akun tidak mengunci pengguna lain di
 * jaringan/IP yang sama); untuk register & admin-setup cukup IP saja,
 * karena tujuannya membatasi laju pembuatan akun/tebak kode dari satu
 * sumber, bukan melindungi satu akun tertentu.
 */
function createRateLimit({ keyOf, message, maxAttempts, windowMs }) {
  const attempts = new Map();
  const max = maxAttempts || MAX_ATTEMPTS;
  const window = windowMs || WINDOW_MS;

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (now - entry.firstAttemptAt > window) attempts.delete(key);
    }
  }, window).unref();

  return function rateLimit(req, res, next) {
    const key = keyOf(req);
    const now = Date.now();
    let entry = attempts.get(key);

    if (!entry || now - entry.firstAttemptAt > window) {
      entry = { count: 0, firstAttemptAt: now };
      attempts.set(key, entry);
    }

    if (entry.count >= max) {
      const waitMs = window - (now - entry.firstAttemptAt);
      const waitMin = Math.ceil(waitMs / 60000);
      return res.status(429).json({ error: `${message} Coba lagi dalam ${waitMin} menit.` });
    }

    entry.count += 1;
    next();
  };
}

const loginRateLimit = createRateLimit({
  keyOf: (req) => `${req.ip}:${((req.body && req.body.email) || '').toLowerCase()}`,
  message: 'Terlalu banyak percobaan login.',
});

const registerRateLimit = createRateLimit({
  keyOf: (req) => req.ip,
  message: 'Terlalu banyak percobaan registrasi.',
});

const adminSetupRateLimit = createRateLimit({
  keyOf: (req) => req.ip,
  message: 'Terlalu banyak percobaan setup admin.',
});

const inviteRateLimit = createRateLimit({
  keyOf: (req) => req.ip,
  message: 'Terlalu banyak percobaan kode undangan.',
  maxAttempts: 8,
});

const forgotPasswordRateLimit = createRateLimit({
  keyOf: (req) => `${req.ip}:${((req.body && req.body.email) || '').toLowerCase()}`,
  message: 'Terlalu banyak permintaan reset password.',
  maxAttempts: 5,
});

const resetPasswordRateLimit = createRateLimit({
  keyOf: (req) => req.ip,
  message: 'Terlalu banyak percobaan reset password.',
  maxAttempts: 8,
});

module.exports = {
  createRateLimit,
  loginRateLimit,
  registerRateLimit,
  adminSetupRateLimit,
  inviteRateLimit,
  forgotPasswordRateLimit,
  resetPasswordRateLimit,
};
