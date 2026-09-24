const { assembleProgram } = require('./programAssembler');
const { localDateKey: dateKey } = require('./dateUtil');
const { applyOverridesToSessions } = require('./sessionOverride');

const DAY_NAME_TO_OFFSET = {
  Senin: 0,
  Selasa: 1,
  Rabu: 2,
  Kamis: 3,
  Jumat: 4,
  Sabtu: 5,
  Minggu: 6,
};

function mondayOnOrBefore(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mondayWeekKeyFromDate(d) {
  const mon = mondayOnOrBefore(d);
  return dateKey(mon);
}

/**
 * Bangun kalender bulanan — sesi generate + override replace (menimpa) + extra.
 */
function buildMonthCalendar(athlete, tests, monitoringLogs, year, month, sessionOverrides = []) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const gridStart = mondayOnOrBefore(monthStart);
  const days = {};
  let note = null;

  const per = athlete.periodization || {};
  const startBound = per.startDate ? new Date(per.startDate + 'T00:00:00') : null;
  const endBound = per.compDate ? new Date(per.compDate + 'T00:00:00') : null;

  const allOv = (sessionOverrides || []).filter(
    (o) => o.athleteId === athlete.id && o.status === 'active'
  );

  for (let weekStart = new Date(gridStart); weekStart <= monthEnd; weekStart.setDate(weekStart.getDate() + 7)) {
    const weekMonday = new Date(weekStart);
    const weekSunday = new Date(weekMonday);
    weekSunday.setDate(weekSunday.getDate() + 6);
    if (endBound && weekMonday > endBound) continue;
    if (startBound && weekSunday < startBound) continue;

    const result = assembleProgram(athlete, tests, monitoringLogs, weekMonday, { includePersonalization: false });

    if (!result.phase.phase) {
      note = result.note || null;
      continue;
    }

    const weekKey = dateKey(weekMonday);
    const replaceOv = allOv.filter(
      (o) => o.kind !== 'extra' && (o.weekKey === weekKey || (!o.weekKey && o.kind === 'replace'))
    );
    const merged = applyOverridesToSessions(result.sessions || [], replaceOv);

    for (const s of merged) {
      if (!s.day || DAY_NAME_TO_OFFSET[s.day] == null) continue;
      const sessionDate = new Date(weekMonday);
      sessionDate.setDate(sessionDate.getDate() + DAY_NAME_TO_OFFSET[s.day]);
      if (sessionDate.getMonth() !== month - 1 || sessionDate.getFullYear() !== year) continue;
      if (startBound && sessionDate < startBound) continue;
      if (endBound && sessionDate > endBound) continue;

      const key = dateKey(sessionDate);
      if (!days[key]) {
        days[key] = {
          date: key,
          phase: result.phase.phase,
          phaseLabel: result.phase.label,
          weekLabel: result.weekPlan ? result.weekPlan.label : null,
          weekKey,
          sessions: [],
        };
      }
      days[key].sessions.push({
        ...s,
        source: s.override ? 'override' : 'generated',
        sessionDate: key,
        weekKey,
      });
    }
  }

  // Sesi tambahan (extra)
  const extras = allOv.filter((o) => o.kind === 'extra' && o.date);
  for (const o of extras) {
    const key = o.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const [y, m] = key.split('-').map(Number);
    if (y !== year || m !== month) continue;
    if (!days[key]) {
      days[key] = {
        date: key,
        phase: null,
        phaseLabel: null,
        weekLabel: null,
        weekKey: o.weekKey || null,
        sessions: [],
      };
    }
    days[key].sessions.push({
      key: o.sessionKey || `extra-${o.id}`,
      label: o.originalLabel || `Sesi tambahan ${o.extraNumber || ''}`.trim(),
      name: o.name,
      goal: o.goal,
      targetRPE: o.targetRPE,
      durationMin: o.durationMin,
      volume: o.volume,
      source: 'extra',
      sessionDate: key,
      weekKey: o.weekKey || null,
      sessionIndex: null,
      override: {
        id: o.id,
        libraryId: o.libraryId,
        manual: true,
        kind: 'extra',
        evaluation: o.evaluation || null,
        note: o.note || null,
      },
    });
  }

  return { year, month, days, note };
}

module.exports = { buildMonthCalendar, DAY_NAME_TO_OFFSET, mondayWeekKeyFromDate };
