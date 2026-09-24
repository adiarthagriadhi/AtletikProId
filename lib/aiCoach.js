// Coach AI — fitur AI hemat token supaya aplikasi terasa "hidup":
//   1. Analisis singkat hasil kuesioner selling page (di-cache per profil).
//   2. Catatan pelatih harian di portal atlet (maks 1 panggilan/atlet/hari,
//      hasilnya disimpan — dibuka berkali-kali tetap 1 panggilan).
//   3. "Tanya Coach" — tanya-jawab singkat dengan kuota harian per paket.
//
// Prinsip hemat token: konteks dikirim sebagai ringkasan beberapa baris
// (bukan seluruh data), jawaban dibatasi beberapa kalimat, effort "low",
// tanpa riwayat percakapan (tiap pertanyaan berdiri sendiri), dan hasil
// di-cache. Tanpa ANTHROPIC_API_KEY semua fitur tetap jalan memakai teks
// berbasis aturan (fallback) — aplikasi tidak pernah rusak karena AI mati.
const crypto = require('crypto');

const DEFAULT_MODEL = 'claude-opus-5';
const DEFAULT_DAILY_LIMIT = 500;
const QUIZ_CACHE_MAX = 500;

let Anthropic = null;
let client = null;

function model() {
  return process.env.AI_MODEL || DEFAULT_MODEL;
}

function aiEnabled() {
  if (String(process.env.AI_ENABLED || '').toLowerCase() === 'false') return false;
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient() {
  if (client) return client;
  if (!Anthropic) Anthropic = require('@anthropic-ai/sdk');
  const Ctor = Anthropic.default || Anthropic;
  // Timeout pendek: fitur ini pelengkap, jangan sampai request pengguna
  // menggantung lama. Satu kali retry untuk 429/5xx.
  client = new Ctor({ maxRetries: 1, timeout: 25000 });
  return client;
}

// --- Pengaman biaya: batas total panggilan per hari (per proses server) ---
const daily = { date: null, count: 0 };
function dailyLimit() {
  const n = Number(process.env.AI_DAILY_LIMIT);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_LIMIT;
}
function takeDailySlot() {
  const today = new Date().toISOString().slice(0, 10);
  if (daily.date !== today) { daily.date = today; daily.count = 0; }
  if (daily.count >= dailyLimit()) return false;
  daily.count += 1;
  return true;
}

const SYSTEM_PROMPT = [
  'Anda adalah Coach AI Atletik Pro Id, asisten pelatih atletik berbahasa Indonesia untuk atlet amatir dan penghobi lari.',
  'Gaya: hangat, singkat, konkret, bahasa Indonesia sehari-hari yang sopan (sapa dengan "Anda").',
  'Format: teks biasa tanpa markdown, tanpa judul, tanpa daftar bernomor; paling banyak satu emoji.',
  'Pakai hanya angka yang ada di data yang diberikan; jangan mengarang angka, pace, atau target baru.',
  'Anda bukan tenaga medis: bila ada nyeri tajam, cedera, pusing, sesak, atau nyeri dada, sarankan berhenti latihan dan periksa ke dokter/fisioterapis.',
  'Jangan menyarankan obat, suplemen berdosis, atau diet ekstrem.',
  'Bila pertanyaan di luar latihan, gizi olahraga, atau pemulihan, tolak dengan sopan dalam satu kalimat.',
].join(' ');

function supportsServerFallback(m) {
  return /^claude-(opus-5|fable-5)/.test(m);
}

function supportsEffort(m) {
  return !/haiku/.test(m);
}

function trimToSentence(text) {
  const t = String(text || '').trim();
  const cut = Math.max(t.lastIndexOf('.'), t.lastIndexOf('!'), t.lastIndexOf('?'));
  return cut > 40 ? t.slice(0, cut + 1) : t;
}

/**
 * Satu panggilan Messages API. Mengembalikan teks, atau null bila AI tidak
 * aktif / kuota harian habis / error / ditolak — pemanggil lalu memakai
 * fallback berbasis aturan.
 */
async function askClaude(prompt, { maxTokens = 1024 } = {}) {
  if (!aiEnabled() || !takeDailySlot()) return null;
  const m = model();
  const params = {
    model: m,
    // Batas atas saja; panjang jawaban dikendalikan instruksi (2–4 kalimat),
    // jadi yang ditagih hanya token yang benar-benar dihasilkan.
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  };
  if (supportsEffort(m)) params.output_config = { effort: process.env.AI_EFFORT || 'low' };

  try {
    const c = getClient();
    const response = supportsServerFallback(m)
      // Bila permintaan ditolak classifier keamanan, API mengulang otomatis
      // di model cadangan yang direkomendasikan (routing per kategori).
      ? await c.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await c.messages.create(params);

    if (response.stop_reason === 'refusal') return null;
    const text = (response.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (!text) return null;
    return response.stop_reason === 'max_tokens' ? trimToSentence(text) : text;
  } catch (err) {
    const A = Anthropic && (Anthropic.default || Anthropic);
    if (A && err instanceof A.RateLimitError) console.warn('[ai] rate limited');
    else if (A && err instanceof A.AuthenticationError) console.error('[ai] ANTHROPIC_API_KEY tidak valid');
    else if (A && err instanceof A.APIError) console.error('[ai] API error', err.status, err.message);
    else console.error('[ai] gagal:', err && err.message ? err.message : err);
    return null;
  }
}

// ---------- Konteks ringkas ----------
const EVENT_LABELS = {
  half_marathon: 'Half marathon', marathon: 'Marathon', lompat_jauh: 'Lompat jauh', lompat_tinggi: 'Lompat tinggi',
};
function eventLabel(ev) {
  return EVENT_LABELS[ev] || ev;
}

function fmtClock(sec) {
  const s = Math.round(Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

function sessionLine(s) {
  if (!s) return null;
  const bits = [s.name];
  if (s.day) bits.push(s.day);
  if (s.reps && (s.dist || s.repDist)) bits.push(`${s.reps}x${s.dist || s.repDist}m`);
  if (s.durMin || s.durationMin) bits.push(`${s.durMin || s.durationMin} mnt`);
  if (s.paceLabel) bits.push(`pace ${s.paceLabel}`);
  if (s.targetRPE != null) bits.push(`RPE ${s.targetRPE}`);
  return bits.join(', ');
}

function contextLines(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

// ---------- 1. Analisis hasil kuesioner ----------
const quizCache = new Map();

function quizContext(preview, answers) {
  const t = preview.nutrition && preview.nutrition.available ? preview.nutrition.targets : null;
  const free = (preview.sessions || []).find((s) => !s.locked);
  return {
    nomor: eventLabel(preview.event),
    level: preview.level,
    tujuan: preview.targetMode === 'lomba' ? `lomba ${preview.periodization.compDate}` : 'progres 12 minggu',
    lama_program: `${preview.totalWeeks} minggu`,
    fase_sekarang: preview.phase && preview.phase.label,
    fokus_minggu: preview.weekFocus,
    prediksi_waktu: preview.racePrediction ? fmtClock(preview.racePrediction.predictedSec) : null,
    usia: answers && answers.usia,
    sesi_pertama: sessionLine(free),
    target_kalori: t ? `${t.kaloriKcalPerHari} kkal, karbo ${t.karbohidratGramPerHari} g, protein ${t.proteinGramPerHari} g` : null,
  };
}

function quizFallback(preview) {
  const phase = preview.phase ? preview.phase.label : 'persiapan';
  const free = (preview.sessions || []).find((s) => !s.locked);
  return `Program ${eventLabel(preview.event)} Anda dimulai di fase ${phase}: fondasinya dibangun dulu supaya tubuh siap menerima latihan yang lebih spesifik. `
    + (free ? `Mulai dari "${free.name}" minggu ini dan catat rasa beratnya setelah latihan. ` : '')
    + 'Konsistensi 3 sesi per minggu jauh lebih berpengaruh daripada satu sesi yang terlalu berat.';
}

async function quizInsight(preview, answers) {
  const ctx = contextLines(quizContext(preview, answers));
  const key = crypto.createHash('sha1').update(ctx).digest('hex');
  if (quizCache.has(key)) return { text: quizCache.get(key), source: 'ai', cached: true };

  const text = await askClaude(
    `Data atlet baru dari kuesioner:\n${ctx}\n\n`
    + 'Tulis analisis pembuka 2–3 kalimat (maks 60 kata) untuk atlet ini: apa yang akan dibangun di fase sekarang, '
    + 'dan satu kunci keberhasilan yang paling relevan dengan level & tujuannya. Terdengar seperti pelatih yang sudah membaca datanya.',
    { maxTokens: 1024 },
  );
  if (!text) return { text: quizFallback(preview), source: 'rules', cached: false };
  if (quizCache.size >= QUIZ_CACHE_MAX) quizCache.delete(quizCache.keys().next().value);
  quizCache.set(key, text);
  return { text, source: 'ai', cached: false };
}

// ---------- 2. Catatan pelatih harian ----------
function dailyFallback(c) {
  const parts = [];
  if (c.sesi_hari_ini) parts.push(`Hari ini: ${c.sesi_hari_ini}. Pemanasan 10 menit dulu, lalu jaga intensitas sesuai target.`);
  else parts.push('Hari ini tidak ada sesi utama — manfaatkan untuk pemulihan: jalan santai, peregangan, tidur cukup.');
  if (c.nyeri) parts.push('Ada keluhan nyeri yang tercatat; kurangi intensitas dan hentikan bila nyeri bertambah.');
  else if (c.status_beban === 'Risiko tinggi' || c.status_beban === 'Waspada') parts.push('Beban latihan minggu ini sedang tinggi, jadi prioritaskan kualitas daripada volume.');
  if (c.nutrisi) parts.push(`Nutrisi: ${c.nutrisi}.`);
  return parts.join(' ');
}

async function dailyNote(c) {
  const ctx = contextLines(c);
  const text = await askClaude(
    `Data hari ini untuk atlet (tanpa pelatih pendamping):\n${ctx}\n\n`
    + 'Tulis catatan pelatih untuk hari ini, 2–3 kalimat (maks 55 kata): sapa dengan nama depan, sebut sesi hari ini (atau pemulihan), '
    + 'dan satu saran spesifik dari data (readiness, beban, nyeri, atau nutrisi). Jangan ulangi semua angka.',
    { maxTokens: 1024 },
  );
  return text ? { text, source: 'ai' } : { text: dailyFallback(c), source: 'rules' };
}

// ---------- 3. Tanya Coach ----------
async function answerQuestion(c, question) {
  const ctx = contextLines(c);
  const q = String(question || '').trim().slice(0, 300);
  const text = await askClaude(
    `Profil & program atlet:\n${ctx}\n\nPertanyaan atlet: """${q}"""\n\n`
    + 'Jawab maksimal 4 kalimat (maks 80 kata), langsung ke inti, sesuai program di atas.',
    { maxTokens: 1500 },
  );
  if (text) return { text, source: 'ai' };
  return {
    text: aiEnabled()
      ? 'Coach AI sedang sibuk. Coba tanyakan lagi beberapa saat lagi ya.'
      : 'Coach AI belum diaktifkan di server ini. Sementara itu, ikuti panduan sesi di tab Program dan catat RPE setelah latihan.',
    source: 'unavailable',
  };
}

module.exports = {
  aiEnabled,
  quizInsight,
  dailyNote,
  answerQuestion,
  sessionLine,
  eventLabel,
  fmtClock,
};
