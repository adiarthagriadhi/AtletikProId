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

function fmtClock(sec) {
  const s = Math.round(Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Kirim ringkasan hasil kuesioner selling page (program minggu 1 + target
 * nutrisi) ke email pengunjung, dengan ajakan membuka program lengkap.
 * `preview` = hasil lib/trialPlan.buildTrialPreview (sudah dipotong server —
 * detail berbayar memang tidak ada di sini).
 */
async function sendTrialPlanEmail({ to, name, preview, planUrl, eventLabel }) {
  if (!smtpConfigured()) {
    return { sent: false, skipped: true };
  }
  const who = name ? String(name) : 'Sobat Atletik';
  const p = preview;
  const free = (p.sessions || []).find((s) => !s.locked);
  const locked = (p.sessions || []).filter((s) => s.locked);
  const t = (p.nutrition && p.nutrition.available && p.nutrition.targets) || null;
  const breakfast = p.nutrition && p.nutrition.menu
    ? (p.nutrition.menu.slots || []).find((sl) => !sl.locked)
    : null;

  const lines = [];
  lines.push(`Halo ${who},`, '');
  lines.push(`Ini program ${eventLabel} Anda dari Atletik Pro Id (${p.totalWeeks} minggu, fase ${p.phase ? p.phase.label : '-'}).`, '');
  if (free) {
    lines.push(`SESI GRATIS — ${free.name} (${free.day || ''})`);
    if (free.guide) {
      lines.push('Pemanasan: ' + free.guide.warmup.join('; '));
      lines.push('Inti: ' + free.guide.main.join('; '));
      lines.push('Pendinginan: ' + free.guide.cooldown.join('; '));
    }
    lines.push('');
  }
  if (locked.length) lines.push(`Terkunci: ${locked.map((s) => s.name).join(', ')} + ${p.lockedWeeks} minggu berikutnya.`, '');
  if (t) lines.push(`Target nutrisi harian: ${t.kaloriKcalPerHari} kkal · karbo ${t.karbohidratGramPerHari} g · protein ${t.proteinGramPerHari} g · air ${t.airLiterPerHari} L`, '');
  if (p.racePrediction) lines.push(`Prediksi waktu ${p.racePrediction.event}: ${fmtClock(p.racePrediction.predictedSec)}`, '');
  lines.push(`Buka program lengkap & coba gratis: ${planUrl}`, '');
  lines.push('Estimasi berbasis pedoman latihan & gizi olahraga — bukan pengganti nasihat medis.');

  const li = (arr) => arr.map((x) => `<li style="margin:2px 0">${escapeHtml(x)}</li>`).join('');
  const card = 'background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin:0 0 14px';
  const muted = 'color:#64748b;font-size:13px';
  let html = `<div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">`
    + `<div style="max-width:560px;margin:0 auto">`
    + `<p style="font-weight:800;font-size:18px;margin:0 0 16px">Atletik <span style="color:#4f46e5">Pro Id</span></p>`
    + `<div style="${card}"><p style="margin:0 0 6px">Halo ${escapeHtml(who)},</p>`
    + `<h2 style="margin:0 0 6px;font-size:20px">Program ${escapeHtml(eventLabel)} Anda sudah siap</h2>`
    + `<p style="${muted};margin:0">${escapeHtml(String(p.totalWeeks))} minggu · Fase ${escapeHtml(p.phase ? p.phase.label : '-')}${p.weekFocus ? ' · Fokus: ' + escapeHtml(p.weekFocus) : ''}</p></div>`;
  if (free) {
    html += `<div style="${card}"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#16a34a">SESI GRATIS UNTUK ANDA</p>`
      + `<h3 style="margin:0 0 4px">${escapeHtml(free.name)}</h3><p style="${muted};margin:0 0 8px">${escapeHtml(free.day || '')}${free.goal ? ' · ' + escapeHtml(free.goal) : ''}</p>`;
    if (free.guide) {
      html += `<p style="margin:8px 0 2px;font-weight:700">Pemanasan</p><ul style="margin:0;padding-left:18px">${li(free.guide.warmup)}</ul>`
        + `<p style="margin:8px 0 2px;font-weight:700">Inti</p><ul style="margin:0;padding-left:18px">${li(free.guide.main)}</ul>`
        + `<p style="margin:8px 0 2px;font-weight:700">Pendinginan</p><ul style="margin:0;padding-left:18px">${li(free.guide.cooldown)}</ul>`;
    }
    html += `</div>`;
  }
  if (t) {
    html += `<div style="${card}"><h3 style="margin:0 0 6px">Target nutrisi harian</h3>`
      + `<p style="margin:0">${escapeHtml(String(t.kaloriKcalPerHari))} kkal · Karbo ${escapeHtml(String(t.karbohidratGramPerHari))} g · Protein ${escapeHtml(String(t.proteinGramPerHari))} g · Air ${escapeHtml(String(t.airLiterPerHari))} L</p>`;
    if (breakfast && breakfast.items) {
      html += `<p style="margin:8px 0 2px;font-weight:700">Contoh sarapan</p><ul style="margin:0;padding-left:18px">${li(breakfast.items.map((it) => `${it.name} ${it.grams} g`))}</ul>`;
    }
    html += `</div>`;
  }
  if (locked.length) {
    html += `<div style="${card};background:#eef2ff;border-color:#c7d2fe"><h3 style="margin:0 0 6px">🔒 Masih terkunci</h3>`
      + `<ul style="margin:0;padding-left:18px">${li(locked.map((s) => `${s.name}${s.day ? ' (' + s.day + ')' : ''}`))}`
      + `<li style="margin:2px 0">${escapeHtml(String(p.lockedWeeks))} minggu program berikutnya + menu makan harian lengkap</li></ul></div>`;
  }
  html += `<p style="text-align:center;margin:20px 0"><a href="${escapeHtml(planUrl)}" style="background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;display:inline-block">Buka program lengkap</a></p>`
    + `<p style="${muted};text-align:center">Estimasi berbasis pedoman latihan & gizi olahraga — bukan pengganti nasihat medis.</p>`
    + `</div></div>`;

  const transporter = createTransport();
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: `Program ${eventLabel} Anda — Atletik Pro Id`,
    text: lines.join('\n'),
    html,
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

module.exports = { smtpConfigured, sendResetPasswordEmail, sendTrialPlanEmail };
