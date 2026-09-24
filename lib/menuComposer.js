// Penyusun menu harian/mingguan deterministic dari subset pangan Indonesia.
// Bukan AI — pilih kombinasi item mendekati target makro per slot.
const fs = require('fs');
const path = require('path');

const FOODS_PATH = path.join(__dirname, '..', 'data', 'foods-id.json');

let _foodsCache = null;
function loadFoods() {
  if (_foodsCache) return _foodsCache;
  const raw = JSON.parse(fs.readFileSync(FOODS_PATH, 'utf8'));
  _foodsCache = raw.foods || [];
  return _foodsCache;
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  if (!arr.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

function scaleFood(food, grams) {
  const f = grams / 100;
  return {
    foodId: food.id,
    name: food.name,
    grams: Math.round(grams),
    kcal: Math.round(food.kcal * f),
    p: Math.round(food.p * f * 10) / 10,
    f: Math.round(food.f * f * 10) / 10,
    c: Math.round(food.c * f * 10) / 10,
  };
}

function sumItems(items) {
  return items.reduce(
    (a, it) => ({
      kcal: a.kcal + (it.kcal || 0),
      p: a.p + (it.p || 0),
      f: a.f + (it.f || 0),
      c: a.c + (it.c || 0),
    }),
    { kcal: 0, p: 0, f: 0, c: 0 }
  );
}

function filterAllergies(foods, alergiText, pantanganText) {
  // "Tidak ada" dicek PER FIELD — sebelumnya dicek pada gabungan teks, jadi
  // alergi "Tidak ada" + pantangan "Vegetarian" membuat pantangan diabaikan.
  const norm = (t) => {
    const s = String(t || '').trim().toLowerCase();
    return s === 'tidak ada' ? '' : s;
  };
  const raw = `${norm(alergiText)} ${norm(pantanganText)}`;
  if (!raw.trim()) return foods;
  const vegetarian = raw.includes('vegetarian') || raw.includes('vegan');
  return foods.filter((food) => {
    const n = food.name.toLowerCase();
    if (vegetarian && ['ayam', 'daging', 'ikan', 'sapi', 'udang', 'babi', 'bebek', 'kambing'].some((w) => n.includes(w))) return false;
    if (raw.includes('vegan') && ['telur', 'susu', 'yogurt', 'keju'].some((w) => n.includes(w))) return false;
    if (raw.includes('telur') && n.includes('telur')) return false;
    if ((raw.includes('susu') || raw.includes('laktosa')) && (n.includes('susu') || n.includes('yogurt') || n.includes('keju'))) return false;
    if (raw.includes('kacang') && (n.includes('kacang') || n.includes('selai'))) return false;
    if ((raw.includes('ikan') || raw.includes('seafood')) && n.includes('ikan')) return false;
    if (raw.includes('ayam') && n.includes('ayam')) return false;
    if (raw.includes('daging') && n.includes('daging')) return false;
    if ((raw.includes('gluten') || raw.includes('gandum')) && (n.includes('roti') || n.includes('mie') || n.includes('oatmeal'))) return false;
    return true;
  });
}

function byTag(foods, tag) {
  return foods.filter((f) => (f.tags || []).includes(tag));
}

/**
 * @param {object} opts
 * @param {object} opts.targets - { kaloriKcalPerHari, karbohidratGramPerHari, proteinGramPerHari, lemakPersenKalori }
 * @param {string} opts.type - 'endurance' | 'sprint_power'
 * @param {string} opts.phaseKey
 * @param {boolean} opts.recoveryMode - paket cedera
 * @param {string} opts.seed - deterministic
 * @param {string} [opts.alergi]
 * @param {string} [opts.pantangan]
 */
function composeDayMenu(opts) {
  const foodsAll = filterAllergies(loadFoods(), opts.alergi, opts.pantangan);
  const rng = mulberry32(hashSeed(opts.seed || 'default'));
  const targets = opts.targets || {};
  const dayKcal = targets.kaloriKcalPerHari || 2200;
  const recovery = !!opts.recoveryMode;
  const endurance = opts.type === 'endurance';

  // Alokasi kasar slot (% kcal)
  const shares = recovery
    ? { breakfast: 0.25, pre: 0.1, post: 0.3, dinner: 0.35 }
    : endurance
      ? { breakfast: 0.25, pre: 0.15, post: 0.25, dinner: 0.35 }
      : { breakfast: 0.28, pre: 0.12, post: 0.25, dinner: 0.35 };

  const slotsSpec = [
    { key: 'breakfast', label: 'Sarapan', share: shares.breakfast, prefer: recovery ? ['recovery', 'protein'] : ['pokok', 'protein'] },
    { key: 'pre', label: 'Sebelum latihan', share: shares.pre, prefer: ['pre', 'karbo', 'low-fiber'] },
    { key: 'post', label: 'Setelah latihan', share: shares.post, prefer: recovery ? ['recovery', 'protein'] : ['protein', 'karbo', 'recovery'] },
    { key: 'dinner', label: 'Makan malam', share: shares.dinner, prefer: ['pokok', 'protein', 'sayur'] },
  ];

  const slots = [];
  for (const spec of slotsSpec) {
    const slotTarget = dayKcal * spec.share;
    const items = [];

    const pokokPool = byTag(foodsAll, 'pokok').concat(byTag(foodsAll, 'karbo'));
    const laukPool = byTag(foodsAll, 'lauk').concat(byTag(foodsAll, 'protein'));
    const sayurPool = byTag(foodsAll, 'sayur');
    const buahPool = byTag(foodsAll, 'buah');
    const drinkPool = byTag(foodsAll, 'minuman').filter((f) => f.id !== 'air-mineral');

    // Preferensi tipe
    let pokok = pick(rng, pokokPool.filter((f) => (endurance ? true : !(f.tags || []).includes('endurance') || (f.tags || []).includes('sprint'))) || pokokPool);
    if (!pokok) pokok = pick(rng, foodsAll);
    let lauk = pick(rng, laukPool);
    let sayur = pick(rng, sayurPool);
    let buah = pick(rng, buahPool);

    if (spec.key === 'pre') {
      // Ringan: karbo cepat + buah
      pokok = pick(rng, byTag(foodsAll, 'pre').concat(byTag(foodsAll, 'karbo'))) || pokok;
      lauk = null;
      sayur = null;
      buah = pick(rng, byTag(foodsAll, 'pre').concat(buahPool)) || buah;
    }
    if (spec.key === 'post' && recovery) {
      lauk = pick(rng, byTag(foodsAll, 'recovery').filter((f) => (f.tags || []).includes('protein')).concat(laukPool)) || lauk;
    }

    // Gram kasar agar mendekati slotTarget
    if (pokok) {
      const g = spec.key === 'pre' ? 40 + rng() * 40 : 120 + rng() * 80;
      items.push(scaleFood(pokok, g));
    }
    if (lauk) {
      const g = recovery ? 100 + rng() * 50 : 80 + rng() * 60;
      items.push(scaleFood(lauk, g));
    }
    if (sayur && spec.key !== 'pre') {
      items.push(scaleFood(sayur, 80 + rng() * 60));
    }
    if (buah) {
      items.push(scaleFood(buah, 80 + rng() * 50));
    }
    if (spec.key === 'post') {
      const drink = pick(rng, byTag(foodsAll, 'recovery').filter((f) => (f.tags || []).includes('minuman')).concat(drinkPool));
      if (drink) items.push(scaleFood(drink, drink.id === 'air-kelapa' ? 250 : 200));
    }

    // Scale total mendekati slotTarget (kasar)
    let tot = sumItems(items);
    if (tot.kcal > 0 && Math.abs(tot.kcal - slotTarget) / slotTarget > 0.35) {
      const factor = slotTarget / tot.kcal;
      items.forEach((it) => {
        it.grams = Math.max(20, Math.round(it.grams * factor));
        const food = foodsAll.find((f) => f.id === it.foodId);
        if (food) {
          const scaled = scaleFood(food, it.grams);
          it.kcal = scaled.kcal;
          it.p = scaled.p;
          it.f = scaled.f;
          it.c = scaled.c;
        }
      });
      tot = sumItems(items);
    }

    slots.push({
      key: spec.key,
      label: spec.label,
      items,
      totals: {
        kcal: Math.round(tot.kcal),
        p: Math.round(tot.p),
        f: Math.round(tot.f * 10) / 10,
        c: Math.round(tot.c),
      },
    });
  }

  const dayTotals = slots.reduce(
    (a, s) => ({
      kcal: a.kcal + s.totals.kcal,
      p: a.p + s.totals.p,
      f: a.f + s.totals.f,
      c: a.c + s.totals.c,
    }),
    { kcal: 0, p: 0, f: 0, c: 0 }
  );
  dayTotals.f = Math.round(dayTotals.f * 10) / 10;

  return {
    mode: recovery ? 'recovery' : 'normal',
    type: opts.type || 'sprint_power',
    phaseKey: opts.phaseKey || 'umum',
    slots,
    totals: dayTotals,
    targetKcal: dayKcal,
  };
}

module.exports = { composeDayMenu, loadFoods, hashSeed };
