/**
 * Aturan akses / trial / langganan Atletik Pro Id.
 *
 * Prioritas (tinggi → rendah):
 * 1. Admin
 * 2. subscriptionEndsAt di masa depan → monthly / annual
 * 3. (legacy) hasLifetimeAccess dikonversi ke annual saat load DB
 * 4. Trial 30 hari sejak trialStartedAt
 * 5. Expired → batas EXPIRED_ATHLETE_LIMIT atlet
 */

const TRIAL_DAYS = 30;
const EXPIRED_ATHLETE_LIMIT = 2;
const TRIAL_ATHLETE_SOFT_LIMIT = 20;
const MONTHLY_DAYS = 30;
const ANNUAL_DAYS = 365;

function daysBetween(fromDate, toDate) {
  const a = new Date(fromDate);
  const b = new Date(toDate);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function getAccessStatus(user, athleteCount = 0, now = new Date()) {
  if (!user) {
    return {
      plan: 'none',
      trialDaysTotal: TRIAL_DAYS,
      trialDaysLeft: 0,
      trialEndsAt: null,
      subscriptionEndsAt: null,
      subscriptionDaysLeft: null,
      athleteLimit: 0,
      athleteCount: 0,
      canAddAthlete: false,
      isExpired: true,
      message: 'Belum login',
    };
  }

  if (user.role === 'admin') {
    return {
      plan: 'admin',
      trialDaysTotal: TRIAL_DAYS,
      trialDaysLeft: null,
      trialEndsAt: null,
      subscriptionEndsAt: null,
      subscriptionDaysLeft: null,
      athleteLimit: null,
      athleteCount,
      canAddAthlete: true,
      isExpired: false,
      message: 'Akses admin penuh',
    };
  }

  // Legacy flag lifetime → perlakukan sebagai annual aktif
  if (user.hasLifetimeAccess === true && !user.subscriptionEndsAt) {
    const end = new Date(now.getTime() + ANNUAL_DAYS * 24 * 60 * 60 * 1000);
    return {
      plan: 'annual',
      trialDaysTotal: TRIAL_DAYS,
      trialDaysLeft: null,
      trialEndsAt: null,
      subscriptionEndsAt: end.toISOString(),
      subscriptionDaysLeft: ANNUAL_DAYS,
      athleteLimit: null,
      athleteCount,
      canAddAthlete: true,
      isExpired: false,
      message: `Langganan tahunan aktif — ${ANNUAL_DAYS} hari tersisa.`,
    };
  }

  // Langganan berjangka (bulanan atau tahunan)
  if (user.subscriptionEndsAt) {
    const subEnd = new Date(user.subscriptionEndsAt);
    if (!isNaN(subEnd.getTime()) && subEnd > now) {
      const daysLeft = Math.max(0, daysBetween(now, subEnd));
      const isAnnual = daysLeft > 45 || user.billingPlan === 'annual';
      return {
        plan: isAnnual ? 'annual' : 'monthly',
        trialDaysTotal: TRIAL_DAYS,
        trialDaysLeft: null,
        trialEndsAt: null,
        subscriptionEndsAt: subEnd.toISOString(),
        subscriptionDaysLeft: daysLeft,
        athleteLimit: null,
        athleteCount,
        canAddAthlete: true,
        isExpired: false,
        message: daysLeft <= 5
          ? `Langganan berakhir dalam ${daysLeft} hari. Perpanjang agar akses tidak terputus.`
          : (isAnnual
            ? `Langganan tahunan aktif — ${daysLeft} hari tersisa.`
            : `Langganan bulanan aktif — ${daysLeft} hari tersisa.`),
      };
    }
  }

  const started = user.trialStartedAt
    ? new Date(user.trialStartedAt)
    : (user.createdAt ? new Date(user.createdAt) : now);
  const endsAt = new Date(started.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const elapsed = daysBetween(started, now);
  const daysLeft = Math.max(0, TRIAL_DAYS - elapsed);
  const isExpired = now >= endsAt;

  if (!isExpired) {
    const atSoftLimit = athleteCount >= TRIAL_ATHLETE_SOFT_LIMIT;
    return {
      plan: 'trial',
      trialDaysTotal: TRIAL_DAYS,
      trialDaysLeft: daysLeft,
      trialEndsAt: endsAt.toISOString(),
      subscriptionEndsAt: null,
      subscriptionDaysLeft: null,
      athleteLimit: TRIAL_ATHLETE_SOFT_LIMIT,
      athleteCount,
      canAddAthlete: !atSoftLimit,
      isExpired: false,
      message: daysLeft <= 7
        ? `Trial tersisa ${daysLeft} hari. Pilih paket bulanan atau tahunan.`
        : `Masa trial aktif — ${daysLeft} hari tersisa.`,
    };
  }

  const canAdd = athleteCount < EXPIRED_ATHLETE_LIMIT;
  return {
    plan: 'expired',
    trialDaysTotal: TRIAL_DAYS,
    trialDaysLeft: 0,
    trialEndsAt: endsAt.toISOString(),
    subscriptionEndsAt: user.subscriptionEndsAt || null,
    subscriptionDaysLeft: 0,
    athleteLimit: EXPIRED_ATHLETE_LIMIT,
    athleteCount,
    canAddAthlete: canAdd,
    isExpired: true,
    message: canAdd
      ? `Akses berakhir. Maksimal ${EXPIRED_ATHLETE_LIMIT} atlet. Aktifkan paket bulanan atau tahunan.`
      : `Akses berakhir. Batas ${EXPIRED_ATHLETE_LIMIT} atlet tercapai. Aktifkan paket bulanan atau tahunan.`,
  };
}

function assertCanAddAthlete(user, athleteCount) {
  const status = getAccessStatus(user, athleteCount);
  if (status.canAddAthlete) return { ok: true, status };
  return {
    ok: false,
    status,
    error: status.plan === 'expired'
      ? `Masa akses berakhir. Maksimal ${status.athleteLimit} atlet. Aktifkan paket berbayar.`
      : `Batas maksimal ${status.athleteLimit} atlet tercapai pada paket Anda.`,
  };
}

/**
 * Perpanjang langganan bulanan: dari max(sekarang, endsAt lama) + MONTHLY_DAYS.
 */
function extendSubscription(user, days, now = new Date()) {
  const add = Number(days) > 0 ? Number(days) : MONTHLY_DAYS;
  const base = user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > now
    ? new Date(user.subscriptionEndsAt)
    : now;
  const next = new Date(base.getTime() + add * 24 * 60 * 60 * 1000);
  user.subscriptionEndsAt = next.toISOString();
  return user.subscriptionEndsAt;
}

function extendMonthlySubscription(user, now = new Date()) {
  user.billingPlan = 'monthly';
  return extendSubscription(user, MONTHLY_DAYS, now);
}

function extendAnnualSubscription(user, now = new Date()) {
  user.billingPlan = 'annual';
  return extendSubscription(user, ANNUAL_DAYS, now);
}

/** Konversi member lifetime lama menjadi paket tahunan (365 hari dari sekarang). */
function convertLifetimeUserToAnnual(user, now = new Date()) {
  if (!user || user.hasLifetimeAccess !== true) return false;
  user.hasLifetimeAccess = false;
  user.billingPlan = 'annual';
  const currentEnd = user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : null;
  const annualEnd = new Date(now.getTime() + ANNUAL_DAYS * 24 * 60 * 60 * 1000);
  if (currentEnd && !isNaN(currentEnd.getTime()) && currentEnd > annualEnd) {
    user.subscriptionEndsAt = currentEnd.toISOString();
  } else {
    user.subscriptionEndsAt = annualEnd.toISOString();
  }
  return true;
}

function revokePaidMembership(user) {
  if (!user) return;
  user.hasLifetimeAccess = false;
  user.billingPlan = null;
  user.subscriptionEndsAt = null;
}

module.exports = {
  TRIAL_DAYS,
  EXPIRED_ATHLETE_LIMIT,
  TRIAL_ATHLETE_SOFT_LIMIT,
  MONTHLY_DAYS,
  ANNUAL_DAYS,
  getAccessStatus,
  assertCanAddAthlete,
  extendSubscription,
  extendMonthlySubscription,
  extendAnnualSubscription,
  convertLifetimeUserToAnnual,
  revokePaidMembership,
};
