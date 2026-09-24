/**
 * Evaluasi override sesi terhadap ACWR, frekuensi ideal, dan fase.
 * Feedback bisa CONFIRMing atau WARNING — bukan hanya negatif.
 */
const { getLibraryItem } = require('./sessionLibrary');

function countLibraryInWeek(overrides, libraryId, excludeId) {
  return (overrides || []).filter(
    (o) => o.libraryId === libraryId && o.id !== excludeId && o.status !== 'cleared'
  ).length;
}

/**
 * @param {object} opts
 * @param {string} opts.libraryId
 * @param {object|null} opts.acwr - hasil computeACWR
 * @param {string|null} opts.phase - umum|khusus|puncak|transisi
 * @param {object[]} opts.weekOverrides - override lain di minggu yang sama
 * @param {number|null} opts.excludeOverrideId
 * @param {number|null} opts.targetRPE
 * @param {boolean} opts.hasActiveShoulderPain
 */
function evaluateOverride(opts) {
  const item = getLibraryItem(opts.libraryId);
  if (!item) {
    return {
      level: 'neutral',
      title: 'Tersimpan sebagai penyesuaian manual',
      messages: ['Item katalog tidak dikenali — pastikan RPE & durasi diisi.'],
    };
  }

  const messages = [];
  let level = 'confirm'; // confirm | neutral | warn | risk
  const acwr = opts.acwr;
  const acwrVal = acwr && acwr.eligible && acwr.acwr != null ? acwr.acwr : null;
  const rpe = opts.targetRPE != null ? Number(opts.targetRPE) : item.defaultTargetRPE;
  const sameTypeCount = countLibraryInWeek(opts.weekOverrides, item.id, opts.excludeOverrideId) + 1; // termasuk yang akan disimpan
  const ideal = item.idealPerWeek || { min: 0, max: 7 };

  // --- Frekuensi ---
  if (sameTypeCount >= ideal.min && sameTypeCount <= ideal.max) {
    messages.push(`Frekuensi “${item.label}” dalam rentang ideal minggu ini (${sameTypeCount}×, ideal ${ideal.min}–${ideal.max}×).`);
  } else if (sameTypeCount > ideal.max) {
    messages.push(`“${item.label}” sudah ${sameTypeCount}× minggu ini (ideal maks ${ideal.max}×).`);
    level = bump(level, 'warn');
  } else if (ideal.min > 0 && sameTypeCount < ideal.min) {
    // still ok - building up
    messages.push(`“${item.label}”: ${sameTypeCount}× minggu ini (ideal ${ideal.min}–${ideal.max}×) — masih dalam proses memenuhi dosis.`);
  }

  // --- ACWR vs intensitas ---
  if (acwrVal != null) {
    if (acwrVal > 1.5 && item.intensityClass === 'hard') {
      messages.push(`ACWR ${acwrVal.toFixed(2)} (risiko tinggi) — sesi berat kurang selaras; pertimbangkan recovery/teknik.`);
      level = bump(level, 'risk');
    } else if (acwrVal > 1.5 && item.intensityClass === 'easy') {
      messages.push(`ACWR ${acwrVal.toFixed(2)} tinggi — pilihan sesi ringan/recovery selaras kaidah beban.`);
      level = bump(level, 'confirm');
    } else if (acwrVal > 1.3 && acwrVal <= 1.5 && item.intensityClass === 'hard') {
      messages.push(`ACWR ${acwrVal.toFixed(2)} (waspada) — sesi berat boleh jika disengaja; pantau pemulihan.`);
      level = bump(level, 'warn');
    } else if (acwrVal > 1.3 && item.intensityClass === 'easy') {
      messages.push(`ACWR ${acwrVal.toFixed(2)} waspada — sesi mudah/recovery mendukung pengelolaan beban.`);
      level = bump(level, 'confirm');
    } else if (acwrVal >= 0.8 && acwrVal <= 1.3) {
      messages.push(`ACWR ${acwrVal.toFixed(2)} di sweet spot — ruang aman untuk penyesuaian sesi ini.`);
      level = bump(level, 'confirm');
    } else if (acwrVal < 0.8 && item.intensityClass === 'hard') {
      messages.push(`ACWR ${acwrVal.toFixed(2)} masih rendah — penambahan stimulus (threshold/speed) dapat selaras progres.`);
      level = bump(level, 'confirm');
    } else if (acwrVal < 0.8 && item.intensityClass === 'easy') {
      messages.push(`ACWR ${acwrVal.toFixed(2)} rendah — sesi sangat ringan menjaga undertraining lebih lama.`);
      level = bump(level, 'neutral');
    }
  } else {
    messages.push('ACWR belum eligible (<14 hari log) — feedback beban terbatas; tetap isi monitoring.');
    level = bump(level, 'neutral');
  }

  // --- RPE vs kelas intensitas ---
  if (rpe >= 9 && item.intensityClass !== 'hard') {
    messages.push(`Target RPE ${rpe} tinggi untuk jenis “${item.label}” — pastikan ini disengaja.`);
    level = bump(level, 'warn');
  }
  if (rpe <= 4 && item.intensityClass === 'hard') {
    messages.push(`RPE ${rpe} rendah untuk label sesi berat — atau sesuaikan jenis latihan.`);
    level = bump(level, 'neutral');
  }

  // --- Nyeri bahu ---
  if (opts.hasActiveShoulderPain && (item.id === 'dryland' || item.intensityClass === 'hard')) {
    messages.push('Ada keluhan nyeri aktif — sesi berat berisiko memperburuk; utamakan teknik/recovery.');
    level = bump(level, 'risk');
  } else if (opts.hasActiveShoulderPain && (item.id === 'technique' || item.id === 'recovery_easy')) {
    messages.push('Keluhan bahu aktif — pilihan teknik/recovery selaras prinsip hati-hati.');
    level = bump(level, 'confirm');
  }

  // --- Fase ---
  const phase = opts.phase;
  if (phase === 'puncak' && item.intensityClass === 'hard' && item.id !== 'race_pace') {
    messages.push('Fase puncak: volume berat non-race perlu selektif; race pace lebih spesifik.');
    level = bump(level, 'neutral');
  }
  if (phase === 'transisi' && item.intensityClass === 'hard') {
    messages.push('Fase transisi — sesi berat jarang menjadi prioritas.');
    level = bump(level, 'warn');
  }
  if (phase === 'transisi' && item.intensityClass === 'easy') {
    messages.push('Fase transisi — sesi ringan/recovery selaras tujuan regenerasi.');
    level = bump(level, 'confirm');
  }

  if (messages.length === 0) {
    messages.push('Penyesuaian manual tercatat.');
    level = 'neutral';
  }

  const titles = {
    confirm: 'Pilihan selaras kaidah',
    neutral: 'Tersimpan sebagai penyesuaian manual',
    warn: 'Deviasi ringan — pantau respons atlet',
    risk: 'Menyimpang dari rujukan beban — lanjut jika disengaja',
  };

  return {
    level,
    title: titles[level] || titles.neutral,
    messages,
    libraryId: item.id,
    libraryLabel: item.label,
  };
}

function bump(current, next) {
  const order = { confirm: 0, neutral: 1, warn: 2, risk: 3 };
  return order[next] >= order[current] ? next : current;
}

function applyOverridesToSessions(sessions, overridesForWeek) {
  if (!sessions || !sessions.length) {
    return [];
  }
  const list = (overridesForWeek || []).filter((o) => o && o.status !== 'cleared' && o.kind !== 'extra');
  return sessions.map((s, i) => {
    const ov = list.find((o) => Number(o.sessionIndex) === i)
      || list.find((o) => o.sessionKey && s.key && o.sessionKey === s.key)
      || list.find((o) => o.sessionKey && s.label && o.sessionKey === s.label);
    if (!ov) return { ...s, sessionIndex: i, override: null };
    return {
      ...s,
      sessionIndex: i,
      name: ov.name || s.name,
      goal: ov.goal != null ? ov.goal : s.goal,
      targetRPE: ov.targetRPE != null ? ov.targetRPE : s.targetRPE,
      durationMin: ov.durationMin != null ? ov.durationMin : (s.durationMin != null ? s.durationMin : s.durMin),
      volume: ov.volume != null ? ov.volume : s.volume,
      // mode generik agar UI menampilkan RPE/durasi override
      mode: s.mode || 'override',
      override: {
        id: ov.id,
        libraryId: ov.libraryId,
        manual: true,
        kind: ov.kind || 'replace',
        evaluation: ov.evaluation || null,
        note: ov.note || null,
      },
    };
  });
}

module.exports = {
  evaluateOverride,
  applyOverridesToSessions,
};
