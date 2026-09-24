// Pratinjau program & nutrisi untuk pengunjung selling page (belum punya
// akun). Dihitung dari atlet VIRTUAL di memori — tidak ada yang disimpan ke
// database. Yang "terkunci" dipotong di SERVER (bukan cuma di-blur di
// tampilan), jadi detail berbayar tidak ikut terkirim ke browser.
const { assembleProgram } = require('./programAssembler');
const { computeNutritionPlan } = require('./nutritionEngine');
const { composeDayMenu } = require('./menuComposer');
const { CATEGORIES } = require('./categories');
const { buildSelfDraft } = require('./selfProfile');
const { buildSessionGuide } = require('./sessionGuide');
const { localDateKey } = require('./dateUtil');

const PREVIEW_ATHLETE_ID = -1;
const FREE_MEAL_SLOTS = ['breakfast'];

function typeFor(kategori) {
  const catDef = CATEGORIES[kategori];
  return catDef && catDef.testProtocol === 'time_trial' ? 'endurance' : 'sprint_power';
}

function lockedSession(s) {
  return {
    label: s.label || null,
    name: s.name || 'Sesi',
    day: s.day || null,
    locked: true,
  };
}

function totalWeeks(periodization) {
  const start = new Date(periodization.startDate + 'T00:00:00');
  const comp = new Date(periodization.compDate + 'T00:00:00');
  return Math.max(1, Math.round((comp - start) / (7 * 24 * 60 * 60 * 1000)));
}

/**
 * @returns {{ ok: true, preview } | { ok: false, errors: string[] }}
 */
function buildTrialPreview(answers, now = new Date()) {
  const draft = buildSelfDraft(answers, { now, defaultName: 'Atlet' });
  if (draft.errors.length) return { ok: false, errors: draft.errors };

  const athlete = {
    id: PREVIEW_ATHLETE_ID,
    coachId: null,
    profile: draft.profile,
    periodization: draft.periodization,
  };
  const tests = draft.initialTest ? [{ id: 1, athleteId: PREVIEW_ATHLETE_ID, ...draft.initialTest }] : [];
  const prog = assembleProgram(athlete, tests, [], now);

  const sessions = (prog.sessions || []).map((s, i) => (i === 0
    ? { ...s, locked: false, guide: buildSessionGuide(s, { phase: prog.phase && prog.phase.phase, strengthBank: prog.strengthBank }) }
    : lockedSession(s)));

  const data = { athletes: [athlete], tests, monitoringLogs: [], injuryReports: [] };
  const nutrition = computeNutritionPlan(athlete, data);
  let menu = null;
  if (nutrition.available) {
    const today = localDateKey(now);
    const day = composeDayMenu({
      targets: nutrition.targets,
      type: typeFor(athlete.profile.kategori),
      phaseKey: prog.phase && prog.phase.phase,
      recoveryMode: false,
      seed: `trial|${athlete.profile.kategori}|${athlete.profile.berat}|${today}`,
      alergi: athlete.profile.alergiMakanan,
      pantangan: athlete.profile.pantanganMakanan,
    });
    menu = {
      targetKcal: day.targetKcal,
      slots: (day.slots || []).map((slot) => (FREE_MEAL_SLOTS.includes(slot.key)
        ? { ...slot, locked: false }
        : { key: slot.key, label: slot.label, kcal: slot.totals ? Math.round(slot.totals.kcal) : null, locked: true })),
    };
  }

  const weeks = totalWeeks(draft.periodization);
  const catDef = CATEGORIES[athlete.profile.kategori];
  return {
    ok: true,
    preview: {
      event: athlete.profile.event,
      kategori: athlete.profile.kategori,
      kategoriLabel: catDef ? catDef.label : athlete.profile.kategori,
      level: draft.meta.levelLabel,
      targetMode: draft.meta.targetMode,
      estimated: { best100m: draft.meta.best100mEstimated, timeTrial: draft.meta.ttEstimated },
      periodization: draft.periodization,
      totalWeeks: weeks,
      lockedWeeks: Math.max(0, weeks - 1),
      phase: prog.phase ? { phase: prog.phase.phase, label: prog.phase.label, remainingWeeks: prog.phase.remainingWeeks } : null,
      weekFocus: prog.weekPlan ? prog.weekPlan.label : null,
      racePrediction: prog.racePrediction ? { event: prog.racePrediction.event, predictedSec: Math.round(prog.racePrediction.predictedSec) } : null,
      sessions,
      nutrition: nutrition.available
        ? {
            available: true,
            phaseLabel: nutrition.phaseLabel,
            targets: nutrition.targets,
            ringkasan: nutrition.ringkasanSingkat,
            sumberPedoman: nutrition.sumberPedoman,
            menu,
          }
        : { available: false, reason: nutrition.reason },
      note: prog.note || null,
    },
  };
}

module.exports = { buildTrialPreview };
