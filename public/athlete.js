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

  async function boot() {
    try {
      state.user = await api('GET', '/auth/me');
      if (!state.user.link) {
        state.view = 'invite';
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
          state.view = state.user.link ? 'home' : 'invite';
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
        el('p', { class: 'muted' }, ['Bukan akun pelatih. Setelah masuk, hubungkan dengan kode undangan pelatih.']),
        form,
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
      ['progress', 'Progress'],
      ['injuries', 'Keluhan'],
    ];
    return el('div', { class: 'bottom-nav' }, items.map(([id, label]) => el('button', {
      class: active === id ? 'active' : '',
      onclick: async () => {
        clearError();
        state.view = id;
        try {
          if (id === 'home') await loadToday();
          if (id === 'program') state.program = await api('GET', '/program');
          if (id === 'nutrition') state.nutrition = await api('GET', '/nutrition');
          if (id === 'progress') state.progress = await api('GET', '/progress');
          if (id === 'injuries') state.injuries = await api('GET', '/injuries');
        } catch (err) { setError(err); }
        render();
      },
    }, [label])));
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
        el('button', {
          class: 'ghost', style: 'width:auto;padding:8px 12px;',
          onclick: async () => { await api('POST', '/auth/logout'); state.user = null; state.view = 'auth'; render(); },
        }, ['Keluar']),
      ]),
      state.error ? el('div', { class: 'error' }, [state.error]) : null,
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
      el('p', { class: 'muted' }, ['Sleep 1–5 · Readiness 1–10. Isi sebelum masuk air.']),
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
      el('p', { class: 'muted' }, ['RPE × durasi dipakai hitung ACWR di sisi pelatih.']),
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

  function renderProgram() {
    const p = state.program;
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
      'Estimasi dari target Anda & database pangan lokal — bukan resep medis. Menu disusun/diperbarui oleh pelatih.',
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
      renderNutritionWeek(state.nutrition.weekMenu),
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
