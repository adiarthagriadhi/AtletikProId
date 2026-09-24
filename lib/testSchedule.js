// Jadwal tes berikutnya — tes terakhir + interval fase.
// Pelatih tetap memutuskan hari pelaksanaan. Dasar singkat:
// mesosiklus 4 minggu (kurva app), residual aerobic ~30 hari (Issurin),
// field test di batas blok (bukan tes mingguan), taper 8–14 hari tanpa
// tes maksimal di 5 hari terakhir (Bosquet / meta taper).
// Time trial lebih jarang dari sprint/lompat karena adaptasi aerobik lebih lambat.

const { CATEGORIES } = require('./categories');
const { computePhase } = require('./periodization');
const { localDateKey } = require('./dateUtil');

const PROTOCOL_META = {
  sprint: {
    shortLabel: 'Tes lapangan Sprint',
    label: 'Tes lapangan (RAST, VO2/HR, teknik)',
    hint: 'RAST 6×35m + VO2/HR + checklist teknik.',
  },
  time_trial: {
    shortLabel: 'Time trial',
    label: 'Time trial (VDOT)',
    hint: 'Time trial di jarak yang sudah dipakai sebelumnya, atau jarak nomor target.',
  },
  jump: {
    shortLabel: 'Tes lompat',
    label: 'Tes lompat (SLJ, VJ, prestasi lomba)',
    hint: 'Standing long jump, vertical jump, dan catatan prestasi lomba bila ada.',
  },
};

// Hari antar tes. time_trial sedikit lebih jarang (adaptasi aerobik lebih lambat).
const INTERVAL_DAYS = {
  sprint:     { umum: 28, khusus: 21, puncak: 14, transisi: 42 },
  jump:       { umum: 28, khusus: 21, puncak: 14, transisi: 42 },
  time_trial: { umum: 28, khusus: 28, puncak: 14, transisi: 42 },
};

const SOON_WINDOW_DAYS = 7;
const TAPER_HOLD_DAYS = 5;
const PRE_COMP_BUFFER_DAYS = 10;

function parseKey(dateKey) {
  if (!dateKey) return null;
  const d = new Date(String(dateKey).slice(0, 10) + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function addDaysKey(dateKey, n) {
  const d = parseKey(dateKey);
  if (!d) return null;
  d.setDate(d.getDate() + n);
  return localDateKey(d);
}

function daysBetween(fromKey, toKey) {
  const a = parseKey(fromKey);
  const b = parseKey(toKey);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

function dayNameOf(dateKey) {
  const d = parseKey(dateKey);
  if (!d) return null;
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
}

function protocolOf(athlete) {
  const catDef = CATEGORIES[athlete && athlete.profile && athlete.profile.kategori];
  return catDef ? catDef.testProtocol : 'sprint';
}

function latestTest(tests, athleteId) {
  const list = (tests || [])
    .filter((t) => athleteId == null || t.athleteId === athleteId)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.id || 0) - (a.id || 0));
  return list[0] || null;
}

function toSession(nextTest) {
  if (!nextTest || !nextTest.date) return null;
  return {
    key: `test-due-${nextTest.date}`,
    label: 'Tes',
    name: nextTest.shortLabel || nextTest.label,
    day: nextTest.dayName,
    goal: nextTest.hint,
    targetRPE: null,
    durationMin: 40,
    volume: null,
    mode: 'test',
    source: 'test',
    sessionDate: nextTest.date,
    sessionIndex: null,
  };
}

/**
 * @returns {object} nextTest payload (selalu objek; date bisa null saat taper hold)
 */
function computeNextTest(athlete, tests, referenceDate = new Date()) {
  const today = localDateKey(referenceDate);
  const protocol = protocolOf(athlete);
  const meta = PROTOCOL_META[protocol] || PROTOCOL_META.sprint;
  const phaseInfo = computePhase(athlete && athlete.periodization, referenceDate);
  const phase = (phaseInfo && phaseInfo.phase) || 'umum';
  const byProtocol = INTERVAL_DAYS[protocol] || INTERVAL_DAYS.sprint;
  const intervalDays = byProtocol[phase] || byProtocol.umum;
  const last = latestTest(tests, athlete && athlete.id);
  const lastDate = last ? String(last.date).slice(0, 10) : null;
  const startDate = athlete && athlete.periodization && athlete.periodization.startDate
    ? String(athlete.periodization.startDate).slice(0, 10)
    : null;
  const compDate = athlete && athlete.periodization && athlete.periodization.compDate
    ? String(athlete.periodization.compDate).slice(0, 10)
    : null;

  const daysToComp = compDate ? daysBetween(today, compDate) : null;
  if (daysToComp != null && daysToComp >= 0 && daysToComp <= TAPER_HOLD_DAYS) {
    return {
      available: true,
      protocol,
      label: meta.label,
      shortLabel: meta.shortLabel,
      hint: 'Minggu kompetisi — jangan tes baru; pakai tes terakhir sebagai rujukan.',
      lastTestDate: lastDate,
      lastTestLabel: last ? (last.label || null) : null,
      intervalDays,
      phase,
      phaseLabel: phaseInfo && phaseInfo.label,
      date: null,
      dayName: null,
      daysUntil: null,
      status: 'taperHold',
      statusLabel: 'Ditunda (minggu kompetisi)',
      note: daysToComp === 0
        ? 'Hari kompetisi. Tes lapangan baru tidak dijadwalkan.'
        : `Sisa ${daysToComp} hari ke kompetisi. Tes berikutnya ditunda agar tidak mengganggu taper.`,
    };
  }

  let due;
  let baseline = false;
  if (!lastDate) {
    baseline = true;
    due = today;
    if (startDate && startDate > today) due = startDate;
  } else {
    due = addDaysKey(lastDate, intervalDays);
  }

  if (compDate && due && due >= compDate) {
    const pre = addDaysKey(compDate, -PRE_COMP_BUFFER_DAYS);
    if (pre && pre > today) due = pre;
    else if (pre && lastDate && pre <= lastDate) {
      return {
        available: true,
        protocol,
        label: meta.label,
        shortLabel: meta.shortLabel,
        hint: meta.hint,
        lastTestDate: lastDate,
        lastTestLabel: last ? (last.label || null) : null,
        intervalDays,
        phase,
        phaseLabel: phaseInfo && phaseInfo.label,
        date: null,
        dayName: null,
        daysUntil: null,
        status: 'taperHold',
        statusLabel: 'Cukup dekat kompetisi',
        note: 'Tes terakhir masih dalam jendela menjelang kompetisi. Tidak ada tes baru yang dijadwalkan.',
      };
    }
  }

  const daysUntil = due ? daysBetween(today, due) : null;
  let status = 'scheduled';
  let statusLabel = 'Terjadwal';
  if (baseline) {
    status = 'baseline';
    statusLabel = 'Tes awal belum ada';
  } else if (daysUntil != null && daysUntil < 0) {
    status = 'overdue';
    statusLabel = 'Terlewat';
  } else if (daysUntil != null && daysUntil <= SOON_WINDOW_DAYS) {
    status = 'dueSoon';
    statusLabel = daysUntil === 0 ? 'Hari ini' : 'Sebentar lagi';
  }

  let note;
  if (status === 'baseline') {
    note = 'Belum ada tes tercatat. Jadwalkan tes awal agar pace, VDOT, atau level prestasi bisa dihitung.';
  } else if (status === 'overdue') {
    const late = Math.abs(daysUntil);
    note = `Jadwal ${due} terlewat ${late} hari. Boleh dicatat kapan sempat — bukan peringatan mendesak.`;
  } else if (status === 'dueSoon' && daysUntil === 0) {
    note = 'Jadwal tes jatuh hari ini.';
  } else if (status === 'dueSoon') {
    note = `Jatuh tempo dalam ${daysUntil} hari (interval ${intervalDays} hari di fase ini).`;
  } else {
    note = `Berikutnya ${intervalDays} hari setelah tes terakhir (${lastDate}).`;
  }

  return {
    available: true,
    protocol,
    label: meta.label,
    shortLabel: meta.shortLabel,
    hint: meta.hint,
    lastTestDate: lastDate,
    lastTestLabel: last ? (last.label || null) : null,
    intervalDays,
    phase,
    phaseLabel: phaseInfo && phaseInfo.label,
    date: due,
    dayName: dayNameOf(due),
    daysUntil,
    status,
    statusLabel,
    note,
  };
}

function attachTestToCalendar(calendar, nextTest) {
  if (!calendar || !nextTest || !nextTest.date) return calendar;
  const key = nextTest.date;
  const [y, m] = key.split('-').map(Number);
  if (calendar.year !== y || calendar.month !== m) {
    calendar.nextTest = nextTest;
    return calendar;
  }
  if (!calendar.days) calendar.days = {};
  if (!calendar.days[key]) {
    calendar.days[key] = {
      date: key,
      phase: nextTest.phase || null,
      phaseLabel: nextTest.phaseLabel || null,
      weekLabel: null,
      weekKey: null,
      sessions: [],
    };
  }
  const exists = (calendar.days[key].sessions || []).some((s) => s.mode === 'test' || s.source === 'test');
  if (!exists) {
    calendar.days[key].sessions = calendar.days[key].sessions || [];
    calendar.days[key].sessions.unshift(toSession(nextTest));
  }
  calendar.nextTest = nextTest;
  return calendar;
}

function injectTestSessionIfThisWeek(sessions, nextTest, weekStart, weekEnd) {
  if (!nextTest || !nextTest.date) return sessions || [];
  const list = Array.isArray(sessions) ? sessions.slice() : [];
  if (weekStart && weekEnd && (nextTest.date < weekStart || nextTest.date > weekEnd)) return list;
  if (list.some((s) => s.mode === 'test' || s.source === 'test' || s.key === `test-due-${nextTest.date}`)) return list;
  const sess = toSession(nextTest);
  if (sess) list.unshift(sess);
  return list;
}

module.exports = {
  PROTOCOL_META,
  INTERVAL_DAYS,
  computeNextTest,
  toSession,
  attachTestToCalendar,
  injectTestSessionIfThisWeek,
};
