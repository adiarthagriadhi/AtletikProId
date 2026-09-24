const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { computeNutritionPlan } = require('../lib/nutritionEngine');
const { getOrCreateWeekPlan, summarizeForClient } = require('../lib/nutritionWeekPlan');
const { localDateKey } = require('../lib/dateUtil');

const router = express.Router();

function canAccess(user, athlete) {
  return user.role === 'admin' || athlete.coachId === user.id;
}

function findAthleteOr403(req, res, data) {
  const athlete = data.athletes.find((a) => a.id === Number(req.params.athleteId));
  if (!athlete) {
    res.status(404).json({ error: 'Atlet tidak ditemukan' });
    return null;
  }
  if (!canAccess(req.user, athlete)) {
    res.status(403).json({ error: 'Tidak punya akses ke atlet ini' });
    return null;
  }
  return athlete;
}

// GET /api/athletes/:athleteId/nutrition — target + ringkasan + menu minggu
router.get('/:athleteId/nutrition', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;

  const base = computeNutritionPlan(athlete, data);
  try {
    const { plan, created, adjusted } = getOrCreateWeekPlan(athlete, data, {
      today: localDateKey(new Date()),
    });
    const week = summarizeForClient(plan);
    res.json({
      ...base,
      weekMenu: week,
      weekMeta: { created, adjusted },
    });
  } catch (err) {
    console.error('week menu error', err);
    res.json({ ...base, weekMenu: null, weekMeta: { error: String(err.message || err) } });
  }
});

// POST /api/athletes/:athleteId/nutrition/week/regenerate — paksa susun ulang sisa minggu
router.post('/:athleteId/nutrition/week/regenerate', requireAuth, (req, res) => {
  const data = db.load();
  const athlete = findAthleteOr403(req, res, data);
  if (!athlete) return;

  const today = localDateKey(new Date());
  const { mondayOfWeek, addDays } = require('../lib/nutritionWeekPlan');
  const weekStart = mondayOfWeek(today);
  if (!data.nutritionWeekPlans) data.nutritionWeekPlans = [];
  const existing = data.nutritionWeekPlans.find(
    (p) => p.athleteId === athlete.id && p.weekStart === weekStart && p.status === 'active'
  );
  if (existing) {
    existing.status = 'superseded';
    existing.supersededAt = new Date().toISOString();
  }
  const { plan, created } = getOrCreateWeekPlan(athlete, data, { today });
  res.json({
    ok: true,
    created,
    weekMenu: summarizeForClient(plan, today),
  });
});

module.exports = router;
