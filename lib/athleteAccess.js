/**
 * Aturan akses paket untuk ATLET MANDIRI (sport enthusiast tanpa pelatih).
 *
 * Atlet yang terhubung ke pelatih lewat kode undangan TIDAK memakai aturan
 * ini — akses mereka diatur pelatih (athleteLinks.programAccess). File ini
 * hanya untuk akun atlet yang profilnya dibuat sendiri (link.selfCoached).
 *
 * Prioritas (tinggi → rendah):
 * 1. subscriptionEndsAt di masa depan → premium (bulanan / tahunan)
 * 2. Trial ATHLETE_TRIAL_DAYS hari sejak trialStartedAt → premium (trial)
 * 3. Selain itu → free (ringkasan sesi & target nutrisi saja)
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TRIAL_DAYS = 7;

function trialDays() {
  const raw = process.env.ATHLETE_TRIAL_DAYS;
  if (raw === undefined || raw === '') return DEFAULT_TRIAL_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_TRIAL_DAYS;
}

function getAthleteAccess(athleteUser, now = new Date()) {
  const total = trialDays();
  if (!athleteUser) {
    return { plan: 'none', premium: false, trialDaysTotal: total, trialDaysLeft: 0, trialEndsAt: null, subscriptionEndsAt: null, subscriptionDaysLeft: null, message: 'Belum login' };
  }

  if (athleteUser.subscriptionEndsAt) {
    const end = new Date(athleteUser.subscriptionEndsAt);
    if (!isNaN(end.getTime()) && end > now) {
      const daysLeft = Math.max(0, Math.ceil((end - now) / DAY_MS));
      const plan = athleteUser.billingPlan === 'annual' ? 'annual' : 'monthly';
      return {
        plan,
        premium: true,
        trialDaysTotal: total,
        trialDaysLeft: null,
        trialEndsAt: null,
        subscriptionEndsAt: end.toISOString(),
        subscriptionDaysLeft: daysLeft,
        message: daysLeft <= 5
          ? `Paket Premium berakhir dalam ${daysLeft} hari. Perpanjang agar program tidak terkunci.`
          : `Paket Premium ${plan === 'annual' ? 'tahunan' : 'bulanan'} aktif — ${daysLeft} hari tersisa.`,
      };
    }
  }

  const started = athleteUser.trialStartedAt ? new Date(athleteUser.trialStartedAt) : null;
  if (started && !isNaN(started.getTime()) && total > 0) {
    const endsAt = new Date(started.getTime() + total * DAY_MS);
    if (now < endsAt) {
      const daysLeft = Math.max(1, Math.ceil((endsAt - now) / DAY_MS));
      return {
        plan: 'trial',
        premium: true,
        trialDaysTotal: total,
        trialDaysLeft: daysLeft,
        trialEndsAt: endsAt.toISOString(),
        subscriptionEndsAt: null,
        subscriptionDaysLeft: null,
        message: `Coba gratis Premium — ${daysLeft} hari tersisa.`,
      };
    }
    return {
      plan: 'free',
      premium: false,
      trialDaysTotal: total,
      trialDaysLeft: 0,
      trialEndsAt: endsAt.toISOString(),
      subscriptionEndsAt: athleteUser.subscriptionEndsAt || null,
      subscriptionDaysLeft: 0,
      message: 'Masa coba gratis selesai. Buka detail program & menu mingguan dengan Premium.',
    };
  }

  return {
    plan: 'free',
    premium: false,
    trialDaysTotal: total,
    trialDaysLeft: 0,
    trialEndsAt: null,
    subscriptionEndsAt: athleteUser.subscriptionEndsAt || null,
    subscriptionDaysLeft: 0,
    message: 'Paket gratis. Buka detail program & menu mingguan dengan Premium.',
  };
}

/** Perpanjang dari max(sekarang, akhir langganan lama) + days. */
function extendAthleteSubscription(athleteUser, planId, days, now = new Date()) {
  const base = athleteUser.subscriptionEndsAt && new Date(athleteUser.subscriptionEndsAt) > now
    ? new Date(athleteUser.subscriptionEndsAt)
    : now;
  athleteUser.billingPlan = planId === 'annual' ? 'annual' : 'monthly';
  athleteUser.subscriptionEndsAt = new Date(base.getTime() + days * DAY_MS).toISOString();
  return athleteUser.subscriptionEndsAt;
}

module.exports = { getAthleteAccess, extendAthleteSubscription, trialDays };
