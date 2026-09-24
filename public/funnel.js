/* Atletik Pro Id — Selling page (funnel kuesioner) untuk pengunjung pertama.
 *
 * Dimuat SEBELUM app.js dan memakai helper global dari app.js (el, icon,
 * api, state, render, brandMark, formatIdr, LANDING_TEAM, WA_LINK, ...) —
 * semuanya baru dipanggil saat render, setelah app.js selesai dimuat.
 *
 * Alur: hero → kuesioner 7 langkah → "menyusun program" → hasil (sesi 1 &
 * sarapan terbuka, sisanya terkunci di server) → daftar akun / kirim email.
 */

const FUNNEL_STORE_KEY = 'funnel-answers-v1';

const FUNNEL_GOALS = [
  { id: 'jauh', icon: 'compass', title: 'Lari jarak jauh', desc: '5K, 10K, half marathon, marathon' },
  { id: 'menengah', icon: 'trending-up', title: 'Lari jarak menengah', desc: '800 m & 1500 m' },
  { id: 'sprint', icon: 'zap', title: 'Sprint', desc: '100 m, 200 m, 400 m' },
  { id: 'lompat', icon: 'arrow-up-circle', title: 'Lompat', desc: 'Lompat jauh & lompat tinggi' },
];

const FUNNEL_LEVEL_DESC = {
  pemula: 'Baru mulai atau belum rutin (< 1 tahun)',
  rutin: 'Latihan rutin 1–3 tahun, pernah ikut event',
  kompetitif: 'Latihan terstruktur > 3 tahun, mengejar prestasi',
};

const FUNNEL_LOADING_STEPS = [
  'Membaca profil & level Anda',
  'Menghitung fase periodisasi',
  'Menyusun sesi minggu pertama',
  'Menghitung kebutuhan kalori & makro',
];

const FUNNEL_FAQ = [
  ['Apakah benar-benar gratis dicoba?', 'Ya. Hasil kuesioner & sesi pertama langsung terlihat tanpa daftar. Setelah membuat akun, Anda dapat masa coba Premium tanpa kartu kredit.'],
  ['Bagaimana program disusun?', 'Dari jawaban Anda, mesin program menghitung fase periodisasi (persiapan umum → khusus → puncak), menyesuaikan volume dengan level, lalu menyusun sesi mingguan. Program dihitung ulang tiap minggu mengikuti catatan latihan Anda.'],
  ['Apa itu Coach AI?', 'Asisten yang membaca data program & catatan latihan Anda untuk memberi catatan harian dan menjawab pertanyaan singkat. Coach AI bukan pengganti dokter — untuk nyeri atau cedera tetap periksa ke tenaga medis.'],
  ['Saya punya pelatih. Bisa dipakai?', 'Bisa. Minta kode undangan dari pelatih Anda dan masukkan di aplikasi atlet — program Anda lalu diatur oleh pelatih.'],
  ['Bagaimana cara bayar?', 'Lewat Midtrans: QRIS, e-wallet, virtual account, atau kartu. Paket bisa diperpanjang kapan saja.'],
];

function funnelState() {
  if (!state.funnel) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(FUNNEL_STORE_KEY) || 'null'); } catch (_) { saved = null; }
    state.funnel = {
      step: 'hero', // hero | quiz | loading | result
      idx: 0,
      answers: (saved && saved.answers) || { alergiMakanan: ['Tidak ada'], pantanganMakanan: ['Tidak ada'] },
      hasResult: !!(saved && saved.done),
      options: null,
      preview: null,
      insight: null,
      error: null,
      loginMenu: false,
      signupError: null,
      signupBusy: false,
      emailMsg: null,
      emailBusy: false,
    };
  }
  return state.funnel;
}

function funnelSave(done) {
  const f = funnelState();
  if (done) f.hasResult = true;
  try { localStorage.setItem(FUNNEL_STORE_KEY, JSON.stringify({ answers: f.answers, done: f.hasResult })); } catch (_) { /* private mode */ }
}

async function funnelLoadOptions() {
  const f = funnelState();
  if (f.options || f.optionsLoading || f.optionsFailed) return;
  f.optionsLoading = true;
  try {
    f.options = await api('GET', '/public/quiz-options');
  } catch (_) {
    f.options = null;
    f.optionsFailed = true; // jangan ulangi fetch di tiap render
  }
  f.optionsLoading = false;
  if (state.view === 'landing' && !state.landingMode) render();
}

function funnelGo(step, idx) {
  const f = funnelState();
  f.step = step;
  if (idx != null) f.idx = idx;
  f.error = null;
  render();
  try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (_) { window.scrollTo(0, 0); }
}

// ---------- Langkah kuesioner (dinamis mengikuti jawaban) ----------
function funnelSteps() {
  const f = funnelState();
  const cat = f.options && f.answers.kategori ? f.options.categories[f.answers.kategori] : null;
  const steps = ['goal', 'event', 'level', 'target'];
  if (cat && (cat.needsTimeTrial || cat.needsBest100m)) steps.push('performance');
  steps.push('body', 'food');
  return steps;
}

function funnelValid(stepId) {
  const a = funnelState().answers;
  switch (stepId) {
    case 'goal': return !!a.kategori;
    case 'event': return !!a.event;
    case 'level': return !!a.level;
    case 'target': return a.targetMode === 'progres' || (a.targetMode === 'lomba' && /^\d{4}-\d{2}-\d{2}$/.test(a.compDate || ''));
    case 'performance': {
      // Kosong semua = pakai estimasi dari level ("Belum tahu").
      const cat = funnelState().options.categories[a.kategori];
      if (cat.needsTimeTrial) {
        if (!a.ttDistance && !a.ttTime) return true;
        return !!a.ttDistance && /^\d{1,2}:\d{2}(:\d{2})?$/.test(String(a.ttTime || ''));
      }
      if (a.best100m == null || a.best100m === '') return true;
      return Number(a.best100m) >= 9 && Number(a.best100m) <= 30;
    }
    case 'body': return (a.jenisKelamin === 'L' || a.jenisKelamin === 'P') && Number(a.usia) > 0 && Number(a.berat) > 0;
    case 'food': return true;
    default: return true;
  }
}

function funnelChoice(opts) {
  // opts: { selected, title, desc, icon, onClick }
  return el('button', {
    type: 'button',
    class: 'funnel-choice' + (opts.selected ? ' selected' : ''),
    onclick: opts.onClick,
  }, [
    opts.icon ? el('span', { class: 'funnel-choice-icon' }, [icon(opts.icon)]) : null,
    el('span', { class: 'funnel-choice-text' }, [
      el('span', { class: 'funnel-choice-title' }, [opts.title]),
      opts.desc ? el('span', { class: 'funnel-choice-desc' }, [opts.desc]) : null,
    ]),
    opts.selected ? el('span', { class: 'funnel-choice-check' }, [icon('check-circle')]) : null,
  ]);
}

function funnelChips(list, selected, onToggle) {
  return el('div', { class: 'funnel-chips' }, list.map((label) => el('button', {
    type: 'button',
    class: 'funnel-chip' + (selected.includes(label) ? ' selected' : ''),
    onclick: () => onToggle(label),
  }, [label])));
}

function toggleFood(key, label) {
  const a = funnelState().answers;
  let cur = Array.isArray(a[key]) ? a[key].slice() : [];
  if (label === 'Tidak ada') cur = ['Tidak ada'];
  else {
    cur = cur.filter((x) => x !== 'Tidak ada');
    cur = cur.includes(label) ? cur.filter((x) => x !== label) : cur.concat(label);
    if (!cur.length) cur = ['Tidak ada'];
  }
  a[key] = cur;
  funnelSave();
  render();
}

function autoAdvance() {
  const f = funnelState();
  const steps = funnelSteps();
  funnelSave();
  if (f.idx < steps.length - 1) setTimeout(() => funnelGo('quiz', f.idx + 1), 160);
  else render();
}

function renderFunnelStep(stepId) {
  const f = funnelState();
  const a = f.answers;
  const o = f.options;
  const setA = (k, v) => { a[k] = v; funnelSave(); };

  if (stepId === 'goal') {
    return [
      el('h2', {}, ['Apa target latihan Anda?']),
      el('p', { class: 'muted' }, ['Pilih yang paling sesuai — program akan disusun khusus untuk nomor ini.']),
      el('div', { class: 'funnel-choice-grid' }, FUNNEL_GOALS.map((g) => funnelChoice({
        selected: a.kategori === g.id, title: g.title, desc: g.desc, icon: g.icon,
        onClick: () => { if (a.kategori !== g.id) { a.event = null; } setA('kategori', g.id); autoAdvance(); },
      }))),
    ];
  }
  if (stepId === 'event') {
    const cat = o.categories[a.kategori];
    return [
      el('h2', {}, ['Nomor spesifiknya?']),
      el('p', { class: 'muted' }, [`Kategori ${cat.label}.`]),
      el('div', { class: 'funnel-choice-grid' }, cat.events.map((ev) => funnelChoice({
        selected: a.event === ev.id, title: ev.label,
        onClick: () => { setA('event', ev.id); autoAdvance(); },
      }))),
    ];
  }
  if (stepId === 'level') {
    return [
      el('h2', {}, ['Seberapa rutin Anda berlatih?']),
      el('p', { class: 'muted' }, ['Dipakai untuk menyesuaikan volume & intensitas awal.']),
      el('div', { class: 'funnel-choice-grid funnel-choice-grid-1' }, o.levels.map((l) => funnelChoice({
        selected: a.level === l.id, title: l.label, desc: FUNNEL_LEVEL_DESC[l.id],
        onClick: () => { setA('level', l.id); autoAdvance(); },
      }))),
    ];
  }
  if (stepId === 'target') {
    const today = new Date();
    const min = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const max = new Date(today.getTime() + 364 * 86400000).toISOString().slice(0, 10);
    return [
      el('h2', {}, ['Ada lomba atau target tanggal?']),
      el('p', { class: 'muted' }, ['Fase latihan dihitung mundur dari tanggal ini.']),
      el('div', { class: 'funnel-choice-grid funnel-choice-grid-1' }, [
        funnelChoice({
          selected: a.targetMode === 'lomba', icon: 'flag', title: 'Ya, ada tanggal lomba/event',
          onClick: () => { setA('targetMode', 'lomba'); render(); },
        }),
        a.targetMode === 'lomba' ? el('div', { class: 'funnel-inline-field' }, [
          el('label', {}, ['Tanggal lomba']),
          el('input', {
            type: 'date', min, max, value: a.compDate || '',
            onchange: (e) => { setA('compDate', e.target.value); render(); },
          }),
        ]) : null,
        funnelChoice({
          selected: a.targetMode === 'progres', icon: 'trending-up', title: 'Belum ada — ingin progres 12 minggu',
          onClick: () => { setA('targetMode', 'progres'); a.compDate = null; autoAdvance(); },
        }),
      ]),
    ];
  }
  if (stepId === 'performance') {
    const cat = o.categories[a.kategori];
    if (cat.needsTimeTrial) {
      const dLabel = { 1600: '1,6 km', 3000: '3 km', 5000: '5K', 10000: '10K', 21097: 'Half marathon' };
      return [
        el('h2', {}, ['Catatan waktu terbaik Anda?']),
        el('p', { class: 'muted' }, ['Dari lari/event 3 bulan terakhir. Dipakai menghitung pace latihan yang pas.']),
        el('label', {}, ['Jarak']),
        el('div', { class: 'funnel-chips' }, o.ttDistances.map((d) => el('button', {
          type: 'button',
          class: 'funnel-chip' + (Number(a.ttDistance) === d ? ' selected' : ''),
          onclick: () => { setA('ttDistance', d); render(); },
        }, [dLabel[d] || `${d} m`]))),
        el('label', { style: 'margin-top:14px;' }, ['Waktu (mm:ss atau j:mm:ss)']),
        el('input', {
          type: 'text', inputmode: 'numeric', placeholder: 'contoh 28:30', value: a.ttTime || '',
          oninput: (e) => { setA('ttTime', e.target.value.trim()); const nx = document.querySelector('.funnel-next'); if (nx) nx.disabled = !funnelValid('performance'); },
        }),
        el('button', {
          type: 'button', class: 'funnel-skip',
          onclick: () => { a.ttDistance = null; a.ttTime = null; funnelSave(); funnelGo('quiz', f.idx + 1); },
        }, ['Belum tahu — pakai estimasi dari level saya']),
      ];
    }
    return [
      el('h2', {}, ['Waktu 100 m terbaik Anda?']),
      el('p', { class: 'muted' }, ['Dalam detik. Dipakai menghitung target waktu tiap repetisi.']),
      el('input', {
        type: 'number', step: '0.01', min: '9', max: '30', placeholder: 'contoh 13.2', value: a.best100m || '',
        oninput: (e) => { setA('best100m', e.target.value); const nx = document.querySelector('.funnel-next'); if (nx) nx.disabled = !funnelValid('performance'); },
      }),
      el('button', {
        type: 'button', class: 'funnel-skip',
        onclick: () => { a.best100m = null; funnelSave(); funnelGo('quiz', f.idx + 1); },
      }, ['Belum tahu — pakai estimasi dari level saya']),
    ];
  }
  if (stepId === 'body') {
    const num = (key, label, attrs) => el('div', { class: 'funnel-field' }, [
      el('label', {}, [label]),
      el('input', Object.assign({
        type: 'number', inputmode: 'decimal', value: a[key] || '',
        oninput: (e) => { setA(key, e.target.value); const nx = document.querySelector('.funnel-next'); if (nx) nx.disabled = !funnelValid('body'); },
      }, attrs)),
    ]);
    return [
      el('h2', {}, ['Sedikit data tubuh']),
      el('p', { class: 'muted' }, ['Untuk menghitung kebutuhan kalori, karbohidrat, protein & cairan.']),
      el('label', {}, ['Jenis kelamin']),
      el('div', { class: 'funnel-toggle' }, [['L', 'Laki-laki'], ['P', 'Perempuan']].map(([v, lbl]) => el('button', {
        type: 'button', class: a.jenisKelamin === v ? 'selected' : '',
        onclick: () => { setA('jenisKelamin', v); render(); },
      }, [lbl]))),
      el('div', { class: 'funnel-field-row' }, [
        num('usia', 'Usia (tahun)', { min: String(o.minAge || 13), max: '90', placeholder: '25' }),
        num('berat', 'Berat (kg)', { min: '25', max: '200', step: '0.1', placeholder: '60' }),
        num('tinggi', 'Tinggi (cm, opsional)', { min: '100', max: '230', placeholder: '165' }),
      ]),
    ];
  }
  if (stepId === 'food') {
    return [
      el('h2', {}, ['Ada alergi atau pantangan makanan?']),
      el('p', { class: 'muted' }, ['Menu contoh akan menghindari bahan ini.']),
      el('label', {}, ['Alergi']),
      funnelChips(['Tidak ada'].concat(o.alergiOptions), a.alergiMakanan || [], (l) => toggleFood('alergiMakanan', l)),
      el('label', { style: 'margin-top:14px;' }, ['Pantangan']),
      funnelChips(['Tidak ada'].concat(o.pantanganOptions), a.pantanganMakanan || [], (l) => toggleFood('pantanganMakanan', l)),
    ];
  }
  return [];
}

function renderFunnelQuiz() {
  const f = funnelState();
  if (!f.options) {
    funnelLoadOptions();
    return el('div', { class: 'funnel-quiz' }, [el('p', { class: 'muted' }, ['Memuat pertanyaan...'])]);
  }
  const steps = funnelSteps();
  if (f.idx >= steps.length) f.idx = steps.length - 1;
  const stepId = steps[f.idx];
  const pct = Math.round(((f.idx + 1) / steps.length) * 100);
  const isLast = f.idx === steps.length - 1;
  const manualNext = ['target', 'performance', 'body', 'food'].includes(stepId)
    || (['goal', 'event', 'level'].includes(stepId) && funnelValid(stepId));

  return el('div', { class: 'funnel-quiz' }, [
    el('div', { class: 'funnel-progress' }, [
      el('button', {
        type: 'button', class: 'funnel-back', 'aria-label': 'Kembali',
        onclick: () => (f.idx === 0 ? funnelGo('hero') : funnelGo('quiz', f.idx - 1)),
      }, [icon('chevron-left')]),
      el('div', { class: 'funnel-progress-track' }, [el('div', { class: 'funnel-progress-fill', style: `width:${pct}%` })]),
      el('span', { class: 'funnel-progress-label' }, [`${f.idx + 1}/${steps.length}`]),
    ]),
    el('div', { class: 'funnel-card card' }, [
      ...renderFunnelStep(stepId),
      f.error ? el('div', { class: 'error-box', style: 'margin-top:14px;' }, [f.error]) : null,
      manualNext ? el('button', {
        type: 'button',
        class: 'funnel-next',
        disabled: funnelValid(stepId) ? null : 'true',
        onclick: () => {
          if (!funnelValid(stepId)) return;
          funnelSave();
          if (isLast) funnelSubmit();
          else funnelGo('quiz', f.idx + 1);
        },
      }, [isLast ? 'Susun program saya' : 'Lanjut', icon('chevron-right')]) : null,
    ]),
    el('p', { class: 'funnel-privacy muted' }, [icon('shield-check'), ' Jawaban hanya dipakai untuk menyusun program Anda.']),
  ]);
}

function funnelAnswersPayload() {
  const a = Object.assign({}, funnelState().answers);
  if (a.targetMode !== 'lomba') delete a.compDate;
  return a;
}

async function funnelSubmit() {
  const f = funnelState();
  f.preview = null;
  f.insight = null;
  funnelGo('loading');
  const started = Date.now();
  const answers = funnelAnswersPayload();
  try {
    const previewP = api('POST', '/public/trial-plan', { answers });
    const insightP = api('POST', '/public/trial-insight', { answers }).catch(() => null);
    f.preview = await previewP;
    // Animasi "menyusun" minimal ~2,6 detik supaya tiap langkah terbaca;
    // analisis AI boleh menyusul setelah halaman hasil tampil.
    const wait = Math.max(0, 2600 - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));
    funnelSave(true);
    funnelGo('result');
    const insight = await insightP;
    f.insight = insight || { text: null, source: 'none' };
    if (f.step === 'result') renderFunnelInsight();
  } catch (err) {
    // Kembali ke langkah terakhir & tampilkan pesan dari server
    // (mis. "Tanggal lomba minimal 1 minggu dari hari ini").
    f.step = 'quiz';
    f.idx = funnelSteps().length - 1;
    f.error = err.message || 'Gagal menyusun program';
    render();
  }
}

function renderFunnelLoading() {
  const wrap = el('div', { class: 'funnel-loading' }, [
    el('div', { class: 'funnel-spinner' }, [brandMark(56)]),
    el('h2', {}, ['Menyusun program Anda...']),
    el('ul', { class: 'funnel-loading-list' }, FUNNEL_LOADING_STEPS.map((t, i) => el('li', {
      style: `animation-delay:${i * 0.6}s`,
    }, [icon('check-circle'), t]))),
  ]);
  return wrap;
}

// ---------- Hasil ----------
function fmtClockShort(sec) {
  const s = Math.round(Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

function funnelEventLabel(p) {
  const f = funnelState();
  const cat = f.options && f.options.categories[p.kategori];
  const ev = cat && cat.events.find((e) => e.id === p.event);
  return ev ? ev.label : p.event;
}

function typewriter(node, text) {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { node.textContent = text; return; }
  node.textContent = '';
  node.classList.add('typing');
  let i = 0;
  const timer = setInterval(() => {
    i += 2;
    node.textContent = text.slice(0, i);
    if (i >= text.length) { clearInterval(timer); node.classList.remove('typing'); }
  }, 22);
}

// Isi kartu Coach AI tanpa re-render seluruh halaman (supaya form yang
// sedang diketik pengunjung tidak hilang).
function renderFunnelInsight() {
  const f = funnelState();
  const box = document.getElementById('funnel-insight-text');
  const label = document.getElementById('funnel-insight-label');
  if (!box) return;
  if (!f.insight || !f.insight.text) {
    const card = document.getElementById('funnel-insight');
    if (card) card.remove();
    return;
  }
  if (label) label.textContent = f.insight.source === 'ai' ? 'Coach AI' : 'Catatan pelatih';
  typewriter(box, f.insight.text);
}

function renderGuideList(title, items) {
  return el('div', { class: 'funnel-guide-block' }, [
    el('div', { class: 'funnel-guide-title' }, [title]),
    el('ul', {}, items.map((x) => el('li', {}, [x]))),
  ]);
}

function renderFreeSession(s) {
  const chips = [];
  if (s.durationMin || s.durMin) chips.push(`${s.durationMin || s.durMin} menit`);
  if (s.reps && (s.dist || s.repDist)) chips.push(`${s.reps} × ${s.dist || s.repDist} m`);
  if (s.paceLabel) chips.push(`pace ${s.paceLabel}`);
  if (s.targetRPE != null) chips.push(`RPE ${s.targetRPE}`);
  return el('div', { class: 'funnel-session card' }, [
    el('div', { class: 'funnel-session-head' }, [
      el('div', {}, [
        el('span', { class: 'funnel-free-badge' }, ['GRATIS · coba hari ini']),
        el('h3', {}, [s.name]),
        el('div', { class: 'muted' }, [[s.day, s.goal].filter(Boolean).join(' · ')]),
      ]),
    ]),
    chips.length ? el('div', { class: 'funnel-session-chips' }, chips.map((c) => el('span', { class: 'badge' }, [c]))) : null,
    s.guide ? el('div', { class: 'funnel-guide' }, [
      renderGuideList('Pemanasan', s.guide.warmup),
      renderGuideList('Inti', s.guide.main),
      renderGuideList('Pendinginan', s.guide.cooldown),
    ]) : null,
    s.guide && s.guide.tip ? el('p', { class: 'muted funnel-tip' }, [s.guide.tip]) : null,
  ]);
}

function renderLockedRow(title, sub) {
  return el('div', { class: 'funnel-locked' }, [
    el('span', { class: 'funnel-locked-icon' }, [icon('lock')]),
    el('div', { class: 'funnel-locked-text' }, [
      el('div', { class: 'funnel-locked-title' }, [title]),
      sub ? el('div', { class: 'muted' }, [sub]) : null,
    ]),
    el('span', { class: 'funnel-locked-tag' }, ['Premium']),
  ]);
}

function scrollToSignup() {
  const n = document.getElementById('funnel-signup');
  if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderFunnelSignup() {
  const f = funnelState();
  const trialDays = (f.options && f.options.trialDays) || 0;
  let nameI; let emailI; let passI;
  const form = el('form', {
    class: 'funnel-signup-form',
    onsubmit: async (e) => {
      e.preventDefault();
      if (f.signupBusy) return;
      f.signupBusy = true;
      f.signupError = null;
      const btn = form.querySelector('button[type=submit]');
      if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan program...'; }
      try {
        await api('POST', '/athlete/auth/register', { name: nameI.value, email: emailI.value, password: passI.value });
        await api('POST', '/athlete/self/setup', Object.assign({ nama: nameI.value }, funnelAnswersPayload()));
        try { localStorage.removeItem(FUNNEL_STORE_KEY); } catch (_) { /* ignore */ }
        location.href = '/athlete?selamat=1';
      } catch (err) {
        f.signupBusy = false;
        f.signupError = err.status === 409
          ? 'Email ini sudah terdaftar. Silakan masuk di aplikasi atlet.'
          : (err.message || 'Gagal membuat akun');
        const box = document.getElementById('funnel-signup-error');
        if (box) { box.textContent = f.signupError; box.style.display = ''; }
        if (btn) { btn.disabled = false; btn.textContent = 'Simpan program & mulai'; }
      }
    },
  }, [
    el('div', { class: 'funnel-field' }, [el('label', {}, ['Nama']), nameI = el('input', { required: 'true', autocomplete: 'name', minlength: '2', maxlength: '100' })]),
    el('div', { class: 'funnel-field' }, [el('label', {}, ['Email']), emailI = el('input', { type: 'email', required: 'true', autocomplete: 'email' })]),
    el('div', { class: 'funnel-field' }, [el('label', {}, ['Password (min. 8 karakter)']), passI = el('input', { type: 'password', required: 'true', minlength: '8', autocomplete: 'new-password' })]),
    el('div', { id: 'funnel-signup-error', class: 'error-box', style: f.signupError ? '' : 'display:none' }, [f.signupError || '']),
    el('button', { type: 'submit' }, ['Simpan program & mulai']),
    el('p', { class: 'muted funnel-small' }, [
      'Sudah punya akun? ', el('a', { href: '/athlete' }, ['Masuk di aplikasi atlet']),
    ]),
  ]);
  return el('section', { class: 'funnel-signup card', id: 'funnel-signup' }, [
    el('span', { class: 'eyebrow' }, [trialDays ? `Coba Premium ${trialDays} hari — gratis` : 'Gratis selamanya untuk paket dasar']),
    el('h2', {}, ['Simpan program ini & buka semua sesinya']),
    el('p', { class: 'muted' }, [
      trialDays
        ? `Buat akun atlet gratis. Selama ${trialDays} hari Anda bisa membuka semua sesi, panduan, menu mingguan, dan Coach AI. Tanpa kartu kredit.`
        : 'Buat akun atlet gratis untuk menyimpan program & mencatat latihan.',
    ]),
    form,
  ]);
}

function renderFunnelEmail() {
  const f = funnelState();
  if (!f.options || !f.options.emailEnabled) return null;
  let emailI; let nameI; let consentI;
  const msg = el('div', { class: f.emailMsg && f.emailMsg.ok ? 'callout callout-ok' : 'error-box', style: f.emailMsg ? '' : 'display:none' }, [f.emailMsg ? f.emailMsg.text : '']);
  const form = el('form', {
    class: 'funnel-email-form',
    onsubmit: async (e) => {
      e.preventDefault();
      if (f.emailBusy) return;
      f.emailBusy = true;
      const btn = form.querySelector('button[type=submit]');
      if (btn) btn.disabled = true;
      try {
        const res = await api('POST', '/public/trial-email', {
          email: emailI.value, name: nameI.value, consentMarketing: !!consentI.checked, answers: funnelAnswersPayload(),
        });
        f.emailMsg = { ok: true, text: res.message || 'Program terkirim.' };
      } catch (err) {
        f.emailMsg = { ok: false, text: err.message || 'Gagal mengirim email' };
      }
      f.emailBusy = false;
      if (btn) btn.disabled = false;
      msg.className = f.emailMsg.ok ? 'callout callout-ok' : 'error-box';
      msg.textContent = f.emailMsg.text;
      msg.style.display = '';
    },
  }, [
    el('div', { class: 'funnel-email-row' }, [
      nameI = el('input', { placeholder: 'Nama', autocomplete: 'name', maxlength: '100' }),
      emailI = el('input', { type: 'email', required: 'true', placeholder: 'email@anda.com', autocomplete: 'email' }),
      el('button', { type: 'submit', class: 'secondary' }, [icon('mail'), 'Kirim']),
    ]),
    el('label', { class: 'funnel-consent' }, [
      consentI = el('input', { type: 'checkbox' }),
      el('span', {}, ['Saya mau menerima tips latihan & penawaran program lewat email (bisa berhenti kapan saja).']),
    ]),
    msg,
  ]);
  return el('section', { class: 'funnel-email card' }, [
    el('h3', {}, [icon('mail'), ' Kirim program ini ke email saya']),
    el('p', { class: 'muted' }, ['Simpan hasilnya dulu — tautan di email bisa dibuka kapan saja untuk melanjutkan.']),
    form,
  ]);
}

function renderFunnelPricing(compact) {
  const f = funnelState();
  const plans = (f.options && f.options.plans) || [];
  const monthly = plans.find((p) => p.id === 'monthly');
  const annual = plans.find((p) => p.id === 'annual');
  const saving = monthly && annual ? Math.round((1 - annual.priceIdr / (monthly.priceIdr * 12)) * 100) : 0;
  const freeFeatures = ['Ringkasan sesi mingguan', 'Target kalori & makro harian', 'Catat latihan, check-in & keluhan', 'Catatan harian Coach AI', '1 pertanyaan Coach AI / hari'];
  const premiumFeatures = ['Detail tiap sesi: repetisi, jarak, pace, istirahat', 'Panduan pemanasan–inti–pendinginan', 'Menu makan mingguan dari pangan lokal', 'Program menyesuaikan beban & progres Anda', '5 pertanyaan Coach AI / hari'];
  const featureList = (arr, ok) => el('ul', { class: 'funnel-price-features' }, arr.map((x) => el('li', {}, [icon(ok ? 'check-circle' : 'check-circle'), x])));
  return el('section', { class: 'landing-section funnel-pricing', id: 'harga' }, [
    el('h2', {}, ['Pilih cara berlatih Anda']),
    compact ? null : el('p', { class: 'landing-section-intro muted' }, ['Mulai gratis. Upgrade saat Anda siap mengikuti program lengkapnya.']),
    el('div', { class: 'funnel-price-grid' }, [
      el('div', { class: 'funnel-price card' }, [
        el('div', { class: 'funnel-price-name' }, ['Gratis']),
        el('div', { class: 'funnel-price-amount' }, [formatIdr(0)]),
        el('div', { class: 'muted' }, ['Selamanya']),
        featureList(freeFeatures, true),
      ]),
      el('div', { class: 'funnel-price card featured' }, [
        el('span', { class: 'funnel-price-flag' }, ['Paling lengkap']),
        el('div', { class: 'funnel-price-name' }, ['Premium']),
        el('div', { class: 'funnel-price-amount' }, [monthly ? formatIdr(monthly.priceIdr) : '—', el('span', { class: 'muted' }, [' /bulan'])]),
        annual ? el('div', { class: 'muted' }, [`atau ${formatIdr(annual.priceIdr)} /tahun${saving > 0 ? ` (hemat ${saving}%)` : ''}`]) : null,
        el('div', { class: 'muted funnel-small', style: 'margin-top:4px;' }, ['Semua fitur Gratis, plus:']),
        featureList(premiumFeatures, true),
        el('button', {
          type: 'button',
          onclick: () => {
            if (funnelState().step === 'result') scrollToSignup();
            else funnelGo('quiz', 0);
          },
        }, [f.options && f.options.trialDays ? `Coba gratis ${f.options.trialDays} hari` : 'Mulai sekarang']),
      ]),
    ]),
  ]);
}

function renderFunnelResult() {
  const f = funnelState();
  const p = f.preview;
  if (!p) { funnelGo('hero'); return el('div'); }
  const evLabel = funnelEventLabel(p);
  const free = (p.sessions || []).find((s) => !s.locked);
  const locked = (p.sessions || []).filter((s) => s.locked);
  const n = p.nutrition;
  const weeksBar = el('div', { class: 'funnel-weeks' }, Array.from({ length: Math.min(p.totalWeeks, 52) }, (_, i) => el('span', {
    class: 'funnel-week' + (i === 0 ? ' open' : ''),
    title: i === 0 ? 'Minggu 1 — terbuka' : `Minggu ${i + 1} — terkunci`,
  })));

  const header = el('section', { class: 'funnel-result-head' }, [
    el('span', { class: 'eyebrow' }, ['Program Anda sudah siap']),
    el('h1', {}, [`Program ${evLabel} · ${p.totalWeeks} minggu`]),
    el('div', { class: 'funnel-result-chips' }, [
      p.phase ? el('span', { class: `badge badge-${p.phase.phase}` }, [`Fase: ${p.phase.label}`]) : null,
      p.level ? el('span', { class: 'badge' }, [p.level]) : null,
      p.targetMode === 'lomba' ? el('span', { class: 'badge' }, [icon('flag'), ` Lomba ${fmtDate(p.periodization.compDate)}`]) : el('span', { class: 'badge' }, ['Siklus progres 12 minggu']),
    ]),
  ]);

  const insightCard = el('div', { class: 'funnel-insight card', id: 'funnel-insight' }, [
    el('div', { class: 'funnel-insight-head' }, [
      el('span', { class: 'funnel-insight-avatar' }, [icon('sparkles')]),
      el('span', { id: 'funnel-insight-label', class: 'funnel-insight-label' }, ['Coach AI']),
    ]),
    el('p', { id: 'funnel-insight-text', class: 'funnel-insight-text typing' }, [f.insight && f.insight.text ? '' : 'Sedang membaca data Anda…']),
  ]);

  const timeline = el('div', { class: 'funnel-block card' }, [
    el('div', { class: 'funnel-block-head' }, [
      el('h3', {}, ['Peta program']),
      el('span', { class: 'muted' }, [`Minggu 1 terbuka · ${p.lockedWeeks} minggu terkunci`]),
    ]),
    weeksBar,
    p.weekFocus ? el('p', { class: 'muted', style: 'margin:10px 0 0;' }, [`Fokus minggu ini: ${p.weekFocus}.`]) : null,
    p.racePrediction ? el('div', { class: 'funnel-prediction' }, [
      icon('timer'),
      el('span', {}, [`Prediksi waktu ${evLabel} saat ini: `, el('strong', {}, [fmtClockShort(p.racePrediction.predictedSec)])]),
      p.estimated && p.estimated.timeTrial ? el('span', { class: 'muted' }, [' (estimasi dari level — catat waktu asli Anda di aplikasi)']) : null,
    ]) : null,
  ]);

  const sessions = el('section', { class: 'funnel-block' }, [
    el('h3', { class: 'funnel-section-title' }, ['Minggu 1']),
    free ? renderFreeSession(free) : el('div', { class: 'card muted' }, [p.note || 'Sesi belum tersedia.']),
    ...locked.map((s) => renderLockedRow(s.name, [s.day, 'detail repetisi, pace & panduan'].filter(Boolean).join(' · '))),
    p.lockedWeeks ? renderLockedRow(`Minggu 2–${p.totalWeeks}`, 'Program berkembang tiap minggu mengikuti fase & catatan latihan Anda') : null,
  ]);

  const nutrition = n && n.available ? el('section', { class: 'funnel-block card' }, [
    el('div', { class: 'funnel-block-head' }, [el('h3', {}, [icon('utensils'), ' Nutrisi harian Anda']), el('span', { class: 'muted' }, [n.phaseLabel ? `Fase ${n.phaseLabel}` : ''])]),
    el('div', { class: 'funnel-macro-grid' }, [
      ['Kalori', `${n.targets.kaloriKcalPerHari}`, 'kkal'],
      ['Karbohidrat', `${n.targets.karbohidratGramPerHari}`, 'g'],
      ['Protein', `${n.targets.proteinGramPerHari}`, 'g'],
      ['Cairan', `${n.targets.airLiterPerHari}`, 'L'],
    ].map(([lbl, v, u]) => el('div', { class: 'funnel-macro' }, [
      el('div', { class: 'funnel-macro-value' }, [v, el('span', {}, [` ${u}`])]),
      el('div', { class: 'muted' }, [lbl]),
    ]))),
    n.menu ? el('div', { class: 'funnel-menu' }, n.menu.slots.map((slot) => (slot.locked
      ? renderLockedRow(slot.label, slot.kcal ? `± ${slot.kcal} kkal` : null)
      : el('div', { class: 'funnel-menu-open' }, [
        el('div', { class: 'funnel-guide-title' }, [`${slot.label} — contoh hari ini`]),
        el('ul', {}, (slot.items || []).map((it) => el('li', {}, [el('span', {}, [it.name]), el('span', { class: 'muted' }, [`${it.grams} g · ${it.kcal} kkal`])]))),
      ])))) : null,
    n.sumberPedoman ? el('p', { class: 'muted funnel-small' }, [n.sumberPedoman]) : null,
  ]) : null;

  return el('div', { class: 'funnel-result' }, [
    header,
    insightCard,
    timeline,
    sessions,
    nutrition,
    renderFunnelSignup(),
    renderFunnelEmail(),
    renderFunnelPricing(true),
    el('p', { class: 'muted funnel-small funnel-disclaimer' }, ['Program & nutrisi adalah estimasi berbasis pedoman latihan dan gizi olahraga — bukan pengganti pemeriksaan atau nasihat medis. Konsultasikan ke dokter bila memiliki kondisi kesehatan tertentu.']),
    el('div', { style: 'text-align:center;margin:8px 0 32px;' }, [
      el('button', { type: 'button', class: 'secondary', onclick: () => funnelGo('quiz', 0) }, [icon('repeat'), 'Ubah jawaban']),
    ]),
  ]);
}

// ---------- Hero & halaman depan ----------
function renderFunnelNav() {
  const f = funnelState();
  return el('header', { class: 'landing-nav' }, [
    el('div', { class: 'landing-nav-inner' }, [
      el('a', { class: 'landing-brand', href: '/', onclick: (e) => { e.preventDefault(); funnelGo('hero'); } }, [brandMark(32), el('span', { class: 'brand', html: 'Atletik <span class="accent">Pro Id</span>' })]),
      el('nav', { class: 'landing-nav-links' }, [
        el('a', { href: '#cara-kerja', onclick: () => { if (f.step !== 'hero') funnelGo('hero'); } }, ['Cara kerja']),
        el('a', { href: '#harga', onclick: () => { if (f.step !== 'hero') funnelGo('hero'); } }, ['Harga']),
        el('a', { href: '#', onclick: (e) => { e.preventDefault(); state.landingMode = 'coach'; render(); window.scrollTo(0, 0); } }, ['Untuk Pelatih']),
      ]),
      el('div', { class: 'funnel-login' }, [
        el('button', { class: 'secondary', onclick: () => { f.loginMenu = !f.loginMenu; render(); } }, ['Masuk']),
        f.loginMenu ? el('div', { class: 'funnel-login-menu card' }, [
          el('a', { href: '/athlete' }, [icon('activity'), 'Masuk sebagai Atlet']),
          el('a', { href: '#', onclick: goToAuth('login') }, [icon('users'), 'Masuk sebagai Pelatih']),
        ]) : null,
      ]),
    ]),
  ]);
}

function renderFunnelHero() {
  const f = funnelState();
  funnelLoadOptions();
  const trialDays = f.options && f.options.trialDays;
  const hero = el('section', { class: 'landing-hero funnel-hero' }, [
    el('div', { class: 'landing-hero-copy' }, [
      el('span', { class: 'eyebrow' }, ['Untuk pelari & atlet penghobi']),
      el('h1', {}, ['Program Latihan & Nutrisi Personal — Siap dalam 60 Detik']),
      el('p', { class: 'landing-lede' }, ['Jawab 7 pertanyaan singkat. Kami susun program latihan periodisasi dan target nutrisi dari data Anda, lalu Anda bisa langsung mencoba sesi pertamanya — gratis.']),
      el('div', { class: 'landing-cta-row' }, [
        el('button', { class: 'funnel-cta', onclick: () => funnelGo('quiz', 0) }, ['Susun program saya', icon('chevron-right')]),
        f.hasResult ? el('button', { class: 'secondary', onclick: () => funnelSubmit() }, ['Lihat lagi hasil saya']) : null,
      ]),
      el('ul', { class: 'funnel-trust' }, [
        el('li', {}, [icon('check-circle'), 'Tanpa daftar untuk melihat hasil']),
        el('li', {}, [icon('check-circle'), trialDays ? `Coba Premium ${trialDays} hari, tanpa kartu kredit` : 'Paket dasar gratis selamanya']),
        el('li', {}, [icon('check-circle'), 'Disusun akademisi fisiologi olahraga']),
      ]),
    ]),
    el('div', { class: 'landing-hero-preview card funnel-hero-preview' }, [
      el('div', { class: 'funnel-insight-head' }, [el('span', { class: 'funnel-insight-avatar' }, [icon('sparkles')]), el('span', { class: 'funnel-insight-label' }, ['Coach AI'])]),
      el('p', { class: 'funnel-insight-text' }, ['“Minggu ini kita bangun fondasi aerobik dulu. Jaga lari Senin tetap di pace ngobrol — itu kunci supaya interval minggu depan terasa ringan.”']),
      el('div', { class: 'row', style: 'margin-top:14px;' }, [el('span', { class: 'muted' }, ['Fase']), el('span', { class: 'badge badge-umum' }, ['Persiapan Umum'])]),
      el('div', { class: 'row', style: 'margin-top:10px;' }, [el('span', { class: 'muted' }, ['Senin']), el('span', {}, ['Tempo Run · 30 mnt · RPE 5'])]),
      el('div', { class: 'row', style: 'margin-top:10px;' }, [el('span', { class: 'muted' }, [icon('utensils'), ' Nutrisi']), el('span', { class: 'badge badge-ok' }, ['2.450 kkal · 2,8 L'])]),
    ]),
  ]);

  const how = el('section', { class: 'landing-section', id: 'cara-kerja' }, [
    el('h2', {}, ['Cara kerjanya']),
    el('div', { class: 'funnel-how' }, [
      ['clipboard', '1. Jawab kuesioner', 'Target, level, catatan waktu, data tubuh, dan pantangan makanan.'],
      ['activity', '2. Program langsung jadi', 'Fase periodisasi, sesi mingguan, pace/target waktu, dan kebutuhan gizi dihitung otomatis.'],
      ['trending-up', '3. Latihan & menyesuaikan', 'Catat RPE setelah latihan — beban & menu menyesuaikan, Coach AI memberi catatan harian.'],
    ].map(([ic, t, d]) => el('div', { class: 'landing-feature-card' }, [
      el('div', { class: 'landing-feature-icon' }, [icon(ic)]),
      el('h3', {}, [t]),
      el('p', { class: 'muted' }, [d]),
    ]))),
    el('div', { style: 'text-align:center;margin-top:28px;' }, [
      el('button', { class: 'funnel-cta', onclick: () => funnelGo('quiz', 0) }, ['Mulai kuesioner', icon('chevron-right')]),
    ]),
  ]);

  const features = el('section', { class: 'landing-section' }, [
    el('h2', {}, ['Seperti punya pelatih di saku Anda']),
    el('div', { class: 'landing-feature-grid' }, [
      ['target', 'Program sesuai nomor Anda', '5K sampai marathon, 800 m, sprint, lompat — masing-masing punya mesin program sendiri.'],
      ['sparkles', 'Coach AI harian', 'Catatan singkat tiap hari dari data latihan, readiness, dan beban Anda. Bisa ditanya juga.'],
      ['utensils', 'Menu dari pangan lokal', 'Target kalori & makro per fase, menu mingguan dari makanan sehari-hari Indonesia.'],
      ['heart', 'Jaga dari cedera', 'Beban latihan dipantau (ACWR); volume otomatis diturunkan saat beban melonjak.'],
    ].map(([ic, t, d]) => el('div', { class: 'landing-feature-card' }, [
      el('div', { class: 'landing-feature-icon' }, [icon(ic)]),
      el('h3', {}, [t]),
      el('p', { class: 'muted' }, [d]),
    ]))),
  ]);

  const faq = el('section', { class: 'landing-section', id: 'faq' }, [
    el('h2', {}, ['Pertanyaan umum']),
    el('div', { class: 'funnel-faq' }, FUNNEL_FAQ.map(([q, a]) => el('details', { class: 'card' }, [
      el('summary', {}, [q]),
      el('p', { class: 'muted' }, [a]),
    ]))),
  ]);

  const team = el('section', { class: 'landing-section landing-team-narrative' }, [
    el('p', { class: 'landing-team-prose muted' }, [
      'Dikembangkan di bawah arahan ', el('strong', {}, [LANDING_TEAM.ketua]), ' bersama ', el('strong', {}, [LANDING_TEAM.anggota.join('; ')]),
      '. Kolaborasi akademisi fisiologi olahraga ini memastikan logika di balik setiap angka program dapat dipertanggungjawabkan secara ilmiah.',
    ]),
  ]);

  const coachBanner = el('section', { class: 'landing-section funnel-coach-banner' }, [
    el('div', {}, [
      el('h3', {}, ['Anda pelatih atletik?']),
      el('p', { class: 'muted' }, ['Kelola banyak atlet, jadwal tes, monitoring cedera, dan ekspor program ke Word.']),
    ]),
    el('button', { class: 'secondary', onclick: () => { state.landingMode = 'coach'; render(); window.scrollTo(0, 0); } }, ['Lihat fitur pelatih', icon('chevron-right')]),
  ]);

  return [hero, how, features, renderFunnelPricing(false), faq, team, coachBanner];
}

function renderFunnelFooter() {
  return el('footer', { class: 'landing-footer' }, [
    el('div', { class: 'landing-brand' }, [brandMark(24), el('span', { class: 'brand', html: 'Atletik <span class="accent">Pro Id</span>' })]),
    el('div', { class: 'landing-footer-links' }, [
      el('a', { href: WA_LINK, target: '_blank', rel: 'noopener noreferrer' }, [icon('message-circle'), 'WhatsApp']),
      el('a', { href: IG_LINK, target: '_blank', rel: 'noopener noreferrer' }, [icon('instagram'), `@${IG_HANDLE}`]),
    ]),
    el('div', { class: 'muted landing-footer-copy' }, [
      `© ${new Date().getFullYear()} Atletik Pro Id. PT Artha Sarana Saintifika bersama Universitas Udayana.`,
    ]),
  ]);
}

function renderFunnel() {
  try {
    document.documentElement.setAttribute('data-ui', 'landing');
    document.documentElement.removeAttribute('data-drawer');
    document.body.style.overflow = '';
    document.body.style.height = '';
  } catch (_) { /* ignore */ }
  const f = funnelState();
  let body;
  if (f.step === 'quiz') body = [renderFunnelQuiz()];
  else if (f.step === 'loading') body = [renderFunnelLoading()];
  else if (f.step === 'result') body = [renderFunnelResult()];
  else body = renderFunnelHero();

  root.innerHTML = '';
  root.appendChild(el('div', { class: 'landing funnel funnel-step-' + f.step }, [
    renderFunnelNav(),
    el('main', { class: 'funnel-main' }, body),
    f.step === 'hero' || f.step === 'result' ? renderFunnelFooter() : null,
  ]));
  if (f.step === 'result' && f.insight && f.insight.text) renderFunnelInsight();
}

/** Buka hasil dari tautan email (?program=TOKEN). */
async function funnelOpenFromLead(token) {
  const f = funnelState();
  try {
    const lead = await api('GET', `/public/trial-lead/${encodeURIComponent(token)}`);
    f.answers = Object.assign({}, lead.answers);
    funnelSave();
    await funnelLoadOptions();
    funnelSubmit();
  } catch (_) {
    render();
  }
}
