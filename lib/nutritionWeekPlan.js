// Rencana menu mingguan per atlet — fixed Senin–Minggu, recall, override.
const db = require('../db');
const { localDateKey } = require('./dateUtil');
const { computeNutritionPlan } = require('./nutritionEngine');
const { composeDayMenu } = require('./menuComposer');
const { computePhase } = require('./periodization');
const { CATEGORIES } = require('./categories');
const { isOngoingInjuryStatus } = require('./injuryStatus');

const DAY_MS = 24 * 60 * 60 * 1000;

function parseLocalDate(key) {
  return new Date(key + 'T12:00:00');
}

/** Senin minggu berjalan (local) untuk tanggal referensi */
function mondayOfWeek(dateKey) {
  const d = parseLocalDate(dateKey || localDateKey(new Date()));
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateKey(d);
}

function addDays(dateKey, n) {
  const d = parseLocalDate(dateKey);
  d.setDate(d.getDate() + n);
  return localDateKey(d);
}

function typeFor(kategori) {
  const catDef = CATEGORIES[kategori];
  const protocol = catDef ? catDef.testProtocol : 'sprint';
  return protocol === 'time_trial' ? 'endurance' : 'sprint_power';
}

function activeInjury(athleteId, data, onDateKey) {
  const list = (data.injuryReports || []).filter(
    (r) => r.athleteId === athleteId && isOngoingInjuryStatus(r.status)
  );
  if (!list.length) return null;
  // Ambil onset terbaru yang masih aktif
  list.sort((a, b) => String(b.onsetDate || b.createdAt || '').localeCompare(String(a.onsetDate || a.createdAt || '')));
  const inj = list[0];
  const onset = (inj.onsetDate || (inj.createdAt && String(inj.createdAt).slice(0, 10)) || onDateKey);
  const end = addDays(onset, 6); // paket 7 hari inklusif
  return { injury: inj, packageStart: onset, packageEnd: end };
}

function phaseKeyOf(athlete) {
  const info = computePhase(athlete.periodization);
  return (info && info.phase) || 'umum';
}

function isDateInRange(dateKey, start, end) {
  return dateKey >= start && dateKey <= end;
}

function buildDayEntry(athlete, data, dateKey, seedBase, forceRecovery) {
  const plan = computeNutritionPlan(athlete, data);
  if (!plan.available) {
    return {
      date: dateKey,
      available: false,
      reason: plan.reason,
      slots: [],
      totals: null,
      mode: 'unavailable',
    };
  }
  const recovery = !!forceRecovery;
  const type = typeFor(athlete.profile.kategori);
  const phaseKey = phaseKeyOf(athlete);
  const dayMenu = composeDayMenu({
    targets: plan.targets,
    type,
    phaseKey,
    recoveryMode: recovery,
    seed: `${seedBase}|${dateKey}|${recovery ? 'R' : 'N'}|${phaseKey}`,
    alergi: athlete.profile.alergiMakanan,
    pantangan: athlete.profile.pantanganMakanan,
  });
  return {
    date: dateKey,
    available: true,
    mode: dayMenu.mode,
    phaseKey,
    slots: dayMenu.slots,
    totals: dayMenu.totals,
    targetKcal: dayMenu.targetKcal,
    targets: plan.targets,
  };
}

function generateWeekDays(athlete, data, weekStart, seedBase, injuryPkg) {
  const days = {};
  for (let i = 0; i < 7; i++) {
    const dateKey = addDays(weekStart, i);
    const inInjury =
      injuryPkg && isDateInRange(dateKey, injuryPkg.packageStart, injuryPkg.packageEnd);
    days[dateKey] = buildDayEntry(athlete, data, dateKey, seedBase, inInjury);
  }
  return days;
}

/**
 * Dapatkan / buat plan minggu berjalan. Apply override periodisasi & paket cedera.
 */
function getOrCreateWeekPlan(athlete, data, options) {
  options = options || {};
  const today = options.today || localDateKey(new Date());
  const weekStart = mondayOfWeek(today);
  const weekEnd = addDays(weekStart, 6);

  if (!data.nutritionWeekPlans) data.nutritionWeekPlans = [];

  let plan = data.nutritionWeekPlans.find(
    (p) => p.athleteId === athlete.id && p.weekStart === weekStart && p.status === 'active'
  );

  const phaseNow = phaseKeyOf(athlete);
  const injuryPkg = activeInjury(athlete.id, data, today);
  const seedBase = `a${athlete.id}|w${weekStart}`;

  if (!plan) {
    const days = generateWeekDays(athlete, data, weekStart, seedBase, injuryPkg);
    plan = {
      id: db.nextId(data, 'nutritionWeekPlans'),
      athleteId: athlete.id,
      weekStart,
      weekEnd,
      status: 'active',
      generatedAt: new Date().toISOString(),
      phaseKeyAtGenerate: phaseNow,
      injuryPackage: injuryPkg
        ? {
            start: injuryPkg.packageStart,
            end: injuryPkg.packageEnd,
            location: injuryPkg.injury.location || null,
          }
        : null,
      days,
    };
    data.nutritionWeekPlans.push(plan);
    db.save(data);
    return { plan, created: true, adjusted: false };
  }

  // --- Adjustments on existing plan ---
  let adjusted = false;
  let needSave = false;

  // Periodisasi: jika fase berubah vs snapshot plan → regenerate sisa hari (hari ini ke depan)
  // dan update phaseKeyAtGenerate agar menetap di fase baru untuk sisa minggu + minggu depan (plan baru).
  if (plan.phaseKeyAtGenerate !== phaseNow) {
    for (let i = 0; i < 7; i++) {
      const dateKey = addDays(weekStart, i);
      if (dateKey < today) continue;
      const inInjury =
        injuryPkg && isDateInRange(dateKey, injuryPkg.packageStart, injuryPkg.packageEnd);
      plan.days[dateKey] = buildDayEntry(athlete, data, dateKey, seedBase + `|phase:${phaseNow}`, inInjury);
    }
    plan.phaseKeyAtGenerate = phaseNow;
    plan.lastPeriodizationAdjustAt = new Date().toISOString();
    adjusted = true;
    needSave = true;
  }

  // Cedera: paket 7 hari dari onset. Pastikan hari dalam jendela recovery memakai mode recovery.
  if (injuryPkg) {
    const pkgKey = `${injuryPkg.packageStart}|${injuryPkg.packageEnd}`;
    if (!plan.injuryPackage || `${plan.injuryPackage.start}|${plan.injuryPackage.end}` !== pkgKey) {
      for (let i = 0; i < 7; i++) {
        const dateKey = addDays(weekStart, i);
        if (!isDateInRange(dateKey, injuryPkg.packageStart, injuryPkg.packageEnd)) continue;
        if (dateKey < today) continue; // hari lewat: jangan pakai menu paket cedera
        plan.days[dateKey] = buildDayEntry(athlete, data, dateKey, seedBase + `|inj:${pkgKey}`, true);
      }
      plan.injuryPackage = {
        start: injuryPkg.packageStart,
        end: injuryPkg.packageEnd,
        location: injuryPkg.injury.location || null,
      };
      plan.lastInjuryAdjustAt = new Date().toISOString();
      adjusted = true;
      needSave = true;
    }
  } else if (plan.injuryPackage) {
    // Paket cedera sudah habis / tidak aktif — hari sisa minggu yang masih bertanda recovery
    // di luar packageEnd dikembalikan normal (hanya dari today ke depan).
    const end = plan.injuryPackage.end;
    for (let i = 0; i < 7; i++) {
      const dateKey = addDays(weekStart, i);
      if (dateKey < today) continue;
      if (dateKey <= end) continue;
      const entry = plan.days[dateKey];
      if (entry && entry.mode === 'recovery') {
        plan.days[dateKey] = buildDayEntry(athlete, data, dateKey, seedBase + '|post-inj', false);
        adjusted = true;
        needSave = true;
      }
    }
  }

  if (needSave) {
    plan.updatedAt = new Date().toISOString();
    db.save(data);
  }

  return { plan, created: false, adjusted };
}

function summarizeForClient(plan, today) {
  const todayKey = today || localDateKey(new Date());
  const day = (plan.days && plan.days[todayKey]) || null;
  const ordered = Object.keys(plan.days || {})
    .sort()
    .map((k) => plan.days[k]);
  return {
    weekStart: plan.weekStart,
    weekEnd: plan.weekEnd,
    phaseKey: plan.phaseKeyAtGenerate,
    injuryPackage: (plan.injuryPackage && todayKey >= plan.injuryPackage.start && todayKey <= plan.injuryPackage.end)
      ? plan.injuryPackage
      : null,
    today: todayKey,
    todayMenu: day,
    days: ordered,
    generatedAt: plan.generatedAt,
    updatedAt: plan.updatedAt || null,
  };
}

module.exports = {
  mondayOfWeek,
  addDays,
  getOrCreateWeekPlan,
  summarizeForClient,
  activeInjury,
  isOngoingInjuryStatus,
};
