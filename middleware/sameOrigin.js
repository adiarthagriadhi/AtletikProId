/**
 * Tolak POST/PUT/PATCH/DELETE lintas origin yang menyertakan header Origin
 * berbeda dari host aplikasi. Webhook Midtrans tidak lewat sini.
 */
function allowedOrigins(req) {
  const list = new Set();
  if (process.env.APP_PUBLIC_URL) {
    try {
      list.add(new URL(process.env.APP_PUBLIC_URL).origin);
    } catch (_) { /* ignore */ }
  }
  const proto = String((req.headers['x-forwarded-proto'] || req.protocol || 'https')).split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (host) list.add(`${proto}://${String(host).split(',')[0].trim()}`);
  return list;
}

function requireSameOrigin(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  const origin = req.headers.origin;
  if (!origin) return next();
  const allowed = allowedOrigins(req);
  if (allowed.has(origin)) return next();
  return res.status(403).json({ error: 'Origin tidak diizinkan' });
}

module.exports = { requireSameOrigin };
