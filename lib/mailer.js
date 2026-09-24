function loadNodemailer() {
  try {
    return require('nodemailer');
  } catch (err) {
    console.error('[mailer] nodemailer belum terpasang. Jalankan npm install');
    return null;
  }
}

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  const nodemailer = loadNodemailer();
  if (!nodemailer) {
    throw new Error('nodemailer belum terpasang');
  }
  const port = Number(process.env.SMTP_PORT || 465);
  const secureFlag = String(process.env.SMTP_SECURE || '').toLowerCase();
  const secure = secureFlag === 'false' || secureFlag === '0' ? false : (secureFlag === 'true' || secureFlag === '1' || port === 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function fromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER;
}

async function sendResetPasswordEmail({ to, resetUrl, name }) {
  if (!smtpConfigured()) {
    return { sent: false, skipped: true };
  }
  const who = name ? String(name) : 'Pelatih';
  const transporter = createTransport();
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: 'Reset password Atletik Pro Id',
    text:
      `Halo ${who},\n\n` +
      `Ada permintaan reset password untuk akun Atletik Pro Id Anda.\n` +
      `Tautan ini berlaku 1 jam:\n\n${resetUrl}\n\n` +
      `Jika Anda tidak meminta ini, abaikan email ini.\n`,
    html:
      `<p>Halo ${escapeHtml(who)},</p>` +
      `<p>Ada permintaan reset password untuk akun Atletik Pro Id Anda. Tautan ini berlaku 1 jam.</p>` +
      `<p><a href="${escapeHtml(resetUrl)}">Atur password baru</a></p>` +
      `<p style="color:#64748b;font-size:13px">Jika tombol tidak bisa diklik, salin tautan ini:<br>${escapeHtml(resetUrl)}</p>` +
      `<p style="color:#64748b;font-size:13px">Jika Anda tidak meminta ini, abaikan email ini.</p>`,
  });
  return { sent: true };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { smtpConfigured, sendResetPasswordEmail };
