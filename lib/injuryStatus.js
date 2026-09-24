/**
 * Status cedera di app: active | improving | resolved
 * Data lama / form campuran: aktif | membaik | selesai | sembuh
 */
function normalizeInjuryStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function isResolvedInjuryStatus(status) {
  const s = normalizeInjuryStatus(status);
  return s === 'resolved' || s === 'selesai' || s === 'sembuh';
}

function isOngoingInjuryStatus(status) {
  const s = normalizeInjuryStatus(status);
  if (!s || isResolvedInjuryStatus(s)) return false;
  return s === 'active' || s === 'aktif' || s === 'improving' || s === 'membaik';
}

module.exports = {
  normalizeInjuryStatus,
  isResolvedInjuryStatus,
  isOngoingInjuryStatus,
};
