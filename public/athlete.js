/* Atletik Pro — Athlete MVP UI */
(function () {
  const root = document.getElementById('root');
  const state = {
    view: 'loading', // auth | invite | home | program | pre | post | progress | injuries
    user: null,
    today: null,
    program: null,
    progress: null,
    injuries: [],
    nutrition: null,
    error: null,
    authMode: 'login',
    // Atlet mandiri
    options: null,       // GET /api/public/quiz-options
    aiDaily: null,       // GET /api/athlete/ai/daily
    ask: null,           // GET /api/athlete/ai/ask
    selfProfile: null,   // GET /api/athlete/self/profile
    toast: null,
    busy: false,
  };

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'html') n.innerHTML = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (attrs[k] === false || attrs[k] == null) { /* skip */ }
        else n.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach((c) => {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return n;
  }

  async function api(method, path, body) {
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (body != null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch('/api/athlete' + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Gagal');
    return data;
  }

  // Endpoint di luar /api/athlete (publik, pembayaran)
  async function apiAbs(method, path, body) {
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (body != null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch('/api' + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Gagal');
    return data;
  }

  function isSelf() {
    return !!(state.user && state.user.selfCoached);
  }

  function premium() {
    return !!(state.user && state.user.access && state.user.access.premium);
  }

  function fmtIdr(n) {
    try { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n); } catch (_) { return 'Rp ' + n; }
  }

  async function loadOptions() {
    if (!state.options) {
      try { state.options = await apiAbs('GET', '/public/quiz-options'); } catch (_) { state.options = null; }
    }
    return state.options;
  }

  async function refreshMe() {
    state.user = await api('GET', '/auth/me');
  }

  function goHomeAfterLink() {
    state.view = state.user.link ? 'home' : 'choose';
  }

  async function boot() {
    try {
      state.user = await api('GET', '/auth/me');
      const params = new URLSearchParams(location.search);
      if (params.has('selamat')) state.toast = 'Program tersimpan. Selamat berlatih! Mulai dari sesi hari ini, lalu catat RPE setelah latihan.';
      if (params.has('bayar')) state.toast = 'Pembayaran diproses. Premium aktif otomatis setelah lunas.';
      if (params.has('selamat') || params.has('bayar')) history.replaceState(null, '', '/athlete');
      if (!state.user.link) {
        state.view = 'choose';
      } else {
        state.view = 'home';
        await loadToday();
      }
    } catch (_) {
      state.user = null;
      state.view = 'auth';
    }
    render();
  }

  async function loadToday() {
    state.today = await api('GET', '/today');
  }

  function setError(e) {
    state.error = e && e.message ? e.message : String(e || 'Error');
    render();
  }

  function clearError() { state.error = null; }

  function renderAuth() {
    const isReg = state.authMode === 'register';
    let name, email, password;
    const form = el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        clearError();
        try {
          if (isReg) {
            state.user = await api('POST', '/auth/register', {
              name: name.value, email: email.value, password: password.value,
            });
          } else {
            state.user = await api('POST', '/auth/login', {
              email: email.value, password: password.value,
            });
          }
          state.user = await api('GET', '/auth/me');
          goHomeAfterLink();
          if (state.user.link) await loadToday();
          render();
        } catch (err) { setError(err); }
      },
    }, [
      state.error ? el('div', { class: 'error' }, [state.error]) : null,
      isReg ? el('div', {}, [el('label', {}, ['Nama']), name = el('input', { required: 'true', autocomplete: 'name' })]) : null,
      el('div', {}, [el('label', {}, ['Email']), email = el('input', { type: 'email', required: 'true', autocomplete: 'email' })]),
      el('div', {}, [el('label', {}, ['Password']), password = el('input', { type: 'password', required: 'true', minlength: '8', autocomplete: isReg ? 'new-password' : 'current-password' })]),
      el('button', { type: 'submit' }, [isReg ? 'Daftar' : 'Masuk']),
    ]);
    return el('div', { class: 'page' }, [
      el('div', { class: 'header-bar' }, [
        el('div', { class: 'brand', html: 'Atletik <span>Pro</span> · Atlet' }),
      ]),
      el('div', { class: 'card' }, [
        el('h2', {}, [isReg ? 'Buat akun atlet' : 'Masuk sebagai atlet']),
        el('p', { class: 'muted' }, ['Akun untuk atlet — berlatih mandiri dengan program otomatis, atau terhubung dengan pelatih lewat kode undangan.']),
        form,
        isReg ? el('p', { class: 'muted', style: 'font-size:0.82rem;margin-top:10px;' }, [
          'Belum punya program? ', el('a', { href: '/?beranda=1' }, ['Susun lewat kuesioner 60 detik']),
        ]) : null,
        el('div', { class: 'row-btns' }, [
          el('button', {
            type: 'button', class: 'ghost',
            onclick: () => { state.authMode = isReg ? 'login' : 'register'; clearError(); render(); },
          }, [isReg ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar']),
        ]),
      ]),
    ]);
  }

  function renderInvite() {
    let code;
    return el('div', { class: 'page' }, [
      el('div', { class: 'header-bar' }, [
        el('div', { class: 'brand', html: 'Atletik <span>Pro</span>' }),
        el('button', {
          class: 'ghost', style: 'width:auto;padding:8px 12px;',
          onclick: async () => { await api('POST', '/auth/logout'); state.user = null; state.view = 'auth'; render(); },
        }, ['Keluar']),
      ]),
      el('div', { class: 'card' }, [
        el('button', { type: 'button', class: 'ghost', style: 'width:auto;padding:6px 10px;margin-bottom:10px;', onclick: () => { state.view = 'choose'; clearError(); render(); } }, ['← Kembali']),
        el('h2', {}, ['Kode undangan']),
        el('p', { class: 'muted' }, ['Minta kode 6 karakter dari pelatih Anda, lalu masukkan di bawah.']),
        state.error ? el('div', { class: 'error' }, [state.error]) : null,
        el('form', {
          onsubmit: async (e) => {
            e.preventDefault();
            clearError();
            try {
              await api('POST', '/auth/accept-invite', { code: code.value });
              state.user = await api('GET', '/auth/me');
              await loadToday();
              state.view = 'home';
              render();
            } catch (err) { setError(err); }
          },
        }, [
          el('label', {}, ['Kode']),
          code = el('input', { required: 'true', placeholder: 'ABC123', style: 'text-transform:uppercase;letter-spacing:0.12em;font-weight:700;' }),
          el('button', { type: 'submit' }, ['Hubungkan']),
        ]),
      ]),
    ]);
  }

  function nav(active) {
    const items = [
      ['home', 'Hari ini'],
      ['program', 'Program'],
      ['nutrition', 'Nutrisi'],
      isSelf() ? ['coach', 'Coach AI'] : null,
      ['progress', 'Progress'],
      ['injuries', 'Keluhan'],
    ].filter(Boolean);
    return el('div', { class: 'bottom-nav' }, items.map(([id, label]) => el('button', {
      class: active === id ? 'active' : '',
      onclick: async () => {
        clearError();
        state.toast = null;
        state.view = id;
        try {
          if (id === 'home') await loadToday();
          if (id === 'program') state.program = await api('GET', '/program');
          if (id === 'nutrition') state.nutrition = await api('GET', '/nutrition');
          if (id === 'progress') state.progress = await api('GET', '/progress');
          if (id === 'injuries') state.injuries = await api('GET', '/injuries');
          if (id === 'coach') state.ask = await api('GET', '/ai/ask');
        } catch (err) { setError(err); }
        render();
      },
    }, [label])));
  }

  // ---------- Atlet mandiri: pilihan awal & setup profil ----------
  function renderChoose() {
    return el('div', { class: 'page' }, [
      el('div', { class: 'header-bar' }, [
        el('div', { class: 'brand', html: 'Atletik <span>Pro</span>' }),
        el('button', {
          class: 'ghost', style: 'width:auto;padding:8px 12px;',
          onclick: async () => { await api('POST', '/auth/logout'); state.user = null; state.view = 'auth'; render(); },
        }, ['Keluar']),
      ]),
      el('h2', {}, ['Bagaimana Anda berlatih?']),
      el('p', { class: 'muted' }, ['Pilih salah satu. Anda tetap bisa terhubung ke pelatih nanti.']),
      el('button', { class: 'choice-card', onclick: () => openSetup() }, [
        el('span', { class: 'choice-title' }, ['Saya berlatih mandiri']),
        el('span', { class: 'choice-desc' }, ['Program & nutrisi disusun otomatis dari profil Anda, dengan Coach AI.']),
      ]),
      el('button', { class: 'choice-card', onclick: () => { state.view = 'invite'; clearError(); render(); } }, [
        el('span', { class: 'choice-title' }, ['Saya punya kode dari pelatih']),
        el('span', { class: 'choice-desc' }, ['Program Anda diatur oleh pelatih.']),
      ]),
    ]);
  }

  async function openSetup() {
    clearError();
    state.view = 'setup';
    render();
    await loadOptions();
    render();
  }

  // Form setup ringkas (versi satu halaman dari kuesioner selling page).
  function renderSetup() {
    const o = state.options;
    if (!o) return el('div', { class: 'page' }, [el('p', { class: 'muted' }, ['Memuat...'])]);
    const f = state.setupForm || (state.setupForm = { kategori: 'jauh', event: '5000m', level: 'pemula', targetMode: 'progres', jenisKelamin: 'L', alergiMakanan: 'Tidak ada', pantanganMakanan: 'Tidak ada' });
    const cat = o.categories[f.kategori];
    const sel = (key, list, onChange) => el('select', {
      onchange: (e) => { f[key] = e.target.value; if (onChange) onChange(); render(); },
    }, list.map(([v, l]) => {
      const opt = el('option', { value: v }, [l]);
      if (String(f[key]) === String(v)) opt.selected = true;
      return opt;
    }));
    const inp = (key, attrs) => el('input', Object.assign({ value: f[key] || '', oninput: (e) => { f[key] = e.target.value; } }, attrs || {}));
    return el('div', { class: 'page' }, [
      el('button', { type: 'button', class: 'ghost', style: 'width:auto;padding:6px 10px;margin-bottom:10px;', onclick: () => { state.view = 'choose'; clearError(); render(); } }, ['← Kembali']),
      el('h2', {}, ['Profil latihan Anda']),
      el('p', { class: 'muted' }, ['Dipakai menyusun program & nutrisi. Bisa diubah kapan saja di Profil.']),
      state.error ? el('div', { class: 'error' }, [state.error]) : null,
      el('div', { class: 'card' }, [
        el('label', {}, ['Kategori']),
        sel('kategori', Object.entries(o.categories).map(([k, c]) => [k, c.label]), () => { f.event = o.categories[f.kategori].events[0].id; }),
        el('label', {}, ['Nomor']),
        sel('event', cat.events.map((e) => [e.id, e.label])),
        el('label', {}, ['Level']),
        sel('level', o.levels.map((l) => [l.id, l.label])),
        el('label', {}, ['Target']),
        sel('targetMode', [['progres', 'Progres 12 minggu (tanpa lomba)'], ['lomba', 'Ada tanggal lomba']]),
        f.targetMode === 'lomba' ? el('div', {}, [el('label', {}, ['Tanggal lomba']), inp('compDate', { type: 'date' })]) : null,
        cat.needsTimeTrial ? el('div', {}, [
          el('label', {}, ['Catatan waktu terbaik (opsional)']),
          el('div', { class: 'two-col' }, [
            sel('ttDistance', [['', 'Jarak…']].concat(o.ttDistances.map((d) => [d, d >= 1000 ? (d / 1000) + ' km' : d + ' m']))),
            inp('ttTime', { placeholder: 'mm:ss' }),
          ]),
        ]) : null,
        cat.needsBest100m ? el('div', {}, [el('label', {}, ['Waktu 100 m terbaik (detik, opsional)']), inp('best100m', { type: 'number', step: '0.01', placeholder: '13.2' })]) : null,
      ]),
      el('div', { class: 'card' }, [
        el('label', {}, ['Jenis kelamin']),
        sel('jenisKelamin', [['L', 'Laki-laki'], ['P', 'Perempuan']]),
        el('div', { class: 'two-col' }, [
          el('div', {}, [el('label', {}, ['Usia']), inp('usia', { type: 'number', min: String(o.minAge || 13) })]),
          el('div', {}, [el('label', {}, ['Berat (kg)']), inp('berat', { type: 'number', step: '0.1' })]),
        ]),
        el('label', {}, ['Tinggi (cm, opsional)']),
        inp('tinggi', { type: 'number' }),
        el('label', {}, ['Alergi makanan']),
        inp('alergiMakanan', { placeholder: 'Tidak ada' }),
        el('label', {}, ['Pantangan makanan']),
        inp('pantanganMakanan', { placeholder: 'Tidak ada / Vegetarian / ...' }),
      ]),
      el('button', {
        type: 'button',
        disabled: state.busy ? 'true' : null,
        onclick: async () => {
          clearError();
          state.busy = true;
          try {
            const body = Object.assign({}, f);
            if (!body.ttDistance) { delete body.ttDistance; delete body.ttTime; }
            await api('POST', '/self/setup', body);
            await refreshMe();
            await loadToday();
            state.toast = 'Program siap. Selamat berlatih!';
            state.view = 'home';
          } catch (err) { state.error = err.message; }
          state.busy = false;
          render();
        },
      }, ['Susun program saya']),
    ]);
  }

  // ---------- Paket & upgrade ----------
  function renderPlanBanner() {
    const a = state.user.access;
    if (!a) return null;
    if (a.plan === 'monthly' || a.plan === 'annual') {
      return (a.subscriptionDaysLeft != null && a.subscriptionDaysLeft <= 5)
        ? el('div', { class: 'plan-banner warn' }, [el('span', {}, [a.message]), el('button', { class: 'mini', onclick: () => openUpgrade() }, ['Perpanjang'])])
        : null;
    }
    return el('div', { class: 'plan-banner' + (a.plan === 'trial' ? '' : ' free') }, [
      el('span', {}, [a.message]),
      el('button', { class: 'mini', onclick: () => openUpgrade() }, [a.plan === 'trial' ? 'Lihat paket' : 'Upgrade']),
    ]);
  }

  function lockedCard(title, desc) {
    return el('div', { class: 'card lock-card' }, [
      el('div', { class: 'session-title' }, ['🔒 ', title]),
      desc ? el('p', { class: 'muted' }, [desc]) : null,
      el('button', { class: 'mini', onclick: () => openUpgrade() }, ['Buka dengan Premium']),
    ]);
  }

  async function openUpgrade() {
    clearError();
    state.view = 'upgrade';
    render();
    await loadOptions();
    render();
  }

  function renderUpgrade() {
    const o = state.options;
    const plans = (o && o.plans) || [];
    const a = state.user.access || {};
    return el('div', { class: 'page' }, [
      el('button', { type: 'button', class: 'ghost', style: 'width:auto;padding:6px 10px;margin-bottom:10px;', onclick: () => { state.view = 'home'; clearError(); render(); } }, ['← Kembali']),
      el('h2', {}, ['Premium Atlet']),
      el('p', { class: 'muted' }, [a.message || '']),
      state.error ? el('div', { class: 'error' }, [state.error]) : null,
      el('div', { class: 'card' }, [
        el('div', { class: 'session-title' }, ['Yang Anda dapat']),
        el('ul', { class: 'guide-list' }, [
          'Detail tiap sesi: repetisi, jarak, pace/target waktu, istirahat',
          'Panduan pemanasan – inti – pendinginan',
          'Menu makan mingguan dari pangan lokal',
          'Tanya Coach AI hingga 5 pertanyaan/hari',
        ].map((x) => el('li', {}, [x]))),
      ]),
      ...plans.map((p) => el('div', { class: 'card plan-card' + (p.id === 'annual' ? ' featured' : '') }, [
        el('div', { class: 'plan-row' }, [
          el('div', {}, [
            el('div', { class: 'session-title' }, [p.name]),
            el('div', { class: 'muted' }, [p.id === 'annual' ? '365 hari akses' : '30 hari akses']),
          ]),
          el('div', { class: 'plan-price' }, [fmtIdr(p.priceIdr)]),
        ]),
        el('button', { disabled: state.busy ? 'true' : null, onclick: () => startCheckout(p.id) }, [p.id === 'annual' ? 'Pilih tahunan' : 'Pilih bulanan']),
      ])),
      el('p', { class: 'muted', style: 'font-size:0.78rem;' }, ['Pembayaran aman via Midtrans (QRIS, e-wallet, VA, kartu).']),
    ]);
  }

  async function startCheckout(planId) {
    clearError();
    state.busy = true;
    render();
    try {
      const session = await apiAbs('POST', '/payments/athlete/create-snap', { plan: planId });
      const src = session.isProduction ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
      let script = document.querySelector('script[data-midtrans-snap]');
      if (!script || script.getAttribute('src') !== src) {
        if (script) script.remove();
        delete window.snap;
        script = document.createElement('script');
        script.src = src;
        script.setAttribute('data-midtrans-snap', '1');
        script.setAttribute('data-client-key', session.clientKey || '');
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error('Gagal memuat Midtrans'));
          document.head.appendChild(script);
        });
      }
      state.busy = false;
      render();
      window.snap.pay(session.token, {
        onSuccess: async () => {
          for (let i = 0; i < 6; i++) {
            try {
              const st = await apiAbs('GET', '/payments/athlete/my-status');
              if (st.access && st.access.premium && st.access.plan !== 'trial') break;
            } catch (_) { /* coba lagi */ }
            await new Promise((r) => setTimeout(r, 900));
          }
          await refreshMe();
          state.toast = state.user.access && state.user.access.premium ? 'Pembayaran berhasil — Premium aktif. Selamat berlatih!' : 'Pembayaran diterima, menunggu konfirmasi.';
          state.view = 'home';
          await loadToday();
          render();
        },
        onPending: () => { state.toast = 'Menunggu pembayaran. Premium aktif otomatis setelah lunas.'; state.view = 'home'; render(); },
        onError: () => setError(new Error('Pembayaran gagal atau dibatalkan.')),
        onClose: () => {},
      });
    } catch (err) {
      state.busy = false;
      setError(err);
    }
  }

  // ---------- Coach AI ----------
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

  function renderAiDailyCard() {
    const textEl = el('p', { class: 'ai-text' + (state.aiDaily ? '' : ' typing') }, [state.aiDaily ? state.aiDaily.text : 'Coach sedang membaca data Anda…']);
    const card = el('div', { class: 'card ai-card' }, [
      el('div', { class: 'ai-head' }, [
        el('span', { class: 'ai-avatar' }, ['✦']),
        el('span', { class: 'ai-label' }, [state.aiDaily && state.aiDaily.source !== 'ai' ? 'Catatan pelatih hari ini' : 'Coach AI · hari ini']),
      ]),
      textEl,
      el('button', {
        class: 'mini secondary', style: 'margin-top:8px;',
        onclick: async () => { clearError(); state.view = 'coach'; try { state.ask = await api('GET', '/ai/ask'); } catch (err) { setError(err); } render(); },
      }, ['Tanya Coach']),
    ]);
    if (!state.aiDaily && !state.aiDailyLoading) {
      state.aiDailyLoading = true;
      api('GET', '/ai/daily').then((d) => {
        state.aiDaily = d;
        state.aiDailyLoading = false;
        const live = document.querySelector('.ai-card .ai-text');
        const label = document.querySelector('.ai-card .ai-label');
        if (label && d.source !== 'ai') label.textContent = 'Catatan pelatih hari ini';
        if (live) { if (d.cached) { live.textContent = d.text; live.classList.remove('typing'); } else typewriter(live, d.text); }
      }).catch(() => {
        state.aiDailyLoading = false;
        const c = document.querySelector('.ai-card');
        if (c) c.remove();
      });
    }
    return card;
  }

  function renderCoach() {
    const q = state.ask || {};
    let input;
    const history = (q.history || []).slice(0, 6);
    return el('div', { class: 'page' }, [
      el('h2', {}, ['Tanya Coach AI']),
      el('p', { class: 'muted' }, [
        q.quota != null ? `Sisa hari ini: ${q.remaining}/${q.quota} pertanyaan.` : '',
        ' Jawaban singkat berdasarkan program & catatan latihan Anda — bukan nasihat medis.',
      ]),
      state.error ? el('div', { class: 'error' }, [state.error]) : null,
      el('div', { class: 'card' }, [
        input = el('textarea', { rows: '3', maxlength: '300', placeholder: 'Contoh: Betis pegal setelah interval kemarin, boleh tetap lari hari ini?' }),
        el('div', { class: 'chips', style: 'margin:0 0 10px;' }, [
          'Apa yang harus dimakan sebelum latihan pagi?',
          'Bagaimana kalau saya melewatkan satu sesi?',
          'Cara tahu pace saya sudah pas?',
        ].map((t) => el('button', { type: 'button', class: 'chip chip-btn', onclick: () => { input.value = t; input.focus(); } }, [t]))),
        el('button', {
          type: 'button',
          disabled: state.busy || (q.remaining === 0) ? 'true' : null,
          onclick: async () => {
            const question = input.value.trim();
            if (question.length < 5) { setError(new Error('Tulis pertanyaan minimal 5 karakter')); return; }
            clearError();
            state.busy = true;
            state.pendingQ = question;
            render();
            try {
              const res = await api('POST', '/ai/ask', { question });
              state.ask = await api('GET', '/ai/ask');
              state.busy = false;
              state.pendingQ = null;
              state.lastAnswerAt = res && res.source === 'ai' ? Date.now() : null;
            } catch (err) {
              state.busy = false;
              state.pendingQ = null;
              state.error = err.message;
            }
            render();
            const first = document.querySelector('.qa-item .qa-a');
            if (first && state.lastAnswerAt) { typewriter(first, first.textContent); state.lastAnswerAt = null; }
          },
        }, [state.busy ? 'Coach sedang mengetik…' : 'Kirim pertanyaan']),
        q.remaining === 0 && !q.premium ? el('button', { class: 'mini', style: 'margin-top:8px;', onclick: () => openUpgrade() }, ['Upgrade untuk bertanya lebih banyak']) : null,
      ]),
      state.pendingQ ? el('div', { class: 'card qa-item' }, [el('div', { class: 'qa-q' }, [state.pendingQ]), el('p', { class: 'qa-a typing' }, [''])]) : null,
      ...history.map((h) => el('div', { class: 'card qa-item' }, [
        el('div', { class: 'qa-q' }, [h.q]),
        el('p', { class: 'qa-a' }, [h.a]),
      ])),
      nav('coach'),
    ]);
  }

  // ---------- Profil atlet mandiri ----------
  async function openProfile() {
    clearError();
    state.view = 'profile';
    render();
    try {
      state.selfProfile = await api('GET', '/self/profile');
      await loadOptions();
    } catch (err) { state.error = err.message; }
    render();
  }

  function renderProfile() {
    const sp = state.selfProfile;
    const a = (state.user && state.user.access) || {};
    const back = el('button', { type: 'button', class: 'ghost', style: 'width:auto;padding:6px 10px;margin-bottom:10px;', onclick: async () => { state.view = 'home'; clearError(); await loadToday(); render(); } }, ['← Kembali']);
    if (!sp) return el('div', { class: 'page' }, [back, state.error ? el('div', { class: 'error' }, [state.error]) : el('p', { class: 'muted' }, ['Memuat...'])]);
    const p = sp.profile;
    const cat = state.options && state.options.categories[p.kategori];
    const f = state.profileForm || (state.profileForm = {
      berat: p.berat, tinggi: p.tinggi, usia: p.usia, compDate: sp.periodization.compDate,
      alergiMakanan: p.alergiMakanan, pantanganMakanan: p.pantanganMakanan, best100m: p.best100mEstimated ? '' : p.best100m,
    });
    const inp = (key, attrs) => el('input', Object.assign({ value: f[key] == null ? '' : f[key], oninput: (e) => { f[key] = e.target.value; } }, attrs || {}));
    return el('div', { class: 'page' }, [
      back,
      el('h2', {}, ['Profil & Paket']),
      state.toast ? el('div', { class: 'toast-ok' }, [state.toast]) : null,
      state.error ? el('div', { class: 'error' }, [state.error]) : null,
      el('div', { class: 'card' }, [
        el('div', { class: 'muted' }, ['Paket']),
        el('div', { class: 'session-title' }, [a.plan === 'trial' ? 'Coba gratis Premium' : a.premium ? 'Premium' : 'Gratis']),
        el('p', { class: 'muted' }, [a.message || '']),
        el('button', { class: 'mini', onclick: () => openUpgrade() }, [a.premium && a.plan !== 'trial' ? 'Perpanjang' : 'Upgrade ke Premium']),
      ]),
      el('div', { class: 'card' }, [
        el('div', { class: 'muted' }, [`${cat ? cat.label : p.kategori} · ${(cat && (cat.events.find((e) => e.id === p.event) || {}).label) || p.event}`]),
        el('div', { class: 'two-col' }, [
          el('div', {}, [el('label', {}, ['Berat (kg)']), inp('berat', { type: 'number', step: '0.1' })]),
          el('div', {}, [el('label', {}, ['Usia']), inp('usia', { type: 'number' })]),
        ]),
        el('label', {}, ['Tinggi (cm)']), inp('tinggi', { type: 'number' }),
        el('label', {}, ['Tanggal lomba / akhir siklus']), inp('compDate', { type: 'date' }),
        cat && cat.needsBest100m ? el('div', {}, [el('label', {}, [`Waktu 100 m (detik)${p.best100mEstimated ? ' — sekarang estimasi' : ''}`]), inp('best100m', { type: 'number', step: '0.01', placeholder: String(p.best100m || '') })]) : null,
        cat && cat.needsTimeTrial ? el('div', {}, [
          el('label', {}, [`Catatan waktu baru${sp.latestTest && sp.latestTest.estimated ? ' (yang sekarang masih estimasi)' : ''}`]),
          el('div', { class: 'two-col' }, [
            el('select', { onchange: (e) => { f.ttDistance = e.target.value; } }, [el('option', { value: '' }, ['Jarak…'])].concat(((state.options && state.options.ttDistances) || []).map((d) => el('option', { value: String(d) }, [d >= 1000 ? (d / 1000) + ' km' : d + ' m'])))),
            inp('ttTime', { placeholder: 'mm:ss' }),
          ]),
        ]) : null,
        el('label', {}, ['Alergi makanan']), inp('alergiMakanan'),
        el('label', {}, ['Pantangan makanan']), inp('pantanganMakanan'),
        el('button', {
          type: 'button',
          onclick: async () => {
            clearError();
            try {
              const body = Object.assign({}, f);
              if (!body.best100m) delete body.best100m;
              if (!body.ttTime) { delete body.ttTime; delete body.ttDistance; }
              state.selfProfile = Object.assign({}, state.selfProfile, await api('PUT', '/self/profile', body));
              state.profileForm = null;
              state.aiDaily = null;
              state.toast = 'Profil disimpan — program & nutrisi dihitung ulang.';
            } catch (err) { state.error = err.message; }
            render();
          },
        }, ['Simpan perubahan']),
      ]),
      el('button', {
        class: 'ghost',
        onclick: async () => { await api('POST', '/auth/logout'); state.user = null; state.view = 'auth'; render(); },
      }, ['Keluar']),
    ]);
  }

  function renderHome() {
    const t = state.today;
    if (!t) return el('div', { class: 'page' }, [el('p', {}, ['Memuat...'])]);
    const st = t.status || {};
    return el('div', { class: 'page' }, [
      el('div', { class: 'header-bar' }, [
        el('div', {}, [
          el('div', { class: 'brand', html: 'Hari ini' }),
          el('div', { class: 'muted' }, [t.athlete.name || '', ' · ', t.date]),
        ]),
        isSelf()
          ? el('button', { class: 'ghost', style: 'width:auto;padding:8px 12px;', onclick: () => openProfile() }, ['Profil'])
          : el('button', {
            class: 'ghost', style: 'width:auto;padding:8px 12px;',
            onclick: async () => { await api('POST', '/auth/logout'); state.user = null; state.view = 'auth'; render(); },
          }, ['Keluar']),
      ]),
      state.toast ? el('div', { class: 'toast-ok' }, [state.toast]) : null,
      state.error ? el('div', { class: 'error' }, [state.error]) : null,
      isSelf() ? renderPlanBanner() : null,
      isSelf() ? renderAiDailyCard() : null,
      el('div', { class: 'card' }, [
        el('div', { class: 'muted' }, ['Status']),
        el('div', { class: 'chips' }, [
          el('span', { class: 'chip' }, [st.preCheckin ? '✓ Check-in pra' : '○ Belum check-in pra']),
          el('span', { class: 'chip' }, [st.postMonitoring ? '✓ Monitoring' : '○ Belum monitoring']),
        ]),
      ]),
      t.nutritionToday ? el('div', { class: t.nutritionKarboLoadingAktif ? 'card card-danger' : 'card' }, [
        el('div', { class: t.nutritionKarboLoadingAktif ? '' : 'muted' }, ['Nutrisi hari ini']),
        el('p', {}, [t.nutritionToday]),
        el('button', {
          class: 'secondary', style: 'width:auto;padding:8px 12px;',
          onclick: async () => {
            clearError();
            state.view = 'nutrition';
            try { state.nutrition = await api('GET', '/nutrition'); } catch (err) { setError(err); }
            render();
          },
        }, ['Lihat detail']),
      ]) : null,
      ...(t.sessions && t.sessions.length
        ? t.sessions.map((s) => el('div', { class: 'card' }, [
          el('div', { class: 'session-title' }, [s.name || 'Sesi']),
          s.goal ? el('p', { class: 'muted' }, [s.goal]) : null,
          el('div', { class: 'chips' }, [
            s.targetRPE != null ? el('span', { class: 'chip' }, ['Target RPE ', s.targetRPE]) : null,
            s.durationMin != null ? el('span', { class: 'chip' }, [s.durationMin, ' mnt']) : null,
            s.volume != null ? el('span', { class: 'chip' }, [s.volume, ' m']) : null,
            s.label ? el('span', { class: 'chip' }, [s.label]) : null,
          ]),
        ]))
        : [el('div', { class: 'card' }, [el('p', { class: 'muted' }, ['Belum ada detail sesi untuk hari ini. Cek tab Program.'])])]),
      el('div', { class: 'row-btns row-btns-sticky' }, [
        el('button', { onclick: () => { state.view = 'pre'; clearError(); render(); } }, ['Check-in sebelum latihan']),
        el('button', { class: 'secondary', onclick: () => { state.view = 'post'; clearError(); render(); } }, ['Isi monitoring setelah latihan']),
      ]),
      nav('home'),
    ]);
  }

  function scaleInput(max, onPick) {
    const wrap = el('div', { class: 'scale-row' });
    for (let i = 1; i <= max; i++) {
      const b = el('button', {
        type: 'button',
        onclick: () => {
          [...wrap.children].forEach((c) => c.classList.remove('on'));
          b.classList.add('on');
          onPick(i);
        },
      }, [String(i)]);
      wrap.appendChild(b);
    }
    return wrap;
  }

  function renderPre() {
    let sleepQuality = null;
    let readiness = null;
    let ateBefore = true;
    let hydration = 'ok';
    let painLocation, painScore, note;
    return el('div', { class: 'page' }, [
      el('h2', {}, ['Check-in pra-latihan']),
      el('p', { class: 'muted' }, ['Tidur 1–5 · Kesiapan 1–10. Isi sebelum mulai latihan.']),
      state.error ? el('div', { class: 'error' }, [state.error]) : null,
      el('div', { class: 'card' }, [
        el('label', {}, ['Kualitas tidur (1–5)']),
        scaleInput(5, (v) => { sleepQuality = v; }),
        el('label', {}, ['Kesiapan / readiness (1–10)']),
        scaleInput(10, (v) => { readiness = v; }),
        el('label', {}, ['Sudah makan sebelum latihan?']),
        el('div', { class: 'scale-row' }, [
          el('button', { type: 'button', class: 'on', onclick: function () { ateBefore = true; this.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('on')); this.classList.add('on'); } }, ['Ya']),
          el('button', { type: 'button', onclick: function () { ateBefore = false; this.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('on')); this.classList.add('on'); } }, ['Tidak']),
        ]),
        el('label', {}, ['Hidrasi']),
        el('div', { class: 'scale-row' }, [
          el('button', { type: 'button', onclick: function () { hydration = 'poor'; this.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('on')); this.classList.add('on'); } }, ['Buruk']),
          el('button', { type: 'button', class: 'on', onclick: function () { hydration = 'ok'; this.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('on')); this.classList.add('on'); } }, ['Cukup']),
          el('button', { type: 'button', onclick: function () { hydration = 'good'; this.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('on')); this.classList.add('on'); } }, ['Baik']),
        ]),
        el('label', {}, ['Nyeri / keluhan (opsional)']),
        painLocation = el('input', { placeholder: 'Mis. bahu kiri' }),
        el('label', {}, ['Skala nyeri 0–10 (opsional)']),
        painScore = el('input', { type: 'number', min: '0', max: '10', placeholder: '0–10' }),
        el('label', {}, ['Catatan']),
        note = el('input', { placeholder: 'Opsional', maxlength: '200' }),
        el('button', {
          type: 'button',
          onclick: async () => {
            clearError();
            if (!sleepQuality || !readiness) {
              setError(new Error('Pilih kualitas tidur dan readiness'));
              return;
            }
            try {
              await api('POST', '/wellness', {
                type: 'pre_session',
                sleepQuality,
                readiness,
                ateBefore,
                hydration,
                painLocation: painLocation.value || undefined,
                painScore: painScore.value || undefined,
                note: note.value || undefined,
              });
              await loadToday();
              state.view = 'home';
              render();
            } catch (err) { setError(err); }
          },
        }, ['Simpan check-in']),
        el('button', { type: 'button', class: 'ghost', style: 'margin-top:8px;', onclick: () => { state.view = 'home'; clearError(); render(); } }, ['Batal']),
      ]),
    ]);
  }

  function renderPost() {
    let rpe, duration, distance, shoulder, note, programMatch = 'yes';
    return el('div', { class: 'page' }, [
      el('h2', {}, ['Monitoring pasca-latihan']),
      el('p', { class: 'muted' }, [isSelf() ? 'RPE × durasi dipakai menyesuaikan beban program Anda.' : 'RPE × durasi dipakai hitung ACWR di sisi pelatih.']),
      state.error ? el('div', { class: 'error' }, [state.error]) : null,
      el('div', { class: 'card' }, [
        el('label', {}, ['RPE aktual (0–10)']),
        rpe = el('input', { type: 'number', min: '0', max: '10', step: '0.5', required: 'true', placeholder: '7' }),
        el('label', {}, ['Durasi (menit)']),
        duration = el('input', { type: 'number', min: '1', max: '600', required: 'true', placeholder: '70' }),
        el('label', {}, ['Jarak (meter, opsional)']),
        distance = el('input', { type: 'number', min: '0', placeholder: '3500' }),
        el('label', {}, ['Nyeri 0–10 (opsional)']),
        shoulder = el('input', { type: 'number', min: '0', max: '10', placeholder: '0' }),
        el('label', {}, ['Sesi sesuai program?']),
        el('div', { class: 'scale-row' }, [
          el('button', { type: 'button', class: 'on', onclick: function () { programMatch = 'yes'; this.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('on')); this.classList.add('on'); } }, ['Ya']),
          el('button', { type: 'button', onclick: function () { programMatch = 'partial'; this.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('on')); this.classList.add('on'); } }, ['Sebagian']),
          el('button', { type: 'button', onclick: function () { programMatch = 'no'; this.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('on')); this.classList.add('on'); } }, ['Tidak']),
        ]),
        el('label', {}, ['Catatan']),
        note = el('input', { maxlength: '200', placeholder: 'Opsional' }),
        el('button', {
          type: 'button',
          onclick: async () => {
            clearError();
            try {
              await api('POST', '/monitoring', {
                rpe: rpe.value,
                durationMin: duration.value,
                                painScore: shoulder.value || undefined,
                programMatch,
                note: note.value || undefined,
              });
              await loadToday();
              state.view = 'home';
              render();
            } catch (err) { setError(err); }
          },
        }, ['Simpan monitoring']),
        el('button', { type: 'button', class: 'ghost', style: 'margin-top:8px;', onclick: () => { state.view = 'home'; clearError(); render(); } }, ['Batal']),
      ]),
    ]);
  }

  function sessionChips(s) {
    return el('div', { class: 'chips' }, [
      s.durationMin != null || s.durMin != null ? el('span', { class: 'chip' }, [s.durationMin || s.durMin, ' mnt']) : null,
      s.reps != null && (s.dist || s.repDist) ? el('span', { class: 'chip' }, [s.reps, ' × ', s.dist || s.repDist, ' m']) : null,
      s.sets != null ? el('span', { class: 'chip' }, [s.sets, ' set × ', s.repsPerSet]) : null,
      s.paceLabel ? el('span', { class: 'chip' }, ['pace ', s.paceLabel]) : null,
      s.timeLabel ? el('span', { class: 'chip' }, [s.timeLabel]) : null,
      s.repTimeLabel ? el('span', { class: 'chip' }, [s.repTimeLabel, ' / rep']) : null,
      s.targetRPE != null ? el('span', { class: 'chip' }, ['RPE ', s.targetRPE]) : null,
    ]);
  }

  function guideBlock(title, items) {
    return el('div', { class: 'guide-block' }, [
      el('div', { class: 'guide-title' }, [title]),
      el('ul', { class: 'guide-list' }, items.map((x) => el('li', {}, [x]))),
    ]);
  }

  // Program atlet mandiri: Premium dapat detail + panduan; gratis dapat ringkasan terkunci.
  function renderSelfProgram(p) {
    const sessions = p.sessions || [];
    return el('div', { class: 'page' }, [
      el('h2', {}, ['Program minggu ini']),
      el('p', { class: 'muted' }, [
        p.phase && p.phase.label ? 'Fase: ' + p.phase.label : '',
        p.weekPlan && p.weekPlan.label ? ' · Fokus: ' + p.weekPlan.label : '',
        p.periodization ? ' · Target: ' + p.periodization.compDate : '',
      ]),
      state.error ? el('div', { class: 'error' }, [state.error]) : null,
      p.note ? el('div', { class: 'warn-box' }, [p.note]) : null,
      ...sessions.map((s) => (s.locked
        ? el('div', { class: 'card lock-card' }, [
          el('div', { class: 'session-title' }, ['🔒 ', s.name || 'Sesi']),
          el('p', { class: 'muted' }, [[s.day, s.goal].filter(Boolean).join(' · ')]),
          sessionChips(s),
          el('button', { class: 'mini', onclick: () => openUpgrade() }, ['Buka detail & panduan']),
        ])
        : el('div', { class: 'card' }, [
          el('div', { class: 'muted' }, [s.day || '', s.label ? ' · ' + s.label : '']),
          el('div', { class: 'session-title' }, [s.name || 'Sesi']),
          s.goal ? el('p', { class: 'muted' }, [s.goal]) : null,
          sessionChips(s),
          s.guide ? el('details', { class: 'guide' }, [
            el('summary', {}, ['Cara melakukan']),
            guideBlock('Pemanasan', s.guide.warmup),
            guideBlock('Inti', s.guide.main),
            guideBlock('Pendinginan', s.guide.cooldown),
            s.guide.tip ? el('p', { class: 'muted', style: 'font-size:0.8rem;' }, [s.guide.tip]) : null,
          ]) : null,
        ]))),
      p.premium && p.strengthBank && p.strengthBank.length ? el('div', { class: 'card' }, [
        el('h3', {}, ['Latihan penunjang fase ini']),
        el('ul', { class: 'guide-list' }, p.strengthBank.map((x) => el('li', {}, [x]))),
      ]) : null,
      p.premium && p.techniqueChecklist && p.techniqueChecklist.length ? el('div', { class: 'card' }, [
        el('h3', {}, ['Fokus teknik']),
        el('ul', { class: 'guide-list' }, p.techniqueChecklist.map((x) => el('li', {}, [x]))),
      ]) : null,
      nav('program'),
    ]);
  }

  function renderProgram() {
    const p = state.program;
    if (p && p.selfCoached) return renderSelfProgram(p);
    return el('div', { class: 'page' }, [
      el('h2', {}, ['Program']),
      p ? el('p', { class: 'muted' }, [
        'Akses: ', p.programAccess === 'full' ? 'penuh' : 'pengingat (ringkas)',
        p.phase && p.phase.label ? ' · Fase: ' + p.phase.label : '',
      ]) : null,
      state.error ? el('div', { class: 'error' }, [state.error]) : null,
      ...(p && p.sessions && p.sessions.length
        ? p.sessions.map((s) => el('div', { class: 'card' }, [
          el('div', { class: 'session-title' }, [s.name || 'Sesi']),
          s.goal ? el('p', { class: 'muted' }, [s.goal]) : null,
          el('div', { class: 'chips' }, [
            s.targetRPE != null ? el('span', { class: 'chip' }, ['RPE ', s.targetRPE]) : null,
            s.durationMin != null ? el('span', { class: 'chip' }, [s.durationMin, ' mnt']) : null,
            s.volume != null ? el('span', { class: 'chip' }, [s.volume, ' m']) : null,
          ]),
        ]))
        : [el('div', { class: 'card' }, [el('p', { class: 'muted' }, ['Program belum tersedia.'])])]),
      nav('program'),
    ]);
  }

  // Kartu "Menu minggu ini" — dulu HANYA ada di Command Center pelatih
  // (app.js renderNutritionWeekCard, lewat GET /athletes/:id/nutrition yang
  // menyertakan weekMenu). Endpoint atlet (GET /api/athlete/nutrition) belum
  // ikut mengirim weekMenu, jadi kartu ini tidak pernah tampil di aplikasi
  // atlet — sekarang dipakai bareng field weekMenu yang sudah ditambahkan di
  // routes/athleteApp.js. Susun-ulang menu tetap wewenang pelatih (tidak ada
  // tombol "Susun ulang" di sini).
  const MEAL_SLOT_LABEL = {
    breakfast: 'Sarapan (Pagi)',
    pre: 'Sebelum latihan',
    post: 'Setelah latihan',
    dinner: 'Makan malam',
  };
  function renderNutritionWeek(week) {
    if (!week) return null;
    const today = week.todayMenu;
    const children = [
      el('h3', {}, ['Menu minggu ini']),
      el('p', { class: 'muted', style: 'font-size:0.78rem;margin:-4px 0 8px;' }, [
        `${week.weekStart} – ${week.weekEnd}`,
        today && today.mode === 'recovery' ? ' · Mode pemulihan' : '',
      ]),
    ];
    if (week.injuryPackage) {
      children.push(el('div', { class: 'warn-box', style: 'margin-bottom:10px;' }, [
        el('p', { style: 'margin:0;font-size:0.85rem;' }, [
          `Paket menu pemulihan cedera aktif s/d ${week.injuryPackage.end || '—'}`,
          week.injuryPackage.location ? ` (${week.injuryPackage.location})` : '',
          '.',
        ]),
      ]));
    }
    if (!today || !today.available) {
      children.push(el('p', { class: 'muted' }, [(today && today.reason) || 'Menu hari ini belum tersedia.']));
      return el('div', { class: 'card' }, children);
    }
    children.push(el('p', { class: 'muted', style: 'font-size:0.82rem;' }, [
      `Hari ini · target ~${today.targetKcal || '—'} kkal · susunan ~${today.totals ? today.totals.kcal : '—'} kkal`,
    ]));
    (today.slots || []).forEach((slot) => {
      children.push(el('div', { class: 'meal-slot' }, [
        el('div', { class: 'meal-slot-head' }, [
          el('span', {}, [MEAL_SLOT_LABEL[slot.key] || slot.label]),
          slot.totals ? el('span', { class: 'muted' }, [`~${slot.totals.kcal} kkal`]) : null,
        ]),
        el('ul', { class: 'meal-slot-items' }, (slot.items || []).map((it) => el('li', {}, [
          el('span', {}, [it.name]),
          el('span', { class: 'muted' }, [`${it.grams} g · ${it.kcal} kkal`]),
        ]))),
      ]));
    });
    const rest = (week.days || []).filter((d) => d.date > week.today && d.available);
    if (rest.length) {
      children.push(el('details', { style: 'margin-top:6px;' }, [
        el('summary', { class: 'muted', style: 'font-size:0.82rem;' }, ['Sisa menu minggu ini']),
        el('ul', { class: 'meal-slot-items', style: 'margin-top:6px;' }, rest.map((d) => el('li', {}, [
          el('span', {}, [d.date]),
          el('span', { class: 'muted' }, [`~${d.totals ? d.totals.kcal : '—'} kkal${d.mode === 'recovery' ? ' (pemulihan)' : ''}`]),
        ]))),
      ]));
    }
    children.push(el('p', { class: 'muted', style: 'font-size:0.72rem;margin-top:8px;margin-bottom:0;' }, [
      isSelf()
        ? 'Estimasi dari target Anda & database pangan lokal — bukan resep medis. Menu diperbarui otomatis tiap minggu.'
        : 'Estimasi dari target Anda & database pangan lokal — bukan resep medis. Menu disusun/diperbarui oleh pelatih.',
    ]));
    return el('div', { class: 'card' }, children);
  }

  function renderNutrition() {
    const p = state.nutrition;
    if (!p) {
      return el('div', { class: 'page' }, [
        el('h2', {}, ['Nutrisi']),
        el('div', { class: 'card' }, [el('p', { class: 'muted' }, ['Memuat...'])]),
        nav('nutrition'),
      ]);
    }
    if (!p.available) {
      return el('div', { class: 'page' }, [
        el('h2', {}, ['Nutrisi']),
        el('div', { class: 'card' }, [
          el('p', { class: 'muted' }, [p.reason || 'Rencana nutrisi belum bisa dihitung. Minta pelatih melengkapi profil Anda.']),
        ]),
        nav('nutrition'),
      ]);
    }
    const t = p.targets || {};
    return el('div', { class: 'page' }, [
      el('h2', {}, ['Nutrisi']),
      p.phaseLabel ? el('p', { class: 'muted' }, ['Fase: ', p.phaseLabel]) : null,
      el('div', { class: 'card' }, [
        p.ringkasanSingkat ? el('div', { class: 'session-title' }, [p.ringkasanSingkat]) : null,
        el('div', { class: 'chips' }, [
          t.kaloriKcalPerHari != null ? el('span', { class: 'chip' }, [String(Math.round(t.kaloriKcalPerHari)), ' kkal']) : null,
          t.karbohidratGramPerHari != null ? el('span', { class: 'chip' }, ['Karbo ', t.karbohidratGramPerHari, ' g']) : null,
          t.proteinGramPerHari != null ? el('span', { class: 'chip' }, ['Protein ', t.proteinGramPerHari, ' g']) : null,
          t.lemakPersenKalori != null ? el('span', { class: 'chip' }, ['Lemak ', t.lemakPersenKalori, '%']) : null,
          t.airLiterPerHari != null ? el('span', { class: 'chip' }, ['Air ', t.airLiterPerHari, ' L']) : null,
        ]),
      ]),
      state.nutrition.weekMenuLocked
        ? lockedCard('Menu makan mingguan', 'Menu sarapan, sebelum & setelah latihan, dan makan malam tiap hari — disusun dari pangan lokal sesuai target & pantangan Anda.')
        : renderNutritionWeek(state.nutrition.weekMenu),
      p.contohMenuHarian && p.contohMenuHarian.length ? el('div', { class: 'card' }, [
        el('h3', {}, ['Contoh menu harian']),
        ...p.contohMenuHarian.map((m) => el('p', {}, [m])),
      ]) : null,
      p.peringatanKhusus && p.peringatanKhusus.length ? el('div', { class: 'warn-box' }, [
        ...p.peringatanKhusus.map((w) => el('p', { style: 'margin:0;' }, [w])),
      ]) : null,
      p.sumberPedoman ? el('p', { class: 'muted', style: 'font-size:0.75rem;' }, [p.sumberPedoman]) : null,
      nav('nutrition'),
    ]);
  }

  function renderProgress() {
    const p = state.progress || {};
    const badgeClass = p.acwrBadge === 'Aman' ? 'ok' : (p.acwrBadge === 'Waspada' ? 'warn' : (p.acwrBadge === 'Risiko tinggi' ? 'risk' : ''));
    return el('div', { class: 'page' }, [
      el('h2', {}, ['Progress']),
      el('div', { class: 'card' }, [
        el('div', { class: 'muted' }, ['Status beban']),
        el('p', {}, [el('span', { class: 'badge ' + badgeClass }, [p.acwrBadge || '—'])]),
        el('p', { class: 'muted' }, [
          'Monitoring: ', String(p.monitoringDays || 0), ' hari · ',
          String(p.logsLast7 || 0), ' log / 7 hari',
        ]),
      ]),
      el('div', { class: 'card' }, [
        el('h3', {}, ['Tes terakhir']),
        ...(p.tests && p.tests.length
          ? p.tests.map((t) => el('p', {}, [t.date, t.label ? ' · ' + t.label : '']))
          : [el('p', { class: 'muted' }, ['Belum ada tes'])]),
      ]),
      nav('progress'),
    ]);
  }

  function renderInjuries() {
    let location, score;
    return el('div', { class: 'page' }, [
      el('h2', {}, ['Keluhan / cedera']),
      el('p', { class: 'muted' }, ['Skrining untuk pelatih — bukan diagnosis medis.']),
      state.error ? el('div', { class: 'error' }, [state.error]) : null,
      el('div', { class: 'card' }, [
        el('label', {}, ['Lokasi']),
        location = el('input', { placeholder: 'Contoh: bahu kiri' }),
        el('label', {}, ['Skala 0–10']),
        score = el('input', { type: 'number', min: '0', max: '10', value: '3' }),
        el('button', {
          type: 'button',
          onclick: async () => {
            clearError();
            try {
              await api('POST', '/injuries', { location: location.value, score: score.value });
              state.injuries = await api('GET', '/injuries');
              render();
            } catch (err) { setError(err); }
          },
        }, ['Tambah keluhan']),
      ]),
      ...(state.injuries || []).map((i) => el('div', { class: 'card' }, [
        el('div', { class: 'session-title' }, [i.location, ' · ', i.score, '/10']),
        el('span', { class: 'badge' }, [i.status]),
        i.status !== 'resolved' ? el('button', {
          class: 'secondary', style: 'margin-top:8px;',
          onclick: async () => {
            await api('PATCH', '/injuries/' + i.id, { status: 'resolved' });
            state.injuries = await api('GET', '/injuries');
            render();
          },
        }, ['Tandai sembuh']) : null,
      ])),
      nav('injuries'),
    ]);
  }

  function render() {
    root.innerHTML = '';
    let node;
    if (state.view === 'loading') node = el('div', { class: 'page' }, [el('p', { class: 'muted' }, ['Memuat...'])]);
    else if (state.view === 'auth') node = renderAuth();
    else if (state.view === 'invite') node = renderInvite();
    else if (state.view === 'choose') node = renderChoose();
    else if (state.view === 'setup') node = renderSetup();
    else if (state.view === 'upgrade') node = renderUpgrade();
    else if (state.view === 'coach') node = renderCoach();
    else if (state.view === 'profile') node = renderProfile();
    else if (state.view === 'pre') node = renderPre();
    else if (state.view === 'post') node = renderPost();
    else if (state.view === 'program') node = renderProgram();
    else if (state.view === 'nutrition') node = renderNutrition();
    else if (state.view === 'progress') node = renderProgress();
    else if (state.view === 'injuries') node = renderInjuries();
    else node = renderHome();
    root.appendChild(node);
  }

  boot();
})();
